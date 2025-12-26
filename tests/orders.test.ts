import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import type { MemStorage } from "../server/storage";
import { featureFlags, platformFees } from "../shared/config";

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
await memStorage.updateUser(customer.id, {
  verificationStatus: "verified",
});
const shop = await memStorage.createUser({
  username: "shop",
  password: "",
  role: "shop",
  name: "Shop",
  phone: "",
  email: "vijaythrillera@gmail.com",
});
await memStorage.updateUser(shop.id, {
  verificationStatus: "verified",
});
const unverifiedCustomer = await memStorage.createUser({
  username: "customer_unverified",
  password: customerPassword,
  role: "customer",
  name: "Cust Unverified",
  phone: "",
  email: "unverified_order_customer@example.com",
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
    const productPrice = Number(product.price);
    const platformFee = featureFlags.platformFeesEnabled ? platformFees.productOrder : 0;
    const totalWithFee = productPrice + platformFee;
    const res = await agent.post("/api/orders").send({
      items: [{ productId: product.id, quantity: 1, price: product.price }],
      total: totalWithFee.toString(),
      subtotal: productPrice.toString(),
      discount: "0",
      deliveryMethod: "delivery",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.order.shopId, shop.id);
  });

  it("rejects an order when the customer profile is not verified", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: unverifiedCustomer.username, password: "pass" });

    const productPrice = Number(product.price);
    const platformFee = featureFlags.platformFeesEnabled ? platformFees.productOrder : 0;
    const totalWithFee = productPrice + platformFee;
    const res = await agent.post("/api/orders").send({
      items: [{ productId: product.id, quantity: 1, price: product.price }],
      total: totalWithFee.toString(),
      subtotal: productPrice.toString(),
      discount: "0",
      deliveryMethod: "delivery",
    });

    assert.equal(res.status, 403);
    assert.ok(
      typeof res.body.message === "string" &&
        res.body.message.includes("Profile verification required"),
    );
  });
  it("rejects orders when totals do not match the server calculation", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/login")
      .send({ username: customer.username, password: "pass" });

    const productPrice = Number(product.price);
    const res = await agent.post("/api/orders").send({
      items: [{ productId: product.id, quantity: 1, price: product.price }],
      total: "1", // Intentionally incorrect total
      subtotal: productPrice.toString(),
      discount: "0",
      deliveryMethod: "delivery",
    });

    const platformFee = featureFlags.platformFeesEnabled ? platformFees.productOrder : 0;
    const expectedTotal = (productPrice + platformFee).toFixed(2);
    assert.equal(res.status, 400);
    assert.equal(res.body.expectedTotal, expectedTotal);
    assert.equal(
      res.body.message,
      "Order total mismatch. Please review your cart and try again.",
    );
  });
});
