import { Redis } from "@upstash/redis";

/**
 * Upstash-compatible REST Redis.
 * Supports `UPSTASH_REDIS_REST_*` (current Vercel / Upstash) and legacy `KV_REST_API_*` (Vercel KV).
 * @see https://upstash.com/docs/redis/sdks/ts/overview
 */

let _redis = /** @type {Redis | undefined} */ (undefined);

/**
 * Non-secret flags for debugging which env vars exist in a deployment.
 * @returns {{ hasUpstashUrl: boolean, hasUpstashToken: boolean, hasKvUrl: boolean, hasKvToken: boolean }}
 */
export function getRedisEnvDebug() {
  return {
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    hasKvUrl: Boolean(process.env.KV_REST_API_URL),
    hasKvToken: Boolean(process.env.KV_REST_API_TOKEN),
  };
}

function resolveRedisRestCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    const missing = [];
    if (!url) {
      missing.push(
        "REST URL missing (checked UPSTASH_REDIS_REST_URL, then KV_REST_API_URL - values are not logged)"
      );
    }
    if (!token) {
      missing.push(
        "REST token missing (checked UPSTASH_REDIS_REST_TOKEN, then KV_REST_API_TOKEN - values are not logged)"
      );
    }
    throw new Error(`Redis not configured: ${missing.join(" ")}`);
  }
  return { url, token };
}

export function getRedis() {
  if (_redis) return _redis;
  const { url, token } = resolveRedisRestCredentials();
  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Small surface matching former `@vercel/kv` usage in this repo (set/get/del/sadd/smembers/srem/incr/expire).
 */
export const kv = {
  /** @param {string} key @param {unknown} value */
  async set(key, value) {
    return getRedis().set(key, value);
  },
  /** @param {string} key */
  async get(key) {
    return getRedis().get(key);
  },
  /** @param {string} key */
  async del(key) {
    return getRedis().del(key);
  },
  /** @param {string} setKey @param {string} member */
  async sadd(setKey, member) {
    return getRedis().sadd(setKey, member);
  },
  /** @param {string} setKey */
  async smembers(setKey) {
    const out = await getRedis().smembers(setKey);
    return Array.isArray(out) ? out : [];
  },
  /** @param {string} setKey @param {string} member */
  async srem(setKey, member) {
    return getRedis().srem(setKey, member);
  },
  /** @param {string} key */
  async incr(key) {
    return getRedis().incr(key);
  },
  /** @param {string} key @param {number} seconds */
  async expire(key, seconds) {
    return getRedis().expire(key, seconds);
  },
};
