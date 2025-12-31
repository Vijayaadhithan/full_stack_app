import session from "express-session";
import pgSession from "connect-pg-simple";
import { db } from "./db";
import logger from "./logger";
import { getCache, setCache, invalidateCache } from "./services/cache.service";
import { createSessionStore } from "./services/sessionStore.service";
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
  TimeSlotLabel,
  shops,
  Shop,
} from "@shared/schema";
import {
  IStorage,
  OrderStatus,
  OrderStatusUpdate,
  ProductListItem,
  OrderItemInput,
  GlobalSearchParams,
  GlobalSearchResult,
  BookingWithRelations,
  OrderWithRelations,
  BookingCreateOptions,
  BookingUpdateOptions,
} from "./storage";
import {
  eq,
  and,
  lt,
  ne,
  sql,
  desc,
  asc,
  count,
  inArray,
  gte,
  isNotNull,

  type SQL,
} from "drizzle-orm";
import {
  toUTCForStorage,
  getCurrentISTDate,
  getExpirationDate,
  getISTDayBoundsUtc,
} from "./ist-utils";
import {
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
} from "./utils/identity";
import {
  normalizeCoordinate,
  DEFAULT_NEARBY_RADIUS_KM,
} from "./utils/geo";
// Import date utilities for storage/display handling

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
const PRODUCT_CACHE_TTL_SECONDS = 60; // 60 seconds cache to balance freshness and throughput

const DEFAULT_SHOP_MODES = {
  catalogModeEnabled: false,
  openOrderMode: false,
  allowPayLater: false,
};

function resolveShopModes(
  profile: ShopProfile | null | undefined,
): typeof DEFAULT_SHOP_MODES {
  const catalogModeEnabled = Boolean(profile?.catalogModeEnabled);
  const openOrderMode =
    profile?.openOrderMode !== undefined
      ? Boolean(profile.openOrderMode)
      : catalogModeEnabled;
  const allowPayLater = Boolean(profile?.allowPayLater);
  return {
    catalogModeEnabled,
    openOrderMode,
    allowPayLater,
  };
}

