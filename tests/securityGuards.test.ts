import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import type { SuperAgentTest } from "supertest";
import type { MemStorage } from "../server/storage";
import type { InsertOrder } from "@shared/schema";
import { randomUUID } from "node:crypto";

process.env.USE_IN_MEMORY_DB = "true";
process.env.SESSION_SECRET ??= "TestSessionSecret1234567890Strong!";
process.env.DATABASE_URL ??= "postgres://localhost/test";
const ORIGINAL_NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.NODE_ENV = "test";

const { storage } = await import("../server/storage");
const { hashPasswordInternal } = await import("../server/auth");
const { registerRoutes } = await import("../server/routes");
const adminRoutes = (await import("../server/routes/admin")).default;
const { db } = await import("../server/db");

function attachCsrfErrorHandler(app: Express) {
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "EBADCSRFTOKEN"
    ) {
      return res
        .status(403)
        .json({ message: "Invalid or missing CSRF token" });
    }
    return next(err);
  });
}

async function createApp(nodeEnvOverride?: string) {
  const previousEnv = process.env.NODE_ENV;
  if (nodeEnvOverride) {
    process.env.NODE_ENV = nodeEnvOverride;
  }
  const newApp = express();
  newApp.use(express.json());
  await registerRoutes(newApp);
  newApp.use("/api/admin", adminRoutes);
  attachCsrfErrorHandler(newApp);
  if (nodeEnvOverride) {
    process.env.NODE_ENV = previousEnv;
  }
  return newApp;
}

const app = await createApp();
const memStorage = storage as MemStorage;

function uniqueUsername(seed: string) {
  return `${seed}-${randomUUID().slice(0, 6)}`;
}

const passwords = {
  customer: "Cust0mer!Pass",
  shopA: "ShopAlpha!23",
  shopB: "ShopBeta!23",
  worker: "WorkerRead!1",
  customerB: "CustBravo!45",
};

const hashedPasswords = {
  customer: await hashPasswordInternal(passwords.customer),
  shopA: await hashPasswordInternal(passwords.shopA),
  shopB: await hashPasswordInternal(passwords.shopB),
  worker: await hashPasswordInternal(passwords.worker),
  customerB: await hashPasswordInternal(passwords.customerB),
};

const customer = await memStorage.createUser({
  username: uniqueUsername("customer-a"),
  password: hashedPasswords.customer,
  role: "customer",
  name: "Customer Alpha",
  phone: "9100000000",
  email: "customer-alpha@example.com",
});
await memStorage.updateUser(customer.id, { verificationStatus: "verified" });

const shopA = await memStorage.createUser({
  username: uniqueUsername("shop-a"),
  password: hashedPasswords.shopA,
  role: "shop",
  name: "Shop Alpha",
  phone: "9200000000",
  email: "shop-alpha@example.com",
});
await memStorage.updateUser(shopA.id, { verificationStatus: "verified" });

const shopB = await memStorage.createUser({
  username: uniqueUsername("shop-b"),
  password: hashedPasswords.shopB,
  role: "shop",
  name: "Shop Beta",
  phone: "9300000000",
  email: "shop-beta@example.com",
});
await memStorage.updateUser(shopB.id, { verificationStatus: "verified" });

const workerUser = await memStorage.createUser({
  username: uniqueUsername("worker-a"),
  password: hashedPasswords.worker,
  role: "worker",
  name: "Worker Ava",
  phone: "9400000000",
  email: "worker-ava@example.com",
});

const customerB = await memStorage.createUser({
  username: uniqueUsername("customer-b"),
  password: hashedPasswords.customerB,
  role: "customer",
  name: "Customer Bravo",
  phone: "9500000000",
  email: "customer-bravo@example.com",
});
await memStorage.updateUser(customerB.id, {
  verificationStatus: "verified",
  googleId: "google-bravo-123",
  phone: "9511111111",
});

const productA = await memStorage.createProduct({
  name: "Shop A Exclusive",
  description: "Hand-crafted item from shop A",
  price: "2500",
  stock: 5,
  category: "accessories",
  shopId: shopA.id,
  isAvailable: true,
  images: [],
});

