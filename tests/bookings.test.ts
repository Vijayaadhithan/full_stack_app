import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import type { MemStorage } from "../server/storage";

process.env.USE_IN_MEMORY_DB = "true";
process.env.SESSION_SECRET = "MyUniqueSessionKey_ForTesting_9876543210!@#";
process.env.DATABASE_URL = "postgres://localhost/test";
process.env.DISABLE_RATE_LIMITERS = "true";

const { storage } = await import("../server/storage");
const { hashPasswordInternal } = await import("../server/auth");
const { registerRoutes } = await import("../server/routes");

const app = express();
app.use(express.json());
await registerRoutes(app);

const memStorage = storage as MemStorage;
const customerPassword = await hashPasswordInternal("pass");
const customer = await memStorage.createUser({
  username: "customer",
  password: customerPassword,
  role: "customer",
  name: "Cust",
  phone: "9000000002",
  email: "vijaythriller11@gmail.com",
  isPhoneVerified: true,
  emailVerified: true,
  averageRating: "0",
  totalReviews: 0,
});
await memStorage.updateUser(customer.id, {
  verificationStatus: "verified",
  addressLandmark: "Near the big temple",
});
const provider = await memStorage.createUser({
  username: "provider",
  password: "",
  role: "provider",
  name: "Prov",
  phone: "9000000003",
  email: "vjaadhi2799@gmail.com",
  isPhoneVerified: true,
  emailVerified: true,
  averageRating: "0",
  totalReviews: 0,
});
await memStorage.updateUser(provider.id, {
  verificationStatus: "verified",
});
const unverifiedCustomer = await memStorage.createUser({
  username: "customer_unverified",
  password: customerPassword,
  role: "customer",
  name: "Cust Unverified",
  phone: "9000000004",
  email: "unverified_customer@example.com",
  isPhoneVerified: false,
  emailVerified: false,
  averageRating: "0",
  totalReviews: 0,
});
const service = await memStorage.createService({
  name: "Test Service",
  description: "Desc",
  price: "100",
  duration: 60,
  category: "Cat",
  providerId: provider.id,
  isAvailable: true,
  bufferTime: 0,
  images: [],
  breakTime: [],
  serviceLocationType: "customer_location",
  isAvailableNow: true,
  allowedSlots: [],
});

describe("Bookings API", () => {
  it("creates a booking", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: customer.username, password: "pass" });
    const res = await agent.post("/api/bookings").send({
      serviceId: service.id,
      bookingDate: new Date().toISOString(),
      serviceLocation: "customer",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.booking.serviceId, service.id);
  });

  it("rejects booking when profile is not verified", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: unverifiedCustomer.username, password: "pass" });

    const res = await agent.post("/api/bookings").send({
      serviceId: service.id,
      bookingDate: new Date().toISOString(),
      serviceLocation: "customer",
    });

    assert.equal(res.status, 403);
    assert.ok(
      typeof res.body.message === "string" &&
      res.body.message.includes("Profile verification required"),
    );
  });

  it("fetches and hydrates customer booking requests", async () => {
    const agent = request.agent(app);
    const loginRes = await agent
      .post("/api/login")
      .send({ username: customer.username, password: "pass" });
    assert.equal(loginRes.status, 200, "Login failed");

    // Create a booking first
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    await agent.post("/api/bookings").send({
      serviceId: service.id,
      bookingDate: futureDate.toISOString(),
      serviceLocation: "customer",
    });

    // Fetch requests
    const res = await agent.get("/api/bookings/customer/requests");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);

    const booking = res.body[0];
    assert.ok(booking.service, "Service should be hydrated");
    assert.equal(booking.service.id, service.id);
    assert.ok(booking.provider, "Provider details should be hydrated");
    assert.equal(booking.provider.id, provider.id);
    assert.ok(booking.customer, "Customer details should be hydrated");
    assert.equal(booking.customer.id, customer.id);
    assert.ok(booking.relevantAddress, "Address should be picked");
  });

  after(async () => {
    // Close the server (if accessible) or just ensure connections are closed
    // Since app is just an express instance and not a listening server, we focus on DB/Redis
    const { closeConnection } = await import("../server/db");
    const { closeRedisConnection } = await import("../server/services/cache.service");
    const { closeRealtimeConnections } = await import("../server/realtime");

    await closeRealtimeConnections();
    await closeRedisConnection();
    await closeConnection();
  });
});
