export type SharePermissions = {
  scheduleToday: boolean;
  habitStreaks: boolean;
  completedTasks: boolean;
  monthlyGoals: boolean;
  fitness: boolean;
  finance: boolean;
};

export type SocialPrivacySettings = {
  profileVisible: boolean;
  allowFriendRequests: boolean;
  allowSharedTaskInvites: boolean;
  sharePermissions: SharePermissions;
};

export type FriendVisibility = {
  useGlobal: boolean;
  categories: SharePermissions;
};

export const SHARED_TASK_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  DECLINED: "declined",
} as const;

export const REFERRAL_CODE_STORAGE_KEY = "proyou_pending_referral_code_v1";
export const REFERRAL_PRO_DAYS = 30;

export const SHARE_CATEGORIES = [
  { id: "scheduleToday", label: "Today's schedule", description: "Tasks and times for today" },
  { id: "habitStreaks", label: "Habit streaks", description: "Build/break habit progress" },
  { id: "completedTasks", label: "Completed tasks", description: "What you've finished recently" },
  { id: "monthlyGoals", label: "Monthly goals", description: "Goal progress this month" },
  { id: "fitness", label: "Fitness progress", description: "Workouts and activity highlights" },
  { id: "finance", label: "Finance milestones", description: "Only if you explicitly enable" },
] as const;

export const NON_SHAREABLE_CATEGORIES = ["medication", "notes", "journal"] as const;

export function defaultSharePermissions(): SharePermissions {
  return {
    scheduleToday: false,
    habitStreaks: false,
    completedTasks: false,
    monthlyGoals: false,
    fitness: false,
    finance: false,
  };
}

export function defaultSocialPrivacy(): SocialPrivacySettings {
  return {
    profileVisible: true,
    allowFriendRequests: true,
    allowSharedTaskInvites: true,
    sharePermissions: defaultSharePermissions(),
  };
}

export function normalizeSharePermissions(raw: unknown): SharePermissions {
  const base = defaultSharePermissions();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof SharePermissions)[]) {
    if (typeof obj[key] === "boolean") base[key] = obj[key];
  }
  return base;
}

export function normalizeSocialPrivacy(raw: unknown): SocialPrivacySettings {
  const d = defaultSocialPrivacy();
  if (!raw || typeof raw !== "object") return d;
  const obj = raw as Record<string, unknown>;
  return {
    profileVisible: obj.profileVisible !== false,
    allowFriendRequests: obj.allowFriendRequests !== false,
    allowSharedTaskInvites: obj.allowSharedTaskInvites !== false,
    sharePermissions: normalizeSharePermissions(obj.sharePermissions),
  };
}

export function defaultFriendVisibility(): FriendVisibility {
  return { useGlobal: true, categories: defaultSharePermissions() };
}

export function normalizeFriendVisibility(raw: unknown): FriendVisibility {
  const d = defaultFriendVisibility();
  if (!raw || typeof raw !== "object") return d;
  const obj = raw as Record<string, unknown>;
  return {
    useGlobal: obj.useGlobal !== false,
    categories: obj.useGlobal === false ? normalizeSharePermissions(obj.categories) : defaultSharePermissions(),
  };
}

export { friendshipDocId } from "./firestoreAccess";

export function generateReferralCode(uid: string): string {
  const slice = (uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PY${slice || "YOU"}${rand}`;
}

export function captureReferralFromUrl(): void {
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

export function getPendingReferralCode(): string {
  try {
    return localStorage.getItem(REFERRAL_CODE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearPendingReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function filterSnapshotForFriend(
  snapshot: Record<string, unknown> | null | undefined,
  globalPerms: unknown,
  friendVisibility: FriendVisibility | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot) return null;
  const perms =
    friendVisibility?.useGlobal === false
      ? normalizeSharePermissions(friendVisibility.categories)
      : normalizeSharePermissions(globalPerms);
  const out: Record<string, unknown> = { updatedAt: snapshot.updatedAt, displayName: snapshot.displayName };
  if (perms.scheduleToday && snapshot.scheduleToday) out.scheduleToday = snapshot.scheduleToday;
  if (perms.habitStreaks && snapshot.habitStreaks) out.habitStreaks = snapshot.habitStreaks;
  if (perms.completedTasks && snapshot.completedTasks) out.completedTasks = snapshot.completedTasks;
  if (perms.monthlyGoals && snapshot.monthlyGoals) out.monthlyGoals = snapshot.monthlyGoals;
  if (perms.fitness && snapshot.fitness) out.fitness = snapshot.fitness;
  if (perms.finance && snapshot.finance) out.finance = snapshot.finance;
  return out;
}
