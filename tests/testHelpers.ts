/**
 * Test helper utilities for consistent mocking patterns
 */
import { mock } from "node:test";
import type { Mock } from "node:test";

export type Handler = (
    req: any,
    res: any,
    next?: () => unknown,
) => unknown | Promise<unknown>;

export type Route = {
    method: string;
    path: string;
    handlers: Handler[];
};

/**
 * Creates a mock database object that matches the db.primary/db.replica structure
 */
export function createMockDb() {
    const createDbMethods = () => ({
        select: mock.fn(() => ({
            from: mock.fn(() => ({
                where: mock.fn(() => ({
                    limit: mock.fn(async () => []),
                    offset: mock.fn(async () => []),
                })),
                leftJoin: mock.fn(() => ({
                    where: mock.fn(async () => []),
                })),
                innerJoin: mock.fn(() => ({
                    where: mock.fn(async () => []),
                })),
                limit: mock.fn(async () => []),
                orderBy: mock.fn(() => ({
                    limit: mock.fn(() => ({
                        offset: mock.fn(async () => []),
                    })),
                })),
                groupBy: mock.fn(() => ({
                    orderBy: mock.fn(async () => []),
                })),
            })),
        })),
        insert: mock.fn(() => ({
            values: mock.fn(() => ({
                returning: mock.fn(async () => []),
            })),
        })),
        update: mock.fn(() => ({
            set: mock.fn(() => ({
                where: mock.fn(() => ({
                    returning: mock.fn(async () => []),
                })),
            })),
        })),
        delete: mock.fn(() => ({
            where: mock.fn(() => ({
                returning: mock.fn(async () => []),
            })),
        })),
        execute: mock.fn(async () => undefined),
    });

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
 * Creates a standardized mock response object
 */
export function createMockRes() {
    const res: any = {
        statusCode: 200,
        body: undefined as unknown,
        headers: {} as Record<string, string>,
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
    };
    return res;
}

/**
 * Creates a mock Express app for route registration testing
 */
export function createMockApp() {
    const routes: Route[] = [];
    const app = {
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
    return { app, routes };
}

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

/**
 * Create a mock session object
 */
export function createMockSession(data: Record<string, any> = {}) {
    return {
        ...data,
        destroy: mock.fn((cb?: (err?: Error) => void) => cb?.()),
        save: mock.fn((cb?: (err?: Error) => void) => cb?.()),
        regenerate: mock.fn((cb?: (err?: Error) => void) => cb?.()),
    };
}

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
