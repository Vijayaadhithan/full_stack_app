import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import logger from "../logger";
import { hashPasswordInternal } from "../auth";
import {
  users,
  shopWorkers,
  WorkerResponsibilities,
  WorkerResponsibilityZ,
  type WorkerResponsibility,
} from "@shared/schema";

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

export async function getWorkerShopId(workerUserId: number): Promise<number | null> {
  const link = await db
    .select({ shopId: shopWorkers.shopId })
    .from(shopWorkers)
    .where(eq(shopWorkers.workerUserId, workerUserId));
  return link[0]?.shopId ?? null;
}

export async function workerHasPermission(workerUserId: number, permission: WorkerResponsibility): Promise<boolean> {
  const result = await db
    .select({ responsibilities: shopWorkers.responsibilities })
    .from(shopWorkers)
    .where(eq(shopWorkers.workerUserId, workerUserId));
  const perms = (result[0]?.responsibilities ?? []) as WorkerResponsibility[];
  return perms.includes(permission);
}

export function registerWorkerRoutes(app: Express) {
  // Ensure table exists (fallback if migration wasn't applied)
  async function ensureShopWorkersTable() {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS shop_workers (
          id SERIAL PRIMARY KEY,
          shop_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          worker_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          responsibilities JSONB NOT NULL,
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT uq_shop_worker_user UNIQUE (worker_user_id),
          CONSTRAINT uq_shop_worker_pair UNIQUE (shop_id, worker_user_id)
        );
      `);
    } catch (e) {
      // Swallow to avoid noisy logs if already exists
    }
  }
  // Worker self info
  app.get(
    "/api/worker/me",
    requireAuth,
    requireRole(["worker"]),
    async (req: any, res: Response) => {
      const result = await db
        .select({ shopId: shopWorkers.shopId, responsibilities: shopWorkers.responsibilities, active: shopWorkers.active })
        .from(shopWorkers)
        .where(eq(shopWorkers.workerUserId, req.user.id));
      const record = result[0];
      if (!record) return res.status(404).json({ message: "Worker link not found" });
      res.json(record);
    },
  );
  // Introspect available responsibilities and suggested presets
  app.get(
    "/api/shops/workers/responsibilities",
    requireAuth,
    requireRole(["shop"]),
    async (_req: Request, res: Response) => {
      const presets: Record<string, WorkerResponsibility[]> = {
        cashier: ["orders:read", "orders:update", "customers:message"],
        inventory_manager: ["products:write", "inventory:adjust", "analytics:view"],
        promotions_manager: ["promotions:manage", "products:read"],
        service_manager: ["bookings:manage", "customers:message"],
      };
      res.json({ all: WorkerResponsibilities, presets });
    },
  );

  // Create a worker under the authenticated shop
  const createWorkerSchema = z.object({
    workerId: z.string().min(3), // The ID given by shop owner; stored as username
    name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    password: z.string().min(6), // Plain password provided by shop owner
    responsibilities: z.array(WorkerResponsibilityZ).default(["orders:read", "products:read"]),
  });

  app.post(
    "/api/shops/workers",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      await ensureShopWorkersTable();
      const parsed = createWorkerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
      }
      const { workerId, name, email, phone, password, responsibilities } = parsed.data;
      try {
        // Ensure workerId (username) is unique
        const existing = await db.select().from(users).where(eq(users.username, workerId));
        if (existing[0]) {
          return res.status(400).json({ message: "Worker ID already exists" });
        }

        const hashedPassword = await hashPasswordInternal(password);
        const [createdUser] = await db
          .insert(users)
          .values({
            username: workerId,
            password: hashedPassword,
            role: "worker",
            name,
            phone: phone ?? "",
            email: email ?? "",
          } as any)
          .returning();

        await db.insert(shopWorkers).values({
          shopId: req.user!.id,
          workerUserId: createdUser.id,
          responsibilities: responsibilities as any,
          active: true,
        });

        return res.status(201).json({
          id: createdUser.id,
          workerId: createdUser.username,
          name: createdUser.name,
          email: createdUser.email,
          phone: createdUser.phone,
          responsibilities,
        });
      } catch (error) {
        logger.error("Error creating worker:", error);
        return res.status(500).json({ message: "Failed to create worker" });
      }
    },
  );

  // List workers for the authenticated shop
  app.get(
    "/api/shops/workers",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      try {
        await ensureShopWorkersTable();
        const result = await db
          .select({
            id: users.id,
            workerId: users.username,
            name: users.name,
            email: users.email,
            phone: users.phone,
            responsibilities: shopWorkers.responsibilities,
            active: shopWorkers.active,
            createdAt: shopWorkers.createdAt,
          })
          .from(shopWorkers)
          .leftJoin(users, eq(users.id, shopWorkers.workerUserId))
          .where(eq(shopWorkers.shopId, req.user!.id));

        return res.json(result);
      } catch (error) {
        logger.error("Error listing workers:", error);
        return res.status(500).json({ message: "Failed to list workers" });
      }
    },
  );

  // Check availability of a worker ID (username) for current shop owner
  app.get(
    "/api/shops/workers/check-id",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      try {
        await ensureShopWorkersTable();
        const workerId = (req.query.workerId as string | undefined)?.trim();
        if (!workerId || workerId.length < 3) {
          return res.status(400).json({ message: "workerId must be at least 3 characters" });
        }
        const existing = await db.select().from(users).where(eq(users.username, workerId));
        const available = !existing[0];
        return res.json({ workerId, available });
      } catch (error) {
        logger.error("Error checking worker ID availability:", error);
        return res.status(500).json({ message: "Failed to check availability" });
      }
    },
  );

  // Update worker details/responsibilities or reset password
  const updateWorkerSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    responsibilities: z.array(WorkerResponsibilityZ).optional(),
    password: z.string().min(6).optional(),
    active: z.boolean().optional(),
  });

  app.patch(
    "/api/shops/workers/:workerUserId",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      await ensureShopWorkersTable();
      const workerUserId = Number(req.params.workerUserId);
      if (isNaN(workerUserId)) return res.status(400).json({ message: "Invalid worker id" });

      const parsed = updateWorkerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(parsed.error.flatten());
      const { name, email, phone, responsibilities, password, active } = parsed.data;

      try {
        // Ensure the worker belongs to this shop
        const link = await db
          .select()
          .from(shopWorkers)
          .where(and(eq(shopWorkers.workerUserId, workerUserId), eq(shopWorkers.shopId, req.user!.id)));
        if (!link[0]) return res.status(404).json({ message: "Worker not found for this shop" });

        // Update responsibilities/active on link
        if (responsibilities || typeof active === "boolean") {
          await db
            .update(shopWorkers)
            .set({
              ...(responsibilities ? { responsibilities: responsibilities as any } : {}),
              ...(typeof active === "boolean" ? { active } : {}),
            })
            .where(and(eq(shopWorkers.workerUserId, workerUserId), eq(shopWorkers.shopId, req.user!.id)));
        }

        // Update basic user fields
        const updateUserData: any = {};
        if (name) updateUserData.name = name;
        if (email) updateUserData.email = email;
        if (phone) updateUserData.phone = phone;
        if (password) updateUserData.password = await hashPasswordInternal(password);
        if (Object.keys(updateUserData).length) {
          await db.update(users).set(updateUserData).where(eq(users.id, workerUserId));
        }

        return res.json({ message: "Worker updated" });
      } catch (error) {
        logger.error("Error updating worker:", error);
        return res.status(500).json({ message: "Failed to update worker" });
      }
    },
  );

  // Get a single worker
  app.get(
    "/api/shops/workers/:workerUserId",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      await ensureShopWorkersTable();
      const workerUserId = Number(req.params.workerUserId);
      if (isNaN(workerUserId)) return res.status(400).json({ message: "Invalid worker id" });
      try {
        const result = await db
          .select({
            id: users.id,
            workerId: users.username,
            name: users.name,
            email: users.email,
            phone: users.phone,
            responsibilities: shopWorkers.responsibilities,
            active: shopWorkers.active,
            createdAt: shopWorkers.createdAt,
          })
          .from(shopWorkers)
          .leftJoin(users, eq(users.id, shopWorkers.workerUserId))
          .where(and(eq(shopWorkers.shopId, req.user!.id), eq(shopWorkers.workerUserId, workerUserId)));
        if (!result[0]) return res.status(404).json({ message: "Worker not found" });
        return res.json(result[0]);
      } catch (error) {
        logger.error("Error fetching worker:", error);
        return res.status(500).json({ message: "Failed to fetch worker" });
      }
    },
  );

  // Delete a worker (removes link and deletes the worker user)
  app.delete(
    "/api/shops/workers/:workerUserId",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      await ensureShopWorkersTable();
      const workerUserId = Number(req.params.workerUserId);
      if (isNaN(workerUserId)) return res.status(400).json({ message: "Invalid worker id" });
      try {
        // Verify the link belongs to this shop
        const link = await db
          .select()
          .from(shopWorkers)
          .where(and(eq(shopWorkers.workerUserId, workerUserId), eq(shopWorkers.shopId, req.user!.id)));
        if (!link[0]) return res.status(404).json({ message: "Worker not found for this shop" });

        // Remove link
        await db.delete(shopWorkers).where(and(eq(shopWorkers.workerUserId, workerUserId), eq(shopWorkers.shopId, req.user!.id)));

        // Delete user account if role is worker
        const target = await db.select().from(users).where(eq(users.id, workerUserId));
        if (target[0]?.role === 'worker') {
          await db.delete(users).where(eq(users.id, workerUserId));
        }
        return res.json({ message: "Worker removed" });
      } catch (error) {
        logger.error("Error deleting worker:", error);
        return res.status(500).json({ message: "Failed to delete worker" });
      }
    },
  );
}
