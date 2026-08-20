import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditCoachSpecificity, applyCoachSpecificityToResult } from "./specificity.ts";

describe("coach specificity", () => {
  it("flags generic productivity lines that are not anchored to the user", () => {
    const audit = auditCoachSpecificity("Stay consistent and prioritize your tasks.", {
      today: { schedulePacingNote: "Still morning; on pace.", isOnPace: true },
      recommendationSeeds: [],
      monthlyObjectives: { active: [], neglected: [] },
    });
    assert.equal(audit.ok, false);
    assert.ok(audit.violations.includes("stay_consistent"));
    assert.match(audit.revisedMessage, /Still morning/);
  });

  it("leaves anchored messages alone", () => {
    const audit = auditCoachSpecificity("Stay consistent on the RHEA draft this morning.", {
      recommendationSeeds: ["RHEA draft"],
      today: { dominantTaskTypes: ["School"] },
      monthlyObjectives: { active: [{ title: "RHEA" }], neglected: [] },
    });
    assert.equal(audit.ok, true);
  });

  it("rewrites the result message when the audit fails", () => {
    const result = applyCoachSpecificityToResult(
      { message: "You have a lot on your plate.", insight: null, highlights: [], followUp: null, suggestions: [], ignoredMonthlies: [], percentSummary: "" },
      { today: { schedulePacingNote: "On pace until 3pm.", isOnPace: true }, recommendationSeeds: [], monthlyObjectives: { active: [], neglected: [] } },
    );
    assert.match(result.message, /On pace until 3pm/);
  });
});
