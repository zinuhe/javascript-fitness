# CLAUDE.md

Gym tracker: NestJS microservices + React/TanStack frontend in a pnpm/Turborepo monorepo.
See `README.md` for architecture, scripts and how to run it.

## Deploy

This site is published on a Raspberry Pi 5 with Docker (`docker/docker-compose.yml`).
README "Deploying to the Raspberry Pi" has the details.

- **The only way to deploy is `deploy-pi` from the repo root on the Mac.** It bumps
  `VERSION`, rsyncs the working tree, builds the images on the Mac (`BUILD_ON="mac"`), sends
  only the changed ones to the Pi, recreates the changed containers and waits until every
  service is healthy. Never build or edit on the Pi. The final step runs on the Pi on its
  own (the Mac only follows its log); `deploy-pi --status` shows how it went.
- When a change is finished and verified locally (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e`), publish it with `deploy-pi`, then commit the change together with the
  bumped `VERSION`. Commit and push only when asked.
- If the change deletes or moves files, run `deploy-pi --dry-run` first and review the list.
- `deploy-pi` uploads the working tree as is, uncommitted changes included.
- Before a deploy that adds a Prisma migration, back up the Pi's databases (`pg_dump` of
  `core_db` and `auth_db` from the `postgres` container) to the Mac.
- The Dockerfiles install dependencies from the lockfile and the `package.json` files only,
  so code-only deploys reuse the cached install. When adding a workspace package, add its
  `package.json` to the `manifests` stage of `docker/Dockerfile` (and to `apps/web/Dockerfile`
  if the frontend depends on it). Dependency changes make the next build slower.
- Do not edit `.deploy.env` or `.deployignore` without asking.

## Domain notes

- Weights are always stored and exchanged in kilograms; kg/lb is only a per-user display and
  input preference (`apps/web/src/components/units.ts`).
- The exercise catalog is shared by every user; workouts and routines are per user.
- The web app is used mostly on an iPhone: design mobile-first (16px inputs, 44px targets,
  safe areas) and check it at 393×852 as well as on desktop.
