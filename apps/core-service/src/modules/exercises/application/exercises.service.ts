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
    if (await this.exercises.existsByName(input.name)) {
      throw duplicateName();
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
    const current = await this.getById(id);
    if (input.name !== undefined && input.name !== current.name) {
      if (await this.exercises.existsByName(input.name, id)) {
        throw duplicateName();
      }
    }
    if (input.equipment) {
      // Logged workouts must keep pointing at equipment the exercise still has.
      const removed = current.equipment.filter((e) => !input.equipment!.includes(e));
      const used = await this.exercises.findUsedEquipment(id, removed);
      if (used.length > 0) {
        throw new ConflictError(
          `Logged workouts use this exercise with ${used.join(', ')}; that equipment cannot be removed`,
          'exercise.equipment_in_use',
        );
      }
    }
    return this.exercises.update(id, input);
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    if (await this.exercises.isInUse(id)) {
      throw new ConflictError(
        'The exercise is used by logged workouts or routines and cannot be deleted',
        'exercise.in_use',
      );
    }
    await this.exercises.delete(id);
  }
}

function duplicateName(): ConflictError {
  return new ConflictError('An exercise with this name already exists', 'exercise.duplicate');
}
