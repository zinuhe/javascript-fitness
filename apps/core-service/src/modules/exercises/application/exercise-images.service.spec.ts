import { NotFoundError, ValidationError } from '@fitness/common';
import { Equipment, MuscleGroup, type Exercise } from '@fitness/contracts';
import type { ExerciseImageRepository } from '../domain/exercise-image.repository';
import { ExerciseImagesService, MAX_THUMB_BYTES, detectImageType } from './exercise-images.service';
import type { ExercisesService } from './exercises.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);

const bench: Exercise = {
  id: 'ex-1',
  name: 'Barbell Bench Press',
  muscleGroup: MuscleGroup.Chest,
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: [Equipment.Barbell],
  warmup: false,
  images: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('detectImageType', () => {
  it.each([
    [JPEG, 'image/jpeg'],
    [PNG, 'image/png'],
    [WEBP, 'image/webp'],
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), null],
    [Buffer.from('GIF89a'), null],
    [Buffer.alloc(0), null],
  ])('%#: reads the type from the first bytes', (data, expected) => {
    expect(detectImageType(data)).toBe(expected);
  });
});

describe('ExerciseImagesService', () => {
  let repo: jest.Mocked<ExerciseImageRepository>;
  let exercises: jest.Mocked<Pick<ExercisesService, 'getById'>>;
  let service: ExerciseImagesService;

  beforeEach(() => {
    repo = { save: jest.fn(), delete: jest.fn(), find: jest.fn() };
    exercises = { getById: jest.fn().mockResolvedValue(bench) };
    service = new ExerciseImagesService(exercises as unknown as ExercisesService, repo);
  });

  describe('set', () => {
    it('stores both renditions with their detected types and a content version', async () => {
      await service.set('ex-1', 2, { thumb: { buffer: JPEG }, large: { buffer: PNG } });

      expect(repo.save).toHaveBeenCalledWith('ex-1', 2, {
        thumb: JPEG,
        thumbType: 'image/jpeg',
        large: PNG,
        largeType: 'image/png',
        version: expect.stringMatching(/^[0-9a-f]{16}$/),
      });
    });

    it('gives different content a different version', async () => {
      await service.set('ex-1', 1, { thumb: { buffer: JPEG }, large: { buffer: JPEG } });
      await service.set('ex-1', 1, { thumb: { buffer: JPEG }, large: { buffer: PNG } });

      const [first, second] = repo.save.mock.calls.map(([, , data]) => data.version);
      expect(first).not.toBe(second);
    });

    it('needs both files', async () => {
      await expect(service.set('ex-1', 1, { thumb: { buffer: JPEG } })).rejects.toMatchObject({
        code: 'exercise.image_missing',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects files that are not JPEG, PNG or WebP, whatever they claim to be', async () => {
      const svg = Buffer.from('<svg onload="alert(1)"/>');

      const error = await service
        .set('ex-1', 1, { thumb: { buffer: JPEG }, large: { buffer: svg } })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({
        code: 'exercise.image_type',
        errors: { large: expect.any(Array) },
      });
    });

    it('rejects a thumbnail above its size limit', async () => {
      const big = Buffer.concat([JPEG, Buffer.alloc(MAX_THUMB_BYTES)]);

      await expect(
        service.set('ex-1', 1, { thumb: { buffer: big }, large: { buffer: JPEG } }),
      ).rejects.toMatchObject({ code: 'exercise.image_too_large' });
    });

    it('only knows slots 1 and 2, and needs the exercise to exist', async () => {
      const files = { thumb: { buffer: JPEG }, large: { buffer: JPEG } };
      await expect(service.set('ex-1', 3, files)).rejects.toBeInstanceOf(NotFoundError);

      exercises.getById.mockRejectedValue(new NotFoundError('Exercise not found'));
      await expect(service.set('nope', 1, files)).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns the stored rendition', async () => {
      const stored = { data: JPEG, contentType: 'image/jpeg', version: 'abc' };
      repo.find.mockResolvedValue(stored);

      await expect(service.get('ex-1', 1, 'thumb')).resolves.toBe(stored);
      expect(repo.find).toHaveBeenCalledWith('ex-1', 1, 'thumb');
    });

    it('is not found for a missing image or an unknown size', async () => {
      repo.find.mockResolvedValue(null);
      await expect(service.get('ex-1', 1, 'large')).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.get('ex-1', 1, 'huge')).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.find).toHaveBeenCalledTimes(1);
    });
  });

  it('removes an image and returns the exercise as it is now', async () => {
    await expect(service.remove('ex-1', 2)).resolves.toBe(bench);
    expect(repo.delete).toHaveBeenCalledWith('ex-1', 2);
  });
});
