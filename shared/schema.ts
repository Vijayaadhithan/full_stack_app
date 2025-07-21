import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import type { SessionData } from "express-session";
import { z } from "zod";

export type UserRole = "customer" | "provider" | "shop" | "admin";
export type PaymentMethod = {
  type: "card" | "upi";
  details: Record<string, string>;
};

// Enhanced shop profile fields
export type ShopProfile = {
  shopName: string;
  description: string;
  businessType: string;
  gstin?: string | null;
  workingHours: {
    from: string;
    to: string;
    days: string[];
  };
  shippingPolicy?: string;
  returnPolicy?: string;
};

// Add working hours type
export type WorkingHours = {
  monday: { isAvailable: boolean; start: string; end: string };
  tuesday: { isAvailable: boolean; start: string; end: string };
  wednesday: { isAvailable: boolean; start: string; end: string };
  thursday: { isAvailable: boolean; start: string; end: string };
  friday: { isAvailable: boolean; start: string; end: string };
  saturday: { isAvailable: boolean; start: string; end: string };
  sunday: { isAvailable: boolean; start: string; end: string };
};

export type BreakTime = {
  start: string;
  end: string;
};

export type BlockedTimeSlot = {
  id: number;
  serviceId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  isRecurring: boolean;
  recurringEndDate?: string;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").$type<UserRole>().notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  addressStreet: text("address_street"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressPostalCode: text("address_postal_code"),
  addressCountry: text("address_country"),
  language: text("language").default("en"),
  profilePicture: text("profile_picture"),
  paymentMethods: jsonb("payment_methods").$type<PaymentMethod[]>(),
  shopProfile: jsonb("shop_profile").$type<ShopProfile>(),
  googleId: text("google_id").unique(), // Added for Google OAuth
  emailVerified: boolean("email_verified").default(false), // Added for Google OAuth
  // Provider profile fields
  bio: text("bio"),
  qualifications: text("qualifications"),
  experience: text("experience"),
  workingHours: text("working_hours"),
  languages: text("languages"),
  // Enhanced profile fields for providers and shops
  verificationStatus: text("verification_status")
    .$type<"unverified" | "pending" | "verified">()
    .default("unverified"),
  verificationDocuments: jsonb("verification_documents").$type<string[]>(), // Array of document URLs or identifiers
  profileCompleteness: integer("profile_completeness").default(0), // Percentage
  specializations: text("specializations").array(), // For providers
  certifications: text("certifications").array(), // For providers
  shopBannerImageUrl: text("shop_banner_image_url"), // For shops
  shopLogoImageUrl: text("shop_logo_image_url"), // For shops
  yearsInBusiness: integer("years_in_business"),
  socialMediaLinks: jsonb("social_media_links").$type<Record<string, string>>(), // e.g., { facebook: "url", instagram: "url" }
  upiId: text("upi_id"),
  upiQrCodeUrl: text("upi_qr_code_url"),
  //rating: decimal("rating", { precision: 2, scale: 1 }),
  deliveryAvailable: boolean("delivery_available").default(false),
  pickupAvailable: boolean("pickup_available").default(true),
  returnsEnabled: boolean("returns_enabled").default(true),
  averageRating: decimal("average_rating").default("0"),
  totalReviews: integer("total_reviews").default(0),
});

// Update services table with new availability fields and soft deletion
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price").notNull(),
  duration: integer("duration").notNull(), // in minutes
  isAvailable: boolean("is_available").default(true),
  isDeleted: boolean("is_deleted").default(false), // Add soft deletion flag
  category: text("category").notNull(),
  images: text("images").array(),
  addressStreet: text("address_street"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressPostalCode: text("address_postal_code"),
  addressCountry: text("address_country"),
  // Removed latitude and longitude
  bufferTime: integer("buffer_time").default(15), // in minutes
  workingHours: jsonb("working_hours").$type<WorkingHours>(),
  breakTime: jsonb("break_time").$type<BreakTime[]>(),
  maxDailyBookings: integer("max_daily_bookings").default(10),
  serviceLocationType: text("service_location_type")
    .$type<"customer_location" | "provider_location">()
    .notNull()
    .default("provider_location"), // New field: where the service takes place
});

