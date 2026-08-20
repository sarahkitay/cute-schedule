import {
  consumeCoachPromptLocal,
  syncCoachPromptUsageFromServer,
} from "./promptUsage.js";
import { setSubscriptionSnapshot } from "./subscriptionStore.js";

/** Apply server coach quota to local storage and refresh subscription snapshot listeners. */
export function applyCoachQuotaFromResponse(data) {
  if (!data || typeof data !== "object") return false;
  const quota = data.coachQuota || null;
  if (quota) {
    syncCoachPromptUsageFromServer(quota);
    setSubscriptionSnapshot({});
    return true;
  }
  if (data.used != null || data.limit != null) {
    syncCoachPromptUsageFromServer({
      used: data.used,
      limit: data.limit,
      dayKey: data.dayKey,
    });
    setSubscriptionSnapshot({});
    return true;
  }
  return false;
}

/** Sync quota from API when present; otherwise increment local-only counter (offline / no Redis). */
export function finalizeCoachPromptUsage(data, trackedLocally) {
  if (applyCoachQuotaFromResponse(data)) return;
  if (!trackedLocally) return;
  consumeCoachPromptLocal();
  setSubscriptionSnapshot({});
}
