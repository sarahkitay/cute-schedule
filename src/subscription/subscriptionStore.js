import { coachPromptsRemaining, hasUnlimitedCoachPrompts } from "./features.js";
import { isAppTrialActive } from "./appTrial.js";
import { getCoachPromptsUsedToday } from "./promptUsage.js";
import { readLocalSnapshot } from "./revenueCatClient.js";

function unlimitedCoachAccess(snap) {
  return hasUnlimitedCoachPrompts({ isPro: snap.isPro, appTrialActive: isAppTrialActive() });
}

/** @type {{ isPro: boolean, trialActive: boolean, promptsRemainingToday: number }} */
let snapshot = {
  isPro: false,
  trialActive: false,
  promptsRemainingToday: coachPromptsRemaining(getCoachPromptsUsedToday(), false),
};

const listeners = new Set();

export function getSubscriptionSnapshot() {
  const used = getCoachPromptsUsedToday();
  const unlimited = unlimitedCoachAccess(snapshot);
  return {
    ...snapshot,
    promptsRemainingToday: unlimited
      ? Infinity
      : coachPromptsRemaining(used, false, false),
  };
}

/** @param {Partial<typeof snapshot>} next */
export function setSubscriptionSnapshot(next) {
  snapshot = { ...snapshot, ...next };
  const used = getCoachPromptsUsedToday();
  snapshot.promptsRemainingToday = unlimitedCoachAccess(snapshot)
    ? Infinity
    : coachPromptsRemaining(used, false, false);
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

/** @returns {boolean} whether prompt may proceed */
export function tryBeginCoachPrompt(onLimit) {
  const snap = getSubscriptionSnapshot();
  if (unlimitedCoachAccess(snapshot)) return true;
  if (snap.promptsRemainingToday <= 0) {
    onLimit?.();
    return false;
  }
  return true;
}

/** Whether a successful coach response should increment local/server free-tier usage. */
export function shouldTrackCoachPromptUsage() {
  return !unlimitedCoachAccess(snapshot);
}
