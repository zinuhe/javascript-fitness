import type { RoutineDay } from '@fitness/contracts';

/**
 * The day after `lastDayId` in a routine's cycle, wrapping from the last day back to the
 * first. With no history (or a day that no longer exists) the routine starts at day one.
 * `days` must be non-empty and sorted by position.
 */
export function nextRoutineDay(days: RoutineDay[], lastDayId: string | null): RoutineDay {
  const lastIndex = lastDayId ? days.findIndex((day) => day.id === lastDayId) : -1;
  return days[(lastIndex + 1) % days.length];
}
