# Fitness — Gym Exercise Tracker

Backend de microservicios para registrar y seguir entrenamientos de gimnasio.
**Node.js + TypeScript · NestJS · Prisma · PostgreSQL · Docker.**

> Estado: en construcción. El frontend (probablemente React) aún no está decidido; solo
> existe un placeholder en `apps/web`.

## Arquitectura

```
Cliente ──▶ API Gateway ──▶ auth-service ──▶ Postgres (auth_db)
              (JWT,          core-service ──▶ Postgres (core_db)
           rate-limit,
             CORS)
```

- **Monorepo** con pnpm workspaces + Turborepo.
- **2 microservicios + gateway**, comunicación **REST síncrona** a través del gateway.
- **Arquitectura hexagonal** (ports & adapters) dentro de cada servicio: la lógica de
  negocio depende de **interfaces Repository**, y Prisma vive solo en los adaptadores de
  `infrastructure` → cambiar de fuente de datos no toca el dominio.
- **Una base de datos por servicio** (`auth_db`, `core_db`) sobre un único contenedor
  Postgres.

### Estructura

| Ruta                 | Descripción                                                     |
| -------------------- | --------------------------------------------------------------- |
| `apps/gateway`       | API Gateway / BFF — único punto de entrada público              |
| `apps/auth-service`  | Autenticación y usuarios (JWT access + refresh, argon2)         |
| `apps/core-service`  | Ejercicios, entrenamientos, series y progreso                   |
| `apps/web`           | Placeholder del frontend React                                  |
| `packages/contracts` | Tipos/interfaces de API compartidos (framework-agnósticos)      |
| `packages/common`    | Errores de dominio, filtro problem+json, correlation-id, logger |
| `packages/config`    | tsconfig base y validación de entorno (Zod)                     |
| `docker/`            | `docker-compose` de dev y prod-like                             |

## Prerrequisitos

- **Node.js ≥ 20** (recomendado 24; hay `.nvmrc`).
- **pnpm** — actívalo con `corepack enable`.
- **Docker Desktop** — para Postgres y los contenedores.

## Puesta en marcha (desarrollo)

```bash
corepack enable
pnpm install
cp .env.example .env          # ajusta secretos
pnpm build                    # compila los paquetes compartidos
pnpm docker:dev               # levanta postgres + servicios con hot-reload
```

- Gateway: http://localhost:3000 · Swagger agregado en `/docs`
- auth-service: http://localhost:3001 · core-service: http://localhost:3002

## Scripts

| Comando           | Acción                                      |
| ----------------- | ------------------------------------------- |
| `pnpm build`      | Compila todos los paquetes/apps (Turborepo) |
| `pnpm dev`        | Modo desarrollo (watch)                     |
| `pnpm lint`       | ESLint en todo el workspace                 |
| `pnpm typecheck`  | Chequeo de tipos                            |
| `pnpm test`       | Tests unitarios (Jest)                      |
| `pnpm test:e2e`   | Tests e2e (Testcontainers + supertest)      |
| `pnpm docker:dev` | Entorno Docker de desarrollo                |

## Convenciones

- **Commits**: Conventional Commits (validado por commitlint). Scopes: `auth`, `core`,
  `gateway`, `contracts`, `common`, `config`, `docker`, `ci`, `repo`.
- **Errores**: respuestas RFC 7807 (`application/problem+json`) con `correlationId`.
- **Validación**: DTOs con `class-validator` + `ValidationPipe` global.

## Licencia

MIT — ver [LICENSE](./LICENSE).
