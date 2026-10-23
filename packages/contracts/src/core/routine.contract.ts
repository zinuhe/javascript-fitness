/**
 * A routine (a "split"): ordered days, each a fixed list of exercises, repeated in order —
 * after the last day it starts again from the first.
 */
export interface RoutineDay {
  id: string;
  /** Zero-based position in the routine; shown as "Day position + 1". */
  position: number;
  name?: string;
  exerciseIds: string[];
}

export interface Routine {
  id: string;
  name: string;
  /** The routine the user follows now; at most one is active. */
  isActive: boolean;
  days: RoutineDay[];
  createdAt: string;
  updatedAt: string;
}

export interface RoutineDayInput {
  /** Existing day to keep (and keep its workout history); omit for a new day. */
  id?: string;
  name?: string;
  exerciseIds: string[];
}

export interface CreateRoutineRequest {
  name: string;
  days: RoutineDayInput[];
}

/**
 * Full replacement (`PUT /routines/:id`). Days are matched by `id`: listed ones are kept and
 * updated, new ones created, missing ones deleted (their workouts stay, unlinked).
 */
export type UpdateRoutineRequest = CreateRoutineRequest;

/** The day to do next in the active routine (`GET /routines/next`). */
export interface NextRoutineDay {
  routine: Routine;
  day: RoutineDay;
}
