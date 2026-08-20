import React from "react";

/**
 * Compact “Ask Coach” entry point for any page or section.
 */
export function AskCoachBar({
  sectionLabel = "this section",
  hint,
  placeholderQuestion,
  disabled = false,
  onAskCoach,
}) {
  const defaultHint = `Questions about ${sectionLabel}? Coach can help.`;
  const question =
    placeholderQuestion ||
    `Help me with ${String(sectionLabel || "this").toLowerCase()}. What should I focus on?`;

  return (
    <div className="ask-coach-bar" role="region" aria-label={`Ask Coach about ${sectionLabel}`}>
      <p className="ask-coach-bar__hint">{hint || defaultHint}</p>
      <button
        type="button"
        className="btn btn-sm ask-coach-bar__btn"
        disabled={disabled}
        onClick={() => onAskCoach?.(question, sectionLabel)}
      >
        Ask Coach
      </button>
    </div>
  );
}
