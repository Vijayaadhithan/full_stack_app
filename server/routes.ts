import express, {
  type Express,
  Request,
  RequestHandler,
  Response,
  NextFunction,
} from "express";
import { createServer as createHttpServer, type Server } from "http";
import {
  createServer as createHttpsServer,
  type ServerOptions as HttpsServerOptions,
} from "https";
import logger from "./logger";
import type { LogCategory } from "@shared/logging";
import {
  initializeAuth,
  registerAuthRoutes,
} from "./auth";
import { storage } from "./storage";
import { sanitizeUser } from "./security/sanitizeUser";
import { z } from "zod";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";
import {
  getCache,
  setCache,
  invalidateCache,
} from "./services/cache.service";
import {
  insertServiceSchema,
  insertProductSchema,
  insertReviewSchema,
  insertUserSchema,
  insertReturnRequestSchema,
  insertProductReviewSchema,
  insertBlockedTimeSlotSchema,
  promotions,
  orders,
  users,
  reviews,
  User,
  Booking,
  Order,
  type Service,
  type OrderItem,
  PaymentMethodType,
  PaymentMethodSchema,
  ShopProfile,
  Shop,
  TimeSlotLabel,
  timeSlotLabelSchema,
  shops,
  notifications,
  InsertNotification,
  bookings,
} from "@shared/schema";
import { featureFlags, platformFees } from "@shared/config";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import crypto from "crypto";
import { performance } from "node:perf_hooks";
import { formatIndianDisplay, toIndianTime, fromIndianTime } from "@shared/date-utils"; // Import IST utility
import {
  DEFAULT_NEARBY_RADIUS_KM,
  MIN_NEARBY_RADIUS_KM,
  MAX_NEARBY_RADIUS_KM,
  toNumericCoordinate,
  haversineDistanceKm,
} from "./utils/geo";
import { registerPromotionRoutes } from "./routes/promotions"; // Import promotion routes
import { bookingsRouter } from "./routes/bookings";
import { ordersRouter } from "./routes/orders";
import { registerWorkerRoutes } from "./routes/workers";
import { recordFrontendMetric } from "./monitoring/metrics";
import { runWithRequestContext } from "./requestContext";
import { performanceMetricEnvelopeSchema } from "./routes/admin";
import {
  requireShopOrWorkerPermission,
  requireShopOrWorkerContext,
  resolveShopContextId,
  coerceNumericId,
  type RequestWithContext,
} from "./workerAuth";
import {
  usernameLookupLimiter,
} from "./security/rateLimiters";
import {
  registerRealtimeClient,
  notifyNotificationChanges,
} from "./realtime";
import {
  hasRoleAccess,
  isProviderUser,
} from "./security/roleAccess";
import { createCsrfProtection } from "./security/csrfProtection";
import { formatValidationError } from "./utils/zod";
//import { registerShopRoutes } from "./routes/shops"; // Import shop routes
import {
  serviceDetailSchema,
  productDetailSchema,
  orderDetailSchema,
  orderTimelineEntrySchema,
  ServiceDetail,
  ProductDetail,
} from "@shared/api-contract";

const PLATFORM_SERVICE_FEE = featureFlags.platformFeesEnabled
  ? platformFees.productOrder
  : 0;
const SERVICE_DETAIL_CACHE_TTL_SECONDS = 60;
const PRODUCT_DETAIL_CACHE_TTL_SECONDS = 60;
const SHOP_DETAIL_CACHE_TTL_SECONDS = 120;
const NEARBY_SEARCH_LIMIT = 200;
const GLOBAL_SEARCH_RESULT_LIMIT = 25;

const locationUpdateSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    context: z.string().optional(),
  })
  .strict();

const nearbySearchSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z
      .coerce.number()
      .min(MIN_NEARBY_RADIUS_KM)
      .max(MAX_NEARBY_RADIUS_KM)
      .default(DEFAULT_NEARBY_RADIUS_KM),
  })
  .strict();

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

// Magic bytes for common image formats (for XSS prevention)
const IMAGE_MAGIC_BYTES: { type: string; bytes: number[] }[] = [
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] }, // JPEG
  { type: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF87a/89a
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (for WebP)
  { type: "image/bmp", bytes: [0x42, 0x4d] }, // BMP
];

// SECURITY: Block SVG to prevent XSS via script injection
const BLOCKED_MIME_TYPES = new Set([
  "image/svg+xml",
  "text/xml",
  "application/xml",
]);

const BLOCKED_EXTENSIONS = new Set([".svg", ".xml", ".html", ".htm", ".xhtml"]);

function validateImageMagicBytes(buffer: Buffer): boolean {
  return IMAGE_MAGIC_BYTES.some(({ bytes }) =>
    bytes.every((byte, index) => buffer[index] === byte),
  );
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
    // SECURITY: Block SVG and other risky file types that can contain scripts
    if (BLOCKED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(new Error("SVG and XML files are not allowed for security reasons"));
      return;
    }

    // Block by extension as well (defense in depth)
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      cb(new Error("This file extension is not allowed for security reasons"));
      return;
    }

    // Only allow actual image types
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type: only image files are allowed"));
    }
  },
});

// SECURITY: Validate magic bytes after upload to prevent MIME spoofing
async function validateUploadedFile(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.promises.open(filePath, "r");
    const buffer = Buffer.alloc(12);
    await fd.read(buffer, 0, 12, 0);
    await fd.close();
    return validateImageMagicBytes(buffer);
  } catch {
    return false;
  }
}

type RequestWithAuth = Request & {
  user?:
  | {
    id?: number | string;
    role?: string;
    isSuspended?: boolean;
    verificationStatus?: string | null;
  }
  | null;
  session?: (Request["session"] & { adminId?: string | null }) | null;
};

function buildPublicShopResponse(shop: User & { ownerId?: number; shopTableId?: number }) {
  const modes = resolveShopModes(shop.shopProfile);
  return {
    id: shop.id, // This is the user ID (owner), used for product lookups
    ownerId: shop.ownerId ?? shop.id, // Explicit owner ID for clarity
    shopTableId: shop.shopTableId, // The shops table row ID (if available)
    name: shop.name,
    phone: shop.phone ?? null,
    shopProfile: shop.shopProfile ?? null,
    profilePicture: shop.profilePicture ?? null,
    shopBannerImageUrl: shop.shopBannerImageUrl ?? null,
    shopLogoImageUrl: shop.shopLogoImageUrl ?? null,
    addressStreet: shop.addressStreet ?? null,
    addressCity: shop.addressCity ?? null,
    addressState: shop.addressState ?? null,
    addressPostalCode: shop.addressPostalCode ?? null,
    addressCountry: shop.addressCountry ?? null,
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    deliveryAvailable: shop.deliveryAvailable ?? false,
    pickupAvailable: shop.pickupAvailable ?? false,
    returnsEnabled: shop.returnsEnabled ?? false,
    averageRating: shop.averageRating ?? null,
    totalReviews: shop.totalReviews ?? 0,
    catalogModeEnabled: modes.catalogModeEnabled,
    openOrderMode: modes.openOrderMode,
    allowPayLater: modes.allowPayLater,
  };
}

function buildShopProfileFromRecord(shop: Shop): ShopProfile {
  return {
    shopName: shop.shopName,
    description: shop.description ?? "",
    businessType: shop.businessType ?? "",
    gstin: shop.gstin ?? null,
    shopAddressStreet: shop.shopAddressStreet ?? undefined,
    shopAddressArea: shop.shopAddressArea ?? undefined,
    shopAddressCity: shop.shopAddressCity ?? undefined,
    shopAddressState: shop.shopAddressState ?? undefined,
    shopAddressPincode: shop.shopAddressPincode ?? undefined,
    shopLocationLat: shop.shopLocationLat ? Number(shop.shopLocationLat) : undefined,
    shopLocationLng: shop.shopLocationLng ? Number(shop.shopLocationLng) : undefined,
    workingHours: shop.workingHours ?? { from: "09:00", to: "18:00", days: [] },
    shippingPolicy: shop.shippingPolicy ?? undefined,
    returnPolicy: shop.returnPolicy ?? undefined,
    catalogModeEnabled: shop.catalogModeEnabled ?? false,
    openOrderMode: shop.openOrderMode ?? false,
    allowPayLater: shop.allowPayLater ?? false,
    payLaterWhitelist: shop.payLaterWhitelist ?? [],
  };
}

function hydrateShopOwner(owner: User, shop: Shop) {
  return {
    ...owner,
    role: "shop" as const,
    ownerId: shop.ownerId,
    shopTableId: shop.id,
    shopProfile: buildShopProfileFromRecord(shop),
    latitude: shop.shopLocationLat ?? owner.latitude,
    longitude: shop.shopLocationLng ?? owner.longitude,
    addressStreet: shop.shopAddressStreet ?? owner.addressStreet,
    addressCity: shop.shopAddressCity ?? owner.addressCity,
    addressState: shop.shopAddressState ?? owner.addressState,
    addressPostalCode: shop.shopAddressPincode ?? owner.addressPostalCode,
  };
}

async function fetchShopOwnerWithProfile(
  ownerId: number,
  ownerOverride?: User | null,
): Promise<(User & { ownerId?: number; shopTableId?: number }) | null> {
  const owner = ownerOverride ?? (await storage.getUser(ownerId));
  if (!owner) return null;
  const skipDbLookup =
    process.env.NODE_ENV === "test" || process.env.USE_IN_MEMORY_DB === "true";

  if (skipDbLookup) {
    if (owner.role === "shop" || owner.shopProfile) {
      return owner;
    }
    return null;
  }

  try {
    const records = await db.primary
      .select()
      .from(shops)
      .where(eq(shops.ownerId, ownerId))
      .limit(1);
    const shop = records[0];
    if (shop) {
      return hydrateShopOwner(owner, shop);
    }
  } catch (err) {
    logger.warn({ err, ownerId }, "Failed to fetch shop profile from shops table");
  }

  if (owner.shopProfile) return owner;
  return null;
}

declare global {
  namespace Express {
    // Stores sanitized, numeric route parameters for downstream handlers.
    interface Request {
      validatedParams?: Record<string, number>;
      workerShopId?: number;
      shopContextId?: number;
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
      | "addressLandmark"
      | "addressCity"
      | "addressState"
      | "addressPostalCode"
      | "addressCountry"
    >
    | null,
): string | null => {
  if (!user) return null;
  const parts = [
    user.addressStreet,
    user.addressLandmark,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter((part): part is string => Boolean(part && part.trim()));
  if (parts.length === 0) {
    return null;
  }
  return parts.join(", ");
};

function pickAddressFields(
  user: User | null | undefined,
): Record<string, string | null> | null {
  if (!user) return null;
  const address = {
    addressStreet: user.addressStreet ?? null,
    addressLandmark: user.addressLandmark ?? null,
    addressCity: user.addressCity ?? null,
    addressState: user.addressState ?? null,
    addressPostalCode: user.addressPostalCode ?? null,
    addressCountry: user.addressCountry ?? null,
  };
  return Object.values(address).some((value) => value && String(value).trim())
    ? address
    : null;
}

function extractUserCoordinates(
  user: Pick<User, "latitude" | "longitude"> | null | undefined,
): { latitude: number | null; longitude: number | null } {
  const lat = toNumericCoordinate(user?.latitude ?? null);
  const lng = toNumericCoordinate(user?.longitude ?? null);
  return {
    latitude: lat === null ? null : Number(lat.toFixed(6)),
    longitude: lng === null ? null : Number(lng.toFixed(6)),
  };
}

function resolveShopModes(
  profile: ShopProfile | null | undefined,
): { catalogModeEnabled: boolean; openOrderMode: boolean; allowPayLater: boolean } {
  const catalogModeEnabled = Boolean(profile?.catalogModeEnabled);
  const openOrderMode =
    profile?.openOrderMode !== undefined
      ? Boolean(profile.openOrderMode)
      : catalogModeEnabled;
  const allowPayLater = Boolean(profile?.allowPayLater);
  return {
    catalogModeEnabled,
    openOrderMode,
    allowPayLater,
  };
}

function normalizePayLaterWhitelist(
  profile: ShopProfile | null | undefined,
): number[] {
  if (!profile?.payLaterWhitelist) {
    return [];
  }
  const ids = Array.isArray(profile.payLaterWhitelist)
    ? profile.payLaterWhitelist
    : [];
  const normalized = ids
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  return Array.from(new Set(normalized));
}

async function evaluatePayLaterEligibility(
  shop: User,
  customerId: number,
): Promise<{
  allowPayLater: boolean;
  isKnownCustomer: boolean;
  isWhitelisted: boolean;
}> {
  const shopModes = resolveShopModes(shop.shopProfile ?? null);
  if (!shopModes.allowPayLater) {
    return {
      allowPayLater: false,
      isKnownCustomer: false,
      isWhitelisted: false,
    };
  }

  const whitelist = normalizePayLaterWhitelist(shop.shopProfile ?? null);
  const isWhitelisted = whitelist.includes(customerId);

  const skipDbLookup =
    process.env.NODE_ENV === "test" || process.env.USE_IN_MEMORY_DB === "true";
  if (skipDbLookup) {
    const eligibleStatuses = new Set([
      "confirmed",
      "processing",
      "packed",
      "dispatched",
      "shipped",
      "delivered",
    ]);
    const ordersForShop = await storage.getOrdersByShop(shop.id);
    const isKnownCustomer = ordersForShop.some(
      (order) => order.customerId === customerId && eligibleStatuses.has(order.status),
    );
    return {
      allowPayLater: true,
      isKnownCustomer,
      isWhitelisted,
    };
  }

  const priorOrders = await db.primary
    .select({ value: sql<number>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shop.id),
        eq(orders.customerId, customerId),
        inArray(orders.status, [
          "confirmed",
          "processing",
          "packed",
          "dispatched",
          "shipped",
          "delivered",
        ]),
      ),
    );
  const isKnownCustomer = Number(priorOrders[0]?.value ?? 0) > 0;



  return {
    allowPayLater: isWhitelisted || isKnownCustomer,
    isKnownCustomer,
    isWhitelisted,
  };
}

function buildUserResponse(
  req: RequestWithAuth,
  user: User,
): Record<string, unknown> | null {
  const sanitized = sanitizeUser(user);
  if (!sanitized) {
    return null;
  }

  const requesterId =
    typeof req.user?.id === "number"
      ? req.user.id
      : typeof req.user?.id === "string"
        ? Number.parseInt(req.user.id, 10)
        : null;
  const isSelf = requesterId === sanitized.id;
  const isAdminSession = Boolean(req.session?.adminId);
  const isAdminUser = req.user?.role === "admin";

  if (isSelf || isAdminSession || isAdminUser) {
    return sanitized;
  }

  const minimal: Record<string, unknown> = {
    id: sanitized.id,
    name: sanitized.name,
    role: sanitized.role,
    profilePicture: sanitized.profilePicture ?? null,
    averageRating: sanitized.averageRating ?? null,
    totalReviews: sanitized.totalReviews ?? 0,
  };

  if (sanitized.role === "shop") {
    if (sanitized.shopProfile) {
      minimal.shopProfile = {
        shopName: sanitized.shopProfile.shopName,
        description: sanitized.shopProfile.description,
        businessType: sanitized.shopProfile.businessType,
      };
    }

    minimal.pickupAvailable = sanitized.pickupAvailable ?? null;
    minimal.deliveryAvailable = sanitized.deliveryAvailable ?? null;
    minimal.returnsEnabled = sanitized.returnsEnabled ?? null;
    const modes = resolveShopModes(sanitized.shopProfile ?? null);
    minimal.catalogModeEnabled = modes.catalogModeEnabled;
    minimal.openOrderMode = modes.openOrderMode;
    minimal.allowPayLater = modes.allowPayLater;

    minimal.addressStreet = sanitized.addressStreet ?? null;
    minimal.addressCity = sanitized.addressCity ?? null;
    minimal.addressState = sanitized.addressState ?? null;
    minimal.addressPostalCode = sanitized.addressPostalCode ?? null;
    minimal.addressCountry = sanitized.addressCountry ?? null;

    const { latitude, longitude } = extractUserCoordinates(sanitized);
    minimal.latitude = latitude;
    minimal.longitude = longitude;
  }

  if (sanitized.role === "provider") {
    minimal.bio = sanitized.bio ?? null;
    minimal.specializations = sanitized.specializations ?? [];
  }

  return minimal;
}

type CustomerBookingHydrated = Booking & {
  service?: Service | null;
  customer?:
  | {
    id: number;
    name: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  }
  | null;
  provider?:
  | {
    id: number;
    name: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  }
  | null;
  relevantAddress?: Record<string, string | null> | null;
};

async function hydrateCustomerBookings(
  bookingList: Booking[],
): Promise<CustomerBookingHydrated[]> {
  if (bookingList.length === 0) {
    return [];
  }

  const bookingIds = bookingList.map((b) => b.id);

  const bookingsWithRelations = await storage.getBookingsWithRelations(bookingIds);

  return bookingsWithRelations.map((booking) => {
    const service = booking.service;
    const customer = booking.customer;
    const provider = service?.provider;

    let relevantAddress: Record<string, string | null> | null = null;
    if (service?.serviceLocationType === "provider_location") {
      relevantAddress = pickAddressFields(provider);
    } else if (service?.serviceLocationType === "customer_location") {
      relevantAddress = pickAddressFields(customer);
    }

    return {
      ...booking,
      service: service, // Matches CustomerBookingHydrated
      customer: customer
        ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          ...extractUserCoordinates(customer),
        }
        : null,
      provider: provider
        ? {
          id: provider.id,
          name: provider.name,
          phone: provider.phone,
          ...extractUserCoordinates(provider),
        }
        : null,
      relevantAddress,
    };
  });
}

type ProviderBookingHydrated = Booking & {
  service: Service | { name: string };
  customer?: {
    id: number;
    name: string | null;
    phone: string | null;
    addressStreet?: string | null;
    addressLandmark?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostalCode?: string | null;
    addressCountry?: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  relevantAddress?: Record<string, string | null> | null;
};

async function hydrateProviderBookings(
  bookingList: Booking[],
): Promise<ProviderBookingHydrated[]> {
  if (bookingList.length === 0) {
    return [];
  }

  const bookingIds = bookingList.map((b) => b.id);

  const bookingsWithRelations = await storage.getBookingsWithRelations(bookingIds);

  return bookingsWithRelations.map((booking) => {
    const service = booking.service;
    const customer = booking.customer;
    const relevantAddress = pickAddressFields(customer);

    return {
      ...booking,
      service: service || { name: "Unknown Service" },
      customer: customer
        ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          addressStreet: customer.addressStreet,
          addressLandmark: customer.addressLandmark,
          addressCity: customer.addressCity,
          addressState: customer.addressState,
          addressPostalCode: customer.addressPostalCode,
          addressCountry: customer.addressCountry,
          ...extractUserCoordinates(customer),
        }
        : null,
      relevantAddress,
    };
  });
}

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
  shop?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  customer?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
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
  const ordersWithRelations = await storage.getOrdersWithRelations(orderIds);
  const orderMap = new Map(ordersWithRelations.map((o) => [o.id, o]));

  return orders.map((order) => {
    const relations = orderMap.get(order.id);
    const hydratedItems =
      relations?.items.map<HydratedOrderItem>((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product?.name ?? "",
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })) ?? [];

    const result: HydratedOrder = {
      ...(order as Order),
      items: hydratedItems,
    };

    if (relations) {
      if (options.includeShop && relations.shop) {
        const { latitude, longitude } = extractUserCoordinates(relations.shop);
        const address = formatUserAddress(relations.shop);
        result.shop = {
          name: relations.shop.name,
          phone: relations.shop.phone,
          email: relations.shop.email,
          address: address ?? null,
          latitude,
          longitude,
        };
      }

      if (options.includeCustomer && relations.customer) {
        const { latitude, longitude } = extractUserCoordinates(relations.customer);
        const address = formatUserAddress(relations.customer);
        result.customer = {
          name: relations.customer.name,
          phone: relations.customer.phone,
          email: relations.customer.email,
          address: address ?? null,
          latitude,
          longitude,
        };
      }
    }

    return result;
  });
}

