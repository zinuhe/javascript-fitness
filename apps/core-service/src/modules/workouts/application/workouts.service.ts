import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@fitness/common';
import type {
  CreateWorkoutRequest,
  Equipment,
  ExerciseProgress,
  LastExerciseSets,
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
    const resolved = await this.resolveReferences(userId, input);
    return this.workouts.create({ ...resolved, userId });
  }

  async update(userId: string, id: string, input: UpdateWorkoutRequest): Promise<Workout> {
    const resolved = await this.resolveReferences(userId, input);
    const workout = await this.workouts.replaceForUser(id, userId, resolved);
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

  lastSets(userId: string, exerciseIds: string[]): Promise<LastExerciseSets[]> {
    return this.workouts.findLastSets(userId, exerciseIds);
  }

  async getExerciseProgress(
    userId: string,
    exerciseId: string,
    equipment?: Equipment,
  ): Promise<ExerciseProgress> {
    const history = await this.workouts.findSetHistory(userId, exerciseId, equipment);
    return { exerciseId, points: buildProgressPoints(history) };
  }

  /**
   * Checks the exercises and routine day the workout points to, and returns the input with
   * each exercise's equipment filled in (the only one it has, when the client sent none).
   */
  private async resolveReferences<T extends UpdateWorkoutRequest>(
    userId: string,
    input: T,
  ): Promise<T> {
    const exercises = await this.resolveEquipment(input);
    if (
      input.routineDayId &&
      !(await this.workouts.routineDayBelongsToUser(input.routineDayId, userId))
    ) {
      throw new ValidationError(
        'Workout references an unknown routine day',
        'workout.unknown_routine_day',
        {
          routineDayId: [input.routineDayId],
        },
      );
    }
    return { ...input, exercises };
  }

  private async resolveEquipment(
    input: Pick<CreateWorkoutRequest, 'exercises'>,
  ): Promise<CreateWorkoutRequest['exercises']> {
    const catalog = await this.workouts.findExerciseEquipment(
      input.exercises.map((e) => e.exerciseId),
    );
    const missing = [
      ...new Set(input.exercises.map((e) => e.exerciseId).filter((id) => !catalog.has(id))),
    ];
    if (missing.length > 0) {
      throw new ValidationError(
        'Workout references unknown exercises',
        'workout.unknown_exercise',
        {
          exerciseId: missing,
        },
      );
    }
    return input.exercises.map((entry) => {
      const options = catalog.get(entry.exerciseId)!;
      if (entry.equipment === undefined && options.length === 1) {
        return { ...entry, equipment: options[0] };
      }
      if (entry.equipment === undefined || !options.includes(entry.equipment)) {
        throw new ValidationError(
          entry.equipment === undefined
            ? 'Choose the equipment used for each exercise'
            : 'The exercise is not done with that equipment',
          'workout.invalid_equipment',
          { [entry.exerciseId]: options },
        );
      }
      return entry;
    });
  }
}
