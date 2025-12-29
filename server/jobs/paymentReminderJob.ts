import cron from "node-cron";
import type { IStorage } from "../storage";
import logger from "../logger";
import { withJobLock } from "../services/jobLock.service";
export let lastRun: Date | null = null;

export function startPaymentReminderJob(storage: IStorage) {
  const schedule = process.env.PAYMENT_REMINDER_CRON || "30 * * * *"; // hourly at :30
  const reminderDays = parseInt(process.env.PAYMENT_REMINDER_DAYS || "3");
  const disputeDays = parseInt(process.env.PAYMENT_DISPUTE_DAYS || "7");
  const lockTtlMs =
    Number.parseInt(
      process.env.PAYMENT_REMINDER_LOCK_TTL_MS ||
      process.env.JOB_LOCK_TTL_MS ||
      "",
      10,
    ) || 10 * 60 * 1000;

  const job = async () => {
    const { acquired } = await withJobLock(
      { name: "payment-reminder", ttlMs: lockTtlMs },
      async () => {
        try {
          lastRun = new Date();
          const now = new Date();
          const reminderCutoff = new Date(
            now.getTime() - reminderDays * 24 * 60 * 60 * 1000,
          );
          const disputeCutoff = new Date(
            now.getTime() - disputeDays * 24 * 60 * 60 * 1000,
          );

          const awaiting = await storage.getBookingsByStatus("awaiting_payment");

          // Batch fetch all service IDs upfront to avoid N+1 queries
          const serviceIds = Array.from(
            new Set(
              awaiting
                .map((b) => b.serviceId)
                .filter((id): id is number => id != null),
            ),
          );
          const services =
            serviceIds.length > 0
              ? await storage.getServicesByIds(serviceIds)
              : [];
          const serviceMap = new Map(services.map((s) => [s.id, s]));

          // Batch fetch all provider IDs
          const providerIds = Array.from(
            new Set(
              services
                .map((s) => s.providerId)
                .filter((id): id is number => id != null),
            ),
          );
          const providers =
            providerIds.length > 0
              ? await storage.getUsersByIds(providerIds)
              : [];
          const providerMap = new Map(providers.map((p) => [p.id, p]));

          for (const b of awaiting) {
            const updatedAt = (b as any).updatedAt
              ? new Date((b as any).updatedAt)
              : new Date();
            if (updatedAt < disputeCutoff) {
              await storage.updateBooking(b.id, {
                status: "disputed",
                disputeReason: "Payment confirmation overdue.",
              });
            } else if (updatedAt < reminderCutoff) {
              const service = b.serviceId ? serviceMap.get(b.serviceId) : null;
              const provider = service?.providerId
                ? providerMap.get(service.providerId)
                : null;
              if (provider && provider.email) {
                logger.info(
                  `[PaymentReminderJob] Skipping email reminder for booking ${b.id}; email notifications disabled.`,
                );
              }
            }
          }
        } catch (err) {
          logger.error("Error running payment reminder job:", err);
        }
      },
    );

    if (!acquired) {
      logger.debug(
        "[PaymentReminderJob] Skipped run; another instance holds the lock",
      );
    }
  };

  const timezone = process.env.CRON_TZ || "Asia/Kolkata";
  cron.schedule(schedule, job, { scheduled: true, timezone });
  job();
}
