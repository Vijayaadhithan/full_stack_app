import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import type { MemStorage } from "../server/storage";

process.env.USE_IN_MEMORY_DB = "true";
process.env.SESSION_SECRET = "test";
process.env.DATABASE_URL = "postgres://localhost/test";

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
  phone: "",
  email: "vijaythriller11@gmail.com",
});
await memStorage.updateUser(customer.id, {
  verificationStatus: "verified",
});
const provider = await memStorage.createUser({
  username: "provider",
  password: "",
  role: "provider",
  name: "Prov",
  phone: "",
  email: "vjaadhi2799@gmail.com",
});
await memStorage.updateUser(provider.id, {
  verificationStatus: "verified",
});
const unverifiedCustomer = await memStorage.createUser({
  username: "customer_unverified",
  password: customerPassword,
  role: "customer",
  name: "Cust Unverified",
  phone: "",
  email: "unverified_customer@example.com",
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
});
