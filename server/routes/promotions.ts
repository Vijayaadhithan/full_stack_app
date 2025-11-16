import { Express, type Request } from "express";
import { z } from "zod";
import { eq, and, gte, lte, isNull, or } from "drizzle-orm"; // Added 'or'
import { db } from "../db";
import { promotions, products, shopWorkers } from "@shared/schema";
import logger from "../logger";
import {
  requireShopOrWorkerPermission,
  resolveShopContextId,
  coerceNumericId,
  type RequestWithContext,
} from "../workerAuth";
import { formatValidationError } from "../utils/zod";
import { broadcastInvalidation } from "../realtime";

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

const promotionIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

const promotionLookupByShopSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

const promotionShopIdParamsSchema = z
  .object({
    shopId: z.coerce.number().int().positive(),
  })
  .strict();

const promotionCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Promotion name is required"),
    description: z.string().trim().max(2000).optional(),
    type: z.enum(["percentage", "fixed_amount"]),
    value: z.coerce.number().min(0, "Discount value must be positive"),
    code: z.string().trim().min(1).max(100).optional(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional().default(true),
    shopId: z.coerce.number().int().positive("Invalid Shop ID"),
    expiryDays: z.coerce.number().int().min(0).default(0),
    applicableProducts: z.array(z.coerce.number().int().positive()).optional(),
    excludedProducts: z.array(z.coerce.number().int().positive()).optional(),
    minPurchase: z.coerce.number().min(0).optional(),
    maxDiscount: z.coerce.number().min(0).optional(),
  })
  .strict();

const promotionUpdateSchema = promotionCreateSchema
  .omit({ shopId: true })
  .partial()
  .extend({
    expiryDays: z.coerce.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.name !== undefined && data.name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Promotion name is required",
        path: ["name"],
      });
    }
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided for update",
      });
    }
  });

const promotionStatusBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const promotionValidationSchema = z
  .object({
    code: z.string().trim().min(1, "Promotion code is required"),
    shopId: z.coerce.number().int().positive("Shop ID is required"),
    cartItems: z
      .array(
        z
          .object({
            productId: z.coerce.number().int().positive(),
            quantity: z.coerce.number().int().positive(),
            price: z
              .coerce.number()
              .refine((val) => Number.isFinite(val) && val >= 0, {
                message: "Invalid price",
              }),
          })
          .strict(),
      )
      .nonempty(),
    subtotal: z
      .coerce.number()
      .refine((val) => Number.isFinite(val) && val >= 0, {
        message: "Invalid subtotal",
      }),
  })
  .strict();

const promotionRedeemSchema = z
  .object({
    orderId: z.coerce.number().int().positive(),
  })
  .strict();

const PROMOTION_QUERY_KEYS = ["/api/promotions/shop", "/api/promotions/active"] as const;

async function notifyPromotionSubscribers(shopId: number | null | undefined) {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  if (shopId == null) return;
  try {
    const workers = await db
      .select({ workerUserId: shopWorkers.workerUserId })
      .from(shopWorkers)
      .where(and(eq(shopWorkers.shopId, shopId), eq(shopWorkers.active, true)));
    const recipients = [shopId, ...workers.map((worker) => worker.workerUserId)];
    broadcastInvalidation(recipients, [...PROMOTION_QUERY_KEYS]);
  } catch (error) {
    logger.warn(
      { err: error, shopId },
      "Failed to broadcast promotion change",
    );
  }
}

