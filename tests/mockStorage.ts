/**
 * Mock Storage Implementation for Testing
 * Implements IStorage interface with in-memory data
 */
import session from "express-session";
import type {
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
} from "../shared/schema.js";
import type { IStorage, OrderStatus, ProductListItem, DashboardStats } from "../server/storage.js";

// In-memory session store for testing
class MemorySessionStore extends session.Store {
    private sessions: Map<string, string> = new Map();

    get(sid: string, callback: (err: any, session?: session.SessionData | null) => void): void {
        const data = this.sessions.get(sid);
        if (data) {
            try {
                callback(null, JSON.parse(data));
            } catch {
                callback(null, null);
            }
        } else {
            callback(null, null);
        }
    }

    set(sid: string, session: session.SessionData, callback?: (err?: any) => void): void {
        this.sessions.set(sid, JSON.stringify(session));
        callback?.();
    }

    destroy(sid: string, callback?: (err?: any) => void): void {
        this.sessions.delete(sid);
        callback?.();
    }
}

export class MockStorage implements IStorage {
    // In-memory data stores
    private users: Map<number, User> = new Map();
    private services: Map<number, Service> = new Map();
    private bookings: Map<number, Booking> = new Map();
    private products: Map<number, Product> = new Map();
    private orders: Map<number, Order> = new Map();
    private orderItems: Map<number, OrderItem> = new Map();
    private reviews: Map<number, Review> = new Map();
    private productReviews: Map<number, ProductReview> = new Map();
    private notifications: Map<number, Notification> = new Map();
    private promotions: Map<number, Promotion> = new Map();
    private returnRequests: Map<number, ReturnRequest> = new Map();
    private cart: Map<number, Map<number, number>> = new Map(); // userId -> productId -> quantity
    private wishlist: Map<number, Set<number>> = new Map(); // userId -> productIds

    // Auto-increment IDs
    private nextUserId = 1;
    private nextServiceId = 1;
    private nextBookingId = 1;
    private nextProductId = 1;
    private nextOrderId = 1;
    private nextOrderItemId = 1;
    private nextReviewId = 1;
    private nextProductReviewId = 1;
    private nextNotificationId = 1;
    private nextPromotionId = 1;
    private nextReturnRequestId = 1;

    public sessionStore: session.Store = new MemorySessionStore();

    // ============ User Operations ============

    async getUser(id: number): Promise<User | undefined> {
        return this.users.get(id);
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        for (const user of this.users.values()) {
            if (user.username?.toLowerCase() === username.toLowerCase()) {
                return user;
            }
        }
        return undefined;
    }

    async getUserByEmail(email: string): Promise<User | undefined> {
        for (const user of this.users.values()) {
            if (user.email?.toLowerCase() === email.toLowerCase()) {
                return user;
            }
        }
        return undefined;
    }

    async getUserByPhone(phone: string): Promise<User | undefined> {
        const normalizedPhone = phone.replace(/\D/g, "");
        for (const user of this.users.values()) {
            if (user.phone?.replace(/\D/g, "") === normalizedPhone) {
                return user;
            }
        }
        return undefined;
    }

    async getAllUsers(options?: { limit?: number; offset?: number }): Promise<User[]> {
        const users = Array.from(this.users.values());
        const offset = options?.offset ?? 0;
        const limit = options?.limit ?? users.length;
        return users.slice(offset, offset + limit);
    }

    async getUsersByIds(ids: number[]): Promise<User[]> {
        return ids.map(id => this.users.get(id)).filter((u): u is User => !!u);
    }

    async getShops(filters?: any): Promise<User[]> {
        return Array.from(this.users.values()).filter(u => u.role === "shop");
    }

    async getShopByOwnerId(ownerId: number): Promise<{ id: number; ownerId: number } | undefined> {
        const shop = Array.from(this.users.values()).find(u => u.id === ownerId && u.role === "shop");
        return shop ? { id: shop.id, ownerId: shop.id } : undefined;
    }

