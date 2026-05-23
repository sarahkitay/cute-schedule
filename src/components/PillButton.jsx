import React from "react";

export function PillButton({
  children,
  variant = "primary",
  size = "md",
  icon = false,
  disabled = false,
  className = "",
  onClick,
  type = "button",
  ...props
}) {
  const cls = [
    "py-pill-btn",
    `py-pill-btn--${variant}`,
    size === "sm" && "py-pill-btn--sm",
    size === "lg" && "py-pill-btn--lg",
    icon && "py-pill-btn--icon",
    className,
  ].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
