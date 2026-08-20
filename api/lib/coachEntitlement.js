import { verifyFirebaseIdTokenDetails } from "./firebaseAdminApp.js";
import { verifyRevenueCatPro } from "./revenueCatVerify.js";
import { kv } from "./redisClient.js";

const FREE_COACH_PROMPTS_PER_DAY = 2;

const BUILTIN_ADMIN_EMAILS = new Set(["sdkitay605@gmail.com"]);

export function isAdminEmailServer(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if (BUILTIN_ADMIN_EMAILS.has(e)) return true;
  const extra = String(process.env.PROYOU_ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(e);
}

export function todayKeyUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function resolveQuotaDayKey(body, now = new Date()) {
  const local = body?.subscription?.localDayKey;
  if (typeof local === "string" && /^\d{4}-\d{2}-\d{2}$/.test(local.trim())) {
    return local.trim();
  }
  return todayKeyUtc(now);
}

export function extractIdToken(req, body) {
  const auth = req?.headers?.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  if (body && typeof body.idToken === "string" && body.idToken.trim()) return body.idToken.trim();
  return null;
}

export function subjectKey(req, body, uid) {
  if (uid) return `uid:${uid}`;
  const deviceId = req?.headers?.["x-proyou-device-id"];
  if (typeof deviceId === "string" && deviceId.trim()) return `dev:${deviceId.trim().slice(0, 128)}`;
  const ip = req?.headers?.["x-forwarded-for"]?.split?.(",")?.[0]?.trim() || req?.socket?.remoteAddress;
  return `ip:${ip || "unknown"}`;
}

/** True when this request must not consume the free daily coach quota. */
export function isUnlimitedCoachEntitlement({
  isPro = false,
  appTrialActive = false,
  testPilotActive = false,
  adminActive = false,
} = {}) {
  return Boolean(isPro || appTrialActive || testPilotActive || adminActive);
}

/**
 * Pure quota decision against a stored count (Redis or local).
 * @param {number} used
 */
export function evaluateStoredCoachPromptCount(used) {
  const n = Math.max(0, Math.round(Number(used) || 0));
  if (n >= FREE_COACH_PROMPTS_PER_DAY) {
    return {
      ok: false,
      code: "PROMPT_LIMIT",
      retryAfterSec: 3600,
      used: n,
      limit: FREE_COACH_PROMPTS_PER_DAY,
    };
  }
  return { ok: true, used: n, limit: FREE_COACH_PROMPTS_PER_DAY };
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
  const auth = idToken ? await verifyFirebaseIdTokenDetails(idToken) : null;
  const uid = auth?.uid ?? null;
  const subject = subjectKey(req, body, uid);
  const isPro = await resolveIsPro(uid, body);
  const appTrialActive = Boolean(body?.subscription?.appTrialActive);
  const clientTestPilot = Boolean(body?.subscription?.testPilotActive);
  const adminActive = isAdminEmailServer(auth?.email);
  const envPilots = String(process.env.PROYOU_TEST_PILOT_UIDS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const serverTestPilot = Boolean(uid && envPilots.includes(uid));
  const testPilotActive = clientTestPilot || serverTestPilot;

  if (isUnlimitedCoachEntitlement({ isPro, appTrialActive, testPilotActive, adminActive })) {
    return {
      ok: true,
      uid,
      isPro: isPro || testPilotActive || adminActive || false,
      appTrialActive,
      testPilotActive,
      adminActive,
      subject,
      quotaDay: resolveQuotaDayKey(body),
    };
  }

  if (!kv) {
    return { ok: true, uid, isPro: false, subject, quotaDay: resolveQuotaDayKey(body) };
  }

  const day = resolveQuotaDayKey(body);
  const key = `coach:prompts:${subject}:${day}`;

  try {
    const used = Number(await kv.get(key)) || 0;
    const decision = evaluateStoredCoachPromptCount(used);
    if (!decision.ok) {
      return { ...decision, quotaDay: day };
    }
    return { ok: true, uid, isPro: false, subject, key, used: decision.used, limit: decision.limit, quotaDay: day };
  } catch (e) {
    console.warn("coach entitlement redis error", e?.message || e);
    return { ok: true, uid, isPro: false, subject, redisError: true };
  }
}

export function buildCoachQuotaPayload(entitlement, usedOverride = null) {
  const limit = FREE_COACH_PROMPTS_PER_DAY;
  if (
    !entitlement ||
    entitlement.isPro ||
    entitlement.appTrialActive ||
    entitlement.testPilotActive ||
    entitlement.adminActive
  ) {
    return null;
  }
  const used =
    usedOverride != null
      ? Math.max(0, Math.round(Number(usedOverride) || 0))
      : Math.max(0, Math.round(Number(entitlement.used) || 0));
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    dayKey: entitlement.quotaDay || undefined,
  };
}

/**
 * Consume one free coach prompt. Call this only after a successful coach response.
 * No-op for Pro users, when Redis is unavailable, or when no key was reserved.
 * @param {{ isPro?: boolean, key?: string } | null | undefined} entitlement
 */
export async function consumeCoachPrompt(entitlement) {
  if (
    !entitlement ||
    entitlement.isPro ||
    entitlement.appTrialActive ||
    entitlement.testPilotActive ||
    entitlement.adminActive ||
    !entitlement.key ||
    !kv
  )
    return;
  try {
    const count = await kv.incr(entitlement.key);
    if (count === 1) {
      await kv.expire(entitlement.key, 60 * 60 * 48);
    }
  } catch (e) {
    console.warn("coach consume redis error", e?.message || e);
  }
}
