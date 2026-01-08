/**
 * Test helper utilities for consistent mocking patterns
 * Enhanced version with comprehensive mock utilities
 */
import { mock } from "node:test";
import type { Mock } from "node:test";

export type Handler = (
    req: any,
    res: any,
    next?: (err?: any) => unknown,
) => unknown | Promise<unknown>;

export type Route = {
    method: string;
    path: string;
    handlers: Handler[];
};

// ============================================
// Mock Database Utilities
// ============================================

/**
 * Creates a mock database object that matches the db.primary/db.replica structure
 */
export function createMockDb() {
    const createDbMethods = () => {
        const chainable: any = {
            select: mock.fn(() => chainable),
            from: mock.fn(() => chainable),
            where: mock.fn(() => chainable),
            limit: mock.fn(() => chainable),
            offset: mock.fn(() => chainable),
            leftJoin: mock.fn(() => chainable),
            innerJoin: mock.fn(() => chainable),
            orderBy: mock.fn(() => chainable),
            groupBy: mock.fn(() => chainable),
            returning: mock.fn(async () => []),
            insert: mock.fn(() => chainable),
            values: mock.fn(() => chainable),
            update: mock.fn(() => chainable),
            set: mock.fn(() => chainable),
            delete: mock.fn(() => chainable),
            execute: mock.fn(async () => undefined),
            then: undefined as any, // Prevent automatic Promise detection
        };

        // Make terminal methods return promises
        const originalLimit = chainable.limit;
        chainable.limit = mock.fn((...args: any[]) => {
            const result = originalLimit(...args);
            result.then = (resolve: any) => resolve([]);
            return result;
        });

        return chainable;
    };

    const primary = createDbMethods();
    const replica = createDbMethods();

    return {
        primary,
        replica,
        // Legacy compatibility - some tests may use db.select directly
        ...primary,
    };
}

/**
 * Creates a mock database that returns specified results
 */
export function createMockDbWithResults<T>(results: T[]) {
    const db = createMockDb();
    const mockResult = async () => results;

    // Override terminal operations to return results
    db.primary.limit = mock.fn(() => ({ then: (r: any) => r(results), offset: mock.fn(mockResult) }));
    db.primary.where = mock.fn(() => ({
        limit: mock.fn(() => ({ offset: mock.fn(mockResult), then: (r: any) => r(results) })),
        returning: mock.fn(mockResult),
        then: (r: any) => r(results)
    }));
    db.primary.returning = mock.fn(mockResult);

    return db;
}

// ============================================
// Mock Response Utilities
// ============================================

/**
 * Creates a standardized mock response object
 */
export function createMockRes() {
    const res: any = {
        statusCode: 200,
        body: undefined as unknown,
        headers: {} as Record<string, string>,
        cookies: {} as Record<string, { value: string; options?: any }>,
        locals: {},

        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(payload: unknown) {
            res.body = payload;
            return res;
        },
        send(payload?: unknown) {
            res.body = payload;
            return res;
        },
        setHeader(name: string, value: string) {
            res.headers[name.toLowerCase()] = value;
            return res;
        },
        getHeader(name: string) {
            return res.headers[name.toLowerCase()];
        },
        cookie(name: string, value: string, options?: any) {
            res.cookies[name] = { value, options };
            return res;
        },
        clearCookie(name: string) {
            delete res.cookies[name];
            return res;
        },
        redirect(url: string) {
            res.redirectUrl = url;
            return res;
        },
        end() {
            res.ended = true;
            return res;
        },
    };
    return res;
}

// ============================================
// Mock Request Utilities
// ============================================

/**
 * Creates a standardized mock request object
 */
export function createMockReq(options: {
    method?: string;
    path?: string;
    body?: any;
    query?: any;
    params?: any;
    headers?: Record<string, string>;
    user?: any;
    session?: any;
    isAuthenticated?: boolean;
} = {}) {
    return {
        method: options.method ?? "GET",
        path: options.path ?? "/",
        url: options.path ?? "/",
        body: options.body ?? {},
        query: options.query ?? {},
        params: options.params ?? {},
        headers: options.headers ?? {},
        user: options.user,
        session: options.session ?? createMockSession(),
        isAuthenticated: () => options.isAuthenticated ?? !!options.user,
        get(name: string) {
            return this.headers[name.toLowerCase()];
        },
        validatedParams: {},
        csrfToken: () => "mock-csrf-token",
    };
}

