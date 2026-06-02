import { APP_TRIAL_DAYS, APP_TRIAL_START_KEY } from "./constants.js";

/** Features free for the first 30 days after first app open, then Pro. */
export const APP_TRIAL_FEATURE_IDS = new Set([
  "coach_prompt",
  "medications",
  "health",
  "insights",
  "advanced_alarms",
  "finance",
]);

/** @returns {boolean} */
export function isAppTrialGatedFeature(featureId) {
  return APP_TRIAL_FEATURE_IDS.has(featureId);
}

/** Record first open time (never moves). */
export function initAppTrialStart() {
  try {
    if (!localStorage.getItem(APP_TRIAL_START_KEY)) {
      localStorage.setItem(APP_TRIAL_START_KEY, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

/** @returns {number | null} */
export function getAppTrialStartMs() {
  try {
    const raw = localStorage.getItem(APP_TRIAL_START_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * @returns {{ active: boolean, ended: boolean, daysLeft: number, daysTotal: number, startMs: number | null }}
 */
export function getAppTrialStatus() {
  initAppTrialStart();
  const startMs = getAppTrialStartMs();
  const daysTotal = APP_TRIAL_DAYS;
  if (startMs == null) {
    return { active: true, ended: false, daysLeft: daysTotal, daysTotal, startMs: null };
  }
  const elapsed = Date.now() - startMs;
  const msTotal = daysTotal * 86400000;
  const active = elapsed < msTotal;
  const daysLeft = active ? Math.max(1, Math.ceil((msTotal - elapsed) / 86400000)) : 0;
  return {
    active,
    ended: !active,
    daysLeft,
    daysTotal,
    startMs,
  };
}

export function isAppTrialActive() {
  return getAppTrialStatus().active;
}
