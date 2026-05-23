/** PNG assets for bottom dock navigation (public/). */
export const DOCK_NAV_ASSETS = {
  today: { label: "Home", image: "homeicon.png", iconSize: 38 },
  plan: { label: "Plan", image: "planIcon.png", iconSize: 38 },
  list: { label: "Plan", image: "tasklist.png", iconSize: 38 },
  monthly: { label: "Goals", image: "monthly.png", iconSize: 38 },
  coach: { label: "Coach", image: "PYIcon.png", iconSize: 42, centerImage: "PYIcon.png", centerSize: 64 },
  insights: { label: "Insights", image: "InsightsIcon.png", iconSize: 40 },
  health: { label: "Fitness", image: "fitness.png", iconSize: 38 },
  finance: { label: "Finance", image: "finance.png", iconSize: 38 },
  notes: { label: "Notes", image: "notes.png", iconSize: 38 },
  medications: { label: "Meds", image: "meds.png", iconSize: 38 },
  timers: { label: "Timers", image: "timer.png", iconSize: 38 },
  you: { label: "You", image: "YouIcon.png", iconSize: 38 },
};

export function dockNavAssetUrl(image) {
  return `${import.meta.env.BASE_URL}${image}`;
}

export function getDockNavAsset(tabId) {
  return DOCK_NAV_ASSETS[tabId] || DOCK_NAV_ASSETS.coach;
}
