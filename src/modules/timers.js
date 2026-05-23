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
    return {
      timers: Array.isArray(parsed.timers) ? parsed.timers : [],
      activeTimer: parsed.activeTimer || null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
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
};

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
    createdAt: Date.now(),
  };
}

export function getNextAlarmTime(alarm) {
  if (!alarm.enabled) return null;
  const now = new Date();
  const [h, m] = alarm.time.split(":").map(Number);
  const today = new Date();
  today.setHours(h, m, 0, 0);
  if (today > now && alarm.days.includes(now.getDay())) return today;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (alarm.days.includes(d.getDay())) return d;
  }
  return null;
}

/**
 * NOTE: Actual alarm triggering requires native platform hooks.
 * - iOS: Capacitor LocalNotifications with sound
 * - Web: Notification API + Audio API
 * This module provides the data model; native integration is a future step.
 */
export const PLATFORM_HOOKS_NEEDED = [
  "Schedule native local notification for alarm time",
  "Play custom sound/song on alarm trigger",
  "Present math problem dismiss UI (native overlay)",
  "Link alarm dismissal to routine/task completion check",
  "Gentle wake mode: gradual volume increase",
];

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
