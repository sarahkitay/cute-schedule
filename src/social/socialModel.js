/** @typedef {'pending' | 'accepted' | 'declined'} FriendRequestStatus */
/** @typedef {'pending' | 'qualified' | 'rewarded'} ReferralStatus */

export const REFERRAL_CODE_STORAGE_KEY = "proyou_pending_referral_code_v1";
export const REFERRAL_PRO_DAYS = 30;

export const SHARE_CATEGORIES = [
  { id: "scheduleToday", label: "Today's schedule", description: "Tasks and times for today" },
  { id: "habitStreaks", label: "Habit streaks", description: "Build/break habit progress" },
  { id: "completedTasks", label: "Completed tasks", description: "What you've finished recently" },
  { id: "monthlyGoals", label: "Monthly goals", description: "Goal progress this month" },
  { id: "fitness", label: "Fitness progress", description: "Workouts and activity highlights" },
  { id: "finance", label: "Finance milestones", description: "Only if you explicitly enable" },
];

/** Categories that cannot be shared (safety). */
export const NON_SHAREABLE_CATEGORIES = ["medication", "notes", "journal"];

/**
 * Default social privacy - nothing shared until opted in.
 * @returns {import('./socialModel.js').SharePermissions}
 */
export function defaultSharePermissions() {
  return {
    scheduleToday: false,
    habitStreaks: false,
    completedTasks: false,
    monthlyGoals: false,
    fitness: false,
    finance: false,
  };
}

/**
 * @typedef {Object} SharePermissions
 * @property {boolean} scheduleToday
 * @property {boolean} habitStreaks
 * @property {boolean} completedTasks
 * @property {boolean} monthlyGoals
 * @property {boolean} fitness
 * @property {boolean} finance
 */

/**
 * @typedef {Object} SocialPrivacySettings
 * @property {boolean} profileVisible
 * @property {boolean} allowFriendRequests
 * @property {boolean} allowSharedTaskInvites
 * @property {SharePermissions} sharePermissions
 */

export function defaultSocialPrivacy() {
  return {
    profileVisible: true,
    allowFriendRequests: true,
    allowSharedTaskInvites: true,
    sharePermissions: defaultSharePermissions(),
  };
}

export function normalizeSharePermissions(raw) {
  const base = defaultSharePermissions();
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base)) {
    if (typeof raw[key] === "boolean") base[key] = raw[key];
  }
  return base;
}

export function normalizeSocialPrivacy(raw) {
  const d = defaultSocialPrivacy();
  if (!raw || typeof raw !== "object") return d;
  return {
    profileVisible: raw.profileVisible !== false,
    allowFriendRequests: raw.allowFriendRequests !== false,
    allowSharedTaskInvites: raw.allowSharedTaskInvites !== false,
    sharePermissions: normalizeSharePermissions(raw.sharePermissions),
  };
}

/** Per-friend overrides: which categories this friend may see. */
export function defaultFriendVisibility() {
  return { useGlobal: true, categories: defaultSharePermissions() };
}

export function normalizeFriendVisibility(raw) {
  const d = defaultFriendVisibility();
  if (!raw || typeof raw !== "object") return d;
  return {
    useGlobal: raw.useGlobal !== false,
    categories: raw.useGlobal === false ? normalizeSharePermissions(raw.categories) : defaultSharePermissions(),
  };
}

export function friendshipDocId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export function generateReferralCode(uid) {
  const slice = (uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PY${slice || "YOU"}${rand}`;
}

export function captureReferralFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || params.get("referral");
    if (ref && ref.trim()) {
      localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, ref.trim().toUpperCase());
      params.delete("ref");
      params.delete("referral");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
  } catch {
    /* ignore */
  }
}

export function getPendingReferralCode() {
  try {
    return localStorage.getItem(REFERRAL_CODE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearPendingReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Filter snapshot payload to only categories allowed for a friend. */
export function filterSnapshotForFriend(snapshot, globalPerms, friendVisibility) {
  if (!snapshot) return null;
  const perms =
    friendVisibility?.useGlobal === false
      ? normalizeSharePermissions(friendVisibility.categories)
      : normalizeSharePermissions(globalPerms);
  const out = { updatedAt: snapshot.updatedAt, displayName: snapshot.displayName };
  if (perms.scheduleToday && snapshot.scheduleToday) out.scheduleToday = snapshot.scheduleToday;
  if (perms.habitStreaks && snapshot.habitStreaks) out.habitStreaks = snapshot.habitStreaks;
  if (perms.completedTasks && snapshot.completedTasks) out.completedTasks = snapshot.completedTasks;
  if (perms.monthlyGoals && snapshot.monthlyGoals) out.monthlyGoals = snapshot.monthlyGoals;
  if (perms.fitness && snapshot.fitness) out.fitness = snapshot.fitness;
  if (perms.finance && snapshot.finance) out.finance = snapshot.finance;
  return out;
}
