import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { normalizeActiveTimer } from "./modules/timers.js";
import { startNativeAlarmRinging, stopNativeAlarmRinging } from "./nativeAlarmRing.js";

const TASK_TIMER_NOTIF_ID = 750001;

export async function syncTaskFocusTimerNotification(active) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  const norm = normalizeActiveTimer(active);
  try {
    const pending = await LocalNotifications.getPending();
    const list = Array.isArray(pending?.notifications) ? pending.notifications : [];
    const ours = list.filter((n) => n?.extra?.proyouSource === "task_timer");
    if (ours.length) {
      await LocalNotifications.cancel({
        notifications: ours.map((n) => ({ id: n.id })).filter((n) => typeof n.id === "number"),
      });
    }
  } catch {}

  if (!norm?.running || !norm.endsAt || norm.endsAt <= Date.now()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    let display = perm?.display;
    if (display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      display = req?.display;
    }
    if (display !== "granted") return;

    const body = norm.linkedTask?.taskText
      ? `${norm.label} · ${norm.linkedTask.taskText}`
      : norm.label;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: TASK_TIMER_NOTIF_ID,
          title: "Task timer done",
          body: body.slice(0, 120),
          schedule: { at: new Date(norm.endsAt) },
          sound: "default",
          extra: { proyouSource: "task_timer" },
        },
      ],
    });
  } catch (e) {
    console.warn("[taskTimerNotify] schedule", e?.message || e);
  }
}

export async function cancelTaskFocusTimerNotification() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TASK_TIMER_NOTIF_ID }] });
  } catch {}
}

/** Plays through silent switch on iOS (playback session). */
export async function playTaskTimerCompleteAlert(label = "Timer") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 400]);
    } catch {}
  }
  if (Capacitor.isNativePlatform()) {
    const started = await startNativeAlarmRinging({ sound: "default" });
    if (started) {
      window.setTimeout(() => {
        void stopNativeAlarmRinging();
      }, 4500);
    }
  }
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Timer complete", { body: `${label} timer finished!` });
    }
  } catch {}
}
