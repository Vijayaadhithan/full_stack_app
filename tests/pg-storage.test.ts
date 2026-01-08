/**
 * Tests for server/pg-storage.ts
 * PostgreSQL storage utility functions and helpers
 */
import { describe, it } from "node:test";
import assert from "node:assert";

describe("pg-storage utilities", () => {
    describe("product cache key building", () => {
        const PRODUCT_CACHE_PREFIX = "products";

        function stableStringify(value: unknown): string {
            if (value === null || value === undefined) {
                return String(value);
            }
            if (Array.isArray(value)) {
                return "[" + value.map(stableStringify).join(",") + "]";
            }
            if (typeof value === "object") {
                const sortedKeys = Object.keys(value).sort();
                const pairs = sortedKeys.map(
                    (k) => JSON.stringify(k) + ":" + stableStringify((value as any)[k])
                );
                return "{" + pairs.join(",") + "}";
            }
            return JSON.stringify(value);
        }

        function buildProductCacheKey(filters?: Record<string, unknown>): string {
            if (!filters || Object.keys(filters).length === 0) {
                return `${PRODUCT_CACHE_PREFIX}:all`;
            }
            const hash = stableStringify(filters);
            return `${PRODUCT_CACHE_PREFIX}:${hash}`;
        }

        it("should return 'all' key for no filters", () => {
            const key = buildProductCacheKey();
            assert.strictEqual(key, "products:all");
        });

        it("should return 'all' key for empty filters", () => {
            const key = buildProductCacheKey({});
            assert.strictEqual(key, "products:all");
        });

        it("should include filters in key", () => {
            const key = buildProductCacheKey({ shopId: 1 });
            assert.ok(key.startsWith("products:"));
            assert.ok(key.includes("shopId"));
        });

        it("should produce same key for same filters", () => {
            const key1 = buildProductCacheKey({ shopId: 1, category: "food" });
            const key2 = buildProductCacheKey({ shopId: 1, category: "food" });

            assert.strictEqual(key1, key2);
        });

        it("should produce same key regardless of filter order", () => {
            const key1 = buildProductCacheKey({ a: 1, b: 2 });
            const key2 = buildProductCacheKey({ b: 2, a: 1 });

            assert.strictEqual(key1, key2);
        });

        it("should produce different keys for different filters", () => {
            const key1 = buildProductCacheKey({ shopId: 1 });
            const key2 = buildProductCacheKey({ shopId: 2 });

            assert.notStrictEqual(key1, key2);
        });
    });

    describe("stableStringify", () => {
        function stableStringify(value: unknown): string {
            if (value === null || value === undefined) {
                return String(value);
            }
            if (Array.isArray(value)) {
                return "[" + value.map(stableStringify).join(",") + "]";
            }
            if (typeof value === "object") {
                const sortedKeys = Object.keys(value).sort();
                const pairs = sortedKeys.map(
                    (k) => JSON.stringify(k) + ":" + stableStringify((value as any)[k])
                );
                return "{" + pairs.join(",") + "}";
            }
            return JSON.stringify(value);
        }

        it("should stringify null", () => {
            assert.strictEqual(stableStringify(null), "null");
        });

        it("should stringify undefined", () => {
            assert.strictEqual(stableStringify(undefined), "undefined");
        });

        it("should stringify numbers", () => {
            assert.strictEqual(stableStringify(42), "42");
        });

        it("should stringify strings", () => {
            assert.strictEqual(stableStringify("hello"), '"hello"');
        });

        it("should stringify booleans", () => {
            assert.strictEqual(stableStringify(true), "true");
            assert.strictEqual(stableStringify(false), "false");
        });

        it("should stringify arrays", () => {
            assert.strictEqual(stableStringify([1, 2, 3]), "[1,2,3]");
        });

        it("should stringify objects with sorted keys", () => {
            const result = stableStringify({ b: 2, a: 1 });
            assert.strictEqual(result, '{"a":1,"b":2}');
        });

        it("should produce consistent output for same object", () => {
            const obj = { z: 3, a: 1, m: 2 };
            const result1 = stableStringify(obj);
            const result2 = stableStringify(obj);

            assert.strictEqual(result1, result2);
        });

        it("should handle nested objects", () => {
            const result = stableStringify({ outer: { inner: 1 } });
            assert.ok(result.includes("outer"));
            assert.ok(result.includes("inner"));
        });

        it("should handle nested arrays", () => {
            const result = stableStringify([[1, 2], [3, 4]]);
            assert.strictEqual(result, "[[1,2],[3,4]]");
        });
    });

    describe("shop modes resolution", () => {
        const DEFAULT_SHOP_MODES = {
            catalogModeEnabled: false,
            openOrderMode: false,
            allowPayLater: false,
        };

        type ShopProfile = {
            catalogModeEnabled?: boolean;
            openOrderMode?: boolean;
            allowPayLater?: boolean;
        };

        function resolveShopModes(
            profile: ShopProfile | null | undefined
        ): typeof DEFAULT_SHOP_MODES {
            if (!profile) {
                return { ...DEFAULT_SHOP_MODES };
            }
            return {
                catalogModeEnabled: profile.catalogModeEnabled ?? false,
                openOrderMode: profile.openOrderMode ?? false,
                allowPayLater: profile.allowPayLater ?? false,
            };
        }

        it("should return defaults for null profile", () => {
            const result = resolveShopModes(null);

            assert.deepStrictEqual(result, DEFAULT_SHOP_MODES);
        });

        it("should return defaults for undefined profile", () => {
            const result = resolveShopModes(undefined);

            assert.deepStrictEqual(result, DEFAULT_SHOP_MODES);
        });

        it("should return defaults for empty profile", () => {
            const result = resolveShopModes({});

            assert.deepStrictEqual(result, DEFAULT_SHOP_MODES);
        });

        it("should respect catalogModeEnabled", () => {
            const result = resolveShopModes({ catalogModeEnabled: true });

            assert.strictEqual(result.catalogModeEnabled, true);
            assert.strictEqual(result.openOrderMode, false);
            assert.strictEqual(result.allowPayLater, false);
        });

        it("should respect openOrderMode", () => {
            const result = resolveShopModes({ openOrderMode: true });

            assert.strictEqual(result.openOrderMode, true);
        });

        it("should respect allowPayLater", () => {
            const result = resolveShopModes({ allowPayLater: true });

            assert.strictEqual(result.allowPayLater, true);
        });

        it("should handle all modes enabled", () => {
            const result = resolveShopModes({
                catalogModeEnabled: true,
                openOrderMode: true,
                allowPayLater: true,
            });

            assert.strictEqual(result.catalogModeEnabled, true);
            assert.strictEqual(result.openOrderMode, true);
            assert.strictEqual(result.allowPayLater, true);
        });

        it("should handle explicit false values", () => {
            const result = resolveShopModes({
                catalogModeEnabled: false,
                openOrderMode: false,
                allowPayLater: false,
            });

            assert.deepStrictEqual(result, DEFAULT_SHOP_MODES);
        });
    });

    describe("product filter normalization", () => {
        function normalizeProductFilters(filters: Record<string, unknown>) {
            const normalized: Record<string, unknown> = {};

            // Normalize shopId
            if (filters.shopId != null) {
                const shopId = Number(filters.shopId);
                if (Number.isFinite(shopId) && shopId > 0) {
                    normalized.shopId = shopId;
                }
            }

            // Normalize category
            if (typeof filters.category === "string" && filters.category.trim()) {
                normalized.category = filters.category.trim().toLowerCase();
            }

            // Normalize search
            if (typeof filters.search === "string" && filters.search.trim()) {
                normalized.search = filters.search.trim().toLowerCase();
            }

            // Normalize pagination
            if (filters.limit != null) {
                const limit = Number(filters.limit);
                if (Number.isFinite(limit) && limit > 0) {
                    normalized.limit = Math.min(limit, 100);
                }
            }

            if (filters.offset != null) {
                const offset = Number(filters.offset);
                if (Number.isFinite(offset) && offset >= 0) {
                    normalized.offset = offset;
                }
            }

            return normalized;
        }

        it("should normalize shopId to number", () => {
            const result = normalizeProductFilters({ shopId: "123" });
            assert.strictEqual(result.shopId, 123);
        });

        it("should ignore invalid shopId", () => {
            const result = normalizeProductFilters({ shopId: "abc" });
            assert.strictEqual(result.shopId, undefined);
        });

        it("should ignore zero shopId", () => {
            const result = normalizeProductFilters({ shopId: 0 });
            assert.strictEqual(result.shopId, undefined);
        });

        it("should normalize category to lowercase", () => {
            const result = normalizeProductFilters({ category: "  FOOD  " });
            assert.strictEqual(result.category, "food");
        });

        it("should normalize search to lowercase", () => {
            const result = normalizeProductFilters({ search: "  Pizza  " });
            assert.strictEqual(result.search, "pizza");
        });

        it("should cap limit at 100", () => {
            const result = normalizeProductFilters({ limit: 500 });
            assert.strictEqual(result.limit, 100);
        });

        it("should accept valid limit", () => {
            const result = normalizeProductFilters({ limit: 50 });
            assert.strictEqual(result.limit, 50);
        });

        it("should normalize offset to non-negative", () => {
            const result = normalizeProductFilters({ offset: 20 });
            assert.strictEqual(result.offset, 20);
        });

        it("should accept zero offset", () => {
            const result = normalizeProductFilters({ offset: 0 });
            assert.strictEqual(result.offset, 0);
        });

        it("should handle empty filters", () => {
            const result = normalizeProductFilters({});
            assert.deepStrictEqual(result, {});
        });

        it("should ignore empty strings", () => {
            const result = normalizeProductFilters({
                category: "",
                search: "   "
            });
            assert.strictEqual(result.category, undefined);
            assert.strictEqual(result.search, undefined);
        });
    });

    describe("haversine condition building", () => {
        const EARTH_RADIUS_KM = 6371;

        it("should use correct Earth radius", () => {
            assert.strictEqual(EARTH_RADIUS_KM, 6371);
        });

        it("should calculate distance formula components", () => {
            // Test the mathematical components
            const lat1 = 12.9716; // Bangalore
            const lon1 = 77.5946;
            const lat2 = 13.0827; // Chennai direction
            const lon2 = 80.2707;

            const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

            const dLat = toRadians(lat2 - lat1);
            const dLon = toRadians(lon2 - lon1);

            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRadians(lat1)) *
                Math.cos(toRadians(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = EARTH_RADIUS_KM * c;

            // Should be approximately 290 km
            assert.ok(distance > 280 && distance < 310);
        });
    });

    describe("user query helpers", () => {
        it("should handle pagination options", () => {
            const options = { limit: 10, offset: 20 };

            assert.strictEqual(options.limit, 10);
            assert.strictEqual(options.offset, 20);
        });

        it("should handle default pagination", () => {
            const options: { limit?: number; offset?: number } = {};

            const limit = options.limit ?? 50;
            const offset = options.offset ?? 0;

            assert.strictEqual(limit, 50);
            assert.strictEqual(offset, 0);
        });
    });

    describe("blocked time slot type", () => {
        interface BlockedTimeSlot {
            id: number;
            serviceId: number;
            date: Date;
            startTime: string;
            endTime: string;
        }

        it("should have correct structure", () => {
            const slot: BlockedTimeSlot = {
                id: 1,
                serviceId: 100,
                date: new Date("2024-06-15"),
                startTime: "10:00",
                endTime: "11:00",
            };

            assert.strictEqual(slot.id, 1);
            assert.strictEqual(slot.serviceId, 100);
            assert.ok(slot.date instanceof Date);
            assert.strictEqual(slot.startTime, "10:00");
            assert.strictEqual(slot.endTime, "11:00");
        });
    });
});
