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
  uuid,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import type { SessionData } from "express-session";
import { z } from "zod";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// UserRole is now optional - users can have multiple profiles via shops/providers tables
export type UserRole = "customer" | "provider" | "shop" | "admin" | "worker";
export type AppMode = "CUSTOMER" | "SHOP" | "PROVIDER";
export const PaymentMethodType = z.enum(["upi", "cash", "pay_later"]);
export type PaymentMethodType = z.infer<typeof PaymentMethodType>;

export const PaymentMethodSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("upi"),
    details: z.object({
      upiId: z.string(),
    }),
  }),
  z.object({
    type: z.literal("cash"),
    details: z.object({}).optional(),
  }),
  z.object({
    type: z.literal("pay_later"),
    details: z
      .object({
        approved: z.boolean().optional(),
        note: z.string().optional(),
      })
      .optional(),
  }),
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

// Enhanced shop profile fields
export type ShopProfile = {
  shopName: string;
  description: string;
  businessType: string;
  gstin?: string | null;
  shopAddressStreet?: string;
  shopAddressArea?: string;
  shopAddressCity?: string;
  shopAddressState?: string;
  shopAddressPincode?: string;
  shopLocationLat?: number;
  shopLocationLng?: number;
  workingHours: {
    from: string;
    to: string;
    days: string[];
  };
  shippingPolicy?: string;
  returnPolicy?: string;
  catalogModeEnabled: boolean;
  openOrderMode: boolean;
  allowPayLater: boolean;
  payLaterWhitelist?: number[];
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

// Time slot label for broad booking slots
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

export const adminRoles = pgTable("admin_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const adminPermissions = pgTable("admin_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull().unique(),
  description: text("description"),
});

export const adminRolePermissions = pgTable(
  "admin_role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => adminRoles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => adminPermissions.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  }),
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  roleId: uuid("role_id").references(() => adminRoles.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type AdminRole = typeof adminRoles.$inferSelect;
export type InsertAdminRole = typeof adminRoles.$inferInsert;
export type AdminPermission = typeof adminPermissions.$inferSelect;
export type InsertAdminPermission = typeof adminPermissions.$inferInsert;

// Worker responsibilities for shop workers
export const WorkerResponsibilities = [
  // Product management
  "products:read",
  "products:write",
  "inventory:adjust",
  // Orders and returns
  "orders:read",
  "orders:update",
  "returns:manage",
  // Promotions and pricing
  "promotions:manage",
  // Customer interaction
  "customers:message",
  // Bookings/services (in case shop also offers services)
  "bookings:manage",
  // Insights
  "analytics:view",
] as const;
export type WorkerResponsibility = (typeof WorkerResponsibilities)[number];
export const WorkerResponsibilityZ = z.enum(WorkerResponsibilities);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    // Auth fields - username/password optional for OTP-only users
    username: text("username").unique(), // Now optional
    password: text("password"), // Now optional for OTP-based auth
    pin: text("pin"), // Hashed 4-digit PIN for rural-first auth
    workerNumber: text("worker_number").unique(), // 10-digit worker ID for shop workers
    // Role is optional - multi-profile via shops/providers tables
    role: text("role").$type<UserRole>().default("customer"),
    // Core identity
    name: text("name").notNull(),
    phone: text("phone").unique().notNull(), // Now UNIQUE - primary identifier
    email: text("email"), // Now optional
    isPhoneVerified: boolean("is_phone_verified").default(false), // OTP verification status
    // Address fields
    addressStreet: text("address_street"),
    addressLandmark: text("address_landmark"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    addressPostalCode: text("address_postal_code"),
    addressCountry: text("address_country"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    language: text("language").default("ta"), // Default to Tamil for rural TN
    profilePicture: text("profile_picture"),
    paymentMethods: jsonb("payment_methods").$type<PaymentMethod[]>(),
    shopProfile: jsonb("shop_profile").$type<ShopProfile>(), // Legacy - kept for migration
    googleId: text("google_id").unique(),
    emailVerified: boolean("email_verified").default(false),
    isSuspended: boolean("is_suspended").default(false),
    // Provider profile fields (legacy - moving to providers table)
    bio: text("bio"),
    qualifications: text("qualifications"),
    experience: text("experience"),
    workingHours: text("working_hours"),
    languages: text("languages"),
    // Enhanced profile fields
    verificationStatus: text("verification_status")
      .$type<"unverified" | "pending" | "verified">()
      .default("unverified"),
    verificationDocuments: jsonb("verification_documents").$type<string[]>(),
    profileCompleteness: integer("profile_completeness").default(0),
    specializations: text("specializations").array(),
    certifications: text("certifications").array(),
    shopBannerImageUrl: text("shop_banner_image_url"),
    shopLogoImageUrl: text("shop_logo_image_url"),
    yearsInBusiness: integer("years_in_business"),
    socialMediaLinks: jsonb("social_media_links").$type<Record<string, string>>(),
    upiId: text("upi_id"),
    upiQrCodeUrl: text("upi_qr_code_url"),
    deliveryAvailable: boolean("delivery_available").default(false),
    pickupAvailable: boolean("pickup_available").default(true),
    returnsEnabled: boolean("returns_enabled").default(true),
    averageRating: decimal("average_rating").default("0"),
    totalReviews: integer("total_reviews").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    usersRoleIdx: index("users_role_idx").on(table.role),
    usersEmailIdx: index("users_email_idx").on(table.email),
    usersPhoneIdx: index("users_phone_idx").on(table.phone),
    usersWorkerNumberIdx: index("users_worker_number_idx").on(table.workerNumber),
  }),
);

// Shop profile table - separate from users for multi-profile support
export const shops = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(), // One shop per user
    shopName: text("shop_name").notNull(),
    description: text("description"),
    businessType: text("business_type"),
    gstin: text("gstin"),
    isOpen: boolean("is_open").default(true),
    catalogModeEnabled: boolean("catalog_mode_enabled").default(false),
    openOrderMode: boolean("open_order_mode").default(false),
    allowPayLater: boolean("allow_pay_later").default(false),
    payLaterWhitelist: jsonb("pay_later_whitelist").$type<number[]>(),
    workingHours: jsonb("working_hours").$type<{
      from: string;
      to: string;
      days: string[];
    }>(),
    shippingPolicy: text("shipping_policy"),
    returnPolicy: text("return_policy"),
    bannerImageUrl: text("banner_image_url"),
    logoImageUrl: text("logo_image_url"),
    shopAddressStreet: text("shop_address_street"),
    shopAddressArea: text("shop_address_area"),
    shopAddressCity: text("shop_address_city"),
    shopAddressState: text("shop_address_state"),
    shopAddressPincode: text("shop_address_pincode"),
    shopLocationLat: decimal("shop_location_lat", { precision: 10, scale: 7 }),
    shopLocationLng: decimal("shop_location_lng", { precision: 10, scale: 7 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    shopsOwnerIdx: index("shops_owner_id_idx").on(table.ownerId),
  }),
);

