// Notification Service: Capacitor native push (FCM via @capacitor-firebase/messaging) + PWA Web Push (VAPID + service worker).

import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { apiUrl, publicUrl, getApiBaseDebug, NATIVE_FALLBACK_API_ORIGIN } from "./apiBase";
import { isValidFcmRegistrationToken, normalizeFcmRegistrationToken } from "../api/lib/fcmRegistrationToken.js";
import { registerIosLocalTaskNotifDebugReporter } from "./nativeTaskLocalNotifications.js";

export { resyncIosTaskLocalNotifications } from "./nativeTaskLocalNotifications.js";

/** @type {Set<(s: Record<string, unknown>) => void>} */
const nativeDebugSubscribers = new Set();

export const nativePushDebugDefault = () => ({
  permission: "unknown",
  nativePlatform: Capacitor.isNativePlatform(),
  /** Native push stack: FCM (Capacitor Firebase Messaging). */
  nativeProvider: null,
  tokenRegistered: false,
  fcmTokenRegistered: false,
  lastTokenPrefix: null,
  lastRegistrationError: null,
  /** Exact URL last used for POST /api/push/register-native */
  lastRegisterNativeUrl: null,
  /** HTTP status from last register-native fetch (null if threw before response) */
  lastRegisterNativeStatus: null,
  /** Truncated register-native response (longer on success so deviceKey JSON stays parseable). */
  lastRegisterNativeResponseText: null,
  /** Anon iOS `deviceKey` from last successful register-native (`native:ios:…`); used for send-test + survives truncation of response text. */
  lastRegisterNativeDeviceKey: null,
  lastRemindersNativeUrl: null,
  lastRemindersNativeStatus: null,
  lastRemindersNativeResponseText: null,
  lastTestSendUrl: null,
  /** Redacted JSON string of the last real send-test POST body (no raw token). */
  lastTestSendRequestBodyRedacted: null,
  /** Non-secret: what the last send-test JSON body contained (keys, lengths). */
  lastTestSendDiag: null,
  lastTestSendStatus: null,
  lastTestSendResponseText: null,
  lastTestSendMessageId: null,
  lastTestSendErrorName: null,
  lastTestSendErrorMessage: null,
  lastTestSendErrorStack: null,
  lastTestSendErrorCause: null,
  lastPushReceivedAt: null,
  lastActionAt: null,
  lastTestSendAt: null,
  lastTestSendOk: null,
  lastTestSendDetail: null,
  lastFcmMessageId: null,
  /** From apiBase: baked VITE_APP_ORIGIN at build time + resolved origin used for /api/* */
  apiOriginFromEnv: null,
  apiOriginResolved: null,
  apiOriginSource: null,
  /** @capacitor/local-notifications (iOS task reminders) */
  localNotificationPermission: null,
  scheduledLocalReminderCount: null,
  lastLocalScheduleError: null,
});

/** @type {ReturnType<typeof nativePushDebugDefault>} */
let nativePushDebug = nativePushDebugDefault();

function emitNativeDebug() {
  if (Capacitor.isNativePlatform()) {
    const api = getApiBaseDebug();
    nativePushDebug.apiOriginFromEnv = api.rawViteAppOrigin;
    nativePushDebug.apiOriginResolved = api.resolvedOrigin;
    nativePushDebug.apiOriginSource = api.source;
  }
  const snap = { ...nativePushDebug };
  nativeDebugSubscribers.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      /* ignore */
    }
  });
}

/** Subscribe to native push debug updates (Capacitor only; no-op on web). */
export function subscribeNativePushDebug(fn) {
  if (typeof fn !== "function") return () => {};
  nativeDebugSubscribers.add(fn);
  emitNativeDebug();
  return () => nativeDebugSubscribers.delete(fn);
}

export function getNativePushDebugSnapshot() {
  return { ...nativePushDebug };
}

function mapCapacitorReceive(receive) {
  if (receive === "granted") return "granted";
  if (receive === "denied") return "denied";
  if (receive === "prompt") return "prompt";
  return "unknown";
}

function mapReceiveToNotificationPermission(receive) {
  if (receive === "granted") return "granted";
  if (receive === "denied") return "denied";
  return "default";
}

