import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { normalizeActiveTimer } from "./modules/timers.js";
import { startNativeAlarmRinging, stopNativeAlarmRinging } from "./nativeAlarmRing.js";
import {
  cancelFocusTimerKit,
  getAlarmKitAuthorizationState,
  isAlarmKitAvailable,
  requestAlarmKitAuthorization,
  scheduleFocusTimerKit,
} from "./nativeAlarmKit.js";

const TASK_TIMER_NOTIF_BASE_ID = 750001;
/** Repeat alerts when AlarmKit is unavailable (older iOS). */
const TIMER_REMINDER_OFFSETS_SEC = [0, 30, 60, 90, 120, 180];
const TASK_TIMER_FIRED_EVENT = "proyou:task-timer-notification";
const RING_SAFETY_STOP_MS = 5 * 60 * 1000;

let activeRingStopTimer = null;
let timerAlertsMuted = false;
let focusTimerUsesAlarmKit = false;
let ringing = false;
/** @type {Set<(v: boolean) => void>} */
const ringingListeners = new Set();

function notifyRinging(next) {
  ringing = next;
  ringingListeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeTaskTimerRinging(listener) {
  if (typeof listener !== "function") return () => {};
  ringingListeners.add(listener);
  listener(ringing);
  return () => ringingListeners.delete(listener);
}

export function isTaskTimerRinging() {
  return ringing;
}

export function focusTimerScheduledWithAlarmKit() {
  return focusTimerUsesAlarmKit;
}

export function clearTaskTimerDismissedSession() {
  timerAlertsMuted = false;
}

async function ensureTimerPermissions() {
  if (typeof window === "undefined") return { ok: false, alarmKit: false, notifications: false };
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {}

  let alarmKit = false;
  if (Capacitor.getPlatform() === "ios" && (await isAlarmKitAvailable())) {
    let auth = await getAlarmKitAuthorizationState();
    if (auth === "notDetermined") auth = await requestAlarmKitAuthorization();
    alarmKit = auth === "authorized";
  }

  let notifications = false;
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      const display = perm?.display ?? perm?.receive;
      if (display === "granted") notifications = true;
      else {
        const req = await LocalNotifications.requestPermissions();
        const d2 = req?.display ?? req?.receive;
        notifications = d2 === "granted";
      }
    } catch {}
  } else {
    notifications =
      typeof Notification !== "undefined" && Notification.permission === "granted";
  }

  return { ok: alarmKit || notifications, alarmKit, notifications };
}

export async function requestTimerNotificationPermissions() {
  const r = await ensureTimerPermissions();
  return r.ok;
}

function timerNotificationId(index) {
  return TASK_TIMER_NOTIF_BASE_ID + index;
}

function timerSessionIdFromEndsAt(endsAt) {
  return endsAt != null ? String(endsAt) : null;
}

