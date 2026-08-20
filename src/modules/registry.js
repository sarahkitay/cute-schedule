/**
 * Module registry: defines all available app modules and their metadata.
 * Navigation is configured dynamically based on enabled modules.
 */

export const MODULE_IDS = {
  TODAY: "today",
  PLAN: "plan",
  LIST: "list",
  MONTHLY: "monthly",
  COACH: "coach",
  NOTES: "notes",
  FINANCE: "finance",
  HEALTH: "health",
  MEDICATIONS: "medications",
  TIMERS: "timers",
  ALARMS: "alarms",
  PERIOD: "period",
  ROUTINES: "routines",
  CALENDAR: "calendar",
  INSIGHTS: "insights",
  PROFILE: "you",
};

export const MODULE_REGISTRY = {
  [MODULE_IDS.TODAY]: {
    id: MODULE_IDS.TODAY,
    label: "Home",
    shortLabel: "Home",
    icon: "home",
    description: "Your daily command center",
    category: "core",
    tier: "free",
    alwaysVisible: true,
    defaultNav: true,
  },
  [MODULE_IDS.PLAN]: {
    id: MODULE_IDS.PLAN,
    label: "Plan",
    shortLabel: "Plan",
    icon: "plan",
    description: "Timeline and task planning",
    category: "core",
    tier: "free",
    defaultNav: true,
  },
  [MODULE_IDS.COACH]: {
    id: MODULE_IDS.COACH,
    label: "Coach",
    shortLabel: "Coach",
    icon: "sparkle",
    description: "AI-powered personal coaching",
    category: "core",
    tier: "free",
    defaultNav: true,
    centerAction: true,
  },
  [MODULE_IDS.INSIGHTS]: {
    id: MODULE_IDS.INSIGHTS,
    label: "Insights",
    shortLabel: "Insights",
    icon: "insights",
    description: "Patterns, trends, and self-understanding",
    category: "core",
    tier: "pro",
    defaultNav: true,
  },
  [MODULE_IDS.PROFILE]: {
    id: MODULE_IDS.PROFILE,
    label: "You",
    shortLabel: "You",
    icon: "user",
    description: "Profile and settings",
    category: "core",
    defaultNav: true,
  },
  [MODULE_IDS.LIST]: {
    id: MODULE_IDS.LIST,
    label: "Task List",
    shortLabel: "List",
    icon: "list",
    description: "All tasks in a flat view",
    category: "planning",
  },
  [MODULE_IDS.MONTHLY]: {
    id: MODULE_IDS.MONTHLY,
    label: "Monthly Objectives",
    shortLabel: "Monthly",
    icon: "target",
    description: "High-level monthly goals",
    category: "planning",
  },
  [MODULE_IDS.NOTES]: {
    id: MODULE_IDS.NOTES,
    label: "Notes",
    shortLabel: "Notes",
    icon: "notes",
    description: "Thoughts, journal, ideas",
    category: "thinking",
  },
  [MODULE_IDS.ROUTINES]: {
    id: MODULE_IDS.ROUTINES,
    label: "Routines",
    shortLabel: "Routines",
    icon: "repeat",
    description: "Morning, evening, and custom routines",
    category: "habits",
  },
  [MODULE_IDS.FINANCE]: {
    id: MODULE_IDS.FINANCE,
    label: "Finance",
    shortLabel: "Finance",
    icon: "finance",
    description: "Income, spending, patterns",
    category: "tracking",
  },
  [MODULE_IDS.HEALTH]: {
    id: MODULE_IDS.HEALTH,
    label: "Health",
    shortLabel: "Health",
    icon: "health",
    description: "Workouts, macros, body",
    category: "tracking",
  },
  [MODULE_IDS.MEDICATIONS]: {
    id: MODULE_IDS.MEDICATIONS,
    label: "Medications",
    shortLabel: "Meds",
    icon: "pill",
    description: "Medication tracking and reminders",
    category: "health",
    tier: "pro",
  },
  [MODULE_IDS.TIMERS]: {
    id: MODULE_IDS.TIMERS,
    label: "Timers",
    shortLabel: "Timers",
    icon: "timer",
    description: "Focus, routine, and custom timers",
    category: "tools",
  },
  [MODULE_IDS.ALARMS]: {
    id: MODULE_IDS.ALARMS,
    label: "Alarms",
    shortLabel: "Alarms",
    icon: "alarm",
    description: "System wake-up alarms (AlarmKit on iOS)",
    category: "tools",
  },
  [MODULE_IDS.PERIOD]: {
    id: MODULE_IDS.PERIOD,
    label: "Period",
    shortLabel: "Period",
    icon: "period",
    description: "Private cycle tracker",
    category: "health",
  },
  [MODULE_IDS.CALENDAR]: {
    id: MODULE_IDS.CALENDAR,
    label: "Calendar",
    shortLabel: "Calendar",
    icon: "calendar",
    description: "Monthly calendar view",
    category: "planning",
  },
};

export const DEFAULT_NAV_ORDER = [
  MODULE_IDS.TODAY,
  MODULE_IDS.PLAN,
  MODULE_IDS.COACH,
  MODULE_IDS.PROFILE,
];

export const DEFAULT_ENABLED_MODULES = [
  MODULE_IDS.TODAY,
  MODULE_IDS.PLAN,
  MODULE_IDS.COACH,
  MODULE_IDS.PROFILE,
  MODULE_IDS.MONTHLY,
  MODULE_IDS.MEDICATIONS,
  MODULE_IDS.HEALTH,
  MODULE_IDS.FINANCE,
  MODULE_IDS.NOTES,
  MODULE_IDS.TIMERS,
  MODULE_IDS.ALARMS,
  MODULE_IDS.PERIOD,
];

export const MODULE_CATEGORIES = {
  core: "Core",
  planning: "Planning",
  thinking: "Thinking",
  habits: "Habits & Routines",
  tracking: "Tracking",
  health: "Health",
  tools: "Tools",
};

export function getModulesByCategory() {
  const grouped = {};
  for (const [id, mod] of Object.entries(MODULE_REGISTRY)) {
    const cat = mod.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(mod);
  }
  return grouped;
}

export function getNavModules(navOrder, enabledModules) {
  return navOrder
    .filter((id) => enabledModules.includes(id) || MODULE_REGISTRY[id]?.alwaysVisible)
    .map((id) => MODULE_REGISTRY[id])
    .filter(Boolean);
}
