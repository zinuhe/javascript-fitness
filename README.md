# Fitness — Gym Exercise Tracker

Microservices backend for logging and tracking gym workouts.
**Node.js + TypeScript · NestJS · Prisma · PostgreSQL · Docker.**

> Status: work in progress. The frontend (likely React) is not decided yet; only a
> placeholder exists in `apps/web`.

## Architecture

```
Client ──▶ API Gateway ──▶ auth-service ──▶ Postgres (auth_db)
             (JWT,          core-service ──▶ Postgres (core_db)
          rate-limit,
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
| `apps/web`           | Frontend placeholder (React, TBD)                          |
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

- Gateway: http://localhost:3000 · aggregated Swagger at `/docs`
- auth-service: http://localhost:3001 · core-service: http://localhost:3002

Prisma migrations are applied automatically when each container starts (entrypoint). To
seed the exercise catalog: `pnpm --filter @fitness/core-service prisma:seed`.

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
pnpm dev     # starts gateway + auth + core together (Turborepo, watch)
```

### Individually (one per terminal)

There is a script per service in the root `package.json`:

| Service      | Dev (watch)        | Built (`node dist/main.js`) |
| ------------ | ------------------ | --------------------------- |
| gateway      | `pnpm dev:gateway` | `pnpm start:gateway`        |
| auth-service | `pnpm dev:auth`    | `pnpm start:auth`           |
| core-service | `pnpm dev:core`    | `pnpm start:core`           |

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

| Method   | Path                         | Auth | Description             |
| -------- | ---------------------------- | ---- | ----------------------- |
| POST     | `/api/auth/register`         | —    | Register + tokens       |
| POST     | `/api/auth/login`            | —    | Login                   |
| POST     | `/api/auth/refresh`          | —    | Rotate refresh token    |
| GET      | `/api/auth/me`               | JWT  | User profile            |
| GET/POST | `/api/exercises`             | JWT  | Exercise catalog (CRUD) |
| GET/POST | `/api/workouts`              | JWT  | User workouts           |
| GET      | `/api/workouts/progress/:id` | JWT  | Per-exercise progress   |

### Quick smoke test

```bash
# Register
curl -s localhost:3000/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"S3curePass","displayName":"Alex"}'
# Use the returned accessToken:
TOKEN=... ; curl -s localhost:3000/api/auth/me -H "authorization: Bearer $TOKEN"
```

## Scripts

| Command           | Action                              |
| ----------------- | ----------------------------------- |
| `pnpm build`      | Build every package/app (Turborepo) |
| `pnpm dev`        | Development mode (watch)            |
| `pnpm lint`       | ESLint across the workspace         |
| `pnpm typecheck`  | Type-check                          |
| `pnpm test`       | Unit tests (Jest)                   |
| `pnpm docker:dev` | Dockerized development environment  |

> End-to-end tests (Testcontainers + supertest) are planned as the next step; the
> `test:e2e` script is reserved in each service but not implemented yet.

## Conventions

- **Commits**: Conventional Commits (validated by commitlint). Scopes: `auth`, `core`,
  `gateway`, `contracts`, `common`, `config`, `docker`, `ci`, `repo`.
- **Errors**: RFC 7807 responses (`application/problem+json`) with a `correlationId`.
- **Validation**: `class-validator` DTOs + a global `ValidationPipe`.

## License

MIT — see [LICENSE](./LICENSE).
