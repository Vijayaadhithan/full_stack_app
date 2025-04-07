import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertServiceSchema,
  insertBookingSchema,
  insertProductSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertReviewSchema,
  insertNotificationSchema,
  insertReturnRequestSchema,
  InsertReturnRequest,
  ReturnRequest,
  insertProductReviewSchema,
  insertPromotionSchema,
  insertBlockedTimeSlotSchema, // Added import
} from "@shared/schema";
import Razorpay from "razorpay";
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_1234567890",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "secret_test_1234567890"
});

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

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Shop Profile Management
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (userId !== req.user!.id) {
        return res.status(403).json({ message: "Can only update own profile" });
      }

      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update user" });
    }
  });

  // Get all shops
  app.get("/api/shops", requireAuth, async (req, res) => {
    try {
      // Get all users with role "shop"
      const allUsers = await Promise.all(
        Array.from({ length: 100 }, (_, i) => i + 1).map(async (id) => {
          try {
            return await storage.getUser(id);
          } catch {
            return null;
          }
        })
      );
      
      const shops = allUsers
        .filter((user): user is NonNullable<typeof user> => !!user && user.role === "shop");
      
      res.json(shops);
    } catch (error) {
      console.error("Error fetching shops:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch shops" });
    }
  });
  // GET /api/shops/:id
