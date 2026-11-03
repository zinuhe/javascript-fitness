import { Injectable } from '@nestjs/common';
import type { ExerciseImageSize, ExerciseImageSlot } from '@fitness/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ExerciseImageRepository,
  SaveExerciseImageData,
  StoredImage,
} from '../domain/exercise-image.repository';

/** Prisma adapter for {@link ExerciseImageRepository}. */
@Injectable()
export class PrismaExerciseImageRepository implements ExerciseImageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    exerciseId: string,
    slot: ExerciseImageSlot,
    data: SaveExerciseImageData,
  ): Promise<void> {
    // Prisma's Bytes fields take a Uint8Array over a plain ArrayBuffer.
    const row = { ...data, thumb: new Uint8Array(data.thumb), large: new Uint8Array(data.large) };
    await this.prisma.exerciseImage.upsert({
      where: { exerciseId_slot: { exerciseId, slot } },
      create: { exerciseId, slot, ...row },
      update: row,
    });
  }

  async delete(exerciseId: string, slot: ExerciseImageSlot): Promise<void> {
    await this.prisma.exerciseImage.deleteMany({ where: { exerciseId, slot } });
  }

  async find(
    exerciseId: string,
    slot: ExerciseImageSlot,
    size: ExerciseImageSize,
  ): Promise<StoredImage | null> {
    // Only the requested rendition is read from the database.
    const row =
      size === 'thumb'
        ? await this.prisma.exerciseImage.findUnique({
            where: { exerciseId_slot: { exerciseId, slot } },
            select: { thumb: true, thumbType: true, version: true },
          })
        : await this.prisma.exerciseImage.findUnique({
            where: { exerciseId_slot: { exerciseId, slot } },
            select: { large: true, largeType: true, version: true },
          });
    if (!row) return null;
    return 'thumb' in row
      ? { data: Buffer.from(row.thumb), contentType: row.thumbType, version: row.version }
      : { data: Buffer.from(row.large), contentType: row.largeType, version: row.version };
  }
}
