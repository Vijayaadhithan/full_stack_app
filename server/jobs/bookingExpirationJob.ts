import type { IStorage } from "../storage";
import logger from "../logger";
import { registerJobHandler, addRepeatableJob, getJobQueue } from "../jobQueue";
import { withJobLock } from "../services/jobLock.service";

export let lastRun: Date | null = null;

const JOB_TYPE = "booking-expiration";

export async function runBookingExpiration(storage: IStorage): Promise<void> {
  lastRun = new Date();
  logger.info("Running booking expiration job");
  await storage.processExpiredBookings();
  logger.info("Completed booking expiration job");
}

export async function processBookingExpiration(storage: IStorage): Promise<void> {
  const lockTtlMs =
    Number.parseInt(
      process.env.BOOKING_EXPIRATION_LOCK_TTL_MS ||
      process.env.JOB_LOCK_TTL_MS ||
      "",
      10
    ) || 10 * 60 * 1000;

  const { acquired } = await withJobLock(
    { name: JOB_TYPE, ttlMs: lockTtlMs },
    async () => {
      try {
        await runBookingExpiration(storage);
      } catch (err) {
        logger.error("Error in booking expiration job:", err);
        throw err; // Re-throw to mark job as failed
      }
    }
  );

  if (!acquired) {
    logger.debug(
      "[BookingExpirationJob] Skipped run; another instance holds the lock"
    );
  }
}

export function startBookingExpirationJob(storage: IStorage): void {
  // Register handler
  registerJobHandler(JOB_TYPE, async () => {
    await processBookingExpiration(storage);
  });

  // Schedule repeatable job
  const schedule = process.env.BOOKING_EXPIRATION_CRON || "0 * * * *";
  const timezone = process.env.CRON_TZ || "Asia/Kolkata";

  // Check if already scheduled to avoid duplicates
  getJobQueue()
    .getRepeatableJobs()
    .then((jobs) => {
      const exists = jobs.some((j) => j.name === JOB_TYPE);
      if (!exists) {
        addRepeatableJob(JOB_TYPE, {}, schedule, { timezone });
      } else {
        logger.debug("[BookingExpirationJob] Already scheduled, skipping");
      }
    });

  // Run immediately on startup
  processBookingExpiration(storage);
}
