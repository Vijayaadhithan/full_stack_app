import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

type Handler = (req: any, res: any, next?: () => unknown) => unknown | Promise<unknown>;

type Route = {
  method: string;
  path: string;
  handlers: Handler[];
};

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
  };
  return res;
}

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

describe("worker helpers", () => {
  it("returns linked shop id for worker users", async () => {
    const { db } = await import("../server/db");
    const selectResponses = [[{ shopId: 12 }]];
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => selectResponses.shift() ?? [],
      }),
    }));

    const { getWorkerShopId } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );

    const result = await getWorkerShopId(100);
    assert.equal(result, 12);
  });

  it("returns null when worker link is missing", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [],
      }),
    }));

    const { getWorkerShopId } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );

    const result = await getWorkerShopId(200);
    assert.equal(result, null);
  });

  it("verifies worker permissions against stored responsibilities", async () => {
    const { db } = await import("../server/db");
    const responses = [
      [{ responsibilities: ["orders:read", "products:read"] }],
      [{ responsibilities: ["orders:read"] }],
    ];
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => responses.shift() ?? [],
      }),
    }));

    const { workerHasPermission } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );

    const allowed = await workerHasPermission(5, "products:read");
    const denied = await workerHasPermission(5, "payments:refund");
    assert.equal(allowed, true);
    assert.equal(denied, false);
  });
});

describe("worker routes", () => {
  it("prevents creating workers with duplicate identifiers", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    mock.method(db, "execute", async () => undefined);
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [{ id: 1 }],
      }),
    }));
    mock.method(db, "insert", () => ({
      values: () => ({
        returning: async () => [],
      }),
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/shops/workers");
    const req = {
      body: {
        workerId: "DuplicateUser",
        name: "John Worker",
        password: "secretpw",
      },
      user: { id: 50, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body?.message ?? ""), /already exists/i);
  });

  it("creates workers and links them to the shop", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    mock.method(db, "execute", async () => undefined);

    const selectResponses = [[], [], []];
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => selectResponses.shift() ?? [],
      }),
    }));

    const insertCalls: any[] = [];
    mock.method(db, "insert", () => ({
      values: (values: any) => {
        insertCalls.push(values);
        return {
          returning: async () => (insertCalls.length === 1
            ? [
                {
                  id: 77,
                  username: values.username,
                  name: values.name,
                  email: values.email,
                  phone: values.phone,
                },
              ]
            : []),
        };
      },
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(routes, "post", "/api/shops/workers");
    const req = {
      body: {
        workerId: "CashierOne",
        name: "Cashier",
        email: "CASHIER@example.com",
        phone: "+1 (555) 123-4567",
        password: "supersecret",
        responsibilities: ["orders:read", "customers:message"],
      },
      user: { id: 9, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.id, 77);
    assert.equal(res.body.workerId, "cashierone");
    assert.equal(res.body.email, "cashier@example.com");
    assert.equal(res.body.phone, "15551234567");
    assert.deepEqual(res.body.responsibilities, [
      "orders:read",
      "customers:message",
    ]);

    const [userValues, linkValues] = insertCalls;
    assert.equal(userValues.username, "cashierone");
    assert.equal(typeof userValues.password, "string");
    assert.equal(linkValues.shopId, 9);
    assert.equal(linkValues.workerUserId, 77);
  });
});