function shortenTokenForLog(token) {
  const t = String(token || "");
  if (t.length <= 12) return t ? `${t.slice(0, 4)}…` : "";
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

async function getOptionalFirebaseIdToken() {
  try {
    const { getAuthApp } = await import("./firebase.js");
    const u = getAuthApp()?.currentUser;
    if (!u) return null;
    return await u.getIdToken();
  } catch {
    return null;
  }
}

const NATIVE_DEVICE_KEY_LS = "proyou_native_push_device_key";

let lastNativeDeviceToken = null;
/** Anon iOS registration id from register-native (`native:ios:…`); persisted for test send after cold start. */
let lastNativeDeviceKey = null;
let nativeListenersAttached = false;

/** Clears in-memory + localStorage native push registration so a new `register()` cannot reuse stale deviceKey / long tokens. */
function clearNativePushRegistrationForFreshRegister() {
  lastNativeDeviceToken = null;
  lastNativeDeviceKey = null;
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(NATIVE_DEVICE_KEY_LS);
  } catch {
    /* ignore */
  }
  nativePushDebug.lastRegisterNativeDeviceKey = null;
  nativePushDebug.lastRegisterNativeResponseText = null;
  nativePushDebug.lastRegisterNativeStatus = null;
  nativePushDebug.lastRegisterNativeUrl = null;
  nativePushDebug.tokenRegistered = false;
  nativePushDebug.fcmTokenRegistered = false;
  nativePushDebug.nativeProvider = null;
  nativePushDebug.lastTokenPrefix = null;
  nativePushDebug.lastFcmMessageId = null;
  nativePushDebug.lastTestSendMessageId = null;
  nativePushDebug.localNotificationPermission = null;
  nativePushDebug.scheduledLocalReminderCount = null;
  nativePushDebug.lastLocalScheduleError = null;
  emitNativeDebug();
}

function hydrateNativeDeviceKeyFromStorage() {
  try {
    if (typeof localStorage === "undefined") return;
    const k = localStorage.getItem(NATIVE_DEVICE_KEY_LS);
    const ks = String(k).trim();
    if (ks && (/^native:ios:/.test(ks) || /^native:user:/.test(ks))) {
      lastNativeDeviceKey = ks;
      nativePushDebug.lastRegisterNativeDeviceKey = lastNativeDeviceKey;
    }
  } catch {
    /* ignore */
  }
}

/** Recover anon `deviceKey` from the last register-native JSON we kept in debug (memory can desync after navigation). */
function syncLastNativeDeviceKeyFromRegisterResponseCache() {
  hydrateNativeDeviceKeyFromStorage();
  const raw = nativePushDebug.lastRegisterNativeResponseText;
  if (!raw || typeof raw !== "string") return;
  try {
    const j = JSON.parse(raw);
    if (typeof j.deviceKey === "string") {
      const dk = j.deviceKey.trim();
      if (/^native:ios:/.test(dk) || /^native:user:/.test(dk)) {
        lastNativeDeviceKey = dk;
        nativePushDebug.lastRegisterNativeDeviceKey = lastNativeDeviceKey;
        try {
          localStorage.setItem(NATIVE_DEVICE_KEY_LS, lastNativeDeviceKey);
        } catch {
          /* ignore */
        }
        emitNativeDebug();
      }
    }
  } catch {
    /* ignore */
  }
}

/** Production native builds sometimes resolve API to https://localhost; real push must hit the deployed host. */
function rewriteNativePushSendUrlIfLocalhost(url) {
  if (!url || typeof url !== "string" || !Capacitor.isNativePlatform() || !import.meta.env.PROD) return url;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host.endsWith(".localhost")) {
      return `${NATIVE_FALLBACK_API_ORIGIN}/api/push/send`;
    }
  } catch {
    /* ignore */
  }
  return url;
}

/** Same API host as last successful register-native when possible (avoids WKWebView failures if api origin drifts from probe). */
function resolveNativePushApiSendUrl() {
  const reg = nativePushDebug.lastRegisterNativeUrl;
  if (typeof reg === "string" && reg.includes("/api/push/register-native")) {
    try {
      const u = new URL(reg);
      u.pathname = "/api/push/send";
      return rewriteNativePushSendUrlIfLocalhost(u.toString());
    } catch {
      /* ignore */
    }
  }
  return rewriteNativePushSendUrlIfLocalhost(apiUrl("/api/push/send"));
}

function buildNativeTestSendRequestBody() {
  const dkRaw =
    (lastNativeDeviceKey && String(lastNativeDeviceKey).trim()) ||
    (nativePushDebug.lastRegisterNativeDeviceKey && String(nativePushDebug.lastRegisterNativeDeviceKey).trim()) ||
    "";
  const deviceKey =
    /^native:ios:/.test(dkRaw) || /^native:user:/.test(dkRaw) ? dkRaw : "";
  const payload = {
    nativeIos: true,
    title: "PROYOU",
    body: "If you see this, native push is working.",
    url: "/",
  };
  if (deviceKey) payload.deviceKey = deviceKey;

  const redacted = { ...payload };
  if (redacted.deviceKey) {
    redacted.deviceKey = `${String(redacted.deviceKey).slice(0, 44)}…`;
  }
  return { payload, redactedJson: JSON.stringify(redacted) };
}

