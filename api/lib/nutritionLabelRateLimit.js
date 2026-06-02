import { kv } from "./redisClient.js";
import { getCoachRateLimitClientId } from "./coachRateLimit.js";

const DEFAULT_MAX = 8;
const DEFAULT_WINDOW_SEC = 60;
const MAX_IMAGE_BASE64_LEN = 6_000_000;
const MAX_TEXT_LEN = 12_000;

/**
 * @returns {Promise<{ ok: true } | { ok: false; retryAfterSec: number }>}
 */
export async function assertNutritionLabelRateLimit(req) {
  const max = Math.max(
    1,
    Number.parseInt(process.env.NUTRITION_LABEL_RATE_LIMIT_MAX || String(DEFAULT_MAX), 10) || DEFAULT_MAX
  );
  const windowSec = Math.max(
    10,
    Number.parseInt(
      process.env.NUTRITION_LABEL_RATE_LIMIT_WINDOW_SEC || String(DEFAULT_WINDOW_SEC),
      10
    ) || DEFAULT_WINDOW_SEC
  );
  const id = getCoachRateLimitClientId(req);
  const windowId = Math.floor(Date.now() / (windowSec * 1000));
  const key = `nutrition:rl:${id}:${windowId}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSec * 2);
    if (count > max) {
      const windowMs = windowSec * 1000;
      const elapsed = Date.now() % windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * @param {{ text?: string, imageBase64?: string }} body
 * @returns {string | null} error message if invalid
 */
export function validateNutritionLabelPayload(body) {
  const text = typeof body?.text === "string" ? body.text : "";
  const image = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  if (text.length > MAX_TEXT_LEN) {
    return "OCR text is too long.";
  }
  if (image.length > MAX_IMAGE_BASE64_LEN) {
    return "Image is too large. Try a closer photo or lower resolution.";
  }
  return null;
}
