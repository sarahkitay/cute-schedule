import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getNextAlarmTime } from "./modules/timers";
import { iosNotificationSoundForAlarm } from "./alarmSounds";

export function localNotificationIdForAlarm(alarmId, dayOffset = 0) {
  let h = dayOffset * 997;
  for (let i = 0; i < String(alarmId).length; i++) {
    h = ((h << 5) - h + String(alarmId).charCodeAt(i)) | 0;
  }
  return Math.abs(h % 800000) + 200000;
}

/**
 * Schedule the next occurrence for each enabled alarm (iOS native).
 * @param {Array} alarms
 */
export async function resyncIosAlarmNotifications(alarms) {
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
        const at = new Date(base.getTime() + offset * 86400000);
        if (at.getTime() < nowMs + 5000) continue;
        if (!probe.days.includes(at.getDay())) continue;
        const id = localNotificationIdForAlarm(alarm.id, offset);
        toSchedule.push({
          id,
          title: alarm.label || "Morning alarm",
          body: "Tap to open PROYOU and complete your wake-up challenge.",
          schedule: { at },
          sound: iosNotificationSoundForAlarm(alarm),
          extra: {
            proyouSource: "alarm",
            alarmId: String(alarm.id),
            alarmMode: alarm.mode,
          },
        });
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
