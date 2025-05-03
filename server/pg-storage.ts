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
  ReturnRequest, InsertReturnRequest, // Type
  Promotion, InsertPromotion,
  ShopProfile, // Added ShopProfile import
  // Ensure bookingHistory is exported from your shared schema if available.
  users, services, bookings, bookingHistory, products, orders, orderItems, reviews, notifications,
  cart, wishlist, promotions, returns, // Changed returnRequests to returns
  UserRole
} from "@shared/schema";
import { IStorage, OrderStatus, OrderStatusUpdate } from "./storage";
import { eq, and, lt, ne, sql } from "drizzle-orm";
import { toISTForStorage, getCurrentISTDate, fromDatabaseToIST, getExpirationDate, convertArrayDatesToIST } from "./ist-utils";
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
  async processRefund(returnRequestId: number): Promise<void> { // Changed parameter name for clarity
    // Retrieve the return request from the database.
    const requestResult = await db.select().from(returns).where(eq(returns.id, returnRequestId)); // Use returns table and parameter
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
    const updatedResult = await db.update(returns) // Use returns table
      .set({ 
        status: "refunded",
        resolvedAt: getCurrentISTDate()
      })
      .where(eq(returns.id, returnRequestId)) // Use returns table and parameter
      .returning();
    if (!updatedResult[0]) {
      throw new Error("Failed to update return request during refund processing");
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
    const result = await db.insert(promotions).values({ ...promotion, type: promotion.type as "percentage" | "fixed_amount" }).returning();
    return result[0];
  }

  async getProducts(): Promise<Product[]> {
    // Only return non-deleted products
    return await db.select().from(products).where(eq(products.isDeleted, false));
  }

  async getPromotionsByShop(shopId: number): Promise<Promotion[]> {
    return await db.select().from(promotions).where(eq(promotions.shopId, shopId));
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
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    // Explicitly construct the object for insertion, excluding paymentMethods
    const insertData: Omit<InsertUser, 'paymentMethods' | 'id'> & { role: UserRole; shopProfile?: ShopProfile | null } = {
      username: user.username,
      password: user.password,
      role: user.role as UserRole, // Ensure role is correctly typed
      name: user.name,
      phone: user.phone,
      email: user.email,
      addressStreet: user.addressStreet,
      addressCity: user.addressCity,
      addressState: user.addressState,
      addressPostalCode: user.addressPostalCode,
      addressCountry: user.addressCountry,
      language: user.language,
      profilePicture: user.profilePicture,
      // Explicitly handle shopProfile, ensuring it matches the ShopProfile type or is null
      shopProfile: user.shopProfile ? user.shopProfile as ShopProfile : null,
      bio: user.bio,
      qualifications: user.qualifications,
      experience: user.experience,
      workingHours: user.workingHours,
      languages: user.languages,
    };

    // Drizzle handles undefined fields correctly, so no need to manually remove them.

    const result = await db.insert(users).values(insertData).returning();
    return result[0];
  }

  async updateUser(id: number, updateData: Partial<Omit<User, 'address'>> & { addressStreet?: string | null; addressCity?: string | null; addressState?: string | null; addressPostalCode?: string | null; addressCountry?: string | null }): Promise<User> {
    const result = await db.update(users)
      .set({ ...updateData }) // Spread operator handles the partial update correctly
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  // ─── SERVICE OPERATIONS ──────────────────────────────────────────
  async createService(service: InsertService): Promise<Service> {
    // Type assertion might be needed depending on InsertService definition
    const result = await db.insert(services).values(service as any).returning();
    return result[0];
  }

  async getService(id: number): Promise<Service | undefined> {
    console.log("Getting service with ID:", id);
    const result = await db.select().from(services).where(eq(services.id, id));
    console.log("Found service:", result[0]);
    return result[0];
  }

  // Implementation of IStorage.getPendingBookingRequestsForProvider
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

  // Implementation of IStorage.getBookingHistoryForProvider

  // Get booking requests with status for a customer
  async getBookingRequestsWithStatusForCustomer(customerId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.customerId, customerId));
  }

  // Implementation of IStorage.getBookingHistoryForCustomer
  async getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(and(
        eq(bookings.customerId, customerId),
        ne(bookings.status, 'pending')
      ));
  }

  // Removed duplicate processExpiredBookings implementation to avoid conflicts.

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

  async updateService(id: number, serviceUpdate: Partial<Service>): Promise<Service> {
    const result = await db.update(services)
      .set(serviceUpdate as any) // Pass the update data directly
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
    // Set default values for new bookings with IST timestamps
    const bookingWithDefaults = {
      ...booking,
      createdAt: getCurrentISTDate(),
      // Set expiresAt to 24 hours from now in IST if needed
      expiresAt: booking.expiresAt || getExpirationDate(24),
      status: booking.status as "pending" | "accepted" | "rejected" | "rescheduled" | "completed" | "cancelled" | "expired",
      paymentStatus: booking.paymentStatus as "pending" | "paid" | "refunded"
    };
    const result = await db.insert(bookings).values(bookingWithDefaults).returning();

    // Add entry to booking history with IST timestamp
    await db.insert(bookingHistory).values({
      bookingId: result[0].id,
      status: result[0].status,
      changedAt: getCurrentISTDate(),
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

    // Set IST timestamp for any updates
    const bookingWithIST = {
      ...booking,
      updatedAt: getCurrentISTDate()
    };

    const result = await db.update(bookings)
      .set(bookingWithIST)
      .where(eq(bookings.id, id))
      .returning();

    // If the status changed, add an entry in the booking history table with IST timestamp
    if (booking.status && booking.status !== currentBooking.status) {
      await db.insert(bookingHistory).values({
        bookingId: id,
        status: booking.status,
        changedAt: getCurrentISTDate(),
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
    console.log(`Adding product ID ${productId} to cart for customer ID ${customerId} with quantity ${quantity}`);
    try {
      const existingItem = await db.select().from(cart)
        .where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
      
      if (existingItem.length > 0) {
        console.log(`Updating existing cart item for customer ID ${customerId}, product ID ${productId}`);
        await db.update(cart)
          .set({ quantity })
          .where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
      } else {
        console.log(`Creating new cart item for customer ID ${customerId}, product ID ${productId}`);
        await db.insert(cart).values({ customerId, productId, quantity });
      }
    } catch (error) {
      console.error(`Error adding product ID ${productId} to cart for customer ID ${customerId}:`, error);
      throw new Error(`Failed to add product to cart: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeFromCart(customerId: number, productId: number): Promise<void> {
    await db.delete(cart).where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
  }

  async getCart(customerId: number): Promise<{ product: Product; quantity: number }[]> {
    console.log(`Getting cart for customer ID: ${customerId}`);
    try {
      const cartItems = await db.select().from(cart).where(eq(cart.customerId, customerId));
      console.log(`Found ${cartItems.length} cart items for customer ID: ${customerId}`);
      
      const result = [];
      for (const item of cartItems) {
        const productResult = await db.select().from(products).where(eq(products.id, item.productId!));
        if (productResult.length > 0 && !productResult[0].isDeleted) {
          result.push({ product: productResult[0], quantity: item.quantity });
        } else {
          // If product doesn't exist or is deleted, remove it from cart if productId is not null
          console.log(`Removing non-existent or deleted product ID ${item.productId} from cart`);
          if (item.productId !== null) {
            await this.removeFromCart(customerId, item.productId);
          }
        }
      }
      return result;
    } catch (error) {
      console.error(`Error getting cart for customer ID ${customerId}:`, error);
      return [];
    }
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
      const productResult = await db.select().from(products).where(eq(products.id, item.productId!));
      if (productResult.length > 0) result.push(productResult[0]);
    }
    return result;
  }

  // ─── ORDER OPERATIONS ─────────────────────────────────────────────
  async createOrder(order: InsertOrder): Promise<Order> {
    const orderToInsert = {
      ...order,
      status: order.status as "pending" | "cancelled" | "confirmed" | "processing" | "packed" | "shipped" | "delivered" | "returned",
      paymentStatus: order.paymentStatus as "pending" | "paid" | "refunded",
    };
    const result = await db.insert(orders).values(orderToInsert).returning();
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
    const result = await db.insert(orderItems).values({
      ...orderItem,
      status: orderItem.status as "cancelled" | "returned" | "ordered" | null | undefined,
    }).returning();
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

  // ─── REVIEW OPERATIONS ───────────────────────────────────────────
  async createReview(review: InsertReview): Promise<Review> {
    const result = await db.insert(reviews).values(review).returning();
    return result[0];
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.serviceId, serviceId));
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    // This requires joining services table to filter by providerId
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(s => s.id);
    if (serviceIds.length === 0) return [];
    // Use sql.in operator for cleaner query
    return await db.select().from(reviews).where(sql`${reviews.serviceId} IN ${serviceIds}`);
  }

  async getReviewById(id: number): Promise<Review | undefined> {
    const result = await db.select().from(reviews).where(eq(reviews.id, id));
    return result[0];
  }

  async updateReview(id: number, reviewData: Partial<Review>): Promise<Review> {
    const result = await db.update(reviews)
      .set(reviewData)
      .where(eq(reviews.id, id))
      .returning();
    if (!result[0]) throw new Error("Review not found");
    return result[0];
  }

  // ─── NOTIFICATION OPERATIONS ─────────────────────────────────────
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values({ ...notification, type: notification.type as "shop" | "booking" | "order" | "promotion" | "system" | "return" | "service_request" | "service" | "booking_request" }).returning();
    return result[0];
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: number, role?: string): Promise<void> {
    const conditions = [eq(notifications.userId, userId)];
    if (role === 'shop_owner') {
      // Shop owners should not see service notifications
      conditions.push(sql`type != 'service'`);
    } else if (role === 'provider') {
      // Service providers should not see order notifications
      conditions.push(sql`type != 'order'`);
    }
    const query = db.update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
    
    await query;
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
        comments: 'Automatically expired after 7 days'
      });
      await this.createNotification({
        userId: booking.customerId,
        type: 'booking_expired',
        title: 'Booking Request Expired',
        message: 'Your booking request has expired as the service provider did not respond within 7 days.',
        isRead: false,
      });
      const service = typeof booking.serviceId === "number" ? await this.getService(booking.serviceId) : undefined;
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


  // Asynchronously compute last-update timestamp for sorting.
  // Removed duplicate implementation of getBookingHistoryForCustomer to resolve the duplicate function error.

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
        : (booking.createdAt ? new Date(booking.createdAt).getTime() : new Date().getTime());
      return { ...booking, lastUpdate };
    }));

    bookingsWithLastUpdate.sort((a, b) => b.lastUpdate - a.lastUpdate);
    return bookingsWithLastUpdate;
  }

  async updateBookingStatus(
    id: number,
    status: "pending" | "completed" | "cancelled" | "confirmed",
    comment?: string
  ): Promise<Booking> {
    const booking = await this.getBooking(id);
    if (!booking) throw new Error("Booking not found");
    // Map 'confirmed' to 'accepted' for internal consistency
    const internalStatus = status === "confirmed" ? "accepted" : status;
    // Ensure that createdAt is always a valid Date object before using new Date()
    let createdAt: Date;
    if (booking && booking.createdAt) {
      createdAt = booking.createdAt instanceof Date
      ? booking.createdAt
      : new Date(booking.createdAt as string | number);
    } else {
      createdAt = new Date();
    }

    return await this.updateBooking(id, { 
      status: internalStatus, 
      comments: comment || null 
    });
  }

  async getBookingsByService(serviceId: number, date: Date): Promise<Booking[]> {
    // Convert date to start and end of day in IST
    const istDate = toISTForStorage(date);
    const startDate = new Date(istDate ?? new Date());
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(istDate ?? new Date());
    endDate.setHours(23, 59, 59, 999);
    // Implementation for querying bookings by service and date
    return [];
  }

  async getProviderSchedule(providerId: number, date: Date): Promise<Booking[]> {
    // Convert date to start and end of day in IST
    const istDate = toISTForStorage(date);
    const startDate =new Date(istDate ?? new Date());
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(istDate ?? new Date());
    endDate.setHours(23, 59, 59, 999);
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
    // Implementation would depend on your database structure
    // Convert date to IST
    const blockedSlot = {
      id: Math.floor(Math.random() * 10000), // In a real DB this would be auto-generated
      ...data,
      date: toISTForStorage(data.date)
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

    // Update the order status with IST timestamp
    // Only include updatedAt if it exists in the Order type
    const updateData: any = { 
      status, 
      trackingInfo: trackingInfo || order.trackingInfo
    };
    if ("updatedAt" in order) {
      updateData.updatedAt = getCurrentISTDate();
    }
    return await this.updateOrder(orderId, updateData);
  }

  async getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]> {
    // This would typically be fetched from a dedicated order_status_history table
    // For this example, we'll return a mock timeline
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");
    
    // Mock timeline data with IST timestamps
    // Use order.placedAt if available, otherwise fallback to new Date()
    const timeline: OrderStatusUpdate[] = [
      {
      orderId,
      status: "pending",
      timestamp: fromDatabaseToIST((order as any).placedAt || new Date()) as Date,
      }
    ];
    return timeline;
  }

  async updateProviderProfile(id: number, profile: Partial<User>): Promise<User> {
    // Remove any null address fields to satisfy the type requirements
    const cleanedProfile = { ...profile };
    if ('addressStreet' in cleanedProfile && cleanedProfile.addressStreet === null) delete cleanedProfile.addressStreet;
    if ('addressCity' in cleanedProfile && cleanedProfile.addressCity === null) delete cleanedProfile.addressCity;
    if ('addressState' in cleanedProfile && cleanedProfile.addressState === null) delete cleanedProfile.addressState;
    if ('addressPostalCode' in cleanedProfile && cleanedProfile.addressPostalCode === null) delete cleanedProfile.addressPostalCode;
    if ('addressCountry' in cleanedProfile && cleanedProfile.addressCountry === null) delete cleanedProfile.addressCountry;
    return await this.updateUser(id, cleanedProfile);
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

  // STUB implementations to satisfy IStorage interface missing methods
  async getWaitlistPosition(customerId: number, serviceId: number): Promise<number> {
    throw new Error('Method not implemented.');
  }

  async createReturnRequest(returnRequest: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async getReturnRequest(id: number): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async getReturnRequestsByOrder(orderId: number): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  async updateReturnRequest(id: number, update: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async deleteReturnRequest(id: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
