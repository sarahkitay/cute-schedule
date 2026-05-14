import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCoachLocalHHMM,
  nextQuarterHourStartAfterLocalNow,
  validateCoachSpecificity,
} from "./coachValidate.js";

function minutes(hhmm) {
  const [h, m] = normalizeCoachLocalHHMM(hhmm).split(":").map(Number);
  return h * 60 + m;
}

test("normalizeCoachLocalHHMM: empty and invalid fall back safely", () => {
  assert.equal(normalizeCoachLocalHHMM(""), "09:00");
  assert.equal(normalizeCoachLocalHHMM(null), "09:00");
  assert.equal(normalizeCoachLocalHHMM(undefined), "09:00");
  assert.equal(normalizeCoachLocalHHMM("25:00"), "09:00");
  assert.equal(normalizeCoachLocalHHMM("12-30"), "09:00");
  assert.equal(normalizeCoachLocalHHMM("9:05"), "09:05");
});

test("nextQuarterHourStartAfterLocalNow is strictly after local now", () => {
  const cases = [
    ["09:00", "09:15"],
    ["10:07", "10:15"],
    ["10:14", "10:15"],
    ["10:15", "10:30"],
    ["23:50", "23:59"],
    ["23:58", "23:59"],
  ];
  for (const [now, expect] of cases) {
    const got = nextQuarterHourStartAfterLocalNow(now);
    assert.ok(
      minutes(got) > minutes(normalizeCoachLocalHHMM(now)),
      `${got} should be after ${now}`
    );
    assert.equal(got, expect, `from ${now}`);
  }
});

test("validateCoachSpecificity does not mutate the original parsed object", () => {
  const original = {
    message: "Only one task has been completed, this suggests overwhelm.",
    insight: "You are behind.",
    highlights: ["Stay consistent"],
    followUp: "Ok?",
    suggestions: [],
    ignoredMonthlies: [],
    percentSummary: "10%",
  };
  const snapshot = JSON.stringify(original);
  validateCoachSpecificity(original, {
    coachContext: {
      today: { isOnPace: true, overdueTasks: 0, completedTasks: 1, schedulePacingNote: "Still morning; on pace." },
      timeOfDay: "morning",
      monthlyObjectives: { neglected: [{ title: "RHEA", suggestedNextAction: "Draft one RHEA slide" }] },
      health: {},
    },
    coachReasoningMode: "missing_from_schedule",
    localNowHHMM: "10:00",
    realTodayKey: "2026-05-09",
    categories: ["School", "Personal"],
    userQuestion: "What has my schedule been missing?",
  });
  assert.equal(JSON.stringify(original), snapshot);
});

const ADD_TASK_KEYS = [
  "type",
  "title",
  "description",
  "reason",
  "category",
  "energyLevel",
  "start",
  "end",
  "durationMinutes",
  "recurring",
  "recurrencePattern",
  "targetDayKey",
  "weekPlanLabel",
  "confidence",
  "requiresApproval",
  "targetTaskId",
];

test("10am on-pace + neglected RHEA: no shame language, full V2 shape, ADD_TASK fields", () => {
  const { parsed } = validateCoachSpecificity(
    {
      message: "Only one task completed suggests you are behind.",
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "",
    },
    {
      coachContext: {
        today: { isOnPace: true, overdueTasks: 0, completedTasks: 1, schedulePacingNote: "Still morning." },
        timeOfDay: "morning",
        yesterday: { summary: "Yesterday you closed several blocks." },
        monthlyObjectives: { neglected: [{ title: "RHEA launch", suggestedNextAction: "30m on RHEA outline" }] },
        health: {},
      },
      coachReasoningMode: "missing_from_schedule",
      localNowHHMM: "10:00",
      realTodayKey: "2026-05-09",
      categories: ["Work", "School"],
      userQuestion: "What has my schedule been missing the last few days?",
    }
  );
  assert.match(parsed.message, /RHEA|on pace|behind right now|not look behind/i);
  assert.doesNotMatch(parsed.message, /only one task.*completed.*overwhelm|this suggests overwhelm/i);
  assert.ok(Array.isArray(parsed.highlights));
  assert.ok("insight" in parsed && "followUp" in parsed);
  assert.ok(Array.isArray(parsed.ignoredMonthlies));
  assert.equal(typeof parsed.percentSummary, "string");
  const add = parsed.suggestions.find((s) => s.type === "ADD_TASK");
  assert.ok(add, "ADD_TASK for neglected monthly");
  for (const k of ADD_TASK_KEYS) assert.ok(k in add, `missing ${k}`);
  assert.ok(minutes(add.start) > minutes("10:00"));
  assert.equal(add.category, "Work");
});

test("4pm multiple overdue: validator does not force on-pace deterministic when not missing_from_schedule", () => {
  const { parsed, usedDeterministicMessage } = validateCoachSpecificity(
    {
      message: "Several blocks are overdue this afternoon; triage the next hour first.",
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "40%",
    },
    {
      coachContext: {
        today: { isOnPace: false, overdueTasks: 4, completedTasks: 1, schedulePacingNote: "Heavy afternoon." },
        timeOfDay: "afternoon",
        monthlyObjectives: { neglected: [] },
        health: {},
      },
      coachReasoningMode: "schedule_check",
      localNowHHMM: "16:00",
      realTodayKey: "2026-05-09",
      categories: [],
      userQuestion: "Am I behind today?",
    }
  );
  assert.equal(usedDeterministicMessage, false);
  assert.match(parsed.message, /overdue|afternoon|triage/i);
});

