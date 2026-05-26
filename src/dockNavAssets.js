import { useSimpleIcons } from "./iconStyle";

/** PNG assets for bottom dock navigation (public/). */
export const DOCK_NAV_SIZE = 44;

export const DOCK_NAV_ASSETS = {
  today: {
    label: "Home",
    image: "homeicon.png",
    simpleDarkImage: "todayicondm.png",
    iconSize: DOCK_NAV_SIZE,
  },
  plan: {
    label: "Plan",
    image: "planIcon.png",
    simpleDarkImage: "list icondm.png",
    iconSize: DOCK_NAV_SIZE,
    iconScale: 1.38,
  },
  list: {
    label: "Plan",
    image: "tasklist.png",
    simpleDarkImage: "list icondm.png",
    iconSize: DOCK_NAV_SIZE,
    iconScale: 1.18,
  },
  monthly: {
    label: "Goals",
    image: "monthly.png",
    simpleDarkImage: "goalsicondm.png",
    iconSize: DOCK_NAV_SIZE,
  },
  coach: {
    label: "Coach",
    image: "PYIcon.png",
    simpleDarkImage: "logodm.png",
    iconSize: DOCK_NAV_SIZE,
    centerImage: "PYIcon.png",
    centerSize: 76,
  },
  insights: {
    label: "Insights",
    image: "InsightsIcon.png",
    simpleDarkImage: "insightsdm.png",
    iconSize: DOCK_NAV_SIZE,
    iconScale: 1.08,
  },
  health: {
    label: "Fitness",
    image: "fitness.png",
    simpleDarkImage: "fitnessdm.png",
    iconSize: DOCK_NAV_SIZE,
  },
  finance: {
    label: "Finance",
    image: "finance.png",
    simpleDarkImage: "financedm.png",
    iconSize: DOCK_NAV_SIZE,
  },
  notes: {
    label: "Notes",
    image: "notes.png",
    iconSize: DOCK_NAV_SIZE,
    iconScale: 1.2,
  },
  medications: {
    label: "Meds",
    image: "meds.png",
    simpleDarkImage: "meds icondm.png",
    iconSize: DOCK_NAV_SIZE,
  },
  timers: {
    label: "Timers",
    image: "timer.png",
    simpleDarkImage: "timericondm.png",
    iconSize: DOCK_NAV_SIZE,
  },
  you: {
    label: "You",
    image: "YouIcon.png",
    simpleDarkImage: "navicondm.png",
    iconSize: DOCK_NAV_SIZE,
  },
};

export function dockNavAssetUrl(image) {
  const encoded = String(image || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${import.meta.env.BASE_URL}${encoded}`;
}

export function getDockNavAsset(tabId) {
  return DOCK_NAV_ASSETS[tabId] || DOCK_NAV_ASSETS.coach;
}

/**
 * @param {string} tabId
 * @param {{ iconStyle?: string, theme?: { name?: string } | null }} opts
 */
export function resolveDockNavImage(tabId, { iconStyle } = {}) {
  const asset = getDockNavAsset(tabId);
  const useSimple = useSimpleIcons(iconStyle);
  if (useSimple && asset.simpleDarkImage) {
    return asset.simpleDarkImage;
  }
  return asset.image;
}
