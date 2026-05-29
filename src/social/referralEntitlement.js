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

/** Grant 30-day internal Pro (complements StoreKit; not a manual Apple subscription extension). */
export function grantReferralProDays(days = REFERRAL_PRO_DAYS) {
  const existing = getReferralProGrant();
  const base = existing.active && existing.until ? existing.until.getTime() : Date.now();
  const until = new Date(base + days * 86400000);
  const iso = until.toISOString();
  setReferralProUntilIso(iso);
  return until;
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
