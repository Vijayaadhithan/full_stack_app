import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cn } from "../client/src/lib/utils";

describe("cn utility", () => {
  it("merges conditional classes", () => {
    assert.equal(
      cn("base", ["btn", undefined], { active: true, disabled: false }),
      "base btn active",
    );
  });

  it("returns an empty string with no inputs", () => {
    assert.equal(cn(), "");
  });
});
