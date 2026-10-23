import type { CreateRoutineRequest, Routine } from '@fitness/contracts';

/** Port for routine persistence. Every operation is scoped to the owning user. */
export interface RoutineRepository {
  findManyForUser(userId: string): Promise<Routine[]>;
  findByIdForUser(id: string, userId: string): Promise<Routine | null>;
  findActiveForUser(userId: string): Promise<Routine | null>;
  countForUser(userId: string): Promise<number>;
  create(userId: string, data: CreateRoutineRequest, isActive: boolean): Promise<Routine>;
  /**
   * Replaces name and days atomically. Days with an `id` are updated in place (keeping the
   * workouts linked to them), days without one are created, and missing days are deleted.
   * Returns null when the routine does not exist or belongs to another user.
   */
  replaceForUser(id: string, userId: string, data: CreateRoutineRequest): Promise<Routine | null>;
  deleteForUser(id: string, userId: string): Promise<boolean>;
  /** Makes this routine the user's only active one. Null when not found. */
  activateForUser(id: string, userId: string): Promise<Routine | null>;
  /** Returns the subset of `exerciseIds` that do not exist in the catalog. */
  findMissingExerciseIds(exerciseIds: string[]): Promise<string[]>;
  /** Day of the user's most recent workout that is linked to a day of this routine. */
  findLastPerformedDayId(routineId: string, userId: string): Promise<string | null>;
}

export const ROUTINE_REPOSITORY = Symbol('ROUTINE_REPOSITORY');
