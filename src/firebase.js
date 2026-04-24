import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { getAppOrigin } from "./apiBase.js";
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
  signInWithCredential,
  deleteUser,
} from "firebase/auth";

const DEVICE_ID_KEY = "cute_schedule_device_id_v1";
/** Before `signInWithRedirect` (non-anonymous), prior uid for schedule migration after return. */
const OAUTH_REDIRECT_PREV_UID_KEY = "cute_schedule_oauth_redirect_prev_uid_v1";
/** Set immediately before Apple OAuth redirect; `getRedirectResult` runs only when this is set (avoids `auth/argument-error` on normal loads). */
const PENDING_OAUTH_REDIRECT_KEY = "cute_schedule_pending_oauth_redirect_v1";

/** Only if both localStorage and sessionStorage throw (extremely rare). */
let lastResortDeviceId = null;

function getFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  const firebaseConfig = {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cute-schedule.vercel.app",
    projectId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  };

  return firebaseConfig;
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
  // "name" is only sent on first Apple consent; omit in Capacitor WKWebView where it occasionally triggers `auth/argument-error`.
  if (!isCapacitorNativeShell()) {
    provider.addScope("name");
  }
  return provider;
}

/** Capacitor / WKWebView — `window.Capacitor` is injected by the native shell at runtime. */
function isCapacitorNativeShell() {
  if (typeof window === "undefined") return false;
  try {
    const c = window.Capacitor;
    return Boolean(c && typeof c.isNativePlatform === "function" && c.isNativePlatform());
  } catch {
    return false;
  }
}

/** Web Apple sign-in should use Firebase’s OAuth provider flow (not native iOS token exchange). */
function preferAppleWebRedirect() {
  // Capacitor Android: try popup (redirect relied on deprecated Firebase Dynamic Links for Cordova-style flows).
  if (isCapacitorNativeShell() && Capacitor.getPlatform() === "android") return false;
  // Capacitor iOS uses native Sign in with Apple + signInWithCredential (see signInWithApple); this branch is unused on iOS.
  if (isCapacitorNativeShell()) return true;
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Safari / WebKit on iOS often blocks or mishandles popups; redirect matches Firebase’s web guidance.
  const isSafariFamily = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(ua);
  return isIOS && isSafariFamily;
}

/** Avoid overlapping `getRedirectResult` (e.g. React StrictMode). */
let oauthRedirectGetResultInFlight = false;

function isBenignRedirectResultError(e) {
  const code = String(e?.code || "");
  if (code === "auth/argument-error" || code === "auth/no-auth-event") return true;
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("argument-error") || msg.includes("no-auth-event");
}

/**
 * Call on web app load after `initFirebase` so `signInWithRedirect` / `linkWithRedirect` can finish.
 * Only calls `getRedirectResult` if we previously set `PENDING_OAUTH_REDIRECT_KEY` (avoids `auth/argument-error` on every load).
 */
export function completeAuthRedirectIfNeeded() {
  const a = getAuthApp();
  if (!a) return Promise.resolve({ user: null, error: null });

  let awaitingRedirect = false;
  try {
    awaitingRedirect = sessionStorage.getItem(PENDING_OAUTH_REDIRECT_KEY) === "1";
  } catch {
    awaitingRedirect = false;
  }
  if (!awaitingRedirect) {
    return Promise.resolve({ user: null, error: null });
  }
  if (oauthRedirectGetResultInFlight) {
    return Promise.resolve({ user: null, error: null });
  }
  oauthRedirectGetResultInFlight = true;

  return (async () => {
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
      if (isBenignRedirectResultError(e)) {
        return { user: null, error: null };
      }
      try {
        sessionStorage.removeItem(OAUTH_REDIRECT_PREV_UID_KEY);
      } catch {
        /* ignore */
      }
      return { user: null, error: e };
    } finally {
      oauthRedirectGetResultInFlight = false;
      try {
        sessionStorage.removeItem(PENDING_OAUTH_REDIRECT_KEY);
      } catch {
        /* ignore */
      }
    }
  })();
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

function randomRawNonce(length = 28) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

