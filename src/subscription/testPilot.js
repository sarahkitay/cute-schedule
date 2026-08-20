/** Permanent Pro access for TestFlight / early-access cohort — no subscription required. */

export const TEST_PILOT_STORAGE_KEY = "proyou_test_pilot_v1";

/** @param {string | null | undefined} firebaseUid */
export function isTestPilotUid(firebaseUid) {
  const raw = String(import.meta.env?.VITE_TEST_PILOT_UIDS || "").trim();
  if (!firebaseUid || !raw) return false;
  const uid = String(firebaseUid).trim();
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(uid);
}

export function readTestPilotFlagFromStorage() {
  try {
    return localStorage.getItem(TEST_PILOT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** @param {object | null | undefined} profile */
export function syncTestPilotFromProfile(profile) {
  if (profile?.testPilot === true) {
    try {
      localStorage.setItem(TEST_PILOT_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }
}

export function activateTestPilot() {
  try {
    localStorage.setItem(TEST_PILOT_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("proyou:test-pilot-updated"));
  }
}

/**
 * @param {string | null | undefined} [firebaseUid]
 * @param {object | null | undefined} [profile]
 */
export function isTestPilotActive(firebaseUid, profile) {
  if (profile?.testPilot === true) return true;
  if (readTestPilotFlagFromStorage()) return true;
  return isTestPilotUid(firebaseUid);
}

/** URL hook for pilot invites, e.g. ?testpilot=1 */
export function captureTestPilotFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("testpilot") || params.get("pilot");
    if (flag === "1" || flag === "true" || flag === "proyou") {
      activateTestPilot();
    }
  } catch {
    /* ignore */
  }
}

/** Merge StoreKit / referral state with permanent test-pilot Pro. */
export function mergeSubscriptionWithTestPilot(storeState, firebaseUid, profile) {
  if (!isTestPilotActive(firebaseUid, profile)) return storeState;
  return {
    ...storeState,
    isPro: true,
    testPilotActive: true,
    subscriptionExpired: false,
  };
}
