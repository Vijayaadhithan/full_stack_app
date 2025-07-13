import cron from 'node-cron';
import type { IStorage } from '../storage';

export function startBookingExpirationJob(storage: IStorage) {
  const schedule = process.env.BOOKING_EXPIRATION_CRON || '0 0 * * *';
  const job = async () => {
    try {
      console.log('Running booking expiration job');
      await storage.processExpiredBookings();
      console.log('Completed booking expiration job');
    } catch (err) {
      console.error('Error in booking expiration job:', err);
    }
  };

  cron.schedule(schedule, job);
  job();
}