function waitForNativeToken(maxMs = 6000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const t = lastNativeDeviceToken;
      if (!t) {
        if (Date.now() - start >= maxMs) return resolve(false);
        setTimeout(tick, 120);
        return;
      }
      const ok = Capacitor.getPlatform() === "ios" ? isValidFcmRegistrationToken(t) : t.length >= 16;
      if (ok) return resolve(true);
      if (Date.now() - start >= maxMs) return resolve(false);
      setTimeout(tick, 120);
    };
    tick();
  });
}

async function postRegisterNative(token, platform) {
  const url = apiUrl("/api/push/register-native");
  nativePushDebug.lastRegisterNativeUrl = url;
  nativePushDebug.lastRegisterNativeStatus = null;
  nativePushDebug.lastRegisterNativeResponseText = null;
  emitNativeDebug();

  const idToken = await getOptionalFirebaseIdToken();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        token,
        platform,
        ...(platform === "ios" ? { pushProvider: "fcm" } : {}),
        ...(idToken ? { idToken } : {}),
      }),
    });
  } catch (e) {
    const msg = e?.message || String(e);
    nativePushDebug.lastRegisterNativeStatus = null;
    nativePushDebug.lastRegisterNativeResponseText = null;
    nativePushDebug.lastRegistrationError = msg;
    emitNativeDebug();
    console.error("[Native push] register-native fetch threw:", msg, "url=", url);
    return { ok: false, status: null, text: "" };
  }

  const text = await res.text();
  nativePushDebug.lastRegisterNativeStatus = res.status;

  if (res.ok) {
    nativePushDebug.lastRegistrationError = null;
    try {
      const j = JSON.parse(text);
      if (typeof j.deviceKey === "string") {
        const dk = j.deviceKey.trim();
        if (/^native:ios:/.test(dk) || /^native:user:/.test(dk)) {
          lastNativeDeviceKey = dk;
          nativePushDebug.lastRegisterNativeDeviceKey = dk;
          try {
            localStorage.setItem(NATIVE_DEVICE_KEY_LS, dk);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
    nativePushDebug.lastRegisterNativeResponseText = text.length > 1800 ? `${text.slice(0, 1800)}…` : text;
    emitNativeDebug();
    if (import.meta.env.DEV) console.log("[Native push] register-native OK", res.status, "url=", url);
  } else {
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text);
      errMsg = j.error || j.hint || errMsg;
    } catch {
      if (text) errMsg = text.slice(0, 200);
    }
    nativePushDebug.lastRegistrationError = errMsg;
    nativePushDebug.lastRegisterNativeResponseText = text.slice(0, 800);
    emitNativeDebug();
    console.warn("[Native push] register-native failed:", res.status, text.slice(0, 300), "url=", url);
  }

  return { ok: res.ok, status: res.status, text };
}

/**
 * Persist FCM registration token from {@link FirebaseMessaging} and POST register-native.
 * @param {unknown} rawToken
 */
async function persistNativeFcmTokenFromRaw(rawToken) {
  const platform = Capacitor.getPlatform();
  const raw = typeof rawToken === "string" ? rawToken.trim() : "";

  lastNativeDeviceToken = null;
  nativePushDebug.tokenRegistered = false;
  nativePushDebug.fcmTokenRegistered = false;
  nativePushDebug.lastTokenPrefix = null;
  nativePushDebug.lastRegistrationError = null;
  emitNativeDebug();

  if (platform === "ios") {
    if (!isValidFcmRegistrationToken(raw)) {
      const msg = raw
        ? `Invalid FCM registration token from FirebaseMessaging (expected 32–4096 chars after trim; got ${raw.length}).`
        : "Missing FCM registration token (FirebaseMessaging.getToken returned empty).";
      nativePushDebug.lastRegistrationError = msg;
      emitNativeDebug();
      console.warn("[Native push]", msg);
      return;
    }
    lastNativeDeviceToken = normalizeFcmRegistrationToken(raw);
  } else {
    if (raw.length < 16) {
      nativePushDebug.lastRegistrationError = "FCM registration value too short";
      emitNativeDebug();
      return;
    }
    lastNativeDeviceToken = raw;
  }

  nativePushDebug.nativeProvider = "fcm";
  nativePushDebug.tokenRegistered = true;
  nativePushDebug.fcmTokenRegistered = true;
  nativePushDebug.lastTokenPrefix = lastNativeDeviceToken ? shortenTokenForLog(lastNativeDeviceToken) : null;
  nativePushDebug.lastRegistrationError = null;
  emitNativeDebug();

  await postRegisterNative(lastNativeDeviceToken, platform);
}

/**
 * Attach FirebaseMessaging listeners once (safe to call multiple times).
 */
async function attachNativePushListenersOnce() {
  if (!Capacitor.isNativePlatform() || nativeListenersAttached) return;
  nativeListenersAttached = true;

  await FirebaseMessaging.addListener("tokenReceived", async (event) => {
    const t = typeof event?.token === "string" ? event.token : "";
    await persistNativeFcmTokenFromRaw(t);
  });

  await FirebaseMessaging.addListener("notificationReceived", (event) => {
    nativePushDebug.lastPushReceivedAt = Date.now();
    if (import.meta.env.DEV) {
      console.log("[Native push] FCM received:", event?.notification?.title || "", event?.notification?.body || "");
    }
    emitNativeDebug();
  });

  await FirebaseMessaging.addListener("notificationActionPerformed", (action) => {
    nativePushDebug.lastActionAt = Date.now();
    if (import.meta.env.DEV) {
      console.log("[Native push] FCM action:", action?.actionId, action?.notification?.title);
    }
    emitNativeDebug();
  });
}

/**
 * On native startup: attach listeners and refresh FCM token if permission already granted (no extra prompt).
 */
export async function bootstrapNativePushOnStartup() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  registerIosLocalTaskNotifDebugReporter((partial) => {
    nativePushDebug = { ...nativePushDebug, ...partial };
    emitNativeDebug();
  });
  hydrateNativeDeviceKeyFromStorage();
  await attachNativePushListenersOnce();
  try {
    const perm = await FirebaseMessaging.checkPermissions();
    nativePushDebug.permission = mapCapacitorReceive(perm.receive);
    emitNativeDebug();
    if (perm.receive === "granted") {
      const { token } = await FirebaseMessaging.getToken();
      await persistNativeFcmTokenFromRaw(token);
      await waitForNativeToken(4000);
    }
  } catch (e) {
    nativePushDebug.lastRegistrationError = e?.message || String(e);
    emitNativeDebug();
  }
}

