import React from "react";
import { formatObjectiveMonthLabel } from "../monthlyObjectivesModel";

/**
 * After auto-carry into the new month: notice that the prior month ended,
 * with Keep (stay on objectives) or Let go (remove from this month).
 */
export function MonthlyCarryOverSection({
  reviewItems,
  priorMonthKey,
  currentMonthKey,
  onKeep,
  onLetGo,
}) {
  if (!reviewItems?.length) return null;

  const priorLabel = formatObjectiveMonthLabel(priorMonthKey);
  const currentLabel = formatObjectiveMonthLabel(currentMonthKey);

  return (
    <section className="monthly-carry-over" aria-labelledby="monthly-carry-over-title">
      <h3 id="monthly-carry-over-title" className="monthly-carry-over-title">
        {priorLabel} is over
      </h3>
      <p className="monthly-carry-over-hint">
        These carried into {currentLabel}. Keep them on your monthly objectives, or let them go?
      </p>
      <ul className="monthly-carry-over-list">
        {reviewItems.map((m) => (
          <li key={m.id} className="monthly-carry-over-row">
            <span className="monthly-carry-over-row-text">{m.text}</span>
            <div className="monthly-carry-over-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary monthly-carry-btn monthly-carry-btn--yes"
                onClick={() => onKeep(m.id)}
              >
                Keep
              </button>
              <button
                type="button"
                className="btn btn-sm monthly-carry-btn monthly-carry-btn--no"
                onClick={() => onLetGo(m.id)}
              >
                Let go
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
