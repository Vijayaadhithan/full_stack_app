import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";

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
});
