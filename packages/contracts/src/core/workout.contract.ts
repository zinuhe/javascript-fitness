import type { Equipment, Exercise } from './exercise.contract';

export interface WorkoutSet {
  id: string;
  order: number;
  reps: number;
  weightKg: number;
  rpe?: number;
  restSeconds?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exercise?: Exercise;
  /** Which of the exercise's equipment was used this time. */
  equipment?: Equipment;
  /** Barbell weight included in each set's weightKg (sets hold the total lifted). */
  barKg?: number;
  /** How many dumbbells were used (1 or 2), for dumbbell exercises. */
  dumbbells?: number;
  order: number;
  sets: WorkoutSet[];
}

/** The routine day a workout was started from (for labels such as "Pull · Day 2"). */
export interface WorkoutRoutineDay {
  id: string;
  routineId: string;
  routineName: string;
  /** Zero-based position of the day in its routine. */
  position: number;
  name?: string;
}

export interface Workout {
  id: string;
  userId: string;
  performedAt: string;
  notes?: string;
  routineDay?: WorkoutRoutineDay;
  exercises: WorkoutExercise[];
  createdAt: string;
}

export interface CreateSetRequest {
  reps: number;
  weightKg: number;
  rpe?: number;
  restSeconds?: number;
}

export interface CreateWorkoutExerciseRequest {
  exerciseId: string;
  /**
   * Which of the exercise's equipment was used. Required when the exercise has more than
   * one; filled in when it has only one.
   */
  equipment?: Equipment;
  /** Barbell weight already included in each set's weightKg; only with barbell. */
  barKg?: number;
  /** How many dumbbells (1 or 2); only with dumbbell, 2 when left out. */
  dumbbells?: number;
  sets: CreateSetRequest[];
}

export interface CreateWorkoutRequest {
  performedAt?: string;
  notes?: string;
  /** Routine day this session follows; advances the routine's rotation. */
  routineDayId?: string;
  exercises: CreateWorkoutExerciseRequest[];
}

/**
 * Full replacement of a workout (`PUT /workouts/:id`): notes and exercises are replaced as
 * given (omitted notes are cleared); an omitted `performedAt` or `routineDayId` is kept, and
 * `routineDayId: null` unlinks the workout from its routine day.
 */
export interface UpdateWorkoutRequest extends Omit<CreateWorkoutRequest, 'routineDayId'> {
  routineDayId?: string | null;
}

/** Derived progress metrics for a given exercise over time. */
export interface ExerciseProgressPoint {
  /** The workout of that session. */
  workoutId: string;
  performedAt: string;
  totalVolumeKg: number;
  estimatedOneRepMaxKg: number;
  bestSetWeightKg: number;
  /**
   * That session's sets of the exercise, in the order they were done. `weightKg` is the
   * total lifted; `barKg` is the bar included in it, for barbell sets.
   */
  sets: { reps: number; weightKg: number; barKg?: number }[];
}

export interface ExerciseProgress {
  exerciseId: string;
  points: ExerciseProgressPoint[];
}

/**
 * The sets of the most recent workout where the user did an exercise with a given equipment
 * (`GET /workouts/last-sets`): one entry per exercise and equipment used.
 */
export interface LastExerciseSets {
  exerciseId: string;
  equipment?: Equipment;
  /** Barbell weight included in the sets' weights, to show them as plates again. */
  barKg?: number;
  /** How many dumbbells were used that time. */
  dumbbells?: number;
  performedAt: string;
  sets: CreateSetRequest[];
}
