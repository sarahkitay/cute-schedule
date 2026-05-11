/** @typedef {{ value: number | null; label: string }} ReminderBeforeOption */

/** "None" → null minutes */
export const TASK_REMINDER_BEFORE_OPTIONS = /** @type {const} */ ([
  { value: null, label: "None" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
]);

/**
 * @param {unknown} task
 * @returns {{ remindersEnabled: boolean; remindAtStart: boolean; remindBeforeMinutes: number | null }}
 */
export function normalizeTaskReminderFields(task) {
  const t = task && typeof task === "object" ? task : {};
  const o = /** @type {Record<string, unknown>} */ (t);
  const remindersEnabled = o.remindersEnabled === true;
  const remindAtStart = o.remindAtStart === true;
  let remindBeforeMinutes = null;
  if (typeof o.remindBeforeMinutes === "number" && Number.isFinite(o.remindBeforeMinutes) && o.remindBeforeMinutes > 0) {
    remindBeforeMinutes = Math.round(o.remindBeforeMinutes);
  }
  return { remindersEnabled, remindAtStart, remindBeforeMinutes };
}

/**
 * Build server push reminder rows for a task (FCM backup / web push).
 * Dedupes by `tag` = taskId + type + at ISO minute.
 * @param {object} p
 * @param {Record<string, unknown>} p.task
 * @param {string} p.dayKey YYYY-MM-DD
 * @param {string} p.hourKey HH:mm
 * @param {number} p.nowMs
 * @param {number} p.maxAtMs
 */
export function buildTaskPushReminderEntriesForTask({ task, dayKey, hourKey, nowMs, maxAtMs }) {
  const { remindersEnabled, remindAtStart, remindBeforeMinutes } = normalizeTaskReminderFields(task);
  if (!remindersEnabled) return [];

  const title = "PROYOU";
  const bodyBase = String(task.text || "Task").trim() || "Task";
  const taskId = String(task.id || "");

  const start = new Date(`${dayKey}T${hourKey}:00`);
  const startMs = start.getTime();
  if (!Number.isFinite(startMs)) return [];

  /** @type {{ at: string; title: string; body: string; tag: string; kind: "before" | "start" }[]} */
  const out = [];
  const seen = new Set();

  /** @param {"before" | "start"} suffix */
  const pushIfInWindow = (atMs, suffix, body) => {
    if (atMs < nowMs || atMs > maxAtMs) return;
    const at = new Date(atMs);
    const tag = `task-${taskId}-${suffix}-${at.toISOString().slice(0, 16)}`;
    if (seen.has(tag)) return;
    seen.add(tag);
    out.push({ at: at.toISOString(), title, body, tag, kind: suffix });
  };

  const leadPhrase = (min) => {
    if (min === 1) return "1 minute";
    if (min < 60) return `${min} minutes`;
    if (min === 60) return "1 hour";
    if (min % 60 === 0) return `${min / 60} hours`;
    return `${min} minutes`;
  };

  if (remindBeforeMinutes != null && remindBeforeMinutes > 0) {
    const atMs = startMs - remindBeforeMinutes * 60 * 1000;
    pushIfInWindow(atMs, "before", `${bodyBase} starts in ${leadPhrase(remindBeforeMinutes)}.`);
  }
  if (remindAtStart) {
    pushIfInWindow(startMs, "start", `Time to start: ${bodyBase}`);
  }

  return out;
}

/**
 * Deterministic 32-bit notification id for Capacitor LocalNotifications.
 * @param {string} taskId
 * @param {"before" | "start"} kind
 */
const NP_DEFAULTS = {
  taskPushEnabled: true,
  taskRemindBeforeEnabled: true,
  taskRemindAtStartEnabled: true,
  taskRemindBeforeMinutes: 5,
};

/**
 * Merge per-task reminder flags with profile.notificationPrefs for push / iOS local scheduling.
 * @param {unknown} task
 * @param {unknown} profile
 */
export function taskForPushReminders(task, profile) {
  const p = profile && typeof profile === "object" ? profile : {};
  const np = { ...NP_DEFAULTS, ...(p.notificationPrefs && typeof p.notificationPrefs === "object" ? p.notificationPrefs : {}) };
  const base = normalizeTaskReminderFields(task);
  if (!base.remindersEnabled || np.taskPushEnabled === false) {
    return { ...(task && typeof task === "object" ? task : {}), remindersEnabled: false };
  }
  const mins = Math.min(120, Math.max(1, Math.round(Number(np.taskRemindBeforeMinutes) || 5)));
  const beforeOn = typeof np.taskRemindBeforeEnabled === "boolean" ? np.taskRemindBeforeEnabled : NP_DEFAULTS.taskRemindBeforeEnabled;
  const atStartOn = typeof np.taskRemindAtStartEnabled === "boolean" ? np.taskRemindAtStartEnabled : NP_DEFAULTS.taskRemindAtStartEnabled;
  return {
    ...(task && typeof task === "object" ? task : {}),
    remindersEnabled: true,
    remindAtStart: atStartOn,
    remindBeforeMinutes: beforeOn ? mins : null,
  };
}

export function localNotificationIdFor(taskId, kind) {
  const s = `${kind}:${taskId}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  const n = Math.abs(h) % 2147483646;
  return n === 0 ? 1 : n;
}
