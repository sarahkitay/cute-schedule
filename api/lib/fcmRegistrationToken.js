/**
 * FCM registration tokens from @capacitor-firebase/messaging (iOS/Android).
 * Validation is length-only after {@link normalizeFcmRegistrationToken} - no hex / APNs shape rules.
 */

/** @param {unknown} t */
export function normalizeFcmRegistrationToken(t) {
  if (typeof t !== "string") return "";
  return t.trim();
}

/**
 * Server-side sanity check for stored FCM tokens (send, cron, client-aligned checks).
 * Does not apply APNs-style hex rules.
 * @param {unknown} t
 * @returns {boolean}
 */
export function isValidFcmRegistrationToken(t) {
  const s = normalizeFcmRegistrationToken(t);
  return s.length >= 32 && s.length <= 4096;
}