const productB = await memStorage.createProduct({
  name: "Shop B Sneaker",
  description: "Limited run sneaker",
  price: "3200",
  stock: 8,
  category: "footwear",
  shopId: shopB.id,
  isAvailable: true,
  images: [],
});

async function seedOrder(shopId: number, productId: number, buyerId: number) {
  const product = await memStorage.getProduct(productId);
  if (!product) {
    throw new Error("Product not found while seeding orders");
  }
  const order = await memStorage.createOrder({
    customerId: buyerId,
    shopId,
    status: "pending",
    paymentStatus: "pending",
    total: product.price,
    shippingAddress: "123 Market Street",
    deliveryMethod: "delivery",
    paymentMethod: "cash",
  } as InsertOrder);
  await memStorage.createOrderItem({
    orderId: order.id,
    productId: product.id,
    quantity: 1,
    price: product.price,
    total: product.price,
  });
  return order;
}

await seedOrder(shopA.id, productA.id, customer.id);
const orderForShopB = await seedOrder(shopB.id, productB.id, customer.id);

async function fetchCsrfToken(agent: SuperAgentTest): Promise<string> {
  const res = await agent.get("/api/csrf-token");
  assert.equal(res.status, 200);
  assert.equal(typeof res.body?.csrfToken, "string");
  return res.body.csrfToken;
}

async function login(agent: SuperAgentTest, username: string, password: string) {
  const csrfToken = await fetchCsrfToken(agent);
  const res = await agent
    .post("/api/login")
    .set("x-csrf-token", csrfToken)
    .send({ username, password });
  assert.equal(res.status, 200);
}

const defaultProductPayload = {
  name: "Seasonal Pick",
  description: "New seasonal item",
  price: "1999",
  stock: 3,
  category: "general",
  isAvailable: true,
  images: [] as string[],
};

const promotionPayload = {
  name: "Flash Sale",
  description: "Limited discount",
  type: "percentage",
  value: 10,
  shopId: shopA.id,
  expiryDays: 5,
  isActive: true,
};

