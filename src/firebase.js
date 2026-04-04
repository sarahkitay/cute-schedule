import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  signOut,
  signInAnonymously,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
} from "firebase/auth";

const DEVICE_ID_KEY = "cute_schedule_device_id_v1";

/** Only if both localStorage and sessionStorage throw (extremely rare). */
let lastResortDeviceId = null;

function getFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || undefined,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
  };
}

let app = null;
let db = null;
let auth = null;

const FIRESTORE_COLLECTION = "schedules";

export function initFirebase() {
  if (app) return { app, db, auth };
  const config = getFirebaseConfig();
  if (!config) return { app: null, db: null, auth: null };
  try {
    app = initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    return { app, db, auth };
  } catch (err) {
    console.warn("Firebase init failed:", err);
    return { app: null, db: null, auth: null };
  }
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

/** Firebase Auth instance (null if Firebase not configured). */
export function getAuthApp() {
  if (!auth) initFirebase();
  return auth;
}

export function isFirebaseEnabled() {
  return Boolean(getFirebaseConfig());
}

/**
 * Firestore document id for the full schedule payload.
 * Prefer signed-in (or anonymous) Firebase uid so rules can scope per user.
 */
export function getScheduleDocId() {
  const a = getAuthApp();
  if (a?.currentUser?.uid) return a.currentUser.uid;
  return getDeviceId();
}

/**
 * Stable device id (legacy doc key before auth). Used only for one-time migration.
 */
export function getDeviceId() {
  const makeId = () =>
    "dev_" +
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
      : Math.random().toString(36).slice(2, 14)) +
    "_" +
    Date.now().toString(36);

  try {
    let id = localStorage.getItem(DEVICE_ID_KEY) || sessionStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = makeId();
    }
    try {
      localStorage.setItem(DEVICE_ID_KEY, id);
    } catch (_) {}
    try {
      sessionStorage.setItem(DEVICE_ID_KEY, id);
    } catch (_) {}
    return id;
  } catch {
    try {
      let id = sessionStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = makeId();
        sessionStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch {
      if (!lastResortDeviceId) lastResortDeviceId = makeId();
      return lastResortDeviceId;
    }
  }
}

/** Copy schedules/{legacyDeviceId} → schedules/{userUid} if the user doc is empty. */
export async function migrateLegacyDeviceScheduleIfNeeded(userUid) {
  const firebaseDb = getDb();
  if (!firebaseDb || !userUid) return;
  const legacyId = getDeviceId();
  if (legacyId === userUid) return;
  const legacyRef = doc(firebaseDb, FIRESTORE_COLLECTION, legacyId);
  const userRef = doc(firebaseDb, FIRESTORE_COLLECTION, userUid);
  try {
    const [legacySnap, userSnap] = await Promise.all([getDoc(legacyRef), getDoc(userRef)]);
    if (!legacySnap.exists() || userSnap.exists()) return;
    await setDoc(userRef, legacySnap.data());
  } catch (e) {
    console.warn("Legacy schedule migration skipped:", e?.code ?? e);
  }
}

/** When auth uid changes (e.g. email sign-in replaced anonymous), copy data if the new account has no doc yet. */
export async function migrateScheduleDocBetweenUsers(fromUid, toUid) {
  const firebaseDb = getDb();
  if (!firebaseDb || !fromUid || !toUid || fromUid === toUid) return;
  const fromRef = doc(firebaseDb, FIRESTORE_COLLECTION, fromUid);
  const toRef = doc(firebaseDb, FIRESTORE_COLLECTION, toUid);
  try {
    const [fromSnap, toSnap] = await Promise.all([getDoc(fromRef), getDoc(toRef)]);
    if (!fromSnap.exists() || toSnap.exists()) return;
    await setDoc(toRef, fromSnap.data());
  } catch (e) {
    console.warn("Schedule migration between users skipped:", e?.code ?? e);
  }
}

const googleProvider = new GoogleAuthProvider();

export async function ensureSignedIn() {
  const a = getAuthApp();
  if (!a) return null;
  if (a.currentUser) return a.currentUser;
  try {
    const { user } = await signInAnonymously(a);
    return user;
  } catch (e) {
    console.warn("Anonymous sign-in failed (enable Anonymous in Firebase Auth → Sign-in method):", e?.code ?? e);
    return null;
  }
}

/**
 * Subscribe to auth; ensures anonymous sign-in when there is no user (so Firestore rules can use uid).
 * @param {(user: import("firebase/auth").User | null) => void} onResolved
 */
export function subscribeAuthState(onResolved) {
  const a = getAuthApp();
  if (!a) {
    onResolved(null);
    return () => {};
  }
  return onAuthStateChanged(a, async (user) => {
    if (!user) {
      try {
        await signInAnonymously(a);
      } catch {
        onResolved(null);
      }
      return;
    }
    onResolved(user);
  });
}

export async function signInWithGoogle() {
  const a = getAuthApp();
  if (!a) throw new Error("Firebase not configured");
  const u = a.currentUser;
  if (u?.isAnonymous) {
    await linkWithPopup(u, googleProvider);
    return a.currentUser;
  }
  const prevUid = u?.uid ?? null;
  await signInWithPopup(a, googleProvider);
  const next = a.currentUser;
  if (prevUid && next && prevUid !== next.uid) {
    await migrateScheduleDocBetweenUsers(prevUid, next.uid);
  }
  return next;
}

export async function signUpWithEmail(email, password) {
  const a = getAuthApp();
  if (!a) throw new Error("Firebase not configured");
  const u = a.currentUser;
  if (u?.isAnonymous) {
    const cred = EmailAuthProvider.credential(email.trim(), password);
    try {
      await linkWithCredential(u, cred);
      return a.currentUser;
    } catch (e) {
      if (e?.code !== "auth/email-already-in-use") throw e;
      const prevUid = u.uid;
      await signInWithEmailAndPassword(a, email.trim(), password);
      const next = a.currentUser;
      if (prevUid && next && prevUid !== next.uid) {
        await migrateScheduleDocBetweenUsers(prevUid, next.uid);
      }
      return next;
    }
  }
  await createUserWithEmailAndPassword(a, email.trim(), password);
  return a.currentUser;
}

export async function signInWithEmail(email, password) {
  const a = getAuthApp();
  if (!a) throw new Error("Firebase not configured");
  const prevUid = a.currentUser?.isAnonymous ? a.currentUser.uid : null;
  await signInWithEmailAndPassword(a, email.trim(), password);
  const next = a.currentUser;
  if (prevUid && next && prevUid !== next.uid) {
    await migrateScheduleDocBetweenUsers(prevUid, next.uid);
  }
  return next;
}

export async function authSignOut() {
  const a = getAuthApp();
  if (!a) return;
  await signOut(a);
  await ensureSignedIn();
}
