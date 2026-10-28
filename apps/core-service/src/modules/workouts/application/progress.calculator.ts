import type { ExerciseProgressPoint } from '@fitness/contracts';
import type { SetHistoryRow } from '../domain/workout.repository';

/** Epley estimated one-rep max: weight * (1 + reps/30). Reps of 1 return the weight. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Aggregates a flat set history (in the order the sets were done) into one progress point
 * per workout date: total volume (Σ reps·weight), best estimated 1RM, the heaviest set, and
 * the sets themselves. Pure — trivially testable.
 */
const setOf = (set: SetHistoryRow) => ({
  reps: set.reps,
  weightKg: set.weightKg,
  ...(set.barKg !== undefined ? { barKg: set.barKg } : {}),
});

export function buildProgressPoints(history: SetHistoryRow[]): ExerciseProgressPoint[] {
  const byDate = new Map<string, ExerciseProgressPoint>();

  for (const set of history) {
    const key = set.performedAt.toISOString();
    const volume = set.reps * set.weightKg;
    const oneRm = estimateOneRepMax(set.weightKg, set.reps);

    const existing = byDate.get(key);
    if (existing) {
      existing.totalVolumeKg += volume;
      existing.estimatedOneRepMaxKg = Math.max(existing.estimatedOneRepMaxKg, oneRm);
      existing.bestSetWeightKg = Math.max(existing.bestSetWeightKg, set.weightKg);
      existing.sets.push(setOf(set));
    } else {
      byDate.set(key, {
        workoutId: set.workoutId,
        performedAt: key,
        totalVolumeKg: volume,
        estimatedOneRepMaxKg: oneRm,
        bestSetWeightKg: set.weightKg,
        sets: [setOf(set)],
      });
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return [...byDate.values()]
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt))
    .map((p) => ({
      ...p,
      totalVolumeKg: round(p.totalVolumeKg),
      estimatedOneRepMaxKg: round(p.estimatedOneRepMaxKg),
      bestSetWeightKg: round(p.bestSetWeightKg),
    }));
}
