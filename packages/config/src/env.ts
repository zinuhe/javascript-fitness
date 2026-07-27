import { z } from 'zod';

/**
 * Validates `source` (defaults to `process.env`) against a Zod schema and returns
 * the parsed, typed result. Throws a readable, aggregated error at startup if any
 * variable is missing or malformed — fail fast instead of crashing at runtime.
 */
export function validateEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  source: Record<string, unknown> = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

/** Common env fields shared by every service. Compose with `.merge()` per service. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
