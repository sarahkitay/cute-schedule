/** Search scheduled tasks across all days for repeat patterns and completion history. */

function normalizeQuery(q) {
  return String(q || "").trim().toLowerCase();
}

function textMatches(taskText, query) {
  const n = normalizeQuery(query);
  if (n.length < 2) return false;
  return String(taskText || "").toLowerCase().includes(n);
}

/**
 * @param {object} appState
 * @param {string} query
 * @returns {Array<{ text: string, occurrences: number, completed: number, lastScheduled: string|null, lastCompleted: string|null, recentDates: Array<{ dayKey: string, hourKey: string, done: boolean }> }>}
 */
export function searchTaskHistory(appState, query) {
  const n = normalizeQuery(query);
  if (n.length < 2) return [];

  /** @type {Map<string, { text: string, occurrences: number, completed: number, lastScheduled: string|null, lastCompleted: string|null, dates: Array<{ dayKey: string, hourKey: string, done: boolean, completedAt?: string|null }> }>} */
  const byKey = new Map();

  for (const [dayKey, day] of Object.entries(appState?.days || {})) {
    const hours = day?.hours;
    if (!hours || typeof hours !== "object") continue;
    for (const hourKey of Object.keys(hours)) {
      const byCat = hours[hourKey];
      if (!byCat || typeof byCat !== "object") continue;
      for (const list of Object.values(byCat)) {
        if (!Array.isArray(list)) continue;
        for (const t of list) {
          if (!t?.text || !textMatches(t.text, n)) continue;
          const text = String(t.text).trim();
          const key = text.toLowerCase();
          let row = byKey.get(key);
          if (!row) {
            row = {
              text,
              occurrences: 0,
              completed: 0,
              lastScheduled: null,
              lastCompleted: null,
              dates: [],
            };
            byKey.set(key, row);
          }
          row.occurrences += 1;
          if (t.done) row.completed += 1;
          row.dates.push({
            dayKey,
            hourKey,
            done: !!t.done,
            completedAt: t.completedAt || null,
          });
          if (!row.lastScheduled || dayKey > row.lastScheduled) row.lastScheduled = dayKey;
          if (t.done) {
            const doneDay =
              t.completedAt && /^\d{4}-\d{2}-\d{2}/.test(String(t.completedAt))
                ? String(t.completedAt).slice(0, 10)
                : dayKey;
            if (!row.lastCompleted || doneDay > row.lastCompleted) row.lastCompleted = doneDay;
          }
        }
      }
    }
  }

  return [...byKey.values()]
    .map((row) => ({
      text: row.text,
      occurrences: row.occurrences,
      completed: row.completed,
      lastScheduled: row.lastScheduled,
      lastCompleted: row.lastCompleted,
      recentDates: row.dates
        .sort((a, b) => b.dayKey.localeCompare(a.dayKey) || b.hourKey.localeCompare(a.hourKey))
        .slice(0, 8),
    }))
    .sort((a, b) => b.occurrences - a.occurrences || b.lastScheduled?.localeCompare(a.lastScheduled || "") || 0);
}

export function formatHistoryDayKey(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey || "-";
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
