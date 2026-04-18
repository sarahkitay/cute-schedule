export const COACH_SUGGESTION_SOURCE = "coach_v2" as const;

export type CoachEnergy = "LIGHT" | "MEDIUM" | "HEAVY";

export type CoachSuggestionType =
  | "ADD_TASK"
  | "REORDER"
  | "TIMEBOX"
  | "BREAK"
  | "SPLIT_TASK"
  | "DEFER";

export interface CoachSuggestionV2 {
  id: string;
  type: CoachSuggestionType;
  title: string;
  description?: string | null;
  reason: string;
  category: string;
  energyLevel: CoachEnergy;
  /** Primary slot (HH:MM) */
  start: string;
  end?: string | null;
  durationMinutes: number;
  recurring: boolean;
  confidence: number;
  requiresApproval: boolean;
  source: typeof COACH_SUGGESTION_SOURCE;
  /** Convenience for schedule keys */
  hour: string;
  targetTaskId?: string | null;
}

export interface NormalizedCoachResult {
  message: string;
  insight: string | null;
  highlights: string[];
  followUp: string | null;
  /** Legacy API field; prefer followUp */
  question?: string | null;
  suggestions: CoachSuggestionV2[];
  ignoredMonthlies: { id?: string; text: string }[];
  percentSummary: string;
}

export type CoachFeedbackEvent = {
  at: string;
  action: "accept" | "accept_edited" | "decline" | "complete" | "abandon" | "postpone";
  type: string;
  title: string;
};

export interface CoachLearningStateV1 {
  version: 1;
  updatedAt: string;
  acceptedByType: Record<string, number>;
  declinedByType: Record<string, number>;
  acceptedByCategory: Record<string, number>;
  declinedByCategory: Record<string, number>;
  acceptedByEnergy: Record<string, number>;
  declinedByEnergy: Record<string, number>;
  editedAcceptCount: number;
  straightAcceptCount: number;
  eveningSoftBias: number;
  lowActivationBias: number;
  /** Last few accept/decline decisions (titles only, no free-text storage of chats) */
  recentFeedback: CoachFeedbackEvent[];
  /** Coach-suggested tasks that were completed (keyed by sourceSuggestionType) */
  completedCoachByType: Record<string, number>;
  /** Completed same day, edited vs straight accept */
  completedCoachEdited: number;
  completedCoachStraight: number;
  /** Coach tasks removed while still incomplete (deleted, not moved) */
  abandonedCoachByType: Record<string, number>;
  /** Rescheduled (time change or moved to tomorrow) while still open */
  postponedCoachByType: Record<string, number>;
}

export interface CoachIntelligenceSnapshot {
  emotionalState: string;
  timeOfDay: string;
  heavyOpen: number;
  mediumOpen: number;
  lightOpen: number;
  totalTasks: number;
  doneTasks: number;
  completionPct: number;
  bestTimeWindow: string | null;
  weakCategory: string | null;
  eveningHeavyCount: number;
  morningHeavyCount: number;
  noteSnippet: string | null;
  learningSummary: string;
}
