import React, { useState } from "react";
import { formatObjectiveMonthLabel } from "../monthlyObjectivesModel";

/**
 * Prompt for unfinished objectives from the prior month (shown from the 1st onward).
 * Yes = carry to this month; No expands to leave in prior month or mark done unmarked.
 */
export function MonthlyCarryOverSection({
  pending,
  priorMonthKey,
  currentMonthKey,
  onCarry,
  onLeave,
  onCompleteUnmarked,
}) {
  const [expandedNoId, setExpandedNoId] = useState(null);

  if (!pending?.length) return null;

  const priorLabel = formatObjectiveMonthLabel(priorMonthKey);
  const currentLabel = formatObjectiveMonthLabel(currentMonthKey);

  return (
    <section className="monthly-carry-over" aria-labelledby="monthly-carry-over-title">
      <h3 id="monthly-carry-over-title" className="monthly-carry-over-title">
        From {priorLabel}
      </h3>
      <p className="monthly-carry-over-hint">
        These were not finished last month. Carry each into {currentLabel}?
      </p>
      <ul className="monthly-carry-over-list">
        {pending.map((m) => {
          const noOpen = expandedNoId === m.id;
          return (
            <li key={m.id} className="monthly-carry-over-row">
              <span className="monthly-carry-over-row-text">{m.text}</span>
              <div className="monthly-carry-over-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary monthly-carry-btn monthly-carry-btn--yes"
                  onClick={() => {
                    setExpandedNoId(null);
                    onCarry(m.id);
                  }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`btn btn-sm monthly-carry-btn monthly-carry-btn--no${noOpen ? " monthly-carry-btn--active" : ""}`}
                  aria-expanded={noOpen}
                  onClick={() => setExpandedNoId((prev) => (prev === m.id ? null : m.id))}
                >
                  No
                </button>
              </div>
              {noOpen ? (
                <div className="monthly-carry-over-no-panel">
                  <button
                    type="button"
                    className="btn btn-sm monthly-carry-sub-btn"
                    onClick={() => {
                      setExpandedNoId(null);
                      onLeave(m.id);
                    }}
                  >
                    Leave in {priorLabel}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm monthly-carry-sub-btn"
                    onClick={() => {
                      setExpandedNoId(null);
                      onCompleteUnmarked(m.id);
                    }}
                  >
                    Done, didn&apos;t mark
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
