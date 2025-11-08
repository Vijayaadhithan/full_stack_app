import session from "express-session";
import createMemoryStore from "memorystore";
import logger from "./logger";
import {
  notifyBookingChange,
  notifyCartChange,
  notifyNotificationChange,
  notifyOrderChange,
  notifyWishlistChange,
} from "./realtime";
import {
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
} from "./utils/identity";
import {
  normalizeCoordinate,
  haversineDistanceKm,
  toNumericCoordinate,
  DEFAULT_NEARBY_RADIUS_KM,
} from "./utils/geo";
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
  ProductReview,
  InsertProductReview,
  ReturnRequest,
  InsertReturnRequest,
  Promotion,
  InsertPromotion,
  orderStatusUpdates,
  UserRole,
} from "@shared/schema";
import { newIndianDate, formatIndianDisplay } from "../shared/date-utils";

const MemoryStore = createMemoryStore(session);

export type OrderStatus =
  | "pending"
  | "cancelled"
  | "confirmed"
  | "processing"
  | "packed"
  | "dispatched"
  | "shipped"
  | "delivered"
  | "returned";
export type ProductListItem = Pick<
  Product,
  | "id"
  | "name"
  | "description"
  | "price"
  | "mrp"
  | "category"
  | "images"
  | "shopId"
  | "isAvailable"
  | "stock"
>;
export interface OrderStatusUpdate {
  orderId: number;
  status: OrderStatus;
  trackingInfo?: string | null;
  timestamp: Date;
}
export interface DashboardStats {
  pendingOrders: number;
  ordersInProgress: number;
  completedOrders: number;
  totalProducts: number;
  lowStockItems: number;
}
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

