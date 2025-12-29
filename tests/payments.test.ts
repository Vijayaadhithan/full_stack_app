import { describe, it, after } from "node:test";
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
const providerPassword = await hashPasswordInternal("pass");
const shopPassword = await hashPasswordInternal("pass");

const customer = await memStorage.createUser({
  username: "customer",
  password: customerPassword,
  role: "customer",
  name: "Cust",
  phone: "9000000008",
  email: "vjaadhi2799@gmail.com",
});
await memStorage.updateUser(customer.id, {
  verificationStatus: "verified",
  addressLandmark: "Near the big temple",
});
const provider = await memStorage.createUser({
  username: "provider",
  password: providerPassword,
  role: "provider",
  name: "Prov",
  phone: "9000000009",
  email: "vijaythriller11@gmail.com",
});
await memStorage.updateUser(provider.id, {
  verificationStatus: "verified",
});
const shop = await memStorage.createUser({
  username: "shop",
  password: shopPassword,
  role: "shop",
  name: "Shop",
  phone: "9000000010",
  email: "vijaythrillera@gmail.com",
});
await memStorage.updateUser(shop.id, {
  verificationStatus: "verified",
});
const service = await memStorage.createService({
  name: "Svc",
  description: "",
  price: "100",
  duration: 60,
  category: "Cat",
  providerId: provider.id,
  isAvailable: true,
  bufferTime: 0,
  images: [],
});
const product = await memStorage.createProduct({
  name: "Item",
  description: "",
  price: "50",
  stock: 10,
  category: "Cat",
  shopId: shop.id,
  isAvailable: true,
  images: [],
});

describe("Payment APIs", () => {
  it("handles booking payment reference flow", async () => {
    const customerAgent = request.agent(app);
    await customerAgent
      .post("/api/login")
      .send({ username: customer.username, password: "pass" });

    const bookingRes = await customerAgent.post("/api/bookings").send({
      serviceId: service.id,
      bookingDate: new Date().toISOString(),
      serviceLocation: "customer",
    });
    assert.equal(bookingRes.status, 201);
    const bookingId = bookingRes.body.booking.id;

    // Provider accepts the booking
    const providerAgent = request.agent(app);
    await providerAgent
      .post("/api/login")
      .send({ username: provider.username, password: "pass" });
    const acceptRes = await providerAgent
      .patch(`/api/bookings/${bookingId}/status`)
      .send({ status: "accepted" });
    assert.equal(acceptRes.status, 200);

    // Customer submits payment reference
    const submitRes = await customerAgent
      .patch(`/api/bookings/${bookingId}/customer-complete`)
      .send({ paymentReference: "PAY123" });
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.booking.status, "awaiting_payment");
    assert.equal(submitRes.body.booking.paymentReference, "PAY123");

    // Customer updates payment reference
    const updateRes = await customerAgent
      .patch(`/api/bookings/${bookingId}/update-reference`)
      .send({ paymentReference: "PAY999" });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.booking.paymentReference, "PAY999");
  });

  it("handles order payment verification flow", async () => {
    const customerAgent = request.agent(app);
    await customerAgent
      .post("/api/login")
      .send({ username: customer.username, password: "pass" });

    const productPrice = Number(product.price);
    const platformFee = featureFlags.platformFeesEnabled ? platformFees.productOrder : 0;
    const totalWithFee = productPrice + platformFee;
    const orderRes = await customerAgent.post("/api/orders").send({
      items: [{ productId: product.id, quantity: 1, price: product.price }],
      total: totalWithFee.toString(),
      subtotal: productPrice.toString(),
      discount: "0",
      deliveryMethod: "delivery",
    });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.order.id;

    // Customer submits payment reference
    const submitRes = await customerAgent
      .post(`/api/orders/${orderId}/submit-payment-reference`)
      .send({ paymentReference: "ORDPAY123" });
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.paymentStatus, "verifying");
    assert.equal(submitRes.body.paymentReference, "ORDPAY123");

    // Shop confirms payment
    const shopAgent = request.agent(app);
    await shopAgent
      .post("/api/login")
      .send({ username: shop.username, password: "pass" });
    const confirmRes = await shopAgent.post(`/api/orders/${orderId}/confirm-payment`);
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.paymentStatus, "paid");
    assert.equal(confirmRes.body.status, "confirmed");
  });

  it("allows cash payment for pickup orders", async () => {
    const customerAgent = request.agent(app);
    await customerAgent
      .post("/api/login")
      .send({ username: customer.username, password: "pass" });

    const productPrice = Number(product.price);
    const platformFee = featureFlags.platformFeesEnabled ? platformFees.productOrder : 0;
    const totalWithFee = productPrice + platformFee;
    const orderRes = await customerAgent.post("/api/orders").send({
      items: [{ productId: product.id, quantity: 1, price: product.price }],
      total: totalWithFee.toString(),
      subtotal: productPrice.toString(),
      discount: "0",
      deliveryMethod: "pickup",
      paymentMethod: "cash",
    });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.order.id;
    assert.equal(orderRes.body.order.paymentMethod, "cash");
    assert.equal(orderRes.body.order.paymentStatus, "pending");

    const shopAgent = request.agent(app);
    await shopAgent
      .post("/api/login")
      .send({ username: shop.username, password: "pass" });
    const confirmRes = await shopAgent.post(
      `/api/orders/${orderId}/confirm-payment`,
    );
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.paymentStatus, "paid");
  });

  after(() => {
    process.exit(0);
  });
});
