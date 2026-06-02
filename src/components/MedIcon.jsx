import React from "react";
import { dockNavAssetUrl } from "../dockNavAssets";
import { appIconUrl } from "../iconStyle";
import { useIconStyle } from "../IconStyleContext";

/**
 * Medication row / section icon: colorful meds.png in light mode, meds icondm.png in dark.
 */
export function MedIcon({ size = 36, className = "" }) {
  const { iconStyle, isDark } = useIconStyle();
  const src = isDark ? dockNavAssetUrl("meds icondm.png") : appIconUrl("meds", iconStyle);

  return (
    <img
      src={src}
      alt=""
      className={["py-med-item__icon-img", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        objectFit: "contain",
        flexShrink: 0,
        display: "block",
      }}
      decoding="async"
    />
  );
}
