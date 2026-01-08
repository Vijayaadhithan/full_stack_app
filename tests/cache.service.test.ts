/**
 * Tests for server/services/cache.service.ts
 * Redis and local fallback cache operations
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
    getCache,
    setCache,
    invalidateCache,
} from "../server/services/cache.service.js";

describe("cache.service", () => {
    // Use unique prefix for each test to avoid collisions
    const testPrefix = `test_${Date.now()}_`;

    describe("setCache and getCache", () => {
        it("should store and retrieve string value", async () => {
            const key = `${testPrefix}string_test`;
            const value = "test value";

            await setCache(key, value, 60);
            const result = await getCache<string>(key);

            assert.strictEqual(result, value);
        });

        it("should store and retrieve number value", async () => {
            const key = `${testPrefix}number_test`;
            const value = 42;

            await setCache(key, value, 60);
            const result = await getCache<number>(key);

            assert.strictEqual(result, value);
        });

        it("should store and retrieve object value", async () => {
            const key = `${testPrefix}object_test`;
            const value = { id: 1, name: "test", active: true };

            await setCache(key, value, 60);
            const result = await getCache<typeof value>(key);

            assert.deepStrictEqual(result, value);
        });

        it("should store and retrieve array value", async () => {
            const key = `${testPrefix}array_test`;
            const value = [1, 2, 3, "a", "b", "c"];

            await setCache(key, value, 60);
            const result = await getCache<typeof value>(key);

            assert.deepStrictEqual(result, value);
        });

        it("should store and retrieve nested object", async () => {
            const key = `${testPrefix}nested_test`;
            const value = {
                user: { id: 1, profile: { name: "test" } },
                items: [{ id: 1 }, { id: 2 }],
            };

            await setCache(key, value, 60);
            const result = await getCache<typeof value>(key);

            assert.deepStrictEqual(result, value);
        });

        it("should store null value", async () => {
            const key = `${testPrefix}null_test`;

            await setCache(key, null, 60);
            const result = await getCache<null>(key);

            assert.strictEqual(result, null);
        });

        it("should store boolean values", async () => {
            const keyTrue = `${testPrefix}bool_true`;
            const keyFalse = `${testPrefix}bool_false`;

            await setCache(keyTrue, true, 60);
            await setCache(keyFalse, false, 60);

            assert.strictEqual(await getCache<boolean>(keyTrue), true);
            assert.strictEqual(await getCache<boolean>(keyFalse), false);
        });

        it("should return null for non-existent key", async () => {
            const key = `${testPrefix}nonexistent_${Date.now()}`;
            const result = await getCache<string>(key);

            assert.strictEqual(result, null);
        });

        it("should overwrite existing value", async () => {
            const key = `${testPrefix}overwrite_test`;

            await setCache(key, "first", 60);
            await setCache(key, "second", 60);
            const result = await getCache<string>(key);

            assert.strictEqual(result, "second");
        });

        it("should use default TTL when not specified", async () => {
            const key = `${testPrefix}default_ttl`;

            // Should not throw
            await setCache(key, "test");
            const result = await getCache<string>(key);

            assert.strictEqual(result, "test");
        });
    });

    describe("cache expiration", () => {
        it("should expire after TTL", async () => {
            const key = `${testPrefix}expire_test`;

            await setCache(key, "expiring", 1); // 1 second TTL

            // Should exist immediately
            const before = await getCache<string>(key);
            assert.strictEqual(before, "expiring");

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Should be expired
            const after = await getCache<string>(key);
            assert.strictEqual(after, null);
        });
    });

    describe("invalidateCache", () => {
        it("should invalidate single key", async () => {
            const key = `${testPrefix}invalidate_single`;

            await setCache(key, "to be invalidated", 60);
            await invalidateCache(key);

            const result = await getCache<string>(key);
            assert.strictEqual(result, null);
        });

        it("should invalidate keys matching pattern", async () => {
            const prefix = `${testPrefix}pattern_`;
            const key1 = `${prefix}one`;
            const key2 = `${prefix}two`;
            const key3 = `${testPrefix}other`;

            await setCache(key1, "value1", 60);
            await setCache(key2, "value2", 60);
            await setCache(key3, "value3", 60);

            await invalidateCache(`${prefix}*`);

            // Pattern matches should be gone
            assert.strictEqual(await getCache<string>(key1), null);
            assert.strictEqual(await getCache<string>(key2), null);

            // Non-matching should remain
            assert.strictEqual(await getCache<string>(key3), "value3");
        });

        it("should not throw for non-existent key", async () => {
            const key = `${testPrefix}nonexistent_invalidate_${Date.now()}`;

            // Should not throw
            await invalidateCache(key);
        });

        it("should handle empty pattern", async () => {
            // Should not throw
            await invalidateCache("");
        });
    });

    describe("edge cases", () => {
        it("should handle special characters in keys", async () => {
            const key = `${testPrefix}special:chars/test.key`;

            await setCache(key, "special", 60);
            const result = await getCache<string>(key);

            assert.strictEqual(result, "special");
        });

        it("should handle very long keys", async () => {
            const key = `${testPrefix}${"x".repeat(200)}`;

            await setCache(key, "long key", 60);
            const result = await getCache<string>(key);

            assert.strictEqual(result, "long key");
        });

        it("should handle large objects", async () => {
            const key = `${testPrefix}large_object`;
            const largeArray = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                name: `item_${i}`,
                data: "x".repeat(100),
            }));

            await setCache(key, largeArray, 60);
            const result = await getCache<typeof largeArray>(key);

            assert.strictEqual(result?.length, 1000);
            assert.strictEqual(result?.[0].id, 0);
            assert.strictEqual(result?.[999].id, 999);
        });

        it("should handle concurrent operations", async () => {
            const baseKey = `${testPrefix}concurrent_`;
            const operations = Array.from({ length: 10 }, async (_, i) => {
                const key = `${baseKey}${i}`;
                await setCache(key, `value_${i}`, 60);
                return getCache<string>(key);
            });

            const results = await Promise.all(operations);

            results.forEach((result, i) => {
                assert.strictEqual(result, `value_${i}`);
            });
        });
    });

    describe("local cache fallback", () => {
        // These tests run in DISABLE_REDIS=true mode
        it("should work without Redis", async () => {
            const key = `${testPrefix}local_fallback`;

            await setCache(key, "local value", 60);
            const result = await getCache<string>(key);

            assert.strictEqual(result, "local value");
        });
    });
});
