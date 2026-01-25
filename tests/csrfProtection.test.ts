/**
 * Tests for server/security/csrfProtection.ts
 * CSRF token validation middleware
 */
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { createCsrfProtection } from "../server/security/csrfProtection.js";
import { createMockReq, createMockRes, createMockSession } from "./testHelpers.js";

describe("csrfProtection", () => {
    describe("createCsrfProtection", () => {
        // Positive cases
        it("should return a middleware function", () => {
            const middleware = createCsrfProtection();
            assert.strictEqual(typeof middleware, "function");
        });

        it("should attach csrfToken function to request", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "GET" });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(!err);
                assert.strictEqual(typeof req.csrfToken, "function");
                done();
            });
        });
    });

    describe("ignored methods", () => {
        // Positive cases - GET, HEAD, OPTIONS should bypass
        it("should allow GET requests without token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "GET" });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(!err);
                done();
            });
        });

        it("should allow HEAD requests without token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "HEAD" });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(!err);
                done();
            });
        });

        it("should allow OPTIONS requests without token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "OPTIONS" });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(!err);
                done();
            });
        });
    });

    describe("token validation - negative cases", () => {
        it("should reject POST without token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "POST" });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(err);
                assert.strictEqual(err.code, "EBADCSRFTOKEN");
                assert.strictEqual(err.status, 403);
                done();
            });
        });

        it("should reject PATCH without token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "PATCH" });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(err);
                assert.strictEqual(err.code, "EBADCSRFTOKEN");
                done();
            });
        });

        it("should reject DELETE without token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "DELETE" });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(err);
                assert.strictEqual(err.code, "EBADCSRFTOKEN");
                done();
            });
        });

        it("should reject invalid token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({
                method: "POST",
                headers: { "csrf-token": "invalid-token" },
            });
            req.session = createMockSession();
            const res = createMockRes();

            middleware(req, res, (err?: any) => {
                assert.ok(err);
                assert.strictEqual(err.code, "EBADCSRFTOKEN");
                done();
            });
        });

        it("should reject tampered token", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "GET" });
            req.session = createMockSession();
            const res = createMockRes();

            // First, get a valid token
            middleware(req, res, () => {
                const token = req.csrfToken();
                // Tamper with the token
                const tamperedToken = token.replace(/[a-f]/g, "0");

                const postReq: any = createMockReq({
                    method: "POST",
                    headers: { "csrf-token": tamperedToken },
                });
                postReq.session = req.session; // Same session

                middleware(postReq, createMockRes(), (err?: any) => {
                    assert.ok(err);
                    assert.strictEqual(err.code, "EBADCSRFTOKEN");
                    done();
                });
            });
        });
    });

    describe("token validation - positive cases", () => {
        it("should accept valid token from header", (_, done) => {
            const middleware = createCsrfProtection();
            const session = createMockSession();

            // First request to get token
            const getReq: any = createMockReq({ method: "GET" });
            getReq.session = session;
            const res = createMockRes();

            middleware(getReq, res, () => {
                const token = getReq.csrfToken();

                // Second request with token
                const postReq: any = createMockReq({
                    method: "POST",
                    headers: { "csrf-token": token },
                });
                postReq.session = session;

                middleware(postReq, createMockRes(), (err?: any) => {
                    assert.ok(!err);
                    done();
                });
            });
        });

        it("should accept token from x-csrf-token header", (_, done) => {
            const middleware = createCsrfProtection();
            const session = createMockSession();

            const getReq: any = createMockReq({ method: "GET" });
            getReq.session = session;

            middleware(getReq, createMockRes(), () => {
                const token = getReq.csrfToken();

                const postReq: any = createMockReq({
                    method: "POST",
                    headers: { "x-csrf-token": token },
                });
                postReq.session = session;

                middleware(postReq, createMockRes(), (err?: any) => {
                    assert.ok(!err);
                    done();
                });
            });
        });

        it("should accept token from body", (_, done) => {
            const middleware = createCsrfProtection();
            const session = createMockSession();

            const getReq: any = createMockReq({ method: "GET" });
            getReq.session = session;

            middleware(getReq, createMockRes(), () => {
                const token = getReq.csrfToken();

                const postReq: any = createMockReq({
                    method: "POST",
                    body: { _csrf: token },
                });
                postReq.session = session;

                middleware(postReq, createMockRes(), (err?: any) => {
                    assert.ok(!err);
                    done();
                });
            });
        });
    });

    describe("Authorization header behavior", () => {
        it("should not bypass CSRF for requests with Authorization header", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({
                method: "POST",
                headers: { authorization: "Bearer some-token" },
            });
            req.session = createMockSession();

            middleware(req, createMockRes(), (err?: any) => {
                assert.ok(err);
                assert.ok(err.message.includes("Missing CSRF token"));
                done();
            });
        });
    });

    describe("ignorePaths option", () => {
        it("should skip validation for ignored paths", (_, done) => {
            const middleware = createCsrfProtection({
                ignorePaths: ["/api/analytics"],
            });
            const req: any = createMockReq({
                method: "POST",
                path: "/api/analytics",
            });
            req.session = createMockSession();

            middleware(req, createMockRes(), (err?: any) => {
                assert.ok(!err);
                done();
            });
        });
    });

    describe("session requirement", () => {
        it("should error when session is missing", (_, done) => {
            const middleware = createCsrfProtection();
            const req: any = createMockReq({ method: "GET" });
            req.session = undefined;

            middleware(req, createMockRes(), (err?: any) => {
                assert.ok(err);
                assert.ok(err.message.includes("Session middleware"));
                done();
            });
        });
    });
});
