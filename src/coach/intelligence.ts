import type { CoachIntelligenceSnapshot, CoachLearningStateV1 } from "./types";
import { summarizeLearningForPrompt } from "./memory";

export type PatternShape = {
  bestTime?: string | null;
  leastCompletedCategory?: string | null;
  todayCompletions?: number;
  totalCompletions?: number;
};

export type TaskLite = {
  hour: string;
  category: string;
  text?: string;
  done?: boolean;
  energyLevel?: string;
};

function hourBand(h: string): "morning" | "afternoon" | "evening" | "late" {
  const [hh] = h.split(":").map(Number);
  if (hh < 12) return "morning";
  if (hh < 17) return "afternoon";
  if (hh < 21) return "evening";
  return "late";
}

function extractNoteSnippet(notes: { text?: string }[], maxLen = 220): string | null {
  const texts = notes
    .map((n) => String(n?.text || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!texts.length) return null;
  const joined = texts.join(" | ").slice(0, maxLen);
  return joined || null;
}

export function buildCoachIntelligenceSnapshot(input: {
  emotionalState: string;
  timeOfDay: string;
  tasks: TaskLite[];
  patterns: PatternShape;
  notes: { text?: string }[];
  learning: CoachLearningStateV1;
}): CoachIntelligenceSnapshot {
  const open = input.tasks.filter((t) => !t.done);
  const heavyOpen = open.filter((t) => t.energyLevel === "HEAVY").length;
  const mediumOpen = open.filter((t) => t.energyLevel === "MEDIUM" || !t.energyLevel).length;
  const lightOpen = open.filter((t) => t.energyLevel === "LIGHT").length;
  const total = input.tasks.length;
  const done = input.tasks.filter((t) => t.done).length;
  const eveningHeavy = open.filter((t) => t.energyLevel === "HEAVY" && hourBand(t.hour) !== "morning" && hourBand(t.hour) !== "afternoon").length;
  const morningHeavy = open.filter((t) => t.energyLevel === "HEAVY" && hourBand(t.hour) === "morning").length;

  return {
    emotionalState: input.emotionalState,
    timeOfDay: input.timeOfDay,
    heavyOpen,
    mediumOpen,
    lightOpen,
    totalTasks: total,
    doneTasks: done,
    completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    bestTimeWindow: input.patterns?.bestTime || null,
    weakCategory: input.patterns?.leastCompletedCategory || null,
    eveningHeavyCount: eveningHeavy,
    morningHeavyCount: morningHeavy,
    noteSnippet: extractNoteSnippet(input.notes),
    learningSummary: summarizeLearningForPrompt(input.learning),
  };
}

export function formatIntelligenceForApi(s: CoachIntelligenceSnapshot): string {
  return [
    "Derived signals (client, for grounding only):",
    `load_state=${s.emotionalState} local_time_band=${s.timeOfDay}`,
    `open_tasks: heavy=${s.heavyOpen} medium=${s.mediumOpen} light=${s.lightOpen} done=${s.doneTasks}/${s.totalTasks} (${s.completionPct}%)`,
    s.bestTimeWindow ? `historical_best_completion_window=${s.bestTimeWindow}` : "",
    s.weakCategory ? `historical_weaker_category=${s.weakCategory}` : "",
    `late_band_heavy_open=${s.eveningHeavyCount} morning_heavy_open=${s.morningHeavyCount}`,
    s.noteSnippet ? `recent_notes: ${s.noteSnippet}` : "",
    s.learningSummary,
  ]
    .filter(Boolean)
    .join("\n");
}