type ActiveOrderBoardLane = "new" | "packing" | "ready";

type ActiveOrderBoardItem = {
  id: number;
  status: Order["status"];
  total: number;
  paymentStatus: Order["paymentStatus"] | null;
  deliveryMethod: Order["deliveryMethod"] | null;
  orderDate: string | null;
  customerName: string | null;
  items: {
    id: number;
    productId: number | null;
    name: string;
    quantity: number;
  }[];
};

type ActiveOrderBoard = Record<ActiveOrderBoardLane, ActiveOrderBoardItem[]>;

const ACTIVE_ORDER_STATUSES: Order["status"][] = [
  "pending",
  "awaiting_customer_agreement",
  "confirmed",
  "processing",
  "packed",
  "dispatched",
  "shipped",
];

function getBoardLaneForStatus(
  status: Order["status"],
): ActiveOrderBoardLane | null {
  if (
    status === "pending" ||
    status === "awaiting_customer_agreement" ||
    status === "confirmed"
  )
    return "new";
  if (status === "processing" || status === "packed") return "packing";
  if (status === "dispatched" || status === "shipped") return "ready";
  return null;
}

const dateStringSchema = z
  .string()
  .refine(isValidDateString, { message: "Invalid date format" });

const optionalBooleanQuerySchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return value;
}, z.boolean().optional());

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
  "en_route",
  "disputed",
  "rescheduled_by_provider",
]);

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
    timeSlotLabel: timeSlotLabelSchema.nullable().optional(),
  })
  .strict();

type ServiceBookingSlot = {
  start: Date;
  end: Date;
  timeSlotLabel: TimeSlotLabel | null;
};

const BROAD_TIME_SLOTS: Record<
  TimeSlotLabel,
  { startHour: number; endHour: number }
> = {
  morning: { startHour: 9, endHour: 12 },
  afternoon: { startHour: 12, endHour: 16 },
  evening: { startHour: 16, endHour: 20 },
};

function buildSlotWindow(date: Date, label?: TimeSlotLabel | null) {
  if (!label || !BROAD_TIME_SLOTS[label]) {
    return null;
  }
  // Convert to IST to set the correct hours for the slot
  const startZoned = new Date(toIndianTime(date));
  startZoned.setHours(BROAD_TIME_SLOTS[label].startHour, 0, 0, 0);
  const endZoned = new Date(toIndianTime(date));
  endZoned.setHours(BROAD_TIME_SLOTS[label].endHour, 0, 0, 0);
  // Convert back from IST representation to proper UTC Date
  return {
    start: fromIndianTime(startZoned),
    end: fromIndianTime(endZoned),
  };
}

async function fetchServiceBookingSlots(
  serviceId: number,
  bookingDate: Date,
): Promise<ServiceBookingSlot[] | null> {
  const service = await storage.getService(serviceId);
  if (!service) {
    return null;
  }

  const bookings = await storage.getBookingsByService(serviceId, bookingDate);
  const durationMinutesRaw =
    typeof service.duration === "number" && !Number.isNaN(service.duration)
      ? service.duration
      : 0;
  const bufferMinutesRaw =
    typeof service.bufferTime === "number" && !Number.isNaN(service.bufferTime)
      ? service.bufferTime
      : 0;

  const combinedMinutes = durationMinutesRaw + bufferMinutesRaw;
  const slotMinutes =
    combinedMinutes > 0
      ? combinedMinutes
      : durationMinutesRaw > 0
        ? durationMinutesRaw
        : 60;
  const slotDurationMs = slotMinutes * 60_000;

  return bookings.map((booking) => ({
    ...(buildSlotWindow(
      booking.bookingDate,
      (booking as any).timeSlotLabel as TimeSlotLabel | null,
    ) ?? {
      start: booking.bookingDate,
      end: new Date(booking.bookingDate.getTime() + slotDurationMs),
    }),
    timeSlotLabel: (booking as any).timeSlotLabel ?? null,
  }));
}

const bookingStatusUpdateSchema = z
  .object({
    status: z.enum(["accepted", "rejected", "rescheduled"]),
    rejectionReason: z.string().trim().min(1).max(500).optional(),
    rescheduleDate: dateStringSchema.optional(),
    rescheduleReason: z.string().trim().min(1).max(500).optional(),
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
    if (value.status === "rescheduled") {
      if (!value.rescheduleDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Reschedule date is required when rescheduling a booking",
          path: ["rescheduleDate"],
        });
      } else if (Number.isNaN(new Date(value.rescheduleDate).getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Reschedule date must be a valid date",
          path: ["rescheduleDate"],
        });
      }
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
    role: z.enum(["customer", "provider", "shop", "worker", "admin"]).optional().nullable(),
  })
  .strict();

const productUpdateSchema = insertProductSchema.partial();
const quickAddProductSchema = z
  .object({
    name: z.string().min(1),
    price: z.string().or(z.number()),
    image: z.string().optional(),
    category: z.string().optional(),
    mrp: z.string().or(z.number()).optional(),
  })
  .strict();

const productBulkUpdateSchema = z
  .object({
    updates: z
      .array(
        z
          .object({
            productId: z.number().int().positive(),
            stock: z.number().int().min(0),
            lowStockThreshold: z.number().int().min(0).nullable().optional(),
          })
          .strict(),
      )
      .min(1, { message: "At least one product update is required" }),
  })
  .strict();

const serviceUpdateSchema = insertServiceSchema
  .partial()
  .extend({
    serviceLocationType: z
      .enum(["customer_location", "provider_location"])
      .optional(),
  });

const providerAvailabilitySchema = z
  .object({
    isAvailableNow: z.boolean(),
    availabilityNote: z.string().optional().nullable(),
  })
  .strict();

const orderPaymentReferenceSchema = z
  .object({
    paymentReference: z.string().trim().min(1).max(100),
  })
  .strict();

const orderStatusUpdateSchema = z
  .object({
    status: z.enum([
      "pending",
      "awaiting_customer_agreement",
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
    availableNow: optionalBooleanQuerySchema,
    locationCity: z.string().trim().max(100).optional(),
    locationState: z.string().trim().max(100).optional(),
    locationPostalCode: z.string().trim().max(20).optional(),
    availabilityDate: dateStringSchema.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z
      .coerce.number()
      .min(MIN_NEARBY_RADIUS_KM)
      .max(MAX_NEARBY_RADIUS_KM)
      .optional(),
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
  )
  .refine(
    (data) =>
      (data.lat === undefined && data.lng === undefined) ||
      (data.lat !== undefined && data.lng !== undefined),
    {
      message: "lat and lng must be provided together",
      path: ["lat"],
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
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z
      .coerce.number()
      .min(MIN_NEARBY_RADIUS_KM)
      .max(MAX_NEARBY_RADIUS_KM)
      .optional(),
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
  )
  .refine(
    (data) =>
      (data.lat === undefined && data.lng === undefined) ||
      (data.lat !== undefined && data.lng !== undefined),
    {
      message: "lat and lng must be provided together",
      path: ["lat"],
    },
  );

const globalSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z
      .coerce.number()
      .min(MIN_NEARBY_RADIUS_KM)
      .max(MAX_NEARBY_RADIUS_KM)
      .optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data.lat === undefined && data.lng === undefined) ||
      (data.lat !== undefined && data.lng !== undefined),
    {
      message: "lat and lng must be provided together",
      path: ["lat"],
    },
  );

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
    if (!hasRoleAccess(req.user, roles)) {
      return res.status(403).send("Forbidden");
    }
    return next();
  };
}

function ensureProfileVerified(
  req: RequestWithAuth,
  res: Response,
  actionDescription: string,
): boolean {
  const status = req.user?.verificationStatus;
  if (status !== "verified") {
    res.status(403).json({
      message: `Profile verification required to ${actionDescription}. Please complete verification from your profile settings.`,
    });
    return false;
  }
  return true;
}


