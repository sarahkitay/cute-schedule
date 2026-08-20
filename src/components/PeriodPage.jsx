import React, { useMemo, useState } from "react";
import {
  daysUntilDate,
  normalizePeriodState,
  periodPhaseLabel,
  predictNextPeriodStart,
  PERIOD_TRACKER_KEYWORDS,
} from "../modules/period.js";
import { PeriodCycleCalendar } from "./PeriodCycleCalendar.jsx";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PeriodPage({
  periodState,
  onUpdatePeriod,
  onBack,
  onAddPeriodToSchedule,
  embedCalendar = false,
  initialDayKey = null,
}) {
  const [dayKey] = useState(() =>
    initialDayKey && /^\d{4}-\d{2}-\d{2}$/.test(initialDayKey) ? initialDayKey : todayKey(),
  );
  const [showCycleHistory, setShowCycleHistory] = useState(embedCalendar);
  const state = useMemo(() => normalizePeriodState(periodState), [periodState]);
  const { profile, log } = state;
  const todayLog = log[dayKey] || {};
  const nextStart = predictNextPeriodStart(profile.lastPeriodStart, profile.cycleLengthDays);
  const daysUntilNext = nextStart ? daysUntilDate(dayKey, nextStart) : null;
  const phase = periodPhaseLabel(
    dayKey,
    profile.lastPeriodStart,
    profile.cycleLengthDays,
    profile.periodLengthDays,
  );

  function patchProfile(partial) {
    onUpdatePeriod?.((prev) => ({
      ...normalizePeriodState(prev),
      profile: { ...normalizePeriodState(prev).profile, ...partial },
    }));
  }

  function patchTodayLog(partial) {
    onUpdatePeriod?.((prev) => {
      const norm = normalizePeriodState(prev);
      return {
        ...norm,
        log: {
          ...norm.log,
          [dayKey]: { ...(norm.log[dayKey] || {}), ...partial },
        },
      };
    });
  }

  return (
    <div className="period-page page-stack">
      {onBack ? (
        <button type="button" className="social-back" onClick={onBack}>
          ← Back
        </button>
      ) : null}
      <div className="py-glass-card" style={{ padding: 18 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600 }}>Period log</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--py-ink-muted)" }}>
          Private notes and cycle calendar on your device. Never shared with friends.
        </p>
      </div>

      {embedCalendar ? (
        <div className="py-glass-card period-page-calendar-embed" style={{ padding: 12 }}>
          <PeriodCycleCalendar periodState={periodState} embedded />
        </div>
      ) : null}

      <div className="py-glass-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Today</div>
        {phase ? <p style={{ fontSize: 14, margin: "0 0 12px" }}>{phase}</p> : null}
        {daysUntilNext != null && daysUntilNext >= 0 ? (
          <p style={{ fontSize: 13, color: "var(--py-ink-muted)", margin: "0 0 12px" }}>
            Next predicted start in ~{daysUntilNext} day{daysUntilNext === 1 ? "" : "s"}
            {nextStart ? ` (${nextStart})` : ""}
          </p>
        ) : null}
        <label className="social-toggle-row" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={!!todayLog.onPeriod}
            onChange={(e) => patchTodayLog({ onPeriod: e.target.checked })}
          />
          <span>On my period today</span>
        </label>
        <label className="label" htmlFor="period-symptoms">
          Symptoms / notes
        </label>
        <input
          id="period-symptoms"
          className="input"
          value={todayLog.notes || ""}
          onChange={(e) => patchTodayLog({ notes: e.target.value.slice(0, 200) })}
          placeholder="Cramps, energy, mood…"
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          style={{ marginTop: 10 }}
          onClick={() => patchProfile({ lastPeriodStart: dayKey })}
        >
          Period started today
        </button>
        {typeof onAddPeriodToSchedule === "function" ? (
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => onAddPeriodToSchedule(dayKey)}
          >
            Add period to today&apos;s schedule (private)
          </button>
        ) : null}
      </div>

      {!embedCalendar ? (
        <div className="py-glass-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Cycle history</div>
          <p style={{ fontSize: 13, color: "var(--py-ink-muted)", margin: "0 0 12px" }}>
            See logged and estimated period days and rough ovulation windows on a calendar.
          </p>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowCycleHistory(true)}>
            View menstrual cycle history
          </button>
        </div>
      ) : null}

      {showCycleHistory && !embedCalendar ? (
        <PeriodCycleCalendar periodState={periodState} onClose={() => setShowCycleHistory(false)} />
      ) : null}

      <div className="py-glass-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Cycle settings</div>
        <div className="quick-row">
          <label className="label" htmlFor="period-last-start">
            Last period start
          </label>
          <input
            id="period-last-start"
            type="date"
            className="input"
            value={profile.lastPeriodStart || ""}
            onChange={(e) => patchProfile({ lastPeriodStart: e.target.value || null })}
          />
        </div>
        <div className="quick-row">
          <label className="label" htmlFor="period-cycle-len">
            Average cycle (days)
          </label>
          <input
            id="period-cycle-len"
            type="number"
            min={21}
            max={45}
            className="input"
            value={profile.cycleLengthDays}
            onChange={(e) => patchProfile({ cycleLengthDays: Number(e.target.value) || 28 })}
          />
        </div>
        <div className="quick-row">
          <label className="label" htmlFor="period-len">
            Typical period length (days)
          </label>
          <input
            id="period-len"
            type="number"
            min={2}
            max={10}
            className="input"
            value={profile.periodLengthDays}
            onChange={(e) => patchProfile({ periodLengthDays: Number(e.target.value) || 5 })}
          />
        </div>
      </div>

      <details className="page-instructions-bar surface-glass page-instructions-bar--compact">
        <summary className="page-instructions-summary">Keywords</summary>
        <div className="page-instructions-panel">
          <p style={{ margin: 0, fontSize: 13 }}>
            Tasks or notes with words like{" "}
            <strong>{PERIOD_TRACKER_KEYWORDS.slice(0, 6).join(", ")}</strong> can remind you to log here. Estimates
            are not medical advice.
          </p>
        </div>
      </details>
    </div>
  );
}
