/** Period filters and aggregates for the Finance dashboard. */

export const FINANCE_PERIOD_OPTIONS = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "three_months", label: "3 months" },
  { id: "this_year", label: "This year" },
];

export const EXPENSE_CATEGORIES = [
  { id: "housing", label: "Housing", color: "#e79ab5" },
  { id: "food", label: "Food", color: "#f0a060" },
  { id: "transport", label: "Transport", color: "#9b8fd4" },
  { id: "shopping", label: "Shopping", color: "#6eb5e8" },
  { id: "entertainment", label: "Entertainment", color: "#7bc99a" },
  { id: "other", label: "Other", color: "#d4b896" },
];

const CATEGORY_BY_ID = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, c]));

export function expenseCategoryLabel(categoryId) {
  return CATEGORY_BY_ID[categoryId]?.label || "Other";
}

export function expenseCategoryColor(categoryId) {
  return CATEGORY_BY_ID[categoryId]?.color || "#d4b896";
}

export function guessExpenseCategory(label) {
  const t = String(label || "").toLowerCase();
  if (/\b(rent|mortgage|housing|lease|landlord|hoa|apartment)\b/.test(t)) return "housing";
  if (/\b(utilities|electric|water bill|gas bill|internet bill)\b/.test(t)) return "housing";
  if (/\b(grocery|groceries|food|coffee|restaurant|dining|lunch|dinner|breakfast|uber eats|doordash)\b/.test(t))
    return "food";
  if (/\b(uber|lyft|gas|fuel|parking|transit|metro|bus|train|car payment|auto)\b/.test(t)) return "transport";
  if (/\b(amazon|target|walmart|shop|shopping|clothes|clothing)\b/.test(t)) return "shopping";
  if (/\b(netflix|spotify|hulu|disney|movie|concert|game|entertainment|gym)\b/.test(t)) return "entertainment";
  return "other";
}

function entryMonthKey(dateISO) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToDate(ym, day = 1) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, day);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** @returns {{ start: Date, end: Date }} */
export function getFinancePeriodRange(periodId, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (periodId === "this_month") {
    return { start: new Date(y, m, 1), end: endOfMonth(now) };
  }
  if (periodId === "last_month") {
    const start = new Date(y, m - 1, 1);
    return { start, end: endOfMonth(start) };
  }
  if (periodId === "three_months") {
    return { start: new Date(y, m - 2, 1), end: endOfMonth(now) };
  }
  if (periodId === "this_year") {
    return { start: new Date(y, 0, 1), end: endOfMonth(now) };
  }
  return { start: new Date(y, m, 1), end: endOfMonth(now) };
}

function dateInRange(dateISO, range) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return false;
  return d >= range.start && d <= range.end;
}

function monthKeyInRange(monthKey, range) {
  const start = monthKeyToDate(monthKey, 1);
  if (!start) return false;
  const end = endOfMonth(start);
  return end >= range.start && start <= range.end;
}

function filterEntriesByRange(entries, range) {
  return (entries || []).filter((e) => dateInRange(e.dateISO, range));
}

function topExpensesToCategories(topExpenses) {
  const out = {};
  for (const row of topExpenses || []) {
    const id = guessExpenseCategory(row.label);
    out[id] = (out[id] || 0) + (Number(row.amount) || 0);
  }
  return out;
}

/**
 * Aggregate income, spending, categories, and transactions for a dashboard period.
 */
export function aggregateFinancePeriod(finance, periodId, now = new Date()) {
  const range = getFinancePeriodRange(periodId, now);
  const incomeLive = filterEntriesByRange(finance.incomeEntries, range);
  const expenseLive = filterEntriesByRange(finance.expenseEntries, range);

  let incomeTotal = incomeLive.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  let expenseTotal = expenseLive.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const categoryTotals = {};

  for (const e of expenseLive) {
    const cat = e.category || guessExpenseCategory(e.label);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
  }

  for (const o of finance.monthOverviews || []) {
    if (!monthKeyInRange(o.monthKey, range)) continue;
    const mk = o.monthKey;
    const hasLiveInMonth =
      (finance.incomeEntries || []).some((e) => entryMonthKey(e.dateISO) === mk) ||
      (finance.expenseEntries || []).some((e) => entryMonthKey(e.dateISO) === mk);
    if (hasLiveInMonth) continue;
    incomeTotal += Number(o.incomeTotal) || 0;
    expenseTotal += Number(o.expenseTotal) || 0;
    const archived = topExpensesToCategories(o.topExpenses);
    for (const [id, amt] of Object.entries(archived)) {
      categoryTotals[id] = (categoryTotals[id] || 0) + amt;
    }
  }

  const transactions = [
    ...incomeLive.map((e) => ({
      id: e.id,
      type: "income",
      label: e.label || "Income",
      amount: Number(e.amount) || 0,
      dateISO: e.dateISO,
    })),
    ...expenseLive.map((e) => ({
      id: e.id,
      type: "expense",
      label: e.label || "Expense",
      amount: Number(e.amount) || 0,
      dateISO: e.dateISO,
      category: e.category || guessExpenseCategory(e.label),
    })),
  ].sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));

  const breakdown = EXPENSE_CATEGORIES.map((c) => ({
    ...c,
    amount: categoryTotals[c.id] || 0,
  }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    range,
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
    breakdown,
    transactions,
  };
}

export function donutGradientFromBreakdown(breakdown, total) {
  if (!total || total <= 0 || !breakdown.length) {
    return "conic-gradient(#f0e8ec 0deg 360deg)";
  }
  let deg = 0;
  const stops = [];
  for (const row of breakdown) {
    const slice = (row.amount / total) * 360;
    const end = deg + slice;
    stops.push(`${row.color} ${deg}deg ${end}deg`);
    deg = end;
  }
  if (deg < 360) stops.push(`#f0e8ec ${deg}deg 360deg`);
  return `conic-gradient(${stops.join(", ")})`;
}

export function formatFinanceMoney(n, { signed = false, type = null } = {}) {
  const v = Math.abs(Number(n) || 0);
  const base = `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!signed) return base;
  if (type === "income") return `+${base}`;
  if (type === "expense") return `-${base}`;
  const num = Number(n) || 0;
  if (num > 0) return `+${base}`;
  if (num < 0) return `-${base}`;
  return base;
}

export function formatTransactionDate(dateISO) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function budgetSpentInPeriod(budget, finance, periodId, now = new Date()) {
  const range = getFinancePeriodRange(periodId, now);
  const cat = budget.category || "other";
  let spent = 0;
  for (const e of finance.expenseEntries || []) {
    if (!dateInRange(e.dateISO, range)) continue;
    const ec = e.category || guessExpenseCategory(e.label);
    if (ec === cat) spent += Number(e.amount) || 0;
  }
  for (const o of finance.monthOverviews || []) {
    if (!monthKeyInRange(o.monthKey, range)) continue;
    const hasLive = (finance.expenseEntries || []).some((e) => entryMonthKey(e.dateISO) === o.monthKey);
    if (hasLive) continue;
    for (const row of o.topExpenses || []) {
      if (guessExpenseCategory(row.label) === cat) spent += Number(row.amount) || 0;
    }
  }
  return spent;
}