export const serviceAvailability = pgTable("service_availability", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"), // e.g., "WEEKLY", "MONTHLY"
  maxBookings: integer("max_bookings").default(1),
});

// Update the bookings table
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  bookingDate: timestamp("booking_date").notNull(),
  status: text("status")
    .$type<
      | "pending"
      | "accepted"
      | "rejected"
      | "rescheduled"
      | "completed"
      | "cancelled"
      | "expired"
      | "rescheduled_pending_provider_approval"
      | "awaiting_payment"
      | "disputed"
    >()
    .notNull(),
  paymentStatus: text("payment_status", {
    enum: ["pending", "verifying", "paid", "failed"],
  })
    .$type<"pending" | "verifying" | "paid" | "failed">()
    .default("pending"),
  deliveryMethod: text("delivery_method", { enum: ["delivery", "pickup"] }),
  rejectionReason: text("rejection_reason"),
  rescheduleDate: timestamp("reschedule_date"), // This can store the original date if rescheduled, or the new date if status is 'rescheduled'
  comments: text("comments"),
  eReceiptId: text("e_receipt_id"),
  eReceiptUrl: text("e_receipt_url"),
  eReceiptGeneratedAt: timestamp("e_receipt_generated_at"),
  paymentReference: text("payment_reference"),
  disputeReason: text("dispute_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  serviceLocation: text("service_location").$type<"customer" | "provider">(), // Added service location type
  providerAddress: text("provider_address"), // Added provider address (nullable)
});

// Booking history table to track status changes
export const bookingHistory = pgTable("booking_history", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id),
  status: text("status").notNull().default("pending"),
  changedAt: timestamp("changed_at").defaultNow(),
  changedBy: integer("changed_by").references(() => users.id),
  comments: text("comments"),
});

// Sessions table for express-session storage
export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").$type<SessionData>().notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});
// Update the reviews table to link with e-receipt
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => users.id),
    serviceId: integer("service_id").references(() => services.id),
    bookingId: integer("booking_id").references(() => bookings.id),
    rating: integer("rating").notNull(),
    review: text("review"),
    createdAt: timestamp("created_at").defaultNow(),
    providerReply: text("provider_reply"),
    isVerifiedService: boolean("is_verified_service").default(false),
  },
  (table) => {
    return {
      customerBookingUnique: unique("customer_booking_unique").on(
        table.customerId,
        table.bookingId,
      ),
    };
  },
);

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  preferredDate: timestamp("preferred_date").notNull(),
  status: text("status").$type<"active" | "fulfilled" | "expired">().notNull(),
  notificationSent: boolean("notification_sent").default(false),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price").notNull(),
  mrp: decimal("mrp").notNull(),
  stock: integer("stock").notNull(),
  category: text("category").notNull(),
  images: text("images").array(),
  isAvailable: boolean("is_available").default(true),
  isDeleted: boolean("is_deleted").default(false), // Add soft deletion flag
  sku: text("sku"),
  barcode: text("barcode"),
  weight: decimal("weight"),
  dimensions: jsonb("dimensions").$type<{
    length: number;
    width: number;
    height: number;
  }>(),
  specifications: jsonb("specifications").$type<Record<string, string>>(),
  tags: text("tags").array(),
  minOrderQuantity: integer("min_order_quantity").default(1),
  maxOrderQuantity: integer("max_order_quantity"),
  lowStockThreshold: integer("low_stock_threshold"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cart = pgTable("cart", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
});

export const wishlist = pgTable("wishlist", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  shopId: integer("shop_id").references(() => users.id),
  status: text("status")
    .$type<
      | "pending"
      | "cancelled"
      | "confirmed"
      | "processing"
      | "packed"
      | "shipped"
      | "delivered"
      | "returned"
    >()
    .notNull(),
  paymentStatus: text("payment_status", {
    enum: ["pending", "verifying", "paid", "failed"],
  })
    .$type<"pending" | "verifying" | "paid" | "failed">()
    .default("pending"),
  deliveryMethod: text("delivery_method", { enum: ["delivery", "pickup"] }),
  total: decimal("total").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  billingAddress: text("billing_address"),
  paymentMethod: text("payment_method"),
  trackingInfo: text("tracking_info"),
  notes: text("notes"),
  eReceiptId: text("e_receipt_id"),
  eReceiptUrl: text("e_receipt_url"),
  eReceiptGeneratedAt: timestamp("e_receipt_generated_at"),
  paymentReference: text("payment_reference"),
  orderDate: timestamp("order_date").defaultNow(),
  returnRequested: boolean("return_requested").default(false), // Add this line
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price").notNull(),
  total: decimal("total").notNull(),
  discount: decimal("discount"),
  status: text("status")
    .$type<"ordered" | "cancelled" | "returned">()
    .default("ordered"),
});

