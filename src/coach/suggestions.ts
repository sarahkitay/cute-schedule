import { COACH_SUGGESTION_SOURCE, type CoachEnergy, type CoachSuggestionType, type CoachSuggestionV2, type NormalizedCoachResult } from "./types";
import { addMinutes, normalizeTimeKey, pickInsertionHourKey, taskCountInHour } from "./taskInsertion";
import { formatExerciseBlockLine, normalizeExerciseBlock } from "../health/healthModel";

const ENERGIES: CoachEnergy[] = ["LIGHT", "MEDIUM", "HEAVY"];
const TYPES: CoachSuggestionType[] = [
  "ADD_TASK",
  "ADD_WORKOUT_PROGRAM",
  "REORDER",
  "TIMEBOX",
  "BREAK",
  "SPLIT_TASK",
  "DEFER",
];

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `sg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = normalizeTimeKey(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const capped = Math.max(0, Math.min(24 * 60 - 1, total));
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** When planning "today" (real calendar date), bump task suggestions to future times and lighter hour buckets. */
export type CoachSuggestionGuardOpts = {
  coachViewDayKey: string;
  realTodayKey: string;
  localNowHHMM: string;
};

function adjustSuggestionForLiveCalendarDay(
  s: CoachSuggestionV2,
  todayHours: Record<string, unknown>,
  opts: CoachSuggestionGuardOpts
): CoachSuggestionV2 {
  const day = s.targetDayKey || opts.coachViewDayKey;
  if (day !== opts.realTodayKey) return s;
  if (s.type === "ADD_WORKOUT_PROGRAM") return s;
  if (s.type !== "ADD_TASK" && s.type !== "BREAK") return s;

  const nowM = timeToMinutes(opts.localNowHHMM);
  let candM = timeToMinutes(s.start);
  if (candM <= nowM) {
    candM = Math.max(nowM + 1, nowM + 15);
    candM = Math.ceil(candM / 15) * 15;
  }

  const hoursTyped = todayHours as Record<string, Record<string, unknown[]>>;
  const maxTries = 96;
  for (let i = 0; i < maxTries; i++) {
    if (candM >= 24 * 60) {
      candM = 23 * 60 + 45;
    }
    const candTime = minutesToTime(candM);
    const hourKey = pickInsertionHourKey(candTime, todayHours);
    const busy = taskCountInHour(hoursTyped, hourKey);
    if (s.type === "ADD_TASK" && busy > 0) {
      candM += 15;
      continue;
    }
    const newStart = normalizeTimeKey(candTime);
    const newHour = pickInsertionHourKey(newStart, todayHours);
    return {
      ...s,
      start: newStart,
      hour: newHour,
      end: addMinutes(newStart, s.durationMinutes),
    };
  }
  const fallbackM = Math.min(Math.max(nowM + 30, 15), 23 * 60 + 30);
  const fb = minutesToTime(fallbackM);
  const fbHour = pickInsertionHourKey(fb, todayHours);
  return { ...s, start: fb, hour: fbHour, end: addMinutes(fb, s.durationMinutes) };
}

/** Apply after parsing API or generating fallback so suggested slots respect "now" and existing tasks. */
export function applyLiveDaySuggestionGuards(
  suggestions: CoachSuggestionV2[],
  todayHours: Record<string, unknown>,
  opts: CoachSuggestionGuardOpts | null | undefined
): CoachSuggestionV2[] {
  if (!opts || !opts.realTodayKey || !opts.coachViewDayKey || !opts.localNowHHMM) return suggestions;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.realTodayKey) || !/^\d{2}:\d{2}$/.test(normalizeTimeKey(opts.localNowHHMM))) return suggestions;
  return suggestions.map((s) => adjustSuggestionForLiveCalendarDay(s, todayHours, opts));
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.7;
  return Math.min(0.99, Math.max(0.35, n));
}

function coerceEnergy(v: unknown): CoachEnergy {
  const s = String(v || "").toUpperCase();
  return ENERGIES.includes(s as CoachEnergy) ? (s as CoachEnergy) : "MEDIUM";
}

function coerceType(v: unknown): CoachSuggestionType {
  const s = String(v || "").toUpperCase();
  return TYPES.includes(s as CoachSuggestionType) ? (s as CoachSuggestionType) : "ADD_TASK";
}

function coerceBool(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  if (v === "false" || v === 0) return false;
  return fallback;
}

function coerceNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** User text that should approve the first pending suggestion */
export function isAffirmationToCoach(text: string): boolean {
  const t = String(text || "")
    .trim()
    .toLowerCase();
  if (!t || t.length > 80) return false;
  const affirm = /^(yes|yep|yeah|sure|ok|okay|add it|do it|do that|please add|sounds good|go ahead|let's do it|lets do it)\.?$/i;
  return affirm.test(t);
}

function coerceRecurrencePattern(v: unknown): "none" | "daily" | "weekly" | null {
  const s = String(v || "").toLowerCase().trim();
  if (s === "weekly" || s === "daily" || s === "none") return s;
  return null;
}

export function normalizeRawSuggestion(
  row: Record<string, unknown>,
  categories: string[],
  todayHours: Record<string, unknown>
): CoachSuggestionV2 | null {
  const rawTypeUpper = String(row.type || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
  if (rawTypeUpper === "ADD_WORKOUT_PROGRAM") {
    let name = String(row.name || row.title || row.programName || "")
      .trim()
      .slice(0, 100);
    const nested =
      row.workoutProgram && typeof row.workoutProgram === "object"
        ? (row.workoutProgram as Record<string, unknown>)
        : row.program && typeof row.program === "object"
          ? (row.program as Record<string, unknown>)
          : null;
    if (nested && !name) {
      name = String(nested.name || nested.title || "")
        .trim()
        .slice(0, 100);
    }
    const lines: string[] = [];
    if (Array.isArray(row.exercises)) {
      for (const ex of row.exercises) {
        if (typeof ex === "string") {
          const t = ex.trim();
          if (t) lines.push(t.slice(0, 220));
        } else if (ex && typeof ex === "object") {
          const b = normalizeExerciseBlock(ex as Record<string, unknown>);
          if (b) {
            const line = formatExerciseBlockLine(b);
            if (line) lines.push(line.slice(0, 220));
          }
        }
      }
    }
    if (Array.isArray(row.exerciseLines)) {
      for (const x of row.exerciseLines) {
        const t = String(x || "").trim();
        if (t) lines.push(t.slice(0, 220));
      }
    }
    if (nested) {
      if (Array.isArray(nested.exercises)) {
        for (const ex of nested.exercises) {
          if (typeof ex === "string") {
            const t = ex.trim();
            if (t) lines.push(t.slice(0, 220));
          } else if (ex && typeof ex === "object") {
            const b = normalizeExerciseBlock(ex as Record<string, unknown>);
            if (b) {
              const line = formatExerciseBlockLine(b);
              if (line) lines.push(line.slice(0, 220));
            }
          }
        }
      }
      if (Array.isArray(nested.exerciseLines)) {
        for (const x of nested.exerciseLines) {
          const t = String(x || "").trim();
          if (t) lines.push(t.slice(0, 220));
        }
      }
    }
    const uniqLines = [...new Set(lines.map((x) => String(x || "").trim()).filter(Boolean))];
    if (!name || !uniqLines.length) return null;
    const category = categories[0] || "Work";
    const start = normalizeTimeKey("09:00");
    const duration = 15;
    return {
      id: String(row.id || newId()),
      type: "ADD_WORKOUT_PROGRAM",
      title: name,
      description: row.description != null ? String(row.description).slice(0, 400) : null,
      reason: String(row.reason || row.why || "Coach drafted this program for you to save if you want it.").slice(0, 500),
      category,
      energyLevel: "MEDIUM",
      start,
      end: addMinutes(start, duration),
      durationMinutes: duration,
      recurring: false,
      recurrencePattern: null,
      targetDayKey: null,
      weekPlanLabel: null,
      confidence: clamp01(coerceNumber(row.confidence, 0.78)),
      requiresApproval: coerceBool(row.requiresApproval, true),
      source: COACH_SUGGESTION_SOURCE,
      hour: pickInsertionHourKey(start, todayHours),
      targetTaskId: null,
      workoutProgram: { name, exerciseLines: uniqLines },
    };
  }

  const title =
    String(row.title || row.text || row.label || "")
      .trim()
      .slice(0, 200);
  if (!title) return null;
  const type = coerceType(row.type);
  const start = normalizeTimeKey(String(row.start || row.hour || "09:00"));
  const duration = Math.min(240, Math.max(5, Math.round(coerceNumber(row.durationMinutes, 20))));
  const endRaw = row.end != null ? String(row.end) : "";
  const end = endRaw ? normalizeTimeKey(endRaw) : addMinutes(start, duration);
  const categoryRaw = String(row.category || "").trim();
  const category = categories.includes(categoryRaw)
    ? categoryRaw
    : categories[0] || "Work";
  const reason = String(row.reason || row.why || row.rationale || "Fits what you have on the board today.").slice(0, 500);
  const confidence = clamp01(coerceNumber(row.confidence, 0.75));
  const recurring = coerceBool(row.recurring, false);
  const recurrencePattern = coerceRecurrencePattern(row.recurrencePattern);
  const targetDayRaw = row.targetDayKey != null ? String(row.targetDayKey).trim() : "";
  const targetDayKey = /^\d{4}-\d{2}-\d{2}$/.test(targetDayRaw) ? targetDayRaw : null;
  const weekPlanLabel =
    row.weekPlanLabel != null ? String(row.weekPlanLabel).trim().slice(0, 120) : null;
  const requiresApproval = coerceBool(row.requiresApproval, true);
  const hour = pickInsertionHourKey(start, todayHours);
  const energyLevel = coerceEnergy(row.energyLevel);
  const description = row.description != null ? String(row.description).slice(0, 400) : null;
  const targetTaskId = row.targetTaskId != null ? String(row.targetTaskId) : null;

  return {
    id: String(row.id || newId()),
    type,
    title,
    description,
    reason,
    category,
    energyLevel,
    start,
    end,
    durationMinutes: duration,
    recurring,
    recurrencePattern,
    targetDayKey,
    weekPlanLabel: weekPlanLabel || null,
    confidence,
    requiresApproval,
    source: COACH_SUGGESTION_SOURCE,
    hour,
    targetTaskId,
  };
}

/**
 * Parse API JSON (V2 or legacy). Never throws.
 */
export function parseCoachApiPayload(
  raw: Record<string, unknown>,
  categories: string[],
  todayHours: Record<string, unknown>
): NormalizedCoachResult {
  const messageFromFields = String(
    raw.message ??
      raw.reply ??
      raw.answer ??
      raw.content ??
      raw.advice ??
      raw.text ??
      ""
  ).trim();
  const insightRaw = raw.insight != null ? String(raw.insight).trim() : "";
  const highlights = Array.isArray(raw.highlights)
    ? (raw.highlights as unknown[]).map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const message =
    messageFromFields ||
    (highlights.length ? highlights.join(" ") : "");
  const insight =
    insightRaw ||
    (highlights.length ? highlights[0].slice(0, 280) : null);
  const followUp =
    raw.followUp != null && String(raw.followUp).trim()
      ? String(raw.followUp).trim()
      : raw.question != null && String(raw.question).trim()
        ? String(raw.question).trim()
        : null;
  const ignoredMonthlies = Array.isArray(raw.ignoredMonthlies)
    ? (raw.ignoredMonthlies as unknown[]).map((m) => {
        if (m && typeof m === "object" && "text" in (m as object)) {
          const o = m as { id?: string; text?: string };
          return { id: o.id, text: String(o.text || "") };
        }
        return { text: String(m || "") };
      })
    : [];
  const percentSummary = String(raw.percentSummary || "").trim();

  const suggestions: CoachSuggestionV2[] = [];
  const rawSug = raw.suggestions;
  if (Array.isArray(rawSug)) {
    for (const item of rawSug) {
      if (!item || typeof item !== "object") continue;
      const n = normalizeRawSuggestion(item as Record<string, unknown>, categories, todayHours);
      if (n) suggestions.push(n);
    }
  }

  const legacyQuestion =
    raw.question != null && String(raw.question).trim() ? String(raw.question).trim() : null;

  return {
    message,
    insight,
    highlights,
    followUp,
    question: legacyQuestion,
    suggestions,
    ignoredMonthlies,
    percentSummary,
  };
}
