/**
 * Additional tests for server/cache.ts modules using actual imports
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    getCache,
    setCache,
    invalidateCache,
} from "../server/cache.js";

describe("cache module - actual", () => {
    const testPrefix = `actual_cache_${Date.now()}_`;

    describe("setCache and getCache", () => {
        it("should store and retrieve string", async () => {
            const key = `${testPrefix}str`;
            await setCache(key, "hello-world");
            const result = await getCache<string>(key);
            assert.strictEqual(result, "hello-world");
        });

        it("should store and retrieve object", async () => {
            const key = `${testPrefix}obj`;
            const obj = { id: 42, name: "test-object" };
            await setCache(key, obj);
            const result = await getCache<typeof obj>(key);
            assert.deepStrictEqual(result, obj);
        });

        it("should return null or undefined for missing key", async () => {
            const key = `${testPrefix}missing_key_${Date.now()}`;
            const result = await getCache(key);
            assert.ok(result === null || result === undefined);
        });

        it("should overwrite existing value", async () => {
            const key = `${testPrefix}overwrite`;
            await setCache(key, "first-value");
            await setCache(key, "second-value");
            const result = await getCache<string>(key);
            assert.strictEqual(result, "second-value");
        });
    });

    describe("invalidateCache", () => {
        it("should remove cached value", async () => {
            const key = `${testPrefix}to_remove`;
            await setCache(key, "value-to-remove");
            await invalidateCache(key);
            const result = await getCache(key);
            assert.ok(result === null || result === undefined);
        });
    });
});
