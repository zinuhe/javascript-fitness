import { NotFoundError, ValidationError } from '@fitness/common';
import { Equipment, type Workout } from '@fitness/contracts';
import { WorkoutsService } from './workouts.service';
import type { WorkoutRepository } from '../domain/workout.repository';

// ex-1 is barbell only, so its equipment can be left out; ex-2 has two and says which.
const input = {
  exercises: [
    { exerciseId: 'ex-1', sets: [{ reps: 5, weightKg: 100 }] },
    { exerciseId: 'ex-2', equipment: Equipment.Dumbbell, sets: [{ reps: 8, weightKg: 60 }] },
  ],
};
const resolved = {
  exercises: [{ ...input.exercises[0], equipment: Equipment.Barbell }, input.exercises[1]],
};
const catalog = () =>
  new Map([
    ['ex-1', [Equipment.Barbell]],
    ['ex-2', [Equipment.Barbell, Equipment.Dumbbell]],
  ]);

let repo: jest.Mocked<WorkoutRepository>;
let service: WorkoutsService;

beforeEach(() => {
  repo = {
    create: jest.fn().mockResolvedValue({ id: 'w-1' } as Workout),
    findByIdForUser: jest.fn(),
    findManyForUser: jest.fn(),
    replaceForUser: jest.fn().mockResolvedValue({ id: 'w-1' } as Workout),
    deleteForUser: jest.fn(),
    findExerciseEquipment: jest.fn().mockImplementation(() => Promise.resolve(catalog())),
    routineDayBelongsToUser: jest.fn().mockResolvedValue(true),
    findLastSets: jest.fn().mockResolvedValue([]),
    findSetHistory: jest.fn(),
  };
  service = new WorkoutsService(repo);
});

describe('WorkoutsService.create', () => {
  it('rejects workouts that reference unknown exercises (422)', async () => {
    repo.findExerciseEquipment.mockResolvedValue(new Map([['ex-1', [Equipment.Barbell]]]));

    const error = await service.create('user-1', input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      httpStatus: 422,
      code: 'workout.unknown_exercise',
      errors: { exerciseId: ['ex-2'] },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates the workout, filling in the equipment of single-equipment exercises', async () => {
    await service.create('user-1', input);

    expect(repo.findExerciseEquipment).toHaveBeenCalledWith(['ex-1', 'ex-2']);
    expect(repo.create).toHaveBeenCalledWith({ ...resolved, userId: 'user-1' });
  });

  it('requires the equipment when the exercise has more than one (422)', async () => {
    const error = await service
      .create('user-1', {
        exercises: [{ exerciseId: 'ex-2', sets: [{ reps: 8, weightKg: 60 }] }],
      })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      httpStatus: 422,
      code: 'workout.invalid_equipment',
      errors: { 'ex-2': [Equipment.Barbell, Equipment.Dumbbell] },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('accepts a bar weight only on barbell exercises (422 otherwise)', async () => {
    const bar = { reps: 5, weightKg: 32.5 };
    await service.create('user-1', {
      exercises: [{ exerciseId: 'ex-1', barKg: 12.5, sets: [bar] }],
    });
    expect(repo.create).toHaveBeenCalledWith({
      exercises: [{ exerciseId: 'ex-1', equipment: Equipment.Barbell, barKg: 12.5, sets: [bar] }],
      userId: 'user-1',
    });

    await expect(
      service.create('user-1', {
        exercises: [
          { exerciseId: 'ex-2', equipment: Equipment.Dumbbell, barKg: 12.5, sets: [bar] },
        ],
      }),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'workout.bar_without_barbell' });
  });

  it('rejects equipment the exercise is not done with (422)', async () => {
    await expect(
      service.create('user-1', {
        exercises: [
          { exerciseId: 'ex-1', equipment: Equipment.Cable, sets: [{ reps: 5, weightKg: 20 }] },
        ],
      }),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'workout.invalid_equipment' });
  });
});

describe('WorkoutsService.update', () => {
  it('replaces the workout scoped to the user', async () => {
    const result = await service.update('user-1', 'w-1', input);

    expect(repo.findExerciseEquipment).toHaveBeenCalledWith(['ex-1', 'ex-2']);
    expect(repo.replaceForUser).toHaveBeenCalledWith('w-1', 'user-1', resolved);
    expect(result).toEqual({ id: 'w-1' });
  });

  it('rejects unknown exercises (422) without touching the workout', async () => {
    repo.findExerciseEquipment.mockResolvedValue(new Map());

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

describe('WorkoutsService routine days', () => {
  it('accepts a routine day of the user', async () => {
    await service.create('user-1', { ...input, routineDayId: 'day-1' });

    expect(repo.routineDayBelongsToUser).toHaveBeenCalledWith('day-1', 'user-1');
    expect(repo.create).toHaveBeenCalledWith({
      ...resolved,
      routineDayId: 'day-1',
      userId: 'user-1',
    });
  });

  it('rejects a routine day that is not the user’s (422)', async () => {
    repo.routineDayBelongsToUser.mockResolvedValue(false);

    await expect(
      service.create('user-1', { ...input, routineDayId: 'day-x' }),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'workout.unknown_routine_day' });
    expect(repo.create).not.toHaveBeenCalled();
  });
});
