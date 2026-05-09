/**
 * Capacitor iOS/Android WKWebView origins (not the same as your Vercel app URL).
 * If API_ALLOWED_ORIGINS is a strict allowlist, these must still get ACAO or fetch() fails with "Load failed".
 */
const CAPACITOR_WEBVIEW_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
]);

/**
 * Sets Access-Control-Allow-Origin for browser API calls.
 * If API_ALLOWED_ORIGINS is unset or "*", allows any origin (legacy; not recommended for production).
 * Otherwise comma-separated list of exact origins; reflects only if request Origin matches.
 * Capacitor app WebView origins are always reflected when present so native /api/* works.
 */
export function applyApiCors(req, res) {
  const raw = (process.env.API_ALLOWED_ORIGINS || "").trim();
  if (!raw || raw === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return;
  }
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && list.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    return;
  }
  if (origin && CAPACITOR_WEBVIEW_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
}
