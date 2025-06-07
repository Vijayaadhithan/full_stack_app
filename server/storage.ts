import session from "express-session";
import createMemoryStore from "memorystore";
import {
  User, InsertUser,
  Service, InsertService,
  Booking, InsertBooking,
  Product, InsertProduct,
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  Review, InsertReview,
  Notification, InsertNotification,
  ReturnRequest, InsertReturnRequest,
  Promotion, InsertPromotion,
  UserRole
} from "@shared/schema";
import { newIndianDate, formatIndianDisplay } from "../shared/date-utils";

const MemoryStore = createMemoryStore(session);

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "shipped" | "delivered";
export interface OrderStatusUpdate {
  orderId: number;
  status: OrderStatus;
  trackingInfo?: string;
  timestamp: Date;
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

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>; // Added for Google OAuth
  getUserByGoogleId(googleId: string): Promise<User | undefined>; // Added for Google OAuth
  getAllUsers(): Promise<User[]>;
  getShops(filters?: { locationCity?: string; locationState?: string }): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>; // Updated to accept all partial User fields

  // Service operations
  createService(service: InsertService): Promise<Service>;
  getService(id: number): Promise<Service | undefined>;
  getServicesByProvider(providerId: number): Promise<Service[]>;
  getServicesByCategory(category: string): Promise<Service[]>;
  updateService(id: number, service: Partial<Service>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  getServices(filters?: any): Promise<Service[]>; // Added filters parameter

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByCustomer(customerId: number): Promise<Booking[]>;
  getBookingsByProvider(providerId: number): Promise<Booking[]>;
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
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getProducts(filters?: any): Promise<Product[]>; // Added filters parameter
  removeProductFromAllCarts(productId: number): Promise<void>;

  // Cart operations
  addToCart(customerId: number, productId: number, quantity: number): Promise<void>;
  removeFromCart(customerId: number, productId: number): Promise<void>;
  getCart(customerId: number): Promise<{ product: Product; quantity: number }[]>;
  clearCart(customerId: number): Promise<void>;

  // Wishlist operations
  addToWishlist(customerId: number, productId: number): Promise<void>;
  removeFromWishlist(customerId: number, productId: number): Promise<void>;
  getWishlist(customerId: number): Promise<Product[]>;

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: number): Promise<Order[]>;
  getOrdersByShop(shopId: number): Promise<Order[]>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order>;

  // Order items operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrder(orderId: number): Promise<OrderItem[]>;

  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReviewsByService(serviceId: number): Promise<Review[]>;
  getReviewsByProvider(providerId: number): Promise<Review[]>;
  getReviewsByCustomer(customerId: number): Promise<Review[]>; 
  getReviewById(id: number): Promise<Review | undefined>;
  updateReview(id: number, data: { rating?: number; review?: string }): Promise<Review>;
  updateCustomerReview(reviewId: number, customerId: number, data: { rating?: number; review?: string }): Promise<Review>;
  
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
  joinWaitlist(customerId: number, serviceId: number, preferredDate: Date): Promise<void>;
  getWaitlistPosition(customerId: number, serviceId: number): Promise<number>;