test("missing monthlyObjectives on context: no crash, no neglected ADD_TASK", () => {
  const { parsed } = validateCoachSpecificity(
    {
      message: "Hello",
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "",
    },
    {
      coachContext: { today: { isOnPace: true, overdueTasks: 0 }, health: {} },
      coachReasoningMode: "general_coaching",
      localNowHHMM: undefined,
      realTodayKey: "2026-05-09",
      userQuestion: "Hi coach",
    }
  );
  assert.ok(typeof parsed.message === "string");
  assert.equal(parsed.suggestions.filter((s) => s.type === "ADD_TASK").length, 0);
});

test("no localNowHHMM uses safe default and suggestion start is still after default now", () => {
  const { parsed } = validateCoachSpecificity(
    {
      message: "x",
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "",
    },
    {
      coachContext: {
        today: { isOnPace: true, overdueTasks: 0, completedTasks: 0, schedulePacingNote: "Morning." },
        monthlyObjectives: { neglected: [{ title: "Taxes", suggestedNextAction: "Gather forms" }] },
        health: {},
      },
      coachReasoningMode: "general_coaching",
      realTodayKey: "2026-05-09",
      categories: [],
    }
  );
  const add = parsed.suggestions.find((s) => s.type === "ADD_TASK");
  assert.ok(add);
  assert.ok(minutes(add.start) > minutes("09:00"));
  assert.equal(add.category, "Work");
});

test("health_programming + model already mentioned workout: no duplicate PROGRAM_NOTE", () => {
  const msg = "Your workout split is solid; next tweak the program volume.";
  const { parsed } = validateCoachSpecificity(
    {
      message: msg,
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "",
    },
    {
      coachContext: {
        today: { isOnPace: true, overdueTasks: 0 },
        monthlyObjectives: { neglected: [] },
        health: { suggestedProgramOpportunity: "Consider a custom block." },
      },
      coachReasoningMode: "health_programming",
      localNowHHMM: "14:00",
      realTodayKey: "2026-05-09",
      categories: ["Personal"],
      userQuestion: "How should I train?",
    }
  );
  assert.equal(parsed.message, msg);
  assert.ok(!parsed.message.includes("On the health side, you've used a built-in program recently"));
});

test("missing_from_schedule without healthOpp: no built-in program sentence", () => {
  const { parsed } = validateCoachSpecificity(
    {
      message: "Generic filler only.",
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "",
    },
    {
      coachContext: {
        today: { isOnPace: true, overdueTasks: 0, schedulePacingNote: "On pace." },
        yesterday: { summary: "Yesterday was strong." },
        monthlyObjectives: { neglected: [{ title: "Blog", suggestedNextAction: "Outline post" }] },
        health: {},
      },
      coachReasoningMode: "missing_from_schedule",
      localNowHHMM: "11:00",
      realTodayKey: "2026-05-09",
      categories: ["Personal", "Work"],
      userQuestion: "What is missing lately?",
    }
  );
  assert.ok(!parsed.message.includes("built-in program recently"));
});

test("empty coachReasoningMode falls back to general_coaching", () => {
  const { parsed } = validateCoachSpecificity(
    {
      message: "ok",
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "x",
    },
    {
      coachContext: { today: { isOnPace: true, overdueTasks: 0 }, monthlyObjectives: { neglected: [] }, health: {} },
      coachReasoningMode: "   ",
      localNowHHMM: "12:00",
      realTodayKey: "2026-05-09",
      categories: ["Work"],
    }
  );
  assert.equal(parsed.message, "ok");
});

test("coach message promises leg program + block but omitted suggestions: adds program + workout ADD_TASK", () => {
  const { parsed, patched } = validateCoachSpecificity(
    {
      message: "Let's add a workout block and a leg day program to your plan.",
      insight: null,
      highlights: [],
      followUp: null,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: "",
    },
    {
      coachContext: {
        today: { isOnPace: true, overdueTasks: 0, completedTasks: 0 },
        monthlyObjectives: { neglected: [] },
        health: {},
      },
      coachReasoningMode: "health_programming",
      localNowHHMM: "14:00",
      realTodayKey: "2026-05-09",
      categories: ["Personal", "Work"],
      userQuestion: null,
      conversation: [],
    }
  );
  assert.equal(patched, true);
  const wp = parsed.suggestions.find((s) => s.type === "ADD_WORKOUT_PROGRAM");
  assert.ok(wp, "ADD_WORKOUT_PROGRAM patched in");
  assert.ok(Array.isArray(wp.exercises) && wp.exercises.length >= 4);
  const gymTask = parsed.suggestions.find(
    (s) => s.type === "ADD_TASK" && /\b(leg day|gym|workout|strength)\b/i.test(`${s.title} ${s.reason}`)
  );
  assert.ok(gymTask, "workout-ish ADD_TASK patched in");
  assert.ok(minutes(gymTask.start) > minutes("14:00"));
});
