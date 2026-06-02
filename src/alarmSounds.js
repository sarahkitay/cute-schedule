/**
 * Alarm sound catalog, built-in Web Audio tones, and custom audio (IndexedDB).
 */

import { getMelodyVariant, melodyDurationSec } from "./alarmBuiltinMelodies.js";

export const ALARM_SOUND_IDS = Object.freeze({
  DEFAULT: "default",
  CHIME: "chime",
  BELLS: "bells",
  DIGITAL: "digital",
  BIRDS: "birds",
  PIANO: "piano",
  SPARKLE: "sparkle",
  MUSICBOX: "musicbox",
  CUSTOM: "custom",
});

export const BUILTIN_ALARM_SOUNDS = Object.freeze([
  { id: ALARM_SOUND_IDS.DEFAULT, label: "Sunrise", desc: "Soft ascending wake-up" },
  { id: ALARM_SOUND_IDS.SPARKLE, label: "Sparkle", desc: "Twinkly high notes" },
  { id: ALARM_SOUND_IDS.MUSICBOX, label: "Music box", desc: "Gentle plucked melody" },
  { id: ALARM_SOUND_IDS.CHIME, label: "Soft chime", desc: "Light glass bells" },
  { id: ALARM_SOUND_IDS.BELLS, label: "Morning bells", desc: "Cheerful ring pattern" },
  { id: ALARM_SOUND_IDS.PIANO, label: "Piano", desc: "Warm key notes" },
  { id: ALARM_SOUND_IDS.BIRDS, label: "Birdsong", desc: "Playful chirps" },
  { id: ALARM_SOUND_IDS.DIGITAL, label: "Pixel pop", desc: "Cute retro beeps" },
  { id: ALARM_SOUND_IDS.CUSTOM, label: "Your music", desc: "MP3 or M4A from Files (iOS)" },
]);

const CUSTOM_DB = "cute_schedule_alarm_audio_v1";
const CUSTOM_STORE = "sounds";

let audioCtx = null;
let loopTimer = null;
let loopVariant = 0;
let previewTimer = null;
/** @type {HTMLAudioElement | null} */
let customAudioEl = null;
let audioUnlockPromise = null;

/** iOS/WKWebView: resume AudioContext after a user gesture or before alarm playback. */
export async function unlockAlarmAudio() {
  if (audioUnlockPromise) return audioUnlockPromise;
  audioUnlockPromise = (async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = audioCtx || new Ctx();
      audioCtx = ctx;
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {}
      }
    }
    try {
      const el = new Audio();
      el.src =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      el.volume = 0.01;
      await el.play();
      el.pause();
    } catch {}
    return true;
  })();
  return audioUnlockPromise;
}

async function getCtx() {
  await unlockAlarmAudio();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = audioCtx || new Ctx();
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {}
  }
  return audioCtx;
}

function tone(ctx, freq, start, dur, type = "sine", vol = 0.12) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/**
 * @param {string} soundId
 * @param {boolean} [gentle]
 * @param {number} [variant]
 */
async function playBuiltinBurst(soundId, gentle = false, variant = 0) {
  const ctx = await getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const volScale = gentle ? 0.72 : 1;
  const notes = getMelodyVariant(soundId, variant);
  for (const n of notes) {
    tone(ctx, n.freq, t + n.at, n.dur, n.type || "sine", (n.vol ?? 0.12) * volScale);
  }
}

function openCustomDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CUSTOM_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CUSTOM_STORE)) {
        db.createObjectStore(CUSTOM_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomAlarmSound(id, name, blob) {
  const db = await openCustomDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_STORE, "readwrite");
    tx.objectStore(CUSTOM_STORE).put({
      id,
      name: name || "My music",
      mimeType: blob.type || "audio/mpeg",
      blob,
      savedAt: Date.now(),
    });
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCustomAlarmSound(id) {
  if (!id) return null;
  const db = await openCustomDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_STORE, "readonly");
    const req = tx.objectStore(CUSTOM_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCustomAlarmSound(id) {
  if (!id) return;
  const db = await openCustomDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_STORE, "readwrite");
    tx.objectStore(CUSTOM_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getAlarmSoundLabel(alarm) {
  if (!alarm) return "Sunrise";
  if (alarm.sound === ALARM_SOUND_IDS.CUSTOM) {
    return alarm.customSoundName || "Your music";
  }
  return BUILTIN_ALARM_SOUNDS.find((s) => s.id === alarm.sound)?.label || "Sunrise";
}

export function normalizeAlarmSound(sound) {
  const valid = BUILTIN_ALARM_SOUNDS.map((s) => s.id);
  return valid.includes(sound) ? sound : ALARM_SOUND_IDS.DEFAULT;
}

function stopCustomAudio() {
  if (customAudioEl) {
    try {
      customAudioEl.pause();
      customAudioEl.currentTime = 0;
      if (customAudioEl.src.startsWith("blob:")) URL.revokeObjectURL(customAudioEl.src);
    } catch {}
    customAudioEl = null;
  }
}

export function stopAlarmSoundPlayback() {
  loopVariant = 0;
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  stopCustomAudio();
  import("./nativeAlarmRing.js")
    .then((m) => m.stopNativeAlarmRinging())
    .catch(() => {});
}

async function playCustomLoop(customSoundId) {
  const rec = await getCustomAlarmSound(customSoundId);
  if (!rec?.blob) return false;
  stopCustomAudio();
  const url = URL.createObjectURL(rec.blob);
  customAudioEl = new Audio(url);
  customAudioEl.loop = true;
  customAudioEl.volume = 0.85;
  try {
    await customAudioEl.play();
    return true;
  } catch {
    URL.revokeObjectURL(url);
    customAudioEl = null;
    return false;
  }
}

/**
 * @param {{ sound?: string, customSoundId?: string, mode?: string }} alarm
 */
export async function playAlarmSoundForAlarm(alarm) {
  stopAlarmSoundPlayback();
  const soundId = normalizeAlarmSound(alarm?.sound || ALARM_SOUND_IDS.DEFAULT);
  const gentle = alarm?.mode === "gentle";

  if (soundId === ALARM_SOUND_IDS.CUSTOM && alarm?.customSoundId) {
    const ok = await playCustomLoop(alarm.customSoundId);
    if (ok) return;
  }

  const notes = getMelodyVariant(soundId, 0);
  const loopMs = Math.round(melodyDurationSec(notes) * 1000) + (gentle ? 900 : 600);

  await playBuiltinBurst(soundId, gentle, loopVariant);
  loopTimer = setInterval(() => {
    loopVariant = (loopVariant + 1) % 3;
    void playBuiltinBurst(soundId, gentle, loopVariant);
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
  }, loopMs);
}

/** Preview a sound for ~2.5s (built-in or custom). */
export async function previewAlarmSound(soundId, customSoundId = null) {
  stopAlarmSoundPlayback();
  const id = normalizeAlarmSound(soundId);

  try {
    const { previewNativeAlarmSound, isNativeAlarmRingAvailable } = await import("./nativeAlarmRing.js");
    if (isNativeAlarmRingAvailable()) {
      const ok = await previewNativeAlarmSound(id, customSoundId);
      if (ok) return;
    }
  } catch {}

  await unlockAlarmAudio();

  if (id === ALARM_SOUND_IDS.CUSTOM && customSoundId) {
    const rec = await getCustomAlarmSound(customSoundId);
    if (rec?.blob) {
      const url = URL.createObjectURL(rec.blob);
      customAudioEl = new Audio(url);
      customAudioEl.volume = 0.7;
      try {
        await customAudioEl.play();
        previewTimer = setTimeout(() => stopAlarmSoundPlayback(), 4000);
      } catch {
        URL.revokeObjectURL(url);
        customAudioEl = null;
      }
    }
    return;
  }

  loopVariant = 0;
  await playBuiltinBurst(id, false, 0);
  previewTimer = setTimeout(() => stopAlarmSoundPlayback(), 3200);
}

/** iOS local notification sound name (bundled sounds only; custom falls back). */
export function iosNotificationSoundForAlarm(alarm) {
  const soundId = normalizeAlarmSound(alarm?.sound || ALARM_SOUND_IDS.DEFAULT);
  if (soundId === ALARM_SOUND_IDS.CUSTOM) return "default";
  return "default";
}
