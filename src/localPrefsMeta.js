export const LOCAL_PREFS_META_KEY = "cute_schedule_local_prefs_meta_v1";

export function readLocalPrefsMeta() {
  try {
    const raw = localStorage.getItem(LOCAL_PREFS_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Mark local-only prefs (name, theme) so cloud load does not clobber recent device edits. */
export function touchLocalPref(...fields) {
  if (!fields.length) return;
  const meta = readLocalPrefsMeta();
  const now = Date.now();
  for (const field of fields) meta[field] = now;
  meta.updatedAt = now;
  try {
    localStorage.setItem(LOCAL_PREFS_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota */
  }
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

export function seedLocalPrefsMetaFromDisk(profile, theme) {
  const meta = readLocalPrefsMeta();
  if (String(profile?.userName || "").trim() && !meta.userName) touchLocalPref("userName");
  if (theme?.name && theme.name !== "Classic Pink" && !meta.theme) touchLocalPref("theme");
}
