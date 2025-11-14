import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import logger from "../server/logger";
import {
  adminPermissions,
  adminRoles,
  adminRolePermissions,
  adminUsers,
} from "@shared/schema";

type TableKey = "permissions" | "roles" | "rolePermissions" | "adminUsers";

const tableKeys: TableKey[] = [
  "permissions",
  "roles",
  "rolePermissions",
  "adminUsers",
];
const filteredQueues: Record<TableKey, any[][]> = {
  permissions: [],
  roles: [],
  rolePermissions: [],
  adminUsers: [],
};
const permissionsAllQueue: any[][] = [];
const insertLog: Record<TableKey, any[]> = {
  permissions: [],
  roles: [],
  rolePermissions: [],
  adminUsers: [],
};
const updateLog: Array<{ table: TableKey; values: any }> = [];

function resolveKey(table: unknown): TableKey {
  if (table === adminPermissions) return "permissions";
  if (table === adminRoles) return "roles";
  if (table === adminRolePermissions) return "rolePermissions";
  if (table === adminUsers) return "adminUsers";
  throw new Error("Unknown table");
}

function resetState() {
  for (const key of tableKeys) {
    filteredQueues[key] = [];
    insertLog[key] = [];
  }
  permissionsAllQueue.length = 0;
  updateLog.length = 0;
}

function handleInsert(key: TableKey, values: any) {
  if (key === "roles") {
    insertLog.roles.push(values);
    return {
      returning: async () => [{ id: 900 + insertLog.roles.length, ...values }],
    };
  }
  insertLog[key].push(values);
  return Promise.resolve([{ id: insertLog[key].length }]);
}
const fakeDb = {
  select: () => ({
    from(table: unknown) {
      const key = resolveKey(table);
      return {
        where() {
          return {
            limit: async () => filteredQueues[key].shift() ?? [],
          };
        },
        limit: async () => filteredQueues[key].shift() ?? [],
        then(onFulfilled: any, onRejected?: any) {
          if (key === "permissions") {
            return Promise.resolve(permissionsAllQueue.shift() ?? []).then(
              onFulfilled,
              onRejected,
            );
          }
          return Promise.resolve([]).then(onFulfilled, onRejected);
        },
      };
    },
  }),
  insert: (table: unknown) => ({
    values: (values: any) => handleInsert(resolveKey(table), values),
  }),
  update: (table: unknown) => ({
    set: (values: any) => ({
      where: async () => {
        updateLog.push({ table: resolveKey(table), values });
      },
    }),
  }),
};

const {
  ensureDefaultAdmin,
  __setBootstrapDepsForTesting,
} = await import("../server/bootstrap");
const realDbModule = await import("../server/db");
const realDb = realDbModule.db;
const realRunWithPrimaryReads = realDbModule.runWithPrimaryReads;

beforeEach(() => {
  mock.restoreAll();
  resetState();
  process.env.ADMIN_EMAIL = "";
  process.env.ADMIN_PASSWORD = "";
  __setBootstrapDepsForTesting({
    db: fakeDb as any,
    runWithPrimaryReads: async (cb: () => unknown) => cb(),
  });
});

afterEach(() => {
  __setBootstrapDepsForTesting({
    db: realDb,
    runWithPrimaryReads: realRunWithPrimaryReads,
  });
});

describe("ensureDefaultAdmin", () => {
  it("requires admin credentials in env", async () => {
    process.env.ADMIN_EMAIL = "";
    process.env.ADMIN_PASSWORD = "";
    const errorSpy = mock.method(logger, "error", () => undefined);
    await assert.rejects(ensureDefaultAdmin);
    assert.equal(errorSpy.mock.callCount(), 1);
  });

  it("creates missing admin and permission data", async () => {
    process.env.ADMIN_EMAIL = "owner@example.com";
    process.env.ADMIN_PASSWORD = "Str0ng!Password";
    filteredQueues.permissions = Array.from({ length: 7 }, () => []);
    filteredQueues.roles = [[]];
    filteredQueues.rolePermissions = Array.from({ length: 7 }, () => []);
    filteredQueues.adminUsers = [[]];
    permissionsAllQueue.push(
      Array.from({ length: 7 }, (_, idx) => ({ id: idx + 1 })),
    );

    const infoSpy = mock.method(logger, "info", () => undefined);

    await ensureDefaultAdmin();

    assert.equal(insertLog.permissions.length, 7);
    assert.equal(insertLog.roles.length, 1);
    assert.equal(insertLog.rolePermissions.length, 7);
    assert.equal(insertLog.adminUsers.length, 1);
    assert.equal(updateLog.length, 0);
    assert.ok(infoSpy.mock.callCount() >= 1);
  });

  it("updates existing admin with new secret", async () => {
    process.env.ADMIN_EMAIL = "owner@example.com";
    process.env.ADMIN_PASSWORD = "Str0ng!Password2";
    filteredQueues.permissions = Array.from({ length: 7 }, () => []);
    filteredQueues.roles = [[{ id: 50, name: "Super Admin" }]];
    filteredQueues.rolePermissions = Array.from({ length: 7 }, () => []);
    filteredQueues.adminUsers = [[{ id: 10, email: "owner@example.com" }]];
    permissionsAllQueue.push(
      Array.from({ length: 7 }, (_, idx) => ({ id: idx + 10 })),
    );

    const infoSpy = mock.method(logger, "info", () => undefined);

    await ensureDefaultAdmin();

    assert.equal(insertLog.adminUsers.length, 0);
    assert.equal(updateLog.length, 1);
    assert.equal(updateLog[0].table, "adminUsers");
    assert.ok(
      infoSpy.mock.calls.some((call) =>
        String(call.arguments[0]).includes("Admin bootstrap"),
      ),
    );
  });
});
