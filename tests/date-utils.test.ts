/**
 * Tests for shared/date-utils.ts
 * IST (Indian Standard Time) handling functions
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
    toIndianTime,
    fromIndianTime,
    formatInIndianTime,
    newIndianDate,
    toIndianISOString,
    formatIndianDisplay,
} from "../shared/date-utils.js";

describe("date-utils", () => {
    describe("toIndianTime", () => {
        // Positive cases
        it("should convert Date object to IST", () => {
            const utcDate = new Date("2024-01-15T00:00:00.000Z");
            const istDate = toIndianTime(utcDate);
            // IST is UTC+5:30, so midnight UTC should be 5:30 AM IST
            assert.strictEqual(istDate.getHours(), 5);
            assert.strictEqual(istDate.getMinutes(), 30);
        });

        it("should convert ISO string to IST", () => {
            const istDate = toIndianTime("2024-01-15T00:00:00.000Z");
            assert.strictEqual(istDate.getHours(), 5);
            assert.strictEqual(istDate.getMinutes(), 30);
        });

        it("should handle date without timezone", () => {
            const istDate = toIndianTime("2024-06-15T12:00:00");
            assert.ok(istDate instanceof Date);
        });

        // Negative cases
        it("should handle invalid date string gracefully", () => {
            const result = toIndianTime("invalid-date");
            assert.ok(result instanceof Date);
            assert.ok(isNaN(result.getTime())); // Should be Invalid Date
        });
    });

    describe("fromIndianTime", () => {
        // Positive cases
        it("should convert IST date back to UTC", () => {
            const utcDate = new Date("2024-01-15T00:00:00.000Z");
            const istDate = toIndianTime(utcDate);
            const backToUtc = fromIndianTime(istDate);

            // Should get back same UTC time
            assert.strictEqual(backToUtc.getUTCHours(), utcDate.getUTCHours());
        });

        it("should handle IST adjusted dates", () => {
            const istDate = toIndianTime(new Date());
            istDate.setHours(10, 0, 0, 0);
            const utc = fromIndianTime(istDate);
            assert.ok(utc instanceof Date);
        });
    });

    describe("formatInIndianTime", () => {
        // Positive cases
        it("should format date with standard format", () => {
            const formatted = formatInIndianTime(
                new Date("2024-01-15T00:00:00.000Z"),
                "yyyy-MM-dd"
            );
            assert.strictEqual(formatted, "2024-01-15");
        });

        it("should format with time", () => {
            const formatted = formatInIndianTime(
                new Date("2024-01-15T00:00:00.000Z"),
                "yyyy-MM-dd HH:mm:ss"
            );
            assert.strictEqual(formatted, "2024-01-15 05:30:00");
        });

        it("should handle date strings", () => {
            const formatted = formatInIndianTime("2024-06-15T12:00:00.000Z", "yyyy-MM-dd");
            assert.strictEqual(formatted, "2024-06-15");
        });

        // Negative cases
        it("should return 'Invalid Date' for invalid input", () => {
            const formatted = formatInIndianTime("not-a-date", "yyyy-MM-dd");
            assert.strictEqual(formatted, "Invalid Date");
        });
    });

    describe("newIndianDate", () => {
        // Positive cases
        it("should return current date in IST", () => {
            const now = newIndianDate();
            assert.ok(now instanceof Date);
        });

        it("should return a valid date", () => {
            const now = newIndianDate();
            assert.ok(!isNaN(now.getTime()));
        });
    });

    describe("toIndianISOString", () => {
        // Positive cases
        it("should convert to ISO string with IST offset", () => {
            const result = toIndianISOString(new Date("2024-01-15T00:00:00.000Z"));
            assert.ok(result.includes("+05:30"));
        });

        it("should handle date strings", () => {
            const result = toIndianISOString("2024-01-15T00:00:00.000Z");
            assert.ok(typeof result === "string");
            assert.ok(result.includes("2024-01-15"));
        });
    });

    describe("formatIndianDisplay", () => {
        // Positive cases
        it("should format as date only", () => {
            const result = formatIndianDisplay(
                new Date("2024-01-15T00:00:00.000Z"),
                "date"
            );
            assert.ok(result.includes("15"));
            assert.ok(result.includes("January") || result.includes("2024"));
        });

        it("should format as time only", () => {
            const result = formatIndianDisplay(
                new Date("2024-01-15T00:00:00.000Z"),
                "time"
            );
            assert.ok(result.includes("AM") || result.includes("PM"));
        });

        it("should format as datetime by default", () => {
            const result = formatIndianDisplay(new Date("2024-01-15T00:00:00.000Z"));
            assert.ok(result.includes("15"));
            assert.ok(result.includes("AM") || result.includes("PM"));
        });

        // Negative cases
        it("should return 'N/A' for undefined input", () => {
            const result = formatIndianDisplay(undefined as any);
            assert.strictEqual(result, "N/A");
        });

        it("should return 'N/A' for null input", () => {
            const result = formatIndianDisplay(null as any);
            assert.strictEqual(result, "N/A");
        });

        it("should handle invalid date gracefully", () => {
            const result = formatIndianDisplay("invalid-date");
            assert.ok(result === "Invalid Date" || result === "Date Error");
        });
    });
});
