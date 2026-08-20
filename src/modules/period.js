/**
 * Period tracker: cycle log, predictions, keyword hints for coach/tasks.
 */

import { canOfferPeriodTracker, normalizeIntakeGender } from "../intakeModel.js";

export const PERIOD_STORAGE_KEY = "cute_schedule_period_v1";

/** Keywords that suggest period/cycle context (coach, notes, tasks). */
export const PERIOD_TRACKER_KEYWORDS = [
  "period",
  "menstrual",
  "menstruation",
  "cycle",
  "cramps",
  "cramping",
  "pms",
  "pmdd",
  "flow",
  "spotting",
  "ovulation",
  "luteal",
  "follicular",
  "tampon",
  "pad",
  "cup",
  "bleed",
  "heavy day",
  "light day",
];

const DEFAULT_CYCLE_DAYS = 28;
const DEFAULT_PERIOD_DAYS = 5;

/** Keywords that suggest a medical visit (for last-period note opt-in). */
export const MEDICAL_APPOINTMENT_KEYWORDS = [
  "doctor",
  "dr appointment",
  "dr appt",
  "dr.",
  "physician",
  "medical appointment",
  "medical appt",
  "gynecologist",
  "gyno",
  "ob-gyn",
  "obgyn",
  "clinic visit",
  "checkup",
  "check-up",
  "annual physical",
  "urgent care",
];

/** User logged a period start or marked a day on period. */
export function hasEverLoggedPeriod(periodState) {
  const s = normalizePeriodState(periodState);
  if (s.profile.lastPeriodStart) return true;
  return Object.values(s.log || {}).some((entry) => entry?.onPeriod === true);
}

/** May be offered period tracker (female intake or any logged period). */
export function isPeriodTrackerEligible(profile, periodState) {
  if (normalizeIntakeGender(profile?.intakeGender) === "female") return true;
  return hasEverLoggedPeriod(periodState);
}

/** Period tracker is on: quick-add, coach hints, and You footer link. */
export function shouldShowPeriodFeatures(profile, periodState) {
  if (!isPeriodTrackerEligible(profile, periodState)) return false;
  return profile?.periodTrackerEnabled === true;
}

export function isMedicalAppointmentTask(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return false;
  return MEDICAL_APPOINTMENT_KEYWORDS.some((kw) => t.includes(kw));
}

/** User typed that their period started (quick-add / task text). */
export function isPeriodStartedPhrase(text) {
  const t = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return false;
  return (
    /\bperiod\s+started\b/.test(t) ||
    /\bmy\s+period\s+started\b/.test(t) ||
    /\bstarted\s+my\s+period\b/.test(t) ||
    t === "period start" ||
    t === "period started"
  );
}

/** @returns {{ kind: "period_started" | "medical_appt" } | null} */
export function detectPeriodQuickAddIntent(text) {
  if (isPeriodStartedPhrase(text)) return { kind: "period_started" };
  if (isMedicalAppointmentTask(text)) return { kind: "medical_appt" };
  return null;
}

export function logPeriodStartOnDay(periodState, dayKey) {
  const norm = normalizePeriodState(periodState);
  const dk = dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : null;
  if (!dk) return norm;
  return {
    ...norm,
    profile: { ...norm.profile, lastPeriodStart: dk },
    log: {
      ...norm.log,
      [dk]: { ...(norm.log[dk] || {}), onPeriod: true },
    },
  };
}

export function formatPeriodDateDisplay(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return "-";
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
}

export const LAST_PERIOD_NOTE_PREFIX = "Last period started:";

export function appendLastPeriodToTaskNote(taskNote, lastPeriodStart) {
  if (!lastPeriodStart || !/^\d{4}-\d{2}-\d{2}$/.test(lastPeriodStart)) return taskNote || "";
  const line = `${LAST_PERIOD_NOTE_PREFIX} ${formatPeriodDateDisplay(lastPeriodStart)}`;
  const base = String(taskNote || "").trim();
  if (!base) return line;
  if (base.toLowerCase().includes(LAST_PERIOD_NOTE_PREFIX.toLowerCase())) {
    return base.replace(/Last period started:\s*[\d/.\-]+/i, line);
  }
  return `${base}\n${line}`;
}

export function removeLastPeriodFromTaskNote(taskNote) {
  return String(taskNote || "")
    .split("\n")
    .filter((ln) => !/^\s*last period started:/i.test(ln.trim()))
    .join("\n")
    .trim();
}

export function taskNoteIncludesLastPeriod(taskNote) {
  return /last period started:/i.test(String(taskNote || ""));
}

/** Days marked as period (logged + estimated cycles) within range. */
export function enumeratePeriodDays(periodState, fromKey, toKey) {
  const s = normalizePeriodState(periodState);
  const out = new Set();
  if (!fromKey || !toKey) return [];

  for (const [dk, entry] of Object.entries(s.log)) {
    if (entry?.onPeriod && dk >= fromKey && dk <= toKey) out.add(dk);
  }

  const { lastPeriodStart, cycleLengthDays, periodLengthDays } = s.profile;
  if (!lastPeriodStart) return [...out].sort();

  let cycleStart = lastPeriodStart;
  for (let i = 0; i < 18; i++) {
    const prev = addDaysKey(cycleStart, -cycleLengthDays);
    if (addDaysKey(prev, periodLengthDays - 1) < fromKey) break;
    cycleStart = prev;
  }

  for (let guard = 0; guard < 24 && cycleStart <= toKey; guard++) {
    for (let d = 0; d < periodLengthDays; d++) {
      const dk = addDaysKey(cycleStart, d);
      if (dk >= fromKey && dk <= toKey) out.add(dk);
    }
    const next = addDaysKey(cycleStart, cycleLengthDays);
    if (next === cycleStart) break;
    cycleStart = next;
  }

  return [...out].sort();
}

