import { after, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert";
import express, { type Express } from "express";
import type { Server } from "node:http";
import { closeConnection } from "../server/db.js";
import {
  createMockReq,
  createMockRes,
  findRouteStack,
} from "./testHelpers.js";

type RegisterRoutes = (app: Express) => Promise<Server>;

function createSelectChain<T>(result: T[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    rightJoin: () => chain,
    innerJoin: () => chain,
    limit: async () => result,
  };
  chain.then = (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("endpoint: routes.ts regressions", () => {
  let app: Express;
  let server: Server;
  let registerRoutes: RegisterRoutes;
  let storage: any;
  let db: any;

  beforeEach(() => {
    mock.reset();
  });

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.USE_IN_MEMORY_DB = "true";
    process.env.DISABLE_REDIS = "true";
    process.env.DISABLE_RATE_LIMITERS = "true";
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET ||
      "A!VeryStrongSessionSecretWithEntropy123456789";

    ({ registerRoutes } = await import("../server/routes.js"));
    ({ storage } = await import("../server/storage.js"));
    ({ db } = await import("../server/db.js"));

    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  async function closeServerGracefully(httpServer: Server): Promise<void> {
    if (!httpServer.listening) {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const timeout = setTimeout(finish, 1_000);
      timeout.unref?.();

      httpServer.close(() => {
        clearTimeout(timeout);
        finish();
      });
    });
  }

  after(async () => {
    if (!server) {
      return;
    }
    try {
      if (typeof (server as any).closeAllConnections === "function") {
        (server as any).closeAllConnections();
      }
      if (typeof (server as any).closeIdleConnections === "function") {
        (server as any).closeIdleConnections();
      }
      await closeServerGracefully(server);
    } catch {
    }
    // Always close the DB connection pool — db.ts creates a real postgres
    // client on import regardless of USE_IN_MEMORY_DB, and those open TCP
    // sockets keep the Node.js event loop alive.
    try {
      await closeConnection();
    } catch {
      // Ignore DB shutdown errors in route-level unit tests.
    }
  });

  function getFinalHandler(method: string, path: string) {
    const handlers = findRouteStack((app as any)._router, method, path);
    return handlers.at(-1)!;
  }

  it("PATCH /api/notifications/:id/read scopes update to current user", async () => {
    let capturedArgs: unknown[] | null = null;
    mock.method(storage, "markNotificationAsRead", async (...args: unknown[]) => {
      capturedArgs = args;
    });

    const handler = getFinalHandler("patch", "/api/notifications/:id/read");
    const req: any = createMockReq({
      method: "PATCH",
      path: "/api/notifications/42/read",
      user: { id: 7, role: "customer" },
    });
    req.validatedParams = { id: 42 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, { success: true });
    assert.deepStrictEqual(capturedArgs, [42, 7]);
  });

  it("PATCH /api/notifications/:id/read returns 404 when ownership check fails", async () => {
    mock.method(storage, "markNotificationAsRead", async () => {
      throw new Error("Notification not found");
    });

    const handler = getFinalHandler("patch", "/api/notifications/:id/read");
    const req: any = createMockReq({
      method: "PATCH",
      path: "/api/notifications/42/read",
      user: { id: 8, role: "customer" },
    });
    req.validatedParams = { id: 42 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.body, { message: "Notification not found" });
  });

  it("DELETE /api/notifications/:id returns 404 for non-owned notification", async () => {
    mock.method(storage, "deleteNotification", async () => {
      throw new Error("Notification not found");
    });

    const handler = getFinalHandler("delete", "/api/notifications/:id");
    const req: any = createMockReq({
      method: "DELETE",
      path: "/api/notifications/10",
      user: { id: 8, role: "customer" },
    });
    req.validatedParams = { id: 10 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.body, { message: "Notification not found" });
  });

  it("DELETE /api/fcm/unregister passes user scope to token deletion", async () => {
    let capturedArgs: unknown[] | null = null;
    mock.method(storage, "deleteFcmToken", async (...args: unknown[]) => {
      capturedArgs = args;
    });

    const handler = getFinalHandler("delete", "/api/fcm/unregister");
    const req: any = createMockReq({
      method: "DELETE",
      path: "/api/fcm/unregister",
      user: { id: 99, role: "customer" },
      body: { token: "some-long-fcm-token-123" },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, { success: true });
    assert.deepStrictEqual(capturedArgs, ["some-long-fcm-token-123", 99]);
  });

  it("PATCH /api/users/:id blocks non-numeric requester IDs", async () => {
    const handler = getFinalHandler("patch", "/api/users/:id");
    const req: any = createMockReq({
      method: "PATCH",
      path: "/api/users/3",
      user: { id: "not-a-number", role: "customer" },
      body: { name: "Blocked" },
    });
    req.validatedParams = { id: 3 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, { message: "Can only update own profile" });
  });

  it("PATCH /api/users/:id rejects forbidden profile fields like role", async () => {
    const handler = getFinalHandler("patch", "/api/users/:id");
    const req: any = createMockReq({
      method: "PATCH",
      path: "/api/users/3",
      user: { id: 3, role: "customer" },
      body: { role: "admin" },
    });
    req.validatedParams = { id: 3 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 400);
  });

  it("PATCH /api/users/:id accepts customer payload with +91 phone and blank optional fields", async () => {
    let capturedUpdate: Partial<Record<string, unknown>> | null = null;
    mock.method(storage, "updateUser", async (_id: number, patch: Record<string, unknown>) => {
      capturedUpdate = patch;
      return {
        id: 3,
        role: "customer",
        name: String(patch.name ?? "Updated User"),
        phone: String(patch.phone ?? "9876543210"),
        email: patch.email ?? null,
        upiId: patch.upiId ?? null,
        createdAt: new Date(),
      } as any;
    });

    const handler = getFinalHandler("patch", "/api/users/:id");
    const req: any = createMockReq({
      method: "PATCH",
      path: "/api/users/3",
      user: { id: 3, role: "customer" },
      body: {
        name: "Updated User",
        phone: "+91 98765 43210",
        email: "",
        upiId: "",
        addressStreet: "Main Street",
      },
    });
    req.validatedParams = { id: 3 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(capturedUpdate?.phone, "9876543210");
    assert.strictEqual(capturedUpdate?.email, null);
    assert.strictEqual(capturedUpdate?.upiId, null);
  });

  it("PATCH /api/users/:id accepts provider profile payload", async () => {
    mock.method(storage, "updateUser", async (_id: number, patch: Record<string, unknown>) => ({
      id: 3,
      role: "provider",
      name: patch.name,
      phone: patch.phone,
      email: patch.email,
      bio: patch.bio,
      qualifications: patch.qualifications,
      experience: patch.experience,
      workingHours: patch.workingHours,
      languages: patch.languages,
      createdAt: new Date(),
    }) as any);

    const handler = getFinalHandler("patch", "/api/users/:id");
    const req: any = createMockReq({
      method: "PATCH",
      path: "/api/users/3",
      user: { id: 3, role: "provider" },
      body: {
        name: "Provider Updated",
        phone: "9876543210",
        email: "provider@example.com",
        bio: "Experienced electrician in local area",
        qualifications: "ITI",
        experience: "8 years",
        workingHours: "9am-6pm",
        languages: "ta,en",
      },
    });
    req.validatedParams = { id: 3 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
  });

  it("PATCH /api/users/:id accepts partial shopProfile updates", async () => {
    let capturedUpdate: Record<string, unknown> | null = null;
    mock.method(storage, "updateUser", async (_id: number, patch: Record<string, unknown>) => {
      capturedUpdate = patch;
      return {
        id: 3,
        role: "shop",
        name: patch.name,
        phone: patch.phone,
        email: patch.email,
        shopProfile: patch.shopProfile,
        createdAt: new Date(),
      } as any;
    });

    const handler = getFinalHandler("patch", "/api/users/:id");
    const req: any = createMockReq({
      method: "PATCH",
      path: "/api/users/3",
      user: { id: 3, role: "shop" },
      body: {
        name: "Shop Owner",
        phone: "9876543210",
        email: "shop@example.com",
        shopProfile: {
          shopName: "New Shop Name",
        },
      },
    });
    req.validatedParams = { id: 3 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(capturedUpdate?.shopProfile, { shopName: "New Shop Name" });
  });

  it("GET /api/users/:id redacts payLaterWhitelist for non-owner viewers", async () => {
    const shopUser = {
      id: 10,
      role: "shop",
      name: "Demo Shop",
      phone: "9876543210",
      email: "shop@example.com",
      isSuspended: false,
      verificationStatus: "verified",
      createdAt: new Date(),
      shopProfile: {
        shopName: "Demo Shop",
        description: "",
        businessType: "",
        allowPayLater: true,
        catalogModeEnabled: true,
        openOrderMode: true,
        payLaterWhitelist: [2, 3, 4],
      },
    };

    mock.method(storage, "getUser", async () => shopUser as any);
    mock.method(storage, "getOrdersByShop", async () => []);

    const handler = getFinalHandler("get", "/api/users/:id");
    const req: any = createMockReq({
      method: "GET",
      path: "/api/users/10",
      user: { id: 99, role: "customer" },
      session: {},
    });
    req.validatedParams = { id: 10 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body?.shopProfile);
    assert.strictEqual("payLaterWhitelist" in res.body.shopProfile, false);
  });

  it("GET /api/users/:id keeps payLaterWhitelist for owner/admin viewers", async () => {
    const shopUser = {
      id: 10,
      role: "shop",
      name: "Owner View",
      phone: "9000000000",
      email: "owner@example.com",
      isSuspended: false,
      verificationStatus: "verified",
      createdAt: new Date(),
      shopProfile: {
        shopName: "Owner Shop",
        description: "",
        businessType: "",
        allowPayLater: true,
        catalogModeEnabled: true,
        openOrderMode: true,
        payLaterWhitelist: [10, 11],
      },
    };

    mock.method(storage, "getUser", async () => shopUser as any);
    mock.method(storage, "getOrdersByShop", async () => []);

    const handler = getFinalHandler("get", "/api/users/:id");
    const req: any = createMockReq({
      method: "GET",
      path: "/api/users/10",
      user: { id: 10, role: "shop" },
      session: {},
    });
    req.validatedParams = { id: 10 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body?.shopProfile?.payLaterWhitelist, [10, 11]);
  });

  it("POST /api/reviews fails when booking service does not match provided service", async () => {
    mock.method(storage, "getBooking", async () => ({
      id: 77,
      customerId: 5,
      serviceId: 999,
    }) as any);

    const handler = getFinalHandler("post", "/api/reviews");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/reviews",
      user: { id: 5, role: "customer" },
      body: {
        serviceId: 1000,
        bookingId: 77,
        rating: 5,
        review: "Great",
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.body, {
      message: "Booking does not match the provided service.",
    });
  });

  it("POST /api/product-reviews fails when product is not part of the order", async () => {
    mock.method(storage, "getOrder", async () => ({
      id: 41,
      customerId: 6,
      shopId: 12,
    }) as any);
    mock.method(storage, "getOrderItemsByOrder", async () => [
      { productId: 222 },
    ] as any);

    const handler = getFinalHandler("post", "/api/product-reviews");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/product-reviews",
      user: { id: 6, role: "customer" },
      body: {
        orderId: 41,
        productId: 111,
        rating: 4,
        review: "Nice",
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, {
      message: "Cannot review a product that is not in this order",
    });
  });

  it("POST /api/bookings/:id/confirm blocks provider who does not own the service", async () => {
    mock.method(storage, "getBooking", async () => ({
      id: 18,
      serviceId: 444,
      customerId: 31,
      bookingDate: new Date(),
    }) as any);
    mock.method(storage, "getService", async () => ({
      id: 444,
      providerId: 900,
    }) as any);

    const handler = getFinalHandler("post", "/api/bookings/:id/confirm");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/bookings/18/confirm",
      user: { id: 7, role: "provider" },
    });
    req.validatedParams = { id: 18 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, {
      message: "Not authorized to confirm this booking",
    });
  });

  it("GET /api/orders/:id denies worker without orders:read responsibility", async () => {
    mock.method(storage, "getOrder", async () => ({
      id: 61,
      customerId: 1,
      shopId: 5,
    }) as any);
    mock.method(db.primary, "select", () =>
      createSelectChain([
        { shopId: 5, active: true, responsibilities: ["products:read"] },
      ]));

    const handler = getFinalHandler("get", "/api/orders/:id");
    const req: any = createMockReq({
      method: "GET",
      path: "/api/orders/61",
      user: { id: 22, role: "worker" },
    });
    req.validatedParams = { id: 61 };
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, { message: "Not authorized" });
  });

  it("POST /api/orders rejects subtotal mismatch using canonical product pricing", async () => {
    mock.method(storage, "getProductsByIds", async () => [
      {
        id: 501,
        shopId: 77,
        name: "Canonical Item",
        price: "100.00",
        stock: 100,
      },
    ] as any);
    mock.method(storage, "getUser", async (id: number) => {
      if (id !== 77) return undefined;
      return {
        id: 77,
        role: "shop",
        shopProfile: {
          allowPayLater: false,
          catalogModeEnabled: false,
          openOrderMode: false,
        },
      } as any;
    });

    const handler = getFinalHandler("post", "/api/orders");
    const req: any = createMockReq({
      method: "POST",
      path: "/api/orders",
      user: {
        id: 5,
        role: "customer",
        verificationStatus: "verified",
      },
      body: {
        items: [{ productId: 501, quantity: 2 }],
        total: "200.00",
        subtotal: "150.00",
        deliveryMethod: "pickup",
        paymentMethod: "upi",
      },
    });
    const res: any = createMockRes();

    await handler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(
      res.body?.message,
      "Cart subtotal mismatch. Please refresh and try again.",
    );
    assert.strictEqual(res.body?.expectedSubtotal, "200.00");
  });
});
