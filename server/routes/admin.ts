import { Router } from "express";
import { db, testConnection } from "../db";
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
import { eq, count, sum, sql, and } from "drizzle-orm";
import { promisify } from "util";
import { scrypt, timingSafeEqual } from "crypto";
import { hashPasswordInternal } from "../auth";
import { lastRun as bookingJobLastRun } from "../jobs/bookingExpirationJob";
import { lastRun as paymentJobLastRun } from "../jobs/paymentReminderJob";
import { adminLoginRateLimiter } from "../security/rateLimiters";

const router = Router();
const scryptAsync = promisify(scrypt);

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
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });
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
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password required" });
    }
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
    let razorpay = "unconfigured";
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const auth = Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
        ).toString("base64");
        const resp = await fetch(
          "https://api.razorpay.com/v1/payments?count=1",
          { headers: { Authorization: `Basic ${auth}` } },
        );
        razorpay = resp.status < 500 ? "ok" : "error";
      } catch {
        razorpay = "error";
      }
    }
    res.json({
      database: dbOk ? "ok" : "error",
      api: "ok",
      razorpay,
      jobs: {
        bookingExpiration: bookingJobLastRun?.toISOString() ?? null,
        paymentReminder: paymentJobLastRun?.toISOString() ?? null,
      },
    });
  },
);

router.get("/dashboard-stats", isAdminAuthenticated, async (_req, res) => {
  const [{ count: userCount }] = await db.select({ count: count() }).from(users);
  const [{ count: orderCount }] = await db.select({ count: count() }).from(orders);
  const [{ sum: totalRevenue }] = await db
    .select({ sum: sum(orders.total) })
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"));
  const [{ count: bookingCount }] = await db.select({ count: count() }).from(bookings);
  const [{ count: pendingOrders }] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.status, "pending"));
  const [{ count: todayBookings }] = await db
    .select({ count: count() })
    .from(bookings)
    .where(sql`date(${bookings.bookingDate}) = CURRENT_DATE`);
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
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const search = (req.query.search as string) || "";
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
    const { userId } = req.params;
    const { isSuspended } = req.body as { isSuspended: boolean };
    await db.update(users).set({ isSuspended }).where(eq(users.id, Number(userId)));
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
    const { reviewId } = req.params;
    await db.delete(reviews).where(eq(reviews.id, Number(reviewId)));
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
    const { email, password, roleId } = req.body ?? {};
    if (!email || !password || !roleId)
      return res.status(400).json({ message: "Missing fields" });
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
    const { name, description } = req.body ?? {};
    if (!name) return res.status(400).json({ message: "Name required" });
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
    const { roleId } = req.params;
    const { permissionIds } = req.body as { permissionIds: string[] };
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
