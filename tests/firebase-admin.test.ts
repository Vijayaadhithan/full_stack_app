/**
 * Tests for server/services/firebase-admin.ts
 * Firebase Admin SDK and phone verification
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
    isFirebaseAdminAvailable,
    normalizeFirebasePhone,
    verifyAndExtractPhone,
} from "../server/services/firebase-admin.js";

describe("firebase-admin", () => {
    describe("isFirebaseAdminAvailable", () => {
        it("should return boolean", () => {
            const result = isFirebaseAdminAvailable();
            assert.strictEqual(typeof result, "boolean");
        });
    });

    describe("normalizeFirebasePhone", () => {
        // Positive cases - Indian numbers
        it("should remove +91 country code", () => {
            assert.strictEqual(normalizeFirebasePhone("+919876543210"), "9876543210");
        });

        it("should handle test phone number", () => {
            assert.strictEqual(normalizeFirebasePhone("+91789546741"), "789546741");
        });

        // Positive cases - other formats
        it("should handle other country codes by taking last 10 digits", () => {
            assert.strictEqual(normalizeFirebasePhone("+14155551234"), "4155551234");
        });

        it("should handle phone without + prefix", () => {
            assert.strictEqual(normalizeFirebasePhone("9876543210"), "9876543210");
        });

        it("should extract last 10 digits for long numbers", () => {
            assert.strictEqual(normalizeFirebasePhone("+44207946123456"), "7946123456");
        });

        // Edge cases
        it("should handle exactly 10 digit number with +", () => {
            assert.strictEqual(normalizeFirebasePhone("+1234567890"), "1234567890");
        });

        it("should return as-is if less than 10 digits", () => {
            assert.strictEqual(normalizeFirebasePhone("+123"), "+123");
        });
    });

    describe("verifyAndExtractPhone - mock tokens", () => {
        // This tests the development/test mock token functionality
        it("should accept mock token in test environment", async () => {
            const result = await verifyAndExtractPhone("mock-token-+91789546741");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.phone, "789546741");
            assert.strictEqual(result.error, undefined);
        });

        it("should normalize phone from mock token", async () => {
            const result = await verifyAndExtractPhone("mock-token-+919876543210");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.phone, "9876543210");
        });

        it("should handle mock token with direct phone", async () => {
            const result = await verifyAndExtractPhone("mock-token-9876543210");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.phone, "9876543210");
        });

        it("should handle mock token with international format", async () => {
            const result = await verifyAndExtractPhone("mock-token-+14155551234");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.phone, "4155551234");
        });
    });

    describe("verifyAndExtractPhone - invalid tokens", () => {
        it("should fail for non-mock token when Firebase not initialized", async () => {
            // If Firebase is not initialized, non-mock tokens should fail
            if (!isFirebaseAdminAvailable()) {
                const result = await verifyAndExtractPhone("invalid-token");

                assert.strictEqual(result.success, false);
                assert.ok(result.error);
            }
        });

        it("should fail for empty token when Firebase not available", async () => {
            if (!isFirebaseAdminAvailable()) {
                const result = await verifyAndExtractPhone("");

                assert.strictEqual(result.success, false);
                assert.ok(result.error);
            }
        });
    });
});
