import { Router } from "express";
import { promises as fs } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { db, testConnection } from "../db";
import { z } from "zod";
import {
  adminUsers,
  adminPermissions,
  adminRolePermissions,
  adminRoles,
  adminAuditLogs,
  reviews,
  users,
  orders,
  bookings,
} from "@shared/schema";
import { performanceMetricSchema } from "@shared/performance";
import { eq, count, sum, sql, and, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { promisify } from "util";
import { scrypt, timingSafeEqual } from "crypto";
import { hashPasswordInternal } from "../auth";
import { lastRun as bookingJobLastRun } from "../jobs/bookingExpirationJob";
import { lastRun as paymentJobLastRun } from "../jobs/paymentReminderJob";
import { adminLoginRateLimiter } from "../security/rateLimiters";
import logger, { LOG_FILE_PATH } from "../logger";
import type { LogCategory } from "../logger";
import {
  getMonitoringSnapshot,
  recordFrontendMetric,
} from "../monitoring/metrics";

const router = Router();
const scryptAsync = promisify(scrypt);

const LOG_READ_MAX_BYTES = 1024 * 1024; // 1MB slice from tail of log file
const LOG_DEFAULT_LIMIT = 100;
const TRANSACTIONS_MAX_PAGE_SIZE = 100;
const LOG_CATEGORIES: LogCategory[] = [
  "admin",
  "service_provider",
  "customer",
  "shop_owner",
  "other",
];

const LOG_CATEGORY_ALIASES: Record<string, LogCategory> = {
  admin: "admin",
  "service-provider": "service_provider",
  "service_provider": "service_provider",
  provider: "service_provider",
  worker: "service_provider",
  "shop-owner": "shop_owner",
  "shop_owner": "shop_owner",
  shop: "shop_owner",
  customer: "customer",
  other: "other",
};

function normalizeLogCategory(value: unknown): LogCategory | undefined {
  if (!value || typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return LOG_CATEGORY_ALIASES[normalized];
}

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const adminPasswordChangeSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const adminSuspendUserSchema = z.object({
  isSuspended: z.boolean(),
});

const adminAccountCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.string().uuid(),
});

const adminRoleCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().max(500).optional(),
});

const adminRolePermissionSchema = z.object({
  permissionIds: z.array(z.string().uuid()).default([]),
});

const performanceMetricEnvelopeSchema = z.union([
  performanceMetricSchema,
  z.array(performanceMetricSchema),
]);

const formatValidationError = (error: z.ZodError) => ({
  message: "Invalid input",
  errors: error.flatten(),
});

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

const PAYMENT_STATUSES = ["pending", "verifying", "paid", "failed"] as const;

type OrderStatusFilter = (typeof ORDER_STATUSES)[number];
type PaymentStatusFilter = (typeof PAYMENT_STATUSES)[number];

const optionalPositiveInt = z
  .preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  }, z.coerce.number().int().positive())
  .optional();

const optionalTrimmedString = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  }, z.string())
  .optional();

const adminLogsQuerySchema = z
  .object({
    limit: optionalPositiveInt,
    level: optionalTrimmedString,
    category: optionalTrimmedString,
  })
  .strict();

const adminTransactionsQuerySchema = z
  .object({
    page: optionalPositiveInt,
    pageSize: optionalPositiveInt,
    limit: optionalPositiveInt,
    status: optionalTrimmedString,
    paymentStatus: optionalTrimmedString,
    customer: optionalTrimmedString,
    shop: optionalTrimmedString,
    search: optionalTrimmedString,
  })
  .strict();

const adminAccountsQuerySchema = z
  .object({
    page: optionalPositiveInt,
    limit: optionalPositiveInt,
    search: optionalTrimmedString,
  })
  .strict();

function isOrderStatus(value: string): value is OrderStatusFilter {
  return ORDER_STATUSES.some((status) => status === value);
}

function isPaymentStatus(value: string): value is PaymentStatusFilter {
  return PAYMENT_STATUSES.some((status) => status === value);
}

