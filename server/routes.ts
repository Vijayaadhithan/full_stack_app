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
} from './emailService'; 
import * as emailService from './emailService';// Added for sending emails
import { storage } from "./storage";
import { z } from "zod";
import {
  insertServiceSchema,
  insertBookingSchema,
  insertProductSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertReviewSchema,
  insertUserSchema,
  insertNotificationSchema,
  insertReturnRequestSchema,
  InsertReturnRequest,
  ReturnRequest,
  insertProductReviewSchema,
  insertPromotionSchema,
  insertBlockedTimeSlotSchema, // Added import
  promotions, // Import promotions table for direct updates
  users, // Import the users table schema
  reviews,
  User
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import crypto from 'crypto';
import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility
import { registerPromotionRoutes } from "./routes/promotions"; // Import promotion routes
//import { registerShopRoutes } from "./routes/shops"; // Import shop routes

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
  // Endpoint to list all available API routes
  app.get("/api", (req, res) => {
    const routes = app._router.stack
      .filter((r: any) => r.route && r.route.path)
      .map((r: any) => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods).join(", ").toUpperCase(),
      }))
      .filter((r: any) => r.path.startsWith("/api/") && r.path !== "/api"); // Filter for API routes and exclude itself
    res.json({ available_endpoints: routes });
  });

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

  // Accept, reject, or reschedule a booking request
  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      // Destructure bookingDate as well, it might be undefined if not a reschedule
      const { status, comments, bookingDate, changedBy } = req.body;
      const currentUser = req.user!;

      console.log(`[API] Attempting to update booking ${bookingId} with data:`, req.body);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        console.log(`[API] Booking ${bookingId} not found.`);
        return res.status(404).json({ message: "Booking not found" });
      }

      const service = await storage.getService(booking.serviceId!);
      if (!service) {
        console.log(`[API] Service ${booking.serviceId} for booking ${bookingId} not found.`);
        return res.status(404).json({ message: "Service not found for this booking" });
      }

      let updatedBookingData = {};
      let notificationPromises = [];
      let emailPromise = Promise.resolve(); // To avoid undefined errors if no email is sent

      // Scenario 1: Customer reschedules
      if (bookingDate && currentUser.role === "customer" && booking.customerId === currentUser.id) {
        console.log(`[API] Customer ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`);
        const originalBookingDate = booking.bookingDate; // Capture original booking date
        updatedBookingData = {
          bookingDate: new Date(bookingDate),
          status: "rescheduled_pending_provider_approval",
          comments: comments || "Rescheduled by customer",
        };

        if (service.providerId) {
          const providerUser = await storage.getUser(service.providerId);
          if (providerUser) {
            notificationPromises.push(
              storage.createNotification({
                userId: service.providerId,
                type: "booking_rescheduled_request",
                title: "Reschedule Request",
                message: `Customer ${currentUser.name || 'ID: '+currentUser.id} requested to reschedule booking #${bookingId} for '${service.name}' to ${new Date(bookingDate).toLocaleString()}. Please review.`,
                isRead: false,
                relatedBookingId: bookingId,
              })
            );
            if (providerUser.email) {
              emailPromise = emailService.sendBookingRescheduledByCustomerEmail(providerUser.email, {
                providerName: providerUser.name || 'Provider',
                customerName: currentUser.name || 'Customer',
                serviceName: service.name,
                originalBookingDate: originalBookingDate ? new Date(originalBookingDate).toLocaleString() : 'N/A',
                newBookingDate: new Date(bookingDate).toLocaleString(),
                bookingId: bookingId.toString(),
                loginUrl: `${process.env.APP_BASE_URL}/login`,
                bookingDetailsUrl: `${process.env.APP_BASE_URL}/provider/bookings`
              }).then(() => {}).catch((err: unknown) => console.error("[API] Failed to send reschedule request email to provider:", err));
            }
          }
        }
      }
      // Scenario 2: Provider reschedules
      else if (bookingDate && currentUser.role === "provider" && service.providerId === currentUser.id) {
        console.log(`[API] Provider ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`);
        const originalBookingDate = booking.bookingDate; // Capture original booking date
        updatedBookingData = {
          bookingDate: new Date(bookingDate),
          status: "rescheduled_by_provider", // Or a more appropriate status like "accepted" if provider reschedule implies auto-acceptance
          comments: comments || "Rescheduled by provider",
        };

        if (booking.customerId) {
          const customerUser = await storage.getUser(booking.customerId);
          if (customerUser) {
            notificationPromises.push(
              storage.createNotification({
                userId: booking.customerId,
                type: "booking_rescheduled_by_provider",
                title: "Booking Rescheduled by Provider",
                message: `Provider ${currentUser.name || 'ID: '+currentUser.id} has rescheduled your booking #${bookingId} for '${service.name}' to ${new Date(bookingDate).toLocaleString()}. ${comments ? 'Comments: ' + comments : ''}`,
                isRead: false,
                relatedBookingId: bookingId,
              })
            );
            if (customerUser.email) {
              emailPromise = emailService.sendBookingRescheduledByProviderEmail(customerUser.email, {
                customerName: customerUser.name || 'Customer',
                providerName: currentUser.name || 'Provider',
                serviceName: service.name,
                originalBookingDate: originalBookingDate ? new Date(originalBookingDate).toLocaleString() : 'N/A',
                newBookingDate: new Date(bookingDate).toLocaleString(),
                bookingId: bookingId.toString(),
                comments: comments || undefined,
                loginUrl: `${process.env.BASE_URL}/login`,
                bookingDetailsUrl: `${process.env.BASE_URL}/customer/bookings` 
              }).then(() => {}).catch((err: unknown) => console.error("[API] Failed to send reschedule by provider email to customer:", err));
            }
          }
        }
      }
      // Scenario 3: Provider accepts/rejects a booking (including a customer's reschedule request)
      else if (status && currentUser.role === "provider" && service.providerId === currentUser.id) {
        console.log(`[API] Provider ${currentUser.id} updating booking ${bookingId} status to ${status}`);
        updatedBookingData = {
          status,
          comments: comments || (status === "accepted" ? "Booking confirmed" : "Booking rejected"),
        };

        if (booking.customerId) {
          const customerUser = await storage.getUser(booking.customerId);
          if (customerUser) {
            let notificationTitle = `Booking ${status === "accepted" ? "Accepted" : "Rejected"}`;
            let notificationMessage = `Your booking for '${service.name}' has been ${status}${comments ? `: ${comments}` : "."}`;
            let emailSubject = `Booking ${status === "accepted" ? "Accepted" : "Rejected"}`;

            if (booking.status === 'rescheduled_pending_provider_approval' && status === 'accepted') {
              notificationTitle = "Reschedule Confirmed";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been accepted. New date: ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleString() : 'N/A'}`;
              emailSubject = "Reschedule Confirmed";
            } else if (booking.status === 'rescheduled_pending_provider_approval' && status === 'rejected') {
              notificationTitle = "Reschedule Rejected";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been rejected. ${comments ? comments : 'Please contact the provider or try rescheduling again.'}`;
              emailSubject = "Reschedule Rejected";
            }

            notificationPromises.push(
              storage.createNotification({
                userId: booking.customerId,
                type: status === "accepted" ? "booking_confirmed" : "booking_rejected",
                title: notificationTitle,
                message: notificationMessage,
                isRead: false,
                relatedBookingId: bookingId,
              })
            );
            if (customerUser.email) {
              emailPromise = emailService.sendBookingUpdateEmail(customerUser.email, {
                customerName: customerUser.name || 'Customer',
                serviceName: service.name,
                bookingStatus: status,
                bookingDate: booking.bookingDate ? new Date(booking.bookingDate).toLocaleString() : 'N/A',
                bookingId: bookingId.toString(),
                providerName: currentUser.name || 'Provider',
                comments: comments || '',
                subject: emailSubject,
                loginUrl: `${process.env.BASE_URL}/login`,
                bookingDetailsUrl: `${process.env.BASE_URL}/customer/bookings`
              }).then(() => {}).catch((err: unknown) => console.error("[API] Failed to send booking update email to customer:", err));
            }
          }
        }
      } 
      // Scenario 3: Customer cancels (can be expanded)
      else if (status === "cancelled" && currentUser.role === "customer" && booking.customerId === currentUser.id) {
        console.log(`[API] Customer ${currentUser.id} cancelling booking ${bookingId}`);
        updatedBookingData = {
            status: "cancelled",
            comments: comments || "Cancelled by customer",
        };
        if (service.providerId) {
            const providerUser = await storage.getUser(service.providerId);
            if (providerUser) {
                notificationPromises.push(
                    storage.createNotification({
                        userId: service.providerId,
                        type: "booking_cancelled_by_customer",
                        title: "Booking Cancelled",
                        message: `Booking #${bookingId} for '${service.name}' has been cancelled by the customer.`,
                        isRead: false,
                        relatedBookingId: bookingId,
                    })
                );
                // Optional: Email to provider about cancellation
                if(providerUser.email){
                    // emailService.sendBookingCancelledByCustomerEmail(...)
                }
            }
        }
      } else {
        console.log(`[API] Unauthorized or invalid action for booking ${bookingId} by user ${currentUser.id} with role ${currentUser.role}. Booking owner: ${booking.customerId}, Service provider: ${service.providerId}`);
        return res.status(403).json({ message: "Unauthorized or invalid action specified" });
      }

      const finalUpdatedBooking = await storage.updateBooking(bookingId, updatedBookingData);
      await Promise.all(notificationPromises);
      await emailPromise; // Wait for email to be processed
      
      console.log(`[API] Successfully updated booking ${bookingId}:`, finalUpdatedBooking);
      res.json(finalUpdatedBooking);

    } catch (error) {
      console.error(`[API] Error updating booking ${req.params.id}:`, error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update booking" });
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

  // Report a dispute on an awaiting payment booking
  app.post('/api/bookings/:id/report-dispute', requireAuth, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { reason } = req.body;
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.status !== 'awaiting_payment') return res.status(400).json({ message: 'Booking not awaiting payment' });
      if (booking.customerId !== req.user!.id && (await storage.getService(booking.serviceId!))?.providerId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      const updated = await storage.updateBooking(bookingId, { status: 'disputed', disputeReason: reason });
      res.json({ booking: updated });
    } catch (error) {
      console.error('Error reporting dispute:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to report dispute' });
    }
  });

  // Admin resolves disputed booking
  app.patch('/api/admin/bookings/:id/resolve', requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { resolutionStatus } = req.body as { resolutionStatus: 'completed' | 'cancelled' };
      if (!['completed','cancelled'].includes(resolutionStatus)) return res.status(400).json({ message: 'Invalid resolutionStatus' });
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.status !== 'disputed') return res.status(400).json({ message: 'Booking not disputed' });
      const updated = await storage.updateBooking(bookingId, { status: resolutionStatus });
      res.json({ booking: updated });
    } catch (error) {
      console.error('Error resolving dispute:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to resolve dispute' });
    }
  });

  // Admin list disputes
  app.get('/api/admin/disputes', requireAuth, requireRole(["admin"]), async (_req, res) => {
    try {
      const disputes = await storage.getBookingsByStatus('disputed');
      res.json(disputes);
    } catch (error) {
      console.error('Error fetching disputes:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to fetch disputes' });
    }
  });

  // Shop Profile Management
  const profileUpdateSchema = insertUserSchema.partial().extend({
    upiId: z.string().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/).optional().nullable(),
    upiQrCodeUrl: z.string().optional().nullable(),
    pickupAvailable: z.boolean().optional(),
    deliveryAvailable: z.boolean().optional(),
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (userId !== req.user!.id) {
        return res.status(403).json({ message: "Can only update own profile" });
      }

      const result = profileUpdateSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

     // Allow both providers and shops to update UPI fields
      if (!['provider', 'shop'].includes(req.user!.role)) {
        delete (result.data as any).upiId;
        delete (result.data as any).upiQrCodeUrl;
      }
      
      // Sanitize paymentMethods to ensure it's an array of PaymentMethod, null, or undefined
      let updateData: Partial<User> = { ...result.data } as Partial<User>;
      if ('paymentMethods' in updateData) {
        if (
          updateData.paymentMethods == null ||
          Array.isArray(updateData.paymentMethods)
        ) {
          // Already valid: array, null, or undefined
        } else if (
          typeof updateData.paymentMethods === 'object' &&
          updateData.paymentMethods !== null &&
          Array.isArray(updateData.paymentMethods)
        ) {
          // Already an array, filter out invalid entries
          updateData.paymentMethods = (updateData.paymentMethods as any[]).filter(
            (pm: any) =>
              pm &&
              typeof pm === 'object' &&
              typeof pm.type === 'string' &&
              typeof pm.details === 'object'
          );
        } else {
          // If it's not valid, set to undefined
          updateData.paymentMethods = undefined;
        }
      }
      if (updateData.shopProfile) {
        if (updateData.shopProfile.shippingPolicy === null) {
          delete updateData.shopProfile.shippingPolicy;
        }
        if (updateData.shopProfile.returnPolicy === null) {
          delete updateData.shopProfile.returnPolicy;
        }
      }
      const updatedUser = await storage.updateUser(userId, updateData);

      if (req.user) Object.assign(req.user, updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update user" });
    }
  });


  // Get all shops
  app.get("/api/shops", requireAuth, async (req, res) => {
    try {
      const { locationCity, locationState } = req.query;
      const filters: any = {};
      if (locationCity) filters.locationCity = String(locationCity);
      if (locationState) filters.locationState = String(locationState);

      const shops = await storage.getShops(filters);
      
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

      // Sanitize numeric fields to prevent 'undefined' string errors
      const numericFields = ["price", "mrp", "stock"];
      for (const field of numericFields) {
        if (updateData.hasOwnProperty(field) && updateData[field] === "undefined") {
          delete updateData[field];
        } else if (updateData.hasOwnProperty(field) && typeof updateData[field] === 'string' && updateData[field].trim() === '') {
          // Also remove if it's an empty string after trimming, as this can also cause issues for numeric types
          delete updateData[field];
        } else if (updateData.hasOwnProperty(field) && updateData[field] === null) {
          // Also remove if it's null
          delete updateData[field];
        }
      }

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
        locationState,
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
      if (locationState) filters.locationState = String(locationState);
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

      const booking = await storage.createBooking({
        customerId: req.user!.id,
        serviceId,
        bookingDate: bookingDateTime,
        status: "pending",
        paymentStatus: "pending",
        serviceLocation,
      });

      await storage.createNotification({
        userId: service.providerId,
        type: "booking_request",
        title: "New Booking Request",
        message: `You have a new booking request for ${service.name}`,
      });


      // --- Razorpay Integration Logic (if configured) ---
      try {
        const customer = await storage.getUser(booking.customerId!);
        const provider = service.providerId !== null ? await storage.getUser(service.providerId) : null;
        if (customer && provider && customer.email && provider.email) {
          const customerAddress = booking.serviceLocation === 'customer'
            ? `${customer.addressStreet || ''} ${customer.addressCity || ''} ${customer.addressState || ''}`.trim() || 'Not specified'
            : 'Provider Location';
          const customerPhone = booking.serviceLocation === 'customer' ? customer.phone : undefined;

          const providerBookingEmailContent = getBookingConfirmationEmailContent(
            provider.name || provider.username,
            {
              bookingId: booking.id.toString(),
              customerName: customer.name || customer.username,
              serviceName: service.name,
              bookingDate: booking.bookingDate,
              customerAddress,
              customerPhone,
            }
          );
          await sendEmail({
            to: provider.email,
            subject: providerBookingEmailContent.subject,
            text: providerBookingEmailContent.text,
            html: providerBookingEmailContent.html,
          });
          const customerPendingEmailContent = getBookingRequestPendingEmailContent(
            customer.name || customer.username,
            {
              serviceName: service.name,
              bookingDate: booking.bookingDate,
              providerName: provider.name || provider.username,
            }
            );
          await sendEmail({
            to: customer.email,
            subject: customerPendingEmailContent.subject,
            text: customerPendingEmailContent.text,
            html: customerPendingEmailContent.html,
          });
          }
        } catch (fetchError) {
        console.error(`[API] Error sending booking emails (Booking ID: ${booking.id}):`, fetchError);
      }
      res.status(201).json({ booking, paymentRequired: false });
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create booking" });
    }
  });

  app.patch("/api/bookings/:id/status", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const { status, rejectionReason } = req.body;
      const bookingId = parseInt(req.params.id);

      console.log(`[API DEBUG] Attempting to update booking status. Booking ID: ${bookingId}, Received Status: ${status}, Received Rejection Reason: ${rejectionReason}`);

      const booking = await storage.getBooking(bookingId);
      console.log(`[API DEBUG] Fetched booking for ID ${bookingId}:`, booking ? `Found (Customer ID: ${booking.customerId})` : 'Not Found');
      if (!booking) {
        console.log(`[API DEBUG] Booking not found: ID=${bookingId}. Returning 404.`);
        return res.status(404).json({ message: "Booking not found" });
      }

      console.log(`[API DEBUG] Attempting to fetch service with ID: ${booking.serviceId} for authorization. Provider ID from token: ${req.user!.id}`);
      const service = await storage.getService(booking.serviceId!);
      console.log(`[API DEBUG] Fetched service for ID ${booking.serviceId}:`, service ? `Found (Provider ID: ${service.providerId})` : 'Not Found');
      if (!service || service.providerId !== req.user!.id) {
        console.log(`[API DEBUG] Authorization check failed for booking ID ${bookingId}. Service found: ${!!service}, Service Provider ID: ${service?.providerId}, Authenticated User ID: ${req.user!.id}. Returning 403.`);
        return res.status(403).json({ message: "Not authorized to update this booking" });
      }

      console.log(`[API DEBUG] Validating status for booking ID ${bookingId}. Status: ${status}`);
      // Validate status
      if (!['accepted', 'rejected', 'rescheduled'].includes(status)) {
        console.log(`[API DEBUG] Invalid status: ${status} for booking ID ${bookingId}. Returning 400.`);
        return res.status(400).json({ message: "Invalid status. Must be 'accepted', 'rejected', or 'rescheduled'" });
      }

      console.log(`[API DEBUG] Checking for rejection reason for booking ID ${bookingId}. Status: ${status}, Rejection Reason: ${rejectionReason}`);
      // Require rejection reason if status is rejected
      if (status === 'rejected' && !rejectionReason) {
        console.log(`[API DEBUG] Rejection reason is required but not provided for booking ID ${bookingId} (status: 'rejected'). Rejection Reason: '${rejectionReason}'. Returning 400.`);
        return res.status(400).json({ message: "Rejection reason is required when rejecting a booking" });
      }

      console.log(`[API DEBUG] All pre-update checks passed for booking ID ${bookingId}. Proceeding to update booking status.`);
      // Update booking status
      const updatedBooking = await storage.updateBooking(bookingId, {
        status,
        rejectionReason: status === "rejected" ? rejectionReason : null,
      });

      console.log(`[API PATCH /api/bookings/:id/status] Booking ID: ${bookingId}. Status updated to ${updatedBooking.status}. Customer email notifications are now handled by dedicated routes: /api/bookings/:id/notify-customer-accepted and /api/bookings/:id/notify-customer-rejected.`);
      // Email sending logic for customer acceptance/rejection has been removed from this route.
      // It is now handled by dedicated endpoints: POST /api/bookings/:id/notify-customer-accepted and POST /api/bookings/:id/notify-customer-rejected.

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

  app.get("/api/reviews/customer", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const customerId = req.user!.id;
      const customerReviews = await storage.getReviewsByCustomer(customerId);
      res.json(customerReviews);
    } catch (error) {
      console.error("Error fetching customer reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Endpoint for providers to confirm payment and complete booking
  app.patch("/api/bookings/:id/provider-complete", requireAuth, requireRole(["provider"]), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const service = await storage.getService(booking.serviceId!);
      if (!service || service.providerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Ensure the booking is in a state that can be completed by a provider (e.g., 'accepted')
      if (booking.status !== 'awaiting_payment') {
        return res.status(400).json({ message: 'Booking not awaiting payment' });
      }

      const updatedBooking = await storage.updateBooking(bookingId, { status: 'completed' });

      await storage.createNotification({
        userId: booking.customerId,
        type: 'booking_update',
        title: 'Payment Confirmed',
        message: `Provider confirmed payment for booking #${bookingId}.`
      });
      let customer: Awaited<ReturnType<typeof storage.getUser>> | undefined;
      if (booking.customerId) {
        customer = await storage.getUser(booking.customerId);
        if (customer?.email) {
          const mail = emailService.getServicePaymentConfirmedCustomerEmailContent(
            customer.name || customer.username,
            {
              bookingId: bookingId.toString(),
              serviceName: service.name,
              bookingDate: booking.bookingDate
            },
            {
              amountPaid: service.price,
              paymentId: booking.paymentReference || 'N/A'
            }
          );
          mail.to = customer.email;
          await sendEmail(mail);
        }
      }
      const provider = await storage.getUser(service.providerId!);
      if (provider?.email) {
        const mail = emailService.getServiceProviderPaymentReceivedEmailContent(
          provider.name || provider.username,
          {
            bookingId: bookingId.toString(),
            serviceName: service.name,
            bookingDate: booking.bookingDate
          },
          { name: customer?.name || customer?.username || 'Customer' },
          {
            amountReceived: service.price,
            paymentId: booking.paymentReference || 'N/A'
          }
        );
        mail.to = provider.email;
        await sendEmail(mail);
      }
      res.json({ booking: updatedBooking });
    } catch (error) {
      console.error("Error completing service by provider:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to complete service" });
    }
  });

  // New dedicated route for sending 'Booking Accepted' email to customer
  app.post("/api/bookings/:id/notify-customer-accepted", requireAuth, requireRole(["provider"]), async (req, res) => {
    const bookingId = req.params.id;
    console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Request received.`);
    try {
      const parsedBookingId = parseInt(bookingId);
      if (isNaN(parsedBookingId)) {
        console.error(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Invalid booking ID format.`);
        return res.status(400).json({ message: "Invalid booking ID format." });
      }

      const booking = await storage.getBooking(parsedBookingId);
      if (!booking) {
        console.error(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Booking not found.`);
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status !== "accepted") {
        console.warn(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Booking status is '${booking.status}', not 'accepted', but proceeding with email as requested by this route.`);
      }

      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching customer ID: ${booking.customerId}`);
      const customer = await storage.getUser(booking.customerId!);
      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched customer:`, customer ? { id: customer.id, name: customer.name, email: customer.email } : 'NOT FOUND');

      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching service details ID: ${booking.serviceId}`);
      const serviceDetails = await storage.getService(booking.serviceId!);
      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched serviceDetails:`, serviceDetails ? { id: serviceDetails.id, name: serviceDetails.name, providerId: serviceDetails.providerId } : 'NOT FOUND');

      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching provider ID: ${serviceDetails?.providerId}`);
      const provider = serviceDetails && serviceDetails.providerId !== null ? await storage.getUser(serviceDetails.providerId) : null;
      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched provider:`, provider ? { id: provider.id, name: provider.name } : 'NOT FOUND');

      if (!customer || !customer.email || !serviceDetails || !provider) {
        console.error(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Cannot send 'accepted' email: Essential data missing. Customer: ${!!customer}, Email: ${!!customer?.email}, Service: ${!!serviceDetails}, Provider: ${!!provider}.`);
        return res.status(500).json({ message: `Cannot send 'accepted' email: Essential data missing for booking ID ${bookingId}.` });
      }

      const emailContent = getBookingAcceptedEmailContent(
        customer.name || customer.username,
        { 
          serviceName: serviceDetails.name, 
          bookingDate: booking.bookingDate 
        },
        {
          name: provider.name || provider.username,
          location: serviceDetails.addressStreet ? `${serviceDetails.addressStreet}, ${serviceDetails.addressCity || ''}`.trim() : serviceDetails.addressCity || "Provider's Location"
        }
      );

      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Attempting 'Booking Accepted' email to ${customer.email}`);
      await sendEmail({
        to: customer.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
      console.log(`[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] 'Booking Accepted' email SENT to ${customer.email}`);

      res.status(200).json({ message: "Customer notification for booking acceptance has been queued." });
    } catch (error) {
      console.error(`[NEW ACCEPT EMAIL ROUTE ERROR - Booking ID: ${bookingId}]`, error);
      res.status(500).json({ message: "Failed to send acceptance email." });
    }
  });

  // New dedicated route for sending 'Booking Rejected' email to customer
  app.post("/api/bookings/:id/notify-customer-rejected", requireAuth, requireRole(["provider"]), async (req, res) => {
    const bookingId = req.params.id;
    const { rejectionReason } = req.body;
    console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Request received. Reason: ${rejectionReason || 'None'}`);
    try {
      const parsedBookingId = parseInt(bookingId);
      if (isNaN(parsedBookingId)) {
        console.error(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Invalid booking ID format.`);
        return res.status(400).json({ message: "Invalid booking ID format." });
      }

      const booking = await storage.getBooking(parsedBookingId);
      if (!booking) {
        console.error(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Booking not found.`);
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status !== "rejected") {
        console.warn(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Booking status is '${booking.status}', not 'rejected', but proceeding with email as requested by this route.`);
      }

      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching customer ID: ${booking.customerId}`);
      const customer = await storage.getUser(booking.customerId!);
      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched customer:`, customer ? { id: customer.id, name: customer.name, email: customer.email } : 'NOT FOUND');

      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching service details ID: ${booking.serviceId}`);
      const serviceDetails = await storage.getService(booking.serviceId!);
      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched serviceDetails:`, serviceDetails ? { id: serviceDetails.id, name: serviceDetails.name, providerId: serviceDetails.providerId } : 'NOT FOUND');

      // Provider data is not strictly needed for rejection email content but fetching for consistency / future use
      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching provider ID: ${serviceDetails?.providerId}`);
      const provider = serviceDetails && serviceDetails.providerId !== null ? await storage.getUser(serviceDetails.providerId) : null;
      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched provider:`, provider ? { id: provider.id, name: provider.name } : 'NOT FOUND');

      if (!customer || !customer.email || !serviceDetails) { // Provider is optional for rejection email content
        console.error(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Cannot send 'rejected' email: Essential data missing. Customer: ${!!customer}, Email: ${!!customer?.email}, Service: ${!!serviceDetails}.`);
        return res.status(500).json({ message: `Cannot send 'rejected' email: Essential data missing for booking ID ${bookingId}.` });
      }

      const finalRejectionReason = rejectionReason || booking.rejectionReason || 'No specific reason provided.';

      const emailContent = getBookingRejectedEmailContent(
        customer.name || customer.username,
        { 
          serviceName: serviceDetails.name, 
          bookingDate: booking.bookingDate 
        },
        finalRejectionReason
      );

      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Attempting 'Booking Rejected' email to ${customer.email}`);
      await sendEmail({
        to: customer.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
      console.log(`[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] 'Booking Rejected' email SENT to ${customer.email}`);

      res.status(200).json({ message: "Customer notification for booking rejection has been queued." });
    } catch (error) {
      console.error(`[NEW REJECT EMAIL ROUTE ERROR - Booking ID: ${bookingId}]`, error);
      res.status(500).json({ message: "Failed to send rejection email." });
    }
  });

  // Customer submits payment reference and marks booking awaiting provider confirmation
  app.patch("/api/bookings/:id/customer-complete", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const { paymentReference } = req.body;
      const bookingId = parseInt(req.params.id);
      
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.customerId !== req.user!.id) return res.status(403).json({ message: "Not authorized" });

      if (booking.status !== 'accepted') {
        return res.status(400).json({ message: 'Booking not confirmed' });
      }

      // Update booking status to completed
      const updatedBooking = await storage.updateBooking(bookingId, {
        status: 'awaiting_payment',
        paymentReference
      });
      
      
      await storage.createNotification({
        userId: (await storage.getService(booking.serviceId!))!.providerId,
        type: 'booking_update',
        title: 'Payment Submitted',
        message: `Customer submitted payment reference for booking #${bookingId}.`
      });
      const service = await storage.getService(booking.serviceId!);
      if (service?.providerId) {
        const provider = await storage.getUser(service.providerId);
        if (provider?.email) {
          const mail = emailService.getGenericNotificationEmailContent(
            provider.name,
            'Payment Submitted',
            `Customer submitted payment reference for booking #${bookingId}. Please confirm receipt.`
          );
          mail.to = provider.email;
          await sendEmail(mail);
        }
      }

      res.json({ booking: updatedBooking });
    } catch (error) {
      console.error("Error submitting payment:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to submit payment" });
    }
  });

  // Allow customer to update payment reference while awaiting provider confirmation
  app.patch("/api/bookings/:id/update-reference", requireAuth, requireRole(["customer"]), async (req, res) => {
    try {
      const { paymentReference } = req.body;
      const bookingId = parseInt(req.params.id);

      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.customerId !== req.user!.id) return res.status(403).json({ message: 'Not authorized' });
      if (booking.status !== 'awaiting_payment') return res.status(400).json({ message: 'Cannot update reference for this booking' });

      const updatedBooking = await storage.updateBooking(bookingId, { paymentReference });
      res.json({ booking: updatedBooking });
    } catch (error) {
      console.error('Error updating payment reference:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to update reference' });
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
            providerName: provider?.name || 'Unknown Provider',
            displayAddress: displayAddress,
            provider: provider
              ? {
                  id: provider.id,
                  name: provider.name,
                  phone: provider.phone,
                  upiId: (provider as any).upiId ?? null,
                  upiQrCodeUrl: (provider as any).upiQrCodeUrl ?? null,
                  addressStreet: provider.addressStreet,
                  addressCity: provider.addressCity,
                  addressState: provider.addressState,
                  addressPostalCode: provider.addressPostalCode,
                  addressCountry: provider.addressCountry,
                }
              : null,
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
    res.status(200).json({ message: "Payment functionality has been disabled." });
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
  app.post('/api/reviews', requireAuth, requireRole(['customer']), async (req, res) => {
  try {
    const result = insertReviewSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    
    const { serviceId, bookingId, rating, review } = result.data;

    if (!serviceId || !bookingId) {
      return res.status(400).json({ message: "Invalid or missing serviceId or bookingId" });
    }

    // More direct check for an existing review for the same booking by the same customer
    const booking = await storage.getBooking(bookingId);
    if (!booking || booking.customerId !== req.user!.id) {
        return res.status(403).json({ message: "You can only review your own bookings." });
    }

    const existingReview = await db.select().from(reviews).where(and(eq(reviews.customerId, req.user!.id), eq(reviews.bookingId, bookingId))).limit(1);

    if (existingReview.length > 0) {
      return res.status(409).json({ 
        message: "You have already reviewed this booking. You can edit your existing review."
      });
    }

    const service = await storage.getService(serviceId);
    if (!service || !service.providerId) throw new Error('Service not found');
    
    const newReview = await storage.createReview({
      customerId: req.user!.id,
      serviceId,
      bookingId,
      rating,
      review
    });

    await storage.updateProviderRating(service.providerId);
    res.status(201).json(newReview);
  } catch (error) {
    console.error('Error saving review:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to save review' });
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
        deliveryMethod: z.enum(["delivery", "pickup"]),
      });

      const result = orderSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const { items, total, subtotal, discount, promotionId, deliveryMethod } = result.data;

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

      // Payment gateway removed. Create the order directly without initiating payment.
      const originalAmount = parseFloat(total.toString());
      

      const newOrder = await storage.createOrder({
        customerId: req.user!.id,
        shopId,
        status: "pending",
        paymentStatus: "pending",
        deliveryMethod,
        total: total.toString(),
        orderDate: new Date(),
        shippingAddress: "",
        billingAddress: "",
      });
      console.log("Created order:", newOrder);
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
        // Build itemsWithNames for email
        const itemsWithNames = await Promise.all(
          items.map(async (item) => {
            const product = await storage.getProduct(item.productId);
            return {
              name: product?.name ?? "",
              quantity: item.quantity,
              price: item.price,
            };
          })
        );
        const customerEmailContent = getOrderConfirmationEmailContent(
          customer.name || customer.username,
          { orderId: newOrder.id, total: newOrder.total },
          itemsWithNames
        );
        await sendEmail({
          to: customer.email,
          subject: customerEmailContent.subject,
          text: customerEmailContent.text,
          html: customerEmailContent.html,
        });
      }

      if (shop) {
        // Use the same itemsWithNames for shop email
        const itemsWithNames = await Promise.all(
          items.map(async (item) => {
            const product = await storage.getProduct(item.productId);
            return {
              name: product?.name ?? "",
              quantity: item.quantity,
              price: item.price,
            };
          })
        );
        const shopEmailContent = getOrderConfirmationEmailContent(
          shop.name || shop.username,
          { orderId: newOrder.id, total: newOrder.total, customerName: customer.name || customer.username },
          itemsWithNames,
          true
        );
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

      res.status(201).json({ order: newOrder});
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create order" });
    }
  });

  app.post("/api/orders/:id/payment", requireAuth, requireRole(["customer"]), async (req, res) => {
    res.status(200).json({ message: "Payment functionality has been disabled." });
  });

  app.get("/api/orders/customer", requireAuth, requireRole(["customer"]), async (req, res) => {
    const orders = await storage.getOrdersByCustomer(req.user!.id);
    const detailed = await Promise.all(
      orders.map(async (order) => {
        const itemsRaw = await storage.getOrderItemsByOrder(order.id);
        const items = await Promise.all(
          itemsRaw.map(async (item) => {
            const product = item.productId !== null ? await storage.getProduct(item.productId) : null;
            return {
              id: item.id,
              productId: item.productId,
              name: product?.name ?? "",
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            };
          })
        );
        const shop = order.shopId !== null ? await storage.getUser(order.shopId) : undefined;
        return { ...order, items, shop: shop ? { name: shop.name, phone: shop.phone, email: shop.email } : undefined };
      })
    );
    res.json(detailed);
  });

  app.get("/api/shops/dashboard-stats", requireAuth, requireRole(["shop"]), async (req, res) => {
    const stats = await storage.getShopDashboardStats(req.user!.id);
    res.json(stats);
  });

  app.get("/api/orders/shop/recent", requireAuth, requireRole(["shop"]), async (req, res) => {
    const orders = await storage.getRecentOrdersByShop(req.user!.id);
    const detailed = await Promise.all(
      orders.map(async (order) => {
        const itemsRaw = await storage.getOrderItemsByOrder(order.id);
        const items = await Promise.all(
          itemsRaw.map(async (item) => {
            const product = item.productId !== null ? await storage.getProduct(item.productId) : null;
            return {
              id: item.id,
              productId: item.productId,
              name: product?.name ?? "",
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            };
          })
        );
        const customer = order.customerId !== null ? await storage.getUser(order.customerId) : undefined;
        return { ...order, items, customer: customer ? { name: customer.name, phone: customer.phone, email: customer.email } : undefined };
      })
    );
    res.json(detailed);
  });

  app.get("/api/orders/shop", requireAuth, requireRole(["shop"]), async (req, res) => {
    const { status } = req.query;
    const orders = await storage.getOrdersByShop(req.user!.id, status as string | undefined);
    const detailed = await Promise.all(
      orders.map(async (order) => {
        const itemsRaw = await storage.getOrderItemsByOrder(order.id);
        const items = await Promise.all(
          itemsRaw.map(async (item) => {
            const product = item.productId !== null ? await storage.getProduct(item.productId) : null;
            return {
              id: item.id,
              productId: item.productId,
              name: product?.name ?? "",
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            };
          })
        );
        const customer = order.customerId !== null ? await storage.getUser(order.customerId) : undefined;
        return { ...order, items, customer: customer ? { name: customer.name, phone: customer.phone, email: customer.email } : undefined };
      })
    );
    res.json(detailed);
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    const order = await storage.getOrder(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.customerId !== req.user!.id && order.shopId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const itemsRaw = await storage.getOrderItemsByOrder(order.id);
    const items = await Promise.all(
      itemsRaw.map(async (item) => {
        const product = item.productId !== null ? await storage.getProduct(item.productId) : null;
        return {
          id: item.id,
          productId: item.productId,
          name: product?.name ?? "",
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        };
      })
    );
    const customer = order.customerId !== null ? await storage.getUser(order.customerId) : undefined;
    const shop = order.shopId !== null ? await storage.getUser(order.shopId) : undefined;
    res.json({
      ...order,
      items,
      customer: customer ? { name: customer.name, phone: customer.phone, email: customer.email } : undefined,
      shop: shop ? { name: shop.name, phone: shop.phone, email: shop.email, upiId: (shop as any).upiId } : undefined,
    });
  });

  // Customer submits payment reference for manual verification
  app.post("/api/orders/:id/submit-payment-reference", requireAuth, async (req, res) => {
    const orderId = parseInt(req.params.id);
    const { paymentReference } = req.body as { paymentReference: string };
    if (isNaN(orderId) || !paymentReference) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const order = await storage.getOrder(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.customerId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const updated = await storage.updateOrder(orderId, { paymentStatus: "verifying", paymentReference });
    if (order.shopId) {
      await storage.createNotification({
        userId: order.shopId,
        type: "order",
        title: "Action Required",
        message: `Payment reference for Order #${orderId} has been submitted. Please verify.`,
      });
    }
    res.json(updated);
  });

  // Shop confirms payment after manual verification
  app.post("/api/orders/:id/confirm-payment", requireAuth, requireRole(["shop"]), async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order id" });
    const order = await storage.getOrder(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.shopId !== req.user!.id) return res.status(403).json({ message: "Not authorized" });
    if (order.paymentStatus !== "verifying") {
      return res.status(400).json({ message: "Order is not awaiting verification" });
    }
    const updated = await storage.updateOrder(orderId, { paymentStatus: "paid", status: "confirmed" });
    if (order.customerId) {
      await storage.createNotification({
        userId: order.customerId,
        type: "order",
        title: "Payment Confirmed",
        message: `Payment Confirmed! Your Order #${orderId} is now being processed.`,
      });
    }
    res.json(updated);
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
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order id" });
    const timeline = await storage.getOrderTimeline(orderId);
    res.json(timeline);
  });

  app.patch("/api/orders/:id/status", requireAuth, requireRole(["shop"]), async (req, res) => {
    try {
      const { status, trackingInfo } = req.body;
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order id" });
      }
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.shopId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updated = await storage.updateOrderStatus(
        orderId,
        status,
        trackingInfo
      );

      // Create notification for status update
      await storage.createNotification({
        userId: updated.customerId,
        type: "order",
        title: `Order ${status}`,
        message: `Your order #${updated.id} has been ${status}. ${trackingInfo || ""}`,
      });

      // Send SMS notification for important status updates
      if (["confirmed", "shipped", "delivered"].includes(status)) {
         const customer = updated.customerId !== null ? await storage.getUser(updated.customerId) : undefined;
        if (customer) {
          await storage.sendSMSNotification(
            customer.phone,
            `Your order #${updated.id} has been ${status}. ${trackingInfo || ""}`
          );
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update order status" });
    }
  });

  // Return and refund routes
  app.post("/api/orders/:orderId/return", requireAuth, requireRole(["customer"]), async (req, res) => {
    const result = insertReturnRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order id" });

    const order = await storage.getOrder(orderId);
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
        attributes, // JSON string for specific attributes e.g. {"color":"red", "size":"M"}
        locationCity,
        locationState
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
      if (locationCity) filters.locationCity = String(locationCity);
      if (locationState) filters.locationState = String(locationState);
      
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