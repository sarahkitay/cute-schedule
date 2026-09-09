export function objectiveMonthKey(d?: Date): string;
export function priorObjectiveMonthKey(monthKey: string): string;
export function formatObjectiveMonthLabel(monthKey: string): string;
export function getPendingCarryObjectives(monthly: unknown[], currentMonthKey: string): unknown[];
export function getVisibleMonthObjectives(monthly: unknown[], monthKey: string): unknown[];
export function getObjectivesForMonth(monthly: unknown[], monthKey: string): unknown[];
export function listObjectiveMonthKeys(monthly: unknown[], currentMonthKey: string): string[];
export function carryMonthlyObjective(
  monthly: unknown[],
  id: string,
  toMonthKey: string,
  newId: string
): unknown[];
export function autoCarryPendingMonthlyObjectives(
  monthly: unknown[],
  currentMonthKey: string,
  makeId: () => string
): { monthly: unknown[]; carriedIds: string[] };
export function getMonthEndReviewObjectives(monthly: unknown[], currentMonthKey: string): unknown[];
export function keepCarriedMonthlyObjective(monthly: unknown[], id: string): unknown[];
export function letGoCarriedMonthlyObjective(monthly: unknown[], id: string): unknown[];
export function leaveMonthlyObjectiveInPriorMonth(monthly: unknown[], id: string): unknown[];
export function completeMonthlyObjectiveUnmarked(monthly: unknown[], id: string): unknown[];
export function filterMonthlyForCoach(
  monthly: unknown[],
  realTodayKey: string
): { id?: string; text?: string; done?: boolean; monthKey?: string }[];
