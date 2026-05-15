import { listMergedTasksForDay } from "../groceryTaskCoachHelpers";
import {
  PROGRAM_LIBRARY,
  fingerprintExerciseBlocksForDedupe,
  formatExerciseBlockLine,
  normalizeExerciseBlock,
} from "../health/healthModel.js";
import type { PatternShape, TaskLite } from "./intelligence";

export type CoachTimeOfDayBand = "morning" | "midday" | "afternoon" | "evening" | "night";

export type MonthlyObjectiveContext = {
  id: string;
  title: string;
  category?: string;
  hasScheduledTaskToday: boolean;
  lastTouchedAt?: string;
  suggestedNextAction?: string;
};

export type NeglectedObjectiveContext = {
  id: string;
  title: string;
  reason: string;
  suggestedNextAction: string;
};

export type CoachContext = {
  now: string;
  timeOfDay: CoachTimeOfDayBand;
  coachViewDayKey: string;
  realTodayKey: string;
  pacingAppliesToViewDay: boolean;
  today: {
    totalTasks: number;
    completedTasks: number;
    remainingTasks: number;
    overdueTasks: number;
    completionRate: number;
    isOnPace: boolean;
    schedulePacingNote: string;
    dominantTaskTypes: string[];
    dominantEnergyLevel?: string;
    upcomingHeavyOpen: number;
  };
  yesterday: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    summary: string;
  };
  recentPatterns: {
    completionTrend: string;
    recurringGaps: string[];
    overloadedPeriods: string[];
    neglectedCategories: string[];
    lastNDays: Array<{ dayKey: string; total: number; done: number; rate: number }>;
  };
  monthlyObjectives: {
    active: MonthlyObjectiveContext[];
    neglected: NeglectedObjectiveContext[];
  };
  health: {
    activePrograms: Array<{ id: string; name: string; exerciseCount: number }>;
    /** Fingerprints of user-built saved programs so the model avoids duplicating lineups. */
    workoutProgramGuard: Array<{ id: string; name: string; fingerprint: string; sampleLines: string[] }>;
    recentlyUsedPrebuiltPrograms: Array<{ id: string; name: string }>;
    suggestedProgramOpportunity?: string;
    profileGoal?: string | null;
  };
  routines: {
    morningEnabled: boolean;
    nightEnabled: boolean;
  };
  habits: {
    missedRecent: string[];
  };
  notes: {
    snippet: string | null;
    moodToday: string | null;
  };
  recommendationSeeds: string[];
};