/** Refresh FCM + (on iOS) local notification permission and pending task-reminder count without rescheduling. */
export async function refreshNativeNotificationDiagnostics() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  try {
    const fcmPerm = await FirebaseMessaging.checkPermissions();
    nativePushDebug.permission = mapCapacitorReceive(fcmPerm.receive);
  } catch {
    /* ignore */
  }
  if (Capacitor.getPlatform() === "ios") {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.checkPermissions();
      const display = perm?.display ?? perm?.receive ?? "unknown";
      nativePushDebug.localNotificationPermission = String(display);
      const pending = await LocalNotifications.getPending();
      const existing = Array.isArray(pending?.notifications) ? pending.notifications : [];
      nativePushDebug.scheduledLocalReminderCount = existing.filter((n) => n?.extra?.proyouSource === "task_reminder").length;
    } catch (e) {
      nativePushDebug.localNotificationPermission = "error";
      nativePushDebug.lastLocalScheduleError = e?.message || String(e);
    }
  }
  emitNativeDebug();
}

/** Open the system screen where the user can enable alerts for this app (iOS: PROYOU settings). */
export async function openNativeAppSystemSettings() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    return { ok: false, hint: "Open the PROYOU app on your phone to change notification settings." };
  }
  try {
    const appId = "app.proyou.proyou";
    if (Capacitor.getPlatform() === "ios") {
      window.location.assign("app-settings:");
      return { ok: true };
    }
    if (Capacitor.getPlatform() === "android") {
      window.location.assign(
        `intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:${appId};end`
      );
      return { ok: true };
    }
    return { ok: false, hint: "Open notification settings from the device system menu." };
  } catch (e) {
    return { ok: false, hint: e?.message || String(e) };
  }
}

/**
 * Request permission + FCM token; POST registration to backend.
 */
