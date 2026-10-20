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
  /** `excludeId` lets an update ignore the exercise being edited. */
  existsByNameAndEquipment(
    name: string,
    equipment: Equipment,
    excludeId?: string,
  ): Promise<boolean>;
  /** Whether any logged workout references this exercise (blocks deletion). */
  isInUse(id: string): Promise<boolean>;
}

export const EXERCISE_REPOSITORY = Symbol('EXERCISE_REPOSITORY');
