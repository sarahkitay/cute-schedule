// Cron: run every 5 min. When you have task sync (client POSTs upcoming to KV), read and send push.
// Dedupe: KV key sent:{subId}:{taskId}:{startISO} with TTL.
import webpush from "web-push";
import { kv } from "@vercel/kv";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:hello@proyou.app",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).end();
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(200).json({ ok: true, sent: 0, reason: "push not configured" });
  }

  try {
    const subIds = await kv.smembers("push:subs");
    let sent = 0;
    // Optional: read upcoming tasks from KV (e.g. key "upcoming:{userId}" set by client)
    // For now, no task sync → no scheduled push. Uncomment when you add client sync:
    // const upcoming = await kv.get("upcoming:default");
    for (const id of subIds) {
      const sub = await kv.get(id);
      if (!sub) continue;
      // Example: send a gentle nudge if you had tasks in window
      // const payload = JSON.stringify({ title: "PROYOU", body: "Time for your next task", url: "/" });
      // await webpush.sendNotification(sub, payload); sent++;
      try {
        // Placeholder: no push unless we have task data
      } catch (_) {}
    }
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error("Cron push error", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
