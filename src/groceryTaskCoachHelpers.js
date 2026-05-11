/** Shopping-list keywords, task disposition log, finance month rollover, coach-facing summaries. */

export const DEFAULT_GROCERY_KEYWORDS = ["grocery", "groceries", "store", "errand"];

const TASK_BEHAVIOR_KEY = "cute_schedule_task_behavior_v1";
const taskBehaviorListeners = new Set();

export function subscribeTaskBehaviorDirty(fn) {
  taskBehaviorListeners.add(fn);
  return () => taskBehaviorListeners.delete(fn);
}

function notifyTaskBehaviorDirty() {
  taskBehaviorListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeGroceryKeywordsFromProfile(profile) {
  const raw = profile?.groceryKeywords;
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string" && raw.trim()) arr = raw.split(/[,;\n]+/);
  const out = [...new Set(arr.map((k) => String(k).trim().toLowerCase()).filter(Boolean))];
  return out.length ? out : [...DEFAULT_GROCERY_KEYWORDS];
}

export function taskMatchesGroceryKeywords(text, keywords) {
  const kws = (keywords || []).filter((k) => k.length > 0);
  if (!kws.length) return false;
  const inner = kws.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?:^|[^a-z0-9])(${inner})(?:$|[^a-z0-9])`, "i");
  return pattern.test(String(text || "").trim());
}

export function loadTaskBehaviorEntries() {
  try {
    const raw = localStorage.getItem(TASK_BEHAVIOR_KEY);
    const o = raw ? JSON.parse(raw) : null;
    const entries = o && Array.isArray(o.entries) ? o.entries : Array.isArray(o) ? o : [];
    return entries.filter((e) => e && typeof e === "object" && e.type && e.at);
  } catch {
    return [];
  }
}

export function appendTaskBehaviorEvent(entry) {
  try {
    const prev = loadTaskBehaviorEntries();
    const row = {
      id: entry.id || `tb_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: entry.type,
      at: entry.at || new Date().toISOString(),
      dayKey: entry.dayKey,
      hourKey: entry.hourKey,
      category: entry.category,
      taskId: entry.taskId,
      textSnippet: entry.textSnippet != null ? String(entry.textSnippet).slice(0, 160) : "",
    };
    const next = [...prev, row].slice(-800);
    localStorage.setItem(TASK_BEHAVIOR_KEY, JSON.stringify({ entries: next }));
    notifyTaskBehaviorDirty();
  } catch {}
}

const MISSED_EOD_DAYS_KEY = "cute_schedule_missed_eod_days_v1";
const DEFAULT_CATEGORIES_FALLBACK = ["Work", "School", "Personal"];

function addDaysKeyStr(dayKeyStr, deltaDays) {
  const [y, m, d] = String(dayKeyStr || "").split("-").map(Number);
  if (!y || !m || !d) return String(dayKeyStr || "");
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function emptySlotForCats(categories) {
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES_FALLBACK;
  return cats.reduce((acc, c) => ({ ...acc, [c]: [] }), {});
}

function mergeSubscriptionTasksIntoHoursLocal(hours, dayKey, subscriptions, categories) {
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES_FALLBACK;
  const firstCat = cats[0];
  const dayOfMonth = parseInt(String(dayKey).slice(8), 10);
  if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return hours || {};
  const subsDue = (subscriptions || []).filter((s) => s.dueDay != null && s.dueDay === dayOfMonth);
  if (subsDue.length === 0) return hours || {};
  const synthetic = subsDue.map((s) => ({
    id: "sub-" + s.id,
    text: `Pay ${s.name} ($${Number(s.amount).toFixed(2)})`,
    done: false,
    energyLevel: "MEDIUM",
    isSubscription: true,
  }));
  const nextHours = { ...(hours || {}) };
  const at09 = nextHours["09:00"] || emptySlotForCats(cats);
  nextHours["09:00"] = { ...at09, [firstCat]: [...(at09[firstCat] || []), ...synthetic] };
  return nextHours;
}

function allTasksInDayLocal(hours, categories) {
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES_FALLBACK;
  const hourEntries = Object.entries(hours || {});
  return hourEntries.flatMap(([hourKey, tasksByCat]) =>
    cats.flatMap((cat) =>
      (tasksByCat[cat] || []).map((task) => ({
        ...task,
        hour: hourKey,
        category: cat,
      }))
    )
  );
}

function loadMissedEodProcessedDays() {
  try {
    const raw = localStorage.getItem(MISSED_EOD_DAYS_KEY);
    const o = raw ? JSON.parse(raw) : null;
    const arr = o && Array.isArray(o.days) ? o.days : [];
    return new Set(arr.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)));
  } catch {
    return new Set();
  }
}

