import React from "react";

export function SegmentedControl({ options, value, onChange, className = "" }) {
  return (
    <div className={`py-segmented ${className}`} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`py-segmented__item ${value === opt.value ? "py-segmented__item--active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
