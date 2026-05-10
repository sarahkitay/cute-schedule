import { getFirebaseAdmin } from "./firebaseAdminApp.js";

/**
 * Send a display notification to one device via FCM (Firebase routes to APNs on iOS).
 * @param {{ deviceToken: string; title: string; body: string; data?: Record<string, unknown> }} p
 * @returns {Promise<{ ok: true; messageId: string } | { ok: false; reason: string; code?: string }>}
 */
export async function sendNativeFcmNotification(p) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return { ok: false, reason: "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON)", code: "admin_missing" };
  }

  const token = typeof p.deviceToken === "string" ? p.deviceToken.trim() : "";
  if (!token) return { ok: false, reason: "Missing FCM token", code: "missing_token" };

  /** @type {Record<string, string>} */
  const data = {};
  if (p.data && typeof p.data === "object") {
    for (const [k, v] of Object.entries(p.data)) {
      if (v == null) continue;
      data[String(k)] = typeof v === "string" ? v : JSON.stringify(v);
    }
  }

  try {
    const messageId = await admin.messaging().send({
      token,
      notification: {
        title: String(p.title ?? "PROYOU"),
        body: String(p.body ?? ""),
      },
      ...(Object.keys(data).length ? { data } : {}),
    });
    return { ok: true, messageId: typeof messageId === "string" ? messageId : String(messageId) };
  } catch (e) {
    const code = typeof e?.code === "string" ? e.code : undefined;
    return { ok: false, reason: e?.message || String(e), code };
  }
}

/** @returns {boolean} */
export function isFcmNativeSendConfigured() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return typeof raw === "string" && raw.trim().length > 20;
}
