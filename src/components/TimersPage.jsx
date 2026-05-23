import React, { useState, useRef, useCallback, useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { PillButton } from "./PillButton";
import { SegmentedControl } from "./SegmentedControl";
import { DockNavIcon } from "../DockNavIcon";
import {
  ALARM_MODES,
  TIMER_TYPES,
  createAlarm,
  formatTimerDisplay,
  getNextAlarmTime,
} from "../modules/timers";
import { requestAlarmPermissions } from "../alarmScheduler";

const PRESETS = [
  { label: "5 min", ms: 5 * 60 * 1000 },
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "25 min", ms: 25 * 60 * 1000 },
  { label: "45 min", ms: 45 * 60 * 1000 },
  { label: "60 min", ms: 60 * 60 * 1000 },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ALARM_MODE_OPTIONS = [
  { value: ALARM_MODES.STANDARD, label: "Standard", desc: "Sound + notification" },
  { value: ALARM_MODES.GENTLE, label: "Gentle", desc: "Softer tones" },
  { value: ALARM_MODES.MATH_DISMISS, label: "Math wake-up", desc: "Solve a quick problem" },
  { value: ALARM_MODES.ACTION_REQUIRED, label: "Writing wake-up", desc: "Type a phrase to dismiss" },
];

export function TimersPage({ timersState, onUpdateTimers, alarmsState, onUpdateAlarms }) {
  const [section, setSection] = useState("timer");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60 * 1000);
  const [selectedPreset, setSelectedPreset] = useState(25 * 60 * 1000);
  const [label, setLabel] = useState("Focus");
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const durationRef = useRef(null);

  const [showAddAlarm, setShowAddAlarm] = useState(false);
  const [newAlarmTime, setNewAlarmTime] = useState("07:00");
  const [newAlarmLabel, setNewAlarmLabel] = useState("Morning alarm");
  const [newAlarmMode, setNewAlarmMode] = useState(ALARM_MODES.STANDARD);
  const [newAlarmDays, setNewAlarmDays] = useState([1, 2, 3, 4, 5]);

  const alarms = alarmsState?.alarms || [];
  const history = timersState?.history || [];

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (section === "alarms") requestAlarmPermissions();
  }, [section]);

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
        if (typeof onUpdateTimers === "function") {
          onUpdateTimers((prev) => ({
            ...prev,
            history: [
              { id: Date.now(), label, durationMs: durationRef.current, completedAt: Date.now(), type: TIMER_TYPES.FOCUS },
              ...(prev?.history || []).slice(0, 49),
            ],
          }));
        }
      }
    }, 100);
  }, [remaining, label, onUpdateTimers]);

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

  function toggleAlarmDay(day) {
    setNewAlarmDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }

  function addAlarm(e) {
    e.preventDefault();
    if (!newAlarmTime) return;
    const alarm = createAlarm({
      time: newAlarmTime,
      label: newAlarmLabel.trim() || "Morning alarm",
      mode: newAlarmMode,
      days: newAlarmDays.length ? newAlarmDays : [0, 1, 2, 3, 4, 5, 6],
    });
    onUpdateAlarms?.((prev) => ({ ...prev, alarms: [...(prev?.alarms || []), alarm] }));
    setShowAddAlarm(false);
  }

  function toggleAlarmEnabled(id) {
    onUpdateAlarms?.((prev) => ({
      ...prev,
      alarms: (prev?.alarms || []).map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    }));
  }

  function removeAlarm(id) {
    onUpdateAlarms?.((prev) => ({
      ...prev,
      alarms: (prev?.alarms || []).filter((a) => a.id !== id),
    }));
  }

  return (
    <div className="py-flex-col py-gap-5 timers-page">
      <div className="py-section-header">
        <div className="py-section-header__title-row">
          <DockNavIcon tabId="timers" active />
          <h2 className="py-section-header__title">Timers & Alarms</h2>
        </div>
      </div>

      <SegmentedControl
        options={[
          { value: "timer", label: "Timer" },
          { value: "alarms", label: "Alarms" },
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

      {section === "alarms" && (
        <>
          <GlassCard compact className="timers-info-card">
            <p className="timers-info-text">
              Alarms ring with sound while PROYOU is open. On iPhone, the native app delivers reliable morning alarms even when the app is closed.
              Add a wake-up challenge to make snoozing harder.
            </p>
          </GlassCard>

          <div className="timers-alarm-toolbar">
            <PillButton variant="primary" size="sm" onClick={() => setShowAddAlarm((v) => !v)}>
              {showAddAlarm ? "Cancel" : "+ Morning alarm"}
            </PillButton>
          </div>

          {showAddAlarm ? (
            <GlassCard className="timers-alarm-form-card">
              <form className="timers-alarm-form" onSubmit={addAlarm}>
                <label className="timers-field">
                  <span className="timers-field-label">Time</span>
                  <input type="time" className="input" value={newAlarmTime} onChange={(e) => setNewAlarmTime(e.target.value)} required />
                </label>
                <label className="timers-field">
                  <span className="timers-field-label">Label</span>
                  <input className="input" value={newAlarmLabel} onChange={(e) => setNewAlarmLabel(e.target.value)} placeholder="Morning alarm" />
                </label>
                <div className="timers-field">
                  <span className="timers-field-label">Wake-up style</span>
                  <div className="timers-alarm-mode-grid">
                    {ALARM_MODE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`timers-alarm-mode-option${newAlarmMode === opt.value ? " is-selected" : ""}`}
                        onClick={() => setNewAlarmMode(opt.value)}
                      >
                        <span className="timers-alarm-mode-label">{opt.label}</span>
                        <span className="timers-alarm-mode-desc">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="timers-field">
                  <span className="timers-field-label">Repeat</span>
                  <div className="timers-day-pills">
                    {DAY_LABELS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        className={`timers-day-pill${newAlarmDays.includes(i) ? " is-on" : ""}`}
                        onClick={() => toggleAlarmDay(i)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <PillButton variant="primary" type="submit">
                  Save alarm
                </PillButton>
              </form>
            </GlassCard>
          ) : null}

          {alarms.length === 0 ? (
            <GlassCard>
              <div className="timers-empty">
                <DockNavIcon tabId="timers" active={false} />
                <p>No alarms yet. Add a morning alarm to start your day on your terms.</p>
              </div>
            </GlassCard>
          ) : (
            <ul className="timers-alarm-list">
              {alarms.map((alarm) => {
                const next = getNextAlarmTime(alarm);
                const modeMeta = ALARM_MODE_OPTIONS.find((o) => o.value === alarm.mode);
                return (
                  <li key={alarm.id} className={`timers-alarm-item${alarm.enabled ? "" : " is-off"}`}>
                    <div className="timers-alarm-main">
                      <span className="timers-alarm-time">{alarm.time}</span>
                      <div className="timers-alarm-meta">
                        <span className="timers-alarm-label">{alarm.label}</span>
                        <span className="timers-alarm-mode">{modeMeta?.label || "Standard"}</span>
                        {next ? (
                          <span className="timers-alarm-next">
                            Next: {next.toLocaleDateString(undefined, { weekday: "short" })} {next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="timers-alarm-actions">
                      <label className="timers-alarm-toggle">
                        <input type="checkbox" checked={!!alarm.enabled} onChange={() => toggleAlarmEnabled(alarm.id)} />
                        <span className="timers-alarm-toggle-ui" />
                      </label>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeAlarm(alarm.id)}>
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
              {history.map((h) => (
                <li key={h.id} className="timers-history-item">
                  <span>{h.label || "Focus"}</span>
                  <span className="timers-history-duration">{formatTimerDisplay(h.durationMs || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}
    </div>
  );
}
