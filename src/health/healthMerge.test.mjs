import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeHealthPreferRicher, normalizeHealth } from "./healthModel.js";
import { mergeHabitTrackers } from "../habitModel.js";

describe("mergeHealthPreferRicher", () => {
  it("keeps local programs when cloud health is empty", () => {
    const local = normalizeHealth({
      programs: [{ id: "p1", name: "Push", exercises: [{ name: "Bench", setsReps: "3x8" }] }],
    });
    const merged = mergeHealthPreferRicher(local, { programs: [] });
    assert.equal(merged.programs.length, 1);
    assert.equal(merged.programs[0].id, "p1");
    assert.equal(merged.programs[0].name, "Push");
  });

  it("unions programs from both sides", () => {
    const local = normalizeHealth({
      programs: [{ id: "p1", name: "Push", exercises: [{ name: "Bench", setsReps: "3x8" }] }],
    });
    const cloud = normalizeHealth({
      programs: [{ id: "p2", name: "Pull", exercises: [{ name: "Row", setsReps: "3x10" }] }],
    });
    const merged = mergeHealthPreferRicher(local, cloud);
    const ids = merged.programs.map((p) => p.id).sort();
    assert.deepEqual(ids, ["p1", "p2"]);
  });

  it("keeps the richer exercise list when ids match", () => {
    const local = normalizeHealth({
      programs: [
        {
          id: "p1",
          name: "Push",
          exercises: [
            { name: "Bench", setsReps: "3x8" },
            { name: "OHP", setsReps: "3x8" },
          ],
        },
      ],
    });
    const cloud = normalizeHealth({
      programs: [{ id: "p1", name: "Push", exercises: [{ name: "Bench", setsReps: "3x8" }] }],
    });
    const merged = mergeHealthPreferRicher(local, cloud);
    assert.equal(merged.programs.length, 1);
    assert.equal(merged.programs[0].exercises.length, 2);
  });
});

describe("mergeHabitTrackers", () => {
  it("does not drop local habits when cloud is empty", () => {
    const local = { habits: [{ id: "h1", label: "Water" }], log: { "2026-08-18": { h1: true } } };
    const merged = mergeHabitTrackers(local, { habits: [], log: {} });
    assert.equal(merged.habits.length, 1);
    assert.equal(merged.habits[0].label, "Water");
    assert.equal(merged.log["2026-08-18"].h1, true);
  });
});
