// POST: store reminders for a push subscription. Cron will send them when due (even when app is closed).
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const { subscription, reminders } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }
  const list = Array.isArray(reminders) ? reminders : [];
  // Normalize: at (ISO), title, body, tag. Keep only future or near-past (cron runs every 5 min)
  const now = Date.now();
  const maxFuture = 48 * 60 * 60 * 1000; // 48 hours
  const normalized = list
    .filter((r) => r && r.at && r.title)
    .map((r) => ({
      at: r.at,
      title: String(r.title).slice(0, 200),
      body: r.body != null ? String(r.body).slice(0, 500) : "",
      tag: r.tag != null ? String(r.tag).slice(0, 100) : `rem-${now}-${Math.random().toString(36).slice(2)}`,
    }))
    .filter((r) => {
      const t = new Date(r.at).getTime();
      return t >= now - 5 * 60 * 1000 && t <= now + maxFuture; // allow 5 min in past (cron catch-up)
    });

  try {
    const id = `sub:${Buffer.from(subscription.endpoint).toString("base64").replace(/=/g, "")}`;
    await kv.set(`reminders:${id}`, normalized);
    return res.status(200).json({ ok: true, count: normalized.length });
  } catch (e) {
    console.error("Reminders save error", e);
    return res.status(500).json({ error: "Failed to store reminders" });
  }
}
