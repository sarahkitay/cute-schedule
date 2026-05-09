/**
 * Capacitor PushNotifications registration: use only `registration.value` (APNs device token).
 * This is NOT `APNS_PRIVATE_KEY` (.p8) — never compare .p8 length to device token length.
 *
 * Normalize: trim, remove whitespace, angle brackets, then any non-hex; lower-case.
 * @param {unknown} raw
 */
export function normalizeCapacitorIosDeviceToken(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[<>]/g, "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toLowerCase();
}

/** Normalized hex length bounds (opaque APNs device token; not `APNS_PRIVATE_KEY`). */
export const APNS_DEVICE_TOKEN_HEX_MIN = 64;
export const APNS_DEVICE_TOKEN_HEX_MAX = 200;

/**
 * APNs device token after `normalizeCapacitorIosDeviceToken`: lowercase hex, even length, opaque length (Apple may use >32 bytes).
 */
export function isValidNormalizedIosDeviceToken(s) {
  if (typeof s !== "string" || !/^[0-9a-f]+$/.test(s)) return false;
  const n = s.length;
  if (n % 2 !== 0) return false;
  return n >= APNS_DEVICE_TOKEN_HEX_MIN && n <= APNS_DEVICE_TOKEN_HEX_MAX;
}

/** @deprecated use normalizeCapacitorIosDeviceToken */
export function trimIosApnsRegistrationToken(raw) {
  return normalizeCapacitorIosDeviceToken(raw);
}

/** @deprecated use isValidNormalizedIosDeviceToken */
export function isIosApnsToken64Hex(s) {
  return isValidNormalizedIosDeviceToken(s);
}

/** @param {string} s */
export function isRegistrationTokenHex(s) {
  return typeof s === "string" && /^[a-fA-F0-9]+$/.test(s);
}
