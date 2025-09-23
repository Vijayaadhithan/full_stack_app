import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";

const indexModule = await import("../server/index");
const {
  shouldMaskKey,
  sanitizeRecord,
  sanitizeBody,
  sanitizeHeaders,
  extractStatusCode,
  resolveErrorMessage,
} = indexModule;

describe("server index utility helpers", () => {
  it("detects when keys should be masked", () => {
    assert.equal(shouldMaskKey("Authorization"), true);
    assert.equal(shouldMaskKey("content-length"), false);
  });

  it("sanitizes nested records without mutating originals", () => {
    const input = {
      password: "super-secret",
      nested: { token: "abc", safe: "value" },
      array: ["visible", { cookie: "crumbs" }],
      buffer: Buffer.from("binary"),
      long: "a".repeat(250),
    };

    const result = sanitizeRecord(input)!;

    assert.equal(result.password, "[REDACTED]");
    assert.equal(result.nested?.token, "[REDACTED]");
    assert.equal(result.nested?.safe, "value");
    assert.equal(result.array?.[0], "visible");
    assert.equal(result.array?.[1]?.cookie, "[REDACTED]");
    assert.equal(result.buffer, "[buffer:6]");
    assert.equal(result.long, `${"a".repeat(200)}…`);
    assert.equal(input.password, "super-secret");
  });

  it("sanitizes response bodies consistently", () => {
    assert.equal(sanitizeBody("raw text"), "[string body omitted]");
    assert.equal(sanitizeBody(Buffer.from("data")), "[buffer:4]");

    const sanitizedObject = sanitizeBody({ token: "abc", nested: { password: "hidden" } });
    assert.deepEqual(sanitizedObject, {
      token: "[REDACTED]",
      nested: { password: "[REDACTED]" },
    });
  });

  it("only logs allowed headers", () => {
    const headers = sanitizeHeaders({
      host: "example.com",
      "user-agent": "jest",
      authorization: "secret",
      referer: "https://example.com",
    } as any);

    assert.deepEqual(headers, {
      "user-agent": "jest",
      referer: "https://example.com",
    });
  });

  it("extracts status codes from various error shapes", () => {
    assert.equal(extractStatusCode({ status: 404 }), 404);
    assert.equal(extractStatusCode({ statusCode: 422 }), 422);
    assert.equal(extractStatusCode(new Error("boom")), 500);
  });

  it("resolves error messages for different inputs", () => {
    assert.equal(resolveErrorMessage(new Error("fail")), "fail");
    assert.equal(resolveErrorMessage({ message: "custom" }), "custom");
    assert.equal(resolveErrorMessage("text"), "text");
    assert.equal(resolveErrorMessage(123), "Internal Server Error");
  });
});
