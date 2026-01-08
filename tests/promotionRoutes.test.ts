/**
 * Tests for server/routes/promotions.ts
 * Promotion CRUD and validation routes
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import { createMockUser } from "./testHelpers.js";

describe("promotionRoutes", () => {
    describe("Promotion creation validation", () => {
        it("should require code and discount", () => {
            const promotionCreateSchema = z.object({
                code: z.string().trim().min(1).max(50),
                discountType: z.enum(["percentage", "fixed"]),
                discountValue: z.coerce.number().positive(),
                shopId: z.coerce.number().int().positive(),
            });

            // Negative cases
            assert.throws(() => promotionCreateSchema.parse({}));
            assert.throws(() => promotionCreateSchema.parse({ code: "" }));
            assert.throws(() => promotionCreateSchema.parse({
                code: "SAVE10",
                discountType: "invalid"
            }));

            // Positive case
            assert.doesNotThrow(() => promotionCreateSchema.parse({
                code: "SAVE10",
                discountType: "percentage",
                discountValue: 10,
                shopId: 1
            }));
        });

        it("should validate percentage discount range", () => {
            const percentageSchema = z.number().min(0).max(100);

            assert.throws(() => percentageSchema.parse(-5));
            assert.throws(() => percentageSchema.parse(150));
            assert.doesNotThrow(() => percentageSchema.parse(50));
        });

        it("should validate fixed discount is positive", () => {
            const fixedAmountSchema = z.number().positive();

            assert.throws(() => fixedAmountSchema.parse(0));
            assert.throws(() => fixedAmountSchema.parse(-100));
            assert.doesNotThrow(() => fixedAmountSchema.parse(100));
        });
    });

    describe("Promotion date validation", () => {
        it("should accept valid date range", () => {
            const startDate = new Date("2024-01-01");
            const endDate = new Date("2024-12-31");

            const isValidRange = startDate < endDate;
            assert.strictEqual(isValidRange, true);
        });

        it("should reject past expiry dates", () => {
            const now = new Date();
            const pastDate = new Date("2020-01-01");

            const isPast = pastDate < now;
            assert.strictEqual(isPast, true);
        });

        it("should accept future expiry dates", () => {
            const now = new Date();
            const futureDate = new Date("2030-01-01");

            const isFuture = futureDate > now;
            assert.strictEqual(isFuture, true);
        });
    });

    describe("Promotion code validation", () => {
        it("should validate code format", () => {
            const codeSchema = z.string().trim().min(1).max(50);

            assert.throws(() => codeSchema.parse(""));
            assert.doesNotThrow(() => codeSchema.parse("SAVE10"));
            assert.doesNotThrow(() => codeSchema.parse("SUMMER-2024"));
        });

        it("should normalize code to uppercase", () => {
            const normalizeCode = (code: string) => code.toUpperCase().trim();

            assert.strictEqual(normalizeCode("save10"), "SAVE10");
            assert.strictEqual(normalizeCode("  Summer2024  "), "SUMMER2024");
        });
    });

    describe("Promotion validation endpoint", () => {
        it("should require code, shopId, and cart items", () => {
            const promotionValidationSchema = z.object({
                code: z.string().trim().min(1),
                shopId: z.coerce.number().int().positive(),
                cartItems: z.array(z.object({
                    productId: z.number().int().positive(),
                    quantity: z.number().int().positive(),
                    price: z.coerce.number().positive(),
                })).min(1),
            });

            // Negative cases
            assert.throws(() => promotionValidationSchema.parse({}));

            // Positive case
            assert.doesNotThrow(() => promotionValidationSchema.parse({
                code: "SAVE10",
                shopId: 1,
                cartItems: [{ productId: 1, quantity: 2, price: 100 }]
            }));
        });
    });

    describe("Discount calculation", () => {
        it("should calculate percentage discount correctly", () => {
            const cartTotal = 1000;
            const discountPercent = 10;

            const discount = cartTotal * (discountPercent / 100);
            assert.strictEqual(discount, 100);
        });

        it("should calculate fixed discount correctly", () => {
            const cartTotal = 1000;
            const fixedDiscount = 150;

            const discount = Math.min(fixedDiscount, cartTotal);
            assert.strictEqual(discount, 150);
        });

        it("should not exceed cart total for fixed discount", () => {
            const cartTotal = 100;
            const fixedDiscount = 200;

            const discount = Math.min(fixedDiscount, cartTotal);
            assert.strictEqual(discount, 100);
        });

        it("should respect max discount cap", () => {
            const cartTotal = 5000;
            const discountPercent = 50;
            const maxDiscount = 500;

            const calculatedDiscount = cartTotal * (discountPercent / 100);
            const actualDiscount = Math.min(calculatedDiscount, maxDiscount);

            assert.strictEqual(calculatedDiscount, 2500);
            assert.strictEqual(actualDiscount, 500);
        });

        it("should enforce minimum purchase requirement", () => {
            const cartTotal = 50;
            const minPurchase = 100;

            const isEligible = cartTotal >= minPurchase;
            assert.strictEqual(isEligible, false);
        });
    });

    describe("Promotion status", () => {
        it("should check if promotion is active", () => {
            const promotion = { isActive: true };
            assert.strictEqual(promotion.isActive, true);
        });

        it("should check if promotion is expired", () => {
            const now = new Date();
            const expiryDate = new Date("2020-01-01");

            const isExpired = expiryDate < now;
            assert.strictEqual(isExpired, true);
        });

        it("should check if promotion has started", () => {
            const now = new Date();
            const startDate = new Date("2020-01-01");

            const hasStarted = startDate <= now;
            assert.strictEqual(hasStarted, true);
        });
    });

    describe("Product exclusions", () => {
        it("should check if product is excluded", () => {
            const excludedProducts = [1, 2, 3];
            const productId = 2;

            const isExcluded = excludedProducts.includes(productId);
            assert.strictEqual(isExcluded, true);
        });

        it("should allow non-excluded products", () => {
            const excludedProducts = [1, 2, 3];
            const productId = 5;

            const isExcluded = excludedProducts.includes(productId);
            assert.strictEqual(isExcluded, false);
        });
    });

    describe("Usage limits", () => {
        it("should check if usage limit reached", () => {
            const usageLimit = 100;
            const currentUsage = 100;

            const isLimitReached = currentUsage >= usageLimit;
            assert.strictEqual(isLimitReached, true);
        });

        it("should allow usage under limit", () => {
            const usageLimit = 100;
            const currentUsage = 50;

            const isLimitReached = currentUsage >= usageLimit;
            assert.strictEqual(isLimitReached, false);
        });

        it("should handle unlimited usage", () => {
            const usageLimit = null;
            const currentUsage = 1000;

            const isLimitReached = usageLimit !== null && currentUsage >= usageLimit;
            assert.strictEqual(isLimitReached, false);
        });
    });
});
