import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import dotenv from 'dotenv';

dotenv.config();

// Check for required environment variables
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create postgres connection
const connectionString = process.env.DATABASE_URL;
const slowThreshold = Number(process.env.DB_SLOW_THRESHOLD_MS || 200);
const client = postgres(connectionString, {
  max: 10,
  debug: (connection, query, parameters) => {
    const start = Date.now();
    return (error?: Error) => {
      const duration = Date.now() - start;
      const msg = `${query} \u2013 ${duration}ms`;
      if (duration > slowThreshold) {
        console.warn(`[DB SLOW] ${msg}`, parameters);
      } else {
        console.log(`[DB] ${msg}`);
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
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}