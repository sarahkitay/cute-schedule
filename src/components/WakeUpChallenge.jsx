import React, { useEffect, useMemo, useState } from "react";
import { ALARM_MODES, alarmRequiresWakeUpChallenge } from "../modules/timers";
import { playAlarmSoundForAlarm, stopAlarmSoundPlayback } from "../alarmSounds";

const WRITING_PROMPTS = [
  "I am awake and ready",
  "Good morning world",
  "Today is a fresh start",
  "Rise and shine",
  "I choose to wake up now",
  "My brain is turned on",
];

const MATH_ROUNDS_EASY = 3;
const MATH_ROUNDS_HARD = 4;
const WRITING_ROUNDS = 2;

function buildMathProblem(difficulty = "easy") {
  if (difficulty === "hard") {
    const a = 12 + Math.floor(Math.random() * 18);
    const b = 8 + Math.floor(Math.random() * 12);
    const op = Math.random() > 0.5 ? "+" : "-";
    const answer = op === "+" ? a + b : a - b;
    return { prompt: `${a} ${op} ${b} = ?`, answer: String(answer) };
  }
  const a = 2 + Math.floor(Math.random() * 9);
  const b = 2 + Math.floor(Math.random() * 9);
  const op = Math.random() > 0.4 ? "+" : "-";
  if (op === "+") {
    return { prompt: `${a} + ${b} = ?`, answer: String(a + b) };
  }
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return { prompt: `${hi} - ${lo} = ?`, answer: String(hi - lo) };
}

function pickWritingPrompts(count) {
  const pool = [...WRITING_PROMPTS];
  const out = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Full-screen wake-up challenge shown when an alarm rings.
 * Alarm sound loops until onDismiss (after challenge or standard dismiss).
 */
export function WakeUpChallenge({ alarm, onDismiss }) {
  const needsMath = alarm?.mode === ALARM_MODES.MATH_DISMISS;
  const needsWriting = alarm?.mode === ALARM_MODES.ACTION_REQUIRED;
  const needsChallenge = alarmRequiresWakeUpChallenge(alarm);

  const mathTotal = needsMath ? (alarm?.mathDifficulty === "hard" ? MATH_ROUNDS_HARD : MATH_ROUNDS_EASY) : 0;
  const writingTotal = needsWriting ? WRITING_ROUNDS : 0;
  const totalRounds = mathTotal || writingTotal || 1;

  const writingQueue = useMemo(
    () => (needsWriting ? pickWritingPrompts(writingTotal) : []),
    [needsWriting, writingTotal, alarm?.id]
  );

  const [round, setRound] = useState(0);
  const [math, setMath] = useState(() =>
    needsMath ? buildMathProblem(alarm?.mathDifficulty || "easy") : null
  );
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [streak, setStreak] = useState(0);

  const writingPrompt = needsWriting ? writingQueue[round] : null;
  const roundLabel = needsChallenge ? `${Math.min(round + 1, totalRounds)} of ${totalRounds}` : null;

  useEffect(() => {
    if (!alarm) return;
    void playAlarmSoundForAlarm(alarm);
    try {
      navigator.vibrate?.([300, 120, 300, 120, 300]);
    } catch {}
    return () => {
      stopAlarmSoundPlayback();
    };
  }, [alarm]);

  useEffect(() => {
    let wakeLock = null;
    let cancelled = false;
    (async () => {
      try {
        if (cancelled || !navigator.wakeLock?.request) return;
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {}
    })();
    return () => {
      cancelled = true;
      wakeLock?.release?.().catch?.(() => {});
    };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && alarm) {
        void playAlarmSoundForAlarm(alarm);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [alarm]);

  function advanceOrFinish() {
    const nextRound = round + 1;
    if (nextRound >= totalRounds) {
      onDismiss();
      return;
    }
    setRound(nextRound);
    setAnswer("");
    setError("");
    if (needsMath) {
      setMath(buildMathProblem(alarm?.mathDifficulty || "easy"));
    }
  }

  function tryDismiss() {
    if (!needsChallenge) {
      onDismiss();
      return;
    }
    if (needsMath && math) {
      if (answer.trim() === math.answer) {
        setStreak((s) => s + 1);
        advanceOrFinish();
        return;
      }
      setError(`Wrong answer. Stay with it. ${roundLabel || ""}`);
      setMath(buildMathProblem(alarm?.mathDifficulty || "easy"));
      setAnswer("");
      setStreak(0);
      try {
        navigator.vibrate?.([120, 80, 120, 80, 120]);
      } catch {}
      return;
    }
    if (needsWriting && writingPrompt) {
      if (answer.trim().toLowerCase() === writingPrompt.toLowerCase()) {
        setStreak((s) => s + 1);
        advanceOrFinish();
        return;
      }
      setError(`Type it exactly, including spaces. ${roundLabel || ""}`);
      setAnswer("");
      setStreak(0);
    }
  }

  return (
    <div
      className="wake-challenge-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wake-challenge-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wake-challenge-card" onClick={(e) => e.stopPropagation()}>
        <div className="wake-challenge-icon-wrap">
          <img src={`${import.meta.env.BASE_URL}PYIcon.png`} alt="" className="wake-challenge-icon" width={72} height={72} />
        </div>
        <h2 id="wake-challenge-title" className="wake-challenge-title">
          {alarm?.label || "Good morning"}
        </h2>
        <p className="wake-challenge-sub">
          {needsMath
            ? `Solve ${mathTotal} quick problems to turn off your alarm. It keeps ringing until you finish.`
            : needsWriting
              ? `Type ${writingTotal} phrases exactly to turn off your alarm. It keeps ringing until you finish.`
              : "Your alarm is ringing. Tap dismiss when you're ready to start the day."}
        </p>

        {needsChallenge && roundLabel ? (
          <p className="wake-challenge-progress" aria-live="polite">
            Step {roundLabel}
            {streak > 0 ? ` · ${streak} correct in a row` : ""}
          </p>
        ) : null}

        {needsMath ? <div className="wake-challenge-problem">{math?.prompt}</div> : null}
        {needsWriting ? <p className="wake-challenge-phrase">&ldquo;{writingPrompt}&rdquo;</p> : null}

        {needsChallenge ? (
          <input
            className="input wake-challenge-input"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && tryDismiss()}
            placeholder={needsMath ? "Your answer" : "Type the phrase…"}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        ) : null}

        {error ? <p className="wake-challenge-error">{error}</p> : null}

        <div className="wake-challenge-actions">
          <button type="button" className="btn btn-primary wake-challenge-btn" onClick={tryDismiss}>
            {needsChallenge ? "Check answer" : "Dismiss alarm"}
          </button>
        </div>
      </div>
    </div>
  );
}
