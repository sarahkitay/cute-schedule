export type CoachReasoningMode =
  | "schedule_check"
  | "missing_from_schedule"
  | "monthly_objective_alignment"
  | "health_programming"
  | "meal_planning"
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

  if (
    /\b(meal plan|meal prep|weekly menu|what to eat|menu for the week|grocery list|shopping list)\b/.test(q) ||
    (/\b(vegan|vegetarian|plant[- ]?based|macros?|protein)\b/.test(q) &&
      /\b(meal|eat|food|tofu|breakfast|lunch|dinner|snack|week)\b/.test(q)) ||
    /\b(\d+\s*g(?:rams?)?\s*(?:of\s*)?protein|protein\s*(?:per|a)\s*day)\b/.test(q)
  ) {
    return "meal_planning";
  }
  if (/\b(week|weekly|last seven|7 days|seven days)\b/.test(q) && /\b(review|retro|look back)\b/.test(q)) return "weekly_review";
  if (/\b(last few days|past few days|recently|lately|this week|few days)\b/.test(q) && /\b(missing|lack|absent|haven't|have not|gone|where)\b/.test(q))
    return "missing_from_schedule";
  if (/\b(behind|on track|on pace|ahead|catch up)\b/.test(q)) return "schedule_check";
  if (/\b(monthly|objective|goal for the month|okr)\b/.test(q)) return "monthly_objective_alignment";

  /** Full-day scheduling beats workout-only routing when they want everything on the calendar. */
  const dayBuildCue =
    /\b(put|add|schedule|slot|fit)\b[\s\S]{0,48}\b(on my schedule|on the schedule|on today|my schedule|my day|calendar|rest of (?:the )?day)\b/.test(
      q
    ) ||
    /\b(all of this|everything)\b[\s\S]{0,24}\b(schedule|today|calendar)\b/.test(q) ||
    /\b(can you|could you)\b[\s\S]{0,32}\b(put|add|schedule)\b[\s\S]{0,32}\b(schedule|today|calendar)\b/.test(q);
  const multiItemCue =
    (q.match(/\b(and|,|;)\b/g) || []).length >= 2 &&
    q.length > 28 &&
    /\b(i have to|i've to|i need to|i also need|need to|have to|must|today|this morning|this afternoon|tonight|schedule|plan|slot|fit in|get done|chores|errands|homework|calls?)\b/.test(
      q
    );
  if (dayBuildCue || multiItemCue) return "daily_planning";

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

  if (/\b(today|this afternoon|tonight|plan my day|rest of the day)\b/.test(q)) return "daily_planning";

  return "general_coaching";
}
