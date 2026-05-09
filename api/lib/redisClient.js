import { Redis } from "@upstash/redis";

/**
 * Upstash Redis (Vercel Storage → Redis / Upstash integration).
 * Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (e.g. `vercel env pull`).
 * @see https://upstash.com/docs/redis/sdks/ts/overview
 */

let _redis = /** @type {Redis | false | undefined} */ (undefined);

export function getRedis() {
  if (_redis === false) return null;
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    _redis = false;
    return null;
  }
  try {
    _redis = Redis.fromEnv();
    return _redis;
  } catch (e) {
    console.error("Redis.fromEnv() failed:", e?.message || e);
    _redis = false;
    return null;
  }
}

/**
 * Small surface matching former `@vercel/kv` usage in this repo (set/get/del/sadd/smembers/srem/incr/expire).
 */
export const kv = {
  /** @param {string} key @param {unknown} value */
  async set(key, value) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    return r.set(key, value);
  },
  /** @param {string} key */
  async get(key) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    return r.get(key);
  },
  /** @param {string} key */
  async del(key) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    return r.del(key);
  },
  /** @param {string} setKey @param {string} member */
  async sadd(setKey, member) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    return r.sadd(setKey, member);
  },
  /** @param {string} setKey */
  async smembers(setKey) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    const out = await r.smembers(setKey);
    return Array.isArray(out) ? out : [];
  },
  /** @param {string} setKey @param {string} member */
  async srem(setKey, member) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    return r.srem(setKey, member);
  },
  /** @param {string} key */
  async incr(key) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    return r.incr(key);
  },
  /** @param {string} key @param {number} seconds */
  async expire(key, seconds) {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");
    return r.expire(key, seconds);
  },
};
