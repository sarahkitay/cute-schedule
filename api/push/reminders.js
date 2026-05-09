// POST: store reminders for a push subscription. Cron will send them when due (even when app is closed).
import { kv } from "@vercel/kv";
import { applyApiCors } from "../lib/cors.js";
import { normalizeReminderPayload } from "../lib/pushReminderNormalize.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  applyApiCors(req, res);
  res.setHeader("Content-Type", "application/json");

  const { subscription, reminders } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }
  const list = Array.isArray(reminders) ? reminders : [];
  const now = Date.now();
  const maxFuture = 48 * 60 * 60 * 1000; // 48 hours
  const normalized = normalizeReminderPayload(list, now, maxFuture);

  try {
    const id = `sub:${Buffer.from(subscription.endpoint).toString("base64").replace(/=/g, "")}`;
    await kv.set(`reminders:${id}`, normalized);
    return res.status(200).json({ ok: true, count: normalized.length });
  } catch (e) {
    console.error("Reminders save error", e);
    const msg = String(e?.message || e);
    const hint = /KV|kv|Redis|REDIS|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)
      ? "Link Vercel KV to this project."
      : msg.slice(0, 200);
    return res.status(500).json({ error: "Failed to store reminders", hint });
  }
}
