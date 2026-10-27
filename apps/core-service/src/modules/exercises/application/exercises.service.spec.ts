import { ConflictError } from '@fitness/common';
import { Equipment, MuscleGroup, type Exercise } from '@fitness/contracts';
import { ExercisesService } from './exercises.service';
import type { ExerciseRepository } from '../domain/exercise.repository';

const bench: Exercise = {
  id: 'ex-1',
  name: 'Barbell Bench Press',
  muscleGroup: MuscleGroup.Chest,
  equipment: [Equipment.Barbell],
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
      existsByName: jest.fn().mockResolvedValue(false),
      findUsedEquipment: jest.fn().mockResolvedValue([]),
      isInUse: jest.fn().mockResolvedValue(false),
    };
    service = new ExercisesService(repo);
  });

  describe('update', () => {
    it('rejects renaming onto an existing name', async () => {
      repo.existsByName.mockResolvedValue(true);

      await expect(service.update('ex-1', { name: 'Pull-up' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(repo.existsByName).toHaveBeenCalledWith('Pull-up', 'ex-1');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('skips the duplicate check when the name is unchanged', async () => {
      await service.update('ex-1', { description: 'Flat bench' });

      expect(repo.existsByName).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith('ex-1', { description: 'Flat bench' });
    });

    it('adds equipment', async () => {
      const equipment = [Equipment.Barbell, Equipment.Dumbbell];
      await service.update('ex-1', { equipment });

      expect(repo.findUsedEquipment).toHaveBeenCalledWith('ex-1', []);
      expect(repo.update).toHaveBeenCalledWith('ex-1', { equipment });
    });

    it('rejects removing equipment that logged workouts used', async () => {
      repo.findById.mockResolvedValue({
        ...bench,
        equipment: [Equipment.Barbell, Equipment.Dumbbell],
      });
      repo.findUsedEquipment.mockResolvedValue([Equipment.Dumbbell]);

      await expect(
        service.update('ex-1', { equipment: [Equipment.Barbell] }),
      ).rejects.toMatchObject({ code: 'exercise.equipment_in_use' });
      expect(repo.findUsedEquipment).toHaveBeenCalledWith('ex-1', [Equipment.Dumbbell]);
      expect(repo.update).not.toHaveBeenCalled();
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
