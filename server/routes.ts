import type { Express } from "express";
import { createServer, type Server } from "http";
import logger from "./logger";
import { setupAuth, hashPasswordInternal } from "./auth"; // Added hashPasswordInternal
import {
  sendNotificationEmail,
  mapUserRoleToRecipient,
  getPasswordResetEmailContent,
  getOrderConfirmationEmailContent,
  getBookingConfirmationEmailContent,
  getBookingUpdateEmailContent,
  getBookingRequestPendingEmailContent,
  getBookingAcceptedEmailContent,
  getBookingRejectedEmailContent,
  getServicePaymentConfirmedCustomerEmailContent,
  getServiceProviderPaymentReceivedEmailContent,
} from "./emailService";
import * as emailService from "./emailService"; // Added for sending emails
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
  passwordResetTokens as passwordResetTokensTable,
  User,
  Booking,
  Order,
  PaymentMethodType,
  PaymentMethodSchema,
  shopWorkers,
} from "@shared/schema";
import { platformFees } from "@shared/config";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import crypto from "crypto";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { registerPromotionRoutes } from "./routes/promotions"; // Import promotion routes
import { bookingsRouter } from "./routes/bookings";
import { ordersRouter } from "./routes/orders";
import { registerWorkerRoutes } from "./routes/workers";
import { requireShopOrWorkerPermission, getWorkerShopId } from "./workerAuth";
import {
  requestPasswordResetLimiter,
  resetPasswordLimiter,
} from "./security/rateLimiters";
//import { registerShopRoutes } from "./routes/shops"; // Import shop routes

const PLATFORM_SERVICE_FEE = platformFees.productOrder;

const isValidDateString = (value: string) =>
  !Number.isNaN(new Date(value).getTime());

const formatUserAddress = (
  user?:
    | Pick<
        User,
        | "addressStreet"
        | "addressCity"
        | "addressState"
        | "addressPostalCode"
        | "addressCountry"
      >
    | null,
) => {
  if (!user) return "";
  const parts = [
    user.addressStreet,
    user.addressCity,
    user.addressState,
    user.addressPostalCode,
    user.addressCountry,
  ].filter((part): part is string => Boolean(part && part.trim()));
  return parts.join(", ");
};

const dateStringSchema = z
  .string()
  .refine(isValidDateString, { message: "Invalid date format" });

const bookingStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "rescheduled",
  "completed",
  "cancelled",
  "expired",
  "rescheduled_pending_provider_approval",
  "awaiting_payment",
  "disputed",
  "rescheduled_by_provider",
]);

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const bookingActionSchema = z
  .object({
    status: bookingStatusSchema.optional(),
    comments: z.string().trim().max(500).optional(),
    bookingDate: dateStringSchema.optional(),
    changedBy: z.number().int().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.bookingDate !== undefined,
    {
      message: "status or bookingDate is required",
      path: ["status"],
    },
  );

const bookingDisputeSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

const bookingResolutionSchema = z.object({
  resolutionStatus: z.enum(["completed", "cancelled"]),
});

const bookingCreateSchema = z.object({
  serviceId: z.number().int().positive(),
  bookingDate: dateStringSchema,
  serviceLocation: z.enum(["customer", "provider"]),
});

const bookingStatusUpdateSchema = z
  .object({
    status: z.enum(["accepted", "rejected", "rescheduled"]),
    rejectionReason: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "rejected" && !value.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejection reason is required when rejecting a booking",
        path: ["rejectionReason"],
      });
    }
  });

const paymentReferenceSchema = z.object({
  paymentReference: z.string().trim().min(1).max(100),
});

const waitlistJoinSchema = z.object({
  serviceId: z.number().int().positive(),
  preferredDate: dateStringSchema,
});

const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1),
});

const wishlistItemSchema = z.object({
  productId: z.number().int().positive(),
});

const reviewUpdateSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    review: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((value) => value.rating !== undefined || value.review !== undefined, {
    message: "Provide a rating or review to update",
    path: ["rating"],
  });

const reviewReplySchema = z
  .union([
    z.object({ response: z.string().trim().min(1).max(2000) }),
    z.object({ reply: z.string().trim().min(1).max(2000) }),
  ])
  .transform((value) =>
    "response" in value ? { reply: value.response } : { reply: value.reply },
  );

const notificationsMarkAllSchema = z.object({
  role: z.enum(["customer", "provider", "shop", "worker", "admin"]).optional(),
});

const productUpdateSchema = insertProductSchema.partial();

const serviceUpdateSchema = insertServiceSchema
  .partial()
  .extend({
    serviceLocationType: z
      .enum(["customer_location", "provider_location"])
      .optional(),
  });

const orderPaymentReferenceSchema = z.object({
  paymentReference: z.string().trim().min(1).max(100),
});

const orderStatusUpdateSchema = z.object({
  status: z.enum([
    "pending",
    "cancelled",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "delivered",
    "returned",
  ]),
  trackingInfo: z.string().trim().max(500).optional(),
});

const bookingRejectionNotificationSchema = z.object({
  rejectionReason: z.string().trim().max(500).optional(),
});

const formatValidationError = (error: z.ZodError) => ({
  message: "Invalid input",
  errors: error.flatten(),
});

