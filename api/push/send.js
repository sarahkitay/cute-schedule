import webpush from "web-push";
import { getWebSubscriptionFromStored } from "../lib/pushTarget.js";
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from "../lib/vapidEnv.js";
import { applyApiCors } from "../lib/cors.js";
import { clientSafeDetail, logServerError } from "../lib/safeJsonError.js";
import { sendIosApnsNotification, isApnsConfigured } from "../lib/nativeApns.js";
import { isValidNormalizedIosDeviceToken, normalizeCapacitorIosDeviceToken } from "../lib/nativeIosTokenNormalize.js";
import { kv } from "../lib/redisClient.js";

const vapidPub = getVapidPublicKey();
const vapidPriv = getVapidPrivateKey();
if (vapidPub && vapidPriv) {
  webpush.setVapidDetails(getVapidSubject(), vapidPub, vapidPriv);
}

const isProd = process.env.NODE_ENV === "production";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    applyApiCors(req, res);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).end();
  }
  applyApiCors(req, res);
  res.setHeader("Content-Type", "application/json");

  const body = typeof req.body === "object" && req.body != null ? req.body : {};
  const { title = "PROYOU", body: textBody = "Test notification", url = "/" } = body;

  // --- Native iOS test (APNs); does not use VAPID / Web PushSubscription ---
  const wantsNativeIos =
    body.nativeIos === true || body.nativeIos === "true" || body.nativeIos === 1 || body.nativeIos === "1";
  if (wantsNativeIos) {
    /** Connectivity probe from Capacitor Settings (no token, no APNs send). */
    const testOnly = body.testOnly === true || body.testOnly === "true" || body.testOnly === 1 || body.testOnly === "1";
    if (testOnly) {
      return res.status(200).json({
        ok: true,
        probe: true,
        channel: "native-probe",
        message: "POST reached /api/push/send (testOnly; no notification sent)",
      });
    }
    const deviceKey = typeof body.deviceKey === "string" ? body.deviceKey.trim() : "";
    const validDeviceKey =
      deviceKey.length >= 8 && (/^native:ios:/.test(deviceKey) || /^native:user:/.test(deviceKey));

    if (!validDeviceKey) {
      return res.status(400).json({
        error: "Missing or invalid deviceKey",
        hint: "Send deviceKey from POST /api/push/register-native (native:ios:… or native:user:…). Raw APNs token is not accepted here — the server loads the token from Redis.",
      });
    }

    let token = "";
    /** Length of `normalizeCapacitorIosDeviceToken(stored.token)` for non-prod debug when invalid. */
    let normalizedFromRedisLen = 0;
    try {
      const stored = await kv.get(deviceKey);
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        if (stored.type !== "ios") {
          return res.status(400).json({
            error: "Wrong device for native iOS send",
            hint: "deviceKey must refer to an iOS registration stored in Redis.",
          });
        }
        const t = stored.token;
        if (typeof t === "string" && t.trim()) {
          const n = normalizeCapacitorIosDeviceToken(t);
          normalizedFromRedisLen = n.length;
          if (isValidNormalizedIosDeviceToken(n)) token = n;
        }
      }
    } catch (e) {
      logServerError("push/send nativeIos deviceKey lookup", e);
      return res.status(503).json({
        error: "deviceKey lookup failed",
        hint: "Could not load device registration from Redis (UPSTASH_* or KV_REST_* env).",
        detail: isProd ? undefined : String(e?.message || e),
      });
    }

    if (!isValidNormalizedIosDeviceToken(token)) {
      return res.status(400).json({
        error: "No valid APNs device token in Redis for this deviceKey",
        hint: "Re-register from the app. Stored token must be even-length hex (64–200 chars) after normalization.",
        debug: isProd ? undefined : { deviceKeyLen: deviceKey.length, normalizedLen: normalizedFromRedisLen || token.length },
      });
    }
    if (!isApnsConfigured()) {
      return res.status(503).json({
        error: "APNs not configured",
        hint: "Set APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID, IOS_BUNDLE_ID on the server (and APNS_PRODUCTION false for dev builds).",
      });
    }
    const rslt = await sendIosApnsNotification({
      deviceToken: token,
      title,
      body: textBody,
      payload: { url },
    });
    if (!rslt.ok) {
      logServerError("push/send APNs failed", new Error(rslt.reason || "unknown"));
      const dbg = rslt.apnsDebug || null;
      return res.status(502).json({
        error: "APNs send failed",
        apnsStatus: rslt.apnsStatus,
        apnsDebug: dbg,
        /** Flatten for clients that read top-level fields */
        ...(dbg && typeof dbg === "object"
          ? {
              normalizedTokenLength: dbg.normalizedTokenLength,
              tokenLooksHex: dbg.tokenLooksHex,
              topic: dbg.topic,
              APNS_PRODUCTION: dbg.APNS_PRODUCTION,
              production: dbg.production,
              apnsReason: dbg.apnsReason,
            }
          : {}),
        detail: isProd ? undefined : rslt.reason,
      });
    }
    return res.status(200).json({ ok: true, sent: 1, channel: "apns" });
  }

  // --- Web Push (VAPID) ---
  if (!vapidPub || !vapidPriv) {
    return res.status(503).json({ error: "Web push not configured", hint: "VAPID keys missing for browser test send." });
  }

  const sub = getWebSubscriptionFromStored(body.subscription);
  if (!sub) {
    return res.status(400).json({
      error: "Missing subscription",
      hint: 'For browser/PWA, include PushSubscription JSON under "subscription". For native iOS test, set nativeIos: true and deviceKey from register-native (no raw APNs token on this route).',
    });
  }

  const payload = JSON.stringify({ title, body: textBody, url });

  try {
    await webpush.sendNotification(sub, payload);
    return res.status(200).json({ ok: true, sent: 1, channel: "web-push" });
  } catch (e) {
    logServerError("push/send targeted", e);
    const status = e?.statusCode === 410 || e?.statusCode === 404 ? 410 : 500;
    const detail = clientSafeDetail(e, isProd);
    return res.status(status).json(
      detail
        ? { error: "Failed to send notification", detail }
        : { error: "Failed to send notification", hint: "Subscription may be expired; enable background reminders again." }
    );
  }
}
