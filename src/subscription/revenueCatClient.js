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

export async function purchaseProMonthly() {
  const Purchases = await loadPurchases();
  if (!Purchases) {
    if (import.meta.env.DEV) {
      writeLocalSnapshot({
        isPro: true,
        trialActive: true,
        expirationDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      return devSubscriptionState();
    }
    throw new Error("Subscriptions are available in the iOS app.");
  }
  const offerings = await Purchases.getOfferings();
  const pkg =
    offerings.current?.availablePackages?.find((p) => p.product?.identifier === PRO_PRODUCT_ID) ||
    offerings.current?.monthly ||
    offerings.current?.availablePackages?.[0];
  if (!pkg) {
    throw new Error("Subscription product is not configured yet.");
  }
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  const parsed = parseCustomerInfo(customerInfo);
  writeLocalSnapshot({
    isPro: parsed.isPro,
    trialActive: parsed.trialActive,
    expirationDate: parsed.expirationDate?.toISOString?.() || null,
  });
  return parsed;
}

export async function restorePurchases() {
  const Purchases = await loadPurchases();
  if (!Purchases) {
    const snap = readLocalSnapshot();
    if (snap?.isPro) return devSubscriptionState();
    throw new Error("Restore is available in the iOS app.");
  }
  const { customerInfo } = await Purchases.restorePurchases();
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
