import { getFirebaseUserAccountDetails, verifyFirebaseIdTokenDetails } from "./firebaseAdminApp.js";
import { verifyRevenueCatPro } from "./revenueCatVerify.js";
import { kv } from "./redisClient.js";

const FREE_COACH_PROMPTS_PER_DAY = 2; // Legacy helper compatibility; no longer grants post-trial access.
export const COACH_TRIAL_DAYS = 30;
const TRIAL_MS = COACH_TRIAL_DAYS * 24 * 60 * 60 * 1000;

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

export function trialStatusFromCreationTime(creationTime, nowMs = Date.now()) {
  const createdMs = typeof creationTime === "string" ? Date.parse(creationTime) : Number(creationTime);
  if (!Number.isFinite(createdMs)) {
    return { active: false, daysLeft: 0, startedAt: null, endsAt: null };
  }
  const endsMs = createdMs + TRIAL_MS;
  const active = nowMs < endsMs;
  return {
    active,
    daysLeft: active ? Math.max(1, Math.ceil((endsMs - nowMs) / 86400000)) : 0,
    startedAt: new Date(createdMs).toISOString(),
    endsAt: new Date(endsMs).toISOString(),
  };
}

export function isUnlimitedCoachEntitlement({
  isPro = false,
  appTrialActive = false,
  testPilotActive = false,
  adminActive = false,
} = {}) {
  return Boolean(isPro || appTrialActive || testPilotActive || adminActive);
}

function isServerPilot(uid) {
  if (!uid) return false;
  const pilots = String(process.env.PROYOU_TEST_PILOT_UIDS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return pilots.includes(uid);
}

/**
 * Authoritative Coach access rules:
 * - authenticated Firebase account required
 * - first 30 days from Firebase account creation are unlimited
 * - active RevenueCat Pro is unlimited after trial
 * - server-configured pilot UIDs are unlimited
 * - admin email is permanently unlimited
 *
 * Client-sent `isPro`, `appTrialActive`, and `testPilotActive` are deliberately ignored.
 */
export async function assertCoachEntitlement(req, body) {
  const idToken = extractIdToken(req, body);
  const auth = idToken ? await verifyFirebaseIdTokenDetails(idToken) : null;
  if (!auth?.uid) {
    return { ok: false, code: "AUTH_REQUIRED", status: 401 };
  }

  const uid = auth.uid;
  const subject = subjectKey(req, body, uid);
  const account = await getFirebaseUserAccountDetails(uid);
  const email = account?.email || auth.email || null;
  const adminActive = isAdminEmailServer(email);
  const testPilotActive = isServerPilot(uid);

  if (adminActive || testPilotActive) {
    return {
      ok: true,
      uid,
      subject,
      isPro: adminActive || testPilotActive,
      appTrialActive: false,
      testPilotActive,
      adminActive,
      accessSource: adminActive ? "admin" : "pilot",
      coachQuota: null,
    };
  }

  if (!account?.creationTime) {
    return { ok: false, code: "ACCOUNT_LOOKUP_UNAVAILABLE", status: 503, uid, subject };
  }

  const trial = trialStatusFromCreationTime(account.creationTime);
  if (trial.active) {
    return {
      ok: true,
      uid,
      subject,
      isPro: false,
      appTrialActive: true,
      testPilotActive: false,
      adminActive: false,
      accessSource: "trial",
      trial,
      coachQuota: null,
    };
  }

  const revenueCat = await verifyRevenueCatPro(uid);
  if (!revenueCat.verified) {
    return {
      ok: false,
      code: "SUBSCRIPTION_CHECK_UNAVAILABLE",
      status: 503,
      uid,
      subject,
      trial,
    };
  }

  if (revenueCat.isPro) {
    return {
      ok: true,
      uid,
      subject,
      isPro: true,
      appTrialActive: false,
      testPilotActive: false,
      adminActive: false,
      accessSource: "subscription",
      trial,
      coachQuota: null,
    };
  }

  return {
    ok: false,
    code: "SUBSCRIPTION_REQUIRED",
    status: 402,
    uid,
    subject,
    trial,
  };
}

// Legacy quota helpers remain exported while client quota-display code is retired.
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

export function buildCoachQuotaPayload(entitlement, usedOverride = null) {
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
    limit: FREE_COACH_PROMPTS_PER_DAY,
    remaining: Math.max(0, FREE_COACH_PROMPTS_PER_DAY - used),
    dayKey: entitlement.quotaDay || undefined,
  };
}

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