const levelNameByNumber: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

const levelNumbersByLabel: Record<string, number[]> = {
  trace: [10],
  debug: [20],
  info: [30],
  warn: [40],
  error: [50, 60],
  fatal: [60],
};

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    adminMustChangePassword?: boolean;
  }
}

async function verifyPassword(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function isAdminAuthenticated(req: any, res: any, next: any) {
  if (req.session?.adminId) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

function checkPermissions(required: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.session?.adminId) return res.status(401).json({ message: "Unauthorized" });
    const admin = await db
      .select({ roleId: adminUsers.roleId })
      .from(adminUsers)
      .where(eq(adminUsers.id, req.session.adminId))
      .limit(1);
    const roleId = admin[0]?.roleId;
    if (!roleId) return res.status(403).json({ message: "Forbidden" });
    const perms = await db
      .select({ action: adminPermissions.action })
      .from(adminRolePermissions)
      .innerJoin(
        adminPermissions,
        eq(adminRolePermissions.permissionId, adminPermissions.id),
      )
      .where(eq(adminRolePermissions.roleId, roleId));
    const set = new Set(perms.map((p) => p.action));
    if (required.every((r) => set.has(r))) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}

router.post("/login", adminLoginRateLimiter, async (req, res) => {
  if (!req.session) {
    return res.status(500).json({ message: "Session not initialized" });
  }
  const parsedBody = adminLoginSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(formatValidationError(parsedBody.error));
  }
  const { email, password } = parsedBody.data;
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);
  const admin = rows[0];
  if (!admin || !(await verifyPassword(password, admin.hashedPassword))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  // Flag password change if logging in with env-provided bootstrap creds
  const needsBootstrapChange =
    !!process.env.ADMIN_EMAIL &&
    !!process.env.ADMIN_PASSWORD &&
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD;
  req.session.adminMustChangePassword = needsBootstrapChange;
  req.session.adminId = admin.id;
  res.json({ id: admin.id, email: admin.email, roleId: admin.roleId, mustChangePassword: !!req.session.adminMustChangePassword });
});

router.post("/logout", (req, res) => {
  if (req.session) req.session.adminId = undefined;
  res.json({ success: true });
});

router.get("/me", isAdminAuthenticated, async (req, res) => {
  const rows = await db
    .select({ id: adminUsers.id, email: adminUsers.email, roleId: adminUsers.roleId })
    .from(adminUsers)
    .where(eq(adminUsers.id, req.session.adminId!))
    .limit(1);
  const base = rows[0];
  if (!base) return res.status(404).json({ message: "Admin not found" });

  // Derive permissions for this admin's role
  let permissions: string[] = [];
  if (base.roleId) {
    const perms = await db
      .select({ action: adminPermissions.action })
      .from(adminRolePermissions)
      .innerJoin(
        adminPermissions,
        eq(adminRolePermissions.permissionId, adminPermissions.id),
      )
      .where(eq(adminRolePermissions.roleId, base.roleId));
    permissions = perms.map((p) => p.action);
  }

  res.json({ ...base, permissions, mustChangePassword: !!req.session.adminMustChangePassword });
});

// Allow admin to change their password
router.post("/change-password", isAdminAuthenticated, async (req, res) => {
  try {
    const parsedBody = adminPasswordChangeSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }
    const { currentPassword, newPassword } = parsedBody.data;
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, req.session!.adminId!))
      .limit(1);
    const admin = rows[0];
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    const ok = await verifyPassword(currentPassword, admin.hashedPassword);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const hashedPassword = await hashPasswordInternal(newPassword);
    await db.update(adminUsers).set({ hashedPassword }).where(eq(adminUsers.id, admin.id));
    if (req.session) req.session.adminMustChangePassword = false;
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to change password" });
  }
});
router.get(
  "/health-status",
  isAdminAuthenticated,
  checkPermissions(["view_health"]),
  async (_req, res) => {
    const dbOk = await testConnection();

    res.json({
      database: dbOk ? "ok" : "error",
      api: "ok",
      jobs: {
        bookingExpiration: bookingJobLastRun?.toISOString() ?? null,
        paymentReminder: paymentJobLastRun?.toISOString() ?? null,
      },
    });
  },
);

