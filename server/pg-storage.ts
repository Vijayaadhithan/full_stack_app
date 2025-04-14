import session from "express-session";
import pgSession from "connect-pg-simple";
import { db } from "./db";
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
  // Ensure bookingHistory is exported from your shared schema if available.
  users, services, bookings, bookingHistory, products, orders, orderItems, reviews, notifications,
  cart, wishlist, returnRequests, promotions
} from "@shared/schema";
import { IStorage, OrderStatus, OrderStatusUpdate } from "./storage";
import { eq, and, lt, ne } from "drizzle-orm";

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

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PgStore = pgSession(session);
    this.sessionStore = new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: 'sessions',
      createTableIfMissing: true
    });
  }

  // ─── USER OPERATIONS ─────────────────────────────────────────────
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  // ─── SERVICE OPERATIONS ──────────────────────────────────────────
  async createService(service: InsertService): Promise<Service> {
    const result = await db.insert(services).values(service).returning();
    return result[0];
  }

  async getService(id: number): Promise<Service | undefined> {
    console.log("Getting service with ID:", id);
    const result = await db.select().from(services).where(eq(services.id, id));
    console.log("Found service:", result[0]);
    return result[0];
  }

  // Get pending booking requests for a provider
  async getPendingBookingRequestsForProvider(providerId: number): Promise<Booking[]> {
    // Get all services offered by this provider first
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    if (serviceIds.length === 0) return [];

    let pendingBookings: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db.select().from(bookings)
        .where(and(
          eq(bookings.serviceId, serviceId),
          eq(bookings.status, 'pending')
        ));
      pendingBookings = [...pendingBookings, ...serviceBookings];
    }
    return pendingBookings;
  }

  // Get booking history for a provider
  async getBookingHistoryForProvider(providerId: number): Promise<Booking[]> {
    // Get all services offered by this provider first
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    if (serviceIds.length === 0) return [];

    let bookingHistory: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db.select().from(bookings)
        .where(and(
          eq(bookings.serviceId, serviceId),
          ne(bookings.status, 'pending')
        ));
      bookingHistory = [...bookingHistory, ...serviceBookings];
    }
    return bookingHistory;
  }

  // Get booking requests with status for a customer
  async getBookingRequestsWithStatusForCustomer(customerId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.customerId, customerId));
  }

  // Get booking history for a customer
  async getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(and(
        eq(bookings.customerId, customerId),
        ne(bookings.status, 'pending')
      ));
  }

  // Process expired bookings
  async processExpiredBookings(): Promise<void> {
    const now = new Date();
    const expiredBookings = await db.select().from(bookings)
      .where(and(
        eq(bookings.status, 'pending'),
        lt(bookings.expiresAt, now)
      ));

    for (const booking of expiredBookings) {
      await this.updateBooking(booking.id, {
        status: 'expired',
        comments: 'Booking expired automatically',
      });
    }
  }

  async getServicesByProvider(providerId: number): Promise<Service[]> {
    return await db.select().from(services).where(and(
      eq(services.providerId, providerId),
      eq(services.isDeleted, false)
    ));
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    return await db.select().from(services).where(and(
      eq(services.category, category),
      eq(services.isDeleted, false)
    ));
  }

  async updateService(id: number, service: Partial<Service>): Promise<Service> {
    const result = await db.update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
    if (!result[0]) throw new Error("Service not found");
    return result[0];
  }

  async deleteService(id: number): Promise<void> {
    // Instead of deleting, mark as deleted (soft delete)
    const result = await db.update(services)
      .set({ isDeleted: true })
      .where(eq(services.id, id))
      .returning();
    if (!result[0]) throw new Error("Service not found");
  }

  async getServices(): Promise<Service[]> {
    // Only return non-deleted services
    return await db.select().from(services).where(eq(services.isDeleted, false));
  }

  // ─── BOOKING OPERATIONS ──────────────────────────────────────────
  async createBooking(booking: InsertBooking): Promise<Booking> {
    // Set default values for new bookings (e.g. createdAt)
    const bookingWithDefaults = {
      ...booking,
      createdAt: new Date(),
      // expiresAt can be set automatically by a trigger or as needed
    };
    const result = await db.insert(bookings).values(bookingWithDefaults).returning();

    // Add entry to booking history
    await db.insert(bookingHistory).values({
      bookingId: result[0].id,
      status: result[0].status,
      changedAt: new Date(),
      changedBy: booking.customerId,
      comments: 'Booking created'
    });

    return result[0];
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id));
    return result[0];
  }

  async getBookingsByCustomer(customerId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.customerId, customerId));
  }

  async getBookingsByProvider(providerId: number): Promise<Booking[]> {
    // Get all services offered by this provider first
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    if (serviceIds.length === 0) return [];

    let allBookings: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db.select().from(bookings).where(eq(bookings.serviceId, serviceId));
      allBookings = [...allBookings, ...serviceBookings];
    }
    return allBookings;
  }

  async updateBooking(id: number, booking: Partial<Booking>): Promise<Booking> {
    // Get the current booking to track status changes
    const currentBooking = await this.getBooking(id);
    if (!currentBooking) throw new Error("Booking not found");

    const result = await db.update(bookings)
      .set(booking)
      .where(eq(bookings.id, id))
      .returning();

    // If the status changed, add an entry in the booking history table
    if (booking.status && booking.status !== currentBooking.status) {
      await db.insert(bookingHistory).values({
        bookingId: id,
        status: booking.status,
        changedAt: new Date(),
        changedBy: booking.changedBy || null,
        comments: booking.comments || `Status changed from ${currentBooking.status} to ${booking.status}`
      });
      // If status is no longer pending, clear the expiration date
      if (booking.status !== 'pending') {
        await db.update(bookings)
          .set({ expiresAt: null })
          .where(eq(bookings.id, id));
      }
    }

    if (!result[0]) throw new Error("Booking not found");
    return result[0];
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
    return await db.select().from(products).where(and(
      eq(products.shopId, shopId),
      eq(products.isDeleted, false)
    ));
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return await db.select().from(products).where(and(
      eq(products.category, category),
      eq(products.isDeleted, false)
    ));
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const result = await db.update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    if (!result[0]) throw new Error("Product not found");
    return result[0];
  }

  async removeProductFromAllCarts(productId: number): Promise<void> {
    console.log(`Removing product ID ${productId} from all carts`);
    try {
      await db.delete(cart).where(eq(cart.productId, productId));
      console.log(`Successfully removed product ID ${productId} from all carts`);
    } catch (error) {
      console.error(`Error removing product ${productId} from carts:`, error);
      throw new Error(`Failed to remove product from carts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeProductFromAllWishlists(productId: number): Promise<void> {
    console.log(`Removing product ID ${productId} from all wishlists`);
    try {
      await db.delete(wishlist).where(eq(wishlist.productId, productId));
      console.log(`Successfully removed product ID ${productId} from all wishlists`);
    } catch (error) {
      console.error(`Error removing product ${productId} from wishlists:`, error);
      throw new Error(`Failed to remove product from wishlists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteProduct(id: number): Promise<void> {
    const productExists = await db.select().from(products).where(eq(products.id, id));
    if (productExists.length === 0) throw new Error("Product not found");

    try {
      await this.removeProductFromAllCarts(id);
      await this.removeProductFromAllWishlists(id);

      // Use soft deletion instead of hard deletion
      const result = await db.update(products)
        .set({ isDeleted: true })
        .where(eq(products.id, id))
        .returning();

      if (!result[0]) throw new Error("Product not found");
      console.log(`Successfully marked product ID ${id} as deleted`);
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error);
      throw new Error(`Failed to delete product: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ─── CART OPERATIONS ─────────────────────────────────────────────
  async addToCart(customerId: number, productId: number, quantity: number): Promise<void> {
    const existingItem = await db.select().from(cart)
      .where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
    if (existingItem.length > 0) {
      await db.update(cart)
        .set({ quantity })
        .where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
    } else {
      await db.insert(cart).values({ customerId, productId, quantity });
    }
  }

  async removeFromCart(customerId: number, productId: number): Promise<void> {
    await db.delete(cart).where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
  }

  async getCart(customerId: number): Promise<{ product: Product; quantity: number }[]> {
    const cartItems = await db.select().from(cart).where(eq(cart.customerId, customerId));
    const result = [];
    for (const item of cartItems) {
      const productResult = await db.select().from(products).where(eq(products.id, item.productId));
      if (productResult.length > 0) {
        result.push({ product: productResult[0], quantity: item.quantity });
      }
    }
    return result;
  }

  async clearCart(customerId: number): Promise<void> {
    await db.delete(cart).where(eq(cart.customerId, customerId));
  }

  // ─── WISHLIST OPERATIONS ─────────────────────────────────────────
  async addToWishlist(customerId: number, productId: number): Promise<void> {
    const existingItem = await db.select().from(wishlist)
      .where(and(eq(wishlist.customerId, customerId), eq(wishlist.productId, productId)));
    if (existingItem.length === 0) {
      await db.insert(wishlist).values({ customerId, productId });
    }
  }

  async removeFromWishlist(customerId: number, productId: number): Promise<void> {
    await db.delete(wishlist).where(and(eq(wishlist.customerId, customerId), eq(wishlist.productId, productId)));
  }

  async getWishlist(customerId: number): Promise<Product[]> {
    const wishlistItems = await db.select().from(wishlist).where(eq(wishlist.customerId, customerId));
    const result: Product[] = [];
    for (const item of wishlistItems) {
      const productResult = await db.select().from(products).where(eq(products.id, item.productId));
      if (productResult.length > 0) result.push(productResult[0]);
    }
    return result;
  }

  // ─── ORDER OPERATIONS ─────────────────────────────────────────────
  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    return result[0];
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getOrdersByCustomer(customerId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerId, customerId));
  }

  async getOrdersByShop(shopId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.shopId, shopId));
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    const result = await db.update(orders)
      .set(order)
      .where(eq(orders.id, id))
      .returning();
    if (!result[0]) throw new Error("Order not found");
    return result[0];
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(orderItem).returning();
    return result[0];
  }

  async updateProductStock(productId: number, quantity: number): Promise<void> {
    const productResult = await db.select().from(products).where(eq(products.id, productId));
    if (!productResult.length) throw new Error(`Product with ID ${productId} not found`);
    const product = productResult[0];
    const newStock = product.stock - quantity;
    if (newStock < 0) throw new Error(`Insufficient stock for product ID ${productId}`);
    await db.update(products).set({ stock: newStock }).where(eq(products.id, productId));
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  // ─── REVIEW OPERATIONS ────────────────────────────────────────────
  async createReview(review: InsertReview): Promise<Review> {
    const result = await db.insert(reviews).values(review).returning();
    return result[0];
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.serviceId, serviceId));
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    if (serviceIds.length === 0) return [];
    let allReviews: Review[] = [];
    for (const serviceId of serviceIds) {
      const serviceReviews = await db.select().from(reviews).where(eq(reviews.serviceId, serviceId));
      allReviews = [...allReviews, ...serviceReviews];
    }
    return allReviews;
  }

  async updateReview(id: number, review: Partial<Review>): Promise<Review> {
    const result = await db.update(reviews)
      .set(review)
      .where(eq(reviews.id, id))
      .returning();
    if (!result[0]) throw new Error("Review not found");
    return result[0];
  }

  // ─── NOTIFICATION OPERATIONS ──────────────────────────────────────
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // ─── ADDITIONAL / ENHANCED OPERATIONS ─────────────────────────────
  async checkAvailability(serviceId: number, date: Date): Promise<boolean> {
    // Your logic here to check service availability for the given date
    return true;
  }

  async joinWaitlist(customerId: number, serviceId: number, preferredDate: Date): Promise<void> {
    // Insert into a waitlist table (implementation required)
  }

  // For booking history sorting, we compute the last update timestamp asynchronously.
  async getBookingHistory(bookingId: number): Promise<any[]> {
    return await db.select().from(bookingHistory).where(eq(bookingHistory.bookingId, bookingId));
  }

  async getExpiredBookings(): Promise<Booking[]> {
    return await db.select().from(bookings).where(and(
      eq(bookings.status, 'pending'),
      lt(bookings.expiresAt, new Date())
    ));
  }

  async processExpiredBookings(): Promise<void> {
    const expiredBookings = await this.getExpiredBookings();
    for (const booking of expiredBookings) {
      await this.updateBooking(booking.id, {
        status: 'expired',
        changedBy: null,
        comments: 'Automatically expired after 7 days'
      });
      await this.createNotification({
        userId: booking.customerId,
        type: 'booking_expired',
        title: 'Booking Request Expired',
        message: 'Your booking request has expired as the service provider did not respond within 7 days.',
        isRead: false,
      });
      const service = await this.getService(booking.serviceId);
      if (service) {
        await this.createNotification({
          userId: service.providerId,
          type: 'booking_expired',
          title: 'Booking Request Expired',
          message: `A booking request for ${service.name} has expired as you did not respond within 7 days.`,
          isRead: false,
        });
      }
    }
  }

  async getPendingBookingRequestsForProvider(providerId: number): Promise<Booking[]> {
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    if (serviceIds.length === 0) return [];
    let pendingBookings: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db.select().from(bookings).where(and(
        eq(bookings.serviceId, serviceId),
        eq(bookings.status, 'pending')
      ));
      pendingBookings = [...pendingBookings, ...serviceBookings];
    }
    // Sort by creation date (newest first)
    return pendingBookings.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Asynchronously compute last-update timestamp for sorting.
  async getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
    const customerBookings = await db.select().from(bookings).where(and(
      eq(bookings.customerId, customerId),
      ne(bookings.status, 'pending')
    ));

    const bookingsWithLastUpdate = await Promise.all(customerBookings.map(async (booking) => {
      const history = await this.getBookingHistory(booking.id);
      const lastUpdate = history.length > 0
        ? new Date(history[history.length - 1].changedAt).getTime()
        : new Date(booking.createdAt).getTime();
      return { ...booking, lastUpdate };
    }));

    bookingsWithLastUpdate.sort((a, b) => b.lastUpdate - a.lastUpdate);
    return bookingsWithLastUpdate;
  }

  async getBookingHistoryForProvider(providerId: number): Promise<Booking[]> {
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    if (serviceIds.length === 0) return [];

    let bookingHistoryArr: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db.select().from(bookings).where(and(
        eq(bookings.serviceId, serviceId),
        ne(bookings.status, 'pending')
      ));
      bookingHistoryArr = [...bookingHistoryArr, ...serviceBookings];
    }

    const bookingsWithLastUpdate = await Promise.all(bookingHistoryArr.map(async (booking) => {
      const history = await this.getBookingHistory(booking.id);
      const lastUpdate = history.length > 0
        ? new Date(history[history.length - 1].changedAt).getTime()
        : new Date(booking.createdAt).getTime();
      return { ...booking, lastUpdate };
    }));

    bookingsWithLastUpdate.sort((a, b) => b.lastUpdate - a.lastUpdate);
    return bookingsWithLastUpdate;
  }

  async updateBookingStatus(
    id: number,
    status: "pending" | "confirmed" | "completed" | "cancelled" | "expired",
    comment?: string
  ): Promise<Booking> {
    const booking = await this.getBooking(id);
    if (!booking) throw new Error("Booking not found");
    return await this.updateBooking(id, { 
      status, 
      statusComment: comment || null 
    });
  }

  async getBookingsByService(serviceId: number, date: Date): Promise<Booking[]> {
    // Implementation for querying bookings by service and date
    return [];
  }

  async getProviderSchedule(providerId: number, date: Date): Promise<Booking[]> {
    // Implementation joining services and bookings tables
    return [];
  }

  async completeService(bookingId: number): Promise<Booking> {
    return await this.updateBookingStatus(bookingId, "completed", "Service completed successfully");
  }

  async addBookingReview(bookingId: number, review: InsertReview): Promise<Review> {
    const booking = await this.getBooking(bookingId);
    if (!booking) throw new Error("Booking not found");
    return await this.createReview({
      ...review,
      bookingId,
      serviceId: booking.serviceId
    });
  }

  async respondToReview(reviewId: number, response: string): Promise<Review> {
    // Update review with provider response (implementation needed)
    return {} as Review;
  }

  // ─── BLOCKED TIME SLOT OPERATIONS ────────────────────────────────
  async getBlockedTimeSlots(serviceId: number): Promise<BlockedTimeSlot[]> {
    // Query blocked time slots table (implementation required)
    return [];
  }

  async createBlockedTimeSlot(data: InsertBlockedTimeSlot): Promise<BlockedTimeSlot> {
    // Insert blocked time slot into the table (implementation required)
    return {} as BlockedTimeSlot;
  }

  async deleteBlockedTimeSlot(slotId: number): Promise<void> {
    // Delete blocked time slot (implementation required)
  }

  async getOverlappingBookings(
    serviceId: number,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<Booking[]> {
    // Query for overlapping bookings (implementation required)
    return [];
  }

  // ─── ENHANCED NOTIFICATION & ORDER TRACKING ───────────────────────
  async sendSMSNotification(phone: string, message: string): Promise<void> {
    console.log(`SMS to ${phone}: ${message}`);
  }

  async sendEmailNotification(email: string, subject: string, message: string): Promise<void> {
    console.log(`Email to ${email}: ${subject} - ${message}`);
  }

  async updateOrderStatus(orderId: number, status: OrderStatus, trackingInfo?: string): Promise<Order> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    order.status = status;
    if (trackingInfo) order.trackingInfo = trackingInfo;

    return await this.updateOrder(orderId, order);
  }

  async getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]> {
    // Query order status updates table (implementation required)
    return [];
  }

  async updateProviderProfile(id: number, profile: Partial<User>): Promise<User> {
    return await this.updateUser(id, profile);
  }

  async updateProviderAvailability(providerId: number, availability: {
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  }): Promise<void> {
    console.log(`Updated availability for provider ${providerId}`);
  }

  async getProviderAvailability(providerId: number): Promise<{
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  } | null> {
    return null;
  }
}
