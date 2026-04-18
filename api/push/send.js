import webpush from "web-push";
import { kv } from "@vercel/kv";
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from "../lib/vapidEnv.js";

const vapidPub = getVapidPublicKey();
const vapidPriv = getVapidPrivateKey();
if (vapidPub && vapidPriv) {
  webpush.setVapidDetails(getVapidSubject(), vapidPub, vapidPriv);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (!vapidPub || !vapidPriv) {
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
    const msg = String(e?.message || e);
    const hint = /KV|kv|Redis|REDIS|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)
      ? "Link Vercel KV to this project (same as for /api/push/subscribe)."
      : msg.slice(0, 200);
    return res.status(500).json({ error: "Failed to send", hint });
  }
}
