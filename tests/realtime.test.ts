import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let importCounter = 0;

class MockResponse extends EventEmitter {
  headers: Record<string, string> = {};
  writes: string[] = [];
  statusCode = 200;

  constructor(private readonly shouldThrow = false) {
    super();
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  write(chunk: string) {
    if (this.shouldThrow) {
      throw new Error("write failed");
    }
    this.writes.push(chunk);
  }

  flushHeaders() {
    return;
  }
}

async function loadRealtime() {
  mock.restoreAll();
  const timers = require("node:timers");
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const originalTimersSetInterval = timers.setInterval;
  const originalTimersClearInterval = timers.clearInterval;

  const heartbeatCallbacks: Array<() => void> = [];
  const intervalHandle = { unref: mock.fn(() => undefined) };
  const setIntervalMock = mock.fn((fn: () => void) => {
    heartbeatCallbacks.push(fn);
    return intervalHandle as unknown as NodeJS.Timeout;
  });
  const clearIntervalMock = mock.fn(() => undefined);

  global.setInterval = setIntervalMock as typeof setInterval;
  global.clearInterval = clearIntervalMock as typeof clearInterval;
  timers.setInterval = setIntervalMock as any;
  timers.clearInterval = clearIntervalMock as any;

  const loggerModule = await import("../server/logger");
  const logger = loggerModule.default;
  mock.method(logger, "warn", () => undefined);

  const mod = await import(`../server/realtime?test=${++importCounter}`);

  return {
    ...mod,
    setIntervalMock,
    clearIntervalMock,
    heartbeatCallbacks,
    intervalHandle,
    logger,
    restore() {
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
      timers.setInterval = originalTimersSetInterval;
      timers.clearInterval = originalTimersClearInterval;
      mock.restoreAll();
    },
  };
}

afterEach(() => {
  mock.restoreAll();
});

describe("realtime SSE helpers", () => {
  it("registers clients and emits heartbeat events", async () => {
    const mod = await loadRealtime();
    try {
      const res = new MockResponse();

      mod.registerRealtimeClient(res as any, 42);
      assert.equal(res.headers["content-type"], "text/event-stream");
      assert.equal(res.headers["cache-control"], "no-cache");
      assert.equal(res.headers["connection"], "keep-alive");
      assert.equal(res.headers["x-accel-buffering"], "no");

      assert.equal(mod.setIntervalMock.mock.callCount(), 1);
      assert.equal(res.writes[0], "event: connected\n");
      assert.equal(res.writes[1], 'data: {"connected":true}\n\n');

      const heartbeat = mod.heartbeatCallbacks[0];
      heartbeat();
      assert.equal(res.writes.at(-2), "event: heartbeat\n");
      assert.equal(res.writes.at(-1), "data: {}\n\n");
    } finally {
      mod.restore();
    }
  });

  it("broadcasts invalidations to deduplicated recipients", async () => {
    const mod = await loadRealtime();
    try {
      const res = new MockResponse();

      mod.registerRealtimeClient(res as any, 7);
      mod.broadcastInvalidation([7, 7, null], ["", "/api/orders", "/api/orders"]);

      assert.equal(res.writes.at(-2), "event: invalidate\n");
      assert.equal(res.writes.at(-1), 'data: {"keys":["/api/orders"]}\n\n');

      mod.notifyBookingChange({ customerId: 7, providerId: 7 });
      assert.ok(
        res.writes.some((line) => line.includes("invalidate")),
        "should send invalidate events",
      );
    } finally {
      mod.restore();
    }
  });

  it("cleans up when writes fail", async () => {
    const mod = await loadRealtime();
    try {
      const res = new MockResponse(true);
      mod.registerRealtimeClient(res as any, 9);
      assert.equal(mod.logger.warn.mock.callCount(), 1);
    } finally {
      mod.restore();
    }
  });
});
