import { queryOptions } from '@tanstack/react-query';
import type {
  AuthResponse,
  CreateExerciseRequest,
  CreateWorkoutRequest,
  UpdateWorkoutRequest,
  Exercise,
  ExerciseProgress,
  LoginRequest,
  Paginated,
  RegisterRequest,
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

export const progressQuery = (exerciseId: string) =>
  queryOptions({
    queryKey: ['progress', exerciseId],
    queryFn: () => api<ExerciseProgress>(`/workouts/progress/${exerciseId}`),
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

export const createWorkout = (input: CreateWorkoutRequest) =>
  api<Workout>('/workouts', { method: 'POST', body: input });

export const updateWorkout = (id: string, input: UpdateWorkoutRequest) =>
  api<Workout>(`/workouts/${id}`, { method: 'PUT', body: input });

export const deleteWorkout = (id: string) => api<void>(`/workouts/${id}`, { method: 'DELETE' });
