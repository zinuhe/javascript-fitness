import { HttpResponse, http } from 'msw';
import type {
  AuthResponse,
  CreateExerciseRequest,
  CreateWorkoutRequest,
  Exercise,
  ExerciseProgressPoint,
  ProblemDetails,
  UserProfile,
  Workout,
} from '@fitness/contracts';
import { Equipment, MuscleGroup } from '@fitness/contracts';

/**
 * In-memory fake of the gateway API, served through MSW. It mirrors the real contract
 * (rotating refresh tokens, RFC 7807 errors, 409/422 rules) so integration tests run the
 * whole app — router, loaders, Query, API client — against realistic behaviour.
 */
interface UserRecord extends UserProfile {
  password: string;
}

interface State {
  users: UserRecord[];
  exercises: Exercise[];
  workouts: Workout[];
  accessTokens: Map<string, string>; // token → userId
  refreshTokens: Map<string, string>; // token → userId
  refreshCalls: number;
  seq: number;
}

let state: State;

export function resetApi(): void {
  state = {
    users: [],
    exercises: [],
    workouts: [],
    accessTokens: new Map(),
    refreshTokens: new Map(),
    refreshCalls: 0,
    seq: 0,
  };
}
resetApi();

const nextId = (prefix: string) => `${prefix}-${++state.seq}`;
const now = () => new Date('2026-10-20T10:00:00.000Z').toISOString();

// ── Seeding helpers for tests ───────────────────────────────────────────────────
export const DEFAULT_PASSWORD = 'correct-horse-battery';

export function seedUser(over: Partial<UserRecord> = {}): UserRecord {
  const user: UserRecord = {
    id: nextId('user'),
    email: 'alex@example.com',
    displayName: 'Alex',
    password: DEFAULT_PASSWORD,
    createdAt: now(),
    ...over,
  };
  state.users.push(user);
  return user;
}

export function seedExercise(over: Partial<Exercise> = {}): Exercise {
  const exercise: Exercise = {
    id: nextId('ex'),
    name: 'Barbell Bench Press',
    muscleGroup: MuscleGroup.Chest,
    equipment: Equipment.Barbell,
    createdAt: now(),
    ...over,
  };
  state.exercises.push(exercise);
  return exercise;
}

export function seedWorkout(userId: string, input: CreateWorkoutRequest): Workout {
  const workout = buildWorkout(userId, input);
  state.workouts.push(workout);
  return workout;
}

/** Issues a token pair for `user`, as if they had signed in. */
export function issueTokens(user: UserRecord): AuthResponse['tokens'] {
  const accessToken = nextId('access');
  const refreshToken = nextId('refresh');
  state.accessTokens.set(accessToken, user.id);
  state.refreshTokens.set(refreshToken, user.id);
  return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 900 };
}

/** Invalidates every access token (simulates expiry); refresh tokens stay valid. */
export function expireAccessTokens(): void {
  state.accessTokens.clear();
}

export const apiState = {
  get workouts() {
    return state.workouts;
  },
  get exercises() {
    return state.exercises;
  },
  get refreshCalls() {
    return state.refreshCalls;
  },
  hasRefreshToken: (token: string) => state.refreshTokens.has(token),
};

