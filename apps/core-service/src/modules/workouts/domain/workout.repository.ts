import type { CreateWorkoutRequest, UpdateWorkoutRequest, Workout } from '@fitness/contracts';

export interface CreateWorkoutData extends CreateWorkoutRequest {
  userId: string;
}

/** A single logged set joined with its performedAt date, used to compute progress. */
export interface SetHistoryRow {
  performedAt: Date;
  reps: number;
  weightKg: number;
}

export interface WorkoutRepository {
  create(data: CreateWorkoutData): Promise<Workout>;
  findByIdForUser(id: string, userId: string): Promise<Workout | null>;
  findManyForUser(
    userId: string,
    params: { skip: number; take: number },
  ): Promise<{ items: Workout[]; total: number }>;
  /**
   * Replaces the workout's date, notes and exercises (with their sets) atomically.
   * Returns null when the workout does not exist or belongs to another user.
   */
  replaceForUser(id: string, userId: string, data: UpdateWorkoutRequest): Promise<Workout | null>;
  deleteForUser(id: string, userId: string): Promise<boolean>;
  /** Returns the subset of `exerciseIds` that do not exist in the catalog. */
  findMissingExerciseIds(exerciseIds: string[]): Promise<string[]>;
  /** All sets a user has logged for a given exercise, oldest first. */
  findSetHistory(userId: string, exerciseId: string): Promise<SetHistoryRow[]>;
}

export const WORKOUT_REPOSITORY = Symbol('WORKOUT_REPOSITORY');
