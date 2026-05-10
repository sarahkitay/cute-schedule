import admin from "firebase-admin";

/**
 * Firebase Admin (same pattern as Firebase docs):
 *
 *   const admin = require("firebase-admin");
 *   const serviceAccount = require("./path/to/serviceAccountKey.json");
 *   admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
 *
 * Here `serviceAccount` comes from `FIREBASE_SERVICE_ACCOUNT_JSON` (stringified JSON on Vercel),
 * not from `require("path/to/...")`, so credentials are never committed to the repo.
 */
export function getFirebaseAdmin() {
  if (globalThis.__proyouFirebaseAdmin) return globalThis.__proyouFirebaseAdmin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    console.error("Firebase Admin: could not parse FIREBASE_SERVICE_ACCOUNT_JSON:", e?.message || e);
    return null;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    globalThis.__proyouFirebaseAdmin = admin;
    return admin;
  } catch (e) {
    console.error("Firebase Admin initializeApp failed:", e?.message || e);
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
