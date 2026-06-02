import { Capacitor, registerPlugin } from "@capacitor/core";
import { getActiveTimerRemaining, normalizeActiveTimer } from "./modules/timers.js";

const ProyouWidget = registerPlugin("ProyouWidget");

const STORAGE_KEY = "cute_schedule_v3";
const HABITS_STORAGE_KEY = "cute_schedule_habits_v1";
const TIMERS_STORAGE_KEY = "cute_schedule_timers_v1";

function loadTimersFromDisk() {
  try {
    const raw = localStorage.getItem(TIMERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadAppStateFromDisk() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { days: {} };
  } catch {
    return { days: {} };
  }
}

function loadHabitTrackerFromDisk() {
  try {
    const raw = localStorage.getItem(HABITS_STORAGE_KEY);
    if (!raw) return { habits: [], log: {} };
    const o = JSON.parse(raw);
    return { habits: Array.isArray(o.habits) ? o.habits : [], log: o.log || {} };
  } catch {
    return { habits: [], log: {} };
  }
}

/**
 * Build a compact snapshot for iOS home-screen widgets.
 * @param {object} appState
 * @param {object} habitTracker
 * @param {string} todayKey YYYY-MM-DD
 */
export function buildWidgetSnapshot(appState, habitTracker, todayKey, timersState = null) {
  const tasks = [];
  const day = appState?.days?.[todayKey];
  const hours = day?.hours;
  if (hours && typeof hours === "object") {
    for (const hourKey of Object.keys(hours).sort()) {
      const categories = hours[hourKey];
      if (!categories || typeof categories !== "object") continue;
      for (const category of Object.keys(categories)) {
        const list = categories[category];
        if (!Array.isArray(list)) continue;
        for (const t of list) {
          if (!t?.text) continue;
          tasks.push({
            id: String(t.id),
            text: String(t.text).slice(0, 120),
            done: !!t.done,
            hourKey,
            category: String(category),
          });
        }
      }
    }
  }

  tasks.sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    return a.hourKey.localeCompare(b.hourKey);
  });

  const habits = (habitTracker?.habits || []).map((h) => ({
    id: String(h.id),
    label: String(h.label || "Habit").slice(0, 40),
    direction: h.direction === "break" ? "break" : "build",
    todayStatus: habitTracker?.log?.[todayKey]?.[h.id] ?? null,
  }));

  let activeTimer = null;
  const active = normalizeActiveTimer(timersState?.activeTimer);
  if (active?.running && active.endsAt) {
    activeTimer = {
      label: String(active.label || "Timer").slice(0, 60),
      remainingSec: Math.max(0, Math.ceil(getActiveTimerRemaining(active) / 1000)),
      endsAtMs: active.endsAt,
      linkedTaskText: active.linkedTask?.taskText
        ? String(active.linkedTask.taskText).slice(0, 80)
        : null,
    };
  }

  return {
    updatedAt: new Date().toISOString(),
    todayKey,
    tasks: tasks.slice(0, 12),
    habits: habits.slice(0, 8),
    activeTimer,
  };
}

let syncTimer = null;

/** Push snapshot to the native widget (iOS App Group). No-op on web. */
export function scheduleWidgetSync(appState, habitTracker, todayKey, timersState = null) {
  if (!Capacitor.isNativePlatform()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const timers = timersState ?? loadTimersFromDisk();
    const snapshot = buildWidgetSnapshot(appState, habitTracker, todayKey, timers);
    void ProyouWidget.updateSnapshot({ snapshot: JSON.stringify(snapshot) }).catch(() => {});
  }, 400);
}

export async function syncWidgetNow(appState, habitTracker, dayKey, timersState = null) {
  if (!Capacitor.isNativePlatform()) return;
  const timers = timersState ?? loadTimersFromDisk();
  const snapshot = buildWidgetSnapshot(appState, habitTracker, dayKey, timers);
  try {
    await ProyouWidget.updateSnapshot({ snapshot: JSON.stringify(snapshot) });
  } catch {}
}

export async function syncWidgetFromDisk() {
  if (!Capacitor.isNativePlatform()) return;
  const appState = loadAppStateFromDisk();
  const habitTracker = loadHabitTrackerFromDisk();
  const timers = loadTimersFromDisk();
  await syncWidgetNow(appState, habitTracker, todayKey(), timers);
}
