import { verifyFirebaseIdToken } from "./firebaseAdminApp.js";
import { kv } from "./redisClient.js";

const FREE_COACH_PROMPTS_PER_DAY = 2;

function todayKeyUtc() {
  return new Date().toISOString().slice(0, 10);
}

function extractIdToken(req, body) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  if (body && typeof body.idToken === "string" && body.idToken.trim()) return body.idToken.trim();
  return null;
}

function subjectKey(req, body, uid) {
  if (uid) return `uid:${uid}`;
  const deviceId = req.headers["x-proyou-device-id"];
  if (typeof deviceId === "string" && deviceId.trim()) return `dev:${deviceId.trim().slice(0, 128)}`;
  const ip = req.headers["x-forwarded-for"]?.split?.(",")?.[0]?.trim() || req.socket?.remoteAddress;
  return `ip:${ip || "unknown"}`;
}

/**
 * Enforce free-tier coach prompt limits (2/day). Pro skips when client sends subscription.isPro.
 * @param {import('http').IncomingMessage} req
 * @param {object} body
 */
export async function assertCoachEntitlement(req, body) {
  const idToken = extractIdToken(req, body);
  const uid = idToken ? await verifyFirebaseIdToken(idToken) : null;
  const clientIsPro = Boolean(body?.subscription?.isPro);

  if (clientIsPro) {
    return { ok: true, uid, isPro: true, subject: subjectKey(req, body, uid) };
  }

  if (!kv) {
    return { ok: true, uid, isPro: false, subject: subjectKey(req, body, uid) };
  }

  const subject = subjectKey(req, body, uid);
  const day = todayKeyUtc();
  const key = `coach:prompts:${subject}:${day}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, 60 * 60 * 48);
    }
    if (count > FREE_COACH_PROMPTS_PER_DAY) {
      return {
        ok: false,
        code: "PROMPT_LIMIT",
        retryAfterSec: 3600,
        used: count - 1,
        limit: FREE_COACH_PROMPTS_PER_DAY,
      };
    }
    return { ok: true, uid, isPro: false, subject, used: count, limit: FREE_COACH_PROMPTS_PER_DAY };
  } catch (e) {
    console.warn("coach entitlement redis error", e?.message || e);
    return { ok: true, uid, isPro: false, subject, redisError: true };
  }
}