// ── Internals ───────────────────────────────────────────────────────────────────
function problem(status: number, detail: string, errors?: Record<string, string[]>) {
  const body: ProblemDetails = {
    type: `urn:fitness:error:http_${status}`,
    title: String(status),
    status,
    detail,
    ...(errors ? { errors } : {}),
  };
  return HttpResponse.json(body, {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

function currentUser(request: Request): UserRecord | null {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  const userId = token ? state.accessTokens.get(token) : undefined;
  return state.users.find((u) => u.id === userId) ?? null;
}

const toProfile = ({ password: _password, ...profile }: UserRecord): UserProfile => profile;

function authResponse(user: UserRecord, status = 200) {
  return HttpResponse.json<AuthResponse>(
    { user: toProfile(user), tokens: issueTokens(user) },
    { status },
  );
}

function paginate<T>(items: T[], url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

function buildWorkout(userId: string, input: CreateWorkoutRequest): Workout {
  return {
    id: nextId('workout'),
    userId,
    performedAt: input.performedAt ?? now(),
    notes: input.notes,
    createdAt: now(),
    exercises: input.exercises.map((entry, order) => ({
      id: nextId('we'),
      exerciseId: entry.exerciseId,
      order,
      sets: entry.sets.map((set, setOrder) => ({ id: nextId('set'), order: setOrder, ...set })),
    })),
  };
}

function progressFor(userId: string, exerciseId: string): ExerciseProgressPoint[] {
  return state.workouts
    .filter((w) => w.userId === userId)
    .flatMap((w) =>
      w.exercises
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => ({
          performedAt: w.performedAt,
          totalVolumeKg: e.sets.reduce((v, s) => v + s.reps * s.weightKg, 0),
          estimatedOneRepMaxKg: Math.max(
            ...e.sets.map((s) => (s.reps <= 1 ? s.weightKg : s.weightKg * (1 + s.reps / 30))),
          ),
          bestSetWeightKg: Math.max(...e.sets.map((s) => s.weightKg)),
        })),
    )
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
}

// ── Handlers ────────────────────────────────────────────────────────────────────
type Credentials = { email: string; password: string; displayName?: string };

export const handlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as Credentials;
    const email = body.email.toLowerCase();
    if (state.users.some((u) => u.email === email)) {
      return problem(409, 'Email is already registered');
    }
    return authResponse(
      seedUser({ email, password: body.password, displayName: body.displayName }),
      201,
    );
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as Credentials;
    const user = state.users.find(
      (u) => u.email === body.email.toLowerCase() && u.password === body.password,
    );
    return user ? authResponse(user) : problem(401, 'Invalid credentials');
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    state.refreshCalls += 1;
    const { refreshToken } = (await request.json()) as { refreshToken: string };
    const userId = state.refreshTokens.get(refreshToken);
    const user = state.users.find((u) => u.id === userId);
    if (!user) return problem(401, 'Invalid refresh token');
    state.refreshTokens.delete(refreshToken); // rotation: each token works once
    return authResponse(user);
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    const { refreshToken } = (await request.json()) as { refreshToken: string };
    state.refreshTokens.delete(refreshToken);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const user = currentUser(request);
    return user ? HttpResponse.json(toProfile(user)) : problem(401, 'Unauthorized');
  }),

  http.get('/api/exercises', ({ request }) => {
    if (!currentUser(request)) return problem(401, 'Unauthorized');
    const sorted = [...state.exercises].sort((a, b) => a.name.localeCompare(b.name));
    return HttpResponse.json(paginate(sorted, new URL(request.url)));
  }),

  http.post('/api/exercises', async ({ request }) => {
    if (!currentUser(request)) return problem(401, 'Unauthorized');
    const body = (await request.json()) as CreateExerciseRequest;
    if (state.exercises.some((e) => e.name === body.name && e.equipment === body.equipment)) {
      return problem(409, 'An exercise with this name and equipment already exists');
    }
    return HttpResponse.json(seedExercise(body), { status: 201 });
  }),

  http.get('/api/exercises/:id', ({ request, params }) => {
    if (!currentUser(request)) return problem(401, 'Unauthorized');
    const exercise = state.exercises.find((e) => e.id === params.id);
    return exercise ? HttpResponse.json(exercise) : problem(404, 'Exercise not found');
  }),

  http.get('/api/workouts', ({ request }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const mine = state.workouts
      .filter((w) => w.userId === user.id)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    return HttpResponse.json(paginate(mine, new URL(request.url)));
  }),

  http.post('/api/workouts', async ({ request }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const body = (await request.json()) as CreateWorkoutRequest;
    const missing = body.exercises
      .map((e) => e.exerciseId)
      .filter((id) => !state.exercises.some((e) => e.id === id));
    if (missing.length > 0) {
      return problem(422, 'Workout references unknown exercises', { exerciseId: missing });
    }
    return HttpResponse.json(seedWorkout(user.id, body), { status: 201 });
  }),

  http.get('/api/workouts/progress/:exerciseId', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const exerciseId = String(params.exerciseId);
    return HttpResponse.json({ exerciseId, points: progressFor(user.id, exerciseId) });
  }),

  http.get('/api/workouts/:id', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const workout = state.workouts.find((w) => w.id === params.id && w.userId === user.id);
    return workout ? HttpResponse.json(workout) : problem(404, 'Workout not found');
  }),

  http.delete('/api/workouts/:id', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const before = state.workouts.length;
    state.workouts = state.workouts.filter((w) => !(w.id === params.id && w.userId === user.id));
    return state.workouts.length < before
      ? new HttpResponse(null, { status: 204 })
      : problem(404, 'Workout not found');
  }),
];
