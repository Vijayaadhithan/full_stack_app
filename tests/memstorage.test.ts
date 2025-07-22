import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "../server/storage";

describe("MemStorage basic operations", () => {
  const store = new MemStorage();

  it("creates and retrieves a user", async () => {
    const user = await store.createUser({
      username: "john",
      password: "secret",
      role: "customer",
      name: "John",
      phone: "123",
      email: "john@example.com",
    });
    const fetched = await store.getUser(user.id);
    assert.strictEqual(fetched?.username, "john");
  });

  it("handles cart items from one shop", async () => {
    const shop = await store.createUser({
      username: "shop1",
      password: "shop",
      role: "shop",
      name: "Shop",
      phone: "000",
      email: "shop@example.com",
    });
    const prod1 = await store.createProduct({
      name: "p1",
      description: "",
      price: "10",
      category: "c",
      shopId: shop.id,
      isAvailable: true,
      images: [],
      mrp: "10",
    });
    await store.addToCart(1, prod1.id, 1);
    const cart = await store.getCart(1);
    assert.strictEqual(cart.length, 1);
  });
  it("retrieves pending bookings for provider", async () => {
    const provider = await store.createUser({
      username: "prov", password: "p", role: "provider", name: "Prov", phone: "111", email: "prov@example.com"
    });
    const customer = await store.createUser({
      username: "cust", password: "c", role: "customer", name: "Cust", phone: "222", email: "cust@example.com"
    });
    const service = await store.createService({
      name: "svc", description: "", price: "5", duration: 30, category: "cat", providerId: provider.id, isAvailable: true, bufferTime: 0, images: [], serviceLocationType: "provider_location"
    });
    const booking = await store.createBooking({
      customerId: customer.id,
      serviceId: service.id,
      bookingDate: new Date(),
      serviceLocation: "customer",
    });

    const pending = await store.getPendingBookingRequestsForProvider(provider.id);
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].id, booking.id);
  });

  it("processes expired bookings", async () => {
    const provider = await store.createUser({
      username: "prov2", password: "p", role: "provider", name: "Prov2", phone: "112", email: "prov2@example.com"
    });
    const customer = await store.createUser({
      username: "cust2", password: "c", role: "customer", name: "Cust2", phone: "223", email: "cust2@example.com"
    });
    const service = await store.createService({
      name: "svc2", description: "", price: "5", duration: 30, category: "cat", providerId: provider.id, isAvailable: true, bufferTime: 0, images: [], serviceLocationType: "provider_location"
    });
    const booking = await store.createBooking({
      customerId: customer.id,
      serviceId: service.id,
      bookingDate: new Date(),
      serviceLocation: "customer",
    });
    await store.updateBooking(booking.id, { expiresAt: new Date(Date.now() - 1000) });

    await store.processExpiredBookings();
    const updated = await store.getBooking(booking.id);
    assert.strictEqual(updated?.status, "expired");
    const custNotes = await store.getNotificationsByUser(customer.id);
    assert.ok(custNotes.some((n) => n.type === "booking_expired"));
    const provNotes = await store.getNotificationsByUser(provider.id);
    assert.ok(provNotes.some((n) => n.type === "booking_expired"));
  });
});
