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
  insertNotificationSchema
} from "@shared/schema";
import Razorpay from "razorpay";

// Update the Razorpay initialization section
const razorpay = new Razorpay({
  key_id: "rzp_test_1234567890",  // Test mode key
  key_secret: "secret_test_1234567890" // Test mode secret
});

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

  app.get("/api/services/category/:category", requireAuth, async (req, res) => {
    const services = await storage.getServicesByCategory(req.params.category);
    res.json(services);
  });

  // Booking routes
  app.post("/api/bookings", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertBookingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    // Check service availability
    const isAvailable = await storage.checkAvailability(result.data.serviceId, new Date(result.data.bookingDate));
    if (!isAvailable) {
      return res.status(400).json({ message: "Service not available at selected time" });
    }

    // Create Razorpay order
    const service = await storage.getService(result.data.serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const order = await razorpay.orders.create({
      amount: parseInt(service.price) * 100, // Convert to paisa
      currency: "INR",
      receipt: `booking_${Date.now()}`,
    });

    const booking = await storage.createBooking({
      ...result.data,
      razorpayOrderId: order.id,
      status: "pending",
      paymentStatus: "pending",
    });

    res.status(201).json({ booking, order });
  });

  app.post("/api/bookings/:id/payment", requireAuth, requireRole(["customer"]), async (req, res) => {
    const { razorpayPaymentId } = req.body;
    const booking = await storage.updateBooking(parseInt(req.params.id), {
      razorpayPaymentId,
      status: "confirmed",
      paymentStatus: "paid",
    });

    // Create notification
    await storage.createNotification({
      userId: booking.customerId,
      type: "booking",
      title: "Booking Confirmed",
      message: "Your booking has been confirmed successfully.",
    });

    res.json(booking);
  });

  app.get("/api/bookings/customer", requireAuth, requireRole(["customer"]), async (req, res) => {
    const bookings = await storage.getBookingsByCustomer(req.user!.id);
    res.json(bookings);
  });

  app.post("/api/waitlist", requireAuth, requireRole(["customer"]), async (req, res) => {
    const { serviceId, preferredDate } = req.body;
    await storage.joinWaitlist(req.user!.id, serviceId, new Date(preferredDate));

    // Create notification
    await storage.createNotification({
      userId: req.user!.id,
      type: "booking",
      title: "Added to Waitlist",
      message: "You've been added to the waitlist. We'll notify you when a slot becomes available.",
    });

    res.sendStatus(200);
  });

  // Cart routes
  app.post("/api/cart", requireAuth, requireRole(["customer"]), async (req, res) => {
    const { productId, quantity } = req.body;
    await storage.addToCart(req.user!.id, productId, quantity);
    res.sendStatus(200);
  });

  app.delete("/api/cart/:productId", requireAuth, requireRole(["customer"]), async (req, res) => {
    await storage.removeFromCart(req.user!.id, parseInt(req.params.productId));
    res.sendStatus(200);
  });

  app.get("/api/cart", requireAuth, requireRole(["customer"]), async (req, res) => {
    const cart = await storage.getCart(req.user!.id);
    res.json(cart);
  });

  // Wishlist routes
  app.post("/api/wishlist", requireAuth, requireRole(["customer"]), async (req, res) => {
    const { productId } = req.body;
    await storage.addToWishlist(req.user!.id, productId);
    res.sendStatus(200);
  });

  app.delete("/api/wishlist/:productId", requireAuth, requireRole(["customer"]), async (req, res) => {
    await storage.removeFromWishlist(req.user!.id, parseInt(req.params.productId));
    res.sendStatus(200);
  });

  app.get("/api/wishlist", requireAuth, requireRole(["customer"]), async (req, res) => {
    const wishlist = await storage.getWishlist(req.user!.id);
    res.json(wishlist);
  });

  // Review routes
  app.post("/api/reviews", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertReviewSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const review = await storage.createReview({
      ...result.data,
      customerId: req.user!.id,
    });
    res.status(201).json(review);
  });

  app.get("/api/reviews/service/:id", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsByService(parseInt(req.params.id));
    res.json(reviews);
  });

  app.get("/api/reviews/provider/:id", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsByProvider(parseInt(req.params.id));
    res.json(reviews);
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const notifications = await storage.getNotificationsByUser(req.user!.id);
    res.json(notifications);
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await storage.markNotificationAsRead(parseInt(req.params.id));
    res.sendStatus(200);
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    await storage.deleteNotification(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Order routes
  app.post("/api/orders", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertOrderSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: parseInt(result.data.total) * 100, // Convert to paisa
      currency: "INR",
      receipt: `order_${Date.now()}`,
    });

    const newOrder = await storage.createOrder({
      ...result.data,
      customerId: req.user!.id,
      razorpayOrderId: order.id,
      status: "pending",
      paymentStatus: "pending",
    });

    // Create order items
    const { items } = req.body;
    for (const item of items) {
      await storage.createOrderItem({
        orderId: newOrder.id,
        ...item,
      });
    }

    // Clear cart after order creation
    await storage.clearCart(req.user!.id);

    res.status(201).json({ order: newOrder, razorpayOrder: order });
  });

  app.post("/api/orders/:id/payment", requireAuth, requireRole(["customer"]), async (req, res) => {
    const { razorpayPaymentId } = req.body;
    const order = await storage.updateOrder(parseInt(req.params.id), {
      razorpayPaymentId,
      status: "confirmed",
      paymentStatus: "paid",
    });

    // Create notification
    await storage.createNotification({
      userId: order.customerId,
      type: "order",
      title: "Order Confirmed",
      message: "Your order has been confirmed and will be processed soon.",
    });

    res.json(order);
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