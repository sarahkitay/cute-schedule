import type { CoachContext } from "./coachContext";
import type { NormalizedCoachResult } from "./types";

const GENERIC_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\byou have a lot on your plate\b/i, label: "lot_on_plate" },
  { re: /\btry breaking tasks into smaller steps\b/i, label: "smaller_steps" },
  { re: /\bconsider taking a break\b/i, label: "take_break" },
  { re: /\bstay consistent\b/i, label: "stay_consistent" },
  { re: /\bprioritize your tasks\b/i, label: "prioritize_tasks" },
  { re: /\byou may feel overwhelmed\b/i, label: "feel_overwhelmed" },
  { re: /\bonly one task (?:has been |is )?completed\b/i, label: "only_one_done" },
  { re: /\bonly \d+ tasks? (?:have been |is )?completed\b/i, label: "low_done_count" },
  { re: /\bfocus on what matters\b/i, label: "focus_matters" },
  { re: /\bthis suggests overwhelm\b/i, label: "suggests_overwhelm" },
];

function collectAnchors(ctx: CoachContext | null | undefined): string[] {
  if (!ctx) return [];
  const out: string[] = [];
  for (const t of ctx.recommendationSeeds || []) {
    const s = String(t || "").trim();
    if (s) out.push(s);
  }
  for (const o of ctx.monthlyObjectives?.active || []) {
    if (o.title) out.push(o.title);
  }
  for (const o of ctx.monthlyObjectives?.neglected || []) {
    if (o.title) out.push(o.title);
  }
  for (const s of ctx.today?.dominantTaskTypes || []) out.push(s);
  if (ctx.yesterday?.summary) out.push(ctx.yesterday.summary);
  if (ctx.today?.schedulePacingNote) out.push(ctx.today.schedulePacingNote);
  if (ctx.health?.suggestedProgramOpportunity) out.push(ctx.health.suggestedProgramOpportunity);
  return out;
}

/** True if text shares a substantive token with anchors (length >= 4) or contains schedule-like numbers. */
function fragmentAnchored(fragment: string, anchors: string[]): boolean {
  const f = fragment.toLowerCase();
  if (/\b\d{1,2}:\d{2}\b/.test(f)) return true;
  if (/\b\d+\s*(min|minutes|hr|hour)\b/i.test(f)) return true;
  if (/\b(am|pm|morning|afternoon|evening)\b/i.test(f) && /\d/.test(f)) return true;

  const anchorBlob = anchors.join(" ").toLowerCase();
  const words = f.split(/[^a-z0-9]+/i).filter((w) => w.length >= 4);
  for (const w of words) {
    if (anchorBlob.includes(w)) return true;
  }
  return false;
}

export type CoachSpecificityAudit = {
  ok: boolean;
  violations: string[];
  revisedMessage?: string;
};

/**
 * If the model leaned on generic productivity lines without anchoring to user data, prepend a pacing correction.
 */
export function auditCoachSpecificity(message: string, ctx: CoachContext | null | undefined): CoachSpecificityAudit {
  const text = String(message || "").trim();
  if (!text) return { ok: true, violations: [] };

  const violations: string[] = [];
  const anchors = collectAnchors(ctx);

  for (const { re, label } of GENERIC_PATTERNS) {
    if (re.test(text)) {
      if (!fragmentAnchored(text, anchors)) violations.push(label);
    }
  }

  if (!violations.length) return { ok: true, violations: [] };

  const pacing = ctx?.today?.schedulePacingNote?.trim();
  const prefix =
    pacing && pacing.length > 0
      ? `${pacing} `
      : ctx?.today?.isOnPace
        ? "From your calendar and clock, nothing is behind yet. "
        : "";

  const stripped = text.replace(/\s+/g, " ").trim();
  const revisedMessage = `${prefix}${stripped}`.trim();

  return {
    ok: false,
    violations,
    revisedMessage,
  };
}

export function applyCoachSpecificityToResult(
  result: NormalizedCoachResult,
  ctx: CoachContext | null | undefined
): NormalizedCoachResult {
  const audit = auditCoachSpecificity(result.message, ctx);
  if (audit.ok || !audit.revisedMessage) return result;
  return {
    ...result,
    message: audit.revisedMessage,
    highlights: Array.isArray(result.highlights) ? result.highlights : [],
  };
}