    async createUser(user: InsertUser): Promise<User> {
        const id = this.nextUserId++;
        const newUser: User = {
            id,
            username: user.username ?? null,
            password: user.password ?? null,
            email: user.email ?? null,
            phone: user.phone ?? null,
            pin: user.pin ?? null,
            name: user.name ?? null,
            role: user.role ?? "customer",
            bio: user.bio ?? null,
            profileImage: user.profileImage ?? null,
            hasProviderProfile: user.hasProviderProfile ?? false,
            hasShopProfile: user.hasShopProfile ?? false,
            providerRating: null,
            providerReviewCount: 0,
            shopName: user.shopName ?? null,
            shopDescription: user.shopDescription ?? null,
            shopImages: user.shopImages ?? null,
            catalogModeEnabled: false,
            openOrderMode: false,
            allowPayLater: false,
            locationCity: user.locationCity ?? null,
            locationState: user.locationState ?? null,
            locationArea: user.locationArea ?? null,
            locationPincode: user.locationPincode ?? null,
            geoLatitude: null,
            geoLongitude: null,
            fcmToken: null,
            preferredLanguage: user.preferredLanguage ?? "en",
            lastActiveAt: new Date(),
            isSuspended: false,
            suspensionReason: null,
            createdAt: new Date(),
            isDeleted: false,
            deletedAt: null,
        };
        this.users.set(id, newUser);
        return newUser;
    }

    async updateUser(id: number, updates: Partial<User>): Promise<User> {
        const user = this.users.get(id);
        if (!user) throw new Error(`User ${id} not found`);
        const updated = { ...user, ...updates };
        this.users.set(id, updated);
        return updated;
    }

    // ============ Service Operations ============

    async createService(service: InsertService): Promise<Service> {
        const id = this.nextServiceId++;
        const newService: Service = {
            id,
            providerId: service.providerId,
            name: service.name,
            description: service.description ?? null,
            price: service.price,
            duration: service.duration,
            category: service.category ?? null,
            images: service.images ?? null,
            isAvailable: service.isAvailable ?? true,
            createdAt: new Date(),
            timeSlotConfig: null,
            maxBookingsPerSlot: 1,
        };
        this.services.set(id, newService);
        return newService;
    }

    async getService(id: number): Promise<Service | undefined> {
        return this.services.get(id);
    }

    async getServicesByIds(ids: number[]): Promise<Service[]> {
        return ids.map(id => this.services.get(id)).filter((s): s is Service => !!s);
    }

    async getServicesByProvider(providerId: number): Promise<Service[]> {
        return Array.from(this.services.values()).filter(s => s.providerId === providerId);
    }

    async getServicesByCategory(category: string): Promise<Service[]> {
        return Array.from(this.services.values()).filter(s => s.category === category);
    }

    async updateService(id: number, updates: Partial<Service>): Promise<Service> {
        const service = this.services.get(id);
        if (!service) throw new Error(`Service ${id} not found`);
        const updated = { ...service, ...updates };
        this.services.set(id, updated);
        return updated;
    }

    async deleteService(id: number): Promise<void> {
        this.services.delete(id);
    }

    async getServices(filters?: any): Promise<Service[]> {
        return Array.from(this.services.values());
    }

    // ============ Booking Operations ============

    async createBooking(booking: InsertBooking, options?: any): Promise<Booking> {
        const id = this.nextBookingId++;
        const newBooking: Booking = {
            id,
            serviceId: booking.serviceId,
            customerId: booking.customerId,
            providerId: booking.providerId,
            date: booking.date,
            timeSlotLabel: booking.timeSlotLabel ?? null,
            expiresAt: booking.expiresAt ?? null,
            status: booking.status ?? "pending",
            notes: booking.notes ?? null,
            serviceSnapshot: booking.serviceSnapshot ?? null,
            createdAt: new Date(),
        };
        this.bookings.set(id, newBooking);
        return newBooking;
    }

    async getBooking(id: number): Promise<Booking | undefined> {
        return this.bookings.get(id);
    }

