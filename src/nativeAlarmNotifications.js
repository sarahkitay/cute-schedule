import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { alarmNotificationBody } from "./modules/timers";
import { iosNotificationSoundForAlarm } from "./alarmSounds";
import {
  isAlarmKitAvailable,
  resyncAlarmKit,
  cancelAlarmKit,
  getAlarmKitAuthorizationState,
} from "./nativeAlarmKit.js";

/** Snooze reminders every 60s for 15 minutes so tapping opens PROYOU until dismissed. */
const SNOOZE_OFFSETS_SEC = [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840];

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
  await cancelAlarmKit(idStr);

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

async function cancelAllProyouAlarmLocalNotifications() {
  const pending = await LocalNotifications.getPending();
  const existing = Array.isArray(pending?.notifications) ? pending.notifications : [];
  const cancelIds = existing
    .filter((n) => n?.extra?.proyouSource === "alarm")
    .map((n) => n.id)
    .filter((id) => typeof id === "number");
  if (cancelIds.length) {
    await LocalNotifications.cancel({ notifications: cancelIds.map((id) => ({ id })) });
  }
}

/**
 * Schedule alarms: AlarmKit on iOS 26+ (system morning alarm), else local notifications.
 * @param {Array} alarms
 */
export async function resyncAlarmNotifications(alarms) {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;

  const list = Array.isArray(alarms) ? alarms : [];

  if (Capacitor.getPlatform() === "ios" && (await isAlarmKitAvailable())) {
    try {
      const auth = await getAlarmKitAuthorizationState();
      if (auth === "authorized") {
        const result = await resyncAlarmKit(list);
        const scheduled = result?.scheduled ?? 0;
        if (scheduled > 0) {
          await cancelAllProyouAlarmLocalNotifications();
          return;
        }
      }
    } catch (e) {
      console.warn("[nativeAlarmNotifications] AlarmKit sync failed, using local notifications:", e?.message || e);
    }
  }

  try {
    const perm = await LocalNotifications.checkPermissions();
    const display = perm?.display ?? perm?.receive ?? "unknown";
    if (display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      const d2 = req?.display ?? req?.receive ?? display;
      if (d2 !== "granted") return;
    }

    await cancelAllProyouAlarmLocalNotifications();

    /** @type {import('@capacitor/local-notifications').LocalNotificationSchema[]} */
    const toSchedule = [];
    const nowMs = Date.now();

    for (const alarm of list) {
      if (!alarm?.enabled || !alarm?.time) continue;
      const [h, m] = alarm.time.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      const days =
        Array.isArray(alarm.days) && alarm.days.length > 0
          ? alarm.days
          : [0, 1, 2, 3, 4, 5, 6];

      for (let offset = 0; offset < 14; offset++) {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() + offset);
        if (!days.includes(day.getDay())) continue;

        const occurrenceMs = new Date(day).setHours(h, m, 0, 0);
        if (occurrenceMs < nowMs + 5000) continue;

        for (let si = 0; si < SNOOZE_OFFSETS_SEC.length; si++) {
          const at = new Date(occurrenceMs + SNOOZE_OFFSETS_SEC[si] * 1000);
          if (at.getTime() < nowMs + 5000) continue;
          const id =
            si === 0
              ? localNotificationIdForAlarm(alarm.id, offset * 100 + si)
              : localNotificationIdForAlarmSnooze(alarm.id, offset, si);
          const isSnooze = si > 0;
          toSchedule.push({
            id,
            title: alarm.label || "Morning alarm",
            body: alarmNotificationBody(alarm, isSnooze),
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
      }
    }

    if (toSchedule.length > 0) {
      const batch = 48;
      for (let i = 0; i < toSchedule.length; i += batch) {
        await LocalNotifications.schedule({ notifications: toSchedule.slice(i, i + batch) });
      }
    }
  } catch (e) {
    console.warn("[nativeAlarmNotifications]", e?.message || e);
  }
}

/** @deprecated use resyncAlarmNotifications */
export const resyncIosAlarmNotifications = resyncAlarmNotifications;