/** Estimated ovulation window (midpoint ±1 day). Not for contraception. */
export function enumerateOvulationDays(periodState, fromKey, toKey) {
  const s = normalizePeriodState(periodState);
  const { lastPeriodStart, cycleLengthDays } = s.profile;
  if (!lastPeriodStart || !fromKey || !toKey) return [];

  const out = new Set();
  let cycleStart = lastPeriodStart;
  for (let i = 0; i < 18; i++) {
    const prev = addDaysKey(cycleStart, -cycleLengthDays);
    if (addDaysKey(prev, cycleLengthDays - 12) < fromKey) break;
    cycleStart = prev;
  }

  for (let guard = 0; guard < 24 && cycleStart <= toKey; guard++) {
    const center = addDaysKey(cycleStart, Math.max(1, cycleLengthDays - 14));
    for (let w = -1; w <= 1; w++) {
      const dk = addDaysKey(center, w);
      if (dk >= fromKey && dk <= toKey) out.add(dk);
    }
    const next = addDaysKey(cycleStart, cycleLengthDays);
    if (next === cycleStart) break;
    cycleStart = next;
  }

  return [...out].sort();
}

export function isTaskHiddenFromSharedSchedule(task) {
  if (!task || typeof task !== "object") return false;
  if (task.hideWhenShared === true) return true;
  if (task.taskType === "period") return true;
  return false;
}

export function buildPeriodScheduleTask(dayKey) {
  return {
    text: "Period",
    taskType: "period",
    hideWhenShared: true,
    energyLevel: "LIGHT",
    periodDayKey: dayKey,
  };
}

export function textMentionsPeriodTopic(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return false;
  return PERIOD_TRACKER_KEYWORDS.some((kw) => t.includes(kw));
}

export function defaultPeriodState() {
  return {
    profile: {
      cycleLengthDays: DEFAULT_CYCLE_DAYS,
      periodLengthDays: DEFAULT_PERIOD_DAYS,
      lastPeriodStart: null,
    },
    log: {},
  };
}

export function normalizePeriodState(raw) {
  const base = defaultPeriodState();
  if (!raw || typeof raw !== "object") return base;
  const profile = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
  const cycle = Number(profile.cycleLengthDays);
  const periodLen = Number(profile.periodLengthDays);
  return {
    profile: {
      cycleLengthDays:
        Number.isFinite(cycle) && cycle >= 21 && cycle <= 45 ? Math.round(cycle) : DEFAULT_CYCLE_DAYS,
      periodLengthDays:
        Number.isFinite(periodLen) && periodLen >= 2 && periodLen <= 10
          ? Math.round(periodLen)
          : DEFAULT_PERIOD_DAYS,
      lastPeriodStart:
        typeof profile.lastPeriodStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(profile.lastPeriodStart)
          ? profile.lastPeriodStart
          : null,
    },
    log: raw.log && typeof raw.log === "object" ? raw.log : {},
  };
}

export function loadPeriodFromDisk() {
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return defaultPeriodState();
    return normalizePeriodState(JSON.parse(raw));
  } catch {
    return defaultPeriodState();
  }
}

export function savePeriodToDisk(state) {
  try {
    localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(normalizePeriodState(state)));
  } catch {
    /* ignore */
  }
}

function addDaysKey(dayKey, delta) {
  const d = new Date(dayKey + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function predictNextPeriodStart(lastStart, cycleLengthDays = DEFAULT_CYCLE_DAYS) {
  if (!lastStart || !/^\d{4}-\d{2}-\d{2}$/.test(lastStart)) return null;
  return addDaysKey(lastStart, cycleLengthDays);
}

export function daysUntilDate(fromDayKey, targetDayKey) {
  if (!fromDayKey || !targetDayKey) return null;
  const a = new Date(fromDayKey + "T12:00:00").getTime();
  const b = new Date(targetDayKey + "T12:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export function periodPhaseLabel(dayKey, lastStart, cycleLengthDays, periodLengthDays) {
  if (!lastStart) return "Log your last period start to see predictions.";
  const dayInCycle = daysUntilDate(lastStart, dayKey);
  if (dayInCycle == null) return null;
  const mod = ((dayInCycle % cycleLengthDays) + cycleLengthDays) % cycleLengthDays;
  if (mod < periodLengthDays) return "Period window";
  if (mod >= cycleLengthDays - 14 && mod < cycleLengthDays - 12) return "Ovulation window (estimate)";
  if (mod >= cycleLengthDays - 14) return "Pre-period (estimate)";
  return "Mid-cycle";
}

export function formatPeriodForCoach(periodState, todayKey) {
  const s = normalizePeriodState(periodState);
  if (!s.profile.lastPeriodStart) return "";
  const next = predictNextPeriodStart(s.profile.lastPeriodStart, s.profile.cycleLengthDays);
  const until = next ? daysUntilDate(todayKey, next) : null;
  const phase = periodPhaseLabel(
    todayKey,
    s.profile.lastPeriodStart,
    s.profile.cycleLengthDays,
    s.profile.periodLengthDays,
  );
  const parts = [`Last period start: ${s.profile.lastPeriodStart}`, `Cycle ~${s.profile.cycleLengthDays} days`];
  if (phase) parts.push(`Phase today: ${phase}`);
  if (until != null && until >= 0) parts.push(`Next predicted start in ~${until} days`);
  return parts.join(". ");
}
