/**
 * Ambient types for `healthModel.js` (runtime source of truth).
 * TypeScript `.ts` files that import this module use these declarations.
 */

export type ExerciseBlock = {
  id?: string;
  name: string;
  setsReps?: string;
  weightNote?: string;
};

export function normalizeExerciseBlock(x: Record<string, unknown> | null | undefined): ExerciseBlock | null;

export function formatExerciseBlockLine(b: ExerciseBlock | null | undefined): string;

export function sanitizeCoachTypography(str: string): string;

export function fingerprintExerciseBlocksForDedupe(exercises: unknown[]): string;

export function draftWorkoutProgramLinesFromCue(cueLower: string): {
  name: string;
  exerciseLines: string[];
  reason?: string;
};

export function prepareCoachProgramForHealth(
  health: unknown,
  exercises: unknown[],
  name: string
): { exercises: ExerciseBlock[]; name: string; reuseExistingId: string | null };

export type ProgramLibraryEntry = {
  id: string;
  name: string;
  blurb?: string;
  exercises?: ReadonlyArray<Record<string, unknown>>;
};

export const PROGRAM_LIBRARY: readonly ProgramLibraryEntry[];
