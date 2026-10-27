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

export enum Equipment {
  Barbell = 'barbell',
  Dumbbell = 'dumbbell',
  Machine = 'machine',
  Cable = 'cable',
  Bodyweight = 'bodyweight',
  Kettlebell = 'kettlebell',
  Bands = 'bands',
  /** A single weight plate, like the ones loaded on a barbell. */
  Disk = 'disk',
  Other = 'other',
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  /** What it can be done with, at least one (e.g. barbell and dumbbell). */
  equipment: Equipment[];
  description?: string;
  createdAt: string;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment[];
  description?: string;
}

export type UpdateExerciseRequest = Partial<CreateExerciseRequest>;
