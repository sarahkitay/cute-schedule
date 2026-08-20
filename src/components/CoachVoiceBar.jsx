import React, { useEffect, useRef, useState } from "react";
import {
  buildVoicePlanQuestion,
  ensureMicrophoneAccess,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startSpeechRecognition,
  stopSpeaking,
} from "../coachVoice.js";

/**
 * Talk-to-Coach: speak the day, get a timed plan to approve.
 * @param {{
 *   disabled?: boolean,
 *   lastCoachReply?: string,
 *   onPlanFromSpeech: (wrappedQuestion: string, spokenText: string) => void,
 * }} props
 */
export function CoachVoiceBar({ disabled = false, lastCoachReply = "", onPlanFromSpeech }) {
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState("");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef(null);
  const partsRef = useRef([]);
  const liveRef = useRef("");
  const committedRef = useRef(false);
  const supported = isSpeechRecognitionSupported();
  const canSpeak = isSpeechSynthesisSupported();

  useEffect(() => () => {
    recRef.current?.stop?.();
    stopSpeaking();
  }, []);

  function commitSpeech() {
    if (committedRef.current) return;
    committedRef.current = true;
    recRef.current?.stop?.();
    recRef.current = null;
    setListening(false);
    const spoken = [...partsRef.current, liveRef.current].join(" ").replace(/\s+/g, " ").trim();
    partsRef.current = [];
    liveRef.current = "";
    setLive("");
    setHeard("");
    if (!spoken) return;
    const wrapped = buildVoicePlanQuestion(spoken);
    if (wrapped) onPlanFromSpeech(wrapped, spoken);
  }

  async function toggleListen() {
    if (disabled) return;
    setError("");
    if (listening) {
      commitSpeech();
      return;
    }
    if (!supported) {
      setError("Voice input is not available here. Type what you have to do, then tap Send.");
      return;
    }
    try {
      await ensureMicrophoneAccess();
    } catch {
      setError("Allow the microphone for PROYOU in Settings, then tap the mic again.");
      return;
    }
    partsRef.current = [];
    liveRef.current = "";
    committedRef.current = false;
    setLive("");
    setHeard("");
    const session = startSpeechRecognition({
      onInterim: (text) => {
        liveRef.current = text;
        setLive(text);
      },
      onFinal: (text) => {
        partsRef.current.push(text);
        liveRef.current = "";
        setHeard(partsRef.current.join(" ").replace(/\s+/g, " ").trim());
        setLive("");
      },
      onError: (message) => {
        setError(message);
        committedRef.current = true;
        setListening(false);
        recRef.current = null;
      },
      onEnd: () => {
        recRef.current = null;
        commitSpeech();
      },
    });
    if (!session) return;
    recRef.current = session;
    setListening(true);
  }

  function toggleReadAloud() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const ok = speakText(lastCoachReply, {
      onEnd: () => setSpeaking(false),
    });
    setSpeaking(ok);
  }

  return (
    <div className="coach-voice-bar">
      <p id="coach-voice-lead" className="coach-voice-bar__lead">
        Tap the mic and say everything you have to do: errands, workouts, homework, calls, and times. Coach will turn it into a timed plan you can approve.
      </p>
      <div className="coach-voice-bar__actions">
        <button
          type="button"
          className={`btn coach-voice-mic${listening ? " is-listening" : ""}`}
          onClick={() => void toggleListen()}
          disabled={disabled}
          aria-pressed={listening}
          aria-describedby="coach-voice-lead"
          aria-label={listening ? "Stop recording and build my plan" : "Talk to Coach about my day"}
        >
          <MicIcon listening={listening} />
          <span>{listening ? "Listening… tap to build plan" : "Talk to Coach"}</span>
        </button>
        {canSpeak && lastCoachReply ? (
          <button
            type="button"
            className="btn btn-ghost coach-voice-speak"
            onClick={toggleReadAloud}
            aria-pressed={speaking}
            aria-label={speaking ? "Stop reading Coach reply" : "Read Coach reply aloud"}
          >
            {speaking ? "Stop reading" : "Read aloud"}
          </button>
        ) : null}
      </div>
      <div className="sr-only" aria-live="assertive">
        {listening ? "Listening for your day." : ""}
        {error}
      </div>
      {listening || live || heard ? (
        <p className="coach-voice-bar__live" aria-live="polite">
          {listening ? "Hearing: " : ""}
          {[heard, live].filter(Boolean).join(" ").trim() || "Say your tasks, errands, and times…"}
        </p>
      ) : null}
      {error ? (
        <p className="coach-voice-bar__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MicIcon({ listening }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      {listening ? <circle cx="12" cy="8.5" r="1.2" fill="currentColor" /> : null}
    </svg>
  );
}