router.get(
  "/logs",
  isAdminAuthenticated,
  checkPermissions(["view_health"]),
  async (req, res) => {
    const parsedQuery = adminLogsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json(formatValidationError(parsedQuery.error));
    }

    const requestedLimit = parsedQuery.data.limit;
    const limit = requestedLimit
      ? Math.min(requestedLimit, 500)
      : LOG_DEFAULT_LIMIT;
    const levelParam = (parsedQuery.data.level ?? "").toLowerCase();
    const filteredLevels = levelNumbersByLabel[levelParam];
    const normalizedCategory = normalizeLogCategory(parsedQuery.data.category);

    try {
      const stats = await fs.stat(LOG_FILE_PATH);
      if (!stats.isFile() || stats.size === 0) {
        return res.json({ logs: [] });
      }

      const readSize = Math.min(stats.size, LOG_READ_MAX_BYTES);
      let fileHandle: FileHandle | undefined;

      try {
        fileHandle = await fs.open(LOG_FILE_PATH, "r");
        const buffer = Buffer.alloc(readSize);
        await fileHandle.read(buffer, 0, readSize, stats.size - readSize);
        const lines = buffer
          .toString("utf-8")
          .split(/\r?\n/)
          .filter((line) => line.trim().length > 0);

        const parsed = lines
          .map((line) => {
            try {
              return JSON.parse(line) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter((entry): entry is Record<string, unknown> => entry !== null);

        const filtered = parsed.filter((entry) => {
          if (typeof entry.level !== "number") return false;
          if (normalizedCategory) {
            const entryCategory = normalizeLogCategory((entry as { category?: unknown }).category);
            if ((entryCategory ?? "other") !== normalizedCategory) {
              return false;
            }
          }
          if (!filteredLevels) return true;
          return filteredLevels.includes(entry.level);
        });

        const slice = filtered.slice(-limit).reverse();
        const logs = slice.map((entry) => {
          const {
            level,
            time,
            msg,
            pid,
            hostname,
            category: entryCategoryRaw,
            userId,
            userRole,
            adminId,
            ...rest
          } = entry as Record<string, unknown> & {
            level: number;
            time?: number | string;
            msg?: string;
            pid?: number;
            hostname?: string;
            category?: unknown;
            userId?: unknown;
            userRole?: unknown;
            adminId?: unknown;
          };

          let timestamp = new Date().toISOString();
          if (typeof time === "number") {
            timestamp = new Date(time).toISOString();
          } else if (typeof time === "string") {
            const numeric = Number(time);
            const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(time);
            if (!Number.isNaN(date.getTime())) {
              timestamp = date.toISOString();
            }
          }

          const logCategory = normalizeLogCategory(entryCategoryRaw) ?? "other";
          const metadata: Record<string, unknown> = {};
          if (userId !== undefined) metadata.userId = userId;
          if (userRole !== undefined) metadata.userRole = userRole;
          if (adminId !== undefined) metadata.adminId = adminId;
          Object.assign(metadata, rest);
          delete metadata.time;
          delete metadata.msg;
          delete metadata.level;
          delete metadata.pid;
          delete metadata.hostname;

          return {
            timestamp,
            level: levelNameByNumber[level] ?? String(level),
            message: msg ?? "",
            category: logCategory,
            metadata: Object.keys(metadata).length ? metadata : undefined,
          };
        });

        return res.json({
          logs,
          availableCategories: LOG_CATEGORIES,
        });
      } finally {
        await fileHandle?.close();
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        return res.json({ logs: [] });
      }
      return res.status(500).json({ message: "Failed to read logs" });
    }
  },
);

router.post(
  "/performance-metrics",
  isAdminAuthenticated,
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

    logger.info(
      {
        adminId: req.session?.adminId,
        metrics,
        source: "admin-ui",
      },
      "Received admin performance metrics",
    );

    for (const metric of metrics) {
      recordFrontendMetric(metric);
    }

    res.status(204).send();
  },
);

router.get(
  "/monitoring/summary",
  isAdminAuthenticated,
  checkPermissions(["view_health"]),
  async (_req, res) => {
    res.json(getMonitoringSnapshot());
  },
);

router.get(
  "/transactions",
  isAdminAuthenticated,
  checkPermissions(["view_all_orders"]),
  async (req, res) => {
    const parsedQuery = adminTransactionsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json(formatValidationError(parsedQuery.error));
    }

    const resolvedPage = parsedQuery.data.page ?? 1;
    const requestedPageSize = parsedQuery.data.pageSize ?? parsedQuery.data.limit;
    const pageSize = requestedPageSize
      ? Math.min(requestedPageSize, TRANSACTIONS_MAX_PAGE_SIZE)
      : 20;
    const offset = (resolvedPage - 1) * pageSize;

    const statusFilter = (parsedQuery.data.status ?? "").toLowerCase();
    const paymentStatusFilter = (parsedQuery.data.paymentStatus ?? "").toLowerCase();
    const customerFilter = parsedQuery.data.customer ?? "";
    const shopFilter = parsedQuery.data.shop ?? "";
    const searchFilter = parsedQuery.data.search ?? "";

    const customerAlias = alias(users, "customer_users");
    const shopAlias = alias(users, "shop_users");

    const filters: SQL<unknown>[] = [];

    if (statusFilter && isOrderStatus(statusFilter)) {
      filters.push(eq(orders.status, statusFilter));
    }

    if (paymentStatusFilter && isPaymentStatus(paymentStatusFilter)) {
      filters.push(eq(orders.paymentStatus, paymentStatusFilter));
    }

    if (customerFilter) {
      const like = `%${customerFilter}%`;
      filters.push(
        sql`(${customerAlias.name} ILIKE ${like} OR ${customerAlias.email} ILIKE ${like})`,
      );
    }

    if (shopFilter) {
      const like = `%${shopFilter}%`;
      filters.push(sql`(${shopAlias.name} ILIKE ${like} OR ${shopAlias.email} ILIKE ${like})`);
    }

    if (searchFilter) {
      const like = `%${searchFilter}%`;
      filters.push(
        sql`(${customerAlias.name} ILIKE ${like} OR ${customerAlias.email} ILIKE ${like} OR ${shopAlias.name} ILIKE ${like} OR ${shopAlias.email} ILIKE ${like} OR ${orders.paymentReference} ILIKE ${like})`,
      );
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const baseQuery = db
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        total: orders.total,
        paymentReference: orders.paymentReference,
        orderDate: orders.orderDate,
        customerId: orders.customerId,
        shopId: orders.shopId,
        customerName: customerAlias.name,
        customerEmail: customerAlias.email,
        shopName: shopAlias.name,
        shopEmail: shopAlias.email,
        totalCount: sql<number>`count(*) over ()`,
      })
      .from(orders)
      .leftJoin(customerAlias, eq(customerAlias.id, orders.customerId))
      .leftJoin(shopAlias, eq(shopAlias.id, orders.shopId));

    const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
      .orderBy(desc(orders.orderDate), desc(orders.id))
      .limit(pageSize)
      .offset(offset);

    const total = rows.length ? Number(rows[0].totalCount) : 0;
    const transactions = rows.map(({ totalCount: _totalCount, ...row }) => ({
      id: row.id,
      status: row.status,
      paymentStatus: row.paymentStatus,
      total: row.total,
      paymentReference: row.paymentReference,
      orderDate: row.orderDate ? row.orderDate.toISOString() : null,
      customer: row.customerId
        ? {
            id: row.customerId,
            name: row.customerName ?? null,
            email: row.customerEmail ?? null,
          }
        : null,
      shop: row.shopId
        ? {
            id: row.shopId,
            name: row.shopName ?? null,
            email: row.shopEmail ?? null,
          }
        : null,
    }));

    return res.json({
      page: resolvedPage,
      pageSize,
      total,
      hasMore: total > resolvedPage * pageSize,
      transactions,
    });
  },
);

