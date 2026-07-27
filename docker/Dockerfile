# Multi-stage, monorepo-aware image. Build context is the repo root.
# Parametrized by SERVICE so the same file builds gateway / auth-service / core-service.
#   docker build -f docker/Dockerfile --build-arg SERVICE=auth-service -t fitness-auth .
ARG NODE_VERSION=24-slim

# ── base ────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ── build ───────────────────────────────────────────────────────────────────────
FROM base AS build
ARG SERVICE
COPY . .
RUN pnpm install --frozen-lockfile
# Generate the Prisma client if this service has one (gateway does not).
RUN pnpm --filter "@fitness/${SERVICE}" run prisma:generate || echo "no prisma for ${SERVICE}"
# Build the service and its workspace dependencies (the trailing '...').
RUN pnpm --filter "@fitness/${SERVICE}..." run build
# Produce a self-contained package with only production deps.
RUN pnpm --filter "@fitness/${SERVICE}" --prod deploy /out

# ── runtime ─────────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /out /app
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
USER node
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
