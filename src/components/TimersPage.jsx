import React, { useState, useEffect, useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { PillButton } from "./PillButton";
import { SegmentedControl } from "./SegmentedControl";
import { DockNavIcon } from "../DockNavIcon";
import {
  formatTimerDisplay,
  formatTimerPresetLabel,
  defaultActiveTimerDraft,
  normalizeActiveTimer,
  getActiveTimerRemaining,
  startActiveTimer,
  pauseActiveTimer,
  resetActiveTimer,
} from "../modules/timers";
import {
  cancelTaskFocusTimerNotification,
  requestTimerNotificationPermissions,
  syncTaskFocusTimerNotification,
  stopTaskTimerCompleteAlert,
  subscribeTaskTimerRinging,
} from "../taskTimerNotify.js";

const PRESETS = [
  { label: "5 min", ms: 5 * 60 * 1000 },
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "25 min", ms: 25 * 60 * 1000 },
  { label: "45 min", ms: 45 * 60 * 1000 },
  { label: "60 min", ms: 60 * 60 * 1000 },
];

export function TimersPage({ timersState, onUpdateTimers, resolveTimerHistoryTask, popToRootSignal = 0 }) {
  const [section, setSection] = useState("timer");
  const [tick, setTick] = useState(() => Date.now());
  const [timerRinging, setTimerRinging] = useState(false);
  const [permHint, setPermHint] = useState("");

  useEffect(() => {
    if (!popToRootSignal) return;
    setSection("timer");
  }, [popToRootSignal]);

  useEffect(() => subscribeTaskTimerRinging(setTimerRinging), []);

  const activeTimer = normalizeActiveTimer(timersState?.activeTimer);
  const selectedPreset = activeTimer?.selectedPresetMs ?? 25 * 60 * 1000;
  const label = activeTimer?.label ?? "Focus";
  const running = !!activeTimer?.running;
  const remaining = useMemo(() => {
    void tick;
    return activeTimer ? getActiveTimerRemaining(activeTimer) : selectedPreset;
  }, [tick, activeTimer, selectedPreset]);

  const history = timersState?.history || [];

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [running, activeTimer?.endsAt]);

  function patchActiveTimer(nextActive) {
    onUpdateTimers?.((prev) => ({ ...prev, activeTimer: nextActive }));
  }

  async function startTimer() {
    setPermHint("");
    await requestTimerNotificationPermissions();
    const next = startActiveTimer(activeTimer ?? defaultActiveTimerDraft(selectedPreset), {
      remainingMs: remaining,
      label,
    });
    patchActiveTimer(next);
    const sync = await syncTaskFocusTimerNotification(next);
    if (sync.scheduled === 0 && sync.mode !== "alarmKit") {
      setPermHint(
        "Allow Alarms for PROYOU in Settings so the timer can ring when time is up.",
      );
    }
  }

  function pauseTimer() {
    patchActiveTimer(pauseActiveTimer(activeTimer));
    void cancelTaskFocusTimerNotification();
  }

  function resetTimer() {
    void stopTaskTimerCompleteAlert();
    onUpdateTimers?.((prev) => {
      const current = normalizeActiveTimer(prev.activeTimer);
      const presetMs = current?.selectedPresetMs ?? selectedPreset;
      return { ...prev, activeTimer: resetActiveTimer(prev.activeTimer, presetMs) };
    });
    void cancelTaskFocusTimerNotification();
    setTick(Date.now());
  }

  function selectPreset(ms) {
    onUpdateTimers?.((prev) => ({
      ...prev,
      activeTimer: resetActiveTimer(prev.activeTimer ?? defaultActiveTimerDraft(ms), ms),
    }));
    setTick(Date.now());
  }

  return (
    <div className="py-flex-col py-gap-5 timers-page page-stack">
      <div className="py-section-header">
        <div className="py-section-header__title-row">
          <DockNavIcon tabId="timers" active />
          <h2 className="py-section-header__title">Timers</h2>
        </div>
      </div>

      <p className="health-subline" style={{ margin: "-8px 0 0" }}>
        On iPhone, focus timers can use the system alarm when Alarms are allowed. You still see the countdown in the app while it runs.
      </p>
      {permHint ? (
        <p className="login-gate-error" role="alert" style={{ margin: 0 }}>
          {permHint}
        </p>
      ) : null}

      <SegmentedControl
        options={[
          { value: "timer", label: "Timer" },
          { value: "history", label: "History" },
        ]}
        value={section}
        onChange={setSection}
      />

      {section === "timer" && (
        <>
          <GlassCard className="timers-display-card">
            <div className="py-timer">
              <div className="py-timer__display">{formatTimerDisplay(remaining)}</div>
              <div className="py-timer__label">{label}</div>
              <div className="py-timer__controls">
                {timerRinging ? (
                  <PillButton
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      void stopTaskTimerCompleteAlert();
                    }}
                  >
                    Dismiss
                  </PillButton>
                ) : !running ? (
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

          <div className="timers-preset-row">
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
        </>
      )}

      {section === "history" && (
        <GlassCard>
          {history.length === 0 ? (
            <div className="timers-empty">
              <DockNavIcon tabId="timers" active={false} />
              <p>Completed focus sessions will show up here.</p>
            </div>
          ) : (
            <ul className="timers-history-list">
              {history.map((h) => {
                const presetMs = h.presetMs ?? h.durationMs ?? 0;
                const linked = h.linkedTask;
                const taskInfo = linked && resolveTimerHistoryTask ? resolveTimerHistoryTask(h) : null;
                const title = linked
                  ? taskInfo?.text || linked.taskText || h.label || "Task"
                  : h.label || "Focus";
                return (
                  <li key={h.id} className="timers-history-item">
                    <div className="timers-history-main">
                      <span className="timers-history-title">{title}</span>
                      {linked ? (
                        <span className="timers-history-meta">
                          <span
                            className={
                              taskInfo?.done || h.taskCompleted
                                ? "timers-history-task-status is-done"
                                : "timers-history-task-status"
                            }
                          >
                            {taskInfo?.done || h.taskCompleted ? "Task completed" : "Task not completed"}
                          </span>
                        </span>
                      ) : (
                        <span className="timers-history-meta">Focus session</span>
                      )}
                    </div>
                    <span className="timers-history-duration" title="Timer length">
                      {formatTimerPresetLabel(presetMs)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      )}
    </div>
  );
}