function saveMissedEodProcessedDays(set) {
  try {
    const arr = [...set].sort().slice(-400);
    localStorage.setItem(MISSED_EOD_DAYS_KEY, JSON.stringify({ days: arr }));
  } catch {}
}

/**
 * For each recent calendar day strictly before `realTodayKey`, log `missed_eod` once per incomplete
 * non-subscription task. Marks days processed so repeats do not duplicate. Subscription placeholders are skipped.
 *
 * @returns {{ logged: number, daysProcessed: number }}
 */
export function processMissedEndOfDayBacklog(opts) {
  const days = opts?.days && typeof opts.days === "object" ? opts.days : {};
  const realTodayKey = typeof opts?.realTodayKey === "string" ? opts.realTodayKey : "";
  const categories = Array.isArray(opts?.categories) ? opts.categories : DEFAULT_CATEGORIES_FALLBACK;
  const subscriptions = opts?.subscriptions || [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(realTodayKey)) return { logged: 0, daysProcessed: 0 };
  if (opts?.enabled === false) return { logged: 0, daysProcessed: 0 };

  const processed = loadMissedEodProcessedDays();
  const entries = loadTaskBehaviorEntries();
  const missedKeys = new Set(
    entries.filter((e) => e.type === "missed_eod" && e.dayKey && e.taskId).map((e) => `${e.dayKey}|${e.taskId}`)
  );

  let logged = 0;
  let daysProcessed = 0;
  const MAX_DAYS = 14;
  const MAX_LOG = 80;

  for (let i = 1; i <= MAX_DAYS; i++) {
    if (logged >= MAX_LOG) break;
    const dayKey = addDaysKeyStr(realTodayKey, -i);
    if (processed.has(dayKey)) continue;

    const dayObj = days[dayKey];
    if (!dayObj || !dayObj.hours || typeof dayObj.hours !== "object" || Object.keys(dayObj.hours).length === 0) {
      processed.add(dayKey);
      daysProcessed++;
      saveMissedEodProcessedDays(processed);
      continue;
    }

    const merged = mergeSubscriptionTasksIntoHoursLocal(dayObj.hours, dayKey, subscriptions, categories);
    const tasks = allTasksInDayLocal(merged, categories);
    for (const t of tasks) {
      if (logged >= MAX_LOG) break;
      if (t.done || String(t.id || "").startsWith("sub-")) continue;
      const k = `${dayKey}|${t.id}`;
      if (missedKeys.has(k)) continue;
      appendTaskBehaviorEvent({
        type: "missed_eod",
        dayKey,
        hourKey: t.hour,
        category: t.category,
        taskId: t.id,
        textSnippet: String(t.text || ""),
        at: `${dayKey}T23:59:59.000Z`,
      });
      missedKeys.add(k);
      logged++;
    }

    processed.add(dayKey);
    daysProcessed++;
    saveMissedEodProcessedDays(processed);
  }

  return { logged, daysProcessed };
}

