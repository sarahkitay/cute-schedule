import { createHash } from "node:crypto";
import { getRedisEnvDebug, kv } from "../lib/redisClient.js";
import { applyApiCors } from "../lib/cors.js";
import { verifyFirebaseIdToken } from "../lib/firebaseAdminApp.js";
import { isValidFcmRegistrationToken, normalizeFcmRegistrationToken } from "../lib/fcmRegistrationToken.js";

function extractIdToken(req, body) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  if (typeof body.idToken === "string" && body.idToken.trim()) return body.idToken.trim();
  return null;
}

/**
 * POST { token, platform?, pushProvider?, idToken? } — optional Firebase ID token (body or Authorization) to scope KV by uid.
 * iOS requires pushProvider=fcm and an FCM registration token from @capacitor-firebase/messaging.
 * Web Push remains push:subs + subscribe.js.
 */
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
  let token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.trim().slice(0, 24) : "unknown";
  const pushProviderRaw = typeof body.pushProvider === "string" ? body.pushProvider.trim().toLowerCase() : "";

  const idToken = extractIdToken(req, body);
  const firebaseUid = idToken ? await verifyFirebaseIdToken(idToken) : null;

  const platNorm = platform === "android" ? "android" : "ios";
  if (platNorm === "ios") {
    if (pushProviderRaw !== "fcm") {
      return res.status(400).json({
        error: "iOS native push requires pushProvider=fcm",
        hint: "Use @capacitor-firebase/messaging getToken() and POST the FCM registration token (not the APNs device token hex).",
      });
    }
    const n = normalizeFcmRegistrationToken(token);
    if (!isValidFcmRegistrationToken(n)) {
      return res.status(400).json({
        error: "Invalid FCM registration token",
        hint: "Expected a long FCM token from FirebaseMessaging.getToken(). Legacy APNs-only hex tokens are not accepted — reinstall/update the app and register again.",
        detail: `normalizedLength=${n.length}`,
      });
    }
    token = n;
  } else if (token.length < 16) {
    return res.status(400).json({ error: "Missing or invalid token" });
  }

  try {
    /** @type {import("../lib/pushTarget.d.ts").PushTarget & { firebaseUid?: string }} */
    const target =
      platNorm === "android"
        ? { type: "android", token, updatedAt: Date.now(), ...(firebaseUid ? { firebaseUid } : {}) }
        : { type: "ios", pushProvider: "fcm", token, updatedAt: Date.now(), ...(firebaseUid ? { firebaseUid } : {}) };

    if (firebaseUid) {
      await kv.set(`native:user:${firebaseUid}`, target);
      await kv.sadd("push:native-user-uids", firebaseUid);
      return res.status(200).json({
        ok: true,
        scope: "user",
        deviceKey: `native:user:${firebaseUid}`,
        uidPrefix: firebaseUid.length > 6 ? `${firebaseUid.slice(0, 6)}…` : firebaseUid,
      });
    }

    const hash = createHash("sha256").update(token).digest("hex");
    const id = `native:${platNorm}:${hash}`;
    await kv.set(id, target);
    await kv.sadd("push:native-subs", id);
    return res.status(200).json({ ok: true, scope: "anon", deviceKey: id });
  } catch (e) {
    console.error("register-native error", e);
    const msg = String(e?.message || e);
    const hint = /KV|kv|Redis|REDIS|Upstash|ECONNREFUSED|ENOTFOUND|fetch failed|not configured/i.test(msg)
      ? "Add Redis to this project (UPSTASH_REDIS_REST_* or legacy KV_REST_API_* from Vercel Storage / vercel env pull)."
      : "Check this deployment's function logs in Vercel for the full error.";
    return res.status(500).json({
      error: "Failed to store native token",
      hint,
      detail: msg.slice(0, 240),
      redisEnv: getRedisEnvDebug(),
    });
  }
}
