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
  /**
   * The bar (barbell), or one handle (heavy dumbbell), included in each set's weightKg: sets
   * hold the total lifted, `plates + barKg` or, with heavy dumbbells, `plates + barKg ×
   * dumbbells` (one handle per dumbbell).
   */
  barKg?: number;
  /**
   * How many dumbbells were used (1 or 2), for dumbbell or heavy dumbbell exercises. Dumbbell
   * weights are the total of all of them; with heavy dumbbells it also counts the handles.
   */
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
  /**
   * The bar, or one handle, already included in each set's weightKg (once per dumbbell for
   * heavy dumbbells); only with a barbell or a heavy dumbbell.
   */
  barKg?: number;
  /** How many dumbbells (1 or 2); only with a dumbbell or heavy dumbbell, 2 when left out. */
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
  /** What the exercise was done with that session, and how many dumbbells. */
  equipment?: Equipment;
  dumbbells?: number;
  totalVolumeKg: number;
  estimatedOneRepMaxKg: number;
  bestSetWeightKg: number;
  /**
   * That session's sets of the exercise, in the order they were done. `weightKg` is the
   * total lifted; `barKg` is the bar, or one handle, included in it (once per dumbbell for
   * heavy dumbbells: see `dumbbells`).
   */
  sets: { reps: number; weightKg: number; barKg?: number }[];
}

export interface ExerciseProgress {
  exerciseId: string;
  points: ExerciseProgressPoint[];
}

/** How many of the user's workouts include an exercise (`GET /workouts/exercise-counts`). */
export interface ExerciseSessionCount {
  exerciseId: string;
  sessions: number;
}

/**
 * The sets of the most recent workout where the user did an exercise with a given equipment
 * (`GET /workouts/last-sets`): one entry per exercise and equipment used.
 */
export interface LastExerciseSets {
  exerciseId: string;
  equipment?: Equipment;
  /**
   * The bar, or one handle (once per dumbbell), included in the sets' weights, to show them
   * as plates again.
   */
  barKg?: number;
  /** How many dumbbells were used that time. */
  dumbbells?: number;
  performedAt: string;
  sets: CreateSetRequest[];
}
