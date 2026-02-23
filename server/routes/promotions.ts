import { Express, type Request } from "express";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { promotions, shopWorkers, shops, products, orders } from "@shared/schema";
import logger from "../logger";
import {
  requireShopOrWorkerPermission,
  resolveShopContextId,
  type RequestWithContext,
} from "../workerAuth";
import { formatValidationError } from "../utils/zod";
import { broadcastInvalidation } from "../realtime";
import { hasRoleAccess } from "../security/roleAccess";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!hasRoleAccess(req.user, roles)) {
      return res.status(403).send("Forbidden");
    }
    return next();
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
          })
          .strict(),
      )
      .nonempty(),
    subtotal: z
      .coerce.number()
      .refine((val) => Number.isFinite(val) && val >= 0, {
        message: "Invalid subtotal",
      })
      .optional(),
  })
  .strict();

const promotionRedeemSchema = z
  .object({
    orderId: z.coerce.number().int().positive(),
  })
  .strict();

const PROMOTION_QUERY_KEYS = ["/api/promotions/shop", "/api/promotions/active"] as const;

type PromotionRow = typeof promotions.$inferSelect;

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return numericValue;
}

function toValidDate(value: unknown): Date | null {
  if (value == null) return null;
  const parsed = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isPromotionWithinSchedule(
  promotion: Pick<PromotionRow, "startDate" | "endDate">,
  now = new Date(),
): boolean {
  const nowTs = now.getTime();
  const startDate = toValidDate(promotion.startDate);
  if (startDate && startDate.getTime() > nowTs) {
    return false;
  }
  const endDate = toValidDate(promotion.endDate);
  if (endDate && endDate.getTime() < nowTs) {
    return false;
  }
  return true;
}

function hasPromotionUsageRemaining(
  promotion: Pick<PromotionRow, "usageLimit" | "usedCount">,
): boolean {
  if (!promotion.usageLimit || promotion.usageLimit <= 0) {
    return true;
  }
  return (promotion.usedCount ?? 0) < promotion.usageLimit;
}

function normalizePromotionResponse(promotion: PromotionRow) {
  return {
    ...promotion,
    value: toFiniteNumber(promotion.value) ?? 0,
    minPurchase: toFiniteNumber(promotion.minPurchase),
    maxDiscount: toFiniteNumber(promotion.maxDiscount),
  };
}

async function resolvePromotionLookupShopIds(shopId: number): Promise<number[]> {
  const ids = new Set<number>([shopId]);
  try {
    const [shopRecord] = await db.primary
      .select({ ownerId: shops.ownerId })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);
    if (shopRecord?.ownerId) {
      ids.add(shopRecord.ownerId);
    }
  } catch (error) {
    logger.warn(
      { err: error, shopId },
      "Failed to resolve shop owner fallback for promotion lookup",
    );
  }
  return Array.from(ids);
}

