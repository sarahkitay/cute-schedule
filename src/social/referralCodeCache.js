const keyForUid = (uid) => `proyou_my_referral_code_${uid}`;

export function loadCachedReferralCode(uid) {
  if (!uid) return "";
  try {
    return String(localStorage.getItem(keyForUid(uid)) || "").trim().toUpperCase();
  } catch {
    return "";
  }
}

export function saveCachedReferralCode(uid, code) {
  if (!uid || !code) return;
  try {
    localStorage.setItem(keyForUid(uid), String(code).trim().toUpperCase());
  } catch {
    /* ignore */
  }
}
