import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canOfferPeriodTracker, defaultPeriodTrackerEnabled, normalizeIntakeGender, normalizeIntakeProfile } from "./intakeModel.js";
import {
  isMedicalAppointmentTask,
  isPeriodStartedPhrase,
  shouldShowPeriodFeatures,
  isPeriodTrackerEligible,
  logPeriodStartOnDay,
  isTaskHiddenFromSharedSchedule,
  appendLastPeriodToTaskNote,
} from "./modules/period.js";
import { normalizeHabitRow, isCustomHabitReminderMode } from "./habitModel.js";
import { searchTaskHistory } from "./taskHistorySearch.js";
import { ALARM_SOUND_IDS, normalizeAlarmSound, isBundledAlarmSound } from "./alarmSounds.js";
import {
  friendshipDocId,
  normalizeSocialPrivacy,
  filterSnapshotForFriend,
  generateReferralCode,
} from "./social/socialModel.js";

describe("intake + period privacy", () => {
  it("offers period tracker for female intake or logged period only when enabled", () => {
    assert.equal(canOfferPeriodTracker("male"), false);
    assert.equal(canOfferPeriodTracker("female"), true);
    assert.equal(defaultPeriodTrackerEnabled("female"), false);
    assert.equal(shouldShowPeriodFeatures({ intakeGender: "male" }, {}), false);
    assert.equal(shouldShowPeriodFeatures({ intakeGender: "female", periodTrackerEnabled: true }, {}), true);
    assert.equal(shouldShowPeriodFeatures({ intakeGender: "female" }, {}), false);
    assert.equal(
      shouldShowPeriodFeatures({ intakeGender: "male", periodTrackerEnabled: true }, { profile: { lastPeriodStart: "2026-08-01" }, log: {} }),
      true,
    );
    const restored = normalizeIntakeProfile({ intakeGender: "", periodTrackerEnabled: false });
    assert.equal(restored.periodTrackerEnabled, false);
  });

  it("detects period tracker eligibility from gender or logs", () => {
    assert.equal(isPeriodTrackerEligible({ intakeGender: "female" }, {}), true);
    assert.equal(isPeriodTrackerEligible({ intakeGender: "male" }, {}), false);
    assert.equal(
      isPeriodTrackerEligible({ intakeGender: "male" }, { profile: { lastPeriodStart: "2026-08-01" }, log: {} }),
      true,
    );
  });

  it("detects medical and period-started phrases", () => {
    assert.equal(isMedicalAppointmentTask("Gyno checkup"), true);
    assert.equal(isMedicalAppointmentTask("Buy groceries"), false);
    assert.equal(isPeriodStartedPhrase("period started"), true);
    assert.equal(isPeriodStartedPhrase("started my period"), true);
    assert.equal(isPeriodStartedPhrase("period cramps"), false);
  });

  it("keeps period tasks off shared schedules", () => {
    const state = logPeriodStartOnDay({ log: {} }, "2026-08-01");
    assert.equal(state.profile.lastPeriodStart, "2026-08-01");
    assert.equal(state.log["2026-08-01"].onPeriod, true);
    assert.equal(isTaskHiddenFromSharedSchedule({ hideWhenShared: true }), true);
    const note = appendLastPeriodToTaskNote("Bring insurance card", "2026-08-01");
    assert.match(note, /Last period started/);
  });

  it("normalizes intake gender and use cases", () => {
    assert.equal(normalizeIntakeGender("nope"), "");
    const p = normalizeIntakeProfile({ intakeGender: "male", onboardingUseCases: ["fitness", "hack"] });
    assert.equal(p.intakeGender, "male");
    assert.equal(p.periodTrackerEnabled, false);
    assert.deepEqual(p.onboardingUseCases, ["fitness"]);
  });
});

describe("habits, search, alarms, social", () => {
  it("normalizes habit reminder hours", () => {
    const row = normalizeHabitRow({
      id: 12,
      label: "  Water  ",
      direction: "break",
      reminderSchedule: "hours",
      reminderHours: ["9:00", "9:00", "21:30"],
    });
    assert.equal(row.id, "12");
    assert.equal(row.label, "Water");
    assert.equal(row.direction, "break");
    assert.deepEqual(row.reminderHours, ["09:00", "21:30"]);
    assert.equal(isCustomHabitReminderMode({ habitReminderMode: "custom" }), true);
  });

  it("aggregates task history by text", () => {
    const appState = {
      days: {
        "2026-08-01": {
          hours: { "09:00": { Work: [{ text: "Write recap", done: true, completedAt: "2026-08-01T10:00:00" }] } },
        },
        "2026-08-08": {
          hours: { "11:00": { Work: [{ text: "Write recap", done: false }] } },
        },
      },
    };
    const rows = searchTaskHistory(appState, "recap");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].occurrences, 2);
    assert.equal(rows[0].completed, 1);
    assert.equal(rows[0].lastScheduled, "2026-08-08");
    assert.equal(searchTaskHistory(appState, "x").length, 0);
  });

  it("maps bundled alarm sounds and rejects unknown ids", () => {
    assert.equal(normalizeAlarmSound(ALARM_SOUND_IDS.WAKE_UP_LEGEND), ALARM_SOUND_IDS.WAKE_UP_LEGEND);
    assert.equal(normalizeAlarmSound("custom"), ALARM_SOUND_IDS.DEFAULT);
    assert.equal(normalizeAlarmSound("not-a-sound"), ALARM_SOUND_IDS.DEFAULT);
    assert.equal(isBundledAlarmSound(ALARM_SOUND_IDS.EDGY_RINGTONE), true);
    assert.equal(isBundledAlarmSound(ALARM_SOUND_IDS.DEFAULT), false);
  });

  it("filters shared snapshots and keeps friendship ids stable", () => {
    assert.equal(friendshipDocId("b", "a"), "a_b");
    assert.match(generateReferralCode("abc123xyz"), /^PY/);
    const snap = {
      displayName: "Sam",
      scheduleToday: { tasks: 1 },
      fitness: { workouts: 2 },
      finance: { secret: true },
    };
    const filtered = filterSnapshotForFriend(snap, { scheduleToday: true, fitness: true, finance: false }, null);
    assert.equal(filtered.scheduleToday.tasks, 1);
    assert.equal(filtered.fitness.workouts, 2);
    assert.equal(filtered.finance, undefined);
    const privacy = normalizeSocialPrivacy({ allowFriendRequests: false });
    assert.equal(privacy.allowFriendRequests, false);
    assert.equal(privacy.sharePermissions.scheduleToday, false);
  });
});
