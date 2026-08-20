/**
 * Alarm sound catalog, built-in Web Audio tones, and bundled alarm clips.
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
  EDGY_RINGTONE: "edgy_ringtone",
  WAKE_UP_LEGEND: "wake_up_legend",
  WAKE_UP_LEGEND_2: "wake_up_legend_2",
  MORNING_LIGHT: "morning_light",
  MORNING_LIGHT_2: "morning_light_2",
  ON_THE_CLOCK: "on_the_clock",
  /** @deprecated legacy import id — migrated to presets */
  CUSTOM: "custom",
});

/** Bundled clips shipped in public/sounds (also copied into the iOS app bundle). */
export const BUNDLED_ALARM_SOUND_FILES = Object.freeze({
  [ALARM_SOUND_IDS.EDGY_RINGTONE]: "sounds/proyou-edgy-ringtone.mp3",
  [ALARM_SOUND_IDS.WAKE_UP_LEGEND]: "sounds/proyou-wake-up-you-legend.mp3",
  [ALARM_SOUND_IDS.WAKE_UP_LEGEND_2]: "sounds/proyou-wake-up-you-legend-2.mp3",
  [ALARM_SOUND_IDS.MORNING_LIGHT]: "sounds/proyou-morning-light-awakens.mp3",
  [ALARM_SOUND_IDS.MORNING_LIGHT_2]: "sounds/proyou-morning-light-awakens-2.mp3",
  [ALARM_SOUND_IDS.ON_THE_CLOCK]: "sounds/proyou-youre-on-the-clock.mp3",
});

export const BUILTIN_ALARM_SOUNDS = Object.freeze([
  { id: ALARM_SOUND_IDS.DEFAULT, label: "Classic alarm", desc: "Urgent repeating beeps", emoji: "⏰" },
  { id: ALARM_SOUND_IDS.DIGITAL, label: "Radar", desc: "Fast digital alarm pulses", emoji: "📟" },
  { id: ALARM_SOUND_IDS.BELLS, label: "Morning bells", desc: "Bright ringing pattern", emoji: "🔔" },
  { id: ALARM_SOUND_IDS.CHIME, label: "Glass chime", desc: "Clear bell tones", emoji: "🎐" },
  { id: ALARM_SOUND_IDS.PIANO, label: "Piano wake", desc: "Warm key strikes", emoji: "🎹" },
  { id: ALARM_SOUND_IDS.SPARKLE, label: "Sparkle", desc: "High twinkly notes", emoji: "✨" },
  { id: ALARM_SOUND_IDS.MUSICBOX, label: "Music box", desc: "Gentle plucked melody", emoji: "🎵" },
  { id: ALARM_SOUND_IDS.BIRDS, label: "Birdsong", desc: "Playful chirps", emoji: "🐦" },
  {
    id: ALARM_SOUND_IDS.EDGY_RINGTONE,
    label: "Edgy ringtone",
    desc: "Bundled clip. Loud and explicit lyrics",
    emoji: "🔥",
    contentWarning: "Contains profanity. Not recommended around kids or at work.",
  },
  {
    id: ALARM_SOUND_IDS.WAKE_UP_LEGEND,
    label: "Wake up, you legend",
    desc: "Motivational wake-up clip",
    emoji: "🏆",
  },
  {
    id: ALARM_SOUND_IDS.WAKE_UP_LEGEND_2,
    label: "Wake up, you legend (alt)",
    desc: "Alternate motivational wake-up",
    emoji: "⭐",
  },
  {
    id: ALARM_SOUND_IDS.MORNING_LIGHT,
    label: "Morning light awakens",
    desc: "Bright morning energy",
    emoji: "🌅",
  },
  {
    id: ALARM_SOUND_IDS.MORNING_LIGHT_2,
    label: "Morning light awakens (alt)",
    desc: "Alternate morning energy",
    emoji: "☀️",
  },
  {
    id: ALARM_SOUND_IDS.ON_THE_CLOCK,
    label: "You're on the clock",
    desc: "Urgent get-moving wake-up",
    emoji: "⏱️",
  },
]);

