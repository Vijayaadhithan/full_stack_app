import logger from "../logger";

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
  scan(
    cursor: string,
    ...args: Array<string | number>
  ): Promise<[string, string[]]>;
  del(...keys: string[]): Promise<number>;
  connect(): Promise<void>;
  on(event: "error" | "end", listener: (err?: unknown) => void): void;
};

type RedisConstructor = new (
  url: string,
  options: Record<string, unknown>,
) => RedisClient;

const redisUrl = process.env.REDIS_URL?.trim();
let redisClient: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;
let loggedMissingUrl = false;
let loggedMissingModule = false;

// ─── LOCAL CACHE FALLBACK ─────────────────────────────────────────────
// Simple in-memory cache with TTL for when Redis is unavailable
type LocalCacheEntry = { data: unknown; expiresAt: number };
const localCache = new Map<string, LocalCacheEntry>();
const MAX_LOCAL_CACHE_SIZE = 100;
let loggedLocalCacheFallback = false;

function getLocalCache<T>(key: string): T | null {
  const entry = localCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setLocalCache(key: string, data: unknown, ttlSeconds: number): void {
  // Evict oldest entry if at capacity (simple LRU-like behavior)
  if (localCache.size >= MAX_LOCAL_CACHE_SIZE) {
    const firstKey = localCache.keys().next().value;
    if (firstKey) localCache.delete(firstKey);
  }
  localCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });

  if (!loggedLocalCacheFallback) {
    logger.info("Using local in-memory cache fallback (Redis unavailable)");
    loggedLocalCacheFallback = true;
  }
}

function invalidateLocalCache(pattern: string): void {
  // Simple prefix matching for invalidation
  const prefix = pattern.replace(/\*/g, "");
  const keysToDelete: string[] = [];
  const allKeys = Array.from(localCache.keys());
  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    localCache.delete(key);
  }
}

async function loadRedis(): Promise<RedisConstructor | null> {
  try {
    const redisModule = await import("ioredis");
    const Redis = (redisModule as { default?: RedisConstructor }).default;
    if (!Redis) {
      throw new Error("ioredis default export missing");
    }
    return Redis;
  } catch (err) {
    if (!loggedMissingModule) {
      logger.warn({ err }, "Failed to load ioredis; caching disabled");
      loggedMissingModule = true;
    }
    return null;
  }
}

async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient) {
    return redisClient;
  }

  if (connectPromise) {
    return connectPromise;
  }

  if (!redisUrl) {
    if (!loggedMissingUrl) {
      logger.warn("REDIS_URL not configured; Redis cache disabled.");
      loggedMissingUrl = true;
    }
    return null;
  }

  connectPromise = (async () => {
    const Redis = await loadRedis();
    if (!Redis) {
      return null;
    }

    try {
      const client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });

      client.on("error", (err: unknown) => {
        logger.warn({ err }, "Redis connection error");
      });

      client.on("end", () => {
        logger.warn("Redis connection closed; cache will fail open.");
        redisClient = null;
      });

      await client.connect();
      redisClient = client;
      logger.info("Connected to Redis cache");
      return client;
    } catch (err) {
      logger.warn({ err }, "Failed to connect to Redis; caching disabled");
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export async function getCache<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return getLocalCache<T>(key);

  try {
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, "Failed to read from Redis cache");
    return getLocalCache<T>(key);
  }
}

export async function setCache(
  key: string,
  data: unknown,
  ttlSeconds = 300,
): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    setLocalCache(key, data, ttlSeconds);
    return;
  }

  try {
    await client.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "Failed to write to Redis cache");
    setLocalCache(key, data, ttlSeconds);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  // Always invalidate local cache
  invalidateLocalCache(pattern);

  const client = await getRedisClient();
  if (!client) return;

  let cursor = "0";
  try {
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      if (keys.length > 0) {
        await client.del(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== "0");
  } catch (err) {
    logger.warn({ err, pattern }, "Failed to invalidate Redis cache keys");
  }
}
