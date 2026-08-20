import { playAlarmSound, notifyAlarm, stopAlarmSound } from "./alarmScheduler";
import { loadAlarmsFromDisk } from "./modules/timers";
import { isAlarmDismissedToday, markAlarmDismissedToday } from "./alarmDismissState.js";

export { isAlarmDismissedToday, markAlarmDismissedToday } from "./alarmDismissState.js";

const RINGING_KEY = "cute_schedule_ringing_alarm_v1";
const MAX_RING_MS = 30 * 60 * 1000;
const SNOOZE_WINDOW_MS = 15 * 60 * 1000;

export function persistRingingAlarm(alarm) {
  try {
    localStorage.setItem(
      RINGING_KEY,
      JSON.stringify({ alarmId: String(alarm.id), firedAt: Date.now() })
    );
  } catch {}
}

export function clearPersistedRingingAlarm() {
  try {
    localStorage.removeItem(RINGING_KEY);
  } catch {}
}

function loadPersistedRingingMeta() {
  try {
    const raw = localStorage.getItem(RINGING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.alarmId || !parsed?.firedAt) return null;
    if (Date.now() - parsed.firedAt > MAX_RING_MS) {
      clearPersistedRingingAlarm();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** True if this alarm's scheduled time was within the last `windowMs` on a valid repeat day. */
export function isAlarmInSnoozeWindow(alarm, windowMs = SNOOZE_WINDOW_MS) {
  if (!alarm?.enabled || !alarm.time) return false;
  const now = new Date();
  const [h, m] = alarm.time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const fire = new Date(now);
  fire.setHours(h, m, 0, 0);
  const days = Array.isArray(alarm.days) ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(fire.getDay())) return false;
  const delta = now.getTime() - fire.getTime();
  return delta >= 0 && delta <= windowMs;
}

/**
 * Find an alarm that should still be ringing (persisted session or recent fire window).
 * @param {Array} alarms
 */
export function resolveActiveRingingAlarm(alarms) {
  const list = Array.isArray(alarms) ? alarms : [];
  const meta = loadPersistedRingingMeta();
  if (meta) {
    const alarm = list.find((a) => String(a.id) === String(meta.alarmId));
    if (alarm?.enabled && !isAlarmDismissedToday(alarm.id)) return alarm;
    clearPersistedRingingAlarm();
  }
  for (const alarm of list) {
    if (!alarm?.enabled) continue;
    if (isAlarmDismissedToday(alarm.id)) continue;
    if (isAlarmInSnoozeWindow(alarm)) return alarm;
  }
  return null;
}

/**
 * Start alarm audio + vibration and persist until dismissed.
 * @param {object} alarm
 * @param {{ replayOnly?: boolean }} [opts]
 */
export function fireAlarm(alarm, opts = {}) {
  if (!alarm?.enabled) return;
  if (isAlarmDismissedToday(alarm.id)) return;
  if (!opts.replayOnly) persistRingingAlarm(alarm);
  void playAlarmSound(alarm);
  try {
    notifyAlarm(alarm);
  } catch (e) {
    console.warn("[fireAlarm] notify", e?.message || e);
  }
}

const SNOOZE_UNTIL_KEY = "cute_schedule_alarm_snooze_until_v1";

export function getPendingSnoozeAlarmId() {
  try {
    const raw = localStorage.getItem(SNOOZE_UNTIL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.alarmId || !parsed?.until) return null;
    if (Date.now() >= parsed.until) {
      localStorage.removeItem(SNOOZE_UNTIL_KEY);
      return String(parsed.alarmId);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Snooze without marking dismissed for today. Alarm rings again after `minutes`.
 * @param {object} alarm
 * @param {(alarm: object) => void} onFire
 * @param {number} [minutes]
 */
export function snoozeActiveAlarm(alarm, onFire, minutes = 9) {
  if (!alarm?.id) return;
  stopAlarmSound();
  clearPersistedRingingAlarm();
  const ms = Math.max(1, minutes) * 60 * 1000;
  const until = Date.now() + ms;
  try {
    localStorage.setItem(SNOOZE_UNTIL_KEY, JSON.stringify({ alarmId: String(alarm.id), until }));
  } catch {}
  setTimeout(() => {
    try {
      const raw = localStorage.getItem(SNOOZE_UNTIL_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.alarmId === String(alarm.id) && Date.now() >= parsed.until) {
        localStorage.removeItem(SNOOZE_UNTIL_KEY);
        if (!isAlarmDismissedToday(alarm.id)) onFire?.(alarm);
      }
    } catch {
      onFire?.(alarm);
    }
  }, ms);
}

/**
 * Stop alarm, clear persistence, mark dismissed for today.
 * @param {string} alarmId
 */
export async function dismissActiveAlarm(alarmId) {
  try {
    localStorage.removeItem(SNOOZE_UNTIL_KEY);
  } catch {}
  markAlarmDismissedToday(alarmId);
  clearPersistedRingingAlarm();
  stopAlarmSound();
  try {
    const { clearAlarmFireMemory } = await import("./alarmScheduler.js");
    clearAlarmFireMemory();
  } catch {}
  try {
    const { cancelAlarmNotificationsForAlarm, resyncAlarmNotifications } = await import(
      "./nativeAlarmNotifications"
    );
    await cancelAlarmNotificationsForAlarm(alarmId);
    const { alarms } = loadAlarmsFromDisk();
    await resyncAlarmNotifications(alarms);
  } catch (e) {
    console.warn("[dismissActiveAlarm]", e?.message || e);
  }
}

/** @param {object} extra */
export function alarmFromNotificationExtra(extra, alarms) {
  if (!extra || extra.proyouSource !== "alarm") return null;
  const alarmId = extra.alarmId != null ? String(extra.alarmId) : "";
  if (!alarmId) return null;
  const list = Array.isArray(alarms) ? alarms : [];
  return list.find((a) => String(a.id) === alarmId) || null;
}
