import session from "express-session";
import pgSession from "connect-pg-simple";
import { db } from "./db";
import type { SQL } from "drizzle-orm";
import logger from "./logger";
import { getCache, setCache } from "./cache";
import { createHash } from "crypto";
import {
  notifyBookingChange,
  notifyCartChange,
  notifyNotificationChange,
  notifyOrderChange,
  notifyWishlistChange,
} from "./realtime";
import {
  User,
  InsertUser,
  Service,
  InsertService,
  Booking,
  InsertBooking,
  Product,
  InsertProduct,
  Order,
  InsertOrder,
  OrderItem,
  InsertOrderItem,
  Review,
  InsertReview,
  Notification,
  InsertNotification,
  ReturnRequest,
  InsertReturnRequest, // Type
  Promotion,
  InsertPromotion,
  ProductReview,
  InsertProductReview,
  ShopProfile, // Added ShopProfile import
  // Ensure bookingHistory is exported from your shared schema if available.
  users,
  services,
  bookings,
  bookingHistory,
  products,
  orders,
  orderItems,
  reviews,
  notifications,
  cart,
  wishlist,
  waitlist,
  shopWorkers,
  promotions,
  returns,
  productReviews,
  blockedTimeSlots,
  orderStatusUpdates,
  UserRole,
} from "@shared/schema";
import {
  IStorage,
  OrderStatus,
  OrderStatusUpdate,
  ProductListItem,
  OrderItemInput,
} from "./storage";
import { eq, and, lt, ne, sql, desc, count, inArray, gte } from "drizzle-orm";
import {
  toISTForStorage,
  getCurrentISTDate,
  fromDatabaseToIST,
  getExpirationDate,
  convertArrayDatesToIST,
} from "./ist-utils";
import {
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
} from "./utils/identity";
// Import date utilities for IST handling

interface BlockedTimeSlot {
  id: number;
  serviceId: number;
  date: Date;
  startTime: string;
  endTime: string;
}

interface InsertBlockedTimeSlot {
  serviceId: number;
  date: Date;
  startTime: string;
  endTime: string;
}

const PRODUCT_CACHE_PREFIX = "products";
const PRODUCT_CACHE_TTL_MS = 60_000; // 60 seconds cache to balance freshness and throughput

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => `${JSON.stringify(key)}:${stableStringify(v)}`);

  return `{${entries.join(",")}}`;
}

function normalizeProductFilters(filters: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};

  if (filters.category) {
    normalized.category = String(filters.category).toLowerCase();
  }
  if (filters.minPrice !== undefined) {
    const value = Number(filters.minPrice);
    if (Number.isFinite(value)) {
      normalized.minPrice = value;
    }
  }
  if (filters.maxPrice !== undefined) {
    const value = Number(filters.maxPrice);
    if (Number.isFinite(value)) {
      normalized.maxPrice = value;
    }
  }
  if (filters.tags) {
    normalized.tags = [...(filters.tags as Array<string | number>)]
      .map((tag) => String(tag))
      .sort();
  }
  if (filters.searchTerm) {
    normalized.searchTerm = String(filters.searchTerm).trim();
  }
  if (filters.shopId !== undefined) {
    const value = Number(filters.shopId);
    if (Number.isFinite(value)) {
      normalized.shopId = value;
    }
  }
  if (filters.attributes && typeof filters.attributes === "object") {
    const entries = Object.entries(filters.attributes as Record<string, unknown>)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    normalized.attributes = Object.fromEntries(entries);
  }
  if (filters.locationCity) {
    normalized.locationCity = String(filters.locationCity).trim();
  }
  if (filters.locationState) {
    normalized.locationState = String(filters.locationState).trim();
  }
  if (filters.page !== undefined) {
    const page = Number(filters.page);
    if (Number.isFinite(page)) {
      normalized.page = Math.max(1, Math.trunc(page));
    }
  }
  if (filters.pageSize !== undefined) {
    const pageSize = Number(filters.pageSize);
    if (Number.isFinite(pageSize)) {
      normalized.pageSize = Math.max(
        1,
        Math.min(100, Math.trunc(pageSize)),
      );
    }
  }

  return normalized;
}

