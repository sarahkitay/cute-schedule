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
  if (/\b(last few|past few|recent|lately|yesterday|previous days)\b/.test(q)) return "missing_from_schedule";
  if (/\b(behind|on track|on pace|ahead|catch up)\b/.test(q)) return "schedule_check";
  if (/\b(monthly|objective|goal for the month|okr)\b/.test(q)) return "monthly_objective_alignment";
  if (/\b(workout|gym|lift|program|training|strength|cardio|muscle|protein|macros)\b/.test(q)) return "health_programming";
  if (/\b(momentum|streak|slump|rut|stuck)\b/.test(q)) return "momentum_recovery";
  if (/\b(overwhelm|too much|can't cope|drowning|panic)\b/.test(q)) return "overwhelm_prevention";
  if (/\b(today|this afternoon|tonight|plan my day|rest of the day)\b/.test(q)) return "daily_planning";

  return "general_coaching";
}
