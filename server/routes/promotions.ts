import { Express } from "express";
import { z } from "zod";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import { db } from "../db";
import { promotions, products } from "@shared/schema";

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
  // Create a new promotion
  app.post("/api/promotions", requireAuth, requireRole(["shop"]), async (req, res) => {
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

      console.log('Creating promotion with calculated dates:', {
        startDate,
        endDate,
        expiryDays
      });

      const promotion = await db.insert(promotions).values({
        ...promotionData,
        startDate,
        endDate,
      }).returning();

      res.status(201).json(promotion[0]);
    } catch (error) {
      console.error("Error creating promotion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create promotion" });
    }
  });

  // Get promotions for a shop
  app.get("/api/promotions/shop/:id", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      const allPromotions = await db.select().from(promotions).where(eq(promotions.shopId, shopId));
      res.json(allPromotions);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch promotions" });
    }
  });

  // Update a promotion
  app.patch("/api/promotions/:id", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const promotionId = parseInt(req.params.id);

      // Get the existing promotion to check ownership
      const existingPromotions = await db.select().from(promotions).where(eq(promotions.shopId, req.user!.id));
      const promotion = existingPromotions.find(p => p.id === promotionId);

      if (!promotion) {
        return res.status(404).json({ message: "Promotion not found or you don't have permission to update it" });
      }

      // Define a Zod schema for the promotion update with expiryDays
      const promotionUpdateSchema = z.object({
        name: z.string().min(1, "Promotion name is required").optional(),
        description: z.string().optional(),
        type: z.enum(["percentage", "fixed_amount"]).optional(),
        value: z.coerce.number().min(0, "Discount value must be positive").optional(),
        code: z.string().optional(),
        usageLimit: z.coerce.number().min(0).optional(),
        isActive: z.boolean().optional(),
        expiryDays: z.coerce.number().min(0).optional(),
        applicableProducts: z.array(z.number()).optional(),
        excludedProducts: z.array(z.number()).optional(),
        minPurchase: z.coerce.number().min(0).optional(),
        maxDiscount: z.coerce.number().min(0).optional(),
      });

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

      // Update the promotion using the same storage method as other entities
      const updatedResult = await db.update(promotions)
        .set(updateData)
        .where(eq(promotions.id, promotionId))
        .returning();

      if (!updatedResult.length) {
        return res.status(404).json({ message: "Failed to update promotion" });
      }

      res.json(updatedResult[0]);
    } catch (error) {
      console.error("Error updating promotion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update promotion" });
    }
  });

  // Validate and apply a promotion code
  app.post("/api/promotions/validate", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const validationSchema = z.object({
        code: z.string().min(1, "Promotion code is required"),
        shopId: z.number().positive("Shop ID is required"),
        cartItems: z.array(z.object({
          productId: z.number().positive(),
          quantity: z.number().positive(),
          price: z.number().or(z.string()).transform(val => typeof val === 'string' ? parseFloat(val) : val),
        })),
        subtotal: z.number().or(z.string()).transform(val => typeof val === 'string' ? parseFloat(val) : val),
      });

      const result = validationSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const { code, shopId, cartItems, subtotal } = result.data;

      // Find the promotion by code and shop
      const promotion = await db.select()
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
                gte(promotions.endDate, new Date())
              )
            )
          )
        );

      if (!promotion.length) {
        return res.status(404).json({ message: "Invalid or expired promotion code" });
      }

      const promoDetails = promotion[0];

      // Check usage limit
      if (promoDetails.usageLimit && promoDetails.usedCount >= promoDetails.usageLimit) {
        return res.status(400).json({ message: "This promotion has reached its usage limit" });
      }

      // Check minimum purchase requirement
      if (promoDetails.minPurchase && subtotal < promoDetails.minPurchase) {
        return res.status(400).json({
          message: `Minimum purchase of ₹${promoDetails.minPurchase} required for this promotion`,
          minPurchase: promoDetails.minPurchase
        });
      }

      // Filter applicable products if specified
      let applicableItems = cartItems;
      if (promoDetails.applicableProducts && promoDetails.applicableProducts.length > 0) {
        applicableItems = cartItems.filter(item => 
          promoDetails.applicableProducts!.includes(item.productId)
        );
      }

      // Remove excluded products if specified
      if (promoDetails.excludedProducts && promoDetails.excludedProducts.length > 0) {
        applicableItems = applicableItems.filter(item => 
          !promoDetails.excludedProducts!.includes(item.productId)
        );
      }

      if (applicableItems.length === 0) {
        return res.status(400).json({ message: "No applicable products for this promotion" });
      }

      // Calculate applicable subtotal
      const applicableSubtotal = applicableItems.reduce(
        (sum, item) => sum + (item.price * item.quantity), 
        0
      );

      // Calculate discount
      let discountAmount = 0;
      if (promoDetails.type === "percentage") {
        discountAmount = (applicableSubtotal * parseFloat(promoDetails.value)) / 100;
      } else { // fixed_amount
        discountAmount = parseFloat(promoDetails.value);
      }

      // Apply max discount cap if specified
      if (promoDetails.maxDiscount && discountAmount > promoDetails.maxDiscount) {
        discountAmount = parseFloat(promoDetails.maxDiscount);
      }

      // Round to 2 decimal places
      discountAmount = Math.round(discountAmount * 100) / 100;

      res.json({
        valid: true,
        promotion: promoDetails,
        discountAmount,
        finalTotal: subtotal - discountAmount
      });
    } catch (error) {
      console.error("Error validating promotion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to validate promotion" });
    }
  });

  // Apply a promotion and increment usage count
  app.post("/api/promotions/:id/apply", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const promotionId = parseInt(req.params.id);
      
      // Update the used count
      const updatedPromotion = await db.update(promotions)
        .set({
          usedCount: sql`${promotions.usedCount} + 1`
        })
        .where(eq(promotions.id, promotionId))
        .returning();

      if (!updatedPromotion.length) {
        return res.status(404).json({ message: "Promotion not found" });
      }

      res.json({ success: true, promotion: updatedPromotion[0] });
    } catch (error) {
      console.error("Error applying promotion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to apply promotion" });
    }
  });
}