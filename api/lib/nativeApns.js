import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @returns {boolean} */
export function isApnsConfigured() {
  const key = (process.env.APNS_PRIVATE_KEY || "").trim();
  const keyId = (process.env.APNS_KEY_ID || "").trim();
  const teamId = (process.env.APNS_TEAM_ID || "").trim();
  const topic = (process.env.IOS_BUNDLE_ID || "").trim();
  return Boolean(key && keyId && teamId && topic);
}

/**
 * Normalize APNs device token for node-apn (hex, no spaces).
 * @param {string} token
 */
export function normalizeApnsDeviceToken(token) {
  const t = String(token).trim().replace(/\s+/g, "").replace(/[<>]/g, "");
  if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) return t.toLowerCase();
  return t;
}

function apnsProductionFlag() {
  if (process.env.APNS_PRODUCTION === "true") return true;
  if (process.env.APNS_PRODUCTION === "false") return false;
  return process.env.NODE_ENV === "production";
}

function getCachedProvider() {
  if (!isApnsConfigured()) return null;
  if (globalThis.__proyouApnsProvider) return globalThis.__proyouApnsProvider;
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
  globalThis.__proyouApnsProvider = provider;
  return provider;
}

/**
 * Send one alert push to an iOS device (APNs HTTP/2 token auth).
 * @param {{ deviceToken: string; title: string; body: string; payload?: Record<string, unknown> }} opts
 * @returns {Promise<{ ok: true } | { ok: false; reason: string }>}
 */
export async function sendIosApnsNotification(opts) {
  const { deviceToken, title, body, payload = {} } = opts;
  if (!isApnsConfigured()) {
    return { ok: false, reason: "APNs not configured (set APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID, IOS_BUNDLE_ID)" };
  }
  const topic = process.env.IOS_BUNDLE_ID.trim();
  const apn = require("apn");
  const provider = getCachedProvider();
  if (!provider) return { ok: false, reason: "APNs provider unavailable" };

  const note = new apn.Notification();
  note.expiry = Math.floor(Date.now() / 1000) + 3600;
  note.alert = { title: String(title).slice(0, 200), body: String(body).slice(0, 2000) };
  note.sound = "default";
  note.topic = topic;
  note.payload = { ...payload, url: typeof payload.url === "string" ? payload.url : "/" };

  const tokenHex = normalizeApnsDeviceToken(deviceToken);
  const result = await provider.send(note, tokenHex);
  const failed = result.failed || [];
  if (failed.length > 0) {
    const f = failed[0];
    const reason = f.response?.reason || f.error?.message || String(f.status || "failed");
    return { ok: false, reason };
  }
  return { ok: true };
}
