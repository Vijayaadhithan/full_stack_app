import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeUser,
  sanitizeUserList,
} from "../server/security/sanitizeUser";

describe("sanitizeUser utilities", () => {
  it("returns null when user payload is missing", () => {
    assert.equal(sanitizeUser(null), null);
    assert.equal(sanitizeUser(undefined), null);
  });

  it("removes password property but preserves other fields", () => {
    const user = { id: 1, name: "Test", password: "secret" };
    const sanitized = sanitizeUser(user);
    assert.deepEqual(sanitized, { id: 1, name: "Test" });
    assert.ok(!("password" in sanitized!));
  });

  it("sanitizes user lists and filters null entries", () => {
    const input = [
      { id: 1, email: "a@example.com", password: "a" },
      null,
      { id: 2, email: "b@example.com" },
    ];
    const sanitized = sanitizeUserList(input as any);
    assert.deepEqual(sanitized, [
      { id: 1, email: "a@example.com" },
      { id: 2, email: "b@example.com" },
    ]);
  });
});
