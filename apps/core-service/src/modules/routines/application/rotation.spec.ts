import type { RoutineDay } from '@fitness/contracts';
import { nextRoutineDay } from './rotation';

const days: RoutineDay[] = ['push', 'pull', 'legs'].map((id, position) => ({
  id,
  position,
  name: id,
  exerciseIds: ['ex-1'],
}));

describe('nextRoutineDay', () => {
  it('starts at the first day when nothing was done yet', () => {
    expect(nextRoutineDay(days, null).id).toBe('push');
  });

  it('moves to the day after the last one done', () => {
    expect(nextRoutineDay(days, 'push').id).toBe('pull');
    expect(nextRoutineDay(days, 'pull').id).toBe('legs');
  });

  it('wraps from the last day back to the first', () => {
    expect(nextRoutineDay(days, 'legs').id).toBe('push');
  });

  it('starts over when the last day no longer exists', () => {
    expect(nextRoutineDay(days, 'deleted-day').id).toBe('push');
  });

  it('keeps repeating a one-day routine', () => {
    expect(nextRoutineDay([days[0]], 'push').id).toBe('push');
  });
});
