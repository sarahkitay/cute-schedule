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
  const details = await verifyFirebaseIdTokenDetails(idToken);
  return details?.uid ?? null;
}

/** @param {string | undefined} idToken */
export async function verifyFirebaseIdTokenDetails(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  const adm = getFirebaseAdmin();
  if (!adm) return null;
  try {
    const decoded = await adm.auth().verifyIdToken(idToken.trim());
    const uid = typeof decoded.uid === "string" ? decoded.uid : null;
    if (!uid) return null;
    const email = typeof decoded.email === "string" ? decoded.email : null;
    return { uid, email };
  } catch {
    return null;
  }
}

/**
 * Server-trusted account metadata used for trial calculations.
 * Firebase Auth account creation is the authoritative start for the 30-day app trial.
 * @param {string | null | undefined} uid
 * @returns {Promise<{ uid: string, email: string | null, creationTime: string | null } | null>}
 */
export async function getFirebaseUserAccountDetails(uid) {
  if (!uid || typeof uid !== "string") return null;
  const adm = getFirebaseAdmin();
  if (!adm) return null;
  try {
    const user = await adm.auth().getUser(uid);
    return {
      uid: user.uid,
      email: typeof user.email === "string" ? user.email : null,
      creationTime: typeof user.metadata?.creationTime === "string" ? user.metadata.creationTime : null,
    };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Firebase Admin getUser failed:", e?.message || e);
    }
    return null;
  }
}
