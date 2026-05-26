import React from "react";
import { HABIT_ICONS, normalizeHabitIcon } from "./habitIcons";

/**
 * @param {{ value: string, onChange: (id: string) => void, compact?: boolean, ariaLabel?: string }} props
 */
export function HabitIconPicker({ value, onChange, compact = false, ariaLabel = "Choose habit icon" }) {
  const selected = normalizeHabitIcon(value);
  return (
    <div
      className={`habit-icon-picker${compact ? " habit-icon-picker--compact" : ""}`}
      role="listbox"
      aria-label={ariaLabel}
    >
      {HABIT_ICONS.map((ic) => (
        <button
          key={ic.id}
          type="button"
          role="option"
          aria-selected={selected === ic.id}
          aria-label={ic.label}
          title={ic.label}
          className={`habit-icon-option${selected === ic.id ? " is-selected" : ""}`}
          onClick={() => onChange(ic.id)}
        >
          <span className="habit-icon-option-emoji" aria-hidden>
            {ic.emoji}
          </span>
        </button>
      ))}
    </div>
  );
}

/** @param {{ iconId: string, className?: string }} props */
export function HabitIconBadge({ iconId, className = "" }) {
  const ic = HABIT_ICONS.find((i) => i.id === normalizeHabitIcon(iconId));
  return (
    <span className={`habit-icon-badge${className ? ` ${className}` : ""}`} title={ic?.label} aria-hidden>
      {ic?.emoji || "⭐"}
    </span>
  );
}

/** Build = green dot; break = muted rose dot (no text label). */
export function HabitDirectionDot({ direction, className = "" }) {
  const isBreak = direction === "break";
  return (
    <span
      className={[
        "habit-direction-dot",
        isBreak ? "habit-direction-dot--break" : "habit-direction-dot--build",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    />
  );
}