async function resolveAuthorizedShopId(
  req: Request,
): Promise<number | null> {
  if (typeof req.shopContextId === "number") {
    return req.shopContextId;
  }
  if (typeof req.user?.id === "number" || typeof req.user?.id === "string") {
    return resolveShopContextId(req as RequestWithContext);
  }
  return null;
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
    requireShopOrWorkerPermission(["promotions:manage"]),
    async (req, res) => {
      try {
        const parsedBody = promotionCreateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedBody.error));
        }

        const {
          expiryDays,
          shopId,
          value,
          minPurchase,
          maxDiscount,
          ...promotionData
        } = parsedBody.data;
        const shopContextId = await resolveAuthorizedShopId(req);
        if (!shopContextId || shopContextId !== shopId) {
          return res.status(403).json({ message: "Invalid shop context for promotion creation" });
        }

        const startDate = new Date();
        let endDate: Date | null = null;
        if (expiryDays > 0) {
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + expiryDays);
        }

        logger.info("Creating promotion with calculated dates:", {
          startDate,
          endDate,
          expiryDays,
        });

        const dbValues = {
          ...promotionData,
          shopId: shopContextId,
          startDate,
          endDate,
          value: value.toString(),
          ...(minPurchase !== undefined && {
            minPurchase: minPurchase.toString(),
          }),
          ...(maxDiscount !== undefined && {
            maxDiscount: maxDiscount.toString(),
          }),
        };

        const promotion = await db
          .insert(promotions)
          .values(dbValues)
          .returning();

        void notifyPromotionSubscribers(shopContextId);
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
    requireShopOrWorkerPermission(["promotions:manage"]),
    async (req, res) => {
      try {
        const parsedParams = promotionLookupByShopSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedParams.error));
        }

        const requestedShopId = parsedParams.data.id;
        const shopContextId = await resolveAuthorizedShopId(req);
        if (!shopContextId || requestedShopId !== shopContextId) {
          return res.status(403).json({ message: "Invalid shop context" });
        }

        const allPromotions = await db
          .select()
          .from(promotions)
          .where(eq(promotions.shopId, shopContextId));
        res.json(allPromotions);
      } catch (error) {
        logger.error("Error fetching promotions:", error);
        res
          .status(500)
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
    requireShopOrWorkerPermission(["promotions:manage"]),
    async (req, res) => {
      try {
        const parsedParams = promotionIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedParams.error));
        }

        const shopContextId = await resolveAuthorizedShopId(req);
        if (!shopContextId) {
          return res.status(403).json({ message: "Invalid shop context" });
        }

        const promotionId = parsedParams.data.id;
        const [existingPromotion] = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.id, promotionId),
              eq(promotions.shopId, shopContextId),
            ),
          );

        if (!existingPromotion) {
          return res.status(404).json({
            message:
              "Promotion not found or you don't have permission to update it",
          });
        }

        const parsedBody = promotionUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedBody.error));
        }

        const {
          expiryDays,
          value,
          minPurchase,
          maxDiscount,
          ...rest
        } = parsedBody.data;

        const updateData: Record<string, unknown> = { ...rest };

        if (value !== undefined) {
          updateData.value = value.toString();
        }
        if (minPurchase !== undefined) {
          updateData.minPurchase = minPurchase.toString();
        }
        if (maxDiscount !== undefined) {
          updateData.maxDiscount = maxDiscount.toString();
        }
        if (expiryDays !== undefined) {
          if (expiryDays > 0) {
            const baseStart =
              existingPromotion.startDate instanceof Date
                ? existingPromotion.startDate
                : existingPromotion.startDate
                  ? new Date(existingPromotion.startDate)
                  : new Date();
            const endDate = new Date(baseStart);
            endDate.setDate(endDate.getDate() + expiryDays);
            updateData.endDate = endDate;
          } else {
            updateData.endDate = null;
          }
        }

        if (Object.keys(updateData).length === 0) {
          return res
            .status(400)
            .json({ message: "No promotion fields provided" });
        }

        const [updatedPromotion] = await db
          .update(promotions)
          .set(updateData)
          .where(eq(promotions.id, promotionId))
          .returning();

        if (!updatedPromotion) {
          return res
            .status(404)
            .json({ message: "Failed to update promotion" });
        }

        void notifyPromotionSubscribers(shopContextId);
        res.json(updatedPromotion);
      } catch (error) {
        logger.error("Error updating promotion:", error);
        res
          .status(500)
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
    requireShopOrWorkerPermission(["promotions:manage"]),
    async (req, res) => {
      try {
        const parsedParams = promotionIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedParams.error));
        }

        const parsedBody = promotionStatusBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedBody.error));
        }

        const shopContextId = await resolveAuthorizedShopId(req);
        if (!shopContextId) {
          return res.status(403).json({ message: "Invalid shop context" });
        }

        const promotionId = parsedParams.data.id;
        const [promotion] = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.id, promotionId),
              eq(promotions.shopId, shopContextId),
            ),
          );

        if (!promotion) {
          return res.status(404).json({
            message:
              "Promotion not found or you don't have permission to update it",
          });
        }

        const [updatedPromotion] = await db
          .update(promotions)
          .set({ isActive: parsedBody.data.isActive })
          .where(eq(promotions.id, promotionId))
          .returning();

        if (!updatedPromotion) {
          return res
            .status(404)
            .json({ message: "Failed to update promotion status" });
        }

        void notifyPromotionSubscribers(shopContextId);
        res.json(updatedPromotion);
      } catch (error) {
        logger.error("Error updating promotion status:", error);
        res
          .status(500)
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
    requireShopOrWorkerPermission(["promotions:manage"]),
    async (req, res) => {
      try {
        const parsedParams = promotionIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedParams.error));
        }

        const shopContextId = await resolveAuthorizedShopId(req);
        if (!shopContextId) {
          return res.status(403).json({ message: "Invalid shop context" });
        }

        const promotionId = parsedParams.data.id;
        const deleted = await db
          .delete(promotions)
          .where(
            and(
              eq(promotions.id, promotionId),
              eq(promotions.shopId, shopContextId),
            ),
          )
          .returning();

        if (!deleted.length) {
          return res.status(404).json({
            message:
              "Promotion not found or you don't have permission to delete it",
          });
        }

        void notifyPromotionSubscribers(shopContextId);
        res.status(200).json({ message: "Promotion deleted successfully" });
      } catch (error) {
        logger.error("Error deleting promotion:", error);
        res
          .status(500)
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
    async (req: any, res) => {
      try {
        const parsedParams = promotionShopIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedParams.error));
        }
        const requestedShopId = parsedParams.data.shopId;
        // Role-based access: customers can view any shop; workers can view only their shop; shops can view only their own
        if (req.user?.role === "shop") {
          const shopContextId = coerceNumericId(req.user.id);
          if (!shopContextId || requestedShopId !== shopContextId) {
            return res.status(403).json({ message: "Invalid shop context" });
          }
        } else if (req.user?.role === "worker") {
          const workerShopId = await resolveShopContextId(
            req as RequestWithContext,
          );
          if (!workerShopId || requestedShopId !== workerShopId) {
            return res.status(403).json({ message: "Invalid shop context" });
          }
        } else if (req.user?.role !== "customer") {
          return res.status(403).json({ message: "Forbidden" });
        }
        const shopId = requestedShopId;
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
          .status(500)
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
        const result = promotionValidationSchema.safeParse(req.body);
        if (!result.success) {
          return res
            .status(400)
            .json(formatValidationError(result.error));
        }

        const {
          code,
          shopId,
          cartItems: rawCartItems,
          subtotal,
        } = result.data;
        const cartItems = [...rawCartItems];

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
        const parsedParams = promotionIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
          return res
            .status(400)
            .json(formatValidationError(parsedParams.error));
        }
        const promotionId = parsedParams.data.id;

        const bodyResult = promotionRedeemSchema.safeParse(req.body);
        if (!bodyResult.success) {
          return res
            .status(400)
            .json(formatValidationError(bodyResult.error));
        }
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
          .status(500)
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
