import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const { subscription } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }

  try {
    const id = `sub:${Buffer.from(subscription.endpoint).toString("base64").replace(/=/g, "")}`;
    await kv.set(id, subscription);
    await kv.sadd("push:subs", id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Subscribe error", e);
    return res.status(500).json({ error: "Failed to store subscription" });
  }
}
