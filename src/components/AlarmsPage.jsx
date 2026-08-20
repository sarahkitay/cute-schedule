import React, { useCallback, useEffect, useState } from "react";
import {
  ALARM_MODES,
  alarmRequiresWakeUpChallenge,
  createAlarm,
  getNextAlarmTime,
  saveAlarmsToDisk,
} from "../modules/timers.js";
import {
  BUILTIN_ALARM_SOUNDS,
  getAlarmSoundLabel,
  previewAlarmSound,
} from "../alarmSounds.js";
import { requestAlarmPermissions } from "../alarmScheduler.js";
import {
  getAlarmKitAuthorizationState,
  isAlarmKitAvailable,
  requestAlarmKitAuthorization,
  syncAlarmSoundsForAlarmKit,
} from "../nativeAlarmKit.js";
import { resyncAlarmNotifications } from "../nativeAlarmNotifications.js";

const WEEKDAYS = [
  { d: 0, l: "S" },
  { d: 1, l: "M" },
  { d: 2, l: "T" },
  { d: 3, l: "W" },
  { d: 4, l: "T" },
  { d: 5, l: "F" },
  { d: 6, l: "S" },
];

const WAKE_MODE_OPTIONS = [
  { id: ALARM_MODES.STANDARD, label: "Standard", desc: "Tap to dismiss" },
  { id: ALARM_MODES.GENTLE, label: "Gentle", desc: "Softer tone pattern" },
  { id: ALARM_MODES.MATH_DISMISS, label: "Math", desc: "3 quick easy problems" },
  { id: ALARM_MODES.ACTION_REQUIRED, label: "Typing", desc: "Type phrases exactly" },
  { id: ALARM_MODES.RIDDLE, label: "Riddle", desc: "3 easy morning riddles" },
  { id: ALARM_MODES.PUZZLE, label: "Puzzle", desc: "Slide tiles into place" },
];

