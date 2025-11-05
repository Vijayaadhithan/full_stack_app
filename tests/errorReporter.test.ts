import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

beforeEach(() => {
  process.env.DATABASE_URL ||= "postgres://localhost/test";
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
});

describe("error reporter", () => {
  it("serializes nested errors and forwards structured payloads to logger", async () => {
    const loggerModule = await import("../server/logger");
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    const { reportError } = await import(
      `../server/monitoring/errorReporter.ts?test=${Date.now()}`
    );

    const underlying = new Error("Database timeout");
    (underlying as any).code = "ETIMEDOUT";

    const error = new Error("Failed to save order", { cause: underlying });
    (error as any).orderId = 5001;

    await reportError(error, {
      errorId: "abc123",
      status: 500,
      tags: { service: "orders" },
      extras: { retry: true },
      request: {
        method: "POST",
        url: "/api/orders",
      },
    });

    assert.equal(logger.error.mock.callCount(), 1);
    const [payload, message] = logger.error.mock.calls[0].arguments;
    assert.equal(message, "Captured error for monitoring");
    assert.equal(payload.errorId, "abc123");
    assert.equal(payload.status, 500);
    assert.equal(payload.error.orderId, 5001);
    assert.equal(payload.error.cause.code, "ETIMEDOUT");
  });

  it("handles primitive error values gracefully", async () => {
    const loggerModule = await import("../server/logger");
    const logger = loggerModule.default;
    mock.method(logger, "error", () => undefined);

    const { reportError } = await import(
      `../server/monitoring/errorReporter.ts?test=${Date.now()}`
    );

    await reportError("timeout", {
      errorId: "primitive",
    });

    const [payload] = logger.error.mock.calls.at(-1)!.arguments;
    assert.deepEqual(payload.error, { message: "timeout" });
  });
});

