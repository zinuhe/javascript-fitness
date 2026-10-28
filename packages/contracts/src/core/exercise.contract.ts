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
  createdAt: string;
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
