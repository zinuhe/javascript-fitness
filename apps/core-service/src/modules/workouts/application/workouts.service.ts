import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@fitness/common';
import {
  Equipment,
  type CreateWorkoutRequest,
  type ExerciseSessionCount,
  type ExerciseProgress,
  type LastExerciseSets,
  type Paginated,
  type UpdateWorkoutRequest,
  type Workout,
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

  async list(
    userId: string,
    page: number,
    pageSize: number,
    range: { from?: string; to?: string } = {},
  ): Promise<Paginated<Workout>> {
    const { items, total } = await this.workouts.findManyForUser(userId, {
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...(range.from ? { from: new Date(range.from) } : {}),
      ...(range.to ? { to: new Date(range.to) } : {}),
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

  exerciseCounts(userId: string): Promise<ExerciseSessionCount[]> {
    return this.workouts.countSessionsByExercise(userId);
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
      const equipment = entry.equipment ?? (options.length === 1 ? options[0] : undefined);
      if (entry.barKg !== undefined && equipment !== Equipment.Barbell) {
        throw new ValidationError(
          'Only barbell exercises can include a bar weight',
          'workout.bar_without_barbell',
          { [entry.exerciseId]: [`equipment: ${equipment ?? 'none'}`] },
        );
      }
      if (entry.dumbbells !== undefined && equipment !== Equipment.Dumbbell) {
        throw new ValidationError(
          'Only dumbbell exercises can say how many dumbbells were used',
          'workout.dumbbells_without_dumbbell',
          { [entry.exerciseId]: [`equipment: ${equipment ?? 'none'}`] },
        );
      }
      // Two dumbbells unless told otherwise.
      const dumbbells = equipment === Equipment.Dumbbell ? (entry.dumbbells ?? 2) : undefined;
      if (entry.equipment === undefined && options.length === 1) {
        return { ...entry, equipment: options[0], ...(dumbbells ? { dumbbells } : {}) };
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
      return { ...entry, ...(dumbbells ? { dumbbells } : {}) };
    });
  }
}
