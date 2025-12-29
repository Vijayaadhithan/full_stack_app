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
import { hasRoleAccess } from "../security/roleAccess";
import {
  normalizeEmail,
  normalizePhone,
} from "../utils/identity";
import { formatValidationError } from "../utils/zod";

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
  const createWorkerSchema = z
    .object({
      workerNumber: z.string().regex(/^\d{10}$/, "Worker number must be exactly 10 digits"),
      name: z.string().min(1),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
      responsibilities: z
        .array(WorkerResponsibilityZ)
        .default(["orders:read", "products:read"]),
    })
    .strict();

  app.post(
    "/api/shops/workers",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      await ensureShopWorkersTable();
      const parsed = createWorkerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(formatValidationError(parsed.error));
      }
      const { workerNumber, name, email, phone, pin, responsibilities } = parsed.data;
      try {
        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);

        // Ensure workerNumber (10-digit ID) is unique
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.workerNumber, workerNumber));
        if (existing[0]) {
          return res.status(400).json({ message: "Worker number already exists" });
        }

        if (normalizedEmail) {
          const emailConflict = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, normalizedEmail));
          if (emailConflict[0]) {
            return res.status(400).json({ message: "Email already in use" });
          }
        }

        if (normalizedPhone) {
          const phoneConflict = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.phone, normalizedPhone));
          if (phoneConflict[0]) {
            return res.status(400).json({ message: "Phone number already in use" });
          }
        }

        // Hash the PIN for secure storage
        const hashedPin = await hashPasswordInternal(pin);
        // Generate a unique username from workerNumber for backwards compatibility
        const generatedUsername = `worker_${workerNumber}`;
        const fallbackEmail = normalizedEmail ?? `worker_${workerNumber}@workers.local`;

        const [createdUser] = await db
          .insert(users)
          .values({
            username: generatedUsername,
            workerNumber: workerNumber,
            pin: hashedPin,
            role: "worker",
            name,
            phone: normalizedPhone ?? "",
            email: fallbackEmail,
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
          workerNumber: createdUser.workerNumber,
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
            workerNumber: users.workerNumber,
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

  // Check availability of a worker number (10-digit ID) for current shop owner
  app.get(
    "/api/shops/workers/check-number",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      try {
        await ensureShopWorkersTable();
        const parsedQuery = workerNumberAvailabilitySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          return res.status(400).json({
            message: "Invalid worker number",
            errors: parsedQuery.error.flatten(),
          });
        }
        const { workerNumber } = parsedQuery.data;
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.workerNumber, workerNumber));
        const available = !existing[0];
        return res.json({ workerNumber, available });
      } catch (error) {
        logger.error("Error checking worker number availability:", error);
        return res.status(500).json({ message: "Failed to check availability" });
      }
    },
  );

  const workerNumberAvailabilitySchema = z
    .object({
      workerNumber: z.string().regex(/^\d{10}$/, "Worker number must be exactly 10 digits"),
    })
    .strict();

  // Update worker details/responsibilities or reset PIN
  const updateWorkerSchema = z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      responsibilities: z.array(WorkerResponsibilityZ).optional(),
      pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits").optional(),
      active: z.boolean().optional(),
    })
    .strict();

  app.patch(
    "/api/shops/workers/:workerUserId",
    requireAuth,
    requireRole(["shop"]),
    async (req: Request, res: Response) => {
      await ensureShopWorkersTable();
      const workerUserId = req.validatedParams?.workerUserId;
      if (typeof workerUserId !== "number") {
        return res.status(400).json({ message: "Invalid worker id" });
      }

      const parsed = updateWorkerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(formatValidationError(parsed.error));
      }
      const { name, email, phone, responsibilities, pin, active } = parsed.data;

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
        if (pin) updateUserData.pin = await hashPasswordInternal(pin);
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
      const workerUserId = req.validatedParams?.workerUserId;
      if (typeof workerUserId !== "number") {
        return res.status(400).json({ message: "Invalid worker id" });
      }
      try {
        const result = await db
          .select({
            id: users.id,
            workerNumber: users.workerNumber,
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
      const workerUserId = req.validatedParams?.workerUserId;
      if (typeof workerUserId !== "number") {
        return res.status(400).json({ message: "Invalid worker id" });
      }
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
