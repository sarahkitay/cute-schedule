import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  objectiveMonthKey,
  priorObjectiveMonthKey,
  getPendingCarryObjectives,
  getVisibleMonthObjectives,
  carryMonthlyObjective,
  leaveMonthlyObjectiveInPriorMonth,
  completeMonthlyObjectiveUnmarked,
  filterMonthlyForCoach,
} from "./monthlyObjectivesModel.js";

describe("monthlyObjectivesModel", () => {
  it("priorObjectiveMonthKey rolls back one month", () => {
    assert.equal(priorObjectiveMonthKey("2026-05"), "2026-04");
    assert.equal(priorObjectiveMonthKey("2026-01"), "2025-12");
  });

  it("pending carry is prior month incomplete without carryResolved", () => {
    const monthly = [
      { id: "a", text: "Blog", done: false, monthKey: "2026-04" },
      { id: "b", text: "Taxes", done: true, monthKey: "2026-04" },
      { id: "c", text: "Gym", done: false, monthKey: "2026-05" },
    ];
    assert.equal(getPendingCarryObjectives(monthly, "2026-05").length, 1);
    assert.equal(getPendingCarryObjectives(monthly, "2026-05")[0].id, "a");
  });

  it("carry adds current-month row and resolves source", () => {
    const monthly = [{ id: "a", text: "Blog", done: false, monthKey: "2026-04" }];
    const next = carryMonthlyObjective(monthly, "a", "2026-05", "new-a");
    assert.equal(next.length, 2);
    assert.equal(next[0].carryOutcome, "carried");
    assert.equal(next[1].monthKey, "2026-05");
    assert.equal(next[1].carriedFromId, "a");
    assert.equal(getPendingCarryObjectives(next, "2026-05").length, 0);
    assert.equal(getVisibleMonthObjectives(next, "2026-05").length, 1);
  });

  it("leave and complete unmarked resolve without adding row", () => {
    const monthly = [{ id: "a", text: "Blog", done: false, monthKey: "2026-04" }];
    const left = leaveMonthlyObjectiveInPriorMonth(monthly, "a");
    assert.equal(getPendingCarryObjectives(left, "2026-05").length, 0);
    assert.equal(getVisibleMonthObjectives(left, "2026-05").length, 0);

    const done = completeMonthlyObjectiveUnmarked(monthly, "a");
    assert.equal(done[0].done, true);
    assert.equal(done[0].carryOutcome, "completed_unmarked");
  });

  it("filterMonthlyForCoach uses real today month", () => {
    const monthly = [
      { id: "a", text: "Old", done: false, monthKey: "2026-04" },
      { id: "b", text: "Now", done: false, monthKey: "2026-05" },
    ];
    const active = filterMonthlyForCoach(monthly, "2026-05-12");
    assert.deepEqual(active.map((m) => m.id), ["b"]);
  });
});
