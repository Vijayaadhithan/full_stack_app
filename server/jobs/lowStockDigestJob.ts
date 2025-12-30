import type { IStorage } from "../storage";
import logger from "../logger";
import { registerJobHandler, addRepeatableJob, getJobQueue } from "../jobQueue";
import { withJobLock } from "../services/jobLock.service";

export let lastRun: Date | null = null;

const JOB_TYPE = "low-stock-digest";

async function processLowStockDigest(storage: IStorage): Promise<void> {
  const lockTtlMs =
    Number.parseInt(
      process.env.LOW_STOCK_DIGEST_LOCK_TTL_MS ||
      process.env.JOB_LOCK_TTL_MS ||
      "",
      10
    ) || 10 * 60 * 1000;

  const { acquired } = await withJobLock(
    { name: JOB_TYPE, ttlMs: lockTtlMs },
    async () => {
      lastRun = new Date();
      try {
        const shops = await storage.getShops();
        for (const shop of shops) {
          if (typeof shop.id !== "number") continue;

          const lowStockItems = await storage.getLowStockProducts({
            shopId: shop.id,
          });

          if (!lowStockItems.length) continue;

          const count = lowStockItems.length;
          const title = "Low stock alert";
          const itemLabel = count === 1 ? "item is" : "items are";
          const message = `${count} ${itemLabel} low on stock. Open Inventory > Quick Edit to restock.`;

          await storage.createNotification({
            userId: shop.id,
            type: "shop",
            title,
            message,
          });
        }

        logger.info(
          { shopsProcessed: shops.length },
          "[LowStockDigest] Inventory digest completed"
        );
      } catch (error) {
        logger.error({ err: error }, "Error running low stock digest job");
        throw error; // Re-throw to mark job as failed
      }
    }
  );

  if (!acquired) {
    logger.debug(
      "[LowStockDigest] Skipped run; another instance holds the lock"
    );
  }
}

export function startLowStockDigestJob(storage: IStorage): void {
  // Register handler
  registerJobHandler(JOB_TYPE, async () => {
    await processLowStockDigest(storage);
  });

  // Schedule repeatable job
  const schedule = process.env.LOW_STOCK_DIGEST_CRON || "0 8 * * *";
  const timezone = process.env.CRON_TZ || "Asia/Kolkata";

  // Check if already scheduled to avoid duplicates
  getJobQueue()
    .getRepeatableJobs()
    .then((jobs) => {
      const exists = jobs.some((j) => j.name === JOB_TYPE);
      if (!exists) {
        addRepeatableJob(JOB_TYPE, {}, schedule, { timezone });
      } else {
        logger.debug("[LowStockDigest] Already scheduled, skipping");
      }
    });

  // Run immediately on startup
  processLowStockDigest(storage);
}
