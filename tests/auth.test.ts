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
const hashed = await hashPasswordInternal("secret");
await memStorage.createUser({
  username: "testuser",
  password: hashed,
  role: "customer",
  name: "Test User",
  phone: "9000000001",
  email: "test@example.com",
  isPhoneVerified: true,
  emailVerified: true,
  averageRating: "0",
  totalReviews: 0,
});

describe("Authentication API", () => {
  it("logs in a user", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/login")
      .send({ username: "testuser", password: "secret" });

    assert.equal(res.status, 200);
    assert.equal(res.body.username, "testuser");

    // Verify session persistence (triggers deserializeUser)
    const userRes = await agent.get("/api/user");
    assert.equal(userRes.status, 200);
    assert.equal(userRes.body.username, "testuser");
    assert.ok(userRes.body.createdAt, "createdAt should be present");
  });

  it("rejects login with wrong password", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/login")
      .send({ username: "testuser", password: "wrongpassword" });

    assert.equal(res.status, 401);
  });

  it("rejects login with non-existent user", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/login")
      .send({ username: "nonexistent", password: "secret" });

    assert.equal(res.status, 401);
  });

  it("returns 401 for unauthenticated user info request", async () => {
    const agent = request.agent(app);
    const res = await agent.get("/api/user");

    assert.equal(res.status, 401);
  });

  it("logs out a user", async () => {
    const agent = request.agent(app);

    // Login first
    const loginRes = await agent
      .post("/api/login")
      .send({ username: "testuser", password: "secret" });
    assert.equal(loginRes.status, 200);

    // Get CSRF token and logout
    const csrfRes = await agent.get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;

    const logoutRes = await agent
      .post("/api/logout")
      .set("x-csrf-token", csrfToken);
    assert.equal(logoutRes.status, 200);

    // Verify session is cleared
    const userRes = await agent.get("/api/user");
    assert.equal(userRes.status, 401);
  });

  after(async () => {
    // Proper cleanup without process.exit
    const { closeConnection } = await import("../server/db");
    const { closeRedisConnection } = await import("../server/services/cache.service");
    const { closeRealtimeConnections } = await import("../server/realtime");

    try {
      await closeRealtimeConnections();
      await closeRedisConnection();
      await closeConnection();
    } catch {
      // Ignore cleanup errors in tests
    }
  });
});
