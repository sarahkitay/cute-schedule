/**
 * Timers & Alarms module: data model, storage, and logic.
 * Platform-specific audio/notification hooks marked for native implementation.
 */

const TIMERS_STORAGE_KEY = "cute_schedule_timers_v1";
const ALARMS_STORAGE_KEY = "cute_schedule_alarms_v1";

// ─── Timer Types ───
export const TIMER_TYPES = {
  BASIC: "basic",
  FOCUS: "focus",
  ROUTINE: "routine",
  POMODORO: "pomodoro",
};

export function defaultTimersState() {
  return {
    timers: [],
    activeTimer: null,
    history: [],
  };
}

export function loadTimersFromDisk() {
  try {
    const raw = localStorage.getItem(TIMERS_STORAGE_KEY);
    if (!raw) return defaultTimersState();
    const parsed = JSON.parse(raw);
    const state = {
      timers: Array.isArray(parsed.timers) ? parsed.timers : [],
      activeTimer: parsed.activeTimer || null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
    return reconcileActiveTimerOnLoad(state);
  } catch {
    return defaultTimersState();
  }
}

export function saveTimersToDisk(state) {
  try {
    localStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function createTimer(options = {}) {
  return {
    id: generateId(),
    type: options.type || TIMER_TYPES.BASIC,
    label: options.label || "Timer",
    durationMs: options.durationMs || 25 * 60 * 1000,
    linkedTaskId: options.linkedTaskId || null,
    linkedRoutineId: options.linkedRoutineId || null,
    createdAt: Date.now(),
  };
}

export function formatTimerDisplay(remainingMs) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Human label for a preset length (e.g. "25 min", "1 hr"). */
export function formatTimerPresetLabel(ms) {
  const mins = Math.max(1, Math.round((Number(ms) || 0) / 60000));
  if (mins % 60 === 0 && mins >= 60) {
    const hrs = mins / 60;
    return hrs === 1 ? "1 hr" : `${hrs} hr`;
  }
  return `${mins} min`;
}

/** @param {object|null|undefined} raw */
export function normalizeLinkedTask(raw) {
  if (!raw || typeof raw !== "object" || raw.taskId == null) return null;
  return {
    taskId: String(raw.taskId),
    dayKey: raw.dayKey != null ? String(raw.dayKey) : null,
    hourKey: raw.hourKey != null ? String(raw.hourKey) : null,
    category: raw.category != null ? String(raw.category) : null,
    taskText:
      typeof raw.taskText === "string" && raw.taskText.trim()
        ? raw.taskText.trim().slice(0, 200)
        : null,
  };
}

const DEFAULT_PRESET_MS = 25 * 60 * 1000;

/** @returns {import('./timers').ActiveTimerDraft} */
export function defaultActiveTimerDraft(presetMs = DEFAULT_PRESET_MS) {
  return {
    label: "Focus",
    selectedPresetMs: presetMs,
    remainingMs: presetMs,
    running: false,
    endsAt: null,
    linkedTask: null,
  };
}

/** @param {object|null|undefined} raw */
export function normalizeActiveTimer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const selectedPresetMs = Number(raw.selectedPresetMs) || DEFAULT_PRESET_MS;
  const remainingMs = Number(raw.remainingMs) || selectedPresetMs;
  const running = !!raw.running;
  const endsAt = running && raw.endsAt != null ? Number(raw.endsAt) : null;
  return {
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : "Focus",
    selectedPresetMs,
    remainingMs,
    running: running && endsAt != null,
    endsAt: running && endsAt != null ? endsAt : null,
    linkedTask: normalizeLinkedTask(raw.linkedTask),
  };
}

/** True when the floating dock timer pill should show (running, paused mid-session, or task timer). */
export function isActiveTimerPillVisible(active) {
  const norm = normalizeActiveTimer(active);
  if (!norm) return false;
  if (norm.running) return true;
  if (norm.linkedTask) return true;
  return norm.remainingMs < norm.selectedPresetMs;
}

/** @param {object|null|undefined} active */
export function getActiveTimerRemaining(active) {
  const norm = normalizeActiveTimer(active);
  if (!norm) return DEFAULT_PRESET_MS;
  if (norm.running && norm.endsAt) return Math.max(0, norm.endsAt - Date.now());
  return norm.remainingMs;
}

/** @param {object|null|undefined} active @param {{ remainingMs?: number, label?: string, linkedTask?: object|null }} [opts] */
export function startActiveTimer(active, opts = {}) {
  const base = normalizeActiveTimer(active) ?? defaultActiveTimerDraft();
  const remainingMs = opts.remainingMs ?? getActiveTimerRemaining(base);
  const ms = Math.max(0, remainingMs);
  const linkedTask =
    opts.linkedTask !== undefined ? normalizeLinkedTask(opts.linkedTask) : base.linkedTask;
  return {
    ...base,
    label: opts.label ?? base.label,
    linkedTask,
    remainingMs: ms,
    running: true,
    endsAt: Date.now() + ms,
  };
}

/** @param {object|null|undefined} active */
export function pauseActiveTimer(active) {
  const base = normalizeActiveTimer(active);
  if (!base?.running) return base;
  const remainingMs = Math.max(0, (base.endsAt || Date.now()) - Date.now());
  return { ...base, running: false, endsAt: null, remainingMs };
}

/** @param {object|null|undefined} active @param {number} [presetMs] */
export function resetActiveTimer(active, presetMs) {
  const base = normalizeActiveTimer(active) ?? defaultActiveTimerDraft(presetMs);
  const ms = presetMs ?? base.selectedPresetMs ?? DEFAULT_PRESET_MS;
  return {
    ...defaultActiveTimerDraft(ms),
    label: base.label,
    linkedTask: null,
    selectedPresetMs: ms,
    remainingMs: ms,
    running: false,
    endsAt: null,
  };
}

/** @param {object} active @param {{ taskCompleted?: boolean }} [opts] */
export function buildFocusTimerHistoryEntry(active, opts = {}) {
  const base = normalizeActiveTimer(active);
  const presetMs = base?.selectedPresetMs || base?.remainingMs || DEFAULT_PRESET_MS;
  const entry = {
    id: Date.now(),
    label: base?.label || "Focus",
    durationMs: presetMs,
    presetMs,
    completedAt: Date.now(),
    type: TIMER_TYPES.FOCUS,
  };
  if (base?.linkedTask) {
    entry.linkedTask = { ...base.linkedTask };
    entry.taskCompleted = !!opts.taskCompleted;
  }
  return entry;
}

/** If a running timer was stored past its end time, return updated state. */
export function reconcileActiveTimerOnLoad(state, opts = {}) {
  const active = normalizeActiveTimer(state?.activeTimer);
  if (!active?.running || !active.endsAt) return state;
  if (Date.now() < active.endsAt) return { ...state, activeTimer: active };
  const entry = buildFocusTimerHistoryEntry(active, {
    taskCompleted: !!opts.resolveTaskDone?.(active),
  });
  return {
    ...state,
    activeTimer: resetActiveTimer(active, active.selectedPresetMs),
    history: [entry, ...(state.history || [])].slice(0, 50),
  };
}

/** @param {object} state @param {{ resolveTaskDone?: (active: object) => boolean }} [opts] */
export function completeActiveTimerState(state, opts = {}) {
  const active = normalizeActiveTimer(state?.activeTimer);
  if (!active?.running || !active.endsAt || Date.now() < active.endsAt) return state;
  const entry = buildFocusTimerHistoryEntry(active, {
    taskCompleted: !!opts.resolveTaskDone?.(active),
  });
  return {
    ...state,
    activeTimer: resetActiveTimer(active, active.selectedPresetMs),
    history: [entry, ...(state.history || [])].slice(0, 50),
  };
}

/** Display stored HH:mm alarm time in 12-hour locale form (e.g. 4:41 PM). */
export function formatAlarmTimeDisplay(time24) {
  if (!time24 || typeof time24 !== "string") return time24 || "";
  const parts = time24.trim().split(":");
  if (parts.length < 2) return time24;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ─── Alarms ───
export const ALARM_MODES = {
  GENTLE: "gentle",
  STANDARD: "standard",
  MATH_DISMISS: "math_dismiss",
  ACTION_REQUIRED: "action_required",
  RIDDLE: "riddle",
  PUZZLE: "puzzle",
};

/** True when the user chose a wake-up game for this alarm. */
export function alarmRequiresWakeUpChallenge(alarm) {
  const mode = alarm?.mode;
  return (
    mode === ALARM_MODES.MATH_DISMISS ||
    mode === ALARM_MODES.ACTION_REQUIRED ||
    mode === ALARM_MODES.RIDDLE ||
    mode === ALARM_MODES.PUZZLE
  );
}

export { ALARM_SOUND_IDS, BUILTIN_ALARM_SOUNDS } from "../alarmSounds";

export function defaultAlarmsState() {
  return { alarms: [] };
}

export function loadAlarmsFromDisk() {
  try {
    const raw = localStorage.getItem(ALARMS_STORAGE_KEY);
    if (!raw) return defaultAlarmsState();
    const parsed = JSON.parse(raw);
    return { alarms: Array.isArray(parsed.alarms) ? parsed.alarms : [] };
  } catch {
    return defaultAlarmsState();
  }
}

export function saveAlarmsToDisk(state) {
  try {
    localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function createAlarm(options = {}) {
  return {
    id: generateId(),
    time: options.time || "07:00",
    label: options.label || "Alarm",
    mode: options.mode || ALARM_MODES.STANDARD,
    days: options.days || [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
    linkedTaskId: options.linkedTaskId || null,
    linkedRoutineId: options.linkedRoutineId || null,
    sound: options.sound || "default",
    customSoundId: options.customSoundId || null,
    customSoundName: options.customSoundName || null,
    mathDifficulty: options.mathDifficulty || "easy",
    requiredAction: options.requiredAction || null,
    allowEmergencyOverride: options.allowEmergencyOverride !== false,
    snoozeMinutes: typeof options.snoozeMinutes === "number" ? options.snoozeMinutes : 9,
    createdAt: Date.now(),
  };
}

export function getNextAlarmTime(alarm) {
  if (!alarm?.enabled || !alarm?.time) return null;
  const days =
    Array.isArray(alarm.days) && alarm.days.length > 0
      ? alarm.days
      : [0, 1, 2, 3, 4, 5, 6];
  const now = new Date();
  const [h, m] = alarm.time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const today = new Date();
  today.setHours(h, m, 0, 0);
  if (today > now && days.includes(now.getDay())) return today;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (days.includes(d.getDay())) return d;
  }
  return null;
}

/** @param {object} alarm @param {boolean} [isSnooze] */
export function alarmNotificationBody(alarm, isSnooze = false) {
  const label = alarm?.label || "Morning alarm";
  if (isSnooze) {
    return alarmRequiresWakeUpChallenge(alarm)
      ? `${label} is still ringing. Open PROYOU to finish your wake-up challenge.`
      : `${label} is still ringing. Tap to open PROYOU.`;
  }
  return alarmRequiresWakeUpChallenge(alarm)
    ? `Tap to open PROYOU and complete your wake-up challenge.`
    : `Tap to open PROYOU. Time to wake up!`;
}

/**
 * Native alarm hooks (see nativeAlarmKit.js, nativeAlarmNotifications.js):
 * - iOS 26+: AlarmKit system alarms
 * - iOS/Android: Local notifications + in-app ring (ProyouAlarmSound on iOS)
 * - Web: Notification API + Web Audio
 */
export const PLATFORM_HOOKS_NEEDED = [
  "Gentle wake mode: gradual volume increase via AlarmKit countdown (optional)",
];

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
