import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma';
import type { CreateRoutineRequest, Routine, RoutineDayInput } from '@fitness/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RoutineRepository } from '../domain/routine.repository';

const routineInclude = {
  days: {
    orderBy: { position: 'asc' },
    include: { exercises: { orderBy: { position: 'asc' }, select: { exerciseId: true } } },
  },
} satisfies Prisma.RoutineInclude;

type RoutineWithDays = Prisma.RoutineGetPayload<{ include: typeof routineInclude }>;

/** Nested-create payload for a day's exercises, in the order given. */
const dayExercisesCreate = (day: RoutineDayInput) => ({
  create: day.exerciseIds.map((exerciseId, position) => ({ exerciseId, position })),
});

/** Prisma adapter for {@link RoutineRepository}. */
@Injectable()
export class PrismaRoutineRepository implements RoutineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyForUser(userId: string): Promise<Routine[]> {
    const rows = await this.prisma.routine.findMany({
      where: { userId },
      include: routineInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toContract(row));
  }

  async findByIdForUser(id: string, userId: string): Promise<Routine | null> {
    const row = await this.prisma.routine.findFirst({
      where: { id, userId },
      include: routineInclude,
    });
    return row ? this.toContract(row) : null;
  }

  async findActiveForUser(userId: string): Promise<Routine | null> {
    const row = await this.prisma.routine.findFirst({
      where: { userId, isActive: true },
      include: routineInclude,
    });
    return row ? this.toContract(row) : null;
  }

  countForUser(userId: string): Promise<number> {
    return this.prisma.routine.count({ where: { userId } });
  }

  async create(userId: string, data: CreateRoutineRequest, isActive: boolean): Promise<Routine> {
    const row = await this.prisma.routine.create({
      data: {
        userId,
        name: data.name,
        isActive,
        days: {
          create: data.days.map((day, position) => ({
            position,
            name: day.name,
            exercises: dayExercisesCreate(day),
          })),
        },
      },
      include: routineInclude,
    });
    return this.toContract(row);
  }

  replaceForUser(id: string, userId: string, data: CreateRoutineRequest): Promise<Routine | null> {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.routine.findFirst({ where: { id, userId }, select: { id: true } });
      if (!owned) return null;

      const keep = data.days.flatMap((day) => (day.id ? [day.id] : []));
      // Removed days go (their workouts stay, with routineDayId set to null by the FK).
      await tx.routineDay.deleteMany({ where: { routineId: id, id: { notIn: keep } } });
      for (const [position, day] of data.days.entries()) {
        if (day.id) {
          await tx.routineDayExercise.deleteMany({ where: { dayId: day.id } });
          await tx.routineDay.update({
            where: { id: day.id },
            data: { position, name: day.name ?? null, exercises: dayExercisesCreate(day) },
          });
        } else {
          await tx.routineDay.create({
            data: { routineId: id, position, name: day.name, exercises: dayExercisesCreate(day) },
          });
        }
      }

      const row = await tx.routine.update({
        where: { id },
        data: { name: data.name },
        include: routineInclude,
      });
      return this.toContract(row);
    });
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.routine.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  activateForUser(id: string, userId: string): Promise<Routine | null> {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.routine.findFirst({ where: { id, userId }, select: { id: true } });
      if (!owned) return null;
      await tx.routine.updateMany({ where: { userId, NOT: { id } }, data: { isActive: false } });
      const row = await tx.routine.update({
        where: { id },
        data: { isActive: true },
        include: routineInclude,
      });
      return this.toContract(row);
    });
  }

  async findMissingExerciseIds(exerciseIds: string[]): Promise<string[]> {
    const unique = [...new Set(exerciseIds)];
    const found = await this.prisma.exercise.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    const existing = new Set(found.map((e) => e.id));
    return unique.filter((id) => !existing.has(id));
  }

  async findLastPerformedDayId(routineId: string, userId: string): Promise<string | null> {
    const last = await this.prisma.workout.findFirst({
      where: { userId, routineDay: { routineId } },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
      select: { routineDayId: true },
    });
    return last?.routineDayId ?? null;
  }

  private toContract(row: RoutineWithDays): Routine {
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      days: row.days.map((day) => ({
        id: day.id,
        position: day.position,
        name: day.name ?? undefined,
        exerciseIds: day.exercises.map((e) => e.exerciseId),
      })),
    };
  }
}
