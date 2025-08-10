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
  email: "vjaadhi2799@gmail.com",
});
const shop = await memStorage.createUser({
  username: "shop",
  password: "",
  role: "shop",
  name: "Shop",
  phone: "",
  email: "vijaythrillera@gmail.com",
});
const product = await memStorage.createProduct({
  name: "Item",
  description: "Desc",
  price: "50",
  stock: 10,
  category: "Cat",
  shopId: shop.id,
  isAvailable: true,
  images: [],
});

describe("Orders API", () => {
  it("creates an order", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: customer.username, password: "pass" });
    const res = await agent.post("/api/orders").send({
      items: [{ productId: product.id, quantity: 1, price: product.price }],
      total: product.price,
      deliveryMethod: "delivery",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.order.shopId, shop.id);
  });
});