  // Return and refund operations
  createReturnRequest(returnRequest: InsertReturnRequest): Promise<ReturnRequest>;
  getReturnRequest(id: number): Promise<ReturnRequest | undefined>;
  getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]>;
  updateReturnRequest(id: number, returnRequest: Partial<ReturnRequest>): Promise<ReturnRequest>;
  processRefund(returnRequestId: number): Promise<void>;

  // Enhanced notification operations
  sendSMSNotification(phone: string, message: string): Promise<void>;
  sendEmailNotification(email: string, subject: string, message: string): Promise<void>;

  // Enhanced order tracking
  updateOrderStatus(orderId: number, status: OrderStatus, trackingInfo?: string): Promise<Order>;
  getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]>;

  //Session store
  sessionStore: session.Store;

  // Enhanced provider profile operations
  updateProviderProfile(id: number, profile: Partial<User>): Promise<User>;
  updateProviderAvailability(providerId: number, availability: {
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  }): Promise<void>;
  getProviderAvailability(providerId: number): Promise<{
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  } | null>;

  // Enhanced booking operations
  updateBookingStatus(
    id: number,
    status: "pending" | "confirmed" | "completed" | "cancelled",
    comment?: string
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
    endTime: string
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
  private blockedTimeSlots: Map<number, BlockedTimeSlot[]>; // Add new map for blocked slots
  sessionStore: session.Store;
  private currentId: number;
  private providerAvailability: Map<number, {
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  }>;

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
      console.warn(`[MemStorage] User with ID ${userId} not found for deletion.`);
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
      }
    });
    orderIdsToDelete.forEach(id => this.orders.delete(id));

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
    serviceIdsToDelete.forEach(id => this.services.delete(id));
    this.providerAvailability.delete(userId);


    // Products sold by the user (as shop owner - assuming shopId might be userId)
    const productIdsToDelete: number[] = [];
    this.products.forEach((product, productId) => {
      if (product.shopId === userId) { // Assuming shopId is the userId of the shop owner
        productIdsToDelete.push(productId);
        // Remove this product from all carts and wishlists (if not already handled by customer-specific deletion)
        this.cart.forEach(userCart => userCart.delete(productId));
        this.wishlist.forEach(userWishlist => userWishlist.delete(productId));
      }
    });
    productIdsToDelete.forEach(id => this.products.delete(id));

    // Promotions by the user's shop
    // MemStorage doesn't have a promotions map directly, this would be part of a more complex setup
    // or promotions are linked via shopId which is userId.
    // For now, we assume if promotions were stored, they'd be keyed by shopId (userId).

    // Finally, delete the user
    this.users.delete(userId);

    console.log(`[MemStorage] User ${userId} and all associated data deleted.`);
  }
  getPendingBookingRequestsForProvider(providerId: number): Promise<Booking[]> {
    throw new Error("Method not implemented.");
  }
  getBookingHistoryForProvider(providerId: number): Promise<Booking[]> {
    throw new Error("Method not implemented.");
  }
  getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
    throw new Error("Method not implemented.");
  }
  processExpiredBookings(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    throw new Error("Method not implemented.");
  }
  getPromotionsByShop(shopId: number): Promise<Promotion[]> {
    throw new Error("Method not implemented.");
  }

  // Add implementation for getProducts
  async getProducts(filters?: { category?: string; isAvailable?: boolean }): Promise<Product[]> {
    let results = Array.from(this.products.values()).filter(p => !p.isDeleted);
    if (filters) {
      if (filters.category) {
        results = results.filter(p => p.category === filters.category);
      }
      if (typeof filters.isAvailable === 'boolean') {
        results = results.filter(p => p.isAvailable === filters.isAvailable);
      }
    }
    return results;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    console.log("[Storage] getUser - Looking for user with ID:", id);
    const user = this.users.get(id);
    console.log("[Storage] getUser - Found user:", user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const user of Array.from(this.users.values())) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
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
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getShops(filters?: { locationCity?: string; locationState?: string }): Promise<User[]> {
    let shops = Array.from(this.users.values()).filter(u => u.role === 'shop');
    if (filters) {
      if (filters.locationCity) {
        shops = shops.filter(s => s.addressCity === filters.locationCity);
      }
      if (filters.locationState) {
        shops = shops.filter(s => s.addressState === filters.locationState);
      }
    }
    return shops;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = {
      id,
      username: insertUser.username ?? "",
      password: insertUser.password!,
      role: insertUser.role as UserRole,
      name: insertUser.name,
      phone: insertUser.phone,
      email: insertUser.email,
      addressStreet: insertUser.addressStreet === undefined ? null : insertUser.addressStreet,
      addressCity: insertUser.addressCity === undefined ? null : insertUser.addressCity,
      addressState: insertUser.addressState === undefined ? null : insertUser.addressState,
      addressPostalCode: insertUser.addressPostalCode === undefined ? null : insertUser.addressPostalCode,
      addressCountry: insertUser.addressCountry === undefined ? null : insertUser.addressCountry,
      language: insertUser.language === undefined ? null : insertUser.language,
      profilePicture: insertUser.profilePicture === undefined ? null : insertUser.profilePicture,
      paymentMethods: Array.isArray(insertUser.paymentMethods)
        ? insertUser.paymentMethods.map(pm => ({
          type: (pm as any).type || "default",
          details: (pm as any).details || {}
        }))
        : null,
      shopProfile: null,
      bio: null,
      qualifications: null,
      experience: null,
      workingHours: null,
      languages: null,
      googleId: null,
      emailVerified: null,
      razorpayLinkedAccountId: null,
      verificationStatus: null,
      verificationDocuments: null,
      profileCompleteness: null,
      specializations: null,
      certifications: null,
      shopBannerImageUrl: null,
      shopLogoImageUrl: null,
      yearsInBusiness: null,
      socialMediaLinks: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> { // Modified to accept Partial<User> to include googleId
    const existing = this.users.get(id);
    if (!existing) throw new Error("User not found");

    // Ensure password is not accidentally overwritten with undefined if not provided in data
    const { password, ...restOfData } = updateData;
    const updatedUserData = { ...existing, ...restOfData };

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
      addressStreet: service.addressStreet === undefined ? null : service.addressStreet,
      addressCity: service.addressCity === undefined ? null : service.addressCity,
      addressState: service.addressState === undefined ? null : service.addressState,
      addressPostalCode: service.addressPostalCode === undefined ? null : service.addressPostalCode,
      addressCountry: service.addressCountry === undefined ? null : service.addressCountry,
      providerId: service.providerId === undefined ? null : service.providerId,
      isAvailable: service.isAvailable === undefined ? null : service.isAvailable,
      serviceLocationType: (service.serviceLocationType === undefined ? "provider_location" : 
        (service.serviceLocationType === "customer_location" || service.serviceLocationType === "provider_location" ? 
          service.serviceLocationType : "provider_location")) as "customer_location" | "provider_location",
      images: service.images === undefined ? null : service.images,
      bufferTime: service.bufferTime === undefined ? null : service.bufferTime,
      workingHours: service.workingHours === undefined ? {
         monday: { isAvailable: false, start: "", end: "" },
         tuesday: { isAvailable: false, start: "", end: "" },
         wednesday: { isAvailable: false, start: "", end: "" },
         thursday: { isAvailable: false, start: "", end: "" },
         friday: { isAvailable: false, start: "", end: "" },
         saturday: { isAvailable: false, start: "", end: "" },
         sunday: { isAvailable: false, start: "", end: "" },
      } : service.workingHours,
      breakTime: service.breakTime == null ? [] : service.breakTime,
      maxDailyBookings: service.maxDailyBookings === undefined ? 5 : service.maxDailyBookings,
      isDeleted: false
    };
    this.services.set(id, newService);
    return newService;
  }

  async getService(id: number): Promise<Service | undefined> {
    console.log("[Storage] getService - Looking for service with ID:", id);
    console.log("[Storage] getService - Available services:", Array.from(this.services.entries()));
    const service = this.services.get(id);
    console.log("[Storage] getService - Found service:", service);
    return service;
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

  async getServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.currentId++;
    const newBooking: Booking = {
      id,
      createdAt: new Date(),
      ...booking, 
// Remove duplicate id property since it's already included in the spread operator
      serviceLocation: booking.serviceLocation ?? null, // Ensure serviceLocation defaults to null
      status: "pending",
      customerId: booking.customerId ?? null,
      serviceId: booking.serviceId ?? null,
      rejectionReason: booking.rejectionReason ?? null,
      providerAddress: booking.providerAddress ?? null,
      bookingDate: booking.bookingDate,
      rescheduleDate: booking.rescheduleDate === undefined ? null : booking.rescheduleDate,
      comments: booking.comments === undefined ? null : booking.comments,
      paymentStatus: "pending",
      eReceiptId: null,
      eReceiptUrl: null,
      eReceiptGeneratedAt: null,
      razorpayPaymentId: null,
      razorpayOrderId: null,
      expiresAt: null
    };
    this.bookings.set(id, newBooking);
    return newBooking;
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByCustomer(customerId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.customerId === customerId,
    );
  }

  async getBookingsByProvider(providerId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter((booking) => {
      if (booking.serviceId === null) return false;
      const service = this.services.get(booking.serviceId);
      return service?.providerId === providerId;
    });
  }

  async updateBooking(id: number, booking: Partial<Booking>): Promise<Booking> {
    const existing = this.bookings.get(id);
    if (!existing) throw new Error("Booking not found");
    const updated = { ...existing, ...booking };
    this.bookings.set(id, updated);
    return updated;
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentId++;
    const newProduct = { 
      ...product, 
      id,
      shopId: product.shopId === undefined ? null : product.shopId,
      isAvailable: product.isAvailable === undefined ? null : product.isAvailable,
      isDeleted: product.isDeleted === undefined ? null : product.isDeleted,
      createdAt: product.createdAt === undefined ? null : product.createdAt,
      updatedAt: product.updatedAt === undefined ? null : product.updatedAt,
      images: product.images === undefined ? null : product.images,
      sku: product.sku === undefined ? null : product.sku,
      barcode: product.barcode === undefined ? null : product.barcode,
      weight: product.weight === undefined ? null : product.weight,
      dimensions: product.dimensions === undefined ? null : product.dimensions,
      specifications: product.specifications === undefined ? null : product.specifications,
      tags: product.tags === undefined ? null : product.tags,
      minOrderQuantity: product.minOrderQuantity === undefined ? null : product.minOrderQuantity,
      maxOrderQuantity: product.maxOrderQuantity === undefined ? null : product.maxOrderQuantity,
      lowStockThreshold: product.lowStockThreshold === undefined ? null : product.lowStockThreshold,
      mrp: product.mrp === undefined ? product.price : product.mrp
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
      lowStockThreshold: newProduct.lowStockThreshold ?? null
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
  lowStockThreshold: newProduct.lowStockThreshold ?? null
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

  async deleteProduct(id: number): Promise<void> {
    const existing = this.products.get(id);
    if (!existing) throw new Error("Product not found");
    this.products.delete(id);
  }

  async removeProductFromAllCarts(productId: number): Promise<void> {
    // Iterate through all customer carts
    for (const [customerId, customerCart] of Array.from(this.cart.entries())) {
      // Remove the product if it exists in this customer's cart
      if (customerCart.has(productId)) {
        customerCart.delete(productId);
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
  async addToCart(customerId: number, productId: number, quantity: number): Promise<void> {
    console.log(`[MemStorage] Attempting to add product ID ${productId} to cart for customer ID ${customerId} with quantity ${quantity}`);
    if (quantity <= 0) {
      console.error(`[MemStorage] Invalid quantity ${quantity} for product ID ${productId}`);
      throw new Error("Quantity must be positive");
    }

    // Get the product being added to find its shopId
    const productToAdd = this.products.get(productId);
    if (!productToAdd) {
      console.error(`[MemStorage] Product ID ${productId} not found`);
      throw new Error("Product not found");
    }
    const shopIdToAdd = productToAdd.shopId;
    console.log(`[MemStorage] Product ID ${productId} belongs to shop ID ${shopIdToAdd}`);

    // Get current cart items
    const customerCart = this.cart.get(customerId);

    if (customerCart && customerCart.size > 0) {
      console.log(`[MemStorage] Customer ID ${customerId} has ${customerCart.size} item(s) in cart`);
      // If cart is not empty, check if the new item's shop matches the existing items' shop
      const firstCartEntry = customerCart.entries().next().value; // Get the first [productId, quantity] pair
      const firstProductId = firstCartEntry ? firstCartEntry[0] : null;
      if (firstProductId === null) {
        throw new Error("Unexpected empty cart encountered.");
      }
      console.log(`[MemStorage] First item in cart has product ID ${firstProductId}`);
      const firstProduct = this.products.get(firstProductId);

      if (firstProduct) {
        const existingShopId = firstProduct.shopId;
        console.log(`[MemStorage] Existing items in cart belong to shop ID ${existingShopId}`);
        if (shopIdToAdd !== existingShopId) {
          console.error(`[MemStorage] Shop ID mismatch: Cannot add product from shop ${shopIdToAdd} to cart containing items from shop ${existingShopId}`);
          throw new Error("Cannot add items from different shops to the cart. Please clear your cart or checkout with items from the current shop.");
        }
      } else {
        // This case should ideally not happen if data is consistent, but log it.
        console.warn(`[MemStorage] Could not find product details for the first item (ID: ${firstProductId}) in the cart for customer ${customerId}. Proceeding with caution.`);
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
    console.log(`[MemStorage] Setting quantity for product ID ${productId} to ${newQuantity} for customer ID ${customerId}`);
    updatedCustomerCart.set(productId, newQuantity);
    console.log(`[MemStorage] Successfully added/updated product ID ${productId} in cart for customer ID ${customerId}`);
  }

  async removeFromCart(customerId: number, productId: number): Promise<void> {
    if (this.cart.has(customerId)) {
      this.cart.get(customerId)!.delete(productId);
    }
  }

  async getCart(customerId: number): Promise<{ product: Product; quantity: number }[]> {
    if (!this.cart.has(customerId)) return [];
    const cartItems = this.cart.get(customerId)!;
    return Array.from(cartItems.entries()).map(([productId, quantity]) => ({
      product: this.products.get(productId)!,
      quantity,
    }));
  }

  async clearCart(customerId: number): Promise<void> {
    this.cart.delete(customerId);
  }

  // Wishlist operations
  async addToWishlist(customerId: number, productId: number): Promise<void> {
    if (!this.wishlist.has(customerId)) {
      this.wishlist.set(customerId, new Set());
    }
    this.wishlist.get(customerId)!.add(productId);
  }

  async removeFromWishlist(customerId: number, productId: number): Promise<void> {
    if (this.wishlist.has(customerId)) {
      this.wishlist.get(customerId)!.delete(productId);
    }
  }

  async getWishlist(customerId: number): Promise<Product[]> {
    if (!this.wishlist.has(customerId)) return [];
    const wishlistIds = this.wishlist.get(customerId)!;
    return Array.from(wishlistIds).map(id => this.products.get(id)!);
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.currentId++;
    // Exclude properties that can cause type conflicts
    const { status, paymentStatus, returnRequested, eReceiptId, eReceiptUrl, eReceiptGeneratedAt, razorpayPaymentId, razorpayOrderId, ...rest } = order;
    const newOrder = { 
      ...rest,
      id,
      customerId: order.customerId === undefined ? null : order.customerId,
      shopId: order.shopId === undefined ? null : order.shopId,
      status: "pending" as "pending",
      paymentStatus: order.paymentStatus === undefined ? "pending" as "pending" | "paid" | "refunded" : order.paymentStatus as "pending" | "paid" | "refunded",
      returnRequested: order.returnRequested === undefined ? null : order.returnRequested,
      billingAddress: order.billingAddress === undefined ? null : order.billingAddress,
      shippingAddress: order.shippingAddress === undefined || order.shippingAddress === null ? "" : order.shippingAddress,
      total: order.total === undefined ? "0" : order.total,
      orderDate: order.orderDate === undefined ? new Date() : order.orderDate,
      notes: order.notes === undefined ? null : order.notes,
      // Removed shippingMethod property as it does not exist on type InsertOrder.
      paymentMethod: order.paymentMethod === undefined ? null : order.paymentMethod,
      trackingInfo: null,
      eReceiptId: null,
      eReceiptUrl: null,
      eReceiptGeneratedAt: null,
      razorpayPaymentId: null,
      razorpayOrderId: null
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByCustomer(customerId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.customerId === customerId,
    );
  }

  async getOrdersByShop(shopId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.shopId === shopId,
    );
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    const existing = this.orders.get(id);
    if (!existing) throw new Error("Order not found");
    const updated = { ...existing, ...order };
    this.orders.set(id, updated);
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
      status: newOrderItem.status as "cancelled" | "returned" | "ordered" | null,
      orderId: newOrderItem.orderId ?? null,
      productId: newOrderItem.productId ?? null,
      discount: newOrderItem.discount ?? null
    });
    return {
      id: newOrderItem.id,
      status: newOrderItem.status as "cancelled" | "returned" | "ordered" | null,
      total: newOrderItem.total,
      orderId: newOrderItem.orderId ?? null,
      price: newOrderItem.price,
      productId: newOrderItem.productId ?? null,
      quantity: newOrderItem.quantity,
      discount: newOrderItem.discount ?? null
    };
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(
      (item) => item.orderId === orderId,
    );
  }

  // Review operations
  async createReview(review: InsertReview): Promise<Review> {
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
      isVerifiedService: newReview.isVerifiedService || null
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
      isVerifiedService: newReview.isVerifiedService ?? null
    };
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(
      (review) => review.serviceId === serviceId,
    );
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    return Array.from(this.reviews.values()).filter(
      (review) => review.serviceId !== null && serviceIds.includes(review.serviceId),
    );
  }

  async getReviewsByCustomer(customerId: number): Promise<Review[]> { // Added
    const results = Array.from(this.reviews.values()).filter(
      r => r.customerId === customerId,
    );

    return results.map(r => {
      const serviceName = r.serviceId ? this.services.get(r.serviceId)?.name ?? 'Service Not Found' : null;
      return { ...r, serviceName } as Review & { serviceName: string | null };
    });
  }

  async getReviewById(id: number): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async updateReview(id: number, data: { rating?: number; review?: string }): Promise<Review> {
    const review = this.reviews.get(id);
    if (!review) throw new Error("Review not found");
    if (data.rating !== undefined) review.rating = data.rating;
    if (data.review !== undefined) review.review = data.review;
    return review;
  }

  async updateCustomerReview(reviewId: number, customerId: number, data: { rating?: number; review?: string }): Promise<Review> { // Added
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

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.currentId++;
    const newNotification = { ...notification, id };
    this.notifications.set(id, {
          id,
          createdAt: newNotification.createdAt || newIndianDate(), // Use newIndianDate() to create dates in IST
          message: newNotification.message,
          type: newNotification.type as "shop" | "booking" | "order" | "promotion" | "system" | "return" | "service_request" | "service" | "booking_request",
          userId: newNotification.userId || null,
          title: newNotification.title,
          isRead: newNotification.isRead || false,
          relatedBookingId: null
        });
    const finalNotification: Notification = {
      id: newNotification.id,
      userId: newNotification.userId ?? null,
      type: newNotification.type as "shop" | "booking" | "order" | "promotion" | "system" | "return" | "service_request" | "service" | "booking_request",
      title: newNotification.title,
      message: newNotification.message,
      isRead: newNotification.isRead ?? false,
      createdAt: newNotification.createdAt ?? newIndianDate(), // Use newIndianDate() to create dates in IST
      relatedBookingId: null
    };
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
    }
  }

  async markAllNotificationsAsRead(userId: number, role?: string): Promise<void> {
    // Get all notifications for this user
    let userNotifications = await this.getNotificationsByUser(userId);
    
    // Apply role-based filtering if role is provided
    if (role) {
      if (role === 'shop_owner') {
        // Shop owners should not see service notifications
        userNotifications = userNotifications.filter(n => n.type !== 'service');
      } else if (role === 'provider') {
        // Service providers should not see order notifications
        userNotifications = userNotifications.filter(n => n.type !== 'order');
      }
      // For customers, we don't need additional filtering
    }
    
    // Mark filtered notifications as read
    for (const notification of userNotifications) {
      notification.isRead = true;
      this.notifications.set(notification.id, notification);
    }
  }

  async deleteNotification(id: number): Promise<void> {
    this.notifications.delete(id);
  }

  // Availability and waitlist operations
  async checkAvailability(serviceId: number, date: Date): Promise<boolean> {
    const bookings = Array.from(this.bookings.values()).filter(
      (booking) =>
        booking.serviceId === serviceId &&
        booking.bookingDate.toDateString() === date.toDateString()
    );

    const service = await this.getService(serviceId);
    if (!service) return false;

    // Simple availability check - can be enhanced with more complex logic
    return bookings.length < 5; // Assuming max 5 bookings per day
  }

  async joinWaitlist(customerId: number, serviceId: number, preferredDate: Date): Promise<void> {
    if (!this.waitlist.has(serviceId)) {
      this.waitlist.set(serviceId, new Map());
    }
    this.waitlist.get(serviceId)!.set(customerId, preferredDate);
  }

  async getWaitlistPosition(customerId: number, serviceId: number): Promise<number> {
    if (!this.waitlist.has(serviceId)) return -1;
    const waitlist = Array.from(this.waitlist.get(serviceId)!.entries());
    const position = waitlist.findIndex(([id]) => id === customerId);
    return position === -1 ? -1 : position + 1;
  }

  // Return and refund operations
  async createReturnRequest(returnRequest: InsertReturnRequest): Promise<ReturnRequest> {
    const id = this.currentId++;
    const newReturnRequest: ReturnRequest = {
      id,
      customerId: returnRequest.customerId ?? null,
      createdAt: new Date(), // Use current date
      status: (returnRequest.status ?? "requested") as "refunded" | "requested" | "approved" | "rejected" | "received" | "completed", // Default status
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
    return newReturnRequest;
  }

  async getReturnRequest(id: number): Promise<ReturnRequest | undefined> {
    return this.returnRequests.get(id);
  }

  async getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]> {
    return Array.from(this.returnRequests.values()).filter(
      (request) => request.orderId === orderId
    );
  }

  async updateReturnRequest(id: number, returnRequest: Partial<ReturnRequest>): Promise<ReturnRequest> {
    const existing = this.returnRequests.get(id);
    if (!existing) throw new Error("Return request not found");
    const updated = { ...existing, ...returnRequest };
    this.returnRequests.set(id, updated);
    return updated;
  }

  async processRefund(returnRequestId: number): Promise<void> {
    const returnRequest = await this.getReturnRequest(returnRequestId);
    if (!returnRequest) throw new Error("Return request not found");

    // In a real implementation, this would integrate with Razorpay's refund API
    returnRequest.status = "refunded";
    this.returnRequests.set(returnRequestId, returnRequest);
  }

  // Enhanced notification operations
  async sendSMSNotification(phone: string, message: string): Promise<void> {
    // In a real implementation, this would integrate with an SMS service
    console.log(`SMS to ${phone}: ${message}`);
  }

  async sendEmailNotification(email: string, subject: string, message: string): Promise<void> {
    // In a real implementation, this would integrate with an email service
    console.log(`Email to ${email}: ${subject} - ${message}`);
  }

  // Enhanced order tracking
  async updateOrderStatus(orderId: number, status: OrderStatus, trackingInfo?: string): Promise<Order> {
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
    return order;
  }

  async getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]> {
    return this.orderStatusUpdates.get(orderId) || [];
  }

  async updateProviderProfile(id: number, profile: Partial<User>): Promise<User> {
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
    }
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
    comment?: string
  ): Promise<Booking> {
    const booking = await this.getBooking(id);
    if (!booking) throw new Error("Booking not found");

    // Create notification for status update
    const customer = booking.customerId !== null ? await this.getUser(booking.customerId) : undefined;
    if (customer) {
      await this.createNotification({
        userId: customer.id,
        type: "booking",
        title: `Booking ${status === "confirmed" ? "accepted" : status}`,
        message: comment || `Your booking has been ${status === "confirmed" ? "accepted" : status}.`,
      });

      // Send SMS for important status updates
      if (["confirmed", "cancelled"].includes(status)) {
        await this.sendSMSNotification(
          customer.phone,
          `Your booking has been ${status === "confirmed" ? "accepted" : status}. ${comment || ''}`
        );
      }
    }

    // Map "confirmed" to "accepted" to match the expected type
    let mappedStatus: "pending" | "completed" | "cancelled" | "accepted" | "rejected" | "rescheduled" | "expired" =
      status === "confirmed" ? "accepted" : status as "pending" | "completed" | "cancelled" | "accepted" | "rejected" | "rescheduled" | "expired";
    const finalUpdated = {
      ...booking,
      status: mappedStatus,
      statusComment: comment || null,
    };
    this.bookings.set(id, finalUpdated);
    return finalUpdated;
  }

  async getBookingsByService(serviceId: number, date: Date): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(booking =>
      booking.serviceId === serviceId &&
      booking.bookingDate.toDateString() === date.toDateString()
    );
  }

  async getProviderSchedule(providerId: number, date: Date): Promise<Booking[]> {
    const services = await this.getServicesByProvider(providerId);
    const serviceIds = services.map(s => s.id);

    return Array.from(this.bookings.values()).filter(booking =>
      booking.serviceId !== null && serviceIds.includes(booking.serviceId) &&
      booking.bookingDate.toDateString() === date.toDateString()
    );
  }

  async completeService(bookingId: number): Promise<Booking> {
    return this.updateBookingStatus(bookingId, "completed", "Service completed successfully");
  }

  async addBookingReview(bookingId: number, review: InsertReview): Promise<Review> {
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

  async createBlockedTimeSlot(data: InsertBlockedTimeSlot): Promise<BlockedTimeSlot> {
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
      const index = slots.findIndex(slot => slot.id === slotId);
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
    endTime: string
  ): Promise<Booking[]> {
    const bookings = Array.from(this.bookings.values()).filter(
      booking =>
        booking.serviceId === serviceId &&
        booking.bookingDate.toDateString() === date.toDateString()
    );

    const bookingStart = new Date(`${date.toDateString()} ${startTime}`);
    const bookingEnd = new Date(`${date.toDateString()} ${endTime}`);

    return bookings.filter(booking => {
      if (booking.serviceId === null) return false;
      const existingStart = new Date(booking.bookingDate);
      const service = this.services.get(booking.serviceId);
      if (!service) return false;

      const existingEnd = new Date(existingStart.getTime() + service.duration * 60000);

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
      paymentMethods: null,
      emailVerified: false
    });

    console.log("Created provider:", provider);

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
          sunday: { isAvailable: false, start: "", end: "" }
        },
        breakTime: [],
        maxDailyBookings: 5,
        serviceLocationType: "provider_location" as "provider_location"
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
        location: { lat: 19.0760, lng: 72.8777 },
        workingHours: {
          monday: { isAvailable: false, start: "", end: "" },
          tuesday: { isAvailable: false, start: "", end: "" },
          wednesday: { isAvailable: false, start: "", end: "" },
          thursday: { isAvailable: false, start: "", end: "" },
          friday: { isAvailable: false, start: "", end: "" },
          saturday: { isAvailable: false, start: "", end: "" },
          sunday: { isAvailable: false, start: "", end: "" }
        },
        breakTime: [],
        maxDailyBookings: 5,
        serviceLocationType: "provider_location"
      }
    ] as InsertService[]; // Explicitly type the array

    const createdServices = [];
    for (const service of services) {
      const createdService = await this.createService(service);
      console.log("Created service:", createdService);
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
      paymentMethods: null,
      emailVerified: false
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
import { PostgresStorage } from './pg-storage';

// Use PostgreSQL storage for persistence instead of in-memory storage
export const storage = new PostgresStorage();