/** Permanent Pro for admin accounts — no subscription required. */

export const BUILTIN_ADMIN_EMAILS = Object.freeze(["sdkitay605@gmail.com"]);

export function normalizeAdminEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getAdminEmailAllowlist() {
  const extra = String(import.meta.env?.VITE_ADMIN_EMAILS || "").trim();
  const fromEnv = extra
    ? extra.split(/[,;\s]+/).map((s) => normalizeAdminEmail(s)).filter(Boolean)
    : [];
  return new Set([...BUILTIN_ADMIN_EMAILS.map(normalizeAdminEmail), ...fromEnv]);
}

export function isAdminEmail(email) {
  const e = normalizeAdminEmail(email);
  if (!e) return false;
  return getAdminEmailAllowlist().has(e);
}

/** Merge StoreKit / referral / pilot state with admin Pro access. */
export function mergeSubscriptionWithAdminAccess(storeState, email) {
  if (!isAdminEmail(email)) return storeState;
  return {
    ...storeState,
    isPro: true,
    adminActive: true,
    subscriptionExpired: false,
  };
}
