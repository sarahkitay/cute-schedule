/**
 * VAPID keys for Web Push (server-side only).
 * Supports VAPID_PUBLIC_KEY (correct) and NEXT_PUBLIC_VAPID_PUBLIC_KEY if that name was set on Vercel by mistake.
 * Never expose VAPID_PRIVATE_KEY to the client.
 */
export function getVapidPublicKey() {
  return (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    ""
  ).trim();
}

export function getVapidPrivateKey() {
  return (process.env.VAPID_PRIVATE_KEY || "").trim();
}

export function getVapidSubject() {
  const s = process.env.VAPID_SUBJECT;
  return s && String(s).trim() ? String(s).trim() : "mailto:hello@proyou.app";
}
