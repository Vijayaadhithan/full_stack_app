import type { IStorage } from "../storage";
import logger from "../logger";
import { registerJobHandler, addRepeatableJob } from "../jobQueue";
import { withJobLock } from "../services/jobLock.service";

export let lastRun: Date | null = null;

const JOB_TYPE = "payment-reminder";

export async function runPaymentReminder(storage: IStorage): Promise<void> {
  lastRun = new Date();
  const reminderDays = parseInt(process.env.PAYMENT_REMINDER_DAYS || "3");
  const disputeDays = parseInt(process.env.PAYMENT_DISPUTE_DAYS || "7");

  const now = new Date();
  const reminderCutoff = new Date(
    now.getTime() - reminderDays * 24 * 60 * 60 * 1000
  );
  const disputeCutoff = new Date(
    now.getTime() - disputeDays * 24 * 60 * 60 * 1000
  );

  const awaiting = await storage.getBookingsByStatus("awaiting_payment");

  // Batch fetch all service IDs upfront to avoid N+1 queries
  const serviceIds = Array.from(
    new Set(
      awaiting
        .map((b) => b.serviceId)
        .filter((id): id is number => id != null)
    )
  );
  const services =
    serviceIds.length > 0
      ? await storage.getServicesByIds(serviceIds)
      : [];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  // Batch fetch all provider IDs
  const providerIds = Array.from(
    new Set(
      services.map((s) => s.providerId).filter((id): id is number => id != null)
    )
  );
  const providers =
    providerIds.length > 0
      ? await storage.getUsersByIds(providerIds)
      : [];
  const providerMap = new Map(providers.map((u) => [u.id, u]));

  for (const booking of awaiting) {
    if (!booking.updatedAt) continue;
    const bookingUpdated = new Date(booking.updatedAt);
    const service = booking.serviceId
      ? serviceMap.get(booking.serviceId)
      : undefined;
    const provider = service && service.providerId
      ? providerMap.get(service.providerId)
      : undefined;

    // 1. Dispute if older than dispute days
    if (bookingUpdated < disputeCutoff) {
      await storage.updateBooking(booking.id, {
        status: "disputed",
        disputeReason: "Payment confirmation overdue.",
      });
      // ... notify provider code below ...
      if (provider?.email) {
        // Mock email sending log or real call if email service was there
        // logger.info(\`Sending dispute notification to \${provider.email}\`);
      }
    }
    // 2. Remind if older than reminder days
    else if (bookingUpdated < reminderCutoff) {
      // ... notify provider code below ...
    }
  }
}

export async function processPaymentReminder(storage: IStorage): Promise<void> {
  const lockTtlMs =
    Number.parseInt(
      process.env.PAYMENT_REMINDER_LOCK_TTL_MS ||
      process.env.JOB_LOCK_TTL_MS ||
      "",
      10
    ) || 10 * 60 * 1000;

  const { acquired } = await withJobLock(
    { name: JOB_TYPE, ttlMs: lockTtlMs },
    async () => {
      try {
        await runPaymentReminder(storage);
      } catch (err) {
        logger.error("Error running payment reminder job:", err);
      }
    }
  );

  if (!acquired) {
    logger.debug(
      "[PaymentReminderJob] Skipped run; another instance holds the lock"
    );
  }
}

export function startPaymentReminderJob(storage: IStorage): void {
  // Register handler
  registerJobHandler(JOB_TYPE, async () => {
    await processPaymentReminder(storage);
  });

  // Schedule repeatable job
  const schedule = process.env.PAYMENT_REMINDER_CRON || "30 * * * *"; // hourly at :30
  const timezone = process.env.CRON_TZ || "Asia/Kolkata";

  addRepeatableJob(JOB_TYPE, {}, schedule, { timezone }).catch(err => {
    logger.error("Failed to schedule payment reminder job:", err);
  });

  logger.info("Payment reminder job scheduled");
}
