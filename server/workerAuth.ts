import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { shopWorkers, type WorkerResponsibility } from "@shared/schema";

export function requireShopOrWorkerPermission(required: WorkerResponsibility[] | WorkerResponsibility) {
  const requiredList = Array.isArray(required) ? required : [required];
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated?.()) return res.status(401).send("Unauthorized");
    if (req.user?.isSuspended) return res.status(403).json({ message: "Account suspended" });

    // Shop owners always allowed
    if (req.user?.role === "shop") return next();

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
      return next();
    }

    return res.status(403).send("Forbidden");
  };
}

export async function getWorkerShopId(workerUserId: number): Promise<number | null> {
  const result = await db
    .select({ shopId: shopWorkers.shopId })
    .from(shopWorkers)
    .where(eq(shopWorkers.workerUserId, workerUserId));
  return result[0]?.shopId ?? null;
}

