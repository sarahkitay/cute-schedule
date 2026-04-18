/** Trim trailing slash from origin. */
function trimSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

/**
 * Deployed site origin (e.g. https://your-app.vercel.app).
 * In Capacitor the UI is loaded from the app bundle, so relative `/api/*` has no host. Set
 * `VITE_APP_ORIGIN` in `.env` / Xcode build settings for release iOS builds.
 */
export function getAppOrigin() {
  return trimSlash(String(import.meta.env.VITE_APP_ORIGIN || "").trim());
}

/** Same-origin API path on web; absolute URL when `VITE_APP_ORIGIN` is set (native). */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = getAppOrigin();
  return origin ? `${origin}${p}` : p;
}

/** Vite base + path for `public/` files (service worker, icons) in web and Capacitor. */
export function publicUrl(path) {
  const clean = String(path || "").replace(/^\//, "");
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${clean}`;
}
