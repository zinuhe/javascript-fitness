import type { QueryClient } from '@tanstack/react-query';
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { ApiError, tokenStore } from './api/client';
import {
  exerciseQuery,
  exercisesQuery,
  lastSetsQuery,
  meQuery,
  nextRoutineQuery,
  progressQuery,
  routineQuery,
  routinesQuery,
  workoutQuery,
  workoutsQuery,
} from './api/queries';
import { ErrorView, NotFound, Pending, defaultProgressEquipment } from './components/ui';
import { LoginPage, RegisterPage } from './pages/auth';
import { AppLayout } from './pages/layout';
import { WorkoutDetailPage, WorkoutsPage } from './pages/workouts';
import { EditWorkoutPage, NewWorkoutPage } from './pages/workout-form';
import { EditExercisePage, ExerciseDetailPage, ExercisesPage } from './pages/exercises';
import { EditRoutinePage, NewRoutinePage, RoutineDetailPage, RoutinesPage } from './pages/routines';
import { StartWorkoutPage } from './pages/start';
import { AccountPage } from './pages/account';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
});

// ── Public ──────────────────────────────────────────────────────────────────────
const authSearch = (search: Record<string, unknown>): { redirect?: string } => ({
  redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
});

const redirectIfSignedIn = () => {
  if (tokenStore.get()) throw redirect({ to: '/workouts' });
};

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: authSearch,
  beforeLoad: redirectIfSignedIn,
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: authSearch,
  beforeLoad: redirectIfSignedIn,
  component: RegisterPage,
});

// ── Authenticated (pathless layout) ─────────────────────────────────────────────
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: ({ location }) => {
    if (!tokenStore.get()) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  loader: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        tokenStore.clear();
        throw redirect({ to: '/login', search: { redirect: location.href } });
      }
      throw error;
    }
  },
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/workouts' });
  },
});

const workoutsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'workouts',
  // Optional so plain links to `/workouts` stay valid; page 1 is the default.
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    const page = Number(search.page);
    return { page: Number.isInteger(page) && page > 1 ? page : undefined };
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workoutsQuery(deps.page)),
      context.queryClient.ensureQueryData(exercisesQuery),
      context.queryClient.ensureQueryData(nextRoutineQuery),
    ]),
  component: WorkoutsPage,
});

// What the tab bar's + opens: the routine's next day, or the empty form without a routine.
const startWorkoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'workouts/start',
  loader: async ({ context }) => {
    const [next] = await Promise.all([
      context.queryClient.ensureQueryData(nextRoutineQuery),
      context.queryClient.ensureQueryData(exercisesQuery),
    ]);
    if (!next) throw redirect({ to: '/workouts/new', replace: true });
  },
  component: StartWorkoutPage,
});

const newWorkoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'workouts/new',
  // routineDayId pre-fills the form with that routine day and the weights used last time.
  validateSearch: (search: Record<string, unknown>): { routineDayId?: string } => ({
    routineDayId: typeof search.routineDayId === 'string' ? search.routineDayId : undefined,
  }),
  loaderDeps: ({ search }) => ({ routineDayId: search.routineDayId }),
  loader: async ({ context, deps }) => {
    const [, routines] = await Promise.all([
      context.queryClient.ensureQueryData(exercisesQuery),
      context.queryClient.ensureQueryData(routinesQuery),
    ]);
    const day = routines.flatMap((routine) => routine.days).find((d) => d.id === deps.routineDayId);
    await context.queryClient.ensureQueryData(lastSetsQuery(day?.exerciseIds ?? []));
  },
  component: NewWorkoutPage,
});

const workoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'workouts/$workoutId',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workoutQuery(params.workoutId)),
      context.queryClient.ensureQueryData(exercisesQuery),
    ]),
  component: WorkoutDetailPage,
});

const editWorkoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'workouts/$workoutId/edit',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workoutQuery(params.workoutId)),
      context.queryClient.ensureQueryData(exercisesQuery),
      context.queryClient.ensureQueryData(routinesQuery),
    ]),
  component: EditWorkoutPage,
});

const exercisesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'exercises',
  loader: ({ context }) => context.queryClient.ensureQueryData(exercisesQuery),
  component: ExercisesPage,
});

const exerciseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'exercises/$exerciseId',
  loader: async ({ context, params }) => {
    const exercise = await context.queryClient.ensureQueryData(exerciseQuery(params.exerciseId));
    await context.queryClient.ensureQueryData(
      progressQuery(params.exerciseId, defaultProgressEquipment(exercise)),
    );
  },
  component: ExerciseDetailPage,
});

const editExerciseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'exercises/$exerciseId/edit',
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(exerciseQuery(params.exerciseId)),
  component: EditExercisePage,
});

const routinesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'routines',
  loader: ({ context }) => context.queryClient.ensureQueryData(routinesQuery),
  component: RoutinesPage,
});

const newRoutineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'routines/new',
  loader: ({ context }) => context.queryClient.ensureQueryData(exercisesQuery),
  component: NewRoutinePage,
});

const routineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'routines/$routineId',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(routineQuery(params.routineId)),
      context.queryClient.ensureQueryData(exercisesQuery),
    ]),
  component: RoutineDetailPage,
});

const editRoutineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'routines/$routineId/edit',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(routineQuery(params.routineId)),
      context.queryClient.ensureQueryData(exercisesQuery),
    ]),
  component: EditRoutinePage,
});

const accountRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'account',
  component: AccountPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  appRoute.addChildren([
    indexRoute,
    workoutsRoute,
    startWorkoutRoute,
    newWorkoutRoute,
    workoutRoute,
    editWorkoutRoute,
    routinesRoute,
    newRoutineRoute,
    routineRoute,
    editRoutineRoute,
    exercisesRoute,
    exerciseRoute,
    editExerciseRoute,
    accountRoute,
  ]),
]);

/** `history` defaults to the browser's; tests pass a memory history to start anywhere. */
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    // Hover/focus on a link prefetches its loader; Query owns caching, so the router
    // should always call the loader and let `ensureQueryData` decide.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: Pending,
    defaultErrorComponent: ErrorView,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
