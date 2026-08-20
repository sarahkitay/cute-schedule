import { Capacitor, registerPlugin } from "@capacitor/core";
import { normalizeAlarmSound, BUNDLED_ALARM_SOUND_FILES } from "./alarmSounds";

const ProyouAlarmKit = registerPlugin("ProyouAlarmKit");

export function isIosNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/**
 * True when AlarmKit is available (iOS 26+ device build with AlarmKit linked).
 */
export async function isAlarmKitAvailable() {
  if (!isIosNative()) return false;
  try {
    const r = await ProyouAlarmKit.isAvailable();
    return Boolean(r?.alarmKit);
  } catch {
    return false;
  }
}

export async function getAlarmKitAuthorizationState() {
  if (!isIosNative()) return "unavailable";
  try {
    const r = await ProyouAlarmKit.getAuthorizationState();
    return r?.state || "unknown";
  } catch {
    return "unknown";
  }
}

export async function requestAlarmKitAuthorization() {
  if (!isIosNative()) return "unavailable";
  try {
    const r = await ProyouAlarmKit.requestAuthorization();
    return r?.state || "unknown";
  } catch (e) {
    console.warn("[nativeAlarmKit] requestAuthorization", e?.message || e);
    return "denied";
  }
}

/**
 * @param {Array<object>} [alarms]
 */
export async function syncAlarmSoundsForAlarmKit(alarms = []) {
  if (!isIosNative() || !(await isAlarmKitAvailable())) return;
  const list = Array.isArray(alarms) ? alarms : [];
  const soundIds = new Set(["default", "digital", ...Object.keys(BUNDLED_ALARM_SOUND_FILES)]);
  for (const a of list) {
    if (a?.enabled === false) continue;
    soundIds.add(normalizeAlarmSound(a?.sound || "default"));
  }
  for (const soundId of soundIds) {
    try {
      await ProyouAlarmKit.installAlarmSound({ soundId });
    } catch (e) {
      console.warn("[nativeAlarmKit] installAlarmSound", soundId, e?.message || e);
    }
  }
}

/**
 * Sync enabled alarms to the system AlarmKit store (iOS 26+).
 * @param {Array<object>} alarms
 * @returns {Promise<{ scheduled: number, authorization?: string } | null>}
 */
export async function resyncAlarmKit(alarms) {
  if (!isIosNative()) return null;
  if (!(await isAlarmKitAvailable())) return null;
  await syncAlarmSoundsForAlarmKit(alarms);
  const list = Array.isArray(alarms) ? alarms : [];
  const payload = list.map((a) => ({
    id: String(a.id),
    time: a.time,
    label: a.label,
    days: (Array.isArray(a.days) ? a.days : [0, 1, 2, 3, 4, 5, 6])
      .map((d) => Number(d))
      .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6),
    enabled: a.enabled !== false,
    mode: a.mode || "standard",
    sound: normalizeAlarmSound(a.sound || "default"),
  }));
  return ProyouAlarmKit.resyncAlarms({ alarms: payload });
}

/**
 * AlarmKit "Open PROYOU" may set this before the deep link is handled.
 * @returns {Promise<string>}
 */
export async function consumePendingAlarmKitOpen() {
  if (!isIosNative()) return "";
  try {
    const r = await ProyouAlarmKit.consumePendingAlarmOpen();
    return r?.alarmId ? String(r.alarmId) : "";
  } catch {
    return "";
  }
}

/** Lock-screen Stop on a standard AlarmKit alarm (marks dismissed without opening challenge). */
export async function consumePendingAlarmDismissed() {
  if (!isIosNative()) return "";
  try {
    const r = await ProyouAlarmKit.consumePendingAlarmDismiss();
    return r?.alarmId ? String(r.alarmId) : "";
  } catch {
    return "";
  }
}

/**
 * @param {string|number} alarmId
 */
export async function cancelAlarmKit(alarmId) {
  if (!isIosNative()) return;
  try {
    await ProyouAlarmKit.cancelAlarm({ alarmId: String(alarmId) });
  } catch (e) {
    console.warn("[nativeAlarmKit] cancel", e?.message || e);
  }
}

/**
 * Schedule a Clock-style focus timer via AlarmKit (iOS 26+).
 * @param {{ label?: string, durationSec: number, sessionId: string }} opts
 */
export async function scheduleFocusTimerKit(opts) {
  if (!isIosNative() || !(await isAlarmKitAvailable())) return null;
  const durationSec = Number(opts?.durationSec);
  const sessionId = opts?.sessionId ? String(opts.sessionId) : "";
  if (!sessionId || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  try {
    const auth = await getAlarmKitAuthorizationState();
    if (auth !== "authorized") {
      const next = await requestAlarmKitAuthorization();
      if (next !== "authorized") return { scheduled: 0, authorization: next };
    }
    return await ProyouAlarmKit.scheduleFocusTimer({
      label: opts?.label || "Focus timer",
      durationSec,
      sessionId,
    });
  } catch (e) {
    console.warn("[nativeAlarmKit] scheduleFocusTimer", e?.message || e, e?.code);
    return { scheduled: 0, error: e?.message || String(e), code: e?.code || "" };
  }
}

export async function cancelFocusTimerKit() {
  if (!isIosNative()) return;
  try {
    await ProyouAlarmKit.cancelFocusTimer();
  } catch (e) {
    console.warn("[nativeAlarmKit] cancelFocusTimer", e?.message || e);
  }
}

export async function consumePendingFocusTimerDismiss() {
  if (!isIosNative()) return "";
  try {
    const r = await ProyouAlarmKit.consumePendingFocusTimerDismiss();
    return r?.sessionId ? String(r.sessionId) : "";
  } catch {
    return "";
  }
}

export async function consumePendingFocusTimerOpen() {
  if (!isIosNative()) return "";
  try {
    const r = await ProyouAlarmKit.consumePendingFocusTimerOpen();
    return r?.sessionId ? String(r.sessionId) : "";
  } catch {
    return "";
  }
}
