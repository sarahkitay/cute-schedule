import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeTaskReminderFields,
  buildTaskPushReminderEntriesForTask,
} from "./taskReminderModel.js";

describe("task reminders", () => {
  it("defaults reminders off and ignores invalid lead times", () => {
    assert.deepEqual(normalizeTaskReminderFields(null), {
      remindersEnabled: false,
      remindAtStart: false,
      remindBeforeMinutes: null,
    });
    assert.equal(normalizeTaskReminderFields({ remindersEnabled: true, remindBeforeMinutes: -5 }).remindBeforeMinutes, null);
    assert.equal(normalizeTaskReminderFields({ remindersEnabled: true, remindBeforeMinutes: 15 }).remindBeforeMinutes, 15);
  });

  it("builds start and lead-time push rows inside the delivery window", () => {
    const nowMs = Date.parse("2026-08-18T08:00:00");
    const rows = buildTaskPushReminderEntriesForTask({
      task: {
        id: "t1",
        text: "Take meds",
        taskNote: "With food",
        remindersEnabled: true,
        remindAtStart: true,
        remindBeforeMinutes: 10,
      },
      dayKey: "2026-08-18",
      hourKey: "09:00",
      nowMs,
      maxAtMs: nowMs + 24 * 60 * 60 * 1000,
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].title, "PROYOU");
    assert.equal(rows[0].kind, "before");
    assert.match(rows[0].body, /10 minutes/);
    assert.equal(rows[1].kind, "start");
    assert.match(rows[1].body, /Take meds/);
  });

  it("returns nothing when reminders are disabled or the start is in the past", () => {
    const nowMs = Date.parse("2026-08-18T10:00:00");
    assert.deepEqual(
      buildTaskPushReminderEntriesForTask({
        task: { id: "t1", text: "Late", remindersEnabled: false, remindAtStart: true },
        dayKey: "2026-08-18",
        hourKey: "09:00",
        nowMs,
        maxAtMs: nowMs + 86_400_000,
      }),
      [],
    );
    assert.deepEqual(
      buildTaskPushReminderEntriesForTask({
        task: { id: "t1", text: "Late", remindersEnabled: true, remindAtStart: true },
        dayKey: "2026-08-18",
        hourKey: "09:00",
        nowMs,
        maxAtMs: nowMs + 86_400_000,
      }),
      [],
    );
  });
});
