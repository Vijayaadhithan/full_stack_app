/**
 * Tests for server/cache.ts
 * Memory and Redis cache operations
 */
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import {
    getCache,
    setCache,
    invalidateCache,
    flushCache,
    __resetCacheForTesting,
    __setRedisModuleLoaderForTesting,
} from "../server/cache.js";
import { silenceLogger } from "./testHelpers.js";

// Silence logger during tests
import logger from "../server/logger.js";

describe("cache", () => {
    beforeEach(() => {
        silenceLogger(logger);
        __resetCacheForTesting();
        // Ensure Redis is disabled for memory-only tests
        process.env.DISABLE_REDIS = "true";
    });

    afterEach(() => {
        __resetCacheForTesting();
    });

    describe("setCache", () => {
        // Positive cases
        it("should store a value in cache", async () => {
            await setCache("test-key", { message: "hello" }, 60000);
            const result = await getCache<{ message: string }>("test-key");
            assert.deepStrictEqual(result, { message: "hello" });
        });

        it("should store string values", async () => {
            await setCache("string-key", "test-value", 60000);
            const result = await getCache<string>("string-key");
            assert.strictEqual(result, "test-value");
        });

        it("should store number values", async () => {
            await setCache("number-key", 42, 60000);
            const result = await getCache<number>("number-key");
            assert.strictEqual(result, 42);
        });

        it("should store array values", async () => {
            await setCache("array-key", [1, 2, 3], 60000);
            const result = await getCache<number[]>("array-key");
            assert.deepStrictEqual(result, [1, 2, 3]);
        });

        it("should overwrite existing value", async () => {
            await setCache("overwrite-key", "first", 60000);
            await setCache("overwrite-key", "second", 60000);
            const result = await getCache<string>("overwrite-key");
            assert.strictEqual(result, "second");
        });
    });

    describe("getCache", () => {
        // Positive cases
        it("should return cached value", async () => {
            await setCache("get-key", { data: "test" }, 60000);
            const result = await getCache<{ data: string }>("get-key");
            assert.deepStrictEqual(result, { data: "test" });
        });

        // Negative cases
        it("should return undefined for non-existent key", async () => {
            const result = await getCache("non-existent-key");
            assert.strictEqual(result, undefined);
        });

        it("should return undefined after TTL expires", async () => {
            await setCache("expiring-key", "value", 1); // 1ms TTL
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 10));
            const result = await getCache("expiring-key");
            assert.strictEqual(result, undefined);
        });
    });

    describe("invalidateCache", () => {
        // Positive cases
        it("should remove cached value", async () => {
            await setCache("invalidate-key", "value", 60000);
            await invalidateCache("invalidate-key");
            const result = await getCache("invalidate-key");
            assert.strictEqual(result, undefined);
        });

        // Negative cases
        it("should not throw for non-existent key", async () => {
            await assert.doesNotReject(async () => {
                await invalidateCache("non-existent-key");
            });
        });
    });

    describe("flushCache", () => {
        // Positive cases
        it("should remove all cached values", async () => {
            await setCache("flush-key-1", "value1", 60000);
            await setCache("flush-key-2", "value2", 60000);
            await flushCache();

            const result1 = await getCache("flush-key-1");
            const result2 = await getCache("flush-key-2");

            assert.strictEqual(result1, undefined);
            assert.strictEqual(result2, undefined);
        });

        it("should not throw when cache is empty", async () => {
            await assert.doesNotReject(async () => {
                await flushCache();
            });
        });
    });

    describe("cache limits", () => {
        // Positive cases - cache eviction
        it("should handle multiple entries", async () => {
            // Add several entries
            for (let i = 0; i < 10; i++) {
                await setCache(`limit-key-${i}`, `value-${i}`, 60000);
            }

            // All should be retrievable
            for (let i = 0; i < 10; i++) {
                const result = await getCache(`limit-key-${i}`);
                assert.strictEqual(result, `value-${i}`);
            }
        });
    });

    describe("Redis fallback", () => {
        beforeEach(() => {
            __resetCacheForTesting();
        });

        // When Redis is disabled, should use memory cache
        it("should work with DISABLE_REDIS=true", async () => {
            process.env.DISABLE_REDIS = "true";
            await setCache("redis-disabled-key", "value", 60000);
            const result = await getCache("redis-disabled-key");
            assert.strictEqual(result, "value");
        });

        // When REDIS_URL is not set, should use memory cache
        it("should work without REDIS_URL", async () => {
            delete process.env.REDIS_URL;
            process.env.DISABLE_REDIS = "false";
            await setCache("no-redis-url-key", "value", 60000);
            const result = await getCache("no-redis-url-key");
            assert.strictEqual(result, "value");
        });
    });
});
