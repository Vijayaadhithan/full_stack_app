import logger from "./logger";
import {
  getRedisUrl,
  isRedisConnectionError,
  isRedisDisabled,
} from "./redisConfig";

interface CacheEntry<T> {
  expire: number;
  value: T;
  insertedAt: number; // Track insertion time for LRU-like eviction
}

// PERFORMANCE FIX: Add max cache size to prevent unbounded memory growth
const MAX_CACHE_ENTRIES = 1000;
const CLEANUP_INTERVAL_MS = 60_000; // Cleanup every 60 seconds

const memoryCache = new Map<string, CacheEntry<unknown>>();

let redisClient: any | null = null;
let redisReady = false;
let redisInitPromise: Promise<void> | null = null;
let redisNextRetry = 0;
let loggedMissingUrl = false;
let loggedDisabled = false;
let redisModuleLoader: (() => Promise<any>) | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let closingRedisClient = false;

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}

function invalidateMemoryCacheByPattern(pattern: string): void {
  if (!pattern.includes("*")) {
    memoryCache.delete(pattern);
    return;
  }

  const regex = patternToRegex(pattern);
  for (const key of Array.from(memoryCache.keys())) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

// PERFORMANCE FIX: Periodic cleanup of expired entries
function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let removedCount = 0;
    for (const [key, entry] of Array.from(memoryCache.entries())) {
      if (entry.expire <= now) {
        memoryCache.delete(key);
        removedCount++;
      }
    }
    if (removedCount > 0) {
      logger.debug({ removedCount, remainingSize: memoryCache.size }, "Cache cleanup completed");
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent process exit
  cleanupTimer.unref();
}

// PERFORMANCE FIX: Evict oldest entries when cache is full
function evictOldestEntries(count: number) {
  if (count <= 0) return;
  // Sort by insertedAt to find oldest entries
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].insertedAt - b[1].insertedAt)
    .slice(0, count);
  for (const [key] of entries) {
    memoryCache.delete(key);
  }
}

export async function __resetCacheForTesting() {
  await closeRedisConnection();
  redisNextRetry = 0;
  loggedMissingUrl = false;
  loggedDisabled = false;
  redisModuleLoader = null;
  closingRedisClient = false;
  memoryCache.clear();
}
export function __setRedisModuleLoaderForTesting(
  loader: (() => Promise<any>) | null,
) {
  redisModuleLoader = loader;
}

async function initRedis() {
  if (redisClient || redisInitPromise) {
    await redisInitPromise;
    return;
  }

  const now = Date.now();
  if (now < redisNextRetry) {
    return;
  }

  const redisDisabled = isRedisDisabled();

  if (redisDisabled) {
    if (process.env.NODE_ENV === "production") {
      logger.fatal("Redis is disabled via DISABLE_REDIS but running in PRODUCTION mode. Exiting...");
      process.exit(1);
    }
    if (!loggedDisabled) {
      logger.info(
        "Redis cache disabled via DISABLE_REDIS flag. Using in-memory cache for this instance.",
      );
      loggedDisabled = true;
    }
    redisNextRetry = Number.POSITIVE_INFINITY;
    return;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    if (process.env.NODE_ENV === "production") {
      logger.fatal("REDIS_URL not set but running in PRODUCTION mode. Exiting...");
      process.exit(1);
    }
    if (!loggedMissingUrl) {
      logger.info(
        "REDIS_URL not set. Using in-memory cache for this instance.",
      );
      loggedMissingUrl = true;
    }
    // No need to retry when configuration is missing.
    redisNextRetry = Number.POSITIVE_INFINITY;
    return;
  }

  redisInitPromise = (async () => {
    try {
      const redisModule = await (redisModuleLoader
        ? redisModuleLoader()
        : import("redis"));
      const createClient = (redisModule as any).createClient;
      if (typeof createClient !== "function") {
        throw new Error("redis module does not export createClient");
      }

      const client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 50, 2000),
        },
      });

      client.on("error", (error: Error) => {
        if (isRedisConnectionError(error)) {
          logger.warn(
            { err: error },
            redisReady
              ? "Redis cache connection lost; serving cache from memory until Redis reconnects."
              : "Redis cache connection failed; using in-memory fallback until Redis is reachable.",
          );
        } else if (redisReady) {
          logger.error({ err: error }, "Redis connection error");
        } else {
          logger.warn({ err: error }, "Redis connection failed");
        }
        redisReady = false;
      });

      client.on("reconnecting", () => {
        logger.info("Redis cache reconnecting");
      });

      client.on("end", () => {
        redisReady = false;
        if (closingRedisClient) {
          logger.info("Redis cache connection closed");
          return;
        }
        logger.warn("Redis cache connection closed");
      });

      client.on("connect", () => {
        redisReady = true;
        logger.info("Connected to Redis cache");
      });

      await client.connect();
      redisClient = client;
      redisReady = true;
      redisNextRetry = 0;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        logger.fatal({ err: error }, "Failed to connect to Redis in PRODUCTION mode. Exiting...");
        process.exit(1);
      }
      redisClient = null;
      redisReady = false;
      redisNextRetry = Date.now() + 60_000; // Retry after 60s to avoid log spam.
      logger.warn(
        { err: error },
        "Falling back to in-memory cache. Redis unavailable.",
      );
    } finally {
      redisInitPromise = null;
    }
  })();

  await redisInitPromise;
}

