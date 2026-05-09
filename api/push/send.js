import webpush from "web-push";
import { getWebSubscriptionFromStored } from "../lib/pushTarget.js";
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from "../lib/vapidEnv.js";
import { applyApiCors } from "../lib/cors.js";
import { clientSafeDetail, logServerError } from "../lib/safeJsonError.js";
import { sendIosApnsNotification, isApnsConfigured } from "../lib/nativeApns.js";
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
    let token = "";
    const bodyToken = typeof body.token === "string" ? body.token.trim() : "";
    const deviceKey = typeof body.deviceKey === "string" ? body.deviceKey.trim() : "";

    if (deviceKey.length >= 8 && /^native:ios:/.test(deviceKey)) {
      try {
        const stored = await kv.get(deviceKey);
        if (stored && typeof stored === "object" && !Array.isArray(stored)) {
          if (stored.type !== "ios") {
            return res.status(400).json({
              error: "Wrong device for native iOS send",
              hint: "deviceKey must refer to an iOS registration (native:ios:…). For Android use a different flow.",
            });
          }
          const t = stored.token;
          if (typeof t === "string" && t.trim().length >= 16) token = t.trim();
        }
      } catch (e) {
        logServerError("push/send nativeIos deviceKey lookup", e);
        return res.status(503).json({
          error: "deviceKey lookup failed",
          hint: "Could not load device registration from Redis (UPSTASH_* or KV_REST_* env).",
          detail: isProd ? undefined : String(e?.message || e),
        });
      }
    }

    if (token.length < 16 && bodyToken.length >= 16) {
      token = bodyToken;
    }

    if (token.length < 16) {
      return res.status(400).json({
        error: "Missing native device token",
        hint: 'Prefer anon "deviceKey" (native:ios:…) from register-native, or send APNs token in "token". Web PushSubscription is not used for native iOS.',
        debug: isProd
          ? undefined
          : { hadDeviceKey: deviceKey.length > 0, bodyTokenLen: bodyToken.length, resolvedTokenLen: token.length },
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
      return res.status(502).json({
        error: "APNs send failed",
        apnsReason: rslt.reason || "unknown",
        apnsStatus: rslt.apnsStatus,
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
      hint: "For browser/PWA, include PushSubscription JSON under \"subscription\". For native iOS test, set nativeIos: true and token.",
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
