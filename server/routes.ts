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

  // Update the services route to use getServices method
  app.get("/api/services", requireAuth, async (req, res) => {
    const services = await storage.getServices();
    res.json(services);
  });

  app.get("/api/services/:id", requireAuth, async (req, res) => {
    console.log(`Fetching service with id: ${req.params.id}`);
    const serviceId = parseInt(req.params.id);
    console.log(`Parsed service ID: ${serviceId}`);

    const service = await storage.getService(serviceId);
    console.log(`Found service:`, service);

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json(service);
  });

  // Add this route for user details
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  });


  app.get("/api/products", requireAuth, async (req, res) => {
    // Get all products from storage
    const products = Array.from(storage.products.values());
    res.json(products);
  });

  // Booking routes
  app.post("/api/bookings", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertBookingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const { serviceId, date, time, isRecurring, recurringPattern, recurringDuration } = req.body;

    // Get service details for validation
    const service = await storage.getService(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    // Parse the booking date and time
    const bookingDateTime = new Date(`${date}T${time}`);

    // Check availability for the initial booking
    const isAvailable = await storage.checkAvailability(serviceId, bookingDateTime);
    if (!isAvailable) {
      return res.status(400).json({ message: "Service not available at selected time" });
    }

    // If recurring, validate all future dates
    if (isRecurring && recurringPattern) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90); // 90 days ahead

      let futureDates: Date[] = [];
      if (recurringPattern === "weekly") {
        for (let i = 1; i < recurringDuration; i++) {
          const futureDate = new Date(bookingDateTime);
          futureDate.setDate(futureDate.getDate() + (i * 7));
          futureDates.push(futureDate);
        }
      } else if (recurringPattern === "monthly") {
        for (let i = 1; i < recurringDuration; i++) {
          const futureDate = new Date(bookingDateTime);
          futureDate.setMonth(futureDate.getMonth() + i);
          futureDates.push(futureDate);
        }
      }

      // Check availability for all future dates
      for (const futureDate of futureDates) {
        const isAvailable = await storage.checkAvailability(serviceId, futureDate);
        if (!isAvailable) {
          return res.status(400).json({
            message: "Some recurring slots are not available",
            date: futureDate,
          });
        }
      }
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: parseInt(service.price) * 100, // Convert to paisa
      currency: "INR",
      receipt: `booking_${Date.now()}`,
    });

    // Create the initial booking
    const booking = await storage.createBooking({
      ...result.data,
      razorpayOrderId: order.id,
      status: "pending",
      paymentStatus: "pending",
      isRecurring: isRecurring || false,
      recurringPattern: recurringPattern || null,
    });

    // If recurring, create future bookings
    if (isRecurring && recurringPattern && recurringDuration) {
      const futureDates = Array.from({ length: recurringDuration - 1 }, (_, i) => {
        const date = new Date(bookingDateTime);
        if (recurringPattern === "weekly") {
          date.setDate(date.getDate() + ((i + 1) * 7));
        } else {
          date.setMonth(date.getMonth() + (i + 1));
        }
        return date;
      });

      for (const futureDate of futureDates) {
        await storage.createBooking({
          ...result.data,
          bookingDate: futureDate,
          status: "pending",
          paymentStatus: "pending",
          isRecurring: true,
          recurringPattern,
        });
      }
    }

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
    try {
      await storage.addToCart(req.user!.id, productId, quantity);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to add to cart" });
    }
  });

  app.delete("/api/cart/:productId", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      await storage.removeFromCart(req.user!.id, parseInt(req.params.productId));
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to remove from cart" });
    }
  });

  app.get("/api/cart", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const cart = await storage.getCart(req.user!.id);
      res.json(cart);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to get cart" });
    }
  });

  // Wishlist routes
  app.post("/api/wishlist", requireAuth, requireRole(["customer"]), async (req, res) => {
    const { productId } = req.body;
    await storage.addToWishlist(req.user!.id, productId);
    res.json({ success: true }); // Send proper JSON response
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

  // Order routes with better error handling
  app.post("/api/orders", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create order" });
    }
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

  // Add an endpoint to get service availability
  app.get("/api/services/:id/bookings", requireAuth, async (req, res) => {
    const { date } = req.query;
    const serviceId = parseInt(req.params.id);

    const service = await storage.getService(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const bookings = await storage.getBookingsByService(serviceId, new Date(date as string));
    res.json(bookings.map(booking => ({
      start: booking.bookingDate,
      end: new Date(booking.bookingDate.getTime() + (service.duration + (service.bufferTime || 0)) * 60000),
    })));
  });


  // Enhanced booking routes with notifications
  app.post("/api/bookings/:id/confirm", requireAuth, requireRole(["provider"]), async (req, res) => {
    const booking = await storage.updateBooking(parseInt(req.params.id), {
      status: "confirmed",
    });

    // Send confirmation notifications
    const customer = await storage.getUser(booking.customerId);
    if (customer) {
      // Create in-app notification
      await storage.createNotification({
        userId: customer.id,
        type: "booking",
        title: "Booking Confirmed",
        message: `Your booking for ${new Date(booking.bookingDate).toLocaleDateString()} has been confirmed.`,
      });

      // Send SMS notification
      await storage.sendSMSNotification(
        customer.phone,
        `Your booking for ${new Date(booking.bookingDate).toLocaleDateString()} has been confirmed.`
      );

      // Send email notification
      await storage.sendEmailNotification(
        customer.email,
        "Booking Confirmation",
        `Your booking for ${new Date(booking.bookingDate).toLocaleDateString()} has been confirmed.`
      );
    }

    res.json(booking);
  });

  // Order tracking routes
  app.get("/api/orders/:id/timeline", requireAuth, async (req, res) => {
    const timeline = await storage.getOrderTimeline(parseInt(req.params.id));
    res.json(timeline);
  });

  app.patch("/api/orders/:id/status", requireAuth, requireRole(["shop"]), async (req, res) => {
    const { status, trackingInfo } = req.body;
    const order = await storage.updateOrderStatus(
      parseInt(req.params.id),
      status,
      trackingInfo
    );

    // Create notification for status update
    await storage.createNotification({
      userId: order.customerId,
      type: "order",
      title: `Order ${status}`,
      message: `Your order #${order.id} has been ${status}. ${trackingInfo || ""}`,
    });

    // Send SMS notification for important status updates
    if (["confirmed", "shipped", "delivered"].includes(status)) {
      const customer = await storage.getUser(order.customerId);
      if (customer) {
        await storage.sendSMSNotification(
          customer.phone,
          `Your order #${order.id} has been ${status}. ${trackingInfo || ""}`
        );
      }
    }

    res.json(order);
  });

  // Return and refund routes
  app.post("/api/orders/:orderId/return", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertReturnRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const order = await storage.getOrder(parseInt(req.params.orderId));
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "delivered") {
      const returnRequest = await storage.createReturnRequest({
        ...result.data,
        orderId: order.id,
        status: "pending",
        customerId: req.user!.id,
      });

      // Create notification for return request
      await storage.createNotification({
        userId: order.customerId,
        type: "return",
        title: "Return Request Received",
        message: "Your return request has been received and is being processed.",
      });

      res.status(201).json(returnRequest);
    } else {
      res.status(400).json({ message: "Order must be delivered before initiating return" });
    }
  });

  app.post("/api/returns/:id/approve", requireAuth, requireRole(["shop"]), async (req, res) => {
    const returnRequest = await storage.getReturnRequest(parseInt(req.params.id));
    if (!returnRequest) return res.status(404).json({ message: "Return request not found" });

    // Process refund through Razorpay
    await storage.processRefund(returnRequest.id);

    const updatedReturn = await storage.updateReturnRequest(returnRequest.id, {
      status: "approved",
    });

    // Notify customer about approved return
    const order = await storage.getOrder(returnRequest.orderId);
    if (order) {
      await storage.createNotification({
        userId: order.customerId,
        type: "return",
        title: "Return Request Approved",
        message: "Your return request has been approved. Refund will be processed shortly.",
      });

      // Send SMS notification
      const customer = await storage.getUser(order.customerId);
      if (customer) {
        await storage.sendSMSNotification(
          customer.phone,
          "Your return request has been approved. Refund will be processed shortly."
        );
      }
    }

    res.json(updatedReturn);
  });

  const httpServer = createServer(app);
  return httpServer;
}