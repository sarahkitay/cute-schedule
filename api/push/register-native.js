import { createHash } from "node:crypto";
import { getRedisEnvDebug, kv } from "../lib/redisClient.js";
import { applyApiCors } from "../lib/cors.js";
import { verifyFirebaseIdToken } from "../lib/firebaseAdminApp.js";
import { normalizeFcmRegistrationToken } from "../lib/fcmRegistrationToken.js";
import { isValidNormalizedIosDeviceToken, normalizeCapacitorIosDeviceToken } from "../lib/nativeIosTokenNormalize.js";

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
 * POST { token, platform?, pushProvider?, idToken? } - optional Firebase ID token (body or Authorization) to scope KV by uid.
 * iOS: `pushProvider=fcm` uses FCM rules only (trim + length). `pushProvider=apns` uses legacy APNs hex normalization.
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
  /** @type {"fcm" | "apns" | undefined} */
  let iosPushProvider;

  if (platNorm === "ios") {
    if (pushProviderRaw === "fcm") {
      token = normalizeFcmRegistrationToken(token);
      if (!token) {
        return res.status(400).json({ error: "Missing iOS FCM token" });
      }
      if (token.length < 32 || token.length > 4096) {
        return res.status(400).json({
          error: "Invalid FCM registration token",
          hint: "After trim, token must be 32–4096 characters (from FirebaseMessaging.getToken()).",
          detail: `length=${token.length}`,
        });
      }
      iosPushProvider = "fcm";
    } else if (pushProviderRaw === "apns") {
      const n = normalizeCapacitorIosDeviceToken(token);
      if (!n) {
        return res.status(400).json({ error: "Missing iOS device token" });
      }
      if (!isValidNormalizedIosDeviceToken(n)) {
        return res.status(400).json({
          error: "Invalid iOS APNs device token",
          hint: "Legacy pushProvider=apns: even-length lowercase hex device token (64–200 chars after removing spaces and <>). Not APNS_PRIVATE_KEY.",
          detail: `normalizedLength=${n.length}; even=${n.length % 2 === 0}; hex=${/^[0-9a-f]+$/.test(n)}`,
        });
      }
      token = n;
      iosPushProvider = "apns";
    } else {
      return res.status(400).json({
        error: "iOS native push requires pushProvider",
        hint: 'Send pushProvider: "fcm" (FirebaseMessaging token) or pushProvider: "apns" (legacy APNs hex only).',
      });
    }
  } else if (token.length < 16) {
    return res.status(400).json({ error: "Missing or invalid token" });
  }

  try {
    /** @type {import("../lib/pushTarget.d.ts").PushTarget & { firebaseUid?: string }} */
    const target =
      platNorm === "android"
        ? { type: "android", token, updatedAt: Date.now(), ...(firebaseUid ? { firebaseUid } : {}) }
        : {
            type: "ios",
            pushProvider: iosPushProvider,
            token,
            updatedAt: Date.now(),
            ...(firebaseUid ? { firebaseUid } : {}),
          };

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
