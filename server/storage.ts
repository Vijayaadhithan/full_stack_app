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
  Notification
} from "@shared/schema";

const MemoryStore = createMemoryStore(session);

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

  // Additional booking operations
  checkAvailability(serviceId: number, date: Date): Promise<boolean>;
  joinWaitlist(customerId: number, serviceId: number, preferredDate: Date): Promise<void>;
  getWaitlistPosition(customerId: number, serviceId: number): Promise<number>;

  sessionStore: session.Store;
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
  sessionStore: session.Store;
  private currentId: number;

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
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
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
    return this.services.get(id);
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
}

export const storage = new MemStorage();