import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDropdownPosition } from "./dropdownPosition.js";

describe("computeDropdownPosition", () => {
  it("keeps the panel inside the viewport when the trigger is near the top", () => {
    const pos = computeDropdownPosition(
      { left: 280, right: 320, top: 24, bottom: 52, width: 40, height: 28 },
      { panelWidth: 300, maxHeight: 520 },
    );
    assert.equal(pos.placement, "below");
    assert.ok(pos.top >= 12);
    assert.ok(pos.top + pos.maxHeight <= 700 - 8);
    assert.ok(pos.left >= 12);
    assert.ok(pos.left + pos.width <= 400);
  });

  it("flips above when there is more room over the trigger", () => {
    const pos = computeDropdownPosition(
      { left: 280, right: 320, top: 620, bottom: 650, width: 40, height: 30 },
      { panelWidth: 260, maxHeight: 440 },
    );
    assert.equal(pos.placement, "above");
    assert.ok(pos.top >= 12);
    assert.ok(pos.top + pos.maxHeight <= 650);
  });

  it("never uses an off-screen bottom coordinate", () => {
    const pos = computeDropdownPosition(
      { left: 20, right: 52, top: 8, bottom: 36, width: 32, height: 28 },
      { panelWidth: 300, maxHeight: 520 },
    );
    assert.equal(pos.placement, "below");
    assert.ok(pos.top >= 12);
    assert.ok(pos.maxHeight >= 120);
    assert.ok(pos.top + pos.maxHeight <= 700);
  });
});
