import type { CreateWorkoutRequest, Workout } from '@fitness/contracts';

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
  deleteForUser(id: string, userId: string): Promise<boolean>;
  /** All sets a user has logged for a given exercise, oldest first. */
  findSetHistory(userId: string, exerciseId: string): Promise<SetHistoryRow[]>;
}

export const WORKOUT_REPOSITORY = Symbol('WORKOUT_REPOSITORY');
