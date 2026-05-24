import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getNextAlarmTime } from "./modules/timers";
import { iosNotificationSoundForAlarm } from "./alarmSounds";

/** Snooze reminders every 60s for 10 minutes so tapping opens PROYOU until dismissed. */
const SNOOZE_OFFSETS_SEC = [0, 60, 120, 180, 240, 300, 360, 420, 480, 540];

export function localNotificationIdForAlarm(alarmId, dayOffset = 0) {
  let h = dayOffset * 997;
  for (let i = 0; i < String(alarmId).length; i++) {
    h = ((h << 5) - h + String(alarmId).charCodeAt(i)) | 0;
  }
  return Math.abs(h % 800000) + 200000;
}

export function localNotificationIdForAlarmSnooze(alarmId, dayOffset, snoozeIndex) {
  return localNotificationIdForAlarm(`${alarmId}:snooze:${snoozeIndex}`, dayOffset + snoozeIndex * 31);
}

/**
 * Cancel pending + delivered notifications for one alarm (main + snooze chain).
 * @param {string|number} alarmId
 */
export async function cancelAlarmNotificationsForAlarm(alarmId) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  const idStr = String(alarmId);

  try {
    const pending = await LocalNotifications.getPending();
    const pendingList = Array.isArray(pending?.notifications) ? pending.notifications : [];
    const cancelPending = pendingList
      .filter((n) => n?.extra?.proyouSource === "alarm" && String(n.extra?.alarmId) === idStr)
      .map((n) => ({ id: n.id }))
      .filter((n) => typeof n.id === "number");
    if (cancelPending.length) {
      await LocalNotifications.cancel({ notifications: cancelPending });
    }
  } catch (e) {
    console.warn("[cancelAlarmNotificationsForAlarm] pending", e?.message || e);
  }

  try {
    const delivered = await LocalNotifications.getDeliveredNotifications();
    const deliveredList = Array.isArray(delivered?.notifications) ? delivered.notifications : [];
    const removeDelivered = deliveredList
      .filter((n) => n?.extra?.proyouSource === "alarm" && String(n.extra?.alarmId) === idStr)
      .map((n) => ({ id: n.id }))
      .filter((n) => typeof n.id === "number");
    if (removeDelivered.length) {
      await LocalNotifications.removeDeliveredNotifications({ notifications: removeDelivered });
    }
  } catch (e) {
    console.warn("[cancelAlarmNotificationsForAlarm] delivered", e?.message || e);
  }
}

/**
 * Schedule the next occurrence (+ snooze chain) for each enabled alarm on native iOS/Android.
 * @param {Array} alarms
 */
export async function resyncAlarmNotifications(alarms) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    const display = perm?.display ?? perm?.receive ?? "unknown";
    if (display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      const d2 = req?.display ?? req?.receive ?? display;
      if (d2 !== "granted") return;
    }

    const pending = await LocalNotifications.getPending();
    const existing = Array.isArray(pending?.notifications) ? pending.notifications : [];
    const cancelIds = existing
      .filter((n) => n?.extra?.proyouSource === "alarm")
      .map((n) => n.id)
      .filter((id) => typeof id === "number");
    if (cancelIds.length) {
      await LocalNotifications.cancel({ notifications: cancelIds.map((id) => ({ id })) });
    }

    /** @type {import('@capacitor/local-notifications').LocalNotificationSchema[]} */
    const toSchedule = [];
    const list = Array.isArray(alarms) ? alarms : [];
    const nowMs = Date.now();

    for (const alarm of list) {
      if (!alarm?.enabled) continue;
      for (let offset = 0; offset < 14; offset++) {
        const probe = { ...alarm };
        const base = getNextAlarmTime(probe);
        if (!base) break;
        const occurrenceMs = base.getTime() + offset * 86400000;
        if (occurrenceMs < nowMs + 5000) continue;
        const atOccurrence = new Date(occurrenceMs);
        if (!probe.days.includes(atOccurrence.getDay())) continue;

        for (let si = 0; si < SNOOZE_OFFSETS_SEC.length; si++) {
          const at = new Date(occurrenceMs + SNOOZE_OFFSETS_SEC[si] * 1000);
          if (at.getTime() < nowMs + 5000) continue;
          const id =
            si === 0
              ? localNotificationIdForAlarm(alarm.id, offset)
              : localNotificationIdForAlarmSnooze(alarm.id, offset, si);
          const isSnooze = si > 0;
          toSchedule.push({
            id,
            title: alarm.label || "Morning alarm",
            body: isSnooze
              ? "Alarm still ringing — tap to open PROYOU and complete your wake-up challenge."
              : "Tap to open PROYOU and complete your wake-up challenge.",
            schedule: { at },
            sound: iosNotificationSoundForAlarm(alarm),
            extra: {
              proyouSource: "alarm",
              alarmId: String(alarm.id),
              alarmMode: alarm.mode,
              isSnooze,
            },
          });
        }
        break;
      }
    }

    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (e) {
    console.warn("[nativeAlarmNotifications]", e?.message || e);
  }
}

/** @deprecated use resyncAlarmNotifications */
export const resyncIosAlarmNotifications = resyncAlarmNotifications;
