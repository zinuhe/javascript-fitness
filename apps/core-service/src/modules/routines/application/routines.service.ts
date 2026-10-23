import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@fitness/common';
import type {
  CreateRoutineRequest,
  NextRoutineDay,
  Routine,
  UpdateRoutineRequest,
} from '@fitness/contracts';
import { ROUTINE_REPOSITORY, type RoutineRepository } from '../domain/routine.repository';
import { nextRoutineDay } from './rotation';

@Injectable()
export class RoutinesService {
  constructor(@Inject(ROUTINE_REPOSITORY) private readonly routines: RoutineRepository) {}

  list(userId: string): Promise<Routine[]> {
    return this.routines.findManyForUser(userId);
  }

  async getById(userId: string, id: string): Promise<Routine> {
    const routine = await this.routines.findByIdForUser(id, userId);
    if (!routine) {
      throw new NotFoundError('Routine not found', 'routine.not_found');
    }
    return routine;
  }

  /** The user's first routine becomes the active one, so "next day" works right away. */
  async create(userId: string, input: CreateRoutineRequest): Promise<Routine> {
    await this.assertExercisesExist(input);
    const isFirst = (await this.routines.countForUser(userId)) === 0;
    return this.routines.create(userId, input, isFirst);
  }

  async update(userId: string, id: string, input: UpdateRoutineRequest): Promise<Routine> {
    const current = await this.getById(userId, id);
    const known = new Set(current.days.map((day) => day.id));
    const unknown = input.days.flatMap((day) => (day.id && !known.has(day.id) ? [day.id] : []));
    if (unknown.length > 0) {
      throw new ValidationError('Routine references days it does not have', 'routine.unknown_day', {
        dayId: unknown,
      });
    }
    await this.assertExercisesExist(input);
    const routine = await this.routines.replaceForUser(id, userId, input);
    if (!routine) {
      throw new NotFoundError('Routine not found', 'routine.not_found');
    }
    return routine;
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.routines.deleteForUser(id, userId);
    if (!deleted) {
      throw new NotFoundError('Routine not found', 'routine.not_found');
    }
  }

  async activate(userId: string, id: string): Promise<Routine> {
    const routine = await this.routines.activateForUser(id, userId);
    if (!routine) {
      throw new NotFoundError('Routine not found', 'routine.not_found');
    }
    return routine;
  }

  /** The day to do next in the active routine, or null when no routine is active. */
  async next(userId: string): Promise<NextRoutineDay | null> {
    const routine = await this.routines.findActiveForUser(userId);
    if (!routine || routine.days.length === 0) return null;
    const lastDayId = await this.routines.findLastPerformedDayId(routine.id, userId);
    return { routine, day: nextRoutineDay(routine.days, lastDayId) };
  }

  private async assertExercisesExist(input: CreateRoutineRequest): Promise<void> {
    const missing = await this.routines.findMissingExerciseIds(
      input.days.flatMap((day) => day.exerciseIds),
    );
    if (missing.length > 0) {
      throw new ValidationError(
        'Routine references unknown exercises',
        'routine.unknown_exercise',
        { exerciseId: missing },
      );
    }
  }
}
