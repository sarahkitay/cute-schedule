import { Capacitor } from "@capacitor/core";
import { getNextAlarmTime, alarmNotificationBody } from "./modules/timers";
import { playAlarmSoundForAlarm, stopAlarmSoundPlayback } from "./alarmSounds";
import { isAlarmDismissedToday } from "./alarmDismissState.js";

/** @type {((alarm: object) => void) | null} */
let onFireCallback = null;
const firedKeys = new Set();

function alarmFireKey(alarmId, atMs) {
  return `${alarmId}:${Math.floor(atMs / 60000)}`;
}

export async function playAlarmSound(alarm) {
  const a = typeof alarm === "object" ? alarm : { sound: "default", mode: alarm };
  stopAlarmSoundPlayback();
  try {
    const { startNativeAlarmRinging, isNativeAlarmRingAvailable } = await import("./nativeAlarmRing.js");
    if (isNativeAlarmRingAvailable()) {
      const ok = await startNativeAlarmRinging(a);
      if (ok) return;
    }
  } catch {}
  await playAlarmSoundForAlarm(a);
}

export function stopAlarmSound() {
  stopAlarmSoundPlayback();
}

export function notifyAlarm(alarm) {
  const title = alarm.label || "Morning alarm";
  const body = alarmNotificationBody(alarm);
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, tag: `proyou-alarm-${alarm.id}` });
    }
  } catch {}
  try {
    navigator.vibrate?.([300, 120, 300, 120, 300]);
  } catch {}
}

/**
 * Poll enabled alarms while the app is open (web + native foreground).
 * @param {Array} alarms
 * @param {(alarm: object) => void} onFire
 * @returns {() => void}
 */
/** Match snooze window in alarmRinging.js and local notification chain length. */
const ALARM_FIRE_GRACE_MS = 15 * 60 * 1000;

function todayFireTimeMs(alarm) {
  if (!alarm?.time) return null;
  const [h, m] = alarm.time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const fire = new Date();
  fire.setHours(h, m, 0, 0);
  const days = Array.isArray(alarm.days) ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(fire.getDay())) return null;
  return fire.getTime();
}

export function startAlarmWatcher(alarms, onFire) {
  onFireCallback = onFire;
  const tick = () => {
    const list = Array.isArray(alarms) ? alarms : [];
    const now = Date.now();
    for (const alarm of list) {
      if (!alarm?.enabled) continue;
      if (isAlarmDismissedToday(alarm.id)) continue;

      const todayMs = todayFireTimeMs(alarm);
      if (todayMs != null) {
        const deltaToday = now - todayMs;
        if (deltaToday >= 0 && deltaToday <= ALARM_FIRE_GRACE_MS) {
          const key = alarmFireKey(alarm.id, todayMs);
          if (!firedKeys.has(key)) {
            firedKeys.add(key);
            onFireCallback?.(alarm);
            continue;
          }
        }
      }

      const next = getNextAlarmTime(alarm);
      if (!next) continue;
      const delta = next.getTime() - now;
      if (delta > 30000 || delta < -60000) continue;
      const key = alarmFireKey(alarm.id, next.getTime());
      if (firedKeys.has(key)) continue;
      firedKeys.add(key);
      onFireCallback?.(alarm);
    }
  };
  tick();
  const id = setInterval(tick, 2000);
  return () => {
    clearInterval(id);
    onFireCallback = null;
  };
}

export async function requestAlarmPermissions() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {}
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.checkPermissions();
      const display = perm?.display ?? perm?.receive;
      if (display !== "granted") await LocalNotifications.requestPermissions();
    } catch {}
    if (Capacitor.getPlatform() === "ios") {
      try {
        const { isAlarmKitAvailable, requestAlarmKitAuthorization } = await import("./nativeAlarmKit.js");
        if (await isAlarmKitAvailable()) {
          await requestAlarmKitAuthorization();
        }
      } catch {}
    }
  }
}

export function clearAlarmFireMemory() {
  firedKeys.clear();
}