/** Total / done for a calendar day (merged subscription rows included). */
export function dayScheduleProgress(days, dayKey, subscriptions, categories) {
  const dayObj = days?.[dayKey];
  const raw = dayObj?.hours;
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return { total: 0, done: 0 };
  const merged = mergeSubscriptionTasksIntoHoursLocal(raw, dayKey, subscriptions, categories);
  const tasks = allTasksInDayLocal(merged, categories);
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done };
}

/**
 * Consecutive calendar days (walking back from endDayKey) where every day that had at least one task
 * was fully checked off. Empty days before the first busy day are skipped; empty days after the streak
 * started end the streak. If endDayKey still has open tasks, counting starts from the previous day.
 */
export function computeCalendarCompletionStreak(days, endDayKey, subscriptions, categories) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDayKey || ""))) return 0;
  const today = dayScheduleProgress(days, endDayKey, subscriptions, categories);
  let start = 0;
  if (today.total > 0 && today.done < today.total) start = 1;

  let streak = 0;
  let seenTaskDay = false;
  for (let i = start; i < 400; i++) {
    const d = addDaysKeyStr(endDayKey, -i);
    const { total, done } = dayScheduleProgress(days, d, subscriptions, categories);
    if (total === 0) {
      if (seenTaskDay) break;
      continue;
    }
    seenTaskDay = true;
    if (done === total) streak++;
    else break;
  }
  return streak;
}

/** True when each of the last 7 calendar days that had any tasks was 100% complete (empty days ignored). */
export function rollingSevenDaySchedulePerfect(days, endDayKey, subscriptions, categories) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDayKey || ""))) return false;
  let any = false;
  for (let i = 0; i < 7; i++) {
    const d = addDaysKeyStr(endDayKey, -i);
    const { total, done } = dayScheduleProgress(days, d, subscriptions, categories);
    if (total === 0) continue;
    any = true;
    if (done !== total) return false;
  }
  return any;
}

export function buildScheduleStreakCoachLine(days, endDayKey, subscriptions, categories) {
  const streak = computeCalendarCompletionStreak(days, endDayKey, subscriptions, categories);
  const weekPerfect = rollingSevenDaySchedulePerfect(days, endDayKey, subscriptions, categories);
  return `calendar_all_done_streak_days=${streak}; rolling_7d_all_scheduled_days_finished=${weekPerfect}`;
}

