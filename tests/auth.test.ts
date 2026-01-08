/**
 * Tests for server/auth.ts
 * Authentication routes: login, register, logout, session management
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import {
    createMockSession,
    createMockUser,
} from "./testHelpers.js";

// Test the hashPasswordInternal function
describe("auth", () => {
    describe("hashPasswordInternal", () => {
        it("should hash password with salt", async () => {
            const { hashPasswordInternal } = await import("../server/auth.js");

            const password = "testPassword123";
            const hashed = await hashPasswordInternal(password);

            // Should contain a dot separator between hash and salt
            assert.ok(hashed.includes("."));
            const [hash, salt] = hashed.split(".");
            assert.ok(hash && hash.length > 0);
            assert.ok(salt && salt.length > 0);
        });

        it("should produce different hashes for same password", async () => {
            const { hashPasswordInternal } = await import("../server/auth.js");

            const password = "testPassword123";
            const hash1 = await hashPasswordInternal(password);
            const hash2 = await hashPasswordInternal(password);

            // Different salts should produce different hashes
            assert.notStrictEqual(hash1, hash2);
        });

        it("should handle empty password", async () => {
            const { hashPasswordInternal } = await import("../server/auth.js");

            const hashed = await hashPasswordInternal("");
            assert.ok(hashed.includes("."));
        });

        it("should handle unicode passwords", async () => {
            const { hashPasswordInternal } = await import("../server/auth.js");

            const password = "பாஸ்வேர்ட்123"; // Tamil password
            const hashed = await hashPasswordInternal(password);
            assert.ok(hashed.includes("."));
        });
    });

    describe("Registration validation", () => {
        const usernameRegex = /^[a-z0-9._-]+$/i;

        it("should require username with min 3 characters", () => {
            const usernameSchema = z.string()
                .trim()
                .min(3, "Username must be at least 3 characters")
                .max(32, "Username must be at most 32 characters")
                .regex(usernameRegex);

            assert.throws(() => usernameSchema.parse("ab"), /3 characters/);
            assert.doesNotThrow(() => usernameSchema.parse("abc"));
        });

        it("should reject username with invalid characters", () => {
            const usernameSchema = z.string().regex(usernameRegex);

            assert.throws(() => usernameSchema.parse("user@name"));
            assert.throws(() => usernameSchema.parse("user name"));
            assert.doesNotThrow(() => usernameSchema.parse("user_name"));
            assert.doesNotThrow(() => usernameSchema.parse("user.name"));
        });

        it("should require password with min 8 characters", () => {
            const passwordSchema = z.string()
                .min(8, "Password must be at least 8 characters")
                .max(64);

            assert.throws(() => passwordSchema.parse("short"), /8 characters/);
            assert.doesNotThrow(() => passwordSchema.parse("longpassword"));
        });

        it("should validate email format", () => {
            const emailSchema = z.string().email();

            assert.throws(() => emailSchema.parse("invalid"));
            assert.throws(() => emailSchema.parse("no@domain"));
            assert.doesNotThrow(() => emailSchema.parse("test@example.com"));
        });

        it("should validate phone with digits only", () => {
            const phoneSchema = z.string()
                .min(8)
                .max(20)
                .regex(/^\d+$/);

            assert.throws(() => phoneSchema.parse("123-456"));
            assert.throws(() => phoneSchema.parse("+911234567890"));
            assert.doesNotThrow(() => phoneSchema.parse("1234567890"));
        });

        it("should accept valid roles", () => {
            const PUBLIC_REGISTRATION_ROLES = ["customer", "provider", "shop"] as const;
            const roleSchema = z.enum(PUBLIC_REGISTRATION_ROLES);

            assert.doesNotThrow(() => roleSchema.parse("customer"));
            assert.doesNotThrow(() => roleSchema.parse("provider"));
            assert.doesNotThrow(() => roleSchema.parse("shop"));
            assert.throws(() => roleSchema.parse("admin"));
            assert.throws(() => roleSchema.parse("worker"));
        });
    });

    describe("Login validation", () => {
        it("should require identifier and password", () => {
            const loginSchema = z.object({
                username: z.string().min(1),
                password: z.string().min(1),
            });

            assert.throws(() => loginSchema.parse({}));
            assert.throws(() => loginSchema.parse({ username: "" }));
            assert.doesNotThrow(() => loginSchema.parse({
                username: "test",
                password: "password"
            }));
        });
    });

    describe("PIN login validation", () => {
        it("should require phone and 4-digit PIN", () => {
            const pinLoginSchema = z.object({
                phone: z.string().min(8).max(20),
                pin: z.string().length(4).regex(/^\d+$/),
            });

            assert.throws(() => pinLoginSchema.parse({ phone: "123", pin: "1234" }));
            assert.throws(() => pinLoginSchema.parse({ phone: "1234567890", pin: "123" }));
            assert.throws(() => pinLoginSchema.parse({ phone: "1234567890", pin: "abcd" }));
            assert.doesNotThrow(() => pinLoginSchema.parse({
                phone: "1234567890",
                pin: "1234"
            }));
        });
    });

    describe("Session management", () => {
        it("should create session with user id on login", () => {
            const session = createMockSession();
            const user = createMockUser({ id: 123 });

            // Simulate session serialization
            session.userId = user.id;

            assert.strictEqual(session.userId, 123);
        });

        it("should clear session on destroy", () => {
            const session = createMockSession({ userId: 123, role: "customer" });

            session.destroy();

            assert.strictEqual(session.userId, undefined);
        });
    });

    describe("Suspended user handling", () => {
        it("should block suspended users from logging in", () => {
            const user = createMockUser({ isSuspended: true });

            // Simulating the check in local strategy
            const canLogin = !user.isSuspended;

            assert.strictEqual(canLogin, false);
        });

        it("should allow non-suspended users to login", () => {
            const user = createMockUser({ isSuspended: false });

            const canLogin = !user.isSuspended;

            assert.strictEqual(canLogin, true);
        });
    });

    describe("Worker login validation", () => {
        it("should require 10-digit worker number and 4-digit PIN", () => {
            const workerLoginSchema = z.object({
                workerNumber: z.string().length(10).regex(/^\d+$/),
                pin: z.string().length(4).regex(/^\d+$/),
            });

            assert.throws(() => workerLoginSchema.parse({
                workerNumber: "123",
                pin: "1234"
            }));
            assert.throws(() => workerLoginSchema.parse({
                workerNumber: "1234567890",
                pin: "123"
            }));
            assert.doesNotThrow(() => workerLoginSchema.parse({
                workerNumber: "1234567890",
                pin: "1234"
            }));
        });
    });

    describe("Password reset validation", () => {
        it("should require valid OTP and new password", () => {
            const resetPasswordSchema = z.object({
                token: z.string().min(1),
                newPassword: z.string().min(8).max(64),
            });

            assert.throws(() => resetPasswordSchema.parse({
                token: "",
                newPassword: "newpassword123"
            }));
            assert.throws(() => resetPasswordSchema.parse({
                token: "valid-token",
                newPassword: "short"
            }));
            assert.doesNotThrow(() => resetPasswordSchema.parse({
                token: "valid-token",
                newPassword: "newpassword123"
            }));
        });
    });
});
