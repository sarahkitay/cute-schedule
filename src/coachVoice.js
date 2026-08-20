/** Speech helpers for Coach voice input and optional read-aloud. */

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionCtor());
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && typeof window.speechSynthesis?.speak === "function";
}

/**
 * Wrap a spoken dump of the day so Coach routes to daily planning
 * and proposes timed ADD_TASK rows.
 * @param {unknown} transcript
 * @returns {string}
 */
export function buildVoicePlanQuestion(transcript) {
  const spoken = String(transcript || "").trim();
  if (!spoken) return "";
  return [
    "Please put all of this on my schedule for today.",
    "Build a concrete timed plan from what I said out loud.",
    "Turn each commitment into ADD_TASK suggestions with specific times that do not overlap.",
    "If I did not give a time, pick a reasonable one. Keep the day doable.",
    "Here is what I have to do:",
    spoken,
  ].join(" ");
}

export async function ensureMicrophoneAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return true;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
  return true;
}

/**
 * @param {{
 *   onInterim?: (text: string) => void,
 *   onFinal?: (text: string) => void,
 *   onError?: (message: string) => void,
 *   onEnd?: () => void,
 *   lang?: string,
 * }} [handlers]
 * @returns {{ stop: () => void } | null}
 */
export function startSpeechRecognition(handlers = {}) {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    handlers.onError?.("Voice input is not available on this device. Type what you have to do instead.");
    return null;
  }
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = handlers.lang || (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i]?.[0]?.transcript || "";
      if (event.results[i].isFinal) finalText += piece;
      else interim += piece;
    }
    if (interim) handlers.onInterim?.(interim);
    if (finalText) handlers.onFinal?.(finalText);
  };
  rec.onerror = (event) => {
    const code = String(event?.error || "");
    if (code === "aborted" || code === "no-speech") return;
    if (code === "not-allowed") {
      handlers.onError?.("Microphone permission is off. Allow the mic for PROYOU, then try again.");
      return;
    }
    handlers.onError?.("Could not hear that. Try again, or type your day.");
  };
  rec.onend = () => handlers.onEnd?.();
  try {
    rec.start();
  } catch {
    handlers.onError?.("Could not start the microphone.");
    return null;
  }
  return {
    stop() {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

export function speakText(text, { onEnd } = {}) {
  if (!isSpeechSynthesisSupported()) return false;
  const spoken = String(text || "").trim();
  if (!spoken) return false;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(spoken);
  utter.rate = 1;
  utter.lang = (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";
  if (typeof onEnd === "function") {
    utter.onend = () => onEnd();
    utter.onerror = () => onEnd();
  }
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
