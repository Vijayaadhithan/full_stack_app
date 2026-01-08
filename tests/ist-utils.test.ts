/**
 * Tests for server/ist-utils.ts
 * Server-side IST date utility functions
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    toUTCForStorage,
    getCurrentISTDate,
    fromDatabaseToIST,
    getExpirationDate,
    getISTDayBoundsUtc,
    convertArrayDatesToIST,
} from "../server/ist-utils.js";

describe("ist-utils", () => {
    describe("toUTCForStorage", () => {
        it("should convert Date to Date", () => {
            const date = new Date("2024-06-15T10:30:00Z");
            const result = toUTCForStorage(date);

            assert.ok(result instanceof Date);
            assert.strictEqual(result?.getTime(), date.getTime());
        });

        it("should parse string to Date", () => {
            const dateStr = "2024-06-15T10:30:00Z";
            const result = toUTCForStorage(dateStr);

            assert.ok(result instanceof Date);
            // Compare timestamps instead of ISO strings (handles .000Z vs Z)
            assert.strictEqual(result?.getTime(), new Date(dateStr).getTime());
        });

        it("should return null for null input", () => {
            const result = toUTCForStorage(null);
            assert.strictEqual(result, null);
        });

        it("should return null for undefined input", () => {
            const result = toUTCForStorage(undefined);
            assert.strictEqual(result, null);
        });

        it("should handle ISO date string", () => {
            const result = toUTCForStorage("2024-06-15");
            assert.ok(result instanceof Date);
        });

        it("should handle datetime with timezone", () => {
            const result = toUTCForStorage("2024-06-15T16:00:00+05:30");
            assert.ok(result instanceof Date);
            // Should convert to UTC internally
            assert.strictEqual(result?.getUTCHours(), 10);
            assert.strictEqual(result?.getUTCMinutes(), 30);
        });
    });

    describe("getCurrentISTDate", () => {
        it("should return a Date object", () => {
            const result = getCurrentISTDate();
            assert.ok(result instanceof Date);
        });

        it("should return current time (approximately)", () => {
            const before = Date.now();
            const result = getCurrentISTDate();
            const after = Date.now();

            // The result timestamp should be within 1 hour of current (accounting for IST offset)
            const diff = Math.abs(result.getTime() - before);
            assert.ok(diff < 24 * 60 * 60 * 1000); // Within 24 hours
        });
    });

    describe("fromDatabaseToIST", () => {
        it("should convert Date to IST", () => {
            const date = new Date("2024-06-15T00:00:00Z"); // Midnight UTC
            const result = fromDatabaseToIST(date);

            assert.ok(result instanceof Date);
        });

        it("should convert string to IST", () => {
            const dateStr = "2024-06-15T00:00:00Z";
            const result = fromDatabaseToIST(dateStr);

            assert.ok(result instanceof Date);
        });

        it("should return null for null input", () => {
            const result = fromDatabaseToIST(null);
            assert.strictEqual(result, null);
        });

        it("should return null for undefined input", () => {
            const result = fromDatabaseToIST(undefined);
            assert.strictEqual(result, null);
        });

        it("should handle various date formats", () => {
            const dates = [
                new Date(),
                "2024-01-01",
                "2024-06-15T10:30:00.000Z",
            ];

            dates.forEach(date => {
                const result = fromDatabaseToIST(date);
                assert.ok(result instanceof Date);
            });
        });
    });

    describe("getExpirationDate", () => {
        it("should return Date object", () => {
            const result = getExpirationDate(24);
            assert.ok(result instanceof Date);
        });

        it("should be in the future for positive hours", () => {
            const now = new Date();
            const result = getExpirationDate(1);

            assert.ok(result > now);
        });

        it("should be approximately hours from now", () => {
            const now = new Date();
            const hours = 24;
            const result = getExpirationDate(hours);

            const expectedMs = hours * 60 * 60 * 1000;
            const actualDiff = result.getTime() - now.getTime();

            // Should be within 1 second of expected
            assert.ok(Math.abs(actualDiff - expectedMs) < 1000);
        });

        it("should handle 0 hours", () => {
            const now = new Date();
            const result = getExpirationDate(0);

            // Should be very close to now
            const diff = Math.abs(result.getTime() - now.getTime());
            assert.ok(diff < 1000);
        });

        it("should handle large hours", () => {
            const result = getExpirationDate(24 * 365); // 1 year
            const now = new Date();

            assert.ok(result > now);
        });
    });

    describe("getISTDayBoundsUtc", () => {
        it("should return start and end dates", () => {
            const date = new Date("2024-06-15T10:30:00Z");
            const result = getISTDayBoundsUtc(date);

            assert.ok(result.start instanceof Date);
            assert.ok(result.end instanceof Date);
        });

        it("should have end after start", () => {
            const date = new Date("2024-06-15T10:30:00Z");
            const result = getISTDayBoundsUtc(date);

            assert.ok(result.end > result.start);
        });

        it("should span approximately 24 hours", () => {
            const date = new Date("2024-06-15T10:30:00Z");
            const result = getISTDayBoundsUtc(date);

            const diff = result.end.getTime() - result.start.getTime();
            const hours = diff / (1000 * 60 * 60);

            assert.strictEqual(hours, 24);
        });

        it("should handle midnight UTC", () => {
            const date = new Date("2024-06-15T00:00:00Z");
            const result = getISTDayBoundsUtc(date);

            assert.ok(result.start instanceof Date);
            assert.ok(result.end instanceof Date);
        });

        it("should handle end of day UTC", () => {
            const date = new Date("2024-06-15T23:59:59Z");
            const result = getISTDayBoundsUtc(date);

            assert.ok(result.start instanceof Date);
            assert.ok(result.end instanceof Date);
        });
    });

    describe("convertArrayDatesToIST", () => {
        it("should convert date fields to IST", () => {
            const items = [
                { id: 1, createdAt: new Date("2024-06-15T00:00:00Z"), name: "Test" },
            ];

            const result = convertArrayDatesToIST(items, ["createdAt"]);

            assert.strictEqual(result.length, 1);
            assert.ok(result[0].createdAt instanceof Date);
        });

        it("should preserve non-date fields", () => {
            const items = [
                { id: 1, createdAt: new Date(), name: "Test", count: 42 },
            ];

            const result = convertArrayDatesToIST(items, ["createdAt"]);

            assert.strictEqual(result[0].id, 1);
            assert.strictEqual(result[0].name, "Test");
            assert.strictEqual(result[0].count, 42);
        });

        it("should handle multiple date fields", () => {
            const items = [
                {
                    id: 1,
                    createdAt: new Date("2024-06-15T00:00:00Z"),
                    updatedAt: new Date("2024-06-16T00:00:00Z"),
                },
            ];

            const result = convertArrayDatesToIST(items, ["createdAt", "updatedAt"]);

            assert.ok(result[0].createdAt instanceof Date);
            assert.ok(result[0].updatedAt instanceof Date);
        });

        it("should handle empty array", () => {
            const result = convertArrayDatesToIST([], ["createdAt"]);
            assert.deepStrictEqual(result, []);
        });

        it("should handle string dates", () => {
            const items = [
                { id: 1, createdAt: "2024-06-15T00:00:00Z" as unknown as Date },
            ];

            const result = convertArrayDatesToIST(items, ["createdAt"]);
            assert.ok(result[0].createdAt instanceof Date);
        });

        it("should not modify original array", () => {
            const original = [
                { id: 1, createdAt: new Date("2024-06-15T00:00:00Z") },
            ];
            const originalTime = original[0].createdAt.getTime();

            convertArrayDatesToIST(original, ["createdAt"]);

            // Original should be unchanged
            assert.strictEqual(original[0].createdAt.getTime(), originalTime);
        });

        it("should handle multiple items", () => {
            const items = [
                { id: 1, createdAt: new Date("2024-06-15T00:00:00Z") },
                { id: 2, createdAt: new Date("2024-06-16T00:00:00Z") },
                { id: 3, createdAt: new Date("2024-06-17T00:00:00Z") },
            ];

            const result = convertArrayDatesToIST(items, ["createdAt"]);

            assert.strictEqual(result.length, 3);
            result.forEach(item => {
                assert.ok(item.createdAt instanceof Date);
            });
        });
    });
});