function buildProductCacheKey(filters?: Record<string, unknown>): string {
  if (!filters || Object.keys(filters).length === 0) {
    return `${PRODUCT_CACHE_PREFIX}:all`;
  }

  const normalized = normalizeProductFilters(filters);
  if (Object.keys(normalized).length === 0) {
    return `${PRODUCT_CACHE_PREFIX}:all`;
  }

  const serialized = stableStringify(normalized);
  const digest = createHash("sha256").update(serialized).digest("hex");
  return `${PRODUCT_CACHE_PREFIX}:${digest}`;
}

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PgStore = pgSession(session);
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL must be configured to use the PostgreSQL-backed session store.",
      );
    }

    const pruneIntervalCandidate = Number.parseInt(
      process.env.SESSION_PRUNE_INTERVAL_SECONDS ?? "",
      10,
    );
    const ttlCandidate = Number.parseInt(
      process.env.SESSION_TTL_SECONDS ?? "",
      10,
    );
    const tableName =
      process.env.SESSION_TABLE_NAME?.trim() ?? "sessions";
    const schemaName = process.env.SESSION_SCHEMA_NAME?.trim();
    const createTableIfMissing =
      process.env.SESSION_AUTO_CREATE_TABLE !== "false";

    const storeOptions: ConstructorParameters<typeof PgStore>[0] = {
      conString: connectionString,
      tableName,
      createTableIfMissing,
      pruneSessionInterval:
        Number.isInteger(pruneIntervalCandidate) && pruneIntervalCandidate > 0
          ? pruneIntervalCandidate
          : 60,
      errorLog: (...args: unknown[]) => {
        logger.error(
          { args },
          "connect-pg-simple emitted an error",
        );
      },
    };

    if (Number.isInteger(ttlCandidate) && ttlCandidate > 0) {
      storeOptions.ttl = ttlCandidate;
    }

    if (schemaName) {
      storeOptions.schemaName = schemaName;
    }

    this.sessionStore = new PgStore(storeOptions);

    logger.info(
      {
        tableName,
        schemaName: schemaName ?? "public",
        pruneSessionInterval: storeOptions.pruneSessionInterval,
        ttlSeconds: storeOptions.ttl ?? null,
      },
      "Initialized PostgreSQL session store",
    );
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = normalizeEmail(email);
    if (!normalized) return undefined;
    const result = await db.select().from(users).where(eq(users.email, normalized));
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    // Ensure 'users.googleId' column exists in your Drizzle schema for the 'users' table.
    // If 'users.googleId' causes a type error, it means the Drizzle schema object for 'users' needs to be updated
    // to include 'googleId'. For this code to work, the database table must have this column.
    // @ts-ignore // Remove this ignore if users.googleId is correctly typed in your schema
    const result = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return result[0];
  }

  async deleteUserAndData(userId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Step 1: Collect all relevant IDs

      // Bookings related to the user (as customer or provider)
      const customerBookingsQuery = tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.customerId, userId));
      const userServicesQuery = tx
        .select({ id: services.id })
        .from(services)
        .where(eq(services.providerId, userId));

      const [customerBookingsResult, userServicesResult] = await Promise.all([
        customerBookingsQuery,
        userServicesQuery,
      ]);

      const customerBookingIds = customerBookingsResult.map((b) => b.id);
      const serviceIds = userServicesResult.map((s) => s.id);

      let providerServiceBookingIds: number[] = [];
      if (serviceIds.length > 0) {
        const providerServiceBookings = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(sql`${bookings.serviceId} IN ${serviceIds}`);
        providerServiceBookingIds = providerServiceBookings.map((b) => b.id);
      }

      const allBookingIds = Array.from(
        new Set([...customerBookingIds, ...providerServiceBookingIds]),
      );

      // Orders related to the user either as customer or as shop owner
      const customerOrdersQuery = tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.customerId, userId));
      const shopOrdersQuery = tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.shopId, userId));

      const [customerOrders, shopOrders] = await Promise.all([
        customerOrdersQuery,
        shopOrdersQuery,
      ]);

      const orderIds = customerOrders.map((o) => o.id);
      const shopOrderIds = shopOrders.map((o) => o.id);
      const allOrderIds = Array.from(new Set([...orderIds, ...shopOrderIds]));

      // Products related to the user (as shop owner)
      const userProducts = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.shopId, userId));
      const productIds = userProducts.map((p) => p.id);

      // Step 2: Delete dependent data in the correct order

      // Reviews linked to bookings
      if (allBookingIds.length > 0) {
        await tx
          .delete(reviews)
          .where(sql`${reviews.bookingId} IN ${allBookingIds}`);
      }

      // Reviews linked directly to services (if schema supports reviews.serviceId and they are not captured by bookingId)
      if (serviceIds.length > 0) {
        // This handles reviews that might be directly on a service, not through a booking.
        await tx
          .delete(reviews)
          .where(sql`${reviews.serviceId} IN ${serviceIds}`);
      }

      // Booking history
      if (allBookingIds.length > 0) {
        await tx
          .delete(bookingHistory)
          .where(sql`${bookingHistory.bookingId} IN ${allBookingIds}`);
      }
      // Notifications linked to these bookings (for any user)
      if (allBookingIds.length > 0) {
        await tx
          .delete(notifications)
          .where(sql`${notifications.relatedBookingId} IN ${allBookingIds}`);
      }
      // Now delete bookings
      if (allBookingIds.length > 0) {
        await tx
          .delete(bookings)
          .where(sql`${bookings.id} IN ${allBookingIds}`);
      }

      // Order items (linked to orders by customer and shop owner, and products by shop owner)
      if (allOrderIds.length > 0) {
        await tx
          .delete(orderItems)
          .where(sql`${orderItems.orderId} IN ${allOrderIds}`);
        await tx
          .delete(orderStatusUpdates)
          .where(sql`${orderStatusUpdates.orderId} IN ${allOrderIds}`);
        await tx
          .delete(productReviews)
          .where(sql`${productReviews.orderId} IN ${allOrderIds}`);
      }
      if (productIds.length > 0) {
        // OrderItems for shop owner's products
        await tx
          .delete(orderItems)
          .where(sql`${orderItems.productId} IN ${productIds}`);
      }

      // Returns (linked to orders)
      if (allOrderIds.length > 0) {
        await tx
          .delete(returns)
          .where(sql`${returns.orderId} IN ${allOrderIds}`);
      }

      // Now delete orders (customer's orders and shop's orders)
      if (allOrderIds.length > 0) {
        await tx.delete(orders).where(sql`${orders.id} IN ${allOrderIds}`);
      }

      // Promotions (linked to shop)
      if (productIds.length > 0 || serviceIds.length > 0) {
        await tx.delete(promotions).where(eq(promotions.shopId, userId));
      }

      // Now delete products (shop owner's products)
      if (productIds.length > 0) {
        // First, remove these products from any wishlist they might be in
        await tx
          .delete(wishlist)
          .where(sql`${wishlist.productId} IN ${productIds}`);
        await tx
          .delete(productReviews)
          .where(sql`${productReviews.productId} IN ${productIds}`);
        // Then, delete the products themselves
        await tx.delete(products).where(eq(products.shopId, userId));
      }

      // Other direct dependencies on user/customer ID
      await tx.delete(reviews).where(eq(reviews.customerId, userId)); // Handles reviews directly by customerId if not linked to booking/service

      await tx.delete(notifications).where(eq(notifications.userId, userId));
      await tx.delete(cart).where(eq(cart.customerId, userId));
      await tx.delete(wishlist).where(eq(wishlist.customerId, userId));
      await tx.delete(productReviews).where(eq(productReviews.customerId, userId));
      await tx.delete(waitlist).where(eq(waitlist.customerId, userId));
      if (serviceIds.length > 0) {
        await tx
          .delete(waitlist)
          .where(sql`${waitlist.serviceId} IN ${serviceIds}`);
      }
      await tx
        .delete(shopWorkers)
        .where(
          sql`${shopWorkers.workerUserId} = ${userId} OR ${shopWorkers.shopId} = ${userId}`,
        );

      // Delete services (after related bookings/reviews are handled)
      if (serviceIds.length > 0) {
        await tx.delete(services).where(eq(services.providerId, userId));
      }

      // Finally, delete the user
      await tx.delete(users).where(eq(users.id, userId));
    });
  }

  // async getReviewsByCustomer(customerId: number): Promise<Review[]> {
  // const result = await db.select().from(reviews).where(eq(reviews.customerId, customerId));
  // return result;
  //}

  async updateReview(
    id: number,
    data: { rating?: number; review?: string; providerReply?: string },
  ): Promise<Review> {
    const updatedReview = await db
      .update(reviews)
      .set(data)
      .where(eq(reviews.id, id))
      .returning();
    if (updatedReview.length === 0) {
      throw new Error("Review not found or update failed");
    }
    return updatedReview[0];
  }
  async processRefund(returnRequestId: number): Promise<void> {
    // Changed parameter name for clarity
    // Retrieve the return request from the database.
    const requestResult = await db
      .select()
      .from(returns)
      .where(eq(returns.id, returnRequestId)); // Use returns table and parameter
    const request = requestResult[0];
    if (!request) {
      throw new Error("Return request not found");
    }
    if (request.status === "refunded") {
      throw new Error("Refund has already been processed for this request");
    }

    // Process the refund.
    // In a real implementation, integrate with a payment processor here.
    // For now, we simulate refund processing by updating the request status and setting a refunded timestamp.
    const updatedResult = await db
      .update(returns) // Use returns table
      .set({
        status: "refunded",
        resolvedAt: getCurrentISTDate(),
      })
      .where(eq(returns.id, returnRequestId)) // Use returns table and parameter
      .returning();
    if (!updatedResult[0]) {
      throw new Error(
        "Failed to update return request during refund processing",
      );
    }
    const updated = updatedResult[0];
    if (updated.orderId != null) {
      const order = await this.getOrder(updated.orderId);
      if (order) {
        notifyOrderChange({
          customerId: order.customerId ?? null,
          shopId: order.shopId ?? null,
          orderId: order.id,
        });
      }
    }

    // Notify the user that the refund has been processed.
    await this.createNotification({
      userId: request.customerId,
      type: "refund_processed",
      title: "Refund Processed",
      message: `Your refund for order ${request.orderId} has been processed.`,
      isRead: false,
    });
  }

  // ─── PROMOTION OPERATIONS ─────────────────────────────────────────
  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const result = await db
      .insert(promotions)
      .values({
        ...promotion,
        type: promotion.type as "percentage" | "fixed_amount",
      })
      .returning();
    return result[0];
  }

  async getProducts(filters?: any): Promise<{ items: ProductListItem[]; hasMore: boolean }> {
    const effectiveFilters = filters ?? {};
    const cacheKey = buildProductCacheKey(effectiveFilters);
    const cached = await getCache<{ items: ProductListItem[]; hasMore: boolean }>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const { page: rawPage, pageSize: rawPageSize, ...criteria } = effectiveFilters;
    const page = Math.max(1, Number(rawPage ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(rawPageSize ?? 24)));
    const offset = (page - 1) * pageSize;
    const limit = pageSize + 1;

    const conditions = [eq(products.isDeleted, false)];
    let query: any = db.select().from(products);
    let joinedUsers = false;

    const escapeLikePattern = (value: string) =>
      value.replace(/[%_]/g, (char) => `\\${char}`);

    if (criteria && Object.keys(criteria).length > 0) {
      if (criteria.category) {
        conditions.push(
          sql`LOWER(${products.category}) = LOWER(${criteria.category})`,
        );
      }
      if (criteria.minPrice !== undefined) {
        conditions.push(sql`${products.price} >= ${criteria.minPrice}`);
      }
      if (criteria.maxPrice !== undefined) {
        conditions.push(sql`${products.price} <= ${criteria.maxPrice}`);
      }
      if (criteria.searchTerm) {
        const normalizedTerm = String(criteria.searchTerm).trim();
        if (normalizedTerm.length > 0) {
          const escapedPhrase = `%${escapeLikePattern(normalizedTerm)}%`;
          const phraseMatch = sql`(${products.name} ILIKE ${escapedPhrase} OR ${products.description} ILIKE ${escapedPhrase})`;
          const wordClauses = normalizedTerm
            .split(/\s+/)
            .filter((word) => word.length > 0)
            .map((word) => {
              const escapedWord = `%${escapeLikePattern(word)}%`;
              return sql`(${products.name} ILIKE ${escapedWord} OR ${products.description} ILIKE ${escapedWord})`;
            });

          if (wordClauses.length > 0) {
            let combinedWords: SQL | null = null;
            for (const clause of wordClauses) {
              combinedWords = combinedWords
                ? sql`${combinedWords} AND ${clause}`
                : clause;
            }

            if (combinedWords) {
              conditions.push(sql`(${phraseMatch} OR (${combinedWords}))`);
            } else {
              conditions.push(phraseMatch);
            }
          } else {
            conditions.push(phraseMatch);
          }
        }
      }
      if (criteria.shopId) {
        conditions.push(eq(products.shopId, criteria.shopId));
      }
      if (criteria.tags && criteria.tags.length > 0) {
        conditions.push(
          sql`${products.tags} @> ARRAY[${criteria.tags.join(",")}]`,
        );
      }
      if (criteria.attributes) {
        for (const key in criteria.attributes) {
          if (
            Object.prototype.hasOwnProperty.call(criteria.attributes, key)
          ) {
            conditions.push(
              sql`${products.specifications}->>${key} = ${criteria.attributes[key]}`,
            );
          }
        }
      }

      if (criteria.locationCity || criteria.locationState) {
        query = query.leftJoin(users, eq(products.shopId, users.id));
        joinedUsers = true;
        if (criteria.locationCity) {
          conditions.push(eq(users.addressCity, criteria.locationCity));
        }
        if (criteria.locationState) {
          conditions.push(eq(users.addressState, criteria.locationState));
        }
      }
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.limit(limit).offset(offset);

    const results = await query;
    const normalizedResults = joinedUsers
      ? (results as any[]).map((r) => r.products as Product)
      : (results as Product[]);

    const hasMore = normalizedResults.length > pageSize;
    const trimmed = normalizedResults.slice(0, pageSize);
    const items: ProductListItem[] = trimmed.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      price: product.price,
      mrp: product.mrp ?? null,
      category: product.category ?? null,
      images: product.images ?? [],
      shopId: product.shopId ?? null,
      isAvailable: product.isAvailable ?? true,
      stock: product.stock,
    }));

    const payload = { items, hasMore };
    await setCache(cacheKey, payload, PRODUCT_CACHE_TTL_MS);
    return payload;
  }

  async getPromotionsByShop(shopId: number): Promise<Promotion[]> {
    return await db
      .select()
      .from(promotions)
      .where(eq(promotions.shopId, shopId));
  }

  // ─── USER OPERATIONS ─────────────────────────────────────────────
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const normalized = normalizeUsername(username);
    if (!normalized) return undefined;
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, normalized));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    const result = await db
      .select()
      .from(users)
      .where(eq(users.phone, normalized));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getShops(filters?: {
    locationCity?: string;
    locationState?: string;
  }): Promise<User[]> {
    const conditions = [eq(users.role, "shop")];
    if (filters) {
      if (filters.locationCity) {
        conditions.push(eq(users.addressCity, filters.locationCity));
      }
      if (filters.locationState) {
        conditions.push(eq(users.addressState, filters.locationState));
      }
    }
    return await db
      .select()
      .from(users)
      .where(and(...conditions));
  }

  async createUser(user: InsertUser): Promise<User> {
    const normalizedUsername = normalizeUsername(user.username);
    const normalizedEmail = normalizeEmail(user.email);
    const normalizedPhone = normalizePhone(user.phone);

    if (!normalizedUsername) {
      throw new Error("Invalid username");
    }
    if (!normalizedEmail) {
      throw new Error("Invalid email");
    }

    const insertData = {
      username: normalizedUsername,
      password: user.password,
      role: user.role as UserRole,
      name: user.name,
      phone: normalizedPhone ?? "",
      email: normalizedEmail,
      addressStreet: user.addressStreet,
      addressCity: user.addressCity,
      addressState: user.addressState,
      addressPostalCode: user.addressPostalCode,
      addressCountry: user.addressCountry,
      language: user.language,
      profilePicture: user.profilePicture,
      shopProfile: user.shopProfile ? (user.shopProfile as ShopProfile) : null,
      bio: user.bio,
      qualifications: user.qualifications,
      experience: user.experience,
      workingHours: user.workingHours,
      languages: user.languages,
      googleId: user.googleId,
      emailVerified: user.emailVerified,
      upiId: user.upiId,
      upiQrCodeUrl: user.upiQrCodeUrl,
      pickupAvailable: user.pickupAvailable ?? true,
      deliveryAvailable: user.deliveryAvailable ?? false,
      returnsEnabled: user.returnsEnabled ?? true,
    };

    const result = await db
      .insert(users)
      .values(insertData as any)
      .returning();
    return result[0];
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const normalizedUpdate: Partial<User> = { ...updateData };

    if (updateData.username !== undefined) {
      const normalized = normalizeUsername(updateData.username);
      if (!normalized) {
        throw new Error("Invalid username");
      }
      normalizedUpdate.username = normalized;
    }

    if (updateData.email !== undefined) {
      const normalized = normalizeEmail(updateData.email);
      if (!normalized) {
        throw new Error("Invalid email");
      }
      normalizedUpdate.email = normalized;
    }

    if (updateData.phone !== undefined) {
      const normalized = normalizePhone(updateData.phone);
      normalizedUpdate.phone = normalized ?? "";
    }

    // Calculate profile completeness if relevant fields are updated
    let profileCompleteness = normalizedUpdate.profileCompleteness;
    if (profileCompleteness === undefined) {
      const currentUser = await this.getUser(id);
      if (currentUser) {
        const combinedData = { ...currentUser, ...normalizedUpdate };
        let completedFields = 0;
        let totalProfileFields = 0;
        // Diagnostic logging to inspect calculation inputs
        logger.info("[updateUser] Combined data for user", id, combinedData);
        if (currentUser.role === "customer") {
          totalProfileFields = 4; // For customer: name, phone, email, full address. Profile picture is optional.
          if (combinedData.name) completedFields++;
          if (combinedData.phone) completedFields++;
          if (combinedData.email) completedFields++;
          if (
            combinedData.addressStreet &&
            combinedData.addressCity &&
            combinedData.addressState &&
            combinedData.addressPostalCode &&
            combinedData.addressCountry
          )
            completedFields++;
          // Profile picture contributes if present, but isn't required for 100% of these base fields.
          // If we want it to contribute to a score > 100 or be part of a 'bonus', that's a different logic.
          // For now, let's say the base 4 fields make it 100% complete.
          // If profilePicture is present, we can reflect that, but it won't prevent 100% if others are filled.
          // To make it contribute but optional for 100%: one way is to have base 100% from 4 fields, and profile pic adds to it, or adjust total fields dynamically.
          // Let's adjust totalProfileFields if profilePicture is present to reflect its contribution without making it mandatory for 100%.
          // This approach is a bit complex for simple percentage. Simpler: 4 fields = 100%.
          // If profile picture is present, it's a bonus but doesn't change the 100% from core fields.
          // Let's stick to the 4 core fields for 100% customer completeness.
        } else if (currentUser.role === "provider") {
          totalProfileFields = 9; // name, phone, email, full address, bio, qualifications, experience, workingHours, languages
          if (combinedData.name) completedFields++;
          if (combinedData.phone) completedFields++;
          if (combinedData.email) completedFields++;
          if (
            combinedData.addressStreet &&
            combinedData.addressCity &&
            combinedData.addressState &&
            combinedData.addressPostalCode &&
            combinedData.addressCountry
          )
            completedFields++;
          if (combinedData.bio) completedFields++;
          if (combinedData.qualifications) completedFields++;
          if (combinedData.experience) completedFields++;
          if (combinedData.workingHours) completedFields++;
          if (combinedData.languages) completedFields++;

          // if (combinedData.verificationStatus === 'verified') completedFields++;
        } else if (currentUser.role === "shop") {
          totalProfileFields = 10;
          if (combinedData.name) completedFields++;
          if (combinedData.phone) completedFields++;
          if (combinedData.email) completedFields++;

          // Address details (user root level)
          if (
            combinedData.addressStreet &&
            combinedData.addressCity &&
            combinedData.addressState &&
            combinedData.addressPostalCode &&
            combinedData.addressCountry
          ) {
            completedFields++;
          }

          if (combinedData.shopProfile) {
            if (combinedData.shopProfile.shopName) completedFields++;
            if (combinedData.shopProfile.description) completedFields++;
            if (combinedData.shopProfile.businessType) completedFields++;

            if (
              combinedData.shopProfile.workingHours &&
              Array.isArray(combinedData.shopProfile.workingHours.days) &&
              combinedData.shopProfile.workingHours.days.length > 0 &&
              combinedData.shopProfile.workingHours.from &&
              combinedData.shopProfile.workingHours.to
            ) {
              completedFields++;
            }

            if (combinedData.shopProfile.shippingPolicy) completedFields++;
            if (combinedData.shopProfile.returnPolicy) completedFields++;
          }
          // Note: GSTIN is optional and not counted towards 100%
          // Note: shopLogoImageUrl and shopBannerImageUrl are now optional and not counted towards 100%
        }
        // Add a general contribution for verification status if it's 'verified', regardless of role, if desired.
        // For now, profile completeness is based on filling out role-specific fields.
        if (totalProfileFields > 0) {
          profileCompleteness = Math.round(
            (completedFields / totalProfileFields) * 100,
          );
        } else {
          profileCompleteness = 0; // Default if role doesn't match or no fields defined
        }
        // Diagnostic logging for calculation results
        logger.info(
          `[updateUser] Fields complete: ${completedFields}/${totalProfileFields} -> ${profileCompleteness}%`,
        );
      }
    }

    const dataToSet: Partial<User> = { ...normalizedUpdate };
    if (profileCompleteness !== undefined) {
      dataToSet.profileCompleteness = profileCompleteness;
      // If profile is 100% complete and current status is unverified, set to verified
      const existingUser = await this.getUser(id);
      if (
        profileCompleteness === 100 &&
        existingUser &&
        (existingUser.verificationStatus === "unverified" ||
          existingUser.verificationStatus === "pending")
      ) {
        dataToSet.verificationStatus = "verified";
      }
    }

    const result = await db
      .update(users)
      .set(dataToSet)
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  // ─── SERVICE OPERATIONS ──────────────────────────────────────────
  async createService(service: InsertService): Promise<Service> {
    // Type assertion might be needed depending on InsertService definition
    const result = await db
      .insert(services)
      .values(service as any)
      .returning();
    return result[0];
  }

  async getService(id: number): Promise<Service | undefined> {
    logger.info("Getting service with ID:", id);
    const result = await db.select().from(services).where(eq(services.id, id));
    logger.info("Found service:", result[0]);
    return result[0];
  }
  async getServicesByIds(ids: number[]): Promise<Service[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(services)
      .where(sql`${services.id} IN ${ids}`);
  }

  async getUsersByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(users)
      .where(sql`${users.id} IN ${ids}`);
  }
  // Implementation of IStorage.getPendingBookingRequestsForProvider
  async getPendingBookingRequestsForProvider(
    providerId: number,
  ): Promise<Booking[]> {
    // Get all services offered by this provider first
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map((s) => s.id);
    if (serviceIds.length === 0) return [];

    const rows = await db
      .select()
      .from(bookings)
      .where(
        and(
          sql`${bookings.serviceId} IN ${serviceIds}`,
          eq(bookings.status, "pending"),
        ),
      );
    return rows as Booking[];
  }

  // Implementation of IStorage.getBookingHistoryForProvider

  // Get booking requests with status for a customer
  async getBookingRequestsWithStatusForCustomer(
    customerId: number,
  ): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.customerId, customerId));
  }

  // Implementation of IStorage.getBookingHistoryForCustomer

  // ─── REVIEW OPERATIONS ───────────────────────────────────────────
  async createReview(review: InsertReview): Promise<Review> {
    if (review.bookingId && review.customerId) {
      const existing = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.bookingId, review.bookingId),
            eq(reviews.customerId, review.customerId),
          ),
        );
      if (existing[0]) {
        throw new Error("Duplicate review");
      }
    }
    const result = await db.insert(reviews).values(review).returning();
    return result[0];
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.serviceId, serviceId));
  }

  async getReviewsByServiceIds(serviceIds: number[]): Promise<Review[]> {
    if (serviceIds.length === 0) {
      return [];
    }
    const uniqueIds = Array.from(new Set(serviceIds));
    return await db
      .select()
      .from(reviews)
      .where(inArray(reviews.serviceId, uniqueIds));
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    // This requires joining reviews with services to get the providerId
    const providerServices = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.providerId, providerId));
    const serviceIds = providerServices.map((s) => s.id);
    if (serviceIds.length === 0) return [];
    const rows = await db
      .select()
      .from(reviews)
      .where(sql`${reviews.serviceId} IN ${serviceIds}`);
    return rows as Review[];
  }

  async getReviewsByCustomer(
    customerId: number,
  ): Promise<(Review & { serviceName: string | null })[]> {
    const results = await db
      .select({
        id: reviews.id,
        customerId: reviews.customerId,
        serviceId: reviews.serviceId,
        rating: reviews.rating,
        review: reviews.review,
        providerReply: reviews.providerReply,
        createdAt: reviews.createdAt,
        // removed updatedAt as it is not defined in the reviews schema
        serviceName: services.name,
      })
      .from(reviews)
      .leftJoin(services, eq(reviews.serviceId, services.id))
      .where(eq(reviews.customerId, customerId));

    // Ensure the return type matches the promise signature
    return results.map((r) => ({
      ...r,
      // Drizzle might return null for left join, handle it
      serviceName: r.serviceName ?? "Service Not Found",
      bookingId: null,
      isVerifiedService: null,
    }));
  }

  async getReviewById(id: number): Promise<Review | undefined> {
    const result = await db.select().from(reviews).where(eq(reviews.id, id));
    return result[0];
  }

  async updateCustomerReview(
    reviewId: number,
    customerId: number,
    data: { rating?: number; review?: string },
  ): Promise<Review> {
    // First, verify the review belongs to the customer
    const reviewCheck = await db
      .select({ id: reviews.id, customerId: reviews.customerId })
      .from(reviews)
      .where(eq(reviews.id, reviewId));

    if (!reviewCheck[0]) {
      throw new Error("Review not found");
    }

    if (reviewCheck[0].customerId !== customerId) {
      throw new Error("Customer is not authorized to update this review");
    }

    // Proceed with the update
    const result = await db
      .update(reviews)
      .set(data)
      .where(eq(reviews.id, reviewId))
      .returning();

    if (!result[0]) {
      // This case should ideally not happen if the check above passed, but good practice to handle it
      throw new Error("Failed to update review");
    }
    return result[0];
  }
  async updateProviderRating(providerId: number): Promise<void> {
    const providerServices = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.providerId, providerId));
    const serviceIds = providerServices.map((s) => s.id);
    if (serviceIds.length === 0) {
      await db.execute(
        sql`UPDATE users SET average_rating = NULL WHERE id = ${providerId}`,
      );
      return;
    }
    const ratings = await db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(sql`${reviews.serviceId} IN ${serviceIds}`);
    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    const average = ratings.length > 0 ? total / ratings.length : null;
    await db.execute(
      sql`UPDATE users SET average_rating = ${average}, total_reviews = ${ratings.length} WHERE id = ${providerId}`,
    );
  }

  // ─── NOTIFICATION OPERATIONS ─────────────────────────────────────
  async getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.customerId, customerId),
          ne(bookings.status, "pending"),
        ),
      );
  }

  // Removed duplicate processExpiredBookings implementation to avoid conflicts.

  async getServicesByProvider(providerId: number): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(
        and(eq(services.providerId, providerId), eq(services.isDeleted, false)),
      );
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    const key = `services_category_${category}`;
    const cached = await getCache<Service[]>(key);
    if (cached) return cached;

    const result = await db
      .select()
      .from(services)
      .where(
        and(eq(services.category, category), eq(services.isDeleted, false)),
      );
    await setCache(key, result);
    return result;
  }

  async updateService(
    id: number,
    serviceUpdate: Partial<Service>,
  ): Promise<Service> {
    const result = await db
      .update(services)
      .set(serviceUpdate as any) // Pass the update data directly
      .where(eq(services.id, id))
      .returning();
    if (!result[0]) throw new Error("Service not found");
    return result[0];
  }

  async deleteService(id: number): Promise<void> {
    // Instead of deleting, mark as deleted (soft delete)
    const result = await db
      .update(services)
      .set({ isDeleted: true })
      .where(eq(services.id, id))
      .returning();
    if (!result[0]) throw new Error("Service not found");
  }

  async getServices(filters?: any): Promise<Service[]> {
    // Build an array of conditions starting with the non-deleted check
    const conditions = [eq(services.isDeleted, false)];
    const escapeLikePattern = (value: string) =>
      value.replace(/[%_]/g, (char) => `\\${char}`);

    if (filters) {
      if (filters.category) {
        conditions.push(
          sql`LOWER(${services.category}) = LOWER(${filters.category})`,
        );
      }
      if (filters.minPrice) {
        conditions.push(sql`${services.price} >= ${filters.minPrice}`);
      }
      if (filters.maxPrice) {
        conditions.push(sql`${services.price} <= ${filters.maxPrice}`);
      }
      if (filters.searchTerm) {
        const normalizedTerm = String(filters.searchTerm).trim();
        if (normalizedTerm.length > 0) {
          const escapedPhrase = `%${escapeLikePattern(normalizedTerm)}%`;
          const phraseMatch = sql`(${services.name} ILIKE ${escapedPhrase} OR ${services.description} ILIKE ${escapedPhrase})`;
          const wordClauses = normalizedTerm
            .split(/\s+/)
            .filter((word) => word.length > 0)
            .map((word) => {
              const escapedWord = `%${escapeLikePattern(word)}%`;
              return sql`(${services.name} ILIKE ${escapedWord} OR ${services.description} ILIKE ${escapedWord})`;
            });

          if (wordClauses.length > 0) {
            let combinedWords: SQL | null = null;
            for (const clause of wordClauses) {
              combinedWords = combinedWords
                ? sql`${combinedWords} AND ${clause}`
                : clause;
            }

            if (combinedWords) {
              conditions.push(sql`(${phraseMatch} OR (${combinedWords}))`);
            } else {
              conditions.push(phraseMatch);
            }
          } else {
            conditions.push(phraseMatch);
          }
        }
      }
      if (filters.providerId) {
        conditions.push(eq(services.providerId, filters.providerId));
      }
      if (filters.locationCity) {
        conditions.push(eq(services.addressCity, filters.locationCity));
      }
      if (filters.locationState) {
        conditions.push(eq(services.addressState, filters.locationState));
      }
      if (filters.locationPostalCode) {
        conditions.push(
          eq(services.addressPostalCode, filters.locationPostalCode),
        );
      }
      // Note: availabilityDate filtering would be more complex and might require checking bookings or a serviceAvailability table.
      if (filters.availabilityDate) {
        conditions.push(eq(services.isAvailable, true));
      }
    }
    // Exclude providers with many unresolved payments
    const exclusion = sql`SELECT s.provider_id FROM ${bookings} b JOIN ${services} s ON b.service_id = s.id WHERE b.status = 'awaiting_payment' GROUP BY s.provider_id HAVING COUNT(*) > 5`;

    conditions.push(sql`${services.providerId} NOT IN (${exclusion})`);
    const query = db
      .select()
      .from(services)
      .where(and(...conditions));
    return await query;
  }

  // ─── BOOKING OPERATIONS ──────────────────────────────────────────
  async createBooking(booking: InsertBooking): Promise<Booking> {
    // Set default values for new bookings with IST timestamps
    const bookingWithDefaults = {
      ...booking,
      createdAt: getCurrentISTDate(),
      // Set expiresAt to 24 hours from now in IST if needed
      expiresAt: booking.expiresAt || getExpirationDate(24),
      status: booking.status as
        | "pending"
        | "accepted"
        | "rejected"
        | "rescheduled"
        | "completed"
        | "cancelled"
        | "expired",
      paymentStatus: booking.paymentStatus as "pending" | "paid" | "refunded",
    };
    const result = await db
      .insert(bookings)
      .values({
        ...bookingWithDefaults,
        paymentStatus: bookingWithDefaults.paymentStatus as
          | "pending"
          | "verifying"
          | "paid"
          | "failed",
      })
      .returning();

    // Add entry to booking history with IST timestamp
    const createdBooking = result[0];

    await db.insert(bookingHistory).values({
      bookingId: createdBooking.id,
      status: createdBooking.status,
      changedAt: getCurrentISTDate(),
      changedBy: booking.customerId,
      comments: "Booking created",
    });

    let providerId: number | null = null;
    if (createdBooking?.serviceId) {
      const service = await this.getService(createdBooking.serviceId);
      providerId = service?.providerId ?? null;
    }

    notifyBookingChange({
      customerId: createdBooking?.customerId ?? null,
      providerId,
    });

    return createdBooking;
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id));
    return result[0];
  }

  async getBookingsByCustomer(
    customerId: number,
    filters?: { status?: Booking["status"] },
  ): Promise<Booking[]> {
    const baseCondition = eq(bookings.customerId, customerId);
    const whereClause = filters?.status
      ? and(baseCondition, eq(bookings.status, filters.status))
      : baseCondition;

    return await db
      .select()
      .from(bookings)
      .where(whereClause)
      .orderBy(desc(bookings.bookingDate));
  }

  async getBookingsByProvider(providerId: number): Promise<Booking[]> {
    // Get all services offered by this provider first
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map((service) => service.id);
    if (serviceIds.length === 0) return [];

    let allBookings: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db
        .select()
        .from(bookings)
        .where(eq(bookings.serviceId, serviceId));
      allBookings = [...allBookings, ...serviceBookings];
    }
    return allBookings;
  }

  async getBookingsByStatus(status: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.status, status as any));
  }

  async updateBooking(id: number, booking: Partial<Booking>): Promise<Booking> {
    // Get the current booking to track status changes
    const currentBooking = await this.getBooking(id);
    if (!currentBooking) throw new Error("Booking not found");

    // Construct the update object, only including defined fields
    const updateData: Partial<Booking> = {}; // Removed updatedAt: getCurrentISTDate()
    for (const key in booking) {
      if (booking[key as keyof Booking] !== undefined) {
        (updateData as any)[key] = booking[key as keyof Booking];
      }
    }

    // If no actual fields to update (other than updatedAt), return current booking
    if (Object.keys(updateData).length === 1 && (updateData as any).updatedAt) {
      // Optionally, you might still want to update 'updatedAt' or decide if this scenario is an error
      // For now, let's assume if only updatedAt is there, no meaningful update was intended beyond timestamp.
      // To be safe, and if Drizzle handles empty .set() gracefully or errors, this could be db.update().set({updatedAt: updateData.updatedAt})
      // However, if booking object was empty, this means no change was requested.
      // Consider if an empty booking object (no status, no comments etc.) should even reach here.
      // Returning currentBooking if no actual data fields were provided for update.
      // If an update with only 'undefined' values was passed, this prevents an error.
      logger.warn(
        `[DB DEBUG] updateBooking called for ID ${id} with no actual data changes.`,
      );
      // return currentBooking; // Or proceed to update just `updatedAt` if that's desired.
    }

    // Ensure there's something to update beyond just `updatedAt` if we don't return early
    if (
      Object.keys(updateData).length <= 1 &&
      !booking.status &&
      !booking.comments
    ) {
      // If only updatedAt is set and no other meaningful fields like status or comments are present in the original 'booking' partial,
      // it implies no actual change was intended or all provided fields were undefined.
      // To prevent an empty update or an update with only 'updatedAt' when no other changes are specified,
      // we can return the current booking. This behavior might need adjustment based on specific requirements.
      logger.info(
        `[DB DEBUG] updateBooking for ID ${id}: No effective changes provided. Returning current booking.`,
      );
      return currentBooking;
    }

    const result = await db
      .update(bookings)
      .set(updateData) // Use the filtered updateData
      .where(eq(bookings.id, id))
      .returning();

    // If the status changed, add an entry in the booking history table with IST timestamp
    // Ensure booking.status is checked against undefined before using it
    if (
      booking.status !== undefined &&
      booking.status !== currentBooking.status
    ) {
      await db.insert(bookingHistory).values({
        bookingId: id,
        status: booking.status, // Safe to use booking.status here due to the check
        changedAt: getCurrentISTDate(),
        // Use booking.comments if defined, otherwise generate a default message
        comments:
          booking.comments !== undefined
            ? booking.comments
            : `Status changed from ${currentBooking.status} to ${booking.status}`,
      });
      // If status is no longer pending, clear the expiration date
      if (booking.status !== "pending") {
        await db
          .update(bookings)
          .set({ expiresAt: null })
          .where(eq(bookings.id, id));
      }
    }

    const updatedBooking = result[0];
    if (!updatedBooking) throw new Error("Booking not found or update failed");

    const serviceId = booking.serviceId ?? currentBooking.serviceId;
    let providerId: number | null = null;
    if (serviceId) {
      const service = await this.getService(serviceId);
      providerId = service?.providerId ?? null;
    }

    notifyBookingChange({
      customerId: currentBooking.customerId ?? null,
      providerId,
    });

    return updatedBooking;
  }

  // ─── PRODUCT OPERATIONS ──────────────────────────────────────────
  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductsByShop(shopId: number): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(and(eq(products.shopId, shopId), eq(products.isDeleted, false)));
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    const key = `products_category_${category}`;
    const cached = await getCache<Product[]>(key);
    if (cached) return cached;

    const result = await db
      .select()
      .from(products)
      .where(
        and(eq(products.category, category), eq(products.isDeleted, false)),
      );
    await setCache(key, result);
    return result;
  }

  async getProductsByIds(ids: number[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }
    const uniqueIds = Array.from(new Set(ids));
    return await db
      .select()
      .from(products)
      .where(
        and(inArray(products.id, uniqueIds), eq(products.isDeleted, false)),
      );
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const result = await db
      .update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    if (!result[0]) throw new Error("Product not found");
    return result[0];
  }

  async removeProductFromAllCarts(productId: number): Promise<void> {
    logger.info(`Removing product ID ${productId} from all carts`);
    try {
      const affectedCustomers = await db
        .select({ customerId: cart.customerId })
        .from(cart)
        .where(eq(cart.productId, productId));
      await db.delete(cart).where(eq(cart.productId, productId));
      logger.info(
        `Successfully removed product ID ${productId} from all carts`,
      );
      for (const row of affectedCustomers) {
        if (row.customerId != null) {
          notifyCartChange(row.customerId);
        }
      }
    } catch (error) {
      logger.error(`Error removing product ${productId} from carts:`, error);
      throw new Error(
        `Failed to remove product from carts: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async removeProductFromAllWishlists(productId: number): Promise<void> {
    logger.info(`Removing product ID ${productId} from all wishlists`);
    try {
      const affectedCustomers = await db
        .select({ customerId: wishlist.customerId })
        .from(wishlist)
        .where(eq(wishlist.productId, productId));
      await db.delete(wishlist).where(eq(wishlist.productId, productId));
      logger.info(
        `Successfully removed product ID ${productId} from all wishlists`,
      );
      for (const row of affectedCustomers) {
        if (row.customerId != null) {
          notifyWishlistChange(row.customerId);
        }
      }
    } catch (error) {
      logger.error(
        `Error removing product ${productId} from wishlists:`,
        error,
      );
      throw new Error(
        `Failed to remove product from wishlists: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteProduct(id: number): Promise<void> {
    const productExists = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    if (productExists.length === 0) throw new Error("Product not found");

    try {
      await this.removeProductFromAllCarts(id);
      await this.removeProductFromAllWishlists(id);

      // Use soft deletion instead of hard deletion
      const result = await db
        .update(products)
        .set({ isDeleted: true })
        .where(eq(products.id, id))
        .returning();

      if (!result[0]) throw new Error("Product not found");
      logger.info(`Successfully marked product ID ${id} as deleted`);
    } catch (error) {
      logger.error(`Error deleting product ${id}:`, error);
      throw new Error(
        `Failed to delete product: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ─── CART OPERATIONS ─────────────────────────────────────────────
  async addToCart(
    customerId: number,
    productId: number,
    quantity: number,
  ): Promise<void> {
    logger.info(
      `Attempting to add product ID ${productId} to cart for customer ID ${customerId} with quantity ${quantity}`,
    );
    if (quantity <= 0) {
      logger.error(`Invalid quantity ${quantity} for product ID ${productId}`);
      throw new Error("Quantity must be positive");
    }

    try {
      // Get the product being added to find its shopId
      const productToAddResult = await db
        .select({ shopId: products.shopId })
        .from(products)
        .where(eq(products.id, productId));
      if (productToAddResult.length === 0) {
        logger.error(`Product ID ${productId} not found`);
        throw new Error("Product not found");
      }
      const shopIdToAdd = productToAddResult[0].shopId;
      logger.info(`Product ID ${productId} belongs to shop ID ${shopIdToAdd}`);

      // Get current cart items for the customer
      const currentCartItems = await db
        .select({ productId: cart.productId })
        .from(cart)
        .where(eq(cart.customerId, customerId));
      logger.info(
        `Customer ID ${customerId} has ${currentCartItems.length} item(s) in cart`,
      );

      if (currentCartItems.length > 0) {
        // If cart is not empty, check if the new item's shop matches the existing items' shop
        const firstCartProductId = currentCartItems[0].productId;
        logger.info(`First item in cart has product ID ${firstCartProductId}`);
        const firstProductResult = await db
          .select({ shopId: products.shopId })
          .from(products)
          .where(eq(products.id, firstCartProductId!));

        if (firstProductResult.length > 0) {
          const existingShopId = firstProductResult[0].shopId;
          logger.info(
            `Existing items in cart belong to shop ID ${existingShopId}`,
          );
          if (shopIdToAdd !== existingShopId) {
            logger.error(
              `Shop ID mismatch: Cannot add product from shop ${shopIdToAdd} to cart containing items from shop ${existingShopId}`,
            );
            throw new Error(
              "Cannot add items from different shops to the cart. Please clear your cart or checkout with items from the current shop.",
            );
          }
        } else {
          // This case should ideally not happen if DB is consistent, but log it.
          logger.warn(
            `Could not find product details for the first item (ID: ${firstCartProductId}) in the cart for customer ${customerId}. Proceeding with caution.`,
          );
        }
      }

      // Proceed with adding or updating the cart item
      // First, get product stock to validate against
      const productDetails = await db
        .select({ stock: products.stock })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (productDetails.length === 0) {
        logger.error(`Product ID ${productId} not found for stock validation.`);
        throw new Error("Product not found when trying to add to cart.");
      }
      const availableStock = productDetails[0].stock;

      if (quantity > availableStock) {
        logger.error(
          `Requested quantity ${quantity} for product ID ${productId} exceeds available stock ${availableStock}.`,
        );
        throw new Error(
          `Cannot add ${quantity} items. Only ${availableStock} left in stock.`,
        );
      }

      if (quantity <= 0) {
        logger.info(
          `Quantity ${quantity} is zero or less for product ID ${productId}. Removing from cart for customer ID ${customerId}.`,
        );
        await db
          .delete(cart)
          .where(
            and(eq(cart.customerId, customerId), eq(cart.productId, productId)),
        );
        logger.info(
          `Successfully removed product ID ${productId} from cart for customer ID ${customerId} due to zero/negative quantity.`,
        );
        notifyCartChange(customerId);
        return; // Exit after removing
      }

      const existingCartItem = await db
        .select()
        .from(cart)
        .where(
          and(eq(cart.customerId, customerId), eq(cart.productId, productId)),
        )
        .limit(1);

      if (existingCartItem.length > 0) {
        // Item exists, update its quantity (direct assignment)
        logger.info(
          `Updating existing cart item for customer ID ${customerId}, product ID ${productId}. New quantity: ${quantity}`,
        );
        await db
          .update(cart)
          .set({ quantity: quantity }) // Direct assignment
          .where(
            and(eq(cart.customerId, customerId), eq(cart.productId, productId)),
          );
      } else {
        // Item does not exist, insert new cart item
        logger.info(
          `Creating new cart item for customer ID ${customerId}, product ID ${productId} with quantity ${quantity}`,
        );
        await db.insert(cart).values({ customerId, productId, quantity });
      }
      logger.info(
        `Successfully added/updated product ID ${productId} with quantity ${quantity} in cart for customer ID ${customerId}`,
      );
      notifyCartChange(customerId);
    } catch (error) {
      logger.error(
        `Error in addToCart for customer ID ${customerId}, product ID ${productId}:`,
        error,
      );
      // Re-throw the original error or a new one with context
      if (
        error instanceof Error &&
        error.message.startsWith("Cannot add items")
      ) {
        throw error; // Re-throw the specific shop mismatch error
      }
      throw new Error(
        `Failed to add product to cart: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async removeFromCart(customerId: number, productId: number): Promise<void> {
    await db
      .delete(cart)
      .where(
        and(eq(cart.customerId, customerId), eq(cart.productId, productId)),
      );
    notifyCartChange(customerId);
  }

  async getCart(
    customerId: number,
  ): Promise<{ product: Product; quantity: number }[]> {
    logger.info(`Getting cart for customer ID: ${customerId}`);
    try {
      const cartItems = await db
        .select()
        .from(cart)
        .where(eq(cart.customerId, customerId));
      logger.info(
        `Found ${cartItems.length} cart items for customer ID: ${customerId}`,
      );

      const result = [];
      for (const item of cartItems) {
        const productResult = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId!));
        if (productResult.length > 0 && !productResult[0].isDeleted) {
          result.push({ product: productResult[0], quantity: item.quantity });
        } else {
          // If product doesn't exist or is deleted, remove it from cart if productId is not null
          logger.info(
            `Removing non-existent or deleted product ID ${item.productId} from cart`,
          );
          if (item.productId !== null) {
            await this.removeFromCart(customerId, item.productId);
          }
        }
      }
      return result;
    } catch (error) {
      logger.error(`Error getting cart for customer ID ${customerId}:`, error);
      return [];
    }
  }

  async clearCart(customerId: number): Promise<void> {
    await db.delete(cart).where(eq(cart.customerId, customerId));
    notifyCartChange(customerId);
  }

  // ─── WISHLIST OPERATIONS ─────────────────────────────────────────
  async addToWishlist(customerId: number, productId: number): Promise<void> {
    const existingItem = await db
      .select()
      .from(wishlist)
      .where(
        and(
          eq(wishlist.customerId, customerId),
          eq(wishlist.productId, productId),
        ),
      );
    if (existingItem.length === 0) {
      await db.insert(wishlist).values({ customerId, productId });
    }
    notifyWishlistChange(customerId);
  }

  async removeFromWishlist(
    customerId: number,
    productId: number,
  ): Promise<void> {
    await db
      .delete(wishlist)
      .where(
        and(
          eq(wishlist.customerId, customerId),
          eq(wishlist.productId, productId),
        ),
      );
    notifyWishlistChange(customerId);
  }

  async getWishlist(customerId: number): Promise<Product[]> {
    const wishlistItems = await db
      .select()
      .from(wishlist)
      .where(eq(wishlist.customerId, customerId));
    const result: Product[] = [];
    for (const item of wishlistItems) {
      const productResult = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId!));
      if (productResult.length > 0) result.push(productResult[0]);
    }
    return result;
  }

  // ─── ORDER OPERATIONS ─────────────────────────────────────────────
  async createOrder(order: InsertOrder): Promise<Order> {
    const orderToInsert = {
      ...order,
      status: order.status as
        | "pending"
        | "cancelled"
        | "confirmed"
        | "processing"
        | "packed"
        | "shipped"
        | "delivered"
        | "returned",
      paymentStatus: order.paymentStatus as
        | "pending"
        | "verifying"
        | "paid"
        | "failed",
    };
    const result = await db.insert(orders).values(orderToInsert).returning();
    const created = result[0];
    await db.insert(orderStatusUpdates).values({
      orderId: created.id,
      status: "pending",
      trackingInfo: created.trackingInfo,
      timestamp: created.orderDate ?? new Date(),
    });
    notifyOrderChange({
      customerId: created.customerId ?? null,
      shopId: created.shopId ?? null,
      orderId: created.id,
    });
    return created;
  }

  async createOrderWithItems(
    order: InsertOrder,
    items: OrderItemInput[],
  ): Promise<Order> {
    if (items.length === 0) {
      throw new Error("Cannot create an order without items");
    }

    const createdOrder = await db.transaction(async (tx) => {
      const productIds = Array.from(
        new Set(items.map((item) => item.productId)),
      );

      const productsForUpdate = await tx
        .select({
          id: products.id,
          shopId: products.shopId,
        })
        .from(products)
        .where(inArray(products.id, productIds));

      if (productsForUpdate.length !== productIds.length) {
        throw new Error("One or more products were not found during checkout");
      }

      for (const row of productsForUpdate) {
        if (row.shopId !== order.shopId) {
          throw new Error("Product does not belong to the specified shop");
        }
      }

      const quantityByProduct = new Map<number, number>();
      for (const item of items) {
        const existing = quantityByProduct.get(item.productId) ?? 0;
        quantityByProduct.set(item.productId, existing + item.quantity);
      }

      for (const [productId, quantity] of Array.from(
        quantityByProduct.entries(),
      )) {
        const updateResult = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${quantity}` })
          .where(and(eq(products.id, productId), gte(products.stock, quantity)))
          .returning({ id: products.id });

        if (updateResult.length === 0) {
          throw new Error(`Insufficient stock for product ID ${productId}`);
        }
      }

      const orderToInsert = {
        ...order,
        status: order.status as
          | "pending"
          | "cancelled"
          | "confirmed"
          | "processing"
          | "packed"
          | "shipped"
          | "delivered"
          | "returned",
        paymentStatus: order.paymentStatus as
          | "pending"
          | "verifying"
          | "paid"
          | "failed",
      };

      const insertedOrders = await tx
        .insert(orders)
        .values(orderToInsert)
        .returning();
      const createdOrderRow = insertedOrders[0];
      if (!createdOrderRow) {
        throw new Error("Failed to create order");
      }

      const orderId = createdOrderRow.id;
      const orderItemsToInsert = items.map((item) => ({
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      }));

      if (orderItemsToInsert.length > 0) {
        await tx.insert(orderItems).values(orderItemsToInsert);
      }

      await tx.insert(orderStatusUpdates).values({
        orderId,
        status: "pending",
        trackingInfo: createdOrderRow.trackingInfo,
        timestamp: createdOrderRow.orderDate ?? new Date(),
      });
      return createdOrderRow;
    });

    if (!createdOrder) {
      throw new Error("Failed to create order");
    }

    notifyOrderChange({
      customerId: createdOrder.customerId ?? null,
      shopId: createdOrder.shopId ?? null,
      orderId: createdOrder.id,
    });

    return createdOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getOrdersByCustomer(
    customerId: number,
    filters?: { status?: Order["status"] },
  ): Promise<Order[]> {
    const conditions = [eq(orders.customerId, customerId)];
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status as any));
    }

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    return await db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.orderDate));
  }

  async getOrdersByShop(shopId: number, status?: string): Promise<Order[]> {
    const conditions = [eq(orders.shopId, shopId)];
    if (status && status !== "all_orders") {
      conditions.push(eq(orders.status, status as any));
    }

    return await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.orderDate));
  }

  async getRecentOrdersByShop(shopId: number): Promise<Order[]> {
    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.shopId, shopId))
      .orderBy(desc(orders.orderDate))
      .limit(5);

    return result;
  }

  async getShopDashboardStats(shopId: number) {
    const [pendingResult] = await db
      .select({ value: count() })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.status, "pending")));
    const [inProgressResult] = await db
      .select({ value: count() })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.status, "packed")));
    const [completedResult] = await db
      .select({ value: count() })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.status, "delivered")));
    const [totalProductsResult] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.shopId, shopId));
    const [lowStockResult] = await db
      .select({ value: count() })
      .from(products)
      .where(and(eq(products.shopId, shopId), lt(products.stock, 10)));

    return {
      pendingOrders: pendingResult.value,
      ordersInProgress: inProgressResult.value,
      completedOrders: completedResult.value,
      totalProducts: totalProductsResult.value,
      lowStockItems: lowStockResult.value,
    };
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    const result = await db
      .update(orders)
      .set(order)
      .where(eq(orders.id, id))
      .returning();
    if (!result[0]) throw new Error("Order not found");
    const updated = result[0];
    notifyOrderChange({
      customerId: updated.customerId ?? null,
      shopId: updated.shopId ?? null,
      orderId: updated.id,
    });
    return updated;
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db
      .insert(orderItems)
      .values({
        ...orderItem,
        status: orderItem.status as
          | "cancelled"
          | "returned"
          | "ordered"
          | null
          | undefined,
      })
      .returning();
    return result[0];
  }

  async updateProductStock(productId: number, quantity: number): Promise<void> {
    const productResult = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));
    if (!productResult.length)
      throw new Error(`Product with ID ${productId} not found`);
    const product = productResult[0];
    const newStock = product.stock - quantity;
    if (newStock < 0)
      throw new Error(`Insufficient stock for product ID ${productId}`);
    await db
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, productId));
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  async getOrderItemsByOrderIds(orderIds: number[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) {
      return [];
    }
    const unique = Array.from(new Set(orderIds));
    return await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, unique));
  }

  // ─── NOTIFICATION OPERATIONS ─────────────────────────────────────
  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const result = await db
      .insert(notifications)
      .values({
        ...notification,
        type: notification.type as any,
        relatedBookingId: notification.relatedBookingId ?? null,
      })
      .returning();
    const newNotification = result[0];

    notifyNotificationChange(newNotification?.userId);

    // Define critical notification types that should trigger an email
    return newNotification;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    const rows = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        isRead: notifications.isRead,
        relatedBookingId: notifications.relatedBookingId,
        createdAt: sql<Date>`(${notifications.createdAt} AT TIME ZONE 'Asia/Kolkata')`,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt ?? null,
    }));
  }

  async markNotificationAsRead(id: number): Promise<void> {
    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning({ userId: notifications.userId });

    if (updated[0]) {
      notifyNotificationChange(updated[0].userId);
    }
  }

  async markAllNotificationsAsRead(
    userId: number,
    role?: string,
  ): Promise<void> {
    const conditions = [eq(notifications.userId, userId)];
    if (role === "shop_owner") {
      // Shop owners should not see service notifications
      conditions.push(sql`type != 'service'`);
    } else if (role === "provider") {
      // Service providers should not see order notifications
      conditions.push(sql`type != 'order'`);
    }
    const query = db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));

    await query;

    notifyNotificationChange(userId);
  }

  async deleteNotification(id: number): Promise<void> {
    const deleted = await db
      .delete(notifications)
      .where(eq(notifications.id, id))
      .returning({ userId: notifications.userId });

    if (deleted[0]) {
      notifyNotificationChange(deleted[0].userId);
    }
  }

  // ─── ADDITIONAL / ENHANCED OPERATIONS ─────────────────────────────
  async checkAvailability(serviceId: number, date: Date): Promise<boolean> {
    const dateStr = date.toISOString().split("T")[0];

    // Check if the slot is blocked by the provider
    const [blocked] = await db
      .select({ id: blockedTimeSlots.id })
      .from(blockedTimeSlots)
      .where(
        and(
          eq(blockedTimeSlots.serviceId, serviceId),
          sql`DATE(${blockedTimeSlots.date}) = ${dateStr}`,
        ),
      );
    if (blocked) return false;

    // Check for existing booking at the exact time
    const [conflict] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.serviceId, serviceId),
          eq(bookings.bookingDate, date),
          sql`${bookings.status} NOT IN ('cancelled','rejected','expired')`,
        ),
      );
    if (conflict) return false;

    // Enforce max daily bookings
    const service = await this.getService(serviceId);
    if (service) {
      const [{ value: countForDay }] = await db
        .select({ value: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.serviceId, serviceId),
            sql`DATE(${bookings.bookingDate}) = ${dateStr}`,
            sql`${bookings.status} NOT IN ('cancelled','rejected','expired')`,
          ),
        );
      const max = service.maxDailyBookings ?? 5;
      if (Number(countForDay) >= max) return false;
    }
    return true;
  }

  async joinWaitlist(
    customerId: number,
    serviceId: number,
    preferredDate: Date,
  ): Promise<void> {
    // Insert into a waitlist table (implementation required)
  }

  // For booking history sorting, we compute the last update timestamp asynchronously.
  async getBookingHistory(bookingId: number): Promise<any[]> {
    return await db
      .select()
      .from(bookingHistory)
      .where(eq(bookingHistory.bookingId, bookingId));
  }

  async getExpiredBookings(): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(
        and(eq(bookings.status, "pending"), lt(bookings.expiresAt, new Date())),
      );
  }

  async processExpiredBookings(): Promise<void> {
    const expiredBookings = await this.getExpiredBookings();
    for (const booking of expiredBookings) {
      await this.updateBooking(booking.id, {
        status: "expired",
        comments: "Automatically expired after 7 days",
      });
      await this.createNotification({
        userId: booking.customerId,
        type: "booking_expired",
        title: "Booking Request Expired",
        message:
          "Your booking request has expired as the service provider did not respond within 7 days.",
        isRead: false,
      });
      const service =
        typeof booking.serviceId === "number"
          ? await this.getService(booking.serviceId)
          : undefined;
      if (service) {
        await this.createNotification({
          userId: service.providerId,
          type: "booking_expired",
          title: "Booking Request Expired",
          message: `A booking request for ${service.name} has expired as you did not respond within 7 days.`,
          isRead: false,
        });
      }
    }
  }

  // Asynchronously compute last-update timestamp for sorting.
  // Removed duplicate implementation of getBookingHistoryForCustomer to resolve the duplicate function error.

  async getBookingHistoryForProvider(providerId: number): Promise<Booking[]> {
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map((service) => service.id);
    if (serviceIds.length === 0) return [];

    let bookingHistoryArr: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.serviceId, serviceId),
            ne(bookings.status, "pending"),
          ),
        );
      bookingHistoryArr = [...bookingHistoryArr, ...serviceBookings];
    }

    const bookingsWithLastUpdate = await Promise.all(
      bookingHistoryArr.map(async (booking) => {
        const history = await this.getBookingHistory(booking.id);
        const lastUpdate =
          history.length > 0
            ? new Date(history[history.length - 1].changedAt).getTime()
            : booking.createdAt
              ? new Date(booking.createdAt).getTime()
              : new Date().getTime();
        return { ...booking, lastUpdate };
      }),
    );

    bookingsWithLastUpdate.sort((a, b) => b.lastUpdate - a.lastUpdate);
    return bookingsWithLastUpdate;
  }

  async updateBookingStatus(
    id: number,
    status: "pending" | "completed" | "cancelled" | "confirmed",
    comment?: string,
  ): Promise<Booking> {
    const booking = await this.getBooking(id);
    if (!booking) throw new Error("Booking not found");
    // Map 'confirmed' to 'accepted' for internal consistency
    const internalStatus = status === "confirmed" ? "accepted" : status;
    // Ensure that createdAt is always a valid Date object before using new Date()
    let createdAt: Date;
    if (booking && booking.createdAt) {
      createdAt =
        booking.createdAt instanceof Date
          ? booking.createdAt
          : new Date(booking.createdAt as string | number);
    } else {
      createdAt = new Date();
    }

    return await this.updateBooking(id, {
      status: internalStatus,
      comments: comment || null,
    });
  }

  async getBookingsByService(
    serviceId: number,
    date: Date,
  ): Promise<Booking[]> {
    // Convert date to start and end of day in IST
    const istDate = toISTForStorage(date);
    const startDate = new Date(istDate ?? new Date());
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(istDate ?? new Date());
    endDate.setHours(23, 59, 59, 999);
    // Implementation for querying bookings by service and date
    return [];
  }

  async getProviderSchedule(
    providerId: number,
    date: Date,
  ): Promise<Booking[]> {
    // Convert date to start and end of day in IST
    const istDate = toISTForStorage(date);
    const startDate = new Date(istDate ?? new Date());
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(istDate ?? new Date());
    endDate.setHours(23, 59, 59, 999);
    // Implementation joining services and bookings tables
    return [];
  }

  async completeService(bookingId: number): Promise<Booking> {
    return await this.updateBookingStatus(
      bookingId,
      "completed",
      "Service completed successfully",
    );
  }

  async addBookingReview(
    bookingId: number,
    review: InsertReview,
  ): Promise<Review> {
    const booking = await this.getBooking(bookingId);
    if (!booking) throw new Error("Booking not found");
    return await this.createReview({
      ...review,
      bookingId,
      serviceId: booking.serviceId,
    });
  }

  async respondToReview(reviewId: number, response: string): Promise<Review> {
    const result = await db
      .update(reviews)
      .set({ providerReply: response })
      .where(eq(reviews.id, reviewId))
      .returning();
    if (!result[0]) throw new Error("Review not found");
    return result[0];
  }

  async createProductReview(
    review: InsertProductReview,
  ): Promise<ProductReview> {
    if (review.orderId && review.customerId && review.productId) {
      const existing = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.orderId, review.orderId),
            eq(productReviews.customerId, review.customerId),
            eq(productReviews.productId, review.productId),
          ),
        )
        .limit(1);
      if (existing[0]) throw new Error("Duplicate review");
    }
    const result = await db.insert(productReviews).values(review).returning();
    return result[0];
  }

  async getProductReviewsByProduct(
    productId: number,
  ): Promise<ProductReview[]> {
    return await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, productId));
  }

  async getProductReviewsByShop(shopId: number): Promise<ProductReview[]> {
    const productIds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.shopId, shopId));
    const ids = productIds.map((p) => p.id);
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(productReviews)
      .where(sql`${productReviews.productId} in ${ids}`);
  }

  async getProductReviewsByCustomer(
    customerId: number,
  ): Promise<(ProductReview & { productName: string | null })[]> {
    const results = await db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        customerId: productReviews.customerId,
        orderId: productReviews.orderId,
        rating: productReviews.rating,
        review: productReviews.review,
        images: productReviews.images,
        createdAt: productReviews.createdAt,
        shopReply: productReviews.shopReply,
        repliedAt: productReviews.repliedAt,
        isVerifiedPurchase: productReviews.isVerifiedPurchase,
        productName: products.name,
      })
      .from(productReviews)
      .leftJoin(products, eq(productReviews.productId, products.id))
      .where(eq(productReviews.customerId, customerId));

    return results.map((r) => ({
      ...r,
      productName: r.productName ?? null,
    }));
  }

  async getProductReviewById(id: number): Promise<ProductReview | undefined> {
    const result = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.id, id));
    return result[0];
  }

  async updateProductReview(
    id: number,
    data: { rating?: number; review?: string; shopReply?: string },
  ): Promise<ProductReview> {
    const updateData: Partial<ProductReview> = {};
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.review !== undefined) updateData.review = data.review;
    if (data.shopReply !== undefined) {
      updateData.shopReply = data.shopReply;
      updateData.repliedAt = new Date();
    }
    const result = await db
      .update(productReviews)
      .set(updateData)
      .where(eq(productReviews.id, id))
      .returning();
    if (!result[0]) throw new Error("Review not found");
    return result[0];
  }
  // Add new methods for blocked time slots
  async getBlockedTimeSlots(serviceId: number): Promise<BlockedTimeSlot[]> {
    // Query blocked time slots table (implementation required)
    return [];
  }

  async createBlockedTimeSlot(
    data: InsertBlockedTimeSlot,
  ): Promise<BlockedTimeSlot> {
    // Implementation would depend on your database structure
    // Convert date to IST
    const blockedSlot = {
      id: Math.floor(Math.random() * 10000), // In a real DB this would be auto-generated
      ...data,
      date: toISTForStorage(data.date),
    };
    // Insert blocked time slot into the table (implementation required)
    if (!blockedSlot.date) {
      throw new Error("Invalid date for blocked time slot");
    }
    // Type assertion is safe here because we check for null above
    return blockedSlot as BlockedTimeSlot;
  }

  async deleteBlockedTimeSlot(slotId: number): Promise<void> {
    // Delete blocked time slot (implementation required)
  }

  async getOverlappingBookings(
    serviceId: number,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<Booking[]> {
    // Query for overlapping bookings (implementation required)
    return [];
  }

  // ─── ENHANCED NOTIFICATION & ORDER TRACKING ───────────────────────
  async sendSMSNotification(phone: string, message: string): Promise<void> {
    logger.info(`SMS to ${phone}: ${message}`);
  }

  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    trackingInfo?: string,
  ): Promise<Order> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    // Update the order status with IST timestamp
    // Only include updatedAt if it exists in the Order type
    const updateData: any = {
      status,
      trackingInfo: trackingInfo || order.trackingInfo,
    };
    if ("updatedAt" in order) {
      updateData.updatedAt = getCurrentISTDate();
    }
    const updated = await this.updateOrder(orderId, updateData);
    await db.insert(orderStatusUpdates).values({
      orderId,
      status,
      trackingInfo: trackingInfo || order.trackingInfo,
      timestamp: getCurrentISTDate(),
    });
    return updated;
  }

  async getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]> {
    const updates = await db
      .select()
      .from(orderStatusUpdates)
      .where(eq(orderStatusUpdates.orderId, orderId))
      .orderBy(orderStatusUpdates.timestamp);
    return updates.map((u) => ({
      orderId: u.orderId!,
      status: u.status as OrderStatus,
      trackingInfo: u.trackingInfo ?? undefined,
      timestamp: fromDatabaseToIST(u.timestamp as Date) as Date,
    }));
  }

  async updateProviderProfile(
    id: number,
    profile: Partial<User>,
  ): Promise<User> {
    // Remove any null address fields to satisfy the type requirements
    const cleanedProfile = { ...profile };
    if (
      "addressStreet" in cleanedProfile &&
      cleanedProfile.addressStreet === null
    )
      delete cleanedProfile.addressStreet;
    if ("addressCity" in cleanedProfile && cleanedProfile.addressCity === null)
      delete cleanedProfile.addressCity;
    if (
      "addressState" in cleanedProfile &&
      cleanedProfile.addressState === null
    )
      delete cleanedProfile.addressState;
    if (
      "addressPostalCode" in cleanedProfile &&
      cleanedProfile.addressPostalCode === null
    )
      delete cleanedProfile.addressPostalCode;
    if (
      "addressCountry" in cleanedProfile &&
      cleanedProfile.addressCountry === null
    )
      delete cleanedProfile.addressCountry;
    return await this.updateUser(id, cleanedProfile);
  }

  async updateProviderAvailability(
    providerId: number,
    availability: {
      days: string[];
      hours: { start: string; end: string };
      breaks: { start: string; end: string }[];
    },
  ): Promise<void> {
    logger.info(`Updated availability for provider ${providerId}`);
  }

  async getProviderAvailability(providerId: number): Promise<{
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  } | null> {
    return null;
  }

  // STUB implementations to satisfy IStorage interface missing methods
  async getWaitlistPosition(
    customerId: number,
    serviceId: number,
  ): Promise<number> {
    const entries = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.serviceId, serviceId))
      .orderBy(waitlist.id);
    const index = entries.findIndex((e) => e.customerId === customerId);
    return index === -1 ? -1 : index + 1;
  }

  async createReturnRequest(
    returnRequest: InsertReturnRequest,
  ): Promise<ReturnRequest> {
    const result = await db
      .insert(returns)
      .values({
        ...returnRequest,
        status: returnRequest.status as
          | "requested"
          | "approved"
          | "rejected"
          | "received"
          | "refunded"
          | "completed",
        refundStatus: returnRequest.refundStatus as
          | "pending"
          | "processed"
          | "failed"
          | null
          | undefined,
      })
      .returning();
    const created = result[0];
    if (created?.orderId != null) {
      const order = await this.getOrder(created.orderId);
      if (order) {
        notifyOrderChange({
          customerId: order.customerId ?? null,
          shopId: order.shopId ?? null,
          orderId: order.id,
        });
      }
    }
    return created;
  }

  async getReturnRequest(id: number): Promise<ReturnRequest | undefined> {
    const res = await db.select().from(returns).where(eq(returns.id, id));
    return res[0];
  }

  async getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]> {
    return await db.select().from(returns).where(eq(returns.orderId, orderId));
  }

  async updateReturnRequest(
    id: number,
    update: Partial<ReturnRequest>,
  ): Promise<ReturnRequest> {
    const result = await db
      .update(returns)
      .set(update)
      .where(eq(returns.id, id))
      .returning();
    if (!result[0]) throw new Error("Return request not found");
    const updated = result[0];
    if (updated.orderId != null) {
      const order = await this.getOrder(updated.orderId);
      if (order) {
        notifyOrderChange({
          customerId: order.customerId ?? null,
          shopId: order.shopId ?? null,
          orderId: order.id,
        });
      }
    }
    return updated;
  }

  async deleteReturnRequest(id: number): Promise<void> {
    const existing = await this.getReturnRequest(id);
    await db.delete(returns).where(eq(returns.id, id));
    if (existing?.orderId != null) {
      const order = await this.getOrder(existing.orderId);
      if (order) {
        notifyOrderChange({
          customerId: order.customerId ?? null,
          shopId: order.shopId ?? null,
          orderId: order.id,
        });
      }
    }
  }
}
