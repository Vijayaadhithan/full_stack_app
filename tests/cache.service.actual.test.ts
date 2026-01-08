/**
 * Additional tests for server/services/cache.service.ts using actual imports
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    getCache,
    setCache,
    invalidateCache,
} from "../server/services/cache.service.js";

describe("cache.service - actual", () => {
    const testPrefix = `svc_cache_${Date.now()}_`;

    describe("basic operations", () => {
        it("should set and get value", async () => {
            const key = `${testPrefix}basic`;
            await setCache(key, "test-value");
            const result = await getCache<string>(key);
            assert.strictEqual(result, "test-value");
        });

        it("should handle complex object", async () => {
            const key = `${testPrefix}complex`;
            const data = {
                nested: { value: 123 },
                array: [1, 2, 3],
            };
            await setCache(key, data);
            const result = await getCache<typeof data>(key);
            assert.deepStrictEqual(result, data);
        });

        it("should invalidate key", async () => {
            const key = `${testPrefix}invalid`;
            await setCache(key, "to-invalidate");
            await invalidateCache(key);
            const result = await getCache(key);
            // Cache returns null or undefined after invalidation
            assert.ok(result === null || result === undefined);
        });

        it("should handle null value", async () => {
            const key = `${testPrefix}null`;
            await setCache(key, null);
            const result = await getCache(key);
            assert.strictEqual(result, null);
        });

        it("should handle boolean values", async () => {
            await setCache(`${testPrefix}true`, true);
            await setCache(`${testPrefix}false`, false);
            assert.strictEqual(await getCache(`${testPrefix}true`), true);
            assert.strictEqual(await getCache(`${testPrefix}false`), false);
        });

        it("should handle number values", async () => {
            await setCache(`${testPrefix}num`, 42.5);
            const result = await getCache<number>(`${testPrefix}num`);
            assert.strictEqual(result, 42.5);
        });
    });
});