app.get("/api/shops/:id", requireAuth, async (req, res) => {
  try {
    const shopId = parseInt(req.params.id, 10);
    console.log("[API] /api/shops/:id - Received request for shop ID:", shopId);
    console.log("[API] /api/shops/:id - Raw ID parameter:", req.params.id);
    
    if (isNaN(shopId)) {
      console.log("[API] /api/shops/:id - Invalid shop ID format");
      return res.status(400).json({ message: "Invalid shop ID format" });
    }

    const user = await storage.getUser(shopId);
    console.log("[API] /api/shops/:id - Shop from storage:", user);
    
    if (!user) {
      console.log("[API] /api/shops/:id - Shop not found in storage");
      return res.status(404).json({ message: "Shop not found" });
    }
    
    if (user.role !== "shop") {
      console.log("[API] /api/shops/:id - User found but not a shop");
      return res.status(404).json({ message: "Shop not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Error fetching shop:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
  
  // Get user by ID
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log("[API] /api/users/:id - Received request for user ID:", userId);
      console.log("[API] /api/users/:id - Raw ID parameter:", req.params.id);
      
      if (isNaN(userId)) {
        console.log("[API] /api/users/:id - Invalid user ID format");
        return res.status(400).json({ message: "Invalid user ID format" });
      }
      
      const user = await storage.getUser(userId);
      console.log("[API] /api/users/:id - User from storage:", user);
      
      if (!user) {
        console.log("[API] /api/users/:id - User not found");
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("[API] Error in /api/users/:id:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch user" });
    }
  });

  // Product Management
  app.post("/api/products", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const result = insertProductSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const product = await storage.createProduct({
        ...result.data,
        shopId: req.user!.id,
      });

      console.log("Created product:", product);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create product" });
    }
  });

  app.get("/api/products/shop/:id", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProductsByShop(parseInt(req.params.id));
      console.log("Shop products:", products);
      res.json(products);
    } catch (error) {
      console.error("Error fetching shop products:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch products" });
    }
  });

  app.patch("/api/products/:id", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.shopId !== req.user!.id) {
        return res.status(403).json({ message: "Can only update own products" });
      }

      // Import and use the updateProductSchema for validation
      const { updateProductSchema } = await import("../shared/updateProductSchema");
      
      // Validate the request body against the schema
      const result = updateProductSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid product data", 
          errors: result.error.errors 
        });
      }

      // Only pass the validated data to the storage layer
      const updatedProduct = await storage.updateProduct(productId, result.data);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      console.log(`Delete product request received for ID: ${req.params.id}`);
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);

      if (!product) {
        console.log(`Product with ID ${productId} not found`);
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.shopId !== req.user!.id) {
        console.log(`Unauthorized delete attempt for product ${productId} by user ${req.user!.id}`);
        return res.status(403).json({ message: "Can only delete own products" });
      }

      console.log(`Deleting product with ID: ${productId}`);
      await storage.deleteProduct(productId);
      console.log(`Product ${productId} deleted successfully`);
      res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to delete product" });
    }
  });

  // Service routes
  app.post("/api/services", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const result = insertServiceSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const service = await storage.createService({
        ...result.data,
        providerId: req.user!.id,
        isAvailable: true, // Default to available
      });

      console.log("Created service:", service);
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create service" });
    }
  });

  // Add PATCH endpoint for updating services
  app.patch("/api/services/:id", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      console.log("[API] /api/services/:id PATCH - Received request for service ID:", serviceId);
      console.log("[API] /api/services/:id PATCH - Request body:", req.body);
      
      if (isNaN(serviceId)) {
        console.log("[API] /api/services/:id PATCH - Invalid service ID format");
        return res.status(400).json({ message: "Invalid service ID format" });
      }
      
      const service = await storage.getService(serviceId);
      
      if (!service) {
        console.log("[API] /api/services/:id PATCH - Service not found");
        return res.status(404).json({ message: "Service not found" });
      }
      
      if (service.providerId !== req.user!.id) {
        console.log("[API] /api/services/:id PATCH - Not authorized");
        return res.status(403).json({ message: "Can only update own services" });
      }
      
      const updatedService = await storage.updateService(serviceId, req.body);
      console.log("[API] /api/services/:id PATCH - Updated service:", updatedService);
      res.json(updatedService);
    } catch (error) {
      console.error("[API] Error updating service:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      console.log("[API] /api/services/:id DELETE - Received request for service ID:", serviceId);
      
      if (isNaN(serviceId)) {
        console.log("[API] /api/services/:id DELETE - Invalid service ID format");
        return res.status(400).json({ message: "Invalid service ID format" });
      }
      
      const service = await storage.getService(serviceId);
      
      if (!service) {
        console.log("[API] /api/services/:id DELETE - Service not found");
        return res.status(404).json({ message: "Service not found" });
      }
      
      if (service.providerId !== req.user!.id) {
        console.log("[API] /api/services/:id DELETE - Not authorized");
        return res.status(403).json({ message: "Can only delete own services" });
      }
      
      await storage.deleteService(serviceId);
      console.log("[API] /api/services/:id DELETE - Service deleted successfully");
      res.status(200).json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("[API] Error deleting service:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to delete service" });
    }
  });

  app.get("/api/services/provider/:id", requireAuth, async (req, res) => {
    try {
      const services = await storage.getServicesByProvider(parseInt(req.params.id));
      console.log("Provider services:", services); // Debug log
      res.json(services);
    } catch (error) {
      console.error("Error fetching provider services:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch services" });
    }
  });

  app.get("/api/services", requireAuth, async (req, res) => {
    try {
      const services = await storage.getServices();
      console.log("All services:", services); // Debug log

      // Map through services to include provider info
      const servicesWithDetails = await Promise.all(services.map(async (service) => {
        const provider = await storage.getUser(service.providerId);
        const reviews = await storage.getReviewsByService(service.id);
        const rating = reviews?.length 
          ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length 
          : null;

        return {
          ...service,
          rating,
          provider: provider ? {
            id: provider.id,
            name: provider.name,
            profilePicture: provider.profilePicture,
          } : null,
        };
      }));

      res.json(servicesWithDetails);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch services" });
    }
  });

  app.get("/api/services/:id", requireAuth, async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      console.log("[API] /api/services/:id - Received request for service ID:", serviceId);
      console.log("[API] /api/services/:id - Raw ID parameter:", req.params.id);

      if (isNaN(serviceId)) {
        console.log("[API] /api/services/:id - Invalid service ID format");
        return res.status(400).json({ message: "Invalid service ID format" });
      }

      // Check if service exists in storage
      const service = await storage.getService(serviceId);
      console.log("[API] /api/services/:id - Service from storage:", service);

      if (!service) {
        console.log("[API] /api/services/:id - Service not found in storage");
        return res.status(404).json({ message: "Service not found" });
      }

      // Get the provider details
      const provider = await storage.getUser(service.providerId);
      console.log("[API] /api/services/:id - Provider details:", provider);

      if (!provider) {
        console.log("[API] /api/services/:id - Provider not found");
        return res.status(404).json({ message: "Service provider not found" });
      }

      // Get reviews and calculate rating
      const reviews = await storage.getReviewsByService(serviceId);
      const rating = reviews?.length 
        ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length 
        : null;

      const responseData = {
        ...service,
        rating,
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          profilePicture: provider.profilePicture,
        },
        reviews: reviews || []
      };

      console.log("[API] /api/services/:id - Sending response data:", responseData);
      res.json(responseData);
    } catch (error) {
      console.error("[API] Error in /api/services/:id:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch service" });
    }
  });

  // Add these endpoints after the existing service routes
  app.get("/api/services/:id/blocked-slots", requireAuth, async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getService(serviceId);

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      const blockedSlots = await storage.getBlockedTimeSlots(serviceId);
      res.json(blockedSlots);
    } catch (error) {
      console.error("Error fetching blocked slots:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch blocked slots" });
    }
  });

  app.post("/api/services/:id/block-time", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getService(serviceId);

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      if (service.providerId !== req.user!.id) {
      return res.status(403).json({ message: "Can only block time for own services" });
    }
    const result = insertBlockedTimeSlotSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    const blockedSlot = await storage.createBlockedTimeSlot({
      ...result.data,
      serviceId
    });

    res.status(201).json(blockedSlot);
  } catch (error) {
    console.error("Error blocking time slot:", error);
    res.status(400).json({ message: error instanceof Error ? error.message : "Failed to block time slot" });
  }
});}
