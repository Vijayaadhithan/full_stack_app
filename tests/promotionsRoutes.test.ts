import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { promotions } from "@shared/schema";

type Handler = (req: any, res: any, next?: () => unknown) => unknown | Promise<unknown>;

type Route = {
  method: string;
  path: string;
  handlers: Handler[];
};

function createMockApp() {
  const routes: Route[] = [];
  const app = {
    post(path: string, ...handlers: Handler[]) {
      routes.push({ method: "post", path, handlers });
      return app;
    },
    get(path: string, ...handlers: Handler[]) {
      routes.push({ method: "get", path, handlers });
      return app;
    },
    patch(path: string, ...handlers: Handler[]) {
      routes.push({ method: "patch", path, handlers });
      return app;
    },
    delete(path: string, ...handlers: Handler[]) {
      routes.push({ method: "delete", path, handlers });
      return app;
    },
  };
  return { app, routes };
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    send(payload?: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function findRoute(routes: Route[], method: string, path: string): Handler {
  const route = routes.find(
    (entry) => entry.method === method && entry.path === path,
  );
  if (!route) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not registered`);
  }
  return route.handlers.at(-1)!;
}

beforeEach(() => {
  process.env.DATABASE_URL ||= "postgres://localhost/test";
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
});

describe("promotion routes", () => {
  it("rejects invalid promotion creation payloads", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    const insertSpy = mock.method(db, "insert", () => ({
      values: () => ({
        returning: async () => [],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );

    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/promotions");
    const req = {
      body: { shopId: 1 },
      isAuthenticated: () => true,
      shopContextId: 1,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.message, "Invalid input");
    assert.ok(res.body?.errors?.name);
    assert.equal(insertSpy.mock.callCount(), 0);
  });

  it("creates promotions with computed dates and numeric coercion", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    const insertedValues: any[] = [];
    const createdPromotion = { id: 42, name: "Summer Sale" };

    mock.method(db, "insert", () => ({
      values: (values: unknown) => {
        insertedValues.push(values);
        return {
          returning: async () => [createdPromotion],
        };
      },
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );

    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/promotions");
    const req = {
      body: {
        name: "Summer Sale",
        type: "percentage",
        value: 15,
        code: "SUMMER15",
        shopId: 8,
        expiryDays: 5,
        minPurchase: 100,
        maxDiscount: 50,
      },
      isAuthenticated: () => true,
      shopContextId: 8,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, createdPromotion);

    const submitted = insertedValues[0] as Record<string, unknown>;
    assert.equal(submitted.value, "15");
    assert.equal(submitted.minPurchase, "100");
    assert.equal(submitted.maxDiscount, "50");
    assert.equal(submitted.shopId, 8);
    assert.ok(submitted.startDate instanceof Date);
    assert.ok(
      submitted.endDate === null || submitted.endDate instanceof Date,
    );
  });

  it("lists active promotions excluding exhausted usage limits", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    const now = Date.now();
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [
          {
            id: 1,
            usageLimit: 2,
            usedCount: 2,
            isActive: true,
            startDate: new Date(now - 1_000),
            endDate: new Date(now + 1_000),
          },
          {
            id: 2,
            usageLimit: 5,
            usedCount: 1,
            isActive: true,
            startDate: new Date(now - 1_000),
            endDate: new Date(now + 1_000),
          },
        ],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );

    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(
      routes,
      "get",
      "/api/promotions/active/:shopId",
    );

    const req = {
      params: { shopId: "8" },
      user: { role: "customer" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, 2);
  });

  it("updates promotions and recalculates derived values", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    const existingPromotion = {
      id: 15,
      shopId: 9,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
    };
    const appliedUpdates: Record<string, unknown>[] = [];

    mock.method(db, "select", () => ({
      from: (table: unknown) => ({
        where: async () => (table === promotions ? [existingPromotion] : []),
      }),
    }));

    mock.method(db, "update", (table: unknown) => ({
      set(payload: Record<string, unknown>) {
        appliedUpdates.push(payload);
        return {
          where: () => ({
            returning: async () => [
              { ...existingPromotion, ...(payload as Record<string, unknown>) },
            ],
          }),
        };
      },
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "patch", "/api/promotions/:id");
    const req = {
      params: { id: String(existingPromotion.id) },
      shopContextId: existingPromotion.shopId,
      body: {
        value: 30,
        minPurchase: 200,
        maxDiscount: 50,
        expiryDays: 2,
        description: "Updated promo",
      },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.value, "30");
    assert.equal(res.body.minPurchase, "200");
    assert.equal(res.body.maxDiscount, "50");
    assert.equal(res.body.description, "Updated promo");
    assert.ok(res.body.endDate instanceof Date);
    assert.ok(appliedUpdates[0].endDate instanceof Date);
  });

  it("rejects promotion updates without any fields", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [{ id: 18, shopId: 2, startDate: new Date() }],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "patch", "/api/promotions/:id");
    const req = {
      params: { id: "18" },
      shopContextId: 2,
      body: {},
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.message, "Invalid input");
  });

  it("clears promotion end date when expiryDays is zero", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [{ id: 19, shopId: 2, startDate: new Date() }],
      }),
    }));
    const updates: Record<string, unknown>[] = [];
    mock.method(db, "update", () => ({
      set(payload: Record<string, unknown>) {
        updates.push(payload);
        return {
          where: () => ({
            returning: async () => [{ ...payload, id: 19 }],
          }),
        };
      },
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "patch", "/api/promotions/:id");
    const req = {
      params: { id: "19" },
      shopContextId: 2,
      body: { expiryDays: 0, isActive: true },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(updates[0].endDate, null);
  });

  it("validates promotions and filters cart items", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    const promotionRecord = {
      code: "SAVE25",
      shopId: 5,
      isActive: true,
      startDate: new Date(Date.now() - 1_000),
      endDate: new Date(Date.now() + 86_400_000),
      usageLimit: 10,
      usedCount: 1,
      minPurchase: "250",
      applicableProducts: [1, 2],
      excludedProducts: [2],
      type: "percentage" as const,
      value: "25",
      maxDiscount: "40",
    };

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [promotionRecord],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/promotions/validate");
    const req = {
      body: {
        code: "SAVE25",
        shopId: 5,
        cartItems: [
          { productId: 1, quantity: 1, price: 500 },
          { productId: 2, quantity: 1, price: 200 },
          { productId: 4, quantity: 1, price: 50 },
        ],
        subtotal: 800,
      },
      user: { role: "customer" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.discountAmount, 40);
    assert.equal(res.body.finalTotal, 760);
    assert.equal(res.body.promotion.code, "SAVE25");
  });

  it("rejects promotion validation when no applicable items remain", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    const promotionRecord = {
      code: "ONLY-A",
      shopId: 5,
      isActive: true,
      startDate: new Date(Date.now() - 1_000),
      endDate: new Date(Date.now() + 86_400_000),
      applicableProducts: [1],
      excludedProducts: [1],
      usageLimit: null,
      usedCount: 0,
      type: "percentage" as const,
      value: "10",
    };

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [promotionRecord],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/promotions/validate");
    const req = {
      body: {
        code: "ONLY-A",
        shopId: 5,
        cartItems: [{ productId: 1, quantity: 1, price: 100 }],
        subtotal: 100,
      },
      user: { role: "customer" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body?.message ?? ""), /no applicable products/i);
  });

  it("applies promotions and increments usage counts", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    const promotionRecord = {
      id: 9,
      isActive: true,
      startDate: new Date(Date.now() - 10_000),
      endDate: new Date(Date.now() + 10_000),
      usageLimit: 5,
      usedCount: 2,
    };
    let updatedUsedCount = 0;

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [promotionRecord],
      }),
    }));
    mock.method(db, "update", () => ({
      set(payload: Record<string, unknown>) {
        updatedUsedCount = Number(payload.usedCount);
        return {
          where: () => Promise.resolve(),
        };
      },
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/promotions/:id/apply");
    const req = {
      params: { id: "9" },
      body: { orderId: 777 },
      user: { role: "customer" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Promotion applied successfully");
    assert.equal(updatedUsedCount, 3);
  });

  it("lists promotions for a shop when context matches", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [
          { id: 1, name: "Promo A" },
          { id: 2, name: "Promo B" },
        ],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "get", "/api/promotions/shop/:id");
    const req = {
      params: { id: "5" },
      shopContextId: 5,
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 2);
  });

  it("rejects shop promotion listing when context mismatches", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "get", "/api/promotions/shop/:id");
    const req = {
      params: { id: "9" },
      shopContextId: 5,
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(String(res.body?.message ?? ""), /invalid shop context/i);
  });

  it("updates promotion active status", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [{ id: 12, shopId: 7 }],
      }),
    }));
    mock.method(db, "update", () => ({
      set: () => ({
        where: () => ({
          returning: async () => [{ id: 12, isActive: false }],
        }),
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "patch", "/api/promotions/:id/status");
    const req = {
      params: { id: "12" },
      body: { isActive: false },
      shopContextId: 7,
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.isActive, false);
  });

  it("returns 404 when toggling status for unknown promotions", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "patch", "/api/promotions/:id/status");
    const req = {
      params: { id: "12" },
      body: { isActive: true },
      shopContextId: 7,
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 404);
  });

  it("deletes promotions scoped to the shop context", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "delete", () => ({
      where: () => ({
        returning: async () => [{ id: 22 }],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "delete", "/api/promotions/:id");
    const req = {
      params: { id: "22" },
      shopContextId: 9,
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Promotion deleted successfully");
  });

  it("enforces shop context when viewing active promotions", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "get", "/api/promotions/active/:shopId");
    const req = {
      params: { shopId: "9" },
      user: { role: "shop", id: 8 },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
  });

  it("prevents applying promotions that reached their usage limit", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [
          {
            id: 33,
            isActive: true,
            startDate: new Date(Date.now() - 1_000),
            endDate: new Date(Date.now() + 1_000),
            usageLimit: 5,
            usedCount: 5,
          },
        ],
      }),
    }));

    const { registerPromotionRoutes } = await import(
      `../server/routes/promotions.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerPromotionRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/promotions/:id/apply");
    const req = {
      params: { id: "33" },
      body: { orderId: 1 },
      user: { role: "customer" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body?.message ?? ""), /usage limit/i);
  });
});
