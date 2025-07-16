interface CacheEntry<T> {
  expire: number;
  value: T;
}

const cache = new Map<string, CacheEntry<any>>();

export function getCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expire > Date.now()) {
    return entry.value as T;
  }
  cache.delete(key);
  return undefined;
}

export function setCache<T>(key: string, value: T, ttlMs = 5 * 60 * 1000) {
  cache.set(key, { value, expire: Date.now() + ttlMs });
}