let audioCtx = null;
let loopTimer = null;
let loopVariant = 0;
let previewTimer = null;
/** @type {HTMLAudioElement | null} */
let bundledAudioEl = null;
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
  const volScale = gentle ? 0.72 : 1.15;
  const notes = getMelodyVariant(soundId, variant);
  for (const n of notes) {
    tone(ctx, n.freq, t + n.at, n.dur, n.type || "sine", (n.vol ?? 0.12) * volScale);
  }
}

export function bundledSoundUrl(soundId) {
  const rel = BUNDLED_ALARM_SOUND_FILES[soundId];
  if (!rel) return null;
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${rel}`;
}

export function isBundledAlarmSound(soundId) {
  return Boolean(BUNDLED_ALARM_SOUND_FILES[soundId]);
}

export function getAlarmSoundLabel(alarm) {
  if (!alarm) return "Classic alarm";
  const id = normalizeAlarmSound(alarm.sound);
  return BUILTIN_ALARM_SOUNDS.find((s) => s.id === id)?.label || "Classic alarm";
}

export function normalizeAlarmSound(sound) {
  const valid = BUILTIN_ALARM_SOUNDS.map((s) => s.id);
  if (valid.includes(sound)) return sound;
  if (sound === ALARM_SOUND_IDS.CUSTOM) return ALARM_SOUND_IDS.DEFAULT;
  return ALARM_SOUND_IDS.DEFAULT;
}

function stopBundledAudio() {
  if (bundledAudioEl) {
    try {
      bundledAudioEl.pause();
      bundledAudioEl.currentTime = 0;
    } catch {}
    bundledAudioEl = null;
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
  stopBundledAudio();
  import("./nativeAlarmRing.js")
    .then((m) => m.stopNativeAlarmRinging())
    .catch(() => {});
}

async function playBundledLoop(soundId) {
  const url = bundledSoundUrl(soundId);
  if (!url) return false;
  stopBundledAudio();
  bundledAudioEl = new Audio(url);
  bundledAudioEl.loop = true;
  bundledAudioEl.volume = 1;
  try {
    await bundledAudioEl.play();
    return true;
  } catch {
    bundledAudioEl = null;
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

  if (isBundledAlarmSound(soundId)) {
    const ok = await playBundledLoop(soundId);
    if (ok) return;
  }

  const notes = getMelodyVariant(soundId, 0);
  const loopMs = Math.round(melodyDurationSec(notes) * 1000) + (gentle ? 700 : 450);

  await playBuiltinBurst(soundId, gentle, loopVariant);
  loopTimer = setInterval(() => {
    loopVariant = (loopVariant + 1) % 3;
    void playBuiltinBurst(soundId, gentle, loopVariant);
    try {
      navigator.vibrate?.([300, 120, 300, 120, 300]);
    } catch {}
  }, loopMs);
}

/** Preview a sound for ~3s (built-in or bundled). */
export async function previewAlarmSound(soundId) {
  stopAlarmSoundPlayback();
  const id = normalizeAlarmSound(soundId);

  try {
    const { previewNativeAlarmSound, isNativeAlarmRingAvailable } = await import("./nativeAlarmRing.js");
    if (isNativeAlarmRingAvailable()) {
      const ok = await previewNativeAlarmSound(id);
      if (ok) return;
    }
  } catch {}

  await unlockAlarmAudio();

  if (isBundledAlarmSound(id)) {
    const url = bundledSoundUrl(id);
    if (url) {
      bundledAudioEl = new Audio(url);
      bundledAudioEl.volume = 0.85;
      try {
        await bundledAudioEl.play();
        previewTimer = setTimeout(() => stopAlarmSoundPlayback(), 4000);
      } catch {
        bundledAudioEl = null;
      }
    }
    return;
  }

  loopVariant = 0;
  await playBuiltinBurst(id, false, 0);
  previewTimer = setTimeout(() => stopAlarmSoundPlayback(), 3200);
}

/** iOS local notification sound name (bundled + built-in presets). */
export function iosNotificationSoundForAlarm(alarm) {
  const soundId = normalizeAlarmSound(alarm?.sound || ALARM_SOUND_IDS.DEFAULT);
  if (isBundledAlarmSound(soundId)) return `proyou_${soundId}`;
  return "default";
}
