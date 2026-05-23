/**
 * Alarm sound catalog, built-in Web Audio tones, and custom audio (IndexedDB).
 */

export const ALARM_SOUND_IDS = Object.freeze({
  DEFAULT: "default",
  CHIME: "chime",
  BELLS: "bells",
  DIGITAL: "digital",
  BIRDS: "birds",
  PIANO: "piano",
  CUSTOM: "custom",
});

export const BUILTIN_ALARM_SOUNDS = Object.freeze([
  { id: ALARM_SOUND_IDS.DEFAULT, label: "Classic", desc: "Warm ascending tone" },
  { id: ALARM_SOUND_IDS.CHIME, label: "Soft chime", desc: "Light glass bells" },
  { id: ALARM_SOUND_IDS.BELLS, label: "Morning bells", desc: "Cheerful ring" },
  { id: ALARM_SOUND_IDS.DIGITAL, label: "Digital", desc: "Clear beeps" },
  { id: ALARM_SOUND_IDS.BIRDS, label: "Birdsong", desc: "Gentle nature chirps" },
  { id: ALARM_SOUND_IDS.PIANO, label: "Piano", desc: "Simple melody notes" },
  { id: ALARM_SOUND_IDS.CUSTOM, label: "Your music", desc: "Pick a song or clip from your device" },
]);

const CUSTOM_DB = "cute_schedule_alarm_audio_v1";
const CUSTOM_STORE = "sounds";

let audioCtx = null;
let loopTimer = null;
let previewTimer = null;
/** @type {HTMLAudioElement | null} */
let customAudioEl = null;

function getCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = audioCtx || new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
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

function playBuiltinBurst(soundId, gentle = false) {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const vol = gentle ? 0.08 : 0.13;

  switch (soundId) {
    case ALARM_SOUND_IDS.CHIME:
      [880, 1108, 1318].forEach((f, i) => tone(ctx, f, t + i * 0.22, 0.55, "sine", vol * 0.9));
      break;
    case ALARM_SOUND_IDS.BELLS:
      [523, 659, 784, 659, 523].forEach((f, i) => tone(ctx, f, t + i * 0.18, 0.4, "triangle", vol));
      break;
    case ALARM_SOUND_IDS.DIGITAL:
      for (let i = 0; i < 4; i++) tone(ctx, 880, t + i * 0.2, 0.12, "square", vol * 0.7);
      break;
    case ALARM_SOUND_IDS.BIRDS:
      [1800, 2100, 2400, 2000, 2300].forEach((f, i) => tone(ctx, f, t + i * 0.12, 0.08, "sine", vol * 0.6));
      break;
    case ALARM_SOUND_IDS.PIANO:
      [262, 330, 392, 523].forEach((f, i) => tone(ctx, f, t + i * 0.25, 0.45, "triangle", vol));
      break;
    case ALARM_SOUND_IDS.DEFAULT:
    default:
      [440, 554, 659, 880].forEach((f, i) => tone(ctx, f, t + i * 0.16, 0.35, "sine", vol));
      break;
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
  if (!alarm) return "Classic";
  if (alarm.sound === ALARM_SOUND_IDS.CUSTOM) {
    return alarm.customSoundName || "Your music";
  }
  return BUILTIN_ALARM_SOUNDS.find((s) => s.id === alarm.sound)?.label || "Classic";
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
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  stopCustomAudio();
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

  playBuiltinBurst(soundId, gentle);
  loopTimer = setInterval(() => {
    playBuiltinBurst(soundId, gentle);
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
  }, gentle ? 2200 : 1400);
}

/** Preview a sound for ~2.5s (built-in or custom). */
export async function previewAlarmSound(soundId, customSoundId = null) {
  stopAlarmSoundPlayback();
  const id = normalizeAlarmSound(soundId);

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

  playBuiltinBurst(id, false);
  previewTimer = setTimeout(() => stopAlarmSoundPlayback(), 2500);
}

/** iOS local notification sound name (bundled sounds only; custom falls back). */
export function iosNotificationSoundForAlarm(alarm) {
  const soundId = normalizeAlarmSound(alarm?.sound || ALARM_SOUND_IDS.DEFAULT);
  if (soundId === ALARM_SOUND_IDS.CUSTOM) return "default";
  return "default";
}
