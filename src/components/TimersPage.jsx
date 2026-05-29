import React, { useState, useRef, useEffect, useMemo } from "react";
import { FeatureGate } from "./FeatureGate.jsx";
import { GlassCard } from "./GlassCard";
import { PillButton } from "./PillButton";
import { SegmentedControl } from "./SegmentedControl";
import { DockNavIcon } from "../DockNavIcon";
import {
  ALARM_MODES,
  createAlarm,
  formatTimerDisplay,
  formatTimerPresetLabel,
  formatAlarmTimeDisplay,
  getNextAlarmTime,
  defaultActiveTimerDraft,
  normalizeActiveTimer,
  getActiveTimerRemaining,
  startActiveTimer,
  pauseActiveTimer,
  resetActiveTimer,
} from "../modules/timers";
import { requestAlarmPermissions } from "../alarmScheduler";
import {
  isAppleMusicLibraryPickerAvailable,
  pickSongFromAppleMusicLibrary,
} from "../alarmMusicPicker";
import { Capacitor } from "@capacitor/core";
import {
  ALARM_SOUND_IDS,
  BUILTIN_ALARM_SOUNDS,
  saveCustomAlarmSound,
  previewAlarmSound,
  stopAlarmSoundPlayback,
  getAlarmSoundLabel,
} from "../alarmSounds";

const PRESETS = [
  { label: "5 min", ms: 5 * 60 * 1000 },
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "25 min", ms: 25 * 60 * 1000 },
  { label: "45 min", ms: 45 * 60 * 1000 },
  { label: "60 min", ms: 60 * 60 * 1000 },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ALARM_MODE_OPTIONS = [
  { value: ALARM_MODES.STANDARD, label: "Standard", desc: "Sound + one-tap dismiss" },
  { value: ALARM_MODES.GENTLE, label: "Gentle", desc: "Softer tones" },
  { value: ALARM_MODES.MATH_DISMISS, label: "Math wake-up", desc: "Optional game: solve to turn off" },
  { value: ALARM_MODES.ACTION_REQUIRED, label: "Writing wake-up", desc: "Optional game: type phrase to turn off" },
];

