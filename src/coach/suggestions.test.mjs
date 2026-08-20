import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAffirmationToCoach,
  normalizeRawSuggestion,
  parseCoachApiPayload,
} from "./suggestions.ts";

describe("coach suggestion parse", () => {
  it("recognizes short affirmations and rejects long free text", () => {
    assert.equal(isAffirmationToCoach("yes"), true);
    assert.equal(isAffirmationToCoach("add it"), true);
    assert.equal(isAffirmationToCoach("Can you also move my 3pm meeting?"), false);
  });

  it("normalizes ADD_TASK rows onto hour buckets", () => {
    const s = normalizeRawSuggestion(
      {
        type: "ADD_TASK",
        title: "Call dentist",
        start: "9:5",
        category: "Personal",
        energyLevel: "LIGHT",
        durationMinutes: 15,
      },
      ["Work", "Personal"],
      { "09:00": { Work: [] } },
    );
    assert.ok(s);
    assert.equal(s.type, "ADD_TASK");
    assert.equal(s.title, "Call dentist");
    assert.equal(s.start, "09:05");
    assert.equal(s.hour, "09:00");
    assert.equal(s.requiresApproval, true);
  });

  it("parses mixed V2 payloads without throwing", () => {
    const parsed = parseCoachApiPayload(
      {
        reply: "Start with the call.",
        question: "Want me to add it?",
        suggestions: [
          { type: "ADD_TASK", title: "Call dentist", start: "10:00", category: "Personal" },
          { type: "NOPE" },
        ],
      },
      ["Personal"],
      {},
    );
    assert.equal(parsed.message, "Start with the call.");
    assert.equal(parsed.followUp, "Want me to add it?");
    assert.equal(parsed.suggestions.length, 1);
    assert.equal(parsed.suggestions[0].title, "Call dentist");
  });
});
