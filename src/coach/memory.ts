import type { CoachEnergy, CoachFeedbackEvent, CoachLearningStateV1, CoachSuggestionType } from "./types";

const KEY = "cute_schedule_coach_learning_v1";

function nowIso() {
  return new Date().toISOString();
}

export function defaultCoachLearning(): CoachLearningStateV1 {
  return {
    version: 1,
    updatedAt: nowIso(),
    acceptedByType: {},
    declinedByType: {},
    acceptedByCategory: {},
    declinedByCategory: {},
    acceptedByEnergy: {},
    declinedByEnergy: {},
    editedAcceptCount: 0,
    straightAcceptCount: 0,
    eveningSoftBias: 0.35,
    lowActivationBias: 0.35,
    recentFeedback: [],
    completedCoachByType: {},
    completedCoachEdited: 0,
    completedCoachStraight: 0,
    abandonedCoachByType: {},
    postponedCoachByType: {},
  };
}

export function loadCoachLearning(): CoachLearningStateV1 {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultCoachLearning();
    const p = JSON.parse(raw) as Partial<CoachLearningStateV1>;
    if (p?.version !== 1) return defaultCoachLearning();
    const base = defaultCoachLearning();
    return {
      ...base,
      ...p,
      recentFeedback: Array.isArray(p.recentFeedback) ? p.recentFeedback.slice(-20) : [],
      acceptedByType: { ...base.acceptedByType, ...p.acceptedByType },
      declinedByType: { ...base.declinedByType, ...p.declinedByType },
      acceptedByCategory: { ...base.acceptedByCategory, ...p.acceptedByCategory },
      declinedByCategory: { ...base.declinedByCategory, ...p.declinedByCategory },
      acceptedByEnergy: { ...base.acceptedByEnergy, ...p.acceptedByEnergy },
      declinedByEnergy: { ...base.declinedByEnergy, ...p.declinedByEnergy },
      completedCoachByType: { ...base.completedCoachByType, ...p.completedCoachByType },
      abandonedCoachByType: { ...base.abandonedCoachByType, ...p.abandonedCoachByType },
      postponedCoachByType: { ...base.postponedCoachByType, ...p.postponedCoachByType },
      completedCoachEdited: p.completedCoachEdited ?? base.completedCoachEdited,
      completedCoachStraight: p.completedCoachStraight ?? base.completedCoachStraight,
    };
  } catch {
    return defaultCoachLearning();
  }
}

export function saveCoachLearning(state: CoachLearningStateV1) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
  } catch {
    /* ignore quota */
  }
}

function bump(rec: Record<string, number>, k: string, n = 1) {
  if (!k) return;
  rec[k] = (rec[k] || 0) + n;
}

export function recordSuggestionAccepted(
  prev: CoachLearningStateV1,
  rec: {
    type: CoachSuggestionType;
    category: string;
    energyLevel: CoachEnergy;
    edited: boolean;
    titleLower: string;
  }
): CoachLearningStateV1 {
  const next = { ...prev, updatedAt: nowIso() };
  bump(next.acceptedByType, rec.type, 1);
  bump(next.acceptedByCategory, rec.category, 1);
  bump(next.acceptedByEnergy, rec.energyLevel, 1);
  if (rec.edited) next.editedAcceptCount += 1;
  else next.straightAcceptCount += 1;
  if (rec.energyLevel === "LIGHT" || rec.type === "BREAK") {
    next.lowActivationBias = Math.min(0.92, next.lowActivationBias + 0.04);
  }
  if (/wind|down|close|night|bed|tomorrow|reset|journal|buffer/i.test(rec.titleLower)) {
    next.eveningSoftBias = Math.min(0.95, next.eveningSoftBias + 0.03);
  }
  const ev: CoachFeedbackEvent = {
    at: nowIso(),
    action: rec.edited ? "accept_edited" : "accept",
    type: rec.type,
    title: rec.titleLower.slice(0, 80),
  };
  next.recentFeedback = [...(next.recentFeedback || []).slice(-14), ev];
  saveCoachLearning(next);
  return next;
}

export function recordSuggestionDeclined(
  prev: CoachLearningStateV1,
  rec: { type: CoachSuggestionType; category: string; energyLevel: CoachEnergy; title?: string }
): CoachLearningStateV1 {
  const next = { ...prev, updatedAt: nowIso() };
  bump(next.declinedByType, rec.type, 1);
  bump(next.declinedByCategory, rec.category, 1);
  bump(next.declinedByEnergy, rec.energyLevel, 1);
  if (rec.energyLevel === "HEAVY") {
    next.lowActivationBias = Math.min(0.95, next.lowActivationBias + 0.02);
  }
  const ev: CoachFeedbackEvent = {
    at: nowIso(),
    action: "decline",
    type: rec.type,
    title: String(rec.title || "").slice(0, 80),
  };
  next.recentFeedback = [...(next.recentFeedback || []).slice(-14), ev];
  saveCoachLearning(next);
  return next;
}

