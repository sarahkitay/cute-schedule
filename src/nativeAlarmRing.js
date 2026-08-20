import { Capacitor, registerPlugin } from "@capacitor/core";
import { normalizeAlarmSound } from "./alarmSounds";

const ProyouAlarmSound = registerPlugin("ProyouAlarmSound");

export function isNativeAlarmRingAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/**
 * @param {{ sound?: string }} alarm
 * @returns {Promise<boolean>}
 */
export async function startNativeAlarmRinging(alarm) {
  if (!isNativeAlarmRingAvailable()) return false;
  try {
    await ProyouAlarmSound.startRinging({
      sound: normalizeAlarmSound(alarm?.sound || "default"),
    });
    return true;
  } catch (e) {
    console.warn("[nativeAlarmRing] start", e?.message || e);
    return false;
  }
}

export async function previewNativeAlarmSound(soundId) {
  if (!isNativeAlarmRingAvailable()) return false;
  try {
    await ProyouAlarmSound.previewSound({
      sound: normalizeAlarmSound(soundId || "default"),
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
