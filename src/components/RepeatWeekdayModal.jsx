import React, { useEffect, useState } from "react";
import { REPEAT_WEEKDAY_LABELS } from "../taskRepeatSeries";

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   subtitle?: string,
 *   initialWeekdays?: number[],
 *   onClose: () => void,
 *   onConfirm: (weekdays: number[]) => void,
 * }} props
 */
export function RepeatWeekdayModal({
  open,
  title = "Repeat every week",
  subtitle = "Choose which days this task should appear.",
  initialWeekdays = [],
  onClose,
  onConfirm,
}) {
  const [selected, setSelected] = useState(() => [...initialWeekdays]);

  useEffect(() => {
    if (open) setSelected([...initialWeekdays]);
  }, [open, initialWeekdays]);

  if (!open) return null;

  function toggle(day) {
    setSelected((prev) => {
      const set = new Set(prev);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return [...set].sort((a, b) => a - b);
    });
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal surface-glass repeat-weekday-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repeat-weekday-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="repeat-weekday-title" className="repeat-weekday-modal__title">
          {title}
        </h3>
        <p className="settings-hint repeat-weekday-modal__subtitle">{subtitle}</p>
        <div className="repeat-weekday-modal__days" role="group" aria-label="Weekdays">
          {REPEAT_WEEKDAY_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              className={`btn btn-sm repeat-weekday-chip${selected.includes(idx) ? " btn-primary" : ""}`}
              aria-pressed={selected.includes(idx)}
              onClick={() => toggle(idx)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="repeat-weekday-modal__actions">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
