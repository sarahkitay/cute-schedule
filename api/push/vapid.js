import { getVapidPublicKey } from "../lib/vapidEnv.js";

// Expose public VAPID key for frontend subscription (no auth needed)
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({
      error: "Push not configured",
      hint: "Set VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY) in Vercel",
    });
  }
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).json({ publicKey: key });
}