export async function registerNativePushFull() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    return { ok: false, skipped: true };
  }
  try {
    await attachNativePushListenersOnce();
    const perm = await FirebaseMessaging.requestPermissions();
    nativePushDebug.permission = mapCapacitorReceive(perm.receive);
    emitNativeDebug();
    if (perm.receive !== "granted") {
      return { ok: false, hint: "Push permission not granted", receive: perm.receive };
    }
    clearNativePushRegistrationForFreshRegister();
    const { token } = await FirebaseMessaging.getToken();
    await persistNativeFcmTokenFromRaw(token);
    const got = await waitForNativeToken();
    if (!got) {
      return {
        ok: false,
        hint: "FCM did not return a registration token yet. Reopen the app, confirm GoogleService-Info.plist + Push capability, and upload your APNs key in Firebase Console → Cloud Messaging.",
      };
    }
    return { ok: true, native: true };
  } catch (e) {
    const msg = e?.message || String(e);
    nativePushDebug.lastRegistrationError = msg;
    emitNativeDebug();
    return { ok: false, hint: msg };
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

class NotificationService {
  constructor() {
    this.permission = null;
    this._checkPromise = null;
  }

  _lazyCheck() {
    if (this._checkPromise == null) this._checkPromise = this.checkPermission();
    return this._checkPromise;
  }

  async registerServiceWorker() {
    if (Capacitor.isNativePlatform()) return null;
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.register(publicUrl("sw.js"), { scope: import.meta.env.BASE_URL || "./" });
    await navigator.serviceWorker.ready;
    return registration;
  }

  async enablePush() {
    if (Capacitor.isNativePlatform()) {
      const r = await registerNativePushFull();
      if (r.skipped) return { ok: false, hint: "Not running in native shell." };
      if (!r.ok) return { ok: false, hint: r.hint || "Native push registration failed." };
      this.permission = "granted";
      return { ok: true, native: true };
    }

    if (!("serviceWorker" in navigator)) {
      return { ok: false, hint: "This browser does not support service workers (use HTTPS and a recent browser)." };
    }
    if (!("PushManager" in window)) {
      return {
        ok: false,
        hint: "Push is not available here. On iPhone, add the app to the Home Screen first, then open it from the icon and try again.",
      };
    }
    try {
      const registration = await this.registerServiceWorker();
      if (!registration) {
        return { ok: false, hint: "Could not register the service worker. Check that /sw.js loads (deploy includes public/sw.js)." };
      }

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      this.permission = permission;
      if (permission !== "granted") {
        return { ok: false, hint: "Notification permission was not granted. Allow notifications for this site in browser or system settings." };
      }

      const res = await fetch(apiUrl("/api/push/vapid"));
      const json = await res.json().catch(() => ({}));
      const publicKey = json.publicKey;
      if (!publicKey) {
        console.warn("Push: no public key from server");
        return {
          ok: false,
          hint:
            json.hint ||
            "Server is not configured for background push. Check your deployment environment for push keys and storage.",
        };
      }

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        try {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        } catch (subErr) {
          console.warn("pushManager.subscribe failed", subErr);
          return {
            ok: false,
            hint:
              subErr?.message ||
              "Subscribe failed. Confirm the server push key pair is valid and not swapped.",
          };
        }
      }

      const subscriptionPayload = typeof sub.toJSON === "function" ? sub.toJSON() : sub;

      const saveRes = await fetch(apiUrl("/api/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscriptionPayload }),
      });
      const saveRaw = await saveRes.text();
      let saveJson = {};
      try {
        saveJson = saveRaw ? JSON.parse(saveRaw) : {};
      } catch {
        saveJson = {};
      }
      if (!saveRes.ok) {
        console.warn("Push: subscribe API error", saveRes.status, saveJson, saveRaw);
        return {
          ok: false,
          hint:
            saveJson.hint ||
            saveJson.detail ||
            saveJson.error ||
            (saveRes.status === 500
              ? "Server could not save your subscription. Add Upstash Redis to the Vercel project (UPSTASH_REDIS_* env vars)."
              : `Server returned ${saveRes.status}`),
        };
      }

      this.permission = "granted";
      return { ok: true, native: false };
    } catch (e) {
      console.warn("Push subscribe failed", e);
      return { ok: false, hint: e?.message || String(e) };
    }
  }

  async checkPermission() {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await FirebaseMessaging.checkPermissions();
        nativePushDebug.permission = mapCapacitorReceive(perm.receive);
        this.permission = mapReceiveToNotificationPermission(perm.receive);
        emitNativeDebug();
        return perm.receive === "granted";
      } catch {
        this.permission = "denied";
        return false;
      }
    }
    if (!("Notification" in window)) {
      this.permission = "denied";
      return false;
    }
    const p = Notification.permission;
    this.permission = p;
    return p === "granted";
  }

  async requestPermission() {
    if (Capacitor.isNativePlatform()) {
      await attachNativePushListenersOnce();
      const perm = await FirebaseMessaging.requestPermissions();
      nativePushDebug.permission = mapCapacitorReceive(perm.receive);
      this.permission = mapReceiveToNotificationPermission(perm.receive);
      emitNativeDebug();
      if (perm.receive === "granted") {
        const { token } = await FirebaseMessaging.getToken();
        await persistNativeFcmTokenFromRaw(token);
        await waitForNativeToken(4000);
      }
      return perm.receive === "granted";
    }
    if (!("Notification" in window)) {
      return false;
    }
    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission === "granted";
  }

  showNotification(title, options = {}) {
    /** iOS/Android native: WebView `Notification` is unreliable; use local/FCM for product nudges. */
    if (Capacitor.isNativePlatform() && options.preferWebNotificationOnNative !== true) {
      return null;
    }
    if (!("Notification" in window) || this.permission !== "granted") {
      return null;
    }

    const defaultOptions = {
      icon: publicUrl("pwa-192.png"),
      badge: publicUrl("pwa-192.png"),
      tag: `task-${Date.now()}`,
      requireInteraction: false,
      ...options,
    };

    try {
      return new Notification(title, defaultOptions);
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }

  scheduleTaskReminder(task, hour, category) {
    if (Capacitor.isNativePlatform()) {
      return null;
    }
    try {
      const now = new Date();
      const [hours, minutes] = hour.split(":").map(Number);
      const reminderTime = new Date(now);
      reminderTime.setHours(hours, minutes, 0, 0);

      if (reminderTime < now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }

      const delay = reminderTime.getTime() - now.getTime();

      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          const currentHour = new Date().getHours();
          let reminderText;
          if (currentHour >= 5 && currentHour < 12) {
            reminderText = "When you're ready, here's what you planned.";
          } else if (currentHour >= 17 && currentHour < 22) {
            reminderText = "Anything you want to wrap up, or are we closing the day?";
          } else if (currentHour >= 22) {
            reminderText = "You don't need to finish anything tonight.";
          } else {
            reminderText = "Quick check-in. Do you want to keep going or slow it down?";
          }

          this.showNotification(reminderText, {
            body: `${task.text} (${category})`,
            tag: `reminder-${task.id}`,
            requireInteraction: false,
          });
        }, delay);

        return reminderTime;
      }
    } catch (error) {
      console.error("Error scheduling reminder:", error);
    }
    return null;
  }

  notifyTaskComplete(task, _category) {
    this.showNotification("Done.", {
      body: `${task.text}`,
      tag: `complete-${task.id}`,
      requireInteraction: false,
    });
  }

  scheduleTaskTransition(currentTask, nextTask, hour, _category) {
    try {
      const now = new Date();
      const [hours, minutes] = hour.split(":").map(Number);
      const taskTime = new Date(now);
      taskTime.setHours(hours, minutes, 0, 0);

      if (taskTime < now) {
        return null;
      }

      const wrapUpTime = new Date(taskTime.getTime() - 10 * 60 * 1000);
      const wrapUpDelay = wrapUpTime.getTime() - now.getTime();

      if (wrapUpDelay > 0 && wrapUpDelay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          let wrapUpMessage = "Time to wrap up.";
          let wrapUpBody = currentTask ? `Finishing up: ${currentTask.text}` : "Wrapping up current task";

          if (nextTask) {
            wrapUpBody += `\nNext: ${nextTask.text} at ${hour}`;
          }

          this.showNotification(wrapUpMessage, {
            body: wrapUpBody,
            tag: `wrapup-${currentTask?.id || Date.now()}`,
            requireInteraction: false,
          });
        }, wrapUpDelay);
      }

      const nextTaskDelay = taskTime.getTime() - now.getTime();
      if (nextTaskDelay > 0 && nextTaskDelay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          this.showNotification("Next task starting", {
            body: `${nextTask.text}${_category ? ` (${_category})` : ""}`,
            tag: `next-${nextTask.id}`,
            requireInteraction: false,
          });
        }, nextTaskDelay);
      }

      return { wrapUpTime, taskTime };
    } catch (error) {
      console.error("Error scheduling task transition:", error);
      return null;
    }
  }

  async getWebPushSubscription() {
    if (Capacitor.isNativePlatform()) return null;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return null;
      return typeof sub.toJSON === "function" ? sub.toJSON() : null;
    } catch {
      return null;
    }
  }

  async syncRemindersToServer(reminders) {
    if (!Array.isArray(reminders) || reminders.length === 0) return false;

    if (Capacitor.isNativePlatform()) {
      const token = lastNativeDeviceToken;
      if (!token) return false;
      const url = apiUrl("/api/push/reminders-native");
      nativePushDebug.lastRemindersNativeUrl = url;
      nativePushDebug.lastRemindersNativeStatus = null;
      nativePushDebug.lastRemindersNativeResponseText = null;
      emitNativeDebug();
      try {
        const idToken = await getOptionalFirebaseIdToken();
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            token,
            platform: Capacitor.getPlatform(),
            ...(Capacitor.getPlatform() === "ios" ? { pushProvider: "fcm" } : {}),
            reminders,
            ...(idToken ? { idToken } : {}),
          }),
        });
        const text = await res.text();
        nativePushDebug.lastRemindersNativeStatus = res.status;
        nativePushDebug.lastRemindersNativeResponseText = text.slice(0, 400);
        emitNativeDebug();
        if (!res.ok) console.warn("[Native push] reminders-native", res.status, text.slice(0, 200), url);
        return res.ok;
      } catch (e) {
        nativePushDebug.lastRemindersNativeResponseText = e?.message || String(e);
        emitNativeDebug();
        console.warn("Sync native reminders failed", e, url);
        return false;
      }
    }

    if (!("serviceWorker" in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;
      const res = await fetch(apiUrl("/api/push/reminders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, reminders }),
      });
      return res.ok;
    } catch (e) {
      console.warn("Sync reminders failed", e);
      return false;
    }
  }

  /**
   * Native iOS: POST /api/push/send with `deviceKey` from register-native (server loads FCM token from Redis).
   * Updates {@link nativePushDebug} (redacted body, HTTP status, response text, fetch error fields).
   */
  async sendNativeTestPush() {
    if (!Capacitor.isNativePlatform()) return { ok: false, hint: "Not native" };
    syncLastNativeDeviceKeyFromRegisterResponseCache();
    const dk =
      (lastNativeDeviceKey && String(lastNativeDeviceKey).trim()) ||
      (nativePushDebug.lastRegisterNativeDeviceKey && String(nativePushDebug.lastRegisterNativeDeviceKey).trim()) ||
      "";
    const keyOk = /^native:ios:/.test(dk) || /^native:user:/.test(dk);
    if (!keyOk) {
      nativePushDebug.lastTestSendDiag = { error: "no_devicekey_before_send" };
      emitNativeDebug();
      return {
        ok: false,
        hint:
          "No deviceKey yet. Enable native push so register-native returns native:ios:… or native:user:…, then try Send test push (raw FCM token is not sent to /api/push/send).",
      };
    }

    nativePushDebug.lastTestSendAt = Date.now();
    nativePushDebug.lastTestSendOk = null;
    nativePushDebug.lastTestSendDetail = null;
    nativePushDebug.lastTestSendUrl = null;
    nativePushDebug.lastTestSendRequestBodyRedacted = null;
    nativePushDebug.lastTestSendDiag = null;
    nativePushDebug.lastTestSendStatus = null;
    nativePushDebug.lastTestSendResponseText = null;
    nativePushDebug.lastTestSendMessageId = null;
    nativePushDebug.lastTestSendErrorName = null;
    nativePushDebug.lastTestSendErrorMessage = null;
    nativePushDebug.lastTestSendErrorStack = null;
    nativePushDebug.lastTestSendErrorCause = null;
    emitNativeDebug();

    const { payload, redactedJson } = buildNativeTestSendRequestBody();
    if (!payload.deviceKey) {
      nativePushDebug.lastTestSendDiag = {
        error: "missing_deviceKey_in_payload",
        keys: Object.keys(payload),
        deviceKeyCached: Boolean(lastNativeDeviceKey || nativePushDebug.lastRegisterNativeDeviceKey),
      };
      nativePushDebug.lastTestSendOk = false;
      nativePushDebug.lastTestSendDetail = "Send body had no deviceKey (would not call server).";
      emitNativeDebug();
      return {
        ok: false,
        hint: "Could not build send body: missing deviceKey. Register native push again after this update.",
        ...nativePushDebug.lastTestSendDiag,
      };
    }

    const jsonBody = JSON.stringify(payload);
    nativePushDebug.lastTestSendRequestBodyRedacted = redactedJson;
    nativePushDebug.lastTestSendDiag = {
      nativeIos: Boolean(payload.nativeIos),
      hasToken: false,
      hasDeviceKey: Boolean(payload.deviceKey),
      deviceKeyLength: typeof payload.deviceKey === "string" ? payload.deviceKey.length : 0,
      debugStoredDeviceKey: Boolean(nativePushDebug.lastRegisterNativeDeviceKey),
      jsonKeys: Object.keys(payload).sort().join(","),
    };
    const url = resolveNativePushApiSendUrl();
    nativePushDebug.lastTestSendUrl = url;
    emitNativeDebug();

    console.log("[Native push] send test POST", {
      url,
      diag: nativePushDebug.lastTestSendDiag,
      bodyRedacted: redactedJson,
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody,
        cache: "no-store",
      });
      const text = await res.text();
      nativePushDebug.lastTestSendStatus = res.status;
      nativePushDebug.lastTestSendResponseText = text.slice(0, 1600);
      let j = {};
      try {
        j = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        j = {};
        nativePushDebug.lastTestSendDetail = `Response was not JSON (${parseErr?.message || parseErr})`;
      }
      const sentN = Number(j.sent);
      const ok = res.ok && (sentN >= 1 || j.channel === "fcm" || j.channel === "apns");
      nativePushDebug.lastTestSendOk = ok;
      nativePushDebug.lastTestSendDetail = ok
        ? "sent"
        : j.error || j.detail || j.hint || nativePushDebug.lastTestSendDetail || `HTTP ${res.status}`;
      if (typeof j.messageId === "string" && j.messageId) {
        nativePushDebug.lastTestSendMessageId = j.messageId;
        nativePushDebug.lastFcmMessageId = j.messageId;
      }
      if (j.debug && typeof j.debug === "object") {
        if (j.debug.nativeProvider != null) nativePushDebug.nativeProvider = String(j.debug.nativeProvider);
        if (j.debug.fcmTokenRegistered === true) nativePushDebug.fcmTokenRegistered = true;
      }
      if (!ok && nativePushDebug.lastTestSendDiag && typeof nativePushDebug.lastTestSendDiag === "object") {
        const fromServer = {};
        if (j.code != null) fromServer.fcmCode = j.code;
        if (j.debug && typeof j.debug === "object") Object.assign(fromServer, j.debug);
        nativePushDebug.lastTestSendDiag = {
          ...nativePushDebug.lastTestSendDiag,
          ...fromServer,
          responseHttpStatus: res.status,
          serverError: j.error ?? null,
          serverHint: j.hint ?? null,
          serverDetail: j.detail ?? null,
        };
      }
      emitNativeDebug();
      console.log("[Native push] send test result", {
        url,
        httpStatus: res.status,
        requestBodyRedacted: redactedJson,
        responseBody: text.slice(0, 800),
        parsed: j,
        ok,
      });
      if (!ok) console.warn("[Native push] send test failed", res.status, text.slice(0, 500), url, j);
      return { ok, status: res.status, ...j };
    } catch (e) {
      const cause = e?.cause;
      const causeStr =
        cause != null
          ? typeof cause === "object" && cause !== null && "message" in cause
            ? String(cause.message)
            : String(cause)
          : "";
      nativePushDebug.lastTestSendOk = false;
      nativePushDebug.lastTestSendStatus = null;
      nativePushDebug.lastTestSendResponseText = null;
      nativePushDebug.lastTestSendErrorName = e?.name != null ? String(e.name) : "";
      nativePushDebug.lastTestSendErrorMessage = e?.message != null ? String(e.message) : String(e);
      nativePushDebug.lastTestSendErrorStack = typeof e?.stack === "string" ? e.stack.slice(0, 2000) : "";
      nativePushDebug.lastTestSendErrorCause = causeStr;
      nativePushDebug.lastTestSendDetail = nativePushDebug.lastTestSendErrorMessage;
      emitNativeDebug();
      console.error("[Native push] send test fetch threw:", {
        url,
        requestBodyRedacted: redactedJson,
        errorName: nativePushDebug.lastTestSendErrorName,
        errorMessage: nativePushDebug.lastTestSendErrorMessage,
        errorStack: nativePushDebug.lastTestSendErrorStack,
        errorCause: nativePushDebug.lastTestSendErrorCause,
        err: e,
      });
      return {
        ok: false,
        hint: nativePushDebug.lastTestSendErrorMessage,
        fetchError: true,
        errorName: nativePushDebug.lastTestSendErrorName,
        errorCause: nativePushDebug.lastTestSendErrorCause,
      };
    }
  }
}

