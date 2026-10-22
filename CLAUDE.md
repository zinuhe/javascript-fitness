# CLAUDE.md

Gym tracker: NestJS microservices + React/TanStack frontend in a pnpm/Turborepo monorepo.
See `README.md` for architecture, scripts and how to run it.

## Deploy

This site is published on a Raspberry Pi 5 with Docker (`docker/docker-compose.yml`).

- When a change is finished and verified locally, publish it with `deploy-pi` from the repo
  root. It rsyncs the working tree to the Pi and runs `docker compose up -d --build` there.
- If the change deletes or moves files, run `deploy-pi --dry-run` first and review the list.
- `deploy-pi` uploads the working tree as is, uncommitted changes included.
- The Dockerfiles install dependencies from the lockfile and the `package.json` files only,
  so code-only deploys reuse the cached install. When adding a workspace package, add its
  `package.json` to the `manifests` stage of `docker/Dockerfile` (and to `apps/web/Dockerfile`
  if the frontend depends on it). Dependency changes make the next deploy slow again.
- Do not edit `.deploy.env` or `.deployignore` without asking.
