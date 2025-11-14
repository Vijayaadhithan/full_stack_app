import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import logger from "../server/logger";
import {
  setCache,
  getCache,
  flushCache,
  invalidateCache,
  __resetCacheForTesting,
  __setRedisModuleLoaderForTesting,
} from "../server/cache";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  mock.restoreAll();
  delete process.env.DISABLE_REDIS;
  delete process.env.REDIS_URL;
  __setRedisModuleLoaderForTesting(null);
  __resetCacheForTesting();
});

afterEach(() => {
  mock.restoreAll();
  __setRedisModuleLoaderForTesting(null);
  __resetCacheForTesting();
});

describe("cache utilities", () => {
  it("stores and retrieves values", async () => {
    await flushCache();
    await setCache("a", 123, 1000);
    assert.strictEqual(await getCache<number>("a"), 123);
  });

  it("expires values after ttl", async () => {
    await flushCache();
    await setCache("b", 5, 1); // 1ms ttl
    await delay(10);
    assert.strictEqual(await getCache("b"), undefined);
  });

  it("falls back to in-memory cache when redis disabled", async () => {
    process.env.DISABLE_REDIS = "true";
    const infoMock = mock.method(logger, "info", () => undefined);
    await setCache("flag", "x", 5);
    const value = await getCache("flag");
    assert.equal(value, "x");
    assert.equal(infoMock.mock.callCount(), 1);
  });

  it("logs missing redis url only once", async () => {
    const infoMock = mock.method(logger, "info", () => undefined);
    await getCache("missing");
    await getCache("missing");
    assert.equal(infoMock.mock.callCount(), 1);
  });

  it("uses redis client when configured", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const client = {
      on: mock.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === "connect") {
          handler();
        }
      }),
      connect: mock.fn(async () => undefined),
      get: mock.fn(async () => JSON.stringify({ ok: true })),
      set: mock.fn(async () => undefined),
      del: mock.fn(async () => undefined),
      flushAll: mock.fn(async () => undefined),
    };
    __setRedisModuleLoaderForTesting(async () => ({
      createClient: () => client,
    }));

    await setCache("redis-key", { ok: true }, 5);
    const value = await getCache<{ ok: boolean }>("redis-key");
    assert.deepEqual(value, { ok: true });
    await invalidateCache("redis-key");
    await flushCache();

    assert.equal(client.connect.mock.callCount(), 1);
    assert.equal(client.set.mock.callCount(), 1);
    assert.equal(client.get.mock.callCount(), 1);
    assert.equal(client.del.mock.callCount(), 1);
    assert.equal(client.flushAll.mock.callCount(), 1);
  });
});
