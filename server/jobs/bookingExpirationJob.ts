import cron from 'node-cron';
import type { IStorage } from '../storage';
import logger from '../logger';

export function startBookingExpirationJob(storage: IStorage) {
  const schedule = process.env.BOOKING_EXPIRATION_CRON || '0 0 * * *';
  const job = async () => {
    try {
      logger.info('Running booking expiration job');
      await storage.processExpiredBookings();
      logger.info('Completed booking expiration job');
    } catch (err) {
      logger.error('Error in booking expiration job:', err);
    }
  };

  cron.schedule(schedule, job);
  job();
}