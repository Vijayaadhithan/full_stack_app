/**
 * Tests for server/utils/geo.ts
 * Geographic utility functions
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    normalizeCoordinate,
    toNumericCoordinate,
    haversineDistanceKm,
    DEFAULT_NEARBY_RADIUS_KM,
    MIN_NEARBY_RADIUS_KM,
    MAX_NEARBY_RADIUS_KM,
} from "../server/utils/geo.js";

describe("geo utilities", () => {
    describe("constants", () => {
        it("should export default nearby radius", () => {
            assert.strictEqual(DEFAULT_NEARBY_RADIUS_KM, 20);
        });

        it("should export min nearby radius", () => {
            assert.strictEqual(MIN_NEARBY_RADIUS_KM, 1);
        });

        it("should export max nearby radius", () => {
            assert.strictEqual(MAX_NEARBY_RADIUS_KM, 100);
        });
    });

    describe("normalizeCoordinate", () => {
        // Positive cases - numbers
        it("should format number to 7 decimal places", () => {
            assert.strictEqual(normalizeCoordinate(12.3456789), "12.3456789");
        });

        it("should pad short decimals", () => {
            assert.strictEqual(normalizeCoordinate(12.5), "12.5000000");
        });

        it("should handle integer", () => {
            assert.strictEqual(normalizeCoordinate(12), "12.0000000");
        });

        it("should handle negative coordinate", () => {
            assert.strictEqual(normalizeCoordinate(-77.0364), "-77.0364000");
        });

        it("should handle zero", () => {
            assert.strictEqual(normalizeCoordinate(0), "0.0000000");
        });

        // Positive cases - strings
        it("should parse string to coordinate", () => {
            assert.strictEqual(normalizeCoordinate("12.3456789"), "12.3456789");
        });

        it("should trim string coordinate", () => {
            assert.strictEqual(normalizeCoordinate("  12.345  "), "12.3450000");
        });

        it("should handle string negative", () => {
            assert.strictEqual(normalizeCoordinate("-77.0364"), "-77.0364000");
        });

        // Negative cases
        it("should return null for null", () => {
            assert.strictEqual(normalizeCoordinate(null), null);
        });

        it("should return null for undefined", () => {
            assert.strictEqual(normalizeCoordinate(undefined), null);
        });

        it("should return null for Infinity", () => {
            assert.strictEqual(normalizeCoordinate(Infinity), null);
        });

        it("should return null for NaN", () => {
            assert.strictEqual(normalizeCoordinate(NaN), null);
        });

        it("should return null for empty string", () => {
            assert.strictEqual(normalizeCoordinate(""), null);
        });

        it("should return null for whitespace only", () => {
            assert.strictEqual(normalizeCoordinate("   "), null);
        });

        it("should return null for non-numeric string", () => {
            assert.strictEqual(normalizeCoordinate("abc"), null);
        });
    });

    describe("toNumericCoordinate", () => {
        // Positive cases
        it("should return number as-is", () => {
            assert.strictEqual(toNumericCoordinate(12.345), 12.345);
        });

        it("should parse string to number", () => {
            assert.strictEqual(toNumericCoordinate("12.345"), 12.345);
        });

        it("should handle negative number", () => {
            assert.strictEqual(toNumericCoordinate(-77.0364), -77.0364);
        });

        it("should handle negative string", () => {
            assert.strictEqual(toNumericCoordinate("-77.0364"), -77.0364);
        });

        it("should handle zero", () => {
            assert.strictEqual(toNumericCoordinate(0), 0);
        });

        it("should handle string zero", () => {
            assert.strictEqual(toNumericCoordinate("0"), 0);
        });

        // Negative cases
        it("should return null for null", () => {
            assert.strictEqual(toNumericCoordinate(null), null);
        });

        it("should return null for undefined", () => {
            assert.strictEqual(toNumericCoordinate(undefined), null);
        });

        it("should return null for Infinity", () => {
            assert.strictEqual(toNumericCoordinate(Infinity), null);
        });

        it("should return null for NaN", () => {
            assert.strictEqual(toNumericCoordinate(NaN), null);
        });

        it("should return null for non-numeric string", () => {
            assert.strictEqual(toNumericCoordinate("abc"), null);
        });
    });

    describe("haversineDistanceKm", () => {
        // Positive cases
        it("should calculate distance between same point as 0", () => {
            const distance = haversineDistanceKm(12.9716, 77.5946, 12.9716, 77.5946);
            assert.strictEqual(distance, 0);
        });

        it("should calculate distance between Bangalore and Chennai (~290 km)", () => {
            // Bangalore: 12.9716, 77.5946
            // Chennai: 13.0827, 80.2707
            const distance = haversineDistanceKm(12.9716, 77.5946, 13.0827, 80.2707);
            assert.ok(distance > 280 && distance < 310, `Expected ~290km, got ${distance}`);
        });

        it("should calculate distance between New York and Los Angeles (~3940 km)", () => {
            // NYC: 40.7128, -74.0060
            // LA: 34.0522, -118.2437
            const distance = haversineDistanceKm(40.7128, -74.0060, 34.0522, -118.2437);
            assert.ok(distance > 3900 && distance < 4000, `Expected ~3940km, got ${distance}`);
        });

        it("should be symmetric (A to B equals B to A)", () => {
            const d1 = haversineDistanceKm(12.9716, 77.5946, 13.0827, 80.2707);
            const d2 = haversineDistanceKm(13.0827, 80.2707, 12.9716, 77.5946);
            assert.strictEqual(d1, d2);
        });

        it("should calculate short distance (~1 km)", () => {
            // Points ~1km apart
            const distance = haversineDistanceKm(12.9716, 77.5946, 12.9806, 77.5946);
            assert.ok(distance > 0.9 && distance < 1.1, `Expected ~1km, got ${distance}`);
        });

        it("should handle coordinates crossing equator", () => {
            const distance = haversineDistanceKm(1, 0, -1, 0);
            assert.ok(distance > 220 && distance < 225, `Expected ~222km, got ${distance}`);
        });

        it("should handle coordinates crossing prime meridian", () => {
            const distance = haversineDistanceKm(0, 1, 0, -1);
            assert.ok(distance > 220 && distance < 225, `Expected ~222km, got ${distance}`);
        });
    });
});
