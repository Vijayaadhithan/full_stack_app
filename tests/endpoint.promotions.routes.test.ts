import { afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert";
import { db } from "../server/db.js";
import {
  createMockApp,
  createMockReq,
  createMockRes,
  findRoute,
} from "./testHelpers.js";

type PromotionRouteRegistrar = (app: any) => void;

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

function mockSelectQueue(queue: unknown[][]) {
  mock.method(db.primary, "select", () => createSelectChain(queue.shift() ?? []));
}

describe("endpoint: promotion routes", () => {
  let registerPromotionRoutes: PromotionRouteRegistrar;

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.USE_IN_MEMORY_DB = "true";
    process.env.DISABLE_REDIS = "true";
    const module = await import("../server/routes/promotions.js");
    registerPromotionRoutes = module.registerPromotionRoutes;
  });

  afterEach(() => {
    mock.reset();
  });

  it("rejects cart subtotal tampering on /api/promotions/validate", async () => {
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app);

    mockSelectQueue([
      [{ ownerId: 1 }],
      [{ id: 101, shopId: 1, price: "100" }],
    ]);

    const handler = findRoute(routes, "post", "/api/promotions/validate");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/promotions/validate",
      user: { id: 7, role: "customer" },
      isAuthenticated: true,
      body: {
        code: "SAVE10",
        shopId: 1,
        cartItems: [{ productId: 101, quantity: 2 }],
        subtotal: 50,
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(
      res.body?.message,
      "Cart subtotal mismatch. Please refresh your cart and retry.",
    );
    assert.strictEqual(res.body?.expectedSubtotal, 200);
  });

  it("calculates discount from canonical product prices and caps at subtotal", async () => {
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app);

    mockSelectQueue([
      [],
      [{ id: 201, shopId: 9, price: "100.00" }],
      [{
        id: 88,
        shopId: 9,
        name: "Big Flat Discount",
        description: null,
        type: "fixed_amount",
        value: "500.00",
        code: "FLAT500",
        startDate: new Date("2020-01-01"),
        endDate: null,
        minPurchase: null,
        maxDiscount: null,
        usageLimit: null,
        usedCount: 0,
        isActive: true,
        applicableProducts: null,
        excludedProducts: null,
      }],
    ]);

    const handler = findRoute(routes, "post", "/api/promotions/validate");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/promotions/validate",
      user: { id: 10, role: "customer" },
      isAuthenticated: true,
      body: {
        code: "flat500",
        shopId: 9,
        cartItems: [{ productId: 201, quantity: 1 }],
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.valid, true);
    assert.strictEqual(res.body?.subtotal, 100);
    assert.strictEqual(res.body?.discountAmount, 100);
    assert.strictEqual(res.body?.finalTotal, 0);
  });

  it("blocks apply when order does not belong to current customer", async () => {
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app);

    mockSelectQueue([
      [{
        id: 55,
        shopId: 5,
        isActive: true,
        startDate: new Date("2020-01-01"),
        endDate: null,
        usageLimit: null,
        usedCount: 0,
      }],
      [{ id: 500, customerId: 999, shopId: 5 }],
    ]);

    const handler = findRoute(routes, "post", "/api/promotions/:id/apply");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/promotions/55/apply",
      params: { id: "55" },
      user: { id: 321, role: "customer" },
      isAuthenticated: true,
      body: { orderId: 500 },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, { message: "Not authorized for this order" });
  });

  it("returns no-op success for apply when checkout already accounted promotion", async () => {
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app);

    mockSelectQueue([
      [{
        id: 56,
        shopId: 7,
        isActive: true,
        startDate: new Date("2020-01-01"),
        endDate: null,
        usageLimit: null,
        usedCount: 0,
      }],
      [{ id: 700, customerId: 14, shopId: 7 }],
    ]);

    const handler = findRoute(routes, "post", "/api/promotions/:id/apply");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/promotions/56/apply",
      params: { id: "56" },
      user: { id: 14, role: "customer" },
      isAuthenticated: true,
      body: { orderId: 700 },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, {
      message: "Promotion already accounted at checkout",
      applied: true,
    });
  });
});
