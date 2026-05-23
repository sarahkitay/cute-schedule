import { Capacitor } from "@capacitor/core";
import { getNextAlarmTime, ALARM_MODES } from "./modules/timers";

let audioCtx = null;
let alarmInterval = null;
let alarmOscillators = [];

/** @type {((alarm: import("./modules/timers").createAlarm extends (...args: any) => infer R ? R : never) => void) | null} */
let onFireCallback = null;
const firedKeys = new Set();

function alarmFireKey(alarmId, atMs) {
  return `${alarmId}:${Math.floor(atMs / 60000)}`;
}

export function playAlarmSound(mode = ALARM_MODES.STANDARD) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();

    stopAlarmSound();

    const gentle = mode === ALARM_MODES.GENTLE;
    const count = gentle ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = gentle ? 440 + i * 40 : 520 + i * 60;
      gain.gain.value = gentle ? 0.08 : 0.14;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.15);
      alarmOscillators.push(osc);
    }

    alarmInterval = setInterval(() => {
      for (let i = 0; i < count; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = gentle ? 440 + i * 40 : 520 + i * 60;
        gain.gain.value = gentle ? 0.1 : 0.16;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = audioCtx.currentTime;
        osc.start(t);
        osc.stop(t + 0.35);
      }
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {}
    }, gentle ? 2200 : 1400);
  } catch {
    /* ignore */
  }
}

export function stopAlarmSound() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  for (const osc of alarmOscillators) {
    try {
      osc.stop();
    } catch {}
  }
  alarmOscillators = [];
}

export function notifyAlarm(alarm) {
  const title = alarm.label || "Morning alarm";
  const body =
    alarm.mode === ALARM_MODES.MATH_DISMISS
      ? "Complete the wake-up challenge to dismiss."
      : alarm.mode === ALARM_MODES.ACTION_REQUIRED
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
      playAlarmSound(alarm.mode);
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
