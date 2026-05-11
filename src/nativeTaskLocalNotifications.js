import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  buildTaskPushReminderEntriesForTask,
  localNotificationIdFor,
  normalizeTaskReminderFields,
  taskForPushReminders,
} from "./taskReminderModel.js";

/** @type {null | ((p: Record<string, unknown>) => void)} */
let debugReporter = null;

/** @param {(p: Record<string, unknown>) => void} fn */
export function registerIosLocalTaskNotifDebugReporter(fn) {
  debugReporter = typeof fn === "function" ? fn : null;
}

function report(partial) {
  try {
    debugReporter?.(partial);
  } catch {
    /* ignore */
  }
}

function addDaysKey(dayKeyStr, deltaDays) {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function allTasksInDaySlot(hours, hourKey, categories) {
  const cats = Array.isArray(categories) && categories.length ? categories : ["Work"];
  const byCat = hours?.[hourKey] || {};
  return cats.flatMap((cat) => (byCat[cat] || []).map((task) => ({ ...task, hour: hourKey, category: cat })));
}

/**
 * @param {unknown} daysMap `appState.days` only (dayKey → day object).
 * @param {string} startDayKey
 * @param {string[]} categories
 * @param {number} daySpan
 * @param {unknown} [profile] optional; merges notificationPrefs for scheduled alerts
 */
export function collectIosLocalTaskNotifications(daysMap, startDayKey, categories, daySpan = 8, profile = null) {
  /** @type {import('@capacitor/local-notifications').LocalNotificationSchema[]} */
  const notifications = [];
  const days = daysMap && typeof daysMap === "object" ? daysMap : {};
  const nowMs = Date.now();
  const maxMs = nowMs + daySpan * 24 * 60 * 60 * 1000;

  for (let i = 0; i < daySpan; i++) {
    const dayKey = i === 0 ? startDayKey : addDaysKey(startDayKey, i);
    const day = days[dayKey];
    const hours = day?.hours || {};
    for (const hourKey of Object.keys(hours)) {
      const tasks = allTasksInDaySlot(hours, hourKey, categories).filter((t) => !t.done);
      for (const task of tasks) {
        const taskEff = taskForPushReminders(task, profile);
        const { remindersEnabled } = normalizeTaskReminderFields(taskEff);
        if (!remindersEnabled) continue;

        const pushRows = buildTaskPushReminderEntriesForTask({
          task: taskEff,
          dayKey,
          hourKey,
          nowMs,
          maxAtMs: maxMs,
        });
        for (const row of pushRows) {
          const atMs = new Date(row.at).getTime();
          if (!Number.isFinite(atMs) || atMs < nowMs + 5000) continue;
          const kind = row.kind === "start" ? "start" : "before";
          const id = localNotificationIdFor(String(task.id), kind);
          const url = `/?tab=today&day=${encodeURIComponent(dayKey)}&task=${encodeURIComponent(String(task.id))}`;
          notifications.push({
            id,
            title: "PROYOU",
            body: row.body,
            schedule: { at: new Date(atMs) },
            extra: {
              proyouSource: "task_reminder",
              taskId: String(task.id),
              dayKey,
              hourKey,
              category: String(task.category || ""),
              reminderType: kind,
              url,
            },
          });
        }
      }
    }
  }
  return notifications;
}

/**
 * Full resync: cancel PROYOU task locals, then schedule from app state.
 * iOS native only.
 */
export async function resyncIosTaskLocalNotifications(daysMap, startDayKey, categories, profile = null) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return;
  }

  try {
    const perm = await LocalNotifications.checkPermissions();
    const display = perm?.display ?? perm?.receive ?? "unknown";
    report({ localNotificationPermission: String(display) });

    if (display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      const d2 = req?.display ?? req?.receive ?? display;
      report({ localNotificationPermission: String(d2) });
      if (d2 !== "granted") {
        report({ lastLocalScheduleError: "Local notification permission not granted", scheduledLocalReminderCount: 0 });
        return;
      }
    }

    const pending = await LocalNotifications.getPending();
    const existing = Array.isArray(pending?.notifications) ? pending.notifications : [];
    const cancelIds = existing
      .filter((n) => n?.extra?.proyouSource === "task_reminder")
      .map((n) => n.id)
      .filter((id) => typeof id === "number");
    if (cancelIds.length) {
      await LocalNotifications.cancel({ notifications: cancelIds.map((id) => ({ id })) });
    }

    const toSchedule = collectIosLocalTaskNotifications(daysMap, startDayKey, categories, 8, profile);
    report({ scheduledLocalReminderCount: toSchedule.length, lastLocalScheduleError: null });

    const chunk = 32;
    for (let i = 0; i < toSchedule.length; i += chunk) {
      const slice = toSchedule.slice(i, i + chunk);
      if (slice.length) await LocalNotifications.schedule({ notifications: slice });
    }
  } catch (e) {
    const msg = e?.message || String(e);
    report({ lastLocalScheduleError: msg, scheduledLocalReminderCount: 0 });
    console.warn("[nativeTaskLocalNotifications]", msg, e);
  }
}