// ============================================
// Mock Express App Utilities
// ============================================

/**
 * Creates a mock Express app for route registration testing
 */
export function createMockApp() {
    const routes: Route[] = [];
    const middleware: Handler[] = [];

    const app: any = {
        use(...args: any[]) {
            if (typeof args[0] === "function") {
                middleware.push(args[0]);
            }
            return app;
        },
        post(path: string, ...handlers: Handler[]) {
            routes.push({ method: "post", path, handlers });
            return app;
        },
        get(path: string, ...handlers: Handler[]) {
            routes.push({ method: "get", path, handlers });
            return app;
        },
        patch(path: string, ...handlers: Handler[]) {
            routes.push({ method: "patch", path, handlers });
            return app;
        },
        put(path: string, ...handlers: Handler[]) {
            routes.push({ method: "put", path, handlers });
            return app;
        },
        delete(path: string, ...handlers: Handler[]) {
            routes.push({ method: "delete", path, handlers });
            return app;
        },
    };

    return { app, routes, middleware };
}

// ============================================
// Route Finding Utilities
// ============================================

/**
 * Find a route handler from registered routes
 */
export function findRoute(
    routes: Route[],
    method: string,
    path: string,
): Handler {
    const route = routes.find(
        (entry) => entry.method === method && entry.path === path,
    );
    if (!route) {
        throw new Error(`Route ${method.toUpperCase()} ${path} not registered`);
    }
    return route.handlers.at(-1)!;
}

/**
 * Find all handlers for a route
 */
export function findRouteHandlers(
    routes: Route[],
    method: string,
    path: string,
): Handler[] {
    const route = routes.find(
        (entry) => entry.method === method && entry.path === path,
    );
    if (!route) {
        throw new Error(`Route ${method.toUpperCase()} ${path} not registered`);
    }
    return route.handlers;
}

/**
 * Find handler from an Express router
 */
export function findRouterHandler(
    router: any,
    method: string,
    routePath: string,
): Handler {
    for (const layer of router.stack ?? []) {
        if (!layer.route) continue;
        if (layer.route.path === routePath && layer.route.methods?.[method]) {
            return layer.route.stack.at(-1)!.handle;
        }
    }
    throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
}

/**
 * Find all handlers in middleware stack from an Express router
 */
export function findRouteStack(
    router: any,
    method: string,
    routePath: string,
): Handler[] {
    for (const layer of router.stack ?? []) {
        if (!layer.route) continue;
        if (layer.route.path === routePath && layer.route.methods?.[method]) {
            return layer.route.stack.map(
                (entry: { handle: Handler }) => entry.handle,
            );
        }
    }
    throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
}

// ============================================
// Mock Session Utilities
// ============================================

/**
 * Create a mock session object
 */
export function createMockSession(data: Record<string, any> = {}) {
    const session: any = {
        ...data,
        id: data.id ?? "mock-session-id",
        cookie: data.cookie ?? { maxAge: 86400000 },
        destroy: mock.fn((cb?: (err?: Error) => void) => {
            Object.keys(session).forEach(key => {
                if (!["destroy", "save", "regenerate", "reload", "touch"].includes(key)) {
                    delete session[key];
                }
            });
            cb?.();
        }),
        save: mock.fn((cb?: (err?: Error) => void) => cb?.()),
        regenerate: mock.fn((cb?: (err?: Error) => void) => cb?.()),
        reload: mock.fn((cb?: (err?: Error) => void) => cb?.()),
        touch: mock.fn(),
    };
    return session;
}

// ============================================
// Test User Factories
// ============================================

/**
 * Create a mock user object
 */
