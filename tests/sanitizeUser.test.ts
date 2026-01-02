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

  it("removes pin property (stored secret for workers)", () => {
    const user = { id: 1, name: "Worker", pin: "hashedpin123", role: "worker" };
    const sanitized = sanitizeUser(user);
    assert.deepEqual(sanitized, { id: 1, name: "Worker", role: "worker" });
    assert.ok(!("pin" in sanitized!));
  });

  it("removes both password and pin when both are present", () => {
    const user = { id: 1, name: "Test", password: "secret", pin: "hashedpin", email: "test@example.com" };
    const sanitized = sanitizeUser(user);
    assert.deepEqual(sanitized, { id: 1, name: "Test", email: "test@example.com" });
    assert.ok(!("password" in sanitized!));
    assert.ok(!("pin" in sanitized!));
  });

  it("returns user unchanged when no sensitive fields present", () => {
    const user = { id: 1, name: "Regular", email: "user@example.com" };
    const sanitized = sanitizeUser(user);
    assert.deepEqual(sanitized, user);
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

  it("sanitizes lists with pin fields", () => {
    const input = [
      { id: 1, name: "Worker1", pin: "hash1" },
      { id: 2, name: "Worker2", pin: "hash2", password: "pwd" },
    ];
    const sanitized = sanitizeUserList(input);
    assert.deepEqual(sanitized, [
      { id: 1, name: "Worker1" },
      { id: 2, name: "Worker2" },
    ]);
    // Verify no sensitive fields leaked
    for (const user of sanitized) {
      assert.ok(!("password" in user));
      assert.ok(!("pin" in user));
    }
  });
});

