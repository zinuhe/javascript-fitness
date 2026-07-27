import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@fitness/common';
import type {
  CreateExerciseRequest,
  Exercise,
  Paginated,
  UpdateExerciseRequest,
} from '@fitness/contracts';
import { EXERCISE_REPOSITORY, type ExerciseRepository } from '../domain/exercise.repository';

@Injectable()
export class ExercisesService {
  constructor(@Inject(EXERCISE_REPOSITORY) private readonly exercises: ExerciseRepository) {}

  async create(input: CreateExerciseRequest): Promise<Exercise> {
    const exists = await this.exercises.existsByNameAndEquipment(input.name, input.equipment);
    if (exists) {
      throw new ConflictError(
        'An exercise with this name and equipment already exists',
        'exercise.duplicate',
      );
    }
    return this.exercises.create(input);
  }

  async list(page: number, pageSize: number): Promise<Paginated<Exercise>> {
    const { items, total } = await this.exercises.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getById(id: string): Promise<Exercise> {
    const exercise = await this.exercises.findById(id);
    if (!exercise) {
      throw new NotFoundError('Exercise not found', 'exercise.not_found');
    }
    return exercise;
  }

  async update(id: string, input: UpdateExerciseRequest): Promise<Exercise> {
    await this.getById(id);
    return this.exercises.update(id, input);
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    await this.exercises.delete(id);
  }
}