const _notificationService = new NotificationService();
export const notificationService = {
  get permission() {
    return _notificationService.permission;
  },
  registerServiceWorker() {
    return _notificationService.registerServiceWorker();
  },
  enablePush() {
    return _notificationService.enablePush();
  },
  checkPermission() {
    return _notificationService._lazyCheck();
  },
  requestPermission() {
    return _notificationService.requestPermission();
  },
  showNotification(title, options) {
    return _notificationService.showNotification(title, options);
  },
  scheduleTaskReminder(task, hour, category) {
    return _notificationService.scheduleTaskReminder(task, hour, category);
  },
  notifyTaskComplete(task, category) {
    return _notificationService.notifyTaskComplete(task, category);
  },
  scheduleTaskTransition(currentTask, nextTask, hour, category) {
    return _notificationService.scheduleTaskTransition(currentTask, nextTask, hour, category);
  },
  syncRemindersToServer(reminders) {
    return _notificationService.syncRemindersToServer(reminders);
  },
  getWebPushSubscription() {
    return _notificationService.getWebPushSubscription();
  },
  sendNativeTestPush() {
    return _notificationService.sendNativeTestPush();
  },
  refreshNativeDiagnostics() {
    return refreshNativeNotificationDiagnostics();
  },
  openNativeNotificationSettings() {
    return openNativeAppSystemSettings();
  },
};

/** @deprecated Use bootstrapNativePushOnStartup */
export async function registerCapacitorPushIfNative() {
  return bootstrapNativePushOnStartup();
}
