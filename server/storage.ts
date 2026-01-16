import session from "express-session";
import { createRequire } from "node:module";
import logger from "./logger";
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
  TimeSlotLabel,
  FcmToken,
  InsertFcmToken,
} from "@shared/schema";

export type OrderStatus =
  | "pending"
  | "awaiting_customer_agreement"
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
> & {
  catalogModeEnabled?: boolean;
  openOrderMode?: boolean;
  allowPayLater?: boolean;
};

export interface OrderStatusUpdate {
  orderId: number;
  status: OrderStatus;
  trackingInfo?: string | null;
  timestamp: Date;
}
export interface CustomerSpendTotal {
  customerId: number;
  name: string | null;
  phone: string | null;
  totalSpent: number;
  orderCount: number;
}

export interface ItemSalesTotal {
  productId: number;
  name: string | null;
  quantity: number;
  totalAmount: number;
}

export type BookingCreateOptions = {
  notification?: InsertNotification | null;
};

export type BookingUpdateOptions = {
  notification?: InsertNotification | null;
};

export interface DashboardStats {
  pendingOrders: number;
  ordersInProgress: number;
  completedOrders: number;
  totalProducts: number;
  lowStockItems: number;
  earningsToday: number;
  earningsMonth: number;
  earningsTotal: number;
  customerSpendTotals: CustomerSpendTotal[];
  itemSalesTotals: ItemSalesTotal[];
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
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  // Note: getUserByGoogleId removed - no longer using Google OAuth
  getAllUsers(options?: { limit?: number; offset?: number }): Promise<User[]>;
  getUsersByIds(ids: number[]): Promise<User[]>;
  getShops(filters?: {
    locationCity?: string;
    locationState?: string;
    excludeOwnerId?: number;
    limit?: number;
  }): Promise<User[]>;
  getShopByOwnerId(ownerId: number): Promise<{ id: number; ownerId: number } | undefined>;
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
  createBooking(booking: InsertBooking, options?: BookingCreateOptions): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByCustomer(
    customerId: number,
    filters?: { status?: Booking["status"]; limit?: number; offset?: number },
  ): Promise<Booking[]>;
  getBookingsByProvider(
    providerId: number,
    options?: { page: number; limit: number },
  ): Promise<{ data: Booking[]; total: number; totalPages: number }>;
  getBookingsByStatus(status: string, limit?: number): Promise<Booking[]>;
  updateBooking(
    id: number,
    booking: Partial<Booking>,
    options?: BookingUpdateOptions,
  ): Promise<Booking>;
  getPendingBookingRequestsForProvider(providerId: number): Promise<Booking[]>; // Added
  getBookingHistoryForProvider(
    providerId: number,
    options?: { page: number; limit: number },
  ): Promise<{ data: Booking[]; total: number; totalPages: number }>; // Added
  getBookingHistoryForCustomer(customerId: number): Promise<Booking[]>; // Added
  getBookingRequestsWithStatusForCustomer(customerId: number): Promise<Booking[]>;
  getBookingsWithRelations(ids: number[]): Promise<BookingWithRelations[]>;
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
  getLowStockProducts(options?: {
    shopId?: number;
    threshold?: number;
    limit?: number;
  }): Promise<Product[]>;
  bulkUpdateProductStock(
    updates: { productId: number; stock: number; lowStockThreshold?: number | null }[],
  ): Promise<Product[]>;

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
    filters?: { status?: Order["status"]; limit?: number; offset?: number },
  ): Promise<Order[]>;
  getOrdersByShop(shopId: number, status?: string | string[], options?: { limit?: number; offset?: number }): Promise<Order[]>;
  getRecentOrdersByShop(shopId: number): Promise<Order[]>;
  getShopDashboardStats(shopId: number): Promise<DashboardStats>;
  getPayLaterOutstandingAmounts(
    shopId: number,
    customerIds: number[],
  ): Promise<Record<number, number>>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order>;

  // Order items operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrder(orderId: number): Promise<OrderItem[]>;
  getOrderItemsByOrder(orderId: number): Promise<OrderItem[]>;
  getOrderItemsByOrderIds(orderIds: number[]): Promise<OrderItem[]>;
  getOrdersWithRelations(ids: number[]): Promise<OrderWithRelations[]>;

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
  getNotificationsByUser(
    userId: number,
    options?: { page: number; limit: number },
  ): Promise<{ data: Notification[]; total: number; totalPages: number }>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;

  // FCM Token operations for push notifications
  createOrUpdateFcmToken(token: InsertFcmToken): Promise<FcmToken>;
  getFcmTokensByUserId(userId: number): Promise<FcmToken[]>;
  deleteFcmToken(token: string): Promise<void>;
  deleteFcmTokensByUserId(userId: number): Promise<void>;

  // Promotion operations
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  getPromotionsByShop(shopId: number): Promise<Promotion[]>;

  // Additional booking operations
  checkAvailability(
    serviceId: number,
    date: Date,
    timeSlotLabel?: TimeSlotLabel | null,
  ): Promise<boolean>;
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

  // Global search across services, products, and shops
  globalSearch(params: GlobalSearchParams): Promise<GlobalSearchResult[]>;
}

// Types for global search
export interface GlobalSearchParams {
  query: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit: number;
  excludeUserId?: number; // Exclude user's own services, products, and shops
}

export type GlobalSearchResult =
  | {
    type: "service";
    id: number;
    serviceId: number;
    name: string | null;
    description: string | null;
    price: string | null;
    image: string | null;
    providerId: number | null;
    providerName: string | null;
    location: { city: string | null; state: string | null };
    distanceKm: number | null;
  }
  | {
    type: "product";
    id: number;
    productId: number;
    shopId: number | null;
    name: string | null;
    description: string | null;
    price: string | null;
    image: string | null;
    shopName: string | null;
    location: { city: string | null; state: string | null };
    distanceKm: number | null;
  }
  | {
    type: "shop";
    id: number;
    shopId: number;
    name: string | null;
    description: string | null;
    image: string | null;
    location: { city: string | null; state: string | null };
    distanceKm: number | null;
  };

export type BookingWithRelations = Booking & {
  service: (Service & { provider: User | null }) | null;
  customer: User | null;
};

export type OrderWithRelations = Order & {
  items: (OrderItem & { product: Product | null })[];
  shop: User | null;
  customer: User | null;
};

const require = createRequire(import.meta.url);

// Always use PostgresStorage - in-memory mode is no longer supported
const { PostgresStorage } = require("./pg-storage") as typeof import("./pg-storage");
export const storage: IStorage = new PostgresStorage();

const runningUnderPm2 =
  typeof process.env.PM2_HOME === "string" ||
  typeof process.env.pm_id === "string" ||
  typeof process.env.PM2_ID === "string";

logger.info(
  {
    pm2: runningUnderPm2,
  },
  "Using PostgreSQL-backed storage for application data. Session storage is configured separately (Redis when available).",
);
