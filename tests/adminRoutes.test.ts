import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
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

let testCounter = 0;

beforeEach(() => {
  process.env.DATABASE_URL ||= "postgres://localhost/test";
  mock.restoreAll();
  testCounter++;
});

afterEach(() => {
  mock.restoreAll();
});

describe("admin routes", () => {
  it("logs out admins by clearing the session", async () => {
    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=logout-${testCounter}`
    );
    const handler = findRouterHandler(adminRouter, "post", "/logout");
    const req = { session: { adminId: "admin-9" } };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(req.session.adminId, undefined);
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

    // Mock db.primary for the routes
    mock.method(db.primary, "select", () => ({
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
        `../server/routes/admin.ts?test=login-${testCounter}`
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

    mock.method(db.primary, "select", () => ({
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

    mock.method(db.primary, "update", () => ({
      set(payload: Record<string, unknown>) {
        updatedPayload = payload;
        return {
          where: () => Promise.resolve(),
        };
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=change-password-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
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
      `../server/routes/admin.ts?test=health-${testCounter}`
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
    mock.method(db.primary, "update", (table: unknown) => ({
      set(payload: Record<string, unknown>) {
        updates.push({ table, payload });
        return {
          where: () => Promise.resolve(),
        };
      },
    }));

    mock.method(db.primary, "insert", (table: unknown) => ({
      values: async () => {
        if (table === adminAuditLogs) {
          throw new Error("audit log write failed");
        }
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=suspend-${testCounter}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "patch",
      "/platform-users/:userId/suspend",
    );
    const req = {
      session: { adminId: "admin-10" },
      params: { userId: "44" },
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

  it("removes platform users and records audit logs", async () => {
    const { db } = await import("../server/db");
    const { storage } = await import("../server/storage");
    const selectCalls: Array<{ table: unknown }> = [];
    mock.method(db.primary, "select", () => ({
      from(table: unknown) {
        selectCalls.push({ table });
        return {
          where: () => ({
            limit: async () => [{ id: 55 }],
          }),
        };
      },
    }));

    const deletedUsers: number[] = [];
    mock.method(storage, "deleteUserAndData", async (userId: number) => {
      deletedUsers.push(userId);
    });

    const auditLogs: Array<Record<string, unknown>> = [];
    mock.method(db.primary, "insert", (table: unknown) => ({
      values: async (payload: Record<string, unknown>) => {
        if (table === adminAuditLogs) {
          auditLogs.push(payload);
        }
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=remove-user-${testCounter}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "delete",
      "/platform-users/:userId",
    );
    const req = {
      session: { adminId: "admin-99" },
      params: { userId: "55" },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
    assert.deepEqual(deletedUsers, [55]);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.resource, "user:55");
    assert.equal(selectCalls.length, 1);
  });

  it("updates role permissions and records audit logs", async () => {
    const { db } = await import("../server/db");
    const deletedTables: unknown[] = [];
    const insertedPermissions: Array<{ roleId: string; permissionId: string }> =
      [];
    const auditLogEntries: Array<Record<string, unknown>> = [];

    mock.method(db.primary, "delete", (table: unknown) => ({
      where: async () => {
        deletedTables.push(table);
      },
    }));

    mock.method(db.primary, "insert", (table: unknown) => ({
      values: async (payload: unknown) => {
        if (table === adminRolePermissions) {
          insertedPermissions.push(...(payload as Array<{ roleId: string; permissionId: string }>));
        } else if (table === adminAuditLogs) {
          auditLogEntries.push(payload as Record<string, unknown>);
        }
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=role-permissions-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
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
      `../server/routes/admin.ts?test=me-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
      from: () => createPagingBuilder(pagedResult),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=platform-users-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
      from: () => createPagingBuilder(pagedResult),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=platform-users-default-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
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
      `../server/routes/admin.ts?test=shop-transactions-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
      from: async () => [
        { id: "admin-1", email: "root@example.com", roleId: "role-a" },
      ],
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=accounts-${testCounter}`
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
    mock.method(db.primary, "insert", (table: unknown) => ({
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
      `../server/routes/admin.ts?test=create-account-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
      from: async () => [
        { id: "role-1", name: "Root", description: "all access" },
      ],
    }));

    mock.method(db.primary, "insert", (table: unknown) => ({
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
      `../server/routes/admin.ts?test=roles-${testCounter}`
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
    mock.method(db.primary, "select", () => ({
      from: () => ({
        orderBy: async () => [
          { action: "suspend_user", resource: "user:1" },
          { action: "delete_review", resource: "review:2" },
        ],
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=audit-logs-${testCounter}`
    );
    const handler = findRouterHandler(adminRouter, "get", "/audit-logs");
    const res = createMockRes();

    await handler({ session: { adminId: "admin-1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 2);
  });

  it("denies access when admin lacks required permissions", async () => {
    const { db } = await import("../server/db");
    mock.method(db.primary, "select", () => ({
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
      `../server/routes/admin.ts?test=deny-permission-${testCounter}`
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

  it("lists all orders and bookings", async () => {
    const { db } = await import("../server/db");
    mock.method(db.primary, "select", () => ({
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
      `../server/routes/admin.ts?test=all-orders-${testCounter}`
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
    mock.method(db.primary, "delete", (table: unknown) => ({
      where: () => ({
        returning: async () => (table === reviews ? [{ id: 90 }] : []),
      }),
    }));
    const auditInserts: Array<Record<string, unknown>> = [];
    mock.method(db.primary, "insert", (table: unknown) => ({
      values: async (payload: Record<string, unknown>) => {
        if (table === adminAuditLogs) {
          auditInserts.push(payload);
        }
      },
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=delete-review-${testCounter}`
    );
    const handler = findRouterHandler(
      adminRouter,
      "delete",
      "/reviews/:reviewId",
    );
    const req = {
      session: { adminId: "admin-1" },
      params: { reviewId: "90" },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(auditInserts.length, 1);
    assert.equal(auditInserts[0].action, "delete_review");
  });

  it("accepts performance metrics payloads and enforces submission limits", async () => {
    const loggerModule = await import("../server/logger");
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "warn", () => undefined);
    mock.method(logger, "error", () => undefined);

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=performance-metrics-${testCounter}`
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
  });

  it("records single performance metrics payloads", async () => {
    const loggerModule = await import("../server/logger");
    const logger = loggerModule.default;
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "warn", () => undefined);
    mock.method(logger, "error", () => undefined);

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=single-metric-${testCounter}`
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

  // Negative test cases
  it("rejects login with invalid credentials", async () => {
    const [{ db }, { hashPasswordInternal }] = await Promise.all([
      import("../server/db"),
      import("../server/auth"),
    ]);

    const hashedPassword = await hashPasswordInternal("correct-password");

    mock.method(db.primary, "select", () => ({
      from: (table: unknown) => {
        if (table === adminUsers) {
          return {
            where: () => ({
              limit: async () => [
                {
                  id: "admin-123",
                  email: "admin@example.com",
                  hashedPassword,
                  roleId: "role-1",
                },
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
      `../server/routes/admin.ts?test=invalid-login-${testCounter}`
    );
    const handler = findRouterHandler(adminRouter, "post", "/login");
    const req = {
      body: {
        email: "admin@example.com",
        password: "wrong-password",
      },
      session: {},
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, "Invalid credentials");
  });

  it("rejects login with invalid email format", async () => {
    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=invalid-email-${testCounter}`
    );
    const handler = findRouterHandler(adminRouter, "post", "/login");
    const req = {
      body: {
        email: "not-an-email",
        password: "password123",
      },
      session: {},
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=unauth-${testCounter}`
    );
    const stack = findRouteStack(adminRouter, "get", "/me");
    const [authMiddleware] = stack;
    const req = { session: {} };
    const res = createMockRes();

    await authMiddleware(req, res, () => undefined);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, "Unauthorized");
  });

  it("rejects password change with wrong current password", async () => {
    const [{ db }, { hashPasswordInternal }] = await Promise.all([
      import("../server/db"),
      import("../server/auth"),
    ]);
    const currentHash = await hashPasswordInternal("actual-password");

    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: "admin-55", hashedPassword: currentHash }],
        }),
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=wrong-current-password-${testCounter}`
    );
    const handler = findRouterHandler(adminRouter, "post", "/change-password");
    const req = {
      session: { adminId: "admin-55" },
      body: {
        currentPassword: "wrong-password",
        newPassword: "NewStrong123!",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, "Current password is incorrect");
  });

  it("returns 404 when admin profile not found", async () => {
    const { db } = await import("../server/db");
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=admin-not-found-${testCounter}`
    );
    const handler = findRouterHandler(adminRouter, "get", "/me");
    const req = { session: { adminId: "non-existent-admin" } };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Admin not found");
  });

  it("returns 404 when deleting non-existent user", async () => {
    const { db } = await import("../server/db");
    mock.method(db.primary, "select", () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }));

    const { default: adminRouter } = await import(
      `../server/routes/admin.ts?test=delete-nonexistent-${testCounter}`
    );
    const handler = findRouterHandler(adminRouter, "delete", "/platform-users/:userId");
    const req = {
      session: { adminId: "admin-1" },
      params: { userId: "999" },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "User not found");
  });
});
