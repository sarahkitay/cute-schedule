/** @typedef {0|1|2|3|4|5|6} WeekdayIndex */

export const REPEAT_WEEKDAY_LABELS = Object.freeze([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const REPEAT_SERIES_KEY = "proyou_repeat_series_v1";

function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {unknown} raw @returns {import('./taskRepeatSeries.js').RepeatSeries | null} */
export function normalizeRepeatSeries(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  if (!id) return null;
  const repeatWeekdays = Array.isArray(raw.repeatWeekdays)
    ? [...new Set(raw.repeatWeekdays.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))]
    : [];
  const skippedDayKeys = Array.isArray(raw.skippedDayKeys)
    ? raw.skippedDayKeys.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k)))
    : [];
  const hour = String(raw.hour || "09:00").slice(0, 5);
  let endHour;
  if (typeof raw.endHour === "string" && /^\d{2}:\d{2}$/.test(raw.endHour.trim())) {
    const candidate = raw.endHour.trim().slice(0, 5);
    const [sh, sm] = hour.split(":").map(Number);
    const [eh, em] = candidate.split(":").map(Number);
    if (
      Number.isFinite(sh) &&
      Number.isFinite(sm) &&
      Number.isFinite(eh) &&
      Number.isFinite(em) &&
      eh * 60 + em > sh * 60 + sm
    ) {
      endHour = candidate;
    }
  }
  return {
    id,
    templateTaskId: String(raw.templateTaskId || "").slice(0, 64) || id,
    text: String(raw.text || "").slice(0, 500),
    category: String(raw.category || "Personal").slice(0, 40),
    hour,
    ...(endHour ? { endHour } : {}),
    energyLevel:
      raw.energyLevel === "LIGHT" || raw.energyLevel === "HEAVY" ? raw.energyLevel : "MEDIUM",
    taskNote: typeof raw.taskNote === "string" ? raw.taskNote.slice(0, 2000) : undefined,
    repeatWeekdays,
    skippedDayKeys,
    taskType: raw.taskType === "workout" ? "workout" : undefined,
    workoutProgramMode:
      raw.workoutProgramMode === "queue" || raw.workoutProgramMode === "auto" || raw.workoutProgramMode === "specific"
        ? raw.workoutProgramMode
        : undefined,
    workoutProgramId: raw.workoutProgramId ? String(raw.workoutProgramId) : undefined,
  };
}