router.get("/dashboard-stats", isAdminAuthenticated, async (_req, res) => {
  const [userCountResult, orderCountResult, totalRevenueResult, bookingCountResult, pendingOrdersResult, todayBookingsResult] =
    await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(orders),
      db
        .select({ sum: sum(orders.total) })
        .from(orders)
        .where(eq(orders.paymentStatus, "paid")),
      db.select({ count: count() }).from(bookings),
      db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "pending")),
      db
        .select({ count: count() })
        .from(bookings)
        .where(sql`date(${bookings.bookingDate}) = CURRENT_DATE`),
    ]);

  const [{ count: userCount }] = userCountResult;
  const [{ count: orderCount }] = orderCountResult;
  const [{ sum: totalRevenue }] = totalRevenueResult;
  const [{ count: bookingCount }] = bookingCountResult;
  const [{ count: pendingOrders }] = pendingOrdersResult;
  const [{ count: todayBookings }] = todayBookingsResult;

  res.json({
    totalUsers: userCount,
    totalOrders: orderCount,
    totalRevenue: totalRevenue || "0",
    totalBookings: bookingCount,
    pendingOrders,
    todaysBookings: todayBookings,
  });
});

router.get(
  "/platform-users",
  isAdminAuthenticated,
  checkPermissions(["manage_users"]),
  async (req, res) => {
    const parsedQuery = adminAccountsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json(formatValidationError(parsedQuery.error));
    }
    const page = parsedQuery.data.page ?? 1;
    const limit = parsedQuery.data.limit ?? 20;
    const search = parsedQuery.data.search ?? "";
    const offset = (page - 1) * limit;
    const base = db.select().from(users);
    const like = `%${search}%`;
    const all = await (search
      ? base
          .where(
            sql`${users.username} ILIKE ${like} OR ${users.email} ILIKE ${like} OR ${users.name} ILIKE ${like}`,
          )
          .limit(limit)
          .offset(offset)
      : base.limit(limit).offset(offset));
    res.json(all);
  },
);

