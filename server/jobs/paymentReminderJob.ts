import cron from "node-cron";
import type { IStorage } from "../storage";
import { sendEmail } from "../emailService";
import logger from "../logger";

export function startPaymentReminderJob(storage: IStorage) {
  const schedule = process.env.PAYMENT_REMINDER_CRON || "30 * * * *"; // hourly at :30
  const reminderDays = parseInt(process.env.PAYMENT_REMINDER_DAYS || "3");
  const disputeDays = parseInt(process.env.PAYMENT_DISPUTE_DAYS || "7");

  const job = async () => {
    try {
      const now = new Date();
      const reminderCutoff = new Date(
        now.getTime() - reminderDays * 24 * 60 * 60 * 1000,
      );
      const disputeCutoff = new Date(
        now.getTime() - disputeDays * 24 * 60 * 60 * 1000,
      );

      const awaiting = await storage.getBookingsByStatus("awaiting_payment");

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
          const provider = await storage
            .getService(b.serviceId!)
            .then((s) => (s ? storage.getUser(s.providerId!) : null));
          if (provider && (provider as any).email) {
            const mail = {
              to: provider.name,
              subject: "Payment Pending",
              text: `Booking #${b.id} is awaiting your payment confirmation.`,
            };
            (mail as any).to = (provider as any).email;
            await sendEmail(mail as any);
          }
        }
      }
    } catch (err) {
      logger.error("Error running payment reminder job:", err);
    }
  };

  const timezone = process.env.CRON_TZ || "Asia/Kolkata";
  cron.schedule(schedule, job, { scheduled: true, timezone });
  job();
}
