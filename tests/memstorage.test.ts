import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "../server/storage";

describe("MemStorage basic operations", () => {
  const store = new MemStorage();

  it("creates and retrieves a user", async () => {
    const user = await store.createUser({
      username: "john",
      password: "secret",
      role: "customer",
      name: "John",
      phone: "123",
      email: "john@example.com",
    });
    const fetched = await store.getUser(user.id);
    assert.strictEqual(fetched?.username, "john");
  });

  it("handles cart items from one shop", async () => {
    const shop = await store.createUser({
      username: "shop1",
      password: "shop",
      role: "shop",
      name: "Shop",
      phone: "000",
      email: "shop@example.com",
    });
    const prod1 = await store.createProduct({
      name: "p1",
      description: "",
      price: "10",
      category: "c",
      shopId: shop.id,
      isAvailable: true,
      images: [],
      mrp: "10",
    });
    await store.addToCart(1, prod1.id, 1);
    const cart = await store.getCart(1);
    assert.strictEqual(cart.length, 1);
  });
});
