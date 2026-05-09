import { createHash } from "node:crypto";
import { kv } from "../lib/redisClient.js";
import { applyApiCors } from "../lib/cors.js";
import { verifyFirebaseIdToken } from "../lib/firebaseAdminApp.js";

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
 * POST { token, platform?, idToken? } — optional Firebase ID token (body or Authorization) to scope KV by uid.
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
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.trim().slice(0, 24) : "unknown";

  if (token.length < 16) {
    return res.status(400).json({ error: "Missing or invalid token" });
  }

  const idToken = extractIdToken(req, body);
  const firebaseUid = idToken ? await verifyFirebaseIdToken(idToken) : null;

  try {
    const platNorm = platform === "android" ? "android" : "ios";
    /** @type {import("../lib/pushTarget.d.ts").PushTarget & { firebaseUid?: string }} */
    const target =
      platNorm === "android"
        ? { type: "android", token, updatedAt: Date.now(), ...(firebaseUid ? { firebaseUid } : {}) }
        : { type: "ios", token, updatedAt: Date.now(), ...(firebaseUid ? { firebaseUid } : {}) };

    if (firebaseUid) {
      await kv.set(`native:user:${firebaseUid}`, target);
      await kv.sadd("push:native-user-uids", firebaseUid);
      return res.status(200).json({
        ok: true,
        scope: "user",
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
    const hint = /KV|kv|Redis|REDIS|Upstash|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)
      ? "Add Upstash Redis to this project. Native push token storage requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
      : "Check this deployment's function logs in Vercel for the full error.";
    return res.status(500).json({ error: "Failed to store native token", hint, detail: msg.slice(0, 240) });
  }
}
