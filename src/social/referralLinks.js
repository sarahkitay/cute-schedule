import { Capacitor } from "@capacitor/core";
import { getAppOrigin, NATIVE_FALLBACK_API_ORIGIN } from "../apiBase.js";

const INVALID_ORIGIN = /^(capacitor|ionic|https?:\/\/localhost)(:|\/|$)/i;

/** Public web origin for invite links (never capacitor:// or https://localhost). */
export function getPublicWebOrigin() {
  const fromEnv = getAppOrigin();
  if (fromEnv && !INVALID_ORIGIN.test(fromEnv)) return fromEnv;
  if (typeof window !== "undefined" && !Capacitor.isNativePlatform()) {
    const origin = String(window.location.origin || "").replace(/\/+$/, "");
    if (origin && !INVALID_ORIGIN.test(origin)) return origin;
  }
  return NATIVE_FALLBACK_API_ORIGIN;
}

/** Public App Store page (fallback when VITE_APP_STORE_URL is unset at build time). */
export const PROYOU_APP_STORE_URL =
  "https://apps.apple.com/us/app/proyou/id6762338902";

/** App Store product page - prefer VITE_APP_STORE_URL from Vercel / .env.local at build time. */
export function getAppStoreUrl() {
  return String(import.meta.env.VITE_APP_STORE_URL || "").trim() || PROYOU_APP_STORE_URL;
}

/**
 * Web invite URL that captures ?ref= for signup attribution.
 * @param {string} referralCode
 */
export function buildReferralWebLink(referralCode) {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!code) return "";
  const base = getPublicWebOrigin();
  const path = import.meta.env.BASE_URL || "/";
  const prefix = path.endsWith("/") ? path.slice(0, -1) || "" : path;
  const url = new URL(`${prefix}/`, base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("ref", code);
  return url.toString();
}

/**
 * @param {string} referralCode
 * @returns {{ webLink: string, appStoreUrl: string, shareText: string, shareUrl: string }}
 */
export function buildReferralSharePayload(referralCode) {
  const code = String(referralCode || "").trim().toUpperCase();
  const appStoreUrl = getAppStoreUrl();
  const lines = [
    "Join me on ProYou - build routines together and stay accountable.",
    code ? `Invite code: ${code}` : "",
    appStoreUrl ? `Download on the App Store: ${appStoreUrl}` : "",
  ].filter(Boolean);
  const shareText = lines.join("\n");
  const shareUrl = appStoreUrl;
  return { webLink: "", appStoreUrl, shareText, shareUrl };
}
