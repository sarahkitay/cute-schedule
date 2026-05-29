import { normalizeSharePermissions } from "./socialModel.js";

/**
 * Build a share snapshot from app state. Only includes categories user opted into.
 * @param {Object} input
 * @param {string} [input.displayName]
 * @param {import('./socialModel.js').SharePermissions} input.sharePermissions
 * @param {string} [input.todayKey]
 * @param {Array<{ text: string, time?: string, done?: boolean }>} [input.todayTasks]
 * @param {Array<{ label: string, streak?: number, direction?: string }>} [input.habits]
 * @param {Array<{ text: string, dayKey?: string }>} [input.recentCompleted]
 * @param {Array<{ text: string, progress?: string }>} [input.monthlyGoals]
 * @param {Object} [input.fitnessSummary]
 * @param {Array<{ label: string }>} [input.financeMilestones]
 */
export function buildShareSnapshot(input) {
  const perms = normalizeSharePermissions(input?.sharePermissions);
  const snapshot = {
    updatedAt: new Date().toISOString(),
    displayName: (input?.displayName || "").trim() || "Friend",
  };
  if (perms.scheduleToday && input?.todayTasks?.length) {
    snapshot.scheduleToday = {
      dayKey: input.todayKey || "",
      tasks: input.todayTasks.slice(0, 24).map((t) => ({
        text: String(t.text || "").slice(0, 120),
        time: t.time || null,
        done: !!t.done,
      })),
    };
  }
  if (perms.habitStreaks && input?.habits?.length) {
    snapshot.habitStreaks = input.habits.slice(0, 20).map((h) => ({
      label: String(h.label || "").slice(0, 80),
      streak: typeof h.streak === "number" ? h.streak : 0,
      direction: h.direction || "build",
    }));
  }
  if (perms.completedTasks && input?.recentCompleted?.length) {
    snapshot.completedTasks = input.recentCompleted.slice(0, 15).map((t) => ({
      text: String(t.text || "").slice(0, 120),
      dayKey: t.dayKey || "",
    }));
  }
  if (perms.monthlyGoals && input?.monthlyGoals?.length) {
    snapshot.monthlyGoals = input.monthlyGoals.slice(0, 12).map((g) => ({
      text: String(g.text || "").slice(0, 120),
      progress: g.progress || "",
    }));
  }
  if (perms.fitness && input?.fitnessSummary) {
    snapshot.fitness = input.fitnessSummary;
  }
  if (perms.finance && input?.financeMilestones?.length) {
    snapshot.finance = input.financeMilestones.slice(0, 8).map((m) => ({
      label: String(m.label || "").slice(0, 80),
    }));
  }
  const hasContent = Object.keys(snapshot).some((k) => k !== "updatedAt" && k !== "displayName");
  return hasContent ? snapshot : null;
}
