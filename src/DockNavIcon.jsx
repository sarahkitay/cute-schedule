import React from "react";
import { dockNavAssetUrl, getDockNavAsset, DOCK_NAV_SIZE } from "./dockNavAssets";

/**
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
      <img src={src} alt="" className="dock-nav-icon-img" draggable={false} />
    </span>
  );
}
