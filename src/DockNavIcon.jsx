import React from "react";
import { NavIcons } from "./components/NavIcons";
import {
  CalendarIcon,
  CoachIcon,
  FinanceIcon,
  HealthIcon,
  ListIcon,
  MonthlyIcon,
  NotesIcon,
  TodayIcon,
} from "./Icons";
import { dockNavAssetUrl, getDockNavAsset, DOCK_NAV_SIZE } from "./dockNavAssets";

function DockNavSvg({ tabId, isCenter }) {
  if (isCenter && tabId === "coach") return <CoachIcon />;

  switch (tabId) {
    case "today":
      return <TodayIcon />;
    case "plan":
      return <CalendarIcon className="dock-tab-icon" />;
    case "list":
      return <ListIcon />;
    case "monthly":
      return <MonthlyIcon />;
    case "coach":
      return <CoachIcon />;
    case "insights":
      return <NavIcons name="insights" size={28} className="dock-tab-icon" />;
    case "health":
      return <HealthIcon />;
    case "finance":
      return <FinanceIcon />;
    case "notes":
      return <NotesIcon />;
    case "medications":
      return <NavIcons name="pill" size={28} className="dock-tab-icon" />;
    case "timers":
      return <NavIcons name="timer" size={28} className="dock-tab-icon" />;
    case "you":
      return <NavIcons name="user" size={28} className="dock-tab-icon" />;
    default:
      return <NavIcons name="home" size={28} className="dock-tab-icon" />;
  }
}

/**
 * Light mode: PNG artwork. Dark mode (Midnight/Mocha): theme-colored SVGs.
 * @param {{ tabId: string, active?: boolean, variant?: "default" | "center", className?: string }} props
 */
export function DockNavIcon({ tabId, active = false, variant = "default", className = "" }) {
  const asset = getDockNavAsset(tabId);
  const isCenter = variant === "center" && asset.centerImage;
  const src = dockNavAssetUrl(isCenter ? asset.centerImage : asset.image);
  const size = isCenter ? asset.centerSize || 64 : asset.iconSize || DOCK_NAV_SIZE;
  const scale = isCenter ? 1 : asset.iconScale || 1;

  return (
    <span
      className={[
        "dock-nav-icon-wrap",
        active ? "is-active" : "",
        isCenter ? "dock-nav-icon-wrap--center" : "",
        tabId === "coach" || tabId === "insights" ? "dock-nav-icon-wrap--insights" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--dock-icon-size": `${size}px`,
        "--dock-icon-scale": String(scale),
      }}
      aria-hidden
    >
      <img src={src} alt="" className="dock-nav-icon-img dock-nav-icon-img--png" draggable={false} />
      <span className="dock-nav-icon-svg" aria-hidden>
        <DockNavSvg tabId={tabId} isCenter={isCenter} />
      </span>
    </span>
  );
}