export type Shop = typeof shops.$inferSelect;
export type InsertShop = typeof shops.$inferInsert;

// Provider profile table - separate from users for multi-profile support
export const providers = pgTable(
  "providers",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(), // One provider profile per user
    skills: text("skills").array(),
    bio: text("bio"),
    experience: text("experience"),
    qualifications: text("qualifications"),
    isOnDuty: boolean("is_on_duty").default(false),
    languages: text("languages").array(),
    specializations: text("specializations").array(),
    certifications: text("certifications").array(),
    workingHours: jsonb("working_hours").$type<WorkingHours>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    providersUserIdx: index("providers_user_id_idx").on(table.userId),
  }),
);

export type Provider = typeof providers.$inferSelect;
export type InsertProvider = typeof providers.$inferInsert;

// Link table for shop workers and their responsibilities
export const shopWorkers = pgTable(
  "shop_workers",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id").references(() => users.id).notNull(),
    workerUserId: integer("worker_user_id").references(() => users.id).notNull(),
    responsibilities: jsonb("responsibilities").$type<WorkerResponsibility[]>().notNull(),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => {
    return {
      uqWorkerUser: unique("uq_shop_worker_user").on(table.workerUserId),
      uqShopWorker: unique("uq_shop_worker_pair").on(table.shopId, table.workerUserId),
    };
  },
);
export type ShopWorker = typeof shopWorkers.$inferSelect;
export type InsertShopWorker = typeof shopWorkers.$inferInsert;

export const timeSlotLabels = ["morning", "afternoon", "evening"] as const;
export const timeSlotLabelSchema = z.enum(timeSlotLabels);
export type TimeSlotLabel = (typeof timeSlotLabels)[number];

