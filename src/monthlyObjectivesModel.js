/** Calendar month key for monthly objectives, e.g. "2026-05". */
export function objectiveMonthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Previous calendar month from a month key. */
export function priorObjectiveMonthKey(monthKey) {
  const [yStr, mStr] = String(monthKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return objectiveMonthKey();
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return objectiveMonthKey(d);
}

export function formatObjectiveMonthLabel(monthKey) {
  const [yStr, mStr] = String(monthKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return monthKey || "";
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function normalizeMonthlyList(monthly, currentMonthKey) {
  if (!Array.isArray(monthly)) return [];
  return monthly.map((row) => ({
    ...row,
    monthKey: row.monthKey || currentMonthKey,
  }));
}

export function isPendingCarryObjective(row, priorMonthKey) {
  if (!row || row.carryResolved) return false;
  if (row.monthKey !== priorMonthKey) return false;
  return !row.done;
}

export function getPendingCarryObjectives(monthly, currentMonthKey) {
  const prior = priorObjectiveMonthKey(currentMonthKey);
  return (monthly || []).filter((m) => isPendingCarryObjective(m, prior));
}

/** Objectives shown on the current month list (excludes prior-month rows awaiting carry prompt). */
export function getVisibleMonthObjectives(monthly, currentMonthKey) {
  const prior = priorObjectiveMonthKey(currentMonthKey);
  return (monthly || []).filter((m) => {
    const mk = m.monthKey || currentMonthKey;
    if (mk === prior && isPendingCarryObjective(m, prior)) return false;
    return mk === currentMonthKey;
  });
}

export function carryMonthlyObjective(monthly, id, currentMonthKey, newId) {
  const source = (monthly || []).find((m) => m.id === id);
  if (!source) return monthly || [];
  const next = (monthly || []).map((m) =>
    m.id === id
      ? { ...m, carryResolved: true, carryOutcome: "carried", carriedToId: newId }
      : m
  );
  return [
    ...next,
    {
      id: newId,
      text: source.text,
      done: false,
      monthKey: currentMonthKey,
      carriedFromId: id,
    },
  ];
}

export function leaveMonthlyObjectiveInPriorMonth(monthly, id) {
  return (monthly || []).map((m) =>
    m.id === id ? { ...m, carryResolved: true, carryOutcome: "left" } : m
  );
}

export function completeMonthlyObjectiveUnmarked(monthly, id) {
  return (monthly || []).map((m) =>
    m.id === id ? { ...m, done: true, carryResolved: true, carryOutcome: "completed_unmarked" } : m
  );
}

/** Coach / API: active objectives for the real current month only. */
export function filterMonthlyForCoach(monthly, realTodayKey) {
  const currentMonthKey = objectiveMonthKey(new Date(`${realTodayKey}T12:00:00`));
  return (monthly || []).filter(
    (m) => m && !m.done && (m.monthKey || currentMonthKey) === currentMonthKey && String(m.text || "").trim()
  );
}
