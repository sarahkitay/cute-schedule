import { Capacitor } from "@capacitor/core";
import { getNextAlarmTime } from "./modules/timers";
import { playAlarmSoundForAlarm, stopAlarmSoundPlayback } from "./alarmSounds";

/** @type {((alarm: object) => void) | null} */
let onFireCallback = null;
const firedKeys = new Set();

function alarmFireKey(alarmId, atMs) {
  return `${alarmId}:${Math.floor(atMs / 60000)}`;
}

export function playAlarmSound(alarm) {
  playAlarmSoundForAlarm(typeof alarm === "object" ? alarm : { sound: "default", mode: alarm });
}

export function stopAlarmSound() {
  stopAlarmSoundPlayback();
}

export function notifyAlarm(alarm) {
  const title = alarm.label || "Morning alarm";
  const body =
    alarm.mode === "math_dismiss"
      ? "Complete the wake-up challenge to dismiss."
      : alarm.mode === "action_required"
        ? "Type the phrase to turn off your alarm."
        : "Time to wake up!";
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
export function startAlarmWatcher(alarms, onFire) {
  onFireCallback = onFire;
  const tick = () => {
    const list = Array.isArray(alarms) ? alarms : [];
    const now = Date.now();
    for (const alarm of list) {
      if (!alarm?.enabled) continue;
      const next = getNextAlarmTime(alarm);
      if (!next) continue;
      const delta = next.getTime() - now;
      if (delta > 0 || delta < -120000) continue;
      const key = alarmFireKey(alarm.id, next.getTime());
      if (firedKeys.has(key)) continue;
      firedKeys.add(key);
      playAlarmSound(alarm);
      notifyAlarm(alarm);
      onFireCallback?.(alarm);
    }
  };
  tick();
  const id = setInterval(tick, 5000);
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
  }
}

export function clearAlarmFireMemory() {
  firedKeys.clear();
}