async function notifyPromotionSubscribers(shopId: number | null | undefined) {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  if (shopId == null) return;
  try {
    const workers = await db.primary
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

        const promotion = await db.primary
          .insert(promotions)
          .values(dbValues)
          .returning();

        void notifyPromotionSubscribers(shopContextId);
        res.status(201).json(normalizePromotionResponse(promotion[0]));
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

        const allPromotions = await db.primary
          .select()
          .from(promotions)
          .where(eq(promotions.shopId, shopContextId));
        res.json(allPromotions.map(normalizePromotionResponse));
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
        const [existingPromotion] = await db.primary
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

        const [updatedPromotion] = await db.primary
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
        res.json(normalizePromotionResponse(updatedPromotion));
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
        const [promotion] = await db.primary
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

        const [updatedPromotion] = await db.primary
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
        res.json(normalizePromotionResponse(updatedPromotion));
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
        const deleted = await db.primary
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
        const shopIds = await resolvePromotionLookupShopIds(requestedShopId);
        const now = new Date();

        // Query by active flag and shop context, then evaluate date window in JS to avoid timezone edge cases.
        const promotionsForShop = await db.primary
          .select()
          .from(promotions)
          .where(
            and(
              inArray(promotions.shopId, shopIds),
              eq(promotions.isActive, true),
            ),
          );

        const validPromotions = promotionsForShop
          .filter((promotion) => isPromotionWithinSchedule(promotion, now))
          .filter(hasPromotionUsageRemaining)
          .map(normalizePromotionResponse);

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
          shopId: requestedShopId,
          cartItems: rawCartItems,
          subtotal: subtotalFromRequest,
        } = result.data;
        const normalizedCode = code.trim().toLowerCase();
        const shopIds = await resolvePromotionLookupShopIds(requestedShopId);
        const now = new Date();

        const productIds = Array.from(
          new Set(rawCartItems.map((item) => item.productId)),
        );
        const cartProducts = productIds.length
          ? await db.primary
            .select({
              id: products.id,
              shopId: products.shopId,
              price: products.price,
            })
            .from(products)
            .where(inArray(products.id, productIds))
          : [];
        const productMap = new Map(cartProducts.map((item) => [item.id, item]));
        const missingProductIds = productIds.filter((id) => !productMap.has(id));
        if (missingProductIds.length > 0) {
          return res.status(400).json({
            message: `Product with ID ${missingProductIds[0]} not found`,
          });
        }

        const canonicalItems = rawCartItems.map((item) => {
          const product = productMap.get(item.productId)!;
          if (product.shopId == null || !shopIds.includes(product.shopId)) {
            throw new Error(
              `Product ${item.productId} does not belong to the selected shop`,
            );
          }
          const price = toFiniteNumber(product.price);
          if (price === null || price < 0) {
            throw new Error(`Invalid product price for product ${item.productId}`);
          }
          return {
            productId: item.productId,
            quantity: item.quantity,
            price,
          };
        });
        const subtotal = Number(
          canonicalItems
            .reduce((sum, item) => sum + item.price * item.quantity, 0)
            .toFixed(2),
        );
        if (
          subtotalFromRequest !== undefined &&
          Math.abs(subtotalFromRequest - subtotal) > 0.01
        ) {
          return res.status(400).json({
            message: "Cart subtotal mismatch. Please refresh your cart and retry.",
            expectedSubtotal: subtotal,
          });
        }

        // Find active promotions for this shop, then match code case-insensitively.
        const promotionsForShop = await db.primary
          .select()
          .from(promotions)
          .where(
            and(
              inArray(promotions.shopId, shopIds),
              eq(promotions.isActive, true),
            ),
          );

        const promoDetails = promotionsForShop.find((promotion) => {
          const promotionCode = promotion.code?.trim().toLowerCase();
          return (
            promotionCode === normalizedCode &&
            isPromotionWithinSchedule(promotion, now)
          );
        });

        if (!promoDetails) {
          return res
            .status(404)
            .json({ message: "Invalid or expired promotion code" });
        }

        if (!hasPromotionUsageRemaining(promoDetails)) {
          return res
            .status(400)
            .json({ message: "This promotion has reached its usage limit" });
        }

        const minPurchaseValue = toFiniteNumber(promoDetails.minPurchase) ?? 0;
        if (minPurchaseValue > 0 && subtotal < minPurchaseValue) {
          return res.status(400).json({
            message: `Minimum purchase of ₹${minPurchaseValue} required for this promotion`,
            minPurchase: minPurchaseValue,
          });
        }

        // Filter applicable products if specified
        let applicableItems = canonicalItems;
        if (
          promoDetails.applicableProducts &&
          promoDetails.applicableProducts.length > 0
        ) {
          applicableItems = canonicalItems.filter((item) =>
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

        let discountAmount = 0;
        const promoValue = toFiniteNumber(promoDetails.value) ?? 0;
        if (promoDetails.type === "percentage") {
          discountAmount = (applicableSubtotal * promoValue) / 100;
        } else {
          // fixed_amount
          discountAmount = promoValue;
        }

        const maxDiscountValue = toFiniteNumber(promoDetails.maxDiscount);
        if (maxDiscountValue !== null && discountAmount > maxDiscountValue) {
          discountAmount = maxDiscountValue;
        }
        if (discountAmount > applicableSubtotal) {
          discountAmount = applicableSubtotal;
        }

        // Round to 2 decimal places
        discountAmount = Math.round(discountAmount * 100) / 100;
        const finalTotal = Number((subtotal - discountAmount).toFixed(2));

        res.json({
          valid: true,
          promotion: normalizePromotionResponse(promoDetails),
          discountAmount,
          subtotal,
          finalTotal,
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
        const promotionResult = await db.primary
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
          !isPromotionWithinSchedule(promotion, now)
        ) {
          return res
            .status(400)
            .json({ message: "Promotion is not active or has expired" });
        }

        if (!hasPromotionUsageRemaining(promotion)) {
          return res
            .status(400)
            .json({ message: "This promotion has reached its usage limit" });
        }

        const orderResult = await db.primary
          .select({
            id: orders.id,
            customerId: orders.customerId,
            shopId: orders.shopId,
          })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);
        const order = orderResult[0];
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }
        const userIdRaw = req.user?.id;
        if (userIdRaw == null) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        const requesterId =
          typeof userIdRaw === "number"
            ? userIdRaw
            : Number.parseInt(String(userIdRaw), 10);
        if (!Number.isFinite(requesterId) || order.customerId !== requesterId) {
          return res.status(403).json({ message: "Not authorized for this order" });
        }
        if (order.shopId !== promotion.shopId) {
          return res.status(400).json({
            message: "Promotion does not apply to this order",
          });
        }

        // Promotion usage is now reserved during checkout (/api/orders) to avoid race
        // conditions and duplicate apply calls from the client.
        res.json({
          message: "Promotion already accounted at checkout",
          applied: true,
        });
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
