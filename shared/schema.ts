import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type UserRole = "customer" | "provider" | "shop" | "admin";

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
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price").notNull(),
  duration: integer("duration").notNull(), // in minutes
  isAvailable: boolean("is_available").default(true),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  bookingDate: timestamp("booking_date").notNull(),
  status: text("status").$type<"pending" | "confirmed" | "completed" | "cancelled">().notNull(),
  paymentStatus: text("payment_status").$type<"pending" | "paid" | "refunded">().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price").notNull(),
  stock: integer("stock").notNull(),
  category: text("category").notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  shopId: integer("shop_id").references(() => users.id),
  status: text("status").$type<"pending" | "confirmed" | "shipped" | "delivered" | "cancelled">().notNull(),
  paymentStatus: text("payment_status").$type<"pending" | "paid" | "refunded">().notNull(),
  total: decimal("total").notNull(),
  orderDate: timestamp("order_date").notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price").notNull(),
});

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
