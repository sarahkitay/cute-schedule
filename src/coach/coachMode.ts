export type CoachReasoningMode =
  | "schedule_check"
  | "missing_from_schedule"
  | "monthly_objective_alignment"
  | "health_programming"
  | "momentum_recovery"
  | "overwhelm_prevention"
  | "daily_planning"
  | "weekly_review"
  | "general_coaching";

/**
 * Classify the user's question for prompt routing (server + client).
 * Heuristic keyword buckets; default general_coaching.
 */
export function inferCoachReasoningMode(userQuestion: string | null | undefined): CoachReasoningMode {
  const q = String(userQuestion || "")
    .trim()
    .toLowerCase();
  if (!q) return "general_coaching";

  if (/\b(week|weekly|last seven|7 days|seven days)\b/.test(q) && /\b(review|retro|look back)\b/.test(q)) return "weekly_review";
  if (/\b(last few days|past few days|recently|lately|this week|few days)\b/.test(q) && /\b(missing|lack|absent|haven't|have not|gone|where)\b/.test(q))
    return "missing_from_schedule";
  if (/\b(behind|on track|on pace|ahead|catch up)\b/.test(q)) return "schedule_check";
  if (/\b(monthly|objective|goal for the month|okr)\b/.test(q)) return "monthly_objective_alignment";
  // Training / body before loose "yesterday" routing so gym questions are not misclassified as schedule-audit.
  if (
    /\b(workout|gym|lift|lifting|program|training|strength|cardio|muscle|protein|macros|reps?|sets?|exercises?|routine|hypertrophy|bodybuilding|split|leg day|arm day|push day|pull day|upper body|lower body|full body|total body|core|abs|chest|back|shoulders?|biceps?|triceps?|glutes?|quads?|hamstrings?|calves|forearms?|delts|deadlift|squat|bench|row|press|pull-up|chin|machine|cable|dumbbell|barbell|kettlebell|mobility|stretch|warm[\s-]?up|pb|plates?|hiit|tabata|superset|dropset)\b/.test(
      q
    ) ||
    /\b(arms?|legs?|pecs?|lats?|traps?)\b/.test(q)
  ) {
    return "health_programming";
  }
  if (
    /\b(last few|past few|recent|lately|yesterday|previous days)\b/.test(q) &&
    /\b(schedule|calendar|tasks?|planned|blocked|missing|forgot|didn't plan|did not plan)\b/.test(q)
  ) {
    return "missing_from_schedule";
  }
  if (/\b(momentum|streak|slump|rut|stuck)\b/.test(q)) return "momentum_recovery";
  if (/\b(overwhelm|too much|can't cope|drowning|panic)\b/.test(q)) return "overwhelm_prevention";

  /** User listed several concrete to-dos (comma / and / semicolon) they want placed today. */
  const multiItemCue =
    (q.match(/\b(and|,|;)\b/g) || []).length >= 2 &&
    q.length > 28 &&
    /\b(i have to|i've to|i need to|need to|have to|must|today|this morning|this afternoon|tonight|schedule|plan|slot|fit in|get done|chores|errands|homework|calls?)\b/.test(q);
  if (multiItemCue) return "daily_planning";

  if (/\b(today|this afternoon|tonight|plan my day|rest of the day)\b/.test(q)) return "daily_planning";

  return "general_coaching";
}
