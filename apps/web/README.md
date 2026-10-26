# @fitness/web — Frontend

Single-page app for the gym tracker: **React 19 · TanStack Router · TanStack Query · Vite**,
served by **Nginx** in its own container.

## What it does

| Route                              | Page                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| `/login`, `/register`              | Sign in / create an account                                |
| `/workouts`                        | Sessions (paginated, newest first) and the "Next up" card  |
| `/workouts/start`                  | What + opens: the routine's next day, other days, or empty |
| `/workouts/new`                    | Log a session; `?routineDayId=` pre-fills that day's sets  |
| `/workouts/$workoutId` (`/edit`)   | Session detail with every set; edit or delete              |
| `/routines`, `/routines/new`       | Routines (rotating day splits) and the routine editor      |
| `/routines/$routineId` (`/edit`)   | Days and exercises; follow, edit or delete                 |
| `/exercises`                       | Searchable catalog and "Add exercise"                      |
| `/exercises/$exerciseId` (`/edit`) | Progress (stats, est. 1RM chart, sessions); edit or delete |
| `/account`                         | Profile, kg/lb unit, sign out                              |

Phones get a bottom tab bar (Workouts · Routines · + · Exercises · Account); form pages
hide it behind their own sticky Save bar. The app is installable from Safari ("Add to Home
Screen": manifest, icons and Apple meta tags in `index.html` and `public/`). The top bar
shows the deploy version from the repo-root `VERSION` file.

## How it is built

- **Routing** — code-based TanStack Router routes in `src/router.tsx`. A pathless `_app`
  layout guards every authenticated page and redirects to `/login?redirect=…`.
- **Data** — TanStack Query. Query definitions live in `src/api/queries.ts` and are shared:
  route loaders call `ensureQueryData` (so data is ready, and prefetched on link hover)
  and components read it with `useSuspenseQuery`.
- **API client** — `src/api/client.ts`. Always calls the same-origin `/api/*`, attaches the
  access token, and on a 401 refreshes it once (concurrent 401s share a single refresh,
  since the API rotates refresh tokens). Errors surface as `ApiError` with the RFC 7807 body.
- **Units** — weights are stored in kg; `src/components/units.ts` converts to and from the
  user's kg/lb preference (inputs, labels, −/+ steps of 2.5 kg or 5 lb).
- **Contracts** — request/response types and enums come from `@fitness/contracts`, which
  Vite and TypeScript resolve from its TS source (see `vite.config.ts` / `tsconfig.json`).
- **Tokens** are kept in `localStorage` so a reload stays signed in. That is simple but
  readable by any script on the page; moving the refresh token to an httpOnly cookie is
  the natural hardening step once the API supports it.

## Running it

| Mode             | Command           | URL                   | `/api` goes to                |
| ---------------- | ----------------- | --------------------- | ----------------------------- |
| Host dev (HMR)   | `pnpm dev:web`    | http://localhost:5173 | Vite proxy → `localhost:3000` |
| Docker dev (HMR) | `pnpm docker:dev` | http://localhost:5173 | Vite proxy → `gateway:3000`   |
| Docker prod-like | `pnpm docker:up`  | http://localhost:8080 | Nginx → `gateway:3000`        |

Override the proxy target with `VITE_API_PROXY_TARGET` (dev) or `GATEWAY_URL` (Nginx
image), and the published port with `WEB_PORT`.

## Tests

**Vitest** + **Testing Library** + **MSW**, in jsdom:

| Command                                    | What                        |
| ------------------------------------------ | --------------------------- |
| `pnpm --filter @fitness/web test`          | Run once (also `pnpm test`) |
| `pnpm --filter @fitness/web test:watch`    | Watch mode                  |
| `pnpm --filter @fitness/web test:coverage` | With v8 coverage report     |

- `src/test/api.ts` is an in-memory fake of the gateway served by MSW at the network
  level (rotating refresh tokens, RFC 7807 errors, 409/422 rules). Tests seed it with
  `seedUser` / `seedExercise` / `seedWorkout` and read it back via `apiState`.
- `renderApp(path)` (`src/test/render.tsx`) mounts the real router + Query client on a
  memory history, so page tests go through loaders, guards and the API client exactly
  like the browser. `signedInAs()` starts a test with a valid session.
- Unhandled requests fail the test (`onUnhandledFrame: 'error'`).

The catalog is loaded in a single page of 100 (the API maximum); add search/paging to the
exercise picker if the catalog grows past that.
