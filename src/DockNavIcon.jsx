import React from "react";
import { dockNavAssetUrl, getDockNavAsset } from "./dockNavAssets";

/**
 * @param {{ tabId: string, active?: boolean, variant?: "default" | "center", className?: string }} props
 */
export function DockNavIcon({ tabId, active = false, variant = "default", className = "" }) {
  const asset = getDockNavAsset(tabId);
  const isCenter = variant === "center" && asset.centerImage;
  const src = dockNavAssetUrl(isCenter ? asset.centerImage : asset.image);
  const size = isCenter ? asset.centerSize || 46 : asset.iconSize || 38;

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
      aria-hidden
    >
      <img src={src} alt="" width={size} height={size} className="dock-nav-icon-img" draggable={false} />
    </span>
  );
}
