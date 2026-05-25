import { coachPromptsRemaining } from "./features.js";
import { getCoachPromptsUsedToday } from "./promptUsage.js";
import { readLocalSnapshot } from "./revenueCatClient.js";

/** @type {{ isPro: boolean, trialActive: boolean, promptsRemainingToday: number }} */
let snapshot = {
  isPro: false,
  trialActive: false,
  promptsRemainingToday: coachPromptsRemaining(getCoachPromptsUsedToday(), false),
};

const listeners = new Set();

export function getSubscriptionSnapshot() {
  const used = getCoachPromptsUsedToday();
  return {
    ...snapshot,
    promptsRemainingToday: snapshot.isPro ? Infinity : coachPromptsRemaining(used, false),
  };
}

/** @param {Partial<typeof snapshot>} next */
export function setSubscriptionSnapshot(next) {
  snapshot = { ...snapshot, ...next };
  const used = getCoachPromptsUsedToday();
  snapshot.promptsRemainingToday = snapshot.isPro ? Infinity : coachPromptsRemaining(used, false);
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
  if (snap.isPro) return true;
  if (snap.promptsRemainingToday <= 0) {
    onLimit?.();
    return false;
  }
  return true;
}
