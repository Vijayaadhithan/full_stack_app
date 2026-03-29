import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getRedisUrl,
  isRedisConfigured,
  isRedisConnectionError,
  isRedisDisabled,
  redactRedisUrl,
} from "../server/redisConfig.js";

const originalEnv = {
  REDIS_URL: process.env.REDIS_URL,
  DISABLE_REDIS: process.env.DISABLE_REDIS,
};

function restoreRedisEnv() {
  if (originalEnv.REDIS_URL === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = originalEnv.REDIS_URL;
  }

  if (originalEnv.DISABLE_REDIS === undefined) {
    delete process.env.DISABLE_REDIS;
  } else {
    process.env.DISABLE_REDIS = originalEnv.DISABLE_REDIS;
  }
}

afterEach(() => {
  restoreRedisEnv();
});

describe("redisConfig", () => {
  it("treats Redis as configured only when enabled and REDIS_URL is present", () => {
    process.env.DISABLE_REDIS = "false";
    process.env.REDIS_URL = "redis://localhost:6379";

    assert.equal(isRedisDisabled(), false);
    assert.equal(getRedisUrl(), "redis://localhost:6379");
    assert.equal(isRedisConfigured(), true);
  });

  it("treats Redis as disabled when DISABLE_REDIS is truthy", () => {
    process.env.DISABLE_REDIS = "yes";
    process.env.REDIS_URL = "redis://localhost:6379";

    assert.equal(isRedisDisabled(), true);
    assert.equal(isRedisConfigured(), false);
  });

  it("treats missing REDIS_URL as not configured", () => {
    process.env.DISABLE_REDIS = "false";
    delete process.env.REDIS_URL;

    assert.equal(getRedisUrl(), null);
    assert.equal(isRedisConfigured(), false);
  });

  it("recognizes AggregateError-style Redis connection failures", () => {
    const connectionRefused = Object.assign(
      new Error("connect ECONNREFUSED 127.0.0.1:6379"),
      { code: "ECONNREFUSED" },
    );
    const aggregateError = Object.assign(
      new AggregateError([connectionRefused]),
      { aggregateErrors: [connectionRefused] },
    );

    assert.equal(isRedisConnectionError(aggregateError), true);
  });

  it("recognizes socket-closed Redis disconnects", () => {
    const socketClosed = Object.assign(
      new Error("Socket closed unexpectedly"),
      { name: "SocketClosedUnexpectedlyError" },
    );

    assert.equal(isRedisConnectionError(socketClosed), true);
  });

  it("redacts Redis passwords in logs", () => {
    assert.equal(
      redactRedisUrl("redis://default:super-secret@localhost:6379"),
      "redis://default:***@localhost:6379",
    );
  });
});