/**
 * Capacitor iOS: Firebase JS `signInWithRedirect` for OAuth depended on Firebase Dynamic Links (sunset Aug 2025)
 * and commonly throws `auth/argument-error`. Use native Apple + `signInWithCredential` instead.
 * @param {import("firebase/auth").Auth} auth
 * @param {ReturnType<typeof getFirebaseConfig>} cfg
 */
async function signInWithAppleNativeIOS(auth, cfg) {
  const clientId = String(
    import.meta.env.VITE_APPLE_IOS_CLIENT_ID || import.meta.env.VITE_APPLE_SERVICE_ID || ""
  ).trim();
  if (!clientId) {
    throw new Error(
      "Set VITE_APPLE_IOS_CLIENT_ID (recommended: your iOS bundle id, e.g. app.proyou.proyou) or VITE_APPLE_SERVICE_ID in .env for native Sign in with Apple."
    );
  }
  const redirectURI = String(
    import.meta.env.VITE_APPLE_REDIRECT_URI || `https://${cfg.authDomain}/__/auth/handler`
  ).trim();

  // Native ASAuthorizationAppleIDRequest sets `nonce` as-is; Apple SHA256-hashes it for the ID token.
  // Firebase `rawNonce` must be that same string (do not pre-hash — unlike the plugin’s web/AppleID JS path).
  const rawNonce = randomRawNonce(32);

  const res = await SignInWithApple.authorize({
    clientId,
    redirectURI,
    scopes: "email name",
    state: `fp_${Date.now()}`,
    nonce: rawNonce,
  });

  const idToken = res?.response?.identityToken;
  if (!idToken) throw new Error("Apple Sign In did not return an identity token.");

  const appleProvider = new OAuthProvider("apple.com");
  const credential = appleProvider.credential({
    idToken,
    rawNonce,
  });

  const u = auth.currentUser;
  if (u?.isAnonymous) {
    try {
      await linkWithCredential(u, credential);
    } catch (e) {
      const alt =
        (typeof OAuthProvider.credentialFromError === "function" && OAuthProvider.credentialFromError(e)) ||
        e?.credential;
      if (e?.code === "auth/credential-already-in-use" && alt) {
        await signInWithCredential(auth, alt);
      } else {
        throw e;
      }
    }
    return auth.currentUser;
  }
  const prevUid = u?.uid ?? null;
  await signInWithCredential(auth, credential);
  const next = auth.currentUser;
  if (prevUid && next && prevUid !== next.uid) {
    await migrateScheduleDocBetweenUsers(prevUid, next.uid);
  }
  return next;
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
 * Sign in with Apple: web uses Firebase `OAuthProvider("apple.com")` + popup/redirect.
 * Capacitor iOS uses native Sign in with Apple + `signInWithCredential` (Firebase web redirect broke when Dynamic Links shut down).
 */
export async function signInWithApple() {
  const a = getAuthApp();
  if (!a) throw new Error("Firebase not configured");
  const cfg = getFirebaseConfig();
  if (!cfg?.authDomain || !String(cfg.authDomain).trim().includes(".")) {
    throw new Error(
      "Firebase authDomain is missing or invalid. Set VITE_FIREBASE_AUTH_DOMAIN (e.g. your-project.firebaseapp.com)."
    );
  }
  if (isCapacitorNativeShell() && Capacitor.getPlatform() === "ios") {
    return signInWithAppleNativeIOS(a, cfg);
  }
  if (isCapacitorNativeShell() && Capacitor.getPlatform() !== "ios") {
    const origin = getAppOrigin();
    if (!origin || !/^https:\/\//i.test(String(origin).trim())) {
      throw new Error(
        "Capacitor needs VITE_APP_ORIGIN=https://your-live-site.com in the build (same host as Firebase authorized domains) for Sign in with Apple to return correctly."
      );
    }
  }
  const appleProvider = getAppleAuthProvider();
  const u = a.currentUser;

  const signInWithAppleRedirect = async () => {
    try {
      sessionStorage.setItem(PENDING_OAUTH_REDIRECT_KEY, "1");
    } catch {
      /* if sessionStorage fails, getRedirectResult may still work; continue */
    }
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
