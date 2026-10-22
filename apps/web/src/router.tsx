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
  meQuery,
  progressQuery,
  workoutQuery,
  workoutsQuery,
} from './api/queries';
import { ErrorView, NotFound, Pending } from './components/ui';
import { LoginPage, RegisterPage } from './pages/auth';
import { AppLayout } from './pages/layout';
import { WorkoutDetailPage, WorkoutsPage } from './pages/workouts';
import { NewWorkoutPage } from './pages/new-workout';
import { ExerciseDetailPage, ExercisesPage } from './pages/exercises';

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
    ]),
  component: WorkoutsPage,
});

const newWorkoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'workouts/new',
  loader: ({ context }) => context.queryClient.ensureQueryData(exercisesQuery),
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

const exercisesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'exercises',
  loader: ({ context }) => context.queryClient.ensureQueryData(exercisesQuery),
  component: ExercisesPage,
});

const exerciseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'exercises/$exerciseId',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(exerciseQuery(params.exerciseId)),
      context.queryClient.ensureQueryData(progressQuery(params.exerciseId)),
    ]),
  component: ExerciseDetailPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  appRoute.addChildren([
    indexRoute,
    workoutsRoute,
    newWorkoutRoute,
    workoutRoute,
    exercisesRoute,
    exerciseRoute,
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
