import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import type { WorkerResponsibility } from "@shared/schema";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/test";

const workerAuthModule = await import("../server/workerAuth");
const {
  coerceNumericId,
  requireShopOrWorkerPermission,
  getWorkerShopId,
  resolveShopContextId,
} = workerAuthModule;
const { db } = await import("../server/db");

function createRes() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
    send(body: unknown) {
      this.payload = body;
      return this;
    },
  };
}

beforeEach(() => {
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
});

describe("coerceNumericId", () => {
  it("parses strings and numbers", () => {
    assert.equal(coerceNumericId(42), 42);
    assert.equal(coerceNumericId("15"), 15);
    assert.equal(coerceNumericId("  "), null);
    assert.equal(coerceNumericId("abc"), null);
  });
});

describe("requireShopOrWorkerPermission", () => {
  const requiredPermission: WorkerResponsibility = "products:write";

  it("rejects unauthenticated requests", async () => {
    const guard = requireShopOrWorkerPermission(requiredPermission);
    const req = { isAuthenticated: () => false } as any;
    const res = createRes();
    const next = mock.fn();

    await guard(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });

  it("rejects suspended users", async () => {
    const guard = requireShopOrWorkerPermission(requiredPermission);
    const req = {
      isAuthenticated: () => true,
      user: { role: "shop", id: 1, isSuspended: true },
    } as any;
    const res = createRes();

    await guard(req, res, mock.fn());
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { message: "Account suspended" });
  });

  it("allows shop owners with numeric ids", async () => {
    const guard = requireShopOrWorkerPermission(requiredPermission);
    const req = {
      isAuthenticated: () => true,
      user: { role: "shop", id: 99 },
    } as any;
    const res = createRes();
    const next = mock.fn();

    await guard(req, res, next);
    assert.equal(next.mock.callCount(), 1);
    assert.equal(req.shopContextId, 99);
  });

  it("rejects shop owners without numeric ids", async () => {
    const guard = requireShopOrWorkerPermission(requiredPermission);
    const req = {
      isAuthenticated: () => true,
      user: { role: "shop", id: "not-a-number" },
    } as any;
    const res = createRes();

    await guard(req, res, mock.fn());
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { message: "Unable to resolve shop context" });
  });

  it("rejects workers without active link", async () => {
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }));

    const guard = requireShopOrWorkerPermission(requiredPermission);
    const req = {
      isAuthenticated: () => true,
      user: { role: "worker", id: 10 },
    } as any;
    const res = createRes();

    await guard(req, res, mock.fn());
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, {
      message: "Worker not active or not linked to a shop",
    });
  });

  it("rejects workers lacking required permissions", async () => {
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              responsibilities: ["orders:read"],
              active: true,
              shopId: 7,
            },
          ]),
      }),
    }));

    const guard = requireShopOrWorkerPermission(requiredPermission);
    const req = {
      isAuthenticated: () => true,
      user: { role: "worker", id: 10 },
    } as any;
    const res = createRes();

    await guard(req, res, mock.fn());
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { message: "Insufficient permissions" });
  });

  it("hydrates worker context when permissions satisfied", async () => {
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              responsibilities: ["products:write", "orders:read"],
              active: true,
              shopId: 5,
            },
          ]),
      }),
    }));

    const guard = requireShopOrWorkerPermission(requiredPermission);
    const req = {
      isAuthenticated: () => true,
      user: { role: "worker", id: 44 },
    } as any;
    const res = createRes();
    const next = mock.fn();

    await guard(req, res, next);
    assert.equal(next.mock.callCount(), 1);
    assert.equal(req.workerShopId, 5);
    assert.equal(req.shopContextId, 5);
  });
});

describe("worker context helpers", () => {
  it("getWorkerShopId returns the linked shop id", async () => {
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () => Promise.resolve([{ shopId: 12 }]),
      }),
    }));
    const shopId = await getWorkerShopId(1);
    assert.equal(shopId, 12);
  });

  it("getWorkerShopId returns null when no link", async () => {
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }));
    const shopId = await getWorkerShopId(1);
    assert.equal(shopId, null);
  });

  it("resolveShopContextId handles shop users", async () => {
    const req = { user: { role: "shop", id: "21" } } as any;
    const context = await resolveShopContextId(req);
    assert.equal(context, 21);
  });

  it("resolveShopContextId uses cached worker context", async () => {
    const req = {
      user: { role: "worker", id: 7 },
      shopContextId: 75,
    } as any;
    const context = await resolveShopContextId(req);
    assert.equal(context, 75);
  });

  it("resolveShopContextId looks up worker link when needed", async () => {
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () => Promise.resolve([{ shopId: 33 }]),
      }),
    }));
    const req = { user: { role: "worker", id: 9 } } as any;
    const context = await resolveShopContextId(req);
    assert.equal(context, 33);
  });

  it("resolveShopContextId returns null when worker id invalid", async () => {
    const req = { user: { role: "worker", id: "abc" } } as any;
    const context = await resolveShopContextId(req);
    assert.equal(context, null);
  });
});
