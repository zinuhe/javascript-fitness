import { NotFoundError, ValidationError } from '@fitness/common';
import type { Workout } from '@fitness/contracts';
import { WorkoutsService } from './workouts.service';
import type { WorkoutRepository } from '../domain/workout.repository';

const input = {
  exercises: [
    { exerciseId: 'ex-1', sets: [{ reps: 5, weightKg: 100 }] },
    { exerciseId: 'ex-2', sets: [{ reps: 8, weightKg: 60 }] },
  ],
};

let repo: jest.Mocked<WorkoutRepository>;
let service: WorkoutsService;

beforeEach(() => {
  repo = {
    create: jest.fn().mockResolvedValue({ id: 'w-1' } as Workout),
    findByIdForUser: jest.fn(),
    findManyForUser: jest.fn(),
    replaceForUser: jest.fn().mockResolvedValue({ id: 'w-1' } as Workout),
    deleteForUser: jest.fn(),
    findMissingExerciseIds: jest.fn().mockResolvedValue([]),
    findSetHistory: jest.fn(),
  };
  service = new WorkoutsService(repo);
});

describe('WorkoutsService.create', () => {
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

describe('WorkoutsService.update', () => {
  it('replaces the workout scoped to the user', async () => {
    const result = await service.update('user-1', 'w-1', input);

    expect(repo.findMissingExerciseIds).toHaveBeenCalledWith(['ex-1', 'ex-2']);
    expect(repo.replaceForUser).toHaveBeenCalledWith('w-1', 'user-1', input);
    expect(result).toEqual({ id: 'w-1' });
  });

  it('rejects unknown exercises (422) without touching the workout', async () => {
    repo.findMissingExerciseIds.mockResolvedValue(['ex-1']);

    await expect(service.update('user-1', 'w-1', input)).rejects.toMatchObject({
      httpStatus: 422,
      code: 'workout.unknown_exercise',
    });
    expect(repo.replaceForUser).not.toHaveBeenCalled();
  });

  it('is a 404 when the workout is missing or belongs to someone else', async () => {
    repo.replaceForUser.mockResolvedValue(null);

    const error = await service.update('user-1', 'w-other', input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ code: 'workout.not_found' });
  });
});
