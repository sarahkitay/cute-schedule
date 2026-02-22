import webpush from "web-push";
import { kv } from "@vercel/kv";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:hello@proyou.app",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: "Push not configured" });
  }

  const { title = "PROYOU", body = "Test notification", url = "/" } = req.body || {};

  try {
    const subIds = await kv.smembers("push:subs");
    const payload = JSON.stringify({ title, body, url });
    let sent = 0;

    for (const id of subIds) {
      const sub = await kv.get(id);
      if (!sub) continue;
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e) {
        await kv.del(id);
        await kv.srem("push:subs", id);
      }
    }
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error("Send error", e);
    return res.status(500).json({ error: "Failed to send" });
  }
}