// Update services table with new availability fields and soft deletion
export const services = pgTable(
  "services",
  {
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
    isAvailableNow: boolean("is_available_now").default(true).notNull(), // Uber-style availability toggle
    availabilityNote: text("availability_note"), // Optional note for unavailability
    allowedSlots: jsonb("allowed_slots").$type<TimeSlotLabel[]>().default(["morning", "afternoon", "evening"]), // Configurable slots
  },
  (table) => ({
    servicesProviderIdx: index("services_provider_id_idx").on(table.providerId),
    servicesCategoryIdx: index("services_category_idx").on(table.category),
    servicesAvailableNowIdx: index("idx_services_is_available_now").on(table.isAvailableNow),
  }),
);

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
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => users.id),
    serviceId: integer("service_id").references(() => services.id),
    bookingDate: timestamp("booking_date").notNull(),
    timeSlotLabel: text("time_slot_label").$type<TimeSlotLabel>(), // Broad time slot label
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
        | "rescheduled_by_provider"
        | "awaiting_payment"
        | "en_route"
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
    updatedAt: timestamp("updated_at").defaultNow(),
    expiresAt: timestamp("expires_at"),
    serviceLocation: text("service_location").$type<"customer" | "provider">(), // Added service location type
    providerAddress: text("provider_address"), // Added provider address (nullable)
  },
  (table) => ({
    bookingsCustomerIdx: index("bookings_customer_id_idx").on(table.customerId),
    bookingsServiceIdx: index("bookings_service_id_idx").on(table.serviceId),
    bookingsStatusIdx: index("bookings_status_idx").on(table.status),
    bookingsDateIdx: index("bookings_booking_date_idx").on(table.bookingDate),
    bookingsTimeSlotIdx: index("idx_bookings_time_slot_label").on(table.timeSlotLabel),
  }),
);

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

// Note: passwordResetTokens, magicLinkTokens, emailVerificationTokens tables removed
// Using phone OTP for auth instead (see phoneOtpTokens below)

