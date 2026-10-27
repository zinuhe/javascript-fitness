import type { Equipment, Exercise, Muscle, MuscleGroup } from '@fitness/contracts';

export interface CreateExerciseData {
  name: string;
  muscleGroup: MuscleGroup;
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  equipment: Equipment[];
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
  existsByName(name: string, excludeId?: string): Promise<boolean>;
  /** Which of `equipment` some logged workout used with this exercise. */
  findUsedEquipment(id: string, equipment: Equipment[]): Promise<Equipment[]>;
  /** Whether any logged workout or routine references this exercise (blocks deletion). */
  isInUse(id: string): Promise<boolean>;
}

export const EXERCISE_REPOSITORY = Symbol('EXERCISE_REPOSITORY');
