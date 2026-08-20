import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../Icons";
import { parseFlexibleDayKey } from "../scheduleDateInput.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthMeta(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const keys = [];
  for (let d = 1; d <= last; d++) keys.push(`${year}-${pad2(month + 1)}-${pad2(d)}`);
  return { firstWeekday, keys };
}

/**
 * @param {{
 *   open: boolean,
 *   taskText?: string,
 *   initialDate?: string,
 *   initialTime?: string,
 *   onClose: () => void,
 *   onConfirm: (targetDayKey: string, targetHourKey: string) => void,
 * }} props
 */
export function MoveTaskDayModal({
  open,
  taskText = "",
  initialDate = "",
  initialTime = "09:00",
  onClose,
  onConfirm,
}) {
  const [targetDate, setTargetDate] = useState(initialDate);
  const [dateTyped, setDateTyped] = useState(initialDate);
  const [targetTime, setTargetTime] = useState(initialTime);
  const seed = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
    ? new Date(`${initialDate}T12:00:00`)
    : new Date();
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  useEffect(() => {
    if (!open) return;
    setTargetDate(initialDate);
    setDateTyped(initialDate);
    setTargetTime(initialTime);
    const d = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? new Date(`${initialDate}T12:00:00`)
      : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [open, initialDate, initialTime]);

  const { firstWeekday, keys } = useMemo(() => monthMeta(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayKey = new Date().toISOString().slice(0, 10);

  function applyDay(dayKey) {
    setTargetDate(dayKey);
    setDateTyped(dayKey);
  }

  function handleTypedDate(value) {
    setDateTyped(value);
    const parsed = parseFlexibleDayKey(value);
    if (parsed) {
      setTargetDate(parsed);
      const d = new Date(`${parsed}T12:00:00`);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const parsed = parseFlexibleDayKey(dateTyped) || targetDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(parsed || "").trim())) return;
    onConfirm(String(parsed).trim(), targetTime || "09:00");
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal surface-glass move-task-day-modal calendar-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-task-day-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="move-task-day-title" className="move-task-day-modal__title">
          Change date
        </h3>
        {taskText ? (
          <p className="move-task-day-modal__task" aria-label="Task">
            {taskText}
          </p>
        ) : null}
        <form className="move-task-day-modal__form" onSubmit={handleSubmit}>
          <div className="quick-row">
            <label className="label" htmlFor="move-task-day-date">
              Date
            </label>
            <input
              id="move-task-day-date"
              className="input"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="Type a date: Aug 20 or 8/20/2026"
              value={dateTyped}
              onChange={(e) => handleTypedDate(e.target.value)}
              required
            />
            <p className="settings-hint move-task-day-modal__hint">
              Type a date or tap a day on the calendar.
            </p>
          </div>

          <div className="move-task-day-modal__cal month-calendar" aria-label="Choose a day">
            <div className="month-calendar-header">
              <span className="month-calendar-header-spacer" aria-hidden />
              <h2 className="month-calendar-title">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <div className="month-calendar-nav">
                <button
                  type="button"
                  className="btn-icon"
                  aria-label="Previous month"
                  onClick={() => {
                    const d = new Date(viewYear, viewMonth - 1, 1);
                    setViewYear(d.getFullYear());
                    setViewMonth(d.getMonth());
                  }}
                >
                  <ChevronLeftIcon style={{ width: 18, height: 18 }} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label="Next month"
                  onClick={() => {
                    const d = new Date(viewYear, viewMonth + 1, 1);
                    setViewYear(d.getFullYear());
                    setViewMonth(d.getMonth());
                  }}
                >
                  <ChevronRightIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
            <div className="month-calendar-weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w} className="month-calendar-weekday">{w}</span>
              ))}
            </div>
            <div className="month-calendar-grid">
              {Array.from({ length: firstWeekday }, (_, i) => (
                <div key={`pad-${i}`} className="month-calendar-day month-calendar-day-empty" />
              ))}
              {keys.map((dayKey) => (
                <button
                  key={dayKey}
                  type="button"
                  className={[
                    "month-calendar-day",
                    dayKey === todayKey ? "is-today" : "",
                    dayKey === targetDate ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => applyDay(dayKey)}
                >
                  <span className="month-calendar-day-num">{Number(dayKey.slice(8))}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="quick-row">
            <label className="label" htmlFor="move-task-day-time">
              Time
            </label>
            <input
              id="move-task-day-time"
              className="input"
              type="time"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              required
            />
          </div>
          <div className="move-task-day-modal__actions">
            <button type="submit" className="btn btn-primary">
              Move task
            </button>
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
