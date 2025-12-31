import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";
import dotenv from "dotenv";
import logger from "./logger";

dotenv.config();

if (!process.env.DATABASE_URL) {
  logger.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

type PoolRole = "primary" | "replica";

const slowThreshold = Number(process.env.DB_SLOW_THRESHOLD_MS || 200);

function createDebugLogger(role: PoolRole) {
  const label = role === "replica" ? "DB:READ" : "DB";
  return (_connection: unknown, query: string, parameters: unknown) => {
    const start = Date.now();
    return (error?: Error) => {
      const duration = Date.now() - start;
      const msg = `[${label}] ${query} \u2013 ${duration}ms`;
      if (error) {
        logger.error({ err: error }, msg);
        return;
      }
      if (duration > slowThreshold) {
        logger.warn(`[SLOW] ${msg}`, parameters);
      } else {
        logger.debug(msg);
      }
    };
  };
}

function createClient(url: string, poolSize: number, role: PoolRole) {
  return postgres(url, {
    max: poolSize,
    debug: createDebugLogger(role),
  });
}

const primaryPoolSize = Number.parseInt(process.env.DB_POOL_SIZE || "50", 10);
const parsedReadPool = Number.parseInt(process.env.DB_READ_POOL_SIZE ?? "", 10);
const readPoolSize =
  Number.isFinite(parsedReadPool) && parsedReadPool > 0 ? parsedReadPool : primaryPoolSize;

const primaryUrl = process.env.DATABASE_URL!;
const replicaUrl = process.env.DATABASE_REPLICA_URL?.trim();

const primaryClient = createClient(primaryUrl, primaryPoolSize, "primary");
const replicaClient =
  replicaUrl && replicaUrl.length > 0 && replicaUrl !== primaryUrl
    ? createClient(replicaUrl, readPoolSize, "replica")
    : primaryClient;

const primaryDb = drizzle(primaryClient, { schema });
const replicaDb = replicaClient === primaryClient ? primaryDb : drizzle(replicaClient, { schema });
if (replicaClient === primaryClient) {
  logger.info("No DATABASE_REPLICA_URL configured; db.replica uses the primary database.");
} else {
  logger.info("DATABASE_REPLICA_URL detected; use db.replica for non-critical reads.");
}
export const db = {
  primary: primaryDb,
  replica: replicaDb,
};

export async function testConnection() {
  if (process.env.NODE_ENV === "test" || process.env.USE_IN_MEMORY_DB === "true") {
    logger.debug(
      "Skipping database connectivity check in test mode or when using in-memory storage.",
    );
    return true;
  }
  try {
    await primaryClient`SELECT 1`;
    logger.info("✅ Primary database connection successful");
    if (replicaClient !== primaryClient) {
      await replicaClient`SELECT 1`;
      logger.info("✅ Replica database connection successful");
    }
    return true;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    return false;
  }
}

export async function closeConnection() {
  await primaryClient.end();
  if (replicaClient !== primaryClient) {
    await replicaClient.end();
  }
  logger.info("Database connections closed");
}
