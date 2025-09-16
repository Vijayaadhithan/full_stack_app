import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setCache, getCache, flushCache } from "../server/cache";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
});
