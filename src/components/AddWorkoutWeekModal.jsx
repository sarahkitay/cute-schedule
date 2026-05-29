import React, { useEffect, useState } from "react";
import { CloseIcon } from "../Icons";
import { addDaysToDayKey } from "../health/healthModel";

/**
 * @param {{
 *   open: boolean;
 *   program: { id: string; name: string } | null;
 *   weekProgramIds: string[];
 *   weekCursor?: number;
 *   startDayKey: string;
 *   onCancel: () => void;
 *   onConfirm: (payload: { mode: "order" | "pick"; dayKey?: string; hourKey: string }) => void;
 * }} props
 */
export function AddWorkoutWeekModal({
  open,
  program,
  weekProgramIds,
  weekCursor = 0,
  startDayKey,
  onCancel,
  onConfirm,
}) {
  const [mode, setMode] = useState("order");
  const [hourKey, setHourKey] = useState("18:00");
  const [dayKey, setDayKey] = useState(startDayKey);

  const inRoutine = program && weekProgramIds.includes(program.id);
  const routineIndex = inRoutine ? weekProgramIds.indexOf(program.id) : -1;

  useEffect(() => {
    if (!open) return;
    setMode(inRoutine ? "order" : "pick");
    setHourKey("18:00");
    setDayKey(startDayKey);
  }, [open, inRoutine, startDayKey]);

  if (!open || !program) return null;

  function submit() {
    if (mode === "order" && inRoutine) {
      onConfirm({
        mode: "order",
        dayKey: addDaysToDayKey(startDayKey, routineIndex),
        hourKey,
      });
      return;
    }
    onConfirm({ mode: "pick", dayKey, hourKey });
  }

  const weekDayOptions = Array.from({ length: 7 }, (_, i) => {
    const dk = addDaysToDayKey(startDayKey, i);
    const d = new Date(`${dk}T12:00:00`);
    const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    return { dayKey: dk, label };
  });

  return (
    <div
      className="modal-overlay health-workout-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-week-workout-title"
      onClick={onCancel}
    >
      <div className="modal health-workout-sheet workout-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="health-workout-sheet-head">
          <h3 id="add-week-workout-title" className="health-workout-sheet-title">
            Add to this week
          </h3>
          <button type="button" className="btn-icon" aria-label="Close" onClick={onCancel}>
            <CloseIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>
        <p className="settings-hint" style={{ marginBottom: 12 }}>
          Schedule <strong>{program.name}</strong> on your calendar with a linked workout.
        </p>
        <label className="quick-row health-field-stack">
          <span className="label">Time</span>
          <input
            type="time"
            className="input"
            value={hourKey}
            onChange={(e) => setHourKey(e.target.value)}
            aria-label="Workout time"
          />
        </label>
        {inRoutine ? (
          <div className="workout-picker-modes" style={{ marginTop: 12 }}>
            <label className="workout-picker-radio">
              <input type="radio" name="wkadd" checked={mode === "order"} onChange={() => setMode("order")} />
              <span>
                Use weekly routine order (slot {routineIndex + 1} of {weekProgramIds.length}, from today)
              </span>
            </label>
            <label className="workout-picker-radio">
              <input type="radio" name="wkadd" checked={mode === "pick"} onChange={() => setMode("pick")} />
              <span>Pick a day</span>
            </label>
          </div>
        ) : null}
        {mode === "pick" || !inRoutine ? (
          <label className="quick-row health-field-stack" style={{ marginTop: 12 }}>
            <span className="label">Day</span>
            <select className="input" value={dayKey} onChange={(e) => setDayKey(e.target.value)} aria-label="Day">
              {weekDayOptions.map((o) => (
                <option key={o.dayKey} value={o.dayKey}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="health-workout-footer" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={submit}>
            Add workout task
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
