import { createHash } from "node:crypto";
import { kv } from "../lib/redisClient.js";
import { applyApiCors } from "../lib/cors.js";
import { verifyFirebaseIdToken } from "../lib/firebaseAdminApp.js";
import { normalizeReminderPayload } from "../lib/pushReminderNormalize.js";
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
 * POST { token, platform?, pushProvider?, reminders, idToken? } — same reminder shape as /api/push/reminders; keys by Firebase uid when token verifies.
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
  const list = Array.isArray(body.reminders) ? body.reminders : [];

  const platNorm = platform === "android" ? "android" : "ios";
  if (platNorm === "ios") {
    if (pushProviderRaw === "fcm") {
      token = normalizeFcmRegistrationToken(token);
      if (!token) {
        return res.status(400).json({ error: "Missing iOS FCM token" });
      }
      if (token.length < 32 || token.length > 4096) {
        return res.status(400).json({
          error: "Invalid FCM token for reminders",
          hint: "After trim, token must be 32–4096 characters (same rules as register-native with pushProvider=fcm).",
          detail: `length=${token.length}`,
        });
      }
    } else if (pushProviderRaw === "apns") {
      const n = normalizeCapacitorIosDeviceToken(token);
      if (!isValidNormalizedIosDeviceToken(n)) {
        return res.status(400).json({
          error: "Invalid iOS APNs token for reminders",
          hint: "Legacy pushProvider=apns: same hex rules as register-native.",
        });
      }
      token = n;
    } else {
      return res.status(400).json({
        error: "iOS reminders require pushProvider",
        hint: 'Send pushProvider: "fcm" or pushProvider: "apns" (legacy), matching register-native.',
      });
    }
  } else if (token.length < 16) {
    return res.status(400).json({ error: "Missing or invalid token" });
  }

  const now = Date.now();
  const maxFuture = 48 * 60 * 60 * 1000;
  const normalized = normalizeReminderPayload(list, now, maxFuture);

  const idToken = extractIdToken(req, body);
  const firebaseUid = idToken ? await verifyFirebaseIdToken(idToken) : null;

  try {
    if (firebaseUid) {
      await kv.set(`reminders:native:user:${firebaseUid}`, normalized);
      return res.status(200).json({ ok: true, count: normalized.length, scope: "user" });
    }

    const hash = createHash("sha256").update(token).digest("hex");
    const deviceId = `native:${platNorm}:${hash}`;
    await kv.set(`reminders:${deviceId}`, normalized);
    return res.status(200).json({ ok: true, count: normalized.length, scope: "anon" });
  } catch (e) {
    console.error("reminders-native error", e);
    const msg = String(e?.message || e);
    const hint = /KV|kv|Redis|REDIS|Upstash|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)
      ? "Add Upstash Redis to this project and run `vercel env pull` for UPSTASH_REDIS_* vars."
      : msg.slice(0, 200);
    return res.status(500).json({ error: "Failed to store reminders", hint });
  }
}
