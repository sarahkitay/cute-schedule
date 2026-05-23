import React, { useMemo, useState } from "react";
import { ALARM_MODES } from "../modules/timers";

const WRITING_PROMPTS = [
  "I am awake and ready",
  "Good morning world",
  "Today is a fresh start",
  "Rise and shine",
];

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

/**
 * Full-screen wake-up challenge shown when an alarm rings.
 */
export function WakeUpChallenge({ alarm, onDismiss }) {
  const needsMath = alarm?.mode === ALARM_MODES.MATH_DISMISS;
  const needsWriting = alarm?.mode === ALARM_MODES.ACTION_REQUIRED;
  const needsChallenge = needsMath || needsWriting;

  const math = useMemo(
    () => (needsMath ? buildMathProblem(alarm?.mathDifficulty || "easy") : null),
    [needsMath, alarm?.mathDifficulty, alarm?.id]
  );
  const writingPrompt = useMemo(
    () => (needsWriting ? WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)] : null),
    [needsWriting, alarm?.id]
  );

  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  function tryDismiss() {
    if (!needsChallenge) {
      onDismiss();
      return;
    }
    if (needsMath) {
      if (answer.trim() === math.answer) {
        onDismiss();
        return;
      }
      setError("Not quite — try again to wake up your brain.");
      return;
    }
    if (needsWriting) {
      if (answer.trim().toLowerCase() === writingPrompt.toLowerCase()) {
        onDismiss();
        return;
      }
      setError("Type the phrase exactly to dismiss.");
    }
  }

  return (
    <div className="wake-challenge-overlay" role="dialog" aria-modal="true" aria-labelledby="wake-challenge-title">
      <div className="wake-challenge-card">
        <div className="wake-challenge-icon-wrap">
          <img src={`${import.meta.env.BASE_URL}PYIcon.png`} alt="" className="wake-challenge-icon" width={72} height={72} />
        </div>
        <h2 id="wake-challenge-title" className="wake-challenge-title">
          {alarm?.label || "Good morning"}
        </h2>
        <p className="wake-challenge-sub">
          {needsMath
            ? "Solve this to turn off your alarm."
            : needsWriting
              ? "Type the phrase below to turn off your alarm."
              : "Tap dismiss when you're ready to start the day."}
        </p>

        {needsMath ? <div className="wake-challenge-problem">{math.prompt}</div> : null}
        {needsWriting ? <p className="wake-challenge-phrase">“{writingPrompt}”</p> : null}

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
          />
        ) : null}

        {error ? <p className="wake-challenge-error">{error}</p> : null}

        <div className="wake-challenge-actions">
          <button type="button" className="btn btn-primary wake-challenge-btn" onClick={tryDismiss}>
            {needsChallenge ? "I'm awake" : "Dismiss alarm"}
          </button>
        </div>
      </div>
    </div>
  );
}
