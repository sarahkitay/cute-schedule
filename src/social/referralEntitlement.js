import { REFERRAL_PRO_DAYS } from "./socialModel.js";

const REFERRAL_PRO_UNTIL_KEY = "proyou_referral_pro_until_v1";

export function getReferralProUntilIso() {
  try {
    return localStorage.getItem(REFERRAL_PRO_UNTIL_KEY) || "";
  } catch {
    return "";
  }
}

export function setReferralProUntilIso(iso) {
  try {
    if (iso) localStorage.setItem(REFERRAL_PRO_UNTIL_KEY, iso);
    else localStorage.removeItem(REFERRAL_PRO_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

/** @returns {{ active: boolean, until: Date | null, daysLeft: number }} */
export function getReferralProGrant() {
  const iso = getReferralProUntilIso();
  if (!iso) return { active: false, until: null, daysLeft: 0 };
  const until = new Date(iso);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return { active: false, until: null, daysLeft: 0 };
  }
  const daysLeft = Math.ceil((until.getTime() - Date.now()) / 86400000);
  return { active: true, until, daysLeft };
}

/** Compute extended Pro-until ISO from an existing grant (or now). */
export function computeReferralProUntilIso(existingIso, days = REFERRAL_PRO_DAYS) {
  let base = Date.now();
  if (existingIso) {
    const existing = new Date(existingIso);
    if (!Number.isNaN(existing.getTime()) && existing.getTime() > base) {
      base = existing.getTime();
    }
  }
  return new Date(base + days * 86400000).toISOString();
}

/** Grant 30-day internal Pro on this device (complements StoreKit). */
export function grantReferralProDays(days = REFERRAL_PRO_DAYS) {
  const iso = computeReferralProUntilIso(getReferralProUntilIso(), days);
  setReferralProUntilIso(iso);
  return new Date(iso);
}

/** Merge RevenueCat / dev state with referral grant for effective Pro access. */
export function mergeSubscriptionWithReferral(storeState) {
  const referral = getReferralProGrant();
  if (!referral.active) return storeState;
  const untilIso = referral.until?.toISOString?.() || null;
  if (storeState.isPro) {
    return { ...storeState, referralProActive: true, referralProUntil: untilIso };
  }
  return {
    ...storeState,
    isPro: true,
    trialActive: false,
    referralProActive: true,
    referralProUntil: untilIso,
    subscriptionExpired: false,
  };
}
