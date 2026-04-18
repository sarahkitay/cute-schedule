import type { CoachIntelligenceSnapshot } from "./types";
import type { PatternShape, TaskLite } from "./intelligence";
import { normalizeTimeKey, pickInsertionHourKey } from "./taskInsertion";
import { COACH_SUGGESTION_SOURCE, type CoachSuggestionV2, type NormalizedCoachResult } from "./types";

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function suggestWindDown(
  categories: string[],
  todayHours: Record<string, unknown>,
  intel: CoachIntelligenceSnapshot
): CoachSuggestionV2 | null {
  if (intel.timeOfDay !== "evening" && intel.timeOfDay !== "late-night") return null;
  if (intel.heavyOpen === 0 && intel.eveningHeavyCount === 0) return null;
  const cat = categories.includes("Personal") ? "Personal" : categories[0] || "Personal";
  const start = intel.timeOfDay === "late-night" ? "21:30" : "21:00";
  const hour = pickInsertionHourKey(start, todayHours);
  return {
    id: newId(),
    type: "ADD_TASK",
    title: "10-minute brain dump + set first tomorrow step",
    description: "Paper or notes app: unload loops, name one first move for morning.",
    reason: "Late band still has weight; closing open loops lowers activation before sleep.",
    category: cat,
    energyLevel: "LIGHT",
    start: normalizeTimeKey(start),
    end: null,
    durationMinutes: 10,
    recurring: false,
    confidence: 0.72,
    requiresApproval: true,
    source: COACH_SUGGESTION_SOURCE,
    hour,
    targetTaskId: null,
  };
}

function suggestMorningAnchor(
  categories: string[],
  todayHours: Record<string, unknown>,
  intel: CoachIntelligenceSnapshot
): CoachSuggestionV2 | null {
  if (intel.timeOfDay !== "morning") return null;
  if (intel.morningHeavyCount < 1) return null;
  const cat = categories.includes("Personal") ? "Personal" : categories[0] || "Personal";
  const start = "08:00";
  const hour = pickInsertionHourKey(start, todayHours);
  return {
    id: newId(),
    type: "ADD_TASK",
    title: "5-minute clothes / bag prep",
    description: "Lower first-block friction before the first heavy task.",
    reason: "Morning still carries heavy work; a tiny prep block reduces activation energy.",
    category: cat,
    energyLevel: "LIGHT",
    start: normalizeTimeKey(start),
    end: null,
    durationMinutes: 5,
    recurring: false,
    confidence: 0.68,
    requiresApproval: true,
    source: COACH_SUGGESTION_SOURCE,
    hour,
    targetTaskId: null,
  };
}

function suggestBuffer(intel: CoachIntelligenceSnapshot, categories: string[], todayHours: Record<string, unknown>): CoachSuggestionV2 | null {
  if (intel.heavyOpen < 2) return null;
  const cat = categories[0] || "Personal";
  const start = intel.timeOfDay === "afternoon" ? "14:30" : "11:00";
  const hour = pickInsertionHourKey(start, todayHours);
  return {
    id: newId(),
    type: "BREAK",
    title: "15-minute recovery buffer",
    description: "No new inputs — walk, water, or stare out a window.",
    reason: "Multiple heavy items still open; spacing protects sustainable pace.",
    category: cat,
    energyLevel: "LIGHT",
    start: normalizeTimeKey(start),
    end: null,
    durationMinutes: 15,
    recurring: false,
    confidence: 0.7,
    requiresApproval: true,
    source: COACH_SUGGESTION_SOURCE,
    hour,
    targetTaskId: null,
  };
}

export function generateCoachV2Fallback(input: {
  emotionalState: string;
  completed: number;
  total: number;
  tasks: TaskLite[];
  timeOfDay: string;
  patterns: PatternShape;
  categories: string[];
  todayHours: Record<string, unknown>;
  intelligence: CoachIntelligenceSnapshot;
}): NormalizedCoachResult {
  const { emotionalState, completed, total, tasks, timeOfDay, intelligence } = input;
  const heavyUndone = tasks.filter((t) => !t.done && t.energyLevel === "HEAVY").length;
  const sortedHours = [...new Set(tasks.map((t) => t.hour).filter(Boolean))].sort();

  let message = "";
  let highlights: string[] = [];

  if (emotionalState === "overloaded") {
    message = `${heavyUndone} heavy item${heavyUndone === 1 ? "" : "s"} still open — the board is asking for sustained attention, not heroics.`;
    highlights = [
      `You are at ${completed}/${total} done today.`,
      intelligence.weakCategory
        ? `Historically, ${intelligence.weakCategory} tasks are easier to defer — shrink or move one, not all.`
        : "Tradeoff: keep one heavy, shrink one, or add a buffer between two.",
    ];
  } else if (emotionalState === "drained") {
    message =
      completed === 0
        ? `${total} task${total === 1 ? "" : "s"} on the board, none checked yet — that often reads as thin fuel, not lack of care.`
        : `${completed} of ${total} moved — quiet progress still shifts the shape of the day.`;
    highlights = ["Pick one visible 5-minute starter; completion is optional.", `Current band: ${timeOfDay}.`];
  } else if (emotionalState === "avoidant") {
    message =
      heavyUndone >= 1
        ? `Heavy work is still waiting while the list stays small — that usually signals friction on the first slice, not capacity.`
        : "Small lists can still feel sticky when the next step is fuzzy.";
    highlights = ["Name the smallest physical first action (open doc, one sentence, one tab)."];
  } else if (emotionalState === "closing") {
    message = "Late band: closure beats expansion.";
    highlights = ["Protect sleep pressure; only tiny loops if you want them."];
  } else if (total === 0) {
    message = "No tasks on today's board yet.";
    highlights = ["One anchor block makes the rest of the day easier to hold."];
  } else {
    message = `${completed}/${total} complete${sortedHours.length ? ` across ${sortedHours.length} block${sortedHours.length === 1 ? "" : "s"}` : ""}.`;
    highlights = [`Best historical completion window: ${intelligence.bestTimeWindow || "not enough data yet"}.`];
  }

  if (intelligence.noteSnippet) {
    highlights.push(`Notes in play: ${intelligence.noteSnippet.slice(0, 160)}${intelligence.noteSnippet.length > 160 ? "…" : ""}`);
  }

  const suggestions: CoachSuggestionV2[] = [];
  const a = suggestWindDown(input.categories, input.todayHours, intelligence);
  const b = suggestMorningAnchor(input.categories, input.todayHours, intelligence);
  const c = suggestBuffer(intelligence, input.categories, input.todayHours);
  if (a) suggestions.push(a);
  if (b) suggestions.push(b);
  if (c && suggestions.length < 2) suggestions.push(c);

  const followUp =
    emotionalState === "closing"
      ? null
      : "What is the single next move that would make the rest of today feel honest?";

  return {
    message,
    insight: highlights[0] || null,
    highlights,
    followUp,
    suggestions: suggestions.slice(0, 3),
    ignoredMonthlies: [],
    percentSummary: total > 0 ? `${completed}/${total} completed` : "",
  };
}
