/**
 * Legacy APNs device token from Capacitor / direct APNs registration (opaque hex).
 * Used only when `pushProvider === "apns"` on iOS register / reminders routes.
 */

export const APNS_DEVICE_TOKEN_HEX_MIN = 64;
export const APNS_DEVICE_TOKEN_HEX_MAX = 200;

/** @param {unknown} raw */
export function normalizeCapacitorIosDeviceToken(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\s<>]/g, "").toLowerCase();
}

/** @param {string} hex */
export function isValidNormalizedIosDeviceToken(hex) {
  if (!hex || hex.length % 2 !== 0) return false;
  if (hex.length < APNS_DEVICE_TOKEN_HEX_MIN || hex.length > APNS_DEVICE_TOKEN_HEX_MAX) return false;
  return /^[0-9a-f]+$/.test(hex);
}