async function cancelLocalTimerNotifications() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  try {
    const ids = TIMER_REMINDER_OFFSETS_SEC.map((_, i) => ({ id: timerNotificationId(i) }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch {}
  try {
    const delivered = await LocalNotifications.getDeliveredNotifications();
    const list = Array.isArray(delivered?.notifications) ? delivered.notifications : [];
    const remove = list
      .filter((n) => n?.extra?.proyouSource === "task_timer")
      .map((n) => ({ id: n.id }))
      .filter((n) => typeof n.id === "number");
    if (remove.length) {
      await LocalNotifications.removeDeliveredNotifications({ notifications: remove });
    }
  } catch {}
}

export async function cancelTaskFocusTimerNotification() {
  focusTimerUsesAlarmKit = false;
  await cancelFocusTimerKit();
  await cancelLocalTimerNotifications();
}

async function scheduleLocalTimerNotifications(norm, body, sessionId) {
  const endsAtMs = norm.endsAt;
  const nowMs = Date.now();
  const title = "Timer finished";

  /** @type {import('@capacitor/local-notifications').LocalNotificationSchema[]} */
  const notifications = [];
  for (let i = 0; i < TIMER_REMINDER_OFFSETS_SEC.length; i++) {
    const atMs = endsAtMs + TIMER_REMINDER_OFFSETS_SEC[i] * 1000;
    if (atMs < nowMs + 3000) continue;
    notifications.push({
      id: timerNotificationId(i),
      title: i === 0 ? title : "Timer still ringing",
      body: body.slice(0, 120),
      schedule: { at: new Date(atMs), allowWhileIdle: true },
      sound: "default",
      extra: {
        proyouSource: "task_timer",
        timerLabel: norm.label || "Focus",
        timerSessionId: sessionId,
      },
    });
  }

  if (!notifications.length) return 0;
  await LocalNotifications.schedule({ notifications });
  return notifications.length;
}

export async function syncTaskFocusTimerNotification(active) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    return { granted: false, scheduled: 0, mode: "none" };
  }

  const norm = normalizeActiveTimer(active);
  await cancelTaskFocusTimerNotification();

  if (!norm?.running || !norm.endsAt || norm.endsAt <= Date.now()) {
    return { granted: true, scheduled: 0, mode: "none" };
  }

  clearTaskTimerDismissedSession();

  const perms = await ensureTimerPermissions();
  const body = norm.linkedTask?.taskText
    ? `${norm.label} · ${norm.linkedTask.taskText}`
    : norm.label;
  const sessionId = timerSessionIdFromEndsAt(norm.endsAt);
  const remainingSec = Math.max(1, Math.ceil((norm.endsAt - Date.now()) / 1000));

  if (Capacitor.getPlatform() === "ios" && perms.alarmKit) {
    const kit = await scheduleFocusTimerKit({
      label: body.slice(0, 80) || norm.label || "Focus timer",
      durationSec: remainingSec,
      sessionId,
    });
    if (kit && Number(kit.scheduled) >= 1) {
      focusTimerUsesAlarmKit = true;
      return { granted: true, scheduled: 1, mode: "alarmKit" };
    }
    if (kit?.authorization && kit.authorization !== "authorized") {
      console.warn("[taskTimerNotify] AlarmKit auth:", kit.authorization);
    }
  }

  if (!perms.notifications) {
    console.warn(
      "[taskTimerNotify] Timer permissions missing - allow Alarms and/or Notifications for PROYOU in Settings.",
    );
    return { granted: false, scheduled: 0, mode: "none" };
  }

  try {
    const count = await scheduleLocalTimerNotifications(norm, body, sessionId);
    focusTimerUsesAlarmKit = false;
    return { granted: true, scheduled: count, mode: "notification" };
  } catch (e) {
    console.warn("[taskTimerNotify] schedule", e?.message || e);
    return { granted: true, scheduled: 0, mode: "notification", error: e?.message || String(e) };
  }
}

/** Stop in-app timer audio and cancel system timer / notifications. */
export async function stopTaskTimerCompleteAlert() {
  if (activeRingStopTimer) {
    clearTimeout(activeRingStopTimer);
    activeRingStopTimer = null;
  }
  timerAlertsMuted = true;
  notifyRinging(false);
  await stopNativeAlarmRinging();
  await cancelTaskFocusTimerNotification();
}

/** In-app ring fallback (iOS 18-25 and web). AlarmKit handles audio on iOS 26+. */
export async function playTaskTimerCompleteAlert(label = "Timer", sessionId = null) {
  if (timerAlertsMuted) return;
  void sessionId;

  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 400]);
    } catch {}
  }

  if (activeRingStopTimer) {
    clearTimeout(activeRingStopTimer);
    activeRingStopTimer = null;
  }

  notifyRinging(true);

  if (focusTimerUsesAlarmKit) {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    const started = await startNativeAlarmRinging({ sound: "chime" });
    if (started) {
      activeRingStopTimer = window.setTimeout(() => {
        void stopTaskTimerCompleteAlert();
      }, RING_SAFETY_STOP_MS);
      return;
    }
  }

  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Timer finished", { body: `${label} timer finished!`, tag: "proyou-task-timer" });
    }
  } catch {}
}

export function handleTaskTimerNotificationExtra(extra) {
  if (!extra || extra.proyouSource !== "task_timer") return false;
  if (timerAlertsMuted) {
    void cancelLocalTimerNotifications();
    return true;
  }
  const timerLabel = typeof extra.timerLabel === "string" ? extra.timerLabel : "Focus";
  const sessionId =
    extra.timerSessionId != null ? String(extra.timerSessionId) : null;

  void cancelLocalTimerNotifications();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TASK_TIMER_FIRED_EVENT, {
        detail: { label: timerLabel, sessionId, extra },
      }),
    );
  }

  void playTaskTimerCompleteAlert(timerLabel, sessionId);
  return true;
}

export { TASK_TIMER_FIRED_EVENT };