// Phone OTP tokens for forgot password and phone verification
export const phoneOtpTokens = pgTable("phone_otp_tokens", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  otpHash: text("otp_hash").notNull(), // Hashed OTP for security
  purpose: text("purpose").$type<"forgot_password" | "phone_verification">().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailNotificationPreferenceOverrides = pgTable(
  "email_notification_preferences",
  {
    id: serial("id").primaryKey(),
    notificationType: text("notification_type").notNull(),
    recipientType: text("recipient_type")
      .$type<"customer" | "serviceProvider" | "shop">()
      .notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedByAdminId: uuid("updated_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
  },
  (table) => ({
    notificationRecipientUnique: unique("email_notification_pref_unique").on(
      table.notificationType,
      table.recipientType,
    ),
  }),
);
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

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id").references(() => users.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    price: decimal("price").notNull(),
    mrp: decimal("mrp").notNull(),
    stock: integer("stock"),
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
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))`,
    ),
  },
  (table) => ({
    productsShopIdx: index("products_shop_id_idx").on(table.shopId),
    productsCategoryIdx: index("products_category_idx").on(table.category),
    productsSearchVectorIdx: index("products_search_vector_idx").using(
      "gin",
      table.searchVector,
    ),
  }),
);

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

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => users.id),
    shopId: integer("shop_id").references(() => users.id),
    orderType: text("order_type")
      .$type<"product_order" | "text_order">()
      .notNull()
      .default("product_order"),
    orderText: text("order_text"),
    status: text("status")
      .$type<
        | "pending"
        | "awaiting_customer_agreement"
        | "cancelled"
        | "confirmed"
        | "processing"
        | "packed"
        | "dispatched"
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
    paymentMethod: text("payment_method").$type<PaymentMethodType>(),
    trackingInfo: text("tracking_info"),
    notes: text("notes"),
    eReceiptId: text("e_receipt_id"),
    eReceiptUrl: text("e_receipt_url"),
    eReceiptGeneratedAt: timestamp("e_receipt_generated_at"),
    paymentReference: text("payment_reference"),
    orderDate: timestamp("order_date").defaultNow(),
    returnRequested: boolean("return_requested").default(false), // Add this line
  },
  (table) => ({
    ordersCustomerIdx: index("orders_customer_id_idx").on(table.customerId),
    ordersShopIdx: index("orders_shop_id_idx").on(table.shopId),
    ordersStatusIdx: index("orders_status_idx").on(table.status),
    ordersOrderDateIdx: index("orders_order_date_idx").on(table.orderDate),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
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
  },
  (table) => ({
    orderItemsOrderIdx: index("order_items_order_id_idx").on(table.orderId),
    orderItemsProductIdx: index("order_items_product_id_idx").on(table.productId),
  }),
);

export const returns = pgTable(
  "returns",
  {
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
  },
  (table) => ({
    returnsOrderIdx: index("returns_order_id_idx").on(table.orderId),
    returnsOrderItemIdx: index("returns_order_item_id_idx").on(table.orderItemId),
    returnsCustomerIdx: index("returns_customer_id_idx").on(table.customerId),
  }),
);

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
}, (table) => ({
  userUnreadIdx: index("notifications_user_unread_idx").on(table.userId, table.isRead),
}));

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
  catalogModeEnabled: z.boolean().optional().default(false),
  openOrderMode: z.boolean().optional().default(false),
  allowPayLater: z.boolean().optional().default(false),
  payLaterWhitelist: z.array(z.number()).optional().default([]),
});

// Generate insert schemas and types

// Schema for customer profile updates (excluding sensitive/role-specific fields)
export const customerProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Phone number must be 10 digits").max(10, "Phone number must be 10 digits"),
  email: z.string().email("Invalid email address").optional().nullable(), // Now optional
  addressStreet: z.string().optional().nullable(),
  addressLandmark: z.string().optional().nullable(),
  addressCity: z.string().optional().nullable(),
  addressState: z.string().optional().nullable(),
  addressPostalCode: z.string().optional().nullable(),
  addressCountry: z.string().optional().nullable(),
  language: z.string().optional().default("ta"),
  profilePicture: z.string().optional().nullable(),
});

// Rural-First Auth Schemas
export const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits");

// Schema for rural registration (phone + PIN based)
export const ruralRegisterSchema = z.object({
  phone: phoneSchema,
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  pin: pinSchema,
  initialRole: z.enum(["customer", "shop", "provider"]).optional().default("customer"),
  language: z.string().optional().default("ta"),
});

export type RuralRegisterData = z.infer<typeof ruralRegisterSchema>;

// Schema for PIN login
export const pinLoginSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
});

export type PinLoginData = z.infer<typeof pinLoginSchema>;

// Schema for worker login (10-digit number + 4-digit PIN)
export const workerLoginSchema = z.object({
  workerNumber: z.string().regex(/^\d{10}$/, "Worker number must be exactly 10 digits"),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export type WorkerLoginData = z.infer<typeof workerLoginSchema>;

// Schema for check user request
export const checkUserSchema = z.object({
  phone: phoneSchema,
});

export type CheckUserData = z.infer<typeof checkUserSchema>;

// Schema for PIN reset
export const resetPinSchema = z.object({
  phone: phoneSchema,
  newPin: pinSchema,
});

export type ResetPinData = z.infer<typeof resetPinSchema>;

export const insertUserSchema = createInsertSchema(users, {
  shopProfile: shopProfileSchema.optional().nullable(),
  emailVerified: z.boolean().optional().default(false),
  isPhoneVerified: z.boolean().optional().default(false),
  role: z.enum(["customer", "provider", "shop", "admin", "worker"]).optional(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  pin: z.string().optional().nullable(),
}).extend({
  paymentMethods: PaymentMethodSchema.array().optional(),
  averageRating: z.string().optional().default("0"),
  totalReviews: z.number().int().optional().default(0),
});

export const insertCustomerSchema = insertUserSchema
  .pick({
    username: true,
    password: true,
    role: true,
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
    emailVerified: true,
    isPhoneVerified: true,
    pin: true,
  })
  .extend({
    role: z.literal("customer").optional(),
  });

// Insert schemas for new profile tables
export const insertShopSchema = createInsertSchema(shops);
export const insertProviderSchema = createInsertSchema(providers);

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
  workingHours: z
    .object({
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
    })
    .optional()
    .nullable(),
  breakTime: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
      }),
    )
    .optional()
    .default([]),
  maxDailyBookings: z
    .coerce.number()
    .min(1, "Must accept at least 1 booking per day")
    .optional(),
  isAvailableNow: z.boolean().optional().default(true),
  availabilityNote: z.string().optional().nullable(),
  allowedSlots: z
    .array(timeSlotLabelSchema)
    .optional()
    .default(timeSlotLabels as unknown as [TimeSlotLabel, ...TimeSlotLabel[]]),
}).strict();

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export const insertBookingSchema = createInsertSchema(bookings, {
  // Add specific validation if needed
  serviceLocation: z.enum(["customer", "provider"]).optional(),
  providerAddress: z.string().optional().nullable(), // Allow null
  timeSlotLabel: timeSlotLabelSchema.optional(),
}).strict();
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export const insertProductSchema = createInsertSchema(products, {
  stock: z.coerce
    .number()
    .int()
    .min(0, "Stock must be a positive number")
    .nullable()
    .optional(),
}).strict();
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const insertOrderSchema = createInsertSchema(orders, {
  paymentMethod: PaymentMethodType.nullable().optional(),
  orderType: z.enum(["product_order", "text_order"]).optional(),
  orderText: z.string().optional().nullable(),
}).strict();
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export const insertOrderItemSchema = createInsertSchema(orderItems).strict();
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export const insertReviewSchema = createInsertSchema(reviews).strict();
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export const insertNotificationSchema = createInsertSchema(notifications).strict();
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertReturnRequestSchema = createInsertSchema(returns).strict();
export type ReturnRequest = typeof returns.$inferSelect;
export type InsertReturnRequest = z.infer<typeof insertReturnRequestSchema>;

export const insertPromotionSchema = createInsertSchema(promotions).strict();
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

export const insertProductReviewSchema = createInsertSchema(productReviews).strict();
export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;

export const insertBlockedTimeSlotSchema = createInsertSchema(blockedTimeSlots).strict();
export type InsertBlockedTimeSlot = z.infer<typeof insertBlockedTimeSlotSchema>;
export type BlockedTimeSlotSelect = typeof blockedTimeSlots.$inferSelect;

export const insertOrderStatusUpdateSchema =
  createInsertSchema(orderStatusUpdates).strict();
export type OrderStatusUpdateRecord = typeof orderStatusUpdates.$inferSelect;
export type InsertOrderStatusUpdate = z.infer<
  typeof insertOrderStatusUpdateSchema
>;

// Note: Token type definitions removed (passwordResetTokens, magicLinkTokens, emailVerificationTokens)
// Using phone OTP for auth instead (see phoneOtpTokens below)

// Phone OTP token types
export const insertPhoneOtpTokenSchema =
  createInsertSchema(phoneOtpTokens).strict();
export type PhoneOtpToken = typeof phoneOtpTokens.$inferSelect;
export type InsertPhoneOtpToken = z.infer<typeof insertPhoneOtpTokenSchema>;

// Forgot password OTP flow schemas
export const forgotPasswordOtpSchema = z.object({
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(15),
});

export const verifyResetOtpSchema = z.object({
  phone: z.string().trim().min(10).max(15),
  otp: z.string().trim().length(6, "OTP must be exactly 6 digits"),
});

export const resetPasswordSchema = z.object({
  phone: z.string().trim().min(10).max(15),
  otp: z.string().trim().length(6, "OTP must be exactly 6 digits"),
  newPin: z.string().trim().length(4, "PIN must be exactly 4 digits"),
});

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
  rejectionReason: z.string().nullable().optional(),
  rescheduleDate: z.string().optional(), // ISO string format
  createdAt: z.string(), // ISO string format
  updatedAt: z.string(), // ISO string format
  serviceLocation: z.enum(["customer", "provider"]).optional(), // Updated service location
  providerAddress: z.string().optional().nullable(), // Updated provider address (nullable)
  disputeReason: z.string().optional(),
  timeSlotLabel: timeSlotLabelSchema.nullable().optional(),
});

import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ one, many }) => ({
  shopProfile: one(shops, {
    fields: [users.id],
    references: [shops.ownerId],
  }),
  providerProfile: one(providers, {
    fields: [users.id],
    references: [providers.userId],
  }),
  bookingsAsCustomer: many(bookings, { relationName: "customerBookings" }),
  servicesAsProvider: many(services),
}));

export const shopsRelations = relations(shops, ({ one, many }) => ({
  owner: one(users, {
    fields: [shops.ownerId],
    references: [users.id],
  }),
  products: many(products),
}));

export const providersRelations = relations(providers, ({ one }) => ({
  user: one(users, {
    fields: [providers.userId],
    references: [users.id],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  provider: one(users, {
    fields: [services.providerId],
    references: [users.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  customer: one(users, {
    fields: [bookings.customerId],
    references: [users.id],
    relationName: "customerBookings",
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
    relationName: "customerOrders",
  }),
  shop: one(users, {
    fields: [orders.shopId],
    references: [users.id],
    relationName: "shopOrders",
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  shop: one(users, {
    fields: [products.shopId],
    references: [users.id],
  }),
}));

