export enum MuscleGroup {
  Chest = 'chest',
  Back = 'back',
  Shoulders = 'shoulders',
  Biceps = 'biceps',
  Triceps = 'triceps',
  Legs = 'legs',
  Glutes = 'glutes',
  Core = 'core',
  FullBody = 'full_body',
  Cardio = 'cardio',
}

/** Muscles an exercise works, fine-grained enough for the muscle map. */
export enum Muscle {
  Chest = 'chest',
  FrontDelts = 'front_delts',
  SideDelts = 'side_delts',
  RearDelts = 'rear_delts',
  Biceps = 'biceps',
  Triceps = 'triceps',
  Forearms = 'forearms',
  Abs = 'abs',
  Obliques = 'obliques',
  Traps = 'traps',
  Lats = 'lats',
  UpperBack = 'upper_back',
  LowerBack = 'lower_back',
  Glutes = 'glutes',
  Quads = 'quads',
  Hamstrings = 'hamstrings',
  Adductors = 'adductors',
  Abductors = 'abductors',
  Calves = 'calves',
}

export enum Equipment {
  Barbell = 'barbell',
  Dumbbell = 'dumbbell',
  Machine = 'machine',
  Cable = 'cable',
  Bodyweight = 'bodyweight',
  Kettlebell = 'kettlebell',
  Bands = 'bands',
  /** A single weight plate, like the ones loaded on a barbell. */
  Plate = 'plate',
  Other = 'other',
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  /** Worked mainly (bright on the muscle map). */
  primaryMuscles: Muscle[];
  /** Also worked (pale on the muscle map). */
  secondaryMuscles: Muscle[];
  /** What it can be done with, at least one (e.g. barbell and dumbbell). */
  equipment: Equipment[];
  description?: string;
  /** Pictures of the exercise, by slot; empty when it has none. */
  images: ExerciseImageRef[];
  createdAt: string;
}

/** Picture slots of an exercise: 1 is the one shown small (forms, lists), 2 an extra one. */
export const EXERCISE_IMAGE_SLOTS = [1, 2] as const;
export type ExerciseImageSlot = (typeof EXERCISE_IMAGE_SLOTS)[number];

/** Each image is kept in two renditions: a small one for lists and forms, a large one. */
export const EXERCISE_IMAGE_SIZES = ['thumb', 'large'] as const;
export type ExerciseImageSize = (typeof EXERCISE_IMAGE_SIZES)[number];

export interface ExerciseImageRef {
  slot: ExerciseImageSlot;
  /**
   * Changes whenever the image does. Image URLs carry it, so a browser may cache one
   * forever: `/api/media/exercises/{exerciseId}/{slot}/{size}?v={version}`.
   */
  version: string;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroup: MuscleGroup;
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  equipment: Equipment[];
  description?: string;
}

export type UpdateExerciseRequest = Partial<CreateExerciseRequest>;