function formatNextAlarm(alarm) {
  const next = getNextAlarmTime(alarm);
  if (!next) return "No upcoming ring";
  const isToday = next.toDateString() === new Date().toDateString();
  const time = next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return isToday ? `Today ${time}` : next.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function modeLabel(mode) {
  return WAKE_MODE_OPTIONS.find((m) => m.id === mode)?.label || "Standard";
}

export function AlarmsPage({ alarmsState, onUpdateAlarms, popToRootSignal = 0 }) {
  const alarms = alarmsState?.alarms || [];
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [permMsg, setPermMsg] = useState("");
  const [kitStatus, setKitStatus] = useState("");

  useEffect(() => {
    if (!popToRootSignal) return;
    setEditing(null);
    setDraft(null);
  }, [popToRootSignal]);

  useEffect(() => {
    void (async () => {
      await requestAlarmPermissions();
      const available = await isAlarmKitAvailable();
      if (!available) {
        setKitStatus("System alarms need iOS 26+ on this device. Until then, PROYOU uses notification alarms.");
        setPermMsg("");
        void resyncAlarmNotifications(alarms);
        return;
      }
      let auth = await getAlarmKitAuthorizationState();
      if (auth !== "authorized") {
        auth = await requestAlarmKitAuthorization();
      }
      if (auth === "authorized") {
        setKitStatus("System alarms are on. They ring like the Clock app, including Silent mode.");
        setPermMsg("");
      } else {
        setKitStatus("");
        setPermMsg("Allow Alarms for PROYOU in Settings to use real system alarms.");
      }
      void resyncAlarmNotifications(alarms);
      void syncAlarmSoundsForAlarmKit(alarms);
    })();
    // Only on mount — avoid resync loops when alarms change (app.jsx already syncs on alarmsState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    (next) => {
      onUpdateAlarms?.(next);
      saveAlarmsToDisk(next);
      void syncAlarmSoundsForAlarmKit(next.alarms || []);
      void resyncAlarmNotifications(next.alarms || []);
    },
    [onUpdateAlarms],
  );

  function openNew() {
    setDraft(createAlarm({ label: "Wake up", time: "07:00", allowEmergencyOverride: true }));
    setEditing("new");
  }

  function openEdit(alarm) {
    setDraft({ ...alarm, sound: alarm.sound === "custom" ? "default" : alarm.sound });
    setEditing(alarm.id);
  }

  function closeForm() {
    setEditing(null);
    setDraft(null);
  }

  function saveDraft() {
    if (!draft?.time) return;
    const list = [...alarms];
    if (editing === "new") list.push(draft);
    else {
      const i = list.findIndex((a) => a.id === draft.id);
      if (i >= 0) list[i] = draft;
    }
    persist({ alarms: list });
    closeForm();
  }

  function removeAlarm(id) {
    persist({ alarms: alarms.filter((a) => a.id !== id) });
    if (editing === id) closeForm();
  }

  function toggleEnabled(alarm) {
    persist({
      alarms: alarms.map((a) => (a.id === alarm.id ? { ...a, enabled: !a.enabled } : a)),
    });
  }

  const formVisible = Boolean(draft);
  const selectedSoundMeta = BUILTIN_ALARM_SOUNDS.find((s) => s.id === draft?.sound);

  return (
      <div className="timers-page page-stack">
        <div className="py-glass-card" style={{ padding: 16 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600 }}>Alarms</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--py-ink-muted)" }}>
            Wake-up games run on your lock screen on iOS 26+ (no need to unlock). You can also finish in the app if you open PROYOU. Snooze or use emergency override (double confirm) if enabled below.
          </p>
          {kitStatus ? <p className="timers-alarm-auth-ok">{kitStatus}</p> : null}
          {permMsg ? (
            <p className={permMsg.includes("Allow") ? "timers-alarm-auth-warn" : "timers-alarm-auth-ok"}>{permMsg}</p>
          ) : null}
        </div>

        <div className="timers-alarm-toolbar">
          <button type="button" className="btn btn-primary timers-alarm-add-btn" onClick={openNew}>
            Add alarm
          </button>
        </div>

        {formVisible ? (
          <div className="py-glass-card timers-alarm-form-card">
            <div className="timers-alarm-form">
              <div className="quick-row">
                <label className="label">Time</label>
                <input
                  type="time"
                  className="input"
                  value={draft.time}
                  onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                />
              </div>
              <div className="quick-row">
                <label className="label" htmlFor="alarm-label">
                  Label
                </label>
                <input
                  id="alarm-label"
                  className="input timers-alarm-label-input"
                  value={draft.label || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value.slice(0, 80) }))}
                  placeholder="Wake up"
                />
              </div>

              <div className="timers-form-section-label">Repeat days</div>
              <div className="timers-day-pills">
                {WEEKDAYS.map(({ d, l }) => {
                  const days = draft.days || [];
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`timers-day-pill${on ? " is-on" : ""}`}
                      onClick={() =>
                        setDraft((prev) => {
                          const cur = Array.isArray(prev.days) ? [...prev.days] : [];
                          const next = on ? cur.filter((x) => x !== d) : [...cur, d].sort();
                          return { ...prev, days: next.length ? next : [d] };
                        })
                      }
                    >
                      {l}
                    </button>
                  );
                })}
              </div>

              <div className="timers-form-section-label">Wake-up game</div>
              <div className="timers-alarm-mode-grid">
                {WAKE_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`timers-alarm-mode-option${draft.mode === opt.id ? " is-selected" : ""}`}
                    onClick={() => setDraft((d) => ({ ...d, mode: opt.id }))}
                  >
                    <span className="timers-alarm-mode-label">{opt.label}</span>
                    <span className="timers-alarm-mode-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>

              <div className="timers-form-section-label">Alarm sound</div>
              <p className="settings-hint" style={{ marginTop: 0 }}>
                Built-in alarm tones play through AlarmKit on iOS, same channel as the Clock alarm, not focus timers.
              </p>
              <div className="timers-sound-grid">
                {BUILTIN_ALARM_SOUNDS.map((s) => (
                  <div
                    key={s.id}
                    className={`timers-sound-option${draft.sound === s.id ? " is-selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="timers-sound-option-main"
                      onClick={() => setDraft((d) => ({ ...d, sound: s.id }))}
                    >
                      <strong>{s.label}</strong>
                      <div style={{ fontSize: 12, color: "var(--text-soft)" }}>{s.desc}</div>
                    </button>
                    <button
                      type="button"
                      className="timers-sound-preview-btn"
                      aria-label={`Preview ${s.label}`}
                      onClick={() => void previewAlarmSound(s.id)}
                    >
                      ▶
                    </button>
                  </div>
                ))}
              </div>
              {selectedSoundMeta?.contentWarning ? (
                <p className="alarm-sound-content-warning" role="status">
                  ⚠️ {selectedSoundMeta.contentWarning}
                </p>
              ) : null}

              <label className="social-toggle-row" style={{ marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={draft.allowEmergencyOverride !== false}
                  onChange={(e) => setDraft((d) => ({ ...d, allowEmergencyOverride: e.target.checked }))}
                />
                <span>Allow emergency override (requires two confirmations)</span>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-primary" onClick={saveDraft}>
                  Save alarm
                </button>
                <button type="button" className="btn btn-sm" onClick={closeForm}>
                  Cancel
                </button>
                {editing !== "new" ? (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeAlarm(draft.id)}>
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {alarms.length === 0 ? (
          <p className="timers-empty">No alarms yet. Add one to wake up with a game or gentle dismiss.</p>
        ) : (
          <ul className="timers-alarm-list">
            {alarms.map((alarm) => (
              <li key={alarm.id} className={`timers-alarm-item${alarm.enabled ? "" : " is-off"}`}>
                <button type="button" style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: 0 }} onClick={() => openEdit(alarm)}>
                  <div className="timers-alarm-time">{alarm.time}</div>
                  <div className="timers-alarm-meta">
                    <span className="timers-alarm-label">{alarm.label || "Alarm"}</span>
                    <span className="timers-alarm-mode">
                      {alarmRequiresWakeUpChallenge(alarm) ? `${modeLabel(alarm.mode)} game` : modeLabel(alarm.mode)}
                    </span>
                    <span className="timers-alarm-sound">{getAlarmSoundLabel(alarm)}</span>
                    <span className="timers-alarm-next">{formatNextAlarm(alarm)}</span>
                  </div>
                </button>
                <label className="timers-alarm-toggle">
                  <input type="checkbox" checked={!!alarm.enabled} onChange={() => toggleEnabled(alarm)} />
                  <span className="timers-alarm-toggle-ui" />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
  );
}
