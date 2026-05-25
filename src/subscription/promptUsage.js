const STORAGE_KEY = "proyou_coach_prompt_usage_v1";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day: todayKey(), count: 0 };
    const parsed = JSON.parse(raw);
    if (parsed?.day !== todayKey()) return { day: todayKey(), count: 0 };
    return { day: parsed.day, count: Number(parsed.count) || 0 };
  } catch {
    return { day: todayKey(), count: 0 };
  }
}

function writeStore(count) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: todayKey(), count }));
  } catch {
    /* ignore */
  }
}

export function getCoachPromptsUsedToday() {
  return readStore().count;
}

export function consumeCoachPromptLocal() {
  const store = readStore();
  const next = store.count + 1;
  writeStore(next);
  return next;
}

export function resetCoachPromptUsageForDev() {
  writeStore(0);
}