export function createMockUser(overrides: Partial<{
    id: number;
    username: string;
    email: string;
    phone: string;
    role: string;
    password: string;
    isSuspended: boolean;
    verificationStatus: string | null;
    name: string;
}> = {}) {
    return {
        id: overrides.id ?? 1,
        username: overrides.username ?? "testuser",
        email: overrides.email ?? "test@example.com",
        phone: overrides.phone ?? "+911234567890",
        role: overrides.role ?? "customer",
        password: overrides.password ?? "hashedpassword",
        isSuspended: overrides.isSuspended ?? false,
        verificationStatus: overrides.verificationStatus ?? null,
        name: overrides.name ?? "Test User",
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

/**
 * Create an admin user
 */
export function createMockAdmin(overrides: Partial<{
    id: string;
    email: string;
    password: string;
    mustChangePassword: boolean;
}> = {}) {
    return {
        id: overrides.id ?? "admin-1",
        email: overrides.email ?? "admin@example.com",
        password: overrides.password ?? "hashedpassword",
        mustChangePassword: overrides.mustChangePassword ?? false,
        createdAt: new Date(),
    };
}

// ============================================
// Logger Utilities
// ============================================

/**
 * Silence logger for tests
 */
export function silenceLogger(logger: any) {
    mock.method(logger, "info", () => undefined);
    mock.method(logger, "warn", () => undefined);
    mock.method(logger, "error", () => undefined);
    mock.method(logger, "debug", () => undefined);
    mock.method(logger, "trace", () => undefined);
    mock.method(logger, "fatal", () => undefined);
}

/**
 * Create a mock logger that captures logs
 */
export function createMockLogger() {
    const logs: { level: string; args: any[] }[] = [];

    return {
        logs,
        info: (...args: any[]) => logs.push({ level: "info", args }),
        warn: (...args: any[]) => logs.push({ level: "warn", args }),
        error: (...args: any[]) => logs.push({ level: "error", args }),
        debug: (...args: any[]) => logs.push({ level: "debug", args }),
        trace: (...args: any[]) => logs.push({ level: "trace", args }),
        fatal: (...args: any[]) => logs.push({ level: "fatal", args }),
        child: () => createMockLogger(),
        clear: () => { logs.length = 0; },
    };
}

// ============================================
// Async Test Utilities
// ============================================

/**
 * Run handler with timeout protection
 */
export async function runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number = 5000,
): Promise<T> {
    return Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Test timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
    ]);
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 1000,
    intervalMs: number = 50,
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await condition()) return;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`waitFor timeout after ${timeoutMs}ms`);
}

// ============================================
// Assertion Utilities
// ============================================

/**
 * Assert response has expected status code
 */
export function assertStatus(res: any, expectedStatus: number) {
    if (res.statusCode !== expectedStatus) {
        throw new Error(
            `Expected status ${expectedStatus} but got ${res.statusCode}. Body: ${JSON.stringify(res.body)}`
        );
    }
}

/**
 * Assert response body contains expected properties
 */
export function assertBodyContains(res: any, expected: Record<string, any>) {
    for (const [key, value] of Object.entries(expected)) {
        if (res.body?.[key] !== value) {
            throw new Error(
                `Expected body.${key} to be ${JSON.stringify(value)} but got ${JSON.stringify(res.body?.[key])}`
            );
        }
    }
}

// ============================================
// Paging Builder Mock
// ============================================

/**
 * Creates a paging builder mock for paginated queries
 */
export function createPagingBuilder<T>(result: T[]) {
    const builder: any = {
        where: () => builder,
        limit: () => builder,
        offset: async () => result,
        orderBy: () => builder,
    };
    return builder;
}

// ============================================
// Environment Setup
// ============================================

/**
 * Setup test environment variables
 */
export function setupTestEnv() {
    process.env.NODE_ENV = "test";
    process.env.USE_IN_MEMORY_DB = "true";
    process.env.DISABLE_RATE_LIMITERS = "true";
    process.env.DISABLE_REDIS = "true";
    process.env.SESSION_SECRET = "test-session-secret";
}

/**
 * Cleanup function to reset mocks between tests
 */
export function cleanup() {
    mock.reset();
}
