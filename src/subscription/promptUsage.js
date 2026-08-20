import { FREE_COACH_PROMPTS_PER_DAY } from "./constants.js";

const STORAGE_KEY = "proyou_coach_prompt_usage_v1";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local calendar day for coach quota (matches user-facing "today"). */
export function getCoachPromptLocalDayKey() {
  return todayKey();
}

function readRawStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function readStore() {
  const day = todayKey();
  const parsed = readRawStore();
  if (!parsed || parsed.day !== day) {
    return { day, count: 0 };
  }
  return { day, count: Math.max(0, Number(parsed.count) || 0) };
}

function writeStore(day, count) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day, count: Math.max(0, Math.round(Number(count) || 0)) }),
    );
  } catch {
    /* ignore */
  }
}

/** Drop stale counts when the local calendar day rolls over. */
export function refreshCoachPromptUsageIfDayChanged() {
  const day = todayKey();
  const parsed = readRawStore();
  if (parsed?.day && parsed.day !== day) {
    writeStore(day, 0);
    return true;
  }
  return false;
}

export function getCoachPromptsUsedToday() {
  refreshCoachPromptUsageIfDayChanged();
  return readStore().count;
}

export function getCoachPromptQuotaLocal() {
  refreshCoachPromptUsageIfDayChanged();
  const store = readStore();
  const used = store.count;
  const limit = FREE_COACH_PROMPTS_PER_DAY;
  return {
    day: store.day,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/** @param {{ used?: number, limit?: number, dayKey?: string } | null | undefined} quota */
export function syncCoachPromptUsageFromServer(quota) {
  if (!quota || typeof quota !== "object") return getCoachPromptsUsedToday();
  const day =
    typeof quota.dayKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(quota.dayKey.trim())
      ? quota.dayKey.trim()
      : todayKey();
  if (day !== todayKey()) {
    // Server quota is for a different local day — ignore and keep today's fresh count.
    refreshCoachPromptUsageIfDayChanged();
    return getCoachPromptsUsedToday();
  }
  const limit =
    typeof quota.limit === "number" && quota.limit > 0 ? Math.round(quota.limit) : FREE_COACH_PROMPTS_PER_DAY;
  const used = Math.max(0, Math.min(limit, Math.round(Number(quota.used) || 0)));
  writeStore(day, used);
  return used;
}

export function consumeCoachPromptLocal() {
  refreshCoachPromptUsageIfDayChanged();
  const store = readStore();
  const next = store.count + 1;
  writeStore(store.day, next);
  return next;
}

export function resetCoachPromptUsageForDev() {
  writeStore(todayKey(), 0);
}