/** @returns {import('./taskRepeatSeries.js').RepeatSeries[]} */
export function loadRepeatSeries() {
  try {
    const raw = JSON.parse(localStorage.getItem(REPEAT_SERIES_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeRepeatSeries).filter(Boolean);
  } catch {
    return [];
  }
}

/** @param {import('./taskRepeatSeries.js').RepeatSeries[]} list */
export function saveRepeatSeries(list) {
  try {
    localStorage.setItem(REPEAT_SERIES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** @param {string} dayKey @returns {WeekdayIndex} */
export function weekdayIndexForDayKey(dayKey) {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getDay();
}

/** @param {string} fromKey @param {string} toKey @returns {string[]} */
export function dayKeysInRange(fromKey, toKey) {
  const out = [];
  let cur = fromKey;
  let guard = 0;
  while (cur <= toKey && guard < 400) {
    out.push(cur);
    cur = addDaysKey(cur, 1);
    guard += 1;
  }
  return out;
}

export function addDaysKey(dayKeyStr, deltaDays) {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {object} task
 * @param {string} dayKey
 * @param {string} hourKey
 * @param {string} category
 * @param {WeekdayIndex[]} repeatWeekdays
 */
export function createRepeatSeriesFromTask(task, dayKey, hourKey, category, repeatWeekdays) {
  const days = [...new Set(repeatWeekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const series = normalizeRepeatSeries({
    id: uid(),
    templateTaskId: task.id,
    text: task.text,
    category,
    hour: hourKey,
    endHour: task.endHour,
    energyLevel: task.energyLevel,
    taskNote: task.taskNote,
    repeatWeekdays: days,
    skippedDayKeys: [],
    taskType: task.taskType,
    workoutProgramMode: task.workoutProgramMode,
    workoutProgramId: task.workoutProgramId,
  });
  if (!series) throw new Error("invalid series");
  const list = loadRepeatSeries().filter((s) => s.id !== series.id);
  list.push(series);
  saveRepeatSeries(list);
  return series;
}

/** @param {string} seriesId @param {WeekdayIndex[]} repeatWeekdays */
export function updateRepeatSeriesWeekdays(seriesId, repeatWeekdays) {
  const days = [...new Set(repeatWeekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const list = loadRepeatSeries().map((s) =>
    s.id === seriesId ? { ...s, repeatWeekdays: days } : s
  );
  saveRepeatSeries(list);
  return list.find((s) => s.id === seriesId) || null;
}

/** @param {string} seriesId @param {string} dayKey */
export function addSkippedRepeatDay(seriesId, dayKey) {
  const list = loadRepeatSeries().map((s) => {
    if (s.id !== seriesId) return s;
    const skipped = new Set(s.skippedDayKeys || []);
    skipped.add(dayKey);
    return { ...s, skippedDayKeys: [...skipped] };
  });
  saveRepeatSeries(list);
}

/** @param {string} seriesId */
export function removeRepeatSeries(seriesId) {
  saveRepeatSeries(loadRepeatSeries().filter((s) => s.id !== seriesId));
}

/** @param {import('./taskRepeatSeries.js').RepeatSeries} series */
function buildInstanceTask(series, dayKey) {
  return {
    id: uid(),
    text: series.text,
    done: false,
    energyLevel: series.energyLevel,
    completedAt: null,
    feeling: null,
    repeat: "weekly",
    repeatUntil: null,
    repeatSeriesId: series.id,
    repeatWeekdays: [...series.repeatWeekdays],
    originalTaskId: series.templateTaskId,
    createdAt: new Date().toISOString(),
    ...(series.taskType === "workout" ? { taskType: "workout" } : {}),
    ...(series.workoutProgramMode ? { workoutProgramMode: series.workoutProgramMode } : {}),
    ...(series.workoutProgramId ? { workoutProgramId: series.workoutProgramId } : {}),
    ...(series.taskNote ? { taskNote: series.taskNote } : {}),
    ...(series.endHour ? { endHour: series.endHour } : {}),
    repeatInstanceDayKey: dayKey,
  };
}

function emptySlot(categories) {
  const o = {};
  for (const c of categories || ["Personal"]) o[c] = [];
  return o;
}

/**
 * Materialize weekly repeat instances between fromKey and toKey (inclusive).
 * @param {object} appState
 * @param {string[]} customCategories
 * @param {string} fromKey
 * @param {string} toKey
 */
export function syncRepeatSeriesIntoAppState(appState, customCategories, fromKey, toKey) {
  const seriesList = loadRepeatSeries();
  if (!seriesList.length) return appState;
  const days = appState?.days && typeof appState.days === "object" ? { ...appState.days } : {};
  const cats = customCategories?.length ? customCategories : ["Personal"];

  for (const dayKey of dayKeysInRange(fromKey, toKey)) {
    const dow = weekdayIndexForDayKey(dayKey);
    let day = days[dayKey] ? { ...days[dayKey], hours: { ...(days[dayKey].hours || {}) } } : { hours: {} };
    const hours = day.hours;
    for (const series of seriesList) {
      const hourKey = series.hour;
      const category = series.category;
      const byCat = hours[hourKey] ? { ...hours[hourKey] } : emptySlot(cats);
      const shouldExist =
        series.repeatWeekdays.includes(dow) && !(series.skippedDayKeys || []).includes(dayKey);
      const list = (byCat[category] || []).filter((t) => {
        if (t.repeatSeriesId !== series.id) return true;
        return shouldExist;
      });
      if (shouldExist && !list.some((t) => t.repeatSeriesId === series.id)) {
        list.push(buildInstanceTask(series, dayKey));
      }
      byCat[category] = list;
      hours[hourKey] = byCat;
    }
    day.hours = hours;
    days[dayKey] = day;
  }

  return { ...appState, days };
}

/**
 * Mark tasks in app state that belong to a series (repeat -> none).
 * @param {object} appState
 * @param {string} seriesId
 */
export function clearRepeatSeriesFromAppState(appState, seriesId) {
  const days = appState?.days && typeof appState.days === "object" ? { ...appState.days } : {};
  let changed = false;
  for (const dayKey of Object.keys(days)) {
    const day = days[dayKey];
    if (!day?.hours) continue;
    const hours = { ...day.hours };
    let dayChanged = false;
    for (const hourKey of Object.keys(hours)) {
      const byCat = { ...hours[hourKey] };
      let hourChanged = false;
      for (const cat of Object.keys(byCat)) {
        const list = (byCat[cat] || []).map((t) => {
          if (t.repeatSeriesId !== seriesId) return t;
          hourChanged = true;
          const next = { ...t, repeat: "none", repeatUntil: null };
          delete next.repeatSeriesId;
          delete next.repeatWeekdays;
          delete next.repeatInstanceDayKey;
          return next;
        });
        if (hourChanged) byCat[cat] = list;
      }
      if (hourChanged) {
        hours[hourKey] = byCat;
        dayChanged = true;
      }
    }
    if (dayChanged) {
      days[dayKey] = { ...day, hours };
      changed = true;
    }
  }
  return changed ? { ...appState, days } : appState;
}

/** @param {import('./taskRepeatSeries.js').RepeatSeries[]} seriesList */
export function getRepeatableSeriesTemplates(seriesList = loadRepeatSeries()) {
  return seriesList.filter((s) => s.repeatWeekdays?.length > 0);
}
