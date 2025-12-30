import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import passport from "passport";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { emailVerificationTokens as emailVerificationTokensTable } from "@shared/schema";

process.env.SESSION_SECRET = "AAaa11!!AAaa11!!AAaa11!!AAaa11!!AAaa11!!";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
const {
  initializeAuth,
  registerAuthRoutes,
  hashPasswordInternal,
} = await import("../server/auth");

type RouteHandler = (req: any, res: any, next: (err?: unknown) => void) => unknown;

function findRouteHandlers(app: express.Express, method: string, path: string): RouteHandler[] {
  const stack = (app as any)._router?.stack ?? [];
  for (const layer of stack) {
    if (!layer.route) continue;
    if (layer.route.path === path && layer.route.methods[method]) {
      return layer.route.stack.map((entry: any) => entry.handle as RouteHandler);
    }
  }
  throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

beforeEach(() => {
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
});

describe("auth setup integration", () => {
  it("registers a user through the POST /api/register handler", async () => {
    const app = express();
    app.use(express.json());
    initializeAuth(app);
    registerAuthRoutes(app);

    const handlers = findRouteHandlers(app, "post", "/api/register");
    const registerHandler = handlers.at(-1)!;

    mock.method(storage, "getUserByUsername", async () => undefined);
    mock.method(storage, "getUserByEmail", async () => undefined);
    mock.method(storage, "getUserByPhone", async () => undefined);
    mock.method(storage, "createUser", async (payload: any) => ({ ...payload, id: 101 }));
    mock.method(db, "insert", (_table: unknown) => {
      // Allow any insert for testing auth setup (no strict token check)
      return {
        values: async () => undefined,
      };
    });

    const req: any = {
      body: {
        username: "NewUser123",
        password: "ValidPass!1",
        role: "customer",
        name: "Test User",
        phone: "12345678",
        email: "user@example.com",
      },
      login(user: unknown, callback: (err?: unknown) => void) {
        this.user = user;
        callback();
      },
      session: {},
    };
    const res = createMockResponse();
    await registerHandler(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 201);
    assert.equal((res.body as any).username, "newuser123");
  });

  it("rejects duplicate usernames via register handler", async () => {
    const app = express();
    app.use(express.json());
    initializeAuth(app);
    registerAuthRoutes(app);

    const handlers = findRouteHandlers(app, "post", "/api/register");
    const registerHandler = handlers.at(-1)!;

    mock.method(storage, "getUserByUsername", async () => ({ id: 1 }));

    const req: any = {
      body: {
        username: "ExistingUser",
        password: "ValidPass!1",
        role: "customer",
        name: "Existing",
        phone: "12345678",
        email: "existing@example.com",
      },
      login: () => undefined,
    };
    const res = createMockResponse();
    await registerHandler(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 400);
    assert.match((res.body as any).message, /Username already exists/);
  });

  it("authenticates via the local strategy verifier", async () => {
    const app = express();
    initializeAuth(app);

    const strategy = (passport as any)._strategy("local");
    assert.ok(strategy, "local strategy not registered");

    const hashed = await hashPasswordInternal("ValidPass!1");
    mock.method(storage, "getUserByUsername", async () => ({
      id: 55,
      username: "loginuser",
      password: hashed,
      role: "customer",
      name: "Login User",
      phone: "9000000015",
      email: "login@example.com",
    }));
    mock.method(storage, "getUserByEmail", async () => undefined);
    mock.method(storage, "getUserByPhone", async () => undefined);

    const result = await new Promise<{ err: unknown; user: unknown; info: unknown }>((resolve) => {
      strategy._verify("loginuser", "ValidPass!1", (err: unknown, user: unknown, info: unknown) => {
        resolve({ err, user, info });
      });
    });

    assert.equal(result.err, null);
    assert.ok(result.user);
    assert.equal((result.user as any).username, "loginuser");
  });


});
