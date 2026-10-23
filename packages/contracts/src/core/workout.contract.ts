import type { Exercise } from './exercise.contract';

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
 * given (omitted notes are cleared); an omitted `performedAt` or `routineDayId` is kept.
 */
export type UpdateWorkoutRequest = CreateWorkoutRequest;

/** Derived progress metrics for a given exercise over time. */
export interface ExerciseProgressPoint {
  performedAt: string;
  totalVolumeKg: number;
  estimatedOneRepMaxKg: number;
  bestSetWeightKg: number;
}

export interface ExerciseProgress {
  exerciseId: string;
  points: ExerciseProgressPoint[];
}

/** The sets of the most recent workout where the user did an exercise (`GET /workouts/last-sets`). */
export interface LastExerciseSets {
  exerciseId: string;
  performedAt: string;
  sets: CreateSetRequest[];
}