router.patch(
  "/platform-users/:userId/suspend",
  isAdminAuthenticated,
  checkPermissions(["manage_users"]),
  async (req, res) => {
    const userId = req.validatedParams?.userId;
    if (typeof userId !== "number") {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const parsedBody = adminSuspendUserSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }
    const { isSuspended } = parsedBody.data;
    await db.update(users).set({ isSuspended }).where(eq(users.id, userId));
    // Audit log (best-effort)
    try {
      await db.insert(adminAuditLogs).values({
        adminId: req.session!.adminId!,
        action: isSuspended ? "suspend_user" : "unsuspend_user",
        resource: `user:${userId}`,
      });
    } catch {}
    res.json({ success: true });
  },
);

router.get(
  "/all-orders",
  isAdminAuthenticated,
  checkPermissions(["view_all_orders"]),
  async (_req, res) => {
    const all = await db.select().from(orders);
    res.json(all);
  },
);

router.get(
  "/shops/transactions",
  isAdminAuthenticated,
  checkPermissions(["view_all_orders"]),
  async (_req, res) => {
    const results = await db
      .select({
        shopId: users.id,
        shopName: users.name,
        transactionCount: sql<number>`count(${orders.id})`,
      })
      .from(users)
      .leftJoin(
        orders,
        and(eq(users.id, orders.shopId), eq(orders.paymentStatus, "paid")),
      )
      .where(eq(users.role, "shop"))
      .groupBy(users.id, users.name)
      .orderBy(sql`count(${orders.id}) DESC`);

    const formatted = results.map((row) => ({
      shopId: row.shopId,
      shopName: row.shopName,
      transactionCount: Number(row.transactionCount ?? 0),
    }));

    res.json(formatted);
  },
);

