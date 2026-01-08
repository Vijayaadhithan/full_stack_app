/**
 * Tests for server/logger.ts
 * Logging functionality
 */
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

describe("logger", () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
        originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    describe("logger instance", () => {
        // Positive cases
        it("should export a logger with standard methods", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.ok(typeof logger.info === "function");
            assert.ok(typeof logger.warn === "function");
            assert.ok(typeof logger.error === "function");
            assert.ok(typeof logger.debug === "function");
        });

        it("should have trace and fatal methods", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.ok(typeof logger.trace === "function");
            assert.ok(typeof logger.fatal === "function");
        });

        it("should have child method for creating child loggers", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.ok(typeof logger.child === "function");
        });
    });

    describe("log levels", () => {
        it("should not throw when logging strings", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.doesNotThrow(() => {
                logger.info("test message");
            });
        });

        it("should not throw when logging objects", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.doesNotThrow(() => {
                logger.info({ key: "value" }, "test message");
            });
        });

        it("should not throw when logging errors", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.doesNotThrow(() => {
                logger.error({ err: new Error("test error") }, "error occurred");
            });
        });

        it("should handle nested objects", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.doesNotThrow(() => {
                logger.info({
                    user: { id: 1, name: "test" },
                    action: "login",
                }, "user logged in");
            });
        });
    });

    describe("child loggers", () => {
        it("should create child logger with additional context", async () => {
            const { default: logger } = await import("../server/logger.js");

            const childLogger = logger.child({ requestId: "123" });

            assert.ok(childLogger);
            assert.ok(typeof childLogger.info === "function");
        });

        it("child logger should not throw on logging", async () => {
            const { default: logger } = await import("../server/logger.js");

            const childLogger = logger.child({ component: "test" });

            assert.doesNotThrow(() => {
                childLogger.info("child logger message");
            });
        });
    });

    describe("error handling", () => {
        // Negative cases - should handle gracefully
        it("should handle undefined message", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.doesNotThrow(() => {
                logger.info(undefined as any);
            });
        });

        it("should handle null in context", async () => {
            const { default: logger } = await import("../server/logger.js");

            assert.doesNotThrow(() => {
                logger.info({ value: null }, "null value");
            });
        });
    });
});