function startOfWeekISO(dayKey) {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function inWindow(atISO, startISO) {
  if (!atISO || !startISO) return false;
  return String(atISO) >= String(startISO);
}

/**
 * @param {string} dayKey YYYY-MM-DD (today)
 * @returns {{ allCompletePct: number | null, weekCompletePct: number | null, pctTomorrow: number | null, pctDelete: number | null, pctUncomplete: number | null, n: number }}
 */
export function summarizeTaskBehaviorForHome(dayKey) {
  const entries = loadTaskBehaviorEntries();
  const weekStart = startOfWeekISO(dayKey);
  const all = entries.filter((e) => ["complete", "tomorrow", "delete", "uncomplete", "missed_eod"].includes(e.type));
  const week = weekStart ? all.filter((e) => inWindow(e.at, weekStart)) : [];

  function rates(slice) {
    let c = 0,
      t = 0,
      d = 0,
      u = 0,
      m = 0;
    for (const e of slice) {
      if (e.type === "complete") c++;
      else if (e.type === "tomorrow") t++;
      else if (e.type === "delete") d++;
      else if (e.type === "uncomplete") u++;
      else if (e.type === "missed_eod") m++;
    }
    const denom = c + t + d + m;
    const denomWide = c + t + d + u + m;
    return {
      completePct: denom > 0 ? Math.round((c / denom) * 100) : null,
      pctTomorrow: denomWide > 0 ? Math.round((t / denomWide) * 100) : null,
      pctDelete: denomWide > 0 ? Math.round((d / denomWide) * 100) : null,
      pctUncomplete: denomWide > 0 ? Math.round((u / denomWide) * 100) : null,
      pctMissedEod: denomWide > 0 ? Math.round((m / denomWide) * 100) : null,
      n: slice.length,
      c,
      t,
      d,
      u,
      m,
      denomWide,
    };
  }

  const a = rates(all);
  const w = rates(week);
  return {
    allCompletePct: a.completePct,
    weekCompletePct: w.completePct,
    pctCompleteShare: a.denomWide > 0 ? Math.round((a.c / a.denomWide) * 100) : null,
    pctTomorrow: a.pctTomorrow,
    pctDelete: a.pctDelete,
    pctUncomplete: a.pctUncomplete,
    pctMissedEod: a.pctMissedEod,
    n: a.n,
    barFracs:
      a.denomWide > 0
        ? {
            complete: a.c / a.denomWide,
            tomorrow: a.t / a.denomWide,
            delete: a.d / a.denomWide,
            uncomplete: a.u / a.denomWide,
            missed: a.m / a.denomWide,
          }
        : null,
  };
}

export function formatTaskBehaviorForCoach(dayKey) {
  const s = summarizeTaskBehaviorForHome(dayKey);
  const lines = [
    s.n > 0
      ? `task_dispositions_logged=${s.n} (complete vs moved/deleted uses recent actions)`
      : "task_dispositions_logged=0",
    s.allCompletePct != null ? `all_time_complete_rate≈${s.allCompletePct}% (of complete+move_tomorrow+delete)` : "",
    s.weekCompletePct != null ? `this_week_complete_rate≈${s.weekCompletePct}%` : "",
    s.pctTomorrow != null ? `share_moved_to_tomorrow≈${s.pctTomorrow}%` : "",
    s.pctDelete != null ? `share_deleted≈${s.pctDelete}%` : "",
    s.pctUncomplete != null ? `share_reopened_uncomplete≈${s.pctUncomplete}%` : "",
    s.pctMissedEod != null ? `share_left_incomplete_at_day_end≈${s.pctMissedEod}%` : "",
  ].filter(Boolean);
  return lines.join("; ") || null;
}

export function financeMonthKeyFromDayKey(dayKey) {
  const m = String(dayKey || "").match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!m) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${m[1]}-${m[2]}`;
}

function monthKeyToSortable(ym) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

function advanceMonthKey(ym) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const d = new Date(Number(m[1]), Number(m[2]) - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function entryMonthKey(dateISO) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function topExpenseLabels(expenseEntries, limit = 5) {
  const by = {};
  for (const e of expenseEntries || []) {
    const lab = String(e.label || "Other").trim() || "Other";
    by[lab] = (by[lab] || 0) + (Number(e.amount) || 0);
  }
  return Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, amount]) => ({ label, amount }));
}

/**
 * When the calendar month advances past financeActiveMonthKey, archive that month's income/expense rows into monthOverviews and advance.
 */
export function rollFinanceMonthsForward(finance, targetMonthKey) {
  const target = String(targetMonthKey || "").match(/^\d{4}-\d{2}$/)
    ? targetMonthKey
    : financeMonthKeyFromDayKey(targetMonthKey);
  let f = finance && typeof finance === "object" ? finance : {};
  let active = f.financeActiveMonthKey || null;
  const overviews = Array.isArray(f.monthOverviews) ? [...f.monthOverviews] : [];
  let incomeEntries = [...(f.incomeEntries || [])];
  let expenseEntries = [...(f.expenseEntries || [])];
  let changed = false;

  if (!active) {
    if (f.financeActiveMonthKey !== target) {
      changed = true;
    }
    return changed ? { ...f, financeActiveMonthKey: target, monthOverviews: overviews } : f;
  }

  while (monthKeyToSortable(active) < monthKeyToSortable(target)) {
    const closing = active;
    const incClosing = incomeEntries.filter((e) => entryMonthKey(e.dateISO) === closing);
    const expClosing = expenseEntries.filter((e) => entryMonthKey(e.dateISO) === closing);
    const incomeTotal = incClosing.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expenseTotal = expClosing.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const topExpenses = topExpenseLabels(expClosing, 6);
    overviews.unshift({
      monthKey: closing,
      incomeTotal,
      expenseTotal,
      net: incomeTotal - expenseTotal,
      topExpenses,
      archivedAt: new Date().toISOString(),
    });
    incomeEntries = incomeEntries.filter((e) => entryMonthKey(e.dateISO) !== closing);
    expenseEntries = expenseEntries.filter((e) => entryMonthKey(e.dateISO) !== closing);
    active = advanceMonthKey(closing);
    changed = true;
    if (overviews.length > 60) {
      active = target;
      break;
    }
  }

  if (monthKeyToSortable(active) > monthKeyToSortable(target)) {
    active = target;
    changed = true;
  }

  if (!changed) return f;

  return {
    ...f,
    financeActiveMonthKey: active,
    monthOverviews: overviews.slice(0, 48),
    incomeEntries,
    expenseEntries,
  };
}

export function averageOverArchivedMonths(overviews, field) {
  const arr = (overviews || []).filter((o) => o && typeof o === "object");
  if (!arr.length) return null;
  const sum = arr.reduce((s, o) => s + (Number(o[field]) || 0), 0);
  return sum / arr.length;
}

export function aggregateTopExpensesAcrossMonths(overviews, limit = 5) {
  const merged = {};
  for (const o of overviews || []) {
    for (const row of o.topExpenses || []) {
      const lab = String(row.label || "Other").trim() || "Other";
      merged[lab] = (merged[lab] || 0) + (Number(row.amount) || 0);
    }
  }
  const n = (overviews || []).length || 1;
  return Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, sum]) => ({ label, avg: sum / n }));
}

export function financeDecalForCurrentMonth({ spentThisMonth, incomeThisMonth, overviews }) {
  const avgSpend = averageOverArchivedMonths(overviews, "expenseTotal");
  const avgIncome = averageOverArchivedMonths(overviews, "incomeTotal");
  const lines = [];
  if (avgSpend != null && spentThisMonth != null && overviews.length) {
    if (spentThisMonth > avgSpend * 1.1) lines.push("You spent more than your recent monthly average this month - totally normal when life stacks up.");
    else if (spentThisMonth < avgSpend * 0.85) lines.push("You spent a bit less than usual this month - nice steadiness.");
  }
  if (avgIncome != null && incomeThisMonth != null && overviews.length) {
    if (incomeThisMonth > avgIncome * 1.08) lines.push("You logged more income than usual this month - good job noticing it.");
    else if (incomeThisMonth < avgIncome * 0.85 && incomeThisMonth > 0)
      lines.push("Income came in lower than your recent average - worth a gentle look when you have a calm minute.");
  }
  return lines;
}

export function buildFinanceHintsForCoach(finance) {
  const f = finance && typeof finance === "object" ? finance : {};
  const credit = Array.isArray(f.creditScoreEntries) ? f.creditScoreEntries : [];
  const last = credit[0];
  const debtPay = Array.isArray(f.debtPayments) ? f.debtPayments : [];
  const recentPay = debtPay.slice(0, 12).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const parts = [];
  if (last && last.score != null) parts.push(`latest_logged_credit_score=${last.score} (${String(last.dateISO || "").slice(0, 10)})`);
  if (recentPay > 0) parts.push(`recent_debt_payments_logged≈$${recentPay.toFixed(2)}`);
  const mo = Array.isArray(f.monthOverviews) && f.monthOverviews[0];
  if (mo && mo.monthKey) parts.push(`last_archived_month=${mo.monthKey} net=$${Number(mo.net || 0).toFixed(2)}`);
  return parts.length ? parts.join("; ") : null;
}