export async function registerRoutes(app: Express): Promise<Server> {
  initializeAuth(app);

  const csrfProtection: RequestHandler =
    process.env.NODE_ENV === "test"
      ? ((req, _res, next) => {
        (req as Request & { csrfToken?: () => string }).csrfToken = () =>
          "test-csrf-token";
        next();
      })
      : createCsrfProtection({
        ignoreMethods: ["GET", "HEAD", "OPTIONS"],
        // Exempt analytics endpoint - sendBeacon doesn't preserve session cookies for CSRF
        ignorePaths: ["/api/performance-metrics"],
      });

  app.use(csrfProtection);
  registerAuthRoutes(app);

  app.use((req, res, next) => {
    const request = req as RequestWithAuth;
    const category = resolveLogCategory(request);
    const headerRequestId = req.headers["x-request-id"];
    const providedId = Array.isArray(headerRequestId)
      ? headerRequestId[0]
      : headerRequestId;
    const fallbackRequestId = crypto.randomUUID();
    const requestId =
      typeof providedId === "string" && providedId.trim().length > 0
        ? providedId.trim()
        : fallbackRequestId;
    const userId = request.user?.id ?? request.session?.adminId ?? undefined;
    const userRole = request.user?.role ?? undefined;
    const adminId = request.session?.adminId ?? undefined;

    const startedAt = process.hrtime.bigint();
    if (!res.headersSent) {
      res.setHeader("x-request-id", requestId);
    }
    const userAgentHeader = req.headers["user-agent"];

    runWithRequestContext(
      () => {
        if (category !== "admin") {
          res.on("finish", () => {
            if ((res.locals as any)?.skipRequestLog) {
              return;
            }
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
      },
      {
        request: {
          requestId,
          method: req.method,
          path: req.originalUrl,
          ip: req.ip,
          userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
          userId,
          userRole,
          adminId,
        },
        log: {
          category,
          userId,
          userRole,
          adminId,
          requestId,
        },
      },
    );
  });

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
    if (socket && typeof socket.setTimeout === "function") {
      socket.setTimeout(0);
    }
    if (socket && typeof socket.setNoDelay === "function") {
      socket.setNoDelay(true);
    }
    res.locals.skipRequestLog = true;
    registerRealtimeClient(res, userId);
  });

  app.get("/api/csrf-token", (req, res) => {
    res.status(200).json({ csrfToken: req.csrfToken() });
  });


  const numericParamSchemas: Record<string, z.ZodTypeAny> = {
    id: z.coerce.number().int().positive(),
    orderId: z.coerce.number().int().positive(),
    productId: z.coerce.number().int().positive(),
    serviceId: z.coerce.number().int().positive(),
    shopId: z.coerce.number().int().positive(),
    slotId: z.coerce.number().int().positive(),
    customerId: z.coerce.number().int().positive(),
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
  app.get("/api", requireAuth, (_req, res) => {
    const routes = app._router.stack
      .filter((r: any) => r.route && r.route.path)
      .map((r: any) => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods).join(", ").toUpperCase(),
      }))
      .filter((r: any) => r.path.startsWith("/api/") && r.path !== "/api");
    res.json({ available_endpoints: routes });
  });

  // Note: Email-based auth routes removed (email-lookup, magic-link, password-reset via email)
  // Phone-based OTP auth is used instead (see auth.ts)

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
        const match = await db.primary
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

  // Register domain routers
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/orders', ordersRouter);
  registerWorkerRoutes(app);

  const uploadSingleFile = uploadMiddleware.single("file");
  const uploadSingleQr = uploadMiddleware.single("qr");

  app.post("/api/upload", requireAuth, (req, res) => {
    uploadSingleFile(req, res, async (err) => {
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

      // SECURITY: Validate magic bytes to prevent MIME spoofing
      const filePath = path.join(UPLOADS_DIRECTORY, req.file.filename);
      const isValidImage = await validateUploadedFile(filePath);
      if (!isValidImage) {
        // Delete the invalid file
        try {
          await fs.promises.unlink(filePath);
        } catch {
          // Best effort cleanup
        }
        return res.status(400).json({ message: "Invalid image file: file content does not match expected format" });
      }

      res.json({
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
      });
    });
  });

  app.post("/api/users/upload-qr", requireAuth, (req, res) => {
    uploadSingleQr(req, res, async (err) => {
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

      // SECURITY: Validate magic bytes to prevent MIME spoofing
      const filePath = path.join(UPLOADS_DIRECTORY, req.file.filename);
      const isValidImage = await validateUploadedFile(filePath);
      if (!isValidImage) {
        // Delete the invalid file
        try {
          await fs.promises.unlink(filePath);
        } catch {
          // Best effort cleanup
        }
        return res.status(400).json({ message: "Invalid image file: file content does not match expected format" });
      }

      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    });
  });

  // SECURITY: Serve uploads with Content-Disposition to prevent browser interpretation
  // and nosniff header to prevent MIME-type sniffing attacks
  app.use("/uploads", (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "attachment");
    next();
  }, express.static(UPLOADS_DIRECTORY));

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

        if (pendingBookings.length === 0) {
          return res.json([]);
        }

        const scheduledStatuses = new Set<Booking["status"]>([
          "accepted",
          "rescheduled",
          "rescheduled_by_provider",
          "awaiting_payment",
          "en_route",
        ]);
        const { data: providerBookings } = await storage.getBookingsByProvider(providerId, { page: 1, limit: 100 });
        const scheduledBookings = providerBookings.filter((booking) => scheduledStatuses.has(booking.status));

        const serviceIds = Array.from(
          new Set(pendingBookings.map((b) => b.serviceId!).filter(Boolean)),
        );
        const services = await storage.getServicesByIds(serviceIds);
        const serviceMap = new Map(services.map((s) => [s.id, s]));

        const userIds = new Set<number>([providerId]);
        services.forEach((s) => {
          if (s.providerId) userIds.add(s.providerId);
        });
        pendingBookings.forEach((b) => {
          if (b.customerId) userIds.add(b.customerId);
        });
        scheduledBookings.forEach((b) => {
          if (b.customerId) userIds.add(b.customerId);
        });
        const users = await storage.getUsersByIds(Array.from(userIds));
        const userMap = new Map(users.map((u) => [u.id, u]));

        const buildDayKey = (date: Date) =>
          [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0"),
          ].join("-");

        const getBookingCoordinates = (
          booking: Booking,
        ): { lat: number; lon: number } | null => {
          if (booking.serviceLocation === "provider") {
            const provider = userMap.get(providerId);
            const lat = toNumericCoordinate(provider?.latitude ?? null);
            const lon = toNumericCoordinate(provider?.longitude ?? null);
            if (lat === null || lon === null) {
              return null;
            }
            return { lat, lon };
          }

          const customer = booking.customerId
            ? userMap.get(booking.customerId)
            : undefined;
          const lat = toNumericCoordinate(customer?.latitude ?? null);
          const lon = toNumericCoordinate(customer?.longitude ?? null);
          if (lat === null || lon === null) {
            return null;
          }
          return { lat, lon };
        };

        const scheduledBookingsByDay = new Map<string, Booking[]>();
        for (const booking of scheduledBookings) {
          const dateValue = booking.bookingDate
            ? new Date(booking.bookingDate)
            : null;
          if (!dateValue || Number.isNaN(dateValue.getTime())) {
            continue;
          }
          const key = buildDayKey(dateValue);
          if (!scheduledBookingsByDay.has(key)) {
            scheduledBookingsByDay.set(key, []);
          }
          scheduledBookingsByDay.get(key)!.push(booking);
        }

        const bookingsWithDetails = pendingBookings.map((b) => {
          const service = serviceMap.get(b.serviceId!);
          const customer = b.customerId ? userMap.get(b.customerId) : undefined;
          const provider =
            service && service.providerId
              ? userMap.get(service.providerId)
              : undefined;

          let relevantAddress: Record<string, string | null> | null = null;
          if (b.serviceLocation === "customer" && customer) {
            relevantAddress = {
              addressStreet: customer.addressStreet ?? null,
              addressLandmark: customer.addressLandmark ?? null,
              addressCity: customer.addressCity ?? null,
              addressState: customer.addressState ?? null,
              addressPostalCode: customer.addressPostalCode ?? null,
              addressCountry: customer.addressCountry ?? null,
            };
          } else if (b.serviceLocation === "provider" && provider) {
            relevantAddress = {
              addressStreet: provider.addressStreet ?? null,
              addressLandmark: provider.addressLandmark ?? null,
              addressCity: provider.addressCity ?? null,
              addressState: provider.addressState ?? null,
              addressPostalCode: provider.addressPostalCode ?? null,
              addressCountry: provider.addressCountry ?? null,
            };
          }

          let proximityInfo: {
            nearestBookingId: number;
            nearestBookingDate: string | null;
            distanceKm: number;
            message: string;
          } | null = null;

          const bookingDate = b.bookingDate ? new Date(b.bookingDate) : null;
          const currentCoords = getBookingCoordinates(b);
          if (
            bookingDate &&
            !Number.isNaN(bookingDate.getTime()) &&
            currentCoords
          ) {
            const sameDayBookings =
              scheduledBookingsByDay.get(buildDayKey(bookingDate)) || [];

            let nearest:
              | { booking: Booking; distanceKm: number }
              | null = null;
            for (const otherBooking of sameDayBookings) {
              const otherCoords = getBookingCoordinates(otherBooking);
              if (!otherCoords) continue;

              const distanceKm = haversineDistanceKm(
                currentCoords.lat,
                currentCoords.lon,
                otherCoords.lat,
                otherCoords.lon,
              );

              if (!Number.isFinite(distanceKm)) continue;
              if (!nearest || distanceKm < nearest.distanceKm) {
                nearest = { booking: otherBooking, distanceKm };
              }
            }

            if (nearest) {
              const nearestDate = nearest.booking.bookingDate
                ? new Date(nearest.booking.bookingDate)
                : null;
              const roundedDistance = Number(nearest.distanceKm.toFixed(2));
              const formattedTime =
                nearestDate && !Number.isNaN(nearestDate.getTime())
                  ? formatIndianDisplay(nearestDate, "time")
                  : "a nearby slot";

              const message =
                roundedDistance <= 5
                  ? `You have a booking ${roundedDistance} km away at ${formattedTime}, this slot fits well.`
                  : `This location is ${roundedDistance} km from your other booking at ${formattedTime}.`;

              proximityInfo = {
                nearestBookingId: nearest.booking.id,
                nearestBookingDate:
                  nearestDate && !Number.isNaN(nearestDate.getTime())
                    ? nearestDate.toISOString()
                    : null,
                distanceKm: roundedDistance,
                message,
              };
            }
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
            proximityInfo,
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
      const { status, comments, bookingDate, changedBy: _changedBy } = parsedBody.data;
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
      const notificationsToCreate: InsertNotification[] = [];

      // Scenario 1: Customer reschedules
      if (
        bookingDate &&
        booking.customerId === currentUser.id
      ) {
        logger.info(
          `[API] Customer ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`,
        );

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
            notificationsToCreate.push({
              userId: service.providerId,
              type: "booking_rescheduled_request",
              title: "Reschedule Request",
              message: `Customer ${currentUser.name || "ID: " + currentUser.id} requested to reschedule booking #${bookingId} for '${service.name}' to ${formattedRescheduleDate}. Please review.`,
              isRead: false,
              relatedBookingId: bookingId,
            });
          }
        }
      }
      // Scenario 2: Provider reschedules
      else if (
        bookingDate &&
        isProviderUser(currentUser) &&
        service.providerId === currentUser.id
      ) {
        logger.info(
          `[API] Provider ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`,
        );

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
            notificationsToCreate.push({
              userId: booking.customerId,
              type: "booking_rescheduled_by_provider",
              title: "Booking Rescheduled by Provider",
              message: `Provider ${currentUser.name || "ID: " + currentUser.id
                } has rescheduled your booking #${bookingId} for '${service.name
                }' to ${formattedProviderRescheduleDate}. ${comments ? "Comments: " + comments : ""
                }`,
              isRead: false,
              relatedBookingId: bookingId,
            });
          }
        }
      }
      // Scenario 3: Provider accepts/rejects a booking (including a customer's reschedule request)
      else if (
        status &&
        isProviderUser(currentUser) &&
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

            if (
              booking.status === "rescheduled_pending_provider_approval" &&
              status === "accepted"
            ) {
              notificationTitle = "Reschedule Confirmed";
              const formattedRescheduledDate = booking.bookingDate
                ? formatIndianDisplay(booking.bookingDate, "datetime")
                : "N/A";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been accepted. New date: ${formattedRescheduledDate}`;
            } else if (
              booking.status === "rescheduled_pending_provider_approval" &&
              status === "rejected"
            ) {
              notificationTitle = "Reschedule Rejected";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been rejected. ${comments ? comments : "Please contact the provider or try rescheduling again."}`;
            }

            notificationsToCreate.push({
              userId: booking.customerId,
              type:
                status === "accepted"
                  ? "booking_confirmed"
                  : "booking_rejected",
              title: notificationTitle,
              message: notificationMessage,
              isRead: false,
              relatedBookingId: bookingId,
            });
          }
        }
      }
      // Scenario 3: Customer cancels (can be expanded)
      else if (
        status === "cancelled" &&
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
            notificationsToCreate.push({
              userId: service.providerId,
              type: "booking_cancelled_by_customer",
              title: "Booking Cancelled",
              message: `Booking #${bookingId} for '${service.name}' has been cancelled by the customer.`,
              isRead: false,
              relatedBookingId: bookingId,
            });
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

      let finalUpdatedBooking: Booking | undefined;

      await db.primary.transaction(async (tx) => {
        const [updated] = await tx
          .update(bookings)
          .set(updatedBookingData)
          .where(eq(bookings.id, bookingId))
          .returning();

        if (!updated) {
          throw new Error("Failed to update booking");
        }
        finalUpdatedBooking = updated;

        if (notificationsToCreate.length > 0) {
          await tx.insert(notifications).values(
            notificationsToCreate.map((n) => ({
              ...n,
              type: n.type as any,
              relatedBookingId: n.relatedBookingId ?? null,
              createdAt: new Date(),
            })),
          );
        }
      });

      if (!finalUpdatedBooking) {
        throw new Error("Failed to update booking");
      }

      // Send realtime notifications after transaction commits
      notifyNotificationChanges(notificationsToCreate.map((n) => n.userId));

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
        const start = performance.now();
        const bookingRequests =
          await storage.getBookingRequestsWithStatusForCustomer(customerId);
        const prepElapsed = performance.now();

        const bookingsWithDetails =
          await hydrateCustomerBookings(bookingRequests);
        const hydrateElapsed = performance.now();

        logger.debug(
          {
            customerId,
            prepMs: (prepElapsed - start).toFixed(2),
            hydrateMs: (hydrateElapsed - prepElapsed).toFixed(2),
            totalMs: (hydrateElapsed - start).toFixed(2),
            bookingCount: bookingRequests.length,
          },
          "Fetched customer booking requests",
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
        const start = performance.now();
        const bookingHistory =
          await storage.getBookingHistoryForCustomer(customerId);
        const prepElapsed = performance.now();

        const bookingsWithDetails =
          await hydrateCustomerBookings(bookingHistory);
        const hydrateElapsed = performance.now();

        logger.debug(
          {
            customerId,
            prepMs: (prepElapsed - start).toFixed(2),
            hydrateMs: (hydrateElapsed - prepElapsed).toFixed(2),
            totalMs: (hydrateElapsed - start).toFixed(2),
            bookingCount: bookingHistory.length,
          },
          "Fetched customer booking history",
        );
        res.json(bookingsWithDetails);
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      try {
        const history = await storage.getBookingHistoryForProvider(req.user!.id, {
          page,
          limit,
        });
        res.json(history);
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
    async (_req, res) => {
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
  app.post("/api/profile/location", requireAuth, async (req, res) => {
    const parsed = locationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(formatValidationError(parsed.error));
    }

    try {
      const { latitude, longitude, context } = req.body;
      logger.info({ body: req.body }, "Location Update Request Body");
      logger.info({ latitude, longitude, context, lat: Number(latitude), lng: Number(longitude) }, "Parsed values");

      const lat = Number(latitude);
      const lng = Number(longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const msg = `Invalid coordinates. Received: lat=${latitude}, lng=${longitude}, typeLat=${typeof latitude}, typeLng=${typeof longitude}`;
        logger.warn(msg);
        return res.status(400).json({
          message: msg,
          debug: { body: req.body }
        });
      }

      const userId = req.user!.id;

      if (context === "shop" && (req.user?.role === "shop" || req.user?.hasShopProfile)) {
        // Update Shop Location
        await db.primary
          .update(shops)
          .set({
            shopLocationLat: String(lat),
            shopLocationLng: String(lng),
            updatedAt: new Date()
          })
          .where(eq(shops.ownerId, userId));

        // Invalidate shop cache if needed
        await invalidateCache(`shop_detail_${userId}`);

        // Return user as is, or fetch updated shop to return?
        // Frontend expects { user } response to update cache, but we just updated shop.
        // We can return the user object as is since user's personal location didn't change.
        return res.json({ message: "Shop location updated", user: req.user });
      }

      // Default: Update User Personal Location
      // We use the raw values as they are checked for number/finite above
      const updatedUser = await storage.updateUser(userId, {
        latitude: String(lat),
        longitude: String(lng),
      });
      const safeUser = sanitizeUser(updatedUser);
      if (!safeUser) {
        return res.status(500).json({ message: "Unable to save location" });
      }

      if (req.user) {
        req.user.latitude = String(lat) as any;
        req.user.longitude = String(lng) as any;
      }

      res.json({
        message: "Location updated!",
        user: safeUser,
      });
    } catch (error) {
      logger.error("Error updating profile location", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to update location",
        });
    }
  });

  app.get("/api/search/nearby", requireAuth, async (req, res) => {
    const parsed = nearbySearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(formatValidationError(parsed.error));
    }

    const { lat, lng, radius } = parsed.data;
    const currentUserId = req.user?.id as number | undefined;

    // Query shops table with haversine distance calculation
    // Use COALESCE to fall back to user coordinates if shop coordinates are not set
    const distanceExpr = sql`
      6371 * 2 * asin(
        sqrt(
          power(sin((radians(CAST(COALESCE(${shops.shopLocationLat}, ${users.latitude}) AS numeric)) - radians(${lat})) / 2), 2) +
          cos(radians(${lat})) * cos(radians(CAST(COALESCE(${shops.shopLocationLat}, ${users.latitude}) AS numeric))) *
          power(sin((radians(CAST(COALESCE(${shops.shopLocationLng}, ${users.longitude}) AS numeric)) - radians(${lng})) / 2), 2)
        )
      )
    `;

    // Query shops table joined with users
    const shopRecords = await db.primary
      .select()
      .from(shops)
      .leftJoin(users, eq(shops.ownerId, users.id))
      .where(
        and(
          // At least one set of coordinates must be available (shop or user)
          sql`(${shops.shopLocationLat} IS NOT NULL OR ${users.latitude} IS NOT NULL)`,
          sql`(${shops.shopLocationLng} IS NOT NULL OR ${users.longitude} IS NOT NULL)`,
          sql`${distanceExpr} <= ${radius}`,
          // Exclude own shop if user is logged in
          currentUserId !== undefined
            ? sql`${shops.ownerId} != ${currentUserId}`
            : sql`TRUE`
        ),
      )
      .orderBy(distanceExpr)
      .limit(NEARBY_SEARCH_LIMIT);

    // Transform to PublicShop format for frontend compatibility
    const publicShops = shopRecords
      .filter(record => record.users !== null)
      .map(record => {
        const shop = record.shops;
        const owner = record.users!;
        // Build a User-like object similar to getShops()
        return buildPublicShopResponse({
          ...owner,
          role: "shop" as const,
          shopProfile: {
            shopName: shop.shopName,
            description: shop.description || "",
            businessType: shop.businessType || "",
            gstin: shop.gstin,
            workingHours: shop.workingHours || { from: "09:00", to: "18:00", days: [] },
            shippingPolicy: shop.shippingPolicy || undefined,
            returnPolicy: shop.returnPolicy || undefined,
            catalogModeEnabled: shop.catalogModeEnabled ?? false,
            openOrderMode: shop.openOrderMode ?? false,
            allowPayLater: shop.allowPayLater ?? false,
            payLaterWhitelist: shop.payLaterWhitelist || [],
          },
          latitude: shop.shopLocationLat || owner.latitude,
          longitude: shop.shopLocationLng || owner.longitude,
          addressStreet: shop.shopAddressStreet || owner.addressStreet,
          addressCity: shop.shopAddressCity || owner.addressCity,
          addressState: shop.shopAddressState || owner.addressState,
          addressPostalCode: shop.shopAddressPincode || owner.addressPostalCode,
        });
      });

    res.json(publicShops);
  });


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
  }).strict();

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = getValidatedParam(req, "id");
      if (userId !== req.user!.id) {
        return res.status(403).json({ message: "Can only update own profile" });
      }

      const result = profileUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json(formatValidationError(result.error));
      }

      // All users can update UPI fields now (for receiving payments)
      // Previously only allowed for provider/shop roles

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

      const skipShopSync =
        process.env.NODE_ENV === "test" || process.env.USE_IN_MEMORY_DB === "true";
      if (!skipShopSync && (req.user?.role === "shop" || req.user?.hasShopProfile)) {
        const shopProfileUpdate = updateData.shopProfile as ShopProfile | undefined;
        const shopUpdate: Partial<typeof shops.$inferInsert> = {};

        if (shopProfileUpdate) {
          if (shopProfileUpdate.shopName !== undefined) {
            shopUpdate.shopName = shopProfileUpdate.shopName;
          }
          if (shopProfileUpdate.description !== undefined) {
            shopUpdate.description = shopProfileUpdate.description;
          }
          if (shopProfileUpdate.businessType !== undefined) {
            shopUpdate.businessType = shopProfileUpdate.businessType;
          }
          if (shopProfileUpdate.gstin !== undefined) {
            shopUpdate.gstin = shopProfileUpdate.gstin;
          }
          if (shopProfileUpdate.workingHours !== undefined) {
            shopUpdate.workingHours = shopProfileUpdate.workingHours;
          }
          if (shopProfileUpdate.shippingPolicy !== undefined) {
            shopUpdate.shippingPolicy = shopProfileUpdate.shippingPolicy;
          }
          if (shopProfileUpdate.returnPolicy !== undefined) {
            shopUpdate.returnPolicy = shopProfileUpdate.returnPolicy;
          }
          if (shopProfileUpdate.catalogModeEnabled !== undefined) {
            shopUpdate.catalogModeEnabled = shopProfileUpdate.catalogModeEnabled;
          }
          if (shopProfileUpdate.openOrderMode !== undefined) {
            shopUpdate.openOrderMode = shopProfileUpdate.openOrderMode;
          }
          if (shopProfileUpdate.allowPayLater !== undefined) {
            shopUpdate.allowPayLater = shopProfileUpdate.allowPayLater;
          }
          if (shopProfileUpdate.payLaterWhitelist !== undefined) {
            shopUpdate.payLaterWhitelist = shopProfileUpdate.payLaterWhitelist;
          }
          if (shopProfileUpdate.shopAddressStreet !== undefined) {
            shopUpdate.shopAddressStreet = shopProfileUpdate.shopAddressStreet;
          }
          if (shopProfileUpdate.shopAddressArea !== undefined) {
            shopUpdate.shopAddressArea = shopProfileUpdate.shopAddressArea;
          }
          if (shopProfileUpdate.shopAddressCity !== undefined) {
            shopUpdate.shopAddressCity = shopProfileUpdate.shopAddressCity;
          }
          if (shopProfileUpdate.shopAddressState !== undefined) {
            shopUpdate.shopAddressState = shopProfileUpdate.shopAddressState;
          }
          if (shopProfileUpdate.shopAddressPincode !== undefined) {
            shopUpdate.shopAddressPincode = shopProfileUpdate.shopAddressPincode;
          }
          if (shopProfileUpdate.shopLocationLat !== undefined) {
            shopUpdate.shopLocationLat = String(shopProfileUpdate.shopLocationLat);
          }
          if (shopProfileUpdate.shopLocationLng !== undefined) {
            shopUpdate.shopLocationLng = String(shopProfileUpdate.shopLocationLng);
          }
        }

        if (updateData.addressStreet !== undefined) {
          shopUpdate.shopAddressStreet = updateData.addressStreet ?? null;
        }
        if (updateData.addressCity !== undefined) {
          shopUpdate.shopAddressCity = updateData.addressCity ?? null;
        }
        if (updateData.addressState !== undefined) {
          shopUpdate.shopAddressState = updateData.addressState ?? null;
        }
        if (updateData.addressPostalCode !== undefined) {
          shopUpdate.shopAddressPincode = updateData.addressPostalCode ?? null;
        }

        if (Object.keys(shopUpdate).length > 0) {
          await db.primary
            .update(shops)
            .set({ ...shopUpdate, updatedAt: new Date() })
            .where(eq(shops.ownerId, userId));
        }
      }

      const safeUser = sanitizeUser(updatedUser);

      if (!safeUser) {
        return res
          .status(500)
          .json({ message: "Failed to update user profile" });
      }

      if (req.user) Object.assign(req.user, safeUser);
      // Invalidate both shop details and user session to ensure fresh data on next request
      await invalidateCache(`shop_detail_${userId}`);
      await invalidateCache(`user_session:${userId}`);
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

  // Get current shop for the logged-in user
  app.get("/api/shops/current", requireAuth, async (req, res) => {
    try {
      const shop = await db.primary.query.shops.findFirst({
        where: eq(shops.ownerId, req.user!.id),
      });

      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      res.json(shop);
    } catch (error) {
      logger.error("Error fetching current shop:", error);
      res.status(500).json({ message: "Failed to fetch shop" });
    }
  });

  // Get all shops
  app.get("/api/shops", async (req, res) => {
    try {
      const parsedQuery = shopsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json(formatValidationError(parsedQuery.error));
      }

      const filters = Object.fromEntries(
        Object.entries(parsedQuery.data).filter(([, value]) => value !== undefined),
      );

      // Exclude own shop if user is logged in
      const currentUserId = (req.user?.id as number) || undefined;
      const queryFilters = {
        ...filters,
        excludeOwnerId: currentUserId,
      };

      logger.info({ currentUserId, queryFilters }, "[/api/shops] Fetching shops with filters");
      const shops = await storage.getShops(queryFilters);
      logger.info({ shopCount: shops.length, shopRoles: shops.map(s => ({ id: s.id, role: s.role })) }, "[/api/shops] Shops returned from storage");

      const publicShops = shops
        .filter((shop): shop is User => Boolean(shop && shop.role === "shop"))
        .map((shop) => buildPublicShopResponse(shop as User));

      logger.info({ filteredCount: publicShops.length }, "[/api/shops] Shops after role filter");
      res.json(publicShops);
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


  // Shop dashboard stats - MUST be defined before /api/shops/:id to avoid route conflict
  app.get(
    "/api/shops/dashboard-stats",
    requireAuth,
    requireShopOrWorkerContext(),
    async (req, res) => {
      try {
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
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

  // Get shop by ID (fetches from shops table, not users)
  app.get("/api/shops/:id", async (req, res) => {
    try {
      const shopId = getValidatedParam(req, "id");

      // Prefer owner ID lookup, fall back to shop table ID
      const byOwnerId = await db.primary
        .select()
        .from(shops)
        .leftJoin(users, eq(shops.ownerId, users.id))
        .where(eq(shops.ownerId, shopId))
        .limit(1);
      const byShopId =
        byOwnerId[0] ??
        (await db.primary
          .select()
          .from(shops)
          .leftJoin(users, eq(shops.ownerId, users.id))
          .where(eq(shops.id, shopId))
          .limit(1))[0];

      if (!byShopId) {
        return res.status(404).json({ message: "Shop not found" });
      }

      const shop = byShopId.shops;
      const owner = byShopId.users;

      if (!owner) {
        return res.status(404).json({ message: "Shop owner not found" });
      }

      const publicShop = buildPublicShopResponse(
        hydrateShopOwner(owner, shop),
      );

      res.json(publicShop);
    } catch (error) {
      logger.error("Error fetching shop by ID:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch shop",
        });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = getValidatedParam(req, "id");
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const safeUser = buildUserResponse(req as RequestWithAuth, user);
      if (!safeUser) {
        return res.status(500).json({ message: "Failed to fetch user" });
      }

      const shopOwner = await fetchShopOwnerWithProfile(user.id, user);
      if (shopOwner && req.user) {
        const requesterId =
          typeof req.user.id === "number"
            ? req.user.id
            : Number.parseInt(String(req.user.id), 10);
        if (Number.isFinite(requesterId)) {
          const eligibility = await evaluatePayLaterEligibility(
            shopOwner,
            requesterId,
          );
          (safeUser as Record<string, unknown>).payLaterEligibilityForCustomer =
          {
            eligible:
              eligibility.allowPayLater &&
              (eligibility.isKnownCustomer || eligibility.isWhitelisted),
            isKnownCustomer: eligibility.isKnownCustomer,
            isWhitelisted: eligibility.isWhitelisted,
          };
        }
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
        const requestWithAuth = req as RequestWithAuth;
        if (requestWithAuth.user?.role === "shop" || requestWithAuth.user?.hasShopProfile) {
          if (
            !ensureProfileVerified(
              requestWithAuth,
              res,
              "manage your shop listings",
            )
          ) {
            return;
          }
        } else if (requestWithAuth.user?.role === "worker") {
          const shopContextId = req.shopContextId;
          if (typeof shopContextId !== "number") {
            return res
              .status(403)
              .json({ message: "Unable to resolve shop context" });
          }
          const shopOwner = await storage.getUser(shopContextId);
          if (!shopOwner) {
            return res.status(404).json({ message: "Shop not found" });
          }
          if (shopOwner.verificationStatus !== "verified") {
            return res.status(403).json({
              message:
                "The shop must complete profile verification before products can be managed.",
            });
          }
        }
        const result = insertProductSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json(formatValidationError(result.error));
        }

        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
        const product = await storage.createProduct({
          ...result.data,
          shopId: shopContextId,
        });

        logger.info("Created product:", product);
        await invalidateCache(`products:shop:${shopContextId}`);
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

  app.post(
    "/api/products/quick-add",
    requireAuth,
    requireShopOrWorkerPermission(["products:write"]),
    async (req, res) => {
      try {
        const parsed = quickAddProductSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json(formatValidationError(parsed.error));
        }
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res
            .status(403)
            .json({ message: "Unable to resolve shop context" });
        }

        const requestWithAuth = req as RequestWithAuth;
        if (requestWithAuth.user?.role === "shop" || requestWithAuth.user?.hasShopProfile) {
          if (
            !ensureProfileVerified(
              requestWithAuth,
              res,
              "manage your shop listings",
            )
          ) {
            return;
          }
        } else if (requestWithAuth.user?.role === "worker") {
          const shopOwner = await storage.getUser(shopContextId);
          if (!shopOwner) {
            return res.status(404).json({ message: "Shop not found" });
          }
          if (shopOwner.verificationStatus !== "verified") {
            return res.status(403).json({
              message:
                "The shop must complete profile verification before products can be managed.",
            });
          }
        }

        const shop = await storage.getUser(shopContextId);
        const shopModes = resolveShopModes(shop?.shopProfile ?? null);
        const basePrice =
          typeof parsed.data.price === "number"
            ? parsed.data.price.toFixed(2)
            : parsed.data.price;
        const baseMrp =
          parsed.data.mrp ??
          (typeof parsed.data.price === "number"
            ? parsed.data.price.toFixed(2)
            : parsed.data.price);
        const payload = insertProductSchema.parse({
          name: parsed.data.name,
          description: "Quick add item",
          price: basePrice,
          mrp: typeof baseMrp === "number" ? baseMrp.toFixed(2) : baseMrp,
          stock: shopModes.catalogModeEnabled ? 0 : 1,
          category: parsed.data.category ?? "uncategorized",
          images: parsed.data.image ? [parsed.data.image] : [],
          isAvailable: true,
          shopId: shopContextId,
        });
        const product = await storage.createProduct(payload);
        res.status(201).json(product);
      } catch (error) {
        logger.error("Error creating quick-add product:", error);
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

  app.get("/api/products/shop/:id", async (req, res) => {
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
    "/api/products/bulk-update",
    requireAuth,
    requireShopOrWorkerPermission(["products:write"]),
    async (req, res) => {
      const parsedBody = productBulkUpdateSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      try {
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }

        const dedupedUpdates = new Map<
          number,
          { stock: number; lowStockThreshold?: number | null }
        >();
        for (const update of parsedBody.data.updates) {
          dedupedUpdates.set(update.productId, {
            stock: update.stock,
            lowStockThreshold: update.lowStockThreshold,
          });
        }

        const productIds = Array.from(dedupedUpdates.keys());
        const products =
          productIds.length > 0
            ? await storage.getProductsByIds(productIds)
            : [];

        const missingProducts = productIds.filter(
          (id) => !products.some((product) => product.id === id),
        );
        if (missingProducts.length) {
          return res
            .status(404)
            .json({ message: `Product not found: ${missingProducts[0]}` });
        }

        const unauthorized = products.find(
          (product) => product.shopId !== shopContextId,
        );
        if (unauthorized) {
          return res
            .status(403)
            .json({ message: "Not authorized to update these products" });
        }

        const normalizedUpdates = productIds.map((productId) => ({
          productId,
          ...dedupedUpdates.get(productId)!,
        }));

        const updatedProducts = await storage.bulkUpdateProductStock(
          normalizedUpdates,
        );

        await Promise.all(
          normalizedUpdates.map(({ productId }) =>
            invalidateCache(`product_detail_${shopContextId}_${productId}`),
          ),
        );

        res.json({ updated: updatedProducts });
      } catch (error) {
        logger.error("[API] Error in /api/products/bulk-update PATCH:", error);
        res.status(400).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to update products",
        });
      }
    },
  );

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
          typeof req.shopContextId === "number" ? req.shopContextId : null;

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

        // Sanitize numeric fields to prevent 'undefined' string errors.
        // Note: products.stock is nullable (shops may not track exact counts).
        const numericFields = ["price", "mrp"];
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

        if (Object.prototype.hasOwnProperty.call(updateData, "stock")) {
          const value = updateData.stock;
          if (value === "undefined") {
            delete updateData.stock;
          } else if (typeof value === "string" && value.trim() === "") {
            delete updateData.stock;
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
        await Promise.all([
          invalidateCache(`product_detail_${shopContextId}_${productId}`),
          invalidateCache(`products:shop:${shopContextId}`),
        ]);
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
      if (
        !ensureProfileVerified(
          req as RequestWithAuth,
          res,
          "publish services",
        )
      ) {
        return;
      }
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
          return res.status(400).json(formatValidationError(result.error));
        }

        const serviceData = {
          ...result.data,
          providerId: req.user!.id,
          isAvailable: true, // Default to available
        };
        const service = await storage.createService(serviceData);

        logger.info("Created service:", service);
        await invalidateCache(`services:provider:${req.user!.id}`);
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

  app.get("/api/services/provider/:id", async (req, res) => {
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

  app.patch(
    "/api/provider/availability",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      const parsedBody = providerAvailabilitySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      try {
        const providerId = req.user!.id;
        const services = await storage.getServicesByProvider(providerId);
        if (services.length === 0) {
          return res.json({ updated: 0, services: [] });
        }

        const updates: Partial<Service> = {
          isAvailableNow: parsedBody.data.isAvailableNow,
        };
        if (parsedBody.data.availabilityNote !== undefined) {
          updates.availabilityNote = parsedBody.data.availabilityNote;
        }

        const updatedServices = await Promise.all(
          services.map((service) => storage.updateService(service.id, updates)),
        );

        // Invalidate caches for individual services and the provider's service list
        await Promise.all([
          ...updatedServices.map((service) =>
            invalidateCache(`service_detail_${service.id}`),
          ),
          invalidateCache(`services:provider:${providerId}`),
        ]);

        res.json({ updated: updatedServices.length, services: updatedServices });
      } catch (error) {
        logger.error("Error updating provider availability:", error);
        res.status(400).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to update availability",
        });
      }
    },
  );

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
        await Promise.all([
          invalidateCache(`service_detail_${serviceId}`),
          invalidateCache(`services:provider:${req.user!.id}`),
        ]);
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

  app.get("/api/services", async (req, res) => {
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
        availableNow,
        locationCity,
        locationState,
        locationPostalCode,
        availabilityDate,
        lat,
        lng,
        radius,
      } = parsedQuery.data;

      const filters: Record<string, unknown> = {};
      if (category) filters.category = category.toLowerCase();
      if (minPrice !== undefined) filters.minPrice = minPrice;
      if (maxPrice !== undefined) filters.maxPrice = maxPrice;
      if (searchTerm) filters.searchTerm = searchTerm;
      if (providerId !== undefined) filters.providerId = providerId;
      if (availableNow !== undefined) filters.availableNow = availableNow;
      if (locationCity) filters.locationCity = locationCity;
      if (locationState) filters.locationState = locationState;
      if (locationPostalCode)
        filters.locationPostalCode = locationPostalCode;
      if (availabilityDate) filters.availabilityDate = availabilityDate;
      if (lat !== undefined && lng !== undefined) {
        filters.lat = lat;
        filters.lng = lng;
        filters.radiusKm = radius ?? DEFAULT_NEARBY_RADIUS_KM;
      }

      // Exclude own services if user is logged in
      const currentUserId = (req.user?.id as number) || undefined;
      if (currentUserId) {
        filters.excludeProviderId = currentUserId;
      }

      const services = await storage.getServices(filters);
      logger.info("Filtered services:", services); // Debug log

      const serviceIds = services.map((service) => service.id);
      const providerIds = new Set(
        services
          .map((service) => service.providerId)
          .filter((id): id is number => id !== null),
      );

      const [providers, reviews] = await Promise.all([
        providerIds.size > 0
          ? storage.getUsersByIds(Array.from(providerIds))
          : Promise.resolve([]),
        serviceIds.length > 0
          ? storage.getReviewsByServiceIds(serviceIds)
          : Promise.resolve([]),
      ]);

      const providerMap = new Map(
        providers.map((provider) => [provider.id, provider]),
      );

      const ratingStats = new Map<
        number,
        { total: number; count: number }
      >();
      for (const review of reviews) {
        if (review.serviceId == null) {
          continue;
        }
        const ratingValue =
          typeof review.rating === "number"
            ? review.rating
            : Number.parseFloat(String(review.rating));
        if (!Number.isFinite(ratingValue)) {
          continue;
        }
        const current = ratingStats.get(review.serviceId) ?? {
          total: 0,
          count: 0,
        };
        current.total += ratingValue;
        current.count += 1;
        ratingStats.set(review.serviceId, current);
      }

      const servicesWithDetails = services.map((service) => {
        const provider =
          service.providerId !== null
            ? providerMap.get(service.providerId) ?? null
            : null;
        const stat = ratingStats.get(service.id);
        const rating =
          stat && stat.count > 0 ? stat.total / stat.count : null;

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
              latitude: provider.latitude,
              longitude: provider.longitude,
            }
            : null,
        };
      });

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


  const handleGlobalSearch: RequestHandler = async (req, res) => {
    try {
      const parsedQuery = globalSearchQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json(formatValidationError(parsedQuery.error));
      }

      const {
        q,
        lat,
        lng,
        radius,
        limit = GLOBAL_SEARCH_RESULT_LIMIT,
      } = parsedQuery.data;

      const maxResults = Math.min(limit, GLOBAL_SEARCH_RESULT_LIMIT);

      // Delegate search to storage layer (database-side filtering and sorting)
      const results = await storage.globalSearch({
        query: q,
        lat,
        lng,
        radiusKm: radius ?? DEFAULT_NEARBY_RADIUS_KM,
        limit: maxResults,
      });

      res.json({
        query: q,
        results,
      });
    } catch (error) {
      logger.error("Error in global search:", error);
      res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to perform search",
      });
    }
  };

  app.get("/api/search/global", handleGlobalSearch);
  app.get("/api/search", handleGlobalSearch);

  app.get(
    "/api/services/:id",
    async (req, res) => {
      try {
        const serviceId = getValidatedParam(req, "id");
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
            ...extractUserCoordinates(provider),
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
        await setCache(cacheKey, payload, SERVICE_DETAIL_CACHE_TTL_SECONDS);
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
          return res
            .status(400)
            .json(formatValidationError(result.error));
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
          await Promise.all([
            invalidateCache(`service_detail_${serviceId}`),
            invalidateCache(`services:provider:${req.user!.id}`),
          ]);
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
      if (
        !ensureProfileVerified(
          req as RequestWithAuth,
          res,
          "book services",
        )
      ) {
        return;
      }
      try {
        const parsedBody = bookingCreateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        const { serviceId, bookingDate, serviceLocation, timeSlotLabel } =
          parsedBody.data;
        const normalizedSlotLabel =
          timeSlotLabel === null ? undefined : timeSlotLabel;

        if (serviceLocation === "customer") {
          const landmark = String((req.user as any)?.addressLandmark ?? "").trim();
          if (!landmark) {
            return res.status(400).json({
              message: "Landmark is required for bookings at customer location.",
            });
          }
        }

        // Get service details
        const service = await storage.getService(serviceId);
        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }

        const slotWindow = buildSlotWindow(
          new Date(bookingDate),
          normalizedSlotLabel,
        );
        if (normalizedSlotLabel && !slotWindow) {
          return res
            .status(400)
            .json({ message: "Invalid time slot selection" });
        }

        // Use the client-provided booking date directly
        // The slot window is used only for availability checks, not to override the booking time
        const bookingDateTime = new Date(bookingDate);
        const checkDateTime = slotWindow ? slotWindow.start : bookingDateTime;

        const existingForDay = await storage.getBookingsByService(
          serviceId,
          checkDateTime,
        );
        const slotKey = normalizedSlotLabel ?? null;
        const customerHasActiveBookingForSlot = existingForDay.some(
          (booking) =>
            booking.customerId === req.user!.id &&
            booking.status !== "completed" &&
            (slotKey === null ||
              booking.timeSlotLabel === null ||
              booking.timeSlotLabel === slotKey),
        );
        if (customerHasActiveBookingForSlot) {
          return res.status(409).json({
            message:
              "You already have an active booking request for this service on the selected day.",
          });
        }

        const isAvailable = await storage.checkAvailability(
          serviceId,
          checkDateTime,
          normalizedSlotLabel,
        );
        if (!isAvailable) {
          return res
            .status(409)
            .json({ message: "Selected time slot is not available" });
        }

        const booking = await storage.createBooking(
          {
            customerId: req.user!.id,
            serviceId,
            bookingDate: bookingDateTime,
            timeSlotLabel: normalizedSlotLabel,
            status: "pending",
            paymentStatus: "pending",
            serviceLocation,
          },
          {
            notification: {
              userId: service.providerId,
              type: "booking_request",
              title: "New Booking Request",
              message: `You have a new booking request for ${service.name}`,
            },
          },
        );

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
        const {
          status,
          rejectionReason,
          rescheduleDate,
          rescheduleReason,
        } = parsedBody.data;
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

        const serviceName = service?.name ?? "your booking";

        logger.info(
          `[API DEBUG] All pre-update checks passed for booking ID ${bookingId}. Proceeding to update booking status.`,
        );
        // Update booking status
        const updateData: Partial<Booking> = {};
        let notificationTitle = "";
        let notificationMessage = "";
        let responseMessage = "";

        if (status === "rescheduled") {
          const rescheduleDateObj = new Date(rescheduleDate!);
          if (rescheduleDateObj.getTime() <= Date.now()) {
            return res.status(400).json({
              message: "Reschedule date must be in the future",
            });
          }

          updateData.status = "rescheduled";
          updateData.rescheduleDate = rescheduleDateObj;
          updateData.bookingDate = rescheduleDateObj;
          updateData.comments = rescheduleReason ?? null;
          updateData.rejectionReason = null;

          const formattedDate = formatIndianDisplay(
            rescheduleDateObj,
            "datetime",
          );
          notificationTitle = "Booking Rescheduled";
          notificationMessage = `Your booking for ${serviceName} has been rescheduled to ${formattedDate}.`;
          if (rescheduleReason) {
            notificationMessage += ` Reason: ${rescheduleReason}`;
          }
          responseMessage =
            "Booking rescheduled successfully. Customer has been notified.";
        } else if (status === "rejected") {
          updateData.status = "rejected";
          updateData.rejectionReason = rejectionReason ?? null;
          updateData.comments = rejectionReason ?? null;
          updateData.rescheduleDate = null;

          notificationTitle = "Booking Rejected";
          notificationMessage = `Your booking for ${serviceName} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""
            }`;
          responseMessage =
            "Booking rejected. Customer has been notified with the reason.";
        } else {
          // status === "accepted"
          updateData.status = "accepted";
          updateData.rejectionReason = null;
          updateData.rescheduleDate = null;
          updateData.comments = null;

          notificationTitle = "Booking Accepted";
          notificationMessage = `Your booking for ${serviceName} has been accepted. The service provider will meet you at the scheduled time.`;
          responseMessage =
            "Booking accepted successfully. Customer has been notified.";
        }

        const updatedBooking = await storage.updateBooking(
          bookingId,
          updateData,
          {
            notification: {
              userId: booking.customerId,
              type: "booking_update",
              title: notificationTitle,
              message: notificationMessage,
            },
          },
        );

        logger.info(
          `[API PATCH /api/bookings/:id/status] Booking ID: ${bookingId}. Status updated to ${updatedBooking.status}. Email notifications are disabled for booking updates.`,
        );

        logger.info(
          `[API] Booking status updated successfully: ID=${bookingId}, Status=${status}`,
        );
        logger.info(
          `[API] Notification sent to customer: ID=${booking.customerId}`,
        );

        res.json({
          booking: updatedBooking,
          message: responseMessage,
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

  app.patch(
    "/api/bookings/:id/en-route",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const bookingId = getValidatedParam(req, "id");
        const booking = await storage.getBooking(bookingId);
        if (!booking) {
          return res.status(404).json({ message: "Booking not found" });
        }

        const service =
          booking.serviceId !== null
            ? await storage.getService(booking.serviceId)
            : null;
        if (!service || service.providerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "Not authorized to update this booking" });
        }

        if (booking.status === "en_route") {
          return res.json({
            booking,
            message: "Provider is already en route for this booking",
          });
        }

        const startableStatuses: Booking["status"][] = [
          "accepted",
          "rescheduled",
          "rescheduled_by_provider",
        ];
        if (!startableStatuses.includes(booking.status)) {
          return res.status(400).json({
            message: "Booking must be accepted before starting the job",
          });
        }

        const notification = booking.customerId
          ? {
            userId: booking.customerId,
            type: "booking_update",
            title: "Provider En Route",
            message: "Your provider has started the trip and is on the way.",
          }
          : null;

        const updatedBooking = await storage.updateBooking(
          bookingId,
          { status: "en_route" },
          notification ? { notification } : undefined,
        );

        res.json({
          booking: updatedBooking,
          message: "Booking marked as on the way",
        });
      } catch (error) {
        logger.error("Error updating booking to en route:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to mark booking as en route",
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

        const updatedBooking = await storage.updateBooking(
          bookingId,
          { status: "completed" },
          {
            notification: {
              userId: booking.customerId,
              type: "booking_update",
              title: "Payment Confirmed",
              message: `Provider confirmed payment for booking #${bookingId}.`,
            },
          },
        );
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

        const canSubmitPayment =
          booking.status === "accepted" || booking.status === "en_route";

        if (!canSubmitPayment) {
          return res
            .status(400)
            .json({ message: "Booking not ready for payment" });
        }

        const providerId =
          (await storage.getService(booking.serviceId!))?.providerId ?? null;

        // Update booking status to completed
        const updatedBooking = await storage.updateBooking(
          bookingId,
          {
            status: "awaiting_payment",
            paymentReference,
          },
          {
            notification: {
              userId: providerId,
              type: "booking_update",
              title: "Payment Submitted",
              message: `Customer submitted payment reference for booking #${bookingId}.`,
            },
          },
        );

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

        const serviceIds = Array.from(
          new Set(
            bookings
              .map((booking) => booking.serviceId)
              .filter((id): id is number => typeof id === "number"),
          ),
        );
        const services =
          serviceIds.length > 0
            ? await storage.getServicesByIds(serviceIds)
            : [];
        const serviceMap = new Map(
          services.map((service) => [service.id, service]),
        );
        const providerIds = new Set<number>();
        for (const service of services) {
          if (typeof service.providerId === "number") {
            providerIds.add(service.providerId);
          }
        }
        const providers =
          providerIds.size > 0
            ? await storage.getUsersByIds(Array.from(providerIds))
            : [];
        const providerMap = new Map(
          providers.map((provider) => [provider.id, provider]),
        );

        const enrichedBookings = bookings.map((booking) => {
          const service =
            typeof booking.serviceId === "number"
              ? serviceMap.get(booking.serviceId) ?? null
              : null;
          const provider =
            service && typeof service.providerId === "number"
              ? providerMap.get(service.providerId) ?? null
              : null;

          let displayAddress: string | null = null;
          if (booking.serviceLocation === "provider") {
            const providerAddressParts =
              provider !== null
                ? [
                  provider.addressStreet,
                  provider.addressCity,
                  provider.addressState,
                ]
                  .map((part) =>
                    typeof part === "string" ? part.trim() : "",
                  )
                  .filter((part) => part.length > 0)
                : [];
            const providerAddress = providerAddressParts.join(", ");
            displayAddress =
              booking.providerAddress ||
              (providerAddress.length > 0
                ? providerAddress
                : "Provider address not available");
          } else if (booking.serviceLocation === "customer") {
            displayAddress = "Service at your location";
          }

          return {
            ...booking,
            status: booking.status,
            rejectionReason: booking.rejectionReason ?? null,
            service: service || { name: "Unknown Service" },
            providerName: provider?.name || "Unknown Provider",
            displayAddress,
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
                ...extractUserCoordinates(provider),
              }
              : null,
          };
        });

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
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const { data: bookings, total, totalPages } = await storage.getBookingsByProvider(req.user!.id, { page, limit });
        const enrichedBookings = await hydrateProviderBookings(bookings);

        res.json({
          data: enrichedBookings,
          meta: {
            total,
            totalPages,
            page,
            limit
          }
        });
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

  app.get(
    "/api/bookings/provider/:id",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      const providerId = getValidatedParam(req, "id");
      const requesterId =
        typeof req.user?.id === "number"
          ? req.user.id
          : Number.parseInt(String(req.user?.id ?? NaN), 10);
      if (!Number.isFinite(requesterId) || providerId !== requesterId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const { data: bookings, total, totalPages } = await storage.getBookingsByProvider(providerId, { page, limit });
        const enrichedBookings = await hydrateProviderBookings(bookings);
        res.json({
          data: enrichedBookings,
          meta: {
            total,
            totalPages,
            page,
            limit
          }
        });
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
    async (_req, res) => {
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

  app.get(
    "/api/recommendations/buy-again",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const customerId = req.user!.id;
      const parseTimestamp = (value: unknown) => {
        if (!value) return 0;
        const date =
          value instanceof Date ? value : new Date(value as string | number);
        const time = date.getTime();
        return Number.isFinite(time) ? time : 0;
      };

      const successfulOrderStatuses: Order["status"][] = [
        "delivered",
        "shipped",
        "dispatched",
        "processing",
        "packed",
        "confirmed",
      ];
      const successfulBookingStatuses: Booking["status"][] = [
        "completed",
        "accepted",
        "rescheduled",
        "rescheduled_pending_provider_approval",
      ];

      try {
        // PERFORMANCE FIX: Limit the amount of historical data fetched
        const [orders, bookings] = await Promise.all([
          storage.getOrdersByCustomer(customerId, { limit: 50 }),
          storage.getBookingsByCustomer(customerId, { limit: 50 }),
        ]);

        const eligibleOrders = orders.filter((order) =>
          successfulOrderStatuses.includes(order.status),
        );

        const orderIds = eligibleOrders.map((order) => order.id);
        const orderItems =
          orderIds.length > 0
            ? await storage.getOrderItemsByOrderIds(orderIds)
            : [];

        const orderDateById = new Map<number, number>();
        const orderShopById = new Map<number, number | null>();
        for (const order of eligibleOrders) {
          const timestamp = parseTimestamp(order.orderDate);
          orderDateById.set(order.id, timestamp);
          orderShopById.set(order.id, order.shopId ?? null);
        }

        const productFrequency = new Map<
          number,
          { count: number; lastTimestamp: number; shopId: number | null }
        >();
        for (const item of orderItems) {
          const productId = item.productId;
          if (!productId) continue;
          const quantity = Number(item.quantity) || 1;
          const orderTimestamp = orderDateById.get(item.orderId ?? -1) ?? 0;
          const shopId = orderShopById.get(item.orderId ?? -1) ?? null;
          const current =
            productFrequency.get(productId) ?? {
              count: 0,
              lastTimestamp: 0,
              shopId,
            };
          current.count += quantity;
          current.lastTimestamp = Math.max(current.lastTimestamp, orderTimestamp);
          current.shopId = current.shopId ?? shopId ?? null;
          productFrequency.set(productId, current);
        }

        const bookingFrequency = new Map<
          number,
          { count: number; lastTimestamp: number }
        >();
        for (const booking of bookings) {
          if (!booking.serviceId) continue;
          if (!successfulBookingStatuses.includes(booking.status)) continue;
          const timestamp =
            parseTimestamp(booking.bookingDate ?? booking.updatedAt) ??
            parseTimestamp(booking.createdAt);
          const current =
            bookingFrequency.get(booking.serviceId) ?? {
              count: 0,
              lastTimestamp: 0,
            };
          current.count += 1;
          current.lastTimestamp = Math.max(current.lastTimestamp, timestamp);
          bookingFrequency.set(booking.serviceId, current);
        }

        const [products, services] = await Promise.all([
          productFrequency.size > 0
            ? storage.getProductsByIds(Array.from(productFrequency.keys()))
            : Promise.resolve([]),
          bookingFrequency.size > 0
            ? storage.getServicesByIds(Array.from(bookingFrequency.keys()))
            : Promise.resolve([]),
        ]);

        const shopIds = new Set(
          products
            .map((product) => product.shopId)
            .filter((id): id is number => id != null),
        );
        const providerIds = new Set(
          services
            .map((service) => service.providerId)
            .filter((id): id is number => id != null),
        );

        const [shops, providers] = await Promise.all([
          shopIds.size > 0
            ? storage.getUsersByIds(Array.from(shopIds))
            : Promise.resolve([]),
          providerIds.size > 0
            ? storage.getUsersByIds(Array.from(providerIds))
            : Promise.resolve([]),
        ]);

        const shopMap = new Map(shops.map((shop) => [shop.id, shop]));
        const providerMap = new Map(
          providers.map((provider) => [provider.id, provider]),
        );

        const productRecommendations = products
          .map((product) => {
            const stat = productFrequency.get(product.id);
            if (!stat) return null;
            const shop = product.shopId
              ? shopMap.get(product.shopId) ?? null
              : null;
            const lastOrderedAt =
              stat.lastTimestamp > 0
                ? new Date(stat.lastTimestamp).toISOString()
                : null;
            return {
              productId: product.id,
              shopId: product.shopId ?? stat.shopId ?? null,
              name: product.name ?? null,
              price: product.price ?? null,
              image: Array.isArray(product.images)
                ? product.images[0] ?? null
                : null,
              timesOrdered: stat.count,
              lastOrderedAt,
              shopName: shop?.name ?? null,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => {
            if (b.timesOrdered !== a.timesOrdered) {
              return b.timesOrdered - a.timesOrdered;
            }
            const aTime = a.lastOrderedAt
              ? new Date(a.lastOrderedAt).getTime()
              : 0;
            const bTime = b.lastOrderedAt
              ? new Date(b.lastOrderedAt).getTime()
              : 0;
            return bTime - aTime;
          });

        const serviceRecommendations = services
          .map((service) => {
            const stat = bookingFrequency.get(service.id);
            if (!stat) return null;
            const provider = service.providerId
              ? providerMap.get(service.providerId) ?? null
              : null;
            const lastBookedAt =
              stat.lastTimestamp > 0
                ? new Date(stat.lastTimestamp).toISOString()
                : null;
            return {
              serviceId: service.id,
              providerId: service.providerId ?? null,
              name: service.name ?? null,
              price: service.price ?? null,
              image: Array.isArray(service.images)
                ? service.images[0] ?? null
                : null,
              timesBooked: stat.count,
              lastBookedAt,
              providerName: provider?.name ?? null,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => {
            if (b.timesBooked !== a.timesBooked) {
              return b.timesBooked - a.timesBooked;
            }
            const aTime = a.lastBookedAt
              ? new Date(a.lastBookedAt).getTime()
              : 0;
            const bTime = b.lastBookedAt
              ? new Date(b.lastBookedAt).getTime()
              : 0;
            return bTime - aTime;
          });

        res.json({
          products: productRecommendations,
          services: serviceRecommendations,
        });
      } catch (error) {
        logger.error("Error building buy-again recommendations:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to load recommendations",
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
        if (!result.success) {
          return res
            .status(400)
            .json(formatValidationError(result.error));
        }

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

        const existingReview = await db.primary
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

        // Invalidate caches
        await invalidateCache(`reviews:service:${serviceId}`);
        if (service.providerId) {
          await invalidateCache(`reviews:provider:${service.providerId}`);
        }

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

        // Invalidate caches
        if (existingReview.serviceId) {
          const service = await storage.getService(existingReview.serviceId);
          if (service) {
            await invalidateCache(`reviews:service:${existingReview.serviceId}`);
            if (service.providerId) {
              await invalidateCache(`reviews:provider:${service.providerId}`);
            }
          }
        }

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

  app.get("/api/reviews/service/:id", async (req, res) => {
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

  app.get("/api/reviews/provider/:id", async (req, res) => {
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

        // Invalidate caches
        if (service) {
          await invalidateCache(`reviews:service:${service.id}`);
          if (service.providerId) {
            await invalidateCache(`reviews:provider:${service.providerId}`);
          }
        }

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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const notifications = await storage.getNotificationsByUser(req.user!.id, {
        page,
        limit,
      });
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
      try {
        // Mark ALL notifications for the user (no role filtering)
        await storage.markAllNotificationsAsRead(req.user!.id);
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
      if (
        !ensureProfileVerified(
          req as RequestWithAuth,
          res,
          "place orders",
        )
      ) {
        return;
      }
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
        if (!result.success) {
          return res
            .status(400)
            .json(formatValidationError(result.error));
        }

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

        if (shopId === undefined) {
          return res.status(400).json({ message: "No items provided" });
        }

        if (typeof shopId !== "number") {
          return res
            .status(400)
            .json({ message: "Unable to determine shop for this order" });
        }

        const shop = await storage.getUser(shopId);
        if (!shop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        const shopModes = resolveShopModes(shop.shopProfile);
        const enforceStock = !(shopModes.catalogModeEnabled || shopModes.openOrderMode);

        if (enforceStock) {
          const insufficientEntry = Array.from(quantityByProduct.entries()).find(
            ([productId, totalQuantity]) => {
              const product = productMap.get(productId);
              return product ? Number(product.stock ?? 0) < totalQuantity : true;
            },
          );
          if (insufficientEntry) {
            const [productId] = insufficientEntry;
            const product = productMap.get(productId);
            return res.status(400).json({
              message: `Insufficient stock for product: ${product?.name ?? productId}`,
            });
          }
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
          return res.status(400).json({
            message: "Order total mismatch. Please review your cart and try again.",
            expectedTotal: totalAsString,
          });
        }

        // If a promotion is applied, verify it's valid
        if (promotionId) {
          const promotionResult = await db.primary
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
        }

        const customer = req.user!;
        if (shopId == null) {
          return res
            .status(400)
            .json({ message: "Shop information is missing" });
        }

        const customerAddress = formatUserAddress(customer);
        const shopAddress = formatUserAddress(shop);
        const derivedShippingAddress =
          deliveryMethod === "delivery" ? customerAddress : shopAddress;
        const shippingAddress = derivedShippingAddress || "";
        const derivedBillingAddress =
          deliveryMethod === "delivery" ? customerAddress : shopAddress;

        const isPayLater = paymentMethod === "pay_later";
        let payLaterEligibility: {
          isKnownCustomer: boolean;
          isWhitelisted: boolean;
          allowPayLater?: boolean;
        } | null = null;
        if (isPayLater) {
          const eligibility = await evaluatePayLaterEligibility(
            shop,
            customer.id,
          );
          payLaterEligibility = eligibility;
          if (!eligibility.allowPayLater) {
            const message = shopModes.allowPayLater
              ? "You are not eligible for Pay Later at this shop (Requires history or approval)."
              : "Pay Later is not enabled for this shop.";
            return res.status(400).json({ message });
          }
          if (!eligibility.isKnownCustomer && !eligibility.isWhitelisted) {
            return res.status(403).json({
              message:
                "Pay later is only available for repeat or whitelisted customers at this shop.",
            });
          }
        }

        const orderItemsPayload = items.map((item) => {
          const numericPrice = toNumber(item.price);
          const price = Number.isFinite(numericPrice) ? numericPrice : 0;
          const itemTotal = Number((price * item.quantity).toFixed(2));
          return {
            productId: item.productId,
            quantity: item.quantity,
            price: price.toFixed(2),
            total: itemTotal.toFixed(2),
          };
        });

        const newOrder = await storage.createOrderWithItems(
          {
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
            notes:
              !enforceStock || isPayLater
                ? [
                  !enforceStock
                    ? "Open order: shop owner will confirm availability."
                    : null,
                  isPayLater
                    ? `Pay later requested by ${payLaterEligibility?.isWhitelisted
                      ? "whitelisted customer"
                      : "known customer"
                    }. Pending approval.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")
                : undefined,
          },
          orderItemsPayload,
        );
        logger.info(`Created order ${newOrder.id}`);

        // Notify shop about new order
        if (shopId) {
          if (isPayLater) {
            // Pay-later orders get specific notification about credit approval
            await storage.createNotification({
              userId: shopId,
              type: "order",
              title: "Pay Later approval needed",
              message: `Order #${newOrder.id} (₹${totalAsString}) is waiting for credit approval.`,
            });
          } else {
            // Regular orders
            await storage.createNotification({
              userId: shopId,
              type: "order",
              title: "New Order Received",
              message: `Order #${newOrder.id} has been placed (₹${totalAsString}).`,
            });
          }
        }

        // Clear cart after order creation
        await storage.clearCart(req.user!.id);

        // Invalidate shop product caches to reflect stock changes
        await invalidateCache(`products:shop:${shopId}`);
        await Promise.all(
          items.map((item) =>
            invalidateCache(`product_detail_${shopId}_${item.productId}`),
          ),
        );

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

  const textOrderCreateSchema = z
    .object({
      shopId: z.number().int().positive(),
      orderText: z.string().trim().min(3).max(2000),
      deliveryMethod: z.enum(["delivery", "pickup"]).optional().default("pickup"),
    })
    .strict();

  app.post(
    "/api/orders/text",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      if (
        !ensureProfileVerified(
          req as RequestWithAuth,
          res,
          "place orders",
        )
      ) {
        return;
      }

      const parsed = textOrderCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(formatValidationError(parsed.error));
      }

      try {
        const customer = req.user!;
        const { shopId, orderText, deliveryMethod } = parsed.data;

        const shop = await fetchShopOwnerWithProfile(shopId);
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
          orderType: "text_order",
          orderText,
          status: "pending",
          paymentStatus: "pending",
          deliveryMethod,
          paymentMethod: "cash",
          total: "0.00",
          shippingAddress,
          billingAddress: derivedBillingAddress || "",
          notes: "Quick order: shop will confirm price and availability.",
          orderDate: new Date(),
        });

        const preview =
          orderText.length > 180 ? `${orderText.slice(0, 177)}...` : orderText;
        await storage.createNotification({
          userId: shopId,
          type: "order",
          title: "New Quick Order",
          message: `Order #${newOrder.id}: ${preview}`,
        });

        return res.status(201).json({ order: newOrder });
      } catch (error) {
        logger.error("Text order creation error:", error);
        return res.status(400).json({
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
    async (_req, res) => {
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
          "awaiting_customer_agreement",
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

        const start = performance.now();
        const orders = await storage.getOrdersByCustomer(req.user!.id, {
          status: statusFilter,
        });
        const prepElapsed = performance.now();

        const detailed = await hydrateOrders(orders, { includeShop: true });
        const hydrateElapsed = performance.now();

        logger.debug(
          {
            customerId: req.user!.id,
            prepMs: (prepElapsed - start).toFixed(2),
            hydrateMs: (hydrateElapsed - prepElapsed).toFixed(2),
            totalMs: (hydrateElapsed - start).toFixed(2),
            orderCount: orders.length,
          },
          "Fetched customer orders",
        );
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

  const payLaterWhitelistSchema = z
    .object({
      customerId: z.number().int().positive().optional(),
      phone: z.string().trim().optional(),
    })
    .refine(
      (data) =>
        typeof data.customerId === "number" ||
        (data.phone !== undefined && data.phone.trim().length > 0),
      {
        message: "Provide a customerId or phone",
      },
    );

  async function buildWhitelistResponse(
    whitelistIds: number[],
    shopContextId: number,
  ): Promise<
    Array<{
      id: number;
      name: string | null;
      phone: string | null;
      email: string | null;
      amountDue: number;
    }>
  > {
    if (!whitelistIds.length) return [];
    const customers = await storage.getUsersByIds(whitelistIds);
    const outstandingAmounts = await storage.getPayLaterOutstandingAmounts(
      shopContextId,
      whitelistIds,
    );
    const customerMap = new Map(
      customers.map((customer) => [customer.id, customer]),
    );

    return whitelistIds
      .map((id) => customerMap.get(id))
      .filter((value): value is User => Boolean(value))
      .map((customer) => ({
        id: customer.id,
        name: customer.name ?? null,
        phone: customer.phone ?? null,
        email: customer.email ?? null,
        amountDue: outstandingAmounts[customer.id] ?? 0,
      }));
  }

  app.get(
    "/api/shops/pay-later/whitelist",
    requireAuth,
    requireShopOrWorkerPermission(["orders:read"]),
    async (req, res) => {
      try {
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res
            .status(403)
            .json({ message: "Unable to resolve shop context" });
        }

        const shop = await storage.getUser(shopContextId);
        if (!shop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        const whitelistIds = normalizePayLaterWhitelist(shop.shopProfile ?? null);
        const customers = await buildWhitelistResponse(
          whitelistIds,
          shopContextId,
        );

        return res.json({
          allowPayLater: resolveShopModes(shop.shopProfile ?? null).allowPayLater,
          customers,
          payLaterWhitelist: whitelistIds,
        });
      } catch (error) {
        logger.error("Error fetching pay-later whitelist:", error);
        return res
          .status(500)
          .json({ message: "Failed to fetch pay-later whitelist" });
      }
    },
  );

  app.post(
    "/api/shops/pay-later/whitelist",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      try {
        const parsed = payLaterWhitelistSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json(formatValidationError(parsed.error));
        }

        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res
            .status(403)
            .json({ message: "Unable to resolve shop context" });
        }

        const shop = await storage.getUser(shopContextId);
        if (!shop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        let customer: User | undefined;
        if (parsed.data.customerId) {
          customer = await storage.getUser(parsed.data.customerId);
        } else if (parsed.data.phone) {
          customer = await storage.getUserByPhone(parsed.data.phone);
        }

        if (!customer) {
          return res
            .status(404)
            .json({ message: "Customer not found for Pay Later whitelist" });
        }

        const whitelistIds = normalizePayLaterWhitelist(shop.shopProfile ?? null);
        if (!whitelistIds.includes(customer.id)) {
          const updatedProfile = {
            ...(shop.shopProfile ?? {}),
            payLaterWhitelist: [...whitelistIds, customer.id],
          } as ShopProfile;
          await storage.updateUser(shopContextId, {
            shopProfile: updatedProfile,
          });
          whitelistIds.push(customer.id);
        }

        const customers = await buildWhitelistResponse(
          whitelistIds,
          shopContextId,
        );

        return res.json({
          allowPayLater: resolveShopModes(shop.shopProfile ?? null).allowPayLater,
          customers,
          payLaterWhitelist: whitelistIds,
        });
      } catch (error) {
        logger.error("Error updating pay-later whitelist:", error);
        return res
          .status(500)
          .json({ message: "Failed to update pay-later whitelist" });
      }
    },
  );

  app.delete(
    "/api/shops/pay-later/whitelist/:customerId",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      try {
        const customerId = getValidatedParam(req, "customerId");
        const shopContextId = req.shopContextId;

        if (typeof shopContextId !== "number") {
          return res
            .status(403)
            .json({ message: "Unable to resolve shop context" });
        }

        const shop = await storage.getUser(shopContextId);
        if (!shop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        const whitelistIds = normalizePayLaterWhitelist(shop.shopProfile ?? null);
        const updatedWhitelist = whitelistIds.filter((id) => id !== customerId);

        const updatedProfile = {
          ...(shop.shopProfile ?? {}),
          payLaterWhitelist: updatedWhitelist,
        } as ShopProfile;
        await storage.updateUser(shopContextId, { shopProfile: updatedProfile });

        const customers = await buildWhitelistResponse(
          updatedWhitelist,
          shopContextId,
        );

        return res.json({
          allowPayLater: resolveShopModes(shop.shopProfile ?? null).allowPayLater,
          customers,
          payLaterWhitelist: updatedWhitelist,
        });
      } catch (error) {
        logger.error("Error removing pay-later whitelist entry:", error);
        return res
          .status(500)
          .json({ message: "Failed to remove pay-later whitelist entry" });
      }
    },
  );

  app.get(
    "/api/shops/orders/active",
    requireAuth,
    requireShopOrWorkerPermission(["orders:read"]),
    async (req, res) => {
      try {
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }

        const activeOrders = await storage.getOrdersByShop(shopContextId, ACTIVE_ORDER_STATUSES);

        if (activeOrders.length === 0) {
          return res.json({ new: [], packing: [], ready: [] } as ActiveOrderBoard);
        }

        const orderIds = activeOrders.map((order) => order.id);
        const orderItems =
          orderIds.length > 0
            ? await storage.getOrderItemsByOrderIds(orderIds)
            : [];
        const itemsByOrderId = new Map<number, OrderItem[]>();
        for (const item of orderItems) {
          if (item.orderId == null) continue;
          if (!itemsByOrderId.has(item.orderId)) {
            itemsByOrderId.set(item.orderId, []);
          }
          itemsByOrderId.get(item.orderId)!.push(item);
        }

        const productIds = Array.from(
          new Set(
            orderItems
              .map((item) => item.productId)
              .filter((id): id is number => id !== null),
          ),
        );
        const products =
          productIds.length > 0
            ? await storage.getProductsByIds(productIds)
            : [];
        const productMap = new Map(products.map((product) => [product.id, product]));

        const customerIds = Array.from(
          new Set(
            activeOrders
              .map((order) => order.customerId)
              .filter((id): id is number => id !== null),
          ),
        );
        const customers =
          customerIds.length > 0
            ? await storage.getUsersByIds(customerIds)
            : [];
        const customerMap = new Map(
          customers.map((customer) => [customer.id, customer]),
        );

        const board: ActiveOrderBoard = {
          new: [],
          packing: [],
          ready: [],
        };

        for (const order of activeOrders) {
          const lane = getBoardLaneForStatus(order.status);
          if (!lane) continue;

          const condensedItems = (itemsByOrderId.get(order.id) ?? []).map(
            (item) => {
              const product =
                item.productId !== null
                  ? productMap.get(item.productId)
                  : undefined;
              return {
                id: item.id,
                productId: item.productId,
                name: product?.name ?? "Item",
                quantity: item.quantity,
              };
            },
          );

          const customer = order.customerId
            ? customerMap.get(order.customerId)
            : undefined;

          board[lane].push({
            id: order.id,
            status: order.status,
            total: Number(order.total ?? 0),
            paymentStatus: order.paymentStatus ?? null,
            deliveryMethod: order.deliveryMethod ?? null,
            orderDate:
              order.orderDate instanceof Date
                ? order.orderDate.toISOString()
                : order.orderDate ?? null,
            customerName: customer?.name ?? null,
            items: condensedItems,
          });
        }

        (Object.keys(board) as ActiveOrderBoardLane[]).forEach((lane) => {
          board[lane].sort((a, b) => {
            const aTime = a.orderDate ? new Date(a.orderDate).getTime() : 0;
            const bTime = b.orderDate ? new Date(b.orderDate).getTime() : 0;
            return bTime - aTime;
          });
        });

        res.json(board);
      } catch (error) {
        logger.error("Error fetching active shop orders:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch active orders",
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
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
        const start = performance.now();
        const orders = await storage.getRecentOrdersByShop(shopContextId);
        const prepElapsed = performance.now();
        const detailed = await hydrateOrders(orders, {
          includeCustomer: true,
        });
        const hydrateElapsed = performance.now();

        logger.debug(
          {
            shopId: shopContextId,
            prepMs: (prepElapsed - start).toFixed(2),
            hydrateMs: (hydrateElapsed - prepElapsed).toFixed(2),
            totalMs: (hydrateElapsed - start).toFixed(2),
            orderCount: orders.length,
          },
          "Fetched recent shop orders",
        );
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
          "awaiting_customer_agreement",
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
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
        const start = performance.now();
        const orders = await storage.getOrdersByShop(
          shopContextId,
          statusFilter,
        );
        const prepElapsed = performance.now();
        const detailed = await hydrateOrders(orders, {
          includeCustomer: true,
        });
        const hydrateElapsed = performance.now();

        logger.debug(
          {
            shopId: shopContextId,
            prepMs: (prepElapsed - start).toFixed(2),
            hydrateMs: (hydrateElapsed - prepElapsed).toFixed(2),
            totalMs: (hydrateElapsed - start).toFixed(2),
            orderCount: orders.length,
            filteredStatus: statusFilter ?? "all",
          },
          "Fetched shop orders",
        );
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
    const orderId = getValidatedParam(req, "id");
    const timingStart = performance.now();
    try {
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const requesterId = coerceNumericId(req.user?.id);
      const isCustomer =
        requesterId !== null && order.customerId === requesterId;
      if (!isCustomer) {
        const shopContextId = await resolveShopContextId(
          req as RequestWithContext,
        );
        if (!shopContextId || order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }
      }
      const orderItems = await storage.getOrderItemsByOrder(order.id);
      const afterItemsFetch = performance.now();

      const productIds = Array.from(
        new Set(
          orderItems
            .map((item) => item.productId)
            .filter((id): id is number => typeof id === "number"),
        ),
      );
      const products =
        productIds.length > 0
          ? await storage.getProductsByIds(productIds)
          : [];
      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );
      const items = orderItems.map((item) => {
        const product =
          item.productId !== null
            ? productMap.get(item.productId) ?? null
            : null;
        return {
          id: item.id,
          productId: item.productId,
          name: product?.name ?? "",
          quantity: item.quantity,
          price: String(item.price),
          total: String(item.total),
        };
      });

      const relatedUserIds = Array.from(
        new Set(
          [order.customerId, order.shopId].filter(
            (id): id is number => typeof id === "number",
          ),
        ),
      );
      const relatedUsers =
        relatedUserIds.length > 0
          ? await storage.getUsersByIds(relatedUserIds)
          : [];
      const userMap = new Map(
        relatedUsers.map((user) => [user.id, user]),
      );
      const customer =
        typeof order.customerId === "number"
          ? userMap.get(order.customerId)
          : undefined;
      const shop =
        typeof order.shopId === "number"
          ? userMap.get(order.shopId)
          : undefined;
      const afterHydrate = performance.now();

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
            ...extractUserCoordinates(customer),
          }
          : undefined,
        shop: shop
          ? {
            name: shop.name ?? null,
            phone: shop.phone ?? null,
            email: shop.email ?? null,
            address: formatUserAddress(shop) ?? null,
            ...extractUserCoordinates(shop),
            upiId: (shop as any).upiId ?? null,
            returnsEnabled:
              (shop as any).returnsEnabled === undefined
                ? null
                : Boolean((shop as any).returnsEnabled),
          }
          : undefined,
      });

      res.json(payload);
      const timingEnd = performance.now();
      logger.debug(
        {
          orderId,
          fetchMs: (afterItemsFetch - timingStart).toFixed(2),
          hydrateMs: (afterHydrate - afterItemsFetch).toFixed(2),
          totalMs: (timingEnd - timingStart).toFixed(2),
        },
        "Fetched order detail",
      );
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
        const requiresCustomerAgreement =
          order.status === "awaiting_customer_agreement" ||
          (order.status === "pending" && order.orderType === "text_order");
        if (requiresCustomerAgreement) {
          return res.status(400).json({
            message: "Please agree to the final bill before paying.",
          });
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
    "/api/orders/:id/approve-pay-later",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      const orderId = getValidatedParam(req, "id");
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.paymentMethod !== "pay_later") {
          return res
            .status(400)
            .json({ message: "Order is not marked as pay later" });
        }
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
        if (order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }
        const requiresCustomerAgreement =
          order.status === "awaiting_customer_agreement" ||
          (order.status === "pending" && order.orderType === "text_order");
        if (requiresCustomerAgreement) {
          return res.status(400).json({
            message: "Order must be confirmed by the customer first.",
          });
        }
        const updated = await storage.updateOrder(orderId, {
          paymentStatus: "verifying",
        });
        if (order.customerId) {
          await storage.createNotification({
            userId: order.customerId,
            type: "order",
            title: "Pay Later approved",
            message: `Pay Later approved for Order #${orderId}. Please settle on delivery or pickup.`,
          });
        }
        res.json(updated);
      } catch (error) {
        logger.error("Error approving pay-later request:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to approve pay-later request",
          });
      }
    },
  );

  const quoteTextOrderSchema = z
    .object({
      total: z.string().or(z.number()),
      note: z.string().trim().max(500).optional(),
    })
    .strict();

  app.post(
    "/api/orders/:id/quote-text-order",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      const orderId = getValidatedParam(req, "id");
      const parsedBody = quoteTextOrderSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      try {
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res
            .status(403)
            .json({ message: "Unable to resolve shop context" });
        }

        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }
        if (!["pending", "awaiting_customer_agreement"].includes(order.status)) {
          return res.status(400).json({
            message: "Final bill can only be set before the customer agrees.",
          });
        }

        const numericTotal =
          typeof parsedBody.data.total === "number"
            ? parsedBody.data.total
            : Number(parsedBody.data.total);
        if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
          return res.status(400).json({ message: "Invalid total amount" });
        }
        const totalString = Number(numericTotal.toFixed(2)).toFixed(2);

        const note = parsedBody.data.note?.trim();
        const nextNotes = [
          order.notes?.trim() ? order.notes.trim() : null,
          note ? `Shop note: ${note}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        let updated = await storage.updateOrder(orderId, {
          total: totalString,
          paymentMethod: order.paymentMethod ?? "cash",
          notes: nextNotes || null,
        });

        if (order.status !== "awaiting_customer_agreement") {
          updated = await storage.updateOrderStatus(
            orderId,
            "awaiting_customer_agreement",
          );
        }

        if (order.customerId) {
          await storage.createNotification({
            userId: order.customerId,
            type: "order",
            title: "Final bill ready",
            message: `Order #${orderId} final bill is ₹${totalString}. Please agree to continue.`,
          });
        }

        res.json(updated);
      } catch (error) {
        logger.error("Error setting final order total:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to set final bill amount",
        });
      }
    },
  );

  app.post(
    "/api/orders/:id/agree-final-bill",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const orderId = getValidatedParam(req, "id");
      try {
        const order = await storage.getOrder(orderId);
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }
        if (order.customerId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
        if (order.status !== "awaiting_customer_agreement") {
          return res.status(400).json({
            message: "Order is not awaiting customer agreement.",
          });
        }
        const numericTotal = Number(order.total);
        if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
          return res.status(400).json({ message: "Final bill is not ready yet." });
        }

        const updated = await storage.updateOrderStatus(orderId, "confirmed");
        if (order.shopId) {
          await storage.createNotification({
            userId: order.shopId,
            type: "order",
            title: "Customer agreed to final bill",
            message: `Customer agreed to the final bill for Order #${orderId}.`,
          });
        }
        return res.json(updated);
      } catch (error) {
        logger.error("Error confirming final bill:", error);
        return res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to confirm final bill",
        });
      }
    },
  );

  const updateTextOrderPaymentMethodSchema = z
    .object({
      paymentMethod: PaymentMethodType,
    })
    .strict();

  app.post(
    "/api/orders/:id/payment-method",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const orderId = getValidatedParam(req, "id");
      const parsedBody = updateTextOrderPaymentMethodSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }

      try {
        const order = await storage.getOrder(orderId);
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }
        if (order.customerId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
        if (order.orderType !== "text_order") {
          return res.status(400).json({
            message: "Payment method updates are only supported for quick orders.",
          });
        }
        if (order.paymentStatus !== "pending") {
          return res.status(400).json({
            message: "Payment method cannot be updated after payment has started.",
          });
        }
        if (order.status !== "confirmed") {
          return res.status(400).json({
            message: "Please agree to the final bill before choosing a payment method.",
          });
        }
        if (order.shopId == null) {
          return res.status(400).json({ message: "Shop information is missing" });
        }

        const paymentMethod = parsedBody.data.paymentMethod;

        const shop = await fetchShopOwnerWithProfile(order.shopId);
        if (!shop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        if (paymentMethod === "upi") {
          const upiId = (shop as any).upiId;
          if (!upiId || typeof upiId !== "string" || !upiId.trim()) {
            return res.status(400).json({
              message: "This shop has not configured UPI payments yet.",
            });
          }
        }

        let nextNotes = order.notes ?? null;
        if (paymentMethod === "pay_later") {
          const eligibility = await evaluatePayLaterEligibility(
            shop,
            req.user!.id,
          );

          if (!eligibility.allowPayLater) {
            return res.status(400).json({
              message: "Pay later is not enabled for this shop.",
            });
          }
          if (!eligibility.isKnownCustomer && !eligibility.isWhitelisted) {
            return res.status(403).json({
              message:
                "Pay later is only available for repeat or whitelisted customers at this shop.",
            });
          }

          const descriptor = eligibility.isWhitelisted
            ? "whitelisted customer"
            : "known customer";
          const payLaterLine = `Pay later requested by ${descriptor}. Pending approval.`;
          const existing = (order.notes ?? "").trim();
          nextNotes = [existing || null, existing.includes(payLaterLine) ? null : payLaterLine]
            .filter(Boolean)
            .join("\n");
        }

        const updated = await storage.updateOrder(orderId, {
          paymentMethod,
          notes: nextNotes,
        });

        if (paymentMethod === "pay_later" && order.shopId) {
          await storage.createNotification({
            userId: order.shopId,
            type: "order",
            title: "Pay Later approval needed",
            message: `Order #${orderId} is waiting for credit approval.`,
          });
        }

        return res.json(updated);
      } catch (error) {
        logger.error("Error updating text order payment method:", error);
        return res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to update payment method",
        });
      }
    },
  );

  app.post(
    "/api/orders/:id/confirm-payment",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      const orderId = getValidatedParam(req, "id");
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
        if (order.shopId !== shopContextId)
          return res.status(403).json({ message: "Not authorized" });
        const requiresCustomerAgreement =
          order.status === "awaiting_customer_agreement" ||
          (order.status === "pending" && order.orderType === "text_order");
        if (requiresCustomerAgreement) {
          return res.status(400).json({
            message: "Order must be confirmed by the customer first.",
          });
        }
        const isPayLater = order.paymentMethod === "pay_later";
        const canMarkPaid =
          (order.paymentMethod === "upi" && order.paymentStatus === "verifying") ||
          (order.paymentMethod === "cash" && order.paymentStatus === "pending") ||
          (isPayLater &&
            (order.paymentStatus === "verifying" ||
              order.paymentStatus === "pending"));

        if (!canMarkPaid) {
          return res
            .status(400)
            .json({ message: "Order is not awaiting verification" });
        }
        const nextStatus = order.status === "pending" ? "confirmed" : order.status;
        const updated = await storage.updateOrder(orderId, {
          paymentStatus: "paid",
          status: nextStatus,
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
      const slots = await fetchServiceBookingSlots(serviceId, bookingDate);
      if (!slots) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(slots);
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

  app.get(
    "/api/bookings/service/:id",
    requireAuth,
    async (req, res) => {
      const parsedQuery = servicesAvailabilityQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json(formatValidationError(parsedQuery.error));
      }
      const serviceId = getValidatedParam(req, "id");
      const bookingDate = new Date(parsedQuery.data.date);
      try {
        const slots = await fetchServiceBookingSlots(serviceId, bookingDate);
        if (!slots) {
          return res.status(404).json({ message: "Service not found" });
        }
        res.json(slots);
      } catch (error) {
        logger.error("Error fetching legacy service bookings route:", error);
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

  // Enhanced booking routes with notifications
  app.post(
    "/api/bookings/:id/confirm",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const bookingId = getValidatedParam(req, "id");
        const existingBooking = await storage.getBooking(bookingId);
        if (!existingBooking) {
          return res.status(404).json({ message: "Booking not found" });
        }

        const confirmationMessage = `Your booking for ${formatIndianDisplay(existingBooking.bookingDate, "date")} has been confirmed.`;
        const notification = existingBooking.customerId
          ? {
            userId: existingBooking.customerId,
            type: "booking",
            title: "Booking Confirmed",
            message: confirmationMessage,
          }
          : null;

        const booking = await storage.updateBooking(
          bookingId,
          {
            status: "accepted",
          },
          notification ? { notification } : undefined,
        );

        // Send confirmation notifications
        const customer =
          booking.customerId !== null
            ? await storage.getUser(booking.customerId)
            : null;
        if (customer) {
          // Send SMS notification
          await storage.sendSMSNotification(
            customer.phone,
            confirmationMessage, // Use formatIndianDisplay
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
      const orderId = getValidatedParam(req, "id");
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.customerId === req.user.id) {
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
        }
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
      next();
    },
    requireShopOrWorkerPermission(["orders:read"]),
    async (req: any, res: Response) => {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }
      const orderId = getValidatedParam(req, "id");
      try {
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        const shopContextId =
          typeof req.shopContextId === "number" ? req.shopContextId : null;
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
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
        if (order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }
        if (
          ["pending", "awaiting_customer_agreement"].includes(order.status) &&
          status !== "cancelled"
        ) {
          return res.status(400).json({
            message: "Wait for customer agreement before updating the order status.",
          });
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
  app.get(
    "/api/returns/shop",
    requireAuth,
    requireShopOrWorkerPermission(["returns:manage"]),
    async (req, res) => {
      try {
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res
            .status(403)
            .json({ message: "Unable to resolve shop context" });
        }
        const returnRequests =
          await storage.getReturnRequestsForShop(shopContextId);
        res.json(returnRequests);
      } catch (error) {
        logger.error("Error fetching shop return requests:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch returns",
          });
      }
    },
  );

  app.post(
    "/api/orders/:orderId/return",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const result = insertReturnRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json(formatValidationError(result.error));
      }

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

          // Create notification for customer
          await storage.createNotification({
            userId: order.customerId,
            type: "return",
            title: "Return Request Received",
            message:
              "Your return request has been received and is being processed.",
          });

          // Notify shop about return request
          if (order.shopId) {
            await storage.createNotification({
              userId: order.shopId,
              type: "return",
              title: "New Return Request",
              message: `Customer requested return for Order #${order.id}.`,
            });
          }

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
        const shopContextId = req.shopContextId;
        if (typeof shopContextId !== "number") {
          return res.status(403).json({ message: "Unable to resolve shop context" });
        }
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

  app.get("/api/products", async (req, res) => {
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
        lat,
        lng,
        radius,
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
      if (lat !== undefined && lng !== undefined) {
        filters.lat = lat;
        filters.lng = lng;
        filters.radiusKm = radius ?? DEFAULT_NEARBY_RADIUS_KM;
      }

      const { items, hasMore } = await storage.getProducts(filters);

      // Get current user's shop ID to exclude their own products
      let userShopId: number | null = null;
      const currentUserId = req.user?.id as number | undefined;
      if (currentUserId) {
        const userShop = await storage.getShopByOwnerId(currentUserId);
        if (userShop) {
          userShopId = currentUserId; // products.shopId references users.id (the owner)
        }
      }

      const list = items
        // Filter out products from user's own shop
        .filter(product => userShopId === null || product.shopId !== userShopId)
        .map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          mrp: product.mrp,
          category: product.category,
          images: product.images ?? [],
          shopId: product.shopId,
          isAvailable: product.isAvailable ?? true,
          stock: product.stock,
          catalogModeEnabled: Boolean(product.catalogModeEnabled),
          openOrderMode: Boolean(
            product.openOrderMode ?? product.catalogModeEnabled,
          ),
          allowPayLater: Boolean(product.allowPayLater),
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
    async (req, res) => {
      try {
        const shopId = getValidatedParam(req, "shopId");
        const productId = getValidatedParam(req, "productId");
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
        const shop = await storage.getUser(shopId);
        const modes = resolveShopModes(shop?.shopProfile ?? null);

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
          catalogModeEnabled: modes.catalogModeEnabled,
          openOrderMode: modes.openOrderMode,
          allowPayLater: modes.allowPayLater,
        });

        await setCache(cacheKey, payload, PRODUCT_DETAIL_CACHE_TTL_SECONDS);
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
  app.get("/api/shops/:shopId", async (req, res) => {
    try {
      const shopId = getValidatedParam(req, "shopId");
      const cacheKey = `shop_detail_${shopId}`;
      const cached = await getCache<ReturnType<typeof buildPublicShopResponse>>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      const shop = await fetchShopOwnerWithProfile(shopId);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
      const payload = buildPublicShopResponse(shop);
      await setCache(cacheKey, payload, SHOP_DETAIL_CACHE_TTL_SECONDS);
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
          await Promise.all([
            invalidateCache(`product_detail_${product.shopId}_${productId}`),
            invalidateCache(`products:shop:${product.shopId}`),
          ]);
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
  app.get("/api/reviews/product/:id", async (req, res) => {
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

  app.get("/api/reviews/shop/:id", async (req, res) => {
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
      if (!result.success) {
        return res.status(400).json(formatValidationError(result.error));
      }

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

        // Invalidate product and shop review caches
        if (result.data.productId) {
          await invalidateCache(`reviews:product:${result.data.productId}`);
          // Get product to find shop ID for cache invalidation
          const product = await storage.getProduct(result.data.productId);
          if (product?.shopId) {
            await invalidateCache(`reviews:shop:${product.shopId}`);
          }
        }

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

        // Invalidate product and shop review caches
        if (existing.productId) {
          await invalidateCache(`reviews:product:${existing.productId}`);
          const product = await storage.getProduct(existing.productId);
          if (product?.shopId) {
            await invalidateCache(`reviews:shop:${product.shopId}`);
          }
        }

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

  app.post(
    "/api/performance-metrics",
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

  const httpsEnabled = process.env.HTTPS_ENABLED === "true";
  if (httpsEnabled) {
    const keyPath = process.env.HTTPS_KEY_PATH;
    const certPath = process.env.HTTPS_CERT_PATH;
    if (!keyPath || !certPath) {
      throw new Error(
        "HTTPS_ENABLED is true but HTTPS_KEY_PATH or HTTPS_CERT_PATH is missing.",
      );
    }

    const resolvePath = (input: string) =>
      path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
    const resolvedKeyPath = resolvePath(keyPath);
    const resolvedCertPath = resolvePath(certPath);

    const tlsOptions: HttpsServerOptions = {
      key: fs.readFileSync(resolvedKeyPath),
      cert: fs.readFileSync(resolvedCertPath),
    };

    const caPath = process.env.HTTPS_CA_PATH;
    let resolvedCaPath: string | undefined;
    if (caPath && caPath.trim().length > 0) {
      resolvedCaPath = resolvePath(caPath.trim());
      tlsOptions.ca = fs.readFileSync(resolvedCaPath);
    }

    const passphrase = process.env.HTTPS_PASSPHRASE;
    if (passphrase && passphrase.trim().length > 0) {
      tlsOptions.passphrase = passphrase;
    }

    logger.info(
      {
        keyPath: resolvedKeyPath,
        certPath: resolvedCertPath,
        caPath: resolvedCaPath,
      },
      "HTTPS enabled; starting secure server",
    );

    const httpsServer = createHttpsServer(tlsOptions, app);
    return httpsServer;
  }

  const httpServer = createHttpServer(app);
  return httpServer;
}
