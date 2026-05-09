// Cron: schedule in vercel.json. Sends stored reminders when due. Web: VAPID + web-push; iOS native: APNs.
import webpush from "web-push";
import { kv } from "../lib/redisClient.js";
import { getWebSubscriptionFromStored, getNativeTokenFromStored } from "../lib/pushTarget.js";
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from "../lib/vapidEnv.js";
import { sendIosApnsNotification, isApnsConfigured } from "../lib/nativeApns.js";

const vapidPub = getVapidPublicKey();
const vapidPriv = getVapidPrivateKey();
if (vapidPub && vapidPriv) {
  webpush.setVapidDetails(getVapidSubject(), vapidPub, vapidPriv);
}

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).end();
  }

  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (cronSecret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!vapidPub && !vapidPriv && !isApnsConfigured()) {
    return res.status(200).json({ ok: true, sent: 0, reason: "push not configured" });
  }

  const now = Date.now();
  let sent = 0;

  try {
    // --- Web Push (VAPID) ---
    if (vapidPub && vapidPriv) {
      const subIds = await kv.smembers("push:subs");
      for (const id of subIds) {
        const raw = await kv.get(id);
        const sub = getWebSubscriptionFromStored(raw);
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
    }

    // --- Native iOS (APNs HTTP/2 token auth) ---
    if (isApnsConfigured()) {
      const uids = await kv.smembers("push:native-user-uids");
      for (const uid of uids) {
        const raw = await kv.get(`native:user:${uid}`);
        const native = getNativeTokenFromStored(raw);
        if (!native || native.kind !== "ios") continue;

        const reminders = (await kv.get(`reminders:native:user:${uid}`)) || [];
        const due = reminders.filter((r) => new Date(r.at).getTime() <= now);
        const remaining = reminders.filter((r) => new Date(r.at).getTime() > now);

        for (const r of due) {
          const rslt = await sendIosApnsNotification({
            deviceToken: native.token,
            title: r.title,
            body: r.body || "",
            payload: { tag: r.tag || "reminder", url: "/" },
          });
          if (rslt.ok) sent++;
          else console.warn("APNs send failed:", rslt.reason);
        }

        if (due.length > 0) await kv.set(`reminders:native:user:${uid}`, remaining);
      }

      const anonIds = await kv.smembers("push:native-subs");
      for (const id of anonIds) {
        const raw = await kv.get(id);
        const native = getNativeTokenFromStored(raw);
        if (!native || native.kind !== "ios") continue;

        const reminders = (await kv.get(`reminders:${id}`)) || [];
        const due = reminders.filter((r) => new Date(r.at).getTime() <= now);
        const remaining = reminders.filter((r) => new Date(r.at).getTime() > now);

        for (const r of due) {
          const rslt = await sendIosApnsNotification({
            deviceToken: native.token,
            title: r.title,
            body: r.body || "",
            payload: { tag: r.tag || "reminder", url: "/" },
          });
          if (rslt.ok) sent++;
          else console.warn("APNs send failed:", rslt.reason);
        }

        if (due.length > 0) await kv.set(`reminders:${id}`, remaining);
      }
    }

    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error("Cron push error", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
