import {
  formatTimerDisplay,
  getActiveTimerRemaining,
  normalizeActiveTimer,
} from "./modules/timers.js";

export { formatTimerDisplay };

/** @param {object|null|undefined} active @param {string} dayKey @param {string} hourKey @param {string} category @param {string|number} taskId */
export function getLinkedTaskTimerRemainingMs(active, dayKey, hourKey, category, taskId) {
  const norm = normalizeActiveTimer(active);
  if (!norm?.running || !norm.linkedTask) return null;
  const linked = norm.linkedTask;
  if (String(linked.taskId) !== String(taskId)) return null;
  if (linked.hourKey && String(linked.hourKey) !== String(hourKey)) return null;
  if (linked.category && String(linked.category) !== String(category)) return null;
  if (linked.dayKey && String(linked.dayKey) !== String(dayKey)) return null;
  return getActiveTimerRemaining(norm);
}
