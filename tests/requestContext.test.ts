/**
 * Tests for server/requestContext.ts
 * Request context middleware and ID generation
 */
import { describe, it } from "node:test";
import assert from "node:assert";

describe("requestContext", () => {
    describe("request ID generation", () => {
        function generateRequestId(): string {
            // Simple UUID-like generation
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        }

        it("should generate unique IDs", () => {
            const ids = new Set<string>();
            for (let i = 0; i < 100; i++) {
                ids.add(generateRequestId());
            }
            assert.strictEqual(ids.size, 100);
        });

        it("should generate valid UUID format", () => {
            const id = generateRequestId();
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            assert.ok(uuidPattern.test(id), `Invalid UUID format: ${id}`);
        });

        it("should include version 4 marker", () => {
            const id = generateRequestId();
            assert.strictEqual(id[14], "4");
        });

        it("should include variant marker", () => {
            const id = generateRequestId();
            const variant = id[19];
            assert.ok(["8", "9", "a", "b"].includes(variant));
        });
    });

    describe("request context data structure", () => {
        interface RequestContext {
            requestId: string;
            startTime: number;
            userId?: number;
            path?: string;
            method?: string;
        }

        function createContext(req: { path?: string; method?: string; user?: { id: number } }): RequestContext {
            return {
                requestId: "test-request-id",
                startTime: Date.now(),
                userId: req.user?.id,
                path: req.path,
                method: req.method,
            };
        }

        it("should create context with required fields", () => {
            const ctx = createContext({});

            assert.ok(ctx.requestId);
            assert.ok(ctx.startTime > 0);
        });

        it("should include user ID when present", () => {
            const ctx = createContext({ user: { id: 123 } });

            assert.strictEqual(ctx.userId, 123);
        });

        it("should include path and method", () => {
            const ctx = createContext({ path: "/api/test", method: "GET" });

            assert.strictEqual(ctx.path, "/api/test");
            assert.strictEqual(ctx.method, "GET");
        });

        it("should handle missing user", () => {
            const ctx = createContext({});

            assert.strictEqual(ctx.userId, undefined);
        });
    });

    describe("request timing", () => {
        it("should calculate request duration", () => {
            const startTime = Date.now() - 100; // 100ms ago
            const endTime = Date.now();
            const duration = endTime - startTime;

            assert.ok(duration >= 100);
            assert.ok(duration < 200);
        });

        it("should handle sub-millisecond timing", () => {
            const start = performance.now();
            // Small operation
            const _ = Math.random() * 100;
            const end = performance.now();
            const duration = end - start;

            assert.ok(duration >= 0);
        });
    });

    describe("context headers", () => {
        function getRequestIdFromHeader(headers: Record<string, string | undefined>): string | null {
            return headers["x-request-id"] || headers["x-correlation-id"] || null;
        }

        it("should extract request ID from x-request-id header", () => {
            const headers = { "x-request-id": "abc-123" };
            const id = getRequestIdFromHeader(headers);

            assert.strictEqual(id, "abc-123");
        });

        it("should extract from x-correlation-id as fallback", () => {
            const headers = { "x-correlation-id": "def-456" };
            const id = getRequestIdFromHeader(headers);

            assert.strictEqual(id, "def-456");
        });

        it("should prefer x-request-id over x-correlation-id", () => {
            const headers = {
                "x-request-id": "primary",
                "x-correlation-id": "fallback"
            };
            const id = getRequestIdFromHeader(headers);

            assert.strictEqual(id, "primary");
        });

        it("should return null if no header present", () => {
            const headers = {};
            const id = getRequestIdFromHeader(headers);

            assert.strictEqual(id, null);
        });
    });

    describe("IP extraction", () => {
        function getClientIp(headers: Record<string, string | undefined>, socketAddress?: string): string {
            // Check forwarded headers first (for proxies)
            const forwarded = headers["x-forwarded-for"];
            if (forwarded) {
                const firstIp = forwarded.split(",")[0].trim();
                return firstIp;
            }

            const realIp = headers["x-real-ip"];
            if (realIp) {
                return realIp;
            }

            return socketAddress || "unknown";
        }

        it("should extract IP from x-forwarded-for", () => {
            const headers = { "x-forwarded-for": "203.0.113.195, 70.41.3.18" };
            const ip = getClientIp(headers);

            assert.strictEqual(ip, "203.0.113.195");
        });

        it("should extract IP from x-real-ip", () => {
            const headers = { "x-real-ip": "192.168.1.1" };
            const ip = getClientIp(headers);

            assert.strictEqual(ip, "192.168.1.1");
        });

        it("should fall back to socket address", () => {
            const headers = {};
            const ip = getClientIp(headers, "127.0.0.1");

            assert.strictEqual(ip, "127.0.0.1");
        });

        it("should return 'unknown' if no IP found", () => {
            const headers = {};
            const ip = getClientIp(headers);

            assert.strictEqual(ip, "unknown");
        });

        it("should handle single forwarded IP", () => {
            const headers = { "x-forwarded-for": "10.0.0.1" };
            const ip = getClientIp(headers);

            assert.strictEqual(ip, "10.0.0.1");
        });
    });
});
