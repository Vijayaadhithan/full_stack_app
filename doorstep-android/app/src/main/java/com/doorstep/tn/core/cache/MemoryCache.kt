package com.doorstep.tn.core.cache

import android.util.LruCache

/**
 * Generic in-memory cache with TTL (Time-To-Live) support.
 * Used to cache API responses and reduce server communication.
 * 
 * @param maxSize Maximum number of entries to cache
 * @param ttlMillis Time after which cached entries expire (default: 5 minutes)
 */
class MemoryCache<K, V>(
    private val maxSize: Int = 100,
    private val ttlMillis: Long = 5 * 60 * 1000 // 5 minutes default
) {
    private data class CacheEntry<V>(val value: V, val timestamp: Long)
    private val cache = LruCache<K, CacheEntry<V>>(maxSize)
    
    /**
     * Get a cached value if it exists and hasn't expired.
     * Returns null if the entry doesn't exist or has expired.
     */
    @Synchronized
    fun get(key: K): V? {
        val entry = cache.get(key) ?: return null
        if (System.currentTimeMillis() - entry.timestamp > ttlMillis) {
            cache.remove(key)
            return null
        }
        return entry.value
    }
    
    /**
     * Store a value in the cache with current timestamp.
     */
    @Synchronized
    fun put(key: K, value: V) {
        cache.put(key, CacheEntry(value, System.currentTimeMillis()))
    }
    
    /**
     * Invalidate a specific cache entry.
     */
    @Synchronized
    fun invalidate(key: K) {
        cache.remove(key)
    }
    
    /**
     * Clear all cached entries.
     */
    @Synchronized
    fun clear() {
        cache.evictAll()
    }
    
    /**
     * Get the current number of cached entries.
     */
    fun size(): Int = cache.size()
}
