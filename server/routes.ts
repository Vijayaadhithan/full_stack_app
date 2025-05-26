import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPasswordInternal } from "./auth"; // Added hashPasswordInternal
import { 
  sendEmail, 
  getPasswordResetEmailContent, 
  getOrderConfirmationEmailContent, 
  getBookingConfirmationEmailContent, 
  getBookingUpdateEmailContent,
  getBookingRequestPendingEmailContent,
  getBookingAcceptedEmailContent,
  getBookingRejectedEmailContent,
  getServicePaymentConfirmedCustomerEmailContent,
  getServiceProviderPaymentReceivedEmailContent
} from './emailService'; // Added for sending emails
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
  promotions, // Import promotions table for direct updates
  users // Import the users table schema
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import Razorpay from "razorpay";
import crypto from 'crypto';
import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility
import { registerPromotionRoutes } from "./routes/promotions"; // Import promotion routes
//import { registerShopRoutes } from "./routes/shops"; // Import shop routes
import { razorpayRouteService, RazorpayRouteService } from "./services/razorpay-route"; // Import Razorpay Route service

// Helper function to validate and parse date and time
function validateAndParseDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error("Invalid date format. Expected YYYY-MM-DD");
      return null;
    }
    
    // Validate time format (HH:MM)
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
      console.error("Invalid time format. Expected HH:MM");
      return null;
    }
    
    // Create a valid date object
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Month is 0-indexed in JavaScript Date
    const date = new Date(year, month - 1, day, hours, minutes);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error("Invalid date/time combination");
      return null;
    }
    
    return date;
  } catch (error) {
    console.error("Error parsing date/time:", error);
    return null;
  }
}

// Check if Razorpay is properly configured with valid keys
const isRazorpayConfigured = 
  process.env.RAZORPAY_KEY_ID && 
  process.env.RAZORPAY_KEY_ID !== "your-razorpay-key" && 
  process.env.RAZORPAY_KEY_SECRET && 
  process.env.RAZORPAY_KEY_SECRET !== "your-razorpay-secret";

// Initialize Razorpay with proper error handling
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_1234567890",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "secret_test_1234567890"
});

// Log Razorpay configuration status
console.log(`Razorpay configuration status: ${isRazorpayConfigured ? 'Configured' : 'Not properly configured'}`);

