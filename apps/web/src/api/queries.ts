import { queryOptions } from '@tanstack/react-query';
import type {
  ActivityEntry,
  AuthResponse,
  CreateExerciseRequest,
  CreateRoutineRequest,
  CreateWorkoutRequest,
  UpdateExerciseRequest,
  UpdateProfileRequest,
  UpdateRoutineRequest,
  UpdateWorkoutRequest,
  Equipment,
  Exercise,
  ExerciseProgress,
  LastExerciseSets,
  LoginRequest,
  NextRoutineDay,
  Paginated,
  RegisterRequest,
  Routine,
  UserProfile,
  Workout,
} from '@fitness/contracts';
import { api, tokenStore } from './client';

/** API maximum page size; the catalog is small enough to load in one page for now. */
export const CATALOG_PAGE_SIZE = 100;
export const WORKOUTS_PAGE_SIZE = 10;

// ── Queries (shared by route loaders and components) ────────────────────────────
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => api<UserProfile>('/auth/me'),
  staleTime: 5 * 60_000,
});

export const exercisesQuery = queryOptions({
  queryKey: ['exercises'],
  queryFn: () => api<Paginated<Exercise>>(`/exercises?pageSize=${CATALOG_PAGE_SIZE}`),
});

export const exerciseQuery = (id: string) =>
  queryOptions({
    queryKey: ['exercises', id],
    queryFn: () => api<Exercise>(`/exercises/${id}`),
  });

export const workoutsQuery = (page: number) =>
  queryOptions({
    queryKey: ['workouts', { page }],
    queryFn: () => api<Paginated<Workout>>(`/workouts?page=${page}&pageSize=${WORKOUTS_PAGE_SIZE}`),
  });

export const workoutQuery = (id: string) =>
  queryOptions({
    queryKey: ['workouts', id],
    queryFn: () => api<Workout>(`/workouts/${id}`),
  });

/** Progress of an exercise; only the sets done with `equipment` when given. */
export const progressQuery = (exerciseId: string, equipment?: Equipment) =>
  queryOptions({
    queryKey: ['progress', exerciseId, equipment ?? 'all'],
    queryFn: () =>
      api<ExerciseProgress>(
        `/workouts/progress/${exerciseId}${equipment ? `?equipment=${equipment}` : ''}`,
      ),
  });

export const routinesQuery = queryOptions({
  queryKey: ['routines'],
  queryFn: () => api<Routine[]>('/routines'),
});

export const routineQuery = (id: string) =>
  queryOptions({
    queryKey: ['routines', id],
    queryFn: () => api<Routine>(`/routines/${id}`),
  });

/** The day to do next in the active routine; null when no routine is active (204). */
export const nextRoutineQuery = queryOptions({
  queryKey: ['routines', 'next'],
  queryFn: async () => (await api<NextRoutineDay | undefined>('/routines/next')) ?? null,
});

/** The user's latest changes (Account). Always refetched on view: any save adds a line. */
export const activityQuery = queryOptions({
  queryKey: ['activity'],
  queryFn: () => api<ActivityEntry[]>('/activity?limit=30'),
  staleTime: 0,
});

/**
 * Sets from the latest workout of each exercise, one entry per equipment used (the most
 * recent first), to pre-fill a routine day.
 */
export const lastSetsQuery = (exerciseIds: string[]) =>
  queryOptions({
    queryKey: ['last-sets', [...exerciseIds].sort()],
    queryFn: () =>
      exerciseIds.length === 0
        ? Promise.resolve<LastExerciseSets[]>([])
        : api<LastExerciseSets[]>(`/workouts/last-sets?exerciseIds=${exerciseIds.join(',')}`),
  });

// ── Commands ────────────────────────────────────────────────────────────────────
async function storeSession(result: Promise<AuthResponse>): Promise<UserProfile> {
  const { tokens, user } = await result;
  tokenStore.set(tokens);
  return user;
}

export const login = (input: LoginRequest) =>
  storeSession(api<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false }));

export const register = (input: RegisterRequest) =>
  storeSession(api<AuthResponse>('/auth/register', { method: 'POST', body: input, auth: false }));

export const updateProfile = (input: UpdateProfileRequest) =>
  api<UserProfile>('/auth/me', { method: 'PATCH', body: input });

export async function logout(): Promise<void> {
  const tokens = tokenStore.get();
  tokenStore.clear();
  if (tokens) {
    // Best effort: the local session is gone either way.
    await api('/auth/logout', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
      auth: false,
    }).catch(() => undefined);
  }
}

export const createExercise = (input: CreateExerciseRequest) =>
  api<Exercise>('/exercises', { method: 'POST', body: input });

export const updateExercise = (id: string, input: UpdateExerciseRequest) =>
  api<Exercise>(`/exercises/${id}`, { method: 'PATCH', body: input });

export const deleteExercise = (id: string) => api<void>(`/exercises/${id}`, { method: 'DELETE' });

export const createWorkout = (input: CreateWorkoutRequest) =>
  api<Workout>('/workouts', { method: 'POST', body: input });

export const updateWorkout = (id: string, input: UpdateWorkoutRequest) =>
  api<Workout>(`/workouts/${id}`, { method: 'PUT', body: input });

export const deleteWorkout = (id: string) => api<void>(`/workouts/${id}`, { method: 'DELETE' });

export const createRoutine = (input: CreateRoutineRequest) =>
  api<Routine>('/routines', { method: 'POST', body: input });

export const updateRoutine = (id: string, input: UpdateRoutineRequest) =>
  api<Routine>(`/routines/${id}`, { method: 'PUT', body: input });

export const activateRoutine = (id: string) =>
  api<Routine>(`/routines/${id}/activate`, { method: 'POST' });

export const deleteRoutine = (id: string) => api<void>(`/routines/${id}`, { method: 'DELETE' });
