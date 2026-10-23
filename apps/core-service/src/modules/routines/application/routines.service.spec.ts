import { NotFoundError, ValidationError } from '@fitness/common';
import type { Routine } from '@fitness/contracts';
import { RoutinesService } from './routines.service';
import type { RoutineRepository } from '../domain/routine.repository';

const routine: Routine = {
  id: 'r-1',
  name: 'PPL',
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  days: [
    { id: 'd-1', position: 0, name: 'Push', exerciseIds: ['ex-1'] },
    { id: 'd-2', position: 1, name: 'Pull', exerciseIds: ['ex-2'] },
  ],
};

const input = { name: 'PPL', days: [{ exerciseIds: ['ex-1'] }, { exerciseIds: ['ex-2'] }] };

let repo: jest.Mocked<RoutineRepository>;
let service: RoutinesService;

beforeEach(() => {
  repo = {
    findManyForUser: jest.fn(),
    findByIdForUser: jest.fn().mockResolvedValue(routine),
    findActiveForUser: jest.fn().mockResolvedValue(routine),
    countForUser: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue(routine),
    replaceForUser: jest.fn().mockResolvedValue(routine),
    deleteForUser: jest.fn().mockResolvedValue(true),
    activateForUser: jest.fn().mockResolvedValue(routine),
    findMissingExerciseIds: jest.fn().mockResolvedValue([]),
    findLastPerformedDayId: jest.fn().mockResolvedValue(null),
  };
  service = new RoutinesService(repo);
});

describe('RoutinesService.create', () => {
  it('makes the first routine active and later ones inactive', async () => {
    await service.create('user-1', input);
    expect(repo.create).toHaveBeenLastCalledWith('user-1', input, true);

    repo.countForUser.mockResolvedValue(1);
    await service.create('user-1', input);
    expect(repo.create).toHaveBeenLastCalledWith('user-1', input, false);
  });

  it('rejects unknown exercises (422)', async () => {
    repo.findMissingExerciseIds.mockResolvedValue(['ex-2']);

    await expect(service.create('user-1', input)).rejects.toMatchObject({
      httpStatus: 422,
      code: 'routine.unknown_exercise',
      errors: { exerciseId: ['ex-2'] },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('RoutinesService.update', () => {
  it('keeps known days and adds new ones', async () => {
    const days = [{ id: 'd-2', exerciseIds: ['ex-2'] }, { exerciseIds: ['ex-1'] }];

    await service.update('user-1', 'r-1', { name: 'PPL', days });

    expect(repo.replaceForUser).toHaveBeenCalledWith('r-1', 'user-1', { name: 'PPL', days });
  });

  it('rejects day ids that belong to another routine (422)', async () => {
    const error = await service
      .update('user-1', 'r-1', { name: 'PPL', days: [{ id: 'd-other', exerciseIds: ['ex-1'] }] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ code: 'routine.unknown_day', errors: { dayId: ['d-other'] } });
    expect(repo.replaceForUser).not.toHaveBeenCalled();
  });

  it('is a 404 for a routine of another user', async () => {
    repo.findByIdForUser.mockResolvedValue(null);

    await expect(service.update('user-1', 'r-x', input)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RoutinesService.next', () => {
  it('returns the day after the last one done in the active routine', async () => {
    repo.findLastPerformedDayId.mockResolvedValue('d-1');

    const next = await service.next('user-1');

    expect(repo.findLastPerformedDayId).toHaveBeenCalledWith('r-1', 'user-1');
    expect(next).toEqual({ routine, day: routine.days[1] });
  });

  it('is null when no routine is active', async () => {
    repo.findActiveForUser.mockResolvedValue(null);

    await expect(service.next('user-1')).resolves.toBeNull();
  });
});

describe('RoutinesService.activate / remove', () => {
  it('404s for routines the user does not own', async () => {
    repo.activateForUser.mockResolvedValue(null);
    repo.deleteForUser.mockResolvedValue(false);

    await expect(service.activate('user-1', 'r-x')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.remove('user-1', 'r-x')).rejects.toBeInstanceOf(NotFoundError);
  });
});
