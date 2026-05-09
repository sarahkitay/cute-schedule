import admin from "firebase-admin";

/**
 * Firebase Admin for server-side ID token verification (native push registration / reminders).
 * Set FIREBASE_SERVICE_ACCOUNT_JSON on Vercel to a stringified service account JSON object.
 */
export function getFirebaseAdmin() {
  if (globalThis.__proyouFirebaseAdmin) return globalThis.__proyouFirebaseAdmin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== "string") {
    return null;
  }
  try {
    const cred = JSON.parse(raw);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(cred) });
    }
    globalThis.__proyouFirebaseAdmin = admin;
    return admin;
  } catch (e) {
    console.error("Firebase Admin init failed:", e?.message || e);
    return null;
  }
}

/** @param {string | undefined} idToken */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  const adm = getFirebaseAdmin();
  if (!adm) return null;
  try {
    const decoded = await adm.auth().verifyIdToken(idToken.trim());
    return typeof decoded.uid === "string" ? decoded.uid : null;
  } catch {
    return null;
  }
}
