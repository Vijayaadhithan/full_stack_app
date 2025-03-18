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
  insertOrderItemSchema
} from "@shared/schema";

function requireAuth(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Service routes
  app.post("/api/services", requireAuth, requireRole(["provider"]), async (req, res) => {
    const result = insertServiceSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    
    const service = await storage.createService(result.data);
    res.status(201).json(service);
  });

  app.get("/api/services/provider/:id", requireAuth, async (req, res) => {
    const services = await storage.getServicesByProvider(parseInt(req.params.id));
    res.json(services);
  });

  // Booking routes
  app.post("/api/bookings", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertBookingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    
    const booking = await storage.createBooking(result.data);
    res.status(201).json(booking);
  });

  app.get("/api/bookings/customer", requireAuth, requireRole(["customer"]), async (req, res) => {
    const bookings = await storage.getBookingsByCustomer(req.user!.id);
    res.json(bookings);
  });

  app.get("/api/bookings/provider", requireAuth, requireRole(["provider"]), async (req, res) => {
    const bookings = await storage.getBookingsByProvider(req.user!.id);
    res.json(bookings);
  });

  // Product routes
  app.post("/api/products", requireAuth, requireRole(["shop"]), async (req, res) => {
    const result = insertProductSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    
    const product = await storage.createProduct(result.data);
    res.status(201).json(product);
  });

  app.get("/api/products/shop/:id", requireAuth, async (req, res) => {
    const products = await storage.getProductsByShop(parseInt(req.params.id));
    res.json(products);
  });

  // Order routes
  app.post("/api/orders", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertOrderSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    
    const order = await storage.createOrder(result.data);
    res.status(201).json(order);
  });

  app.get("/api/orders/customer", requireAuth, requireRole(["customer"]), async (req, res) => {
    const orders = await storage.getOrdersByCustomer(req.user!.id);
    res.json(orders);
  });

  app.get("/api/orders/shop", requireAuth, requireRole(["shop"]), async (req, res) => {
    const orders = await storage.getOrdersByShop(req.user!.id);
    res.json(orders);
  });

  const httpServer = createServer(app);
  return httpServer;
}
