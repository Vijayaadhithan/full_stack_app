import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
// Ensure database configuration is present before loading the app
process.env.DATABASE_URL = "postgres://localhost/test";
const { app } = await import("../server/index");

describe("/api/health", () => {
  it("returns service info", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });
});
