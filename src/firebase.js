import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  signOut,
  signInAnonymously,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
  deleteUser,
} from "firebase/auth";

const DEVICE_ID_KEY = "cute_schedule_device_id_v1";
/** Before `signInWithRedirect` (non-anonymous), prior uid for schedule migration after return. */
const OAUTH_REDIRECT_PREV_UID_KEY = "cute_schedule_oauth_redirect_prev_uid_v1";

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
    try {
      auth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch (e) {
      if (e?.code === "auth/already-initialized") {
        auth = getAuth(app);
      } else {
        throw e;
      }
    }
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

function getAppleAuthProvider() {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
}

/** Web Apple sign-in should use Firebase’s OAuth provider flow (not native iOS token exchange). */
function preferAppleWebRedirect() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Safari / WebKit on iOS often blocks or mishandles popups; redirect matches Firebase’s web guidance.
  const isSafariFamily = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(ua);
  return isIOS && isSafariFamily;
}

/**
 * Single-flight: React StrictMode (and fast re-mounts) can invoke this twice; a second
 * `getRedirectResult` often throws `auth/argument-error` because the pending redirect was already consumed.
 */
let completeRedirectPromise = null;

/**
 * Call on web app load after `initFirebase` so `signInWithRedirect` / `linkWithRedirect` can finish.
 * Resolves to `{ user, error }` — `error` only for real failures (e.g. account collision), not benign SDK noise.
 */
export function completeAuthRedirectIfNeeded() {
  const a = getAuthApp();
  if (!a) return Promise.resolve({ user: null, error: null });
  if (completeRedirectPromise) return completeRedirectPromise;
  completeRedirectPromise = (async () => {
    let prevUid = null;
    try {
      prevUid = sessionStorage.getItem(OAUTH_REDIRECT_PREV_UID_KEY) || null;
    } catch {
      prevUid = null;
    }
    try {
      const result = await getRedirectResult(a);
      if (!result?.user) {
        return { user: null, error: null };
      }
      if (prevUid && result.user.uid !== prevUid) {
        await migrateScheduleDocBetweenUsers(prevUid, result.user.uid);
      }
      await migrateLegacyDeviceScheduleIfNeeded(result.user.uid);
      try {
        sessionStorage.removeItem(OAUTH_REDIRECT_PREV_UID_KEY);
      } catch {
        /* ignore */
      }
      return { user: result.user, error: null };
    } catch (e) {
      const code = e?.code;
      // No pending redirect, or redirect already handled — not a user-facing Apple failure.
      if (code === "auth/argument-error" || code === "auth/no-auth-event") {
        return { user: null, error: null };
      }
      try {
        sessionStorage.removeItem(OAUTH_REDIRECT_PREV_UID_KEY);
      } catch {
        /* ignore */
      }
      return { user: null, error: e };
    }
  })();
  return completeRedirectPromise;
}

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
 * Subscribe to Firebase Auth state.
 * @param {(user: import("firebase/auth").User | null) => void} onResolved
 * @param {{ autoSignInAnonymous?: boolean }} [options] If true, signs in anonymously when signed out (legacy). Default false → show login UI first.
 */
export function subscribeAuthState(onResolved, options = {}) {
  const { autoSignInAnonymous = false } = options;
  const a = getAuthApp();
  if (!a) {
    onResolved(null);
    return () => {};
  }
  return onAuthStateChanged(a, async (user) => {
    if (!user) {
      if (autoSignInAnonymous) {
        try {
          await signInAnonymously(a);
        } catch {
          onResolved(null);
        }
        return;
      }
      onResolved(null);
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

/**
 * Sign in with Apple on web: Firebase `OAuthProvider("apple.com")` + popup or redirect (not native iOS ID token).
 * Enable Apple in Firebase Auth → Sign-in method. Uses redirect on iOS Safari; popup elsewhere, with redirect fallback if the popup is blocked.
 */
export async function signInWithApple() {
  const a = getAuthApp();
  if (!a) throw new Error("Firebase not configured");
  const appleProvider = getAppleAuthProvider();
  const u = a.currentUser;

  const signInWithAppleRedirect = async () => {
    if (u?.isAnonymous) {
      await linkWithRedirect(u, appleProvider);
      return null;
    }
    try {
      if (u?.uid) sessionStorage.setItem(OAUTH_REDIRECT_PREV_UID_KEY, u.uid);
    } catch {
      /* ignore */
    }
    await signInWithRedirect(a, appleProvider);
    return null;
  };

  const signInWithApplePopup = async () => {
    if (u?.isAnonymous) {
      await linkWithPopup(u, appleProvider);
      return a.currentUser;
    }
    const prevUid = u?.uid ?? null;
    await signInWithPopup(a, appleProvider);
    const next = a.currentUser;
    if (prevUid && next && prevUid !== next.uid) {
      await migrateScheduleDocBetweenUsers(prevUid, next.uid);
    }
    return next;
  };

  if (preferAppleWebRedirect()) {
    return signInWithAppleRedirect();
  }
  try {
    return await signInWithApplePopup();
  } catch (e) {
    if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") {
      return signInWithAppleRedirect();
    }
    throw e;
  }
}

/** Remove this user’s Firestore schedule doc (best-effort before Auth account deletion). */
export async function deleteFirestoreScheduleForUid(uid) {
  const firebaseDb = getDb();
  if (!firebaseDb || !uid) return;
  try {
    await deleteDoc(doc(firebaseDb, FIRESTORE_COLLECTION, uid));
  } catch (e) {
    console.warn("deleteFirestoreScheduleForUid:", e?.code ?? e);
  }
}

/**
 * Permanently delete the current Firebase Auth user (and their schedule doc).
 * May throw `auth/requires-recent-login` — user must sign in again then retry.
 */
export async function deleteCurrentUserAccount() {
  const a = getAuthApp();
  if (!a?.currentUser) throw new Error("Not signed in");
  const uid = a.currentUser.uid;
  await deleteFirestoreScheduleForUid(uid);
  await deleteUser(a.currentUser);
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

/** Sign out completely. App should show the login gate again (no automatic anonymous session). */
export async function authSignOut() {
  const a = getAuthApp();
  if (!a) return;
  await signOut(a);
}
