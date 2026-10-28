import { buildProgressPoints, estimateOneRepMax } from './progress.calculator';
import type { SetHistoryRow } from '../domain/workout.repository';

describe('estimateOneRepMax', () => {
  it('returns the weight for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('applies the Epley formula for multiple reps', () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
  });
});

describe('buildProgressPoints', () => {
  const d1 = new Date('2026-01-01T10:00:00Z');
  const d2 = new Date('2026-01-08T10:00:00Z');

  it('aggregates sets per date with volume, best 1RM and heaviest set', () => {
    const history: SetHistoryRow[] = [
      { performedAt: d1, reps: 10, weightKg: 60 },
      { performedAt: d1, reps: 8, weightKg: 70 },
      { performedAt: d2, reps: 5, weightKg: 80 },
    ];

    const points = buildProgressPoints(history);

    expect(points).toHaveLength(2);
    // Day 1: volume = 10*60 + 8*70 = 1160; best set = 70
    expect(points[0].performedAt).toBe(d1.toISOString());
    expect(points[0].totalVolumeKg).toBe(1160);
    expect(points[0].bestSetWeightKg).toBe(70);
    // Day 2 comes after day 1 (sorted ascending)
    expect(points[1].performedAt).toBe(d2.toISOString());
    expect(points[1].totalVolumeKg).toBe(400);
    // Each point keeps its sets, in the order they were done.
    expect(points[0].sets).toEqual([
      { reps: 10, weightKg: 60 },
      { reps: 8, weightKg: 70 },
    ]);
    expect(points[1].sets).toEqual([{ reps: 5, weightKg: 80 }]);
  });

  it('keeps the bar of barbell sets', () => {
    const points = buildProgressPoints([{ performedAt: d1, reps: 8, weightKg: 32.7, barKg: 12.7 }]);
    expect(points[0].sets).toEqual([{ reps: 8, weightKg: 32.7, barKg: 12.7 }]);
  });

  it('returns an empty array for no history', () => {
    expect(buildProgressPoints([])).toEqual([]);
  });
});
