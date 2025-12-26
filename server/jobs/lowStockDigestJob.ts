import cron from "node-cron";
import type { IStorage } from "../storage";
import logger from "../logger";
import { withJobLock } from "../services/jobLock.service";

export let lastRun: Date | null = null;

export function startLowStockDigestJob(storage: IStorage) {
  const schedule = process.env.LOW_STOCK_DIGEST_CRON || "0 8 * * *"; // default 8 AM daily
  const timezone = process.env.CRON_TZ || "Asia/Kolkata";
  const lockTtlMs =
    Number.parseInt(
      process.env.LOW_STOCK_DIGEST_LOCK_TTL_MS ||
        process.env.JOB_LOCK_TTL_MS ||
        "",
      10,
    ) || 10 * 60 * 1000;

  const job = async () => {
    const { acquired } = await withJobLock(
      { name: "low-stock-digest", ttlMs: lockTtlMs },
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
            "[LowStockDigest] Inventory digest completed",
          );
        } catch (error) {
          logger.error({ err: error }, "Error running low stock digest job");
        }
      },
    );

    if (!acquired) {
      logger.debug(
        "[LowStockDigest] Skipped run; another instance holds the lock",
      );
    }
  };

  cron.schedule(schedule, job, { scheduled: true, timezone });
  job();
}
