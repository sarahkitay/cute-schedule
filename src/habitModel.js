import { normalizeTimeKey } from "./coach/taskInsertion.ts";
import { normalizeHabitIcon } from "./habitIcons.js";

/** Stable habit row incl. reminder fields (local + cloud). */
export function normalizeHabitRow(h) {
  if (!h || typeof h !== "object" || h.id == null) return null;
  const sch = h.reminderSchedule;
  const reminderSchedule = sch === "hourly" || sch === "hours" ? sch : "none";
  const rawHours = Array.isArray(h.reminderHours) ? h.reminderHours : [];
  const reminderHours =
    reminderSchedule === "hours"
      ? [...new Set(rawHours.map((t) => normalizeTimeKey(t)).filter(Boolean))].sort()
      : [];
  return {
    ...h,
    id: String(h.id),
    label: String(h.label || "").trim() || "Habit",
    direction: h.direction === "break" ? "break" : "build",
    icon: normalizeHabitIcon(h.icon),
    reminderSchedule,
    reminderHours,
    reminderPushEnabled: h.reminderPushEnabled === false ? false : true,
  };
}

export function isCustomHabitReminderMode(notificationPrefs) {
  const mode = notificationPrefs?.habitReminderMode;
  return mode === "custom" || mode == null;
}

/** Union local + cloud habit lists so an empty cloud doc cannot wipe habits. */
export function mergeHabitTrackers(localRaw, cloudRaw) {
  const localHabits = Array.isArray(localRaw?.habits)
    ? localRaw.habits.map(normalizeHabitRow).filter(Boolean)
    : [];
  const cloudHabits = Array.isArray(cloudRaw?.habits)
    ? cloudRaw.habits.map(normalizeHabitRow).filter(Boolean)
    : [];
  const byId = new Map();
  for (const h of [...cloudHabits, ...localHabits]) {
    if (h?.id) byId.set(h.id, h);
  }
  const log = {};
  for (const src of [cloudRaw?.log, localRaw?.log]) {
    if (!src || typeof src !== "object") continue;
    for (const [day, row] of Object.entries(src)) {
      if (!log[day] || typeof log[day] !== "object") {
        log[day] = row && typeof row === "object" ? { ...row } : row;
        continue;
      }
      if (row && typeof row === "object") log[day] = { ...log[day], ...row };
    }
  }
  return { habits: [...byId.values()], log };
}
