import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { createCsrfProtection } from "../server/security/csrfProtection";

type SessionLike = {
  [key: string]: unknown;
};

type MockRequest = Partial<Request> & {
  session?: SessionLike;
  csrfToken?: () => string;
};

const SECRET_SESSION_KEY = "__csrfSecret";

function createRequest(
  overrides: Partial<MockRequest> & {
    method?: string;
    headers?: Record<string, string | string[]>;
  } = {},
): MockRequest {
  return {
    method: overrides.method,
    headers: overrides.headers ?? {},
    session: overrides.session,
    body: overrides.body,
    query: overrides.query,
  };
}

function invokeMiddleware(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  req: MockRequest,
) {
  return new Promise<unknown>((resolve) => {
    handler(req as Request, {} as Response, (err?: unknown) => {
      resolve(err ?? null);
    });
  });
}

describe("createCsrfProtection", () => {
  it("throws when session is missing", async () => {
    const middleware = createCsrfProtection();
    const err = await invokeMiddleware(
      middleware,
      createRequest({ method: "POST", headers: {} }),
    );
    assert.ok(err instanceof Error);
    assert.match((err as Error).message, /Session middleware must be mounted/i);
  });

  it("skips verification for ignored methods (case insensitive)", async () => {
    const middleware = createCsrfProtection({ ignoreMethods: ["post"] });
    const session: SessionLike = {};
    const req = createRequest({
      method: "post",
      headers: {},
      session,
    });
    const err = await invokeMiddleware(middleware, req);
    assert.equal(err, null);
    assert.equal(typeof req.csrfToken, "function");
    assert.equal(typeof session[SECRET_SESSION_KEY], "string");
  });

  it("treats missing method as GET and allows the request", async () => {
    const middleware = createCsrfProtection();
    const session: SessionLike = {};
    const err = await invokeMiddleware(
      middleware,
      createRequest({ method: undefined, headers: {}, session }),
    );
    assert.equal(err, null);
  });

  it("rejects unsafe requests without a token", async () => {
    const middleware = createCsrfProtection();
    const err = await invokeMiddleware(
      middleware,
      createRequest({ method: "POST", headers: {}, session: {} }),
    );
    assert.ok(err instanceof Error);
    assert.equal((err as Error & { code?: string }).code, "EBADCSRFTOKEN");
    assert.equal((err as Error).message, "Missing CSRF token");
  });

  it("rejects tokens that fail verification", async () => {
    const middleware = createCsrfProtection();
    const session: SessionLike = {
      [SECRET_SESSION_KEY]: "a".repeat(64),
    };
    const err = await invokeMiddleware(
      middleware,
      createRequest({
        method: "POST",
        headers: { "csrf-token": "aa.bb" },
        session,
      }),
    );
    assert.ok(err instanceof Error);
    assert.equal((err as Error & { code?: string }).code, "EBADCSRFTOKEN");
    assert.equal((err as Error).message, "Invalid CSRF token");
  });

  it("accepts a valid token provided in headers", async () => {
    const middleware = createCsrfProtection();
    const session: SessionLike = {};
    const seedRequest = createRequest({
      method: "GET",
      headers: {},
      session,
    });
    const seedErr = await invokeMiddleware(middleware, seedRequest);
    assert.equal(seedErr, null);
    assert.equal(typeof seedRequest.csrfToken, "function");
    const token = seedRequest.csrfToken!();

    const postRequest = createRequest({
      method: "POST",
      headers: { "x-csrf-token": ["   ", token] },
      session,
    });
    const postErr = await invokeMiddleware(middleware, postRequest);
    assert.equal(postErr, null);
  });

  it("accepts a valid token provided in the request body", async () => {
    const middleware = createCsrfProtection();
    const session: SessionLike = {};
    const seedRequest = createRequest({
      method: "GET",
      headers: {},
      session,
    });
    await invokeMiddleware(middleware, seedRequest);
    const token = seedRequest.csrfToken!();

    const postRequest = createRequest({
      method: "POST",
      headers: {},
      body: { _csrf: token },
      session,
    });
    const err = await invokeMiddleware(middleware, postRequest);
    assert.equal(err, null);
  });

  it("accepts a valid token provided in the query string", async () => {
    const middleware = createCsrfProtection();
    const session: SessionLike = {};
    const seedRequest = createRequest({
      method: "GET",
      headers: {},
      session,
    });
    await invokeMiddleware(middleware, seedRequest);
    const token = seedRequest.csrfToken!();

    const postRequest = createRequest({
      method: "POST",
      headers: {},
      query: { _csrf: token },
      session,
    });
    const err = await invokeMiddleware(middleware, postRequest);
    assert.equal(err, null);
  });
});
