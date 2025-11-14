import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  adminUsers,
  adminRolePermissions,
  adminAuditLogs,
  adminRoles,
  users,
  orders,
  bookings,
  reviews,
} from "@shared/schema";

type Handler = (req: any, res: any, next?: () => unknown) => unknown | Promise<unknown>;

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

function findRouterHandler(router: any, method: string, routePath: string): Handler {
  for (const layer of router.stack ?? []) {
    if (!layer.route) continue;
    if (layer.route.path === routePath && layer.route.methods?.[method]) {
      return layer.route.stack.at(-1)!.handle;
    }
  }
  throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
}

function findRouteStack(router: any, method: string, routePath: string): Handler[] {
  for (const layer of router.stack ?? []) {
    if (!layer.route) continue;
    if (layer.route.path === routePath && layer.route.methods?.[method]) {
      return layer.route.stack.map((entry: { handle: Handler }) => entry.handle);
    }
  }
  throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
}

function createPagingBuilder<T>(result: T[]) {
  const builder: any = {
    where: () => builder,
    limit: () => builder,
    offset: async () => result,
  };
  return builder;
}

beforeEach(() => {
  process.env.DATABASE_URL ||= "postgres://localhost/test";
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
});

describe("admin routes", () => {
  it("reads recent logs while applying level and category filters", async () => {
    const loggerModule = await import("../server/logger");
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "warn", () => undefined);
    mock.method(logger, "error", () => undefined);

    const logPath = loggerModule.LOG_FILE_PATH;
    const originalContent = await fs.readFile(logPath, "utf8").catch(() => null);

    const logLines = [
      JSON.stringify({
        level: 30,
        time: 1_710_000_000_000,
        msg: "customer info",
        category: "customer",
        requestId: "req-1",
      }),
      JSON.stringify({
        level: 50,
        time: 1_710_000_010_000,
        msg: "shop error",
        category: "shop",
        userId: 42,
      }),
      JSON.stringify({
        level: 30,
        time: "1710000015000",
        msg: "provider notice",
        category: "service-provider",
      }),
      JSON.stringify({
        level: 30,
        time: 1_710_000_020_000,
        msg: "admin event",
        category: "admin",
      }),
      "{ invalid json",
    ].join("\n");

    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, `${logLines}\n`, "utf8");

    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));

    try {
      const { default: adminRouter } = await import(
        `../server/routes/admin.ts?test=${Date.now()}`
      );
      const handler = findRouterHandler(adminRouter, "get", "/logs");

      const req = {
        query: {},
        session: { adminId: "admin-1" },
      };
      const res = createMockRes();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      const categories = res.body.logs.map((log: any) => log.category);
      assert.ok(categories.every((category: string) => category !== "admin"));
      assert.ok(categories.includes("customer"));
      assert.ok(categories.includes("shop_owner"));
      assert.ok(categories.includes("service_provider"));
      assert.deepEqual(res.body.availableCategories, [
        "service_provider",
        "customer",
        "shop_owner",
        "other",
      ]);

      const filteredRes = createMockRes();
      await handler(
        {
          ...req,
          query: { category: "shop" },
        },
        filteredRes,
      );
      assert.equal(filteredRes.body.logs.length, 1);
      assert.equal(filteredRes.body.logs[0].category, "shop_owner");
    } finally {
      if (originalContent === null) {
        await fs.unlink(logPath).catch(() => undefined);
      } else {
        await fs.writeFile(logPath, originalContent, "utf8");
      }
    }
  });

  it("accepts performance metrics payloads and enforces submission limits", async () => {
    const loggerModule = await import("../server/logger");
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "warn", () => undefined);
    mock.method(logger, "error", () => undefined);

    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "post",
      "/performance-metrics",
    );

    const tooManyMetrics = Array.from({ length: 21 }, (_, index) => ({
      name: "FCP" as const,
      value: index,
      rating: "good" as const,
      page: `/page-${index}`,
      timestamp: index,
    }));

    const resExcess = createMockRes();
    await handler(
      {
        body: tooManyMetrics,
        session: { adminId: "admin-42" },
      },
      resExcess,
    );
    assert.equal(resExcess.statusCode, 400);
    assert.match(String(resExcess.body?.message ?? ""), /too many/i);
    assert.equal(logger.info.mock.callCount(), 0);

    const validMetrics = [
      {
        name: "TTFB" as const,
        value: 120,
        rating: "good" as const,
        page: "/dashboard",
        timestamp: 100,
      },
      {
        name: "LCP" as const,
        value: 2.8,
        rating: "poor" as const,
        page: "/dashboard",
        timestamp: 120,
      },
    ];

    const resValid = createMockRes();
    await handler(
      {
        body: validMetrics,
        session: { adminId: "admin-42" },
      },
      resValid,
    );
    assert.equal(resValid.statusCode, 204);
    assert.equal(logger.info.mock.callCount(), 1);
  });

  it("records single performance metrics payloads", async () => {
    const loggerModule = await import("../server/logger");
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "warn", () => undefined);
    mock.method(logger, "error", () => undefined);

    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "post",
      "/performance-metrics",
    );
    const res = createMockRes();
    await handler(
      {
        body: {
          name: "CLS",
          value: 0.12,
          rating: "good",
          page: "/",
          timestamp: 10,
        },
        session: { adminId: "admin-1" },
      },
      res,
    );
    assert.equal(res.statusCode, 204);
  });

  it("logs in admins, derives permissions, and flags bootstrap credentials", async () => {
    const [{ db }, { hashPasswordInternal }] = await Promise.all([
      import("../server/db"),
      import("../server/auth"),
    ]);

    const originalEmail = process.env.ADMIN_EMAIL;
    const originalPassword = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = "bootstrap@example.com";
    process.env.ADMIN_PASSWORD = "bootstrap-secret";

    const hashedPassword = await hashPasswordInternal("bootstrap-secret");
    mock.method(db, "select", () => ({
      from: (table: unknown) => {
        if (table === adminUsers) {
          return {
            where: () => ({
              limit: async () => [
                {
                  id: "admin-123",
                  email: process.env.ADMIN_EMAIL,
                  hashedPassword,
                  roleId: "role-1",
                },
              ],
            }),
          };
        }
        if (table === adminRolePermissions) {
          return {
            innerJoin: () => ({
              where: async () => [{ action: "manage_users" }],
            }),
          };
        }
        return {
          where: () => ({
            limit: async () => [],
          }),
        };
      },
    }));

    try {
      const { default: adminRouter } = await import(
        `../server/routes/admin.ts?test=${Date.now()}`
      );
      const handler = findRouterHandler(adminRouter, "post", "/login");
      const req = {
        body: {
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        },
        session: {},
      };
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(req.session.adminId, "admin-123");
      assert.equal(req.session.adminMustChangePassword, true);
      assert.equal(res.body.mustChangePassword, true);
      assert.deepEqual(res.body.permissions, ["manage_users"]);
    } finally {
      process.env.ADMIN_EMAIL = originalEmail;
      process.env.ADMIN_PASSWORD = originalPassword;
    }
  });

  it("allows admins to change passwords and clears forced-change flags", async () => {
    const [{ db }, { hashPasswordInternal }] = await Promise.all([
      import("../server/db"),
      import("../server/auth"),
    ]);
    const currentHash = await hashPasswordInternal("old-password");
    let updatedPayload: Record<string, unknown> | undefined;

    mock.method(db, "select", () => ({
      from: (table: unknown) => {
        if (table === adminUsers) {
          return {
            where: () => ({
              limit: async () => [
                { id: "admin-55", hashedPassword: currentHash },
              ],
            }),
          };
        }
        return {
          where: () => ({
            limit: async () => [],
          }),
        };
      },
    }));

    mock.method(db, "update", () => ({
      set(payload: Record<string, unknown>) {
        updatedPayload = payload;
        return {
          where: () => Promise.resolve(),
        };
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "post",
      "/change-password",
    );
    const req = {
      session: { adminId: "admin-55", adminMustChangePassword: true },
      body: {
        currentPassword: "old-password",
        newPassword: "SuperStrong123!",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(req.session.adminMustChangePassword, false);
    assert.equal(typeof updatedPayload?.hashedPassword, "string");
    assert.notEqual(updatedPayload?.hashedPassword, currentHash);
  });

  it("reports platform health and enforces permissions", async () => {
    const dbModule = await import("../server/db");
    const { db } = dbModule;
    mock.method(db, "select", () => ({
      from: (table: unknown) => {
        if (table === adminUsers) {
          return {
            where: () => ({
              limit: async () => [{ roleId: "role-health" }],
            }),
          };
        }
        if (table === adminRolePermissions) {
          return {
            innerJoin: () => ({
              where: async () => [{ action: "view_health" }],
            }),
          };
        }
        return {
          where: () => ({
            limit: async () => [],
          }),
        };
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const stack = findRouteStack(adminRouter, "get", "/health-status");
    const [authMiddleware, permissionsMiddleware, handler] = stack;
    const req = { session: { adminId: "admin-health" } };
    const res = createMockRes();

    await new Promise<void>((resolve) => authMiddleware(req, res, resolve));
    await permissionsMiddleware(req, res, () => undefined);
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(["ok", "error"].includes(res.body.database));
    assert.equal(res.body.api, "ok");
    assert.ok(res.body.jobs);
  });

  it("suspends platform users and ignores audit log failures", async () => {
    const { db } = await import("../server/db");
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

    mock.method(db, "insert", (table: unknown) => ({
      values: async () => {
        if (table === adminAuditLogs) {
          throw new Error("audit log write failed");
        }
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "patch",
      "/platform-users/:userId/suspend",
    );
    const req = {
      session: { adminId: "admin-10" },
      validatedParams: { userId: 44 },
      body: { isSuspended: true },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].table, users);
    assert.equal(updates[0].payload.isSuspended, true);
  });

  it("updates role permissions and records audit logs", async () => {
    const { db } = await import("../server/db");
    const deletedTables: unknown[] = [];
    const insertedPermissions: Array<{ roleId: string; permissionId: string }> =
      [];
    const auditLogEntries: Array<Record<string, unknown>> = [];

    mock.method(db, "delete", (table: unknown) => ({
      where: async () => {
        deletedTables.push(table);
      },
    }));

    mock.method(db, "insert", (table: unknown) => ({
      values: async (payload: unknown) => {
        if (table === adminRolePermissions) {
          insertedPermissions.push(...(payload as Array<{ roleId: string; permissionId: string }>));
        } else if (table === adminAuditLogs) {
          auditLogEntries.push(payload as Record<string, unknown>);
        }
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "put",
      "/roles/:roleId/permissions",
    );
    const roleId = "123e4567-e89b-12d3-a456-426614174000";
    const req = {
      session: { adminId: "admin-77" },
      params: { roleId },
      body: {
        permissionIds: [
          "11111111-1111-1111-1111-111111111111",
          "22222222-2222-2222-2222-222222222222",
        ],
      },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(deletedTables, [adminRolePermissions]);
    assert.deepEqual(insertedPermissions, [
      { roleId, permissionId: "11111111-1111-1111-1111-111111111111" },
      { roleId, permissionId: "22222222-2222-2222-2222-222222222222" },
    ]);
    assert.equal(auditLogEntries.length, 1);
    assert.equal(auditLogEntries[0].action, "update_role_permissions");
  });

  it("returns the authenticated admin profile with permissions", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: (table: unknown) => {
        if (table === adminUsers) {
          return {
            where: () => ({
              limit: async () => [
                { id: "admin-1", email: "root@example.com", roleId: "role-9" },
              ],
            }),
          };
        }
        if (table === adminRolePermissions) {
          return {
            innerJoin: () => ({
              where: async () => [
                { action: "view_health" },
                { action: "manage_users" },
              ],
            }),
          };
        }
        return {
          where: () => ({
            limit: async () => [],
          }),
        };
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(adminRouter, "get", "/me");
    const req = { session: { adminId: "admin-1", adminMustChangePassword: false } };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.email, "root@example.com");
    assert.deepEqual(res.body.permissions, ["view_health", "manage_users"]);
    assert.equal(res.body.mustChangePassword, false);
  });

  it("lists platform users with pagination and search", async () => {
    const { db } = await import("../server/db");
    const pagedResult = [
      { id: 1, username: "alpha", email: "a@example.com" },
      { id: 2, username: "beta", email: "b@example.com" },
    ];
    mock.method(db, "select", () => ({
      from: () => createPagingBuilder(pagedResult),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "get",
      "/platform-users",
    );
    const req = {
      session: { adminId: "admin-1" },
      query: { search: "alpha", page: "2", limit: "1" },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, pagedResult);
  });

  it("uses default pagination when listing platform users without search", async () => {
    const { db } = await import("../server/db");
    const pagedResult = [{ id: 3, username: "gamma" }];
    mock.method(db, "select", () => ({
      from: () => createPagingBuilder(pagedResult),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "get",
      "/platform-users",
    );
    const req = { session: { adminId: "admin-1" }, query: {} };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, pagedResult);
  });

  it("aggregates shop transactions into formatted response", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: async () => [
                { shopId: 8, shopName: "Outlet 8", transactionCount: 3 },
                { shopId: 9, shopName: "Outlet 9", transactionCount: null },
              ],
            }),
          }),
        }),
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "get",
      "/shops/transactions",
    );
    const req = { session: { adminId: "admin-1" } };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [
      { shopId: 8, shopName: "Outlet 8", transactionCount: 3 },
      { shopId: 9, shopName: "Outlet 9", transactionCount: 0 },
    ]);
  });
  it("lists admin accounts", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: async () => [
        { id: "admin-1", email: "root@example.com", roleId: "role-a" },
      ],
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(adminRouter, "get", "/accounts");
    const req = { session: { adminId: "admin-1" } };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body[0].email, "root@example.com");
  });

  it("creates admin accounts and writes audit logs", async () => {
    const { db } = await import("../server/db");
    const inserts: Array<{ table: unknown; payload: Record<string, unknown> }> =
      [];
    mock.method(db, "insert", (table: unknown) => ({
      values(payload: Record<string, unknown>) {
        inserts.push({ table, payload });
        if (table === adminUsers) {
          return {
            returning: async () => [
              {
                id: "admin-2",
                email: payload.email,
                roleId: payload.roleId,
              },
            ],
          };
        }
        return Promise.resolve();
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(adminRouter, "post", "/accounts");
    const req = {
      session: { adminId: "admin-1" },
      body: {
        email: "new@example.com",
        password: "StrongPass123!",
        roleId: "33333333-3333-3333-3333-333333333333",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.email, "new@example.com");
    const [firstInsert, auditInsert] = inserts;
    assert.equal(firstInsert.table, adminUsers);
    assert.equal(typeof firstInsert.payload.hashedPassword, "string");
    assert.equal(auditInsert.table, adminAuditLogs);
    assert.equal(auditInsert.payload.action, "create_admin");
  });

  it("lists and creates admin roles", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: async () => [
        { id: "role-1", name: "Root", description: "all access" },
      ],
    }));

    mock.method(db, "insert", (table: unknown) => ({
      values(payload: Record<string, unknown>) {
        if (table === adminRoles) {
          return {
            returning: async () => [{ ...payload, id: "role-2" }],
          };
        }
        return Promise.resolve();
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const listHandler = findRouterHandler(adminRouter, "get", "/roles");
    const createHandler = findRouterHandler(adminRouter, "post", "/roles");

    const listRes = createMockRes();
    await listHandler({ session: { adminId: "admin-1" } }, listRes);
    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.body[0].name, "Root");

    const createReq = {
      session: { adminId: "admin-1" },
      body: { name: "Support", description: "support team" },
    };
    const createRes = createMockRes();
    await createHandler(createReq, createRes);
    assert.equal(createRes.statusCode, 200);
    assert.equal(createRes.body.name, "Support");
  });

  it("returns recent audit logs", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: () => ({
        orderBy: async () => [
          { action: "suspend_user", resource: "user:1" },
          { action: "delete_review", resource: "review:2" },
        ],
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(adminRouter, "get", "/audit-logs");
    const res = createMockRes();

    await handler({ session: { adminId: "admin-1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 2);
  });

  it("denies access when admin lacks required permissions", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: (table: unknown) => {
        if (table === adminUsers) {
          return {
            where: () => ({
              limit: async () => [{ roleId: "role-x" }],
            }),
          };
        }
        if (table === adminRolePermissions) {
          return {
            innerJoin: () => ({
              where: async () => [],
            }),
          };
        }
        return {
          where: () => ({
            limit: async () => [],
          }),
        };
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const stack = findRouteStack(adminRouter, "get", "/accounts");
    const [authMiddleware, permissionsMiddleware] = stack;
    const req = { session: { adminId: "admin-1" } };
    const res = createMockRes();

    await new Promise<void>((resolve) => authMiddleware(req, res, resolve));
    await permissionsMiddleware(req, res, () => undefined);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.message, "Forbidden");
  });

  it("logs out admins by clearing the session", async () => {
    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(adminRouter, "post", "/logout");
    const req = { session: { adminId: "admin-9" } };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(req.session.adminId, undefined);
  });

  it("lists all orders and bookings", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "select", () => ({
      from: (table: unknown) => {
        if (table === orders) {
          return Promise.resolve([{ id: 1 }, { id: 2 }]);
        }
        if (table === bookings) {
          return Promise.resolve([{ id: 3 }]);
        }
        return Promise.resolve([]);
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const ordersHandler = findRouterHandler(adminRouter, "get", "/all-orders");
    const bookingsHandler = findRouterHandler(
      adminRouter,
      "get",
      "/all-bookings",
    );

    const ordersRes = createMockRes();
    await ordersHandler({ session: { adminId: "admin-1" } }, ordersRes);
    assert.equal(ordersRes.statusCode, 200);
    assert.equal(ordersRes.body.length, 2);

    const bookingsRes = createMockRes();
    await bookingsHandler({ session: { adminId: "admin-1" } }, bookingsRes);
    assert.equal(bookingsRes.statusCode, 200);
    assert.equal(bookingsRes.body.length, 1);
  });

  it("deletes reviews and writes audit logs", async () => {
    const { db } = await import("../server/db");
    mock.method(db, "delete", (table: unknown) => ({
      where: () => ({
        returning: async () => (table === reviews ? [{ id: 90 }] : []),
      }),
    }));
    const auditInserts: Array<Record<string, unknown>> = [];
    mock.method(db, "insert", (table: unknown) => ({
      values: async (payload: Record<string, unknown>) => {
        if (table === adminAuditLogs) {
          auditInserts.push(payload);
        }
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=${Date.now()}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "delete",
      "/reviews/:reviewId",
    );
    const req = {
      session: { adminId: "admin-1" },
      validatedParams: { reviewId: 90 },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(auditInserts.length, 1);
    assert.equal(auditInserts[0].action, "delete_review");
  });
});
