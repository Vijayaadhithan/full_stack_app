import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCoordinate,
  toNumericCoordinate,
  haversineDistanceKm,
  MIN_NEARBY_RADIUS_KM,
  MAX_NEARBY_RADIUS_KM,
} from "../server/utils/geo";

describe("geo utilities", () => {
  it("normalizes numeric and string coordinates", () => {
    assert.equal(normalizeCoordinate(12.3456789), "12.3456789");
    assert.equal(normalizeCoordinate(" 77.5 "), "77.5000000");
    assert.equal(normalizeCoordinate("not-a-number"), null);
    assert.equal(normalizeCoordinate(undefined), null);
  });

  it("converts to numeric coordinates with bounds checks", () => {
    assert.equal(toNumericCoordinate("42.5"), 42.5);
    assert.equal(toNumericCoordinate(null), null);
    assert.equal(toNumericCoordinate("abc"), null);
    assert.ok(MIN_NEARBY_RADIUS_KM < MAX_NEARBY_RADIUS_KM);
  });

  it("computes haversine distances in kilometers", () => {
    const distance = haversineDistanceKm(12.9716, 77.5946, 28.7041, 77.1025);
    assert.ok(distance > 1700 && distance < 1800);
  });
});
