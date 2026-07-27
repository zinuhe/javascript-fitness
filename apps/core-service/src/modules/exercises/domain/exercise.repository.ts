import type { Equipment, Exercise, MuscleGroup } from '@fitness/contracts';

export interface CreateExerciseData {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  description?: string;
}

export type UpdateExerciseData = Partial<CreateExerciseData>;

export interface ExerciseRepository {
  create(data: CreateExerciseData): Promise<Exercise>;
  findById(id: string): Promise<Exercise | null>;
  findMany(params: { skip: number; take: number }): Promise<{ items: Exercise[]; total: number }>;
  update(id: string, data: UpdateExerciseData): Promise<Exercise>;
  delete(id: string): Promise<void>;
  existsByNameAndEquipment(name: string, equipment: Equipment): Promise<boolean>;
}

export const EXERCISE_REPOSITORY = Symbol('EXERCISE_REPOSITORY');
