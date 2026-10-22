import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Starts a throwaway Postgres (same major version as docker-compose), applies the real
 * Prisma migrations and exposes the env the app validates at startup. Runs once per
 * `test:e2e` run; the suites share the database, so tests use unique emails.
 */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  (globalThis as { __POSTGRES__?: unknown }).__POSTGRES__ = container;

  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    AUTH_DATABASE_URL: `${container.getConnectionUri()}?schema=public`,
    JWT_ACCESS_SECRET: 'e2e_access_secret_at_least_32_characters',
    JWT_REFRESH_SECRET: 'e2e_refresh_secret_at_least_32_characters',
  });

  const prisma = join(__dirname, '..', 'node_modules', '.bin', 'prisma');
  execFileSync(prisma, ['migrate', 'deploy'], { cwd: join(__dirname, '..'), stdio: 'pipe' });
}
