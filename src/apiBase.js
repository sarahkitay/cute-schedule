import { Capacitor } from "@capacitor/core";

/** Trim trailing slash from origin. */
function trimSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

/** Production API host for PROYOU when a native build shipped without VITE_APP_ORIGIN (Capacitor WKWebView cannot use relative /api/*). */
const NATIVE_FALLBACK_API_ORIGIN = "https://cute-schedule.vercel.app";

/**
 * Deployed site origin (e.g. https://your-app.vercel.app).
 * In Capacitor the UI loads from the app bundle; relative `/api/*` resolves to `https://localhost/...`, not Vercel.
 * Set `VITE_APP_ORIGIN` in `.env.local` before `vite build` / `cap sync` (same value the coach uses).
 */
export function getAppOrigin() {
  return trimSlash(String(import.meta.env.VITE_APP_ORIGIN || "").trim());
}

/**
 * Resolves the origin used for `apiUrl()` (coach, push, etc.).
 * @returns {{ origin: string; source: "env" | "native-fallback" | "relative" }}
 */
export function resolveApiOriginForRequest() {
  const fromEnv = getAppOrigin();
  if (fromEnv) {
    return { origin: fromEnv, source: "env" };
  }
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    console.warn(
      "[apiBase] VITE_APP_ORIGIN is empty — native API calls would hit localhost. Using fallback:",
      NATIVE_FALLBACK_API_ORIGIN,
      "Rebuild with VITE_APP_ORIGIN=https://cute-schedule.vercel.app in .env.local before `npm run build && npx cap sync ios`."
    );
    return { origin: NATIVE_FALLBACK_API_ORIGIN, source: "native-fallback" };
  }
  return { origin: "", source: "relative" };
}

/** For Settings / debug: what Vite baked in vs what we actually use. */
export function getApiBaseDebug() {
  const raw = String(import.meta.env.VITE_APP_ORIGIN ?? "").trim();
  const r = resolveApiOriginForRequest();
  return {
    rawViteAppOrigin: raw || "(empty at build time)",
    resolvedOrigin: r.origin || "(relative paths — web same-origin only)",
    source: r.source,
    nativePlatform: typeof window !== "undefined" && Capacitor.isNativePlatform(),
  };
}

/** Same-origin API path on web; absolute URL on Capacitor (env or native fallback). */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const { origin } = resolveApiOriginForRequest();
  return origin ? `${origin}${p}` : p;
}

/** Vite base + path for `public/` files (service worker, icons) in web and Capacitor. */
export function publicUrl(path) {
  const clean = String(path || "").replace(/^\//, "");
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${clean}`;
}
