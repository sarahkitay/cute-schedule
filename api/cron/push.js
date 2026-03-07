// Cron: run every 5 min. Send stored reminders when due (bills, subscriptions, task reminders) so they fire even when app is closed.
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

  const now = Date.now();

  try {
    const subIds = await kv.smembers("push:subs");
    let sent = 0;

    for (const id of subIds) {
      const sub = await kv.get(id);
      if (!sub) continue;

      const reminders = (await kv.get(`reminders:${id}`)) || [];
      const due = reminders.filter((r) => new Date(r.at).getTime() <= now);
      const remaining = reminders.filter((r) => new Date(r.at).getTime() > now);

      for (const r of due) {
        try {
          const payload = JSON.stringify({
            title: r.title,
            body: r.body || "",
            tag: r.tag || "reminder",
            url: "/",
          });
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await kv.del(id);
            await kv.srem("push:subs", id);
            await kv.del(`reminders:${id}`);
          }
        }
      }

      if (due.length > 0) await kv.set(`reminders:${id}`, remaining);
    }

    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error("Cron push error", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
