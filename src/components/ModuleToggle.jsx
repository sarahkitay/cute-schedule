import React from "react";
import { NavIcons } from "./NavIcons";

export function ModuleToggle({ module, enabled, onToggle }) {
  return (
    <div
      className={`py-module-toggle ${enabled ? "py-module-toggle--active" : ""}`}
      onClick={() => onToggle(!enabled)}
      role="switch"
      aria-checked={enabled}
      aria-label={`${module.label}: ${enabled ? "enabled" : "disabled"}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onToggle(!enabled)}
    >
      <div className="py-module-toggle__icon">
        <NavIcons name={module.icon} size={18} />
      </div>
      <div className="py-module-toggle__label">{module.label}</div>
      <div className="py-module-toggle__switch" />
    </div>
  );
}
