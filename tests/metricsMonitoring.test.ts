import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

beforeEach(() => {
  process.env.DATABASE_URL ||= "postgres://localhost/test";
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
});

describe("monitoring metrics", () => {
  it("tracks request stats, error rates, resource usage, and frontend metrics", async () => {
    const perfHooks = await import("node:perf_hooks");

    const perfValues = [50, 100, 200, 250, 300, 350, 500, 600];
    mock.method(perfHooks.performance, "now", () => {
      const next = perfValues.shift();
      return next ?? 600;
    });

    const cpuUsageValues = [
      { user: 1_000, system: 500 },
      { user: 3_000, system: 1_500 },
    ];
    let cpuCall = 0;
    mock.method(process, "cpuUsage", () => cpuUsageValues[cpuCall++] ?? cpuUsageValues.at(-1)!);
    mock.method(process, "memoryUsage", () => ({
      rss: 10_000,
      heapUsed: 5_000,
      heapTotal: 8_000,
      external: 1_000,
    }));
    mock.method(process, "uptime", () => 1234);

    const dateValues = [10_000, 10_500, 11_000, 11_500];
    mock.method(Date, "now", () => {
      const next = dateValues.shift();
      return next ?? 11_500;
    });

    const { trackRequestStart, recordFrontendMetric, getMonitoringSnapshot } =
      await import(`../server/monitoring/metrics.ts?test=${Date.now()}`);

    const completeFirst = trackRequestStart();
    const completeSecond = trackRequestStart();
    const completeInFlight = trackRequestStart();

    completeFirst({ method: "GET", path: "/api/orders", status: 200 });
    completeSecond({ method: "POST", path: "/api/orders", status: 500 });

    recordFrontendMetric(
      {
        name: "CLS",
        value: 0.25,
        rating: "needs-improvement",
        page: "/home",
        timestamp: 1_000,
        details: { navigation: "link" },
      },
      "customer",
    );
    recordFrontendMetric(
      {
        name: "LCP",
        value: 2.4,
        rating: "good",
        page: "/admin/dashboard",
        timestamp: 1_020,
        details: { segment: "admin" },
      },
      "admin",
    );

    const snapshot = getMonitoringSnapshot();

    assert.equal(snapshot.requests.total, 2);
    assert.equal(snapshot.requests.inFlight, 1);
    assert.equal(snapshot.requests.statusBuckets.success, 1);
    assert.equal(snapshot.requests.statusBuckets.serverError, 1);
    assert.equal(snapshot.errors.lastFiveMinutes, 1);
    assert.equal(snapshot.errors.recent[0].status, 500);

    const endpointKeys = snapshot.requests.topEndpoints.map(
      (entry) => `${entry.method} ${entry.path}`,
    );
    assert.ok(endpointKeys.includes("GET /api/orders"));
    assert.ok(endpointKeys.includes("POST /api/orders"));

    assert.equal(snapshot.frontend.metrics.length, 1);
    const frontendMetric = snapshot.frontend.metrics[0];
    assert.equal(frontendMetric.name, "CLS");
    assert.equal(frontendMetric.ratingCounts["needs-improvement"], 1);

    assert.ok(snapshot.resources.cpu);
    assert.ok(Number.isFinite(snapshot.resources.cpu?.percent ?? NaN));
    assert.equal(snapshot.resources.memory.heapUsedBytes, 5_000);
    assert.ok(Object.prototype.hasOwnProperty.call(snapshot.resources, "eventLoopDelayMs"));

    completeInFlight({ method: "GET", path: "/api/products", status: 204 });
  });
});
