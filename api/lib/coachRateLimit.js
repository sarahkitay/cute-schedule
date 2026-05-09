import { kv } from "./redisClient.js";

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_SEC = 60;

/** Best-effort client id from Vercel / proxies (first hop in X-Forwarded-For). */
export function getCoachRateLimitClientId(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0].trim();
    if (first) return `ip:${first.slice(0, 64)}`;
  }
  const xr = req.headers["x-real-ip"];
  if (typeof xr === "string" && xr.trim()) return `ip:${xr.trim().slice(0, 64)}`;
  return "ip:unknown";
}

/**
 * Fixed-window counter in Redis. If Redis is unreachable, allows the request (dev / misconfig).
 * @returns {Promise<{ ok: true } | { ok: false; retryAfterSec: number }>}
 */
export async function assertCoachRateLimit(req) {
  const max = Math.max(1, Number.parseInt(process.env.COACH_RATE_LIMIT_MAX || String(DEFAULT_MAX), 10) || DEFAULT_MAX);
  const windowSec = Math.max(
    10,
    Number.parseInt(process.env.COACH_RATE_LIMIT_WINDOW_SEC || String(DEFAULT_WINDOW_SEC), 10) || DEFAULT_WINDOW_SEC
  );
  const id = getCoachRateLimitClientId(req);
  const windowId = Math.floor(Date.now() / (windowSec * 1000));
  const key = `coach:rl:${id}:${windowId}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, windowSec * 2);
    }
    if (count > max) {
      const windowMs = windowSec * 1000;
      const elapsed = Date.now() % windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("coach rate limit: Redis unavailable, allowing request:", e?.message || e);
    }
    return { ok: true };
  }
}
