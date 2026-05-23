import React from "react";
import { NavIcons } from "./NavIcons";

export function InsightCard({ icon, title, text, accent = false, children }) {
  return (
    <div className={`py-insight-card ${accent ? "py-glass-card--featured" : ""}`}>
      <div className="py-insight-card__icon">
        {typeof icon === "string" ? <NavIcons name={icon} size={20} /> : icon}
      </div>
      <div className="py-insight-card__body">
        {title && <h4 className="py-insight-card__title">{title}</h4>}
        {text && <p className="py-insight-card__text">{text}</p>}
        {children}
      </div>
    </div>
  );
}