router.get(
  "/all-bookings",
  isAdminAuthenticated,
  checkPermissions(["view_all_bookings"]),
  async (_req, res) => {
    const all = await db.select().from(bookings);
    res.json(all);
  },
);

router.delete(
  "/reviews/:reviewId",
  isAdminAuthenticated,
  checkPermissions(["manage_reviews"]),
  async (req, res) => {
    const reviewId = req.validatedParams?.reviewId;
    if (typeof reviewId !== "number") {
      return res.status(400).json({ message: "Invalid review id" });
    }
    await db.delete(reviews).where(eq(reviews.id, reviewId));
    // Audit log (best-effort)
    try {
      await db.insert(adminAuditLogs).values({
        adminId: req.session!.adminId!,
        action: "delete_review",
        resource: `review:${reviewId}`,
      });
    } catch {}
    res.json({ success: true });
  },
);

router.get(
  "/accounts",
  isAdminAuthenticated,
  checkPermissions(["manage_admins"]),
  async (_req, res) => {
    const all = await db
      .select({ id: adminUsers.id, email: adminUsers.email, roleId: adminUsers.roleId, createdAt: adminUsers.createdAt })
      .from(adminUsers);
    res.json(all);
  },
);

router.post(
  "/accounts",
  isAdminAuthenticated,
  checkPermissions(["manage_admins"]),
  async (req, res) => {
    const parsedBody = adminAccountCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }
    const { email, password, roleId } = parsedBody.data;
    const hashedPassword = await hashPasswordInternal(password);
    const [created] = await db
      .insert(adminUsers)
      .values({ email, hashedPassword, roleId })
      .returning({ id: adminUsers.id, email: adminUsers.email, roleId: adminUsers.roleId });
    // Audit log (best-effort)
    try {
      await db.insert(adminAuditLogs).values({
        adminId: req.session!.adminId!,
        action: "create_admin",
        resource: `admin:${created.id}`,
      });
    } catch {}
    res.json(created);
  },
);

router.get(
  "/roles",
  isAdminAuthenticated,
  checkPermissions(["manage_admins"]),
  async (_req, res) => {
    const roles = await db.select().from(adminRoles);
    res.json(roles);
  },
);

router.post(
  "/roles",
  isAdminAuthenticated,
  checkPermissions(["manage_admins"]),
  async (req, res) => {
    const parsedBody = adminRoleCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }
    const { name, description } = parsedBody.data;
    const [role] = await db
      .insert(adminRoles)
      .values({ name, description })
      .returning();
    res.json(role);
  },
);

router.put(
  "/roles/:roleId/permissions",
  isAdminAuthenticated,
  checkPermissions(["manage_admins"]),
  async (req, res) => {
    const paramsResult = z.object({ roleId: z.string().uuid() }).safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json(formatValidationError(paramsResult.error));
    }
    const { roleId } = paramsResult.data;
    const parsedBody = adminRolePermissionSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }
    const { permissionIds } = parsedBody.data;
    await db.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId, roleId));
    if (permissionIds?.length) {
      await db.insert(adminRolePermissions).values(
        permissionIds.map((id) => ({ roleId, permissionId: id })),
      );
    }
    // Audit log (best-effort)
    try {
      await db.insert(adminAuditLogs).values({
        adminId: req.session!.adminId!,
        action: "update_role_permissions",
        resource: `role:${roleId}`,
      });
    } catch {}
    res.json({ success: true });
  },
);

// Audit logs listing endpoint
router.get(
  "/audit-logs",
  isAdminAuthenticated,
  checkPermissions(["manage_admins"]),
  async (_req, res) => {
    const logs = await db
      .select()
      .from(adminAuditLogs)
      .orderBy(sql`created_at DESC`);
    res.json(logs);
  },
);

export default router;
