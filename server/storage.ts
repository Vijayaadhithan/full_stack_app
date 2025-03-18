import session from "express-session";
import createMemoryStore from "memorystore";
import {
  User, InsertUser,
  Service, InsertService,
  Booking, InsertBooking,
  Product, InsertProduct,
  Order, InsertOrder,
  OrderItem, InsertOrderItem
} from "@shared/schema";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Service operations
  createService(service: InsertService): Promise<Service>;
  getService(id: number): Promise<Service | undefined>;
  getServicesByProvider(providerId: number): Promise<Service[]>;
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
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: number): Promise<Order[]>;
  getOrdersByShop(shopId: number): Promise<Order[]>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order>;

  // Order items operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrder(orderId: number): Promise<OrderItem[]>;

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private services: Map<number, Service>;
  private bookings: Map<number, Booking>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  sessionStore: session.Store;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.services = new Map();
    this.bookings = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

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

  async updateService(id: number, service: Partial<Service>): Promise<Service> {
    const existing = this.services.get(id);
    if (!existing) throw new Error("Service not found");
    const updated = { ...existing, ...service };
    this.services.set(id, updated);
    return updated;
  }

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

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const existing = this.products.get(id);
    if (!existing) throw new Error("Product not found");
    const updated = { ...existing, ...product };
    this.products.set(id, updated);
    return updated;
  }

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
}

export const storage = new MemStorage();
