import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

// Check for required environment variables
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create postgres connection
const connectionString = process.env.DATABASE_URL;
const poolSize = parseInt(process.env.DB_POOL_SIZE || '10', 10);
const slowThreshold = Number(process.env.DB_SLOW_THRESHOLD_MS || 200);
const client = postgres(connectionString, {
  max: poolSize,
  debug: (connection, query, parameters) => {
    const start = Date.now();
    return (error?: Error) => {
      const duration = Date.now() - start;
      const msg = `${query} \u2013 ${duration}ms`;
      if (duration > slowThreshold) {
        logger.warn(`[DB SLOW] ${msg}`, parameters);
      } else {
        logger.info(`[DB] ${msg}`);
      }
    };
  },
});

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Export a function to test the database connection
export async function testConnection() {
  try {
    // Try to query the database
    await client`SELECT 1`;
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    return false;
  }
}