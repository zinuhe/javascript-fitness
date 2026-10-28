import type {
  CreateWorkoutRequest,
  Equipment,
  LastExerciseSets,
  UpdateWorkoutRequest,
  Workout,
} from '@fitness/contracts';

export interface CreateWorkoutData extends CreateWorkoutRequest {
  userId: string;
}

/** A single logged set joined with its performedAt date, used to compute progress. */
export interface SetHistoryRow {
  workoutId: string;
  performedAt: Date;
  reps: number;
  weightKg: number;
  /** The bar included in `weightKg`, for barbell sets. */
  barKg?: number;
}

export interface WorkoutRepository {
  create(data: CreateWorkoutData): Promise<Workout>;
  findByIdForUser(id: string, userId: string): Promise<Workout | null>;
  /** Newest first; `from`/`to` keep only workouts performed in `[from, to)`. */
  findManyForUser(
    userId: string,
    params: { skip: number; take: number; from?: Date; to?: Date },
  ): Promise<{ items: Workout[]; total: number }>;
  /**
   * Replaces the workout's date, notes and exercises (with their sets) atomically.
   * Returns null when the workout does not exist or belongs to another user.
   */
  replaceForUser(id: string, userId: string, data: UpdateWorkoutRequest): Promise<Workout | null>;
  deleteForUser(id: string, userId: string): Promise<boolean>;
  /** Equipment of each catalog exercise among `exerciseIds`; unknown ids are left out. */
  findExerciseEquipment(exerciseIds: string[]): Promise<Map<string, Equipment[]>>;
  /** Whether the routine day exists and belongs to one of the user's routines. */
  routineDayBelongsToUser(routineDayId: string, userId: string): Promise<boolean>;
  /**
   * Per exercise and equipment used, the sets of the user's most recent workout with them;
   * for each exercise, the most recent entry comes first.
   */
  findLastSets(userId: string, exerciseIds: string[]): Promise<LastExerciseSets[]>;
  /**
   * All sets a user has logged for a given exercise (only with `equipment`, when given), in
   * the order they were done.
   */
  findSetHistory(
    userId: string,
    exerciseId: string,
    equipment?: Equipment,
  ): Promise<SetHistoryRow[]>;
}

export const WORKOUT_REPOSITORY = Symbol('WORKOUT_REPOSITORY');
