import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { installMemoryLocalStorage } from "../../tests/helpers/memoryStorage.mjs";
import {
  defaultCoachLearning,
  loadCoachLearning,
  recordSuggestionAccepted,
  recordSuggestionDeclined,
  saveCoachLearning,
} from "./memory.ts";

describe("coach learning memory", () => {
  beforeEach(() => installMemoryLocalStorage());

  it("starts from a versioned empty state", () => {
    const state = loadCoachLearning();
    assert.equal(state.version, 1);
    assert.equal(state.straightAcceptCount, 0);
    assert.deepEqual(state.acceptedByType, {});
  });

  it("records accept and decline tallies", () => {
    const base = defaultCoachLearning();
    const accepted = recordSuggestionAccepted(base, {
      type: "ADD_TASK",
      category: "Work",
      energyLevel: "LIGHT",
      edited: false,
      titleLower: "call dentist",
    });
    const declined = recordSuggestionDeclined(accepted, {
      type: "BREAK",
      category: "Personal",
      energyLevel: "LIGHT",
      title: "Walk",
    });
    saveCoachLearning(declined);
    const loaded = loadCoachLearning();
    assert.equal(loaded.acceptedByType.ADD_TASK, 1);
    assert.equal(loaded.declinedByType.BREAK, 1);
    assert.equal(loaded.straightAcceptCount, 1);
  });
});
