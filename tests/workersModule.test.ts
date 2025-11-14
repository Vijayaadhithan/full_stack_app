import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { users, shopWorkers } from "@shared/schema";

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

  it("returns worker self profile data", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [
          {
            shopId: 5,
            responsibilities: ["orders:read"],
            active: true,
          },
        ],
      }),
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(routes, "get", "/api/worker/me");
    const req = {
      user: { id: 42, role: "worker" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.shopId, 5);
    assert.deepEqual(res.body.responsibilities, ["orders:read"]);
  });

  it("returns static worker responsibility presets", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);
    mock.method(db, "execute", async () => undefined);

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(
      routes,
      "get",
      "/api/shops/workers/responsibilities",
    );
    const req = {
      user: { id: 3, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.presets.cashier);
    assert.ok(res.body.all.length > 0);
  });

  it("fetches individual worker records for a shop", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    mock.method(db, "select", () => ({
      from: () => ({
        leftJoin: () => ({
          where: async () => [
            {
              id: 77,
              workerId: "worker77",
              name: "Worker",
              responsibilities: ["orders:read"],
              active: true,
            },
          ],
        }),
      }),
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(
      routes,
      "get",
      "/api/shops/workers/:workerUserId",
    );
    const req = {
      validatedParams: { workerUserId: 77 },
      user: { id: 5, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.workerId, "worker77");
  });

  it("lists workers for the authenticated shop", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    const executeCalls: unknown[] = [];
    mock.method(db, "execute", async (sqlStatement: unknown) => {
      executeCalls.push(sqlStatement);
    });

    const listedWorkers = [
      {
        id: 1,
        workerId: "cashier-one",
        name: "Cashier One",
        email: "cashier@example.com",
        phone: "123",
        responsibilities: ["orders:read"],
        active: true,
        createdAt: new Date(),
      },
    ];
    mock.method(db, "select", () => ({
      from: () => ({
        leftJoin: () => ({
          where: async () => listedWorkers,
        }),
      }),
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(routes, "get", "/api/shops/workers");
    const req = {
      user: { id: 9, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, listedWorkers);
    assert.equal(executeCalls.length, 1);
  });

  it("checks workerId availability with normalization", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    mock.method(db, "execute", async () => undefined);
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => [],
      }),
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(routes, "get", "/api/shops/workers/check-id");
    const req = {
      query: { workerId: "  Cashier.One  " },
      user: { id: 3, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.workerId, "cashier.one");
    assert.equal(res.body.available, true);
  });

  it("updates worker details, responsibilities, and credentials", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    mock.method(db, "execute", async () => undefined);
    const selectResponses = [[{ shopId: 9 }]];
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => selectResponses.shift() ?? [],
      }),
    }));

    const updates: Array<{ table: unknown; payload: Record<string, unknown> }> =
      [];
    mock.method(db, "update", (table: unknown) => ({
      set(payload: Record<string, unknown>) {
        updates.push({ table, payload });
        return {
          where: () => Promise.resolve(),
        };
      },
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(routes, "patch", "/api/shops/workers/:workerUserId");
    const req = {
      validatedParams: { workerUserId: 77 },
      body: {
        name: "Updated Worker",
        email: "updated@example.com",
        phone: "999",
        responsibilities: ["orders:update"],
        password: "fresh-password",
        active: false,
      },
      user: { id: 9, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.message, "Worker updated");
    const shopWorkerUpdate = updates.find((entry) => entry.table === shopWorkers);
    const userUpdate = updates.find((entry) => entry.table === users);
    assert.ok(shopWorkerUpdate);
    assert.deepEqual(shopWorkerUpdate?.payload.responsibilities, ["orders:update"]);
    assert.equal(shopWorkerUpdate?.payload.active, false);
    assert.equal(userUpdate?.payload.name, "Updated Worker");
    assert.equal(userUpdate?.payload.email, "updated@example.com");
    assert.equal(userUpdate?.payload.phone, "999");
    assert.equal(typeof userUpdate?.payload.password, "string");
    assert.notEqual(userUpdate?.payload.password, "fresh-password");
  });

  it("deletes worker accounts when removing links", async () => {
    const [{ db }, loggerModule] = await Promise.all([
      import("../server/db"),
      import("../server/logger"),
    ]);
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    mock.method(db, "execute", async () => undefined);
    const selectResponses = [
      [{ shopId: 9 }],
      [{ role: "worker" }],
    ];
    mock.method(db, "select", () => ({
      from: () => ({
        where: async () => selectResponses.shift() ?? [],
      }),
    }));

    const deleteTables: unknown[] = [];
    mock.method(db, "delete", (table: unknown) => ({
      where: async () => {
        deleteTables.push(table);
      },
    }));

    const { registerWorkerRoutes } = await import(
      `../server/routes/workers.ts?test=${Date.now()}`
    );
    const { app, routes } = createMockApp();
    registerWorkerRoutes(app as any);

    const handler = findRoute(routes, "delete", "/api/shops/workers/:workerUserId");
    const req = {
      validatedParams: { workerUserId: 77 },
      user: { id: 9, role: "shop" },
      isAuthenticated: () => true,
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Worker removed");
    assert.deepEqual(deleteTables, [shopWorkers, users]);
  });
});
