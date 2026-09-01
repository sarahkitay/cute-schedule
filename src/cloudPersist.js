import { normalizeHealth } from "./health/healthModel.js";
import {
  applyPinnedProfileFields,
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
  const next = applyPinnedProfileFields({ ...(profile || {}) });
  const pinned = readPinnedUserName();
  if (pinned) {
    next.userName = pinned;
    return next;
  }
  const raw = String(next.userName || next.name || "").trim();
  if (raw && isBlocklistedUserName(raw)) {
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
 * Normalize schedule payload before writing to Firestore.
 * @param {object} parts
 * @param {{ themesByName?: Record<string, unknown> }} [opts]
 */
export function buildCloudSavePayload(parts, opts = {}) {
  const profile = sanitizeProfileForPersist(parts.profile);
  const theme = themeForPersist(parts.theme, opts.themesByName);
  const health = normalizeHealth(parts.health);
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

/** True when this device has newer/richer data than the cloud doc we just loaded. */
export function shouldRepairCloudAfterLoad({ cloudUpdatedAt, cloudProfile, cloudHealth, localProfile, localHealth }) {
  if (readPinnedUserName()) return true;
  if (readPinnedThemeName()) return true;
  if (localPrefIsNewer("health", cloudUpdatedAt)) return true;
  if (localPrefIsNewer("userName", cloudUpdatedAt)) return true;
  if (localPrefIsNewer("theme", cloudUpdatedAt)) return true;

  const cloudName = String(cloudProfile?.userName || cloudProfile?.name || "").trim();
  if (cloudName && isBlocklistedUserName(cloudName)) return true;

  const localPrograms = healthProgramCount(localHealth);
  const cloudPrograms = healthProgramCount(cloudHealth);
  if (localPrograms > cloudPrograms) return true;

  const localName = String(sanitizeProfileForPersist(localProfile).userName || "").trim();
  if (localName && localName !== cloudName) return true;

  return false;
}

export function markProfilePersisted(profile) {
  const name = String(sanitizeProfileForPersist(profile).userName || "").trim();
  if (name) touchLocalPref("profile", "userName");
}
