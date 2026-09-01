import { isBlocklistedUserName } from "./cloudPersist.js";

export const LOCAL_PREFS_META_KEY = "cute_schedule_local_prefs_meta_v1";

export function readLocalPrefsMeta() {
  try {
    const raw = localStorage.getItem(LOCAL_PREFS_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalPrefsMeta(meta) {
  try {
    localStorage.setItem(LOCAL_PREFS_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota */
  }
}

/** Mark local-only prefs (name, theme, health) so cloud load does not clobber recent device edits. */
export function touchLocalPref(...fields) {
  if (!fields.length) return;
  const meta = readLocalPrefsMeta();
  const now = Date.now();
  for (const field of fields) meta[field] = now;
  meta.updatedAt = now;
  writeLocalPrefsMeta(meta);
}

export function localPrefIsNewer(field, cloudUpdatedAtIso) {
  const meta = readLocalPrefsMeta();
  const localTs = meta[field];
  if (!localTs) return false;
  if (!cloudUpdatedAtIso) return true;
  const cloudTs = Date.parse(String(cloudUpdatedAtIso));
  if (Number.isNaN(cloudTs)) return true;
  return localTs > cloudTs;
}

export function readPinnedUserName() {
  return String(readLocalPrefsMeta().pinnedUserName || "").trim();
}

export function pinLocalUserName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return;
  const meta = readLocalPrefsMeta();
  const now = Date.now();
  meta.userName = now;
  meta.updatedAt = now;
  meta.pinnedUserName = trimmed;
  writeLocalPrefsMeta(meta);
}

export function readPinnedThemeName() {
  return String(readLocalPrefsMeta().pinnedThemeName || "").trim();
}

export function pinLocalThemeName(themeName) {
  const trimmed = String(themeName || "").trim();
  if (!trimmed) return;
  const meta = readLocalPrefsMeta();
  const now = Date.now();
  meta.theme = now;
  meta.updatedAt = now;
  meta.pinnedThemeName = trimmed;
  writeLocalPrefsMeta(meta);
}

/** Pin good on-disk prefs once so cloud cannot revert them (skips blocklisted stale names). */
export function seedLocalPrefsMetaFromDisk(profile, theme) {
  const meta = readLocalPrefsMeta();
  const name = String(profile?.userName || "").trim();
  if (name && !meta.pinnedUserName && !isBlocklistedUserName(name)) {
    pinLocalUserName(name);
  }
  const themeName = String(theme?.name || "").trim();
  if (themeName && themeName !== "Classic Pink" && !meta.pinnedThemeName) {
    pinLocalThemeName(themeName);
  }
}

export function applyPinnedProfileFields(profile) {
  const next = { ...profile };
  const pinnedName = readPinnedUserName();
  if (pinnedName) next.userName = pinnedName;
  return next;
}
