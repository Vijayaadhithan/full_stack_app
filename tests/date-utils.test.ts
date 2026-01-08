/**
 * Tests for shared/date-utils.ts
 * IST (Indian Standard Time) handling functions
 */
import { describe, it } from "node:test";
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

        it("should handle end of day UTC", () => {
            const result = toIndianTime(new Date("2024-06-15T23:59:59Z"));
            assert.ok(result instanceof Date);
            // 23:59 UTC should be 05:29 next day IST
            assert.strictEqual(result.getDate(), 16);
        });

        it("should handle DST-unaffected timezone", () => {
            // India doesn't observe DST
            const winter = toIndianTime(new Date("2024-01-15T12:00:00Z"));
            const summer = toIndianTime(new Date("2024-07-15T12:00:00Z"));

            // Both should be at 17:30 IST
            assert.strictEqual(winter.getHours(), 17);
            assert.strictEqual(winter.getMinutes(), 30);
            assert.strictEqual(summer.getHours(), 17);
            assert.strictEqual(summer.getMinutes(), 30);
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

        it("should format with various format strings", () => {
            const date = new Date("2024-06-15T10:30:00Z");

            // Test different format strings
            const formats = [
                "yyyy-MM-dd",
                "HH:mm:ss",
                "dd/MM/yyyy",
                "EEEE, MMMM dd, yyyy",
            ];

            formats.forEach(fmt => {
                const result = formatInIndianTime(date, fmt);
                assert.ok(typeof result === "string");
                assert.ok(result !== "Invalid Date");
            });
        });

        it("should format month names correctly", () => {
            const result = formatInIndianTime(new Date("2024-06-15T10:30:00Z"), "MMMM");
            assert.strictEqual(result, "June");
        });

        it("should format day names correctly", () => {
            const result = formatInIndianTime(new Date("2024-06-15T10:30:00Z"), "EEEE");
            assert.ok(result === "Saturday");
        });

        it("should handle leap year dates", () => {
            const result = formatInIndianTime(new Date("2024-02-29T10:00:00Z"), "yyyy-MM-dd");
            assert.strictEqual(result, "2024-02-29");
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

        it("should include timezone offset", () => {
            const result = toIndianISOString(new Date("2024-06-15T00:00:00Z"));
            assert.ok(result.includes("+05:30"));
        });

        it("should format with milliseconds", () => {
            const result = toIndianISOString(new Date("2024-06-15T10:30:45.123Z"));
            assert.ok(result.includes("."));
        });

        it("should handle date object input", () => {
            const date = new Date();
            const result = toIndianISOString(date);
            assert.ok(typeof result === "string");
            assert.ok(result.includes("+05:30"));
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

        it("should handle string dates with date format", () => {
            const result = formatIndianDisplay("2024-06-15T10:30:00Z", "date");
            assert.ok(result.includes("15"));
            assert.ok(result.includes("June"));
        });

        it("should handle string dates with time format", () => {
            const result = formatIndianDisplay("2024-06-15T10:30:00Z", "time");
            assert.ok(result.includes("PM") || result.includes("AM"));
        });

        it("should handle string dates with datetime format", () => {
            const result = formatIndianDisplay("2024-06-15T10:30:00Z", "datetime");
            assert.ok(result.includes("June") || result.includes("2024"));
        });

        // Negative cases
        it("should return 'N/A' for undefined input", () => {
            const result = formatIndianDisplay(undefined as unknown as string);
            assert.strictEqual(result, "N/A");
        });

        it("should return 'N/A' for null input", () => {
            const result = formatIndianDisplay(null as unknown as string);
            assert.strictEqual(result, "N/A");
        });

        it("should return 'N/A' for empty string input", () => {
            const result = formatIndianDisplay("" as unknown as string);
            assert.strictEqual(result, "N/A");
        });

        it("should handle invalid date gracefully", () => {
            const result = formatIndianDisplay("invalid-date");
            assert.ok(result === "Invalid Date" || result === "Date Error");
        });
    });
});
