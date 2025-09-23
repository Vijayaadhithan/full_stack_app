import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getLogContext,
  runWithLogContext,
  setLogContext,
} from "../server/logger";

describe("logger context helpers", () => {
  it("merges updates within a context and resets afterwards", () => {
    const result = runWithLogContext(() => {
      assert.deepEqual(getLogContext(), {});
      setLogContext({ userId: "123" });
      setLogContext({ category: "customer" });
      return getLogContext();
    });

    assert.equal(result?.userId, "123");
    assert.equal(result?.category, "customer");
    assert.equal(getLogContext(), undefined);
  });

  it("isolates values across concurrent async calls", async () => {
    const [first, second] = await Promise.all([
      runWithLogContext(async () => {
        setLogContext({ userId: "alpha" });
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getLogContext();
      }),
      runWithLogContext(async () => {
        setLogContext({ userId: "beta" });
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getLogContext();
      }),
    ]);

    assert.equal(first?.userId, "alpha");
    assert.equal(second?.userId, "beta");
  });
});
