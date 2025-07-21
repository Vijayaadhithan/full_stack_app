import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toISTForStorage,
  fromDatabaseToIST,
  getExpirationDate,
} from "../server/ist-utils";

describe("IST utils", () => {
  it("converts null safely", () => {
    assert.strictEqual(toISTForStorage(null), null);
    assert.strictEqual(fromDatabaseToIST(null), null);
  });

  it("calculates expiration date", () => {
    const start = new Date();
    const exp = getExpirationDate(1);
    const diff = exp.getTime() - start.getTime();
    assert.ok(diff >= 3600000);
  });
});
