import { objectiveMonthKey } from "../monthlyObjectivesModel.js";
import { getVisibleMonthObjectives } from "../monthlyObjectivesModel.js";

/**
 * @param {Object} opts
 * @param {string} [opts.displayName]
 * @param {string} opts.realTodayKey
 * @param {Object} opts.appState
 * @param {Object} opts.habitTracker
 */
export function buildShareInputFromApp({ displayName, realTodayKey, appState, habitTracker }) {
  const day = appState?.days?.[realTodayKey];
  const todayTasks = [];
  if (day?.hours) {
    for (const [hourKey, hour] of Object.entries(day.hours)) {
      if (!hour || typeof hour !== "object") continue;
      for (const [, list] of Object.entries(hour)) {
        if (!Array.isArray(list)) continue;
        for (const task of list) {
          if (!task?.text) continue;
          todayTasks.push({
            text: task.text,
            time: hourKey,
            done: !!task.done,
          });
        }
      }
    }
  }

  const habits = (habitTracker?.habits || []).map((h) => {
    let streak = 0;
    const log = habitTracker?.log || {};
    for (let i = 0; i < 60; i++) {
      const d = new Date(`${realTodayKey}T12:00:00`);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (log[key]?.[h.id]) streak += 1;
      else if (i > 0) break;
    }
    return { label: h.label, streak, direction: h.direction || "build" };
  });

  const recentCompleted = [];
  for (let i = 0; i < 7 && recentCompleted.length < 12; i++) {
    const d = new Date(`${realTodayKey}T12:00:00`);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayData = appState?.days?.[key];
    if (!dayData?.hours) continue;
    for (const hour of Object.values(dayData.hours)) {
      if (!hour || typeof hour !== "object") continue;
      for (const [, list] of Object.entries(hour)) {
        if (!Array.isArray(list)) continue;
        for (const task of list) {
          if (task?.done && task?.text) {
            recentCompleted.push({ text: task.text, dayKey: key });
          }
        }
      }
    }
  }

  const monthKey = objectiveMonthKey(new Date(`${realTodayKey}T12:00:00`));
  const monthlyGoals = getVisibleMonthObjectives(appState?.monthly || [], monthKey).map((o) => ({
    text: o.text,
    progress: o.done ? "Done" : "In progress",
  }));

  return {
    displayName,
    todayKey: realTodayKey,
    todayTasks,
    habits,
    recentCompleted: recentCompleted.slice(0, 12),
    monthlyGoals,
    fitnessSummary: null,
    financeMilestones: [],
  };
}
