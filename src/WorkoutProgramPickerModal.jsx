import React, { useEffect, useState } from "react";
import { CloseIcon } from "./Icons";

/**
 * @param {{ open: boolean, taskPreview: string, programs: { id: string, name: string, exercises?: string[] }[], onCancel: () => void, onConfirm: (pick: { workoutProgramMode: 'specific'|'queue'|'auto', workoutProgramId?: string }) => void }} props
 */
export function WorkoutProgramPickerModal({ open, taskPreview, programs, onCancel, onConfirm }) {
  const [mode, setMode] = useState("auto");
  const [programId, setProgramId] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("auto");
    setProgramId("");
  }, [open]);

  if (!open) return null;

  function submit() {
    if (mode === "specific") {
      if (!programId) return;
      onConfirm({ workoutProgramMode: "specific", workoutProgramId: programId });
      return;
    }
    if (mode === "queue") {
      onConfirm({ workoutProgramMode: "queue" });
      return;
    }
    onConfirm({ workoutProgramMode: "auto" });
  }

  const specificOk = mode !== "specific" || !!programId;

  return (
    <div className="modal-overlay health-workout-overlay" role="dialog" aria-modal="true" aria-labelledby="wk-pick-title" onClick={onCancel}>
      <div className="modal health-workout-sheet workout-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="health-workout-sheet-head">
          <h3 id="wk-pick-title" className="health-workout-sheet-title">
            Link this gym task to a program
          </h3>
          <button type="button" className="btn-icon" aria-label="Close" onClick={onCancel}>
            <CloseIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>
        <p className="settings-hint" style={{ marginBottom: 12 }}>
          Task: <strong>{taskPreview || "Workout"}</strong>. Pick how we should choose the exercises when you tap{" "}
          <strong>Begin workout</strong> on the schedule.
        </p>
        <div className="workout-picker-modes">
          <label className="workout-picker-radio">
            <input type="radio" name="wkpm" checked={mode === "specific"} onChange={() => setMode("specific")} />
            <span>Choose a specific program</span>
          </label>
          <label className="workout-picker-radio">
            <input type="radio" name="wkpm" checked={mode === "queue"} onChange={() => setMode("queue")} />
            <span>Next in my weekly routine (order in Health)</span>
          </label>
          <label className="workout-picker-radio">
            <input type="radio" name="wkpm" checked={mode === "auto"} onChange={() => setMode("auto")} />
            <span>Auto-pick (routine if set, otherwise your first saved program or a sample)</span>
          </label>
        </div>
        {mode === "specific" ? (
          <div className="workout-picker-program-row" role="group" aria-label="Choose program">
            <span className="workout-picker-program-label" id="wk-pick-program-label">
              Program
            </span>
            <select
              className="input workout-picker-program-select"
              aria-labelledby="wk-pick-program-label"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              <option value="">Select…</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {Array.isArray(p.exercises) ? ` (${p.exercises.length} moves)` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="health-workout-footer" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" disabled={!specificOk} onClick={submit}>
            Add task
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
