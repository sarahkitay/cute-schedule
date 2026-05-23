import React from "react";
import { NavIcons } from "./NavIcons";

export function FloatingNav({ items, activeTab, onTabChange, centerAction }) {
  const centerIdx = Math.floor(items.length / 2);
  const before = items.slice(0, centerIdx);
  const after = items.slice(centerIdx);

  return (
    <nav className="py-nav" aria-label="Main navigation">
      {before.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          active={activeTab === item.id}
          onClick={() => onTabChange(item.id)}
        />
      ))}
      {centerAction && (
        <button
          type="button"
          className="py-nav__center"
          onClick={() => onTabChange(centerAction.id)}
          aria-label={centerAction.label}
          aria-current={activeTab === centerAction.id ? "page" : undefined}
        >
          <NavIcons name={centerAction.icon} />
        </button>
      )}
      {after.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          active={activeTab === item.id}
          onClick={() => onTabChange(item.id)}
        />
      ))}
    </nav>
  );
}

function NavItem({ item, active, onClick }) {
  return (
    <button
      type="button"
      className={`py-nav__item ${active ? "py-nav__item--active" : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
    >
      <NavIcons name={item.icon} size={22} />
      <span>{item.shortLabel || item.label}</span>
    </button>
  );
}
