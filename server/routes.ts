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

      const updatedProduct = await storage.updateProduct(productId, req.body);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update product" });
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
        return res.status(403).json({ message: "Can only block time slots for own services" });
      }

      const result = insertBlockedTimeSlotSchema.safeParse({
        ...req.body,
        serviceId
      });

      if (!result.success) {
        return res.status(400).json(result.error);
      }

      const blockedSlot = await storage.createBlockedTimeSlot(result.data);

      // Create notification for existing bookings that might be affected
      const overlappingBookings = await storage.getOverlappingBookings(
        serviceId,
        new Date(result.data.date),
        result.data.startTime,
        result.data.endTime
      );

      for (const booking of overlappingBookings) {
        await storage.createNotification({
          userId: booking.customerId,
          type: "service",
          title: "Service Unavailable",
          message: "A service you booked has become unavailable for the scheduled time. Please reschedule.",
        });
      }

      res.status(201).json(blockedSlot);
    } catch (error) {
      console.error("Error blocking time slot:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to block time slot" });
    }
  });

  app.delete("/api/services/:serviceId/blocked-slots/:slotId", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const slotId = parseInt(req.params.slotId);

      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      if (service.providerId !== req.user!.id) {
        return res.status(403).json({ message: "Can only unblock time slots for own services" });
      }

      await storage.deleteBlockedTimeSlot(slotId);
      res.sendStatus(200);
    } catch (error) {
      console.error("Error unblocking time slot:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to unblock time slot" });
    }
  });

  // Booking routes
  app.post("/api/bookings", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const { serviceId, date, time } = req.body;

      // Get service details
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Create Razorpay order
      const amount = parseInt(service.price);
      const order = await razorpay.orders.create({
        amount: amount * 100, // Convert to paisa
        currency: "INR",
        receipt: `booking_${Date.now()}`,
      });

      // Create booking record
      const booking = await storage.createBooking({
        customerId: req.user!.id,
        serviceId,
        bookingDate: new Date(`${date}T${time}`),
        status: "pending",
        paymentStatus: "pending",
        razorpayOrderId: order.id,
      });

      // Create notification for provider
      await storage.createNotification({
        userId: service.providerId,
        type: "booking_request",
        title: "New Booking Request",
        message: `You have a new booking request for ${service.name}`,
      });

      res.status(201).json({ booking, order });
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create booking" });
    }
  });

  app.patch("/api/bookings/:id/status", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const { status, rejectionReason } = req.body;
      const bookingId = parseInt(req.params.id);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const service = await storage.getService(booking.serviceId);
      if (!service || service.providerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this booking" });
      }

      // Update booking status
      const updatedBooking = await storage.updateBooking(bookingId, {
        status,
        rejectionReason: status === "rejected" ? rejectionReason : null,
      });

      // Create notification for customer
      const notificationMessage = status === "rejected"
        ? `Your booking for ${service.name} was rejected. Reason: ${rejectionReason}`
        : `Your booking for ${service.name} was ${status}`;

      await storage.createNotification({
        userId: booking.customerId,
        type: "booking_update",
        title: `Booking ${status}`,
        message: notificationMessage,
      });

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update booking status" });
    }
  });

  app.post("/api/bookings/:id/payment", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const { razorpayPaymentId, razorpaySignature } = req.body;
      const bookingId = parseInt(req.params.id);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify payment signature
      const body = booking.razorpayOrderId + "|" + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      // Update booking payment status
      const updatedBooking = await storage.updateBooking(bookingId, {
        paymentStatus: "paid",
        razorpayPaymentId,
      });

      // Notify provider about payment
      const service = await storage.getService(booking.serviceId);
      if (service) {
        await storage.createNotification({
          userId: service.providerId,
          type: "payment",
          title: "Payment Received",
          message: `Payment received for booking #${booking.id}`,
        });
      }

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to verify payment" });
    }
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

  // Order Management
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
    try {
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
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update order status" });
    }
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
    try {
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
    } catch (error) {
      console.error("Error approving return:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to approve return" });
    }
  });

  // Add this route for user details
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  });

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


  app.get("/api/products", requireAuth, async (req, res) => {
    // Get all products from storage
    const products = Array.from(storage.products.values());
    res.json(products);
  });

  // Product Reviews
  app.get("/api/reviews/product/:id", requireAuth, async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(parseInt(req.params.id));
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching product reviews:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews/product/:id/reply", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const { reply } = req.body;
      const review = await storage.replyToProductReview(parseInt(req.params.id), reply);
      res.json(review);
    } catch (error) {
      console.error("Error replying to review:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to reply to review" });
    }
  });

  // Promotions Management
  app.post("/api/promotions", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const result = insertPromotionSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const promotion = await storage.createPromotion({
        ...result.data,
        shopId: req.user!.id,
      });

      res.status(201).json(promotion);
    } catch (error) {
      console.error("Error creating promotion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create promotion" });
    }
  });

  app.get("/api/promotions/shop/:id", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const promotions = await storage.getPromotionsByShop(parseInt(req.params.id));
      res.json(promotions);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch promotions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}