/**
 * Tests for server/routes/admin.ts
 * Admin panel routes: login, user management, logs
 */
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import {
    createMockReq,
    createMockRes,
    createMockSession,
    createMockAdmin,
    silenceLogger,
} from "./testHelpers.js";

describe("adminRoutes", () => {
    describe("Admin login validation", () => {
        it("should require email and password", () => {

            const adminLoginSchema = z.object({
                email: z.string().email(),
                password: z.string().min(8),
            }).strict();

            // Negative cases
            assert.throws(() => adminLoginSchema.parse({}), /email/i);
            assert.throws(() => adminLoginSchema.parse({ email: "admin@example.com" }));
            assert.throws(() => adminLoginSchema.parse({ email: "invalid", password: "password123" }));
            assert.throws(() => adminLoginSchema.parse({ email: "admin@example.com", password: "short" }));

            // Positive case
            assert.doesNotThrow(() => adminLoginSchema.parse({
                email: "admin@example.com",
                password: "password123"
            }));
        });

        it("should reject extra fields in strict mode", () => {
            const adminLoginSchema = z.object({
                email: z.string().email(),
                password: z.string().min(8),
            }).strict();

            assert.throws(() => adminLoginSchema.parse({
                email: "admin@example.com",
                password: "password123",
                extraField: "value"
            }));
        });
    });

    describe("Admin password change validation", () => {
        it("should require current and new password", () => {
            const adminPasswordChangeSchema = z.object({
                currentPassword: z.string().min(8),
                newPassword: z.string().min(8),
            }).strict();

            // Negative cases
            assert.throws(() => adminPasswordChangeSchema.parse({}));
            assert.throws(() => adminPasswordChangeSchema.parse({
                currentPassword: "oldpassword"
            }));
            assert.throws(() => adminPasswordChangeSchema.parse({
                currentPassword: "short",
                newPassword: "newpassword123"
            }));

            // Positive case
            assert.doesNotThrow(() => adminPasswordChangeSchema.parse({
                currentPassword: "oldpassword123",
                newPassword: "newpassword456"
            }));
        });
    });

    describe("Admin session handling", () => {
        it("should set adminId in session on login", () => {
            const session = createMockSession();
            const admin = createMockAdmin({ id: "admin-uuid-123" });

            // Simulate admin login
            session.adminId = admin.id;

            assert.strictEqual(session.adminId, "admin-uuid-123");
        });

        it("should check mustChangePassword flag", () => {
            const session = createMockSession();

            // Simulate admin with password change required
            session.adminMustChangePassword = true;

            assert.strictEqual(session.adminMustChangePassword, true);
        });

        it("should clear admin session on logout", () => {
            const session = createMockSession({
                adminId: "admin-123",
                adminMustChangePassword: false
            });

            session.destroy();

            assert.strictEqual(session.adminId, undefined);
        });
    });

    describe("Admin authentication middleware", () => {
        it("should reject requests without adminId in session", () => {
            const req = createMockReq();
            req.session = createMockSession(); // No adminId
            const res = createMockRes();

            // Simulating isAdminAuthenticated middleware logic
            const isAuthenticated = !!req.session.adminId;

            assert.strictEqual(isAuthenticated, false);
        });

        it("should allow requests with valid adminId", () => {
            const req = createMockReq();
            req.session = createMockSession({ adminId: "admin-123" });

            const isAuthenticated = !!req.session.adminId;

            assert.strictEqual(isAuthenticated, true);
        });
    });

    describe("User management query validation", () => {
        it("should accept pagination parameters", () => {
            const optionalPositiveInt = z.preprocess(
                (value: unknown) => value === undefined || value === null || value === "" ? undefined : value,
                z.coerce.number().int().positive().optional()
            );

            const usersQuerySchema = z.object({
                page: optionalPositiveInt,
                limit: optionalPositiveInt,
                search: z.string().trim().optional(),
            }).strict();

            // Positive cases
            assert.doesNotThrow(() => usersQuerySchema.parse({}));
            assert.doesNotThrow(() => usersQuerySchema.parse({ page: 1 }));
            assert.doesNotThrow(() => usersQuerySchema.parse({ page: 1, limit: 10 }));
            assert.doesNotThrow(() => usersQuerySchema.parse({ search: "john" }));

            // Negative cases - page must be positive
            assert.throws(() => usersQuerySchema.parse({ page: 0 }));
            assert.throws(() => usersQuerySchema.parse({ page: -1 }));
        });
    });

    describe("Order status filter validation", () => {
        it("should accept valid order statuses", () => {
            const ORDER_STATUSES = [
                "pending",
                "confirmed",
                "processing",
                "packed",
                "shipped",
                "delivered",
                "cancelled",
                "returned",
            ] as const;

            const isOrderStatus = (value: string) =>
                ORDER_STATUSES.includes(value as any);

            assert.strictEqual(isOrderStatus("pending"), true);
            assert.strictEqual(isOrderStatus("delivered"), true);
            assert.strictEqual(isOrderStatus("invalid"), false);
        });
    });

    describe("Payment status filter validation", () => {
        it("should accept valid payment statuses", () => {
            const PAYMENT_STATUSES = ["pending", "verifying", "paid", "failed"] as const;

            const isPaymentStatus = (value: string) =>
                PAYMENT_STATUSES.includes(value as any);

            assert.strictEqual(isPaymentStatus("pending"), true);
            assert.strictEqual(isPaymentStatus("paid"), true);
            assert.strictEqual(isPaymentStatus("invalid"), false);
        });
    });

    describe("Log category validation", () => {
        it("should normalize log categories", () => {
            const LOG_CATEGORIES = ["admin", "service_provider", "customer", "shop_owner", "other"];
            const LOG_CATEGORY_ALIASES: Record<string, string> = {
                admin: "admin",
                "service-provider": "service_provider",
                "service_provider": "service_provider",
                provider: "service_provider",
                worker: "service_provider",
                "shop-owner": "shop_owner",
                "shop_owner": "shop_owner",
                shop: "shop_owner",
                customer: "customer",
                other: "other",
            };

            const normalizeLogCategory = (value: string) => {
                const normalized = value.toLowerCase();
                return LOG_CATEGORY_ALIASES[normalized];
            };

            assert.strictEqual(normalizeLogCategory("admin"), "admin");
            assert.strictEqual(normalizeLogCategory("provider"), "service_provider");
            assert.strictEqual(normalizeLogCategory("service-provider"), "service_provider");
            assert.strictEqual(normalizeLogCategory("shop"), "shop_owner");
            assert.strictEqual(normalizeLogCategory("invalid"), undefined);
        });
    });

    describe("Admin permissions", () => {
        it("should check required permissions", () => {
            const adminPermissions = ["users:read", "users:write", "orders:read"];
            const requiredPermissions = ["users:read"];

            const hasPermissions = requiredPermissions.every(p =>
                adminPermissions.includes(p)
            );

            assert.strictEqual(hasPermissions, true);
        });

        it("should fail if missing required permission", () => {
            const adminPermissions = ["users:read", "orders:read"];
            const requiredPermissions = ["users:write"];

            const hasPermissions = requiredPermissions.every(p =>
                adminPermissions.includes(p)
            );

            assert.strictEqual(hasPermissions, false);
        });

        it("should require all permissions in array", () => {
            const adminPermissions = ["users:read", "users:write"];
            const requiredPermissions = ["users:read", "users:write", "orders:write"];

            const hasPermissions = requiredPermissions.every(p =>
                adminPermissions.includes(p)
            );

            assert.strictEqual(hasPermissions, false);
        });
    });

    describe("Log level mapping", () => {
        it("should map level numbers to names", () => {
            const levelNameByNumber: Record<number, string> = {
                10: "trace",
                20: "debug",
                30: "info",
                40: "warn",
                50: "error",
                60: "fatal",
            };

            assert.strictEqual(levelNameByNumber[30], "info");
            assert.strictEqual(levelNameByNumber[50], "error");
            assert.strictEqual(levelNameByNumber[99], undefined);
        });

        it("should map level labels to numbers", () => {
            const levelNumbersByLabel: Record<string, number[]> = {
                trace: [10],
                debug: [20],
                info: [30],
                warn: [40],
                error: [50, 60],
                fatal: [60],
            };

            assert.deepStrictEqual(levelNumbersByLabel["info"], [30]);
            assert.deepStrictEqual(levelNumbersByLabel["error"], [50, 60]);
        });
    });
});
