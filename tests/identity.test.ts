/**
 * Tests for server/utils/identity.ts
 * Username, email, and phone normalization utilities
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    normalizeUsername,
    normalizeEmail,
    normalizePhone,
    normalizeOptionalString,
} from "../server/utils/identity.js";

describe("identity utilities", () => {
    describe("normalizeUsername", () => {
        // Positive cases
        it("should lowercase username", () => {
            assert.strictEqual(normalizeUsername("TestUser"), "testuser");
        });

        it("should trim whitespace", () => {
            assert.strictEqual(normalizeUsername("  username  "), "username");
        });

        it("should handle already lowercase", () => {
            assert.strictEqual(normalizeUsername("myuser"), "myuser");
        });

        it("should handle mixed case with numbers", () => {
            assert.strictEqual(normalizeUsername("User123"), "user123");
        });

        // Negative cases
        it("should return null for empty string", () => {
            assert.strictEqual(normalizeUsername(""), null);
        });

        it("should return null for whitespace only", () => {
            assert.strictEqual(normalizeUsername("   "), null);
        });

        it("should return null for null", () => {
            assert.strictEqual(normalizeUsername(null), null);
        });

        it("should return null for undefined", () => {
            assert.strictEqual(normalizeUsername(undefined), null);
        });

        it("should return null for number", () => {
            assert.strictEqual(normalizeUsername(123 as unknown as string), null);
        });

        it("should return null for object", () => {
            assert.strictEqual(normalizeUsername({} as unknown as string), null);
        });
    });

    describe("normalizeEmail", () => {
        // Positive cases
        it("should lowercase email", () => {
            assert.strictEqual(normalizeEmail("Test@Example.COM"), "test@example.com");
        });

        it("should trim whitespace", () => {
            assert.strictEqual(normalizeEmail("  test@example.com  "), "test@example.com");
        });

        it("should handle already lowercase", () => {
            assert.strictEqual(normalizeEmail("user@domain.com"), "user@domain.com");
        });

        it("should handle email with subdomain", () => {
            assert.strictEqual(normalizeEmail("User@Mail.Sub.Domain.COM"), "user@mail.sub.domain.com");
        });

        // Negative cases
        it("should return null for empty string", () => {
            assert.strictEqual(normalizeEmail(""), null);
        });

        it("should return null for whitespace only", () => {
            assert.strictEqual(normalizeEmail("   "), null);
        });

        it("should return null for null", () => {
            assert.strictEqual(normalizeEmail(null), null);
        });

        it("should return null for undefined", () => {
            assert.strictEqual(normalizeEmail(undefined), null);
        });

        it("should return null for non-string", () => {
            assert.strictEqual(normalizeEmail(123 as unknown as string), null);
        });
    });

    describe("normalizePhone", () => {
        // Positive cases
        it("should extract digits from phone with country code", () => {
            assert.strictEqual(normalizePhone("+91 9876543210"), "919876543210");
        });

        it("should extract digits from phone with dashes", () => {
            assert.strictEqual(normalizePhone("987-654-3210"), "9876543210");
        });

        it("should extract digits from phone with spaces", () => {
            assert.strictEqual(normalizePhone("98 76 54 32 10"), "9876543210");
        });

        it("should handle plain digits", () => {
            assert.strictEqual(normalizePhone("9876543210"), "9876543210");
        });

        it("should handle phone with parentheses", () => {
            assert.strictEqual(normalizePhone("(987) 654-3210"), "9876543210");
        });

        it("should handle numeric input", () => {
            assert.strictEqual(normalizePhone(9876543210), "9876543210");
        });

        it("should truncate decimal from number", () => {
            assert.strictEqual(normalizePhone(9876543210.5), "9876543210");
        });

        it("should handle test phone number", () => {
            assert.strictEqual(normalizePhone("789546741"), "789546741");
        });

        // Negative cases
        it("should return null for empty string", () => {
            assert.strictEqual(normalizePhone(""), null);
        });

        it("should return null for non-digit string", () => {
            assert.strictEqual(normalizePhone("abcdefg"), null);
        });

        it("should return null for null", () => {
            assert.strictEqual(normalizePhone(null), null);
        });

        it("should return null for undefined", () => {
            assert.strictEqual(normalizePhone(undefined), null);
        });

        it("should return null for object", () => {
            assert.strictEqual(normalizePhone({} as unknown as string), null);
        });

        it("should return null for Infinity", () => {
            assert.strictEqual(normalizePhone(Infinity), null);
        });

        it("should return null for NaN", () => {
            assert.strictEqual(normalizePhone(NaN), null);
        });
    });

    describe("normalizeOptionalString", () => {
        // Positive cases
        it("should trim whitespace", () => {
            assert.strictEqual(normalizeOptionalString("  hello  "), "hello");
        });

        it("should preserve case", () => {
            assert.strictEqual(normalizeOptionalString("Hello World"), "Hello World");
        });

        it("should handle plain string", () => {
            assert.strictEqual(normalizeOptionalString("test"), "test");
        });

        // Negative cases
        it("should return null for empty string", () => {
            assert.strictEqual(normalizeOptionalString(""), null);
        });

        it("should return null for whitespace only", () => {
            assert.strictEqual(normalizeOptionalString("   "), null);
        });

        it("should return null for null", () => {
            assert.strictEqual(normalizeOptionalString(null), null);
        });

        it("should return null for undefined", () => {
            assert.strictEqual(normalizeOptionalString(undefined), null);
        });

        it("should return null for number", () => {
            assert.strictEqual(normalizeOptionalString(123 as unknown as string), null);
        });
    });
});
