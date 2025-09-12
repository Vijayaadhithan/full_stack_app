import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import express from "express";

// Verify that modular routers for bookings and orders are registered

describe("route modules", () => {
  it("registers bookings and orders routers", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.SESSION_SECRET = "test";
    const { registerRoutes } = await import("../server/routes");

    const app = express();
    app.use(express.json());
    await registerRoutes(app);

    // The bookings router exposes a simple test endpoint under /test to
    // avoid clashing with the real /api/bookings routes used by the app.
    const resBookings = await request(app).get("/api/bookings/test");
    assert.equal(resBookings.status, 200);
    assert.equal(resBookings.body.message, "bookings route");

    const resOrders = await request(app).get("/api/orders");
    assert.equal(resOrders.status, 200);
    assert.equal(resOrders.body.message, "orders route");
  });
});