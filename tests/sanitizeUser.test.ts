/**
 * Tests for server/security/sanitizeUser.ts
 * User data sanitization to remove sensitive fields
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeUser, sanitizeUserList } from "../server/security/sanitizeUser.js";

describe("sanitizeUser", () => {
    describe("sanitizeUser", () => {
        // Positive cases
        it("should remove password field from user object", () => {
            const user = {
                id: 1,
                username: "testuser",
                email: "test@example.com",
                password: "hashedpassword123",
            };

            const sanitized = sanitizeUser(user);

            assert.strictEqual(sanitized?.id, 1);
            assert.strictEqual(sanitized?.username, "testuser");
            assert.strictEqual(sanitized?.email, "test@example.com");
            assert.ok(!("password" in (sanitized ?? {})));
        });

        it("should remove pin field from user object", () => {
            const user = {
                id: 1,
                username: "testuser",
                pin: "1234",
            };

            const sanitized = sanitizeUser(user);

            assert.strictEqual(sanitized?.id, 1);
            assert.ok(!("pin" in (sanitized ?? {})));
        });

        it("should remove both password and pin fields", () => {
            const user = {
                id: 1,
                username: "testuser",
                password: "secret",
                pin: "1234",
            };

            const sanitized = sanitizeUser(user);

            assert.strictEqual(sanitized?.id, 1);
            assert.ok(!("password" in (sanitized ?? {})));
            assert.ok(!("pin" in (sanitized ?? {})));
        });

        it("should preserve all other fields", () => {
            const user = {
                id: 1,
                username: "testuser",
                email: "test@example.com",
                phone: "+911234567890",
                role: "customer",
                name: "Test User",
                createdAt: new Date("2024-01-01"),
                password: "secret",
            };

            const sanitized = sanitizeUser(user);

            assert.strictEqual(sanitized?.id, 1);
            assert.strictEqual(sanitized?.username, "testuser");
            assert.strictEqual(sanitized?.email, "test@example.com");
            assert.strictEqual(sanitized?.phone, "+911234567890");
            assert.strictEqual(sanitized?.role, "customer");
            assert.strictEqual(sanitized?.name, "Test User");
            assert.ok(sanitized?.createdAt);
        });

        it("should return user as-is if no sensitive fields exist", () => {
            const user = {
                id: 1,
                username: "testuser",
                email: "test@example.com",
            };

            const sanitized = sanitizeUser(user);

            // Should be the same object reference when no modification needed
            assert.deepStrictEqual(sanitized, user);
        });

        // Negative cases
        it("should return null for null input", () => {
            const sanitized = sanitizeUser(null);
            assert.strictEqual(sanitized, null);
        });

        it("should return null for undefined input", () => {
            const sanitized = sanitizeUser(undefined);
            assert.strictEqual(sanitized, null);
        });

        it("should handle empty object", () => {
            const sanitized = sanitizeUser({});
            assert.deepStrictEqual(sanitized, {});
        });
    });

    describe("sanitizeUserList", () => {
        // Positive cases
        it("should sanitize all users in list", () => {
            const users = [
                { id: 1, username: "user1", password: "pass1" },
                { id: 2, username: "user2", password: "pass2" },
            ];

            const sanitized = sanitizeUserList(users);

            assert.strictEqual(sanitized.length, 2);
            assert.strictEqual(sanitized[0].id, 1);
            assert.strictEqual(sanitized[0].username, "user1");
            assert.ok(!("password" in sanitized[0]));
            assert.strictEqual(sanitized[1].id, 2);
            assert.ok(!("password" in sanitized[1]));
        });

        it("should handle empty array", () => {
            const sanitized = sanitizeUserList([]);
            assert.deepStrictEqual(sanitized, []);
        });

        it("should handle mixed users with and without sensitive fields", () => {
            const users = [
                { id: 1, username: "user1", password: "pass1" },
                { id: 2, username: "user2" },
                { id: 3, username: "user3", pin: "1234" },
            ];

            const sanitized = sanitizeUserList(users);

            assert.strictEqual(sanitized.length, 3);
            assert.ok(!("password" in sanitized[0]));
            assert.ok(!("pin" in sanitized[2]));
        });

        it("should preserve nested objects", () => {
            const users = [
                {
                    id: 1,
                    username: "user1",
                    password: "pass1",
                    profile: { bio: "Hello", avatar: "avatar.jpg" },
                },
            ];

            const sanitized = sanitizeUserList(users);

            assert.strictEqual(sanitized.length, 1);
            assert.deepStrictEqual(sanitized[0].profile, {
                bio: "Hello",
                avatar: "avatar.jpg",
            });
        });
    });
});
