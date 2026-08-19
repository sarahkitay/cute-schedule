import { REFERRAL_PRO_DAYS } from "./socialModel.js";

const REFERRAL_PRO_UNTIL_KEY = "proyou_referral_pro_until_v1";

export function getReferralProUntilIso(): string {
  try {
    return localStorage.getItem(REFERRAL_PRO_UNTIL_KEY) || "";
  } catch {
    return "";
  }
}

export function setReferralProUntilIso(iso: string | null | undefined): void {
  try {
    if (iso) localStorage.setItem(REFERRAL_PRO_UNTIL_KEY, iso);
    else localStorage.removeItem(REFERRAL_PRO_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

export function getReferralProGrant(): { active: boolean; until: Date | null; daysLeft: number } {
  const iso = getReferralProUntilIso();
  if (!iso) return { active: false, until: null, daysLeft: 0 };
  const until = new Date(iso);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return { active: false, until: null, daysLeft: 0 };
  }
  const daysLeft = Math.ceil((until.getTime() - Date.now()) / 86400000);
  return { active: true, until, daysLeft };
}

export function computeReferralProUntilIso(existingIso?: string | null, days = REFERRAL_PRO_DAYS): string {
  let base = Date.now();
  if (existingIso) {
    const existing = new Date(existingIso);
    if (!Number.isNaN(existing.getTime()) && existing.getTime() > base) {
      base = existing.getTime();
    }
  }
  return new Date(base + days * 86400000).toISOString();
}

export function latestReferralProUntilIso(candidates: Array<string | null | undefined>): string {
  let best = "";
  let bestMs = 0;
  for (const iso of candidates) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t) && t > bestMs) {
      bestMs = t;
      best = iso;
    }
  }
  return best;
}

export function grantReferralProDays(days = REFERRAL_PRO_DAYS): Date {
  const iso = computeReferralProUntilIso(getReferralProUntilIso(), days);
  setReferralProUntilIso(iso);
  return new Date(iso);
}

export function mergeSubscriptionWithReferral<T extends Record<string, unknown>>(storeState: T): T & Record<string, unknown> {
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
