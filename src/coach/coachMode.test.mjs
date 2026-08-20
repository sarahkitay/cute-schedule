import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferCoachReasoningMode } from "./coachMode.ts";
import { normalizeTimeKey, addMinutes, taskCountInHour } from "./taskInsertion.ts";

describe("inferCoachReasoningMode", () => {
  it("defaults empty questions to general coaching", () => {
    assert.equal(inferCoachReasoningMode(""), "general_coaching");
    assert.equal(inferCoachReasoningMode(null), "general_coaching");
  });

  it("routes meal, health, and schedule questions", () => {
    assert.equal(inferCoachReasoningMode("Build me a weekly meal plan"), "meal_planning");
    assert.equal(inferCoachReasoningMode("What should my gym split be?"), "health_programming");
    assert.equal(inferCoachReasoningMode("Am I on track today?"), "schedule_check");
    assert.equal(inferCoachReasoningMode("Help me with my monthly objective"), "monthly_objective_alignment");
  });

  it("routes overwhelm and day-build cues", () => {
    assert.equal(inferCoachReasoningMode("I'm drowning and this is too much, I can't cope"), "overwhelm_prevention");
    assert.equal(
      inferCoachReasoningMode("Can you put all of this on my schedule today"),
      "daily_planning",
    );
  });
});

describe("taskInsertion", () => {
  it("normalizes clock keys and clamps ranges", () => {
    assert.equal(normalizeTimeKey("9:5"), "09:05");
    assert.equal(normalizeTimeKey("bad"), "09:00");
    assert.equal(addMinutes("09:50", 20), "10:10");
  });

  it("counts tasks in an hour slot", () => {
    const hours = { "09:00": { Work: [{ id: 1 }, { id: 2 }], Personal: [{ id: 3 }] } };
    assert.equal(taskCountInHour(hours, "09:00"), 3);
    assert.equal(taskCountInHour(hours, "10:00"), 0);
  });
});
