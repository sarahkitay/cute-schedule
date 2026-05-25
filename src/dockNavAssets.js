/** PNG assets for bottom dock navigation (public/). */
export const DOCK_NAV_SIZE = 44;

export const DOCK_NAV_ASSETS = {
  today: { label: "Home", image: "homeicon.png", iconSize: DOCK_NAV_SIZE },
  plan: { label: "Plan", image: "planIcon.png", iconSize: DOCK_NAV_SIZE, iconScale: 1.38 },
  list: { label: "Plan", image: "tasklist.png", iconSize: DOCK_NAV_SIZE, iconScale: 1.18 },
  monthly: { label: "Goals", image: "monthly.png", iconSize: DOCK_NAV_SIZE },
  coach: { label: "Coach", image: "PYIcon.png", iconSize: DOCK_NAV_SIZE, centerImage: "PYIcon.png", centerSize: 76 },
  insights: { label: "Insights", image: "InsightsIcon.png", iconSize: DOCK_NAV_SIZE, iconScale: 1.08 },
  health: { label: "Fitness", image: "fitness.png", iconSize: DOCK_NAV_SIZE },
  finance: { label: "Finance", image: "finance.png", iconSize: DOCK_NAV_SIZE },
  notes: { label: "Notes", image: "notes.png", iconSize: DOCK_NAV_SIZE, iconScale: 1.2 },
  medications: { label: "Meds", image: "meds.png", iconSize: DOCK_NAV_SIZE },
  timers: { label: "Timers", image: "timer.png", iconSize: DOCK_NAV_SIZE },
  you: { label: "You", image: "YouIcon.png", iconSize: DOCK_NAV_SIZE },
};

export function dockNavAssetUrl(image) {
  return `${import.meta.env.BASE_URL}${image}`;
}

export function getDockNavAsset(tabId) {
  return DOCK_NAV_ASSETS[tabId] || DOCK_NAV_ASSETS.coach;
}
