import React, { useMemo, useState } from "react";
import { formatHistoryDayKey, searchTaskHistory } from "../taskHistorySearch.js";

/**
 * @param {{ appState: object, onSelectDay?: (dayKey: string) => void }} props
 */
export function PlanTaskHistorySearch({ appState, onSelectDay }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => searchTaskHistory(appState, query), [appState, query]);

  return (
    <section className="plan-task-history surface-glass scroll-reveal" aria-label="Task history search">
      <button
        type="button"
        className="plan-task-history-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="plan-task-history-toggle-title">Search past tasks</span>
        <span className="plan-task-history-toggle-hint">See how often you&apos;ve done something</span>
        <span className="plan-task-history-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="plan-task-history-body">
          <label className="label" htmlFor="plan-task-history-query">
            Task name or keyword
          </label>
          <input
            id="plan-task-history-query"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. laundry, gym, groceries…"
            autoComplete="off"
          />
          {query.trim().length >= 2 && results.length === 0 ? (
            <p className="settings-hint plan-task-history-empty">No matching tasks in your schedule history yet.</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="plan-task-history-list">
              {results.map((row) => (
                <li key={row.text.toLowerCase()} className="plan-task-history-item">
                  <div className="plan-task-history-item-head">
                    <strong className="plan-task-history-item-title">{row.text}</strong>
                    <span className="plan-task-history-badge">
                      {row.occurrences}× scheduled
                    </span>
                  </div>
                  <div className="plan-task-history-stats">
                    <span>
                      Done <strong>{row.completed}</strong> time{row.completed === 1 ? "" : "s"}
                    </span>
                    {row.lastCompleted ? (
                      <span>
                        Last done <strong>{formatHistoryDayKey(row.lastCompleted)}</strong>
                      </span>
                    ) : (
                      <span className="plan-task-history-muted">Not marked done yet</span>
                    )}
                    {row.lastScheduled ? (
                      <span>
                        Last on schedule <strong>{formatHistoryDayKey(row.lastScheduled)}</strong>
                      </span>
                    ) : null}
                  </div>
                  {row.recentDates.length > 0 ? (
                    <div className="plan-task-history-dates">
                      {row.recentDates.map((d, i) => (
                        <button
                          key={`${d.dayKey}-${d.hourKey}-${i}`}
                          type="button"
                          className={`plan-task-history-date-chip${d.done ? " is-done" : ""}`}
                          onClick={() => onSelectDay?.(d.dayKey)}
                          title={`${d.dayKey} ${d.hourKey}`}
                        >
                          {formatHistoryDayKey(d.dayKey).replace(/, \d{4}$/, "")}
                          {d.done ? " ✓" : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : query.trim().length < 2 ? (
            <p className="settings-hint">Type at least 2 characters to search your full schedule history.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
