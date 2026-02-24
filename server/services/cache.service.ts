import {
  closeRedisConnection as closeSharedRedisConnection,
  getCache as getSharedCache,
  invalidateCachePattern as invalidateSharedCachePattern,
  setCache as setSharedCache,
} from "../cache";

function resolveTtlMs(ttlSeconds: number): number {
  const normalized = Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? ttlSeconds
    : 300;
  return Math.trunc(normalized * 1000);
}

export async function getCache<T>(key: string): Promise<T | null> {
  const cached = await getSharedCache<T>(key);
  return cached ?? null;
}

export async function setCache(
  key: string,
  data: unknown,
  ttlSeconds = 300,
): Promise<void> {
  await setSharedCache(key, data, resolveTtlMs(ttlSeconds));
}

export async function invalidateCache(pattern: string): Promise<void> {
  await invalidateSharedCachePattern(pattern);
}

export async function closeRedisConnection(): Promise<void> {
  await closeSharedRedisConnection();
}