export async function getRedisClient() {
  await initRedis();
  return redisClient;
}

export async function getCache<T>(key: string): Promise<T | undefined> {
  await initRedis();

  if (redisClient && redisReady) {
    try {
      const raw = await redisClient.get(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch (error) {
      logger.warn({ err: error, key }, "Failed to read from Redis cache");
    }
  }

  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (entry.expire > Date.now()) {
    return entry.value as T;
  }
  memoryCache.delete(key);
  return undefined;
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlMs = 5 * 60 * 1000,
): Promise<void> {
  await initRedis();

  if (redisClient && redisReady) {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        PX: ttlMs,
      });
    } catch (error) {
      logger.warn({ err: error, key }, "Failed to write to Redis cache");
    }
  }

  // PERFORMANCE FIX: Start cleanup timer on first cache use
  startCleanupTimer();

  // PERFORMANCE FIX: Evict oldest entries if cache is full
  if (!memoryCache.has(key) && memoryCache.size >= MAX_CACHE_ENTRIES) {
    const entriesToEvict = Math.max(1, Math.floor(MAX_CACHE_ENTRIES * 0.1)); // Evict 10%
    evictOldestEntries(entriesToEvict);
  }

  memoryCache.set(key, { value, expire: Date.now() + ttlMs, insertedAt: Date.now() });
}

export async function invalidateCache(key: string): Promise<void> {
  await initRedis();

  if (redisClient && redisReady) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.warn({ err: error, key }, "Failed to invalidate Redis cache");
    }
  }

  invalidateMemoryCacheByPattern(key);
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  await initRedis();

  if (redisClient && redisReady) {
    try {
      if (!pattern.includes("*")) {
        await redisClient.del(pattern);
      } else {
        let cursor: number | string = 0;
        do {
          const scanResult: any = await redisClient.scan(cursor, {
            MATCH: pattern,
            COUNT: 100,
          });
          const nextCursor: number | string | undefined = Array.isArray(scanResult)
            ? scanResult[0]
            : scanResult?.cursor;
          const keys = Array.isArray(scanResult) ? scanResult[1] : scanResult?.keys;
          if (Array.isArray(keys) && keys.length > 0) {
            await redisClient.del(...keys);
          }
          cursor = nextCursor ?? 0;
        } while (String(cursor) !== "0");
      }
    } catch (error) {
      logger.warn({ err: error, pattern }, "Failed to invalidate Redis cache pattern");
    }
  }

  invalidateMemoryCacheByPattern(pattern);
}

export async function flushCache(): Promise<void> {
  await initRedis();

  if (redisClient && redisReady) {
    try {
      await redisClient.flushAll();
    } catch (error) {
      logger.warn({ err: error }, "Failed to flush Redis cache");
    }
  }

  memoryCache.clear();
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    closingRedisClient = true;
    try {
      if (typeof redisClient.quit === "function") {
        await redisClient.quit();
      } else if (typeof redisClient.disconnect === "function") {
        await redisClient.disconnect();
      }
    } catch (error) {
      logger.warn({ err: error }, "Failed to close Redis cache connection cleanly");
    }
  }

  redisClient = null;
  redisReady = false;
  redisInitPromise = null;
  closingRedisClient = false;
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
