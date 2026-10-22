import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@fitness/common';
import type {
  CreateWorkoutRequest,
  ExerciseProgress,
  Paginated,
  UpdateWorkoutRequest,
  Workout,
} from '@fitness/contracts';
import { WORKOUT_REPOSITORY, type WorkoutRepository } from '../domain/workout.repository';
import { buildProgressPoints } from './progress.calculator';

@Injectable()
export class WorkoutsService {
  constructor(@Inject(WORKOUT_REPOSITORY) private readonly workouts: WorkoutRepository) {}

  async create(userId: string, input: CreateWorkoutRequest): Promise<Workout> {
    await this.assertExercisesExist(input);
    return this.workouts.create({ ...input, userId });
  }

  async update(userId: string, id: string, input: UpdateWorkoutRequest): Promise<Workout> {
    await this.assertExercisesExist(input);
    const workout = await this.workouts.replaceForUser(id, userId, input);
    if (!workout) {
      throw new NotFoundError('Workout not found', 'workout.not_found');
    }
    return workout;
  }

  async list(userId: string, page: number, pageSize: number): Promise<Paginated<Workout>> {
    const { items, total } = await this.workouts.findManyForUser(userId, {
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

  async getById(userId: string, id: string): Promise<Workout> {
    const workout = await this.workouts.findByIdForUser(id, userId);
    if (!workout) {
      throw new NotFoundError('Workout not found', 'workout.not_found');
    }
    return workout;
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.workouts.deleteForUser(id, userId);
    if (!deleted) {
      throw new NotFoundError('Workout not found', 'workout.not_found');
    }
  }

  async getExerciseProgress(userId: string, exerciseId: string): Promise<ExerciseProgress> {
    const history = await this.workouts.findSetHistory(userId, exerciseId);
    return { exerciseId, points: buildProgressPoints(history) };
  }

  private async assertExercisesExist(input: CreateWorkoutRequest): Promise<void> {
    const missing = await this.workouts.findMissingExerciseIds(
      input.exercises.map((e) => e.exerciseId),
    );
    if (missing.length > 0) {
      throw new ValidationError(
        'Workout references unknown exercises',
        'workout.unknown_exercise',
        {
          exerciseId: missing,
        },
      );
    }
  }
}