describe(
  "Security and permission enforcement",
  { concurrency: false },
  () => {
    describe("Role-based isolation", () => {
      it("blocks customers from admin or shop-only surfaces", async () => {
        const agent = request.agent(app);
        await login(agent, customer.username, passwords.customer);

        const adminRes = await agent.get("/api/admin/health-status");
        assert.ok(
          adminRes.status === 401 || adminRes.status === 403,
          `Expected 401/403 for admin route, received ${adminRes.status}`,
        );
        if (adminRes.body?.message) {
          assert.match(
            String(adminRes.body.message),
            /unauthorized|forbidden/i,
          );
        }

        const productRes = await agent.post("/api/products").send({
          ...defaultProductPayload,
          shopId: shopA.id,
        });
        assert.equal(productRes.status, 403);
        assert.match(String(productRes.text || ""), /Forbidden/i);
      });
    });

    describe("Ownership boundaries", () => {
      it("prevents shops from modifying or viewing other shops' data", async () => {
        const agent = request.agent(app);
        await login(agent, shopA.username, passwords.shopA);

        const patchRes = await agent
          .patch(`/api/products/${productB.id}`)
          .send({ name: "Hacked Name" });
        assert.equal(patchRes.status, 403);
        assert.match(
          String(patchRes.body?.message ?? ""),
          /not authorized/i,
        );

        const listRes = await agent.get("/api/orders/shop");
        assert.equal(listRes.status, 200);
        assert.ok(Array.isArray(listRes.body));
        assert.ok(
          listRes.body.every(
            (order: Record<string, unknown>) => order.shopId === shopA.id,
          ),
          "Received an order that does not belong to shop A",
        );
        assert.ok(
          !listRes.body.some(
            (order: Record<string, unknown>) => order.id === orderForShopB.id,
          ),
          "Shop A was able to view Shop B's order in the collection response",
        );

        const detailRes = await agent.get(`/api/orders/${orderForShopB.id}`);
        assert.ok(
          detailRes.status === 403 || detailRes.status === 404,
          `Expected 403/404 for cross-shop order access, got ${detailRes.status}`,
        );
        if (detailRes.body?.message) {
          assert.match(String(detailRes.body.message), /not authorized/i);
        }
      });
    });

    describe("Worker permission checks", () => {
      it("only allows responsibilities that are explicitly granted", async () => {
        const agent = request.agent(app);
        await login(agent, workerUser.username, passwords.worker);

        mock.method(db, "select", () => ({
          from: () => ({
            where: async () => [
              {
                responsibilities: ["orders:read"],
                active: true,
                shopId: shopA.id,
              },
            ],
          }),
        }));

        try {
          const ordersRes = await agent.get("/api/orders/shop");
          assert.equal(ordersRes.status, 200);
          assert.ok(Array.isArray(ordersRes.body));

          const productPatch = await agent
            .patch(`/api/products/${productA.id}`)
            .send({ name: "Worker Update" });
          assert.equal(productPatch.status, 403);
          assert.match(
            String(productPatch.body?.message ?? ""),
            /permission/i,
          );

          const promoRes = await agent.post("/api/promotions").send({
            ...promotionPayload,
            applicableProducts: [productA.id],
          });
          assert.equal(promoRes.status, 403);
          assert.match(
            String(promoRes.body?.message ?? ""),
            /permission/i,
          );
        } finally {
          mock.restoreAll();
        }
      });
    });

    describe("Input validation & injection defenses", () => {
      it("rejects malformed booking payloads", async () => {
        const agent = request.agent(app);
        await login(agent, customer.username, passwords.customer);

        const bookingRes = await agent.post("/api/bookings").send({
          serviceId: "abc",
          bookingDate: "not-a-date",
          serviceLocation: "customer",
        });
        assert.equal(bookingRes.status, 400);
        assert.equal(bookingRes.body?.message, "Invalid input");
        assert.ok(bookingRes.body?.errors?.serviceId);
        assert.ok(bookingRes.body?.errors?.bookingDate);
      });

      it("describes password violations during registration", async () => {
        const registerAgent = request.agent(app);
        const csrfToken = await fetchCsrfToken(registerAgent);
        const registerRes = await registerAgent.post("/api/register").set("x-csrf-token", csrfToken).send({
          username: uniqueUsername("short-pass"),
          password: "1234",
          role: "customer",
          name: "Short Password",
          phone: "9600000000",
          email: `short-pass-${Date.now()}@example.com`,
        });
        assert.equal(registerRes.status, 400);
        assert.equal(registerRes.body?.message, "Invalid input");
        const issues = registerRes.body?.errors;
        assert.ok(Array.isArray(issues));
        assert.ok(
          issues.some(
            (issue: Record<string, unknown>) =>
              Array.isArray(issue?.path) &&
              issue.path.includes("password") &&
              typeof issue.message === "string" &&
              /password/i.test(issue.message),
          ),
          "Expected password validation message",
        );
      });
    });

    describe("Sensitive data exposure", () => {
      it("only returns public fields for other users", async () => {
        const agent = request.agent(app);
        await login(agent, customer.username, passwords.customer);

        const res = await agent.get(`/api/users/${customerB.id}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.id, customerB.id);
        assert.equal(res.body.role, "customer");
        assert.ok(!("email" in res.body));
        assert.ok(!("phone" in res.body));
        assert.ok(!("googleId" in res.body));
        assert.ok(!("password" in res.body));
      });
    });

    describe("CSRF protection", () => {
      it("rejects state-changing requests without a token", async () => {
        const csrfApp = await createApp("integration-test");
        const agent = request.agent(csrfApp);
        await login(agent, shopA.username, passwords.shopA);

        const res = await agent.post("/api/products").send({
          ...defaultProductPayload,
          shopId: shopA.id,
        });
        assert.equal(res.status, 403);
        assert.match(
          String(res.body?.message ?? ""),
          /csrf/i,
        );
      });
    });
  },
);

process.env.NODE_ENV = ORIGINAL_NODE_ENV;
