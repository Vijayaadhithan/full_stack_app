import express, {
  type Express,
  Request,
  RequestHandler,
  Response,
  NextFunction,
} from "express";
import { createServer, type Server } from "http";
import logger, { LogCategory, runWithLogContext } from "./logger";
import { setupAuth, hashPasswordInternal } from "./auth"; // Added hashPasswordInternal
import {
  sendEmail,
  getPasswordResetEmailContent,
  getMagicLinkEmailContent,
} from "./emailService";
import { storage } from "./storage";
import { sanitizeUser, sanitizeUserList } from "./security/sanitizeUser";
import { z } from "zod";
import multer, { MulterError } from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { getCache, setCache, invalidateCache } from "./cache";
import {
  insertServiceSchema,
  insertBookingSchema,
  insertProductSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertReviewSchema,
  insertUserSchema,
  insertNotificationSchema,
  insertReturnRequestSchema,
  InsertReturnRequest,
  ReturnRequest,
  insertProductReviewSchema,
  insertPromotionSchema,
  insertBlockedTimeSlotSchema, // Added import
  promotions, // Import promotions table for direct updates
  users, // Import the users table schema
  reviews,
  passwordResetTokens as passwordResetTokensTable,
  magicLinkTokens as magicLinkTokensTable,
  User,
  Booking,
  Order,
  type Product,
  type OrderItem,
  PaymentMethodType,
  PaymentMethodSchema,
  ShopProfile,
  shopWorkers,
} from "@shared/schema";
import { platformFees } from "@shared/config";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import crypto from "crypto";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { registerPromotionRoutes } from "./routes/promotions"; // Import promotion routes
import { bookingsRouter } from "./routes/bookings";
import { ordersRouter } from "./routes/orders";
import { registerWorkerRoutes } from "./routes/workers";
import { recordFrontendMetric } from "./monitoring/metrics";
import { performanceMetricEnvelopeSchema } from "./routes/admin";
import { requireShopOrWorkerPermission, getWorkerShopId } from "./workerAuth";
import {
  requestPasswordResetLimiter,
  resetPasswordLimiter,
  emailLookupLimiter,
  magicLinkRequestLimiter,
  magicLinkLoginLimiter,
  usernameLookupLimiter,
} from "./security/rateLimiters";
import {
  notifyBookingChange,
  notifyNotificationChange,
  registerRealtimeClient,
} from "./realtime";
import { createCsrfProtection } from "./security/csrfProtection";
//import { registerShopRoutes } from "./routes/shops"; // Import shop routes
import {
  appApi,
  serviceDetailSchema,
  productDetailSchema,
  orderDetailSchema,
  orderTimelineEntrySchema,
  ServiceDetail,
  ProductDetail,
} from "@shared/api-contract";

const PLATFORM_SERVICE_FEE = platformFees.productOrder;
const SERVICE_DETAIL_CACHE_TTL_MS = 60_000;
const PRODUCT_DETAIL_CACHE_TTL_MS = 60_000;
const SHOP_DETAIL_CACHE_TTL_MS = 120_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIRECTORY = path.join(__dirname, "../uploads");

function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName || "");
  const extension = path.extname(base).slice(0, 10);
  const nameWithoutExt = base.slice(0, base.length - extension.length);
  const normalized =
    nameWithoutExt
      .replace(/[^a-z0-9._-]/gi, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 80) || "upload";
  const cleanedExt = extension.replace(/[^a-z0-9.]/gi, "").toLowerCase();
  if (!cleanedExt) {
    return normalized;
  }
  const ensuredExt = cleanedExt.startsWith(".")
    ? cleanedExt
    : `.${cleanedExt}`;
  return `${normalized}${ensuredExt}`;
}

const uploadStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOADS_DIRECTORY);
  },
  filename(_req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const safeOriginalName = sanitizeFilename(file.originalname);
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

type RequestWithAuth = Request & {
  user?: { id?: number | string; role?: string; isSuspended?: boolean } | null;
  session?: (Request["session"] & { adminId?: string | null }) | null;
};

declare global {
  namespace Express {
    // Stores sanitized, numeric route parameters for downstream handlers.
    interface Request {
      validatedParams?: Record<string, number>;
    }
  }
}

function resolveLogCategory(req: RequestWithAuth): LogCategory {
  const originalUrl = req.originalUrl || req.url || "";
  if (req.session?.adminId || originalUrl.startsWith("/api/admin")) {
    return "admin";
  }

  const role = req.user?.role;
  if (!role) {
    return "other";
  }

  if (role === "provider" || role === "worker") {
    return "service_provider";
  }
  if (role === "shop") {
    return "shop_owner";
  }
  if (role === "customer") {
    return "customer";
  }

  return "other";
}

const isValidDateString = (value: string) =>
  !Number.isNaN(new Date(value).getTime());

const formatUserAddress = (
  user?:
    | Pick<
        User,
        | "addressStreet"
        | "addressCity"
        | "addressState"
        | "addressPostalCode"
        | "addressCountry"
      >
    | null,
) => {
  if (!user) return "";
  const parts = [
    user.addressStreet,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter((part): part is string => Boolean(part && part.trim()));
  return parts.join(", ");
};

type OrderHydrationOptions = {
  includeShop?: boolean;
  includeCustomer?: boolean;
};

type HydratedOrderItem = {
  id: number;
  productId: number | null;
  name: string;
  quantity: number;
  price: string;
  total: string;
};

type HydratedOrder = Order & {
  items: HydratedOrderItem[];
  shop?: { name: string | null; phone: string | null; email: string | null };
  customer?: {
    name: string | null;
    phone: string | null;
    email: string | null;
  };
};

async function hydrateOrders(
  orders: Order[],
  options: OrderHydrationOptions = {},
): Promise<HydratedOrder[]> {
  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const rawItems = await storage.getOrderItemsByOrderIds(orderIds);
  const itemsByOrderId = new Map<number, OrderItem[]>();
  for (const item of rawItems) {
    if (item.orderId == null) continue;
    if (!itemsByOrderId.has(item.orderId)) {
      itemsByOrderId.set(item.orderId, []);
    }
    itemsByOrderId.get(item.orderId)!.push(item);
  }

  const productIds = Array.from(
    new Set(
      rawItems
        .map((item) => item.productId)
        .filter((value): value is number => value !== null),
    ),
  );
  const products =
    productIds.length > 0
      ? await storage.getProductsByIds(productIds)
      : ([] as Product[]);
  const productMap = new Map<number, Product>(
    products.map((product) => [product.id, product]),
  );

  const userIdSet = new Set<number>();
  if (options.includeShop) {
    for (const order of orders) {
      if (order.shopId != null) {
        userIdSet.add(order.shopId);
      }
    }
  }
  if (options.includeCustomer) {
    for (const order of orders) {
      if (order.customerId != null) {
        userIdSet.add(order.customerId);
      }
    }
  }

  const relatedUsers =
    userIdSet.size > 0
      ? await storage.getUsersByIds(Array.from(userIdSet))
      : ([] as User[]);
  const userMap = new Map<number, User>(
    relatedUsers.map((user) => [user.id, user]),
  );

  return orders.map((order) => {
    const orderItems = itemsByOrderId.get(order.id) ?? [];
    const hydratedItems = orderItems.map<HydratedOrderItem>((item) => {
      const product =
        item.productId !== null ? productMap.get(item.productId) : undefined;
      return {
        id: item.id,
        productId: item.productId,
        name: product?.name ?? "",
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      };
    });

    const result: HydratedOrder = {
      ...(order as Order),
      items: hydratedItems,
    };

    if (options.includeShop && order.shopId != null) {
      const shop = userMap.get(order.shopId);
      if (shop) {
        result.shop = {
          name: shop.name,
          phone: shop.phone,
          email: shop.email,
        };
      }
    }

    if (options.includeCustomer && order.customerId != null) {
      const customer = userMap.get(order.customerId);
      if (customer) {
        result.customer = {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        };
      }
    }

    return result;
  });
}

const dateStringSchema = z
  .string()
  .refine(isValidDateString, { message: "Invalid date format" });

const bookingStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "rescheduled",
  "completed",
  "cancelled",
  "expired",
  "rescheduled_pending_provider_approval",
  "awaiting_payment",
  "disputed",
  "rescheduled_by_provider",
]);

const requestPasswordResetSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  })
  .strict();

const emailLookupSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

const magicLinkLoginSchema = z
  .object({
    token: z.string().min(1),
  })
  .strict();

const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000;

const usernameLookupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9._-]+$/, {
        message:
          "Username can include letters, numbers, dots, underscores, and dashes",
      }),
  })
  .strict();

const bookingActionSchema = z
  .object({
    status: bookingStatusSchema.optional(),
    comments: z.string().trim().max(500).optional(),
    bookingDate: dateStringSchema.optional(),
    changedBy: z.number().int().optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== undefined || value.bookingDate !== undefined,
    {
      message: "status or bookingDate is required",
      path: ["status"],
    },
  );

const bookingDisputeSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

const bookingResolutionSchema = z
  .object({
    resolutionStatus: z.enum(["completed", "cancelled"]),
  })
  .strict();

const bookingCreateSchema = z
  .object({
    serviceId: z.number().int().positive(),
    bookingDate: dateStringSchema,
    serviceLocation: z.enum(["customer", "provider"]),
  })
  .strict();

const bookingStatusUpdateSchema = z
  .object({
    status: z.enum(["accepted", "rejected", "rescheduled"]),
    rejectionReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "rejected" && !value.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejection reason is required when rejecting a booking",
        path: ["rejectionReason"],
      });
    }
  });

const paymentReferenceSchema = z
  .object({
    paymentReference: z.string().trim().min(1).max(100),
  })
  .strict();

const waitlistJoinSchema = z
  .object({
    serviceId: z.number().int().positive(),
    preferredDate: dateStringSchema,
  })
  .strict();

const cartItemSchema = z
  .object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1),
  })
  .strict();

const wishlistItemSchema = z
  .object({
    productId: z.number().int().positive(),
  })
  .strict();

const reviewUpdateSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    review: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((value) => value.rating !== undefined || value.review !== undefined, {
    message: "Provide a rating or review to update",
    path: ["rating"],
  });

const reviewReplySchema = z
  .union([
    z
      .object({ response: z.string().trim().min(1).max(2000) })
      .strict(),
    z.object({ reply: z.string().trim().min(1).max(2000) }).strict(),
  ])
  .transform((value) =>
    "response" in value ? { reply: value.response } : { reply: value.reply },
  );

const notificationsMarkAllSchema = z
  .object({
    role: z.enum(["customer", "provider", "shop", "worker", "admin"]).optional(),
  })
  .strict();

const productUpdateSchema = insertProductSchema.partial();

const serviceUpdateSchema = insertServiceSchema
  .partial()
  .extend({
    serviceLocationType: z
      .enum(["customer_location", "provider_location"])
      .optional(),
  });

const orderPaymentReferenceSchema = z
  .object({
    paymentReference: z.string().trim().min(1).max(100),
  })
  .strict();

const orderStatusUpdateSchema = z
  .object({
    status: z.enum([
      "pending",
      "cancelled",
      "confirmed",
      "processing",
      "packed",
      "dispatched",
      "shipped",
      "delivered",
      "returned",
    ]),
    trackingInfo: z.string().trim().max(500).optional(),
  })
  .strict();

const shopsQuerySchema = z
  .object({
    locationCity: z.string().trim().max(100).optional(),
    locationState: z.string().trim().max(100).optional(),
  })
  .strict();

const servicesQuerySchema = z
  .object({
    category: z.string().trim().max(100).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    searchTerm: z.string().trim().max(200).optional(),
    providerId: z.coerce.number().int().positive().optional(),
    locationCity: z.string().trim().max(100).optional(),
    locationState: z.string().trim().max(100).optional(),
    locationPostalCode: z.string().trim().max(20).optional(),
    availabilityDate: dateStringSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: "minPrice cannot be greater than maxPrice",
      path: ["minPrice"],
    },
  );

const statusQuerySchema = z
  .object({
    status: z.string().trim().max(50).optional(),
  })
  .strict();

const servicesAvailabilityQuerySchema = z
  .object({
    date: dateStringSchema,
  })
  .strict();

const productsQuerySchema = z
  .object({
    category: z.string().trim().max(100).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    tags: z.string().trim().optional(),
    searchTerm: z.string().trim().max(200).optional(),
    shopId: z.coerce.number().int().positive().optional(),
    attributes: z.string().trim().optional(),
    locationCity: z.string().trim().max(100).optional(),
    locationState: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: "minPrice cannot be greater than maxPrice",
      path: ["minPrice"],
    },
  );

const formatValidationError = (error: z.ZodError) => ({
  message: "Invalid input",
  errors: error.flatten(),
});

