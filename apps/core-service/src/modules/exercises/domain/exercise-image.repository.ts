import type { ExerciseImageSize, ExerciseImageSlot } from '@fitness/contracts';

/** One rendition of an exercise image, ready to send. */
export interface StoredImage {
  data: Buffer;
  contentType: string;
  version: string;
}

export interface SaveExerciseImageData {
  thumb: Buffer;
  thumbType: string;
  large: Buffer;
  largeType: string;
  version: string;
}

/** Port for exercise images (the catalog's pictures), kept apart from the exercise data. */
export interface ExerciseImageRepository {
  /** Creates or replaces the image in `slot`. */
  save(exerciseId: string, slot: ExerciseImageSlot, data: SaveExerciseImageData): Promise<void>;
  /** Removes the image in `slot`; nothing happens when there is none. */
  delete(exerciseId: string, slot: ExerciseImageSlot): Promise<void>;
  find(
    exerciseId: string,
    slot: ExerciseImageSlot,
    size: ExerciseImageSize,
  ): Promise<StoredImage | null>;
}

export const EXERCISE_IMAGE_REPOSITORY = Symbol('EXERCISE_IMAGE_REPOSITORY');
