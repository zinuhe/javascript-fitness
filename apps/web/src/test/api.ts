import { HttpResponse, http } from 'msw';
import type {
  AuthResponse,
  CreateExerciseRequest,
  CreateRoutineRequest,
  CreateWorkoutRequest,
  Exercise,
  ExerciseProgressPoint,
  LastExerciseSets,
  ProblemDetails,
  UpdateProfileRequest,
  Routine,
  UpdateWorkoutRequest,
  UserProfile,
  Workout,
  WorkoutRoutineDay,
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

interface RoutineRecord extends Routine {
  userId: string;
}

interface State {
  users: UserRecord[];
  exercises: Exercise[];
  workouts: Workout[];
  routines: RoutineRecord[];
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
    routines: [],
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
    weightUnit: 'kg',
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
    equipment: [Equipment.Barbell],
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

/** A routine for `userId`; the user's first routine is active, like the real API. */
export function seedRoutine(userId: string, input: CreateRoutineRequest): Routine {
  const routine: RoutineRecord = {
    id: nextId('routine'),
    userId,
    name: input.name,
    isActive: !state.routines.some((r) => r.userId === userId),
    createdAt: now(),
    updatedAt: now(),
    days: input.days.map((day, position) => ({
      id: nextId('day'),
      position,
      name: day.name,
      exerciseIds: [...day.exerciseIds],
    })),
  };
  state.routines.push(routine);
  return withoutOwner(routine);
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
  get users() {
    return state.users;
  },
  get workouts() {
    return state.workouts;
  },
  get exercises() {
    return state.exercises;
  },
  get routines() {
    return state.routines;
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

const withoutOwner = ({ userId: _userId, ...routine }: RoutineRecord): Routine => routine;

/** Label of a routine day as workouts carry it, or undefined when it doesn't exist. */
function routineDayLabel(dayId: string | undefined): WorkoutRoutineDay | undefined {
  for (const routine of state.routines) {
    const day = routine.days.find((d) => d.id === dayId);
    if (day) {
      return {
        id: day.id,
        routineId: routine.id,
        routineName: routine.name,
        position: day.position,
        name: day.name,
      };
    }
  }
  return undefined;
}

const ownsRoutineDay = (userId: string, dayId: string) =>
  state.routines.some((r) => r.userId === userId && r.days.some((d) => d.id === dayId));

const missingExercises = (ids: string[]) =>
  [...new Set(ids)].filter((id) => !state.exercises.some((e) => e.id === id));

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Like the API: a 422 when an exercise needs its equipment chosen or names one it lacks. */
function invalidEquipment(input: CreateWorkoutRequest) {
  for (const entry of input.exercises) {
    const options = state.exercises.find((e) => e.id === entry.exerciseId)?.equipment ?? [];
    const ok = entry.equipment ? options.includes(entry.equipment) : options.length === 1;
    if (!ok) {
      return problem(
        422,
        entry.equipment
          ? 'The exercise is not done with that equipment'
          : 'Choose the equipment used for each exercise',
      );
    }
  }
  return null;
}

function onlyEquipment(exerciseId: string) {
  const options = state.exercises.find((e) => e.id === exerciseId)?.equipment ?? [];
  return options.length === 1 ? options[0] : undefined;
}

function buildWorkout(userId: string, input: CreateWorkoutRequest): Workout {
  return {
    id: nextId('workout'),
    userId,
    performedAt: input.performedAt ?? now(),
    notes: input.notes,
    routineDay: routineDayLabel(input.routineDayId),
    createdAt: now(),
    exercises: input.exercises.map((entry, order) => ({
      id: nextId('we'),
      exerciseId: entry.exerciseId,
      // The only equipment of the exercise is filled in, as the API does.
      equipment: entry.equipment ?? onlyEquipment(entry.exerciseId),
      order,
      sets: entry.sets.map((set, setOrder) => ({ id: nextId('set'), order: setOrder, ...set })),
    })),
  };
}

function progressFor(
  userId: string,
  exerciseId: string,
  equipment: string | null,
): ExerciseProgressPoint[] {
  return state.workouts
    .filter((w) => w.userId === userId)
    .flatMap((w) =>
      w.exercises
        .filter((e) => e.exerciseId === exerciseId && (!equipment || e.equipment === equipment))
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

  http.patch('/api/auth/me', async ({ request }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    Object.assign(user, (await request.json()) as UpdateProfileRequest);
    return HttpResponse.json(toProfile(user));
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
    if (state.exercises.some((e) => sameName(e.name, body.name))) {
      return problem(409, 'An exercise with this name already exists');
    }
    return HttpResponse.json(seedExercise(body), { status: 201 });
  }),

  http.get('/api/exercises/:id', ({ request, params }) => {
    if (!currentUser(request)) return problem(401, 'Unauthorized');
    const exercise = state.exercises.find((e) => e.id === params.id);
    return exercise ? HttpResponse.json(exercise) : problem(404, 'Exercise not found');
  }),

  http.patch('/api/exercises/:id', async ({ request, params }) => {
    if (!currentUser(request)) return problem(401, 'Unauthorized');
    const exercise = state.exercises.find((e) => e.id === params.id);
    if (!exercise) return problem(404, 'Exercise not found');
    const body = (await request.json()) as Partial<CreateExerciseRequest>;
    const name = body.name ?? exercise.name;
    if (state.exercises.some((e) => e !== exercise && sameName(e.name, name))) {
      return problem(409, 'An exercise with this name already exists');
    }
    const removed = exercise.equipment.filter((e) => body.equipment && !body.equipment.includes(e));
    const used = removed.filter((equipment) =>
      state.workouts.some((w) =>
        w.exercises.some((e) => e.exerciseId === exercise.id && e.equipment === equipment),
      ),
    );
    if (used.length > 0) {
      return problem(
        409,
        `Logged workouts use this exercise with ${used.join(', ')}; that equipment cannot be removed`,
      );
    }
    Object.assign(exercise, body, { description: body.description || undefined });
    return HttpResponse.json(exercise);
  }),

  http.delete('/api/exercises/:id', ({ request, params }) => {
    if (!currentUser(request)) return problem(401, 'Unauthorized');
    const id = String(params.id);
    if (!state.exercises.some((e) => e.id === id)) return problem(404, 'Exercise not found');
    const used =
      state.workouts.some((w) => w.exercises.some((e) => e.exerciseId === id)) ||
      state.routines.some((r) => r.days.some((d) => d.exerciseIds.includes(id)));
    if (used) {
      return problem(
        409,
        'The exercise is used by logged workouts or routines and cannot be deleted',
      );
    }
    state.exercises = state.exercises.filter((e) => e.id !== id);
    return new HttpResponse(null, { status: 204 });
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
    if (body.routineDayId && !ownsRoutineDay(user.id, body.routineDayId)) {
      return problem(422, 'Workout references an unknown routine day');
    }
    const invalid = invalidEquipment(body);
    if (invalid) return invalid;
    return HttpResponse.json(seedWorkout(user.id, body), { status: 201 });
  }),

  http.get('/api/workouts/progress/:exerciseId', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const exerciseId = String(params.exerciseId);
    const equipment = new URL(request.url).searchParams.get('equipment');
    return HttpResponse.json({ exerciseId, points: progressFor(user.id, exerciseId, equipment) });
  }),

  http.get('/api/workouts/last-sets', ({ request }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const ids = (new URL(request.url).searchParams.get('exerciseIds') ?? '').split(',');
    const newestFirst = state.workouts
      .filter((w) => w.userId === user.id)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    // One entry per exercise and equipment, the most recent first for each exercise.
    const result: LastExerciseSets[] = ids.flatMap((exerciseId) => {
      const seen = new Set<string | undefined>();
      return newestFirst.flatMap((workout) =>
        workout.exercises
          .filter((e) => e.exerciseId === exerciseId && !seen.has(e.equipment))
          .slice(0, 1)
          .map((entry) => {
            seen.add(entry.equipment);
            const sets = entry.sets.map(({ reps, weightKg, rpe, restSeconds }) => ({
              reps,
              weightKg,
              ...(rpe !== undefined ? { rpe } : {}),
              ...(restSeconds !== undefined ? { restSeconds } : {}),
            }));
            return {
              exerciseId,
              ...(entry.equipment ? { equipment: entry.equipment } : {}),
              performedAt: workout.performedAt,
              sets,
            };
          }),
      );
    });
    return HttpResponse.json(result);
  }),

  http.get('/api/workouts/:id', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const workout = state.workouts.find((w) => w.id === params.id && w.userId === user.id);
    return workout ? HttpResponse.json(workout) : problem(404, 'Workout not found');
  }),

  http.put('/api/workouts/:id', async ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const body = (await request.json()) as UpdateWorkoutRequest;
    const missing = body.exercises
      .map((e) => e.exerciseId)
      .filter((id) => !state.exercises.some((e) => e.id === id));
    if (missing.length > 0) {
      return problem(422, 'Workout references unknown exercises', { exerciseId: missing });
    }
    const invalid = invalidEquipment(body);
    if (invalid) return invalid;
    const index = state.workouts.findIndex((w) => w.id === params.id && w.userId === user.id);
    if (index === -1) return problem(404, 'Workout not found');
    const current = state.workouts[index];
    // Same semantics as the API: notes/exercises replaced, omitted performedAt kept.
    const rebuilt = buildWorkout(user.id, {
      ...body,
      performedAt: body.performedAt ?? current.performedAt,
      routineDayId: body.routineDayId ?? current.routineDay?.id,
    });
    const updated: Workout = { ...rebuilt, id: current.id, createdAt: current.createdAt };
    state.workouts[index] = updated;
    return HttpResponse.json(updated);
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

  // ── Routines ──────────────────────────────────────────────────────────────────
  http.get('/api/routines', ({ request }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const mine = state.routines
      .filter((r) => r.userId === user.id)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
    return HttpResponse.json(mine.map(withoutOwner));
  }),

  // Before '/api/routines/:id', which would otherwise match "next".
  http.get('/api/routines/next', ({ request }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const routine = state.routines.find((r) => r.userId === user.id && r.isActive);
    if (!routine) return new HttpResponse(null, { status: 204 });
    const last = state.workouts
      .filter((w) => w.userId === user.id && w.routineDay?.routineId === routine.id)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
    const lastIndex = routine.days.findIndex((d) => d.id === last?.routineDay?.id);
    const day = routine.days[(lastIndex + 1) % routine.days.length];
    return HttpResponse.json({ routine: withoutOwner(routine), day });
  }),

  http.post('/api/routines', async ({ request }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const body = (await request.json()) as CreateRoutineRequest;
    const missing = missingExercises(body.days.flatMap((d) => d.exerciseIds));
    if (missing.length > 0) {
      return problem(422, 'Routine references unknown exercises', { exerciseId: missing });
    }
    return HttpResponse.json(seedRoutine(user.id, body), { status: 201 });
  }),

  http.get('/api/routines/:id', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const routine = state.routines.find((r) => r.id === params.id && r.userId === user.id);
    return routine ? HttpResponse.json(withoutOwner(routine)) : problem(404, 'Routine not found');
  }),

  http.put('/api/routines/:id', async ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const routine = state.routines.find((r) => r.id === params.id && r.userId === user.id);
    if (!routine) return problem(404, 'Routine not found');
    const body = (await request.json()) as CreateRoutineRequest;
    const unknown = body.days.flatMap((d) =>
      d.id && !routine.days.some((existing) => existing.id === d.id) ? [d.id] : [],
    );
    if (unknown.length > 0) return problem(422, 'Routine references days it does not have');
    routine.name = body.name;
    routine.days = body.days.map((day, position) => ({
      id: day.id ?? nextId('day'),
      position,
      name: day.name,
      exerciseIds: [...day.exerciseIds],
    }));
    return HttpResponse.json(withoutOwner(routine));
  }),

  http.post('/api/routines/:id/activate', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const routine = state.routines.find((r) => r.id === params.id && r.userId === user.id);
    if (!routine) return problem(404, 'Routine not found');
    for (const r of state.routines) if (r.userId === user.id) r.isActive = r.id === routine.id;
    return HttpResponse.json(withoutOwner(routine));
  }),

  http.delete('/api/routines/:id', ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return problem(401, 'Unauthorized');
    const routine = state.routines.find((r) => r.id === params.id && r.userId === user.id);
    if (!routine) return problem(404, 'Routine not found');
    state.routines = state.routines.filter((r) => r !== routine);
    for (const w of state.workouts) {
      if (w.routineDay?.routineId === routine.id) w.routineDay = undefined;
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
