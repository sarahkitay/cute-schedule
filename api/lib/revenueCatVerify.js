/**
 * Server-side RevenueCat entitlement verification.
 *
 * The client configures RevenueCat with the Firebase uid as the app user id, so we
 * can confirm Pro status against RevenueCat's REST API instead of trusting any
 * client-sent subscription flag.
 *
 * Requires REVENUECAT_SECRET_KEY (a RevenueCat secret API key) in env. Callers must
 * treat `verified=false` as an unavailable entitlement check, not as permission to
 * trust the client.
 */

const PRO_ENTITLEMENT_ID = process.env.REVENUECAT_PRO_ENTITLEMENT_ID || "pro";

/**
 * @param {string | null | undefined} appUserId Firebase uid used as the RevenueCat app user id.
 * @returns {Promise<{ verified: boolean, isPro: boolean }>}
 *   `verified=false` means the server could not check RevenueCat (missing key,
 *   missing id, network error, or API error). `verified=true` is authoritative.
 */
export async function verifyRevenueCatPro(appUserId) {
  const secret = process.env.REVENUECAT_SECRET_KEY;
  if (!secret || !appUserId) return { verified: false, isPro: false };

  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
      }
    );
    // 404 = unknown subscriber (never purchased) → authoritative "not pro".
    if (res.status === 404) return { verified: true, isPro: false };
    if (!res.ok) return { verified: false, isPro: false };

    const data = await res.json();
    const ent = data?.subscriber?.entitlements?.[PRO_ENTITLEMENT_ID];
    if (!ent) return { verified: true, isPro: false };

    const expiresMs = ent.expires_date ? Date.parse(ent.expires_date) : null;
    // No expiry (lifetime) or expiry in the future = active.
    const isActive = !expiresMs || Number.isNaN(expiresMs) || expiresMs > Date.now();
    return { verified: true, isPro: Boolean(isActive) };
  } catch (e) {
    console.warn("RevenueCat verify error", e?.message || e);
    return { verified: false, isPro: false };
  }
}
