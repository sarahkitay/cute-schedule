import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFlexibleDayKey } from "./scheduleDateInput.js";

describe("parseFlexibleDayKey", () => {
  const now = new Date("2026-08-18T12:00:00");

  it("accepts ISO, slashes, and month names", () => {
    assert.equal(parseFlexibleDayKey("2026-08-20", now), "2026-08-20");
    assert.equal(parseFlexibleDayKey("8/20/2026", now), "2026-08-20");
    assert.equal(parseFlexibleDayKey("8/20", now), "2026-08-20");
    assert.equal(parseFlexibleDayKey("Aug 20", now), "2026-08-20");
    assert.equal(parseFlexibleDayKey("August 20, 2026", now), "2026-08-20");
  });

  it("rejects impossible days", () => {
    assert.equal(parseFlexibleDayKey("2026-02-31", now), null);
    assert.equal(parseFlexibleDayKey("not a date", now), null);
  });
});
