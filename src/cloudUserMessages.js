/** User-facing cloud/auth copy - never mention Firebase, Firestore, or vendor SDKs. */
export const CLOUD_ACCOUNT_UNAVAILABLE =
  "Cloud account isn't available on this build.";
export const CLOUD_CONNECT_FAILED =
  "Couldn't connect to your cloud account. Try again.";

const VENDOR_RE =
  /\bfirebase\b|\bfirestore\b|firebaseapp|googleapis|GoogleService-Info|VITE_|authDomain|FCM|FirebaseMessaging|firebase deploy/i;

function isCloudUnavailableMessage(raw) {
  if (!raw) return false;
  return (
    /not configured/i.test(raw) ||
    /cloud sync is not configured/i.test(raw) ||
    /cloud account isn't available/i.test(raw) ||
    /isn't available on this build/i.test(raw)
  );
}

/** Map thrown errors and SDK messages to product-friendly cloud copy. */
export function sanitizeCloudUserError(err, fallback = CLOUD_CONNECT_FAILED) {
  if (err == null) return fallback;
  const rawMsg =
    typeof err === "string" ? err : String(err?.message || err || "").trim();

  if (isCloudUnavailableMessage(rawMsg)) return CLOUD_ACCOUNT_UNAVAILABLE;
  if (!rawMsg || VENDOR_RE.test(rawMsg) || /^Firebase:/i.test(rawMsg)) return fallback;

  return rawMsg;
}
