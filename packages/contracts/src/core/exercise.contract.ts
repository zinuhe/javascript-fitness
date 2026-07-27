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
  Other = 'other',
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  description?: string;
  createdAt: string;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  description?: string;
}

export type UpdateExerciseRequest = Partial<CreateExerciseRequest>;
