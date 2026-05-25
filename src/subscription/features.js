import {
  FREE_COACH_PROMPTS_PER_DAY,
  FREE_OPTIONAL_MODULE_LIMIT,
  FREE_ROUTINE_TEMPLATE_LIMIT,
} from "./constants.js";
import { MODULE_IDS } from "../modules/registry.js";

/** @typedef {'coach_prompt' | 'medications' | 'insights' | 'cloud_sync' | 'unlimited_routines' | 'unlimited_modules' | 'advanced_alarms' | 'smart_recurring_reminders' | 'analytics' | 'advanced_customization'} FeatureId */

/** Core free modules per product spec */
export const FREE_MODULE_IDS = new Set([
  MODULE_IDS.TODAY,
  MODULE_IDS.PLAN,
  MODULE_IDS.LIST,
  MODULE_IDS.MONTHLY,
  MODULE_IDS.COACH,
  MODULE_IDS.NOTES,
  MODULE_IDS.TIMERS,
  MODULE_IDS.PROFILE,
]);

/** Pro-only modules */
export const PRO_MODULE_IDS = new Set([
  MODULE_IDS.MEDICATIONS,
  MODULE_IDS.INSIGHTS,
  MODULE_IDS.ALARMS,
  MODULE_IDS.HEALTH,
  MODULE_IDS.FINANCE,
  MODULE_IDS.ROUTINES,
  MODULE_IDS.CALENDAR,
]);

export const FEATURE_COPY = {
  coach_prompt: {
    title: "Daily coach limit reached",
    body: "Free includes 2 AI coach prompts per day. Pro unlocks unlimited coaching.",
  },
  medications: {
    title: "Medication tracking is Pro",
    body: "Track doses, reminders, and adherence with ProYou Pro.",
  },
  insights: {
    title: "Insights are Pro",
    body: "See patterns, trends, and analytics with ProYou Pro.",
  },
  cloud_sync: {
    title: "Cloud backup is Pro",
    body: "Sync and back up across devices with ProYou Pro.",
  },
  unlimited_routines: {
    title: "More routines with Pro",
    body: `Free includes up to ${FREE_ROUTINE_TEMPLATE_LIMIT} routine templates. Pro is unlimited.`,
  },
  unlimited_modules: {
    title: "More modules with Pro",
    body: "Unlock medications, insights, advanced alarms, and more with Pro.",
  },
  advanced_alarms: {
    title: "Advanced alarms are Pro",
    body: "Wake challenges, smart conditions, and richer alarm flows with Pro.",
  },
  smart_recurring_reminders: {
    title: "Smart reminders are Pro",
    body: "Intelligent recurring reminders are included with Pro.",
  },
  analytics: {
    title: "Analytics are Pro",
    body: "Trend insights and deeper analytics come with Pro.",
  },
  advanced_customization: {
    title: "Advanced customization is Pro",
    body: "Themes, dock editing, and premium customization are Pro features.",
  },
};

/**
 * @param {FeatureId} featureId
 * @param {{ isPro: boolean, promptsRemainingToday: number, routineTemplateCount?: number, optionalModuleCount?: number }} ctx
 */
export function canUseFeature(featureId, ctx) {
  const { isPro, promptsRemainingToday = 0, routineTemplateCount = 0, optionalModuleCount = 0 } = ctx;
  if (isPro) return true;

  switch (featureId) {
    case "coach_prompt":
      return promptsRemainingToday > 0;
    case "medications":
    case "insights":
    case "cloud_sync":
    case "advanced_alarms":
    case "smart_recurring_reminders":
    case "analytics":
    case "advanced_customization":
      return false;
    case "unlimited_routines":
      return routineTemplateCount <= FREE_ROUTINE_TEMPLATE_LIMIT;
    case "unlimited_modules":
      return optionalModuleCount <= FREE_OPTIONAL_MODULE_LIMIT;
    default:
      return true;
  }
}

export function countOptionalEnabledModules(enabledModules) {
  return (enabledModules || []).filter((id) => !FREE_MODULE_IDS.has(id)).length;
}

export function coachPromptsRemaining(usedToday, isPro) {
  if (isPro) return Infinity;
  return Math.max(0, FREE_COACH_PROMPTS_PER_DAY - usedToday);
}
