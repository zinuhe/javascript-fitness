# Fitness — Gym Exercise Tracker

Microservices backend for logging and tracking gym workouts.
**Node.js + TypeScript · NestJS · Prisma · PostgreSQL · Docker.**

> Status: in use. Workouts, exercise catalog, rotating routines with pre-filled sets, kg/lb,
> and an iPhone-first web app (`apps/web`, installable from Safari) served from a Raspberry Pi.

**Frontend: React 19 · TanStack Router · TanStack Query · Vite · Nginx.**

## Architecture

```
Browser ──▶ web (Nginx) ──▶ API Gateway ──▶ auth-service ──▶ Postgres (auth_db)
            SPA + /api       (JWT,          core-service ──▶ Postgres (core_db)
            proxy         rate-limit,
                             CORS)
```

- **Monorepo** with pnpm workspaces + Turborepo.
- **2 microservices + gateway**, communicating over **synchronous REST** through the gateway.
- **Hexagonal architecture** (ports & adapters) inside each service: business logic depends
  on **Repository interfaces**, and Prisma lives only in the `infrastructure` adapters →
  swapping the data source never touches the domain.
- **One database per service** (`auth_db`, `core_db`) on a single Postgres container.

### Structure

| Path                 | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `apps/gateway`       | API Gateway / BFF — the only public entry point            |
| `apps/auth-service`  | Authentication and users (JWT access + refresh, argon2)    |
| `apps/core-service`  | Exercises, workouts, sets and progress                     |
| `apps/web`           | Frontend SPA (React + TanStack), served by Nginx           |
| `packages/contracts` | Shared API types/interfaces (framework-agnostic)           |
| `packages/common`    | Domain errors, problem+json filter, correlation-id, logger |
| `packages/config`    | Base tsconfig and environment validation (Zod)             |
| `docker/`            | `docker-compose` for dev and prod-like                     |

## Prerequisites

- **Node.js ≥ 20** (24 recommended; see `.nvmrc`).
- **pnpm** — enable it with `corepack enable`.
- **Docker Desktop** — for Postgres and the containers.

## Getting started (development)

```bash
corepack enable
pnpm install
cp .env.example .env          # adjust secrets
pnpm build                    # compile the shared packages
pnpm docker:dev               # start postgres + services with hot-reload
```

- Frontend: http://localhost:5173 (Vite, hot-reload) · `pnpm docker:up` serves it on :8080
- Gateway: http://localhost:3000 · aggregated Swagger at `/docs`
- auth-service: http://localhost:3001 · core-service: http://localhost:3002

Prisma migrations are applied automatically when each container starts (entrypoint). To
seed the exercise catalog: `pnpm --filter @fitness/core-service prisma:seed`.

### Prod-like stack

`pnpm docker:up` builds and starts everything (Postgres, the three services and the
frontend). Open http://localhost:8080; only the frontend (:8080) is published — the API is
served under `/api` through it, and the gateway and Postgres are reachable only inside the
compose network (use `docker compose exec` to get at them). The database starts empty —
seed the catalog once from inside the container:

```bash
docker compose --env-file .env -f docker/docker-compose.yml exec core-service node prisma/seed.cjs
```

The images install dependencies from the lockfile and the `package.json` files only, so a
code-only change reuses the cached install and just recompiles. When you add a workspace
package, add its `package.json` to the `manifests` stage of `docker/Dockerfile` (and to
`apps/web/Dockerfile` if the frontend depends on it).

### Development without Docker (hybrid)

If you prefer to run only Postgres in Docker and the services on the host:

```bash
docker compose --env-file .env -f docker/docker-compose.dev.yml up postgres -d
pnpm --filter @fitness/auth-service exec prisma migrate deploy
pnpm --filter @fitness/core-service exec prisma migrate deploy
pnpm --filter @fitness/core-service prisma:seed   # optional
```

## Running the services

### All at once

```bash
pnpm build   # first time / after changing shared packages
pnpm dev     # starts gateway + auth + core + web together (Turborepo, watch)
```

### Individually (one per terminal)

There is a script per service in the root `package.json`:

| Service      | Dev (watch)        | Built (`node dist/main.js`) |
| ------------ | ------------------ | --------------------------- |
| gateway      | `pnpm dev:gateway` | `pnpm start:gateway`        |
| auth-service | `pnpm dev:auth`    | `pnpm start:auth`           |
| core-service | `pnpm dev:core`    | `pnpm start:core`           |
| web          | `pnpm dev:web`     | — (static build on Nginx)   |

The `dev:*` scripts recompile on change. The `start:*` scripts run the compiled output
(run `pnpm build` first) and are the most stable for just poking at the API.

## Health / heartbeat endpoints

Each service exposes **unauthenticated** health endpoints (no gateway, no JWT):

| Service      | Liveness                           | Readiness (checks the DB)         |
| ------------ | ---------------------------------- | --------------------------------- |
| gateway      | `GET http://localhost:3000/health` | —                                 |
| auth-service | `GET http://localhost:3001/health` | `GET http://localhost:3001/ready` |
| core-service | `GET http://localhost:3002/health` | `GET http://localhost:3002/ready` |

`GET /health` returns `{"status":"ok",...}` — ideal for a Postman ping or a container
healthcheck.

