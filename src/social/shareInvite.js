import { Capacitor } from "@capacitor/core";

/**
 * Copy text on iOS WKWebView and desktop (clipboard API + textarea fallback).
 * @param {string} text
 */
export async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) throw new Error("Nothing to copy.");

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* fall through */
    }
  }

  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.width = "2em";
  ta.style.height = "2em";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
  if (!ok) throw new Error("Could not copy to clipboard.");
}

/**
 * Share or copy an invite payload (native iOS-safe).
 * @param {{ webLink?: string, appStoreUrl?: string, shareText?: string, shareUrl?: string, referralCode?: string }} payload
 * @returns {Promise<"shared" | "copied">}
 */
export async function shareInvitePayload(payload) {
  const appStoreUrl = String(payload?.appStoreUrl || payload?.shareUrl || "").trim();
  const code = String(payload?.referralCode || "").trim().toUpperCase();
  const shareText =
    String(payload?.shareText || "").trim() ||
    [
      "Join me on ProYou - build routines together and stay accountable.",
      code ? `Invite code: ${code}` : "",
      appStoreUrl ? `Download on the App Store: ${appStoreUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  if (!appStoreUrl && !shareText) {
    throw new Error("Invite link is not ready yet. Wait for your code to load or sign in.");
  }

  const shareUrl = appStoreUrl;
  const isNative = Capacitor.isNativePlatform();

  if (typeof navigator.share === "function") {
    try {
      /** iOS share sheet works best with a single URL; keep long text in `text`. */
      await navigator.share({
        title: "Join me on ProYou",
        text: shareText,
        ...(shareUrl ? { url: shareUrl } : {}),
      });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      if (isNative) {
        await copyTextToClipboard(shareText);
        return "copied";
      }
    }
  }

  await copyTextToClipboard(shareText);
  return "copied";
}
