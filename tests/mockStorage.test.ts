/**
 * Integration tests using MockStorage
 * Tests auth routes and storage operations without database
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { MockStorage } from "./mockStorage.js";

describe("MockStorage - User Operations", () => {
    let storage: MockStorage;

    beforeEach(() => {
        storage = new MockStorage();
        storage.reset();
    });

    describe("createUser", () => {
        it("should create a new user with all fields", async () => {
            const user = await storage.createUser({
                username: "testuser",
                password: "hashedpass.salt",
                email: "test@example.com",
                phone: "9876543210",
                name: "Test User",
                role: "customer",
            });

            assert.strictEqual(user.id, 1);
            assert.strictEqual(user.username, "testuser");
            assert.strictEqual(user.email, "test@example.com");
            assert.strictEqual(user.phone, "9876543210");
            assert.strictEqual(user.role, "customer");
        });

        it("should auto-increment user IDs", async () => {
            const user1 = await storage.createUser({ username: "user1" });
            const user2 = await storage.createUser({ username: "user2" });

            assert.strictEqual(user1.id, 1);
            assert.strictEqual(user2.id, 2);
        });

        it("should set default values", async () => {
            const user = await storage.createUser({});

            assert.strictEqual(user.role, "customer");
            assert.strictEqual(user.isSuspended, false);
            assert.strictEqual(user.isDeleted, false);
            assert.ok(user.createdAt instanceof Date);
        });
    });

    describe("getUser", () => {
        it("should get user by ID", async () => {
            await storage.createUser({ username: "findme" });
            const user = await storage.getUser(1);

            assert.strictEqual(user?.username, "findme");
        });

        it("should return undefined for non-existent user", async () => {
            const user = await storage.getUser(999);
            assert.strictEqual(user, undefined);
        });
    });

    describe("getUserByUsername", () => {
        it("should find user by username (case-insensitive)", async () => {
            await storage.createUser({ username: "TestUser" });
            const user = await storage.getUserByUsername("testuser");

            assert.strictEqual(user?.username, "TestUser");
        });

        it("should return undefined if not found", async () => {
            const user = await storage.getUserByUsername("nonexistent");
            assert.strictEqual(user, undefined);
        });
    });

    describe("getUserByEmail", () => {
        it("should find user by email (case-insensitive)", async () => {
            await storage.createUser({ email: "Test@Example.COM" });
            const user = await storage.getUserByEmail("test@example.com");

            assert.strictEqual(user?.email, "Test@Example.COM");
        });
    });

    describe("getUserByPhone", () => {
        it("should find user by phone (normalized)", async () => {
            await storage.createUser({ phone: "789546741" });
            const user = await storage.getUserByPhone("789546741");

            assert.strictEqual(user?.phone, "789546741");
        });

        it("should normalize phone number for lookup (same digits)", async () => {
            await storage.createUser({ phone: "9876543210" });
            // Spaces and dashes are stripped, leaving same digits
            const user = await storage.getUserByPhone("987-654-3210");

            assert.strictEqual(user?.phone, "9876543210");
        });
    });

    describe("updateUser", () => {
        it("should update user fields", async () => {
            await storage.createUser({ username: "original" });
            const updated = await storage.updateUser(1, { name: "Updated Name", bio: "New bio" });

            assert.strictEqual(updated.name, "Updated Name");
            assert.strictEqual(updated.bio, "New bio");
            assert.strictEqual(updated.username, "original");
        });

        it("should throw for non-existent user", async () => {
            await assert.rejects(
                () => storage.updateUser(999, { name: "Test" }),
                /User 999 not found/
            );
        });
    });

    describe("getAllUsers", () => {
        it("should return all users", async () => {
            await storage.createUser({ username: "user1" });
            await storage.createUser({ username: "user2" });
            await storage.createUser({ username: "user3" });

            const users = await storage.getAllUsers();
            assert.strictEqual(users.length, 3);
        });

        it("should support pagination", async () => {
            for (let i = 0; i < 10; i++) {
                await storage.createUser({ username: `user${i}` });
            }

            const page1 = await storage.getAllUsers({ limit: 3, offset: 0 });
            const page2 = await storage.getAllUsers({ limit: 3, offset: 3 });

            assert.strictEqual(page1.length, 3);
            assert.strictEqual(page2.length, 3);
            assert.notStrictEqual(page1[0].id, page2[0].id);
        });
    });

    describe("getUsersByIds", () => {
        it("should return users by IDs", async () => {
            await storage.createUser({ username: "user1" });
            await storage.createUser({ username: "user2" });
            await storage.createUser({ username: "user3" });

            const users = await storage.getUsersByIds([1, 3]);
            assert.strictEqual(users.length, 2);
            assert.ok(users.some(u => u.username === "user1"));
            assert.ok(users.some(u => u.username === "user3"));
        });

        it("should filter out non-existent IDs", async () => {
            await storage.createUser({ username: "user1" });
            const users = await storage.getUsersByIds([1, 999]);

            assert.strictEqual(users.length, 1);
        });
    });

    describe("getShops", () => {
        it("should return only shop users", async () => {
            await storage.createUser({ username: "customer", role: "customer" });
            await storage.createUser({ username: "shop1", role: "shop" });
            await storage.createUser({ username: "shop2", role: "shop" });
            await storage.createUser({ username: "provider", role: "provider" });

            const shops = await storage.getShops();
            assert.strictEqual(shops.length, 2);
            assert.ok(shops.every(s => s.role === "shop"));
        });
    });
});

describe("MockStorage - Service Operations", () => {
    let storage: MockStorage;

    beforeEach(async () => {
        storage = new MockStorage();
        storage.reset();
        await storage.createUser({ username: "provider", role: "provider" });
    });

    describe("createService", () => {
        it("should create a service", async () => {
            const service = await storage.createService({
                providerId: 1,
                name: "Haircut",
                price: "100.00",
                duration: 30,
                category: "Beauty",
            });

            assert.strictEqual(service.id, 1);
            assert.strictEqual(service.name, "Haircut");
            assert.strictEqual(service.providerId, 1);
        });
    });

    describe("getServicesByProvider", () => {
        it("should return services for a provider", async () => {
            await storage.createService({ providerId: 1, name: "Service 1", price: "50", duration: 30 });
            await storage.createService({ providerId: 1, name: "Service 2", price: "75", duration: 45 });
            await storage.createService({ providerId: 2, name: "Service 3", price: "100", duration: 60 });

            const services = await storage.getServicesByProvider(1);
            assert.strictEqual(services.length, 2);
        });
    });

    describe("updateService", () => {
        it("should update service fields", async () => {
            await storage.createService({ providerId: 1, name: "Original", price: "50", duration: 30 });
            const updated = await storage.updateService(1, { name: "Updated", price: "75" });

            assert.strictEqual(updated.name, "Updated");
            assert.strictEqual(updated.price, "75");
        });
    });

    describe("deleteService", () => {
        it("should delete a service", async () => {
            await storage.createService({ providerId: 1, name: "ToDelete", price: "50", duration: 30 });
            await storage.deleteService(1);

            const service = await storage.getService(1);
            assert.strictEqual(service, undefined);
        });
    });
});

describe("MockStorage - Product Operations", () => {
    let storage: MockStorage;

    beforeEach(async () => {
        storage = new MockStorage();
        storage.reset();
        await storage.createUser({ username: "shop", role: "shop" });
    });

    describe("createProduct", () => {
        it("should create a product", async () => {
            const product = await storage.createProduct({
                shopId: 1,
                name: "Test Product",
                price: "99.99",
                category: "Electronics",
                stock: 100,
            });

            assert.strictEqual(product.id, 1);
            assert.strictEqual(product.name, "Test Product");
            assert.strictEqual(product.stock, 100);
        });
    });

    describe("getProductsByShop", () => {
        it("should return products for a shop", async () => {
            await storage.createProduct({ shopId: 1, name: "Product 1", price: "10" });
            await storage.createProduct({ shopId: 1, name: "Product 2", price: "20" });
            await storage.createProduct({ shopId: 2, name: "Product 3", price: "30" });

            const products = await storage.getProductsByShop(1);
            assert.strictEqual(products.length, 2);
        });
    });

    describe("updateProduct", () => {
        it("should update product stock", async () => {
            await storage.createProduct({ shopId: 1, name: "Product", price: "10", stock: 50 });
            const updated = await storage.updateProduct(1, { stock: 25 });

            assert.strictEqual(updated.stock, 25);
        });
    });

    describe("bulkUpdateProductStock", () => {
        it("should update multiple product stocks", async () => {
            await storage.createProduct({ shopId: 1, name: "P1", price: "10", stock: 10 });
            await storage.createProduct({ shopId: 1, name: "P2", price: "20", stock: 20 });

            const updated = await storage.bulkUpdateProductStock([
                { productId: 1, stock: 5 },
                { productId: 2, stock: 15 },
            ]);

            assert.strictEqual(updated.length, 2);
            assert.strictEqual(updated[0].stock, 5);
            assert.strictEqual(updated[1].stock, 15);
        });
    });
});

describe("MockStorage - Cart Operations", () => {
    let storage: MockStorage;

    beforeEach(async () => {
        storage = new MockStorage();
        storage.reset();
        await storage.createUser({ username: "customer", role: "customer" });
        await storage.createUser({ username: "shop", role: "shop" });
        await storage.createProduct({ shopId: 2, name: "Product 1", price: "10" });
        await storage.createProduct({ shopId: 2, name: "Product 2", price: "20" });
    });

    describe("addToCart", () => {
        it("should add product to cart", async () => {
            await storage.addToCart(1, 1, 2);
            const cart = await storage.getCart(1);

            assert.strictEqual(cart.length, 1);
            assert.strictEqual(cart[0].quantity, 2);
        });
    });

    describe("getCart", () => {
        it("should return cart with products", async () => {
            await storage.addToCart(1, 1, 2);
            await storage.addToCart(1, 2, 3);
            const cart = await storage.getCart(1);

            assert.strictEqual(cart.length, 2);
        });

        it("should return empty for new user", async () => {
            const cart = await storage.getCart(999);
            assert.strictEqual(cart.length, 0);
        });
    });

    describe("removeFromCart", () => {
        it("should remove product from cart", async () => {
            await storage.addToCart(1, 1, 2);
            await storage.addToCart(1, 2, 3);
            await storage.removeFromCart(1, 1);
            const cart = await storage.getCart(1);

            assert.strictEqual(cart.length, 1);
            assert.strictEqual(cart[0].product.id, 2);
        });
    });

    describe("clearCart", () => {
        it("should clear entire cart", async () => {
            await storage.addToCart(1, 1, 2);
            await storage.addToCart(1, 2, 3);
            await storage.clearCart(1);
            const cart = await storage.getCart(1);

            assert.strictEqual(cart.length, 0);
        });
    });
});

describe("MockStorage - Order Operations", () => {
    let storage: MockStorage;

    beforeEach(async () => {
        storage = new MockStorage();
        storage.reset();
        await storage.createUser({ username: "customer", role: "customer" });
        await storage.createUser({ username: "shop", role: "shop" });
        await storage.createProduct({ shopId: 2, name: "Product", price: "100" });
    });

    describe("createOrderWithItems", () => {
        it("should create order with items", async () => {
            const order = await storage.createOrderWithItems(
                { customerId: 1, shopId: 2, totalAmount: "200", status: "pending" },
                [{ productId: 1, quantity: 2, price: "100", total: "200" }]
            );

            assert.strictEqual(order.id, 1);
            assert.strictEqual(order.totalAmount, "200");

            const items = await storage.getOrderItemsByOrder(1);
            assert.strictEqual(items.length, 1);
            assert.strictEqual(items[0].quantity, 2);
        });
    });

    describe("getOrdersByCustomer", () => {
        it("should return orders for customer", async () => {
            await storage.createOrder({ customerId: 1, shopId: 2, totalAmount: "100" });
            await storage.createOrder({ customerId: 1, shopId: 2, totalAmount: "200" });
            await storage.createOrder({ customerId: 2, shopId: 2, totalAmount: "300" });

            const orders = await storage.getOrdersByCustomer(1);
            assert.strictEqual(orders.length, 2);
        });
    });

    describe("updateOrderStatus", () => {
        it("should update order status", async () => {
            await storage.createOrder({ customerId: 1, shopId: 2, totalAmount: "100" });
            const updated = await storage.updateOrderStatus(1, "processing", "Tracking123");

            assert.strictEqual(updated.status, "processing");
            assert.strictEqual(updated.trackingInfo, "Tracking123");
        });
    });
});

describe("MockStorage - Booking Operations", () => {
    let storage: MockStorage;

    beforeEach(async () => {
        storage = new MockStorage();
        storage.reset();
        await storage.createUser({ username: "customer", role: "customer" });
        await storage.createUser({ username: "provider", role: "provider" });
        await storage.createService({ providerId: 2, name: "Service", price: "50", duration: 30 });
    });

    describe("createBooking", () => {
        it("should create a booking", async () => {
            const booking = await storage.createBooking({
                serviceId: 1,
                customerId: 1,
                providerId: 2,
                date: new Date(),
                status: "pending",
            });

            assert.strictEqual(booking.id, 1);
            assert.strictEqual(booking.status, "pending");
        });
    });

    describe("getBookingsByCustomer", () => {
        it("should return bookings for customer", async () => {
            await storage.createBooking({ serviceId: 1, customerId: 1, providerId: 2, date: new Date() });
            await storage.createBooking({ serviceId: 1, customerId: 1, providerId: 2, date: new Date() });

            const bookings = await storage.getBookingsByCustomer(1);
            assert.strictEqual(bookings.length, 2);
        });
    });

    describe("updateBookingStatus", () => {
        it("should update booking status", async () => {
            await storage.createBooking({ serviceId: 1, customerId: 1, providerId: 2, date: new Date() });
            const updated = await storage.updateBookingStatus(1, "confirmed");

            assert.strictEqual(updated.status, "confirmed");
        });
    });
});

describe("MockStorage - Notification Operations", () => {
    let storage: MockStorage;

    beforeEach(async () => {
        storage = new MockStorage();
        storage.reset();
        await storage.createUser({ username: "user" });
    });

    describe("createNotification", () => {
        it("should create notification", async () => {
            const notification = await storage.createNotification({
                userId: 1,
                type: "order",
                title: "New Order",
                message: "You have a new order",
            });

            assert.strictEqual(notification.id, 1);
            assert.strictEqual(notification.read, false);
        });
    });

    describe("markNotificationAsRead", () => {
        it("should mark notification as read", async () => {
            await storage.createNotification({ userId: 1, type: "order", title: "Test", message: "Test" });
            await storage.markNotificationAsRead(1);

            const { data } = await storage.getNotificationsByUser(1);
            assert.strictEqual(data[0].read, true);
        });
    });

    describe("markAllNotificationsAsRead", () => {
        it("should mark all notifications as read", async () => {
            await storage.createNotification({ userId: 1, type: "order", title: "Test 1", message: "Test" });
            await storage.createNotification({ userId: 1, type: "order", title: "Test 2", message: "Test" });
            await storage.markAllNotificationsAsRead(1);

            const { data } = await storage.getNotificationsByUser(1);
            assert.ok(data.every(n => n.read === true));
        });
    });
});

describe("MockStorage - Seed and Reset", () => {
    it("should seed test data", async () => {
        const storage = new MockStorage();
        await storage.seedTestData();

        const users = await storage.getAllUsers();
        assert.strictEqual(users.length, 3);

        const customer = await storage.getUserByPhone("789546741");
        assert.ok(customer);
        assert.strictEqual(customer.pin, "2702");
    });

    it("should reset all data", async () => {
        const storage = new MockStorage();
        await storage.seedTestData();
        storage.reset();

        const users = await storage.getAllUsers();
        assert.strictEqual(users.length, 0);
    });
});
