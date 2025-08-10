import { Express } from "express";
import { z } from "zod";
import { eq, and, gte, lte, isNull, or } from "drizzle-orm"; // Added 'or'
import { db } from "../db";
import { promotions, products } from "@shared/schema";
import logger from "../logger";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

export function registerPromotionRoutes(app: Express) {
  /**
   * @openapi
   * /api/promotions:
   *   post:
   *     summary: Create a new promotion
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, type, value, shopId]
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [percentage, fixed_amount]
   *               value:
   *                 type: number
   *               code:
   *                 type: string
   *               usageLimit:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *               shopId:
   *                 type: integer
   *               expiryDays:
   *                 type: integer
   *               applicableProducts:
   *                 type: array
   *                 items:
   *                   type: integer
   *               excludedProducts:
   *                 type: array
   *                 items:
   *                   type: integer
   *               minPurchase:
   *                 type: number
   *               maxDiscount:
   *                 type: number
   *     responses:
   *       201:
   *         description: Promotion created
   *       400:
   *         description: Invalid input
   */
  app.post(
    "/api/promotions",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        // Define a Zod schema for the promotion with expiryDays
        const promotionWithExpirySchema = z.object({
          name: z.string().min(1, "Promotion name is required"),
          description: z.string().optional(),
          type: z.enum(["percentage", "fixed_amount"]),
          value: z.coerce.number().min(0, "Discount value must be positive"),
          code: z.string().optional(),
          usageLimit: z.coerce.number().min(0).optional(),
          isActive: z.boolean().default(true),
          shopId: z.coerce.number().positive("Invalid Shop ID"),
          expiryDays: z.coerce.number().min(0).default(0),
          applicableProducts: z.array(z.number()).optional(),
          excludedProducts: z.array(z.number()).optional(),
          minPurchase: z.coerce.number().min(0).optional(),
          maxDiscount: z.coerce.number().min(0).optional(),
        });

        const result = promotionWithExpirySchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const { expiryDays, ...promotionData } = result.data;

        // Calculate start and end dates
        const startDate = new Date();
        let endDate = null;

        if (expiryDays > 0) {
          endDate = new Date();
          endDate.setDate(endDate.getDate() + expiryDays);
        }

        logger.info("Creating promotion with calculated dates:", {
          startDate,
          endDate,
          expiryDays,
        });

        // Convert numeric fields expected as strings by the schema
        const dbValues: any = {
          ...promotionData,
          startDate,
          endDate,
          value: promotionData.value.toString(), // Convert to string
          ...(promotionData.minPurchase !== undefined && {
            minPurchase: promotionData.minPurchase.toString(),
          }), // Convert to string if exists
          ...(promotionData.maxDiscount !== undefined && {
            maxDiscount: promotionData.maxDiscount.toString(),
          }), // Convert to string if exists
        };

        const promotion = await db
          .insert(promotions)
          .values(dbValues)
          .returning();

        res.status(201).json(promotion[0]);
      } catch (error) {
        logger.error("Error creating promotion:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create promotion",
          });
      }
    },
  );

  /**
     * @openapi
     * /api/promotions/shop/{id}:
     *   get:
     *     summary: Get promotions for a shop
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of promotions
     *       400:
     *         description: Invalid shop id
     */
    app.get(
      "/api/promotions/shop/:id",
      requireAuth,
      requireRole(["shop"]),
      async (req, res) => {
        try {
          const paramsSchema = z.object({
            id: z.coerce.number().int().positive(),
          });
          const parsedParams = paramsSchema.safeParse(req.params);
          if (!parsedParams.success)
            return res.status(400).json(parsedParams.error);

          const shopId = parsedParams.data.id;
          const allPromotions = await db
            .select()
            .from(promotions)
            .where(eq(promotions.shopId, shopId));
          res.json(allPromotions);
        } catch (error) {
          logger.error("Error fetching promotions:", error);
          res
            .status(400)
            .json({
              message:
               error instanceof Error
                  ? error.message
                  : "Failed to fetch promotions",
            });
        }
        },
    );

    /**
     * @openapi
     * /api/promotions/{id}:
     *   patch:
     *     summary: Update a promotion
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               description:
     *                 type: string
     *               type:
     *                 type: string
     *                 enum: [percentage, fixed_amount]
     *               value:
     *                 type: number
     *               code:
     *                 type: string
     *               usageLimit:
     *                 type: integer
     *               isActive:
     *                 type: boolean
     *               expiryDays:
     *                 type: integer
     *               applicableProducts:
     *                 type: array
     *                 items:
     *                   type: integer
     *               excludedProducts:
     *                 type: array
     *                 items:
     *                   type: integer
     *               minPurchase:
     *                 type: number
     *               maxDiscount:
     *                 type: number
     *     responses:
     *       200:
     *         description: Promotion updated
     *       400:
     *         description: Invalid input
     */
    app.patch(
      "/api/promotions/:id",
      requireAuth,
      requireRole(["shop"]),
      async (req, res) => {
        try {
          const paramsSchema = z.object({
            id: z.coerce.number().int().positive(),
          });
          const parsedParams = paramsSchema.safeParse(req.params);
          if (!parsedParams.success)
            return res.status(400).json(parsedParams.error);

          const promotionId = parsedParams.data.id;

          // Get the existing promotion to check ownership
          const existingPromotions = await db
            .select()
            .from(promotions)
            .where(eq(promotions.shopId, req.user!.id));
          const promotion = existingPromotions.find((p) => p.id === promotionId);

          if (!promotion) {
            return res
              .status(404)
              .json({
                message:
                  "Promotion not found or you don't have permission to update it",
              });
            }
            // Define a Zod schema for the promotion update with expiryDays
          const promotionUpdateSchema = z
            .object({
              name: z.string().min(1, "Promotion name is required").optional(),
              description: z.string().optional(),
              type: z.enum(["percentage", "fixed_amount"]).optional(),
              value: z.coerce
                .number()
                .min(0, "Discount value must be positive")
                .optional(),
              code: z.string().optional(),
              usageLimit: z.coerce.number().min(0).optional(),
              isActive: z.boolean().optional(),
              expiryDays: z.coerce.number().min(0).optional(),
              applicableProducts: z.array(z.number()).optional(),
              excludedProducts: z.array(z.number()).optional(),
              minPurchase: z.coerce.number().min(0).optional(),
              maxDiscount: z.coerce.number().min(0).optional(),
            })
            // Only validate name if it's being updated and not just toggling isActive
            .superRefine((data, ctx) => {
              // If we're updating name, validate it
              if (data.name !== undefined && data.name.trim() === "") {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Promotion name is required",
                  path: ["name"],
                });
              }
            })
            .refine(
              (data) => {
                // Ensure at least one field is provided for the update
                return Object.keys(data).length > 0;
              },
              {
                message: "At least one field must be provided for update",
              },
            );

          const result = promotionUpdateSchema.safeParse(req.body);
          if (!result.success) return res.status(400).json(result.error);

          const updateData: any = { ...result.data };
          delete updateData.expiryDays;
        // Handle expiry days update if provided
        if (result.data.expiryDays !== undefined) {
          const startDate = promotion.startDate;
          let endDate = null;

          if (result.data.expiryDays > 0) {
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + result.data.expiryDays);
          }

          updateData.endDate = endDate;
        }

        // Convert numeric fields expected as strings by the schema before updating
        if (updateData.value !== undefined) {
          updateData.value = updateData.value.toString();
        }
        if (updateData.minPurchase !== undefined) {
          updateData.minPurchase = updateData.minPurchase.toString();
        }
        if (updateData.maxDiscount !== undefined) {
          updateData.maxDiscount = updateData.maxDiscount.toString();
        }

        // Update the promotion using the same storage method as other entities
        const updatedResult = await db
          .update(promotions)
          .set(updateData)
          .where(eq(promotions.id, promotionId))
          .returning();

        if (!updatedResult.length) {
          return res
            .status(404)
            .json({ message: "Failed to update promotion" });
        }

        res.json(updatedResult[0]);
      } catch (error) {
        logger.error("Error updating promotion:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update promotion",
          });
      }
    },
  );

  /**
     * @openapi
     * /api/promotions/{id}/status:
     *   patch:
     *     summary: Update promotion status
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [isActive]
     *             properties:
     *               isActive:
     *                 type: boolean
     *     responses:
     *       200:
     *         description: Promotion status updated
     *       400:
     *         description: Invalid input
     */
    app.patch(
      "/api/promotions/:id/status",
      requireAuth,
      requireRole(["shop"]),
      async (req, res) => {
        try {
          const paramsSchema = z.object({
            id: z.coerce.number().int().positive(),
          });
          const parsedParams = paramsSchema.safeParse(req.params);
          if (!parsedParams.success)
            return res.status(400).json(parsedParams.error);
          const promotionId = parsedParams.data.id;

          const bodySchema = z.object({ isActive: z.boolean() });
          const bodyResult = bodySchema.safeParse(req.body);
          if (!bodyResult.success) return res.status(400).json(bodyResult.error);
          const { isActive } = bodyResult.data;

        // Get the existing promotion to check ownership
        const existingPromotions = await db
          .select()
          .from(promotions)
          .where(eq(promotions.shopId, req.user!.id));
        const promotion = existingPromotions.find((p) => p.id === promotionId);

        if (!promotion) {
          return res
            .status(404)
            .json({
              message:
                "Promotion not found or you don't have permission to update it",
            });
        }

        // Update only the isActive status
        const updatedResult = await db
          .update(promotions)
          .set({ isActive })
          .where(eq(promotions.id, promotionId))
          .returning();

        if (!updatedResult.length) {
          return res
            .status(404)
            .json({ message: "Failed to update promotion status" });
        }

        res.json(updatedResult[0]);
      } catch (error) {
        logger.error("Error updating promotion status:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update promotion status",
          });
      }
    },
  );

  /**
     * @openapi
     * /api/promotions/{id}:
     *   delete:
     *     summary: Delete a promotion
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Promotion deleted successfully
     *       400:
     *         description: Invalid promotion id
     */
    app.delete(
      "/api/promotions/:id",
      requireAuth,
      requireRole(["shop"]),
      async (req, res) => {
        try {
          const paramsSchema = z.object({
            id: z.coerce.number().int().positive(),
          });
          const parsedParams = paramsSchema.safeParse(req.params);
          if (!parsedParams.success)
            return res.status(400).json(parsedParams.error);
          const promotionId = parsedParams.data.id;

          // Get the existing promotion to check ownership
          const existingPromotions = await db
            .select()
            .from(promotions)
            .where(eq(promotions.shopId, req.user!.id));
          const promotion = existingPromotions.find((p) => p.id === promotionId);

          if (!promotion) {
            return res
              .status(404)
              .json({
                message:
                  "Promotion not found or you don't have permission to delete it",
              });
          }

        // Delete the promotion
          await db.delete(promotions).where(eq(promotions.id, promotionId));

        res.status(200).json({ message: "Promotion deleted successfully" });
        } catch (error) {
          logger.error("Error deleting promotion:", error);
          res
            .status(400)
            .json({
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to delete promotion",
            });
        }
        },
    );

  /**
   * @openapi
   * /api/promotions/active/{shopId}:
   *   get:
   *     summary: Get active promotions for a shop
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of active promotions
   *       400:
   *         description: Invalid shop id
   */

  app.get(
    "/api/promotions/active/:shopId",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const paramsSchema = z.object({
          shopId: z.coerce.number().int().positive(),
        });
        const parsedParams = paramsSchema.safeParse(req.params);
        if (!parsedParams.success)
          return res.status(400).json(parsedParams.error);
        const shopId = parsedParams.data.shopId;
        const now = new Date();

        // Get all active and non-expired promotions for the shop
        const activePromotions = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.shopId, shopId),
              eq(promotions.isActive, true),
              lte(promotions.startDate, now),
              or(isNull(promotions.endDate), gte(promotions.endDate, now)),
            ),
          );

        // Filter out promotions that have reached their usage limit
        const validPromotions = activePromotions.filter((promo) => {
          // Add null check for usedCount
          return !promo.usageLimit || (promo.usedCount || 0) < promo.usageLimit;
        });

        res.json(validPromotions);
      } catch (error) {
        logger.error("Error fetching active promotions:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch active promotions",
          });
      }
    },
  );

  /**
   * @openapi
   * /api/promotions/validate:
   *   post:
   *     summary: Validate and calculate promotion discount
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [code, shopId, cartItems, subtotal]
   *             properties:
   *               code:
   *                 type: string
   *               shopId:
   *                 type: integer
   *               cartItems:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     productId:
   *                       type: integer
   *                     quantity:
   *                       type: integer
   *                     price:
   *                       type: number
   *               subtotal:
   *                 type: number
   *     responses:
   *       200:
   *         description: Promotion validated
   *       400:
   *         description: Invalid input
   */
  app.post(
    "/api/promotions/validate",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const validationSchema = z.object({
          code: z.string().min(1, "Promotion code is required"),
          shopId: z.number().positive("Shop ID is required"),
          cartItems: z.array(
            z.object({
              productId: z.number().positive(),
              quantity: z.number().positive(),
              price: z
                .number()
                .or(z.string())
                .transform((val) =>
                  typeof val === "string" ? parseFloat(val) : val,
                ),
            }),
          ),
          subtotal: z
            .number()
            .or(z.string())
            .transform((val) =>
              typeof val === "string" ? parseFloat(val) : val,
            ),
        });

        const result = validationSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const { code, shopId, cartItems, subtotal } = result.data;

        // Find the promotion by code and shop
        const promotion = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.code, code),
              eq(promotions.shopId, shopId),
              eq(promotions.isActive, true),
              and(
                lte(promotions.startDate, new Date()),
                or(
                  isNull(promotions.endDate),
                  gte(promotions.endDate, new Date()),
                ),
              ),
            ),
          );

        if (!promotion.length) {
          return res
            .status(404)
            .json({ message: "Invalid or expired promotion code" });
        }

        const promoDetails = promotion[0];

        // Check usage limit (add null check)
        if (
          promoDetails.usageLimit &&
          (promoDetails.usedCount || 0) >= promoDetails.usageLimit
        ) {
          return res
            .status(400)
            .json({ message: "This promotion has reached its usage limit" });
        }

        // Check minimum purchase requirement (convert promoDetails.minPurchase to number)
        const minPurchaseValue = promoDetails.minPurchase
          ? parseFloat(promoDetails.minPurchase)
          : 0;
        if (minPurchaseValue > 0 && subtotal < minPurchaseValue) {
          return res.status(400).json({
            message: `Minimum purchase of ₹${minPurchaseValue} required for this promotion`,
            minPurchase: minPurchaseValue,
          });
        }

        // Filter applicable products if specified
        let applicableItems = cartItems;
        if (
          promoDetails.applicableProducts &&
          promoDetails.applicableProducts.length > 0
        ) {
          applicableItems = cartItems.filter((item) =>
            promoDetails.applicableProducts!.includes(item.productId),
          );
        }

        // Remove excluded products if specified
        if (
          promoDetails.excludedProducts &&
          promoDetails.excludedProducts.length > 0
        ) {
          applicableItems = applicableItems.filter(
            (item) => !promoDetails.excludedProducts!.includes(item.productId),
          );
        }

        if (applicableItems.length === 0) {
          return res
            .status(400)
            .json({ message: "No applicable products for this promotion" });
        }

        // Calculate applicable subtotal
        const applicableSubtotal = applicableItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );

        // Calculate discount (convert promoDetails.value to number)
        let discountAmount = 0;
        const promoValue = parseFloat(promoDetails.value);
        if (promoDetails.type === "percentage") {
          discountAmount = (applicableSubtotal * promoValue) / 100;
        } else {
          // fixed_amount
          discountAmount = promoValue;
        }

        // Apply max discount cap if specified (convert promoDetails.maxDiscount to number)
        const maxDiscountValue = promoDetails.maxDiscount
          ? parseFloat(promoDetails.maxDiscount)
          : null;
        if (maxDiscountValue !== null && discountAmount > maxDiscountValue) {
          discountAmount = maxDiscountValue;
        }

        // Round to 2 decimal places
        discountAmount = Math.round(discountAmount * 100) / 100;

        res.json({
          valid: true,
          promotion: promoDetails,
          discountAmount,
          finalTotal: subtotal - discountAmount,
        });
      } catch (error) {
        logger.error("Error validating promotion:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to validate promotion",
          });
      }
    },
  );

  /**
   * @openapi
   * /api/promotions/{id}/apply:
   *   post:
   *     summary: Apply a promotion to an order
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderId]
   *             properties:
   *               orderId:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Promotion applied
   *       400:
   *         description: Invalid input
   */
  app.post(
    "/api/promotions/:id/apply",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const paramsSchema = z.object({
          id: z.coerce.number().int().positive(),
        });
        const parsedParams = paramsSchema.safeParse(req.params);
        if (!parsedParams.success)
          return res.status(400).json(parsedParams.error);
        const promotionId = parsedParams.data.id;

        const bodySchema = z.object({ orderId: z.coerce.number().int().positive() });
        const bodyResult = bodySchema.safeParse(req.body);
        if (!bodyResult.success) return res.status(400).json(bodyResult.error);
        const { orderId } = bodyResult.data;

        // Get the promotion
        const promotionResult = await db
          .select()
          .from(promotions)
          .where(eq(promotions.id, promotionId));
        if (!promotionResult.length) {
          return res.status(404).json({ message: "Promotion not found" });
        }

        const promotion = promotionResult[0];

        // Check if promotion is still valid
        const now = new Date();
        if (
          !promotion.isActive ||
          promotion.startDate > now ||
          (promotion.endDate && promotion.endDate < now)
        ) {
          return res
            .status(400)
            .json({ message: "Promotion is not active or has expired" });
        }

        // Check usage limit (add null check)
        if (
          promotion.usageLimit &&
          (promotion.usedCount || 0) >= promotion.usageLimit
        ) {
          return res
            .status(400)
            .json({ message: "This promotion has reached its usage limit" });
        }

        // Increment the used count (add null check)
        await db
          .update(promotions)
          .set({ usedCount: (promotion.usedCount || 0) + 1 })
          .where(eq(promotions.id, promotionId));

        res.json({ message: "Promotion applied successfully" });
      } catch (error) {
        logger.error("Error applying promotion:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to apply promotion",
          });
      }
    },
  );
}
