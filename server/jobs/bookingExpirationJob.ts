import cron from "node-cron";
import type { IStorage } from "../storage";
import logger from "../logger";
import { withJobLock } from "../services/jobLock.service";

export let lastRun: Date | null = null;

export function startBookingExpirationJob(storage: IStorage) {
  const schedule = process.env.BOOKING_EXPIRATION_CRON || "0 * * * *"; // hourly by default
  const lockTtlMs =
    Number.parseInt(
      process.env.BOOKING_EXPIRATION_LOCK_TTL_MS ||
        process.env.JOB_LOCK_TTL_MS ||
        "",
      10,
    ) || 10 * 60 * 1000;
  const job = async () => {
    const { acquired } = await withJobLock(
      { name: "booking-expiration", ttlMs: lockTtlMs },
      async () => {
        try {
          lastRun = new Date();
          logger.info("Running booking expiration job");
          await storage.processExpiredBookings();
          logger.info("Completed booking expiration job");
        } catch (err) {
          logger.error("Error in booking expiration job:", err);
        }
      },
    );

    if (!acquired) {
      logger.debug(
        "[BookingExpirationJob] Skipped run; another instance holds the lock",
      );
    }
  };

  const timezone = process.env.CRON_TZ || "Asia/Kolkata";
  cron.schedule(schedule, job, { scheduled: true, timezone });
  job();
}
