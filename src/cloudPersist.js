import { mergeHealthPreferRicher, normalizeHealth } from "./health/healthModel.js";
import {
  applyPinnedProfileFields,
  clearBlocklistedPinnedUserName,
  localPrefIsNewer,
  readPinnedThemeName,
  readPinnedUserName,
  touchLocalPref,
} from "./localPrefsMeta.js";

/** Names that must never be persisted or restored from cloud/disk (stale sync artifacts). */
const BLOCKLIST_USER_NAMES = new Set(["christy gilkin"]);

export function isBlocklistedUserName(name) {
  return BLOCKLIST_USER_NAMES.has(String(name || "").trim().toLowerCase());
}

/** Profile safe for localStorage + Firestore (pinned name wins; blocklisted names cleared). */
export function sanitizeProfileForPersist(profile) {
  clearBlocklistedPinnedUserName();
  const next = applyPinnedProfileFields({ ...(profile || {}) });
  const pinned = readPinnedUserName();
  if (pinned && !isBlocklistedUserName(pinned)) {
    next.userName = pinned;
  }
  const raw = String(next.userName || next.name || "").trim();
  if (!raw || isBlocklistedUserName(raw)) {
    next.userName = "";
    if ("name" in next) next.name = "";
  }
  return next;
}

export function themeForPersist(theme, themesByName) {
  const pinned = readPinnedThemeName();
  if (pinned && themesByName?.[pinned]) return themesByName[pinned];
  return theme;
}

export function healthProgramCount(health) {
  return (normalizeHealth(health).programs || []).length;
}

/**
 * Prefer the richer health blob so empty/thin device state never wipes My programs.
 * Always unions programs via mergeHealthPreferRicher.
 */
export function preferRicherHealth(primary, secondary) {
  return mergeHealthPreferRicher(primary, secondary);
}

/**
 * Normalize schedule payload before writing to Firestore.
 * Merges health with on-disk so programs cannot disappear mid-save.
 * @param {object} parts
 * @param {{ themesByName?: Record<string, unknown>, diskHealth?: object | null }} [opts]
 */
export function buildCloudSavePayload(parts, opts = {}) {
  const profile = sanitizeProfileForPersist(parts.profile);
  const theme = themeForPersist(parts.theme, opts.themesByName);
  let health = normalizeHealth(parts.health);
  if (opts.diskHealth != null) {
    health = preferRicherHealth(opts.diskHealth, health);
  }
  if (opts.cloudHealth != null) {
    // Never upload fewer programs than what we last saw in cloud.
    const cloudN = healthProgramCount(opts.cloudHealth);
    const outN = healthProgramCount(health);
    if (cloudN > outN) {
      health = preferRicherHealth(health, opts.cloudHealth);
    }
  }
  return {
    appState: parts.appState,
    notes: parts.notes,
    finance: parts.finance,
    profile,
    health,
    theme,
    routineTemplate: parts.routineTemplate,
    morningRoutineTemplate: parts.morningRoutineTemplate,
    routineSchedule: parts.routineSchedule,
    coachMeta: parts.coachMeta,
    coachUserProfile: parts.coachUserProfile,
    moodboard: parts.moodboard,
    customCategories: parts.customCategories,
    patterns: parts.patterns,
    habitTracker: parts.habitTracker,
  };
}

/**
 * True when this device should push profile/theme/name back to cloud.
 * Does NOT trigger solely because local health timestamp is newer (that wiped programs).
 */
export function shouldRepairCloudAfterLoad({ cloudUpdatedAt, cloudProfile, cloudHealth, localProfile, localHealth }) {
  const pinnedName = readPinnedUserName();
  if (pinnedName && !isBlocklistedUserName(pinnedName)) return true;
  if (readPinnedThemeName()) return true;
  if (localPrefIsNewer("userName", cloudUpdatedAt)) return true;
  if (localPrefIsNewer("theme", cloudUpdatedAt)) return true;

  const cloudName = String(cloudProfile?.userName || cloudProfile?.name || "").trim();
  if (cloudName && isBlocklistedUserName(cloudName)) return true;

  const localPrograms = healthProgramCount(localHealth);
  const cloudPrograms = healthProgramCount(cloudHealth);
  if (localPrograms > cloudPrograms) return true;

  const localName = String(sanitizeProfileForPersist(localProfile).userName || "").trim();
  if (localName && localName !== cloudName && !isBlocklistedUserName(cloudName)) return true;

  return false;
}

export function markProfilePersisted(profile) {
  const name = String(sanitizeProfileForPersist(profile).userName || "").trim();
  if (name) touchLocalPref("profile", "userName");
}

/** Account label: never show a blocklisted Auth displayName. */
export function formatAccountStatusLabel({ isAnonymous, email, authDisplayName, profileName } = {}) {
  if (isAnonymous) return { kind: "guest", text: "guest" };
  if (email) return { kind: "email", text: String(email).trim() };
  const authName = String(authDisplayName || "").trim();
  if (authName && !isBlocklistedUserName(authName)) return { kind: "auth", text: authName };
  const own = String(profileName || "").trim();
  if (own && !isBlocklistedUserName(own)) return { kind: "profile", text: own };
  return { kind: "signedIn", text: "" };
}
