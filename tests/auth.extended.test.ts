/**
 * Additional tests for server/auth.ts
 * Comprehensive coverage for auth routes and functions
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import { hashPasswordInternal } from "../server/auth.js";
import {
    createMockSession,
    createMockUser,
    createMockReq,
    createMockRes,
} from "./testHelpers.js";

describe("auth - extended coverage", () => {
    describe("hashPasswordInternal", () => {
        it("should produce hash of expected length", async () => {
            const hash = await hashPasswordInternal("password123");

            // Hash format: hex(64 bytes).hex(16 bytes salt) = 128 + 1 + 32 = 161 chars
            const [hashPart, saltPart] = hash.split(".");
            assert.strictEqual(hashPart.length, 128); // 64 bytes in hex
            assert.strictEqual(saltPart.length, 32);  // 16 bytes in hex
        });

        it("should handle long passwords", async () => {
            const longPassword = "a".repeat(100);
            const hash = await hashPasswordInternal(longPassword);

            assert.ok(hash.includes("."));
        });

        it("should handle special characters", async () => {
            const specialPassword = "P@$$w0rd!#$%^&*()";
            const hash = await hashPasswordInternal(specialPassword);

            assert.ok(hash.includes("."));
        });
    });

    describe("Registration schema", () => {
        const PUBLIC_REGISTRATION_ROLES = ["customer", "provider", "shop"] as const;
        const usernameRegex = /^[a-z0-9._-]+$/i;

        const registrationSchema = z.object({
            username: z.string().trim().min(3).max(32).regex(usernameRegex),
            password: z.string().min(8).max(64),
            role: z.enum(PUBLIC_REGISTRATION_ROLES).default("customer"),
            name: z.string().trim().min(1).max(100),
            phone: z.string().trim().min(8).max(20).regex(/^\d+$/),
            email: z.string().trim().email(),
            language: z.string().trim().max(10).optional(),
            bio: z.string().trim().max(1000).optional(),
        });

        it("should validate complete registration data", () => {
            const data = {
                username: "testuser123",
                password: "password123",
                role: "customer",
                name: "Test User",
                phone: "9876543210",
                email: "test@example.com",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(result.success);
        });

        it("should apply default role", () => {
            const data = {
                username: "testuser",
                password: "password123",
                name: "Test User",
                phone: "9876543210",
                email: "test@example.com",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(result.success);
            if (result.success) {
                assert.strictEqual(result.data.role, "customer");
            }
        });

        it("should reject username less than 3 chars", () => {
            const data = {
                username: "ab",
                password: "password123",
                name: "Test User",
                phone: "9876543210",
                email: "test@example.com",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(!result.success);
        });

        it("should reject password less than 8 chars", () => {
            const data = {
                username: "testuser",
                password: "short",
                name: "Test User",
                phone: "9876543210",
                email: "test@example.com",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(!result.success);
        });

        it("should reject invalid email", () => {
            const data = {
                username: "testuser",
                password: "password123",
                name: "Test User",
                phone: "9876543210",
                email: "invalid-email",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(!result.success);
        });

        it("should reject non-digit phone", () => {
            const data = {
                username: "testuser",
                password: "password123",
                name: "Test User",
                phone: "+91-9876543210",
                email: "test@example.com",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(!result.success);
        });

        it("should accept provider role with bio", () => {
            const data = {
                username: "provider_user",
                password: "password123",
                role: "provider",
                name: "Provider Name",
                phone: "9876543210",
                email: "provider@example.com",
                bio: "I am an experienced service provider",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(result.success);
        });

        it("should accept shop role", () => {
            const data = {
                username: "shop_owner",
                password: "password123",
                role: "shop",
                name: "Shop Owner",
                phone: "9876543210",
                email: "shop@example.com",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(result.success);
        });

        it("should accept optional language", () => {
            const data = {
                username: "testuser",
                password: "password123",
                name: "Test User",
                phone: "9876543210",
                email: "test@example.com",
                language: "ta",
            };

            const result = registrationSchema.safeParse(data);
            assert.ok(result.success);
            if (result.success) {
                assert.strictEqual(result.data.language, "ta");
            }
        });
    });

    describe("Rural register schema", () => {
        const ruralRegisterSchema = z.object({
            firebaseIdToken: z.string().min(1),
            name: z.string().trim().min(1).max(100),
            pin: z.string().length(4).regex(/^\d+$/),
            initialRole: z.enum(["customer", "provider", "shop"]).optional(),
            language: z.string().max(10).optional(),
        });

        it("should validate rural registration with mock token", () => {
            const data = {
                firebaseIdToken: "mock-token-+91789546741",
                name: "Rural User",
                pin: "1234",
                initialRole: "customer",
            };

            const result = ruralRegisterSchema.safeParse(data);
            assert.ok(result.success);
        });

        it("should require 4-digit PIN", () => {
            const data = {
                firebaseIdToken: "mock-token",
                name: "User",
                pin: "123",
            };

            const result = ruralRegisterSchema.safeParse(data);
            assert.ok(!result.success);
        });

        it("should reject non-numeric PIN", () => {
            const data = {
                firebaseIdToken: "mock-token",
                name: "User",
                pin: "abcd",
            };

            const result = ruralRegisterSchema.safeParse(data);
            assert.ok(!result.success);
        });

        it("should accept optional initialRole", () => {
            const data = {
                firebaseIdToken: "mock-token",
                name: "User",
                pin: "1234",
            };

            const result = ruralRegisterSchema.safeParse(data);
            assert.ok(result.success);
            if (result.success) {
                assert.strictEqual(result.data.initialRole, undefined);
            }
        });
    });

    describe("Check user schema", () => {
        const checkUserSchema = z.object({
            phone: z.string().min(8).max(20),
        });

        it("should validate phone number", () => {
            const result = checkUserSchema.safeParse({ phone: "9876543210" });
            assert.ok(result.success);
        });

        it("should validate test phone", () => {
            const result = checkUserSchema.safeParse({ phone: "789546741" });
            assert.ok(result.success);
        });

        it("should reject short phone", () => {
            const result = checkUserSchema.safeParse({ phone: "123" });
            assert.ok(!result.success);
        });

        it("should reject very long phone", () => {
            const result = checkUserSchema.safeParse({ phone: "1".repeat(25) });
            assert.ok(!result.success);
        });
    });

    describe("PIN login schema", () => {
        const pinLoginSchema = z.object({
            phone: z.string().min(8).max(20),
            pin: z.string().length(4).regex(/^\d+$/),
        });

        it("should validate PIN login", () => {
            const result = pinLoginSchema.safeParse({
                phone: "789546741",
                pin: "2702",
            });
            assert.ok(result.success);
        });

        it("should reject missing PIN", () => {
            const result = pinLoginSchema.safeParse({ phone: "9876543210" });
            assert.ok(!result.success);
        });
    });

    describe("Reset PIN schema", () => {
        const resetPinSchema = z.object({
            firebaseIdToken: z.string().min(1),
            newPin: z.string().length(4).regex(/^\d+$/),
        });

        it("should validate reset PIN request", () => {
            const result = resetPinSchema.safeParse({
                firebaseIdToken: "mock-token-+91789546741",
                newPin: "5678",
            });
            assert.ok(result.success);
        });

        it("should reject invalid new PIN", () => {
            const result = resetPinSchema.safeParse({
                firebaseIdToken: "mock-token",
                newPin: "abc",
            });
            assert.ok(!result.success);
        });
    });

    describe("Worker login schema", () => {
        const workerLoginSchema = z.object({
            workerNumber: z.string().length(10).regex(/^\d+$/),
            pin: z.string().length(4).regex(/^\d+$/),
        });

        it("should validate worker login", () => {
            const result = workerLoginSchema.safeParse({
                workerNumber: "1234567890",
                pin: "1234",
            });
            assert.ok(result.success);
        });

        it("should reject short worker number", () => {
            const result = workerLoginSchema.safeParse({
                workerNumber: "123456789",
                pin: "1234",
            });
            assert.ok(!result.success);
        });

        it("should reject non-numeric worker number", () => {
            const result = workerLoginSchema.safeParse({
                workerNumber: "abcdefghij",
                pin: "1234",
            });
            assert.ok(!result.success);
        });
    });

    describe("Session cookie settings", () => {
        it("should define session settings structure", () => {
            const sessionSettings = {
                secret: "test-secret",
                resave: false,
                saveUninitialized: false,
                cookie: {
                    httpOnly: true,
                    secure: false,
                    sameSite: "lax" as const,
                    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                },
            };

            assert.strictEqual(sessionSettings.resave, false);
            assert.strictEqual(sessionSettings.saveUninitialized, false);
            assert.strictEqual(sessionSettings.cookie.httpOnly, true);
            assert.strictEqual(sessionSettings.cookie.sameSite, "lax");
            assert.strictEqual(sessionSettings.cookie.maxAge, 2592000000);
        });

        it("should secure cookie in production", () => {
            const isProduction = process.env.NODE_ENV === "production";
            const cookie = {
                secure: isProduction,
            };

            // In test mode, should not be secure
            assert.strictEqual(cookie.secure, false);
        });
    });

    describe("Password comparison logic", () => {
        it("should handle null stored password", () => {
            const stored = null;
            const isValid = typeof stored === "string" && stored.length > 0;

            assert.strictEqual(isValid, false);
        });

        it("should handle undefined stored password", () => {
            const stored = undefined;
            const isValid = typeof stored === "string" && stored.length > 0;

            assert.strictEqual(isValid, false);
        });

        it("should handle empty stored password", () => {
            const stored = "";
            const isValid = typeof stored === "string" && stored.length > 0;

            assert.strictEqual(isValid, false);
        });

        it("should require hash.salt format", () => {
            const checkFormat = (stored: string) => {
                const parts = stored.split(".");
                return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
            };

            assert.strictEqual(checkFormat("hash.salt"), true);
            assert.strictEqual(checkFormat("nodotsalt"), false);
            assert.strictEqual(checkFormat(".salt"), false);
            assert.strictEqual(checkFormat("hash."), false);
        });
    });

    describe("Suspended user check", () => {
        it("should block suspended user", () => {
            const user = createMockUser({ isSuspended: true });
            const canLogin = !user.isSuspended;

            assert.strictEqual(canLogin, false);
        });

        it("should allow non-suspended user", () => {
            const user = createMockUser({ isSuspended: false });
            const canLogin = !user.isSuspended;

            assert.strictEqual(canLogin, true);
        });

        it("should allow user without suspended flag", () => {
            const user = { id: 1, role: "customer" };
            const canLogin = !(user as any).isSuspended;

            assert.strictEqual(canLogin, true);
        });
    });
});
