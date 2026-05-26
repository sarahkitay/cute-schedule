import {
  FREE_COACH_PROMPTS_PER_DAY,
  FREE_OPTIONAL_MODULE_LIMIT,
  FREE_ROUTINE_TEMPLATE_LIMIT,
} from "./constants.js";
import { isAppTrialGatedFeature } from "./appTrial.js";
import { MODULE_IDS } from "../modules/registry.js";

/** @typedef {'coach_prompt' | 'medications' | 'health' | 'insights' | 'cloud_sync' | 'unlimited_routines' | 'unlimited_modules' | 'advanced_alarms' | 'smart_recurring_reminders' | 'analytics' | 'advanced_customization'} FeatureId */

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

/** Pro-only modules (some unlocked during first 30-day app trial — see appTrial.js) */
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
    trialTitle: "Medications — included for now",
    trialBody:
      "Free for your first 30 days with ProYou. After that, medication tracking and reminders are part of ProYou Pro.",
    body: "Your first 30 days of meds tracking have ended. Subscribe to ProYou Pro to keep doses and reminders.",
  },
  health: {
    title: "Fitness & training is Pro",
    trialTitle: "Health & training — included for now",
    trialBody:
      "Free for your first 30 days with ProYou. After that, workouts, macros, and programs are part of ProYou Pro.",
    body: "Your first 30 days of fitness access have ended. Subscribe to ProYou Pro to keep training and macros.",
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
    title: "Alarms are Pro",
    trialTitle: "Alarms — included for now",
    trialBody:
      "Free for your first 30 days with ProYou. After that, advanced alarms and wake-up challenges are part of ProYou Pro.",
    body: "Your first 30 days of alarm access have ended. Subscribe to ProYou Pro for advanced alarms.",
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
 * @param {{ isPro?: boolean, appTrialActive?: boolean, appTrialDaysLeft?: number, promptsRemainingToday?: number, routineTemplateCount?: number, optionalModuleCount?: number }} ctx
 */
export function canUseFeature(featureId, ctx) {
  const {
    isPro,
    appTrialActive = false,
    promptsRemainingToday = 0,
    routineTemplateCount = 0,
    optionalModuleCount = 0,
  } = ctx;
  if (isPro) return true;

  if (isAppTrialGatedFeature(featureId) && appTrialActive) return true;

  switch (featureId) {
    case "coach_prompt":
      return promptsRemainingToday > 0;
    case "medications":
    case "health":
    case "advanced_alarms":
    case "insights":
    case "cloud_sync":
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

/**
 * @param {FeatureId} featureId
 * @param {{ isPro?: boolean, appTrialActive?: boolean, appTrialDaysLeft?: number }} ctx
 */
export function getFeatureGateCopy(featureId, ctx) {
  const { isPro, appTrialActive = false, appTrialDaysLeft = 0 } = ctx;
  const copy = FEATURE_COPY[featureId];
  if (!copy) {
    return {
      title: "Unlock with ProYou Pro",
      body: "This feature is included with ProYou Pro.",
      showTrialBanner: false,
    };
  }
  if (isPro) {
    return { title: copy.title, body: copy.body, showTrialBanner: false };
  }
  if (appTrialActive && isAppTrialGatedFeature(featureId)) {
    const days =
      appTrialDaysLeft === 1 ? "1 day" : `${appTrialDaysLeft} days`;
    return {
      title: copy.trialTitle || copy.title,
      body: copy.trialBody || copy.body,
      trialBanner: `${days} left free · then part of ProYou Pro`,
      showTrialBanner: true,
    };
  }
  return {
    title: copy.title,
    body: copy.body,
    showTrialBanner: false,
  };
}

export function countOptionalEnabledModules(enabledModules) {
  return (enabledModules || []).filter((id) => !FREE_MODULE_IDS.has(id)).length;
}

export function coachPromptsRemaining(usedToday, isPro) {
  if (isPro) return Infinity;
  return Math.max(0, FREE_COACH_PROMPTS_PER_DAY - usedToday);
}