// Helper function to validate and parse date and time
function validateAndParseDateTime(
  dateStr: string,
  timeStr: string,
): Date | null {
  try {
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      logger.error("Invalid date format. Expected YYYY-MM-DD");
      return null;
    }

    // Validate time format (HH:MM)
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
      logger.error("Invalid time format. Expected HH:MM");
      return null;
    }

    // Create a valid date object
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);

    // Month is 0-indexed in JavaScript Date
    const date = new Date(year, month - 1, day, hours, minutes);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      logger.error("Invalid date/time combination");
      return null;
    }

    return date;
  } catch (error) {
    logger.error("Error parsing date/time:", error);
    return null;
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Unauthorized");
  }
  if (req.user?.isSuspended) {
    return res.status(403).json({ message: "Account suspended" });
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
  /**
   * @openapi
   * /api:
   *   get:
   *     summary: List all API endpoints
   *     responses:
   *       200:
   *         description: A JSON array of available endpoints
   */
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

  app.post("/api/request-password-reset", requestPasswordResetLimiter, async (req, res) => {
    const parsedBody = requestPasswordResetSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }

    const { email } = parsedBody.data;

    try {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Important: Don't reveal if the email exists or not for security reasons
        logger.info(
          `Password reset requested for non-existent email: ${email}`,
        );
        return res
          .status(200)
          .json({
            message:
              "If an account with that email exists, a password reset link has been sent.",
          });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000); // Token expires in 1 hour

      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;
      const emailContent = getPasswordResetEmailContent(
        user.name || user.username,
        resetLink,
      );

      if (user.email) {
        await sendNotificationEmail({
          to: user.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
          notificationType: "passwordReset",
          recipientType: mapUserRoleToRecipient(user.role),
          context: { userId: user.id },
        });
      } else {
        logger.warn(
          `Password reset attempted for user ${user.id}, but no email is available.`,
        );
      }

      return res
        .status(200)
        .json({
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
    } catch (error) {
      logger.error("Error requesting password reset:", error);
      return res
        .status(500)
        .json({ message: "Error processing password reset request" });
    }
  });

  app.post("/api/reset-password", resetPasswordLimiter, async (req, res) => {
    const parsedBody = resetPasswordSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json(formatValidationError(parsedBody.error));
    }

    const { token, newPassword } = parsedBody.data;
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    try {
      const tokenRecords = await db
        .select()
        .from(passwordResetTokensTable)
        .where(eq(passwordResetTokensTable.token, token))
        .limit(1);
      const tokenEntry = tokenRecords[0];
      if (!tokenEntry || tokenEntry.expiresAt < new Date()) {
        return res
          .status(400)
          .json({ message: "Invalid or expired password reset token" });
      }

      const user = await storage.getUser(tokenEntry.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const hashedPassword = await hashPasswordInternal(newPassword); // Use the exported hash function
      await storage.updateUser(tokenEntry.userId, { password: hashedPassword });

      // Invalidate the token after use
      await db
        .delete(passwordResetTokensTable)
        .where(eq(passwordResetTokensTable.token, token));

      return res
        .status(200)
        .json({ message: "Password has been reset successfully" });
    } catch (error) {
      logger.error("Error resetting password:", error);
      return res.status(500).json({ message: "Error resetting password" });
    }
  });

  setupAuth(app);

  // Register domain routers
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/orders', ordersRouter);
  registerWorkerRoutes(app);

  // Booking Notification System
  // Get pending booking requests for a provider
  app.get(
    "/api/bookings/provider/pending",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const providerId = req.user!.id;
        const pendingBookings =
          await storage.getPendingBookingRequestsForProvider(providerId);

        const serviceIds = Array.from(
          new Set(pendingBookings.map((b) => b.serviceId!).filter(Boolean)),
        );
        const services = await storage.getServicesByIds(serviceIds);
        const serviceMap = new Map(services.map((s) => [s.id, s]));

        const userIds = new Set<number>();
        services.forEach((s) => {
          if (s.providerId) userIds.add(s.providerId);
        });
        pendingBookings.forEach((b) => {
          if (b.customerId) userIds.add(b.customerId);
        });
        const users = await storage.getUsersByIds(Array.from(userIds));
        const userMap = new Map(users.map((u) => [u.id, u]));

        const bookingsWithDetails = pendingBookings.map((b) => {
          const service = serviceMap.get(b.serviceId!);
          const customer = b.customerId ? userMap.get(b.customerId) : undefined;
          const provider =
            service && service.providerId
              ? userMap.get(service.providerId)
              : undefined;

          let relevantAddress = {} as any;
          if (b.serviceLocation === "customer" && customer) {
            relevantAddress = {
              addressStreet: customer.addressStreet,
              addressCity: customer.addressCity,
              addressState: customer.addressState,
              addressPostalCode: customer.addressPostalCode,
              addressCountry: customer.addressCountry,
            };
          }

          return {
            ...b,
            service,
            customer: customer
              ? { id: customer.id, name: customer.name, phone: customer.phone }
              : null,
            provider: provider
              ? { id: provider.id, name: provider.name, phone: provider.phone }
              : null,
            relevantAddress,
          };
        });

        res.json(bookingsWithDetails);
      } catch (error) {
        logger.error("Error fetching pending bookings:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch pending bookings",
          });
      }
    },
  );

  // Accept, reject, or reschedule a booking request
  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const parsedBody = bookingActionSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      // Destructure bookingDate as well, it might be undefined if not a reschedule
      const { status, comments, bookingDate, changedBy } = parsedBody.data;
      const currentUser = req.user!;

      logger.info(`[API] Attempting to update booking ${bookingId}`);

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        logger.info(`[API] Booking ${bookingId} not found.`);
        return res.status(404).json({ message: "Booking not found" });
      }

      const service = await storage.getService(booking.serviceId!);
      if (!service) {
        logger.info(
          `[API] Service ${booking.serviceId} for booking ${bookingId} not found.`,
        );
        return res
          .status(404)
          .json({ message: "Service not found for this booking" });
      }

      let updatedBookingData = {};
      let notificationPromises = [];
      let emailPromise = Promise.resolve(); // To avoid undefined errors if no email is sent

      // Scenario 1: Customer reschedules
      if (
        bookingDate &&
        currentUser.role === "customer" &&
        booking.customerId === currentUser.id
      ) {
        logger.info(
          `[API] Customer ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`,
        );
        const originalBookingDate = booking.bookingDate; // Capture original booking date
        updatedBookingData = {
          bookingDate: new Date(bookingDate),
          status: "rescheduled_pending_provider_approval",
          comments: comments || "Rescheduled by customer",
        };

        if (service.providerId) {
          const providerUser = await storage.getUser(service.providerId);
          if (providerUser) {
            const formattedRescheduleDate = formatIndianDisplay(
              bookingDate,
              "datetime",
            );
            notificationPromises.push(
              storage.createNotification({
                userId: service.providerId,
                type: "booking_rescheduled_request",
                title: "Reschedule Request",
                message: `Customer ${currentUser.name || "ID: " + currentUser.id} requested to reschedule booking #${bookingId} for '${service.name}' to ${formattedRescheduleDate}. Please review.`,
                isRead: false,
                relatedBookingId: bookingId,
              }),
            );
            if (providerUser.email) {
              const formattedOriginalDate = originalBookingDate
                ? formatIndianDisplay(originalBookingDate, "datetime")
                : "N/A";
              const formattedNewDate = formatIndianDisplay(
                bookingDate,
                "datetime",
              );
              emailPromise = emailService
                .sendBookingRescheduledByCustomerEmail(providerUser.email, {
                  providerName: providerUser.name || "Provider",
                  customerName: currentUser.name || "Customer",
                  serviceName: service.name,
                  originalBookingDate: formattedOriginalDate,
                  newBookingDate: formattedNewDate,
                  bookingId: bookingId.toString(),
                  loginUrl: `${process.env.APP_BASE_URL}/login`,
                  bookingDetailsUrl: `${process.env.APP_BASE_URL}/provider/bookings`,
                })
                .then(() => {})
                .catch((err: unknown) =>
                  logger.error(
                    "[API] Failed to send reschedule request email to provider:",
                    err,
                  ),
                );
            }
          }
        }
      }
      // Scenario 2: Provider reschedules
      else if (
        bookingDate &&
        currentUser.role === "provider" &&
        service.providerId === currentUser.id
      ) {
        logger.info(
          `[API] Provider ${currentUser.id} rescheduling booking ${bookingId} to ${bookingDate}`,
        );
        const originalBookingDate = booking.bookingDate; // Capture original booking date
        updatedBookingData = {
          bookingDate: new Date(bookingDate),
          status: "rescheduled_by_provider", // Or a more appropriate status like "accepted" if provider reschedule implies auto-acceptance
          comments: comments || "Rescheduled by provider",
        };

        if (booking.customerId) {
          const customerUser = await storage.getUser(booking.customerId);
          if (customerUser) {
            const formattedProviderRescheduleDate = formatIndianDisplay(
              bookingDate,
              "datetime",
            );
            notificationPromises.push(
              storage.createNotification({
                userId: booking.customerId,
                type: "booking_rescheduled_by_provider",
                title: "Booking Rescheduled by Provider",
                message: `Provider ${
                  currentUser.name || "ID: " + currentUser.id
                } has rescheduled your booking #${bookingId} for '${
                  service.name
                }' to ${formattedProviderRescheduleDate}. ${
                  comments ? "Comments: " + comments : ""
                }`,
                isRead: false,
                relatedBookingId: bookingId,
              }),
            );
            if (customerUser.email) {
              const formattedOriginalDate = originalBookingDate
                ? formatIndianDisplay(originalBookingDate, "datetime")
                : "N/A";
              const formattedNewDate = formatIndianDisplay(
                bookingDate,
                "datetime",
              );
              emailPromise = emailService
                .sendBookingRescheduledByProviderEmail(customerUser.email, {
                  customerName: customerUser.name || "Customer",
                  providerName: currentUser.name || "Provider",
                  serviceName: service.name,
                  originalBookingDate: formattedOriginalDate,
                  newBookingDate: formattedNewDate,
                  bookingId: bookingId.toString(),
                  comments: comments || undefined,
                  loginUrl: `${process.env.BASE_URL}/login`,
                  bookingDetailsUrl: `${process.env.BASE_URL}/customer/bookings`,
                })
                .then(() => {})
                .catch((err: unknown) =>
                  logger.error(
                    "[API] Failed to send reschedule by provider email to customer:",
                    err,
                  ),
                );
            }
          }
        }
      }
      // Scenario 3: Provider accepts/rejects a booking (including a customer's reschedule request)
      else if (
        status &&
        currentUser.role === "provider" &&
        service.providerId === currentUser.id
      ) {
        logger.info(
          `[API] Provider ${currentUser.id} updating booking ${bookingId} status to ${status}`,
        );
        updatedBookingData = {
          status,
          comments:
            comments ||
            (status === "accepted" ? "Booking confirmed" : "Booking rejected"),
        };

        if (booking.customerId) {
          const customerUser = await storage.getUser(booking.customerId);
          if (customerUser) {
            let notificationTitle = `Booking ${status === "accepted" ? "Accepted" : "Rejected"}`;
            let notificationMessage = `Your booking for '${service.name}' has been ${status}${comments ? `: ${comments}` : "."}`;
            let emailSubject = `Booking ${status === "accepted" ? "Accepted" : "Rejected"}`;

            if (
              booking.status === "rescheduled_pending_provider_approval" &&
              status === "accepted"
            ) {
              notificationTitle = "Reschedule Confirmed";
              const formattedRescheduledDate = booking.bookingDate
                ? formatIndianDisplay(booking.bookingDate, "datetime")
                : "N/A";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been accepted. New date: ${formattedRescheduledDate}`;
              emailSubject = "Reschedule Confirmed";
            } else if (
              booking.status === "rescheduled_pending_provider_approval" &&
              status === "rejected"
            ) {
              notificationTitle = "Reschedule Rejected";
              notificationMessage = `Your reschedule request for booking #${bookingId} ('${service.name}') has been rejected. ${comments ? comments : "Please contact the provider or try rescheduling again."}`;
              emailSubject = "Reschedule Rejected";
            }

            notificationPromises.push(
              storage.createNotification({
                userId: booking.customerId,
                type:
                  status === "accepted"
                    ? "booking_confirmed"
                    : "booking_rejected",
                title: notificationTitle,
                message: notificationMessage,
                isRead: false,
                relatedBookingId: bookingId,
              }),
            );
            if (customerUser.email) {
              emailPromise = emailService
                .sendBookingUpdateEmail(customerUser.email, {
                  customerName: customerUser.name || "Customer",
                  serviceName: service.name,
                  bookingStatus: status,
                  bookingDate: booking.bookingDate
                    ? formatIndianDisplay(booking.bookingDate, "datetime")
                    : "N/A",
                  bookingId: bookingId.toString(),
                  providerName: currentUser.name || "Provider",
                  comments: comments || "",
                  subject: emailSubject,
                  loginUrl: `${process.env.BASE_URL}/login`,
                  bookingDetailsUrl: `${process.env.BASE_URL}/customer/bookings`,
                })
                .then(() => {})
                .catch((err: unknown) =>
                  logger.error(
                    "[API] Failed to send booking update email to customer:",
                    err,
                  ),
                );
            }
          }
        }
      }
      // Scenario 3: Customer cancels (can be expanded)
      else if (
        status === "cancelled" &&
        currentUser.role === "customer" &&
        booking.customerId === currentUser.id
      ) {
        logger.info(
          `[API] Customer ${currentUser.id} cancelling booking ${bookingId}`,
        );
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
              }),
            );
            // Optional: Email to provider about cancellation
            if (providerUser.email) {
              // emailService.sendBookingCancelledByCustomerEmail(...)
            }
          }
        }
      } else {
        logger.info(
          `[API] Unauthorized or invalid action for booking ${bookingId} by user ${currentUser.id} with role ${currentUser.role}. Booking owner: ${booking.customerId}, Service provider: ${service.providerId}`,
        );
        return res
          .status(403)
          .json({ message: "Unauthorized or invalid action specified" });
      }

      const finalUpdatedBooking = await storage.updateBooking(
        bookingId,
        updatedBookingData,
      );
      await Promise.all(notificationPromises);
      await emailPromise; // Wait for email to be processed

      logger.info(
        `[API] Successfully updated booking ${bookingId}:`,
        finalUpdatedBooking,
      );
      res.json(finalUpdatedBooking);
    } catch (error) {
      logger.error(`[API] Error updating booking ${req.params.id}:`, error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to update booking",
        });
    }
  });

  // Get booking requests with status for a customer
  app.get(
    "/api/bookings/customer/requests",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const customerId = req.user!.id;
        const bookingRequests =
          await storage.getBookingRequestsWithStatusForCustomer(customerId);

        // Fetch details for each booking
        const bookingsWithDetails = await Promise.all(
          bookingRequests.map(async (booking: Booking) => {
            const service = await storage.getService(booking.serviceId!);
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null; // Fetch customer (self)
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider

            let relevantAddress = {};
            // If service is at provider's location, show provider address
            if (
              service?.serviceLocationType === "provider_location" &&
              provider
            ) {
              relevantAddress = {
                addressStreet: provider.addressStreet,
                addressCity: provider.addressCity,
                addressState: provider.addressState,
                addressPostalCode: provider.addressPostalCode,
                addressCountry: provider.addressCountry,
              };
            }
            // If service is at customer's location, show customer address
            else if (
              service?.serviceLocationType === "customer_location" &&
              customer
            ) {
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
              customer: customer
                ? {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                  }
                : null,
              provider: provider
                ? {
                    id: provider.id,
                    name: provider.name,
                    phone: provider.phone,
                  }
                : null,
              relevantAddress, // Add the conditionally determined address
            };
          }),
        );

        res.json(bookingsWithDetails); // Send the response back
      } catch (error) {
        logger.error("Error fetching booking requests:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch booking requests",
          });
      }
    },
  );

  // Get booking history for a customer
  app.get(
    "/api/bookings/customer/history",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const customerId = req.user!.id;
        const bookingHistory =
          await storage.getBookingHistoryForCustomer(customerId);

        // Fetch details for each booking
        const bookingsWithDetails = await Promise.all(
          bookingHistory.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null; // Fetch customer (self)
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider

            let relevantAddress = {};
            // If service is at provider's location, show provider address
            if (
              service?.serviceLocationType === "provider_location" &&
              provider
            ) {
              relevantAddress = {
                addressStreet: provider.addressStreet,
                addressCity: provider.addressCity,
                addressState: provider.addressState,
                addressPostalCode: provider.addressPostalCode,
                addressCountry: provider.addressCountry,
              };
            }
            // If service is at customer's location, show customer address
            else if (
              service?.serviceLocationType === "customer_location" &&
              customer
            ) {
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
              customer: customer
                ? {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                  }
                : null,
              provider: provider
                ? {
                    id: provider.id,
                    name: provider.name,
                    phone: provider.phone,
                  }
                : null,
              relevantAddress, // Add the conditionally determined address
            };
          }),
        );
        res.json(bookingsWithDetails); // Send details back
      } catch (error) {
        logger.error("Error fetching booking history:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch booking history",
          });
      }
    },
  );

  // Get booking history for a provider
  app.get(
    "/api/bookings/provider/history",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const providerId = req.user!.id;
        const bookingHistory =
          await storage.getBookingHistoryForProvider(providerId);

        // Fetch details for each booking
        const bookingsWithDetails = await Promise.all(
          bookingHistory.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null; // Fetch customer details
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider (self)

            let relevantAddress = {};
            // If service is at provider's location, show provider address (implicitly known)
            // If service is at customer's location, show customer address
            if (
              service?.serviceLocationType === "customer_location" &&
              customer
            ) {
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
              customer: customer
                ? {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                  }
                : null,
              provider: provider
                ? {
                    id: provider.id,
                    name: provider.name,
                    phone: provider.phone,
                  }
                : null,
              relevantAddress, // Add the conditionally determined address
            };
          }),
        );
        res.json(bookingsWithDetails); // Send details back
      } catch (error) {
        logger.error("Error fetching booking history:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch booking history",
          });
      }
    },
  );

  // Process expired bookings (can be called by a scheduled job)
  app.post(
    "/api/bookings/process-expired",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        await storage.processExpiredBookings();
        res.json({ message: "Expired bookings processed successfully" });
      } catch (error) {
        logger.error("Error processing expired bookings:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to process expired bookings",
          });
      }
    },
  );

  // Report a dispute on an awaiting payment booking
  app.post(
    "/api/bookings/:id/report-dispute",
    requireAuth,
    async (req, res) => {
      try {
        const bookingId = parseInt(req.params.id);
        const parsedBody = bookingDisputeSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { reason } = parsedBody.data;
        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.status !== "awaiting_payment")
          return res
            .status(400)
            .json({ message: "Booking not awaiting payment" });
        if (
          booking.customerId !== req.user!.id &&
          (await storage.getService(booking.serviceId!))?.providerId !==
            req.user!.id
        ) {
          return res.status(403).json({ message: "Not authorized" });
        }
        const updated = await storage.updateBooking(bookingId, {
          status: "disputed",
          disputeReason: reason,
        });
        res.json({ booking: updated });
      } catch (error) {
        logger.error("Error reporting dispute:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to report dispute",
          });
      }
    },
  );

  // Admin resolves disputed booking
  app.patch(
    "/api/admin/bookings/:id/resolve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const bookingId = parseInt(req.params.id);
        const parsedBody = bookingResolutionSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { resolutionStatus } = parsedBody.data;
        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.status !== "disputed")
          return res.status(400).json({ message: "Booking not disputed" });
        const updated = await storage.updateBooking(bookingId, {
          status: resolutionStatus,
        });
        res.json({ booking: updated });
      } catch (error) {
        logger.error("Error resolving dispute:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to resolve dispute",
          });
      }
    },
  );

  // Admin list disputes
  app.get(
    "/api/admin/disputes",
    requireAuth,
    requireRole(["admin"]),
    async (_req, res) => {
      try {
        const disputes = await storage.getBookingsByStatus("disputed");
        res.json(disputes);
      } catch (error) {
        logger.error("Error fetching disputes:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch disputes",
          });
      }
    },
  );

  // Shop Profile Management
  const profileUpdateSchema = insertUserSchema.partial().extend({
    upiId: z
      .string()
      .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/)
      .optional()
      .nullable(),
    upiQrCodeUrl: z.string().optional().nullable(),
    pickupAvailable: z.boolean().optional(),
    deliveryAvailable: z.boolean().optional(),
    returnsEnabled: z.boolean().optional(),
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
      if (!["provider", "shop"].includes(req.user!.role)) {
        delete (result.data as any).upiId;
        delete (result.data as any).upiQrCodeUrl;
      }

      // Sanitize paymentMethods using shared schema
      let updateData: Partial<User> = { ...result.data } as Partial<User>;
      if ("paymentMethods" in updateData) {
        const pmResult = PaymentMethodSchema.array().safeParse(
          (updateData as any).paymentMethods,
        );
        updateData.paymentMethods = pmResult.success
          ? pmResult.data
          : undefined;
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
      logger.error("Error updating user:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to update user",
        });
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
      logger.error("Error fetching shops:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch shops",
        });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      logger.info(
        "[API] /api/users/:id - Received request for user ID:",
        userId,
      );
      logger.info("[API] /api/users/:id - Raw ID parameter:", req.params.id);

      if (isNaN(userId)) {
        logger.info("[API] /api/users/:id - Invalid user ID format");
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      const user = await storage.getUser(userId);
      logger.info("[API] /api/users/:id - User from storage:", user);

      if (!user) {
        logger.info("[API] /api/users/:id - User not found");
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      logger.error("[API] Error in /api/users/:id:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch user",
        });
    }
  });

  // Product Management
  app.post(
    "/api/products",
    requireAuth,
    requireShopOrWorkerPermission(["products:write"]),
    async (req, res) => {
      try {
        const result = insertProductSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        const product = await storage.createProduct({
          ...result.data,
          shopId: shopContextId,
        });

        logger.info("Created product:", product);
        res.status(201).json(product);
      } catch (error) {
        logger.error("Error creating product:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create product",
          });
      }
    },
  );

  app.get("/api/products/shop/:id", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProductsByShop(parseInt(req.params.id));
      logger.info("Shop products:", products);
      res.json(products);
    } catch (error) {
      logger.error("Error fetching shop products:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch products",
        });
    }
  });

  app.patch(
    "/api/products/:id",
    requireAuth,
    requireShopOrWorkerPermission(["products:write"]),
    async (req, res) => {
      try {
        const productId = parseInt(req.params.id);
        const product = await storage.getProduct(productId);

        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        if (req.user!.role === "shop") {
          if (product.shopId !== req.user!.id) {
            return res.status(403).json({ message: "Can only update own products" });
          }
        } else if (req.user!.role === "worker") {
          const workerShopId = (req as any).workerShopId;
          if (!workerShopId || product.shopId !== workerShopId) {
            return res.status(403).json({ message: "Worker can only update products of their shop" });
          }
        }

        const parsedBody = productUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        if (Object.keys(parsedBody.data).length === 0) {
          return res.status(400).json({ message: "No product fields provided" });
        }

        const updateData: Record<string, unknown> = { ...parsedBody.data };

        // Sanitize numeric fields to prevent 'undefined' string errors
        const numericFields = ["price", "mrp", "stock"];
        for (const field of numericFields) {
          if (Object.prototype.hasOwnProperty.call(updateData, field)) {
            const value = updateData[field];
            if (value === "undefined" || value === null) {
              delete updateData[field];
            } else if (typeof value === "string" && value.trim() === "") {
              delete updateData[field];
            }
          }
        }

        // The storage.updateProduct method expects Partial<Product>
        const updatedProduct = await storage.updateProduct(
          productId,
          updateData,
        );
        logger.info(
          "[API] /api/products/:id PATCH - Updated product:",
          updatedProduct,
        );
        res.json(updatedProduct);
      } catch (error) {
        logger.error("[API] Error in /api/products/:id PATCH:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update product",
          });
      }
    },
  );

  // Service routes
  app.post(
    "/api/services",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        // Add serviceLocationType to the validation
        const serviceSchemaWithLocation = insertServiceSchema.extend({
          serviceLocationType: z
            .enum(["customer_location", "provider_location"])
            .optional()
            .default("provider_location"),
        });
        const result = serviceSchemaWithLocation.safeParse(req.body);
        if (!result.success) {
          logger.error(
            "[API] /api/services POST - Validation error:",
            result.error.flatten(),
          );
          return res.status(400).json(result.error.flatten());
        }

        const serviceData = {
          ...result.data,
          providerId: req.user!.id,
          isAvailable: true, // Default to available
        };
        const service = await storage.createService(serviceData);

        logger.info("Created service:", service);
        res.status(201).json(service);
      } catch (error) {
        logger.error("Error creating service:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create service",
          });
      }
    },
  );

  app.get("/api/services/provider/:id", requireAuth, async (req, res) => {
    try {
      const services = await storage.getServicesByProvider(
        parseInt(req.params.id),
      );
      logger.info("Provider services:", services); // Debug log
      res.json(services);
    } catch (error) {
      logger.error("Error fetching provider services:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch services",
        });
    }
  });

  // Add PATCH endpoint for updating services
  app.patch(
    "/api/services/:id",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = parseInt(req.params.id);
        logger.info(
          "[API] /api/services/:id PATCH - Received request for service ID:",
          serviceId,
        );
        logger.info("[API] /api/services/:id PATCH - Request received");

        if (isNaN(serviceId)) {
          logger.info(
            "[API] /api/services/:id PATCH - Invalid service ID format",
          );
          return res.status(400).json({ message: "Invalid service ID format" });
        }

        const service = await storage.getService(serviceId);

        if (!service) {
          logger.info("[API] /api/services/:id PATCH - Service not found");
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          logger.info("[API] /api/services/:id PATCH - Not authorized");
          return res
            .status(403)
            .json({ message: "Can only update own services" });
        }

        const parsedBody = serviceUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        if (Object.keys(parsedBody.data).length === 0) {
          return res.status(400).json({ message: "No service fields provided" });
        }

        const updatedService = await storage.updateService(
          serviceId,
          parsedBody.data,
        );
        logger.info(
          "[API] /api/services/:id PATCH - Updated service:",
          updatedService,
        );
        res.json(updatedService);
      } catch (error) {
        logger.error("[API] Error updating service:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update service",
          });
      }
    },
  );

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
        availabilityDate, // YYYY-MM-DD
      } = req.query;

      const filters: any = {};
      if (category) filters.category = String(category).toLowerCase();
      if (minPrice) filters.minPrice = parseFloat(String(minPrice));
      if (maxPrice) filters.maxPrice = parseFloat(String(maxPrice));
      if (searchTerm) filters.searchTerm = String(searchTerm);
      if (providerId) filters.providerId = parseInt(String(providerId));
      if (locationCity) filters.locationCity = String(locationCity);
      if (locationState) filters.locationState = String(locationState);
      if (locationPostalCode)
        filters.locationPostalCode = String(locationPostalCode);
      if (availabilityDate) filters.availabilityDate = String(availabilityDate); // Will be parsed in storage layer

      const services = await storage.getServices(filters);
      logger.info("Filtered services:", services); // Debug log

      // Map through services to include provider info and rating
      const servicesWithDetails = await Promise.all(
        services.map(async (service) => {
          const provider =
            service.providerId !== null
              ? await storage.getUser(service.providerId)
              : null;
          const reviews = await storage.getReviewsByService(service.id);
          const rating = reviews?.length
            ? reviews.reduce((acc, review) => acc + review.rating, 0) /
              reviews.length
            : null;

          return {
            ...service,
            rating,
            provider: provider
              ? {
                  // Include full provider details needed for address logic
                  id: provider.id,
                  name: provider.name,
                  phone: provider.phone,
                  profilePicture: provider.profilePicture,
                  addressStreet: provider.addressStreet,
                  addressCity: provider.addressCity,
                  addressState: provider.addressState,
                  addressPostalCode: provider.addressPostalCode,
                  addressCountry: provider.addressCountry,
                }
              : null,
          };
        }),
      );

      res.json(servicesWithDetails);
    } catch (error) {
      logger.error("Error fetching services:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch services",
        });
    }
  });

  app.get("/api/services/:id", requireAuth, async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      logger.info(
        "[API] /api/services/:id - Received request for service ID:",
        serviceId,
      );
      logger.info("[API] /api/services/:id - Raw ID parameter:", req.params.id);

      if (isNaN(serviceId)) {
        logger.info("[API] /api/services/:id - Invalid service ID format");
        return res.status(400).json({ message: "Invalid service ID format" });
      }

      const service = await storage.getService(serviceId);
      logger.info("[API] /api/services/:id - Service from storage:", service);

      if (!service) {
        logger.info("[API] /api/services/:id - Service not found in storage");
        return res.status(404).json({ message: "Service not found" });
      }

      // Get the provider details
      const provider =
        service.providerId !== null
          ? await storage.getUser(service.providerId)
          : null;
      logger.info("[API] /api/services/:id - Provider details:", provider);

      if (!provider) {
        logger.info("[API] /api/services/:id - Provider not found");
        return res.status(404).json({ message: "Service provider not found" });
      }

      // Get reviews and calculate rating
      const reviews = await storage.getReviewsByService(serviceId);
      const rating = reviews?.length
        ? reviews.reduce((acc, review) => acc + review.rating, 0) /
          reviews.length
        : null;

      const responseData = {
        ...service,
        rating,
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          phone: provider.phone,
          profilePicture: provider.profilePicture,
          // Include address fields
          addressStreet: provider.addressStreet,
          addressCity: provider.addressCity,
          addressState: provider.addressState,
          addressPostalCode: provider.addressPostalCode,
          addressCountry: provider.addressCountry,
        },
        // Include availability details
        workingHours: service.workingHours,
        breakTime: service.breakTime, // Corrected field name
        reviews: reviews || [],
      };

      logger.info(
        "[API] /api/services/:id - Sending response data:",
        responseData,
      );
      res.json(responseData);
    } catch (error) {
      logger.error("[API] Error in /api/services/:id:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch service",
        });
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
      logger.error("Error fetching blocked slots:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch blocked slots",
        });
    }
  });

  app.post(
    "/api/services/:id/block-time",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = parseInt(req.params.id);
        const service = await storage.getService(serviceId);

        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "Can only block time slots for own services" });
        }

        const result = insertBlockedTimeSlotSchema.safeParse({
          ...req.body,
          serviceId: serviceId,
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
          result.data.endTime,
        );

        for (const booking of overlappingBookings) {
          await storage.createNotification({
            userId: booking.customerId,
            type: "service",
            title: "Service Unavailable",
            message:
              "A service you booked has become unavailable for the scheduled time. Please reschedule.",
          });
        }

        res.status(201).json(blockedSlot);
      } catch (error) {
        logger.error("Error blocking time slot:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to block time slot",
          });
      }
    },
  );

  app.delete(
    "/api/services/:serviceId/blocked-slots/:slotId",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = parseInt(req.params.serviceId);
        const slotId = parseInt(req.params.slotId);

        const service = await storage.getService(serviceId);
        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "Can only unblock time slots for own services" });
        }

        await storage.deleteBlockedTimeSlot(slotId);
        res.sendStatus(200);
      } catch (error) {
        logger.error("Error unblocking time slot:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to unblock time slot",
          });
      }
    },
  );

  // Add endpoint to delete a service
  app.delete(
    "/api/services/:id",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const serviceId = parseInt(req.params.id);
        logger.info(
          "[API] /api/services/:id DELETE - Received request for service ID:",
          serviceId,
        );

        if (isNaN(serviceId)) {
          logger.info(
            "[API] /api/services/:id DELETE - Invalid service ID format",
          );
          return res.status(400).json({ message: "Invalid service ID format" });
        }

        const service = await storage.getService(serviceId);

        if (!service) {
          logger.info("[API] /api/services/:id DELETE - Service not found");
          return res.status(404).json({ message: "Service not found" });
        }

        if (service.providerId !== req.user!.id) {
          logger.info("[API] /api/services/:id DELETE - Not authorized");
          return res
            .status(403)
            .json({ message: "Can only delete own services" });
        }

        try {
          await storage.deleteService(serviceId);
          logger.info(
            "[API] /api/services/:id DELETE - Service marked as deleted successfully",
          );
          res.status(200).json({ message: "Service deleted successfully" });
        } catch (error) {
          logger.error("[API] Error deleting service:", error);
          res
            .status(400)
            .json({
              message:
                "Failed to delete service due to existing bookings. Please mark the service as unavailable instead.",
            });
        }
      } catch (error) {
        logger.error("[API] Error deleting service:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete service",
          });
      }
    },
  );

  // Booking routes
  app.post(
    "/api/bookings",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const parsedBody = bookingCreateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        const { serviceId, bookingDate, serviceLocation } = parsedBody.data;

        // Get service details
        const service = await storage.getService(serviceId);
        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }

        const bookingDateTime = new Date(bookingDate);
        const isAvailable = await storage.checkAvailability(
          serviceId,
          bookingDateTime,
        );
        if (!isAvailable) {
          return res
            .status(409)
            .json({ message: "Selected time slot is not available" });
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

        // --- Payment provider integration hook (if configured) ---
        try {
          const customer = await storage.getUser(booking.customerId!);
          const provider =
            service.providerId !== null
              ? await storage.getUser(service.providerId)
              : null;
          if (customer && provider && customer.email && provider.email) {
            const customerAddress =
              booking.serviceLocation === "customer"
                ? `${customer.addressStreet || ""} ${customer.addressCity || ""} ${customer.addressState || ""}`.trim() ||
                  "Not specified"
                : "Provider Location";
            const customerPhone =
              booking.serviceLocation === "customer"
                ? customer.phone
                : undefined;

            const providerBookingEmailContent =
              getBookingConfirmationEmailContent(
                provider.name || provider.username,
                {
                  bookingId: booking.id.toString(),
                  customerName: customer.name || customer.username,
                  serviceName: service.name,
                  bookingDate: booking.bookingDate,
                  customerAddress,
                  customerPhone,
                },
              );
            await sendNotificationEmail({
              to: provider.email,
              subject: providerBookingEmailContent.subject,
              text: providerBookingEmailContent.text,
              html: providerBookingEmailContent.html,
              notificationType: "bookingRequest",
              recipientType: "serviceProvider",
              context: { bookingId: booking.id },
            });
            const customerPendingEmailContent =
              getBookingRequestPendingEmailContent(
                customer.name || customer.username,
                {
                  serviceName: service.name,
                  bookingDate: booking.bookingDate,
                  providerName: provider.name || provider.username,
                },
              );
            await sendNotificationEmail({
              to: customer.email,
              subject: customerPendingEmailContent.subject,
              text: customerPendingEmailContent.text,
              html: customerPendingEmailContent.html,
              notificationType: "bookingPendingCustomer",
              recipientType: "customer",
              context: { bookingId: booking.id },
            });
          }
        } catch (fetchError) {
          logger.error(
            `[API] Error sending booking emails (Booking ID: ${booking.id}):`,
            fetchError,
          );
        }
        res.status(201).json({ booking, paymentRequired: false });
      } catch (error) {
        logger.error("Error creating booking:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create booking",
          });
      }
    },
  );

  app.patch(
    "/api/bookings/:id/status",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const parsedBody = bookingStatusUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { status, rejectionReason } = parsedBody.data;
        const bookingId = parseInt(req.params.id);

        logger.info(
          `[API DEBUG] Attempting to update booking status. Booking ID: ${bookingId}, Received Status: ${status}, Received Rejection Reason: ${rejectionReason}`,
        );

        const booking = await storage.getBooking(bookingId);
        logger.info(
          `[API DEBUG] Fetched booking for ID ${bookingId}:`,
          booking ? `Found (Customer ID: ${booking.customerId})` : "Not Found",
        );
        if (!booking) {
          logger.info(
            `[API DEBUG] Booking not found: ID=${bookingId}. Returning 404.`,
          );
          return res.status(404).json({ message: "Booking not found" });
        }

        logger.info(
          `[API DEBUG] Attempting to fetch service with ID: ${booking.serviceId} for authorization. Provider ID from token: ${req.user!.id}`,
        );
        const service = await storage.getService(booking.serviceId!);
        logger.info(
          `[API DEBUG] Fetched service for ID ${booking.serviceId}:`,
          service ? `Found (Provider ID: ${service.providerId})` : "Not Found",
        );
        if (!service || service.providerId !== req.user!.id) {
          logger.info(
            `[API DEBUG] Authorization check failed for booking ID ${bookingId}. Service found: ${!!service}, Service Provider ID: ${service?.providerId}, Authenticated User ID: ${req.user!.id}. Returning 403.`,
          );
          return res
            .status(403)
            .json({ message: "Not authorized to update this booking" });
        }

        logger.info(
          `[API DEBUG] All pre-update checks passed for booking ID ${bookingId}. Proceeding to update booking status.`,
        );
        // Update booking status
        const updatedBooking = await storage.updateBooking(bookingId, {
          status,
          rejectionReason: status === "rejected" ? rejectionReason : null,
        });

        logger.info(
          `[API PATCH /api/bookings/:id/status] Booking ID: ${bookingId}. Status updated to ${updatedBooking.status}. Customer email notifications are now handled by dedicated routes: /api/bookings/:id/notify-customer-accepted and /api/bookings/:id/notify-customer-rejected.`,
        );
        // Email sending logic for customer acceptance/rejection has been removed from this route.
        // It is now handled by dedicated endpoints: POST /api/bookings/:id/notify-customer-accepted and POST /api/bookings/:id/notify-customer-rejected.

        // Create notification for customer
        const notificationMessage =
          status === "rejected"
            ? `Your booking for ${service.name} was rejected. Reason: ${rejectionReason}`
            : `Your booking for ${service.name} has been accepted. The service provider will meet you at the scheduled time.`;

        const notificationTitle =
          status === "rejected" ? "Booking Rejected" : "Booking Accepted";

        await storage.createNotification({
          userId: booking.customerId,
          type: "booking_update",
          title: notificationTitle,
          message: notificationMessage,
        });

        logger.info(
          `[API] Booking status updated successfully: ID=${bookingId}, Status=${status}`,
        );
        logger.info(
          `[API] Notification sent to customer: ID=${booking.customerId}`,
        );

        res.json({
          booking: updatedBooking,
          message:
            status === "accepted"
              ? "Booking accepted successfully. Customer has been notified."
              : "Booking rejected. Customer has been notified with the reason.",
        });
      } catch (error) {
        logger.error("Error updating booking status:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update booking status",
          });
      }
    },
  );

  app.get(
    "/api/reviews/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const customerId = req.user!.id;
        const customerReviews = await storage.getReviewsByCustomer(customerId);
        res.json(customerReviews);
      } catch (error) {
        logger.error("Error fetching customer reviews:", error);
        res.status(500).json({ message: "Failed to fetch reviews" });
      }
    },
  );

  // Endpoint for providers to confirm payment and complete booking
  app.patch(
    "/api/bookings/:id/provider-complete",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const bookingId = parseInt(req.params.id);

        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });

        const service = await storage.getService(booking.serviceId!);
        if (!service || service.providerId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized" });
        }

        // Ensure the booking is in a state that can be completed by a provider (e.g., 'accepted')
        if (booking.status !== "awaiting_payment") {
          return res
            .status(400)
            .json({ message: "Booking not awaiting payment" });
        }

        const updatedBooking = await storage.updateBooking(bookingId, {
          status: "completed",
        });

        await storage.createNotification({
          userId: booking.customerId,
          type: "booking_update",
          title: "Payment Confirmed",
          message: `Provider confirmed payment for booking #${bookingId}.`,
        });
        let customer: Awaited<ReturnType<typeof storage.getUser>> | undefined;
        if (booking.customerId) {
          customer = await storage.getUser(booking.customerId);
          if (customer?.email) {
            const mailOptions =
              emailService.getServicePaymentConfirmedCustomerEmailContent(
                customer.name || customer.username,
                {
                  bookingId: bookingId.toString(),
                  serviceName: service.name,
                  bookingDate: booking.bookingDate,
                },
                {
                  amountPaid: service.price,
                  paymentId: booking.paymentReference || "N/A",
                },
              );
            await sendNotificationEmail({
              ...mailOptions,
              to: customer.email,
              notificationType: "servicePaymentConfirmedCustomer",
              recipientType: "customer",
              context: { bookingId, userId: customer.id },
            });
          }
        }
        const provider = await storage.getUser(service.providerId!);
        if (provider?.email) {
          const mailOptions =
            emailService.getServiceProviderPaymentReceivedEmailContent(
              provider.name || provider.username,
              {
                bookingId: bookingId.toString(),
                serviceName: service.name,
                bookingDate: booking.bookingDate,
              },
              { name: customer?.name || customer?.username || "Customer" },
              {
                amountReceived: service.price,
                paymentId: booking.paymentReference || "N/A",
              },
            );
          await sendNotificationEmail({
            ...mailOptions,
            to: provider.email,
            notificationType: "serviceProviderPaymentReceived",
            recipientType: "serviceProvider",
            context: { bookingId, userId: provider.id },
          });
        }
        res.json({ booking: updatedBooking });
      } catch (error) {
        logger.error("Error completing service by provider:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to complete service",
          });
      }
    },
  );

  // New dedicated route for sending 'Booking Accepted' email to customer
  app.post(
    "/api/bookings/:id/notify-customer-accepted",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      const bookingId = req.params.id;
      logger.info(
        `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Request received.`,
      );
      try {
        const parsedBookingId = parseInt(bookingId);
        if (isNaN(parsedBookingId)) {
          logger.error(
            `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Invalid booking ID format.`,
          );
          return res
            .status(400)
            .json({ message: "Invalid booking ID format." });
        }

        const booking = await storage.getBooking(parsedBookingId);
        if (!booking) {
          logger.error(
            `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Booking not found.`,
          );
          return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.status !== "accepted") {
          logger.warn(
            `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Booking status is '${booking.status}', not 'accepted', but proceeding with email as requested by this route.`,
          );
        }

        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching customer ID: ${booking.customerId}`,
        );
        const customer = await storage.getUser(booking.customerId!);
        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched customer:`,
          customer
            ? { id: customer.id, name: customer.name, email: customer.email }
            : "NOT FOUND",
        );

        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching service details ID: ${booking.serviceId}`,
        );
        const serviceDetails = await storage.getService(booking.serviceId!);
        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched serviceDetails:`,
          serviceDetails
            ? {
                id: serviceDetails.id,
                name: serviceDetails.name,
                providerId: serviceDetails.providerId,
              }
            : "NOT FOUND",
        );

        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching provider ID: ${serviceDetails?.providerId}`,
        );
        const provider =
          serviceDetails && serviceDetails.providerId !== null
            ? await storage.getUser(serviceDetails.providerId)
            : null;
        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched provider:`,
          provider ? { id: provider.id, name: provider.name } : "NOT FOUND",
        );

        if (!customer || !customer.email || !serviceDetails || !provider) {
          logger.error(
            `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Cannot send 'accepted' email: Essential data missing. Customer: ${!!customer}, Email: ${!!customer?.email}, Service: ${!!serviceDetails}, Provider: ${!!provider}.`,
          );
          return res
            .status(500)
            .json({
              message: `Cannot send 'accepted' email: Essential data missing for booking ID ${bookingId}.`,
            });
        }

        const emailContent = getBookingAcceptedEmailContent(
          customer.name || customer.username,
          {
            serviceName: serviceDetails.name,
            bookingDate: booking.bookingDate,
          },
          {
            name: provider.name || provider.username,
            location: serviceDetails.addressStreet
              ? `${serviceDetails.addressStreet}, ${serviceDetails.addressCity || ""}`.trim()
              : serviceDetails.addressCity || "Provider's Location",
          },
        );

        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] Attempting 'Booking Accepted' email to ${customer.email}`,
        );
        await sendNotificationEmail({
          to: customer.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
          notificationType: "bookingAccepted",
          recipientType: "customer",
          context: { bookingId: booking.id, userId: customer.id },
        });
        logger.info(
          `[NEW ACCEPT EMAIL ROUTE - Booking ID: ${bookingId}] 'Booking Accepted' email SENT to ${customer.email}`,
        );

        res
          .status(200)
          .json({
            message:
              "Customer notification for booking acceptance has been queued.",
          });
      } catch (error) {
        logger.error(
          `[NEW ACCEPT EMAIL ROUTE ERROR - Booking ID: ${bookingId}]`,
          error,
        );
        res.status(500).json({ message: "Failed to send acceptance email." });
      }
    },
  );

  // New dedicated route for sending 'Booking Rejected' email to customer
  app.post(
    "/api/bookings/:id/notify-customer-rejected",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      const bookingId = req.params.id;
      const parsedBody = bookingRejectionNotificationSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { rejectionReason } = parsedBody.data;
      logger.info(
        `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Request received. Reason: ${rejectionReason || "None"}`,
      );
      try {
        const parsedBookingId = parseInt(bookingId);
        if (isNaN(parsedBookingId)) {
          logger.error(
            `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Invalid booking ID format.`,
          );
          return res
            .status(400)
            .json({ message: "Invalid booking ID format." });
        }

        const booking = await storage.getBooking(parsedBookingId);
        if (!booking) {
          logger.error(
            `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Booking not found.`,
          );
          return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.status !== "rejected") {
          logger.warn(
            `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Booking status is '${booking.status}', not 'rejected', but proceeding with email as requested by this route.`,
          );
        }

        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching customer ID: ${booking.customerId}`,
        );
        const customer = await storage.getUser(booking.customerId!);
        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched customer:`,
          customer
            ? { id: customer.id, name: customer.name, email: customer.email }
            : "NOT FOUND",
        );

        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching service details ID: ${booking.serviceId}`,
        );
        const serviceDetails = await storage.getService(booking.serviceId!);
        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched serviceDetails:`,
          serviceDetails
            ? {
                id: serviceDetails.id,
                name: serviceDetails.name,
                providerId: serviceDetails.providerId,
              }
            : "NOT FOUND",
        );

        // Provider data is not strictly needed for rejection email content but fetching for consistency / future use
        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetching provider ID: ${serviceDetails?.providerId}`,
        );
        const provider =
          serviceDetails && serviceDetails.providerId !== null
            ? await storage.getUser(serviceDetails.providerId)
            : null;
        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Fetched provider:`,
          provider ? { id: provider.id, name: provider.name } : "NOT FOUND",
        );

        if (!customer || !customer.email || !serviceDetails) {
          // Provider is optional for rejection email content
          logger.error(
            `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Cannot send 'rejected' email: Essential data missing. Customer: ${!!customer}, Email: ${!!customer?.email}, Service: ${!!serviceDetails}.`,
          );
          return res
            .status(500)
            .json({
              message: `Cannot send 'rejected' email: Essential data missing for booking ID ${bookingId}.`,
            });
        }

        const finalRejectionReason =
          rejectionReason ||
          booking.rejectionReason ||
          "No specific reason provided.";

        const emailContent = getBookingRejectedEmailContent(
          customer.name || customer.username,
          {
            serviceName: serviceDetails.name,
            bookingDate: booking.bookingDate,
          },
          finalRejectionReason,
        );

        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] Attempting 'Booking Rejected' email to ${customer.email}`,
        );
        await sendNotificationEmail({
          to: customer.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
          notificationType: "bookingRejected",
          recipientType: "customer",
          context: { bookingId: booking.id, userId: customer.id },
        });
        logger.info(
          `[NEW REJECT EMAIL ROUTE - Booking ID: ${bookingId}] 'Booking Rejected' email SENT to ${customer.email}`,
        );

        res
          .status(200)
          .json({
            message:
              "Customer notification for booking rejection has been queued.",
          });
      } catch (error) {
        logger.error(
          `[NEW REJECT EMAIL ROUTE ERROR - Booking ID: ${bookingId}]`,
          error,
        );
        res.status(500).json({ message: "Failed to send rejection email." });
      }
    },
  );

  // Customer submits payment reference and marks booking awaiting provider confirmation
  app.patch(
    "/api/bookings/:id/customer-complete",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const parsedBody = paymentReferenceSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { paymentReference } = parsedBody.data;
        const bookingId = parseInt(req.params.id);

        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.customerId !== req.user!.id)
          return res.status(403).json({ message: "Not authorized" });

        if (booking.status !== "accepted") {
          return res.status(400).json({ message: "Booking not confirmed" });
        }

        // Update booking status to completed
        const updatedBooking = await storage.updateBooking(bookingId, {
          status: "awaiting_payment",
          paymentReference,
        });

        await storage.createNotification({
          userId: (await storage.getService(booking.serviceId!))!.providerId,
          type: "booking_update",
          title: "Payment Submitted",
          message: `Customer submitted payment reference for booking #${bookingId}.`,
        });
        const service = await storage.getService(booking.serviceId!);
        if (service?.providerId) {
          const provider = await storage.getUser(service.providerId);
          if (provider?.email) {
            const mail = emailService.getGenericNotificationEmailContent(
              provider.name,
              "Payment Submitted",
              `Customer submitted payment reference for booking #${bookingId}. Please confirm receipt.`,
            );
            await sendNotificationEmail({
              ...mail,
              to: provider.email,
              notificationType: "bookingUpdate",
              recipientType: "serviceProvider",
              context: { bookingId, userId: provider.id },
            });
          }
        }

        res.json({ booking: updatedBooking });
      } catch (error) {
        logger.error("Error submitting payment:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to submit payment",
          });
      }
    },
  );

  // Allow customer to update payment reference while awaiting provider confirmation
  app.patch(
    "/api/bookings/:id/update-reference",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const parsedBody = paymentReferenceSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { paymentReference } = parsedBody.data;
        const bookingId = parseInt(req.params.id);

        const booking = await storage.getBooking(bookingId);
        if (!booking)
          return res.status(404).json({ message: "Booking not found" });
        if (booking.customerId !== req.user!.id)
          return res.status(403).json({ message: "Not authorized" });
        if (booking.status !== "awaiting_payment")
          return res
            .status(400)
            .json({ message: "Cannot update reference for this booking" });

        const updatedBooking = await storage.updateBooking(bookingId, {
          paymentReference,
        });
        res.json({ booking: updatedBooking });
      } catch (error) {
        logger.error("Error updating payment reference:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update reference",
          });
      }
    },
  );

  // Get bookings for customer
  app.get(
    "/api/bookings",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const allowedStatusFilters: Booking["status"][] = [
          "pending",
          "accepted",
          "rejected",
          "rescheduled",
          "completed",
          "cancelled",
          "expired",
          "rescheduled_pending_provider_approval",
          "awaiting_payment",
          "disputed",
        ];

        const rawStatus =
          typeof req.query.status === "string"
            ? req.query.status.trim().toLowerCase()
            : undefined;

        let statusFilter: Booking["status"] | undefined;
        if (rawStatus && rawStatus !== "all") {
          if (allowedStatusFilters.includes(rawStatus as Booking["status"])) {
            statusFilter = rawStatus as Booking["status"];
          } else {
            return res.status(400).json({ message: "Invalid status filter" });
          }
        }

        const bookings = await storage.getBookingsByCustomer(req.user!.id, {
          status: statusFilter,
        });

        // Enrich bookings with service details
        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider details

            // Determine which address to show the customer
            let displayAddress = null;
            if (booking.serviceLocation === "provider") {
              displayAddress =
                booking.providerAddress ||
                (provider
                  ? `${provider.addressStreet || ""}, ${provider.addressCity || ""}, ${provider.addressState || ""}`
                      .trim()
                      .replace(/^, |, $/g, "")
                  : "Provider address not available");
            } else if (booking.serviceLocation === "customer") {
              // Customer already knows their own address, no need to display it here
              displayAddress = "Service at your location";
            }
            return {
              ...booking,
              status: booking.status,
              rejectionReason: booking.rejectionReason ?? null,
              service: service || { name: "Unknown Service" },
              providerName: provider?.name || "Unknown Provider",
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
          }),
        );

        res.json(enrichedBookings);
      } catch (error) {
        logger.error("Error fetching customer bookings:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch bookings",
          });
      }
    },
  );

  // Get bookings for provider
  app.get(
    "/api/bookings/provider",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const bookings = await storage.getBookingsByProvider(req.user!.id);

        // Enrich bookings with service details
        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            const service = await storage.getService(booking.serviceId!);
            const provider =
              service && service.providerId !== null
                ? await storage.getUser(service.providerId)
                : null; // Fetch provider details

            // Determine which address to show the customer
            let displayAddress = null;
            if (booking.serviceLocation === "provider") {
              displayAddress =
                booking.providerAddress ||
                (provider
                  ? `${provider.addressStreet || ""}, ${provider.addressCity || ""}, ${provider.addressState || ""}`
                      .trim()
                      .replace(/^, |, $/g, "")
                  : "Provider address not available");
            } else if (booking.serviceLocation === "customer") {
              // Customer already knows their own address, no need to display it here
              displayAddress = "Service at your location";
            }
            const customer =
              booking.customerId !== null
                ? await storage.getUser(booking.customerId)
                : null;

            // No need for customerContact object anymore, just return the full customer object

            return {
              ...booking,
              service: service || { name: "Unknown Service" },
              customer: customer, // Return the full customer object
            };
          }),
        );

        res.json(enrichedBookings);
      } catch (error) {
        logger.error("Error fetching provider bookings:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch bookings",
          });
      }
    },
  );

  app.post(
    "/api/bookings/:id/payment",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      res
        .status(200)
        .json({ message: "Payment functionality has been disabled." });
    },
  );

  app.get(
    "/api/bookings/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const bookings = await storage.getBookingsByCustomer(req.user!.id);
      res.json(bookings);
    },
  );
  app.post(
    "/api/waitlist",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const parsedBody = waitlistJoinSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { serviceId, preferredDate } = parsedBody.data;
      await storage.joinWaitlist(
        req.user!.id,
        serviceId,
        new Date(preferredDate),
      );

      // Create notification
      await storage.createNotification({
        userId: req.user!.id,
        type: "booking",
        title: "Added to Waitlist",
        message:
          "You've been added to the waitlist. We'll notify you when a slot becomes available.",
      });

      res.sendStatus(200);
    },
  );

  // Cart routes
  app.post(
    "/api/cart",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const parsedBody = cartItemSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { productId, quantity } = parsedBody.data;
      try {
        await storage.addToCart(req.user!.id, productId, quantity);
        res.json({ success: true });
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to add to cart",
          });
      }
    },
  );

  app.delete(
    "/api/cart/:productId",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        await storage.removeFromCart(
          req.user!.id,
          parseInt(req.params.productId),
        );
        res.json({ success: true });
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to remove from cart",
          });
      }
    },
  );

  app.get(
    "/api/cart",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const cart = await storage.getCart(req.user!.id);
        res.json(cart);
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to get cart",
          });
      }
    },
  );

  // Wishlist routes
  app.post(
    "/api/wishlist",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const parsedBody = wishlistItemSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { productId } = parsedBody.data;
      await storage.addToWishlist(req.user!.id, productId);
      res.json({ success: true }); // Send proper JSON response
    },
  );

  app.delete(
    "/api/wishlist/:productId",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      await storage.removeFromWishlist(
        req.user!.id,
        parseInt(req.params.productId),
      );
      res.sendStatus(200);
    },
  );

  app.get(
    "/api/wishlist",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const wishlist = await storage.getWishlist(req.user!.id);
      res.json(wishlist);
    },
  );

  // Review routes
  app.post(
    "/api/reviews",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const result = insertReviewSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const { serviceId, bookingId, rating, review } = result.data;

        if (!serviceId || !bookingId) {
          return res
            .status(400)
            .json({ message: "Invalid or missing serviceId or bookingId" });
        }

        // More direct check for an existing review for the same booking by the same customer
        const booking = await storage.getBooking(bookingId);
        if (!booking || booking.customerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "You can only review your own bookings." });
        }

        const existingReview = await db
          .select()
          .from(reviews)
          .where(
            and(
              eq(reviews.customerId, req.user!.id),
              eq(reviews.bookingId, bookingId),
            ),
          )
          .limit(1);

        if (existingReview.length > 0) {
          return res.status(409).json({
            message:
              "You have already reviewed this booking. You can edit your existing review.",
          });
        }

        const service = await storage.getService(serviceId);
        if (!service || !service.providerId)
          throw new Error("Service not found");

        const newReview = await storage.createReview({
          customerId: req.user!.id,
          serviceId,
          bookingId,
          rating,
          review,
        });

        await storage.updateProviderRating(service.providerId);
        res.status(201).json(newReview);
      } catch (error) {
        logger.error("Error saving review:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to save review",
          });
      }
    },
  );

  // Add endpoint to update an existing review
  app.patch(
    "/api/reviews/:id",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const reviewId = parseInt(req.params.id);
        const parsedBody = reviewUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        const updatePayload: Record<string, unknown> = {};
        if (parsedBody.data.rating !== undefined) {
          updatePayload.rating = parsedBody.data.rating;
        }
        if (parsedBody.data.review !== undefined) {
          updatePayload.review = parsedBody.data.review;
        }

        // Verify the review belongs to this user
        const existingReview = await storage.getReviewById(reviewId);
        if (!existingReview) {
          return res.status(404).json({ message: "Review not found" });
        }

        if (existingReview.customerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "You can only edit your own reviews" });
        }

        // Update the review
        const updatedReview = await storage.updateReview(reviewId, updatePayload);
        res.json(updatedReview);
      } catch (error) {
        logger.error("Error updating review:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update review",
          });
      }
    },
  );

  app.get("/api/reviews/service/:id", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsByService(parseInt(req.params.id));
    res.json(reviews);
  });

  app.get("/api/reviews/provider/:id", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsByProvider(parseInt(req.params.id));
    res.json(reviews);
  });

  // Add endpoint for service providers to reply to reviews
  app.post(
    "/api/reviews/:id/reply",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      try {
        const parsedBody = reviewReplySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { reply } = parsedBody.data;
        const reviewId = parseInt(req.params.id);

        // Get the review
        const review = await storage.getReviewById(reviewId);
        if (!review) {
          return res.status(404).json({ message: "Review not found" });
        }

        // Get the service to verify ownership
        const service = await storage.getService(review.serviceId!);
        if (!service || service.providerId !== req.user!.id) {
          return res
            .status(403)
            .json({
              message: "You can only reply to reviews for your own services",
            });
        }

        // Update the review with the provider's reply
        const updatedReview = await storage.updateReview(reviewId, {
          providerReply: reply,
        } as any);
        res.json(updatedReview);
      } catch (error) {
        logger.error("Error replying to review:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to reply to review",
          });
      }
    },
  );

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const notifications = await storage.getNotificationsByUser(req.user!.id);
    res.json(notifications);
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await storage.markNotificationAsRead(parseInt(req.params.id));
    res.sendStatus(200);
  });

  app.patch(
    "/api/notifications/mark-all-read",
    requireAuth,
    async (req, res) => {
      const parsedBody = notificationsMarkAllSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { role } = parsedBody.data;
      // Pass both user ID and role to properly filter notifications
      await storage.markAllNotificationsAsRead(req.user!.id, role);
      res.sendStatus(200);
    },
  );

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    await storage.deleteNotification(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Order Management
  app.post(
    "/api/orders",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const orderSchema = z.object({
          items: z.array(
            z.object({
              productId: z.number(),
              quantity: z.number().min(1),
              price: z.string().or(z.number()),
            }),
          ),
          total: z.string().or(z.number()),
          subtotal: z.string().or(z.number()).optional(),
          discount: z.string().or(z.number()).optional(),
          promotionId: z.number().optional(),
          deliveryMethod: z.enum(["delivery", "pickup"]),
          paymentMethod: PaymentMethodType.optional(),
        });

        const result = orderSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const {
          items,
          total: requestedTotal,
          subtotal,
          discount,
          promotionId,
          deliveryMethod,
          paymentMethod = "upi",
        } = result.data;

        if (deliveryMethod === "delivery" && paymentMethod === "cash") {
          return res
            .status(400)
            .json({
              message: "Cash payment only available for pickup orders",
            });
        }

        // Validate products, stock, and ensure all items are from same shop
        let shopId: number | null | undefined;
        for (const item of items) {
          const product = await storage.getProduct(item.productId);
          if (!product) {
            return res
              .status(400)
              .json({ message: `Product with ID ${item.productId} not found` });
          }
          if (product.stock < item.quantity) {
            return res
              .status(400)
              .json({
                message: `Insufficient stock for product: ${product.name}`,
              });
          }
          const productShopId = product.shopId;
          if (productShopId == null) {
            return res
              .status(400)
              .json({ message: `Product with ID ${item.productId} has no shop` });
          }
          if (shopId == null) {
            shopId = productShopId;
          } else if (productShopId !== shopId) {
            return res
              .status(400)
              .json({
                message: "All items must be from the same shop",
              });
          }
        }
        if (shopId === undefined) {
          return res.status(400).json({ message: "No items provided" });
        }

        const toNumber = (value: string | number) =>
          typeof value === "number" ? value : Number(value);
        const optionalToNumber = (value: string | number | undefined) =>
          value === undefined ? undefined : toNumber(value);

        const subtotalFromRequest = optionalToNumber(subtotal);
        const subtotalValue =
          subtotalFromRequest !== undefined
            ? subtotalFromRequest
            : items.reduce((sum, item) => sum + toNumber(item.price) * item.quantity, 0);

        if (!Number.isFinite(subtotalValue)) {
          return res.status(400).json({ message: "Invalid subtotal amount" });
        }

        const discountValue = optionalToNumber(discount) ?? 0;
        if (!Number.isFinite(discountValue)) {
          return res.status(400).json({ message: "Invalid discount amount" });
        }

        const computedTotalRaw =
          subtotalValue - discountValue + PLATFORM_SERVICE_FEE;
        if (!Number.isFinite(computedTotalRaw)) {
          return res.status(400).json({ message: "Invalid order amount" });
        }

        const computedTotal = Number(computedTotalRaw.toFixed(2));
        const totalAsString = computedTotal.toFixed(2);

        const requestedTotalValue = optionalToNumber(requestedTotal);
        if (
          requestedTotalValue !== undefined &&
          Math.abs(requestedTotalValue - computedTotal) > 0.01
        ) {
          logger.warn(
            `Order total mismatch for user ${req.user!.id}: requested ${requestedTotalValue}, computed ${computedTotal}`,
          );
        }

        // If a promotion is applied, verify it's valid
        let promotionCode = null;
        if (promotionId) {
          const promotionResult = await db
            .select()
            .from(promotions)
            .where(eq(promotions.id, promotionId));
          if (!promotionResult.length) {
            return res.status(400).json({ message: "Invalid promotion" });
          }

          const promotion = promotionResult[0];

          // Verify promotion belongs to the shop
          if (promotion.shopId !== shopId) {
            return res
              .status(400)
              .json({ message: "Promotion does not apply to this shop" });
          }

          // Verify promotion is active and not expired
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

          // Verify usage limit
          if (
            promotion.usageLimit &&
            (promotion.usedCount ?? 0) >= promotion.usageLimit
          ) {
            return res
              .status(400)
              .json({ message: "This promotion has reached its usage limit" });
          }

          promotionCode = promotion.code || null;
        }

        const customer = req.user!;
        if (shopId == null) {
          return res
            .status(400)
            .json({ message: "Shop information is missing" });
        }

        const shop = await storage.getUser(shopId);
        if (!shop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        const customerAddress = formatUserAddress(customer);
        const shopAddress = formatUserAddress(shop);
        const derivedShippingAddress =
          deliveryMethod === "delivery" ? customerAddress : shopAddress;
        const shippingAddress = derivedShippingAddress || "";
        const derivedBillingAddress =
          deliveryMethod === "delivery" ? customerAddress : shopAddress;

        const newOrder = await storage.createOrder({
          customerId: customer.id,
          shopId,
          status: "pending",
          paymentStatus: "pending",
          deliveryMethod,
          paymentMethod,
          total: totalAsString,
          orderDate: new Date(),
          shippingAddress,
          billingAddress: derivedBillingAddress || "",
        });
        logger.info(`Created order ${newOrder.id}`);
        // Create order items
        for (const item of items) {
          await storage.createOrderItem({
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price.toString(),
            total: (
              parseFloat(item.price.toString()) * item.quantity
            ).toString(),
          });

          // Update product stock
          await storage.updateProductStock(item.productId, item.quantity);
        }

        // Clear cart after order creation
        await storage.clearCart(req.user!.id);

        // Send order confirmation emails
        try {
          const shopDisplayName = shop.name || shop.username || "DoorStep Shop";
          const customerDisplayName = customer.name || customer.username;

          const itemsWithNames = await Promise.all(
            items.map(async (item) => {
              const product = await storage.getProduct(item.productId);
              return {
                name: product?.name ?? "",
                quantity: item.quantity,
                price: item.price,
              };
            }),
          );

          const contactDetails = {
            deliveryMethod,
            customerPhone: customer.phone,
            customerAddress: customerAddress || undefined,
            shopPhone: shop.phone,
            shopAddress: shopAddress || undefined,
          };

          const customerEmailContent = getOrderConfirmationEmailContent({
            recipientName: customerDisplayName,
            customerName: customerDisplayName,
            shopName: shopDisplayName,
            orderNumber: newOrder.id,
            total: newOrder.total,
            items: itemsWithNames,
            ...contactDetails,
          });
          if (customer.email) {
            await sendNotificationEmail({
              to: customer.email,
              subject: customerEmailContent.subject,
              text: customerEmailContent.text,
              html: customerEmailContent.html,
              notificationType: "orderConfirmation",
              recipientType: "customer",
              context: { orderId: newOrder.id, userId: customer.id },
            });
          } else {
            logger.warn(
              `Order ${newOrder.id}: customer ${customer.id} has no email. Skipping confirmation email.`,
            );
          }

          const shopEmailContent = getOrderConfirmationEmailContent({
            recipientName: shopDisplayName,
            customerName: customerDisplayName,
            shopName: shopDisplayName,
            orderNumber: newOrder.id,
            total: newOrder.total,
            items: itemsWithNames,
            forShopOwner: true,
            ...contactDetails,
          });
          if (shop.email) {
            await sendNotificationEmail({
              to: shop.email,
              subject: shopEmailContent.subject,
              text: shopEmailContent.text,
              html: shopEmailContent.html,
              notificationType: "orderConfirmation",
              recipientType: "shop",
              context: { orderId: newOrder.id, userId: shop.id },
            });
          } else {
            logger.warn(
              `Order ${newOrder.id}: shop ${shop.id} has no email. Skipping confirmation email.`,
            );
          }
        } catch (emailError) {
          logger.error("Error sending order confirmation emails:", emailError);
          // Don't let email failure break the order creation flow
        }

        res.status(201).json({ order: newOrder });
      } catch (error) {
        logger.error("Order creation error:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to create order",
          });
      }
    },
  );

  app.post(
    "/api/orders/:id/payment",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      res
        .status(200)
        .json({ message: "Payment functionality has been disabled." });
    },
  );

  app.get(
    "/api/orders/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const allowedOrderStatus: Order["status"][] = [
        "pending",
        "cancelled",
        "confirmed",
        "processing",
        "packed",
        "shipped",
        "delivered",
        "returned",
      ];

      const rawStatus =
        typeof req.query.status === "string"
          ? req.query.status.trim().toLowerCase()
          : undefined;

      let statusFilter: Order["status"] | undefined;
      if (rawStatus && rawStatus !== "all") {
        if (allowedOrderStatus.includes(rawStatus as Order["status"])) {
          statusFilter = rawStatus as Order["status"];
        } else {
          return res.status(400).json({ message: "Invalid status filter" });
        }
      }

      const orders = await storage.getOrdersByCustomer(req.user!.id, {
        status: statusFilter,
      });
      const detailed = await Promise.all(
        orders.map(async (order) => {
          const itemsRaw = await storage.getOrderItemsByOrder(order.id);
          const items = await Promise.all(
            itemsRaw.map(async (item) => {
              const product =
                item.productId !== null
                  ? await storage.getProduct(item.productId)
                  : null;
              return {
                id: item.id,
                productId: item.productId,
                name: product?.name ?? "",
                quantity: item.quantity,
                price: item.price,
                total: item.total,
              };
            }),
          );
          const shop =
            order.shopId !== null
              ? await storage.getUser(order.shopId)
              : undefined;
          return {
            ...order,
            items,
            shop: shop
              ? { name: shop.name, phone: shop.phone, email: shop.email }
              : undefined,
          };
        }),
      );
      res.json(detailed);
    },
  );

  app.get(
    "/api/shops/dashboard-stats",
    requireAuth,
    requireShopOrWorkerPermission(["analytics:view"]),
    async (req, res) => {
      const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
      const stats = await storage.getShopDashboardStats(shopContextId);
      res.json(stats);
    },
  );

  app.get(
    "/api/orders/shop/recent",
    requireAuth,
    requireShopOrWorkerPermission(["orders:read"]),
    async (req, res) => {
      const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
      const orders = await storage.getRecentOrdersByShop(shopContextId);
      const detailed = await Promise.all(
        orders.map(async (order) => {
          const itemsRaw = await storage.getOrderItemsByOrder(order.id);
          const items = await Promise.all(
            itemsRaw.map(async (item) => {
              const product =
                item.productId !== null
                  ? await storage.getProduct(item.productId)
                  : null;
              return {
                id: item.id,
                productId: item.productId,
                name: product?.name ?? "",
                quantity: item.quantity,
                price: item.price,
                total: item.total,
              };
            }),
          );
          const customer =
            order.customerId !== null
              ? await storage.getUser(order.customerId)
              : undefined;
          return {
            ...order,
            items,
            customer: customer
              ? {
                  name: customer.name,
                  phone: customer.phone,
                  email: customer.email,
                }
              : undefined,
          };
        }),
      );
      res.json(detailed);
    },
  );

  app.get(
    "/api/orders/shop",
    requireAuth,
    requireShopOrWorkerPermission(["orders:read"]),
    async (req, res) => {
      const { status } = req.query;
      const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
      const orders = await storage.getOrdersByShop(shopContextId, status as string | undefined);
      const detailed = await Promise.all(
        orders.map(async (order) => {
          const itemsRaw = await storage.getOrderItemsByOrder(order.id);
          const items = await Promise.all(
            itemsRaw.map(async (item) => {
              const product =
                item.productId !== null
                  ? await storage.getProduct(item.productId)
                  : null;
              return {
                id: item.id,
                productId: item.productId,
                name: product?.name ?? "",
                quantity: item.quantity,
                price: item.price,
                total: item.total,
              };
            }),
          );
          const customer =
            order.customerId !== null
              ? await storage.getUser(order.customerId)
              : undefined;
          return {
            ...order,
            items,
            customer: customer
              ? {
                  name: customer.name,
                  phone: customer.phone,
                  email: customer.email,
                }
              : undefined,
          };
        }),
      );
      res.json(detailed);
    },
  );

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    const order = await storage.getOrder(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.customerId !== req.user!.id) {
      // Allow shop owners or their workers if the order belongs to their shop
      if (req.user!.role === "shop") {
        if (order.shopId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
      } else if (req.user!.role === "worker") {
        const workerShopId = await getWorkerShopId(req.user!.id);
        if (!workerShopId || order.shopId !== workerShopId) {
          return res.status(403).json({ message: "Not authorized" });
        }
      } else {
        return res.status(403).json({ message: "Not authorized" });
      }
    }
    const itemsRaw = await storage.getOrderItemsByOrder(order.id);
    const items = await Promise.all(
      itemsRaw.map(async (item) => {
        const product =
          item.productId !== null
            ? await storage.getProduct(item.productId)
            : null;
        return {
          id: item.id,
          productId: item.productId,
          name: product?.name ?? "",
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        };
      }),
    );
    const customer =
      order.customerId !== null
        ? await storage.getUser(order.customerId)
        : undefined;
    const shop =
      order.shopId !== null ? await storage.getUser(order.shopId) : undefined;
    res.json({
      ...order,
      items,
      customer: customer
        ? {
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: formatUserAddress(customer),
          }
        : undefined,
      shop: shop
        ? {
            name: shop.name,
            phone: shop.phone,
            email: shop.email,
            address: formatUserAddress(shop),
            upiId: (shop as any).upiId,
            returnsEnabled: (shop as any).returnsEnabled,
          }
        : undefined,
    });
  });

  // Customer submits payment reference for manual verification
  app.post(
    "/api/orders/:id/submit-payment-reference",
    requireAuth,
    async (req, res) => {
      const orderId = parseInt(req.params.id);
      const parsedBody = orderPaymentReferenceSchema.safeParse(req.body);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid request" });
      }
      if (!parsedBody.success) {
        return res.status(400).json(formatValidationError(parsedBody.error));
      }
      const { paymentReference } = parsedBody.data;
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.customerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.updateOrder(orderId, {
        paymentStatus: "verifying",
        paymentReference,
      });
      if (order.shopId) {
        await storage.createNotification({
          userId: order.shopId,
          type: "order",
          title: "Action Required",
          message: `Payment reference for Order #${orderId} has been submitted. Please verify.`,
        });
      }
      res.json(updated);
    },
  );

  // Shop confirms payment after manual verification
  app.post(
    "/api/orders/:id/confirm-payment",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId))
        return res.status(400).json({ message: "Invalid order id" });
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
      if (order.shopId !== shopContextId)
        return res.status(403).json({ message: "Not authorized" });
      if (
        (order.paymentMethod === "upi" && order.paymentStatus !== "verifying") ||
        (order.paymentMethod === "cash" && order.paymentStatus !== "pending")
      ) {
        return res
          .status(400)
          .json({ message: "Order is not awaiting verification" });
      }
      const updated = await storage.updateOrder(orderId, {
        paymentStatus: "paid",
        status: "confirmed",
      });
      if (order.customerId) {
        await storage.createNotification({
          userId: order.customerId,
          type: "order",
          title: "Payment Confirmed",
          message: `Payment Confirmed! Your Order #${orderId} is now being processed.`,
        });
      }
      res.json(updated);
    },
  );

  // Add an endpoint to get service availability
  app.get("/api/services/:id/bookings", requireAuth, async (req, res) => {
    const { date } = req.query;
    const serviceId = parseInt(req.params.id);

    const service = await storage.getService(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const bookings = await storage.getBookingsByService(
      serviceId,
      new Date(date as string),
    );
    res.json(
      bookings.map((booking) => ({
        start: booking.bookingDate,
        end: new Date(
          booking.bookingDate.getTime() +
            (service.duration + (service.bufferTime || 0)) * 60000,
        ),
      })),
    );
  });

  // Enhanced booking routes with notifications
  app.post(
    "/api/bookings/:id/confirm",
    requireAuth,
    requireRole(["provider"]),
    async (req, res) => {
      const booking = await storage.updateBooking(parseInt(req.params.id), {
        status: "accepted",
      });

      // Send confirmation notifications
      const customer =
        booking.customerId !== null
          ? await storage.getUser(booking.customerId)
          : null;
      if (customer) {
        // Create in-app notification
        await storage.createNotification({
          userId: customer.id,
          type: "booking",
          title: "Booking Confirmed",
          message: `Your booking for ${formatIndianDisplay(booking.bookingDate, "date")} has been confirmed.`, // Use formatIndianDisplay
        });

        // Send SMS notification
        await storage.sendSMSNotification(
          customer.phone,
          `Your booking for ${formatIndianDisplay(booking.bookingDate, "date")} has been confirmed.`, // Use formatIndianDisplay
        );

        // Send email notification
        await storage.sendEmailNotification(
          customer.email,
          "Booking Confirmation",
          `Your booking for ${formatIndianDisplay(booking.bookingDate, "date")} has been confirmed.`, // Use formatIndianDisplay
        );
      }

      res.json(booking);
    },
  );

  // Order tracking routes with permissions
  app.get(
    "/api/orders/:id/timeline",
    requireAuth,
    // If customer, handle directly; otherwise fall through to worker/shop check
    async (req: any, res, next) => {
      if (req.user?.role === "customer") {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId))
          return res.status(400).json({ message: "Invalid order id" });
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.customerId !== req.user.id)
          return res.status(403).json({ message: "Not authorized" });
        const timeline = await storage.getOrderTimeline(orderId);
        return res.json(timeline);
      }
      next();
    },
    requireShopOrWorkerPermission(["orders:read"]),
    async (req: any, res) => {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId))
        return res.status(400).json({ message: "Invalid order id" });
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const shopContextId = req.user.role === "shop" ? req.user.id : req.workerShopId;
      if (order.shopId !== shopContextId)
        return res.status(403).json({ message: "Not authorized" });
      const timeline = await storage.getOrderTimeline(orderId);
      res.json(timeline);
    },
  );

  app.patch(
    "/api/orders/:id/status",
    requireAuth,
    requireShopOrWorkerPermission(["orders:update"]),
    async (req, res) => {
      try {
        const parsedBody = orderStatusUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { status, trackingInfo } = parsedBody.data;
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) {
          return res.status(400).json({ message: "Invalid order id" });
        }
        const order = await storage.getOrder(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        if (order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }

        const updated = await storage.updateOrderStatus(
          orderId,
          status,
          trackingInfo,
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
          const customer =
            updated.customerId !== null
              ? await storage.getUser(updated.customerId)
              : undefined;
          if (customer) {
            await storage.sendSMSNotification(
              customer.phone,
              `Your order #${updated.id} has been ${status}. ${trackingInfo || ""}`,
            );
          }
        }

        res.json(updated);
      } catch (error) {
        logger.error("Error updating order status:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update order status",
          });
      }
    },
  );

  // Return and refund routes
  app.post(
    "/api/orders/:orderId/return",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const result = insertReturnRequestSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId))
        return res.status(400).json({ message: "Invalid order id" });

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
          message:
            "Your return request has been received and is being processed.",
        });

        res.status(201).json(returnRequest);
      } else {
        res
          .status(400)
          .json({
            message: "Order must be delivered before initiating return",
          });
      }
    },
  );

  app.post(
    "/api/returns/:id/approve",
    requireAuth,
    requireShopOrWorkerPermission(["returns:manage"]),
    async (req, res) => {
      try {
        const returnRequest = await storage.getReturnRequest(
          parseInt(req.params.id),
        );
        if (!returnRequest)
          return res.status(404).json({ message: "Return request not found" });

        // Ensure this return belongs to the caller's shop
        const order = returnRequest.orderId ? await storage.getOrder(returnRequest.orderId) : null;
        const shopContextId = req.user!.role === "shop" ? req.user!.id : (req as any).workerShopId;
        if (!order || order.shopId !== shopContextId) {
          return res.status(403).json({ message: "Not authorized" });
        }

        // Process refund through configured payment provider
        await storage.processRefund(returnRequest.id);

        const updatedReturn = await storage.updateReturnRequest(
          returnRequest.id,
          {
            status: "approved",
          },
        );

        // Notify customer about approved return (use the same order instance)
        if (order) {
          await storage.createNotification({
            userId: order.customerId,
            type: "return",
            title: "Return Request Approved",
            message:
              "Your return request has been approved. Refund will be processed shortly.",
          });

          // Send SMS notification
          // Ensure order.customerId is not null before fetching customer
          const customer =
            order.customerId !== null
              ? await storage.getUser(order.customerId)
              : null;
          if (customer) {
            await storage.sendSMSNotification(
              customer.phone,
              "Your return request has been approved. Refund will be processed shortly.",
            );
          }
        }

        res.json(updatedReturn);
      } catch (error) {
        logger.error("Error approving return:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to approve return",
          });
      }
    },
  );

  // Add this route for user details
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
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
        locationState,
      } = req.query;

      const filters: any = {};
      if (category) filters.category = String(category).toLowerCase();
      if (minPrice) filters.minPrice = parseFloat(String(minPrice));
      if (maxPrice) filters.maxPrice = parseFloat(String(maxPrice));
      if (tags)
        filters.tags = String(tags)
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag);
      if (searchTerm) filters.searchTerm = String(searchTerm);
      if (shopId) filters.shopId = parseInt(String(shopId));
      if (attributes) {
        try {
          filters.attributes = JSON.parse(String(attributes));
        } catch (e) {
          logger.error("Failed to parse product attributes filter", e);
          // Optionally return a 400 error or ignore the filter
        }
      }
      if (locationCity) filters.locationCity = String(locationCity);
      if (locationState) filters.locationState = String(locationState);

      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      logger.error("Error fetching products:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch products",
        });
    }
  });

  // Get a specific product by shop ID and product ID
  app.get(
    "/api/shops/:shopId/products/:productId",
    requireAuth,
    async (req, res) => {
      try {
        const shopId = parseInt(req.params.shopId);
        const productId = parseInt(req.params.productId);
        const product = await storage.getProduct(productId);

        if (!product || product.shopId !== shopId) {
          return res
            .status(404)
            .json({ message: "Product not found in this shop" });
        }
        res.json(product);
      } catch (error) {
        logger.error("Error fetching product:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch product",
          });
      }
    },
  );

  // Get shop details by ID
  app.get("/api/shops/:shopId", requireAuth, async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const shop = await storage.getUser(shopId);

      if (!shop || shop.role !== "shop") {
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
      logger.error("Error fetching shop details:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch shop details",
        });
    }
  });

  app.delete(
    "/api/products/:id",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        logger.info(`Delete product request received for ID: ${req.params.id}`);
        const productId = parseInt(req.params.id);
        const product = await storage.getProduct(productId);

        if (!product) {
          logger.info(`Product with ID ${productId} not found`);
          return res.status(404).json({ message: "Product not found" });
        }

        if (product.shopId !== req.user!.id) {
          logger.info(
            `Unauthorized delete attempt for product ${productId} by user ${req.user!.id}`,
          );
          return res
            .status(403)
            .json({ message: "Can only delete own products" });
        }

        try {
          // First, remove the product from all carts to avoid foreign key constraint violations
          logger.info(
            `Removing product ${productId} from all carts before deletion`,
          );
          await storage.removeProductFromAllCarts(productId);

          // Then delete the product
          logger.info(`Deleting product with ID: ${productId}`);
          await storage.deleteProduct(productId);
          logger.info(`Product ${productId} deleted successfully`);
          res.status(200).json({ message: "Product deleted successfully" });
        } catch (deleteError) {
          logger.error(`Error during product deletion process: ${deleteError}`);
          res.status(400).json({
            message:
              deleteError instanceof Error
                ? deleteError.message
                : "Failed to delete product. It may be referenced in orders or other records.",
          });
        }
      } catch (error) {
        logger.error("Error deleting product:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete product",
          });
      }
    },
  );

  // Product Reviews
  app.get("/api/reviews/product/:id", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const reviews = await storage.getProductReviewsByProduct(productId);
      res.json(reviews);
    } catch (error) {
      logger.error("Error fetching product reviews:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch reviews",
        });
    }
  });

  app.get("/api/reviews/shop/:id", requireAuth, async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      const reviews = await storage.getProductReviewsByShop(shopId);
      res.json(reviews);
    } catch (error) {
      logger.error("Error fetching shop product reviews:", error);
      res
        .status(400)
        .json({
          message:
            error instanceof Error ? error.message : "Failed to fetch reviews",
        });
    }
  });

  app.get(
    "/api/product-reviews/customer",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const reviews = await storage.getProductReviewsByCustomer(req.user!.id);
        res.json(reviews);
      } catch (error) {
        logger.error("Error fetching customer product reviews:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch reviews",
          });
      }
    },
  );

  app.post(
    "/api/product-reviews",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      const result = insertProductReviewSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      if (!result.data.orderId) {
        return res.status(400).json({ message: "Order id required" });
      }
      const order = await storage.getOrder(result.data.orderId);
      if (!order || order.customerId !== req.user!.id) {
        return res.status(403).json({ message: "Cannot review this order" });
      }

      try {
        const review = await storage.createProductReview({
          ...result.data,
          customerId: req.user!.id,
          isVerifiedPurchase: true,
        });
        res.status(201).json(review);
      } catch (error) {
        res
          .status(400)
          .json({
            message:
              error instanceof Error ? error.message : "Failed to save review",
          });
      }
    },
  );

  app.patch(
    "/api/product-reviews/:id",
    requireAuth,
    requireRole(["customer"]),
    async (req, res) => {
      try {
        const reviewId = parseInt(req.params.id);
        const parsedBody = reviewUpdateSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }

        const updatePayload: Record<string, unknown> = {};
        if (parsedBody.data.rating !== undefined) {
          updatePayload.rating = parsedBody.data.rating;
        }
        if (parsedBody.data.review !== undefined) {
          updatePayload.review = parsedBody.data.review;
        }

        const existing = await storage.getProductReviewById(reviewId);
        if (!existing) {
          return res.status(404).json({ message: "Review not found" });
        }
        if (existing.customerId !== req.user!.id) {
          return res
            .status(403)
            .json({ message: "You can only edit your own reviews" });
        }

        const updated = await storage.updateProductReview(reviewId, updatePayload);
        res.json(updated);
      } catch (error) {
        logger.error("Error updating product review:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update review",
          });
      }
    },
  );
  app.post(
    "/api/product-reviews/:id/reply",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        const parsedBody = reviewReplySchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json(formatValidationError(parsedBody.error));
        }
        const { reply } = parsedBody.data;
        const reviewId = parseInt(req.params.id);
        const existingReview = await storage.getProductReviewById(reviewId);
        if (!existingReview) {
          return res.status(404).json({ message: "Review not found" });
        }
        if (existingReview.productId === null) {
          return res.status(400).json({ message: "Invalid review" });
        }
        const product = existingReview.productId
          ? await storage.getProduct(existingReview.productId)
          : null;
        if (!product || product.shopId !== req.user!.id) {
          return res
            .status(403)
            .json({
              message: "You can only reply to reviews for your own products",
            });
        }
        const review = await storage.updateProductReview(reviewId, {
          shopReply: reply,
        });
        res.json(review);
      } catch (error) {
        logger.error("Error replying to review:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to reply to review",
          });
      }
    },
  );

  // Promotions Management
  app.post(
    "/api/promotions",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
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
          expiryDays: z.coerce.number().min(0).default(0),
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

        logger.info("Creating promotion with calculated dates:", {
          startDate,
          endDate,
          expiryDays,
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

  app.get(
    "/api/promotions/shop/:id",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        const promotions = await storage.getPromotionsByShop(
          parseInt(req.params.id),
        );
        res.json(promotions);
      } catch (error) {
        logger.error("Error fetching promotions:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch promotions",
          });
      }
    },
  );

  app.patch(
    "/api/promotions/:id",
    requireAuth,
    requireRole(["shop"]),
    async (req, res) => {
      try {
        const promotionId = parseInt(req.params.id);

        // Get the existing promotion to check ownership
        const existingPromotions = await storage.getPromotionsByShop(
          req.user!.id,
        );
        const promotion = existingPromotions.find((p) => p.id === promotionId);

        if (!promotion) {
          return res
            .status(404)
            .json({
              message:
                "Promotion not found or you don't have permission to update it",
            });
        }

        // Define a Zod schema for the promotion update with expiryDays
        const promotionUpdateSchema = z.object({
          name: z.string().min(1, "Promotion name is required").optional(),
          description: z.string().optional(),
          type: z.enum(["percentage", "fixed_amount"]).optional(),
          value: z.coerce
            .number()
            .min(0, "Discount value must be positive")
            .optional(),
          code: z.string().optional(),
          usageLimit: z.coerce.number().min(0).optional(),
          isActive: z.boolean().optional(),
          expiryDays: z.coerce.number().min(0).optional(),
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
        const updatedResult = await db
          .update(promotions)
          .set({
            ...updateData,
            value:
              updateData.value !== undefined
                ? updateData.value.toString()
                : updateData.value,
          })
          .where(eq(promotions.id, promotionId))
          .returning();

        if (!updatedResult[0]) {
          return res
            .status(404)
            .json({ message: "Failed to update promotion" });
        }

        res.json(updatedResult[0]);
      } catch (error) {
        logger.error("Error updating promotion:", error);
        res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Failed to update promotion",
          });
      }
    },
  );

  // Register promotion routes
  registerPromotionRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
