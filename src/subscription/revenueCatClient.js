import { Capacitor } from "@capacitor/core";
import {
  PRO_ENTITLEMENT_ID,
  PRO_PRODUCT_ID,
  SUBSCRIPTION_SNAPSHOT_KEY,
} from "./constants.js";

let purchasesModule = null;
let configured = false;

function isNativeIos() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function purchasesErrorMessage(error) {
  const code = error?.code ?? error?.errorCode ?? "";
  const msg = error?.message || String(error || "");
  if (/cancel/i.test(msg) || code === "1" || code === 1) {
    return { cancelled: true, message: msg };
  }
  if (/not configured/i.test(msg) || /not been configured/i.test(msg)) {
    return {
      cancelled: false,
      message: "In-app purchases are not ready yet. Try again in a moment, or use Restore purchases.",
    };
  }
  return { cancelled: false, message: msg || "Purchase failed. Please try again." };
}

async function loadPurchases() {
  if (purchasesModule) return purchasesModule;
  if (!isNativeIos()) return null;
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    purchasesModule = mod.Purchases;
    return purchasesModule;
  } catch (e) {
    console.warn("RevenueCat Purchases SDK not available:", e?.message || e);
    return null;
  }
}

function readLocalSnapshot() {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export { readLocalSnapshot };

function writeLocalSnapshot(snapshot) {
  try {
    localStorage.setItem(SUBSCRIPTION_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

function parseCustomerInfo(customerInfo) {
  const ent = customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
  const isPro = Boolean(ent?.isActive);
  const trialActive = ent?.periodType === "TRIAL" || ent?.periodType === "INTRO";
  const expirationDate = ent?.expirationDate ? new Date(ent.expirationDate) : null;
  const subscriptionExpired = Boolean(expirationDate && expirationDate.getTime() < Date.now() && !isPro);
  return {
    isPro,
    trialActive,
    expirationDate,
    subscriptionExpired,
    productIdentifier: ent?.productIdentifier || null,
    willRenew: ent?.willRenew ?? null,
  };
}

/** Dev / web fallback when StoreKit is unavailable */
function devSubscriptionState() {
  const snap = readLocalSnapshot();
  if (snap?.isPro) {
    return {
      isPro: true,
      trialActive: Boolean(snap.trialActive),
      expirationDate: snap.expirationDate ? new Date(snap.expirationDate) : null,
      subscriptionExpired: false,
      productIdentifier: PRO_PRODUCT_ID,
      willRenew: true,
    };
  }
  return {
    isPro: false,
    trialActive: false,
    expirationDate: null,
    subscriptionExpired: false,
    productIdentifier: null,
    willRenew: null,
  };
}

export async function configureRevenueCat(appUserId) {
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
  const Purchases = await loadPurchases();
  if (!Purchases || !apiKey) {
    configured = false;
    return devSubscriptionState();
  }
  if (!configured) {
    await Purchases.configure({
      apiKey,
      appUserID: appUserId || undefined,
    });
    configured = true;
  } else if (appUserId) {
    try {
      await Purchases.logIn({ appUserID: appUserId });
    } catch {
      /* ignore */
    }
  }
  const { customerInfo } = await Purchases.getCustomerInfo();
  const parsed = parseCustomerInfo(customerInfo);
  writeLocalSnapshot({
    isPro: parsed.isPro,
    trialActive: parsed.trialActive,
    expirationDate: parsed.expirationDate?.toISOString?.() || null,
  });
  return parsed;
}

export async function refreshSubscriptionState(appUserId) {
  if (!isNativeIos() || !import.meta.env.VITE_REVENUECAT_IOS_API_KEY) {
    return devSubscriptionState();
  }
  return configureRevenueCat(appUserId);
}

/** Configure RevenueCat when possible; throws with a user-facing message if purchases cannot run. */
export async function ensureRevenueCatReady(appUserId) {
  if (!isNativeIos()) {
    if (import.meta.env.DEV) return null;
    throw new Error("Subscriptions are available in the ProYou iOS app.");
  }
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Subscriptions are not set up in this build yet. Your 30-day welcome access still works on this device.",
    );
  }
  const Purchases = await loadPurchases();
  if (!Purchases) {
    throw new Error("In-app purchases are not available on this device.");
  }
  await configureRevenueCat(appUserId);
  return Purchases;
}

export async function purchaseProMonthly(appUserId) {
  const Purchases = await ensureRevenueCatReady(appUserId);
  if (!Purchases) {
    writeLocalSnapshot({
      isPro: true,
      trialActive: true,
      expirationDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    return devSubscriptionState();
  }

  let offerings;
  try {
    offerings = await withTimeout(
      Purchases.getOfferings(),
      20000,
      "Could not load subscription options. Check your connection and try again.",
    );
  } catch (e) {
    const { cancelled, message } = purchasesErrorMessage(e);
    if (cancelled) throw e;
    throw new Error(message);
  }

  const pkg =
    offerings.current?.availablePackages?.find((p) => p.product?.identifier === PRO_PRODUCT_ID) ||
    offerings.current?.monthly ||
    offerings.current?.availablePackages?.[0];
  if (!pkg) {
    throw new Error("Subscription product is not configured yet. Try Restore purchases or contact support.");
  }

  let customerInfo;
  try {
    ({ customerInfo } = await withTimeout(
      Purchases.purchasePackage({ aPackage: pkg }),
      120000,
      "Purchase timed out. If you finished in the App Store sheet, tap Restore purchases.",
    ));
  } catch (e) {
    const { cancelled, message } = purchasesErrorMessage(e);
    if (cancelled) throw e;
    throw new Error(message);
  }

  const parsed = parseCustomerInfo(customerInfo);
  writeLocalSnapshot({
    isPro: parsed.isPro,
    trialActive: parsed.trialActive,
    expirationDate: parsed.expirationDate?.toISOString?.() || null,
  });
  return parsed;
}

export async function restorePurchases(appUserId) {
  const Purchases = await ensureRevenueCatReady(appUserId);
  if (!Purchases) {
    const snap = readLocalSnapshot();
    if (snap?.isPro) return devSubscriptionState();
    throw new Error("Restore is available in the ProYou iOS app.");
  }

  let customerInfo;
  try {
    ({ customerInfo } = await withTimeout(
      Purchases.restorePurchases(),
      30000,
      "Restore timed out. Check your connection and try again.",
    ));
  } catch (e) {
    const { cancelled, message } = purchasesErrorMessage(e);
    if (cancelled) throw e;
    throw new Error(message);
  }

  const parsed = parseCustomerInfo(customerInfo);
  writeLocalSnapshot({
    isPro: parsed.isPro,
    trialActive: parsed.trialActive,
    expirationDate: parsed.expirationDate?.toISOString?.() || null,
  });
  return parsed;
}

export function subscriptionPlatformLabel() {
  return isNativeIos() ? "ios" : "web";
}
