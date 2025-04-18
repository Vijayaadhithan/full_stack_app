import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
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
  gstin?: string;
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
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
  monday: { isAvailable: boolean; start: string; end: string; };
  tuesday: { isAvailable: boolean; start: string; end: string; };
  wednesday: { isAvailable: boolean; start: string; end: string; };
  thursday: { isAvailable: boolean; start: string; end: string; };
  friday: { isAvailable: boolean; start: string; end: string; };
  saturday: { isAvailable: boolean; start: string; end: string; };
  sunday: { isAvailable: boolean; start: string; end: string; };
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
  address: text("address"),
  language: text("language").default("en"),
  profilePicture: text("profile_picture"),
  paymentMethods: jsonb("payment_methods").$type<PaymentMethod[]>(),
  shopProfile: jsonb("shop_profile").$type<ShopProfile>(),
  // Provider profile fields
  bio: text("bio"),
  qualifications: text("qualifications"),
  experience: text("experience"),
  workingHours: text("working_hours"),
  languages: text("languages"),
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
  location: jsonb("location").$type<{ lat: number; lng: number }>(),
  bufferTime: integer("buffer_time").default(15), // in minutes
  workingHours: jsonb("working_hours").$type<WorkingHours>(),
  breakTime: jsonb("break_time").$type<BreakTime[]>(),
  maxDailyBookings: integer("max_daily_bookings").default(10),
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
  status: text("status").$type<"pending" | "accepted" | "rejected" | "rescheduled" | "completed" | "cancelled" | "expired">().notNull(),
  paymentStatus: text("payment_status").$type<"pending" | "paid" | "refunded">().notNull(),
  rejectionReason: text("rejection_reason"),
  rescheduleDate: timestamp("reschedule_date"),
  comments: text("comments"),
  eReceiptId: text("e_receipt_id"),
  eReceiptUrl: text("e_receipt_url"),
  eReceiptGeneratedAt: timestamp("e_receipt_generated_at"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
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
  sess: jsonb("sess").$type<any>().notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});


// Update the reviews table to link with e-receipt
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  bookingId: integer("booking_id").references(() => bookings.id),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
  providerReply: text("provider_reply"),
  isVerifiedService: boolean("is_verified_service").default(false),
});

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
  dimensions: jsonb("dimensions").$type<{ length: number; width: number; height: number }>(),
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
  status: text("status").$type<"pending" | "cancelled" | "confirmed" | "processing" | "packed" | "shipped" | "delivered" | "returned">().notNull(),
  paymentStatus: text("payment_status").$type<"pending" | "paid" | "refunded">().notNull(),
  total: decimal("total").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  billingAddress: text("billing_address"),
  paymentMethod: text("payment_method"),
  trackingInfo: text("tracking_info"),
  notes: text("notes"),
  eReceiptId: text("e_receipt_id"),
  eReceiptUrl: text("e_receipt_url"),
  eReceiptGeneratedAt: timestamp("e_receipt_generated_at"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
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
  status: text("status").$type<"ordered" | "cancelled" | "returned">().default("ordered"),
});

export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  orderItemId: integer("order_item_id").references(() => orderItems.id),
  customerId: integer("customer_id").references(() => users.id),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").$type<"requested" | "approved" | "rejected" | "received" | "refunded" | "completed">().notNull(),
  refundAmount: decimal("refund_amount"),
  refundStatus: text("refund_status").$type<"pending" | "processed" | "failed">(),
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
  type: text("type").$type<"booking" | "order" | "promotion" | "system" | "return" | "service_request" | "service" | "booking_request" | "shop">().notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
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


// Generate insert schemas and types
export const insertUserSchema = createInsertSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Update service schema validation
export const insertServiceSchema = createInsertSchema(services).extend({
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
  breakTime: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })),
  maxDailyBookings: z.number().min(1, "Must accept at least 1 booking per day"),
});

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export const insertBookingSchema = createInsertSchema(bookings);
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
