import React, { useState, useRef, useCallback, useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { PillButton } from "./PillButton";
import { SegmentedControl } from "./SegmentedControl";
import { NavIcons } from "./NavIcons";
import { TIMER_TYPES, formatTimerDisplay, createTimer } from "../modules/timers";

const PRESETS = [
  { label: "5 min", ms: 5 * 60 * 1000 },
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "25 min", ms: 25 * 60 * 1000 },
  { label: "45 min", ms: 45 * 60 * 1000 },
  { label: "60 min", ms: 60 * 60 * 1000 },
];

export function TimersPage({ timersState, onUpdate }) {
  const [mode, setMode] = useState("timer");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60 * 1000);
  const [selectedPreset, setSelectedPreset] = useState(25 * 60 * 1000);
  const [label, setLabel] = useState("Focus");
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const durationRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    durationRef.current = remaining;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const left = Math.max(0, durationRef.current - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setRunning(false);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Timer complete", { body: `${label} timer finished!` });
        }
      }
    }, 100);
  }, [remaining, label]);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    pauseTimer();
    setRemaining(selectedPreset);
  }, [pauseTimer, selectedPreset]);

  function selectPreset(ms) {
    setSelectedPreset(ms);
    setRemaining(ms);
    pauseTimer();
  }

  return (
    <div className="py-flex-col py-gap-5">
      <div className="py-section-header">
        <h2 className="py-section-header__title">Timers</h2>
      </div>

      <SegmentedControl
        options={[
          { value: "timer", label: "Timer" },
          { value: "focus", label: "Focus" },
          { value: "history", label: "History" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {(mode === "timer" || mode === "focus") && (
        <GlassCard>
          <div className="py-timer">
            <div className="py-timer__display">
              {formatTimerDisplay(remaining)}
            </div>
            <div className="py-timer__label">{label}</div>
            <div className="py-timer__controls">
              {!running ? (
                <PillButton variant="primary" size="lg" onClick={startTimer}>
                  Start
                </PillButton>
              ) : (
                <PillButton variant="secondary" size="lg" onClick={pauseTimer}>
                  Pause
                </PillButton>
              )}
              <PillButton variant="ghost" onClick={resetTimer}>
                Reset
              </PillButton>
            </div>
          </div>
        </GlassCard>
      )}

      {(mode === "timer" || mode === "focus") && (
        <div style={{ display: "flex", gap: "var(--py-space-2)", flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <PillButton
              key={p.ms}
              variant={selectedPreset === p.ms ? "primary" : "secondary"}
              size="sm"
              onClick={() => selectPreset(p.ms)}
            >
              {p.label}
            </PillButton>
          ))}
        </div>
      )}

      {mode === "focus" && (
        <GlassCard compact>
          <p style={{ fontSize: "var(--py-text-caption)", color: "var(--py-ink-secondary)", margin: 0 }}>
            Focus mode: minimize distractions, commit to one task. Link a timer to a task from the Today screen.
          </p>
        </GlassCard>
      )}

      {mode === "history" && (
        <GlassCard>
          <div className="py-text-center" style={{ padding: "var(--py-space-6) 0" }}>
            <NavIcons name="timer" size={36} />
            <p style={{ marginTop: "var(--py-space-3)", color: "var(--py-ink-secondary)" }}>
              Timer history will appear here as you complete focus sessions.
            </p>
          </div>
        </GlassCard>
      )}

      {/* Platform notice */}
      <GlassCard compact>
        <p style={{ fontSize: "var(--py-text-caption)", color: "var(--py-ink-muted)", textAlign: "center", margin: 0 }}>
          Native alarm sounds and background timers require the iOS app. Web timers work while the tab is active.
        </p>
      </GlassCard>
    </div>
  );
}
