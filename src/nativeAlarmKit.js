import { Capacitor, registerPlugin } from "@capacitor/core";
import { ALARM_SOUND_IDS } from "./alarmSounds";
import { getCustomAlarmSound } from "./alarmSounds";

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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fileExtensionFromMime(mimeType, fileName) {
  if (fileName && fileName.includes(".")) {
    return fileName.split(".").pop().toLowerCase();
  }
  if (mimeType?.includes("mpeg")) return "mp3";
  if (mimeType?.includes("wav")) return "wav";
  return "m4a";
}

/**
 * Copy one imported clip into iOS Library/Sounds for AlarmKit (lock-screen alarm audio).
 * @param {string} customSoundId
 * @param {{ path?: string, file?: File | Blob, mimeType?: string }} [opts]
 */
export async function installCustomSoundForAlarmKit(customSoundId, opts = {}) {
  if (!isIosNative() || !customSoundId) return;
  try {
    if (opts.path) {
      await ProyouAlarmKit.installCustomSound({ customSoundId, path: opts.path });
      return;
    }
    const blob = opts.file;
    if (!blob) return;
    const base64 = await blobToBase64(blob);
    const ext = fileExtensionFromMime(opts.mimeType || blob.type, blob.name);
    await ProyouAlarmKit.installCustomSound({
      customSoundId,
      base64,
      fileExtension: ext,
    });
  } catch (e) {
    console.warn("[nativeAlarmKit] installCustomSound", e?.message || e);
  }
}

/**
 * Ensures every custom alarm sound used by enabled alarms is installed for AlarmKit.
 * @param {Array<object>} alarms
 */
export async function syncCustomSoundsForAlarmKit(alarms) {
  if (!isIosNative() || !(await isAlarmKitAvailable())) return;
  const list = Array.isArray(alarms) ? alarms : [];
  const ids = new Set();
  for (const a of list) {
    if (a?.enabled === false) continue;
    if (a?.sound === ALARM_SOUND_IDS.CUSTOM && a?.customSoundId) {
      ids.add(String(a.customSoundId));
    }
  }
  for (const id of ids) {
    const rec = await getCustomAlarmSound(id);
    if (!rec?.blob) continue;
    await installCustomSoundForAlarmKit(id, {
      file: rec.blob,
      mimeType: rec.mimeType,
    });
  }
}

/**
 * Sync enabled alarms to the system AlarmKit store (iOS 26+).
 * @param {Array<object>} alarms
 * @returns {Promise<{ scheduled: number, authorization?: string } | null>}
 */
export async function resyncAlarmKit(alarms) {
  if (!isIosNative()) return null;
  await syncCustomSoundsForAlarmKit(alarms);
  const list = Array.isArray(alarms) ? alarms : [];
  const payload = list.map((a) => ({
    id: String(a.id),
    time: a.time,
    label: a.label,
    days: Array.isArray(a.days) ? a.days : [0, 1, 2, 3, 4, 5, 6],
    enabled: a.enabled !== false,
    mode: a.mode,
    sound: a.sound || "default",
    customSoundId:
      a.sound === ALARM_SOUND_IDS.CUSTOM && a.customSoundId
        ? String(a.customSoundId)
        : undefined,
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
