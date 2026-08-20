import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVoicePlanQuestion, isSpeechRecognitionSupported } from "./coachVoice.js";
import { inferCoachReasoningMode } from "./coach/coachMode.ts";

describe("buildVoicePlanQuestion", () => {
  it("returns empty for blank speech", () => {
    assert.equal(buildVoicePlanQuestion("  "), "");
  });

  it("wraps spoken chores so daily planning is inferred", () => {
    const q = buildVoicePlanQuestion("Gym at 5, groceries, call Mom, and finish homework");
    assert.match(q, /Gym at 5/);
    assert.match(q, /on my schedule for today/);
    assert.equal(inferCoachReasoningMode(q), "daily_planning");
  });

  it("reports no speech API in Node", () => {
    assert.equal(isSpeechRecognitionSupported(), false);
  });
});
