import { describe, it, after } from "node:test";
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
const hashedPassword = await hashPasswordInternal("pass");

const verifiedProvider = await memStorage.createUser({
  username: "guard_provider_verified",
  password: hashedPassword,
  role: "provider",
  name: "Verified Provider",
  phone: "9000000011",
  email: "verified_provider@example.com",
});
await memStorage.updateUser(verifiedProvider.id, {
  verificationStatus: "verified",
});

const unverifiedProvider = await memStorage.createUser({
  username: "guard_provider_unverified",
  password: hashedPassword,
  role: "provider",
  name: "Unverified Provider",
  phone: "9000000012",
  email: "unverified_provider@example.com",
});

const verifiedShop = await memStorage.createUser({
  username: "guard_shop_verified",
  password: hashedPassword,
  role: "shop",
  name: "Verified Shop",
  phone: "9000000013",
  email: "verified_shop@example.com",
});
await memStorage.updateUser(verifiedShop.id, {
  verificationStatus: "verified",
});

const unverifiedShop = await memStorage.createUser({
  username: "guard_shop_unverified",
  password: hashedPassword,
  role: "shop",
  name: "Unverified Shop",
  phone: "9000000014",
  email: "unverified_shop@example.com",
});

const workingHours = {
  monday: { isAvailable: true, start: "09:00", end: "17:00" },
  tuesday: { isAvailable: true, start: "09:00", end: "17:00" },
  wednesday: { isAvailable: true, start: "09:00", end: "17:00" },
  thursday: { isAvailable: true, start: "09:00", end: "17:00" },
  friday: { isAvailable: true, start: "09:00", end: "17:00" },
  saturday: { isAvailable: false, start: "09:00", end: "17:00" },
  sunday: { isAvailable: false, start: "09:00", end: "17:00" },
};

const servicePayload = {
  name: "Guarded Service",
  description: "Service requiring verification",
  category: "general",
  price: "100",
  duration: 60,
  isAvailable: true,
  workingHours,
  breakTime: [],
  maxDailyBookings: 5,
  bufferTime: 0,
  serviceLocationType: "provider_location",
};

const productPayload = {
  name: "Guarded Product",
  description: "Product requiring verification",
  price: "25",
  mrp: "30",
  stock: 5,
  category: "general",
  images: [],
  isAvailable: true,
  tags: [],
  minOrderQuantity: 1,
};

describe("Profile verification guard rails", () => {
  it("rejects service creation when provider profile is not verified", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: unverifiedProvider.username, password: "pass" });

    const res = await agent.post("/api/services").send(servicePayload);

    assert.equal(res.status, 403);
    assert.match(String(res.body.message ?? ""), /verification/i);
  });

  it("allows service creation once provider profile is verified", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: verifiedProvider.username, password: "pass" });

    const res = await agent.post("/api/services").send(servicePayload);

    assert.equal(res.status, 201);
    assert.equal(res.body.providerId, verifiedProvider.id);
  });

  it("rejects product creation when shop profile is not verified", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: unverifiedShop.username, password: "pass" });

    const res = await agent.post("/api/products").send(productPayload);

    assert.equal(res.status, 403);
    assert.match(String(res.body.message ?? ""), /verification/i);
  });

  it("allows product creation once shop profile is verified", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: verifiedShop.username, password: "pass" });

    const res = await agent.post("/api/products").send(productPayload);

    assert.equal(res.status, 201);
    assert.equal(res.body.shopId, verifiedShop.id);
  });

  after(() => {
    process.exit(0);
  });
});
