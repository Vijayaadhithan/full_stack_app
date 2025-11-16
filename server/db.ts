import { AsyncLocalStorage } from "node:async_hooks";
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
const readPreference = new AsyncLocalStorage<boolean>();

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
        logger.info(msg);
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

const primaryPoolSize = Number.parseInt(process.env.DB_POOL_SIZE || "10", 10);
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
  logger.info("No DATABASE_REPLICA_URL configured; SELECT statements use the primary database.");
} else {
  logger.info("DATABASE_REPLICA_URL detected; routing SELECT statements to the read replica.");
}

const READ_METHODS = new Set<string>(["select"]);

function shouldUsePrimaryReads() {
  return readPreference.getStore() === true || replicaDb === primaryDb;
}

const dbProxy = new Proxy(primaryDb, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && READ_METHODS.has(prop)) {
      const source = shouldUsePrimaryReads() ? target : replicaDb;
      const value = Reflect.get(source as object, prop, receiver);
      if (typeof value === "function") {
        return value.bind(source);
      }
      return value;
    }
    return Reflect.get(target as object, prop, receiver);
  },
  set(target, prop, value, receiver) {
    if (typeof prop === "string" && READ_METHODS.has(prop) && replicaDb !== target) {
      Reflect.set(replicaDb as object, prop, value);
    }
    return Reflect.set(target as object, prop, value, receiver);
  },
});

export const db = dbProxy as typeof primaryDb;

export function runWithPrimaryReads<T>(callback: () => T): T {
  return readPreference.run(true, callback);
}

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
