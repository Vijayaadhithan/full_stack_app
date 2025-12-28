import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { shopWorkers, type WorkerResponsibility } from "@shared/schema";

export type RequestWithContext = Request & {
  isAuthenticated?: () => boolean;
  workerShopId?: number;
  shopContextId?: number;
};

export function coerceNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function requireShopOrWorkerPermission(
  required: WorkerResponsibility[] | WorkerResponsibility,
) {
  const requiredList = Array.isArray(required) ? required : [required];
  return async (req: RequestWithContext, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated?.()) {
      return res.status(401).send("Unauthorized");
    }
    if (req.user?.isSuspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    // Shop owners or users with shop profile always allowed
    if (req.user?.role === "shop" || req.user?.hasShopProfile) {
      const shopId = coerceNumericId(req.user.id);
      if (!shopId) {
        return res.status(403).json({ message: "Unable to resolve shop context" });
      }
      req.shopContextId = shopId;
      return next();
    }

    // Workers must have explicit permissions
    if (req.user?.role === "worker") {
      const link = await db
        .select({ responsibilities: shopWorkers.responsibilities, active: shopWorkers.active, shopId: shopWorkers.shopId })
        .from(shopWorkers)
        .where(eq(shopWorkers.workerUserId, req.user.id));
      const record = link[0];
      if (!record || record.active === false) {
        return res.status(403).json({ message: "Worker not active or not linked to a shop" });
      }
      const perms = (record.responsibilities ?? []) as WorkerResponsibility[];
      const ok = requiredList.every((p) => perms.includes(p));
      if (!ok) return res.status(403).json({ message: "Insufficient permissions" });
      // Provide shop context for downstream handlers
      req.workerShopId = record.shopId;
      req.shopContextId = record.shopId;
      return next();
    }

    return res.status(403).send("Forbidden");
  };
}

export function requireShopOrWorkerContext() {
  return requireShopOrWorkerPermission([] as WorkerResponsibility[]);
}

export async function getWorkerShopId(workerUserId: number): Promise<number | null> {
  const result = await db
    .select({ shopId: shopWorkers.shopId })
    .from(shopWorkers)
    .where(eq(shopWorkers.workerUserId, workerUserId));
  return result[0]?.shopId ?? null;
}

export async function resolveShopContextId(
  req: RequestWithContext,
): Promise<number | null> {
  if (!req.user) return null;
  if (req.user.role === "shop" || req.user.hasShopProfile) {
    return coerceNumericId(req.user.id);
  }
  if (req.user.role === "worker") {
    if (req.shopContextId) {
      return req.shopContextId;
    }
    const rawId = (req.user as { id?: unknown }).id;
    const parsedId = coerceNumericId(rawId);
    if (parsedId === null) {
      return null;
    }
    return getWorkerShopId(parsedId);
  }
  return null;
}
