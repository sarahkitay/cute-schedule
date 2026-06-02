import { verifyFirebaseIdToken } from "./firebaseAdminApp.js";
import { verifyRevenueCatPro } from "./revenueCatVerify.js";
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
 * Resolve Pro status, preferring server-side RevenueCat verification over the
 * client-sent flag. Falls back to the client flag only when RevenueCat cannot be
 * checked (no secret key, anonymous user, or API/network error).
 * @param {string | null} uid
 * @param {object} body
 */
async function resolveIsPro(uid, body) {
  const clientIsPro = Boolean(body?.subscription?.isPro);
  if (!uid) return clientIsPro; // anonymous: cannot verify, trust client (still rate-limited)
  const rc = await verifyRevenueCatPro(uid);
  return rc.verified ? rc.isPro : clientIsPro;
}

/**
 * Enforce free-tier coach prompt limits (2/day). The quota is only *checked* here;
 * it is consumed via `consumeCoachPrompt` after a successful response so that failed
 * requests do not burn a prompt. Pro is verified server-side via RevenueCat when possible.
 * @param {import('http').IncomingMessage} req
 * @param {object} body
 */
export async function assertCoachEntitlement(req, body) {
  const idToken = extractIdToken(req, body);
  const uid = idToken ? await verifyFirebaseIdToken(idToken) : null;
  const subject = subjectKey(req, body, uid);
  const isPro = await resolveIsPro(uid, body);
  const appTrialActive = Boolean(body?.subscription?.appTrialActive);

  if (isPro || appTrialActive) {
    return { ok: true, uid, isPro: isPro || false, appTrialActive, subject };
  }

  if (!kv) {
    return { ok: true, uid, isPro: false, subject };
  }

  const day = todayKeyUtc();
  const key = `coach:prompts:${subject}:${day}`;

  try {
    const used = Number(await kv.get(key)) || 0;
    if (used >= FREE_COACH_PROMPTS_PER_DAY) {
      return {
        ok: false,
        code: "PROMPT_LIMIT",
        retryAfterSec: 3600,
        used,
        limit: FREE_COACH_PROMPTS_PER_DAY,
      };
    }
    return { ok: true, uid, isPro: false, subject, key, used, limit: FREE_COACH_PROMPTS_PER_DAY };
  } catch (e) {
    console.warn("coach entitlement redis error", e?.message || e);
    return { ok: true, uid, isPro: false, subject, redisError: true };
  }
}

/**
 * Consume one free coach prompt. Call this only after a successful coach response.
 * No-op for Pro users, when Redis is unavailable, or when no key was reserved.
 * @param {{ isPro?: boolean, key?: string } | null | undefined} entitlement
 */
export async function consumeCoachPrompt(entitlement) {
  if (!entitlement || entitlement.isPro || entitlement.appTrialActive || !entitlement.key || !kv) return;
  try {
    const count = await kv.incr(entitlement.key);
    if (count === 1) {
      await kv.expire(entitlement.key, 60 * 60 * 48);
    }
  } catch (e) {
    console.warn("coach consume redis error", e?.message || e);
  }
}
