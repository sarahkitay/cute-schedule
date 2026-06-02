import { dockNavAssetUrl } from "./dockNavAssets";

export const ICON_STYLE_COLORFUL = "colorful";
export const ICON_STYLE_SIMPLE = "simple";

export const ICON_STYLE_OPTIONS = [
  {
    id: ICON_STYLE_COLORFUL,
    label: "Colorful",
    description: "Full-color 3D artwork everywhere.",
  },
  {
    id: ICON_STYLE_SIMPLE,
    label: "Simple",
    description: "Light metallic icons on theme-colored chips (dark chips in Midnight & Mocha).",
  },
];

export function normalizeIconStyle(raw) {
  return raw === ICON_STYLE_SIMPLE ? ICON_STYLE_SIMPLE : ICON_STYLE_COLORFUL;
}

export function isDarkTheme(theme) {
  const name = theme?.name || "";
  if (name === "Midnight" || name === "Mocha") return true;
  if (typeof document !== "undefined" && document.documentElement?.dataset?.theme === "dark") {
    return true;
  }
  return false;
}

/** Dark themes use simple metallic nav icons; light themes use colorful. */
export function iconStyleForTheme(theme) {
  return isDarkTheme(theme) ? ICON_STYLE_SIMPLE : ICON_STYLE_COLORFUL;
}

/** User chose simple (light metallic) dock icons; shown on dark icon chips in any theme. */
export function useSimpleIcons(iconStyle) {
  return normalizeIconStyle(iconStyle) === ICON_STYLE_SIMPLE;
}

/** @deprecated Use useSimpleIcons */
export function useSimpleDarkIcons(iconStyle, _theme) {
  return useSimpleIcons(iconStyle);
}

/**
 * @param {{ colorfulImage: string, simpleDarkImage?: string | null, iconStyle: string, theme: { name?: string } | null }} opts
 */
export function resolveAppIconUrl({ colorfulImage, simpleDarkImage, iconStyle }) {
  if (useSimpleIcons(iconStyle) && simpleDarkImage) {
    return dockNavAssetUrl(simpleDarkImage);
  }
  return dockNavAssetUrl(colorfulImage);
}

export const APP_ICON_ASSETS = {
  streakFlame: { colorful: "fireicon.png", simpleDark: "fireicondm.png" },
  brandLogo: { colorful: "pyiconnobubble.png", simpleDark: "logodm.png" },
  settings: { colorful: "settings.png", simpleDark: "settingsdm.png" },
  coachLogo: { colorful: "PYIcon.png", simpleDark: "logodm.png" },
  youHabits: { colorful: "habit.png", simpleDark: "habiticondm.png" },
  youNavigation: { colorful: "nav.png", simpleDark: "navicondm.png" },
  youRoutines: { colorful: "suniconnobubble.png", simpleDark: "todayicondm.png" },
  youProfile: { colorful: "YouIcon.png", simpleDark: "youdm.png" },
  accountability: { colorful: "accountability.png", simpleDark: "accountabilitydm.png" },
  meds: { colorful: "meds.png", simpleDark: "meds icondm.png" },
};

export function appIconUrl(assetKey, iconStyle) {
  const asset = APP_ICON_ASSETS[assetKey];
  if (!asset) return "";
  return resolveAppIconUrl({
    colorfulImage: asset.colorful,
    simpleDarkImage: asset.simpleDark,
    iconStyle,
  });
}

export function streakFlameIconUrl(iconStyle) {
  const a = APP_ICON_ASSETS.streakFlame;
  return resolveAppIconUrl({
    colorfulImage: a.colorful,
    simpleDarkImage: a.simpleDark,
    iconStyle,
  });
}