async function loadShopModes(
  shopId: number | null | undefined,
): Promise<typeof DEFAULT_SHOP_MODES> {
  if (typeof shopId !== "number") {
    return DEFAULT_SHOP_MODES;
  }
  const rows = await db.primary
    .select({ profile: users.shopProfile })
    .from(users)
    .where(eq(users.id, shopId))
    .limit(1);
  const profile = (rows[0]?.profile as ShopProfile | null | undefined) ?? null;
  return resolveShopModes(profile);
}

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
  if (filters.lat !== undefined && filters.lng !== undefined) {
    const lat = Number(filters.lat);
    const lng = Number(filters.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      normalized.lat = lat;
      normalized.lng = lng;
      if (filters.radiusKm !== undefined) {
        const radius = Number(filters.radiusKm);
        if (Number.isFinite(radius)) {
          normalized.radiusKm = radius;
        }
      }
    }
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

const EARTH_RADIUS_KM = 6371;

function buildHaversineCondition({
  columnLat,
  columnLng,
  lat,
  lng,
  radiusKm,
}: {
  columnLat: SQL | unknown;
  columnLng: SQL | unknown;
  lat: number;
  lng: number;
  radiusKm: number;
}) {
  const latRad = sql`radians(${lat})`;
  const lngRad = sql`radians(${lng})`;
  const rowLat = sql`radians(${columnLat}::float8)`;
  const rowLng = sql`radians(${columnLng}::float8)`;
  const distanceExpr = sql`
    ${EARTH_RADIUS_KM} * 2 * asin(
      sqrt(
        power(sin((${rowLat} - ${latRad}) / 2), 2) +
        cos(${latRad}) * cos(${rowLat}) *
        power(sin((${rowLng} - ${lngRad}) / 2), 2)
      )
    )
  `;
  const condition = sql`(
    ${columnLat} IS NOT NULL
    AND ${columnLng} IS NOT NULL
    AND ${distanceExpr} <= ${radiusKm}
  )`;
  return { condition, distanceExpr };
}

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PgStore = pgSession(session);
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL must be configured to use the PostgreSQL storage backend.",
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

    const fallbackFactory = () => {
      const pgStore = new PgStore(storeOptions);
      logger.info(
        {
          tableName,
          schemaName: schemaName ?? "public",
          pruneSessionInterval: storeOptions.pruneSessionInterval,
          ttlSeconds: storeOptions.ttl ?? null,
        },
        "Initialized PostgreSQL session store",
      );
      return pgStore;
    };

    this.sessionStore = createSessionStore({ fallbackFactory });
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = normalizeEmail(email);
    if (!normalized) return undefined;
    const result = await db.primary.select().from(users).where(eq(users.email, normalized));
    return result[0];
  }

  // Note: getUserByGoogleId removed - no longer using Google OAuth

  async deleteUserAndData(userId: number): Promise<void> {
    await db.primary.transaction(async (tx) => {
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
  // const result = await db.primary.select().from(reviews).where(eq(reviews.customerId, customerId));
  // return result;
  //}

  async updateReview(
    id: number,
    data: { rating?: number; review?: string; providerReply?: string },
  ): Promise<Review> {
    const updatedReview = await db.primary
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
    const requestResult = await db.primary
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
    const updatedResult = await db.primary
      .update(returns) // Use returns table
      .set({
        status: "refunded",
        resolvedAt: new Date(),
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
    const result = await db.primary
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

    const conditions: SQL[] = [eq(products.isDeleted, false)];
    const orderByClauses: SQL[] = [];
    // PERFORMANCE FIX: Use replica for read-heavy product queries
    let query: any = db.replica.select().from(products);
    let joinedUsers = false;

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
          const tsQuery = sql`plainto_tsquery('english', ${normalizedTerm})`;
          const searchVector = sql`${products.searchVector}`;
          conditions.push(sql`${searchVector} @@ ${tsQuery}`);
          orderByClauses.push(sql`ts_rank(${searchVector}, ${tsQuery}) DESC`);
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

      if (criteria.lat !== undefined && criteria.lng !== undefined) {
        if (!joinedUsers) {
          query = query.leftJoin(users, eq(products.shopId, users.id));
          joinedUsers = true;
        }
        const lat = Number(criteria.lat);
        const lng = Number(criteria.lng);
        const radiusKm = Number(criteria.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM);
        const { condition, distanceExpr } = buildHaversineCondition({
          columnLat: users.latitude,
          columnLng: users.longitude,
          lat,
          lng,
          radiusKm,
        });
        conditions.push(condition);
        orderByClauses.push(distanceExpr);
      }
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    if (orderByClauses.length > 0) {
      query = query.orderBy(...orderByClauses);
    }

    query = query.limit(limit).offset(offset);

    const results = await query;
    const normalizedResults = joinedUsers
      ? (results as any[]).map((r) => r.products as Product)
      : (results as Product[]);

    const hasMore = normalizedResults.length > pageSize;
    const trimmed = normalizedResults.slice(0, pageSize);

    const shopIds = Array.from(
      new Set(
        trimmed
          .map((product) => product.shopId)
          .filter((id): id is number => typeof id === "number"),
      ),
    );
    const shopModes = new Map<number, typeof DEFAULT_SHOP_MODES>();
    if (shopIds.length) {
      const shops = await db.primary
        .select({
          id: users.id,
          profile: users.shopProfile,
        })
        .from(users)
        .where(inArray(users.id, shopIds));
      for (const shop of shops) {
        shopModes.set(
          shop.id,
          resolveShopModes(shop.profile as ShopProfile | null | undefined),
        );
      }
    }

    const items: ProductListItem[] = trimmed.map((product) => {
      const modes =
        (product.shopId && shopModes.get(product.shopId)) || DEFAULT_SHOP_MODES;
      return {
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
        catalogModeEnabled: modes.catalogModeEnabled,
        openOrderMode: modes.openOrderMode,
        allowPayLater: modes.allowPayLater,
      };
    });

    const payload = { items, hasMore };
    await setCache(cacheKey, payload, PRODUCT_CACHE_TTL_SECONDS);
    return payload;
  }

  async getPromotionsByShop(shopId: number): Promise<Promotion[]> {
    return await db.primary
      .select()
      .from(promotions)
      .where(eq(promotions.shopId, shopId));
  }

  // ─── USER OPERATIONS ─────────────────────────────────────────────
  async getUser(id: number): Promise<User | undefined> {
    // PERFORMANCE FIX: Use replica for read operations
    const result = await db.replica.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const normalized = normalizeUsername(username);
    if (!normalized) return undefined;
    const result = await db.primary
      .select()
      .from(users)
      .where(eq(users.username, normalized));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    const result = await db.primary
      .select()
      .from(users)
      .where(eq(users.phone, normalized));
    return result[0];
  }

  async getAllUsers(options?: { limit?: number; offset?: number }): Promise<User[]> {
    // PERFORMANCE FIX: Add pagination to prevent memory issues with large user counts
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;
    return await db.primary
      .select()
      .from(users)
      .limit(limit)
      .offset(offset);
  }

  async getShops(filters?: {
    locationCity?: string;
    locationState?: string;
    excludeOwnerId?: number;
  }): Promise<User[]> {
    // Build cache key from filters
    const filterParts: string[] = [];
    if (filters?.locationCity) filterParts.push(`city:${filters.locationCity.toLowerCase()}`);
    if (filters?.locationState) filterParts.push(`state:${filters.locationState.toLowerCase()}`);
    if (filters?.excludeOwnerId) filterParts.push(`excl:${filters.excludeOwnerId}`);
    const cacheKey = `shops:list:${filterParts.join(':')}`;

    const cached = await getCache<User[]>(cacheKey);
    if (cached) return cached;

    // Query shops table and join with users to get owner info
    const shopRecords = await db.primary
      .select()
      .from(shops)
      .leftJoin(users, eq(shops.ownerId, users.id));

    // Filter and transform to User-like objects for backward compatibility
    const results: User[] = [];

    for (const record of shopRecords) {
      const shop = record.shops;
      const owner = record.users;

      if (!owner) continue;

      // Apply filters
      if (filters?.excludeOwnerId !== undefined && shop.ownerId === filters.excludeOwnerId) {
        continue;
      }
      if (filters?.locationCity && shop.shopAddressCity?.toLowerCase() !== filters.locationCity.toLowerCase()) {
        continue;
      }
      if (filters?.locationState && shop.shopAddressState?.toLowerCase() !== filters.locationState.toLowerCase()) {
        continue;
      }

      // Build a User-like object with shop profile data
      results.push({
        ...owner,
        role: "shop" as const, // Treat as shop role for frontend compatibility
        shopProfile: {
          shopName: shop.shopName,
          description: shop.description || "",
          businessType: shop.businessType || "",
          gstin: shop.gstin,
          shopAddressStreet: shop.shopAddressStreet || undefined,
          shopAddressArea: shop.shopAddressArea || undefined,
          shopAddressCity: shop.shopAddressCity || undefined,
          shopAddressState: shop.shopAddressState || undefined,
          shopAddressPincode: shop.shopAddressPincode || undefined,
          shopLocationLat: shop.shopLocationLat ? Number(shop.shopLocationLat) : undefined,
          shopLocationLng: shop.shopLocationLng ? Number(shop.shopLocationLng) : undefined,
          workingHours: shop.workingHours || { from: "09:00", to: "18:00", days: [] },
          shippingPolicy: shop.shippingPolicy || undefined,
          returnPolicy: shop.returnPolicy || undefined,
          catalogModeEnabled: shop.catalogModeEnabled ?? false,
          openOrderMode: shop.openOrderMode ?? false,
          allowPayLater: shop.allowPayLater ?? false,
          payLaterWhitelist: shop.payLaterWhitelist || [],
        },
        // Use shop address coordinates if available, else fall back to user
        latitude: shop.shopLocationLat || owner.latitude,
        longitude: shop.shopLocationLng || owner.longitude,
        addressStreet: shop.shopAddressStreet || owner.addressStreet,
        addressCity: shop.shopAddressCity || owner.addressCity,
        addressState: shop.shopAddressState || owner.addressState,
        addressPostalCode: shop.shopAddressPincode || owner.addressPostalCode,
      });
    }

    await setCache(cacheKey, results, 120); // 2 minutes cache for shop listings
    return results;
  }

  async getShopById(shopId: number): Promise<Shop | undefined> {
    const result = await db.primary.select().from(shops).where(eq(shops.id, shopId));
    return result[0];
  }

  async getShopByOwnerId(ownerId: number): Promise<Shop | undefined> {
    const result = await db.primary.select().from(shops).where(eq(shops.ownerId, ownerId));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const normalizedUsername = normalizeUsername(user.username);
    const normalizedEmail = user.email ? normalizeEmail(user.email) : null;
    const normalizedPhone = normalizePhone(user.phone);

    // Username is required
    if (!normalizedUsername) {
      throw new Error("Invalid username");
    }
    // Email is optional for rural users (phone + PIN only)
    // Only validate if email is provided
    if (user.email && !normalizedEmail) {
      throw new Error("Invalid email format");
    }

    const insertData = {
      username: normalizedUsername,
      password: user.password,
      pin: user.pin, // Add PIN support for rural auth
      role: user.role as UserRole,
      name: user.name,
      phone: normalizedPhone ?? "",
      email: normalizedEmail, // Can be null for rural users
      isPhoneVerified: user.isPhoneVerified ?? false, // Add phone verification status
      addressStreet: user.addressStreet,
      addressLandmark: user.addressLandmark,
      addressCity: user.addressCity,
      addressState: user.addressState,
      addressPostalCode: user.addressPostalCode,
      addressCountry: user.addressCountry,
      latitude: normalizeCoordinate(user.latitude),
      longitude: normalizeCoordinate(user.longitude),
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

    const result = await db.primary
      .insert(users)
      .values(insertData as any)
      .returning();
    return result[0];
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      throw new Error("User not found");
    }
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

    if (updateData.latitude !== undefined) {
      normalizedUpdate.latitude = normalizeCoordinate(updateData.latitude);
    }

    if (updateData.longitude !== undefined) {
      normalizedUpdate.longitude = normalizeCoordinate(updateData.longitude);
    }

    if (updateData.shopProfile !== undefined) {
      normalizedUpdate.shopProfile = {
        ...(existingUser.shopProfile ?? {}),
        ...updateData.shopProfile,
      } as any;
    }

    // Calculate profile completeness if relevant fields are updated
    let profileCompleteness = normalizedUpdate.profileCompleteness;
    if (profileCompleteness === undefined) {
      if (existingUser) {
        const combinedData = { ...existingUser, ...normalizedUpdate };
        let completedFields = 0;
        let totalProfileFields = 0;
        // Diagnostic logging to inspect calculation inputs
        logger.info("[updateUser] Combined data for user", id, combinedData);
        if (existingUser.role === "customer") {
          // For customer: name, phone, and address/landmark
          // Email is optional for rural-first auth users
          totalProfileFields = 3;
          if (combinedData.name) completedFields++;
          if (combinedData.phone) completedFields++;
          // Address completeness: either full address fields OR addressLandmark is sufficient
          const hasFullAddress = combinedData.addressStreet &&
            combinedData.addressCity &&
            combinedData.addressState &&
            combinedData.addressPostalCode &&
            combinedData.addressCountry;
          const hasLandmark = combinedData.addressLandmark && combinedData.addressLandmark.trim().length > 0;
          if (hasFullAddress || hasLandmark) completedFields++;
        } else if (existingUser.role === "provider") {
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
        } else if (existingUser.role === "shop") {
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
      if (
        profileCompleteness === 100 &&
        (existingUser.verificationStatus === "unverified" ||
          existingUser.verificationStatus === "pending")
      ) {
        dataToSet.verificationStatus = "verified";
      }
    }

    const result = await db.primary
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
    const result = await db.primary
      .insert(services)
      .values(service as any)
      .returning();
    return result[0];
  }

  async getService(id: number): Promise<Service | undefined> {
    logger.info("Getting service with ID:", id);
    const result = await db.primary.select().from(services).where(eq(services.id, id));
    logger.info("Found service:", result[0]);
    return result[0];
  }
  async getServicesByIds(ids: number[]): Promise<Service[]> {
    if (ids.length === 0) return [];
    return await db.primary
      .select()
      .from(services)
      .where(sql`${services.id} IN ${ids}`);
  }

  async getUsersByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return await db.primary
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

    const rows = await db.primary
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
    return await db.primary
      .select()
      .from(bookings)
      .where(eq(bookings.customerId, customerId));
  }


  async getBookingsWithRelations(ids: number[]): Promise<BookingWithRelations[]> {
    if (ids.length === 0) return [];

    return await db.primary.query.bookings.findMany({
      where: inArray(bookings.id, ids),
      with: {
        service: {
          with: {
            provider: true,
          },
        },
        customer: true,
      },
    }) as unknown as BookingWithRelations[];
  }

  async getOrdersWithRelations(ids: number[]): Promise<OrderWithRelations[]> {
    if (ids.length === 0) return [];

    return await db.primary.query.orders.findMany({
      where: inArray(orders.id, ids),
      with: {
        items: {
          with: {
            product: true,
          },
        },
        shop: true,
        customer: true,
      },
      orderBy: desc(orders.orderDate),
    }) as unknown as OrderWithRelations[];
  }

  // Implementation of IStorage.getBookingHistoryForCustomer

  // ─── REVIEW OPERATIONS ───────────────────────────────────────────
  async createReview(review: InsertReview): Promise<Review> {
    if (review.bookingId && review.customerId) {
      const existing = await db.primary
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
    const result = await db.primary.insert(reviews).values(review).returning();

    // Invalidate caches
    if (review.serviceId) {
      await invalidateCache(`reviews:service:${review.serviceId}`);
      try {
        const service = await this.getService(review.serviceId);
        if (service?.providerId) {
          await invalidateCache(`reviews:provider:${service.providerId}`);
        }
      } catch (err) {
        logger.warn({ err }, "Failed to invalidate provider review cache");
      }
    }

    return result[0];
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    const cacheKey = `reviews:service:${serviceId}`;
    const cached = await getCache<Review[]>(cacheKey);
    if (cached) return cached;

    const results = await db.primary
      .select()
      .from(reviews)
      .where(eq(reviews.serviceId, serviceId));

    await setCache(cacheKey, results, 300); // 5 minutes cache
    return results;
  }

  async getReviewsByServiceIds(serviceIds: number[]): Promise<Review[]> {
    if (serviceIds.length === 0) {
      return [];
    }
    const uniqueIds = Array.from(new Set(serviceIds));
    return await db.primary
      .select()
      .from(reviews)
      .where(inArray(reviews.serviceId, uniqueIds));
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    // Optimized: Single JOIN query instead of two separate queries
    const rows = await db.primary
      .select({
        id: reviews.id,
        customerId: reviews.customerId,
        serviceId: reviews.serviceId,
        bookingId: reviews.bookingId,
        rating: reviews.rating,
        review: reviews.review,
        providerReply: reviews.providerReply,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(services, eq(reviews.serviceId, services.id))
      .where(eq(services.providerId, providerId));

    return rows as Review[];
  }

  async getReviewsByCustomer(
    customerId: number,
  ): Promise<(Review & { serviceName: string | null })[]> {
    const results = await db.primary
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
    const result = await db.primary.select().from(reviews).where(eq(reviews.id, id));
    return result[0];
  }

  async updateCustomerReview(
    reviewId: number,
    customerId: number,
    data: { rating?: number; review?: string },
  ): Promise<Review> {
    // First, verify the review belongs to the customer
    const reviewCheck = await db.primary
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
    const result = await db.primary
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
    const providerServices = await db.primary
      .select({ id: services.id })
      .from(services)
      .where(eq(services.providerId, providerId));
    const serviceIds = providerServices.map((s) => s.id);
    if (serviceIds.length === 0) {
      await db.primary.execute(
        sql`UPDATE users SET average_rating = NULL WHERE id = ${providerId}`,
      );
      return;
    }
    const ratings = await db.primary
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(sql`${reviews.serviceId} IN ${serviceIds}`);
    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    const average = ratings.length > 0 ? total / ratings.length : null;
    await db.primary.execute(
      sql`UPDATE users SET average_rating = ${average}, total_reviews = ${ratings.length} WHERE id = ${providerId}`,
    );
  }

  // ─── NOTIFICATION OPERATIONS ─────────────────────────────────────
  async getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
    return await db.primary
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
    return await db.primary
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

    const result = await db.primary
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
    const result = await db.primary
      .update(services)
      .set(serviceUpdate as any) // Pass the update data directly
      .where(eq(services.id, id))
      .returning();
    if (!result[0]) throw new Error("Service not found");
    return result[0];
  }

  async deleteService(id: number): Promise<void> {
    // Instead of deleting, mark as deleted (soft delete)
    const result = await db.primary
      .update(services)
      .set({ isDeleted: true })
      .where(eq(services.id, id))
      .returning();
    if (!result[0]) throw new Error("Service not found");
  }

  async getServices(filters?: any): Promise<Service[]> {
    // Build an array of conditions starting with the non-deleted check
    const conditions = [eq(services.isDeleted, false)];

    if (filters?.excludeProviderId !== undefined) {
      conditions.push(ne(services.providerId, filters.excludeProviderId));
    }
    let query: any = db.primary.select().from(services);
    let joinedProviders = false;
    const escapeLikePattern = (value: string) =>
      value.replace(/[%_]/g, (char) => `\\${char}`);
    const ensureProviderJoin = () => {
      if (joinedProviders) return;
      query = query.leftJoin(users, eq(services.providerId, users.id));
      joinedProviders = true;
    };

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
        ensureProviderJoin();
        conditions.push(eq(users.addressCity, filters.locationCity));
      }
      if (filters.locationState) {
        ensureProviderJoin();
        conditions.push(eq(users.addressState, filters.locationState));
      }
      if (filters.locationPostalCode) {
        ensureProviderJoin();
        conditions.push(
          eq(users.addressPostalCode, filters.locationPostalCode),
        );
      }
      // Note: availabilityDate filtering would be more complex and might require checking bookings or a serviceAvailability table.
      if (filters.availabilityDate) {
        conditions.push(eq(services.isAvailable, true));
      }
      if (filters.availableNow !== undefined) {
        const desired = Boolean(filters.availableNow);
        conditions.push(eq(services.isAvailableNow, desired));
        if (desired) {
          conditions.push(sql`${services.isAvailable} IS NOT FALSE`);
        }
      }
      if (filters.lat !== undefined && filters.lng !== undefined) {
        if (!joinedProviders) {
          query = query.leftJoin(users, eq(services.providerId, users.id));
          joinedProviders = true;
        }
        const lat = Number(filters.lat);
        const lng = Number(filters.lng);
        const radiusKm = Number(filters.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM);
        const { condition, distanceExpr } = buildHaversineCondition({
          columnLat: users.latitude,
          columnLng: users.longitude,
          lat,
          lng,
          radiusKm,
        });
        conditions.push(condition);
        query = query.orderBy(distanceExpr);
      }
    }
    // Exclude providers with many unresolved payments
    const exclusion = sql`SELECT s.provider_id FROM ${bookings} b JOIN ${services} s ON b.service_id = s.id WHERE b.status = 'awaiting_payment' GROUP BY s.provider_id HAVING COUNT(*) > 5`;

    conditions.push(sql`${services.providerId} NOT IN (${exclusion})`);
    query = query.where(and(...conditions));
    const rows = await query;
    return joinedProviders
      ? (rows as Array<{ services: Service }>).map((row) => row.services)
      : (rows as Service[]);
  }

  // ─── BOOKING OPERATIONS ──────────────────────────────────────────
  async createBooking(
    booking: InsertBooking,
    options?: BookingCreateOptions,
  ): Promise<Booking> {
    // Set default values for new bookings in UTC
    const bookingWithDefaults = {
      ...booking,
      createdAt: new Date(),
      // Set expiresAt to 24 hours from now in UTC if needed
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
    const notification = options?.notification ?? null;
    const createdBooking = await db.primary.transaction(async (tx) => {
      const result = await tx
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

      const inserted = result[0];
      if (!inserted) {
        throw new Error("Failed to create booking");
      }

      // Add entry to booking history with UTC timestamp
      await tx.insert(bookingHistory).values({
        bookingId: inserted.id,
        status: inserted.status,
        changedAt: new Date(),
        changedBy: booking.customerId,
        comments: "Booking created",
      });

      if (notification) {
        await tx.insert(notifications).values({
          ...notification,
          type: notification.type as any,
          relatedBookingId: notification.relatedBookingId ?? null,
        });
      }

      return inserted;
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

    if (notification) {
      notifyNotificationChange(notification.userId ?? null);
    }

    return createdBooking;
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const result = await db.primary.select().from(bookings).where(eq(bookings.id, id));
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

    return await db.primary
      .select()
      .from(bookings)
      .where(whereClause)
      .orderBy(desc(bookings.bookingDate));
  }

  async getBookingsByProvider(
    providerId: number,
    options?: { page: number; limit: number },
  ): Promise<{ data: Booking[]; total: number; totalPages: number }> {
    // Get all services offered by this provider first
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map((service) => service.id);

    if (serviceIds.length === 0) {
      return { data: [], total: 0, totalPages: 0 };
    }

    const { page = 1, limit = 20 } = options ?? {};
    const offset = (page - 1) * limit;

    // Get total count
    const totalResult = await db.primary
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(inArray(bookings.serviceId, serviceIds));
    const total = Number(totalResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Get paginated data
    const data = await db.primary
      .select()
      .from(bookings)
      .where(inArray(bookings.serviceId, serviceIds))
      .orderBy(desc(bookings.bookingDate))
      .limit(limit)
      .offset(offset);

    return { data, total, totalPages };
  }

  async getBookingsByStatus(status: string): Promise<Booking[]> {
    return await db.primary
      .select()
      .from(bookings)
      .where(eq(bookings.status, status as any));
  }

  async updateBooking(
    id: number,
    booking: Partial<Booking>,
    options?: BookingUpdateOptions,
  ): Promise<Booking> {
    const notification = options?.notification ?? null;
    const { updatedBooking, currentBooking, didUpdate } =
      await db.primary.transaction(async (tx) => {
        const rows = await tx.select().from(bookings).where(eq(bookings.id, id));
        const currentBooking = rows[0];
        if (!currentBooking) throw new Error("Booking not found");

        // Construct the update object, only including defined fields
        const updateData: Partial<Booking> = {}; // Removed updatedAt from default updates
        for (const key in booking) {
          if (booking[key as keyof Booking] !== undefined) {
            (updateData as any)[key] = booking[key as keyof Booking];
          }
        }

        // If no actual fields to update (other than updatedAt), return current booking
        if (Object.keys(updateData).length === 1 && (updateData as any).updatedAt) {
          // Optionally, you might still want to update 'updatedAt' or decide if this scenario is an error
          // For now, let's assume if only updatedAt is there, no meaningful update was intended beyond timestamp.
          // To be safe, and if Drizzle handles empty .set() gracefully or errors, this could be db.primary.update().set({updatedAt: updateData.updatedAt})
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
          return { updatedBooking: currentBooking, currentBooking, didUpdate: false };
        }

        const result = await tx
          .update(bookings)
          .set(updateData) // Use the filtered updateData
          .where(eq(bookings.id, id))
          .returning();

        const updatedBooking = result[0];
        if (!updatedBooking) throw new Error("Booking not found or update failed");

        // If the status changed, add an entry in the booking history table with UTC timestamp
        // Ensure booking.status is checked against undefined before using it
        if (
          booking.status !== undefined &&
          booking.status !== currentBooking.status
        ) {
          await tx.insert(bookingHistory).values({
            bookingId: id,
            status: booking.status, // Safe to use booking.status here due to the check
            changedAt: new Date(),
            // Use booking.comments if defined, otherwise generate a default message
            comments:
              booking.comments !== undefined
                ? booking.comments
                : `Status changed from ${currentBooking.status} to ${booking.status}`,
          });
          // If status is no longer pending, clear the expiration date
          if (booking.status !== "pending") {
            await tx
              .update(bookings)
              .set({ expiresAt: null })
              .where(eq(bookings.id, id));
          }
        }

        if (notification) {
          await tx.insert(notifications).values({
            ...notification,
            type: notification.type as any,
            relatedBookingId: notification.relatedBookingId ?? null,
          });
        }

        return { updatedBooking, currentBooking, didUpdate: true };
      });

    const serviceId = booking.serviceId ?? currentBooking.serviceId;
    let providerId: number | null = null;
    if (serviceId) {
      const service = await this.getService(serviceId);
      providerId = service?.providerId ?? null;
    }

    if (didUpdate) {
      notifyBookingChange({
        customerId: currentBooking.customerId ?? null,
        providerId,
      });
      if (notification) {
        notifyNotificationChange(notification.userId ?? null);
      }
    }

    return updatedBooking;
  }

  // ─── PRODUCT OPERATIONS ──────────────────────────────────────────
  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.primary
      .insert(products)
      .values(product as typeof products.$inferInsert)
      .returning();
    return result[0];
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.primary.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductsByShop(shopId: number): Promise<Product[]> {
    return await db.primary
      .select()
      .from(products)
      .where(and(eq(products.shopId, shopId), eq(products.isDeleted, false)));
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    const key = `products_category_${category}`;
    const cached = await getCache<Product[]>(key);
    if (cached) return cached;

    const result = await db.primary
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
    return await db.primary
      .select()
      .from(products)
      .where(
        and(inArray(products.id, uniqueIds), eq(products.isDeleted, false)),
      );
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const result = await db.primary
      .update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    if (!result[0]) throw new Error("Product not found");
    return result[0];
  }

  async getLowStockProducts(options?: {
    shopId?: number;
    threshold?: number;
    limit?: number;
  }): Promise<Product[]> {
    const { shopId, threshold, limit } = options ?? {};
    const fallbackThreshold = 5;
    const conditions: SQL<unknown>[] = [eq(products.isDeleted, false)];

    if (shopId !== undefined) {
      conditions.push(eq(products.shopId, shopId));
    }

    if (threshold !== undefined) {
      conditions.push(sql`${products.stock} <= ${threshold}`);
    } else {
      conditions.push(
        sql`${products.stock} <= COALESCE(${products.lowStockThreshold}, ${fallbackThreshold})`,
      );
    }

    const query = db.primary
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(products.stock);

    if (typeof limit === "number") {
      query.limit(limit);
    }

    return query;
  }

  async bulkUpdateProductStock(
    updates: {
      productId: number;
      stock: number;
      lowStockThreshold?: number | null;
    }[],
  ): Promise<Product[]> {
    if (updates.length === 0) return [];

    // PERFORMANCE FIX: Process updates in parallel batches instead of sequential N+1 queries
    const BATCH_SIZE = 50;
    const updated: Product[] = [];

    await db.primary.transaction(async (tx) => {
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);

        // Execute batch updates in parallel
        const batchResults = await Promise.all(
          batch.map(update =>
            tx
              .update(products)
              .set({
                stock: update.stock,
                lowStockThreshold:
                  update.lowStockThreshold !== undefined
                    ? update.lowStockThreshold
                    : undefined,
                updatedAt: new Date(),
              })
              .where(and(eq(products.id, update.productId), eq(products.isDeleted, false)))
              .returning()
          )
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          if (!result || !result[0]) {
            throw new Error(`Product not found: ${batch[j].productId}`);
          }
          updated.push(result[0]);
        }
      }
    });

    return updated;
  }

  async removeProductFromAllCarts(productId: number): Promise<void> {
    logger.info(`Removing product ID ${productId} from all carts`);
    try {
      const affectedCustomers = await db.primary
        .select({ customerId: cart.customerId })
        .from(cart)
        .where(eq(cart.productId, productId));
      await db.primary.delete(cart).where(eq(cart.productId, productId));
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
      const affectedCustomers = await db.primary
        .select({ customerId: wishlist.customerId })
        .from(wishlist)
        .where(eq(wishlist.productId, productId));
      await db.primary.delete(wishlist).where(eq(wishlist.productId, productId));
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
    const productExists = await db.primary
      .select()
      .from(products)
      .where(eq(products.id, id));
    if (productExists.length === 0) throw new Error("Product not found");

    try {
      await this.removeProductFromAllCarts(id);
      await this.removeProductFromAllWishlists(id);

      // Use soft deletion instead of hard deletion
      const result = await db.primary
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
      const productToAddResult = await db.primary
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
      const currentCartItems = await db.primary
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
        const firstProductResult = await db.primary
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
      const productDetails = await db.primary
        .select({ stock: products.stock })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (productDetails.length === 0) {
        logger.error(`Product ID ${productId} not found for stock validation.`);
        throw new Error("Product not found when trying to add to cart.");
      }
      const availableStock = productDetails[0].stock ?? 0;
      const shopModes = await loadShopModes(shopIdToAdd);
      const enforceStock = !(shopModes.catalogModeEnabled || shopModes.openOrderMode);

      if (enforceStock && quantity > availableStock) {
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
        await db.primary
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

      const existingCartItem = await db.primary
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
        await db.primary
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
        await db.primary.insert(cart).values({ customerId, productId, quantity });
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
    await db.primary
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
      const cartItems = await db.primary
        .select()
        .from(cart)
        .where(eq(cart.customerId, customerId));
      logger.info(
        `Found ${cartItems.length} cart items for customer ID: ${customerId}`,
      );

      if (cartItems.length === 0) {
        return [];
      }

      const productIds = Array.from(
        new Set(
          cartItems
            .map((item) => item.productId)
            .filter((id): id is number => typeof id === "number"),
        ),
      );

      const productsList =
        productIds.length > 0
          ? await db.primary
            .select()
            .from(products)
            .where(inArray(products.id, productIds))
          : [];
      const productMap = new Map(productsList.map((product) => [product.id, product]));

      const missingProductIds: number[] = [];
      const result: { product: Product; quantity: number }[] = [];

      for (const item of cartItems) {
        const productId = item.productId;
        if (typeof productId !== "number") {
          continue;
        }
        const product = productMap.get(productId);
        if (!product || product.isDeleted) {
          missingProductIds.push(productId);
          continue;
        }
        result.push({ product, quantity: item.quantity });
      }

      if (missingProductIds.length > 0) {
        await db.primary
          .delete(cart)
          .where(
            and(
              eq(cart.customerId, customerId),
              inArray(cart.productId, missingProductIds),
            ),
          );
        notifyCartChange(customerId);
      }

      return result;
    } catch (error) {
      logger.error(`Error getting cart for customer ID ${customerId}:`, error);
      return [];
    }
  }

  async clearCart(customerId: number): Promise<void> {
    await db.primary.delete(cart).where(eq(cart.customerId, customerId));
    notifyCartChange(customerId);
  }

  // ─── WISHLIST OPERATIONS ─────────────────────────────────────────
  async addToWishlist(customerId: number, productId: number): Promise<void> {
    const existingItem = await db.primary
      .select()
      .from(wishlist)
      .where(
        and(
          eq(wishlist.customerId, customerId),
          eq(wishlist.productId, productId),
        ),
      );
    if (existingItem.length === 0) {
      await db.primary.insert(wishlist).values({ customerId, productId });
    }
    notifyWishlistChange(customerId);
  }

  async removeFromWishlist(
    customerId: number,
    productId: number,
  ): Promise<void> {
    await db.primary
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
    const wishlistItems = await db.primary
      .select()
      .from(wishlist)
      .where(eq(wishlist.customerId, customerId));

    if (wishlistItems.length === 0) {
      return [];
    }

    const productIds = Array.from(
      new Set(
        wishlistItems
          .map((item) => item.productId)
          .filter((id): id is number => typeof id === "number"),
      ),
    );

    const productsList =
      productIds.length > 0
        ? await db.primary
          .select()
          .from(products)
          .where(inArray(products.id, productIds))
        : [];
    const productMap = new Map(productsList.map((product) => [product.id, product]));

    const staleProductIds: number[] = [];
    const result: Product[] = [];
    for (const item of wishlistItems) {
      const productId = item.productId;
      if (typeof productId !== "number") {
        continue;
      }
      const product = productMap.get(productId);
      if (!product || product.isDeleted) {
        staleProductIds.push(productId);
        continue;
      }
      result.push(product);
    }

    if (staleProductIds.length > 0) {
      await db.primary
        .delete(wishlist)
        .where(
          and(
            eq(wishlist.customerId, customerId),
            inArray(wishlist.productId, staleProductIds),
          ),
        );
      notifyWishlistChange(customerId);
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
    const result = await db.primary.insert(orders).values(orderToInsert).returning();
    const created = result[0];
    await db.primary.insert(orderStatusUpdates).values({
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

    const createdOrder = await db.primary.transaction(async (tx) => {
      const shopModes = await loadShopModes(order.shopId);
      const enforceStock = !(shopModes.catalogModeEnabled || shopModes.openOrderMode);
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
        if (enforceStock) {
          const updateResult = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${quantity}` })
            .where(and(eq(products.id, productId), gte(products.stock, quantity)))
            .returning({ id: products.id });

          if (updateResult.length === 0) {
            throw new Error(`Insufficient stock for product ID ${productId}`);
          }
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

    // Invalidate dashboard stats cache when new order is created
    if (createdOrder.shopId != null) {
      await invalidateCache(`dashboard_stats:${createdOrder.shopId}`);
    }

    return createdOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.primary.select().from(orders).where(eq(orders.id, id));
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

    return await db.primary
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.orderDate));
  }

  async getOrdersByShop(shopId: number, status?: string | string[]): Promise<Order[]> {
    const conditions = [eq(orders.shopId, shopId)];
    if (status && status !== "all_orders") {
      if (Array.isArray(status)) {
        // Safe cast as we expect valid statuses
        conditions.push(inArray(orders.status, status as any[]));
      } else {
        conditions.push(eq(orders.status, status as any));
      }
    }

    return await db.primary
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.orderDate));
  }

  async getRecentOrdersByShop(shopId: number): Promise<Order[]> {
    const result = await db.primary
      .select()
      .from(orders)
      .where(eq(orders.shopId, shopId))
      .orderBy(desc(orders.orderDate))
      .limit(5);

    return result;
  }

  async getShopDashboardStats(shopId: number) {
    // Check cache first to reduce database load
    const cacheKey = `dashboard_stats:${shopId}`;
    const cached = await getCache<{
      pendingOrders: number;
      ordersInProgress: number;
      completedOrders: number;
      totalProducts: number;
      lowStockItems: number;
      earningsToday: number;
      earningsMonth: number;
      earningsTotal: number;
      customerSpendTotals: { customerId: number; name: string | null; phone: string | null; totalSpent: number; orderCount: number }[];
      itemSalesTotals: { productId: number; name: string | null; quantity: number; totalAmount: number }[];
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const readDb = db.replica;
    const now = getCurrentISTDate();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const paidOrderFilters = and(
      eq(orders.shopId, shopId),
      eq(orders.paymentStatus, "paid"),
      ne(orders.status, "cancelled"),
      ne(orders.status, "returned"),
    );
    const totalRevenueSql = sql<number>`coalesce(sum(${orders.total}::double precision), 0)`;
    const itemRevenueSql = sql<number>`coalesce(sum(${orderItems.total}::double precision), 0)`;
    const itemQuantitySql = sql<number>`coalesce(sum(${orderItems.quantity}), 0)`;
    const customerSpendSql = sql<number>`coalesce(sum(${orders.total}::double precision), 0)`;

    const [
      pendingResult,
      inProgressResult,
      completedResult,
      totalProductsResult,
      lowStockResult,
      todayEarningsResult,
      monthEarningsResult,
      totalEarningsResult,
      customerSpendRows,
      itemSalesRows,
    ] = await Promise.all([
      readDb
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.shopId, shopId), eq(orders.status, "pending"))),
      readDb
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.shopId, shopId), eq(orders.status, "packed"))),
      readDb
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.shopId, shopId), eq(orders.status, "delivered"))),
      readDb
        .select({ value: count() })
        .from(products)
        .where(eq(products.shopId, shopId)),
      readDb
        .select({ value: count() })
        .from(products)
        .where(and(eq(products.shopId, shopId), lt(products.stock, 10))),
      readDb
        .select({ value: totalRevenueSql })
        .from(orders)
        .where(and(paidOrderFilters, gte(orders.orderDate, startOfDay))),
      readDb
        .select({ value: totalRevenueSql })
        .from(orders)
        .where(and(paidOrderFilters, gte(orders.orderDate, startOfMonth))),
      readDb.select({ value: totalRevenueSql }).from(orders).where(paidOrderFilters),
      readDb
        .select({
          customerId: orders.customerId,
          name: users.name,
          phone: users.phone,
          totalSpent: customerSpendSql,
          orderCount: sql<number>`count(${orders.id})`,
        })
        .from(orders)
        .leftJoin(users, eq(orders.customerId, users.id))
        .where(and(paidOrderFilters, isNotNull(orders.customerId)))
        .groupBy(orders.customerId, users.name, users.phone)
        .orderBy(desc(customerSpendSql)),
      readDb
        .select({
          productId: orderItems.productId,
          name: products.name,
          quantity: itemQuantitySql,
          totalAmount: itemRevenueSql,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(
          and(
            eq(orders.shopId, shopId),
            eq(orders.paymentStatus, "paid"),
            ne(orders.status, "cancelled"),
            ne(orders.status, "returned"),
            eq(orderItems.status, "ordered"),
          ),
        )
        .groupBy(orderItems.productId, products.name)
        .orderBy(desc(itemRevenueSql)),
    ]);

    const stats = {
      pendingOrders: pendingResult[0]?.value ?? 0,
      ordersInProgress: inProgressResult[0]?.value ?? 0,
      completedOrders: completedResult[0]?.value ?? 0,
      totalProducts: totalProductsResult[0]?.value ?? 0,
      lowStockItems: lowStockResult[0]?.value ?? 0,
      earningsToday: Number(todayEarningsResult[0]?.value ?? 0),
      earningsMonth: Number(monthEarningsResult[0]?.value ?? 0),
      earningsTotal: Number(totalEarningsResult[0]?.value ?? 0),
      customerSpendTotals: customerSpendRows
        .filter((row) => row.customerId != null)
        .map((row) => ({
          customerId: row.customerId as number,
          name: row.name ?? null,
          phone: row.phone ?? null,
          totalSpent: Number(row.totalSpent ?? 0),
          orderCount: Number(row.orderCount ?? 0),
        })),
      itemSalesTotals: itemSalesRows
        .filter((row) => row.productId != null)
        .map((row) => ({
          productId: row.productId as number,
          name: row.name ?? null,
          quantity: Number(row.quantity ?? 0),
          totalAmount: Number(row.totalAmount ?? 0),
        })),
    };

    // Cache for 5 minutes (300 seconds = 300000ms)
    await setCache(cacheKey, stats, 300);
    return stats;
  }

  async getPayLaterOutstandingAmounts(
    shopId: number,
    customerIds: number[],
  ): Promise<Record<number, number>> {
    const outstanding: Record<number, number> = {};
    if (!customerIds.length) return outstanding;

    const amountDueSql = sql<number>`coalesce(sum(${orders.total}::double precision), 0)`;
    const rows = await db.primary
      .select({
        customerId: orders.customerId,
        amountDue: amountDueSql,
      })
      .from(orders)
      .where(
        and(
          eq(orders.shopId, shopId),
          eq(orders.paymentMethod, "pay_later"),
          ne(orders.paymentStatus, "paid"),
          ne(orders.status, "cancelled"),
          ne(orders.status, "returned"),
          inArray(orders.customerId, customerIds),
        ),
      )
      .groupBy(orders.customerId);

    rows.forEach((row) => {
      if (row.customerId == null) return;
      outstanding[row.customerId] = Number(row.amountDue ?? 0);
    });

    return outstanding;
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    const result = await db.primary
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
    // Invalidate dashboard stats cache when order changes
    if (updated.shopId != null) {
      await invalidateCache(`dashboard_stats:${updated.shopId}`);
    }
    return updated;
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.primary
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
    const productResult = await db.primary
      .select()
      .from(products)
      .where(eq(products.id, productId));
    if (!productResult.length)
      throw new Error(`Product with ID ${productId} not found`);
    const product = productResult[0];
    const newStock = (product.stock ?? 0) - quantity;
    if (newStock < 0)
      throw new Error(`Insufficient stock for product ID ${productId}`);
    await db.primary
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, productId));
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return await db.primary
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  async getOrderItemsByOrderIds(orderIds: number[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) {
      return [];
    }
    const unique = Array.from(new Set(orderIds));
    return await db.primary
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, unique));
  }

  // ─── NOTIFICATION OPERATIONS ─────────────────────────────────────
  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const result = await db.primary
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

  async getNotificationsByUser(
    userId: number,
    options?: { page: number; limit: number },
  ): Promise<{ data: Notification[]; total: number; totalPages: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    // Count total
    const [countResult] = await db.primary
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Get data
    const data = await db.primary
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
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const mappedData = data.map((row) => ({
      ...row,
      createdAt: row.createdAt ?? null,
    }));

    return { data: mappedData, total, totalPages };
  }

  async markNotificationAsRead(id: number): Promise<void> {
    const updated = await db.primary
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning({ userId: notifications.userId });

    if (updated[0]) {
      notifyNotificationChange(updated[0].userId);
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    // Mark ALL notifications for this user as read (no role filtering)
    await db.primary
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    notifyNotificationChange(userId);
  }

  async deleteNotification(id: number): Promise<void> {
    const deleted = await db.primary
      .delete(notifications)
      .where(eq(notifications.id, id))
      .returning({ userId: notifications.userId });

    if (deleted[0]) {
      notifyNotificationChange(deleted[0].userId);
    }
  }

  // ─── ADDITIONAL / ENHANCED OPERATIONS ─────────────────────────────
  async checkAvailability(
    serviceId: number,
    date: Date,
    timeSlotLabel?: TimeSlotLabel | null,
  ): Promise<boolean> {
    const service = await this.getService(serviceId);
    if (service && (service.isAvailable === false || service.isAvailableNow === false)) {
      return false;
    }

    // Check if the requested slot is allowed by the provider
    if (service && timeSlotLabel && service.allowedSlots) {
      const allowed = service.allowedSlots as TimeSlotLabel[];
      if (!allowed.includes(timeSlotLabel)) {
        return false;
      }
    }

    const { start: startOfDay, end: nextDay } = getISTDayBoundsUtc(date);
    const activeStatusCondition = sql`${bookings.status} NOT IN ('cancelled','rejected','expired')`;

    // Check if the slot is blocked by the provider
    const [blocked] = await db.primary
      .select({ id: blockedTimeSlots.id })
      .from(blockedTimeSlots)
      .where(
        and(
          eq(blockedTimeSlots.serviceId, serviceId),
          gte(blockedTimeSlots.date, startOfDay),
          lt(blockedTimeSlots.date, nextDay),
        ),
      );
    if (blocked) return false;

    // Enforce max daily + per-slot capacity
    const [{ value: countForDay }] = await db.primary
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.serviceId, serviceId),
          gte(bookings.bookingDate, startOfDay),
          lt(bookings.bookingDate, nextDay),
          activeStatusCondition,
        ),
      );

    const maxDailyBookings = service?.maxDailyBookings ?? 5;
    if (Number(countForDay) >= maxDailyBookings) {
      return false;
    }

    if (!timeSlotLabel) {
      return true;
    }

    const allowedSlots =
      Array.isArray(service?.allowedSlots) && service.allowedSlots.length > 0
        ? (service.allowedSlots as TimeSlotLabel[])
        : (["morning", "afternoon", "evening"] as TimeSlotLabel[]);
    const perSlotCapacity = Math.max(
      1,
      Math.ceil(maxDailyBookings / Math.max(1, allowedSlots.length)),
    );

    const slotCondition = sql`(${bookings.timeSlotLabel} IS NULL OR ${bookings.timeSlotLabel} = ${timeSlotLabel})`;
    const [{ value: countForSlot }] = await db.primary
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.serviceId, serviceId),
          gte(bookings.bookingDate, startOfDay),
          lt(bookings.bookingDate, nextDay),
          activeStatusCondition,
          slotCondition,
        ),
      );

    return Number(countForSlot) < perSlotCapacity;
  }

  async joinWaitlist(
    _customerId: number,
    _serviceId: number,
    _preferredDate: Date,
  ): Promise<void> {
    // Insert into a waitlist table (implementation required)
  }

  // For booking history sorting, we compute the last update timestamp asynchronously.
  async getBookingHistory(bookingId: number): Promise<any[]> {
    return await db.primary
      .select()
      .from(bookingHistory)
      .where(eq(bookingHistory.bookingId, bookingId));
  }

  async getExpiredBookings(): Promise<Booking[]> {
    return await db.primary
      .select()
      .from(bookings)
      .where(
        and(eq(bookings.status, "pending"), lt(bookings.expiresAt, new Date())),
      );
  }

  async processExpiredBookings(): Promise<void> {
    const expiredBookings = await this.getExpiredBookings();
    if (expiredBookings.length === 0) return;

    // PERFORMANCE FIX: Pre-fetch all services in one query instead of N queries
    const serviceIds = Array.from(new Set(
      expiredBookings
        .map(b => b.serviceId)
        .filter((id): id is number => typeof id === "number")
    ));
    const servicesList = serviceIds.length > 0
      ? await this.getServicesByIds(serviceIds)
      : [];
    const serviceMap = new Map(servicesList.map(s => [s.id, s]));

    // PERFORMANCE FIX: Process bookings in parallel batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < expiredBookings.length; i += BATCH_SIZE) {
      const batch = expiredBookings.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (booking) => {
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

        const service = typeof booking.serviceId === "number"
          ? serviceMap.get(booking.serviceId)
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
      }));
    }
  }

  // Asynchronously compute last-update timestamp for sorting.
  // Removed duplicate implementation of getBookingHistoryForCustomer to resolve the duplicate function error.



  async updateBookingStatus(
    id: number,
    status: "pending" | "completed" | "cancelled" | "confirmed",
    comment?: string,
  ): Promise<Booking> {
    const booking = await this.getBooking(id);
    if (!booking) throw new Error("Booking not found");
    // Map 'confirmed' to 'accepted' for internal consistency
    const internalStatus = status === "confirmed" ? "accepted" : status;

    return await this.updateBooking(id, {
      status: internalStatus,
      comments: comment || null,
    });
  }

  async getBookingsByService(
    serviceId: number,
    date: Date,
  ): Promise<Booking[]> {
    const { start: startDate, end: nextDate } = getISTDayBoundsUtc(date);

    return await db.primary
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.serviceId, serviceId),
          gte(bookings.bookingDate, startDate),
          lt(bookings.bookingDate, nextDate),
          sql`${bookings.status} NOT IN ('cancelled','rejected','expired')`,
        ),
      )
      .orderBy(bookings.bookingDate);
  }

  async getProviderSchedule(
    _providerId: number,
    date: Date,
  ): Promise<Booking[]> {
    // Convert date to start and end of day in IST (returned as UTC instants)
    const { start: startDate, end: endDate } = getISTDayBoundsUtc(date);
    void startDate;
    void endDate;
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

  async getBookingHistoryForProvider(
    providerId: number,
    options?: { page: number; limit: number },
  ): Promise<{ data: Booking[]; total: number; totalPages: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    // Get services for this provider
    const providerServices = await db.primary
      .select({ id: services.id })
      .from(services)
      .where(eq(services.providerId, providerId));

    const serviceIds = providerServices.map((s) => s.id);

    if (serviceIds.length === 0) {
      return { data: [], total: 0, totalPages: 0 };
    }

    // Count total
    const [countResult] = await db.primary
      .select({ count: count() })
      .from(bookings)
      .where(
        and(
          inArray(bookings.serviceId, serviceIds),
          ne(bookings.status, "pending"),
        ),
      );
    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Get data
    const data = await db.primary
      .select()
      .from(bookings)
      .where(
        and(
          inArray(bookings.serviceId, serviceIds),
          ne(bookings.status, "pending"),
        ),
      )
      .orderBy(desc(bookings.updatedAt))
      .limit(limit)
      .offset(offset);

    return { data, total, totalPages };
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
    const result = await db.primary
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
      const existing = await db.primary
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
    const result = await db.primary.insert(productReviews).values(review).returning();
    return result[0];
  }

  async getProductReviewsByProduct(
    productId: number,
  ): Promise<ProductReview[]> {
    const result = await db.primary
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, productId));
    return result;
  }

  async getProductReviewsByShop(shopId: number): Promise<ProductReview[]> {
    const productIds = await db.primary
      .select({ id: products.id })
      .from(products)
      .where(eq(products.shopId, shopId));
    const ids = productIds.map((p) => p.id);
    if (ids.length === 0) return [];
    return await db.primary
      .select()
      .from(productReviews)
      .where(sql`${productReviews.productId} in ${ids}`);
  }

  async getProductReviewsByCustomer(
    customerId: number,
  ): Promise<(ProductReview & { productName: string | null })[]> {
    const results = await db.primary
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
    const result = await db.primary
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
    const result = await db.primary
      .update(productReviews)
      .set(updateData)
      .where(eq(productReviews.id, id))
      .returning();
    if (!result[0]) throw new Error("Review not found");
    return result[0];
  }
  // Add new methods for blocked time slots
  async getBlockedTimeSlots(_serviceId: number): Promise<BlockedTimeSlot[]> {
    // Query blocked time slots table (implementation required)
    return [];
  }

  async createBlockedTimeSlot(
    data: InsertBlockedTimeSlot,
  ): Promise<BlockedTimeSlot> {
    // Implementation would depend on your database structure
    // Normalize date for UTC storage
    const normalizedDate = toUTCForStorage(data.date);
    if (!normalizedDate) {
      throw new Error("Invalid date for blocked time slot");
    }
    const blockedSlot = {
      id: Math.floor(Math.random() * 10000), // In a real DB this would be auto-generated
      ...data,
      date: normalizedDate,
    };
    // Insert blocked time slot into the table (implementation required)
    // Type assertion is safe here because we check for null above
    return blockedSlot as BlockedTimeSlot;
  }

  async deleteBlockedTimeSlot(_slotId: number): Promise<void> {
    // Delete blocked time slot (implementation required)
  }

  async getOverlappingBookings(
    _serviceId: number,
    _date: Date,
    _startTime: string,
    _endTime: string,
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

    // Update the order status with UTC timestamp
    // Only include updatedAt if it exists in the Order type
    const updateData: any = {
      status,
      trackingInfo: trackingInfo || order.trackingInfo,
    };
    if ("updatedAt" in order) {
      updateData.updatedAt = new Date();
    }
    const updated = await this.updateOrder(orderId, updateData);
    await db.primary.insert(orderStatusUpdates).values({
      orderId,
      status,
      trackingInfo: trackingInfo || order.trackingInfo,
      timestamp: new Date(),
    });
    return updated;
  }

  async getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]> {
    const updates = await db.primary
      .select()
      .from(orderStatusUpdates)
      .where(eq(orderStatusUpdates.orderId, orderId))
      .orderBy(orderStatusUpdates.timestamp);
    return updates.map((u) => ({
      orderId: u.orderId!,
      status: u.status as OrderStatus,
      trackingInfo: u.trackingInfo ?? undefined,
      timestamp: u.timestamp as Date,
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
    _providerId: number,
    _availability: {
      days: string[];
      hours: { start: string; end: string };
      breaks: { start: string; end: string }[];
    },
  ): Promise<void> {
    logger.info(`Updated availability for provider`);
  }

  async getProviderAvailability(_providerId: number): Promise<{
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
    const entries = await db.primary
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
    const result = await db.primary
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
    const res = await db.primary.select().from(returns).where(eq(returns.id, id));
    return res[0];
  }

  async getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]> {
    return await db.primary.select().from(returns).where(eq(returns.orderId, orderId));
  }

  async getReturnRequestsForShop(shopId: number): Promise<ReturnRequest[]> {
    const rows = await db.primary
      .select()
      .from(returns)
      .innerJoin(orders, eq(returns.orderId, orders.id))
      .where(eq(orders.shopId, shopId));
    return rows.map((row) => row.returns);
  }

  async updateReturnRequest(
    id: number,
    update: Partial<ReturnRequest>,
  ): Promise<ReturnRequest> {
    const result = await db.primary
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
    await db.primary.delete(returns).where(eq(returns.id, id));
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

  // Global search with database-side filtering, distance calculation, and sorting
  async globalSearch(params: GlobalSearchParams): Promise<GlobalSearchResult[]> {
    const { query, lat, lng, radiusKm, limit } = params;
    const normalizedQuery = query.trim().toLowerCase();

    // If location is provided, we use it for distance sorting and filtering
    const hasLocation = lat !== undefined && lng !== undefined;
    const effectiveRadius = radiusKm ?? DEFAULT_NEARBY_RADIUS_KM;



    // Calculate distance in meters for display/sorting
    const distanceExpr = hasLocation
      ? sql`ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000`
      : sql`NULL::float8`;

    // Relevance scoring
    const relevanceExpr = (nameCol: any, descCol: any) => sql`
      CASE WHEN LOWER(${nameCol}::text || ' ' || COALESCE(${descCol}::text, '')) LIKE ${'%' + normalizedQuery + '%'} THEN 4 ELSE 0 END
      + CASE 
          WHEN ${hasLocation ? distanceExpr : sql`NULL`} IS NULL THEN 0
          WHEN ${distanceExpr} < 1 THEN 2
          WHEN ${distanceExpr} < 5 THEN 1.5
          WHEN ${distanceExpr} < 15 THEN 1
          WHEN ${distanceExpr} < 40 THEN 0.5
          ELSE 0
        END
    `;

    // 1. Services Query
    const servicesDistExpr = hasLocation
      ? sql`ST_Distance(users.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000`
      : sql`NULL::float8`;

    const servicesQuery = db.primary
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        price: services.price,
        images: services.images,
        providerId: services.providerId,
        providerName: users.name,
        city: users.addressCity,
        state: users.addressState,
        distanceKm: servicesDistExpr.as("distance_km"),
        relevanceScore: relevanceExpr(services.name, services.description).as("relevance_score"),
      })
      .from(services)
      .leftJoin(users, eq(services.providerId, users.id))
      .where(
        and(
          eq(services.isDeleted, false),
          sql`LOWER(${services.name}::text || ' ' || COALESCE(${services.description}::text, '')) LIKE ${'%' + normalizedQuery + '%'}`,
          hasLocation ? sql`users.location IS NOT NULL AND ${servicesDistExpr} <= ${effectiveRadius}` : undefined
        )
      )
      .orderBy(desc(sql`relevance_score`), asc(sql`distance_km`))
      .limit(limit);

    // 2. Products Query
    const productsDistExpr = servicesDistExpr; // Same user table join logic

    const productsQuery = db.primary
      .select({
        id: products.id,
        shopId: products.shopId,
        name: products.name,
        description: products.description,
        price: products.price,
        images: products.images,
        ownerId: products.shopId,
        ownerName: users.name,
        city: users.addressCity,
        state: users.addressState,
        distanceKm: productsDistExpr.as("distance_km"),
        relevanceScore: relevanceExpr(products.name, products.description).as("relevance_score"),
      })
      .from(products)
      .leftJoin(users, eq(products.shopId, users.id))
      .where(
        and(
          eq(products.isDeleted, false),
          sql`${products.searchVector} @@ plainto_tsquery('english', ${normalizedQuery})`,
          hasLocation ? sql`users.location IS NOT NULL AND ${productsDistExpr} <= ${effectiveRadius}` : undefined
        )
      )
      .orderBy(desc(sql`relevance_score`), asc(sql`distance_km`))
      .limit(limit);

    // 3. Shops Query
    const shopsDistExpr = hasLocation
      ? sql`ST_Distance(shops.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000`
      : sql`NULL::float8`;

    // Use the shop filter 
    const shopsQuery = db.primary
      .select({
        id: shops.id,
        ownerId: shops.ownerId,
        shopName: shops.shopName,
        description: shops.description,
        image: users.profilePicture, // Using profile picture as shop image often
        city: shops.shopAddressCity,
        state: shops.shopAddressState,
        distanceKm: shopsDistExpr.as("distance_km"),
        relevanceScore: relevanceExpr(shops.shopName, shops.description).as("relevance_score"),
      })
      .from(shops)
      .leftJoin(users, eq(shops.ownerId, users.id))
      .where(
        and(
          sql`LOWER(${shops.shopName}::text || ' ' || COALESCE(${shops.description}::text, '')) LIKE ${'%' + normalizedQuery + '%'}`,
          hasLocation ? sql`shops.location IS NOT NULL AND ${shopsDistExpr} <= ${effectiveRadius}` : undefined
        )
      )
      .orderBy(desc(sql`relevance_score`), asc(sql`distance_km`))
      .limit(limit);

    // Execute queries
    const [servicesResults, productsResults, shopsResults] = await Promise.all([
      servicesQuery,
      productsQuery,
      shopsQuery,
    ]);

    // Combine and Map results
    const combined: (GlobalSearchResult & { relevanceScore: number })[] = [];

    for (const row of servicesResults) {
      combined.push({
        type: "service",
        id: row.id,
        serviceId: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        image: row.images?.[0] || null,
        providerId: row.providerId,
        providerName: row.providerName,
        location: { city: row.city || null, state: row.state || null },
        distanceKm: row.distanceKm != null ? Number(row.distanceKm) : null,
        relevanceScore: Number(row.relevanceScore ?? 0),
      });
    }

    for (const row of productsResults) {
      combined.push({
        type: "product",
        id: row.id,
        productId: row.id,
        shopId: row.shopId,
        name: row.name,
        description: row.description,
        price: row.price,
        image: row.images?.[0] || null,
        shopName: row.ownerName, // ownerName from users join
        location: { city: row.city || null, state: row.state || null },
        distanceKm: row.distanceKm != null ? Number(row.distanceKm) : null,
        relevanceScore: Number(row.relevanceScore ?? 0),
      });
    }

    for (const row of shopsResults) {
      combined.push({
        type: "shop",
        id: row.ownerId, // Use ownerId as ID for consistency
        shopId: row.id,
        name: row.shopName,
        description: row.description,
        image: row.image,
        location: { city: row.city || null, state: row.state || null },
        distanceKm: row.distanceKm != null ? Number(row.distanceKm) : null,
        relevanceScore: Number(row.relevanceScore ?? 0),
      });
    }

    // Final sort in memory
    combined.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    return combined.slice(0, limit).map(({ relevanceScore, ...rest }) => rest);
  }
}
