import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { updateProductSchema } from "../shared/updateProductSchema";

describe("updateProductSchema", () => {
  it("requires at least one field", () => {
    const result = updateProductSchema.safeParse({});
    assert.ok(!result.success);
  });

  it("validates numeric fields", () => {
    const result = updateProductSchema.safeParse({ price: -1 });
    assert.ok(!result.success);
  });

  it("accepts partial valid update", () => {
    const result = updateProductSchema.safeParse({ name: "Widget", price: 10 });
    assert.ok(result.success);
    if (result.success) {
      assert.equal(result.data.name, "Widget");
      assert.equal(result.data.price, 10);
    }
  });
});