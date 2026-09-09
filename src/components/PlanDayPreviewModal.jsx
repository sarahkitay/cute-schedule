import React, { useEffect, useMemo, useRef, useState } from "react";

function formatDayHeading(dayKey, realTodayKey) {
  if (dayKey === realTodayKey) return "Today";
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function toShortTime(hourKey) {
  const [h, m] = String(hourKey || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hourKey || "";
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${hour12} ${period}`;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatPreviewTime(task) {
  const start = toShortTime(task.hour);
  const end = task.endHour ? toShortTime(task.endHour) : "";
  if (!end || end === start) return start;
  return `${start}–${end}`;
}

/**
 * Plan calendar day preview: planned tasks, quick add, open that day on Home.
 */
export function PlanDayPreviewModal({
  dayKey,
  realTodayKey,
  tasks = [],
  categories = [],
  defaultHour = "09:00",
  defaultCategory = "",
  onClose,
  onOpenDay,
  onQuickAdd,
}) {
  const [text, setText] = useState("");
  const [hour, setHour] = useState(defaultHour);
  const [category, setCategory] = useState(defaultCategory || categories[0] || "Work");
  const [justAdded, setJustAdded] = useState(false);
  const addedTimerRef = useRef(null);
  const seededDayRef = useRef(null);

  useEffect(() => {
    if (seededDayRef.current === dayKey) return;
    seededDayRef.current = dayKey;
    setText("");
    setHour(defaultHour || "09:00");
    setCategory(defaultCategory || categories[0] || "Work");
    setJustAdded(false);
  }, [dayKey, defaultHour, defaultCategory, categories]);

  useEffect(
    () => () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    },
    []
  );

  const sortedTasks = useMemo(
    () =>
      [...(tasks || [])].sort((a, b) => {
        const ah = String(a.hour || "");
        const bh = String(b.hour || "");
        if (ah !== bh) return ah.localeCompare(bh);
        return String(a.text || "").localeCompare(String(b.text || ""));
      }),
    [tasks]
  );

  const incomplete = sortedTasks.filter((t) => !t.done);
  const complete = sortedTasks.filter((t) => t.done);
  const heading = formatDayHeading(dayKey, realTodayKey);

  function submitQuickAdd(e) {
    e.preventDefault();
    const clean = String(text || "").trim();
    if (!clean || typeof onQuickAdd !== "function") return;
    onQuickAdd({ text: clean, hourKey: hour, category });
    setText("");
    setJustAdded(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => {
      addedTimerRef.current = null;
      setJustAdded(false);
    }, 1400);
  }

  return (
    <div
      className="modal-overlay plan-day-preview-overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={`Plan for ${heading}`}
    >
      <div className="modal plan-day-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plan-day-preview-header">
          <div>
            <h2 className="plan-day-preview-title">{heading}</h2>
            {dayKey !== realTodayKey ? (
              <p className="plan-day-preview-sub">{dayKey}</p>
            ) : null}
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="plan-day-preview-body">
          {sortedTasks.length === 0 ? (
            <p className="plan-day-preview-empty">Nothing planned yet.</p>
          ) : (
            <>
              {incomplete.length > 0 ? (
                <ul className="plan-day-preview-list" aria-label="Planned tasks">
                  {incomplete.map((t) => (
                    <li key={`${t.hour}-${t.category}-${t.id}`} className="plan-day-preview-row">
                      <span className="plan-day-preview-time">{formatPreviewTime(t)}</span>
                      <span className="plan-day-preview-task">{t.text}</span>
                      {t.category ? <span className="plan-day-preview-cat">{t.category}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="plan-day-preview-empty">All tasks complete for this day.</p>
              )}
              {complete.length > 0 ? (
                <p className="plan-day-preview-done-count">
                  {complete.length} complete
                </p>
              ) : null}
            </>
          )}
        </div>

        <form className="plan-day-preview-add" onSubmit={submitQuickAdd} autoComplete="off">
          <label className="plan-day-preview-add-label" htmlFor="plan-day-quick-task">
            Quick add to this day
          </label>
          <input
            id="plan-day-quick-task"
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. dinner 5-7pm"
            aria-label="New task for this day"
          />
          <div className="plan-day-preview-add-row">
            <input
              type="time"
              className="input"
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              aria-label="Time"
            />
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Category"
            >
              {(categories.length ? categories : ["Work"]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className={`btn btn-primary btn-sm${justAdded ? " plan-day-preview-added" : ""}`}
              disabled={!text.trim() || justAdded}
            >
              {justAdded ? "Added" : "Add"}
            </button>
          </div>
        </form>

        <div className="plan-day-preview-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenDay?.(dayKey)}
          >
            Go to this day
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
