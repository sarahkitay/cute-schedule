import React from "react";
import { PillButton } from "./PillButton";
import { NavIcons } from "./NavIcons";

export function CoachSuggestionCard({
  suggestion,
  reason,
  onApprove,
  onEdit,
  onDismiss,
  question,
}) {
  return (
    <div className="py-suggestion-card">
      <div className="py-suggestion-card__header">
        <div className="py-suggestion-card__badge">
          <NavIcons name="sparkle" size={14} />
        </div>
        <span className="py-suggestion-card__label">ProYou suggests</span>
      </div>
      <div className="py-suggestion-card__content">{suggestion}</div>
      {reason && <div className="py-suggestion-card__reason">{reason}</div>}
      {question && (
        <div className="py-suggestion-card__reason" style={{ fontStyle: "normal" }}>
          {question}
        </div>
      )}
      <div className="py-suggestion-card__actions">
        <PillButton variant="primary" size="sm" onClick={onApprove}>
          Approve
        </PillButton>
        {onEdit && (
          <PillButton variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </PillButton>
        )}
        <PillButton variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </PillButton>
      </div>
    </div>
  );
}