// Store password reset tokens in memory (for simplicity, in a real app use a database)
interface PasswordResetToken {
  userId: number;
  token: string;
  expiresAt: Date;
}
const passwordResetTokens: PasswordResetToken[] = [];


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
  // Password Reset Routes
  app.post("/api/request-password-reset", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Important: Don't reveal if the email exists or not for security reasons
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // Token expires in 1 hour

      passwordResetTokens.push({ userId: user.id, token, expiresAt });

      const resetLink = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/reset-password?token=${token}`;
      const emailContent = getPasswordResetEmailContent(user.name || user.username, resetLink);
      
      await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });

      return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      return res.status(500).json({ message: "Error processing password reset request" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    try {
      const tokenEntryIndex = passwordResetTokens.findIndex(entry => entry.token === token && entry.expiresAt > new Date());
      if (tokenEntryIndex === -1) {
        return res.status(400).json({ message: "Invalid or expired password reset token" });
      }

      const { userId } = passwordResetTokens[tokenEntryIndex];
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const hashedPassword = await hashPasswordInternal(newPassword); // Use the exported hash function
      await storage.updateUser(userId, { password: hashedPassword });

      // Invalidate the token after use
      passwordResetTokens.splice(tokenEntryIndex, 1);

      return res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ message: "Error resetting password" });
    }
  });

  setupAuth(app);

  // Booking Notification System
  // Get pending booking requests for a provider
  app.get("/api/bookings/provider/pending", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const providerId = req.user!.id;
      const pendingBookings = await storage.getPendingBookingRequestsForProvider(providerId);
      
      // Fetch service details for each booking
      const bookingsWithDetails = await Promise.all(
        pendingBookings.map(async (booking) => {
          const service = await storage.getService(booking.serviceId!);
          const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null; // Fetch customer details
          const provider = (service && service.providerId !== null) ? await storage.getUser(service.providerId) : null; // Fetch provider details

          let relevantAddress = {};
          // If the booking's serviceLocation is 'customer', include the customer's address
          if (booking.serviceLocation === 'customer' && customer) {
            relevantAddress = {
              addressStreet: customer.addressStreet,
              addressCity: customer.addressCity,
              addressState: customer.addressState,
              addressPostalCode: customer.addressPostalCode,
              addressCountry: customer.addressCountry,
            };
          }
          // If serviceLocation is 'provider', the provider knows their own address, so no address is needed here.

          return { 
            ...booking, 
            service, 
            customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null, // Basic customer info
            provider: provider ? { id: provider.id, name: provider.name, phone: provider.phone } : null, // Basic provider info
            relevantAddress // Add the conditionally determined address
          };
        })
      );
      res.json(bookingsWithDetails); // Send details back
      

    } catch (error) {
      console.error("Error fetching pending bookings:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch pending bookings" });
    }
  });

  // Accept or reject a booking request
  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { status, comments, changedBy } = req.body;
      
      console.log(`[API] Updating booking ${bookingId} status to ${status}`);
      
      // Validate the booking exists
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // For providers: verify they own the service being booked
      if (req.user!.role === "provider") {
        const service = await storage.getService(booking.serviceId!);
        if (!service || service.providerId !== req.user!.id) {
          return res.status(403).json({ message: "You can only manage bookings for your own services" });
        }
      }
      
      // For customers: verify they own the booking
      if (req.user!.role === "customer" && booking.customerId !== req.user!.id) {
        return res.status(403).json({ message: "You can only manage your own bookings" });
      }
      
      // Update the booking
      const updatedBooking = await storage.updateBooking(bookingId, {
        status,
        comments,
      });
      
      // Create notification for the customer
      if (status === "accepted" || status === "rejected") {
        await storage.createNotification({
          userId: booking.customerId,
          type: "booking",
          title: `Booking ${status === "accepted" ? "Accepted" : "Rejected"}`,
          message: `Your booking request has been ${status === "accepted" ? "accepted" : "rejected"}${comments ? `: ${comments}` : "."}`,
          isRead: false,
        });
      }
      
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update booking" });
    }
  });

  // ─── REVIEW OPERATIONS ───────────────────────────────────────────

  // Get reviews submitted by the currently logged-in customer
  app.get("/api/reviews/customer", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const customerId = req.user!.id;
      const reviews = await storage.getReviewsByCustomer(customerId);
      // Optionally, enrich reviews with service/product details if needed
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching customer reviews:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch reviews" });
    }
  });

  // Update a specific review owned by the customer
  const updateReviewSchema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
    review: z.string().min(1).optional(),
  }).strip(); // Use strip to remove extra fields

  app.put("/api/reviews/:id", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      const customerId = req.user!.id;

      // Validate request body
      const validationResult = updateReviewSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: validationResult.error.errors });
      }
      const updateData = validationResult.data;

      // Ensure there's something to update
      if (!updateData.rating && !updateData.review) {
        return res.status(400).json({ message: "No update data provided (rating or review required)" });
      }

      // Update the review using the specific customer update method
      const updatedReview = await storage.updateCustomerReview(reviewId, customerId, updateData);

      res.json(updatedReview);
    } catch (error) {
      console.error("Error updating review:", error);
      // Handle specific errors like 'Review not found' or 'Unauthorized'
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("authorized"))) {
        return res.status(404).json({ message: error.message }); // Use 404 for not found/authorized in this context
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update review" });
    }
  });

  // Get booking requests with status for a customer
  app.get("/api/bookings/customer/requests", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const customerId = req.user!.id;
      const bookingRequests = await storage.getBookingRequestsWithStatusForCustomer(customerId);
      
      // Fetch details for each booking
      const bookingsWithDetails = await Promise.all(
        bookingRequests.map(async (booking) => {
          const service = await storage.getService(booking.serviceId!);
          const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null; // Fetch customer (self)
          const provider = (service && service.providerId !== null) ? await storage.getUser(service.providerId) : null; // Fetch provider

          let relevantAddress = {};
          // If service is at provider's location, show provider address
          if (service?.serviceLocationType === 'provider_location' && provider) {
            relevantAddress = {
              addressStreet: provider.addressStreet,
              addressCity: provider.addressCity,
              addressState: provider.addressState,
              addressPostalCode: provider.addressPostalCode,
              addressCountry: provider.addressCountry,
            };
          } 
          // If service is at customer's location, show customer address
          else if (service?.serviceLocationType === 'customer_location' && customer) {
            relevantAddress = {
              addressStreet: customer.addressStreet,
              addressCity: customer.addressCity,
              addressState: customer.addressState,
              addressPostalCode: customer.addressPostalCode,
              addressCountry: customer.addressCountry,
            };
          }

          return { 
            ...booking, 
            service, 
            customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
            provider: provider ? { id: provider.id, name: provider.name, phone: provider.phone } : null,
            relevantAddress // Add the conditionally determined address
          };
        })
      );
      
      res.json(bookingsWithDetails); // Send the response back
    } catch (error) {
      console.error("Error fetching booking requests:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch booking requests" });
    }
  });

  // Get booking history for a customer
  app.get("/api/bookings/customer/history", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const customerId = req.user!.id;
      const bookingHistory = await storage.getBookingHistoryForCustomer(customerId);
      
      // Fetch details for each booking
      const bookingsWithDetails = await Promise.all(
        bookingHistory.map(async (booking) => {
          const service = await storage.getService(booking.serviceId!);
          const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null; // Fetch customer (self)
          const provider = (service && service.providerId !== null) ? await storage.getUser(service.providerId) : null; // Fetch provider

          let relevantAddress = {};
          // If service is at provider's location, show provider address
          if (service?.serviceLocationType === 'provider_location' && provider) {
            relevantAddress = {
              addressStreet: provider.addressStreet,
              addressCity: provider.addressCity,
              addressState: provider.addressState,
              addressPostalCode: provider.addressPostalCode,
              addressCountry: provider.addressCountry,
            };
          } 
          // If service is at customer's location, show customer address
          else if (service?.serviceLocationType === 'customer_location' && customer) {
            relevantAddress = {
              addressStreet: customer.addressStreet,
              addressCity: customer.addressCity,
              addressState: customer.addressState,
              addressPostalCode: customer.addressPostalCode,
              addressCountry: customer.addressCountry,
            };
          }

          return { 
            ...booking, 
            service, 
            customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
            provider: provider ? { id: provider.id, name: provider.name, phone: provider.phone } : null,
            relevantAddress // Add the conditionally determined address
          };
        })
      );
      res.json(bookingsWithDetails); // Send details back
      

    } catch (error) {
      console.error("Error fetching booking history:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch booking history" });
    }
  });

  // Get booking history for a provider
  app.get("/api/bookings/provider/history", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const providerId = req.user!.id;
      const bookingHistory = await storage.getBookingHistoryForProvider(providerId);
      
      // Fetch details for each booking
      const bookingsWithDetails = await Promise.all(
        bookingHistory.map(async (booking) => {
          const service = await storage.getService(booking.serviceId!);
          const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null; // Fetch customer details
          const provider = (service && service.providerId !== null) ? await storage.getUser(service.providerId) : null; // Fetch provider (self)

          let relevantAddress = {};
          // If service is at provider's location, show provider address (implicitly known)
          // If service is at customer's location, show customer address
          if (service?.serviceLocationType === 'customer_location' && customer) {
            relevantAddress = {
              addressStreet: customer.addressStreet,
              addressCity: customer.addressCity,
              addressState: customer.addressState,
              addressPostalCode: customer.addressPostalCode,
              addressCountry: customer.addressCountry,
            };
          }
          // Provider address is implicitly known by the provider, so no need to explicitly add it here
          // unless the service location is 'provider_location' and you *want* to show it redundantly.
          // For clarity, we only show the *other* party's address when relevant.

          return { 
            ...booking, 
            service, 
            customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
            provider: provider ? { id: provider.id, name: provider.name, phone: provider.phone } : null,
            relevantAddress // Add the conditionally determined address
          };
        })
      );
      res.json(bookingsWithDetails); // Send details back
      

    } catch (error) {
      console.error("Error fetching booking history:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch booking history" });
    }
  });

  // Process expired bookings (can be called by a scheduled job)
  app.post("/api/bookings/process-expired", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      await storage.processExpiredBookings();
      res.json({ message: "Expired bookings processed successfully" });
    } catch (error) {
      console.error("Error processing expired bookings:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to process expired bookings" });
    }
  });

  // Shop Profile Management
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (userId !== req.user!.id) {
        return res.status(403).json({ message: "Can only update own profile" });
      }

      console.log("[API] Updating user profile:", { userId, data: req.body });
      
      // Update the user in the database
      const updatedUser = await storage.updateUser(userId, req.body);
      
      // Update the user in the session
      if (req.user) {
        Object.assign(req.user, updatedUser);
      }
      
      console.log("[API] Updated user profile:", updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update user" });
    }
  });


  // Get all shops
  app.get("/api/shops", requireAuth, async (req, res) => {
    try {
      // Fetch users with the 'shop' role directly from the database
      const shops = await db.select().from(users).where(eq(users.role, 'shop'));
      
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

      // Use a Zod schema for partial updates if desired, or rely on storage layer validation
      // For now, directly pass the body. The storage layer handles partial updates.
      const updateData = req.body;

      // The storage.updateProduct method expects Partial<Product>
      const updatedProduct = await storage.updateProduct(productId, updateData);
      console.log("[API] /api/products/:id PATCH - Updated product:", updatedProduct);
      res.json(updatedProduct);
    } catch (error) {
      console.error("[API] Error in /api/products/:id PATCH:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update product" });
    }
  });

  // Service routes
  app.post("/api/services", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      // Add serviceLocationType to the validation
      const serviceSchemaWithLocation = insertServiceSchema.extend({
        serviceLocationType: z.enum(["customer_location", "provider_location"]).optional().default("provider_location"),
      });
      const result = serviceSchemaWithLocation.safeParse(req.body);
      if (!result.success) {
        console.error("[API] /api/services POST - Validation error:", result.error.flatten());
        return res.status(400).json(result.error.flatten());
      }

      const serviceData = { 
        ...result.data, 
        providerId: req.user!.id,
        isAvailable: true, // Default to available
      };
      const service = await storage.createService(serviceData);

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
      const { 
        category,
        minPrice,
        maxPrice,
        searchTerm,
        providerId,
        locationCity,
        locationPostalCode,
        availabilityDate // YYYY-MM-DD
      } = req.query;

      const filters: any = {};
      if (category) filters.category = String(category);
      if (minPrice) filters.minPrice = parseFloat(String(minPrice));
      if (maxPrice) filters.maxPrice = parseFloat(String(maxPrice));
      if (searchTerm) filters.searchTerm = String(searchTerm);
      if (providerId) filters.providerId = parseInt(String(providerId));
      if (locationCity) filters.locationCity = String(locationCity);
      if (locationPostalCode) filters.locationPostalCode = String(locationPostalCode);
      if (availabilityDate) filters.availabilityDate = String(availabilityDate); // Will be parsed in storage layer

      const services = await storage.getServices(filters);
      console.log("Filtered services:", services); // Debug log

      // Map through services to include provider info and rating
      const servicesWithDetails = await Promise.all(services.map(async (service) => {
        const provider = service.providerId !== null ? await storage.getUser(service.providerId) : null;
        const reviews = await storage.getReviewsByService(service.id);
        const rating = reviews?.length 
          ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length 
          : null;

        return {
          ...service,
          rating,
          provider: provider ? { // Include full provider details needed for address logic
            id: provider.id, 
            name: provider.name, 
            phone: provider.phone,
            profilePicture: provider.profilePicture,
            addressStreet: provider.addressStreet,
            addressCity: provider.addressCity,
            addressState: provider.addressState,
            addressPostalCode: provider.addressPostalCode,
            addressCountry: provider.addressCountry,
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
      const provider = service.providerId !== null ? await storage.getUser(service.providerId) : null;
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
          // Include address fields
          addressStreet: provider.addressStreet,
          addressCity: provider.addressCity,
          addressState: provider.addressState,
          addressPostalCode: provider.addressPostalCode,
          addressCountry: provider.addressCountry
        },
        // Include availability details
        workingHours: service.workingHours,
        breakTime: service.breakTime, // Corrected field name
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
        serviceId: serviceId
      });

      if (!result.success) {
        return res.status(400).json(result.error);
      }

      // Ensure serviceId is a number by overriding the value from the schema if necessary
      const validData = { ...result.data, serviceId: serviceId };
      const blockedSlot = await storage.createBlockedTimeSlot(validData);

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

  // Add endpoint to delete a service
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
      
      try {
        await storage.deleteService(serviceId);
        console.log("[API] /api/services/:id DELETE - Service marked as deleted successfully");
        res.status(200).json({ message: "Service deleted successfully" });
      } catch (error) {
        console.error("[API] Error deleting service:", error);
        res.status(400).json({ message: "Failed to delete service due to existing bookings. Please mark the service as unavailable instead." });
      }
    } catch (error) {
      console.error("[API] Error deleting service:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to delete service" });
    }
  });

  // Booking routes
  app.post("/api/bookings", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      // Destructure bookingDate and serviceLocation. Remove date, time, providerAddress.
      const { serviceId, bookingDate, serviceLocation } = req.body;

      // Get service details
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Validate bookingDate is a valid ISO string
      const bookingDateTime = new Date(bookingDate);
      if (isNaN(bookingDateTime.getTime())) {
        return res.status(400).json({ message: "Invalid booking date format. Expected ISO string." });
      }

      // Validate serviceLocation
      if (serviceLocation !== 'customer' && serviceLocation !== 'provider') {
        return res.status(400).json({ message: "Invalid service location. Must be 'customer' or 'provider'." });
      }

      // Check if Razorpay is properly configured
      if (!isRazorpayConfigured) {
        console.log("Razorpay is not properly configured. Creating booking without payment integration.");

        // Create booking record without Razorpay integration
        const booking = await storage.createBooking({
          customerId: req.user!.id,
          serviceId,
          bookingDate: bookingDateTime, // Use the validated Date object
          status: "pending",
          paymentStatus: "pending",
          serviceLocation: serviceLocation, // Store service location
          // Remove providerAddress field
        });

        // Create notification for provider
        await storage.createNotification({
          userId: service.providerId,
          type: "booking_request",
          title: "New Booking Request",
          message: `You have a new booking request for ${service.name}`,
        });

        return res.status(201).json({ booking, paymentRequired: false, message: "Booking request sent. Payment integration unavailable." });
      }

      // --- Razorpay Integration Logic (if configured) ---
      try {
        // Create Razorpay order
        const amount = parseInt(service.price); // Ensure price is stored as string or number
        if (isNaN(amount) || amount <= 0) {
          return res.status(400).json({ message: "Invalid service price for payment." });
        }

        const orderOptions = {
          amount: amount * 100, // Convert to paisa
          currency: "INR",
          receipt: `booking_${Date.now()}_${serviceId}`,
          notes: {
            serviceId: serviceId,
            customerId: req.user!.id,
            // Add other relevant notes if needed
          }
        };

        const order = await razorpay.orders.create(orderOptions);

        // Create booking record with Razorpay order ID
        const booking = await storage.createBooking({
          customerId: req.user!.id,
          serviceId,
          bookingDate: bookingDateTime, // Use the validated Date object
          status: "pending", // Or 'awaiting_payment' if payment is immediate
          paymentStatus: "pending",
          razorpayOrderId: order.id,
          serviceLocation: serviceLocation, // Store service location
          // Remove providerAddress field
        });

        // Add bookingId to order notes for verification webhook (important!)
        // We need to update the order *after* creating the booking to get the booking ID.
        // This might require a separate Razorpay API call if notes can't be updated easily,
        // or store the bookingId -> orderId mapping elsewhere for the webhook.
        // For simplicity here, we assume the webhook can retrieve bookingId from receipt or other means.
        // If not, the verification logic needs adjustment.
        // Example: await razorpay.orders.edit(order.id, { notes: { ...order.notes, bookingId: booking.id } });

        // Create notification for provider
        await storage.createNotification({
          userId: service.providerId,
          type: "booking_request",
          title: "New Booking Request",
          message: `You have a new booking request for ${service.name}`,
        });

        // Send "New Booking Request" email to provider and "Booking Request Pending" to customer
        try {
          const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null;
          const provider = service.providerId !== null ? await storage.getUser(service.providerId) : undefined;

          if (customer && provider) {
            // Email to provider: "New Booking Request"
            const providerBookingEmailContent = getBookingConfirmationEmailContent(
              provider.name || provider.username,
              {
                bookingId: booking.id.toString(), // Ensure bookingId is a string
                customerName: customer.name || customer.username,
                serviceName: service.name,
                bookingDate: booking.bookingDate, // Pass Date object
              }
              // customer // Pass full customer object - Removed extra argument
            );
            await sendEmail({
              to: provider.email,
              subject: providerBookingEmailContent.subject,
              text: providerBookingEmailContent.text,
              html: providerBookingEmailContent.html,
            });
            console.log(`[API] 'New Booking Request' email sent to provider: ${provider.email}`);

            // Email to customer: "Booking Request Pending"
            const customerPendingEmailContent = getBookingRequestPendingEmailContent(
              customer.name || customer.username,
              {
                serviceName: service.name,
                bookingDate: booking.bookingDate, // Pass Date object
              }
            );
            await sendEmail({
              to: customer.email,
              subject: customerPendingEmailContent.subject,
              text: customerPendingEmailContent.text,
              html: customerPendingEmailContent.html,
            });
            console.log(`[API] 'Booking Request Pending' email sent to customer: ${customer.email}`);
          }
        } catch (emailError) {
          console.error("Error sending booking request emails:", emailError);
        }

        // Return booking and order details for frontend payment initiation
        res.status(201).json({ booking, order, paymentRequired: true });

      } catch (razorpayError) {
        console.error("Razorpay order creation error:", razorpayError);
        // Fallback: Create booking without payment if Razorpay fails
        const booking = await storage.createBooking({
          customerId: req.user!.id,
          serviceId,
          bookingDate: bookingDateTime, // Use the validated Date object
          status: "pending",
          paymentStatus: "pending",
          serviceLocation: serviceLocation, // Store service location
        });

        // Create notification for provider
        await storage.createNotification({
          userId: service.providerId,
          type: "booking_request",
          title: "New Booking Request",
          message: `You have a new booking request for ${service.name}`,
        });

        // Send "New Booking Request" (provider) and "Booking Request Pending" (customer) emails (fallback case)
        try {
          const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null;
          const provider = service.providerId !== null ? await storage.getUser(service.providerId) : null;

          if (customer && provider) {
            const providerBookingEmailContent = getBookingConfirmationEmailContent(
              provider.name || provider.username,
              {
                bookingId: booking.id.toString(), // Ensure bookingId is a string
                customerName: customer.name || customer.username,
                serviceName: service.name,
                bookingDate: booking.bookingDate,
              }
              // customer - Removed extra argument
            );
            await sendEmail({
              to: provider.email,
              subject: providerBookingEmailContent.subject,
              text: providerBookingEmailContent.text,
              html: providerBookingEmailContent.html,
            });
            console.log(`[API] 'New Booking Request' email sent to provider (fallback): ${provider.email}`);

            const customerPendingEmailContent = getBookingRequestPendingEmailContent(
              customer.name || customer.username,
              {
                serviceName: service.name,
                bookingDate: booking.bookingDate,
              }
            );
            await sendEmail({
              to: customer.email,
              subject: customerPendingEmailContent.subject,
              text: customerPendingEmailContent.text,
              html: customerPendingEmailContent.html,
            });
            console.log(`[API] 'Booking Request Pending' email sent to customer (fallback): ${customer.email}`);
          }
        } catch (emailError) {
          console.error("Error sending booking request emails (fallback):", emailError);
        }
        // Inform frontend about the fallback
        res.status(201).json({ booking, paymentRequired: false, message: "Booking request sent. Payment integration failed." });
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create booking" });
    }
  });

  app.patch("/api/bookings/:id/status", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const { status, rejectionReason } = req.body;
      const bookingId = parseInt(req.params.id);

      console.log(`[API] Updating booking status: ID=${bookingId}, Status=${status}, Reason=${rejectionReason || 'N/A'}`);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        console.log(`[API] Booking not found: ID=${bookingId}`);
        return res.status(404).json({ message: "Booking not found" });
      }

      const service = await storage.getService(booking.serviceId!);
      if (!service || service.providerId !== req.user!.id) {
        console.log(`[API] Not authorized to update booking: ID=${bookingId}`);
        return res.status(403).json({ message: "Not authorized to update this booking" });
      }

      // Validate status
      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'accepted' or 'rejected'" });
      }

      // Require rejection reason if status is rejected
      if (status === 'rejected' && !rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required when rejecting a booking" });
      }

      // Update booking status
      const updatedBooking = await storage.updateBooking(bookingId, {
        status,
        rejectionReason: status === "rejected" ? rejectionReason : null,
      });

      // Send appropriate email based on status
      try {
        const customer = await storage.getUser(updatedBooking.customerId!);
        const provider = await storage.getUser(service.providerId!);
        const serviceDetails = await storage.getService(updatedBooking.serviceId!)

        if (customer && serviceDetails && provider) {
          if (updatedBooking.status === "accepted") {
            const acceptedEmailContent = getBookingAcceptedEmailContent(
              customer.name || customer.username,
              {
                serviceName: serviceDetails.name,
                bookingDate: updatedBooking.bookingDate,
                // location: serviceDetails.location, // Example: if location is needed
              },
              provider // Pass provider details
            );
            await sendEmail({
              to: customer.email,
              subject: acceptedEmailContent.subject,
              text: acceptedEmailContent.text,
              html: acceptedEmailContent.html,
            });
            console.log(`[API] 'Booking Accepted' email sent to customer: ${customer.email}`);
          } else if (updatedBooking.status === "rejected") {
            const rejectedEmailContent = getBookingRejectedEmailContent(
              customer.name || customer.username,
              {
                // Removed bookingId as it is not defined in the expected type
                serviceName: serviceDetails.name,
                bookingDate: updatedBooking.bookingDate,
              },
              updatedBooking.rejectionReason ?? undefined
            );
            await sendEmail({
              to: customer.email,
              subject: rejectedEmailContent.subject,
              text: rejectedEmailContent.text,
              html: rejectedEmailContent.html,
            });
            console.log(`[API] 'Booking Rejected' email sent to customer: ${customer.email}`);
          }
        }
      } catch (emailError) {
        console.error("Error sending booking status update email:", emailError);
      }

      // Create notification for customer
      const notificationMessage = status === "rejected"
        ? `Your booking for ${service.name} was rejected. Reason: ${rejectionReason}`
        : `Your booking for ${service.name} has been accepted. The service provider will meet you at the scheduled time.`;

      const notificationTitle = status === "rejected" ? "Booking Rejected" : "Booking Accepted";

      await storage.createNotification({
        userId: booking.customerId,
        type: "booking_update",
        title: notificationTitle,
        message: notificationMessage,
      });
      
      console.log(`[API] Booking status updated successfully: ID=${bookingId}, Status=${status}`);
      console.log(`[API] Notification sent to customer: ID=${booking.customerId}`);
  
      res.json({
        booking: updatedBooking,
        message: status === "accepted" 
          ? "Booking accepted successfully. Customer has been notified." 
          : "Booking rejected. Customer has been notified with the reason."
      });
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update booking status" });
    }
  });

  // New endpoint for customers to mark service as completed and confirm satisfaction
  app.patch("/api/bookings/:id/complete", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const { isSatisfactory, comments } = req.body;
      const bookingId = parseInt(req.params.id);
      
      console.log(`[API] Customer marking booking as completed: ID=${bookingId}, Satisfactory=${isSatisfactory}, Comments=${comments || 'N/A'}`);

      if (isSatisfactory === undefined) {
        return res.status(400).json({ message: "Satisfaction status (isSatisfactory) is required" });
      }

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        console.log(`[API] Booking not found: ID=${bookingId}`);
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify this booking belongs to the customer
      if (booking.customerId !== req.user!.id) {
        console.log(`[API] Not authorized to update booking: ID=${bookingId}, User=${req.user!.id}, Owner=${booking.customerId}`);
        return res.status(403).json({ message: "Not authorized to update this booking" });
      }

      // Verify the booking is in 'accepted' status
      if (booking.status !== "accepted") {
        console.log(`[API] Invalid booking status for completion: ID=${bookingId}, Status=${booking.status}`);
        return res.status(400).json({ 
          message: "Only accepted bookings can be marked as completed",
          currentStatus: booking.status
        });
      }

      const service = await storage.getService(booking.serviceId!);
      if (!service) {
        console.log(`[API] Service not found: ID=${booking.serviceId}`);
        return res.status(404).json({ message: "Service not found" });
      }

      // Update booking status to completed
      const updatedBooking = await storage.updateBooking(bookingId, {
        status: "completed",
        comments: comments || null,
      });
      
      console.log(`[API] Booking marked as completed: ID=${bookingId}`);

      // Create notification for service provider
      const notificationMessage = isSatisfactory
        ? `Customer has marked the booking for ${service.name} as completed and was satisfied with the service.`
        : `Customer has marked the booking for ${service.name} as completed but had some concerns with the service.`;

      await storage.createNotification({
        userId: service.providerId,
        type: "booking_update",
        title: "Service Completed",
        message: notificationMessage
      });
      
      console.log(`[API] Notification sent to provider: ID=${service.providerId}`);

      // If the service was satisfactory and payment is pending, process payment
      if (isSatisfactory && booking.paymentStatus === "pending") {
        console.log(`[API] Processing payment for completed service: ID=${bookingId}`);
        
        // If there's a Razorpay order ID, we need to handle payment through the frontend
        if (booking.razorpayOrderId) {
          console.log(`[API] Razorpay payment required: OrderID=${booking.razorpayOrderId}`);
          return res.json({
            booking: updatedBooking,
            paymentRequired: true,
            razorpayOrderId: booking.razorpayOrderId,
            message: "Please complete the payment for this service"
          });
        } else {
          // For services without Razorpay integration, mark as paid directly
          const paidBooking = await storage.updateBooking(bookingId, {
            paymentStatus: "paid"
          });
          
          console.log(`[API] Booking marked as paid: ID=${bookingId}`);
          
          // Notify provider about payment
          await storage.createNotification({
            userId: service.providerId,
            type: "payment",
            title: "Payment Received",
            message: `Payment for booking #${bookingId} has been marked as received.`
          });
          
          console.log(`[API] Payment notification sent to provider: ID=${service.providerId}`);
          
          return res.json({
            booking: paidBooking,
            paymentRequired: false,
            message: "Service completed and payment recorded"
          });
        }
      }

      res.json({
        booking: updatedBooking,
        message: isSatisfactory 
          ? "Thank you for your positive feedback! Please proceed to payment." 
          : "Thank you for your feedback. We're sorry to hear you had concerns with the service."
      });
    } catch (error) {
      console.error("Error completing booking:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to complete booking" });
    }
  });

  // Initiate payment for a booking
  app.post("/api/bookings/:id/initiate-payment", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      console.log(`[API] Initiating payment for booking: ID=${bookingId}`);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        console.log(`[API] Booking not found for payment initiation: ID=${bookingId}`);
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify this booking belongs to the customer
      if (booking.customerId !== req.user!.id) {
        console.log(`[API] Not authorized to initiate payment: User=${req.user!.id}, Owner=${booking.customerId}`);
        return res.status(403).json({ message: "Not authorized to initiate payment for this booking" });
      }

      // Check if booking is in a state where payment can be initiated (e.g., accepted or completed)
      // The client-side logic seems to allow payment for 'accepted' bookings before completion.
      if (!['accepted', 'completed'].includes(booking.status)) {
        console.log(`[API] Invalid booking status for payment initiation: ID=${bookingId}, Status=${booking.status}`);
        return res.status(400).json({ 
          message: "Payment can only be initiated for accepted or completed bookings",
          currentStatus: booking.status
        });
      }
      
      // Check if already paid
      if (booking.paymentStatus === 'paid') {
        console.log(`[API] Booking already paid: ID=${bookingId}`);
        return res.status(400).json({ message: "This booking has already been paid" });
      }

      // Get service details to determine the amount
      const service = await storage.getService(booking.serviceId!); 
      if (!service) {
        console.log(`[API] Service not found for booking: ServiceID=${booking.serviceId}`);
        return res.status(404).json({ message: "Service associated with booking not found" });
      }

      // Initialize Razorpay Route service
      const razorpayRoute = razorpayRouteService(storage);
      
      // Calculate the total amount including the platform fee
      const originalAmount = Number(service.price);
      const totalAmount = razorpayRoute.calculateTotalWithCustomerFee(originalAmount);
      const amountInPaise = Math.round(totalAmount * 100); // Convert price to paise

      if (!isRazorpayConfigured) {
        console.error("[API] Razorpay is not configured. Cannot initiate payment.");
        return res.status(500).json({ message: "Payment gateway is not configured." });
      }

      // Create Razorpay order
      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `booking_${bookingId}_${Date.now()}`,
        notes: {
          bookingId: bookingId.toString(),
          customerId: req.user!.id.toString(),
          serviceId: service.id.toString(),
          originalAmount: originalAmount.toString(),
          platformFee: "3", // Fixed 3rs platform fee for customer
          totalAmount: totalAmount.toString()
        }
      };

      console.log(`[API] Creating Razorpay order for booking ${bookingId} with options:`, options);
      const order = await razorpay.orders.create(options);
      console.log(`[API] Razorpay order created: ID=${order.id}`);

      // Store the razorpayOrderId in the booking record
      await storage.updateBooking(bookingId, { razorpayOrderId: order.id });
      console.log(`[API] Stored Razorpay Order ID ${order.id} in booking ${bookingId}`);

      // Return order details needed by Razorpay checkout on the client
      res.json({ 
        id: order.id, 
        amount: order.amount, 
        currency: order.currency, 
        booking // Include booking details for context on the client
      });

    } catch (error) {
      console.error("Error initiating payment:", error);
      // Check if the error is from Razorpay
      if (error instanceof Error && 'statusCode' in error) {
        const razorpayError = error as any; // Type assertion for Razorpay error
        console.error("Razorpay Error Details:", razorpayError.error);
        return res.status(razorpayError.statusCode || 500).json({ 
          message: razorpayError.error?.description || "Failed to initiate payment with payment gateway",
          code: razorpayError.error?.code
        });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to initiate payment" });
    }
  });

  // Process payment verification after Razorpay checkout
  app.post("/api/bookings/:id/payment", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
      const bookingId = parseInt(req.params.id);
      
      console.log(`[API] Processing payment for booking: ID=${bookingId}, PaymentID=${razorpayPaymentId || 'N/A'}`);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        console.log(`[API] Booking not found: ID=${bookingId}`);
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify this booking belongs to the customer
      if (booking.customerId !== req.user!.id) {
        console.log(`[API] Not authorized to process payment: User=${req.user!.id}, Owner=${booking.customerId}`);
        return res.status(403).json({ message: "Not authorized to process payment for this booking" });
      }

      // Verify the booking is in 'completed' status
      if (booking.status !== "completed") {
        console.log(`[API] Invalid booking status for payment: ID=${bookingId}, Status=${booking.status}`);
        return res.status(400).json({ 
          message: "Only completed bookings can be paid",
          currentStatus: booking.status
        });
      }

      // Get service details
      const service = await storage.getService(booking.serviceId!);
      if (!service) {
        console.log(`[API] Service not found: ID=${booking.serviceId}`);
        return res.status(404).json({ message: "Service not found" });
      }

      // Verify payment if Razorpay is configured
      if (isRazorpayConfigured && razorpayPaymentId && razorpayOrderId && razorpaySignature) {
        console.log(`[API] Verifying Razorpay payment signature: OrderID=${razorpayOrderId}`);
        // Verify the payment signature
        const generatedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          console.log(`[API] Invalid payment signature: Expected=${generatedSignature}, Received=${razorpaySignature}`);
          return res.status(400).json({ message: "Invalid payment signature" });
        }
        console.log(`[API] Payment signature verified successfully`);
      }

      // Update booking payment status
      const updatedBooking = await storage.updateBooking(bookingId, {
        paymentStatus: "paid",
        razorpayPaymentId: razorpayPaymentId || booking.razorpayPaymentId
      });
      
      console.log(`[API] Booking payment status updated to paid: ID=${bookingId}`);
      
      // Process payment split using Razorpay Route
      try {
        const razorpayRoute = razorpayRouteService(storage);
        await razorpayRoute.processBookingPaymentSplit(bookingId, razorpayPaymentId || booking.razorpayPaymentId);
        console.log(`[API] Payment split processed successfully for booking: ID=${bookingId}`);
      } catch (splitError) {
        console.error(`[API] Error processing payment split for booking ${bookingId}:`, splitError);
        // Continue with the payment process even if the split fails
        // We'll need to handle this case manually or implement a retry mechanism
      }
      
      const customer = await storage.getUser(booking.customerId!); // Add non-null assertion
      const provider = await storage.getUser(service.providerId!); // Add non-null assertion

      if (!customer || !provider) {
        console.error(`[API] Customer or Provider not found for booking ${bookingId} during payment. Skipping payment emails.`);
      } else {
        // Send "Service Payment Confirmed" email to customer
        const customerPaymentEmailContent = getServicePaymentConfirmedCustomerEmailContent(
          customer.name || customer.username,
          {
            bookingId: updatedBooking.id.toString(), // Ensure bookingId is a string
            serviceName: service.name,
            bookingDate: updatedBooking.bookingDate,
          },
          {
            amountPaid: service.price, // Corrected property name and use service.price
            paymentId: razorpayPaymentId || booking.razorpayPaymentId!,
          }
        );
        await sendEmail({
          to: customer.email,
          subject: customerPaymentEmailContent.subject,
          text: customerPaymentEmailContent.text,
          html: customerPaymentEmailContent.html,
        });
        console.log(`[API] 'Service Payment Confirmed' email sent to customer: ${customer.email}`);

        // Send "Payment Received for Service" email to provider
        const providerPaymentEmailContent = getServiceProviderPaymentReceivedEmailContent(
          provider.name || provider.username,
          {
            bookingId: updatedBooking.id.toString(), // Ensure bookingId is a string
            serviceName: service.name,
            bookingDate: updatedBooking.bookingDate,
          },
          {
            name: customer.name || customer.username, // Corrected property name for customerDetails
          },
          {
            amountReceived: service.price, // Corrected property name and use service.price
            paymentId: razorpayPaymentId || booking.razorpayPaymentId!,
          }
        );
        await sendEmail({
          to: provider.email,
          subject: providerPaymentEmailContent.subject,
          text: providerPaymentEmailContent.text,
          html: providerPaymentEmailContent.html,
        });
        console.log(`[API] 'Payment Received for Service' email sent to provider: ${provider.email}`);
      }

      // Create notification for service provider (in-app)
      await storage.createNotification({
        userId: service.providerId,
        type: "payment",
        title: "Payment Received",
        message: `Payment for booking #${bookingId} (${service.name}) has been received.`
      });
      console.log(`[API] Payment notification (in-app) sent to provider: ID=${service.providerId}`);
      
      // Create notification for customer (in-app)
      await storage.createNotification({
        userId: booking.customerId,
        type: "payment",
        title: "Payment Successful",
        message: `Your payment for ${service.name} has been processed successfully. Thank you for using our service!`
      });
      console.log(`[API] Payment confirmation notification (in-app) sent to customer: ID=${booking.customerId}`);

      res.json({
        success: true,
        booking: updatedBooking,
        message: "Payment processed successfully"
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to process payment" });
    }
  });

  // Get bookings for customer
  app.get("/api/bookings", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const bookings = await storage.getBookingsByCustomer(req.user!.id);
      
      // Enrich bookings with service details
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          const service = await storage.getService(booking.serviceId!);
          const provider = (service && service.providerId !== null) ? await storage.getUser(service.providerId) : null; // Fetch provider details

          // Determine which address to show the customer
          let displayAddress = null;
          if (booking.serviceLocation === 'provider') {
            displayAddress = booking.providerAddress || 
                             (provider ? `${provider.addressStreet || ''}, ${provider.addressCity || ''}, ${provider.addressState || ''}`.trim().replace(/^, |, $/g, '') : 'Provider address not available');
          } else if (booking.serviceLocation === 'customer') {
            // Customer already knows their own address, no need to display it here
            displayAddress = 'Service at your location';
          }
          return {
            ...booking,
            service: service || { name: "Unknown Service" },
            providerName: provider?.name || 'Unknown Provider', // Add provider name
            displayAddress: displayAddress // Add the determined address
          };
        })
      );
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error("Error fetching customer bookings:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch bookings" });
    }
  });

  // Get bookings for provider
  app.get("/api/bookings/provider", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const bookings = await storage.getBookingsByProvider(req.user!.id);
      
      // Enrich bookings with service details
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          const service = await storage.getService(booking.serviceId!);
          const provider = (service && service.providerId !== null) ? await storage.getUser(service.providerId) : null; // Fetch provider details

          // Determine which address to show the customer
          let displayAddress = null;
          if (booking.serviceLocation === 'provider') {
            displayAddress = booking.providerAddress ||
                     (provider
                       ? `${provider.addressStreet || ''}, ${provider.addressCity || ''}, ${provider.addressState || ''}`.trim().replace(/^, |, $/g, '')
                       : 'Provider address not available');
          } else if (booking.serviceLocation === 'customer') {
            // Customer already knows their own address, no need to display it here
            displayAddress = 'Service at your location';
          }
          const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null;

          // No need for customerContact object anymore, just return the full customer object

          return {
            ...booking,
            service: service || { name: "Unknown Service" },
            customer: customer // Return the full customer object
          };
        })
      );
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error("Error fetching provider bookings:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch bookings" });
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
      const service = await storage.getService(booking.serviceId!);
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
    try {
      const result = insertReviewSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      
      // Check if user has already reviewed this service for this booking
      if (result.data.serviceId == null) {
        return res.status(400).json({ message: "Invalid or missing serviceId" });
      }
      const existingReviews = await storage.getReviewsByService(result.data.serviceId);
      const userReview = existingReviews.find(r => 
        r.customerId === req.user!.id && 
        r.bookingId === result.data.bookingId
      );
      
      if (userReview) {
        // Return 409 Conflict for duplicate review attempts
        return res.status(409).json({ 
          message: "You have already reviewed this booking. You can edit your existing review."
        });
      }
      
      const review = await storage.createReview({
        ...result.data,
        customerId: req.user!.id,
      });
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create review" });
    }
  });

  // Add endpoint to update an existing review
  app.patch("/api/reviews/:id", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      const { rating, review } = req.body;
      
      // Verify the review belongs to this user
      const existingReview = await storage.getReviewById(reviewId);
      if (!existingReview) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      if (existingReview.customerId !== req.user!.id) {
        return res.status(403).json({ message: "You can only edit your own reviews" });
      }
      
      // Update the review
      const updatedReview = await storage.updateReview(reviewId, { rating, review });
      res.json(updatedReview);
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update review" });
    }
  });

  app.get("/api/reviews/service/:id", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsByService(parseInt(req.params.id));
    res.json(reviews);
  });

  app.get("/api/reviews/provider/:id", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsByProvider(parseInt(req.params.id));
    res.json(reviews);
  });

  // Add endpoint for service providers to reply to reviews
  app.post("/api/reviews/:id/reply", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const { response } = req.body;
      const reviewId = parseInt(req.params.id);
      
      // Get the review
      const review = await storage.getReviewById(reviewId);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      // Get the service to verify ownership
      const service = await storage.getService(review.serviceId!);
      if (!service || service.providerId !== req.user!.id) {
        return res.status(403).json({ message: "You can only reply to reviews for your own services" });
      }
      
      // Update the review with the provider's reply
      const updatedReview = await storage.updateReview(reviewId, { providerReply: response } as any);
      res.json(updatedReview);
    } catch (error) {
      console.error("Error replying to review:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to reply to review" });
    }
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

  app.patch("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    const { role } = req.body;
    // Pass both user ID and role to properly filter notifications
    await storage.markAllNotificationsAsRead(req.user!.id, role);
    res.sendStatus(200);
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    await storage.deleteNotification(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Order Management
  app.post("/api/orders", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const orderSchema = z.object({
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
          price: z.string().or(z.number()),
        })),
        total: z.string().or(z.number()),
        subtotal: z.string().or(z.number()).optional(),
        discount: z.string().or(z.number()).optional(),
        promotionId: z.number().optional(),
      });

      const result = orderSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const { items, total, subtotal, discount, promotionId } = result.data;

      // Validate that all products exist and have sufficient stock
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product with ID ${item.productId} not found` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for product: ${product.name}` });
        }
      }

      // Get the shop ID from the first product
      const firstProduct = await storage.getProduct(items[0].productId);
      if (!firstProduct) {
        return res.status(400).json({ message: "Product not found" });
      }
      const shopId = firstProduct.shopId;

      // If a promotion is applied, verify it's valid
      let promotionCode = null;
      if (promotionId) {
        const promotionResult = await db.select().from(promotions).where(eq(promotions.id, promotionId));
        if (!promotionResult.length) {
          return res.status(400).json({ message: "Invalid promotion" });
        }
        
        const promotion = promotionResult[0];
        
        // Verify promotion belongs to the shop
        if (promotion.shopId !== shopId) {
          return res.status(400).json({ message: "Promotion does not apply to this shop" });
        }
        
        // Verify promotion is active and not expired
        const now = new Date();
        if (
          !promotion.isActive ||
          promotion.startDate > now ||
          (promotion.endDate && promotion.endDate < now)
        ) {
          return res.status(400).json({ message: "Promotion is not active or has expired" });
        }
        
        // Verify usage limit
        if (promotion.usageLimit && (promotion.usedCount ?? 0) >= promotion.usageLimit) {
          return res.status(400).json({ message: "This promotion has reached its usage limit" });
        }
        
        promotionCode = promotion.code || null;
      }

      // Initialize Razorpay Route service
      const razorpayRoute = razorpayRouteService(storage);
      
      // Calculate the total amount including the platform fee
      const originalAmount = parseFloat(total.toString());
      const totalWithFee = razorpayRoute.calculateTotalWithCustomerFee(originalAmount);

      // Create Razorpay order
      let order;
      try {
        // Check if Razorpay is properly configured
        if (!isRazorpayConfigured) {
          console.error("Razorpay is not properly configured. Please check your API keys.");
          return res.status(500).json({ message: "Payment gateway not configured. Please contact the administrator." });
        }
        
        order = await razorpay.orders.create({
          amount: Math.round(totalWithFee * 100), // Convert to paisa
          currency: "INR",
          receipt: `order_${Date.now()}`,
          notes: {
            originalAmount: originalAmount.toString(),
            platformFee: "3", // Fixed 3rs platform fee for customer
            totalWithFee: totalWithFee.toString()
          }
        });
      } catch (error) {
        console.error("Razorpay order creation error:", error);
        return res.status(500).json({ message: "Failed to create payment order. Please try again later." });
      }

      const newOrder = await storage.createOrder({
        customerId: req.user!.id,
        shopId,
        status: "pending",
        paymentStatus: "pending",
        total: total.toString(),
        razorpayOrderId: order.id,
        orderDate: new Date(),
        shippingAddress: "",
        billingAddress: "",
      });

      // Create order items
      for (const item of items) {
        await storage.createOrderItem({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price.toString(),
          total: (parseFloat(item.price.toString()) * item.quantity).toString(),
        });

        // Update product stock
        await storage.updateProductStock(item.productId, item.quantity);
      }

      // Clear cart after order creation
      await storage.clearCart(req.user!.id);

      // Send order confirmation emails
      try {
        const customer = req.user!;
        if (shopId === null) {
          return res.status(400).json({ message: "Shop information is missing" });
        }
        const shop = await storage.getUser(shopId); // Assuming shop owner is a user

        if (customer) {
          const customerEmailContent = getOrderConfirmationEmailContent(customer.name || customer.username, { orderId: newOrder.id, total: newOrder.total, items });
          await sendEmail({
            to: customer.email,
            subject: customerEmailContent.subject,
            text: customerEmailContent.text,
            html: customerEmailContent.html,
          });
        }

        if (shop) {
          const shopEmailContent = getOrderConfirmationEmailContent(shop.name || shop.username, { orderId: newOrder.id, total: newOrder.total, items, customerName: customer.name || customer.username }, true);
          await sendEmail({
            to: shop.email,
            subject: shopEmailContent.subject,
            text: shopEmailContent.text,
            html: shopEmailContent.html,
          });
        }
      } catch (emailError) {
        console.error("Error sending order confirmation emails:", emailError);
        // Don't let email failure break the order creation flow
      }

      res.status(201).json({ order: newOrder, razorpayOrder: order });
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create order" });
    }
  });

  app.post("/api/orders/:id/payment", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
      const orderId = parseInt(req.params.id);
      
      console.log(`[API] Processing payment for order: ID=${orderId}, PaymentID=${razorpayPaymentId || 'N/A'}`);

      // Verify payment if Razorpay is configured
      if (isRazorpayConfigured && razorpayPaymentId && razorpayOrderId && razorpaySignature) {
        console.log(`[API] Verifying Razorpay payment signature: OrderID=${razorpayOrderId}`);
        // Verify the payment signature
        const generatedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          console.log(`[API] Invalid payment signature: Expected=${generatedSignature}, Received=${razorpaySignature}`);
          return res.status(400).json({ message: "Invalid payment signature" });
        }
        console.log(`[API] Payment signature verified successfully`);
      }

      // Update order payment status
      const order = await storage.updateOrder(orderId, {
        razorpayPaymentId,
        status: "confirmed",
        paymentStatus: "paid",
      });
      
      console.log(`[API] Order payment status updated to paid: ID=${orderId}`);
      
      // Process payment split using Razorpay Route
      try {
        const razorpayRoute = razorpayRouteService(storage);
        await razorpayRoute.processOrderPaymentSplit(orderId, razorpayPaymentId);
        console.log(`[API] Payment split processed successfully for order: ID=${orderId}`);
      } catch (splitError) {
        console.error(`[API] Error processing payment split for order ${orderId}:`, splitError);
        // Continue with the payment process even if the split fails
        // We'll need to handle this case manually or implement a retry mechanism
      }

      // Create notification for customer
      await storage.createNotification({
        userId: order.customerId,
        type: "order",
        title: "Order Confirmed",
        message: "Your order has been confirmed and will be processed soon.",
      });
      
      // Create notification for shop
      await storage.createNotification({
        userId: order.shopId,
        type: "order",
        title: "New Order Received",
        message: `You have received a new order (#${orderId}). Please process it soon.`,
      });

      res.json({
        success: true,
        order,
        message: "Payment processed successfully"
      });
    } catch (error) {
      console.error("Error processing order payment:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to process payment" });
    }
  });

  app.get("/api/orders/customer", requireAuth, requireRole(["customer"]), async (req, res) => {
    const orders = await storage.getOrdersByCustomer(req.user!.id);
    res.json(orders);
  });

  app.get("/api/orders/shop", requireAuth, requireRole(["shop"]), async (req, res) => {
    const orders = await storage.getOrdersByShop(req.user!.id);
    res.json(orders);
  });

  // Razorpay Route - Vendor Onboarding
  app.post("/api/razorpay/onboard", requireAuth, requireRole(["shop", "provider"]), async (req, res) => {
    try {
      const userId = req.user!.id;
      const { bankDetails } = req.body;
      
      // Validate bank details
      if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
        return res.status(400).json({ message: "Bank details are required for onboarding" });
      }
      
      // Initialize Razorpay Route service
      const razorpayRoute = razorpayRouteService(storage);
      
      // Create linked account
      const linkedAccount = await razorpayRoute.createLinkedAccount(userId, bankDetails);
      
      res.json({
        success: true,
        message: "Successfully onboarded to Razorpay Route",
        linkedAccountId: linkedAccount.id
      });
    } catch (error) {
      console.error("Error onboarding vendor to Razorpay Route:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to onboard vendor" });
    }
  });
  
  // Get Razorpay Route onboarding status
  app.get("/api/razorpay/onboard-status", requireAuth, requireRole(["shop", "provider"]), async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        isOnboarded: !!user.razorpayLinkedAccountId,
        linkedAccountId: user.razorpayLinkedAccountId || null
      });
    } catch (error) {
      console.error("Error getting onboarding status:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get onboarding status" });
    }
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
      status: "accepted",
    });

    // Send confirmation notifications
    const customer = booking.customerId !== null ? await storage.getUser(booking.customerId) : null;
    if (customer) {
      // Create in-app notification
      await storage.createNotification({
        userId: customer.id,
        type: "booking",
        title: "Booking Confirmed",
        message: `Your booking for ${formatIndianDisplay(booking.bookingDate, 'date')} has been confirmed.`, // Use formatIndianDisplay
      });

      // Send SMS notification
      await storage.sendSMSNotification(
        customer.phone,
        `Your booking for ${formatIndianDisplay(booking.bookingDate, 'date')} has been confirmed.` // Use formatIndianDisplay
      );

      // Send email notification
      await storage.sendEmailNotification(
        customer.email,
        "Booking Confirmation",
        `Your booking for ${formatIndianDisplay(booking.bookingDate, 'date')} has been confirmed.` // Use formatIndianDisplay
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
        const customer = order.customerId !== null ? await storage.getUser(order.customerId) : undefined;
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
      const returnRequest = await (storage as any).createReturnRequest({
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
        // Ensure order.customerId is not null before fetching customer
        const customer = order.customerId !== null ? await storage.getUser(order.customerId) : null;
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
    try {
      const { 
        category,
        minPrice,
        maxPrice,
        tags, // comma-separated string
        searchTerm,
        shopId,
        attributes // JSON string for specific attributes e.g. {"color":"red", "size":"M"}
      } = req.query;

      const filters: any = {};
      if (category) filters.category = String(category);
      if (minPrice) filters.minPrice = parseFloat(String(minPrice));
      if (maxPrice) filters.maxPrice = parseFloat(String(maxPrice));
      if (tags) filters.tags = String(tags).split(',').map(tag => tag.trim()).filter(tag => tag);
      if (searchTerm) filters.searchTerm = String(searchTerm);
      if (shopId) filters.shopId = parseInt(String(shopId));
      if (attributes) {
        try {
          filters.attributes = JSON.parse(String(attributes));
        } catch (e) {
          console.error("Failed to parse product attributes filter", e);
          // Optionally return a 400 error or ignore the filter
        }
      }

      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch products" });
    }
  });

  // Get a specific product by shop ID and product ID
  app.get("/api/shops/:shopId/products/:productId", requireAuth, async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const productId = parseInt(req.params.productId);
      const product = await storage.getProduct(productId);

      if (!product || product.shopId !== shopId) {
        return res.status(404).json({ message: "Product not found in this shop" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch product" });
    }
  });

  // Get shop details by ID
  app.get("/api/shops/:shopId", requireAuth, async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await storage.getUser(shopId);

      if (!shop || shop.role !== 'shop') {
        return res.status(404).json({ message: "Shop not found" });
      }
      // Return only necessary public shop info
      res.json({
        id: shop.id,
        name: shop.name,
        shopProfile: shop.shopProfile,
        // Add other relevant public fields if needed
      });
    } catch (error) {
      console.error("Error fetching shop details:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch shop details" });
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

      try {
        // First, remove the product from all carts to avoid foreign key constraint violations
        console.log(`Removing product ${productId} from all carts before deletion`);
        await storage.removeProductFromAllCarts(productId);
        
        // Then delete the product
        console.log(`Deleting product with ID: ${productId}`);
        await storage.deleteProduct(productId);
        console.log(`Product ${productId} deleted successfully`);
        res.status(200).json({ message: "Product deleted successfully" });
      } catch (deleteError) {
        console.error(`Error during product deletion process: ${deleteError}`);
        res.status(400).json({ 
          message: deleteError instanceof Error ? 
            deleteError.message : 
            "Failed to delete product. It may be referenced in orders or other records."
        });
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to delete product" });
    }
  });

  // Product Reviews
  app.get("/api/reviews/product/:id", requireAuth, async (req, res) => {
    try {
      const reviews = await storage.getReviewsByProvider(parseInt(req.params.id));
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching product reviews:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews/product/:id/reply", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const { reply } = req.body;
      const reviewId = parseInt(req.params.id);
      const existingReview = await storage.getReviewById(reviewId);
      if (!existingReview) {
        return res.status(404).json({ message: "Review not found" });
      }
      if (existingReview.serviceId === null) {
        return res.status(400).json({ message: "The review does not have a valid serviceId." });
      }
      const product = await storage.getProduct(existingReview.serviceId);
      if (!product || product.shopId !== req.user!.id) {
        return res.status(403).json({ message: "You can only reply to reviews for your own products" });
      }
      const review = await storage.updateReview(reviewId, { providerReply: reply } as any);
      res.json(review);
    } catch (error) {
      console.error("Error replying to review:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to reply to review" });
    }
  });

  // Promotions Management
  app.post("/api/promotions", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      // Define a Zod schema for the promotion with expiryDays
      const promotionWithExpirySchema = z.object({
        name: z.string().min(1, "Promotion name is required"),
        description: z.string().optional(),
        type: z.enum(["percentage", "fixed_amount"]),
        value: z.coerce.number().min(0, "Discount value must be positive"),
        code: z.string().optional(),
        usageLimit: z.coerce.number().min(0).default(0),
        isActive: z.boolean().default(true),
        shopId: z.coerce.number().optional(),
        expiryDays: z.coerce.number().min(0).default(0)
      });
      
      // Validate the request body
      const result = promotionWithExpirySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      
      // Extract validated data
      const { expiryDays, ...promotionData } = result.data;
      
      // Set startDate to current time
      const startDate = new Date();
      
      // Calculate endDate based on expiryDays
      let endDate = null;
      if (expiryDays > 0) {
        const calculatedEndDate = new Date();
        calculatedEndDate.setDate(calculatedEndDate.getDate() + expiryDays);
        endDate = calculatedEndDate;
      }

      console.log('Creating promotion with calculated dates:', { 
        startDate, 
        endDate, 
        expiryDays 
      });

      const promotion = await storage.createPromotion({
        ...promotionData,
        value: promotionData.value.toString(),
        shopId: req.user!.id,
        startDate,
        endDate,
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
  
  app.patch("/api/promotions/:id", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const promotionId = parseInt(req.params.id);
      
      // Get the existing promotion to check ownership
      const existingPromotions = await storage.getPromotionsByShop(req.user!.id);
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
        expiryDays: z.coerce.number().min(0).optional()
      });
      
      // Validate the request body
      const result = promotionUpdateSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      
      // Extract validated data
      const { expiryDays, ...updateData } = result.data;
      
      // Always set startDate to current time for updates
      (updateData as any).startDate = new Date();
      
      // Calculate endDate based on expiryDays
      if (expiryDays !== undefined) {
        if (expiryDays === 0) {
          (updateData as any).endDate = null;
        } else {
          const calculatedEndDate = new Date();
          calculatedEndDate.setDate(calculatedEndDate.getDate() + expiryDays);
          (updateData as any).endDate = calculatedEndDate;
        }
      }
      
      // Update the promotion using the same storage method as other entities
      const updatedResult = await db.update(promotions)
        .set({
          ...updateData,
          value: updateData.value !== undefined ? updateData.value.toString() : updateData.value,
        })
        .where(eq(promotions.id, promotionId))
        .returning();
      
      if (!updatedResult[0]) {
        return res.status(404).json({ message: "Failed to update promotion" });
      }
      
      res.json(updatedResult[0]);
    } catch (error) {
      console.error("Error updating promotion:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update promotion" });
    }
  });

  // Register promotion routes
  registerPromotionRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}