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
  Promotion, InsertPromotion
} from "@shared/schema";

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
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>;

  // Service operations
  createService(service: InsertService): Promise<Service>;
  getService(id: number): Promise<Service | undefined>;
  getServicesByProvider(providerId: number): Promise<Service[]>;
  getServicesByCategory(category: string): Promise<Service[]>;
  updateService(id: number, service: Partial<Service>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  getServices(): Promise<Service[]>;

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByCustomer(customerId: number): Promise<Booking[]>;
  getBookingsByProvider(providerId: number): Promise<Booking[]>;
  updateBooking(id: number, booking: Partial<Booking>): Promise<Booking>;

  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductsByShop(shopId: number): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
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
  updateReview(id: number, review: Partial<Review>): Promise<Review>;

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

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    console.log("[Storage] getUser - Looking for user with ID:", id);
    const user = this.users.get(id);
    console.log("[Storage] getUser - Found user:", user);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error("User not found");
    const updated = { ...existing, ...updateData };
    this.users.set(id, updated);
    return updated;
  }

  // Service operations
  async createService(service: InsertService): Promise<Service> {
    const id = this.currentId++;
    const newService = { ...service, id };
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
    const newBooking = { ...booking, id };
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
    const newProduct = { ...product, id };
    this.products.set(id, newProduct);
    return newProduct;
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
    for (const [customerId, customerCart] of this.cart.entries()) {
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
    if (!this.cart.has(customerId)) {
      this.cart.set(customerId, new Map());
    }
    this.cart.get(customerId)!.set(productId, quantity);
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
    const newOrder = { ...order, id };
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
    this.orderItems.set(id, newOrderItem);
    return newOrderItem;
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
    this.reviews.set(id, newReview);
    return newReview;
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
      (review) => serviceIds.includes(review.serviceId),
    );
  }

  async updateReview(id: number, review: Partial<Review>): Promise<Review> {
    const existing = this.reviews.get(id);
    if (!existing) throw new Error("Review not found");
    const updated = { ...existing, ...review };
    this.reviews.set(id, updated);
    return updated;
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.currentId++;
    const newNotification = { ...notification, id };
    this.notifications.set(id, newNotification);
    return newNotification;
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
    const newReturnRequest = { ...returnRequest, id };
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
    status: "pending" | "confirmed" | "completed" | "cancelled",
    comment?: string
  ): Promise<Booking> {
    const booking = await this.getBooking(id);
    if (!booking) throw new Error("Booking not found");

    const updated = {
      ...booking,
      status,
      statusComment: comment || null,
    };

    this.bookings.set(id, updated);

    // Create notification for status update
    const customer = await this.getUser(booking.customerId);
    if (customer) {
      await this.createNotification({
        userId: customer.id,
        type: "booking",
        title: `Booking ${status}`,
        message: comment || `Your booking has been ${status}.`,
      });

      // Send SMS for important status updates
      if (["confirmed", "cancelled"].includes(status)) {
        await this.sendSMSNotification(
          customer.phone,
          `Your booking has been ${status}. ${comment || ''}`
        );
      }
    }

    return updated;
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
      serviceIds.includes(booking.serviceId) &&
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
    const service = await this.getService(booking.serviceId);
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
    for (const [serviceId, slots] of this.blockedTimeSlots.entries()) {
      const index = slots.findIndex(slot => slot.id === slotId);
      if (index !== -1) {
        slots.splice(index, 1);
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
      address: "123 Main St, Mumbai",
      language: "en",
      profilePicture: null,
      paymentMethods: null
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
        location: { lat: 19.0760, lng: 72.8777 }
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
        location: { lat: 19.0760, lng: 72.8777 }
      }
    ];

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
      address: "456 Market St, Delhi",
      language: "en",
      profilePicture: null,
      paymentMethods: null
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
      await this.createProduct(product);
    }
  }
}

// Import the PostgreSQL storage implementation
import { PostgresStorage } from './pg-storage';

// Use PostgreSQL storage for persistence instead of in-memory storage
export const storage = new PostgresStorage();