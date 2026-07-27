import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Workout, WorkoutExercise, WorkoutSet } from '@fitness/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateWorkoutData,
  SetHistoryRow,
  WorkoutRepository,
} from '../domain/workout.repository';

const workoutInclude = {
  exercises: {
    orderBy: { order: 'asc' },
    include: { sets: { orderBy: { order: 'asc' } } },
  },
} satisfies Prisma.WorkoutInclude;

type WorkoutWithRelations = Prisma.WorkoutGetPayload<{ include: typeof workoutInclude }>;

/** Prisma adapter for {@link WorkoutRepository}. */
@Injectable()
export class PrismaWorkoutRepository implements WorkoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWorkoutData): Promise<Workout> {
    const row = await this.prisma.workout.create({
      data: {
        userId: data.userId,
        performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
        notes: data.notes,
        exercises: {
          create: data.exercises.map((we, exIndex) => ({
            exerciseId: we.exerciseId,
            order: exIndex,
            sets: {
              create: we.sets.map((set, setIndex) => ({
                order: setIndex,
                reps: set.reps,
                weightKg: new Prisma.Decimal(set.weightKg),
                rpe: set.rpe !== undefined ? new Prisma.Decimal(set.rpe) : null,
                restSeconds: set.restSeconds,
              })),
            },
          })),
        },
      },
      include: workoutInclude,
    });
    return this.toContract(row);
  }

  async findByIdForUser(id: string, userId: string): Promise<Workout | null> {
    const row = await this.prisma.workout.findFirst({
      where: { id, userId },
      include: workoutInclude,
    });
    return row ? this.toContract(row) : null;
  }

  async findManyForUser(
    userId: string,
    params: { skip: number; take: number },
  ): Promise<{ items: Workout[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workout.findMany({
        where: { userId },
        include: workoutInclude,
        orderBy: { performedAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.workout.count({ where: { userId } }),
    ]);
    return { items: rows.map((r) => this.toContract(r)), total };
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.workout.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async findSetHistory(userId: string, exerciseId: string): Promise<SetHistoryRow[]> {
    const sets = await this.prisma.workoutSet.findMany({
      where: {
        workoutExercise: { exerciseId, workout: { userId } },
      },
      select: {
        reps: true,
        weightKg: true,
        workoutExercise: { select: { workout: { select: { performedAt: true } } } },
      },
    });
    return sets.map((s) => ({
      performedAt: s.workoutExercise.workout.performedAt,
      reps: s.reps,
      weightKg: s.weightKg.toNumber(),
    }));
  }

  private toContract(row: WorkoutWithRelations): Workout {
    return {
      id: row.id,
      userId: row.userId,
      performedAt: row.performedAt.toISOString(),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      exercises: row.exercises.map((we): WorkoutExercise => ({
        id: we.id,
        exerciseId: we.exerciseId,
        order: we.order,
        sets: we.sets.map((s): WorkoutSet => ({
          id: s.id,
          order: s.order,
          reps: s.reps,
          weightKg: s.weightKg.toNumber(),
          rpe: s.rpe !== null ? s.rpe.toNumber() : undefined,
          restSeconds: s.restSeconds ?? undefined,
        })),
      })),
    };
  }
}
