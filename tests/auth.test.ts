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
const hashed = await hashPasswordInternal("secret");
await memStorage.createUser({
  username: "testuser",
  password: hashed,
  role: "customer",
  name: "Test User",
  phone: "9000000001",
  email: "test@example.com",
});

describe("Authentication API", () => {
  it("logs in a user", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/login")
      .send({ username: "testuser", password: "secret" });
    assert.equal(res.status, 200);
    assert.equal(res.body.username, "testuser");
  });
});
