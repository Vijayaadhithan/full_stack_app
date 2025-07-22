import cron from "node-cron";
import type { IStorage } from "../storage";
import logger from "../logger";

export function startBookingExpirationJob(storage: IStorage) {
  const schedule = process.env.BOOKING_EXPIRATION_CRON || "0 * * * *"; // hourly by default
  const job = async () => {
    try {
      logger.info("Running booking expiration job");
      await storage.processExpiredBookings();
      logger.info("Completed booking expiration job");
    } catch (err) {
      logger.error("Error in booking expiration job:", err);
    }
  };

  const timezone = process.env.CRON_TZ || "Asia/Kolkata";
  cron.schedule(schedule, job, { scheduled: true, timezone });
  job();
}
