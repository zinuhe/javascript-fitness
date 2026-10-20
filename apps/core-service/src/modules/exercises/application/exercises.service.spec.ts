import { ConflictError } from '@fitness/common';
import { Equipment, MuscleGroup, type Exercise } from '@fitness/contracts';
import { ExercisesService } from './exercises.service';
import type { ExerciseRepository } from '../domain/exercise.repository';

const bench: Exercise = {
  id: 'ex-1',
  name: 'Barbell Bench Press',
  muscleGroup: MuscleGroup.Chest,
  equipment: Equipment.Barbell,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ExercisesService', () => {
  let repo: jest.Mocked<ExerciseRepository>;
  let service: ExercisesService;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(bench),
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue(bench),
      delete: jest.fn(),
      existsByNameAndEquipment: jest.fn().mockResolvedValue(false),
      isInUse: jest.fn().mockResolvedValue(false),
    };
    service = new ExercisesService(repo);
  });

  describe('update', () => {
    it('rejects renaming onto an existing name + equipment', async () => {
      repo.existsByNameAndEquipment.mockResolvedValue(true);

      await expect(service.update('ex-1', { name: 'Pull-up' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(repo.existsByNameAndEquipment).toHaveBeenCalledWith(
        'Pull-up',
        Equipment.Barbell,
        'ex-1',
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('skips the duplicate check when name and equipment are unchanged', async () => {
      await service.update('ex-1', { description: 'Flat bench' });

      expect(repo.existsByNameAndEquipment).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith('ex-1', { description: 'Flat bench' });
    });
  });

  describe('remove', () => {
    it('rejects deleting an exercise referenced by workouts', async () => {
      repo.isInUse.mockResolvedValue(true);

      await expect(service.remove('ex-1')).rejects.toMatchObject({ code: 'exercise.in_use' });
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes an unused exercise', async () => {
      await service.remove('ex-1');
      expect(repo.delete).toHaveBeenCalledWith('ex-1');
    });
  });
});
