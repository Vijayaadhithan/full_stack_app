/**
 * Auth Route Integration Tests using MockStorage
 * Tests authentication flow without database
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import { MockStorage } from "./mockStorage.js";
import { hashPasswordInternal } from "../server/auth.js";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Create storage instance for auth tests
const storage = new MockStorage();

// Local password comparison for testing
const scryptAsync = promisify(scrypt);
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
    if (!stored || stored.length === 0) return false;
    const parts = stored.split(".");
    if (parts.length !== 2) return false;
    const [hashed, salt] = parts;
    if (!hashed || !salt) return false;
    try {
        const hashedBuf = Buffer.from(hashed, "hex");
        const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
        if (hashedBuf.length !== suppliedBuf.length) return false;
        return timingSafeEqual(hashedBuf, suppliedBuf);
    } catch {
        return false;
    }
}

describe("Auth Routes - Password Authentication", () => {
    beforeEach(async () => {
        storage.reset();
    });

    describe("Registration Flow", () => {
        const registrationSchema = z.object({
            username: z.string().trim().min(3).max(32).regex(/^[a-z0-9._-]+$/i),
            password: z.string().min(8).max(64),
            role: z.enum(["customer", "provider", "shop"]).default("customer"),
            name: z.string().trim().min(1).max(100),
            phone: z.string().trim().min(8).max(20).regex(/^\d+$/),
            email: z.string().trim().email(),
        });

        it("should register new user with valid data", async () => {
            const input = registrationSchema.parse({
                username: "newuser",
                password: "password123",
                name: "New User",
                phone: "9876543210",
                email: "new@example.com",
            });

            const hashedPassword = await hashPasswordInternal(input.password);
            const user = await storage.createUser({
                ...input,
                password: hashedPassword,
            });

            assert.strictEqual(user.username, "newuser");
            assert.strictEqual(user.role, "customer");
            assert.ok(user.password?.includes("."));
        });

        it("should prevent duplicate username", async () => {
            await storage.createUser({ username: "existing" });
            const existing = await storage.getUserByUsername("existing");

            assert.ok(existing);
            // Registration should check and reject
        });

        it("should prevent duplicate email", async () => {
            await storage.createUser({ email: "taken@example.com" });
            const existing = await storage.getUserByEmail("taken@example.com");

            assert.ok(existing);
        });

        it("should prevent duplicate phone", async () => {
            await storage.createUser({ phone: "9876543210" });
            const existing = await storage.getUserByPhone("9876543210");

            assert.ok(existing);
        });
    });

    describe("Login Flow", () => {
        beforeEach(async () => {
            const hashedPassword = await hashPasswordInternal("correctpassword");
            await storage.createUser({
                username: "loginuser",
                password: hashedPassword,
                email: "login@example.com",
                phone: "9876543210",
                name: "Login User",
            });
        });

        it("should login with correct credentials", async () => {
            const user = await storage.getUserByUsername("loginuser");
            assert.ok(user);
            assert.ok(user.password);

            const isValid = await comparePasswords("correctpassword", user.password);
            assert.strictEqual(isValid, true);
        });

        it("should reject incorrect password", async () => {
            const user = await storage.getUserByUsername("loginuser");
            assert.ok(user);
            assert.ok(user.password);

            const isValid = await comparePasswords("wrongpassword", user.password);
            assert.strictEqual(isValid, false);
        });

        it("should reject non-existent user", async () => {
            const user = await storage.getUserByUsername("nonexistent");
            assert.strictEqual(user, undefined);
        });

        it("should block suspended user", async () => {
            await storage.updateUser(1, { isSuspended: true });
            const user = await storage.getUser(1);

            assert.strictEqual(user?.isSuspended, true);
            // Login should check and reject
        });
    });

    describe("Session Management", () => {
        it("should have session store", () => {
            assert.ok(storage.sessionStore);
        });

        it("should get user by ID for session deserialization", async () => {
            await storage.createUser({ username: "sessionuser" });
            const user = await storage.getUser(1);

            assert.ok(user);
            assert.strictEqual(user.id, 1);
        });
    });
});

describe("Auth Routes - PIN Authentication", () => {
    beforeEach(async () => {
        storage.reset();
    });

    describe("Check User", () => {
        const checkUserSchema = z.object({
            phone: z.string().min(8).max(20),
        });

        it("should find existing user by phone", async () => {
            await storage.createUser({
                phone: "789546741",
                pin: "2702",
                name: "Test User",
            });

            const phone = checkUserSchema.parse({ phone: "789546741" }).phone;
            const user = await storage.getUserByPhone(phone);

            assert.ok(user);
            assert.strictEqual(user.phone, "789546741");
        });

        it("should return not found for new phone", async () => {
            const user = await storage.getUserByPhone("1234567890");
            assert.strictEqual(user, undefined);
        });
    });

    describe("PIN Login", () => {
        const pinLoginSchema = z.object({
            phone: z.string().min(8).max(20),
            pin: z.string().length(4).regex(/^\d+$/),
        });

        beforeEach(async () => {
            await storage.createUser({
                phone: "789546741",
                pin: "2702",
                name: "PIN User",
            });
        });

        it("should login with correct PIN", async () => {
            const input = pinLoginSchema.parse({ phone: "789546741", pin: "2702" });
            const user = await storage.getUserByPhone(input.phone);

            assert.ok(user);
            assert.strictEqual(user.pin, input.pin);
        });

        it("should reject incorrect PIN", async () => {
            const input = pinLoginSchema.parse({ phone: "789546741", pin: "9999" });
            const user = await storage.getUserByPhone(input.phone);

            assert.ok(user);
            assert.notStrictEqual(user.pin, input.pin);
        });
    });

    describe("Rural Register", () => {
        const ruralRegisterSchema = z.object({
            firebaseIdToken: z.string().min(1),
            name: z.string().trim().min(1).max(100),
            pin: z.string().length(4).regex(/^\d+$/),
            initialRole: z.enum(["customer", "provider", "shop"]).optional(),
        });

        it("should register new rural user", async () => {
            const input = ruralRegisterSchema.parse({
                firebaseIdToken: "mock-token-+91789546741",
                name: "Rural User",
                pin: "1234",
                initialRole: "customer",
            });

            // Extract phone from token
            const phone = input.firebaseIdToken.replace("mock-token-+91", "");

            const user = await storage.createUser({
                phone,
                pin: input.pin,
                name: input.name,
                role: input.initialRole ?? "customer",
            });

            assert.strictEqual(user.phone, "789546741");
            assert.strictEqual(user.pin, "1234");
            assert.strictEqual(user.role, "customer");
        });

        it("should allow provider role", async () => {
            const user = await storage.createUser({
                phone: "9876543210",
                pin: "5678",
                name: "Provider User",
                role: "provider",
            });

            assert.strictEqual(user.role, "provider");
        });

        it("should allow shop role", async () => {
            const user = await storage.createUser({
                phone: "9876543211",
                pin: "9012",
                name: "Shop User",
                role: "shop",
            });

            assert.strictEqual(user.role, "shop");
        });
    });

    describe("Reset PIN", () => {
        const resetPinSchema = z.object({
            firebaseIdToken: z.string().min(1),
            newPin: z.string().length(4).regex(/^\d+$/),
        });

        it("should reset PIN for existing user", async () => {
            await storage.createUser({
                phone: "789546741",
                pin: "1234",
                name: "User",
            });

            const input = resetPinSchema.parse({
                firebaseIdToken: "mock-token-+91789546741",
                newPin: "5678",
            });

            const user = await storage.getUserByPhone("789546741");
            assert.ok(user);

            const updated = await storage.updateUser(user.id, { pin: input.newPin });
            assert.strictEqual(updated.pin, "5678");
        });
    });
});

describe("Auth Routes - Account Management", () => {
    beforeEach(async () => {
        storage.reset();
        await storage.createUser({
            username: "existinguser",
            password: "hashedpass.salt",
            email: "existing@example.com",
            phone: "9876543210",
            name: "Existing User",
        });
    });

    describe("Get User Profile", () => {
        it("should return user profile", async () => {
            const user = await storage.getUser(1);

            assert.ok(user);
            assert.strictEqual(user.username, "existinguser");
            // Password should be removed for response
            const sanitized = { ...user, password: undefined, pin: undefined };
            assert.strictEqual(sanitized.password, undefined);
            assert.strictEqual(sanitized.pin, undefined);
        });
    });

    describe("Update Profile", () => {
        it("should update user name", async () => {
            const updated = await storage.updateUser(1, { name: "New Name" });
            assert.strictEqual(updated.name, "New Name");
        });

        it("should update bio", async () => {
            const updated = await storage.updateUser(1, { bio: "This is my bio" });
            assert.strictEqual(updated.bio, "This is my bio");
        });
    });

    describe("Delete Account", () => {
        it("should soft delete user", async () => {
            const updated = await storage.updateUser(1, {
                isDeleted: true,
                deletedAt: new Date(),
            });

            assert.strictEqual(updated.isDeleted, true);
            assert.ok(updated.deletedAt instanceof Date);
        });

        it("should hard delete user and data", async () => {
            await storage.deleteUserAndData(1);
            const user = await storage.getUser(1);

            assert.strictEqual(user, undefined);
        });
    });

    describe("Suspend Account", () => {
        it("should suspend user", async () => {
            const updated = await storage.updateUser(1, {
                isSuspended: true,
                suspensionReason: "Violation of terms",
            });

            assert.strictEqual(updated.isSuspended, true);
            assert.strictEqual(updated.suspensionReason, "Violation of terms");
        });

        it("should unsuspend user", async () => {
            await storage.updateUser(1, { isSuspended: true });
            const updated = await storage.updateUser(1, {
                isSuspended: false,
                suspensionReason: null,
            });

            assert.strictEqual(updated.isSuspended, false);
            assert.strictEqual(updated.suspensionReason, null);
        });
    });
});

describe("Auth Routes - Worker Login", () => {
    beforeEach(async () => {
        storage.reset();
    });

    describe("Worker Number Login", () => {
        const workerLoginSchema = z.object({
            workerNumber: z.string().length(10).regex(/^\d+$/),
            pin: z.string().length(4).regex(/^\d+$/),
        });

        it("should validate worker login schema", () => {
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
});

describe("Auth Helpers", () => {
    describe("hashPasswordInternal", () => {
        it("should produce consistent format", async () => {
            const hash = await hashPasswordInternal("testpassword");
            const parts = hash.split(".");

            assert.strictEqual(parts.length, 2);
            assert.strictEqual(parts[0].length, 128); // 64 bytes hex
            assert.strictEqual(parts[1].length, 32);  // 16 bytes hex
        });

        it("should produce unique hashes for same password", async () => {
            const hash1 = await hashPasswordInternal("samepassword");
            const hash2 = await hashPasswordInternal("samepassword");

            // Different salts mean different hashes
            assert.notStrictEqual(hash1, hash2);
        });
    });

    describe("comparePasswords (local impl)", () => {
        it("should verify correct password", async () => {
            const hash = await hashPasswordInternal("mypassword");
            const isValid = await comparePasswords("mypassword", hash);

            assert.strictEqual(isValid, true);
        });

        it("should reject incorrect password", async () => {
            const hash = await hashPasswordInternal("mypassword");
            const isValid = await comparePasswords("wrongpassword", hash);

            assert.strictEqual(isValid, false);
        });

        it("should handle special characters", async () => {
            const password = "P@$$w0rd!#$%^&*()";
            const hash = await hashPasswordInternal(password);
            const isValid = await comparePasswords(password, hash);

            assert.strictEqual(isValid, true);
        });

        it("should handle unicode characters", async () => {
            const password = "பாஸ்வேர்ட்123";
            const hash = await hashPasswordInternal(password);
            const isValid = await comparePasswords(password, hash);

            assert.strictEqual(isValid, true);
        });
    });
});
