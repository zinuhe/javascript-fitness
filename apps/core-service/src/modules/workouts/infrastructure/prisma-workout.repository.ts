import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma';
import type {
  Equipment,
  LastExerciseSets,
  UpdateWorkoutRequest,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@fitness/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateWorkoutData,
  SetHistoryRow,
  WorkoutRepository,
} from '../domain/workout.repository';

const setsOrdered = { orderBy: { order: 'asc' } } satisfies Prisma.WorkoutExercise$setsArgs;

const workoutInclude = {
  exercises: {
    orderBy: { order: 'asc' },
    include: { sets: setsOrdered },
  },
  routineDay: {
    select: { id: true, position: true, name: true, routine: { select: { id: true, name: true } } },
  },
} satisfies Prisma.WorkoutInclude;

type WorkoutWithRelations = Prisma.WorkoutGetPayload<{ include: typeof workoutInclude }>;

/** Nested-create payload for a workout's exercises and sets, in the order given. */
function exercisesCreate(
  exercises: UpdateWorkoutRequest['exercises'],
): Prisma.WorkoutExerciseCreateNestedManyWithoutWorkoutInput {
  return {
    create: exercises.map((we, exIndex) => ({
      exerciseId: we.exerciseId,
      equipment: we.equipment ?? null,
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
  };
}

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
        routineDayId: data.routineDayId,
        exercises: exercisesCreate(data.exercises),
      },
      include: workoutInclude,
    });
    return this.toContract(row);
  }

  replaceForUser(id: string, userId: string, data: UpdateWorkoutRequest): Promise<Workout | null> {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.workout.findFirst({ where: { id, userId }, select: { id: true } });
      if (!owned) return null;
      // Sets cascade with their workout exercise; the new ones are created in order below.
      await tx.workoutExercise.deleteMany({ where: { workoutId: id } });
      const row = await tx.workout.update({
        where: { id },
        data: {
          ...(data.performedAt ? { performedAt: new Date(data.performedAt) } : {}),
          // Omitted keeps the routine day; null unlinks it.
          ...(data.routineDayId !== undefined ? { routineDayId: data.routineDayId } : {}),
          notes: data.notes ?? null,
          exercises: exercisesCreate(data.exercises),
        },
        include: workoutInclude,
      });
      return this.toContract(row);
    });
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

  async findExerciseEquipment(exerciseIds: string[]): Promise<Map<string, Equipment[]>> {
    const found = await this.prisma.exercise.findMany({
      where: { id: { in: [...new Set(exerciseIds)] } },
      select: { id: true, equipment: true },
    });
    return new Map(found.map((e) => [e.id, e.equipment as Equipment[]]));
  }

  async routineDayBelongsToUser(routineDayId: string, userId: string): Promise<boolean> {
    const day = await this.prisma.routineDay.findFirst({
      where: { id: routineDayId, routine: { userId } },
      select: { id: true },
    });
    return day !== null;
  }

  async findLastSets(userId: string, exerciseIds: string[]): Promise<LastExerciseSets[]> {
    const where = { exerciseId: { in: [...new Set(exerciseIds)] }, workout: { userId } };
    // Each (exercise, equipment) pair the user has logged, then its latest entry.
    const pairs = await this.prisma.workoutExercise.findMany({
      where,
      distinct: ['exerciseId', 'equipment'],
      select: { exerciseId: true, equipment: true },
    });
    const latest = await Promise.all(
      pairs.map((pair) =>
        this.prisma.workoutExercise.findFirst({
          where: { ...where, exerciseId: pair.exerciseId, equipment: pair.equipment },
          orderBy: [{ workout: { performedAt: 'desc' } }, { workout: { createdAt: 'desc' } }],
          include: { sets: setsOrdered, workout: { select: { performedAt: true } } },
        }),
      ),
    );
    return latest
      .flatMap((entry) => (entry ? [entry] : []))
      .sort(
        (a, b) =>
          a.exerciseId.localeCompare(b.exerciseId) ||
          b.workout.performedAt.getTime() - a.workout.performedAt.getTime(),
      )
      .map((entry) => ({
        exerciseId: entry.exerciseId,
        ...(entry.equipment ? { equipment: entry.equipment as Equipment } : {}),
        performedAt: entry.workout.performedAt.toISOString(),
        sets: entry.sets.map((s) => ({
          reps: s.reps,
          weightKg: s.weightKg.toNumber(),
          ...(s.rpe !== null ? { rpe: s.rpe.toNumber() } : {}),
          ...(s.restSeconds !== null ? { restSeconds: s.restSeconds } : {}),
        })),
      }));
  }

  async findSetHistory(
    userId: string,
    exerciseId: string,
    equipment?: Equipment,
  ): Promise<SetHistoryRow[]> {
    const sets = await this.prisma.workoutSet.findMany({
      where: {
        workoutExercise: {
          exerciseId,
          workout: { userId },
          ...(equipment ? { equipment: equipment as never } : {}),
        },
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
      routineDay: row.routineDay
        ? {
            id: row.routineDay.id,
            routineId: row.routineDay.routine.id,
            routineName: row.routineDay.routine.name,
            position: row.routineDay.position,
            name: row.routineDay.name ?? undefined,
          }
        : undefined,
      createdAt: row.createdAt.toISOString(),
      exercises: row.exercises.map((we): WorkoutExercise => ({
        id: we.id,
        exerciseId: we.exerciseId,
        equipment: (we.equipment as Equipment | null) ?? undefined,
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
