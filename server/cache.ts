import logger from "./logger";

interface CacheEntry<T> {
  expire: number;
  value: T;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

let redisClient: any | null = null;
let redisReady = false;
let redisInitPromise: Promise<void> | null = null;
let redisNextRetry = 0;
let loggedMissingUrl = false;

async function initRedis() {
  if (redisClient || redisInitPromise) {
    await redisInitPromise;
    return;
  }

  const now = Date.now();
  if (now < redisNextRetry) {
    return;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
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
      const redisModule = await import("redis");
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
        if (redisReady) {
          logger.error({ err: error }, "Redis connection error");
        } else {
          logger.warn({ err: error }, "Redis connection failed");
        }
        redisReady = false;
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

  memoryCache.set(key, { value, expire: Date.now() + ttlMs });
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

  memoryCache.delete(key);
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
