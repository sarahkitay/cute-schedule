import { kv } from "../lib/redisClient.js";
import { applyApiCors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  applyApiCors(req, res);
  res.setHeader("Content-Type", "application/json");

  const { subscription } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }

  try {
    const id = `sub:${Buffer.from(subscription.endpoint).toString("base64").replace(/=/g, "")}`;
    /** @type {import("../lib/pushTarget.d.ts").PushTarget} */
    const target = { type: "web", subscription, updatedAt: Date.now() };
    await kv.set(id, target);
    await kv.sadd("push:subs", id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Subscribe error", e);
    const msg = String(e?.message || e);
    const hint = /KV|kv|Redis|REDIS|Upstash|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)
      ? "Add Upstash Redis to this project (Vercel Dashboard → Storage → Redis, link to project, then `vercel env pull`). Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Push subscribe/reminders need Redis."
      : "Check this deployment’s function logs in Vercel for the full error.";
    return res.status(500).json({ error: "Failed to store subscription", hint, detail: msg.slice(0, 240) });
  }
}
