import { Injectable } from '@nestjs/common';
import type { Equipment, Exercise, Muscle, MuscleGroup } from '@fitness/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateExerciseData,
  ExerciseRepository,
  UpdateExerciseData,
} from '../domain/exercise.repository';

type ExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  description: string | null;
  createdAt: Date;
};

/** Prisma adapter for {@link ExerciseRepository}. */
@Injectable()
export class PrismaExerciseRepository implements ExerciseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateExerciseData): Promise<Exercise> {
    const row = await this.prisma.exercise.create({
      data: {
        ...data,
        equipment: data.equipment as never,
        primaryMuscles: data.primaryMuscles as never,
        secondaryMuscles: data.secondaryMuscles as never,
      },
    });
    return this.toContract(row);
  }

  async findById(id: string): Promise<Exercise | null> {
    const row = await this.prisma.exercise.findUnique({ where: { id } });
    return row ? this.toContract(row) : null;
  }

  async findMany(params: { skip: number; take: number }): Promise<{
    items: Exercise[];
    total: number;
  }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.exercise.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.exercise.count(),
    ]);
    return { items: rows.map((r) => this.toContract(r)), total };
  }

  async update(id: string, data: UpdateExerciseData): Promise<Exercise> {
    const row = await this.prisma.exercise.update({
      where: { id },
      data: {
        ...data,
        equipment: data.equipment as never,
        primaryMuscles: data.primaryMuscles as never,
        secondaryMuscles: data.secondaryMuscles as never,
      },
    });
    return this.toContract(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.exercise.delete({ where: { id } });
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const found = await this.prisma.exercise.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return found !== null;
  }

  async findUsedEquipment(id: string, equipment: Equipment[]): Promise<Equipment[]> {
    if (equipment.length === 0) return [];
    const rows = await this.prisma.workoutExercise.findMany({
      where: { exerciseId: id, equipment: { in: equipment as never } },
      distinct: ['equipment'],
      select: { equipment: true },
    });
    return rows.map((r) => r.equipment as Equipment);
  }

  async isInUse(id: string): Promise<boolean> {
    const [inWorkout, inRoutine] = await Promise.all([
      this.prisma.workoutExercise.findFirst({ where: { exerciseId: id }, select: { id: true } }),
      this.prisma.routineDayExercise.findFirst({ where: { exerciseId: id }, select: { id: true } }),
    ]);
    return inWorkout !== null || inRoutine !== null;
  }

  private toContract(row: ExerciseRow): Exercise {
    return {
      id: row.id,
      name: row.name,
      muscleGroup: row.muscleGroup as MuscleGroup,
      primaryMuscles: row.primaryMuscles as Muscle[],
      secondaryMuscles: row.secondaryMuscles as Muscle[],
      equipment: row.equipment as Equipment[],
      description: row.description ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
