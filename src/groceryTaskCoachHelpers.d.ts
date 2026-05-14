/**
 * Ambient types for `groceryTaskCoachHelpers.js`. Expand when new TS imports are added.
 */

/** Flattened task row from `listMergedTasksForDay` (subscription synthetics included). */
export type MergedDayTask = {
  id?: string;
  text?: string;
  done?: boolean;
  hour?: string;
  category?: string;
  energyLevel?: string;
  isSubscription?: boolean;
  [key: string]: unknown;
};

export function listMergedTasksForDay(
  days: Record<string, unknown>,
  dayKey: string,
  subscriptions: unknown[],
  categories: string[]
): MergedDayTask[];
