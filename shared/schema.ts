import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type UserRole = "customer" | "provider" | "shop" | "admin";
export type PaymentMethod = {
  type: "card" | "upi";
  details: Record<string, string>;
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
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price").notNull(),
  duration: integer("duration").notNull(), // in minutes
  isAvailable: boolean("is_available").default(true),
  category: text("category").notNull(),
  images: text("images").array(),
  location: jsonb("location").$type<{ lat: number; lng: number }>(),
  bufferTime: integer("buffer_time").default(0), // in minutes
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

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  bookingDate: timestamp("booking_date").notNull(),
  status: text("status").$type<"pending" | "confirmed" | "completed" | "cancelled">().notNull(),
  paymentStatus: text("payment_status").$type<"pending" | "paid" | "refunded">().notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"),
  comments: text("comments"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
});

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  preferredDate: timestamp("preferred_date").notNull(),
  status: text("status").$type<"active" | "fulfilled" | "expired">().notNull(),
  notificationSent: boolean("notification_sent").default(false),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
  providerReply: text("provider_reply"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price").notNull(),
  stock: integer("stock").notNull(),
  category: text("category").notNull(),
  images: text("images").array(),
  discount: decimal("discount"),
  isAvailable: boolean("is_available").default(true),
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
  status: text("status").$type<"pending" | "confirmed" | "shipped" | "delivered" | "cancelled">().notNull(),
  paymentStatus: text("payment_status").$type<"pending" | "paid" | "refunded">().notNull(),
  total: decimal("total").notNull(),
  orderDate: timestamp("order_date").notNull(),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price").notNull(),
});

export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  customerId: integer("customer_id").references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").$type<"pending" | "approved" | "rejected" | "refunded" | "completed">().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  type: text("type").$type<"booking" | "order" | "promotion" | "system">().notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Generate insert schemas and types
export const insertUserSchema = createInsertSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertServiceSchema = createInsertSchema(services);
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