function pushFeedback(next: CoachLearningStateV1, ev: CoachFeedbackEvent) {
  next.recentFeedback = [...(next.recentFeedback || []).slice(-12), ev];
}

export function recordCoachSuggestedTaskCompleted(
  prev: CoachLearningStateV1,
  rec: {
    type: string;
    edited: boolean;
    category: string;
    energyLevel: CoachEnergy;
    titleSnippet: string;
  }
): CoachLearningStateV1 {
  const next = { ...prev, updatedAt: nowIso() };
  bump(next.completedCoachByType, rec.type || "ADD_TASK", 1);
  if (rec.edited) next.completedCoachEdited += 1;
  else next.completedCoachStraight += 1;
  if (rec.energyLevel === "LIGHT" || rec.type === "BREAK") {
    next.lowActivationBias = Math.min(0.95, next.lowActivationBias + 0.02);
  }
  if (/wind|down|close|night|bed|tomorrow|reset|journal|buffer|brain dump|slice/i.test(rec.titleSnippet)) {
    next.eveningSoftBias = Math.min(0.96, next.eveningSoftBias + 0.02);
  }
  pushFeedback(next, {
    at: nowIso(),
    action: "complete",
    type: rec.type,
    title: rec.titleSnippet.slice(0, 80),
  });
  saveCoachLearning(next);
  return next;
}

export function recordCoachSuggestedTaskAbandoned(
  prev: CoachLearningStateV1,
  rec: { type: string; titleSnippet: string }
): CoachLearningStateV1 {
  const next = { ...prev, updatedAt: nowIso() };
  bump(next.abandonedCoachByType, rec.type || "ADD_TASK", 1);
  if (/wind|down|close|night|bed|tomorrow|reset|journal|buffer|brain dump/i.test(rec.titleSnippet)) {
    next.eveningSoftBias = Math.max(0.15, next.eveningSoftBias - 0.025);
  }
  pushFeedback(next, {
    at: nowIso(),
    action: "abandon",
    type: rec.type,
    title: rec.titleSnippet.slice(0, 80),
  });
  saveCoachLearning(next);
  return next;
}

export function recordCoachSuggestedTaskPostponed(
  prev: CoachLearningStateV1,
  rec: { type: string; titleSnippet: string }
): CoachLearningStateV1 {
  const next = { ...prev, updatedAt: nowIso() };
  bump(next.postponedCoachByType, rec.type || "ADD_TASK", 1);
  pushFeedback(next, {
    at: nowIso(),
    action: "postpone",
    type: rec.type,
    title: rec.titleSnippet.slice(0, 80),
  });
  saveCoachLearning(next);
  return next;
}

/** Short block for the model — product-local, not personal surveillance */
export function summarizeLearningForPrompt(s: CoachLearningStateV1): string {
  const topAccepted = Object.entries(s.acceptedByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  const topDeclined = Object.entries(s.declinedByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  const rf = (s.recentFeedback || [])
    .slice(-5)
    .map((e) => `${e.action}:${e.type}`)
    .join(", ");
  const comp = Object.entries(s.completedCoachByType || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  const aband = Object.entries(s.abandonedCoachByType || {})
    .reduce((n, [, v]) => n + (v || 0), 0);
  const postp = Object.entries(s.postponedCoachByType || {}).reduce((n, [, v]) => n + (v || 0), 0);
  const parts = [
    `Coach memory (behavioral, local only):`,
    `evening_soft_bias=${s.eveningSoftBias.toFixed(2)} low_activation_bias=${s.lowActivationBias.toFixed(2)}`,
    rf ? `recent_decisions: ${rf}` : "",
    topAccepted ? `accepted_types: ${topAccepted}` : "",
    topDeclined ? `declined_types: ${topDeclined}` : "",
    s.straightAcceptCount + s.editedAcceptCount > 0
      ? `accepts_straight=${s.straightAcceptCount} accepts_edited=${s.editedAcceptCount}`
      : "",
    comp ? `coach_tasks_completed_by_type: ${comp}` : "",
    (s.completedCoachEdited || 0) + (s.completedCoachStraight || 0) > 0
      ? `coach_done_edited=${s.completedCoachEdited} coach_done_straight=${s.completedCoachStraight}`
      : "",
    aband ? `coach_tasks_abandoned_total=${aband}` : "",
    postp ? `coach_tasks_postponed_total=${postp}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}
