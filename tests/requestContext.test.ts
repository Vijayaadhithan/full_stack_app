import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getRequestMetadata,
  runWithRequestContext,
  updateRequestContext,
} from "../server/requestContext";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("request context", () => {
  it("exposes metadata for the current async call", async () => {
    const metadata = await runWithRequestContext(async () => {
      updateRequestContext({ requestId: "abc", userId: 42 });
      return getRequestMetadata();
    }, { request: { method: "GET", path: "/demo" } });

    assert.equal(metadata?.requestId, "abc");
    assert.equal(metadata?.userId, 42);
    assert.equal(metadata?.method, "GET");
    assert.equal(metadata?.path, "/demo");
    assert.equal(getRequestMetadata(), undefined);
  });

  it("isolates concurrent contexts", async () => {
    const [first, second] = await Promise.all([
      runWithRequestContext(async () => {
        updateRequestContext({ requestId: "first" });
        await delay(10);
        return getRequestMetadata()?.requestId;
      }),
      runWithRequestContext(async () => {
        updateRequestContext({ requestId: "second" });
        await delay(5);
        return getRequestMetadata()?.requestId;
      }),
    ]);

    assert.equal(first, "first");
    assert.equal(second, "second");
  });
});
