# @fitness/web — Frontend (placeholder)

Reservado para el frontend. La tecnología aún **no está decidida** (probablemente React

- Vite). Este paquete es un marcador de posición para no bloquear el backend.

## Cuando se implemente

- `Dockerfile` propio (multi-stage: build de Vite → Nginx sirviendo estáticos).
- Consumir el API a través del **gateway** (`http://localhost:3000/api`).
- Reutilizar los tipos de `@fitness/contracts` para las peticiones/respuestas.
- Añadir el servicio `web` a `docker/docker-compose.yml` y `docker-compose.dev.yml`.

Referencia de contratos disponibles: `packages/contracts/src` (auth, exercises, workouts).
