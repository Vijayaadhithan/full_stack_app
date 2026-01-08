/**
 * Tests for server/cache.ts
 * Main cache module with memory and Redis support
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    getCache,
    setCache,
    invalidateCache,
    flushCache,
} from "../server/cache.js";

describe("cache module", () => {
    const testPrefix = `cachetest_${Date.now()}_`;

    describe("setCache and getCache", () => {
        it("should store and retrieve string", async () => {
            const key = `${testPrefix}str`;
            await setCache(key, "hello");
            const result = await getCache<string>(key);
            assert.strictEqual(result, "hello");
        });

        it("should store and retrieve number", async () => {
            const key = `${testPrefix}num`;
            await setCache(key, 42);
            const result = await getCache<number>(key);
            assert.strictEqual(result, 42);
        });

        it("should store and retrieve object", async () => {
            const key = `${testPrefix}obj`;
            const obj = { id: 1, name: "test" };
            await setCache(key, obj);
            const result = await getCache<typeof obj>(key);
            assert.deepStrictEqual(result, obj);
        });

        it("should store and retrieve array", async () => {
            const key = `${testPrefix}arr`;
            const arr = [1, 2, 3];
            await setCache(key, arr);
            const result = await getCache<number[]>(key);
            assert.deepStrictEqual(result, arr);
        });

        it("should store and retrieve boolean", async () => {
            const keyTrue = `${testPrefix}bool_true`;
            const keyFalse = `${testPrefix}bool_false`;
            await setCache(keyTrue, true);
            await setCache(keyFalse, false);
            assert.strictEqual(await getCache(keyTrue), true);
            assert.strictEqual(await getCache(keyFalse), false);
        });

        it("should store null value", async () => {
            const key = `${testPrefix}null`;
            await setCache(key, null);
            const result = await getCache(key);
            assert.strictEqual(result, null);
        });

        it("should return undefined for missing key", async () => {
            const key = `${testPrefix}missing_${Date.now()}`;
            const result = await getCache(key);
            assert.strictEqual(result, undefined);
        });

        it("should overwrite existing value", async () => {
            const key = `${testPrefix}overwrite`;
            await setCache(key, "first");
            await setCache(key, "second");
            const result = await getCache<string>(key);
            assert.strictEqual(result, "second");
        });

        it("should use custom TTL", async () => {
            const key = `${testPrefix}ttl`;
            await setCache(key, "with-ttl", 60000); // 60 seconds
            const result = await getCache<string>(key);
            assert.strictEqual(result, "with-ttl");
        });
    });

    describe("invalidateCache", () => {
        it("should remove cached value", async () => {
            const key = `${testPrefix}invalidate`;
            await setCache(key, "to-remove");
            await invalidateCache(key);
            const result = await getCache(key);
            assert.strictEqual(result, undefined);
        });

        it("should not throw for non-existent key", async () => {
            const key = `${testPrefix}nonexistent_${Date.now()}`;
            await assert.doesNotReject(() => invalidateCache(key));
        });
    });

    describe("flushCache", () => {
        it("should not throw", async () => {
            await assert.doesNotReject(() => flushCache());
        });
    });

    describe("complex objects", () => {
        it("should handle nested objects", async () => {
            const key = `${testPrefix}nested`;
            const nested = {
                level1: {
                    level2: {
                        value: "deep",
                    },
                },
            };
            await setCache(key, nested);
            const result = await getCache<typeof nested>(key);
            assert.deepStrictEqual(result, nested);
        });

        it("should handle objects with nulls", async () => {
            const key = `${testPrefix}nullfields`;
            const obj = { a: 1, b: null, c: "test" };
            await setCache(key, obj);
            const result = await getCache<typeof obj>(key);
            assert.deepStrictEqual(result, obj);
        });

        it("should handle large objects", async () => {
            const key = `${testPrefix}large`;
            const large = {
                items: Array.from({ length: 100 }, (_, i) => ({
                    id: i,
                    name: `Item ${i}`,
                    data: "x".repeat(50),
                })),
            };
            await setCache(key, large);
            const result = await getCache<typeof large>(key);
            assert.strictEqual(result?.items.length, 100);
        });
    });
});
