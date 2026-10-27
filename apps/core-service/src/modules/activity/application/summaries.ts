import type { Workout } from '@fitness/contracts';

/** "Added workout · Day 2 · Legs": the verb, then the routine day when there is one. */
export function workoutSummary(verb: string, workout: Workout): string {
  const day = workout.routineDay;
  if (!day) return `${verb} workout`;
  return `${verb} workout · Day ${day.position + 1}${day.name ? ` · ${day.name}` : ''}`;
}
