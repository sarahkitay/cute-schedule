import { coachPromptsRemaining, hasUnlimitedCoachPrompts } from "./features.js";
import { isAppTrialActive } from "./appTrial.js";
import { isTestPilotActive } from "./testPilot.js";
import { getCoachPromptsUsedToday, refreshCoachPromptUsageIfDayChanged } from "./promptUsage.js";
import { readLocalSnapshot } from "./revenueCatClient.js";

function unlimitedCoachAccess(snap) {
  return hasUnlimitedCoachPrompts({
    isPro: snap.isPro,
    appTrialActive: isAppTrialActive(),
    testPilotActive: isTestPilotActive(),
  });
}

function computePromptsRemainingToday(snap) {
  refreshCoachPromptUsageIfDayChanged();
  const used = getCoachPromptsUsedToday();
  const appTrialActive = isAppTrialActive();
  const testPilotActive = isTestPilotActive();
  if (hasUnlimitedCoachPrompts({ isPro: snap.isPro, appTrialActive, testPilotActive })) return Infinity;
  return coachPromptsRemaining(used, snap.isPro, appTrialActive, testPilotActive);
}

/** @type {{ isPro: boolean, trialActive: boolean, promptsRemainingToday: number }} */
let snapshot = {
  isPro: false,
  trialActive: false,
  promptsRemainingToday: computePromptsRemainingToday({ isPro: false, trialActive: false }),
};

const listeners = new Set();

export function getSubscriptionSnapshot() {
  return {
    ...snapshot,
    promptsRemainingToday: computePromptsRemainingToday(snapshot),
  };
}

/** @param {Partial<typeof snapshot>} next */
export function setSubscriptionSnapshot(next) {
  snapshot = { ...snapshot, ...next };
  snapshot.promptsRemainingToday = computePromptsRemainingToday(snapshot);
  listeners.forEach((fn) => {
    try {
      fn(getSubscriptionSnapshot());
    } catch {
      /* ignore */
    }
  });
}

export function initSubscriptionSnapshotFromStorage() {
  const local = readLocalSnapshot();
  setSubscriptionSnapshot({
    isPro: Boolean(local?.isPro),
    trialActive: Boolean(local?.trialActive),
  });
}

export function subscribeSubscriptionSnapshot(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @returns {boolean} whether the coach request may proceed (server enforces quota). */
export function tryBeginCoachPrompt() {
  refreshCoachPromptUsageIfDayChanged();
  return true;
}

/** Whether a successful coach response should increment local/server free-tier usage. */
export function shouldTrackCoachPromptUsage(opts = {}) {
  if (opts.adminActive) return false;
  return !unlimitedCoachAccess(getSubscriptionSnapshot());
}
