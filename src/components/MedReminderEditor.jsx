import React from "react";
import { normalizeMedTimeKey } from "../modules/medications";

/**
 * Per-medication daily reminder toggle + time pickers.
 */
export function MedReminderEditor({ enabled, times, onChange, compact = false }) {
  const safeTimes = (times || []).map(normalizeMedTimeKey).filter(Boolean);
  const displayTimes = safeTimes.length ? safeTimes : ["08:00"];

  function setEnabled(next) {
    onChange({
      reminderEnabled: next,
      reminderTimes: next && !safeTimes.length ? ["08:00"] : safeTimes,
    });
  }

  function setTimeAt(index, value) {
    const hm = normalizeMedTimeKey(value);
    if (!hm) return;
    const next = [...displayTimes];
    next[index] = hm;
    onChange({ reminderEnabled: true, reminderTimes: [...new Set(next)].sort() });
  }

  function addTime() {
    onChange({ reminderEnabled: true, reminderTimes: [...displayTimes, "12:00"] });
  }

  function removeTimeAt(index) {
    const next = displayTimes.filter((_, i) => i !== index);
    onChange({
      reminderEnabled: next.length > 0,
      reminderTimes: next.length ? next : ["08:00"],
    });
  }

  return (
    <div className={`py-med-reminder${compact ? " py-med-reminder--compact" : ""}`}>
      <label className="py-med-reminder-toggle">
        <input type="checkbox" checked={!!enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>Daily reminder</span>
      </label>
      {enabled ? (
        <div className="py-med-reminder-times">
          <span className="py-med-reminder-times-label">Remind at</span>
          {displayTimes.map((hm, index) => (
            <div key={`${hm}-${index}`} className="py-med-reminder-time-row">
              <input
                type="time"
                className="py-input py-med-reminder-time-input"
                value={hm}
                onChange={(e) => setTimeAt(index, e.target.value)}
                aria-label={`Reminder time ${index + 1}`}
              />
              {displayTimes.length > 1 ? (
                <button
                  type="button"
                  className="py-med-reminder-remove-time"
                  onClick={() => removeTimeAt(index)}
                  aria-label="Remove reminder time"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="py-med-reminder-add-time" onClick={addTime}>
            + Add time
          </button>
        </div>
      ) : null}
    </div>
  );
}
