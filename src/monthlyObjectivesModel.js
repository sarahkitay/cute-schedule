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

export function trimMonthlyObjectiveNote(note) {
  if (note == null) return "";
  return String(note).trim();
}

export function normalizeMonthlyList(monthly, currentMonthKey) {
  if (!Array.isArray(monthly)) return [];
  return monthly.map((row) => {
    const note = trimMonthlyObjectiveNote(row.note);
    return {
      ...row,
      monthKey: row.monthKey || currentMonthKey,
      ...(note ? { note } : {}),
    };
  });
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

/** Objectives shown for a specific month (excludes prior-month rows awaiting auto-carry). */
export function getVisibleMonthObjectives(monthly, currentMonthKey) {
  const prior = priorObjectiveMonthKey(currentMonthKey);
  return (monthly || []).filter((m) => {
    const mk = m.monthKey || currentMonthKey;
    if (mk === prior && isPendingCarryObjective(m, prior)) return false;
    return mk === currentMonthKey;
  });
}

/** All objectives stamped for a given month (for history review). */
export function getObjectivesForMonth(monthly, monthKey) {
  const key = String(monthKey || "");
  return (monthly || []).filter((m) => (m.monthKey || "") === key);
}

/** Distinct month keys present in data, newest first. Always includes `currentMonthKey`. */
export function listObjectiveMonthKeys(monthly, currentMonthKey) {
  const keys = new Set();
  if (currentMonthKey) keys.add(currentMonthKey);
  for (const row of monthly || []) {
    if (row?.monthKey) keys.add(String(row.monthKey));
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
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
      monthEndReviewed: false,
      ...(trimMonthlyObjectiveNote(source.note) ? { note: trimMonthlyObjectiveNote(source.note) } : {}),
    },
  ];
}

/**
 * Auto-carry every unfinished prior-month objective into the current month.
 * @param {(prefix?: string) => string} makeId
 */
export function autoCarryPendingMonthlyObjectives(monthly, currentMonthKey, makeId) {
  const pending = getPendingCarryObjectives(monthly, currentMonthKey);
  if (!pending.length) return { monthly: monthly || [], carriedIds: [] };
  let next = monthly || [];
  const carriedIds = [];
  for (const row of pending) {
    const newId = typeof makeId === "function" ? makeId() : `mo-${Date.now()}-${carriedIds.length}`;
    next = carryMonthlyObjective(next, row.id, currentMonthKey, newId);
    carriedIds.push(newId);
  }
  return { monthly: next, carriedIds };
}

/** Carried-into-current-month rows waiting for keep / let-go notice. */
export function getMonthEndReviewObjectives(monthly, currentMonthKey) {
  return (monthly || []).filter(
    (m) =>
      m &&
      m.monthKey === currentMonthKey &&
      m.carriedFromId &&
      !m.monthEndReviewed &&
      !m.done
  );
}

export function keepCarriedMonthlyObjective(monthly, id) {
  return (monthly || []).map((m) =>
    m.id === id ? { ...m, monthEndReviewed: true } : m
  );
}

/** Remove the carried clone from this month; prior-month source stays as unfinished/left. */
export function letGoCarriedMonthlyObjective(monthly, id) {
  const row = (monthly || []).find((m) => m.id === id);
  if (!row) return monthly || [];
  const fromId = row.carriedFromId;
  return (monthly || [])
    .filter((m) => m.id !== id)
    .map((m) =>
      m.id === fromId
        ? {
            ...m,
            carryResolved: true,
            carryOutcome: "left",
            carriedToId: undefined,
          }
        : m
    );
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
