/**
 * FCM registration tokens from @capacitor-firebase/messaging (iOS/Android).
 * Not the APNs device token (opaque hex).
 */

/** @param {unknown} t */
export function normalizeFcmRegistrationToken(t) {
  if (typeof t !== "string") return "";
  return t.trim();
}

/**
 * Reject legacy APNs-only opaque hex rows mistaken for FCM.
 * @param {string} s
 */
function looksLikeLegacyApnsHexToken(s) {
  if (!s || s.length < 64 || s.length > 200 || s.length % 2 !== 0) return false;
  return /^[0-9a-f]+$/i.test(s);
}

/**
 * @param {unknown} t
 * @returns {boolean}
 */
export function isValidFcmRegistrationToken(t) {
  const s = normalizeFcmRegistrationToken(t);
  if (s.length < 50 || s.length > 4096) return false;
  if (looksLikeLegacyApnsHexToken(s)) return false;
  return true;
}
