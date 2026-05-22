import React from "react";

export function GlassCard({ children, className = "", featured = false, compact = false, flush = false, style, onClick }) {
  const cls = [
    "py-glass-card",
    featured && "py-glass-card--featured",
    compact && "py-glass-card--compact",
    flush && "py-glass-card--flush",
    className,
  ].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  );
}
