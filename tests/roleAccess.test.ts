/**
 * Tests for server/security/roleAccess.ts
 * Role-based access control functions
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    hasRoleAccess,
    isShopUser,
    isProviderUser,
    isWorkerUser,
    isAdminUser,
    isCustomerUser,
} from "../server/security/roleAccess.js";

describe("roleAccess", () => {
    describe("isShopUser", () => {
        // Positive cases
        it("should return true for user with shop role", () => {
            assert.strictEqual(isShopUser({ role: "shop" }), true);
        });

        it("should return true for user with hasShopProfile", () => {
            assert.strictEqual(isShopUser({ role: "customer", hasShopProfile: true }), true);
        });

        // Negative cases
        it("should return false for customer without shop profile", () => {
            assert.strictEqual(isShopUser({ role: "customer" }), false);
        });

        it("should return false for null user", () => {
            assert.strictEqual(isShopUser(null), false);
        });

        it("should return false for undefined user", () => {
            assert.strictEqual(isShopUser(undefined), false);
        });
    });

    describe("isProviderUser", () => {
        // Positive cases
        it("should return true for user with provider role", () => {
            assert.strictEqual(isProviderUser({ role: "provider" }), true);
        });

        it("should return true for user with hasProviderProfile", () => {
            assert.strictEqual(isProviderUser({ role: "customer", hasProviderProfile: true }), true);
        });

        // Negative cases
        it("should return false for customer without provider profile", () => {
            assert.strictEqual(isProviderUser({ role: "customer" }), false);
        });

        it("should return false for null user", () => {
            assert.strictEqual(isProviderUser(null), false);
        });
    });

    describe("isWorkerUser", () => {
        // Positive cases
        it("should return true for user with worker role", () => {
            assert.strictEqual(isWorkerUser({ role: "worker" }), true);
        });

        // Negative cases
        it("should return false for shop user", () => {
            assert.strictEqual(isWorkerUser({ role: "shop" }), false);
        });

        it("should return false for customer", () => {
            assert.strictEqual(isWorkerUser({ role: "customer" }), false);
        });

        it("should return false for null user", () => {
            assert.strictEqual(isWorkerUser(null), false);
        });
    });

    describe("isAdminUser", () => {
        // Positive cases
        it("should return true for user with admin role", () => {
            assert.strictEqual(isAdminUser({ role: "admin" }), true);
        });

        // Negative cases
        it("should return false for shop user", () => {
            assert.strictEqual(isAdminUser({ role: "shop" }), false);
        });

        it("should return false for customer", () => {
            assert.strictEqual(isAdminUser({ role: "customer" }), false);
        });

        it("should return false for null user", () => {
            assert.strictEqual(isAdminUser(null), false);
        });
    });

    describe("isCustomerUser", () => {
        // Positive cases - any authenticated user is a customer
        it("should return true for any user object", () => {
            assert.strictEqual(isCustomerUser({ role: "customer" }), true);
        });

        it("should return true for shop user", () => {
            assert.strictEqual(isCustomerUser({ role: "shop" }), true);
        });

        it("should return true for provider user", () => {
            assert.strictEqual(isCustomerUser({ role: "provider" }), true);
        });

        // Negative cases
        it("should return false for null user", () => {
            assert.strictEqual(isCustomerUser(null), false);
        });

        it("should return false for undefined user", () => {
            assert.strictEqual(isCustomerUser(undefined), false);
        });
    });

    describe("hasRoleAccess", () => {
        // Positive cases - exact role match
        it("should return true when user role matches required role", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "shop" }, ["shop"]),
                true
            );
        });

        it("should return true when user role is in required roles array", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "provider" }, ["shop", "provider"]),
                true
            );
        });

        it("should return true for any user when customer role is required", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "shop" }, ["customer"]),
                true
            );
        });

        it("should return true for shop user via hasShopProfile", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "customer", hasShopProfile: true }, ["shop"]),
                true
            );
        });

        it("should return true for provider user via hasProviderProfile", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "customer", hasProviderProfile: true }, ["provider"]),
                true
            );
        });

        it("should return true for worker role", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "worker" }, ["worker"]),
                true
            );
        });

        it("should return true for admin role", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "admin" }, ["admin"]),
                true
            );
        });

        // Negative cases - insufficient permissions
        it("should return false when user role does not match", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "customer" }, ["shop"]),
                false
            );
        });

        it("should return false for null user", () => {
            assert.strictEqual(hasRoleAccess(null, ["shop"]), false);
        });

        it("should return false for undefined user", () => {
            assert.strictEqual(hasRoleAccess(undefined, ["shop"]), false);
        });

        it("should return false for customer trying to access admin", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "customer" }, ["admin"]),
                false
            );
        });

        it("should return false for shop trying to access admin", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "shop" }, ["admin"]),
                false
            );
        });

        it("should return false when user has no role and customer not in required", () => {
            assert.strictEqual(
                hasRoleAccess({ role: undefined }, ["shop", "admin"]),
                false
            );
        });

        // Edge cases
        it("should handle empty roles array", () => {
            assert.strictEqual(
                hasRoleAccess({ role: "customer" }, []),
                false
            );
        });

        it("should handle user with null role", () => {
            assert.strictEqual(
                hasRoleAccess({ role: null }, ["customer"]),
                true // Any authenticated user is a customer
            );
        });
    });
});