export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  orderItemId: integer("order_item_id").references(() => orderItems.id),
  customerId: integer("customer_id").references(() => users.id),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status")
    .$type<
      | "requested"
      | "approved"
      | "rejected"
      | "received"
      | "refunded"
      | "completed"
    >()
    .notNull(),
  refundAmount: decimal("refund_amount"),
  refundStatus: text("refund_status").$type<
    "pending" | "processed" | "failed"
  >(),
  refundId: text("refund_id"),
  images: text("images").array(),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
});

export const productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  customerId: integer("customer_id").references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  rating: integer("rating").notNull(),
  review: text("review"),
  images: text("images").array(),
  createdAt: timestamp("created_at").defaultNow(),
  shopReply: text("shop_reply"),
  repliedAt: timestamp("replied_at"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
});

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").$type<"percentage" | "fixed_amount">().notNull(),
  value: decimal("value").notNull(),
  code: text("code").unique(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  minPurchase: decimal("min_purchase"),
  maxDiscount: decimal("max_discount"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0),
  isActive: boolean("is_active").default(true),
  applicableProducts: integer("applicable_products").array(),
  excludedProducts: integer("excluded_products").array(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  type: text("type")
    .$type<
      | "booking"
      | "order"
      | "promotion"
      | "system"
      | "return"
      | "service_request"
      | "service"
      | "booking_request"
      | "shop"
      | "booking_rescheduled_request" // Customer requests reschedule, notify provider
      | "booking_confirmed" // Provider confirms booking/reschedule, notify customer
      | "booking_rejected" // Provider rejects booking/reschedule, notify customer
      | "booking_cancelled_by_customer" // Customer cancels, notify provider
    >()
    .notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  relatedBookingId: integer("related_booking_id").references(() => bookings.id), // Optional: to link notification to a specific booking
});

export const blockedTimeSlots = pgTable("blocked_time_slots", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id),
  date: timestamp("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  reason: text("reason"),
  isRecurring: boolean("is_recurring").default(false),
  recurringEndDate: timestamp("recurring_end_date"),
});

export const orderStatusUpdates = pgTable("order_status_updates", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  status: text("status").notNull(),
  trackingInfo: text("tracking_info"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Zod schema for ShopProfile
export const shopProfileSchema = z.object({
  shopName: z.string().min(1, "Shop name is required"),
  description: z.string().min(1, "Shop description is required"),
  businessType: z.string().min(1, "Business type is required"),
  gstin: z.string().optional().nullable(),
  workingHours: z.object({
    from: z.string().min(1, "'From' time is required"),
    to: z.string().min(1, "'To' time is required"),
    days: z
      .array(z.string().min(1))
      .min(1, "At least one working day is required"),
  }),
  shippingPolicy: z.string().optional().nullable(),
  returnPolicy: z.string().optional().nullable(),
});

// Generate insert schemas and types

// Schema for customer profile updates (excluding sensitive/role-specific fields)
export const customerProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address"),
  addressStreet: z.string().optional().nullable(),
  addressCity: z.string().optional().nullable(),
  addressState: z.string().optional().nullable(),
  addressPostalCode: z.string().optional().nullable(),
  addressCountry: z.string().optional().nullable(),
  language: z.string().optional().default("en"),
  profilePicture: z.string().optional().nullable(),
});

export const insertUserSchema = createInsertSchema(users, {
  shopProfile: shopProfileSchema.optional().nullable(),
  emailVerified: z.boolean().optional().default(false),
  role: z.enum(["customer", "provider", "shop", "admin"]),
  username: z.string().optional(),
  password: z.string().optional(),
}).extend({
  paymentMethods: z
    .array(
      z.object({
        type: z.enum(["card", "upi"]),
        details: z.record(z.string()),
      }),
    )
    .optional(),
  averageRating: z.string().optional().default("0"),
  totalReviews: z.number().int().optional().default(0),
});

