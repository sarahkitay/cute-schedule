import { Capacitor, registerPlugin } from "@capacitor/core";
import { getCustomAlarmSound } from "./alarmSounds";

const ProyouAlarmSound = registerPlugin("ProyouAlarmSound");

export function isNativeAlarmRingAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

async function customPayload(customSoundId) {
  if (!customSoundId) return {};
  const rec = await getCustomAlarmSound(customSoundId);
  if (!rec?.blob) return {};
  const base64 = await blobToBase64(rec.blob);
  return { customBase64: base64 };
}

/**
 * @param {{ sound?: string, customSoundId?: string }} alarm
 * @returns {Promise<boolean>}
 */
export async function startNativeAlarmRinging(alarm) {
  if (!isNativeAlarmRingAvailable()) return false;
  try {
    const extra = await customPayload(alarm?.customSoundId);
    await ProyouAlarmSound.startRinging({
      sound: alarm?.sound || "default",
      ...extra,
    });
    return true;
  } catch (e) {
    console.warn("[nativeAlarmRing] start", e?.message || e);
    return false;
  }
}

export async function previewNativeAlarmSound(soundId, customSoundId = null) {
  if (!isNativeAlarmRingAvailable()) return false;
  try {
    const extra = await customPayload(customSoundId);
    await ProyouAlarmSound.previewSound({
      sound: soundId || "default",
      ...extra,
    });
    return true;
  } catch (e) {
    console.warn("[nativeAlarmRing] preview", e?.message || e);
    return false;
  }
}

export async function stopNativeAlarmRinging() {
  if (!isNativeAlarmRingAvailable()) return;
  try {
    await ProyouAlarmSound.stopRinging();
  } catch {}
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
