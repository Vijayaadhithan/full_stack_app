// Set env vars BEFORE any module loads to prevent Redis connections
process.env.NODE_ENV = "test";
process.env.USE_IN_MEMORY_DB = "true";
process.env.DISABLE_REDIS = "true";
process.env.DISABLE_RATE_LIMITERS = "true";

import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert";

type RegisterAuthRoutes = typeof import("../server/auth.js").registerAuthRoutes;
type Db = typeof import("../server/db.js").db;
type Storage = typeof import("../server/storage.js").storage;
type CloseConnection = typeof import("../server/db.js").closeConnection;
type CloseRealtimeConnections = typeof import("../server/realtime.js").closeRealtimeConnections;
type ResetCache = typeof import("../server/cache.js").__resetCacheForTesting;
type CreateMockApp = typeof import("./testHelpers.js").createMockApp;
type CreateMockReq = typeof import("./testHelpers.js").createMockReq;
type CreateMockRes = typeof import("./testHelpers.js").createMockRes;
type FindRoute = typeof import("./testHelpers.js").findRoute;

function createSelectChain<T>(result: T[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    rightJoin: () => chain,
    innerJoin: () => chain,
    limit: async () => result,
  };
  chain.then = (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("endpoint: POST /api/auth/create-shop", () => {
  let registerAuthRoutes: RegisterAuthRoutes;
  let db: Db;
  let storage: Storage;
  let closeConnection: CloseConnection;
  let closeRealtimeConnections: CloseRealtimeConnections;
  let resetCache: ResetCache;
  let createMockApp: CreateMockApp;
  let createMockReq: CreateMockReq;
  let createMockRes: CreateMockRes;
  let findRoute: FindRoute;

  before(async () => {
    ({ registerAuthRoutes } = await import("../server/auth.js"));
    ({ db } = await import("../server/db.js"));
    ({ storage } = await import("../server/storage.js"));
    ({ closeConnection } = await import("../server/db.js"));
    ({ closeRealtimeConnections } = await import("../server/realtime.js"));
    ({ __resetCacheForTesting: resetCache } = await import("../server/cache.js"));
    ({ createMockApp, createMockReq, createMockRes, findRoute } = await import("./testHelpers.js"));
  });

  afterEach(() => {
    mock.reset();
  });

  after(async () => {
    try { await closeRealtimeConnections(); } catch { }
    try { await resetCache(); } catch { }
    try { await closeConnection(); } catch { }
  });

  it("rejects custom address when required fields are missing", async () => {
    const { app, routes } = createMockApp();
    registerAuthRoutes(app as any);

    mock.method(db.primary, "select", () => createSelectChain([]));
    mock.method(storage, "getUser", async () => ({
      id: 11,
      role: "customer",
      addressStreet: "10 Market St",
      addressCity: "Chennai",
      addressState: "TN",
      addressPostalCode: "600001",
      addressLandmark: "Signal",
      latitude: "13.0827",
      longitude: "80.2707",
    }) as any);

    const handler = findRoute(routes, "post", "/api/auth/create-shop");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/auth/create-shop",
      user: { id: 11, role: "customer" },
      isAuthenticated: true,
      body: {
        shopName: "New Shop",
        useCustomerAddress: false,
        shopAddressStreet: "",
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.body, {
      message: "Custom shop address requires street, city, and pincode.",
    });
  });

  it("inherits customer address and coordinates when useCustomerAddress=true", async () => {
    const { app, routes } = createMockApp();
    registerAuthRoutes(app as any);

    const insertPayloads: any[] = [];

    mock.method(db.primary, "select", () => createSelectChain([]));
    mock.method(storage, "getUser", async () => ({
      id: 25,
      role: "customer",
      addressStreet: "88 River Road",
      addressCity: "Madurai",
      addressState: "TN",
      addressPostalCode: "625001",
      addressLandmark: "Temple",
      latitude: "9.9252",
      longitude: "78.1198",
    }) as any);
    mock.method(db.primary, "insert", () => ({
      values: (payload: unknown) => {
        insertPayloads.push(payload);
        return {
          returning: async () => [{ id: 901, ...(payload as Record<string, unknown>) }],
        };
      },
    }) as any);

    const handler = findRoute(routes, "post", "/api/auth/create-shop");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/auth/create-shop",
      user: { id: 25, role: "customer" },
      isAuthenticated: true,
      body: {
        shopName: "Aarthi Stores",
        description: "Groceries",
        businessType: "retail",
        useCustomerAddress: true,
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(insertPayloads.length, 1);
    assert.deepStrictEqual(insertPayloads[0], {
      ownerId: 25,
      shopName: "Aarthi Stores",
      description: "Groceries",
      businessType: "retail",
      shopAddressStreet: "88 River Road",
      shopAddressArea: "Temple",
      shopAddressCity: "Madurai",
      shopAddressState: "TN",
      shopAddressPincode: "625001",
      shopLocationLat: "9.9252",
      shopLocationLng: "78.1198",
    });
  });

  it("rejects unknown input keys via strict schema", async () => {
    const { app, routes } = createMockApp();
    registerAuthRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/auth/create-shop");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/auth/create-shop",
      user: { id: 41, role: "customer" },
      isAuthenticated: true,
      body: {
        shopName: "Strict Check",
        role: "admin",
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.message, "Invalid shop profile data");
  });
});
