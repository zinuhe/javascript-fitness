# Multi-stage, monorepo-aware image. Build context is the repo root.
# Parametrized by SERVICE so the same file builds gateway / auth-service / core-service.
#   docker build -f docker/Dockerfile --build-arg SERVICE=auth-service -t fitness-auth .
#
# Layer caching: dependency installs only depend on the lockfile and the package.json
# files, so a source-only change skips them and just recompiles (see `manifests`), and
# the compile only reruns when this service or a shared package changes (see `build`).
ARG NODE_VERSION=24-slim

# ── base ────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
# Prisma's query/schema engines link against libssl; the slim image ships without it, and
# Prisma would otherwise fall back to an openssl-1.1.x engine that cannot load at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
# Every install below shares one pnpm store through a BuildKit cache mount (id=pnpm-store,
# also used by apps/web/Dockerfile): each package is downloaded once and reused across
# images and builds. `sharing=locked` runs the installs one at a time, which a Raspberry Pi
# (slow microSD, flaky link to the registry) handles far better than several in parallel.
ENV PNPM_INSTALL_OPTS="--store-dir=/pnpm/store --network-concurrency=4 --fetch-retries=6 --fetch-timeout=300000"

# ── manifests ───────────────────────────────────────────────────────────────────
# Only what pnpm needs to resolve dependencies. Keep this list in sync with the
# workspace: a package missing here is installed without its dependencies.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/auth-service/package.json apps/auth-service/
COPY apps/core-service/package.json apps/core-service/
COPY apps/gateway/package.json apps/gateway/
COPY apps/web/package.json apps/web/
COPY packages/common/package.json packages/common/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
# The root `prepare: husky` installs git hooks for local dev; no git or husky here.
RUN npm pkg delete scripts.prepare

# ── deps: everything needed to build this service (cached until manifests change) ──
FROM manifests AS deps
ARG SERVICE
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
  pnpm install --frozen-lockfile --filter "@fitness/${SERVICE}..." $PNPM_INSTALL_OPTS

# ── prod-deps: the runtime node_modules (cached until manifests change) ─────────
# `--legacy` because pnpm 10+ otherwise requires `inject-workspace-packages=true`, which
# would also change how the shared packages are linked in local dev.
FROM manifests AS prod-deps
ARG SERVICE
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
  pnpm --filter "@fitness/${SERVICE}" --prod deploy --legacy /out $PNPM_INSTALL_OPTS

# ── build: compile, then stage only the build output for the runtime image ──────
FROM deps AS build
ARG SERVICE
# Only this service's sources and the shared packages, so a change elsewhere in the repo
# (another service, the web app) does not invalidate this compile.
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/${SERVICE} apps/${SERVICE}
# Generate the Prisma client if this service has one (gateway does not).
RUN pnpm --filter "@fitness/${SERVICE}" run prisma:generate || echo "no prisma for ${SERVICE}"
# Build the service and its workspace dependencies (the trailing '...').
RUN pnpm --filter "@fitness/${SERVICE}..." run build
# /stage/app: the service's dist (+ Prisma schema, migrations and generated client when
# present). /stage/packages/<name>/dist: each shared package's build output.
RUN set -e; app="apps/${SERVICE}"; mkdir -p /stage/app /stage/packages; \
  cp -r "$app/dist" /stage/app/; \
  for d in prisma generated; do [ ! -d "$app/$d" ] || cp -r "$app/$d" /stage/app/; done; \
  for p in packages/*; do \
    mkdir -p "/stage/packages/$(basename "$p")"; \
    cp -r "$p/dist" "/stage/packages/$(basename "$p")/"; \
  done

# ── runtime ─────────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
COPY --from=prod-deps /out /app
COPY --from=build /stage/app /app
# Shared packages are symlinks into node_modules/.pnpm/<hashed dir>, which COPY cannot
# write through, so drop each dist into the resolved target. Only the dists are written:
# the node_modules layer above stays cached.
COPY --from=build /stage/packages /tmp/packages
RUN set -e; for p in /tmp/packages/*; do \
    target="$(readlink -f "node_modules/@fitness/$(basename "$p")")"; \
    [ ! -d "$target" ] || cp -r "$p/dist" "$target/"; \
  done; \
  rm -rf /tmp/packages
USER node
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
