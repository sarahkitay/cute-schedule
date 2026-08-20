import React, { useEffect, useMemo, useState } from "react";
import { ALARM_MODES, alarmRequiresWakeUpChallenge } from "../modules/timers";
import { playAlarmSound, stopAlarmSound } from "../alarmScheduler";

const WRITING_PROMPTS = [
  "I am awake and ready",
  "Good morning world",
  "Today is a fresh start",
  "Rise and shine",
  "I choose to wake up now",
  "My brain is turned on",
];

const RIDDLES = [
  { q: "What gets wetter the more it dries?", a: "towel" },
  { q: "I have hands but cannot clap. What am I?", a: "clock" },
  { q: "What has to be broken before you can use it?", a: "egg" },
  { q: "The more you take, the more you leave behind. What are they?", a: "footsteps" },
  { q: "What can you catch but not throw?", a: "cold" },
];

const MATH_ROUNDS = 3;
const RIDDLE_ROUNDS = 3;
const WRITING_ROUNDS = 2;

function buildMathProblem() {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
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

function pickRiddles(count) {
  const pool = [...RIDDLES];
  const out = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createPuzzle() {
  const tiles = shuffle([1, 2, 3, 4, 5, 6, 7, 8, null]);
  return tiles;
}

function puzzleSolved(tiles) {
  if (!Array.isArray(tiles) || tiles.length !== 9) return false;
  for (let i = 0; i < 8; i++) {
    if (tiles[i] !== i + 1) return false;
  }
  return tiles[8] === null;
}

function puzzleNeighbors(idx) {
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  const out = [];
  if (row > 0) out.push(idx - 3);
  if (row < 2) out.push(idx + 3);
  if (col > 0) out.push(idx - 1);
  if (col < 2) out.push(idx + 1);
  return out;
}

/**
 * Full-screen wake-up challenge on Home when an alarm rings.
 * Sound pauses once you start the game; returns if you leave without finishing.
 */
export function WakeUpChallenge({ alarm, onDismiss, onSnooze }) {
  const needsMath = alarm?.mode === ALARM_MODES.MATH_DISMISS;
  const needsWriting = alarm?.mode === ALARM_MODES.ACTION_REQUIRED;
  const needsRiddle = alarm?.mode === ALARM_MODES.RIDDLE;
  const needsPuzzle = alarm?.mode === ALARM_MODES.PUZZLE;
  const needsChallenge = alarmRequiresWakeUpChallenge(alarm);
  const allowOverride = alarm?.allowEmergencyOverride !== false;

  const mathTotal = needsMath ? MATH_ROUNDS : 0;
  const writingTotal = needsWriting ? WRITING_ROUNDS : 0;
  const riddleTotal = needsRiddle ? RIDDLE_ROUNDS : 0;
  const totalRounds = mathTotal || writingTotal || riddleTotal || (needsPuzzle ? 1 : 1);

  const writingQueue = useMemo(
    () => (needsWriting ? pickWritingPrompts(writingTotal) : []),
    [needsWriting, writingTotal, alarm?.id],
  );

  const riddleQueue = useMemo(
    () => (needsRiddle ? pickRiddles(riddleTotal) : []),
    [needsRiddle, riddleTotal, alarm?.id],
  );

  const [round, setRound] = useState(0);
  const [math, setMath] = useState(() => (needsMath ? buildMathProblem() : null));
  const [puzzle, setPuzzle] = useState(() => (needsPuzzle ? createPuzzle() : []));
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [streak, setStreak] = useState(0);
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [overrideStep, setOverrideStep] = useState(0);

  const writingPrompt = needsWriting ? writingQueue[round] : null;
  const riddle = needsRiddle ? riddleQueue[round] : null;
  const roundLabel = needsChallenge ? `${Math.min(round + 1, totalRounds)} of ${totalRounds}` : null;

  useEffect(() => {
    if (!alarm) return;
    try {
      navigator.vibrate?.([300, 120, 300, 120, 300]);
    } catch {}
    void playAlarmSound(alarm);
    return () => {
      stopAlarmSound();
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
      if (document.visibilityState !== "visible" || !alarm || !needsChallenge || !challengeStarted) return;
      const puzzleIncomplete = needsPuzzle && !puzzleSolved(puzzle);
      const textIncomplete = needsMath || needsWriting || needsRiddle;
      if (puzzleIncomplete || textIncomplete) {
        void playAlarmSound(alarm);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [alarm, needsChallenge, challengeStarted, puzzle]);

  function beginChallenge() {
    if (!challengeStarted) {
      setChallengeStarted(true);
      stopAlarmSound();
    }
  }

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
      setMath(buildMathProblem());
    }
  }

  function tryDismiss() {
    if (!needsChallenge) {
      onDismiss();
      return;
    }
    beginChallenge();
    if (needsMath && math) {
      if (answer.trim() === math.answer) {
        setStreak((s) => s + 1);
        advanceOrFinish();
        return;
      }
      setError(`Wrong answer. Stay with it. ${roundLabel || ""}`);
      setMath(buildMathProblem());
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
      return;
    }
    if (needsRiddle && riddle) {
      const norm = answer.trim().toLowerCase().replace(/[^\w\s]/g, "");
      const expected = riddle.a.toLowerCase();
      if (norm === expected || norm.includes(expected)) {
        setStreak((s) => s + 1);
        advanceOrFinish();
        return;
      }
      setError(`Not quite. Try again. ${roundLabel || ""}`);
      setAnswer("");
      setStreak(0);
    }
  }

  function tapPuzzleTile(idx) {
    beginChallenge();
    const blank = puzzle.indexOf(null);
    if (!puzzleNeighbors(blank).includes(idx)) return;
    setPuzzle((prev) => {
      const next = [...prev];
      [next[blank], next[idx]] = [next[idx], next[blank]];
      if (puzzleSolved(next)) {
        setTimeout(() => onDismiss(), 400);
      }
      return next;
    });
    setError("");
  }

  function handleOverride() {
    if (!allowOverride) return;
    if (overrideStep === 0) {
      setOverrideStep(1);
      setError("Tap override again to confirm you want to skip the wake-up game.");
      return;
    }
    onDismiss();
  }

  const subCopy = needsMath
    ? `Solve ${mathTotal} quick easy problems. Sound pauses while you play. Finish or the alarm returns.`
    : needsWriting
      ? `Type ${writingTotal} phrases exactly. Sound pauses while you play.`
      : needsRiddle
        ? `Answer ${riddleTotal} easy riddles to turn off your alarm. Sound pauses while you think.`
        : needsPuzzle
          ? "Slide tiles 1-8 into order. Sound pauses while you play."
          : "Your alarm is ringing. Tap dismiss when you're ready.";

  const modeMeta = needsMath
    ? { label: "Math wake-up" }
    : needsWriting
      ? { label: "Typing challenge" }
      : needsRiddle
        ? { label: "Morning riddles" }
        : needsPuzzle
          ? { label: "Slide puzzle" }
          : { label: "Good morning" };

  return (
    <div
      className="wake-challenge-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wake-challenge-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wake-challenge-blob wake-challenge-blob--a" aria-hidden="true" />
      <div className="wake-challenge-blob wake-challenge-blob--b" aria-hidden="true" />
      <div className="wake-challenge-card" onClick={(e) => e.stopPropagation()}>
        <div className="wake-challenge-mode-chip">{modeMeta.label}</div>
        <div className="wake-challenge-icon-wrap">
          <img src={`${import.meta.env.BASE_URL}PYIcon.png`} alt="" className="wake-challenge-icon" width={72} height={72} />
        </div>
        <h2 id="wake-challenge-title" className="wake-challenge-title">
          {alarm?.label || "Good morning"}
        </h2>
        <p className="wake-challenge-sub">{subCopy}</p>

        {needsChallenge && roundLabel ? (
          <p className="wake-challenge-progress" aria-live="polite">
            Step {roundLabel}
            {streak > 0 ? ` · ${streak} correct in a row ✨` : ""}
          </p>
        ) : null}

        {needsMath ? <div className="wake-challenge-problem">{math?.prompt}</div> : null}
        {needsWriting ? <p className="wake-challenge-phrase">&ldquo;{writingPrompt}&rdquo;</p> : null}
        {needsRiddle ? <p className="wake-challenge-phrase wake-challenge-phrase--riddle">{riddle?.q}</p> : null}

        {needsPuzzle ? (
          <div className="wake-puzzle-grid" role="group" aria-label="Slide puzzle">
            {puzzle.map((tile, idx) => (
              <button
                key={idx}
                type="button"
                className={`wake-puzzle-tile${tile == null ? " wake-puzzle-tile--empty" : ""}`}
                disabled={tile == null}
                onClick={() => tapPuzzleTile(idx)}
              >
                {tile ?? ""}
              </button>
            ))}
          </div>
        ) : null}

        {(needsMath || needsWriting || needsRiddle) && needsChallenge ? (
          <input
            className="input wake-challenge-input"
            value={answer}
            onFocus={beginChallenge}
            onChange={(e) => {
              beginChallenge();
              setAnswer(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && tryDismiss()}
            placeholder={needsMath ? "Your answer" : needsRiddle ? "Your answer" : "Type the phrase…"}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        ) : null}

        {error ? <p className="wake-challenge-error">{error}</p> : null}

        <div className="wake-challenge-actions">
          {(needsMath || needsWriting || needsRiddle) ? (
            <button type="button" className="btn btn-primary wake-challenge-btn" onClick={tryDismiss}>
              Check answer
            </button>
          ) : !needsPuzzle ? (
            <button type="button" className="btn btn-primary wake-challenge-btn" onClick={() => onDismiss()}>
              Dismiss alarm
            </button>
          ) : null}
          {needsChallenge ? (
            <div className="wake-challenge-secondary-actions">
              <button
                type="button"
                className="btn btn-sm wake-challenge-snooze-btn"
                onClick={() => onSnooze?.(alarm)}
              >
                Snooze {alarm?.snoozeMinutes || 9} min
              </button>
              {allowOverride ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={handleOverride}>
                  {overrideStep === 1 ? "Confirm override" : "Emergency override"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
