import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

export function initFirebase() {
  if (app) return { app, db };
  const config = getFirebaseConfig();
  if (!config) return { app: null, db: null };
  try {
    app = initializeApp(config);
    db = getFirestore(app);
    return { app, db };
  } catch (err) {
    console.warn("Firebase init failed:", err);
    return { app: null, db: null };
  }
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

export function isFirebaseEnabled() {
  return Boolean(getFirebaseConfig());
}

/**
 * Stable id for Firestore doc `schedules/{id}`. Must survive reload.
 * If localStorage throws (ITP, blockers), we fall back to sessionStorage — NOT a new id every load
 * (the old `dev_anon_${Date.now()}` caused every refresh to write a different document).
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
