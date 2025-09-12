import { Router } from "express";
import { db, testConnection } from "../db";
import {
  adminUsers,
  adminPermissions,
  adminRolePermissions,
  adminRoles,
  reviews,
  users,
  orders,
  bookings,
} from "@shared/schema";
import { eq, count, sum, sql } from "drizzle-orm";
import { promisify } from "util";
import { scrypt, timingSafeEqual } from "crypto";
import { hashPasswordInternal } from "../auth";
import { lastRun as bookingJobLastRun } from "../jobs/bookingExpirationJob";
import { lastRun as paymentJobLastRun } from "../jobs/paymentReminderJob";

const router = Router();
const scryptAsync = promisify(scrypt);

declare module "express-session" {
  interface SessionData {
    adminId?: string;
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

router.post("/login", async (req, res) => {
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
  req.session.adminId = admin.id;
  res.json({ id: admin.id, email: admin.email, roleId: admin.roleId });
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
  res.json(rows[0]);
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
    res.json({ success: true });
  },
);

router.get(
  "/accounts",
  isAdminAuthenticated,
  checkPermissions(["manage_admins"]),
  async (_req, res) => {
    const all = await db.select().from(adminUsers);
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
    res.json({ success: true });
  },
);

export default router;