## Main endpoints (through the gateway, `/api` prefix)

| Method         | Path                                    | Auth | Description                                  |
| -------------- | --------------------------------------- | ---- | -------------------------------------------- |
| POST           | `/api/auth/register`                    | —    | Register + tokens                            |
| POST           | `/api/auth/login`                       | —    | Login                                        |
| POST           | `/api/auth/refresh`                     | —    | Rotate refresh token                         |
| GET            | `/api/auth/me`                          | JWT  | User profile                                 |
| PATCH          | `/api/auth/me`                          | JWT  | Update name / weight unit (kg or lb)         |
| GET/POST       | `/api/exercises`                        | JWT  | Exercise catalog (CRUD)                      |
| GET/POST       | `/api/workouts`                         | JWT  | User workouts                                |
| GET/PUT/DELETE | `/api/workouts/:id`                     | JWT  | One workout (PUT replaces it)                |
| GET            | `/api/workouts/progress/:id`            | JWT  | Per-exercise progress                        |
| GET            | `/api/workouts/last-sets?exerciseIds=…` | JWT  | Last sets per exercise (pre-fill)            |
| GET/POST       | `/api/routines`                         | JWT  | Routines (rotating day splits)               |
| GET/PUT/DELETE | `/api/routines/:id`                     | JWT  | One routine (PUT keeps day ids)              |
| POST           | `/api/routines/:id/activate`            | JWT  | Make it the active routine                   |
| GET            | `/api/routines/next`                    | JWT  | Next day of the active routine (204 if none) |

### Quick smoke test

```bash
# Register
curl -s localhost:3000/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"S3curePass","displayName":"Alex"}'
# Use the returned accessToken:
TOKEN=... ; curl -s localhost:3000/api/auth/me -H "authorization: Bearer $TOKEN"
```

## Scripts

| Command           | Action                                            |
| ----------------- | ------------------------------------------------- |
| `pnpm build`      | Build every package/app (Turborepo)               |
| `pnpm dev`        | Development mode (watch)                          |
| `pnpm lint`       | ESLint across the workspace                       |
| `pnpm typecheck`  | Type-check                                        |
| `pnpm test`       | Tests (Jest for services, Vitest for web)         |
| `pnpm test:e2e`   | End-to-end tests for auth and core (needs Docker) |
| `pnpm docker:dev` | Dockerized development environment                |

### End-to-end tests

`pnpm test:e2e` runs `apps/auth-service/test` and `apps/core-service/test`. Each run starts a
throwaway Postgres 17 with Testcontainers, applies the real Prisma migrations and drives the
whole Nest app over HTTP with supertest (same validation and error handling as `main.ts`,
via `src/app.setup.ts`). Only Docker is required; nothing touches your dev database. CI runs
them on every push.

## Deploying to the Raspberry Pi

The app runs on a Raspberry Pi 5 with the prod-like compose file. **There is one way to
deploy: `deploy-pi` from the Mac**, at the repo root. Nothing is built on the Pi (its
microSD is far too slow for it); images are built on the Mac (same arm64 architecture) and
only the ones that changed are sent over SSH.

```bash
deploy-pi --dry-run   # what would change on the Pi, without touching it
deploy-pi             # deploy
deploy-pi --status    # how the last deploy is going / how it ended, on the Pi
```

What one `deploy-pi` run does, configured in the git-ignored `.deploy.env`:

1. `PRE_DEPLOY` on the Mac: `scripts/bump-version.sh` bumps `VERSION` (shown in the app's
   top bar; each part 0–99, carrying over). Commit the new `VERSION` with your change.
2. rsync of the working tree to the Pi (uncommitted changes included). Paths in
   `.deployignore` (the Pi's `.env`, build output, local settings) are never uploaded nor
   deleted there.
3. `docker compose build` on the Mac (`BUILD_ON="mac"`), then `docker save | ssh docker load`
   for the images whose content differs from the Pi's.
4. `docker compose up -d --no-build` on the Pi: only changed containers are recreated;
   Prisma migrations run in each service's entrypoint.
5. `POST_DEPLOY` on the Pi: `scripts/wait-healthy.sh` waits until the web app and every
   backend `/health` answer, and fails with their logs otherwise.

Steps 4–5 run on the Pi as their own process (`~/.deploy-pi/fitness.log` there): the Mac
only follows the log. Once the images are sent you can close the Mac; the Pi finishes on
its own and `deploy-pi --status` shows the result later. A new deploy refuses to start while
the previous one is still finishing.

Requirements: Docker Desktop running on the Mac, SSH key access to the Pi, and the Mac on
the same network (or Tailscale) until the images are sent. Do not edit files on the Pi: the next deploy overwrites
them. Back up the database before deploys that add migrations.

## Conventions

- **Commits**: Conventional Commits (validated by commitlint). Scopes: `auth`, `core`,
  `gateway`, `web`, `contracts`, `common`, `config`, `docker`, `ci`, `repo`.
- **Errors**: RFC 7807 responses (`application/problem+json`) with a `correlationId`.
- **Validation**: `class-validator` DTOs + a global `ValidationPipe`.

## License

MIT — see [LICENSE](./LICENSE).
