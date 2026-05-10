/**
 * Normalize KV value to a Web Push subscription for `web-push`, or null if not web.
 * Supports new `{ type: 'web', subscription }` and legacy raw subscription objects.
 * @param {unknown} raw
 * @returns {WebPushSubscription | null}
 */
export function getWebSubscriptionFromStored(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (o.type === "web" && o.subscription && typeof o.subscription === "object" && o.subscription !== null) {
    const sub = /** @type {Record<string, unknown>} */ (o.subscription);
    if (typeof sub.endpoint === "string" && sub.endpoint) return /** @type {WebPushSubscription} */ (o.subscription);
  }
  if (typeof o.endpoint === "string" && o.endpoint) {
    return /** @type {WebPushSubscription} */ (raw);
  }
  return null;
}

/**
 * @typedef {{ kind: 'ios' | 'android'; token: string; pushProvider?: string }} NativeTokenInfo
 */

/**
 * Native FCM (iOS/Android) token from stored row, or null.
 * Supports `{ type: 'ios'|'android', token, pushProvider? }` and legacy `{ token, platform }`.
 * @param {unknown} raw
 * @returns {NativeTokenInfo | null}
 */
export function getNativeTokenFromStored(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const pushProvider = typeof o.pushProvider === "string" ? o.pushProvider : undefined;
  if (o.type === "ios" && typeof o.token === "string") return { kind: "ios", token: o.token, pushProvider };
  if (o.type === "android" && typeof o.token === "string") return { kind: "android", token: o.token, pushProvider };
  if (typeof o.token === "string" && o.token.length >= 16) {
    const p = typeof o.platform === "string" ? o.platform.toLowerCase() : "";
    if (p === "android") return { kind: "android", token: o.token, pushProvider };
    if (p === "ios" || p === "unknown" || !p) return { kind: "ios", token: o.token, pushProvider };
    return { kind: "ios", token: o.token, pushProvider };
  }
  return null;
}
