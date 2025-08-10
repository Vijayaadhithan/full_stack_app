import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { format } from "date-fns";
import {
  toIndianTime,
  formatInIndianTime,
  newIndianDate,
  toIndianISOString,
  formatIndianDisplay,
} from "../shared/date-utils";

describe("date-utils", () => {
  it("converts UTC to IST correctly", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    const ist = toIndianTime(date);
    const formatted = format(ist, "HH:mm");
    assert.strictEqual(formatted, "05:30");
  });

  it("formats in Indian time", () => {
    const date = "2024-01-01T00:00:00Z";
    const formatted = formatInIndianTime(date, "yyyy-MM-dd HH:mm");
    assert.strictEqual(formatted, "2024-01-01 05:30");
  });

  it("newIndianDate returns a date object", () => {
    const now = newIndianDate();
    assert.ok(now instanceof Date);
  });

  it("converts to ISO string with IST offset", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    const iso = toIndianISOString(date);
    assert.ok(iso.endsWith("+05:30"));
  });

  it("formats indian display", () => {
    const out = formatIndianDisplay("2024-01-01T00:00:00Z", "date");
    assert.ok(out.includes("2024"));
  });
});
