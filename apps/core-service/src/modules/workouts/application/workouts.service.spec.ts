import { ValidationError } from '@fitness/common';
import type { Workout } from '@fitness/contracts';
import { WorkoutsService } from './workouts.service';
import type { WorkoutRepository } from '../domain/workout.repository';

describe('WorkoutsService.create', () => {
  let repo: jest.Mocked<WorkoutRepository>;
  let service: WorkoutsService;

  const input = {
    exercises: [
      { exerciseId: 'ex-1', sets: [{ reps: 5, weightKg: 100 }] },
      { exerciseId: 'ex-2', sets: [{ reps: 8, weightKg: 60 }] },
    ],
  };

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue({ id: 'w-1' } as Workout),
      findByIdForUser: jest.fn(),
      findManyForUser: jest.fn(),
      deleteForUser: jest.fn(),
      findMissingExerciseIds: jest.fn().mockResolvedValue([]),
      findSetHistory: jest.fn(),
    };
    service = new WorkoutsService(repo);
  });

  it('rejects workouts that reference unknown exercises (422)', async () => {
    repo.findMissingExerciseIds.mockResolvedValue(['ex-2']);

    const error = await service.create('user-1', input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      httpStatus: 422,
      code: 'workout.unknown_exercise',
      errors: { exerciseId: ['ex-2'] },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates the workout when every exercise exists', async () => {
    await service.create('user-1', input);

    expect(repo.findMissingExerciseIds).toHaveBeenCalledWith(['ex-1', 'ex-2']);
    expect(repo.create).toHaveBeenCalledWith({ ...input, userId: 'user-1' });
  });
});
