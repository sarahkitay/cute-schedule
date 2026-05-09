import { createRequire } from "node:module";
import {
  APNS_DEVICE_TOKEN_HEX_MAX,
  APNS_DEVICE_TOKEN_HEX_MIN,
  isValidNormalizedIosDeviceToken,
} from "./nativeIosTokenNormalize.js";

const require = createRequire(import.meta.url);

/** Xcode / App Store target for PROYOU (must match `note.topic` sent to APNs). */
const EXPECTED_PROYOU_IOS_BUNDLE_ID = "app.proyou.proyou";

/** @returns {boolean} */
export function isApnsConfigured() {
  const key = (process.env.APNS_PRIVATE_KEY || "").trim();
  const keyId = (process.env.APNS_KEY_ID || "").trim();
  const teamId = (process.env.APNS_TEAM_ID || "").trim();
  const topic = (process.env.IOS_BUNDLE_ID || "").trim();
  return Boolean(key && keyId && teamId && topic);
}

/**
 * Normalize APNs device token from @capacitor/push-notifications (or Redis):
 * trim, strip whitespace, remove angle brackets, strip any non-hex, lower-case.
 * @param {unknown} token
 */
export function normalizeApnsDeviceToken(token) {
  return String(token ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[<>]/g, "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toLowerCase();
}

/**
 * Validates the **device token** (from Capacitor / Redis), not `APNS_PRIVATE_KEY` (.p8).
 * Treats token as variable-length opaque hex (even length, bounds shared with `nativeIosTokenNormalize`).
 */
export function apnsHexTokenLooksValid(hex) {
  return isValidNormalizedIosDeviceToken(hex);
}

function apnsProductionFlag() {
  if (process.env.APNS_PRODUCTION === "true") return true;
  if (process.env.APNS_PRODUCTION === "false") return false;
  return process.env.NODE_ENV === "production";
}

/**
 * @param {{ hex: string; apnsReason: string | null }} p
 * @returns {{
 *   normalizedTokenLength: number;
 *   tokenLooksHex: boolean;
 *   topic: string;
 *   APNS_PRODUCTION: string | null;
 *   production: boolean;
 *   apnsReason: string | null;
 * }}
 */
function buildApnsDebug(p) {
  const topic = (process.env.IOS_BUNDLE_ID || "").trim();
  const apnsProdRaw = process.env.APNS_PRODUCTION;
  const usesProdEndpoint = apnsProductionFlag();
  const reason = p.apnsReason != null ? String(p.apnsReason) : "";
  /** @type {Record<string, unknown>} */
  const out = {
    normalizedTokenLength: p.hex.length,
    tokenLooksHex: apnsHexTokenLooksValid(p.hex),
    topic,
    APNS_PRODUCTION: apnsProdRaw === undefined || apnsProdRaw === "" ? null : String(apnsProdRaw),
    production: usesProdEndpoint,
    apnsReason: reason || null,
  };
  if (reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic") {
    out.badDeviceTokenHint = usesProdEndpoint
      ? "APNs production endpoint is active. Tokens from Xcode / local debug installs are almost always sandbox—set Vercel env APNS_PRODUCTION=false (or omit so NODE_ENV=development uses sandbox) and re-register push, then retry."
      : "APNs sandbox endpoint is active. Production/App Store device tokens require APNS_PRODUCTION=true on the server.";
  }
  return out;
}

/** Log only length + first/last 6 hex chars (never full token). */
function logApnsTokenProbe(hex, topic, production) {
  const n = hex.length;
  const preview = n >= 12 ? `${hex.slice(0, 6)}…${hex.slice(-6)}` : n > 0 ? `${hex.slice(0, Math.min(6, n))}…` : "(empty)";
  console.log("[nativeApns] APNs device token probe (not APNS_PRIVATE_KEY / .p8 length)", {
    normalizedTokenLength: n,
    tokenPreview: preview,
    topic,
    production,
  });
}

function getCachedProvider() {
  if (!isApnsConfigured()) return null;
  const cacheKey = apnsProductionFlag() ? "__proyouApnsProvider_prod" : "__proyouApnsProvider_sandbox";
  if (globalThis[cacheKey]) return globalThis[cacheKey];
  const apn = require("apn");
  const key = String(process.env.APNS_PRIVATE_KEY).replace(/\\n/g, "\n");
  const provider = new apn.Provider({
    token: {
      key,
      keyId: process.env.APNS_KEY_ID,
      teamId: process.env.APNS_TEAM_ID,
    },
    production: apnsProductionFlag(),
  });
  globalThis[cacheKey] = provider;
  return provider;
}

/**
 * Send one alert push to an iOS device (APNs HTTP/2 token auth).
 * @param {{ deviceToken: string; title: string; body: string; payload?: Record<string, unknown> }} opts
 * @returns {Promise<
 *   | { ok: true }
 *   | {
 *       ok: false;
 *       reason: string;
 *       apnsStatus?: number;
 *       apnsDebug: { normalizedTokenLength: number; tokenLooksHex: boolean; topic: string; APNS_PRODUCTION: string | null; production: boolean; apnsReason: string | null; badDeviceTokenHint?: string };
 *     }
 * >}
 */
export async function sendIosApnsNotification(opts) {
  const { deviceToken, title, body, payload = {} } = opts;
  const topic = (process.env.IOS_BUNDLE_ID || "").trim();
  const production = apnsProductionFlag();
  const tokenHex = normalizeApnsDeviceToken(deviceToken);

  if (!isApnsConfigured()) {
    return {
      ok: false,
      reason: "APNs not configured (set APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID, IOS_BUNDLE_ID)",
      apnsDebug: buildApnsDebug({ hex: tokenHex, apnsReason: "APNs not configured" }),
    };
  }

  if (topic !== EXPECTED_PROYOU_IOS_BUNDLE_ID) {
    console.warn(
      "[nativeApns] IOS_BUNDLE_ID should be exactly app.proyou.proyou for PROYOU; current topic:",
      topic || "(empty)"
    );
  }

  logApnsTokenProbe(tokenHex, topic, production);

  if (!apnsHexTokenLooksValid(tokenHex)) {
    let msg = "Invalid device token after normalization";
    if (tokenHex.length === 0) msg = "Empty token after normalization";
    else if (tokenHex.length % 2 !== 0) msg = `APNs device token hex length must be even; got ${tokenHex.length}`;
    else if (!/^[0-9a-f]+$/.test(tokenHex)) msg = "Token not hex-only after normalization";
    else
      msg = `APNs device token hex length out of range (need even length ${APNS_DEVICE_TOKEN_HEX_MIN}–${APNS_DEVICE_TOKEN_HEX_MAX}); got ${tokenHex.length}`;
    return { ok: false, reason: msg, apnsDebug: buildApnsDebug({ hex: tokenHex, apnsReason: msg }) };
  }

  const apn = require("apn");
  const provider = getCachedProvider();
  if (!provider) {
    return {
      ok: false,
      reason: "APNs provider unavailable",
      apnsDebug: buildApnsDebug({ hex: tokenHex, apnsReason: "APNs provider unavailable" }),
    };
  }

  const note = new apn.Notification();
  note.expiry = Math.floor(Date.now() / 1000) + 3600;
  note.alert = { title: String(title).slice(0, 200), body: String(body).slice(0, 2000) };
  note.sound = "default";
  note.topic = topic;
  note.payload = { ...payload, url: typeof payload.url === "string" ? payload.url : "/" };

  const result = await provider.send(note, tokenHex);
  const failed = result.failed || [];
  if (failed.length > 0) {
    const f = failed[0];
    const reason = f.response?.reason || f.error?.message || String(f.status || "failed");
    const apnsStatus = typeof f.status === "number" ? f.status : undefined;
    const apnsDebug = buildApnsDebug({ hex: tokenHex, apnsReason: reason });
    console.warn("[nativeApns] APNs rejected push", { ...apnsDebug, apnsStatus });
    return { ok: false, reason, apnsStatus, apnsDebug };
  }
  return { ok: true };
}
