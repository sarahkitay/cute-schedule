import React, { useState } from "react";
import { normalizeTimeKey } from "../coach/taskInsertion.ts";
import { normalizeHabitRow } from "../habitModel.js";

function to12Hour(time24) {
  const [h, m] = time24.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Per-habit hourly / clock reminders when notifications cadence is Custom.
 * @param {{ row: ReturnType<typeof normalizeHabitRow>, setHabitTracker: Function }} props
 */
export function HabitCustomReminderFields({ row, setHabitTracker }) {
  const [draftTime, setDraftTime] = useState("09:00");
  if (!row) return null;

  const sch = row.reminderSchedule || "none";
  const hours = row.reminderHours || [];

  return (
    <div className="habit-you-reminder-fields" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <label className="habit-settings-remind-label" htmlFor={`habit-remind-${row.id}`} style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
        Reminders (custom)
      </label>
      <select
        id={`habit-remind-${row.id}`}
        className="input habit-settings-remind-select"
        style={{ width: "100%", marginBottom: sch === "hours" ? 8 : 0 }}
        value={sch}
        onChange={(e) => {
          const v = e.target.value;
          setHabitTracker((prev) => ({
            ...prev,
            habits: (prev.habits || []).map((x) =>
              x.id === row.id
                ? normalizeHabitRow({
                    ...x,
                    reminderSchedule: v === "hourly" || v === "hours" ? v : "none",
                    reminderHours: v === "hours" ? (Array.isArray(x.reminderHours) ? x.reminderHours : []) : [],
                  })
                : x
            ),
          }));
        }}
      >
        <option value="none">None</option>
        <option value="hourly">Hourly (uses quiet hours from notifications)</option>
        <option value="hours">Choose times</option>
      </select>
      {sch === "hours" ? (
        <div className="habit-reminder-hours">
          <div className="habit-reminder-hour-chips">
            {hours.map((hm) => (
              <span key={hm} className="habit-reminder-chip">
                {to12Hour(hm)}
                <button
                  type="button"
                  aria-label={`Remove ${hm}`}
                  onClick={() =>
                    setHabitTracker((prev) => ({
                      ...prev,
                      habits: (prev.habits || []).map((x) =>
                        x.id === row.id
                          ? normalizeHabitRow({
                              ...x,
                              reminderHours: hours.filter((t) => t !== hm),
                            })
                          : x
                      ),
                    }))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="habit-reminder-add-row" style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              type="time"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
              aria-label={`Add reminder time for ${row.label}`}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                const slot = normalizeTimeKey(draftTime);
                setHabitTracker((prev) => ({
                  ...prev,
                  habits: (prev.habits || []).map((x) => {
                    if (x.id !== row.id) return x;
                    const cur = normalizeHabitRow(x)?.reminderHours || [];
                    if (cur.includes(slot)) return x;
                    return normalizeHabitRow({ ...x, reminderHours: [...cur, slot].sort() });
                  }),
                }));
              }}
            >
              Add time
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
