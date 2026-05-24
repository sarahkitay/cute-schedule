import { Capacitor, registerPlugin } from "@capacitor/core";

const ProyouWidget = registerPlugin("ProyouWidget");

const STORAGE_KEY = "cute_schedule_v3";
const HABITS_STORAGE_KEY = "cute_schedule_habits_v1";

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
export function buildWidgetSnapshot(appState, habitTracker, todayKey) {
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

  return {
    updatedAt: new Date().toISOString(),
    todayKey,
    tasks: tasks.slice(0, 12),
    habits: habits.slice(0, 8),
  };
}

let syncTimer = null;

/** Push snapshot to the native widget (iOS App Group). No-op on web. */
export function scheduleWidgetSync(appState, habitTracker, todayKey) {
  if (!Capacitor.isNativePlatform()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const snapshot = buildWidgetSnapshot(appState, habitTracker, todayKey);
    void ProyouWidget.updateSnapshot({ snapshot: JSON.stringify(snapshot) }).catch(() => {});
  }, 400);
}

export async function syncWidgetNow(appState, habitTracker, dayKey) {
  if (!Capacitor.isNativePlatform()) return;
  const snapshot = buildWidgetSnapshot(appState, habitTracker, dayKey);
  try {
    await ProyouWidget.updateSnapshot({ snapshot: JSON.stringify(snapshot) });
  } catch {}
}

export async function syncWidgetFromDisk() {
  if (!Capacitor.isNativePlatform()) return;
  const appState = loadAppStateFromDisk();
  const habitTracker = loadHabitTrackerFromDisk();
  await syncWidgetNow(appState, habitTracker, todayKey());
}
