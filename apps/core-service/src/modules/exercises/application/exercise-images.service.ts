import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@fitness/common';
import {
  EXERCISE_IMAGE_SIZES,
  EXERCISE_IMAGE_SLOTS,
  type Exercise,
  type ExerciseImageSize,
  type ExerciseImageSlot,
} from '@fitness/contracts';
import {
  EXERCISE_IMAGE_REPOSITORY,
  type ExerciseImageRepository,
  type StoredImage,
} from '../domain/exercise-image.repository';
import { ExercisesService } from './exercises.service';

/** A file as received from a multipart upload. */
export interface UploadedImage {
  buffer: Buffer;
}

/** The browser resizes before uploading; these only stop the odd full-size photo. */
export const MAX_THUMB_BYTES = 200 * 1024;
export const MAX_LARGE_BYTES = 1024 * 1024;

@Injectable()
export class ExerciseImagesService {
  constructor(
    private readonly exercises: ExercisesService,
    @Inject(EXERCISE_IMAGE_REPOSITORY) private readonly images: ExerciseImageRepository,
  ) {}

  /** Creates or replaces the image in `slot` with its two renditions. */
  async set(
    exerciseId: string,
    slotParam: number,
    files: { thumb?: UploadedImage; large?: UploadedImage },
  ): Promise<Exercise> {
    const slot = parseSlot(slotParam);
    await this.exercises.getById(exerciseId);
    const thumb = checkImage(files.thumb, 'thumb', MAX_THUMB_BYTES);
    const large = checkImage(files.large, 'large', MAX_LARGE_BYTES);
    const version = createHash('sha256')
      .update(thumb.data)
      .update(large.data)
      .digest('hex')
      .slice(0, 16);
    await this.images.save(exerciseId, slot, {
      thumb: thumb.data,
      thumbType: thumb.contentType,
      large: large.data,
      largeType: large.contentType,
      version,
    });
    return this.exercises.getById(exerciseId);
  }

  async remove(exerciseId: string, slotParam: number): Promise<Exercise> {
    const slot = parseSlot(slotParam);
    await this.exercises.getById(exerciseId);
    await this.images.delete(exerciseId, slot);
    return this.exercises.getById(exerciseId);
  }

  async get(exerciseId: string, slotParam: number, size: string): Promise<StoredImage> {
    const slot = parseSlot(slotParam);
    if (!(EXERCISE_IMAGE_SIZES as readonly string[]).includes(size)) {
      throw imageNotFound();
    }
    const image = await this.images.find(exerciseId, slot, size as ExerciseImageSize);
    if (!image) throw imageNotFound();
    return image;
  }

  /** "picture 1" / "picture 2", for the activity log. */
  static describeSlot(slot: number): string {
    return `picture ${slot}`;
  }
}

function parseSlot(slot: number): ExerciseImageSlot {
  if (!(EXERCISE_IMAGE_SLOTS as readonly number[]).includes(slot)) {
    throw new NotFoundError('Exercise pictures are slots 1 and 2', 'exercise.image_slot');
  }
  return slot as ExerciseImageSlot;
}

function imageNotFound(): NotFoundError {
  return new NotFoundError('Image not found', 'exercise.image_not_found');
}

/**
 * The type is read from the file's first bytes, not from what the client claims, so only
 * real JPEG, PNG or WebP images are stored and later served with a matching Content-Type.
 */
export function detectImageType(data: Buffer): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (data.length >= 8 && data.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function checkImage(
  file: UploadedImage | undefined,
  field: 'thumb' | 'large',
  maxBytes: number,
): { data: Buffer; contentType: string } {
  if (!file || file.buffer.length === 0) {
    throw new ValidationError(`The ${field} image is missing`, 'exercise.image_missing', {
      [field]: ['required'],
    });
  }
  if (file.buffer.length > maxBytes) {
    throw new ValidationError(
      `The ${field} image is too large (at most ${Math.round(maxBytes / 1024)} KB)`,
      'exercise.image_too_large',
      { [field]: [`at most ${maxBytes} bytes`] },
    );
  }
  const contentType = detectImageType(file.buffer);
  if (!contentType) {
    throw new ValidationError('Images must be JPEG, PNG or WebP', 'exercise.image_type', {
      [field]: ['not a JPEG, PNG or WebP image'],
    });
  }
  return { data: file.buffer, contentType };
}
