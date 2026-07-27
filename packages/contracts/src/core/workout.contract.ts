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

export interface Workout {
  id: string;
  userId: string;
  performedAt: string;
  notes?: string;
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
  exercises: CreateWorkoutExerciseRequest[];
}

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
