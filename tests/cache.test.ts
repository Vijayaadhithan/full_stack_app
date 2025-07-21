import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setCache, getCache } from "../server/cache";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("cache utilities", () => {
  it("stores and retrieves values", () => {
    setCache("a", 123, 1000);
    assert.strictEqual(getCache<number>("a"), 123);
  });

  it("expires values after ttl", async () => {
    setCache("b", 5, 1); // 1ms ttl
    await delay(10);
    assert.strictEqual(getCache("b"), undefined);
  });
});