// Helper function to validate and parse date and time
function validateAndParseDateTime(
  dateStr: string,
  timeStr: string,
): Date | null {
  try {
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      logger.error("Invalid date format. Expected YYYY-MM-DD");
      return null;
    }

    // Validate time format (HH:MM)
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
      logger.error("Invalid time format. Expected HH:MM");
      return null;
    }

    // Create a valid date object
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);

    // Month is 0-indexed in JavaScript Date
    const date = new Date(year, month - 1, day, hours, minutes);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      logger.error("Invalid date/time combination");
      return null;
    }

    return date;
  } catch (error) {
    logger.error("Error parsing date/time:", error);
    return null;
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Unauthorized");
  }
  if (req.user?.isSuspended) {
    return res.status(403).json({ message: "Account suspended" });
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const csrfProtection: RequestHandler =
    process.env.NODE_ENV === "test"
      ? ((req, _res, next) => {
          (req as Request & { csrfToken?: () => string }).csrfToken = () =>
            "test-csrf-token";
          next();
        })
      : createCsrfProtection({ ignoreMethods: ["GET", "HEAD", "OPTIONS"] });

  app.use(csrfProtection);

  app.get("/api/events", requireAuth, (req, res) => {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ message: "Unable to open realtime channel" });
      return;
    }
    const socket = req.socket;
    if (socket && typeof socket.setKeepAlive === "function") {
      socket.setKeepAlive(true, 60_000);
    }
    if (socket && typeof socket.setNoDelay === "function") {
      socket.setNoDelay(true);
    }
    registerRealtimeClient(res, userId);
  });

  app.get("/api/csrf-token", (req, res) => {
    res.status(200).json({ csrfToken: req.csrfToken() });
  });

  app.use((req, res, next) => {
    const request = req as RequestWithAuth;
    const category = resolveLogCategory(request);
    const initialContext = {
      category,
      userId: request.user?.id ?? request.session?.adminId ?? undefined,
      userRole: request.user?.role ?? undefined,
      adminId: request.session?.adminId ?? undefined,
    };
    const startedAt = process.hrtime.bigint();

    runWithLogContext(() => {
      if (category !== "admin") {
        res.on("finish", () => {
          const durationNs = process.hrtime.bigint() - startedAt;
          const durationMs = Number(durationNs) / 1_000_000;
          logger.info(
            {
              method: req.method,
              path: req.originalUrl,
              status: res.statusCode,
              durationMs,
            },
            "Request completed",
          );
        });
      }

      next();
    }, initialContext);
  });

  const numericParamSchemas: Record<string, z.ZodTypeAny> = {
    id: z.coerce.number().int().positive(),
    orderId: z.coerce.number().int().positive(),
    productId: z.coerce.number().int().positive(),
    serviceId: z.coerce.number().int().positive(),
    shopId: z.coerce.number().int().positive(),
    slotId: z.coerce.number().int().positive(),
    workerUserId: z.coerce.number().int().positive(),
    userId: z.coerce.number().int().positive(),
    reviewId: z.coerce.number().int().positive(),
  };

  for (const [paramName, schema] of Object.entries(numericParamSchemas)) {
    app.param(paramName, (req, res, next, value) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        return res.status(400).json(formatValidationError(parsed.error));
      }
      if (!req.validatedParams) {
        req.validatedParams = {};
      }
      req.validatedParams[paramName] = parsed.data;
      next();
    });
  }

  const getValidatedParam = (
    req: Request,
    name: keyof typeof numericParamSchemas,
  ): number => {
    const params = req.validatedParams;
    if (!params || typeof params[name] !== "number") {
      throw new Error(`Validated parameter '${String(name)}' is missing`);
    }
    return params[name];
  };

  /**
   * @openapi
   * /api:
   *   get:
   *     summary: List all API endpoints
   *     responses:
   *       200:
   *         description: A JSON array of available endpoints
   */
  app.get("/api", requireAuth, (req, res) => {
    const routes = app._router.stack
      .filter((r: any) => r.route && r.route.path)
      .map((r: any) => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods).join(", ").toUpperCase(),
      }))
      .filter((r: any) => r.path.startsWith("/api/") && r.path !== "/api");
    res.json({ available_endpoints: routes });
  });

  app.post(
    "/api/auth/email-lookup",
    emailLookupLimiter,
    async (req, res) => {
      const parsedBody = emailLookupSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      const { email } = parsedBody.data;
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return res.json({ exists: false });
        }

        return res.json({
          exists: true,
          email: user.email,
          name: user.name,
          hasPassword: Boolean(user.password),
          isSuspended: Boolean((user as any)?.isSuspended),
        });
      } catch (error) {
        logger.error("Error performing email lookup:", error);
        return res.status(500).json({ message: "Unable to process request" });
      }
    },
  );

  app.post(
    "/api/auth/check-username",
    usernameLookupLimiter,
    async (req, res) => {
      const parsedBody = usernameLookupSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      const { username } = parsedBody.data;
      const normalized = username.toLowerCase();
      try {
        const match = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, normalized))
          .limit(1);

        if (match.length > 0) {
          return res.json({ available: false });
        }

        const existing = await storage.getUserByUsername(normalized);
        return res.json({ available: !existing });
      } catch (error) {
        logger.error("Error checking username availability:", error);
        return res.status(500).json({ message: "Unable to validate username" });
      }
    },
  );

  app.post(
    "/api/auth/send-magic-link",
    magicLinkRequestLimiter,
    async (req, res) => {
      const parsedBody = emailLookupSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      const { email } = parsedBody.data;
      try {
        const user = await storage.getUserByEmail(email);
        if (!user || !user.email) {
          return res.json({
            message:
              "If an account with that email exists, a magic link has been sent.",
          });
        }

        if ((user as any)?.isSuspended) {
          return res
            .status(403)
            .json({ message: "Account suspended. Contact support." });
        }

        await db
          .delete(magicLinkTokensTable)
          .where(eq(magicLinkTokensTable.userId, user.id));

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

        await db.insert(magicLinkTokensTable).values({
          userId: user.id,
          tokenHash,
          expiresAt,
        });

        const magicLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/magic-login?token=${rawToken}`;
        const emailContent = getMagicLinkEmailContent(
          user.name || user.username,
          magicLink,
        );

        await sendEmail({
          to: user.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        return res.json({
          message:
            "If an account with that email exists, a magic link has been sent.",
        });
      } catch (error) {
        logger.error("Error sending magic link:", error);
        return res
          .status(500)
          .json({ message: "Unable to send magic link at the moment" });
      }
    },
  );

  app.post(
    "/api/auth/magic-login",
    magicLinkLoginLimiter,
    async (req, res, next) => {
      const parsedBody = magicLinkLoginSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      const tokenHash = crypto
        .createHash("sha256")
        .update(parsedBody.data.token)
        .digest("hex");

      try {
        const tokenRows = await db
          .select()
          .from(magicLinkTokensTable)
          .where(eq(magicLinkTokensTable.tokenHash, tokenHash))
          .limit(1);
        const tokenRecord = tokenRows[0];

        if (
          !tokenRecord ||
          tokenRecord.expiresAt < new Date() ||
          tokenRecord.consumedAt
        ) {
          return res
            .status(400)
            .json({ message: "Invalid or expired magic link" });
        }

        const user = await storage.getUser(tokenRecord.userId);
        if (!user) {
          await db
            .delete(magicLinkTokensTable)
            .where(eq(magicLinkTokensTable.id, tokenRecord.id));
          return res.status(404).json({ message: "User not found" });
        }

        if ((user as any)?.isSuspended) {
          await db
            .delete(magicLinkTokensTable)
            .where(eq(magicLinkTokensTable.id, tokenRecord.id));
          return res
            .status(403)
            .json({ message: "Account suspended. Contact support." });
        }

        await db
          .update(magicLinkTokensTable)
          .set({ consumedAt: new Date() })
          .where(eq(magicLinkTokensTable.id, tokenRecord.id));

        const safeUser = sanitizeUser(user);
        if (!safeUser) {
          return res
            .status(500)
            .json({ message: "Unable to complete magic link login" });
        }

        req.login(safeUser as Express.User, (err) => {
          if (err) return next(err);
          return res.json(safeUser);
        });
      } catch (error) {
        logger.error("Error completing magic link login:", error);
        return res
          .status(500)
          .json({ message: "Unable to complete magic link login" });
      }
    },
  );

  app.post(
    "/api/request-password-reset",
    requestPasswordResetLimiter,
    async (req, res) => {
      const parsedBody = requestPasswordResetSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      const { email } = parsedBody.data;

      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          logger.info(
            `Password reset requested for non-existent email: ${email}`,
          );
          return res.status(200).json({
            message:
              "If an account with that email exists, a password reset link has been sent.",
          });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 3600000);

        await db.insert(passwordResetTokensTable).values({
          userId: user.id,
          token,
          expiresAt,
        });

        const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;
        const emailContent = getPasswordResetEmailContent(
          user.name || user.username,
          resetLink,
        );

        if (user.email) {
          await sendEmail({
            to: user.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
        } else {
          logger.warn(
            `Password reset attempted for user ${user.id}, but no email is available.`,
          );
        }

        return res.status(200).json({
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      } catch (error) {
        logger.error("Error requesting password reset:", error);
        return res
          .status(500)
          .json({ message: "Error processing password reset request" });
      }
    },
  );

  app.post("/api/reset-password", resetPasswordLimiter, async (req, res) => {
    const parsedBody = resetPasswordSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }

    const { token, newPassword } = parsedBody.data;
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    try {
      const tokenRecords = await db
        .select()
        .from(passwordResetTokensTable)
        .where(eq(passwordResetTokensTable.token, token))
        .limit(1);
      const tokenEntry = tokenRecords[0];
      if (!tokenEntry || tokenEntry.expiresAt < new Date()) {
        return res
          .status(400)
          .json({ message: "Invalid or expired password reset token" });
      }

      const user = await storage.getUser(tokenEntry.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const hashedPassword = await hashPasswordInternal(newPassword);
      await storage.updateUser(tokenEntry.userId, { password: hashedPassword });

      await db
        .delete(passwordResetTokensTable)
        .where(eq(passwordResetTokensTable.token, token));

      return res
        .status(200)
        .json({ message: "Password has been reset successfully" });
    } catch (error) {
      logger.error("Error resetting password:", error);
      return res.status(500).json({ message: "Error resetting password" });
    }
  });

  // Register domain routers
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/orders', ordersRouter);
  registerWorkerRoutes(app);

  const uploadSingleFile = uploadMiddleware.single("file");
  const uploadSingleQr = uploadMiddleware.single("qr");

  app.post("/api/upload", requireAuth, (req, res) => {
    uploadSingleFile(req, res, (err) => {
      if (err) {
        const message =
          err instanceof MulterError && err.code === "LIMIT_FILE_SIZE"
            ? "File too large"
            : err instanceof Error
              ? err.message
              : "Upload failed";
        return res.status(400).json({ message });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      res.json({
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
      });
    });
  });

  app.post("/api/users/upload-qr", requireAuth, (req, res) => {
    uploadSingleQr(req, res, (err) => {
      if (err) {
        const message =
          err instanceof MulterError && err.code === "LIMIT_FILE_SIZE"
            ? "File too large"
            : err instanceof Error
              ? err.message
              : "Upload failed";
        return res.status(400).json({ message });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    });
  });

  app.use("/uploads", express.static(UPLOADS_DIRECTORY));

  // Booking Notification System
  // Get pending booking requests for a provider
  app.get(
    "/api/bookings/provider/pending",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const providerId = req.user!.id;
        const pendingBookings =
          await storage.getPendingBookingRequestsForProvider(providerId);

        const serviceIds = Array.from(
          new Set(pendingBookings.map((b) => b.serviceId!).filter(Boolean)),
        );
        const services = await storage.getServicesByIds(serviceIds);
        const serviceMap = new Map(services.map((s) => [s.id, s]));

        const userIds = new Set<number>();
        services.forEach((s) => {
          if (s.providerId) userIds.add(s.providerId);
        });
        pendingBookings.forEach((b) => {
          if (b.customerId) userIds.add(b.customerId);
        });
        const users = await storage.getUsersByIds(Array.from(userIds));
        const userMap = new Map(users.map((u) => [u.id, u]));

        const bookingsWithDetails = pendingBookings.map((b) => {
          const service = serviceMap.get(b.serviceId!);
          const customer = b.customerId ? userMap.get(b.customerId) : undefined;
          const provider =
            service && service.providerId
              ? userMap.get(service.providerId)
              : undefined;

          let relevantAddress = {} as any;
          if (b.serviceLocation === "customer" && customer) {
            relevantAddress = {
              addressStreet: customer.addressStreet,
              addressCity: customer.addressCity,
              addressState: customer.addressState,
              addressPostalCode: customer.addressPostalCode,
              addressCountry: customer.addressCountry,
            };
          }

          return {
            ...b,
            service,
            customer: customer
              ? { id: customer.id, name: customer.name, phone: customer.phone }
              : null,
            provider: provider
              ? { id: provider.id, name: provider.name, phone: provider.phone }
              : null,
            relevantAddress,
          };
        });

        res.json(bookingsWithDetails);
      } catch (error) {
        logger.error("Error fetching pending bookings:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch pending bookings",
          });
      }
    },
  );

  // Accept, reject, or reschedule a booking request
  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    const bookingId = getValidatedParam(req, "id");
    try {
      const parsedBody = bookingActionSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      // Destructure bookingDate as well, it might be undefined if not a reschedule
      const { status, comments, bookingDate, changedBy } = parsedBody.data;
      const currentUser = req.user!;

      logger.info(`[API] Attempting to update booking ${bookingId}`);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        logger.info(`[API] Booking ${bookingId} not found.`);
        return res.status(404).json({ message: "Booking not found" });
      }

      const service = await storage.getService(booking.serviceId!);
      if (!service) {
        logger.info(
          `[API] Service ${booking.serviceId} for booking ${bookingId} not found.`,
        );
        return res
          .status(404)
          .json({ message: "Service not found for this booking" });
      }

      let updatedBookingData = {};
      let notificationPromises = [];

      // Scenario 1: Customer reschedules
      if (
        bookingDate &&
        currentUser.role === "customer" &&
        booking.customerId === currentUser.id
      ) {
        logger.info(
          `[API] Customer ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`,
        );
        const originalBookingDate = booking.bookingDate; // Capture original booking date
        updatedBookingData = {
          bookingDate: new Date(bookingDate),
          status: "rescheduled_pending_provider_approval",
          comments: comments || "Rescheduled by customer",
        };

        if (service.providerId) {
          const providerUser = await storage.getUser(service.providerId);
          if (providerUser) {
            const formattedRescheduleDate = formatIndianDisplay(
              bookingDate,
              "datetime",
            );
            notificationPromises.push(
              storage.createNotification({
                userId: service.providerId,
                type: "booking_rescheduled_request",
                title: "Reschedule Request",
                message: `Customer ${currentUser.name || "ID: " + currentUser.id} requested to reschedule booking #${bookingId} for '${service.name}' to ${formattedRescheduleDate}. Please review.`,
                isRead: false,
                relatedBookingId: bookingId,
              }),
            );
          }
        }
      }
      // Scenario 2: Provider reschedules
      else if (
        bookingDate &&
        currentUser.role === "provider" &&
        service.providerId === currentUser.id
      ) {
        logger.info(
          `[API] Provider ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`,
        );
        const originalBookingDate = booking.bookingDate; // Capture original booking date
        updatedBookingData = {
          bookingDate: new Date(bookingDate),
          status: "rescheduled_by_provider", // Or a more appropriate status like "accepted" if provider reschedule implies auto-acceptance
          comments: comments || "Rescheduled by provider",
        };

        if (booking.customerId) {
          const customerUser = await storage.getUser(booking.customerId);
          if (customerUser) {
            const formattedProviderRescheduleDate = formatIndianDisplay(
              bookingDate,
              "datetime",
            );
            notificationPromises.push(
              storage.createNotification({
                userId: booking.customerId,
                type: "booking_rescheduled_by_provider",
                title: "Booking Rescheduled by Provider",
                message: `Provider ${
                  currentUser.name || "ID: " + currentUser.id
                } has rescheduled your booking #${bookingId} for '${
                  service.name
                }' to ${formattedProviderRescheduleDate}. ${
                  comments ? "Comments: " + comments : ""
                }`,
                isRead: false,
                relatedBookingId: bookingId,
              }),
            );
          }
        }
      }
      // Scenario 3: Provider accepts/rejects a booking (including a customer's reschedule request)
      else if (
        status &&
        currentUser.role === "provider" &&
        service.providerId === currentUser.id
      ) {
        logger.info(
          `[API] Provider ${currentUser.id} updating booking ${bookingId} status to ${status}`,
        );
        updatedBookingData = {
          status,
          comments:
            comments ||
            (status === "accepted" ? "Booking confirmed" : "Booking rejected"),
        };

        if (booking.customerId) {
          const customerUser = await storage.getUser(booking.customerId);
          if (customerUser) {
            let notificationTitle = `Booking ${status === "accepted" ? "Accepted" : "Rejected"}`;
            let notificationMessage = `Your booking for '${service.name}' has been ${status}${comments ? `: ${comments}` : "."}`;
            let emailSubject = `Booking ${status === "accepted" ? "Accepted" : "Rejected"}`;

            if (
              booking.status === "rescheduled_pending_provider_approval" &&
              status === "accepted"
            ) {
              notificationTitle = "Reschedule Confirmed";
              const formattedRescheduledDate = booking.bookingDate
                ? formatIndianDisplay(booking.bookingDate, "datetime")
                : "N/A";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been accepted. New date: ${formattedRescheduledDate}`;
              emailSubject = "Reschedule Confirmed";
            } else if (
              booking.status === "rescheduled_pending_provider_approval" &&
              status === "rejected"
            ) {
              notificationTitle = "Reschedule Rejected";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been rejected. ${comments ? comments : "Please contact the provider or try rescheduling again."}`;
              emailSubject = "Reschedule Rejected";
            }

            notificationPromises.push(
              storage.createNotification({
                userId: booking.customerId,
                type:
                  status === "accepted"
                    ? "booking_confirmed"
                    : "booking_rejected",
                title: notificationTitle,
                message: notificationMessage,
                isRead: false,
                relatedBookingId: bookingId,
              }),
            );
          }
        }
      }
      // Scenario 3: Customer cancels (can be expanded)
      else if (
        status === "cancelled" &&
        currentUser.role === "customer" &&
        booking.customerId === currentUser.id
      ) {
        logger.info(
          `[API] Customer ${currentUser.id} cancelling booking ${bookingId}`,
        );
        updatedBookingData = {
          status: "cancelled",
          comments: comments || "Cancelled by customer",
        };
        if (service.providerId) {
          const providerUser = await storage.getUser(service.providerId);
          if (providerUser) {
            notificationPromises.push(
              storage.createNotification({
                userId: service.providerId,
                type: "booking_cancelled_by_customer",
                title: "Booking Cancelled",
                message: `Booking #${bookingId} for '${service.name}' has been cancelled by the customer.`,
                isRead: false,
                relatedBookingId: bookingId,
              }),
            );
            // Email notifications removed
          }
        }
      } else {
        logger.info(
          `[API] Unauthorized or invalid action for booking ${bookingId} by user ${currentUser.id} with role ${currentUser.role}. Booking owner: ${booking.customerId}, Service provider: ${service.providerId}`,
        );
        return res
          .status(403)
          .json({ message: "Unauthorized or invalid action specified" });
      }

      const finalUpdatedBooking = await storage.updateBooking(
        bookingId,
        updatedBookingData,
      );
      await Promise.all(notificationPromises);

      logger.info(
        `[API] Successfully updated booking ${bookingId}:`,
        finalUpdatedBooking,
      );
      res.json(finalUpdatedBooking);
    } catch (error) {
      logger.error(`[API] Error updating booking ${bookingId}:`, error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to update booking",
        });
    }
  });

  // Get booking requests with status for a customer
  app.get(
    "/api/bookings/customer/requests",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const customerId = req.user!.id;
        const bookingRequests =
          await storage.getBookingRequestsWithStatusForCustomer(customerId);

        // Fetch details for each booking
        const bookingsWithDetails = await Promise.all(
          bookingRequests.map(async (booking: Booking) => {
            const service = await storage.getService(booking.serviceId!);
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null; // Fetch customer (self)
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider

            let relevantAddress = {};
            // If service is at provider's location, show provider address
            if (
              service?.serviceLocationType === "provider_location" &&
              provider
            ) {
              relevantAddress = {
                addressStreet: provider.addressStreet,
                addressCity: provider.addressCity,
                addressState: provider.addressState,
                addressPostalCode: provider.addressPostalCode,
                addressCountry: provider.addressCountry,
              };
            }
            // If service is at customer's location, show customer address
            else if (
              service?.serviceLocationType === "customer_location" &&
              customer
            ) {
              relevantAddress = {
                addressStreet: customer.addressStreet,
                addressCity: customer.addressCity,
                addressState: customer.addressState,
                addressPostalCode: customer.addressPostalCode,
                addressCountry: customer.addressCountry,
              };
            }

            return {
              ...booking,
              service,
              customer: customer
                ? {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                  }
                : null,
              provider: provider
                ? {
                    id: provider.id,
                    name: provider.name,
                    phone: provider.phone,
                  }
                : null,
              relevantAddress, // Add the conditionally determined address
            };
          }),
        );

        res.json(bookingsWithDetails); // Send the response back
      } catch (error) {
        logger.error("Error fetching booking requests:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch booking requests",
          });
      }
    },
  );

  // Get booking history for a customer
  app.get(
    "/api/bookings/customer/history",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const customerId = req.user!.id;
        const bookingHistory =
          await storage.getBookingHistoryForCustomer(customerId);

        // Fetch details for each booking
        const bookingsWithDetails = await Promise.all(
          bookingHistory.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null; // Fetch customer (self)
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider

            let relevantAddress = {};
            // If service is at provider's location, show provider address
            if (
              service?.serviceLocationType === "provider_location" &&
              provider
            ) {
              relevantAddress = {
                addressStreet: provider.addressStreet,
                addressCity: provider.addressCity,
                addressState: provider.addressState,
                addressPostalCode: provider.addressPostalCode,
                addressCountry: provider.addressCountry,
              };
            }
            // If service is at customer's location, show customer address
            else if (
              service?.serviceLocationType === "customer_location" &&
              customer
            ) {
              relevantAddress = {
                addressStreet: customer.addressStreet,
                addressCity: customer.addressCity,
                addressState: customer.addressState,
                addressPostalCode: customer.addressPostalCode,
                addressCountry: customer.addressCountry,
              };
            }

            return {
              ...booking,
              service,
              customer: customer
                ? {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                  }
                : null,
              provider: provider
                ? {
                    id: provider.id,
                    name: provider.name,
                    phone: provider.phone,
                  }
                : null,
              relevantAddress, // Add the conditionally determined address
            };
          }),
        );
        res.json(bookingsWithDetails); // Send details back
      } catch (error) {
        logger.error("Error fetching booking history:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch booking history",
          });
      }
    },
  );

  // Get booking history for a provider
  app.get(
    "/api/bookings/provider/history",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const providerId = req.user!.id;
        const bookingHistory =
          await storage.getBookingHistoryForProvider(providerId);

        // Fetch details for each booking
        const bookingsWithDetails = await Promise.all(
          bookingHistory.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null; // Fetch customer details
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider (self)

            let relevantAddress = {};
            // If service is at provider's location, show provider address (implicitly known)
            // If service is at customer's location, show customer address
            if (
              service?.serviceLocationType === "customer_location" &&
              customer
            ) {
              relevantAddress = {
                addressStreet: customer.addressStreet,
                addressCity: customer.addressCity,
                addressState: customer.addressState,
                addressPostalCode: customer.addressPostalCode,
                addressCountry: customer.addressCountry,
              };
            }
            // Provider address is implicitly known by the provider, so no need to explicitly add it here
            // unless the service location is 'provider_location' and you *want* to show it redundantly.
            // For clarity, we only show the *other* party's address when relevant.

            return {
              ...booking,
              service,
              customer: customer
                ? {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                  }
                : null,
              provider: provider
                ? {
                    id: provider.id,
                    name: provider.name,
                    phone: provider.phone,
                  }
                : null,
              relevantAddress, // Add the conditionally determined address
            };
          }),
        );
        res.json(bookingsWithDetails); // Send details back
      } catch (error) {
        logger.error("Error fetching booking history:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch booking history",
          });
      }
    },
  );

  // Process expired bookings (can be called by a scheduled job)
  app.post(
    "/api/bookings/process-expired",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        await storage.processExpiredBookings();
        res.json({ message: "Expired bookings processed successfully" });
      } catch (error) {
        logger.error("Error processing expired bookings:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to process expired bookings",
          });
      }
    },
  );

  // Report a dispute on an awaiting payment booking
  app.post(
    "/api/bookings/:id/report-dispute",
    requireAuth,
    async (req, res) => {
      try {
        const bookingId = getValidatedParam(req, "id");
        const parsedBody = bookingDisputeSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { reason } = parsedBody.data;
        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.status !== "awaiting_payment")
          return res
            .status(400)
            .json({ message: "Booking not awaiting payment" });
        if (
          booking.customerId !== req.user!.id &&
          (await storage.getService(booking.serviceId!))?.providerId !==
            req.user!.id
        ) {
          return res.status(403).json({ message: "Not authorized" });
        }
        const updated = await storage.updateBooking(bookingId, {
          status: "disputed",
          disputeReason: reason,
        });
        res.json({ booking: updated });
      } catch (error) {
        logger.error("Error reporting dispute:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to report dispute",
          });
      }
    },
  );

  // Admin resolves disputed booking
  app.patch(
    "/api/admin/bookings/:id/resolve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const bookingId = getValidatedParam(req, "id");
        const parsedBody = bookingResolutionSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { resolutionStatus } = parsedBody.data;
        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.status !== "disputed")
          return res.status(400).json({ message: "Booking not disputed" });
        const updated = await storage.updateBooking(bookingId, {
          status: resolutionStatus,
        });
        res.json({ booking: updated });
      } catch (error) {
        logger.error("Error resolving dispute:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to resolve dispute",
          });
      }
    },
  );

  // Admin list disputes
  app.get(
    "/api/admin/disputes",
    requireAuth,
    requireRole(["admin"]),
    async (_req, res) => {
      try {
        const disputes = await storage.getBookingsByStatus("disputed");
        res.json(disputes);
      } catch (error) {
        logger.error("Error fetching disputes:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch disputes",
          });
      }
    },
  );

  // Shop Profile Management
  const profileUpdateSchema = insertUserSchema.partial().extend({
    upiId: z
      .string()
      .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/)
      .optional()
      .nullable(),
    upiQrCodeUrl: z.string().optional().nullable(),
    pickupAvailable: z.boolean().optional(),
    deliveryAvailable: z.boolean().optional(),
    returnsEnabled: z.boolean().optional(),
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = getValidatedParam(req, "id");
      if (userId !== req.user!.id) {
        return res.status(403).json({ message: "Can only update own profile" });
      }

      const result = profileUpdateSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      // Allow both providers and shops to update UPI fields
      if (!["provider", "shop"].includes(req.user!.role)) {
        delete (result.data as any).upiId;
        delete (result.data as any).upiQrCodeUrl;
      }

      // Sanitize paymentMethods using shared schema
      let updateData: Partial<User> = { ...result.data } as Partial<User>;
      if ("paymentMethods" in updateData) {
        const pmResult = PaymentMethodSchema.array().safeParse(
          (updateData as any).paymentMethods,
        );
        updateData.paymentMethods = pmResult.success
          ? pmResult.data
          : undefined;
      }
      if (updateData.shopProfile) {
        if (updateData.shopProfile.shippingPolicy === null) {
          delete updateData.shopProfile.shippingPolicy;
        }
        if (updateData.shopProfile.returnPolicy === null) {
          delete updateData.shopProfile.returnPolicy;
        }
      }
      const updatedUser = await storage.updateUser(userId, updateData);
      const safeUser = sanitizeUser(updatedUser);

      if (!safeUser) {
        return res
          .status(500)
          .json({ message: "Failed to update user profile" });
      }

      if (req.user) Object.assign(req.user, safeUser);
      if (req.user?.role === "shop") {
        await invalidateCache(`shop_detail_${userId}`);
      }
      res.json(safeUser);
    } catch (error) {
      logger.error("Error updating user:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to update user",
        });
    }
  });

  // Get all shops
  app.get("/api/shops", requireAuth, async (req, res) => {
    try {
      const parsedQuery = shopsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json(formatValidationError(parsedQuery.error));
      }

      const filters = Object.fromEntries(
        Object.entries(parsedQuery.data).filter(([, value]) => value !== undefined),
      );

      const shops = await storage.getShops(filters);

      res.json(sanitizeUserList(shops));
    } catch (error) {
      logger.error("Error fetching shops:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch shops",
        });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = getValidatedParam(req, "id");
      logger.info(
        "[API] /api/users/:id - Received request for user ID:",
        userId,
      );

      const user = await storage.getUser(userId);
      if (!user) {
        logger.info("[API] /api/users/:id - User not found");
        return res.status(404).json({ message: "User not found" });
      }

      const safeUser = sanitizeUser(user);
      logger.info("[API] /api/users/:id - User from storage:", safeUser);

      if (!safeUser) {
        return res.status(500).json({ message: "Failed to fetch user" });
      }

      res.json(safeUser);
    } catch (error) {
      logger.error("[API] Error in /api/users/:id:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch user",
        });
    }
  });

  // Product Management
  app.post(
    "/api/products",
    requireAuth,
    requireShopOrWorkerPermission(["products:write"]),
    async (req, res) => {
      try {
        const result = insertProductSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        const product = await storage.createProduct({
          ...result.data,
          shopId: shopContextId,
        });

        logger.info("Created product:", product);
        res.status(201).json(product);
      } catch (error) {
        logger.error("Error creating product:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create product",
          });
      }
    },
  );

  app.get("/api/products/shop/:id", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProductsByShop(getValidatedParam(req, "id"));
      logger.info("Shop products:", products);
      res.json(products);
    } catch (error) {
      logger.error("Error fetching shop products:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch products",
        });
    }
  });

  app.patch(
    "/api/products/:id",
    requireAuth,
    requireShopOrWorkerPermission(["products:write"]),
    async (req, res) => {
      try {
        const productId = getValidatedParam(req, "id");
        const product = await storage.getProduct(productId);

        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        const shopContextId =
          req.user!.role === "shop"
            ? req.user!.id
            : req.user!.role === "worker"
              ? (req as any).workerShopId
              : null;

        if (!shopContextId || product.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized to update this product" });
        }

        const parsedBody = productUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        if (Object.keys(parsedBody.data).length === 0) {
          return res.status(400).json({ message: "No product fields provided" });
        }

        const updateData: Record<string, unknown> = { ...parsedBody.data };

        // Sanitize numeric fields to prevent 'undefined' string errors
        const numericFields = ["price", "mrp", "stock"];
        for (const field of numericFields) {
          if (Object.prototype.hasOwnProperty.call(updateData, field)) {
            const value = updateData[field];
            if (value === "undefined" || value === null) {
              delete updateData[field];
            } else if (typeof value === "string" && value.trim() === "") {
              delete updateData[field];
            }
          }
        }

        // The storage.updateProduct method expects Partial<Product>
        const updatedProduct = await storage.updateProduct(
          productId,
          updateData,
        );
        logger.info(
          "[API] /api/products/:id PATCH - Updated product:",
          updatedProduct,
        );
        await invalidateCache(`product_detail_${shopContextId}_${productId}`);
        res.json(updatedProduct);
      } catch (error) {
        logger.error("[API] Error in /api/products/:id PATCH:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update product",
          });
      }
    },
  );

  // Service routes
  app.post(
    "/api/services",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        // Add serviceLocationType to the validation
        const serviceSchemaWithLocation = insertServiceSchema.extend({
          serviceLocationType: z
            .enum(["customer_location", "provider_location"])
            .optional()
            .default("provider_location"),
        });
        const result = serviceSchemaWithLocation.safeParse(req.body);
        if (!result.success) {
          logger.error(
            "[API] /api/services POST - Validation error:",
            result.error.flatten(),
          );
          return res.status(400).json(result.error.flatten());
        }

        const serviceData = {
          ...result.data,
          providerId: req.user!.id,
          isAvailable: true, // Default to available
        };
        const service = await storage.createService(serviceData);

        logger.info("Created service:", service);
        res.status(201).json(service);
      } catch (error) {
        logger.error("Error creating service:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create service",
          });
      }
    },
  );

  app.get("/api/services/provider/:id", requireAuth, async (req, res) => {
    try {
      const services = await storage.getServicesByProvider(
        getValidatedParam(req, "id"),
      );
      logger.info("Provider services:", services); // Debug log
      res.json(services);
    } catch (error) {
      logger.error("Error fetching provider services:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch services",
        });
    }
  });

  // Add PATCH endpoint for updating services
  app.patch(
    "/api/services/:id",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = getValidatedParam(req, "id");
        logger.info(
          "[API] /api/services/:id PATCH - Received request for service ID:",
          serviceId,
        );
        logger.info("[API] /api/services/:id PATCH - Request received");

        const service = await storage.getService(serviceId);

        if (!service) {
          logger.info("[API] /api/services/:id PATCH - Service not found");
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          logger.info("[API] /api/services/:id PATCH - Not authorized");
          return res
            .status(403)
            .json({ message: "Can only update own services" });
        }

        const parsedBody = serviceUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        if (Object.keys(parsedBody.data).length === 0) {
          return res.status(400).json({ message: "No service fields provided" });
        }

        const updatedService = await storage.updateService(
          serviceId,
          parsedBody.data,
        );
        logger.info(
          "[API] /api/services/:id PATCH - Updated service:",
          updatedService,
        );
        await invalidateCache(`service_detail_${serviceId}`);
        res.json(updatedService);
      } catch (error) {
        logger.error("[API] Error updating service:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update service",
          });
      }
    },
  );

  app.get("/api/services", requireAuth, async (req, res) => {
    try {
      const parsedQuery = servicesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json(formatValidationError(parsedQuery.error));
      }

      const {
        category,
        minPrice,
        maxPrice,
        searchTerm,
        providerId,
        locationCity,
        locationState,
        locationPostalCode,
        availabilityDate,
      } = parsedQuery.data;

      const filters: Record<string, unknown> = {};
      if (category) filters.category = category.toLowerCase();
      if (minPrice !== undefined) filters.minPrice = minPrice;
      if (maxPrice !== undefined) filters.maxPrice = maxPrice;
      if (searchTerm) filters.searchTerm = searchTerm;
      if (providerId !== undefined) filters.providerId = providerId;
      if (locationCity) filters.locationCity = locationCity;
      if (locationState) filters.locationState = locationState;
      if (locationPostalCode)
        filters.locationPostalCode = locationPostalCode;
      if (availabilityDate) filters.availabilityDate = availabilityDate;

      const services = await storage.getServices(filters);
      logger.info("Filtered services:", services); // Debug log

      // Map through services to include provider info and rating
      const servicesWithDetails = await Promise.all(
        services.map(async (service) => {
          const provider =
            service.providerId !== null
              ? await storage.getUser(service.providerId)
              : null;
          const reviews = await storage.getReviewsByService(service.id);
          const rating = reviews?.length
            ? reviews.reduce((acc, review) => acc + review.rating, 0) /
              reviews.length
            : null;

          return {
            ...service,
            rating,
            provider: provider
              ? {
                  // Include full provider details needed for address logic
                  id: provider.id,
                  name: provider.name,
                  phone: provider.phone,
                  profilePicture: provider.profilePicture,
                  addressStreet: provider.addressStreet,
                  addressCity: provider.addressCity,
                  addressState: provider.addressState,
                  addressPostalCode: provider.addressPostalCode,
                  addressCountry: provider.addressCountry,
                }
              : null,
          };
        }),
      );

      res.json(servicesWithDetails);
    } catch (error) {
      logger.error("Error fetching services:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch services",
        });
    }
  });

  app.get(
    "/api/services/:id",
    requireAuth,
    async (req, res) => {
      try {
        const serviceId = Number(req.params.id);
        logger.info(
          "[API] /api/services/:id - Received request for service ID: %d",
          serviceId,
        );

        const cacheKey = `service_detail_${serviceId}`;
        const cached = await getCache<ServiceDetail>(cacheKey);
        if (cached) {
          logger.debug("[API] /api/services/:id - returning cached response");
          return res.json(cached);
        }

        const service = await storage.getService(serviceId);
        logger.info("[API] /api/services/:id - Service from storage:", service);

        if (!service) {
          logger.info("[API] /api/services/:id - Service not found in storage");
          return res.status(404).json({ message: "Service not found" });
        }

        const provider =
          service.providerId !== null
            ? await storage.getUser(service.providerId)
            : null;
        if (!provider) {
          logger.info("[API] /api/services/:id - Provider not found");
          return res
            .status(404)
            .json({ message: "Service provider not found" });
        }

        const reviews = await storage.getReviewsByService(serviceId);
        const rating = reviews?.length
          ? reviews.reduce((acc, review) => acc + review.rating, 0) /
            reviews.length
          : null;

        const rawWorkingHours = (service as any).workingHours;
        let workingHours = rawWorkingHours ?? null;
        if (typeof rawWorkingHours === "string") {
          try {
            workingHours = JSON.parse(rawWorkingHours);
          } catch (parseError) {
            logger.warn(
              { err: parseError },
              "Failed to parse working hours JSON for service %d",
              serviceId,
            );
            workingHours = null;
          }
        }

        const breakSlots =
          (service as any).breakTime ??
          (service as any).breakTimes ??
          null;

        const payload = serviceDetailSchema.parse({
          ...service,
          workingHours,
          breakTime: breakSlots,
          rating,
          provider: {
            id: provider.id,
            name: provider.name ?? null,
            email: provider.email ?? null,
            phone: provider.phone ?? null,
            profilePicture: provider.profilePicture ?? null,
            addressStreet: provider.addressStreet ?? null,
            addressCity: provider.addressCity ?? null,
            addressState: provider.addressState ?? null,
            addressPostalCode: provider.addressPostalCode ?? null,
            addressCountry: provider.addressCountry ?? null,
          },
          reviews: (reviews ?? []).map((review) => ({
            id: review.id,
            customerId: review.customerId ?? null,
            serviceId: review.serviceId ?? null,
            bookingId: review.bookingId ?? null,
            rating: review.rating,
            review: review.review ?? null,
            createdAt:
              review.createdAt instanceof Date
                ? review.createdAt.toISOString()
                : review.createdAt
                  ? new Date(
                      review.createdAt as unknown as string,
                    ).toISOString()
                  : null,
            providerReply: review.providerReply ?? null,
            isVerifiedService: review.isVerifiedService ?? undefined,
          })),
        });

        logger.info(
          "[API] /api/services/:id - Sending typed response",
          payload,
        );
        await setCache(cacheKey, payload, SERVICE_DETAIL_CACHE_TTL_MS);
        res.json(payload);
      } catch (error) {
        logger.error("[API] Error in /api/services/:id:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch service",
          });
      }
    },
  );

  // Add these endpoints after the existing service routes
  app.get("/api/services/:id/blocked-slots", requireAuth, async (req, res) => {
    try {
      const serviceId = getValidatedParam(req, "id");
      const service = await storage.getService(serviceId);

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      const blockedSlots = await storage.getBlockedTimeSlots(serviceId);
      res.json(blockedSlots);
    } catch (error) {
      logger.error("Error fetching blocked slots:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch blocked slots",
        });
    }
  });

  app.post(
    "/api/services/:id/block-time",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = getValidatedParam(req, "id");
        const service = await storage.getService(serviceId);

        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "Can only block time slots for own services" });
        }

        const result = insertBlockedTimeSlotSchema.safeParse({
          ...req.body,
          serviceId: serviceId,
        });

        if (!result.success) {
          return res.status(400).json(result.error);
        }

        // Ensure serviceId is a number by overriding the value from the schema if necessary
        const validData = { ...result.data, serviceId: serviceId };
        const blockedSlot = await storage.createBlockedTimeSlot(validData);

        // Create notification for existing bookings that might be affected
        const overlappingBookings = await storage.getOverlappingBookings(
          serviceId,
          new Date(result.data.date),
          result.data.startTime,
          result.data.endTime,
        );

        for (const booking of overlappingBookings) {
          await storage.createNotification({
            userId: booking.customerId,
            type: "service",
            title: "Service Unavailable",
            message:
              "A service you booked has become unavailable for the scheduled time. Please reschedule.",
          });
        }

        res.status(201).json(blockedSlot);
      } catch (error) {
        logger.error("Error blocking time slot:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to block time slot",
          });
      }
    },
  );

  app.delete(
    "/api/services/:serviceId/blocked-slots/:slotId",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = getValidatedParam(req, "serviceId");
        const slotId = getValidatedParam(req, "slotId");

        const service = await storage.getService(serviceId);
        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "Can only unblock time slots for own services" });
        }

        await storage.deleteBlockedTimeSlot(slotId);
        res.sendStatus(200);
      } catch (error) {
        logger.error("Error unblocking time slot:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to unblock time slot",
          });
      }
    },
  );

  // Add endpoint to delete a service
  app.delete(
    "/api/services/:id",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = getValidatedParam(req, "id");
        logger.info(
          "[API] /api/services/:id DELETE - Received request for service ID:",
          serviceId,
        );

        const service = await storage.getService(serviceId);

        if (!service) {
          logger.info("[API] /api/services/:id DELETE - Service not found");
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          logger.info("[API] /api/services/:id DELETE - Not authorized");
          return res
            .status(403)
            .json({ message: "Can only delete own services" });
        }

        try {
          await storage.deleteService(serviceId);
          logger.info(
            "[API] /api/services/:id DELETE - Service marked as deleted successfully",
          );
          await invalidateCache(`service_detail_${serviceId}`);
          res.status(200).json({ message: "Service deleted successfully" });
        } catch (error) {
          logger.error("[API] Error deleting service:", error);
          res
            .status(400)
            .json({
              message:
                "Failed to delete service due to existing bookings. Please mark the service as unavailable instead.",
            });
        }
      } catch (error) {
        logger.error("[API] Error deleting service:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete service",
          });
      }
    },
  );

  // Booking routes
  app.post(
    "/api/bookings",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const parsedBody = bookingCreateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        const { serviceId, bookingDate, serviceLocation } = parsedBody.data;

        // Get service details
        const service = await storage.getService(serviceId);
        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }

        const bookingDateTime = new Date(bookingDate);
        const isAvailable = await storage.checkAvailability(
          serviceId,
          bookingDateTime,
        );
        if (!isAvailable) {
          return res
            .status(409)
            .json({ message: "Selected time slot is not available" });
        }

        const booking = await storage.createBooking({
          customerId: req.user!.id,
          serviceId,
          bookingDate: bookingDateTime,
          status: "pending",
          paymentStatus: "pending",
          serviceLocation,
        });

        await storage.createNotification({
          userId: service.providerId,
          type: "booking_request",
          title: "New Booking Request",
          message: `You have a new booking request for ${service.name}`,
        });

        // --- Payment provider integration hook (if configured) ---
        res.status(201).json({ booking, paymentRequired: false });
      } catch (error) {
        logger.error("Error creating booking:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create booking",
          });
      }
    },
  );

  app.patch(
    "/api/bookings/:id/status",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const parsedBody = bookingStatusUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { status, rejectionReason } = parsedBody.data;
        const bookingId = getValidatedParam(req, "id");

        logger.info(
          `[API DEBUG] Attempting to update booking status. Booking ID: ${bookingId}, Received Status: ${status}, Received Rejection Reason: ${rejectionReason}`,
        );

        const booking = await storage.getBooking(bookingId);
        logger.info(
          `[API DEBUG] Fetched booking for ID ${bookingId}:`,
          booking ? `Found (Customer ID: ${booking.customerId})` : "Not Found",
        );
        if (!booking) {
          logger.info(
            `[API DEBUG] Booking not found: ID=${bookingId}. Returning 404.`,
          );
          return res.status(404).json({ message: "Booking not found" });
        }

        logger.info(
          `[API DEBUG] Attempting to fetch service with ID: ${booking.serviceId} for authorization. Provider ID from token: ${req.user!.id}`,
        );
        const service =
          booking.serviceId !== null
            ? await storage.getService(booking.serviceId)
            : null;
        logger.info(
          `[API DEBUG] Fetched service for ID ${booking.serviceId}:`,
          service ? `Found (Provider ID: ${service.providerId})` : "Not Found",
        );
        if (!service || service.providerId !== req.user!.id) {
          logger.info(
            `[API DEBUG] Authorization check failed for booking ID ${bookingId}. Service found: ${!!service}, Service Provider ID: ${service?.providerId}, Authenticated User ID: ${req.user!.id}. Returning 403.`,
          );
          return res
            .status(403)
            .json({ message: "Not authorized to update this booking" });
        }

        logger.info(
          `[API DEBUG] All pre-update checks passed for booking ID ${bookingId}. Proceeding to update booking status.`,
        );
        // Update booking status
        const updatedBooking = await storage.updateBooking(bookingId, {
          status,
          rejectionReason: status === "rejected" ? rejectionReason : null,
        });

        logger.info(
          `[API PATCH /api/bookings/:id/status] Booking ID: ${bookingId}. Status updated to ${updatedBooking.status}. Email notifications are disabled for booking updates.`,
        );

        // Create notification for customer
        const serviceName = service?.name ?? "your booking";
        const notificationMessage =
          status === "rejected"
            ? `Your booking for ${serviceName} was rejected. Reason: ${rejectionReason}`
            : `Your booking for ${serviceName} has been accepted. The service provider will meet you at the scheduled time.`;

        const notificationTitle =
          status === "rejected" ? "Booking Rejected" : "Booking Accepted";

        await storage.createNotification({
          userId: booking.customerId,
          type: "booking_update",
          title: notificationTitle,
          message: notificationMessage,
        });

        logger.info(
          `[API] Booking status updated successfully: ID=${bookingId}, Status=${status}`,
        );
        logger.info(
          `[API] Notification sent to customer: ID=${booking.customerId}`,
        );

        res.json({
          booking: updatedBooking,
          message:
            status === "accepted"
              ? "Booking accepted successfully. Customer has been notified."
              : "Booking rejected. Customer has been notified with the reason.",
        });
      } catch (error) {
        logger.error("Error updating booking status:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update booking status",
          });
      }
    },
  );

  app.get(
    "/api/reviews/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const customerId = req.user!.id;
        const customerReviews = await storage.getReviewsByCustomer(customerId);
        res.json(customerReviews);
      } catch (error) {
        logger.error("Error fetching customer reviews:", error);
        res.status(500).json({ message: "Failed to fetch reviews" });
      }
    },
  );

  // Endpoint for providers to confirm payment and complete booking
  app.patch(
    "/api/bookings/:id/provider-complete",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const bookingId = getValidatedParam(req, "id");

        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });

        const service = await storage.getService(booking.serviceId!);
        if (!service || service.providerId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized" });
        }

        // Ensure the booking is in a state that can be completed by a provider (e.g., 'accepted')
        if (booking.status !== "awaiting_payment") {
          return res
            .status(400)
            .json({ message: "Booking not awaiting payment" });
        }

        const updatedBooking = await storage.updateBooking(bookingId, {
          status: "completed",
        });

        await storage.createNotification({
          userId: booking.customerId,
          type: "booking_update",
          title: "Payment Confirmed",
          message: `Provider confirmed payment for booking #${bookingId}.`,
        });
        res.json({ booking: updatedBooking });
      } catch (error) {
        logger.error("Error completing service by provider:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to complete service",
          });
      }
    },
  );

  // New dedicated route for sending 'Booking Accepted' email to customer
  app.post(
    "/api/bookings/:id/notify-customer-accepted",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      const bookingId = getValidatedParam(req, "id");
      logger.info(
        `[Bookings] Skipping acceptance email for booking ${bookingId}; email notifications are disabled.`,
      );
      res
        .status(200)
        .json({ message: "Email notifications are disabled for bookings." });
    },
  );

  // New dedicated route for sending 'Booking Rejected' email to customer
  app.post(
    "/api/bookings/:id/notify-customer-rejected",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      const bookingId = getValidatedParam(req, "id");
      logger.info(
        `[Bookings] Skipping rejection email for booking ${bookingId}; email notifications are disabled.`,
      );
      res
        .status(200)
        .json({ message: "Email notifications are disabled for bookings." });
    },
  );

  // Customer submits payment reference and marks booking awaiting provider confirmation
  app.patch(
    "/api/bookings/:id/customer-complete",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const parsedBody = paymentReferenceSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { paymentReference } = parsedBody.data;
        const bookingId = getValidatedParam(req, "id");

        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.customerId !== req.user!.id)
          return res.status(403).json({ message: "Not authorized" });

        if (booking.status !== "accepted") {
          return res.status(400).json({ message: "Booking not confirmed" });
        }

        // Update booking status to completed
        const updatedBooking = await storage.updateBooking(bookingId, {
          status: "awaiting_payment",
          paymentReference,
        });

        await storage.createNotification({
          userId: (await storage.getService(booking.serviceId!))!.providerId,
          type: "booking_update",
          title: "Payment Submitted",
          message: `Customer submitted payment reference for booking #${bookingId}.`,
        });
        const service = await storage.getService(booking.serviceId!);

        res.json({ booking: updatedBooking });
      } catch (error) {
        logger.error("Error submitting payment:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to submit payment",
          });
      }
    },
  );

  // Allow customer to update payment reference while awaiting provider confirmation
  app.patch(
    "/api/bookings/:id/update-reference",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const parsedBody = paymentReferenceSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { paymentReference } = parsedBody.data;
        const bookingId = getValidatedParam(req, "id");

        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.customerId !== req.user!.id)
          return res.status(403).json({ message: "Not authorized" });
        if (booking.status !== "awaiting_payment")
          return res
            .status(400)
            .json({ message: "Cannot update reference for this booking" });

        const updatedBooking = await storage.updateBooking(bookingId, {
          paymentReference,
        });
        res.json({ booking: updatedBooking });
      } catch (error) {
        logger.error("Error updating payment reference:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update reference",
          });
      }
    },
  );

  // Get bookings for customer
  app.get(
    "/api/bookings",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const allowedStatusFilters: Booking["status"][] = [
          "pending",
          "accepted",
          "rejected",
          "rescheduled",
          "completed",
          "cancelled",
          "expired",
          "rescheduled_pending_provider_approval",
          "awaiting_payment",
          "disputed",
        ];

        const parsedQuery = statusQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          return res.status(400).json(formatValidationError(parsedQuery.error));
        }

        const rawStatus = parsedQuery.data.status?.toLowerCase();

        let statusFilter: Booking["status"] | undefined;
        if (rawStatus && rawStatus !== "all") {
          if (allowedStatusFilters.includes(rawStatus as Booking["status"])) {
            statusFilter = rawStatus as Booking["status"];
          } else {
            return res.status(400).json({ message: "Invalid status filter" });
          }
        }

        const bookings = await storage.getBookingsByCustomer(req.user!.id, {
          status: statusFilter,
        });

        // Enrich bookings with service details
        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider details

            // Determine which address to show the customer
            let displayAddress = null;
            if (booking.serviceLocation === "provider") {
              displayAddress =
                booking.providerAddress ||
                (provider
                  ? `${provider.addressStreet || ""}, ${provider.addressCity || ""}, ${provider.addressState || ""}`
                      .trim()
                      .replace(/^, |, $/g, "")
                  : "Provider address not available");
            } else if (booking.serviceLocation === "customer") {
              // Customer already knows their own address, no need to display it here
              displayAddress = "Service at your location";
            }
            return {
              ...booking,
              status: booking.status,
              rejectionReason: booking.rejectionReason ?? null,
              service: service || { name: "Unknown Service" },
              providerName: provider?.name || "Unknown Provider",
              displayAddress: displayAddress,
              provider: provider
                ? {
                    id: provider.id,
                    name: provider.name,
                    phone: provider.phone,
                    upiId: (provider as any).upiId ?? null,
                    upiQrCodeUrl: (provider as any).upiQrCodeUrl ?? null,
                    addressStreet: provider.addressStreet,
                    addressCity: provider.addressCity,
                    addressState: provider.addressState,
                    addressPostalCode: provider.addressPostalCode,
                    addressCountry: provider.addressCountry,
                  }
                : null,
            };
          }),
        );

        res.json(enrichedBookings);
      } catch (error) {
        logger.error("Error fetching customer bookings:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch bookings",
          });
      }
    },
  );

  // Get bookings for provider
  app.get(
    "/api/bookings/provider",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const bookings = await storage.getBookingsByProvider(req.user!.id);

        // Enrich bookings with service details
        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider details

            // Determine which address to show the customer
            let displayAddress = null;
            if (booking.serviceLocation === "provider") {
              displayAddress =
                booking.providerAddress ||
                (provider
                  ? `${provider.addressStreet || ""}, ${provider.addressCity || ""}, ${provider.addressState || ""}`
                      .trim()
                      .replace(/^, |, $/g, "")
                  : "Provider address not available");
            } else if (booking.serviceLocation === "customer") {
              // Customer already knows their own address, no need to display it here
              displayAddress = "Service at your location";
            }
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null;

            // No need for customerContact object anymore, just return the full customer object

            return {
              ...booking,
              service: service || { name: "Unknown Service" },
              customer: customer, // Return the full customer object
            };
          }),
        );

        res.json(enrichedBookings);
      } catch (error) {
        logger.error("Error fetching provider bookings:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch bookings",
          });
      }
    },
  );

  app.post(
    "/api/bookings/:id/payment",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      res
        .status(200)
        .json({ message: "Payment functionality has been disabled." });
    },
  );

  app.get(
    "/api/bookings/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const bookings = await storage.getBookingsByCustomer(req.user!.id);
        res.json(bookings);
      } catch (error) {
        logger.error("Error fetching customer bookings:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch bookings",
          });
      }
    },
  );
  app.post(
    "/api/waitlist",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const parsedBody = waitlistJoinSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { serviceId, preferredDate } = parsedBody.data;
      try {
        await storage.joinWaitlist(
          req.user!.id,
          serviceId,
          new Date(preferredDate),
        );

        // Create notification
        await storage.createNotification({
          userId: req.user!.id,
          type: "booking",
          title: "Added to Waitlist",
          message:
            "You've been added to the waitlist. We'll notify you when a slot becomes available.",
        });

        res.sendStatus(200);
      } catch (error) {
        logger.error("Error joining waitlist:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to join waitlist",
          });
      }
    },
  );

  // Cart routes
  app.post(
    "/api/cart",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const parsedBody = cartItemSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { productId, quantity } = parsedBody.data;
      try {
        await storage.addToCart(req.user!.id, productId, quantity);
        res.json({ success: true });
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to add to cart",
          });
      }
    },
  );

  app.delete(
    "/api/cart/:productId",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        await storage.removeFromCart(
          req.user!.id,
          getValidatedParam(req, "productId"),
        );
        res.json({ success: true });
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to remove from cart",
          });
      }
    },
  );

  app.get(
    "/api/cart",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const cart = await storage.getCart(req.user!.id);
        res.json(cart);
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to get cart",
          });
      }
    },
  );

  // Wishlist routes
  app.post(
    "/api/wishlist",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const parsedBody = wishlistItemSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { productId } = parsedBody.data;
      try {
        await storage.addToWishlist(req.user!.id, productId);
        res.json({ success: true }); // Send proper JSON response
      } catch (error) {
        logger.error("Error adding to wishlist:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update wishlist",
          });
      }
    },
  );

  app.delete(
    "/api/wishlist/:productId",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        await storage.removeFromWishlist(
          req.user!.id,
          getValidatedParam(req, "productId"),
        );
        res.sendStatus(200);
      } catch (error) {
        logger.error("Error removing from wishlist:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update wishlist",
          });
      }
    },
  );

  app.get(
    "/api/wishlist",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const wishlist = await storage.getWishlist(req.user!.id);
        res.json(wishlist);
      } catch (error) {
        logger.error("Error fetching wishlist:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch wishlist",
          });
      }
    },
  );

  // Review routes
  app.post(
    "/api/reviews",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const result = insertReviewSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const { serviceId, bookingId, rating, review } = result.data;

        if (!serviceId || !bookingId) {
          return res
            .status(400)
            .json({ message: "Invalid or missing serviceId or bookingId" });
        }

        // More direct check for an existing review for the same booking by the same customer
        const booking = await storage.getBooking(bookingId);
        if (!booking || booking.customerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "You can only review your own bookings." });
        }

        const existingReview = await db
          .select()
          .from(reviews)
          .where(
            and(
              eq(reviews.customerId, req.user!.id),
              eq(reviews.bookingId, bookingId),
            ),
          )
          .limit(1);

        if (existingReview.length > 0) {
          return res.status(409).json({
            message:
              "You have already reviewed this booking. You can edit your existing review.",
          });
        }

        const service = await storage.getService(serviceId);
        if (!service || !service.providerId)
          throw new Error("Service not found");

        const newReview = await storage.createReview({
          customerId: req.user!.id,
          serviceId,
          bookingId,
          rating,
          review,
        });

        await storage.updateProviderRating(service.providerId);
        res.status(201).json(newReview);
      } catch (error) {
        logger.error("Error saving review:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to save review",
          });
      }
    },
  );

  // Add endpoint to update an existing review
  app.patch(
    "/api/reviews/:id",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const reviewId = getValidatedParam(req, "id");
        const parsedBody = reviewUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        const updatePayload: Record<string, unknown> = {};
        if (parsedBody.data.rating !== undefined) {
          updatePayload.rating = parsedBody.data.rating;
        }
        if (parsedBody.data.review !== undefined) {
          updatePayload.review = parsedBody.data.review;
        }

        // Verify the review belongs to this user
        const existingReview = await storage.getReviewById(reviewId);
        if (!existingReview) {
          return res.status(404).json({ message: "Review not found" });
        }

        if (existingReview.customerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "You can only edit your own reviews" });
        }

        // Update the review
        const updatedReview = await storage.updateReview(reviewId, updatePayload);
        res.json(updatedReview);
      } catch (error) {
        logger.error("Error updating review:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update review",
          });
      }
    },
  );

  app.get("/api/reviews/service/:id", requireAuth, async (req, res) => {
    try {
      const reviews = await storage.getReviewsByService(getValidatedParam(req, "id"));
      res.json(reviews);
    } catch (error) {
      logger.error("Error fetching service reviews:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch reviews",
        });
    }
  });

  app.get("/api/reviews/provider/:id", requireAuth, async (req, res) => {
    try {
      const reviews = await storage.getReviewsByProvider(getValidatedParam(req, "id"));
      res.json(reviews);
    } catch (error) {
      logger.error("Error fetching provider reviews:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch reviews",
        });
    }
  });

  // Add endpoint for service providers to reply to reviews
  app.post(
    "/api/reviews/:id/reply",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const parsedBody = reviewReplySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { reply } = parsedBody.data;
        const reviewId = getValidatedParam(req, "id");

        // Get the review
        const review = await storage.getReviewById(reviewId);
        if (!review) {
          return res.status(404).json({ message: "Review not found" });
        }

        // Get the service to verify ownership
        const service = await storage.getService(review.serviceId!);
        if (!service || service.providerId !== req.user!.id) {
          return res
            .status(403)
            .json({
              message: "You can only reply to reviews for your own services",
            });
        }

        // Update the review with the provider's reply
        const updatedReview = await storage.updateReview(reviewId, {
          providerReply: reply,
        } as any);
        res.json(updatedReview);
      } catch (error) {
        logger.error("Error replying to review:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to reply to review",
          });
      }
    },
  );

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      res.json(notifications);
    } catch (error) {
      logger.error("Error fetching notifications:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch notifications",
        });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markNotificationAsRead(getValidatedParam(req, "id"));
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to update notification",
        });
    }
  });

  app.patch(
    "/api/notifications/mark-all-read",
    requireAuth,
    async (req, res) => {
      const parsedBody = notificationsMarkAllSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { role } = parsedBody.data;
      try {
        // Pass both user ID and role to properly filter notifications
        await storage.markAllNotificationsAsRead(req.user!.id, role);
        res.status(200).json({ success: true });
      } catch (error) {
        logger.error("Error marking notifications as read:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update notifications",
          });
      }
    },
  );

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteNotification(getValidatedParam(req, "id"));
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error deleting notification:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete notification",
        });
    }
  });

  // Order Management
  app.post(
    "/api/orders",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const orderSchema = z
          .object({
            items: z.array(
              z
                .object({
                  productId: z.number(),
                  quantity: z.number().min(1),
                  price: z.string().or(z.number()),
                })
                .strict(),
            ),
            total: z.string().or(z.number()),
            subtotal: z.string().or(z.number()).optional(),
            discount: z.string().or(z.number()).optional(),
            promotionId: z.number().optional(),
            deliveryMethod: z.enum(["delivery", "pickup"]),
            paymentMethod: PaymentMethodType.optional(),
          })
          .strict();

        const result = orderSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const {
          items,
          total: requestedTotal,
          subtotal,
          discount,
          promotionId,
          deliveryMethod,
          paymentMethod = "upi",
        } = result.data;

        if (deliveryMethod === "delivery" && paymentMethod === "cash") {
          return res
            .status(400)
            .json({
              message: "Cash payment only available for pickup orders",
            });
        }

        // Validate products, stock, and ensure all items are from same shop
        const productIds = Array.from(new Set(items.map((item) => item.productId)));
        const products = productIds.length
          ? await storage.getProductsByIds(productIds)
          : [];
        const productMap = new Map(products.map((product) => [product.id, product]));

        const missingProducts = productIds.filter((id) => !productMap.has(id));
        if (missingProducts.length > 0) {
          return res.status(400).json({
            message: `Product with ID ${missingProducts[0]} not found`,
          });
        }

        let shopId: number | null | undefined;
        const quantityByProduct = new Map<number, number>();
        for (const item of items) {
          const product = productMap.get(item.productId);
          if (!product) {
            // Safety net, though missing products handled earlier.
            return res.status(400).json({
              message: `Product with ID ${item.productId} not found`,
            });
          }

          const totalQuantity =
            (quantityByProduct.get(item.productId) ?? 0) + item.quantity;
          quantityByProduct.set(item.productId, totalQuantity);

          const productShopId = product.shopId;
          if (productShopId == null) {
            return res
              .status(400)
              .json({ message: `Product with ID ${item.productId} has no shop` });
          }

          if (shopId == null) {
            shopId = productShopId;
          } else if (productShopId !== shopId) {
            return res
              .status(400)
              .json({ message: "All items must be from the same shop" });
          }
        }

        const insufficientEntry = Array.from(quantityByProduct.entries()).find(
          ([productId, totalQuantity]) => {
            const product = productMap.get(productId);
            return product ? product.stock < totalQuantity : true;
          },
        );
        if (insufficientEntry) {
          const [productId] = insufficientEntry;
          const product = productMap.get(productId);
          return res.status(400).json({
            message: `Insufficient stock for product: ${product?.name ?? productId}`,
          });
        }

        if (shopId === undefined) {
          return res.status(400).json({ message: "No items provided" });
        }

        const toNumber = (value: string | number) =>
          typeof value === "number" ? value : Number(value);
        const optionalToNumber = (value: string | number | undefined) =>
          value === undefined ? undefined : toNumber(value);

        const subtotalFromRequest = optionalToNumber(subtotal);
        const subtotalValue =
          subtotalFromRequest !== undefined
            ? subtotalFromRequest
            : items.reduce((sum, item) => sum + toNumber(item.price) * item.quantity, 0);

        if (!Number.isFinite(subtotalValue)) {
          return res.status(400).json({ message: "Invalid subtotal amount" });
        }

        const discountValue = optionalToNumber(discount) ?? 0;
        if (!Number.isFinite(discountValue)) {
          return res.status(400).json({ message: "Invalid discount amount" });
        }

        const computedTotalRaw =
          subtotalValue - discountValue + PLATFORM_SERVICE_FEE;
        if (!Number.isFinite(computedTotalRaw)) {
          return res.status(400).json({ message: "Invalid order amount" });
        }

        const computedTotal = Number(computedTotalRaw.toFixed(2));
        const totalAsString = computedTotal.toFixed(2);

        const requestedTotalValue = optionalToNumber(requestedTotal);
        if (
          requestedTotalValue !== undefined &&
          Math.abs(requestedTotalValue - computedTotal) > 0.01
        ) {
          logger.warn(
            `Order total mismatch for user ${req.user!.id}: requested ${requestedTotalValue}, computed ${computedTotal}`,
          );
        }

        // If a promotion is applied, verify it's valid
        let promotionCode = null;
        if (promotionId) {
          const promotionResult = await db
            .select()
            .from(promotions)
            .where(eq(promotions.id, promotionId));
          if (!promotionResult.length) {
            return res.status(400).json({ message: "Invalid promotion" });
          }

          const promotion = promotionResult[0];

          // Verify promotion belongs to the shop
          if (promotion.shopId !== shopId) {
            return res
              .status(400)
              .json({ message: "Promotion does not apply to this shop" });
          }

          // Verify promotion is active and not expired
          const now = new Date();
          if (
            !promotion.isActive ||
            promotion.startDate > now ||
            (promotion.endDate && promotion.endDate < now)
          ) {
            return res
              .status(400)
              .json({ message: "Promotion is not active or has expired" });
          }

          // Verify usage limit
          if (
            promotion.usageLimit &&
            (promotion.usedCount ?? 0) >= promotion.usageLimit
          ) {
            return res
              .status(400)
              .json({ message: "This promotion has reached its usage limit" });
          }

          promotionCode = promotion.code || null;
        }

        const customer = req.user!;
        if (shopId == null) {
          return res
            .status(400)
            .json({ message: "Shop information is missing" });
        }

        const shop = await storage.getUser(shopId);
        if (!shop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        const customerAddress = formatUserAddress(customer);
        const shopAddress = formatUserAddress(shop);
        const derivedShippingAddress =
          deliveryMethod === "delivery" ? customerAddress : shopAddress;
        const shippingAddress = derivedShippingAddress || "";
        const derivedBillingAddress =
          deliveryMethod === "delivery" ? customerAddress : shopAddress;

        const newOrder = await storage.createOrder({
          customerId: customer.id,
          shopId,
          status: "pending",
          paymentStatus: "pending",
          deliveryMethod,
          paymentMethod,
          total: totalAsString,
          orderDate: new Date(),
          shippingAddress,
          billingAddress: derivedBillingAddress || "",
        });
        logger.info(`Created order ${newOrder.id}`);
        const orderItemPayloads = items.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price.toString(),
          total: (
            parseFloat(item.price.toString()) * item.quantity
          ).toString(),
        }));
        await Promise.all(
          orderItemPayloads.map((payload) => storage.createOrderItem(payload)),
        );

        const stockUpdates = Array.from(quantityByProduct.entries());
        for (let i = 0; i < stockUpdates.length; i += 1) {
          const [productId, totalQuantity] = stockUpdates[i]!;
          await storage.updateProductStock(productId, totalQuantity);
        }

        // Clear cart after order creation
        await storage.clearCart(req.user!.id);

        res.status(201).json({ order: newOrder });
      } catch (error) {
        logger.error("Order creation error:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to create order",
          });
      }
    },
  );

  app.post(
    "/api/orders/:id/payment",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      res
        .status(200)
        .json({ message: "Payment functionality has been disabled." });
    },
  );

  app.get(
    "/api/orders/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const allowedOrderStatus: Order["status"][] = [
          "pending",
          "cancelled",
          "confirmed",
          "processing",
          "packed",
          "dispatched",
          "shipped",
          "delivered",
          "returned",
        ];

        const parsedQuery = statusQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          return res.status(400).json(formatValidationError(parsedQuery.error));
        }

        const rawStatus = parsedQuery.data.status?.toLowerCase();

        let statusFilter: Order["status"] | undefined;
        if (rawStatus && rawStatus !== "all") {
          if (allowedOrderStatus.includes(rawStatus as Order["status"])) {
            statusFilter = rawStatus as Order["status"];
          } else {
            return res.status(400).json({ message: "Invalid status filter" });
          }
        }

        const orders = await storage.getOrdersByCustomer(req.user!.id, {
          status: statusFilter,
        });
        const detailed = await hydrateOrders(orders, { includeShop: true });
        res.json(detailed);
      } catch (error) {
        logger.error("Error fetching customer orders:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch orders",
          });
      }
    },
  );

  app.get(
    "/api/shops/dashboard-stats",
    requireAuth,
    requireShopOrWorkerPermission(["analytics:view"]),
    async (req, res) => {
      try {
        const shopContextId =
          req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        const stats = await storage.getShopDashboardStats(shopContextId);
        res.json(stats);
      } catch (error) {
        logger.error("Error fetching shop dashboard stats:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch dashboard stats",
          });
      }
    },
  );

  app.get(
    "/api/orders/shop/recent",
    requireAuth,
    requireShopOrWorkerPermission(["orders:read"]),
    async (req, res) => {
      try {
        const shopContextId =
          req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        const orders = await storage.getRecentOrdersByShop(shopContextId);
        const detailed = await hydrateOrders(orders, {
          includeCustomer: true,
        });
        res.json(detailed);
      } catch (error) {
        logger.error("Error fetching recent shop orders:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch orders",
          });
      }
    },
  );

  app.get(
    "/api/orders/shop",
    requireAuth,
    requireShopOrWorkerPermission(["orders:read"]),
    async (req, res) => {
      try {
        const parsedQuery = statusQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          return res.status(400).json(formatValidationError(parsedQuery.error));
        }

        const allowedOrderStatus: Order["status"][] = [
          "pending",
          "cancelled",
          "confirmed",
          "processing",
          "packed",
          "dispatched",
          "shipped",
          "delivered",
          "returned",
        ];

        const rawStatus = parsedQuery.data.status?.toLowerCase();
        const normalizedStatus =
          rawStatus === "all_orders" ? "all" : rawStatus;

        let statusFilter: Order["status"] | undefined;
        if (normalizedStatus && normalizedStatus !== "all") {
          if (allowedOrderStatus.includes(normalizedStatus as Order["status"])) {
            statusFilter = normalizedStatus as Order["status"];
          } else {
            return res.status(400).json({ message: "Invalid status filter" });
          }
        }
        const shopContextId =
          req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        const orders = await storage.getOrdersByShop(
          shopContextId,
          statusFilter,
        );
        const detailed = await hydrateOrders(orders, {
          includeCustomer: true,
        });
        res.json(detailed);
      } catch (error) {
        logger.error("Error fetching shop orders:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch orders",
          });
      }
    },
  );

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    const orderId = Number(req.params.id);
    try {
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.customerId !== req.user!.id) {
        if (req.user!.role === "shop") {
          if (order.shopId !== req.user!.id) {
            return res.status(403).json({ message: "Not authorized" });
          }
        } else if (req.user!.role === "worker") {
          const workerShopId = await getWorkerShopId(req.user!.id);
          if (!workerShopId || order.shopId !== workerShopId) {
            return res.status(403).json({ message: "Not authorized" });
          }
        } else {
          return res.status(403).json({ message: "Not authorized" });
        }
      }
      const itemsRaw = await storage.getOrderItemsByOrder(order.id);
      const items = await Promise.all(
        itemsRaw.map(async (item) => {
          const product =
            item.productId !== null
              ? await storage.getProduct(item.productId)
              : null;
          return {
            id: item.id,
            productId: item.productId,
            name: product?.name ?? "",
            quantity: item.quantity,
            price: String(item.price),
            total: String(item.total),
          };
        }),
      );

      const customer =
        order.customerId !== null
          ? await storage.getUser(order.customerId)
          : undefined;
      const shop =
        order.shopId !== null ? await storage.getUser(order.shopId) : undefined;

      const payload = orderDetailSchema.parse({
        ...order,
        orderDate:
          order.orderDate instanceof Date
            ? order.orderDate.toISOString()
            : order.orderDate ?? null,
        eReceiptGeneratedAt:
          order.eReceiptGeneratedAt instanceof Date
            ? order.eReceiptGeneratedAt.toISOString()
            : order.eReceiptGeneratedAt ?? null,
        paymentReference: order.paymentReference ?? null,
        billingAddress: order.billingAddress ?? null,
        trackingInfo: order.trackingInfo ?? null,
        notes: order.notes ?? null,
        eReceiptId: order.eReceiptId ?? null,
        eReceiptUrl: order.eReceiptUrl ?? null,
        items,
        customer: customer
          ? {
              name: customer.name ?? null,
              phone: customer.phone ?? null,
              email: customer.email ?? null,
              address: formatUserAddress(customer) ?? null,
            }
          : undefined,
        shop: shop
          ? {
              name: shop.name ?? null,
              phone: shop.phone ?? null,
              email: shop.email ?? null,
              address: formatUserAddress(shop) ?? null,
              upiId: (shop as any).upiId ?? null,
              returnsEnabled:
                (shop as any).returnsEnabled === undefined
                  ? null
                  : Boolean((shop as any).returnsEnabled),
            }
          : undefined,
      });

      res.json(payload);
    } catch (error) {
      logger.error("Error fetching order details:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch order",
        });
    }
  });

  // Customer submits payment reference for manual verification
  app.post(
    "/api/orders/:id/submit-payment-reference",
    requireAuth,
    async (req, res) => {
      const orderId = getValidatedParam(req, "id");
      const parsedBody = orderPaymentReferenceSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { paymentReference } = parsedBody.data;
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.customerId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
        const updated = await storage.updateOrder(orderId, {
          paymentStatus: "verifying",
          paymentReference,
        });
        if (order.shopId) {
          await storage.createNotification({
            userId: order.shopId,
            type: "order",
            title: "Action Required",
            message: `Payment reference for Order #${orderId} has been submitted. Please verify.`,
          });
        }
        res.json(updated);
      } catch (error) {
        logger.error("Error submitting payment reference:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to submit payment reference",
          });
      }
    },
  );

  // Shop confirms payment after manual verification
  app.post(
    "/api/orders/:id/confirm-payment",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      const orderId = getValidatedParam(req, "id");
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        const shopContextId =
          req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        if (order.shopId !== shopContextId)
          return res.status(403).json({ message: "Not authorized" });
        if (
          (order.paymentMethod === "upi" && order.paymentStatus !== "verifying") ||
          (order.paymentMethod === "cash" && order.paymentStatus !== "pending")
        ) {
          return res
            .status(400)
            .json({ message: "Order is not awaiting verification" });
        }
        const updated = await storage.updateOrder(orderId, {
          paymentStatus: "paid",
          status: "confirmed",
        });
        if (order.customerId) {
          await storage.createNotification({
            userId: order.customerId,
            type: "order",
            title: "Payment Confirmed",
            message: `Payment Confirmed! Your Order #${orderId} is now being processed.`,
          });
        }
        res.json(updated);
      } catch (error) {
        logger.error("Error confirming payment:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to confirm payment",
          });
      }
    },
  );

  // Add an endpoint to get service availability
  app.get("/api/services/:id/bookings", requireAuth, async (req, res) => {
    const parsedQuery = servicesAvailabilityQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json(formatValidationError(parsedQuery.error));
    }

    const serviceId = getValidatedParam(req, "id");
    const bookingDate = new Date(parsedQuery.data.date);

    try {
      const service = await storage.getService(serviceId);
      if (!service)
        return res.status(404).json({ message: "Service not found" });

      const bookings = await storage.getBookingsByService(
        serviceId,
        bookingDate,
      );
      res.json(
        bookings.map((booking) => ({
          start: booking.bookingDate,
          end: new Date(
            booking.bookingDate.getTime() +
              (service.duration + (service.bufferTime || 0)) * 60000,
          ),
        })),
      );
    } catch (error) {
      logger.error("Error fetching service bookings:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch bookings",
        });
    }
  });

  // Enhanced booking routes with notifications
  app.post(
    "/api/bookings/:id/confirm",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const booking = await storage.updateBooking(getValidatedParam(req, "id"), {
          status: "accepted",
        });

        // Send confirmation notifications
        const customer =
          booking.customerId !== null
            ? await storage.getUser(booking.customerId)
            : null;
        if (customer) {
          // Create in-app notification
          await storage.createNotification({
            userId: customer.id,
            type: "booking",
            title: "Booking Confirmed",
            message: `Your booking for ${formatIndianDisplay(booking.bookingDate, "date")} has been confirmed.`, // Use formatIndianDisplay
          });

          // Send SMS notification
          await storage.sendSMSNotification(
            customer.phone,
            `Your booking for ${formatIndianDisplay(booking.bookingDate, "date")} has been confirmed.`, // Use formatIndianDisplay
          );

          // Email notifications removed
        }

        res.json(booking);
      } catch (error) {
        logger.error("Error confirming booking:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to confirm booking",
          });
      }
    },
  );

  // Order tracking routes with permissions
  app.get(
    "/api/orders/:id/timeline",
    requireAuth,
    // If customer, handle directly; otherwise fall through to worker/shop check
    async (req: any, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }
      if (req.user?.role === "customer") {
        const orderId = Number(req.params.id);
        try {
          const order = await storage.getOrder(orderId);
          if (!order) return res.status(404).json({ message: "Order not found" });
          if (order.customerId !== req.user.id)
            return res.status(403).json({ message: "Not authorized" });
          const timeline = await storage.getOrderTimeline(orderId);
          return res.json(
            orderTimelineEntrySchema
              .array()
              .parse(
                timeline.map((entry) => ({
                  ...entry,
                  trackingInfo: entry.trackingInfo ?? null,
                  timestamp:
                    entry.timestamp instanceof Date
                      ? entry.timestamp.toISOString()
                      : new Date(entry.timestamp).toISOString(),
                })),
              ),
          );
        } catch (error) {
          logger.error("Error fetching customer order timeline:", error);
          return res
            .status(500)
            .json({
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to fetch order timeline",
            });
        }
      }
      next();
    },
    requireShopOrWorkerPermission(["orders:read"]),
    async (req: any, res: Response) => {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }
      const orderId = Number(req.params.id);
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        const shopContextId =
          req.user && req.user.role === "shop"
            ? req.user.id
            : (req.workerShopId ?? null);
        if (order.shopId !== shopContextId)
          return res.status(403).json({ message: "Not authorized" });
        const timeline = await storage.getOrderTimeline(orderId);
        res.json(
          orderTimelineEntrySchema
            .array()
            .parse(
              timeline.map((entry) => ({
                ...entry,
                trackingInfo: entry.trackingInfo ?? null,
                timestamp:
                  entry.timestamp instanceof Date
                    ? entry.timestamp.toISOString()
                    : new Date(entry.timestamp).toISOString(),
              })),
            ),
        );
      } catch (error) {
        logger.error("Error fetching order timeline for shop/worker:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch order timeline",
          });
      }
    },
  );

  app.patch(
    "/api/orders/:id/status",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      try {
        const parsedBody = orderStatusUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { status, trackingInfo } = parsedBody.data;
        const orderId = getValidatedParam(req, "id");
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        if (order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }

        const updated = await storage.updateOrderStatus(
          orderId,
          status,
          trackingInfo,
        );

        // Create notification for status update
        await storage.createNotification({
          userId: updated.customerId,
          type: "order",
          title: `Order ${status}`,
          message: `Your order #${updated.id} has been ${status}. ${trackingInfo || ""}`,
        });

        // Send SMS notification for important status updates
        if (["confirmed", "dispatched", "shipped", "delivered"].includes(status)) {
          const customer =
            updated.customerId !== null
              ? await storage.getUser(updated.customerId)
              : undefined;
          if (customer) {
            await storage.sendSMSNotification(
              customer.phone,
              `Your order #${updated.id} has been ${status}. ${trackingInfo || ""}`,
            );
          }
        }

        res.json(updated);
      } catch (error) {
        logger.error("Error updating order status:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update order status",
          });
      }
    },
  );

  // Return and refund routes
  app.post(
    "/api/orders/:orderId/return",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const result = insertReturnRequestSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const orderId = getValidatedParam(req, "orderId");

      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.status === "delivered") {
          const returnRequest = await (storage as any).createReturnRequest({
            ...result.data,
            orderId: order.id,
            status: "pending",
            customerId: req.user!.id,
          });

          // Create notification for return request
          await storage.createNotification({
            userId: order.customerId,
            type: "return",
            title: "Return Request Received",
            message:
              "Your return request has been received and is being processed.",
          });

          res.status(201).json(returnRequest);
        } else {
          res
            .status(400)
            .json({
              message: "Order must be delivered before initiating return",
            });
        }
      } catch (error) {
        logger.error("Error creating return request:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create return request",
          });
      }
    },
  );

  app.post(
    "/api/returns/:id/approve",
    requireAuth,
    requireShopOrWorkerPermission(["returns:manage"]),
    async (req, res) => {
      try {
        const returnRequest = await storage.getReturnRequest(
          getValidatedParam(req, "id"),
        );
        if (!returnRequest)
          return res.status(404).json({ message: "Return request not found" });

        // Ensure this return belongs to the caller's shop
        const order = returnRequest.orderId ? await storage.getOrder(returnRequest.orderId) : null;
        const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        if (!order || order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }

        // Process refund through configured payment provider
        await storage.processRefund(returnRequest.id);

        const updatedReturn = await storage.updateReturnRequest(
          returnRequest.id,
          {
            status: "approved",
          },
        );

        // Notify customer about approved return (use the same order instance)
        if (order) {
          await storage.createNotification({
            userId: order.customerId,
            type: "return",
            title: "Return Request Approved",
            message:
              "Your return request has been approved. Refund will be processed shortly.",
          });

          // Send SMS notification
          // Ensure order.customerId is not null before fetching customer
          const customer =
            order.customerId !== null
              ? await storage.getUser(order.customerId)
              : null;
          if (customer) {
            await storage.sendSMSNotification(
              customer.phone,
              "Your return request has been approved. Refund will be processed shortly.",
            );
          }
        }

        res.json(updatedReturn);
      } catch (error) {
        logger.error("Error approving return:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to approve return",
          });
      }
    },
  );

  // Add this route for user details
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = getValidatedParam(req, "id");
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const safeUser = sanitizeUser(user);
      if (!safeUser) {
        return res.status(500).json({ message: "Failed to fetch user" });
      }
      res.json(safeUser);
    } catch (error) {
      logger.error("Error fetching user:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch user",
        });
    }
  });

  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const parsedQuery = productsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json(formatValidationError(parsedQuery.error));
      }

      const {
        category,
        minPrice,
        maxPrice,
        tags,
        searchTerm,
        shopId,
        attributes,
        locationCity,
        locationState,
        page = 1,
        pageSize = 24,
      } = parsedQuery.data;

      const normalizedPage = Math.max(1, Number(page));
      const normalizedPageSize = Math.min(100, Math.max(1, Number(pageSize)));

      const filters: Record<string, unknown> = {
        page: normalizedPage,
        pageSize: normalizedPageSize,
      };
      if (category) filters.category = category.toLowerCase();
      if (minPrice !== undefined) filters.minPrice = minPrice;
      if (maxPrice !== undefined) filters.maxPrice = maxPrice;
      if (tags) {
        const parsedTags = tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0);
        if (parsedTags.length > 0) {
          filters.tags = parsedTags;
        }
      }
      if (searchTerm) filters.searchTerm = searchTerm;
      if (shopId !== undefined) filters.shopId = shopId;
      if (attributes) {
        try {
          const parsedAttributes = JSON.parse(attributes);
          if (
            !parsedAttributes ||
            typeof parsedAttributes !== "object" ||
            Array.isArray(parsedAttributes)
          ) {
            return res
              .status(400)
              .json({ message: "attributes must be a JSON object" });
          }
          filters.attributes = parsedAttributes;
        } catch (error) {
          logger.error("Failed to parse product attributes filter", error);
          return res
            .status(400)
            .json({ message: "attributes must be valid JSON" });
        }
      }
      if (locationCity) filters.locationCity = locationCity;
      if (locationState) filters.locationState = locationState;

      const { items, hasMore } = await storage.getProducts(filters);
      const list = items.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        category: product.category,
        images: product.images ?? [],
        shopId: product.shopId,
        isAvailable: product.isAvailable ?? true,
        stock: product.stock,
      }));

      res.json({
        page: normalizedPage,
        pageSize: normalizedPageSize,
        hasMore,
        items: list,
      });
    } catch (error) {
      logger.error("Error fetching products:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch products",
        });
    }
  });

  // Get a specific product by shop ID and product ID
  app.get(
    "/api/shops/:shopId/products/:productId",
    requireAuth,
    async (req, res) => {
      try {
        const shopId = Number(req.params.shopId);
        const productId = Number(req.params.productId);
        const cacheKey = `product_detail_${shopId}_${productId}`;
        const cached = await getCache<ProductDetail>(cacheKey);
        if (cached) {
          logger.debug("[API] /api/shops/:shopId/products/:productId - cache hit");
          return res.json(cached);
        }
        const product = await storage.getProduct(productId);

        if (!product || product.shopId !== shopId) {
          return res
            .status(404)
            .json({ message: "Product not found in this shop" });
        }

        const payload = productDetailSchema.parse({
          ...product,
          images: product.images ?? null,
          specifications: product.specifications ?? null,
          tags: product.tags ?? null,
          weight: product.weight ?? null,
          dimensions: product.dimensions ?? null,
          mrp: product.mrp ?? null,
          createdAt:
            product.createdAt instanceof Date
              ? product.createdAt.toISOString()
              : product.createdAt ?? null,
          updatedAt:
            product.updatedAt instanceof Date
              ? product.updatedAt.toISOString()
              : product.updatedAt ?? null,
        });

        await setCache(cacheKey, payload, PRODUCT_DETAIL_CACHE_TTL_MS);
        res.json(payload);
      } catch (error) {
        logger.error("Error fetching product:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch product",
          });
      }
    },
  );

  // Get shop details by ID
  app.get("/api/shops/:shopId", requireAuth, async (req, res) => {
    try {
      const shopId = getValidatedParam(req, "shopId");
      const cacheKey = `shop_detail_${shopId}`;
      const cached = await getCache<{ id: number; name: string | null; shopProfile: ShopProfile | null }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      const shop = await storage.getUser(shopId);

      if (!shop || shop.role !== "shop") {
        return res.status(404).json({ message: "Shop not found" });
      }
      // Return only necessary public shop info
      const payload = {
        id: shop.id,
        name: shop.name,
        shopProfile: shop.shopProfile,
      } as const;
      await setCache(cacheKey, payload, SHOP_DETAIL_CACHE_TTL_MS);
      res.json(payload);
    } catch (error) {
      logger.error("Error fetching shop details:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch shop details",
        });
    }
  });

  app.delete(
    "/api/products/:id",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        const productId = getValidatedParam(req, "id");
        logger.info(`Delete product request received for ID: ${productId}`);
        const product = await storage.getProduct(productId);

        if (!product) {
          logger.info(`Product with ID ${productId} not found`);
          return res.status(404).json({ message: "Product not found" });
        }

        if (product.shopId !== req.user!.id) {
          logger.info(
            `Unauthorized delete attempt for product ${productId} by user ${req.user!.id}`,
          );
          return res
            .status(403)
            .json({ message: "Can only delete own products" });
        }

        try {
          // First, remove the product from all carts to avoid foreign key constraint violations
          logger.info(
            `Removing product ${productId} from all carts before deletion`,
          );
          await storage.removeProductFromAllCarts(productId);

          // Then delete the product
          logger.info(`Deleting product with ID: ${productId}`);
          await storage.deleteProduct(productId);
          await invalidateCache(`product_detail_${product.shopId}_${productId}`);
          logger.info(`Product ${productId} deleted successfully`);
          res.status(200).json({ message: "Product deleted successfully" });
        } catch (deleteError) {
          logger.error(`Error during product deletion process: ${deleteError}`);
          res.status(400).json({
            message:
              deleteError instanceof Error
                ? deleteError.message
                : "Failed to delete product. It may be referenced in orders or other records.",
          });
        }
      } catch (error) {
        logger.error("Error deleting product:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete product",
          });
      }
    },
  );

  // Product Reviews
  app.get("/api/reviews/product/:id", requireAuth, async (req, res) => {
    try {
      const productId = getValidatedParam(req, "id");
      const reviews = await storage.getProductReviewsByProduct(productId);
      res.json(reviews);
    } catch (error) {
      logger.error("Error fetching product reviews:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch reviews",
        });
    }
  });

  app.get("/api/reviews/shop/:id", requireAuth, async (req, res) => {
    try {
      const shopId = getValidatedParam(req, "id");
      const reviews = await storage.getProductReviewsByShop(shopId);
      res.json(reviews);
    } catch (error) {
      logger.error("Error fetching shop product reviews:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch reviews",
        });
    }
  });

  app.get(
    "/api/product-reviews/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const reviews = await storage.getProductReviewsByCustomer(req.user!.id);
        res.json(reviews);
      } catch (error) {
        logger.error("Error fetching customer product reviews:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch reviews",
          });
      }
    },
  );

  app.post(
    "/api/product-reviews",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const result = insertProductReviewSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      if (!result.data.orderId) {
        return res.status(400).json({ message: "Order id required" });
      }
      try {
        const order = await storage.getOrder(result.data.orderId);
        if (!order || order.customerId !== req.user!.id) {
          return res.status(403).json({ message: "Cannot review this order" });
        }

        const review = await storage.createProductReview({
          ...result.data,
          customerId: req.user!.id,
          isVerifiedPurchase: true,
        });
        res.status(201).json(review);
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to save review",
          });
      }
    },
  );

  app.patch(
    "/api/product-reviews/:id",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const reviewId = getValidatedParam(req, "id");
        const parsedBody = reviewUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        const updatePayload: Record<string, unknown> = {};
        if (parsedBody.data.rating !== undefined) {
          updatePayload.rating = parsedBody.data.rating;
        }
        if (parsedBody.data.review !== undefined) {
          updatePayload.review = parsedBody.data.review;
        }

        const existing = await storage.getProductReviewById(reviewId);
        if (!existing) {
          return res.status(404).json({ message: "Review not found" });
        }
        if (existing.customerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "You can only edit your own reviews" });
        }

        const updated = await storage.updateProductReview(reviewId, updatePayload);
        res.json(updated);
      } catch (error) {
        logger.error("Error updating product review:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update review",
          });
      }
    },
  );
  app.post(
    "/api/product-reviews/:id/reply",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        const parsedBody = reviewReplySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { reply } = parsedBody.data;
        const reviewId = getValidatedParam(req, "id");
        const existingReview = await storage.getProductReviewById(reviewId);
        if (!existingReview) {
          return res.status(404).json({ message: "Review not found" });
        }
        if (existingReview.productId === null) {
          return res.status(400).json({ message: "Invalid review" });
        }
        const product = existingReview.productId
          ? await storage.getProduct(existingReview.productId)
          : null;
        if (!product || product.shopId !== req.user!.id) {
          return res
            .status(403)
            .json({
              message: "You can only reply to reviews for your own products",
            });
        }
        const review = await storage.updateProductReview(reviewId, {
          shopReply: reply,
        });
        res.json(review);
      } catch (error) {
        logger.error("Error replying to review:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to reply to review",
          });
      }
    },
  );

  // Promotions Management
  app.post(
    "/api/promotions",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        // Define a Zod schema for the promotion with expiryDays
        const promotionWithExpirySchema = z
          .object({
            name: z.string().min(1, "Promotion name is required"),
            description: z.string().optional(),
            type: z.enum(["percentage", "fixed_amount"]),
            value: z.coerce.number().min(0, "Discount value must be positive"),
            code: z.string().optional(),
            usageLimit: z.coerce.number().min(0).default(0),
            isActive: z.boolean().default(true),
            shopId: z.coerce.number().optional(),
            expiryDays: z.coerce.number().min(0).default(0),
          })
          .strict();

        // Validate the request body
        const result = promotionWithExpirySchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        // Extract validated data
        const { expiryDays, ...promotionData } = result.data;

        // Set startDate to current time
        const startDate = new Date();

        // Calculate endDate based on expiryDays
        let endDate = null;
        if (expiryDays > 0) {
          const calculatedEndDate = new Date();
          calculatedEndDate.setDate(calculatedEndDate.getDate() + expiryDays);
          endDate = calculatedEndDate;
        }

        logger.info("Creating promotion with calculated dates:", {
          startDate,
          endDate,
          expiryDays,
        });

        const promotion = await storage.createPromotion({
          ...promotionData,
          value: promotionData.value.toString(),
          shopId: req.user!.id,
          startDate,
          endDate,
        });

        res.status(201).json(promotion);
      } catch (error) {
        logger.error("Error creating promotion:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create promotion",
          });
      }
    },
  );

  app.get(
    "/api/promotions/shop/:id",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        const promotions = await storage.getPromotionsByShop(
          getValidatedParam(req, "id"),
        );
        res.json(promotions);
      } catch (error) {
        logger.error("Error fetching promotions:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch promotions",
          });
      }
    },
  );

  app.patch(
    "/api/promotions/:id",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        const promotionId = getValidatedParam(req, "id");

        // Get the existing promotion to check ownership
        const existingPromotions = await storage.getPromotionsByShop(
          req.user!.id,
        );
        const promotion = existingPromotions.find((p) => p.id === promotionId);

        if (!promotion) {
          return res
            .status(404)
            .json({
              message:
                "Promotion not found or you don't have permission to update it",
            });
        }

        // Define a Zod schema for the promotion update with expiryDays
        const promotionUpdateSchema = z
          .object({
            name: z.string().min(1, "Promotion name is required").optional(),
            description: z.string().optional(),
            type: z.enum(["percentage", "fixed_amount"]).optional(),
            value: z.coerce
              .number()
              .min(0, "Discount value must be positive")
              .optional(),
            code: z.string().optional(),
            usageLimit: z.coerce.number().min(0).optional(),
            isActive: z.boolean().optional(),
            expiryDays: z.coerce.number().min(0).optional(),
          })
          .strict();

        // Validate the request body
        const result = promotionUpdateSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        // Extract validated data
        const { expiryDays, ...updateData } = result.data;

        // Always set startDate to current time for updates
        (updateData as any).startDate = new Date();

        // Calculate endDate based on expiryDays
        if (expiryDays !== undefined) {
          if (expiryDays === 0) {
            (updateData as any).endDate = null;
          } else {
            const calculatedEndDate = new Date();
            calculatedEndDate.setDate(calculatedEndDate.getDate() + expiryDays);
            (updateData as any).endDate = calculatedEndDate;
          }
        }

        // Update the promotion using the same storage method as other entities
        const updatedResult = await db
          .update(promotions)
          .set({
            ...updateData,
            value:
              updateData.value !== undefined
                ? updateData.value.toString()
                : updateData.value,
          })
          .where(eq(promotions.id, promotionId))
          .returning();

        if (!updatedResult[0]) {
          return res
            .status(404)
            .json({ message: "Failed to update promotion" });
        }

        res.json(updatedResult[0]);
      } catch (error) {
        logger.error("Error updating promotion:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update promotion",
          });
      }
    },
  );

  app.post(
    "/api/performance-metrics",
    requireAuth,
    async (req, res) => {
      const parsedBody = performanceMetricEnvelopeSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      const metrics = Array.isArray(parsedBody.data)
        ? parsedBody.data
        : [parsedBody.data];

      if (metrics.length > 20) {
        return res
          .status(400)
          .json({ message: "Too many metrics submitted at once" });
      }

      const role = req.user?.role;
      const segment =
        role === "customer"
          ? "customer"
          : role === "provider"
            ? "provider"
            : role === "shop"
              ? "shop"
              : role === "worker"
                ? "provider"
                : "other";

      for (const metric of metrics) {
        recordFrontendMetric(metric, segment);
      }

      res.status(204).send();
    },
  );

  // Register promotion routes
  registerPromotionRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
