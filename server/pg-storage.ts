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
  users, services, bookings, products, orders, orderItems, reviews, notifications,
  cart, wishlist, returnRequests, promotions
} from "@shared/schema";
import { IStorage, OrderStatus, OrderStatusUpdate } from "./storage";
import { eq, and } from "drizzle-orm";

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

  // User operations
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

  // Service operations
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

  async getServicesByProvider(providerId: number): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.providerId, providerId));
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.category, category));
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
    const result = await db.delete(services)
      .where(eq(services.id, id))
      .returning();
    
    if (!result[0]) throw new Error("Service not found");
  }

  async getServices(): Promise<Service[]> {
    return await db.select().from(services);
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const result = await db.insert(bookings).values(booking).returning();
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
    // This is more complex as we need to join with services
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    
    if (serviceIds.length === 0) return [];
    
    // For simplicity, we'll query each service's bookings separately
    let allBookings: Booking[] = [];
    for (const serviceId of serviceIds) {
      const serviceBookings = await db.select()
        .from(bookings)
        .where(eq(bookings.serviceId, serviceId));
      allBookings = [...allBookings, ...serviceBookings];
    }
    
    return allBookings;
  }

  async updateBooking(id: number, booking: Partial<Booking>): Promise<Booking> {
    const result = await db.update(bookings)
      .set(booking)
      .where(eq(bookings.id, id))
      .returning();
    
    if (!result[0]) throw new Error("Booking not found");
    return result[0];
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductsByShop(shopId: number): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.shopId, shopId));
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.category, category));
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
      // Delete all cart entries that reference this product
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
      // Delete all wishlist entries that reference this product
      await db.delete(wishlist).where(eq(wishlist.productId, productId));
      console.log(`Successfully removed product ID ${productId} from all wishlists`);
    } catch (error) {
      console.error(`Error removing product ${productId} from wishlists:`, error);
      throw new Error(`Failed to remove product from wishlists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteProduct(id: number): Promise<void> {
    // First check if the product exists
    const productExists = await db.select().from(products).where(eq(products.id, id));
    if (productExists.length === 0) throw new Error("Product not found");
    
    try {
      // First remove the product from all carts and wishlists to avoid foreign key constraint violations
      await this.removeProductFromAllCarts(id);
      await this.removeProductFromAllWishlists(id);
      
      // Then delete the product
      const result = await db.delete(products)
        .where(eq(products.id, id))
        .returning();
      
      if (!result[0]) throw new Error("Product not found");
      
      console.log(`Successfully deleted product ID ${id}`);
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error);
      throw new Error(`Failed to delete product: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Implement remaining methods from IStorage interface
  // These are placeholders that would need to be properly implemented
  
  // Cart operations
  async addToCart(customerId: number, productId: number, quantity: number): Promise<void> {
    // Check if the product exists in the cart already
    const existingItem = await db
      .select()
      .from(cart)
      .where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));

    if (existingItem.length > 0) {
      // Update quantity if item already exists
      await db
        .update(cart)
        .set({ quantity })
        .where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
    } else {
      // Insert new item if it doesn't exist
      await db.insert(cart).values({
        customerId,
        productId,
        quantity,
      });
    }
  }

  async removeFromCart(customerId: number, productId: number): Promise<void> {
    await db
      .delete(cart)
      .where(and(eq(cart.customerId, customerId), eq(cart.productId, productId)));
  }

  async getCart(customerId: number): Promise<{ product: Product; quantity: number }[]> {
    const cartItems = await db
      .select()
      .from(cart)
      .where(eq(cart.customerId, customerId));

    const result = [];
    for (const item of cartItems) {
      const productResult = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId));

      if (productResult.length > 0) {
        result.push({
          product: productResult[0],
          quantity: item.quantity,
        });
      }
    }

    return result;
  }

  async clearCart(customerId: number): Promise<void> {
    await db.delete(cart).where(eq(cart.customerId, customerId));
  }

  // Wishlist operations
  async addToWishlist(customerId: number, productId: number): Promise<void> {
    // Check if the product already exists in the wishlist
    const existingItem = await db
      .select()
      .from(wishlist)
      .where(and(eq(wishlist.customerId, customerId), eq(wishlist.productId, productId)));

    // Only add if it doesn't already exist
    if (existingItem.length === 0) {
      await db.insert(wishlist).values({
        customerId,
        productId,
      });
    }
  }

  async removeFromWishlist(customerId: number, productId: number): Promise<void> {
    await db
      .delete(wishlist)
      .where(and(eq(wishlist.customerId, customerId), eq(wishlist.productId, productId)));
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
        .where(eq(products.id, item.productId));

      if (productResult.length > 0) {
        result.push(productResult[0]);
      }
    }

    return result;
  }

  // Order operations
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

  // Promotion operations
  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const result = await db.insert(promotions).values(promotion).returning();
    return result[0];
  }

  async getPromotionsByShop(shopId: number): Promise<Promotion[]> {
    return await db.select().from(promotions).where(eq(promotions.shopId, shopId));
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order> {
    const result = await db.update(orders)
      .set(order)
      .where(eq(orders.id, id))
      .returning();
    
    if (!result[0]) throw new Error("Order not found");
    return result[0];
  }

  // Order items operations
  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(orderItem).returning();
    return result[0];
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  // Review operations
  async createReview(review: InsertReview): Promise<Review> {
    const result = await db.insert(reviews).values(review).returning();
    return result[0];
  }

  async getReviewsByService(serviceId: number): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.serviceId, serviceId));
  }

  async getReviewsByProvider(providerId: number): Promise<Review[]> {
    // This requires joining with services to get all reviews for a provider's services
    const providerServices = await this.getServicesByProvider(providerId);
    const serviceIds = providerServices.map(service => service.id);
    
    if (serviceIds.length === 0) return [];
    
    // For simplicity, we'll query each service's reviews separately
    let allReviews: Review[] = [];
    for (const serviceId of serviceIds) {
      const serviceReviews = await db.select()
        .from(reviews)
        .where(eq(reviews.serviceId, serviceId));
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

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // Additional methods required by IStorage interface
  // These would need proper implementation with database tables
  
  async checkAvailability(serviceId: number, date: Date): Promise<boolean> {
    // Implementation would check bookings for the service on the given date
    return true;
  }
  
  async joinWaitlist(customerId: number, serviceId: number, preferredDate: Date): Promise<void> {
    // Implementation would insert into a waitlist table
  }
  
  async getWaitlistPosition(customerId: number, serviceId: number): Promise<number> {
    // Implementation would query a waitlist table
    return 0;
  }
  
  async createReturnRequest(returnRequest: InsertReturnRequest): Promise<ReturnRequest> {
    // Implementation would insert into returnRequests table
    return {} as ReturnRequest;
  }
  
  async getReturnRequest(id: number): Promise<ReturnRequest | undefined> {
    // Implementation would query returnRequests table
    return undefined;
  }
  
  async getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]> {
    // Implementation would query returnRequests table
    return [];
  }
  
  async updateReturnRequest(id: number, returnRequest: Partial<ReturnRequest>): Promise<ReturnRequest> {
    // Implementation would update returnRequests table
    return {} as ReturnRequest;
  }

  async processRefund(returnRequestId: number): Promise<void> {
    // Implementation would integrate with payment gateway for refunds
    console.log(`Processing refund for return request ${returnRequestId}`);
  }

  // Enhanced notification operations
  async sendSMSNotification(phone: string, message: string): Promise<void> {
    // Implementation would integrate with SMS service
    console.log(`SMS to ${phone}: ${message}`);
  }

  async sendEmailNotification(email: string, subject: string, message: string): Promise<void> {
    // Implementation would integrate with email service
    console.log(`Email to ${email}: ${subject} - ${message}`);
  }

  // Enhanced order tracking
  async updateOrderStatus(orderId: number, status: OrderStatus, trackingInfo?: string): Promise<Order> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");
    
    order.status = status;
    if (trackingInfo) {
      order.trackingInfo = trackingInfo;
    }
    
    return await this.updateOrder(orderId, order);
  }

  async getOrderTimeline(orderId: number): Promise<OrderStatusUpdate[]> {
    // Implementation would query order status updates table
    return [];
  }

  // Enhanced provider profile operations
  async updateProviderProfile(id: number, profile: Partial<User>): Promise<User> {
    return await this.updateUser(id, profile);
  }

  async updateProviderAvailability(providerId: number, availability: {
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  }): Promise<void> {
    // Implementation would store provider availability in database
    console.log(`Updated availability for provider ${providerId}`);
  }

  async getProviderAvailability(providerId: number): Promise<{
    days: string[];
    hours: { start: string; end: string };
    breaks: { start: string; end: string }[];
  } | null> {
    // Implementation would retrieve provider availability from database
    return null;
  }

  // Enhanced booking operations
  async updateBookingStatus(
    id: number,
    status: "pending" | "confirmed" | "completed" | "cancelled",
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
    // Implementation would query bookings by service and date
    return [];
  }

  async getProviderSchedule(providerId: number, date: Date): Promise<Booking[]> {
    // Implementation would join services and bookings tables
    return [];
  }

  // Service completion and rating
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
    // Implementation would update review with provider response
    return {} as Review;
  }

  // Blocked time slots
  async getBlockedTimeSlots(serviceId: number): Promise<BlockedTimeSlot[]> {
    // Implementation would query blocked time slots table
    return [];
  }

  async createBlockedTimeSlot(data: InsertBlockedTimeSlot): Promise<BlockedTimeSlot> {
    // Implementation would insert into blocked time slots table
    return {} as BlockedTimeSlot;
  }

  async deleteBlockedTimeSlot(slotId: number): Promise<void> {
    // Implementation would delete from blocked time slots table
  }

  async getOverlappingBookings(
    serviceId: number,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<Booking[]> {
    // Implementation would query bookings that overlap with the given time range
    return [];
  }
}