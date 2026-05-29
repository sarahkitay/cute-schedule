import { Capacitor } from "@capacitor/core";
import { getNextAlarmTime, alarmRequiresWakeUpChallenge } from "./modules/timers";
import { playAlarmSoundForAlarm, stopAlarmSoundPlayback } from "./alarmSounds";
const DISMISSED_KEY = "cute_schedule_alarm_dismissed_v1";

function isAlarmDismissedTodayLocal(alarmId) {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return map[today]?.[String(alarmId)] === true;
  } catch {
    return false;
  }
}

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
  const body = alarmRequiresWakeUpChallenge(alarm)
    ? alarm.mode === "math_dismiss"
      ? "Complete the wake-up challenge to dismiss."
      : "Type the phrase to turn off your alarm."
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
const ALARM_FIRE_GRACE_MS = 20 * 60 * 1000;

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
      if (isAlarmDismissedTodayLocal(alarm.id)) continue;

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
  }
}

export function clearAlarmFireMemory() {
  firedKeys.clear();
}
