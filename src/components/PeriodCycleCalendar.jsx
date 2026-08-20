import React, { useMemo, useState } from "react";
import { enumerateOvulationDays, enumeratePeriodDays } from "../modules/period.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDayKeysInMonthLocal(year, month) {
  const days = [];
  const n = new Date(year, month + 1, 0).getDate();
  const m = String(month + 1).padStart(2, "0");
  for (let d = 1; d <= n; d++) {
    days.push(`${year}-${m}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function monthRangeKeys(year, month) {
  const keys = getDayKeysInMonthLocal(year, month);
  return { from: keys[0], to: keys[keys.length - 1] };
}

/**
 * @param {{ periodState: object, onClose?: () => void, embedded?: boolean }} props
 */
export function PeriodCycleCalendar({ periodState, onClose, embedded = false }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const dayKeys = getDayKeysInMonthLocal(year, month);
  const padding = Array(new Date(year, month, 1).getDay()).fill(null);
  const { from, to } = monthRangeKeys(year, month);

  const periodDays = useMemo(
    () => new Set(enumeratePeriodDays(periodState, from, to)),
    [periodState, from, to],
  );
  const ovulationDays = useMemo(
    () => new Set(enumerateOvulationDays(periodState, from, to)),
    [periodState, from, to],
  );

  const todayKeyStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const body = (
    <div className={`period-cycle-calendar${embedded ? " period-cycle-calendar--embedded" : ""}`}>
      {!embedded ? (
        <div className="period-cycle-calendar-header">
          <h3 className="period-cycle-calendar-title">Menstrual cycle history</h3>
          {onClose ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">
              Close
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="period-cycle-disclaimer" role="note">
        Estimates only. Not medical advice. Do not use this calendar to prevent or track pregnancy or fertility.
        Ovulation marks are rough guesses based on your average cycle length.
      </p>

      <div className="period-cycle-legend">
        <span className="period-cycle-legend-item">
          <span className="period-cycle-dot period-cycle-dot--period" aria-hidden /> Period
        </span>
        <span className="period-cycle-legend-item">
          <span className="period-cycle-dot period-cycle-dot--ovulation" aria-hidden /> Ovulation (est.)
        </span>
      </div>

      <div className="month-calendar period-cycle-month">
        <div className="month-calendar-header">
          <h4 className="month-calendar-title">{MONTH_NAMES[month]} {year}</h4>
          <div className="month-calendar-nav">
            <button
              type="button"
              className="btn-icon"
              aria-label="Previous month"
              onClick={() => {
                const d = new Date(year, month - 1, 1);
                setYear(d.getFullYear());
                setMonth(d.getMonth());
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="btn-icon"
              aria-label="Next month"
              onClick={() => {
                const d = new Date(year, month + 1, 1);
                setYear(d.getFullYear());
                setMonth(d.getMonth());
              }}
            >
              ›
            </button>
          </div>
        </div>
        <div className="month-calendar-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w} className="month-calendar-weekday">{w}</span>
          ))}
        </div>
        <div className="month-calendar-grid">
          {padding.map((_, i) => (
            <div key={`pad-${i}`} className="month-calendar-day month-calendar-day-empty" />
          ))}
          {dayKeys.map((dayKey) => {
            const isPeriod = periodDays.has(dayKey);
            const isOvulation = !isPeriod && ovulationDays.has(dayKey);
            const isToday = dayKey === todayKeyStr;
            return (
              <div
                key={dayKey}
                className={[
                  "month-calendar-day",
                  "period-cycle-day",
                  isPeriod ? "period-cycle-day--period" : "",
                  isOvulation ? "period-cycle-day--ovulation" : "",
                  isToday ? "is-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`${dayKey}${isPeriod ? ", period" : ""}${isOvulation ? ", estimated ovulation" : ""}`}
              >
                <span className="month-calendar-day-num">{new Date(`${dayKey}T12:00:00`).getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal surface-glass period-cycle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-cycle-title"
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>
  );
}