export function TimersPage({
  timersState,
  onUpdateTimers,
  alarmsState,
  onUpdateAlarms,
  resolveTimerHistoryTask,
}) {
  const [section, setSection] = useState("timer");
  const [tick, setTick] = useState(() => Date.now());

  const activeTimer = normalizeActiveTimer(timersState?.activeTimer);
  const selectedPreset = activeTimer?.selectedPresetMs ?? 25 * 60 * 1000;
  const label = activeTimer?.label ?? "Focus";
  const running = !!activeTimer?.running;
  const remaining = useMemo(() => {
    void tick;
    return activeTimer ? getActiveTimerRemaining(activeTimer) : selectedPreset;
  }, [tick, activeTimer, selectedPreset]);

  const [showAddAlarm, setShowAddAlarm] = useState(false);
  const [newAlarmTime, setNewAlarmTime] = useState("07:00");
  const [newAlarmLabel, setNewAlarmLabel] = useState("Morning alarm");
  const [newAlarmMode, setNewAlarmMode] = useState(ALARM_MODES.STANDARD);
  const [newAlarmDays, setNewAlarmDays] = useState([1, 2, 3, 4, 5]);
  const [newAlarmSound, setNewAlarmSound] = useState(ALARM_SOUND_IDS.DEFAULT);
  const [newAlarmCustomSoundId, setNewAlarmCustomSoundId] = useState(null);
  const [newAlarmCustomSoundName, setNewAlarmCustomSoundName] = useState("");
  const [soundImportError, setSoundImportError] = useState("");
  const [soundImporting, setSoundImporting] = useState(false);
  const musicInputRef = useRef(null);
  const appleMusicPickerAvailable = isAppleMusicLibraryPickerAvailable();

  const alarms = alarmsState?.alarms || [];
  const history = timersState?.history || [];

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [running, activeTimer?.endsAt]);

  useEffect(() => {
    if (section === "alarms") requestAlarmPermissions();
  }, [section]);

  useEffect(() => () => stopAlarmSoundPlayback(), []);

  function patchActiveTimer(nextActive) {
    onUpdateTimers?.((prev) => ({ ...prev, activeTimer: nextActive }));
  }

  function startTimer() {
    const next = startActiveTimer(activeTimer ?? defaultActiveTimerDraft(selectedPreset), {
      remainingMs: remaining,
      label,
    });
    patchActiveTimer(next);
  }

  function pauseTimer() {
    patchActiveTimer(pauseActiveTimer(activeTimer));
  }

  function resetTimer() {
    patchActiveTimer(resetActiveTimer(activeTimer, selectedPreset));
  }

  function selectPreset(ms) {
    patchActiveTimer(resetActiveTimer(activeTimer ?? defaultActiveTimerDraft(ms), ms));
  }

  function toggleAlarmDay(day) {
    setNewAlarmDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }

  function addAlarm(e) {
    e.preventDefault();
    if (!newAlarmTime) return;
    if (newAlarmSound === ALARM_SOUND_IDS.CUSTOM && !newAlarmCustomSoundId) {
      setSoundImportError("Choose a song or audio clip from your device first.");
      return;
    }
    const alarm = createAlarm({
      time: newAlarmTime,
      label: newAlarmLabel.trim() || "Morning alarm",
      mode: newAlarmMode,
      days: newAlarmDays.length ? newAlarmDays : [0, 1, 2, 3, 4, 5, 6],
      sound: newAlarmSound,
      customSoundId: newAlarmSound === ALARM_SOUND_IDS.CUSTOM ? newAlarmCustomSoundId : null,
      customSoundName: newAlarmSound === ALARM_SOUND_IDS.CUSTOM ? newAlarmCustomSoundName : null,
    });
    onUpdateAlarms?.((prev) => ({ ...prev, alarms: [...(prev?.alarms || []), alarm] }));
    setShowAddAlarm(false);
    setSoundImportError("");
  }

  async function importAlarmMusicFile(file, displayName, { manageLoading = true } = {}) {
    if (!file) return;
    setSoundImportError("");
    if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(file.name)) {
      setSoundImportError("Please pick an audio file (MP3, M4A, WAV, etc.).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setSoundImportError("File is too large. Try a shorter clip under 15 MB.");
      return;
    }
    if (manageLoading) setSoundImporting(true);
    try {
      const id = `custom_${Date.now().toString(36)}`;
      const name = displayName || file.name.replace(/\.[^.]+$/, "");
      await saveCustomAlarmSound(id, name, file);
      setNewAlarmSound(ALARM_SOUND_IDS.CUSTOM);
      setNewAlarmCustomSoundId(id);
      setNewAlarmCustomSoundName(name);
    } catch {
      setSoundImportError("Could not save that file. Try a different clip.");
    } finally {
      if (manageLoading) setSoundImporting(false);
    }
  }

  async function handleMusicFile(file) {
    await importAlarmMusicFile(file);
  }

  async function handlePickFromAppleMusic() {
    setSoundImportError("");
    setNewAlarmSound(ALARM_SOUND_IDS.CUSTOM);
    if (!appleMusicPickerAvailable) {
      setSoundImportError(
        Capacitor.getPlatform() === "ios"
          ? "Rebuild the app from Xcode on a real iPhone to use the music library picker. Or use Choose from Files."
          : "On iPhone: open Music → song → Share → Save to Files, then tap Choose from Files here. On Mac/web, use Choose from Files."
      );
      return;
    }
    setSoundImporting(true);
    try {
      const { file, title } = await pickSongFromAppleMusicLibrary();
      await importAlarmMusicFile(file, title, { manageLoading: false });
    } catch (e) {
      const msg = e?.message || "";
      if (e?.code === "CANCELLED" || /cancel/i.test(msg)) return;
      setSoundImportError(msg || "Could not import that song.");
    } finally {
      setSoundImporting(false);
    }
  }

  function previewSound(soundId, customId = null) {
    void previewAlarmSound(soundId, customId);
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
    <div className="py-flex-col py-gap-5 timers-page page-stack">
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
        <FeatureGate feature="advanced_alarms">
        <>
          <div className="timers-alarm-toolbar">
            <PillButton
              variant="primary"
              size="md"
              className="timers-alarm-add-btn"
              onClick={() => setShowAddAlarm((v) => !v)}
            >
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
                  <span className="timers-field-label">Alarm sound</span>
                  <div className="timers-sound-grid">
                    {BUILTIN_ALARM_SOUNDS.filter((s) => s.id !== ALARM_SOUND_IDS.CUSTOM).map((opt) => (
                      <div key={opt.id} className={`timers-sound-option${newAlarmSound === opt.id ? " is-selected" : ""}`}>
                        <button
                          type="button"
                          className="timers-sound-option-main"
                          onClick={() => {
                            setNewAlarmSound(opt.id);
                            setSoundImportError("");
                          }}
                        >
                          <span className="timers-alarm-mode-label">{opt.label}</span>
                          <span className="timers-alarm-mode-desc">{opt.desc}</span>
                        </button>
                        <button
                          type="button"
                          className="timers-sound-preview-btn"
                          aria-label={`Preview ${opt.label}`}
                          onClick={() => previewSound(opt.id)}
                        >
                          ▶
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={`timers-sound-custom${newAlarmSound === ALARM_SOUND_IDS.CUSTOM ? " is-selected" : ""}`}>
                    <button
                      type="button"
                      className="timers-sound-custom-main"
                      onClick={() => setNewAlarmSound(ALARM_SOUND_IDS.CUSTOM)}
                    >
                      <span className="timers-alarm-mode-label">Your music</span>
                      <span className="timers-alarm-mode-desc">
                        {newAlarmCustomSoundName || "Pick from your library or a file on your device"}
                      </span>
                    </button>
                    <div className="timers-sound-custom-actions">
                      {appleMusicPickerAvailable ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={soundImporting}
                          onClick={() => void handlePickFromAppleMusic()}
                        >
                          {soundImporting ? "Saving…" : "Apple Music library"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={soundImporting}
                        onClick={() => musicInputRef.current?.click()}
                      >
                        {soundImporting ? "Saving…" : newAlarmCustomSoundName ? "Change file" : "Choose from Files"}
                      </button>
                      {newAlarmCustomSoundId ? (
                        <button
                          type="button"
                          className="timers-sound-preview-btn"
                          aria-label="Preview your music"
                          onClick={() => previewSound(ALARM_SOUND_IDS.CUSTOM, newAlarmCustomSoundId)}
                        >
                          ▶
                        </button>
                      ) : null}
                    </div>
                    <input
                      ref={musicInputRef}
                      type="file"
                      accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac"
                      className="timers-sound-file-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleMusicFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {soundImportError ? <p className="timers-sound-error">{soundImportError}</p> : null}
                  <p className="timers-sound-import-hint">
                    {appleMusicPickerAvailable
                      ? "Apple Music library opens your on-device songs (download a track in Music first if it’s streaming-only). Files works for MP3/M4A in iCloud or On My iPhone."
                      : "On iPhone without a native build: Music → song → Share → Save to Files, then Choose from Files. Built-in alarm sounds work everywhere."}
                  </p>
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
                      <span className="timers-alarm-time">{formatAlarmTimeDisplay(alarm.time)}</span>
                      <div className="timers-alarm-meta">
                        <span className="timers-alarm-label">{alarm.label}</span>
                        <span className="timers-alarm-mode">{modeMeta?.label || "Standard"}</span>
                        <span className="timers-alarm-sound">{getAlarmSoundLabel(alarm)}</span>
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
        </FeatureGate>
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