export type OrderItemInput = {
  productId: number;
  quantity: number;
  price: string;
  total: string;
};

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>; // Added for Google OAuth
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>; // Added for Google OAuth
  getAllUsers(): Promise<User[]>;
  getUsersByIds(ids: number[]): Promise<User[]>;
  getShops(filters?: {
    locationCity?: string;
    locationState?: string;
  }): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>; // Updated to accept all partial User fields

  // Service operations
  createService(service: InsertService): Promise<Service>;
  getService(id: number): Promise<Service | undefined>;
  getServicesByIds(ids: number[]): Promise<Service[]>;
  getServicesByProvider(providerId: number): Promise<Service[]>;
  getServicesByCategory(category: string): Promise<Service[]>;
  updateService(id: number, service: Partial<Service>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  getServices(filters?: any): Promise<Service[]>; // Added filters parameter

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByCustomer(
    customerId: number,
    filters?: { status?: Booking["status"] },
  ): Promise<Booking[]>;
  getBookingsByProvider(providerId: number): Promise<Booking[]>;
  getBookingsByStatus(status: string): Promise<Booking[]>;
  updateBooking(id: number, booking: Partial<Booking>): Promise<Booking>;
  getPendingBookingRequestsForProvider(providerId: number): Promise<Booking[]>; // Added
  getBookingHistoryForProvider(providerId: number): Promise<Booking[]>; // Added
  getBookingHistoryForCustomer(customerId: number): Promise<Booking[]>; // Added
  processExpiredBookings(): Promise<void>; // Added

  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductsByShop(shopId: number): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  getProductsByIds(ids: number[]): Promise<Product[]>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getProducts(
    filters?: any,
  ): Promise<{ items: ProductListItem[]; hasMore: boolean }>; // Added filters parameter with pagination
  removeProductFromAllCarts(productId: number): Promise<void>;

  // Cart operations
  addToCart(
    customerId: number,
    productId: number,
    quantity: number,
  ): Promise<void>;
  removeFromCart(customerId: number, productId: number): Promise<void>;
  getCart(
    customerId: number,
  ): Promise<{ product: Product; quantity: number }[]>;
  clearCart(customerId: number): Promise<void>;

  // Wishlist operations
  addToWishlist(customerId: number, productId: number): Promise<void>;
  removeFromWishlist(customerId: number, productId: number): Promise<void>;
  getWishlist(customerId: number): Promise<Product[]>;

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithItems(order: InsertOrder, items: OrderItemInput[]): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByCustomer(
    customerId: number,
    filters?: { status?: Order["status"] },
  ): Promise<Order[]>;
  getOrdersByShop(shopId: number, status?: string): Promise<Order[]>;
  getRecentOrdersByShop(shopId: number): Promise<Order[]>;
  getShopDashboardStats(shopId: number): Promise<DashboardStats>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order>;

  // Order items operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrder(orderId: number): Promise<OrderItem[]>;
  getOrderItemsByOrderIds(orderIds: number[]): Promise<OrderItem[]>;

  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReviewsByService(serviceId: number): Promise<Review[]>;
  getReviewsByServiceIds(serviceIds: number[]): Promise<Review[]>;
  getReviewsByProvider(providerId: number): Promise<Review[]>;
  getReviewsByCustomer(customerId: number): Promise<Review[]>;
  getReviewById(id: number): Promise<Review | undefined>;
  updateReview(
    id: number,
    data: { rating?: number; review?: string },
  ): Promise<Review>;
  updateCustomerReview(
    reviewId: number,
    customerId: number,
    data: { rating?: number; review?: string },
  ): Promise<Review>;
  updateProviderRating(providerId: number): Promise<void>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  getProductReviewsByProduct(productId: number): Promise<ProductReview[]>;
  getProductReviewsByShop(shopId: number): Promise<ProductReview[]>;
  getProductReviewsByCustomer(customerId: number): Promise<ProductReview[]>;
  getProductReviewById(id: number): Promise<ProductReview | undefined>;
  updateProductReview(
    id: number,
    data: { rating?: number; review?: string; shopReply?: string },
  ): Promise<ProductReview>;
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;

  // Promotion operations
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  getPromotionsByShop(shopId: number): Promise<Promotion[]>;

  // Additional booking operations
  checkAvailability(serviceId: number, date: Date): Promise<boolean>;
  joinWaitlist(
    customerId: number,
    serviceId: number,
    preferredDate: Date,
  ): Promise<void>;
  getWaitlistPosition(customerId: number, serviceId: number): Promise<number>;

  // Return and refund operations
  createReturnRequest(
    returnRequest: InsertReturnRequest,
  ): Promise<ReturnRequest>;
  getReturnRequest(id: number): Promise<ReturnRequest | undefined>;
  getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]>;
  getReturnRequestsForShop(shopId: number): Promise<ReturnRequest[]>;
  updateReturnRequest(
    id: number,
    returnRequest: Partial<ReturnRequest>,
  ): Promise<ReturnRequest>;
  deleteReturnRequest(id: number): Promise<void>;
  processRefund(returnRequestId: number): Promise<void>;

  // Enhanced notification operations
  sendSMSNotification(phone: string, message: string): Promise<void>;

  // Enhanced order tracking
  updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    trackingInfo?: string,
  ): Promise<Order>;
  getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]>;

  //Session store
  sessionStore: session.Store;

  // Enhanced provider profile operations
  updateProviderProfile(id: number, profile: Partial<User>): Promise<User>;
  updateProviderAvailability(
    providerId: number,
    availability: {
      days: string[];
      hours: { start: string; end: string };
      breaks: { start: string; end: string }[];
    },
  ): Promise<void>;
  getProviderAvailability(providerId: number): Promise<{
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  } | null>;

  // Enhanced booking operations
  updateBookingStatus(
    id: number,
    status: "pending" | "confirmed" | "completed" | "cancelled",
    comment?: string,
  ): Promise<Booking>;
  getBookingsByService(serviceId: number, date: Date): Promise<Booking[]>;
  getProviderSchedule(providerId: number, date: Date): Promise<Booking[]>;

  // Service completion and rating
  completeService(bookingId: number): Promise<Booking>;
  addBookingReview(bookingId: number, review: InsertReview): Promise<Review>;
  respondToReview(reviewId: number, response: string): Promise<Review>;

  // Add new methods for blocked time slots
  getBlockedTimeSlots(serviceId: number): Promise<BlockedTimeSlot[]>;
  createBlockedTimeSlot(data: InsertBlockedTimeSlot): Promise<BlockedTimeSlot>;
  deleteBlockedTimeSlot(slotId: number): Promise<void>;
  getOverlappingBookings(
    serviceId: number,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<Booking[]>;

  // User deletion and data erasure
  deleteUserAndData(userId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private services: Map<number, Service>;
  private bookings: Map<number, Booking>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private reviews: Map<number, Review>;
  private notifications: Map<number, Notification>;
  private cart: Map<number, Map<number, number>>; // customerId -> (productId -> quantity)
  private wishlist: Map<number, Set<number>>; // customerId -> Set of productIds
  private waitlist: Map<number, Map<number, Date>>; // serviceId -> (customerId -> preferredDate)
  private returnRequests: Map<number, ReturnRequest>;
  private orderStatusUpdates: Map<number, OrderStatusUpdate[]>;
  private productReviews: Map<number, ProductReview>;
  private blockedTimeSlots: Map<number, BlockedTimeSlot[]>; // Add new map for blocked slots
  sessionStore: session.Store;
  private currentId: number;
  private providerAvailability: Map<
    number,
    {
      days: string[];
      hours: { start: string; end: string };
      breaks: { start: string; end: string }[];
    }
  >;

  constructor() {
    this.users = new Map();
    this.services = new Map();
    this.bookings = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.reviews = new Map();
    this.notifications = new Map();
    this.cart = new Map();
    this.wishlist = new Map();
    this.waitlist = new Map();
    this.returnRequests = new Map();
    this.orderStatusUpdates = new Map();
    this.productReviews = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.providerAvailability = new Map();
    this.blockedTimeSlots = new Map(); // Initialize the new map
  }
  async deleteUserAndData(userId: number): Promise<void> {
    // Check if user exists
    if (!this.users.has(userId)) {
      // Optionally, throw an error or return if user not found
      logger.warn(
        `[MemStorage] User with ID ${userId} not found for deletion.`,
      );
      return;
    }

    // --- Delete data related to the user as a customer ---

    // Bookings made by the user
    this.bookings.forEach((booking, bookingId) => {
      if (booking.customerId === userId) {
        this.bookings.delete(bookingId);
      }
    });

    // Orders placed by the user
    const orderIdsToDelete: number[] = [];
    this.orders.forEach((order, orderId) => {
      if (order.customerId === userId) {
        orderIdsToDelete.push(orderId);
        // Delete associated order items
        this.orderItems.forEach((item, itemId) => {
          if (item.orderId === orderId) {
            this.orderItems.delete(itemId);
          }
        });
        // Delete associated return requests
        this.returnRequests.forEach((request, requestId) => {
          if (request.orderId === orderId) {
            this.returnRequests.delete(requestId);
          }
        });
        // Delete order status updates
        this.orderStatusUpdates.delete(orderId);
        // Delete product reviews linked to the order
        this.productReviews.forEach((review, reviewId) => {
          if ((review as any).orderId === orderId) {
            this.productReviews.delete(reviewId);
          }
        });
      }
    });
    orderIdsToDelete.forEach((id) => this.orders.delete(id));

    // Reviews written by the user
    this.reviews.forEach((review, reviewId) => {
      if (review.customerId === userId) {
        this.reviews.delete(reviewId);
      }
    });

    // Notifications for the user
    this.notifications.forEach((notification, notificationId) => {
      if (notification.userId === userId) {
        this.notifications.delete(notificationId);
      }
    });

    // Cart items for the user
    this.cart.delete(userId);

    // Wishlist items for the user
    this.wishlist.delete(userId);

    // Waitlist entries for the user
    this.waitlist.forEach((serviceWaitlist, serviceId) => {
      if (serviceWaitlist.has(userId)) {
        serviceWaitlist.delete(userId);
        if (serviceWaitlist.size === 0) {
          this.waitlist.delete(serviceId);
        }
      }
    });

    // --- Delete data related to the user as a provider/shop owner ---

    // Services offered by the user (as provider)
    const serviceIdsToDelete: number[] = [];
    this.services.forEach((service, serviceId) => {
      if (service.providerId === userId) {
        serviceIdsToDelete.push(serviceId);
        // Delete bookings for these services
        this.bookings.forEach((booking, bookingId) => {
          if (booking.serviceId === serviceId) {
            this.bookings.delete(bookingId);
          }
        });
        // Delete reviews for these services
        this.reviews.forEach((review, reviewId) => {
          if (review.serviceId === serviceId) {
            this.reviews.delete(reviewId);
          }
        });
        // Delete blocked time slots for these services
        const serviceBlockedSlots = this.blockedTimeSlots.get(serviceId);
        if (serviceBlockedSlots) {
          this.blockedTimeSlots.delete(serviceId);
        }
      }
    });
    serviceIdsToDelete.forEach((id) => this.services.delete(id));
    this.providerAvailability.delete(userId);

    // Products sold by the user (as shop owner - assuming shopId might be userId)
    const productIdsToDelete: number[] = [];
    this.products.forEach((product, productId) => {
      if (product.shopId === userId) {
        // Assuming shopId is the userId of the shop owner
        productIdsToDelete.push(productId);
        // Remove this product from all carts and wishlists (if not already handled by customer-specific deletion)
        this.cart.forEach((userCart) => userCart.delete(productId));
        this.wishlist.forEach((userWishlist) => userWishlist.delete(productId));
      }
    });
    productIdsToDelete.forEach((id) => this.products.delete(id));

    // Promotions by the user's shop
    // MemStorage doesn't have a promotions map directly, this would be part of a more complex setup
    // or promotions are linked via shopId which is userId.
    // For now, we assume if promotions were stored, they'd be keyed by shopId (userId).

    // Finally, delete the user
    this.users.delete(userId);

    logger.info(`[MemStorage] User ${userId} and all associated data deleted.`);
  }
  getPendingBookingRequestsForProvider(providerId: number): Promise<Booking[]> {
    const services = Array.from(this.services.values()).filter(
      (s) => s.providerId === providerId,
    );
    const serviceIds = services.map((s) => s.id);
    return Promise.resolve(
      Array.from(this.bookings.values()).filter(
        (b) =>
          b.status === "pending" &&
          b.serviceId !== null &&
          serviceIds.includes(b.serviceId),
      ),
    );
  }
  getBookingRequestsWithStatusForCustomer(customerId: number): Promise<Booking[]> {
    return Promise.resolve(
      Array.from(this.bookings.values()).filter(
        (b) => b.customerId === customerId,
      ),
    );
  }
  getBookingHistoryForProvider(providerId: number): Promise<Booking[]> {
    const services = Array.from(this.services.values()).filter(
      (s) => s.providerId === providerId,
    );
    const serviceIds = services.map((s) => s.id);
    const history = Array.from(this.bookings.values()).filter(
      (b) =>
        b.serviceId !== null &&
        serviceIds.includes(b.serviceId) &&
        b.status !== "pending",
    );
    history.sort((a, b) => {
      const aTime = (a.updatedAt ?? a.createdAt ?? new Date()) as Date;
      const bTime = (b.updatedAt ?? b.createdAt ?? new Date()) as Date;
      return bTime.getTime() - aTime.getTime();
    });
    return Promise.resolve(history);
  }
  getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
    const history = Array.from(this.bookings.values()).filter(
      (b) => b.customerId === customerId && b.status !== "pending",
    );
    history.sort((a, b) => {
      const aTime = (a.updatedAt ?? a.createdAt ?? new Date()) as Date;
      const bTime = (b.updatedAt ?? b.createdAt ?? new Date()) as Date;
      return bTime.getTime() - aTime.getTime();
    });
    return Promise.resolve(history);
  }
  processExpiredBookings(): Promise<void> {
    const now = new Date();
    const expired = Array.from(this.bookings.values()).filter(
      (b) => b.status === "pending" && b.expiresAt && b.expiresAt < now,
    );
    for (const booking of expired) {
      const updated: Booking = { ...booking, status: "expired", comments: "Automatically expired after 7 days" };
      this.bookings.set(booking.id, updated);

      if (booking.customerId) {
        this.createNotification({
          userId: booking.customerId,
          type: "booking_expired",
          title: "Booking Request Expired",
          message:
            "Your booking request has expired as the service provider did not respond within 7 days.",
          isRead: false,
        });
      }

      if (booking.serviceId) {
        const service = this.services.get(booking.serviceId);
        if (service) {
          this.createNotification({
            userId: service.providerId,
            type: "booking_expired",
            title: "Booking Request Expired",
            message: `A booking request for ${service.name} has expired as you did not respond within 7 days.`,
            isRead: false,
          });
        }
      }
    }
    return Promise.resolve();
  }
  createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    throw new Error("Method not implemented.");
  }
  getPromotionsByShop(shopId: number): Promise<Promotion[]> {
    throw new Error("Method not implemented.");
  }

  // Add implementation for getProducts
  async getProducts(
    filters?: any,
  ): Promise<{ items: ProductListItem[]; hasMore: boolean }> {
    let results = Array.from(this.products.values()).filter(
      (p) => !p.isDeleted,
    );

    const page = Math.max(1, Number(filters?.page ?? 1));
    const pageSize = Math.min(
      Math.max(1, Number(filters?.pageSize ?? 24)),
      100,
    );

    if (!filters) {
      const offset = (page - 1) * pageSize;
      const sliced = results.slice(offset, offset + pageSize + 1);
      const items: ProductListItem[] = sliced.slice(0, pageSize).map((product) => ({
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
      return { items, hasMore: sliced.length > pageSize };
    }

    if (filters.category) {
      const target = String(filters.category).toLowerCase();
      results = results.filter(
        (p) => (p.category ?? "").toLowerCase() === target,
      );
    }

    if (filters.minPrice !== undefined) {
      const minPrice = Number(filters.minPrice);
      if (!Number.isNaN(minPrice)) {
        results = results.filter((p) => Number(p.price) >= minPrice);
      }
    }

    if (filters.maxPrice !== undefined) {
      const maxPrice = Number(filters.maxPrice);
      if (!Number.isNaN(maxPrice)) {
        results = results.filter((p) => Number(p.price) <= maxPrice);
      }
    }

    if (typeof filters.isAvailable === "boolean") {
      results = results.filter((p) => p.isAvailable === filters.isAvailable);
    }

    if (filters.searchTerm) {
      const normalized = String(filters.searchTerm).trim().toLowerCase();
      if (normalized.length > 0) {
        const tokens = normalized.split(/\s+/).filter(Boolean);
        results = results.filter((product) => {
          const searchable = `${product.name} ${product.description ?? ""}`.toLowerCase();
          if (searchable.includes(normalized)) return true;
          if (!tokens.length) return false;
          return tokens.every((token) => searchable.includes(token));
        });
      }
    }

    if (filters.attributes) {
      const entries = Object.entries(filters.attributes).filter(
        ([, value]) => value !== undefined && value !== null && String(value).length > 0,
      );
      if (entries.length > 0) {
        results = results.filter((product) => {
          const specs = (product as any).specifications as
            | Record<string, unknown>
            | undefined
            | null;
          return entries.every(([key, rawValue]) => {
            const target = String(rawValue).toLowerCase();
            const specValue = specs?.[key];
            if (specValue !== undefined && specValue !== null) {
              return String(specValue).toLowerCase() === target;
            }
            const directValue = (product as any)[key];
            return directValue
              ? String(directValue).toLowerCase().includes(target)
              : false;
          });
        });
      }
    }

    if (filters.lat !== undefined && filters.lng !== undefined) {
      const lat = Number(filters.lat);
      const lng = Number(filters.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const radiusKm = Number(filters.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM);
        results = results.filter((product) => {
          if (!product.shopId) return false;
          const shop = this.users.get(product.shopId);
          if (!shop) return false;
          const shopLat = toNumericCoordinate(shop.latitude);
          const shopLng = toNumericCoordinate(shop.longitude);
          if (shopLat === null || shopLng === null) {
            return false;
          }
          return haversineDistanceKm(lat, lng, shopLat, shopLng) <= radiusKm;
        });
      }
    }

    const offset = (page - 1) * pageSize;
    const sliced = results.slice(offset, offset + pageSize + 1);
    const items: ProductListItem[] = sliced.slice(0, pageSize).map((product) => ({
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
    return { items, hasMore: sliced.length > pageSize };
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    logger.info("[Storage] getUser - Looking for user with ID:", id);
    const user = this.users.get(id);
    logger.info("[Storage] getUser - Found user:", user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = normalizeEmail(email);
    if (!normalized) return undefined;
    return Array.from(this.users.values()).find(
      (user) => normalizeEmail(user.email) === normalized,
    );
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    return Array.from(this.users.values()).find(
      (user) => normalizePhone(user.phone) === normalized,
    );
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    for (const user of Array.from(this.users.values())) {
      // Ensure googleId is checked correctly, even if it's null or undefined on some user objects
      if (user.googleId && user.googleId === googleId) {
        return user;
      }
    }
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const normalized = normalizeUsername(username);
    if (!normalized) return undefined;
    return Array.from(this.users.values()).find(
      (user) => normalizeUsername(user.username) === normalized,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByIds(ids: number[]): Promise<User[]> {
    return ids.map((id) => this.users.get(id)).filter((u): u is User => !!u);
  }
  async getShops(filters?: {
    locationCity?: string;
    locationState?: string;
  }): Promise<User[]> {
    let shops = Array.from(this.users.values()).filter(
      (u) => u.role === "shop",
    );
    if (filters) {
      if (filters.locationCity) {
        shops = shops.filter((s) => s.addressCity === filters.locationCity);
      }
      if (filters.locationState) {
        shops = shops.filter((s) => s.addressState === filters.locationState);
      }
    }
    return shops;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const normalizedUsername = normalizeUsername(insertUser.username);
    const normalizedEmail = normalizeEmail(insertUser.email);
    const normalizedPhone = normalizePhone(insertUser.phone);

    if (!normalizedUsername) {
      throw new Error("Invalid username");
    }
    if (!normalizedEmail) {
      throw new Error("Invalid email");
    }

    const id = this.currentId++;
    const user: User = {
      id,
      username: normalizedUsername,
      password: insertUser.password!,
      role: insertUser.role as UserRole,
      name: insertUser.name,
      phone: normalizedPhone ?? "",
      email: normalizedEmail,
      addressStreet:
        insertUser.addressStreet === undefined
          ? null
          : insertUser.addressStreet,
      addressCity:
        insertUser.addressCity === undefined ? null : insertUser.addressCity,
      addressState:
        insertUser.addressState === undefined ? null : insertUser.addressState,
      addressPostalCode:
        insertUser.addressPostalCode === undefined
          ? null
          : insertUser.addressPostalCode,
      addressCountry:
        insertUser.addressCountry === undefined
          ? null
          : insertUser.addressCountry,
      latitude: normalizeCoordinate(insertUser.latitude),
      longitude: normalizeCoordinate(insertUser.longitude),
      language: insertUser.language === undefined ? null : insertUser.language,
      profilePicture:
        insertUser.profilePicture === undefined
          ? null
          : insertUser.profilePicture,
      paymentMethods:
        insertUser.paymentMethods === undefined
          ? null
          : insertUser.paymentMethods,
      shopProfile:
        insertUser.shopProfile && insertUser.shopProfile !== null
          ? {
              ...insertUser.shopProfile,
              shippingPolicy: insertUser.shopProfile.shippingPolicy ?? undefined,
              returnPolicy: insertUser.shopProfile.returnPolicy ?? undefined,
            }
          : null,
      bio: insertUser.bio === undefined ? null : insertUser.bio,
      qualifications: null,
      experience:
        insertUser.experience === undefined ? null : insertUser.experience,
      workingHours: null,
      languages:
        insertUser.languages === undefined ? null : insertUser.languages,
      googleId: null,
      emailVerified:
        insertUser.emailVerified === undefined ? null : insertUser.emailVerified,
      verificationStatus: null,
      verificationDocuments: null,
      profileCompleteness: null,
      specializations: null,
      certifications: null,
      shopBannerImageUrl: null,
      shopLogoImageUrl: null,
      yearsInBusiness: null,
      socialMediaLinks: null,
      upiId: null,
      upiQrCodeUrl: null,
      averageRating:
        insertUser.averageRating === undefined ? null : insertUser.averageRating,
      totalReviews:
        insertUser.totalReviews === undefined ? null : insertUser.totalReviews,
      deliveryAvailable: null,
      returnsEnabled: true,
      pickupAvailable: null,
      isSuspended: false,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error("User not found");

    const { password, ...restOfData } = updateData;
    const normalizedUpdate: Partial<User> = { ...restOfData };

    if (restOfData.username !== undefined) {
      const normalized = normalizeUsername(restOfData.username);
      if (!normalized) {
        throw new Error("Invalid username");
      }
      normalizedUpdate.username = normalized;
    }

    if (restOfData.email !== undefined) {
      const normalized = normalizeEmail(restOfData.email);
      if (!normalized) {
        throw new Error("Invalid email");
      }
      normalizedUpdate.email = normalized;
    }

    if (restOfData.phone !== undefined) {
      const normalized = normalizePhone(restOfData.phone);
      normalizedUpdate.phone = normalized ?? "";
    }

    if (restOfData.latitude !== undefined) {
      normalizedUpdate.latitude = normalizeCoordinate(restOfData.latitude);
    }

    if (restOfData.longitude !== undefined) {
      normalizedUpdate.longitude = normalizeCoordinate(restOfData.longitude);
    }

    const updatedUserData = { ...existing, ...normalizedUpdate };

    if (password !== undefined) {
      // If a new password is provided, it should be handled (e.g., re-hashed if necessary)
      // For MemStorage, we'll just update it directly. In a real DB scenario, hashing would occur before this point.
      updatedUserData.password = password;
    }

    // Explicitly handle googleId if present in updateData
    if (updateData.googleId !== undefined) {
      updatedUserData.googleId = updateData.googleId;
    }

    this.users.set(id, updatedUserData);
    return updatedUserData;
  }

  // Service operations
  async createService(service: InsertService): Promise<Service> {
    const id = this.currentId++;
    const newService = {
      ...service,
      id,
      addressStreet:
        service.addressStreet === undefined ? null : service.addressStreet,
      addressCity:
        service.addressCity === undefined ? null : service.addressCity,
      addressState:
        service.addressState === undefined ? null : service.addressState,
      addressPostalCode:
        service.addressPostalCode === undefined
          ? null
          : service.addressPostalCode,
      addressCountry:
        service.addressCountry === undefined ? null : service.addressCountry,
      providerId: service.providerId === undefined ? null : service.providerId,
      isAvailable:
        service.isAvailable === undefined ? null : service.isAvailable,
      serviceLocationType: (service.serviceLocationType === undefined
        ? "provider_location"
        : service.serviceLocationType === "customer_location" ||
            service.serviceLocationType === "provider_location"
          ? service.serviceLocationType
          : "provider_location") as "customer_location" | "provider_location",
      images: service.images === undefined ? null : service.images,
      bufferTime: service.bufferTime === undefined ? null : service.bufferTime,
      workingHours:
        service.workingHours === undefined
          ? {
              monday: { isAvailable: false, start: "", end: "" },
              tuesday: { isAvailable: false, start: "", end: "" },
              wednesday: { isAvailable: false, start: "", end: "" },
              thursday: { isAvailable: false, start: "", end: "" },
              friday: { isAvailable: false, start: "", end: "" },
              saturday: { isAvailable: false, start: "", end: "" },
              sunday: { isAvailable: false, start: "", end: "" },
            }
          : service.workingHours,
      breakTime: service.breakTime == null ? [] : service.breakTime,
      maxDailyBookings:
        service.maxDailyBookings === undefined ? 5 : service.maxDailyBookings,
      isDeleted: false,
    };
    this.services.set(id, newService);
    return newService;
  }

  async getService(id: number): Promise<Service | undefined> {
    logger.info("[Storage] getService - Looking for service with ID:", id);
    logger.info(
      "[Storage] getService - Available services:",
      Array.from(this.services.entries()),
    );
    const service = this.services.get(id);
    logger.info("[Storage] getService - Found service:", service);
    return service;
  }

  async getServicesByIds(ids: number[]): Promise<Service[]> {
    return ids
      .map((id) => this.services.get(id))
      .filter((s): s is Service => !!s);
  }

  async getServicesByProvider(providerId: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(
      (service) => service.providerId === providerId,
    );
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    return Array.from(this.services.values()).filter(
      (service) => service.category === category,
    );
  }

  async updateService(id: number, service: Partial<Service>): Promise<Service> {
    const existing = this.services.get(id);
    if (!existing) throw new Error("Service not found");
    const updated = { ...existing, ...service };
    this.services.set(id, updated);
    return updated;
  }

  async deleteService(id: number): Promise<void> {
    const existing = this.services.get(id);
    if (!existing) throw new Error("Service not found");
    this.services.delete(id);
  }

  async getServices(filters?: any): Promise<Service[]> {
    const counts: Record<number, number> = {};
    for (const b of Array.from(this.bookings.values())) {
      if (b.status === "awaiting_payment" && b.serviceId) {
        const s = this.services.get(b.serviceId);
        if (s?.providerId) {
          counts[s.providerId] = (counts[s.providerId] || 0) + 1;
        }
      }
    }
    const blocked = new Set(
      Object.entries(counts)
        .filter(([, c]) => c > 5)
        .map(([id]) => Number(id)),
    );

    let results = Array.from(this.services.values()).filter(
      (service) => !blocked.has(service.providerId ?? -1) && service.isDeleted !== true,
    );

    if (filters) {
      if (filters.category) {
        const normalized = String(filters.category).toLowerCase();
        results = results.filter(
          (service) => (service.category ?? "").toLowerCase() === normalized,
        );
      }
      if (filters.minPrice !== undefined) {
        const minPrice = Number(filters.minPrice);
        if (Number.isFinite(minPrice)) {
          results = results.filter((service) => Number(service.price) >= minPrice);
        }
      }
      if (filters.maxPrice !== undefined) {
        const maxPrice = Number(filters.maxPrice);
        if (Number.isFinite(maxPrice)) {
          results = results.filter((service) => Number(service.price) <= maxPrice);
        }
      }
      if (filters.searchTerm) {
        const normalized = String(filters.searchTerm).trim().toLowerCase();
        if (normalized.length > 0) {
          const tokens = normalized.split(/\s+/).filter(Boolean);
          results = results.filter((service) => {
            const searchable = `${service.name} ${service.description ?? ""}`.toLowerCase();
            if (searchable.includes(normalized)) return true;
            return tokens.every((token) => searchable.includes(token));
          });
        }
      }
      if (filters.providerId) {
        results = results.filter(
          (service) => service.providerId === Number(filters.providerId),
        );
      }
      if (filters.locationCity) {
        results = results.filter(
          (service) => service.addressCity === filters.locationCity,
        );
      }
      if (filters.locationState) {
        results = results.filter(
          (service) => service.addressState === filters.locationState,
        );
      }
      if (filters.locationPostalCode) {
        results = results.filter(
          (service) => service.addressPostalCode === filters.locationPostalCode,
        );
      }
      if (filters.availabilityDate) {
        results = results.filter((service) => service.isAvailable === true);
      }
      if (filters.lat !== undefined && filters.lng !== undefined) {
        const lat = Number(filters.lat);
        const lng = Number(filters.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const radiusKm = Number(filters.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM);
          results = results.filter((service) => {
            if (!service.providerId) return false;
            const provider = this.users.get(service.providerId);
            if (!provider) return false;
            const providerLat = toNumericCoordinate(provider.latitude);
            const providerLng = toNumericCoordinate(provider.longitude);
            if (providerLat === null || providerLng === null) return false;
            return (
              haversineDistanceKm(lat, lng, providerLat, providerLng) <= radiusKm
            );
          });
        }
      }
    }

    return results;
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.currentId++;
    const newBooking: Booking = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...booking,
      // Remove duplicate id property since it's already included in the spread operator
      serviceLocation: booking.serviceLocation ?? null, // Ensure serviceLocation defaults to null
      status: "pending",
      customerId: booking.customerId ?? null,
      serviceId: booking.serviceId ?? null,
      rejectionReason: booking.rejectionReason ?? null,
      providerAddress: booking.providerAddress ?? null,
      deliveryMethod: booking.deliveryMethod ?? null,
      bookingDate: booking.bookingDate,
      rescheduleDate:
        booking.rescheduleDate === undefined ? null : booking.rescheduleDate,
      comments: booking.comments === undefined ? null : booking.comments,
      paymentStatus: (booking.paymentStatus ?? "pending") as
        | "pending"
        | "verifying"
        | "paid"
        | "failed",
      paymentReference:
        booking.paymentReference === undefined
          ? null
          : booking.paymentReference,
      eReceiptId: null,
      eReceiptUrl: null,
      eReceiptGeneratedAt: null,
      expiresAt: null,
      disputeReason:
        booking.disputeReason === undefined ? null : booking.disputeReason,
    };
    this.bookings.set(id, newBooking);
    const providerId =
      newBooking.serviceId != null
        ? this.services.get(newBooking.serviceId)?.providerId ?? null
        : null;

    notifyBookingChange({
      customerId: newBooking.customerId ?? null,
      providerId,
    });

    return newBooking;
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByCustomer(
    customerId: number,
    filters?: { status?: Booking["status"] },
  ): Promise<Booking[]> {
    const parseDate = (value: unknown) => {
      if (!value) return 0;
      const timestamp = new Date(value as Date).getTime();
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    return Array.from(this.bookings.values())
      .filter((booking) => booking.customerId === customerId)
      .filter((booking) =>
        filters?.status ? booking.status === filters.status : true,
      )
      .sort(
        (a, b) => parseDate(b.bookingDate ?? b.createdAt) - parseDate(a.bookingDate ?? a.createdAt),
      );
  }

  async getBookingsByProvider(providerId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter((booking) => {
      if (booking.serviceId === null) return false;
      const service = this.services.get(booking.serviceId);
      return service?.providerId === providerId;
    });
  }

  async getBookingsByStatus(status: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (b) => b.status === status,
    );
  }

  async updateBooking(id: number, booking: Partial<Booking>): Promise<Booking> {
    const existing = this.bookings.get(id);
    if (!existing) throw new Error("Booking not found");
    const updated = { ...existing, ...booking };
    this.bookings.set(id, updated);
    const serviceId = updated.serviceId ?? existing.serviceId;
    const providerId =
      serviceId != null
        ? this.services.get(serviceId)?.providerId ?? null
        : null;
    const customerId =
      (updated.customerId ?? existing.customerId) ?? null;

    notifyBookingChange({
      customerId,
      providerId,
    });

    return updated;
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentId++;
    const newProduct = {
      ...product,
      id,
      shopId: product.shopId === undefined ? null : product.shopId,
      isAvailable:
        product.isAvailable === undefined ? null : product.isAvailable,
      isDeleted: product.isDeleted === undefined ? null : product.isDeleted,
      createdAt: product.createdAt === undefined ? null : product.createdAt,
      updatedAt: product.updatedAt === undefined ? null : product.updatedAt,
      images: product.images === undefined ? null : product.images,
      sku: product.sku === undefined ? null : product.sku,
      barcode: product.barcode === undefined ? null : product.barcode,
      weight: product.weight === undefined ? null : product.weight,
      dimensions: product.dimensions === undefined ? null : product.dimensions,
      specifications:
        product.specifications === undefined ? null : product.specifications,
      tags: product.tags === undefined ? null : product.tags,
      minOrderQuantity:
        product.minOrderQuantity === undefined
          ? null
          : product.minOrderQuantity,
      maxOrderQuantity:
        product.maxOrderQuantity === undefined
          ? null
          : product.maxOrderQuantity,
      lowStockThreshold:
        product.lowStockThreshold === undefined
          ? null
          : product.lowStockThreshold,
      mrp: product.mrp === undefined ? product.price : product.mrp,
    };
    this.products.set(id, {
      id: newProduct.id,
      name: newProduct.name,
      shopId: newProduct.shopId,
      description: newProduct.description,
      price: newProduct.price,
      mrp: newProduct.mrp,
      stock: newProduct.stock,
      category: newProduct.category,
      images: newProduct.images,
      isAvailable: newProduct.isAvailable,
      isDeleted: newProduct.isDeleted,
      createdAt: newProduct.createdAt,
      updatedAt: newProduct.updatedAt,
      sku: newProduct.sku,
      barcode: newProduct.barcode,
      weight: newProduct.weight,
      dimensions: newProduct.dimensions,
      specifications: newProduct.specifications,
      tags: newProduct.tags,
      minOrderQuantity: newProduct.minOrderQuantity,
      maxOrderQuantity: newProduct.maxOrderQuantity,
      lowStockThreshold: newProduct.lowStockThreshold ?? null,
    });
    return {
      id: newProduct.id,
      name: newProduct.name,
      shopId: newProduct.shopId,
      description: newProduct.description,
      price: newProduct.price,
      mrp: newProduct.mrp,
      stock: newProduct.stock,
      category: newProduct.category,
      images: newProduct.images,
      isAvailable: newProduct.isAvailable,
      isDeleted: newProduct.isDeleted,
      createdAt: newProduct.createdAt,
      updatedAt: newProduct.updatedAt,
      sku: newProduct.sku,
      barcode: newProduct.barcode,
      weight: newProduct.weight,
      dimensions: newProduct.dimensions,
      specifications: newProduct.specifications,
      tags: newProduct.tags,
      minOrderQuantity: newProduct.minOrderQuantity,
      maxOrderQuantity: newProduct.maxOrderQuantity,
      lowStockThreshold: newProduct.lowStockThreshold ?? null,
    };
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductsByShop(shopId: number): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.shopId === shopId,
    );
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.category === category,
    );
  }

  async getProductsByIds(ids: number[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const uniqueIds = new Set(ids);
    const results: Product[] = [];
    uniqueIds.forEach((id) => {
      const product = this.products.get(id);
      if (product) {
        results.push(product);
      }
    });
    return results;
  }

  async deleteProduct(id: number): Promise<void> {
    const existing = this.products.get(id);
    if (!existing) throw new Error("Product not found");
    this.products.delete(id);
  }
  async updateProductStock(
    productId: number,
    quantity: number,
  ): Promise<void> {
    const product = this.products.get(productId);
    if (!product) throw new Error("Product not found");
    product.stock -= quantity;
    this.products.set(productId, product);
  }

  async removeProductFromAllCarts(productId: number): Promise<void> {
    // Iterate through all customer carts
    for (const [customerId, customerCart] of Array.from(this.cart.entries())) {
      // Remove the product if it exists in this customer's cart
      if (customerCart.has(productId)) {
        customerCart.delete(productId);
        notifyCartChange(customerId);
      }
    }
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const existing = this.products.get(id);
    if (!existing) throw new Error("Product not found");
    const updated = { ...existing, ...product };
    this.products.set(id, updated);
    return updated;
  }

  // Cart operations
  async addToCart(
    customerId: number,
    productId: number,
    quantity: number,
  ): Promise<void> {
    logger.info(
      `[MemStorage] Attempting to add product ID ${productId} to cart for customer ID ${customerId} with quantity ${quantity}`,
    );
    if (quantity <= 0) {
      logger.error(
        `[MemStorage] Invalid quantity ${quantity} for product ID ${productId}`,
      );
      throw new Error("Quantity must be positive");
    }

    // Get the product being added to find its shopId
    const productToAdd = this.products.get(productId);
    if (!productToAdd) {
      logger.error(`[MemStorage] Product ID ${productId} not found`);
      throw new Error("Product not found");
    }
    const shopIdToAdd = productToAdd.shopId;
    logger.info(
      `[MemStorage] Product ID ${productId} belongs to shop ID ${shopIdToAdd}`,
    );

    // Get current cart items
    const customerCart = this.cart.get(customerId);

    if (customerCart && customerCart.size > 0) {
      logger.info(
        `[MemStorage] Customer ID ${customerId} has ${customerCart.size} item(s) in cart`,
      );
      // If cart is not empty, check if the new item's shop matches the existing items' shop
      const firstCartEntry = customerCart.entries().next().value; // Get the first [productId, quantity] pair
      const firstProductId = firstCartEntry ? firstCartEntry[0] : null;
      if (firstProductId === null) {
        throw new Error("Unexpected empty cart encountered.");
      }
      logger.info(
        `[MemStorage] First item in cart has product ID ${firstProductId}`,
      );
      const firstProduct = this.products.get(firstProductId);

      if (firstProduct) {
        const existingShopId = firstProduct.shopId;
        logger.info(
          `[MemStorage] Existing items in cart belong to shop ID ${existingShopId}`,
        );
        if (shopIdToAdd !== existingShopId) {
          logger.error(
            `[MemStorage] Shop ID mismatch: Cannot add product from shop ${shopIdToAdd} to cart containing items from shop ${existingShopId}`,
          );
          throw new Error(
            "Cannot add items from different shops to the cart. Please clear your cart or checkout with items from the current shop.",
          );
        }
      } else {
        // This case should ideally not happen if data is consistent, but log it.
        logger.warn(
          `[MemStorage] Could not find product details for the first item (ID: ${firstProductId}) in the cart for customer ${customerId}. Proceeding with caution.`,
        );
      }
    }

    // Ensure the cart map exists for the customer
    if (!this.cart.has(customerId)) {
      this.cart.set(customerId, new Map());
    }
    const updatedCustomerCart = this.cart.get(customerId)!;

    // Proceed with adding or updating the cart item
    const existingQuantity = updatedCustomerCart.get(productId) || 0;
    const newQuantity = existingQuantity + quantity;
    logger.info(
      `[MemStorage] Setting quantity for product ID ${productId} to ${newQuantity} for customer ID ${customerId}`,
    );
    updatedCustomerCart.set(productId, newQuantity);
    logger.info(
      `[MemStorage] Successfully added/updated product ID ${productId} in cart for customer ID ${customerId}`,
    );
    notifyCartChange(customerId);
  }

  async removeFromCart(customerId: number, productId: number): Promise<void> {
    if (this.cart.has(customerId)) {
      this.cart.get(customerId)!.delete(productId);
    }
    notifyCartChange(customerId);
  }

  async getCart(
    customerId: number,
  ): Promise<{ product: Product; quantity: number }[]> {
    if (!this.cart.has(customerId)) return [];
    const cartItems = this.cart.get(customerId)!;
    const result: { product: Product; quantity: number }[] = [];
    let removedStaleEntry = false;

    for (const [productId, quantity] of Array.from(cartItems.entries())) {
      const product = this.products.get(productId);
      if (!product) {
        cartItems.delete(productId);
        removedStaleEntry = true;
        continue;
      }
      result.push({ product, quantity });
    }

    if (removedStaleEntry) {
      notifyCartChange(customerId);
    }

    return result;
  }

  async clearCart(customerId: number): Promise<void> {
    this.cart.delete(customerId);
    notifyCartChange(customerId);
  }

  // Wishlist operations
  async addToWishlist(customerId: number, productId: number): Promise<void> {
    if (!this.wishlist.has(customerId)) {
      this.wishlist.set(customerId, new Set());
    }
    this.wishlist.get(customerId)!.add(productId);
    notifyWishlistChange(customerId);
  }

  async removeFromWishlist(
    customerId: number,
    productId: number,
  ): Promise<void> {
    if (this.wishlist.has(customerId)) {
      this.wishlist.get(customerId)!.delete(productId);
    }
    notifyWishlistChange(customerId);
  }

  async getWishlist(customerId: number): Promise<Product[]> {
    if (!this.wishlist.has(customerId)) return [];
    const wishlistIds = this.wishlist.get(customerId)!;
    const result: Product[] = [];
    let removedStaleEntry = false;
    for (const productId of Array.from(wishlistIds)) {
      const product = this.products.get(productId);
      if (!product) {
        wishlistIds.delete(productId);
        removedStaleEntry = true;
        continue;
      }
      result.push(product);
    }
    if (removedStaleEntry) {
      notifyWishlistChange(customerId);
    }
    return result;
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.currentId++;
    // Exclude properties that can cause type conflicts
    const {
      status,
      paymentStatus,
      returnRequested,
      eReceiptId,
      eReceiptUrl,
      eReceiptGeneratedAt,
      ...rest
    } = order;
    const newOrder = {
      ...rest,
      id,
      customerId: order.customerId === undefined ? null : order.customerId,
      shopId: order.shopId === undefined ? null : order.shopId,
      status: "pending" as "pending",
      paymentStatus: (order.paymentStatus ?? "pending") as
        | "pending"
        | "verifying"
        | "paid"
        | "failed",
      returnRequested:
        order.returnRequested === undefined ? null : order.returnRequested,
      billingAddress:
        order.billingAddress === undefined ? null : order.billingAddress,
      shippingAddress:
        order.shippingAddress === undefined || order.shippingAddress === null
          ? ""
          : order.shippingAddress,
      total: order.total === undefined ? "0" : order.total,
      orderDate: order.orderDate === undefined ? new Date() : order.orderDate,
      notes: order.notes === undefined ? null : order.notes,
      // Removed shippingMethod property as it does not exist on type InsertOrder.
      paymentMethod:
        order.paymentMethod === undefined ? null : order.paymentMethod,
      paymentReference:
        order.paymentReference === undefined ? null : order.paymentReference,
      trackingInfo: null,
      deliveryMethod: order.deliveryMethod ?? null,
      eReceiptId: null,
      eReceiptUrl: null,
      eReceiptGeneratedAt: null,
    };
    this.orders.set(id, newOrder);
    this.orderStatusUpdates.set(id, [
      {
        orderId: id,
        status: "pending",
        trackingInfo: null,
        timestamp: newOrder.orderDate ?? new Date(),
      },
    ]);
    notifyOrderChange({
      customerId: newOrder.customerId ?? null,
      shopId: newOrder.shopId ?? null,
      orderId: id,
    });
    return newOrder;
  }

  async createOrderWithItems(
    order: InsertOrder,
    items: OrderItemInput[],
  ): Promise<Order> {
    if (items.length === 0) {
      throw new Error("Cannot create an order without items");
    }

    const quantityByProduct = new Map<number, number>();
    for (const item of items) {
      const product = this.products.get(item.productId);
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      const totalQuantity = (quantityByProduct.get(item.productId) ?? 0) + item.quantity;
      if (product.stock < totalQuantity) {
        throw new Error(`Insufficient stock for product ID ${item.productId}`);
      }
      quantityByProduct.set(item.productId, totalQuantity);
    }

    quantityByProduct.forEach((totalQuantity, productId) => {
      const product = this.products.get(productId);
      if (!product) {
        return;
      }
      product.stock -= totalQuantity;
      this.products.set(productId, product);
    });

    const createdOrder = await this.createOrder(order);

    for (const item of items) {
      await this.createOrderItem({
        orderId: createdOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      });
    }

    return createdOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByCustomer(
    customerId: number,
    filters?: { status?: Order["status"] },
  ): Promise<Order[]> {
    const parseDate = (value: unknown) => {
      if (!value) return 0;
      const timestamp = new Date(value as Date).getTime();
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    return Array.from(this.orders.values())
      .filter((order) => order.customerId === customerId)
      .filter((order) =>
        filters?.status ? order.status === filters.status : true,
      )
      .sort((a, b) => parseDate(b.orderDate) - parseDate(a.orderDate));
  }

  async getOrdersByShop(shopId: number, status?: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter((order) => order.shopId === shopId)
      .filter(
        (order) =>
          !status || status === "all_orders" || order.status === status,
      );
  }

  async getRecentOrdersByShop(shopId: number): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter((order) => order.shopId === shopId)
      .sort((a, b) => {
        const aDate = a.orderDate ? new Date(a.orderDate).getTime() : 0;
        const bDate = b.orderDate ? new Date(b.orderDate).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 5);
  }

  async getShopDashboardStats(shopId: number) {
    const ordersByShop = Array.from(this.orders.values()).filter(
      (o) => o.shopId === shopId,
    );
    const pendingOrders = ordersByShop.filter(
      (o) => o.status === "pending",
    ).length;
    const ordersInProgress = ordersByShop.filter(
      (o) => o.status === "packed",
    ).length;
    const completedOrders = ordersByShop.filter(
      (o) => o.status === "delivered",
    ).length;
    const productsByShop = Array.from(this.products.values()).filter(
      (p) => p.shopId === shopId,
    );
    const totalProducts = productsByShop.length;
    const lowStockItems = productsByShop.filter((p) => p.stock < 10).length;

    return {
      pendingOrders,
      ordersInProgress,
      completedOrders,
      totalProducts,
      lowStockItems,
    };
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    const existing = this.orders.get(id);
    if (!existing) throw new Error("Order not found");
    const updated = { ...existing, ...order };
    this.orders.set(id, updated);
    notifyOrderChange({
      customerId: updated.customerId ?? null,
      shopId: updated.shopId ?? null,
      orderId: id,
    });
    return updated;
  }

  // Order items operations
  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.currentId++;
    const newOrderItem = { ...orderItem, id };
    this.orderItems.set(id, {
      id: newOrderItem.id,
      price: newOrderItem.price,
      total: newOrderItem.total,
      quantity: newOrderItem.quantity,
      status: newOrderItem.status as
        | "cancelled"
        | "returned"
        | "ordered"
        | null,
      orderId: newOrderItem.orderId ?? null,
      productId: newOrderItem.productId ?? null,
      discount: newOrderItem.discount ?? null,
    });
    return {
      id: newOrderItem.id,
      status: newOrderItem.status as
        | "cancelled"
        | "returned"
        | "ordered"
        | null,
      total: newOrderItem.total,
      orderId: newOrderItem.orderId ?? null,
      price: newOrderItem.price,
      productId: newOrderItem.productId ?? null,
      quantity: newOrderItem.quantity,
      discount: newOrderItem.discount ?? null,
    };
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(
      (item) => item.orderId === orderId,
    );
  }

  async getOrderItemsByOrderIds(orderIds: number[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) return [];
    const orderIdSet = new Set(orderIds);
    return Array.from(this.orderItems.values()).filter(
      (item) => item.orderId !== null && orderIdSet.has(item.orderId),
    );
  }

  // Review operations
  async createReview(review: InsertReview): Promise<Review> {
    if (review.bookingId && review.customerId) {
      const existing = Array.from(this.reviews.values()).find(
        (r) =>
          r.bookingId === review.bookingId &&
          r.customerId === review.customerId,
      );
      if (existing) {
        throw new Error("Duplicate review");
      }
    }
    const id = this.currentId++;
    const newReview = { ...review, id };
    this.reviews.set(id, {
      id: newReview.id,
      createdAt: newReview.createdAt || null,
      customerId: newReview.customerId || null,
      serviceId: newReview.serviceId || null,
      bookingId: newReview.bookingId || null,
      rating: newReview.rating,
      review: newReview.review || null,
      providerReply: newReview.providerReply || null,
      isVerifiedService: newReview.isVerifiedService || null,
    });
    return {
      id: newReview.id,
      customerId: newReview.customerId ?? null,
      serviceId: newReview.serviceId ?? null,
      createdAt: newReview.createdAt ?? null,
      bookingId: newReview.bookingId ?? null,
      rating: newReview.rating,
      review: newReview.review ?? null,
      providerReply: newReview.providerReply ?? null,
      isVerifiedService: newReview.isVerifiedService ?? null,
    };
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(
      (review) => review.serviceId === serviceId,
    );
  }

  async getReviewsByServiceIds(serviceIds: number[]): Promise<Review[]> {
    if (serviceIds.length === 0) {
      return [];
    }
    const idSet = new Set(serviceIds);
    return Array.from(this.reviews.values()).filter(
      (review) => review.serviceId !== null && idSet.has(review.serviceId),
    );
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map((service) => service.id);
    return Array.from(this.reviews.values()).filter(
      (review) =>
        review.serviceId !== null && serviceIds.includes(review.serviceId),
    );
  }

  async getReviewsByCustomer(customerId: number): Promise<Review[]> {
    // Added
    const results = Array.from(this.reviews.values()).filter(
      (r) => r.customerId === customerId,
    );

    return results.map((r) => {
      const serviceName = r.serviceId
        ? (this.services.get(r.serviceId)?.name ?? "Service Not Found")
        : null;
      return { ...r, serviceName } as Review & { serviceName: string | null };
    });
  }

  async getReviewById(id: number): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async updateReview(
    id: number,
    data: { rating?: number; review?: string },
  ): Promise<Review> {
    const review = this.reviews.get(id);
    if (!review) throw new Error("Review not found");
    if (data.rating !== undefined) review.rating = data.rating;
    if (data.review !== undefined) review.review = data.review;
    return review;
  }

  async updateCustomerReview(
    reviewId: number,
    customerId: number,
    data: { rating?: number; review?: string },
  ): Promise<Review> {
    // Added
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error("Review not found");
    if (review.customerId !== customerId) {
      throw new Error("Customer is not authorized to update this review");
    }

    if (data.rating !== undefined) review.rating = data.rating;
    if (data.review !== undefined) review.review = data.review;
    this.reviews.set(reviewId, review);
    return review;
  }

  async updateProviderRating(providerId: number): Promise<void> {
    const providerServices = Array.from(this.services.values()).filter(
      (s) => s.providerId === providerId,
    );
    const serviceIds = providerServices.map((s) => s.id);
    const providerReviews = Array.from(this.reviews.values()).filter((r) =>
      serviceIds.includes(r.serviceId!),
    );
    const total = providerReviews.reduce((sum, r) => sum + r.rating, 0);
    const average =
      providerReviews.length > 0 ? total / providerReviews.length : 0;
    const user = this.users.get(providerId);
    if (user) {
      (user as any).averageRating = average;
      (user as any).totalReviews = providerReviews.length;
    }
  }
  async createProductReview(
    review: InsertProductReview,
  ): Promise<ProductReview> {
    if (review.orderId && review.customerId && review.productId) {
      for (const r of Array.from(this.productReviews.values())) {
        if (
          r.orderId === review.orderId &&
          r.customerId === review.customerId &&
          r.productId === review.productId
        ) {
          throw new Error("Duplicate review");
        }
      }
    }
    const id = this.currentId++;
    const newReview = { ...review, id };
    this.productReviews.set(id, newReview as ProductReview);
    return newReview as ProductReview;
  }

  async getProductReviewsByProduct(
    productId: number,
  ): Promise<ProductReview[]> {
    return Array.from(this.productReviews.values()).filter(
      (r) => r.productId === productId,
    );
  }

  async getProductReviewsByShop(shopId: number): Promise<ProductReview[]> {
    const productIds = Array.from(this.products.values())
      .filter((p) => p.shopId === shopId)
      .map((p) => p.id);
    return Array.from(this.productReviews.values()).filter(
      (r) => r.productId !== null && productIds.includes(r.productId),
    );
  }

  async getProductReviewsByCustomer(
    customerId: number,
  ): Promise<(ProductReview & { productName: string | null })[]> {
    return Array.from(this.productReviews.values())
      .filter((r) => r.customerId === customerId)
      .map((r) => ({
        ...r,
        productName: r.productId
          ? (this.products.get(r.productId)?.name ?? null)
          : null,
      }));
  }

  async getProductReviewById(id: number): Promise<ProductReview | undefined> {
    return this.productReviews.get(id);
  }

  async updateProductReview(
    id: number,
    data: { rating?: number; review?: string; shopReply?: string },
  ): Promise<ProductReview> {
    const review = this.productReviews.get(id);
    if (!review) throw new Error("Review not found");
    if (data.rating !== undefined)
      (review as ProductReview).rating = data.rating;
    if (data.review !== undefined)
      (review as ProductReview).review = data.review;
    if (data.shopReply !== undefined) {
      (review as ProductReview).shopReply = data.shopReply;
      (review as ProductReview).repliedAt = new Date();
    }
    this.productReviews.set(id, review as ProductReview);
    return review as ProductReview;
  }

  // Notification operations
  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const id = this.currentId++;
    const newNotification = { ...notification, id };
    this.notifications.set(id, {
      id,
      createdAt: newNotification.createdAt || newIndianDate(), // Use newIndianDate() to create dates in IST
      message: newNotification.message,
      type: newNotification.type as
        | "shop"
        | "booking"
        | "order"
        | "promotion"
        | "system"
        | "return"
        | "service_request"
        | "service"
        | "booking_request",
      userId: newNotification.userId || null,
      title: newNotification.title,
      isRead: newNotification.isRead || false,
      relatedBookingId: null,
    });
    const finalNotification: Notification = {
      id: newNotification.id,
      userId: newNotification.userId ?? null,
      type: newNotification.type as
        | "shop"
        | "booking"
        | "order"
        | "promotion"
        | "system"
        | "return"
        | "service_request"
        | "service"
        | "booking_request",
      title: newNotification.title,
      message: newNotification.message,
      isRead: newNotification.isRead ?? false,
      createdAt: newNotification.createdAt ?? newIndianDate(), // Use newIndianDate() to create dates in IST
      relatedBookingId: null,
    };
    notifyNotificationChange(newNotification.userId ?? null);
    return finalNotification;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId,
    );
  }

  async markNotificationAsRead(id: number): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.isRead = true;
      this.notifications.set(id, notification);
      notifyNotificationChange(notification.userId ?? null);
    }
  }

  async markAllNotificationsAsRead(
    userId: number,
    role?: string,
  ): Promise<void> {
    // Get all notifications for this user
    let userNotifications = await this.getNotificationsByUser(userId);

    // Apply role-based filtering if role is provided
    if (role) {
      if (role === "shop_owner") {
        // Shop owners should not see service notifications
        userNotifications = userNotifications.filter(
          (n) => n.type !== "service",
        );
      } else if (role === "provider") {
        // Service providers should not see order notifications
        userNotifications = userNotifications.filter((n) => n.type !== "order");
      }
      // For customers, we don't need additional filtering
    }

    // Mark filtered notifications as read
    for (const notification of userNotifications) {
      notification.isRead = true;
      this.notifications.set(notification.id, notification);
    }

    notifyNotificationChange(userId);
  }

  async deleteNotification(id: number): Promise<void> {
    const notification = this.notifications.get(id);
    this.notifications.delete(id);
    notifyNotificationChange(notification?.userId ?? null);
  }

  // Availability and waitlist operations
  async checkAvailability(serviceId: number, date: Date): Promise<boolean> {
    const bookings = Array.from(this.bookings.values()).filter(
      (booking) =>
        booking.serviceId === serviceId &&
        booking.bookingDate.toDateString() === date.toDateString(),
    );

    const service = await this.getService(serviceId);
    if (!service) return false;

    // Simple availability check - can be enhanced with more complex logic
    return bookings.length < 5; // Assuming max 5 bookings per day
  }

  async joinWaitlist(
    customerId: number,
    serviceId: number,
    preferredDate: Date,
  ): Promise<void> {
    if (!this.waitlist.has(serviceId)) {
      this.waitlist.set(serviceId, new Map());
    }
    this.waitlist.get(serviceId)!.set(customerId, preferredDate);
  }

  async getWaitlistPosition(
    customerId: number,
    serviceId: number,
  ): Promise<number> {
    if (!this.waitlist.has(serviceId)) return -1;
    const waitlist = Array.from(this.waitlist.get(serviceId)!.entries());
    const position = waitlist.findIndex(([id]) => id === customerId);
    return position === -1 ? -1 : position + 1;
  }

  // Return and refund operations
  async createReturnRequest(
    returnRequest: InsertReturnRequest,
  ): Promise<ReturnRequest> {
    const id = this.currentId++;
    const newReturnRequest: ReturnRequest = {
      id,
      customerId: returnRequest.customerId ?? null,
      createdAt: new Date(), // Use current date
      status: (returnRequest.status ?? "requested") as
        | "refunded"
        | "requested"
        | "approved"
        | "rejected"
        | "received"
        | "completed", // Default status
      orderId: returnRequest.orderId ?? null,
      orderItemId: returnRequest.orderItemId ?? null, // Fix: Default to null if undefined
      description: returnRequest.description ?? null,
      images: returnRequest.images ?? null,
      reason: returnRequest.reason ?? null,
      resolvedAt: null, // Initially null
      resolvedBy: null, // Initially null
      refundAmount: null, // Added refundAmount
      refundStatus: null, // Added refundStatus
      refundId: null, // Initially null
    };
    this.returnRequests.set(id, newReturnRequest);
    if (newReturnRequest.orderId != null) {
      const order = await this.getOrder(newReturnRequest.orderId);
      if (order) {
        notifyOrderChange({
          customerId: order.customerId ?? null,
          shopId: order.shopId ?? null,
          orderId: order.id,
        });
      }
    }
    return newReturnRequest;
  }

  async getReturnRequest(id: number): Promise<ReturnRequest | undefined> {
    return this.returnRequests.get(id);
  }

  async getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]> {
    return Array.from(this.returnRequests.values()).filter(
      (request) => request.orderId === orderId,
    );
  }

  async getReturnRequestsForShop(shopId: number): Promise<ReturnRequest[]> {
    return Array.from(this.returnRequests.values()).filter((request) => {
      if (request.orderId == null) {
        return false;
      }
      const order = this.orders.get(request.orderId);
      return order?.shopId === shopId;
    });
  }

  async updateReturnRequest(
    id: number,
    returnRequest: Partial<ReturnRequest>,
  ): Promise<ReturnRequest> {
    const existing = this.returnRequests.get(id);
    if (!existing) throw new Error("Return request not found");
    const updated = { ...existing, ...returnRequest };
    this.returnRequests.set(id, updated);
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
    const existing = this.returnRequests.get(id);
    this.returnRequests.delete(id);
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

  async processRefund(returnRequestId: number): Promise<void> {
    const returnRequest = await this.getReturnRequest(returnRequestId);
    if (!returnRequest) throw new Error("Return request not found");

    // In a real implementation, this would integrate with a payment provider's refund API
    returnRequest.status = "refunded";
    this.returnRequests.set(returnRequestId, returnRequest);
    if (returnRequest.orderId != null) {
      const order = await this.getOrder(returnRequest.orderId);
      if (order) {
        notifyOrderChange({
          customerId: order.customerId ?? null,
          shopId: order.shopId ?? null,
          orderId: order.id,
        });
      }
    }
  }

  // Enhanced notification operations
  async sendSMSNotification(phone: string, message: string): Promise<void> {
    // In a real implementation, this would integrate with an SMS service
    logger.info(`SMS to ${phone}: ${message}`);
  }

  // Enhanced order tracking
  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    trackingInfo?: string,
  ): Promise<Order> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    const statusUpdate = {
      orderId,
      status,
      trackingInfo,
      timestamp: new Date(),
    };

    if (!this.orderStatusUpdates.has(orderId)) {
      this.orderStatusUpdates.set(orderId, []);
    }
    this.orderStatusUpdates.get(orderId)!.push(statusUpdate);

    order.status = status;
    this.orders.set(orderId, order);
    notifyOrderChange({
      customerId: order.customerId ?? null,
      shopId: order.shopId ?? null,
      orderId,
    });
    return order;
  }

  async getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]> {
    return this.orderStatusUpdates.get(orderId) || [];
  }

  async updateProviderProfile(
    id: number,
    profile: Partial<User>,
  ): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error("Provider not found");
    const updated = { ...existing, ...profile };
    this.users.set(id, updated);
    return updated;
  }

  async updateProviderAvailability(
    providerId: number,
    availability: {
      days: string[];
      hours: { start: string; end: string };
      breaks: { start: string; end: string }[];
    },
  ): Promise<void> {
    this.providerAvailability.set(providerId, availability);
  }

  async getProviderAvailability(providerId: number): Promise<{
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  } | null> {
    return this.providerAvailability.get(providerId) || null;
  }

  async updateBookingStatus(
    id: number,
    status: "pending" | "completed" | "cancelled" | "confirmed",
    comment?: string,
  ): Promise<Booking> {
    const booking = await this.getBooking(id);
    if (!booking) throw new Error("Booking not found");

    // Create notification for status update
    const customer =
      booking.customerId !== null
        ? await this.getUser(booking.customerId)
        : undefined;
    if (customer) {
      await this.createNotification({
        userId: customer.id,
        type: "booking",
        title: `Booking ${status === "confirmed" ? "accepted" : status}`,
        message:
          comment ||
          `Your booking has been ${status === "confirmed" ? "accepted" : status}.`,
      });

      // Send SMS for important status updates
      if (["confirmed", "cancelled"].includes(status)) {
        await this.sendSMSNotification(
          customer.phone,
          `Your booking has been ${status === "confirmed" ? "accepted" : status}. ${comment || ""}`,
        );
      }
    }

    // Map "confirmed" to "accepted" to match the expected type
    let mappedStatus:
      | "pending"
      | "completed"
      | "cancelled"
      | "accepted"
      | "rejected"
      | "rescheduled"
      | "expired" =
      status === "confirmed"
        ? "accepted"
        : (status as
            | "pending"
            | "completed"
            | "cancelled"
            | "accepted"
            | "rejected"
            | "rescheduled"
            | "expired");
    const finalUpdated = {
      ...booking,
      status: mappedStatus,
      statusComment: comment || null,
    };
    this.bookings.set(id, finalUpdated);
    return finalUpdated;
  }

  async getBookingsByService(
    serviceId: number,
    date: Date,
  ): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) =>
        booking.serviceId === serviceId &&
        booking.bookingDate.toDateString() === date.toDateString(),
    );
  }

  async getProviderSchedule(
    providerId: number,
    date: Date,
  ): Promise<Booking[]> {
    const services = await this.getServicesByProvider(providerId);
    const serviceIds = services.map((s) => s.id);

    return Array.from(this.bookings.values()).filter(
      (booking) =>
        booking.serviceId !== null &&
        serviceIds.includes(booking.serviceId) &&
        booking.bookingDate.toDateString() === date.toDateString(),
    );
  }

  async completeService(bookingId: number): Promise<Booking> {
    return this.updateBookingStatus(
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

    const newReview = await this.createReview({
      ...review,
      bookingId,
      serviceId: booking.serviceId,
    });

    // Notify provider about new review
    const service = await this.getService(booking.serviceId!);
    if (service) {
      await this.createNotification({
        userId: service.providerId,
        type: "review",
        title: "New Review Received",
        message: `You received a ${newReview.rating}-star review for ${service.name}.`,
      });
    }

    return newReview;
  }

  async respondToReview(reviewId: number, response: string): Promise<Review> {
    const review = await this.reviews.get(reviewId);
    if (!review) throw new Error("Review not found");

    const updated = {
      ...review,
      providerResponse: response,
      respondedAt: new Date(),
    };

    this.reviews.set(reviewId, updated);
    return updated;
  }

  // Add new methods for blocked time slots
  async getBlockedTimeSlots(serviceId: number): Promise<BlockedTimeSlot[]> {
    return this.blockedTimeSlots.get(serviceId) || [];
  }

  async createBlockedTimeSlot(
    data: InsertBlockedTimeSlot,
  ): Promise<BlockedTimeSlot> {
    const id = this.currentId++;
    const newSlot = { ...data, id };

    if (!this.blockedTimeSlots.has(data.serviceId)) {
      this.blockedTimeSlots.set(data.serviceId, []);
    }
    this.blockedTimeSlots.get(data.serviceId)!.push(newSlot);

    return newSlot;
  }

  async deleteBlockedTimeSlot(slotId: number): Promise<void> {
    // Convert entries to an array to allow iteration without --downlevelIteration
    const entries = Array.from(this.blockedTimeSlots.entries());
    for (const [serviceId, slots] of entries) {
      const index = slots.findIndex((slot) => slot.id === slotId);
      if (index !== -1) {
        slots.splice(index, 1);
        // If no slots left for this service, remove the key
        if (slots.length === 0) {
          this.blockedTimeSlots.delete(serviceId);
        } else {
          this.blockedTimeSlots.set(serviceId, slots);
        }
        return;
      }
    }
  }

  async getOverlappingBookings(
    serviceId: number,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<Booking[]> {
    const bookings = Array.from(this.bookings.values()).filter(
      (booking) =>
        booking.serviceId === serviceId &&
        booking.bookingDate.toDateString() === date.toDateString(),
    );

    const bookingStart = new Date(`${date.toDateString()} ${startTime}`);
    const bookingEnd = new Date(`${date.toDateString()} ${endTime}`);

    return bookings.filter((booking) => {
      if (booking.serviceId === null) return false;
      const existingStart = new Date(booking.bookingDate);
      const service = this.services.get(booking.serviceId);
      if (!service) return false;

      const existingEnd = new Date(
        existingStart.getTime() + service.duration * 60000,
      );

      return (
        (bookingStart >= existingStart && bookingStart < existingEnd) ||
        (bookingEnd > existingStart && bookingEnd <= existingEnd) ||
        (bookingStart <= existingStart && bookingEnd >= existingEnd)
      );
    });
  }

  async initializeSampleData() {
    // Create a service provider
    const provider = await this.createUser({
      username: "serviceProvider1",
      password: "password123",
      role: "provider",
      name: "Wellness Spa",
      phone: "+91-9876543210",
      email: "spa@example.com",
      addressStreet: "123 Main St",
      addressCity: "Mumbai",
      addressState: null,
      addressPostalCode: null,
      addressCountry: null,
      language: "en",
      profilePicture: null,
      paymentMethods: undefined,
      emailVerified: false,
      averageRating: "",
      totalReviews: 0,
    });

    logger.info("Created provider:", provider);

    // Create sample services
    const services = [
      {
        name: "Full Body Massage",
        description: "60-minute relaxing massage therapy",
        price: "1500",
        duration: 60,
        category: "Wellness",
        providerId: provider.id,
        isAvailable: true,
        bufferTime: 15,
        images: ["https://example.com/massage.jpg"],
        workingHours: {
          monday: { isAvailable: false, start: "", end: "" },
          tuesday: { isAvailable: false, start: "", end: "" },
          wednesday: { isAvailable: false, start: "", end: "" },
          thursday: { isAvailable: false, start: "", end: "" },
          friday: { isAvailable: false, start: "", end: "" },
          saturday: { isAvailable: false, start: "", end: "" },
          sunday: { isAvailable: false, start: "", end: "" },
        },
        breakTime: [],
        maxDailyBookings: 5,
        serviceLocationType: "provider_location" as "provider_location",
      },
      {
        name: "Hair Styling",
        description: "Professional hair styling and treatment",
        price: "1000",
        duration: 45,
        category: "Beauty",
        providerId: provider.id,
        isAvailable: true,
        bufferTime: 10,
        images: ["https://example.com/hairstyle.jpg"],
        location: { lat: 19.076, lng: 72.8777 },
        workingHours: {
          monday: { isAvailable: false, start: "", end: "" },
          tuesday: { isAvailable: false, start: "", end: "" },
          wednesday: { isAvailable: false, start: "", end: "" },
          thursday: { isAvailable: false, start: "", end: "" },
          friday: { isAvailable: false, start: "", end: "" },
          saturday: { isAvailable: false, start: "", end: "" },
          sunday: { isAvailable: false, start: "", end: "" },
        },
        breakTime: [],
        maxDailyBookings: 5,
        serviceLocationType: "provider_location",
      },
    ] as InsertService[]; // Explicitly type the array

    const createdServices = [];
    for (const service of services) {
      const createdService = await this.createService(service);
      logger.info("Created service:", createdService);
      createdServices.push(createdService);
    }

    // Create a shop owner
    const shop = await this.createUser({
      username: "shopowner1",
      password: "password123",
      role: "shop",
      name: "Fashion Store",
      phone: "+91-9876543211",
      email: "fashion@example.com",
      addressStreet: "456 Market St",
      addressCity: "Delhi",
      addressState: "Delhi",
      addressPostalCode: "110001",
      addressCountry: "India",
      language: "en",
      profilePicture: null,
      paymentMethods: undefined,
      emailVerified: false,
      averageRating: "",
      totalReviews: 0,
    });

    // Create sample products
    const products = [
      {
        name: "Designer T-Shirt",
        description: "100% cotton premium t-shirt",
        price: "999",
        stock: 50,
        category: "Clothing",
        shopId: shop.id,
        isAvailable: true,
        images: ["https://example.com/tshirt.jpg"],
        discount: "10",
      },
      {
        name: "Leather Wallet",
        description: "Genuine leather wallet with card slots",
        price: "1499",
        stock: 30,
        category: "Accessories",
        shopId: shop.id,
        isAvailable: true,
        images: ["https://example.com/wallet.jpg"],
        discount: null,
      },
    ];

    for (const product of products) {
      await this.createProduct({ ...product, mrp: product.price });
    }
  }
}

// Import the PostgreSQL storage implementation
import { PostgresStorage } from "./pg-storage";

const isTestEnv = process.env.NODE_ENV === "test";
const requestedInMemory = process.env.USE_IN_MEMORY_DB === "true";
const runningUnderPm2 =
  typeof process.env.PM2_HOME === "string" ||
  typeof process.env.pm_id === "string" ||
  typeof process.env.PM2_ID === "string";

const shouldUseInMemory = isTestEnv || (!runningUnderPm2 && requestedInMemory);

if (!isTestEnv && runningUnderPm2 && requestedInMemory) {
  logger.warn(
    "Detected PM2 cluster mode. Ignoring USE_IN_MEMORY_DB and using the PostgreSQL session store instead.",
  );
}

export const storage = shouldUseInMemory ? new MemStorage() : new PostgresStorage();

if (shouldUseInMemory) {
  const message =
    "Using in-memory storage for application data and sessions. This configuration is not shared across processes.";
  if (isTestEnv) {
    logger.info({ testEnv: true }, message);
  } else {
    logger.warn(message);
  }
} else {
  logger.info(
    {
      pm2: runningUnderPm2,
    },
    "Using PostgreSQL-backed storage for application data and sessions.",
  );
}
