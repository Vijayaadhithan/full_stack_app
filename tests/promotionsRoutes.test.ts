import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

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
});
