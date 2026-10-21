# Frontend image. Build context is the repo root (the app consumes packages/contracts).
#   docker build -f apps/web/Dockerfile -t fitness-web .
# Targets: `dev` (Vite dev server with HMR) and `runtime` (default; static files on Nginx).
ARG NODE_VERSION=24-slim

# ── deps ────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# ── dev ─────────────────────────────────────────────────────────────────────────
FROM deps AS dev
EXPOSE 5173
CMD ["pnpm", "--filter", "@fitness/web", "dev", "--host", "0.0.0.0"]

# ── build ───────────────────────────────────────────────────────────────────────
FROM deps AS build
RUN pnpm --filter @fitness/web build

# ── runtime ─────────────────────────────────────────────────────────────────────
FROM nginx:1.30-alpine AS runtime
# Upstream for `/api/*`; the official image renders templates with envsubst at startup.
ENV GATEWAY_URL=http://gateway:3000
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