export const insertCustomerSchema = insertUserSchema
  .pick({
    username: true,
    password: true,
    role: true, // Default to 'customer' or ensure it's set
    name: true,
    phone: true,
    email: true,
    addressStreet: true,
    addressCity: true,
    addressState: true,
    addressPostalCode: true,
    addressCountry: true,
    language: true,
    profilePicture: true,
    emailVerified: true, // Can be part of initial creation
  })
  .extend({
    role: z.literal("customer"), // Ensure role is customer for this schema
  });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type CustomerProfile = z.infer<typeof customerProfileSchema>;

// Update service schema validation
export const insertServiceSchema = createInsertSchema(services, {
  // Add specific validation if needed, e.g., for price
  price: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)), {
      message: "Price must be a valid number",
    }),
  // Ensure serviceLocationType is included and validated
  serviceLocationType: z
    .enum(["customer_location", "provider_location"])
    .optional()
    .default("provider_location"),
}).extend({
  workingHours: z.object({
    monday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    tuesday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    wednesday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    thursday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    friday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    saturday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
    sunday: z.object({
      isAvailable: z.boolean(),
      start: z.string(),
      end: z.string(),
    }),
  }),
  breakTime: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
    }),
  ),
  maxDailyBookings: z.number().min(1, "Must accept at least 1 booking per day"),
});

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export const insertBookingSchema = createInsertSchema(bookings, {
  // Add specific validation if needed
  serviceLocation: z.enum(["customer", "provider"]).optional(),
  providerAddress: z.string().optional().nullable(), // Allow null
});
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export const insertProductSchema = createInsertSchema(products);
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const insertOrderSchema = createInsertSchema(orders);
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export const insertOrderItemSchema = createInsertSchema(orderItems);
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export const insertReviewSchema = createInsertSchema(reviews);
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export const insertNotificationSchema = createInsertSchema(notifications);
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertReturnRequestSchema = createInsertSchema(returns);
export type ReturnRequest = typeof returns.$inferSelect;
export type InsertReturnRequest = z.infer<typeof insertReturnRequestSchema>;

export const insertPromotionSchema = createInsertSchema(promotions);
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

export const insertProductReviewSchema = createInsertSchema(productReviews);
export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;

export const insertBlockedTimeSlotSchema = createInsertSchema(blockedTimeSlots);
export type InsertBlockedTimeSlot = z.infer<typeof insertBlockedTimeSlotSchema>;
export type BlockedTimeSlotSelect = typeof blockedTimeSlots.$inferSelect;

export const insertOrderStatusUpdateSchema =
  createInsertSchema(orderStatusUpdates);
export type OrderStatusUpdateRecord = typeof orderStatusUpdates.$inferSelect;
export type InsertOrderStatusUpdate = z.infer<
  typeof insertOrderStatusUpdateSchema
>;
export const insertPasswordResetTokenSchema =
  createInsertSchema(passwordResetTokens);
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<
  typeof insertPasswordResetTokenSchema
>;
export const insertEmailVerificationTokenSchema =
  createInsertSchema(emailVerificationTokens);
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = z.infer<
  typeof insertEmailVerificationTokenSchema
>;

export const Booking = z.object({
  id: z.number(),
  customerId: z.number(),
  providerId: z.number(),
  serviceId: z.number(),
  bookingDate: z.string(), // ISO string format
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
    "rescheduled",
    "completed",
    "cancelled",
    "awaiting_payment",
    "disputed",
  ]), // Removed 'expired' as it's handled internally
  comments: z.string().optional(),
  rejectionReason: z.string().optional(),
  rescheduleDate: z.string().optional(), // ISO string format
  createdAt: z.string(), // ISO string format
  updatedAt: z.string(), // ISO string format
  serviceLocation: z.enum(["customer", "provider"]).optional(), // Updated service location
  providerAddress: z.string().optional().nullable(), // Updated provider address (nullable)
  disputeReason: z.string().optional(),
});
