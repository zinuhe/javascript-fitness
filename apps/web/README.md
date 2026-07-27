# @fitness/web — Frontend (placeholder)

Reserved for the frontend. The technology is **not decided yet** (likely React + Vite).
This package is a placeholder so it does not block the backend.

## When it gets implemented

- Its own `Dockerfile` (multi-stage: Vite build → Nginx serving static assets).
- Consume the API through the **gateway** (`http://localhost:3000/api`).
- Reuse the types from `@fitness/contracts` for requests/responses.
- Add the `web` service to `docker/docker-compose.yml` and `docker-compose.dev.yml`.

Available contract reference: `packages/contracts/src` (auth, exercises, workouts).
