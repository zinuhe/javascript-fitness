# Frontend image. Build context is the repo root (the app consumes packages/contracts).
#   docker build -f apps/web/Dockerfile -t fitness-web .
# Targets: `dev` (Vite dev server with HMR) and `runtime` (default; static files on Nginx).
#
# Layer caching: the dependency install only depends on the lockfile and the package.json
# files, so a source-only change skips it and just rebuilds the bundle.
ARG NODE_VERSION=24-slim

# ── deps (cached until the manifests change) ────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
# The root `prepare: husky` installs git hooks for local dev; no git or husky here.
RUN npm pkg delete scripts.prepare
# Shared pnpm store and network settings: see the `base` stage of docker/Dockerfile.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
  pnpm install --frozen-lockfile --filter "@fitness/web..." \
  --store-dir=/pnpm/store --network-concurrency=4 --fetch-retries=6 --fetch-timeout=300000

# ── source ──────────────────────────────────────────────────────────────────────
FROM deps AS source
COPY . .

# ── dev ─────────────────────────────────────────────────────────────────────────
FROM source AS dev
EXPOSE 5173
CMD ["pnpm", "--filter", "@fitness/web", "dev", "--host", "0.0.0.0"]

# ── build ───────────────────────────────────────────────────────────────────────
FROM source AS build
RUN pnpm --filter @fitness/web build

# ── runtime ─────────────────────────────────────────────────────────────────────
FROM nginx:1.30-alpine AS runtime
# Upstream for `/api/*`; the official image renders templates with envsubst at startup.
ENV GATEWAY_URL=http://gateway:3000
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
