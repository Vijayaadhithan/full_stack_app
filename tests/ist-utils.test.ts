import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toUTCForStorage,
  fromDatabaseToIST,
  getExpirationDate,
  getCurrentISTDate,
  convertArrayDatesToIST,
} from "../server/ist-utils";

describe("IST utils", () => {
  it("converts null safely", () => {
    assert.strictEqual(toUTCForStorage(null), null);
    assert.strictEqual(fromDatabaseToIST(null), null);
  });

  it("calculates expiration date", () => {
    const start = new Date();
    const exp = getExpirationDate(1);
    const diff = exp.getTime() - start.getTime();
    assert.ok(diff >= 3600000);
  });

  it("delegates current time to shared helper", () => {
    const lowerBound = fromDatabaseToIST(new Date());
    const current = getCurrentISTDate();
    const upperBound = fromDatabaseToIST(new Date());
    assert.ok(current instanceof Date);
    if (lowerBound && upperBound) {
      assert.ok(current.getTime() >= lowerBound.getTime());
      assert.ok(current.getTime() <= upperBound.getTime());
    }
  });

  it("converts array date fields without mutating input", () => {
    const original = [
      {
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: "2024-01-02T00:00:00Z",
        unchanged: "value",
      },
    ];

    const result = convertArrayDatesToIST(original, ["createdAt", "updatedAt"]);
    assert.notStrictEqual(result[0], original[0]);
    assert.equal(result[0].unchanged, "value");
    assert.ok(result[0].createdAt instanceof Date);
    assert.ok(result[0].updatedAt instanceof Date);

    const expectedCreated = fromDatabaseToIST(original[0].createdAt)!;
    const expectedUpdated = fromDatabaseToIST(original[0].updatedAt)!;
    assert.equal(result[0].createdAt.getTime(), expectedCreated.getTime());
    assert.equal(result[0].updatedAt.getTime(), expectedUpdated.getTime());
    assert.ok(original[0].createdAt instanceof Date);
    assert.equal(typeof original[0].updatedAt, "string");
  });
});