function addCalendarDays(dayKey: string, delta: number): string {
  const [y, m, d] = String(dayKey || "").split("-").map(Number);
  if (!y || !m || !d) return String(dayKey || "");
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function minutesFromHHMM(hhmm: string): number {
  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function bandFromMinutes(totalMin: number): CoachTimeOfDayBand {
  const h = Math.floor(totalMin / 60);
  if (h < 11) return "morning";
  if (h < 14) return "midday";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function toTaskLite(row: Record<string, unknown>): TaskLite {
  return {
    hour: String(row.hour || "09:00"),
    category: String(row.category || "Personal"),
    text: row.text != null ? String(row.text) : "",
    done: !!row.done,
    energyLevel: row.energyLevel != null ? String(row.energyLevel) : undefined,
  };
}

function dominantCategories(tasks: TaskLite[], max = 3): string[] {
  const counts: Record<string, number> = {};
  for (const t of tasks) {
    const c = t.category || "Personal";
    counts[c] = (counts[c] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

function dominantOpenEnergy(tasks: TaskLite[]): string | undefined {
  const open = tasks.filter((t) => !t.done);
  if (!open.length) return undefined;
  const counts: Record<string, number> = { HEAVY: 0, MEDIUM: 0, LIGHT: 0 };
  for (const t of open) {
    const e = (t.energyLevel || "MEDIUM").toUpperCase();
    if (e in counts) counts[e]++;
    else counts.MEDIUM++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function tokenizeObjectiveTitle(title: string): string[] {
  return String(title || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 3)
    .slice(0, 12);
}

function taskBlobForDay(tasks: TaskLite[]): string {
  return tasks
    .map((t) => `${t.text || ""} ${t.category || ""}`)
    .join(" ")
    .toLowerCase();
}

function lastObjectiveTouchDay(
  objectiveTokens: string[],
  dayKeysNewestFirst: string[],
  tasksByDay: Map<string, TaskLite[]>
): string | undefined {
  for (const dk of dayKeysNewestFirst) {
    const blob = taskBlobForDay(tasksByDay.get(dk) || []);
    if (objectiveTokens.some((tok) => blob.includes(tok))) return dk;
  }
  return undefined;
}

function suggestObjectiveAction(title: string): string {
  const t = String(title || "").trim();
  const short = t.length > 42 ? `${t.slice(0, 40)}…` : t;
  return `Add a 30–45 minute block tied to "${short}" (one concrete deliverable: ship a small slice, outline the next step, or do outreach).`;
}

export type BuildCoachContextInput = {
  realTodayKey: string;
  coachViewDayKey: string;
  localNowHHMM: string;
  days: Record<string, { hours?: Record<string, Record<string, unknown[]>> }>;
  subscriptions: unknown[];
  categories: string[];
  monthly: Array<{ id?: string; text?: string; done?: boolean }>;
  patterns: PatternShape;
  health: unknown;
  habitTracker: { habits?: unknown[]; log?: Record<string, Record<string, unknown>> };
  notes: Array<{ text?: string; createdAt?: string }>;
  routineSchedule: { enabledMorning?: boolean; enabledNight?: boolean };
};

export function buildCoachContext(input: BuildCoachContextInput): CoachContext {
  const {
    realTodayKey,
    coachViewDayKey,
    localNowHHMM,
    days,
    subscriptions,
    categories,
    monthly,
    patterns,
    health,
    habitTracker,
    notes,
    routineSchedule,
  } = input;

  const nowMin = minutesFromHHMM(localNowHHMM);
  const timeOfDay = bandFromMinutes(nowMin);
  const pacingAppliesToViewDay = coachViewDayKey === realTodayKey;

  const todayTasksRaw = listMergedTasksForDay(days, realTodayKey, subscriptions, categories);
  const todayTasks = todayTasksRaw.map((t) => toTaskLite(t as Record<string, unknown>));

  const totalTasks = todayTasks.length;
  const completedTasks = todayTasks.filter((t) => t.done).length;
  const remainingTasks = totalTasks - completedTasks;

  let overdueTasks = 0;
  if (pacingAppliesToViewDay) {
    for (const t of todayTasks) {
      if (t.done) continue;
      if (minutesFromHHMM(t.hour) < nowMin) overdueTasks++;
    }
  }

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const morningEarly = timeOfDay === "morning" && nowMin < 11 * 60;
  const isOnPace = !pacingAppliesToViewDay ? true : overdueTasks === 0;

  let schedulePacingNote = "";
  if (!pacingAppliesToViewDay) {
    schedulePacingNote = `You are viewing ${coachViewDayKey} (not real today); pacing below refers to ${realTodayKey}.`;
  } else if (totalTasks === 0) {
    schedulePacingNote = "No tasks are on today's board yet.";
  } else if (overdueTasks > 0) {
    schedulePacingNote = `${overdueTasks} open task(s) are already past their scheduled time; that is the clearest pressure signal, not raw completion count.`;
  } else if (morningEarly && completedTasks <= 2) {
    schedulePacingNote =
      "It is still morning; a low completion count so far is not automatically a problem if nothing is overdue yet.";
  } else if (overdueTasks === 0 && remainingTasks > 0) {
    schedulePacingNote = "Nothing is behind the clock yet; you appear on pace for the current time.";
  } else {
    schedulePacingNote = "Schedule is light or fully checked; momentum reads as steady.";
  }

  const open = todayTasks.filter((t) => !t.done);
  const upcomingHeavyOpen = open.filter((t) => minutesFromHHMM(t.hour) >= nowMin && t.energyLevel === "HEAVY").length;

  const yesterdayKey = addCalendarDays(realTodayKey, -1);
  const yTasks = listMergedTasksForDay(days, yesterdayKey, subscriptions, categories).map((t) => toTaskLite(t as Record<string, unknown>));
  const yTotal = yTasks.length;
  const yDone = yTasks.filter((t) => t.done).length;
  const yRate = yTotal > 0 ? Math.round((yDone / yTotal) * 100) : 0;
  let ySummary = yTotal === 0 ? "Yesterday had no scheduled tasks in the app." : `Yesterday: ${yDone}/${yTotal} tasks checked (${yRate}%).`;
  if (yTotal > 0 && yRate >= 80) ySummary += " Strong execution day.";
  else if (yTotal > 0 && yRate < 40) ySummary += " Lighter follow-through than usual.";

  const lastNDays: CoachContext["recentPatterns"]["lastNDays"] = [];
  for (let i = 0; i < 7; i++) {
    const dk = addCalendarDays(realTodayKey, -i);
    const arr = listMergedTasksForDay(days, dk, subscriptions, categories).map((t) => toTaskLite(t as Record<string, unknown>));
    const tot = arr.length;
    const dn = arr.filter((t) => t.done).length;
    lastNDays.push({ dayKey: dk, total: tot, done: dn, rate: tot > 0 ? Math.round((dn / tot) * 100) : 0 });
  }
  const rates = lastNDays.filter((d) => d.total > 0).map((d) => d.rate);
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  const completionTrend =
    rates.length < 2
      ? "Not enough multi-day schedule data to infer a strong trend."
      : avgRate >= 75
        ? "Recent days skew toward high completion when tasks exist."
        : avgRate >= 45
          ? "Recent completion is mixed across days."
          : "Recent days show more open tasks left at day-end when scheduled.";

  const recurringGaps: string[] = [];
  if (patterns?.leastCompletedCategory) recurringGaps.push(`Historically softer category: ${patterns.leastCompletedCategory}`);

  const overloadedPeriods: string[] = [];
  if (upcomingHeavyOpen >= 3) overloadedPeriods.push(`Later today still has ${upcomingHeavyOpen} heavy tasks open.`);

  const neglectedCategories: string[] = [];
  if (todayTasks.length) {
    for (const c of categories || []) {
      if (!todayTasks.some((t) => t.category === c)) neglectedCategories.push(c);
    }
  }

  const activeMonthly = (monthly || []).filter((m) => m && !m.done && String(m.text || "").trim());
  const dayKeysForObj = Array.from({ length: 7 }, (_, i) => addCalendarDays(realTodayKey, -i));
  const tasksByDay = new Map<string, TaskLite[]>();
  for (const dk of dayKeysForObj) {
    tasksByDay.set(
      dk,
      listMergedTasksForDay(days, dk, subscriptions, categories).map((t) => toTaskLite(t as Record<string, unknown>))
    );
  }

  const activeObjs: MonthlyObjectiveContext[] = [];
  const neglectedObjs: NeglectedObjectiveContext[] = [];
  const libIds = new Set(PROGRAM_LIBRARY.map((p) => p.id));

  for (const m of activeMonthly) {
    const title = String(m.text || "").trim();
    const id = String(m.id || title);
    const tokens = tokenizeObjectiveTitle(title);
    const blobToday = taskBlobForDay(tasksByDay.get(realTodayKey) || []);
    const hasScheduledTaskToday = tokens.some((tok) => blobToday.includes(tok));
    const lastTouch = lastObjectiveTouchDay(tokens, dayKeysForObj, tasksByDay);
    const neglected = !hasScheduledTaskToday && tokens.length > 0;
    activeObjs.push({
      id,
      title,
      hasScheduledTaskToday,
      lastTouchedAt: lastTouch,
      suggestedNextAction: suggestObjectiveAction(title),
    });
    if (neglected) {
      neglectedObjs.push({
        id,
        title,
        reason: "No task on today's board matched this objective title (keywords).",
        suggestedNextAction: suggestObjectiveAction(title),
      });
    }
  }

  const h = health && typeof health === "object" ? (health as Record<string, unknown>) : {};
  const programs = Array.isArray(h.programs) ? (h.programs as Record<string, unknown>[]) : [];
  const activePrograms = programs
    .filter((p) => p && Array.isArray(p.exercises) && (p.exercises as unknown[]).length)
    .map((p) => ({
      id: String(p.id || ""),
      name: String(p.name || "Program"),
      exerciseCount: (p.exercises as unknown[]).length,
    }));

  const workoutProgramGuard = programs
    .filter((p) => p && !libIds.has(String((p as { id?: string }).id || "")))
    .map((p) => {
      const ex = Array.isArray((p as { exercises?: unknown[] }).exercises) ? (p as { exercises: unknown[] }).exercises : [];
      const blocks = ex
        .map((e) => normalizeExerciseBlock(e as Record<string, unknown>))
        .filter(Boolean) as ReturnType<typeof normalizeExerciseBlock>[];
      const fingerprint = fingerprintExerciseBlocksForDedupe(blocks);
      const sampleLines = blocks
        .slice(0, 4)
        .map((b) => formatExerciseBlockLine(b))
        .filter(Boolean);
      return {
        id: String((p as { id?: string }).id || ""),
        name: String((p as { name?: string }).name || "Program"),
        fingerprint,
        sampleLines,
      };
    })
    .filter((row) => row.fingerprint.length > 0 && row.id.length > 0);

  const prebuiltUsed: Array<{ id: string; name: string }> = [];
  for (const p of programs) {
    const id = String(p.id || "");
    if (libIds.has(id)) prebuiltUsed.push({ id, name: String(p.name || id) });
  }
  const weekIds = (Array.isArray(h.weekRoutineProgramIds) ? h.weekRoutineProgramIds : []).map(String);
  for (const id of weekIds) {
    if (libIds.has(id)) {
      const lib = PROGRAM_LIBRARY.find((x) => x.id === id);
      if (lib && !prebuiltUsed.some((x) => x.id === id)) prebuiltUsed.push({ id, name: lib.name });
    }
  }

  let suggestedProgramOpportunity: string | undefined;
  const userBuilt = programs.filter((p) => !libIds.has(String(p.id || "")));
  if (prebuiltUsed.length && userBuilt.length === 0) {
    suggestedProgramOpportunity =
      "You have leaned on built-in sample programs; a custom program with a clear goal (strength, fat loss, glute focus, endurance, consistency, mobility) would make progression easier to track.";
  } else if (programs.length >= 1 && weekIds.length >= 1) {
    suggestedProgramOpportunity = "Routine rotation is set; tuning goals or adding a progression block may be the next lever.";
  }

  const profile = (h.profile as Record<string, unknown>) || {};
  const profileGoal = profile.goal != null ? String(profile.goal) : null;

  const missedHabits: string[] = [];
  const habits = Array.isArray(habitTracker?.habits) ? habitTracker.habits : [];
  const log = habitTracker?.log || {};
  for (let i = 1; i <= 3; i++) {
    const dk = addCalendarDays(realTodayKey, -i);
    const dayLog = log[dk] && typeof log[dk] === "object" ? log[dk] : {};
    for (const hb of habits) {
      const row = hb as { id?: string; label?: string };
      if (!row.id) continue;
      if (dayLog[row.id] == null) missedHabits.push(`${row.label || row.id} (no check-in on ${dk})`);
    }
  }

  const noteTexts = (notes || []).map((n) => String(n.text || "").trim()).filter(Boolean);
  const snippet = noteTexts.length ? noteTexts.slice(0, 5).join(" | ").slice(0, 400) : null;

  const seeds: string[] = [];
  seeds.push(schedulePacingNote);
  if (ySummary) seeds.push(ySummary);
  if (neglectedObjs[0]) seeds.push(`Neglected monthly objective candidate: ${neglectedObjs[0].title}`);
  if (upcomingHeavyOpen >= 2) seeds.push(`Later today still stacks ${upcomingHeavyOpen} heavy open tasks.`);
  if (suggestedProgramOpportunity) seeds.push(suggestedProgramOpportunity);
  for (const g of recurringGaps) seeds.push(g);

  return {
    now: new Date().toISOString(),
    timeOfDay,
    coachViewDayKey,
    realTodayKey,
    pacingAppliesToViewDay,
    today: {
      totalTasks,
      completedTasks,
      remainingTasks,
      overdueTasks,
      completionRate,
      isOnPace: !!isOnPace,
      schedulePacingNote,
      dominantTaskTypes: dominantCategories(todayTasks),
      dominantEnergyLevel: dominantOpenEnergy(todayTasks),
      upcomingHeavyOpen,
    },
    yesterday: {
      totalTasks: yTotal,
      completedTasks: yDone,
      completionRate: yRate,
      summary: ySummary,
    },
    recentPatterns: {
      completionTrend,
      recurringGaps,
      overloadedPeriods,
      neglectedCategories: neglectedCategories.slice(0, 6),
      lastNDays,
    },
    monthlyObjectives: { active: activeObjs, neglected: neglectedObjs },
    health: {
      activePrograms,
      workoutProgramGuard,
      recentlyUsedPrebuiltPrograms: prebuiltUsed,
      suggestedProgramOpportunity,
      profileGoal,
    },
    routines: {
      morningEnabled: routineSchedule?.enabledMorning !== false,
      nightEnabled: routineSchedule?.enabledNight !== false,
    },
    habits: { missedRecent: missedHabits.slice(0, 8) },
    notes: { snippet, moodToday: null },
    recommendationSeeds: seeds.filter(Boolean).slice(0, 14),
  };
}

export function formatCoachContextForApi(ctx: CoachContext): string {
  const lines: string[] = [];
  lines.push("=== COACH_CONTEXT (structured; use for pacing + specificity) ===");
  lines.push(`now_iso=${ctx.now} time_band=${ctx.timeOfDay} local_view_day=${ctx.coachViewDayKey} real_today=${ctx.realTodayKey} pacing_view=${ctx.pacingAppliesToViewDay}`);
  lines.push(
    `today_tasks: total=${ctx.today.totalTasks} done=${ctx.today.completedTasks} open=${ctx.today.remainingTasks} overdue=${ctx.today.overdueTasks} rate=${ctx.today.completionRate}% on_pace=${ctx.today.isOnPace}`
  );
  lines.push(`pacing: ${ctx.today.schedulePacingNote}`);
  lines.push(`dominant_categories=${ctx.today.dominantTaskTypes.join(", ")} open_energy=${ctx.today.dominantEnergyLevel || "n/a"} upcoming_heavy_open=${ctx.today.upcomingHeavyOpen}`);
  lines.push(`yesterday: ${ctx.yesterday.summary}`);
  lines.push(`recent_trend: ${ctx.recentPatterns.completionTrend}`);
  if (ctx.recentPatterns.recurringGaps.length) lines.push(`gaps: ${ctx.recentPatterns.recurringGaps.join(" | ")}`);
  if (ctx.recentPatterns.overloadedPeriods.length) lines.push(`load: ${ctx.recentPatterns.overloadedPeriods.join(" | ")}`);
  if (ctx.monthlyObjectives.active.length) {
    lines.push(
      `monthly_active: ${JSON.stringify(
        ctx.monthlyObjectives.active.map((o) => ({
          id: o.id,
          title: o.title,
          has_task_today: o.hasScheduledTaskToday,
          last_touch: o.lastTouchedAt || null,
          next: o.suggestedNextAction,
        }))
      )}`
    );
  }
  if (ctx.monthlyObjectives.neglected.length) {
    lines.push(`monthly_neglected: ${JSON.stringify(ctx.monthlyObjectives.neglected)}`);
  }
  if (ctx.health.activePrograms.length) lines.push(`health_programs: ${JSON.stringify(ctx.health.activePrograms)}`);
  if (ctx.health.workoutProgramGuard?.length) {
    lines.push(
      `saved_program_uniqueness_guard: ${JSON.stringify(
        ctx.health.workoutProgramGuard.map((g) => ({
          id: g.id,
          name: g.name,
          fingerprint: g.fingerprint,
          sample_lines: g.sampleLines,
        }))
      )}. Any new ADD_WORKOUT_PROGRAM or workoutProgram on ADD_TASK must use a DIFFERENT exercise fingerprint than these rows (new lifts; not a reorder or synonym swap of the same session). Read the user's specific training ask and health_training; do not clone their saved programs.`
    );
  }
  if (ctx.health.recentlyUsedPrebuiltPrograms.length)
    lines.push(`prebuilt_program_touchpoints: ${JSON.stringify(ctx.health.recentlyUsedPrebuiltPrograms)}`);
  if (ctx.health.suggestedProgramOpportunity) lines.push(`health_opportunity: ${ctx.health.suggestedProgramOpportunity}`);
  if (ctx.habits.missedRecent.length) lines.push(`habit_gaps: ${ctx.habits.missedRecent.join("; ")}`);
  if (ctx.notes.snippet) lines.push(`notes_snippet: ${ctx.notes.snippet}`);
  lines.push(`recommendation_seeds: ${JSON.stringify(ctx.recommendationSeeds)}`);
  return lines.join("\n").slice(0, 8000);
}