    async getBookingsByCustomer(customerId: number, filters?: any): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter(b => b.customerId === customerId);
    }

    async getBookingsByProvider(providerId: number, options?: any): Promise<any> {
        const bookings = Array.from(this.bookings.values()).filter(b => b.providerId === providerId);
        return { data: bookings, total: bookings.length, totalPages: 1 };
    }

    async getBookingsByStatus(status: string, limit?: number): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter(b => b.status === status);
    }

    async updateBooking(id: number, updates: Partial<Booking>, options?: any): Promise<Booking> {
        const booking = this.bookings.get(id);
        if (!booking) throw new Error(`Booking ${id} not found`);
        const updated = { ...booking, ...updates };
        this.bookings.set(id, updated);
        return updated;
    }

    async getPendingBookingRequestsForProvider(providerId: number): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter(
            b => b.providerId === providerId && b.status === "pending"
        );
    }

    async getBookingHistoryForProvider(providerId: number, options?: any): Promise<any> {
        const history = Array.from(this.bookings.values()).filter(
            b => b.providerId === providerId && ["completed", "cancelled"].includes(b.status)
        );
        return { data: history, total: history.length, totalPages: 1 };
    }

    async getBookingHistoryForCustomer(customerId: number): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter(
            b => b.customerId === customerId && ["completed", "cancelled"].includes(b.status)
        );
    }

    async getBookingRequestsWithStatusForCustomer(customerId: number): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter(b => b.customerId === customerId);
    }

    async getBookingsWithRelations(ids: number[]): Promise<any[]> {
        return ids.map(id => {
            const booking = this.bookings.get(id);
            if (!booking) return null;
            const service = this.services.get(booking.serviceId);
            const customer = this.users.get(booking.customerId);
            const provider = booking.providerId ? this.users.get(booking.providerId) : null;
            return {
                ...booking,
                service: service ? { ...service, provider } : null,
                customer,
            };
        }).filter(Boolean);
    }

    async processExpiredBookings(): Promise<void> {
        // No-op for tests
    }

    // ============ Product Operations ============

    async createProduct(product: InsertProduct): Promise<Product> {
        const id = this.nextProductId++;
        const newProduct: Product = {
            id,
            shopId: product.shopId,
            name: product.name,
            description: product.description ?? null,
            price: product.price,
            mrp: product.mrp ?? null,
            category: product.category ?? null,
            subcategory: product.subcategory ?? null,
            images: product.images ?? null,
            isAvailable: product.isAvailable ?? true,
            stock: product.stock ?? 0,
            lowStockThreshold: product.lowStockThreshold ?? null,
            unit: product.unit ?? null,
            brand: product.brand ?? null,
            weight: product.weight ?? null,
            dimensions: product.dimensions ?? null,
            createdAt: new Date(),
        };
        this.products.set(id, newProduct);
        return newProduct;
    }

    async getProduct(id: number): Promise<Product | undefined> {
        return this.products.get(id);
    }

    async getProductsByShop(shopId: number): Promise<Product[]> {
        return Array.from(this.products.values()).filter(p => p.shopId === shopId);
    }

    async getProductsByCategory(category: string): Promise<Product[]> {
        return Array.from(this.products.values()).filter(p => p.category === category);
    }

    async getProductsByIds(ids: number[]): Promise<Product[]> {
        return ids.map(id => this.products.get(id)).filter((p): p is Product => !!p);
    }

    async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
        const product = this.products.get(id);
        if (!product) throw new Error(`Product ${id} not found`);
        const updated = { ...product, ...updates };
        this.products.set(id, updated);
        return updated;
    }

    async deleteProduct(id: number): Promise<void> {
        this.products.delete(id);
    }

    async getProducts(filters?: any): Promise<{ items: ProductListItem[]; hasMore: boolean }> {
        const items = Array.from(this.products.values()).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            mrp: p.mrp,
            category: p.category,
            images: p.images,
            shopId: p.shopId,
            isAvailable: p.isAvailable,
            stock: p.stock,
        }));
        return { items, hasMore: false };
    }

    async removeProductFromAllCarts(productId: number): Promise<void> {
        for (const userCart of this.cart.values()) {
            userCart.delete(productId);
        }
    }

    async getLowStockProducts(options?: any): Promise<Product[]> {
        const threshold = options?.threshold ?? 10;
        return Array.from(this.products.values()).filter(p => (p.stock ?? 0) < threshold);
    }

    async bulkUpdateProductStock(updates: any[]): Promise<Product[]> {
        return updates.map(u => {
            const product = this.products.get(u.productId);
            if (product) {
                product.stock = u.stock;
                if (u.lowStockThreshold !== undefined) {
                    product.lowStockThreshold = u.lowStockThreshold;
                }
                this.products.set(u.productId, product);
                return product;
            }
            return null;
        }).filter((p): p is Product => !!p);
    }

    // ============ Cart Operations ============

    async addToCart(customerId: number, productId: number, quantity: number): Promise<void> {
        if (!this.cart.has(customerId)) {
            this.cart.set(customerId, new Map());
        }
        this.cart.get(customerId)!.set(productId, quantity);
    }

    async removeFromCart(customerId: number, productId: number): Promise<void> {
        this.cart.get(customerId)?.delete(productId);
    }

    async getCart(customerId: number): Promise<{ product: Product; quantity: number }[]> {
        const userCart = this.cart.get(customerId);
        if (!userCart) return [];
        const items: { product: Product; quantity: number }[] = [];
        for (const [productId, quantity] of userCart.entries()) {
            const product = this.products.get(productId);
            if (product) {
                items.push({ product, quantity });
            }
        }
        return items;
    }

    async clearCart(customerId: number): Promise<void> {
        this.cart.delete(customerId);
    }

    // ============ Wishlist Operations ============

    async addToWishlist(customerId: number, productId: number): Promise<void> {
        if (!this.wishlist.has(customerId)) {
            this.wishlist.set(customerId, new Set());
        }
        this.wishlist.get(customerId)!.add(productId);
    }

    async removeFromWishlist(customerId: number, productId: number): Promise<void> {
        this.wishlist.get(customerId)?.delete(productId);
    }

    async getWishlist(customerId: number): Promise<Product[]> {
        const productIds = this.wishlist.get(customerId);
        if (!productIds) return [];
        return Array.from(productIds).map(id => this.products.get(id)).filter((p): p is Product => !!p);
    }

    // ============ Order Operations ============

    async createOrder(order: InsertOrder): Promise<Order> {
        const id = this.nextOrderId++;
        const newOrder: Order = {
            id,
            customerId: order.customerId,
            shopId: order.shopId,
            status: order.status ?? "pending",
            totalAmount: order.totalAmount,
            deliveryAddress: order.deliveryAddress ?? null,
            deliveryNotes: order.deliveryNotes ?? null,
            paymentMethod: order.paymentMethod ?? null,
            paymentStatus: order.paymentStatus ?? "pending",
            trackingInfo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.orders.set(id, newOrder);
        return newOrder;
    }

    async createOrderWithItems(order: InsertOrder, items: any[]): Promise<Order> {
        const newOrder = await this.createOrder(order);
        for (const item of items) {
            await this.createOrderItem({
                orderId: newOrder.id,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                total: item.total,
            });
        }
        return newOrder;
    }

    async getOrder(id: number): Promise<Order | undefined> {
        return this.orders.get(id);
    }

    async getOrdersByCustomer(customerId: number, filters?: any): Promise<Order[]> {
        return Array.from(this.orders.values()).filter(o => o.customerId === customerId);
    }

    async getOrdersByShop(shopId: number, status?: any, options?: any): Promise<Order[]> {
        return Array.from(this.orders.values()).filter(o => o.shopId === shopId);
    }

    async getRecentOrdersByShop(shopId: number): Promise<Order[]> {
        return Array.from(this.orders.values())
            .filter(o => o.shopId === shopId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10);
    }

    async getShopDashboardStats(shopId: number): Promise<DashboardStats> {
        const orders = Array.from(this.orders.values()).filter(o => o.shopId === shopId);
        return {
            pendingOrders: orders.filter(o => o.status === "pending").length,
            ordersInProgress: orders.filter(o => ["processing", "packed", "dispatched"].includes(o.status)).length,
            completedOrders: orders.filter(o => o.status === "delivered").length,
            totalProducts: Array.from(this.products.values()).filter(p => p.shopId === shopId).length,
            lowStockItems: 0,
            earningsToday: 0,
            earningsMonth: 0,
            earningsTotal: 0,
            customerSpendTotals: [],
            itemSalesTotals: [],
        };
    }

    async getPayLaterOutstandingAmounts(shopId: number, customerIds: number[]): Promise<Record<number, number>> {
        return {};
    }

    async updateOrder(id: number, updates: Partial<Order>): Promise<Order> {
        const order = this.orders.get(id);
        if (!order) throw new Error(`Order ${id} not found`);
        const updated = { ...order, ...updates, updatedAt: new Date() };
        this.orders.set(id, updated);
        return updated;
    }

    // ============ Order Item Operations ============

    async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
        const id = this.nextOrderItemId++;
        const newItem: OrderItem = {
            id,
            orderId: item.orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
        };
        this.orderItems.set(id, newItem);
        return newItem;
    }

    async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
        return Array.from(this.orderItems.values()).filter(i => i.orderId === orderId);
    }

    async getOrderItemsByOrderIds(orderIds: number[]): Promise<OrderItem[]> {
        return Array.from(this.orderItems.values()).filter(i => orderIds.includes(i.orderId));
    }

    async getOrdersWithRelations(ids: number[]): Promise<any[]> {
        return ids.map(id => {
            const order = this.orders.get(id);
            if (!order) return null;
            const items = Array.from(this.orderItems.values())
                .filter(i => i.orderId === id)
                .map(i => ({
                    ...i,
                    product: this.products.get(i.productId) ?? null,
                }));
            return {
                ...order,
                items,
                shop: this.users.get(order.shopId) ?? null,
                customer: this.users.get(order.customerId) ?? null,
            };
        }).filter(Boolean);
    }

    // ============ Review Operations ============

    async createReview(review: InsertReview): Promise<Review> {
        const id = this.nextReviewId++;
        const newReview: Review = {
            id,
            serviceId: review.serviceId,
            customerId: review.customerId,
            providerId: review.providerId,
            bookingId: review.bookingId ?? null,
            rating: review.rating,
            review: review.review ?? null,
            providerReply: null,
            createdAt: new Date(),
        };
        this.reviews.set(id, newReview);
        return newReview;
    }

    async getReviewsByService(serviceId: number): Promise<Review[]> {
        return Array.from(this.reviews.values()).filter(r => r.serviceId === serviceId);
    }

    async getReviewsByServiceIds(serviceIds: number[]): Promise<Review[]> {
        return Array.from(this.reviews.values()).filter(r => serviceIds.includes(r.serviceId));
    }

    async getReviewsByProvider(providerId: number): Promise<Review[]> {
        return Array.from(this.reviews.values()).filter(r => r.providerId === providerId);
    }

    async getReviewsByCustomer(customerId: number): Promise<Review[]> {
        return Array.from(this.reviews.values()).filter(r => r.customerId === customerId);
    }

    async getReviewById(id: number): Promise<Review | undefined> {
        return this.reviews.get(id);
    }

    async updateReview(id: number, data: any): Promise<Review> {
        const review = this.reviews.get(id);
        if (!review) throw new Error(`Review ${id} not found`);
        const updated = { ...review, ...data };
        this.reviews.set(id, updated);
        return updated;
    }

    async updateCustomerReview(reviewId: number, customerId: number, data: any): Promise<Review> {
        const review = this.reviews.get(reviewId);
        if (!review || review.customerId !== customerId) {
            throw new Error(`Review ${reviewId} not found or not owned by customer`);
        }
        return this.updateReview(reviewId, data);
    }

    async updateProviderRating(providerId: number): Promise<void> {
        // No-op for tests
    }

    async createProductReview(review: InsertProductReview): Promise<ProductReview> {
        const id = this.nextProductReviewId++;
        const newReview: ProductReview = {
            id,
            productId: review.productId,
            customerId: review.customerId,
            shopId: review.shopId,
            orderId: review.orderId ?? null,
            rating: review.rating,
            review: review.review ?? null,
            shopReply: null,
            createdAt: new Date(),
        };
        this.productReviews.set(id, newReview);
        return newReview;
    }

    async getProductReviewsByProduct(productId: number): Promise<ProductReview[]> {
        return Array.from(this.productReviews.values()).filter(r => r.productId === productId);
    }

    async getProductReviewsByShop(shopId: number): Promise<ProductReview[]> {
        return Array.from(this.productReviews.values()).filter(r => r.shopId === shopId);
    }

    async getProductReviewsByCustomer(customerId: number): Promise<ProductReview[]> {
        return Array.from(this.productReviews.values()).filter(r => r.customerId === customerId);
    }

    async getProductReviewById(id: number): Promise<ProductReview | undefined> {
        return this.productReviews.get(id);
    }

    async updateProductReview(id: number, data: any): Promise<ProductReview> {
        const review = this.productReviews.get(id);
        if (!review) throw new Error(`Product review ${id} not found`);
        const updated = { ...review, ...data };
        this.productReviews.set(id, updated);
        return updated;
    }

    // ============ Notification Operations ============

    async createNotification(notification: InsertNotification): Promise<Notification> {
        const id = this.nextNotificationId++;
        const newNotification: Notification = {
            id,
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data ?? null,
            read: false,
            createdAt: new Date(),
        };
        this.notifications.set(id, newNotification);
        return newNotification;
    }

    async getNotificationsByUser(userId: number, options?: any): Promise<any> {
        const notifications = Array.from(this.notifications.values())
            .filter(n => n.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return { data: notifications, total: notifications.length, totalPages: 1 };
    }

    async markNotificationAsRead(id: number): Promise<void> {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.read = true;
            this.notifications.set(id, notification);
        }
    }

    async markAllNotificationsAsRead(userId: number): Promise<void> {
        for (const notification of this.notifications.values()) {
            if (notification.userId === userId) {
                notification.read = true;
            }
        }
    }

    async deleteNotification(id: number): Promise<void> {
        this.notifications.delete(id);
    }

    // ============ Promotion Operations ============

    async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
        const id = this.nextPromotionId++;
        const newPromotion: Promotion = {
            id,
            shopId: promotion.shopId,
            code: promotion.code,
            description: promotion.description ?? null,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
            minOrderValue: promotion.minOrderValue ?? null,
            maxUses: promotion.maxUses ?? null,
            usedCount: 0,
            startDate: promotion.startDate ?? null,
            endDate: promotion.endDate ?? null,
            isActive: promotion.isActive ?? true,
            createdAt: new Date(),
        };
        this.promotions.set(id, newPromotion);
        return newPromotion;
    }

    async getPromotionsByShop(shopId: number): Promise<Promotion[]> {
        return Array.from(this.promotions.values()).filter(p => p.shopId === shopId);
    }

    // ============ Availability Operations ============

    async checkAvailability(serviceId: number, date: Date, timeSlotLabel?: TimeSlotLabel | null): Promise<boolean> {
        return true;
    }

    async joinWaitlist(customerId: number, serviceId: number, preferredDate: Date): Promise<void> {
        // No-op for tests
    }

    async getWaitlistPosition(customerId: number, serviceId: number): Promise<number> {
        return 0;
    }

    // ============ Return Request Operations ============

    async createReturnRequest(request: InsertReturnRequest): Promise<ReturnRequest> {
        const id = this.nextReturnRequestId++;
        const newRequest: ReturnRequest = {
            id,
            orderId: request.orderId,
            orderItemId: request.orderItemId ?? null,
            customerId: request.customerId,
            shopId: request.shopId,
            reason: request.reason,
            status: request.status ?? "pending",
            refundAmount: request.refundAmount ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.returnRequests.set(id, newRequest);
        return newRequest;
    }

    async getReturnRequest(id: number): Promise<ReturnRequest | undefined> {
        return this.returnRequests.get(id);
    }

    async getReturnRequestsByOrder(orderId: number): Promise<ReturnRequest[]> {
        return Array.from(this.returnRequests.values()).filter(r => r.orderId === orderId);
    }

    async getReturnRequestsForShop(shopId: number): Promise<ReturnRequest[]> {
        return Array.from(this.returnRequests.values()).filter(r => r.shopId === shopId);
    }

    async updateReturnRequest(id: number, updates: Partial<ReturnRequest>): Promise<ReturnRequest> {
        const request = this.returnRequests.get(id);
        if (!request) throw new Error(`Return request ${id} not found`);
        const updated = { ...request, ...updates, updatedAt: new Date() };
        this.returnRequests.set(id, updated);
        return updated;
    }

    async deleteReturnRequest(id: number): Promise<void> {
        this.returnRequests.delete(id);
    }

    async processRefund(returnRequestId: number): Promise<void> {
        // No-op for tests
    }

    // ============ Misc Operations ============

    async sendSMSNotification(phone: string, message: string): Promise<void> {
        // No-op for tests
    }

    async updateOrderStatus(orderId: number, status: OrderStatus, trackingInfo?: string): Promise<Order> {
        const order = this.orders.get(orderId);
        if (!order) throw new Error(`Order ${orderId} not found`);
        const updated = { ...order, status, trackingInfo: trackingInfo ?? order.trackingInfo, updatedAt: new Date() };
        this.orders.set(orderId, updated);
        return updated;
    }

    async getOrderTimeline(orderId: number): Promise<any[]> {
        return [];
    }

    async updateProviderProfile(id: number, profile: Partial<User>): Promise<User> {
        return this.updateUser(id, profile);
    }

    async updateProviderAvailability(providerId: number, availability: any): Promise<void> {
        // No-op for tests
    }

    async getProviderAvailability(providerId: number): Promise<any> {
        return null;
    }

    async updateBookingStatus(id: number, status: any, comment?: string): Promise<Booking> {
        return this.updateBooking(id, { status });
    }

    async getBookingsByService(serviceId: number, date: Date): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter(b => b.serviceId === serviceId);
    }

    async getProviderSchedule(providerId: number, date: Date): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter(b => b.providerId === providerId);
    }

    async completeService(bookingId: number): Promise<Booking> {
        return this.updateBooking(bookingId, { status: "completed" });
    }

    async addBookingReview(bookingId: number, review: InsertReview): Promise<Review> {
        return this.createReview({ ...review, bookingId });
    }

    async respondToReview(reviewId: number, response: string): Promise<Review> {
        return this.updateReview(reviewId, { providerReply: response });
    }

    async getBlockedTimeSlots(serviceId: number): Promise<any[]> {
        return [];
    }

    async createBlockedTimeSlot(data: any): Promise<any> {
        return { id: 1, ...data };
    }

    async deleteBlockedTimeSlot(slotId: number): Promise<void> {
        // No-op
    }

    async getOverlappingBookings(serviceId: number, date: Date, startTime: string, endTime: string): Promise<Booking[]> {
        return [];
    }

    async deleteUserAndData(userId: number): Promise<void> {
        this.users.delete(userId);
        // Clean up related data
        for (const [id, booking] of this.bookings) {
            if (booking.customerId === userId) this.bookings.delete(id);
        }
        for (const [id, order] of this.orders) {
            if (order.customerId === userId) this.orders.delete(id);
        }
        this.cart.delete(userId);
        this.wishlist.delete(userId);
    }

    async globalSearch(params: any): Promise<any[]> {
        return [];
    }

    // ============ Test Helpers ============

    reset(): void {
        this.users.clear();
        this.services.clear();
        this.bookings.clear();
        this.products.clear();
        this.orders.clear();
        this.orderItems.clear();
        this.reviews.clear();
        this.productReviews.clear();
        this.notifications.clear();
        this.promotions.clear();
        this.returnRequests.clear();
        this.cart.clear();
        this.wishlist.clear();
        this.nextUserId = 1;
        this.nextServiceId = 1;
        this.nextBookingId = 1;
        this.nextProductId = 1;
        this.nextOrderId = 1;
        this.nextOrderItemId = 1;
        this.nextReviewId = 1;
        this.nextProductReviewId = 1;
        this.nextNotificationId = 1;
        this.nextPromotionId = 1;
        this.nextReturnRequestId = 1;
    }

    // Seed test data
    async seedTestData(): Promise<void> {
        // Create test users
        await this.createUser({
            username: "testcustomer",
            password: "hashedpassword.salt",
            email: "customer@test.com",
            phone: "789546741",
            pin: "2702",
            name: "Test Customer",
            role: "customer",
        });

        await this.createUser({
            username: "testshop",
            password: "hashedpassword.salt",
            email: "shop@test.com",
            phone: "9876543210",
            name: "Test Shop",
            role: "shop",
            shopName: "Test Shop",
            hasShopProfile: true,
        });

        await this.createUser({
            username: "testprovider",
            password: "hashedpassword.salt",
            email: "provider@test.com",
            phone: "9876543211",
            name: "Test Provider",
            role: "provider",
            hasProviderProfile: true,
        });
    }
}

// Export singleton for tests
export const mockStorage = new MockStorage();
