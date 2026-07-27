import { z } from 'zod';
import { baseEnvSchema, validateEnv } from '@fitness/config';

const authEnvSchema = baseEnvSchema.extend({
  AUTH_SERVICE_PORT: z.coerce.number().int().positive().default(3001),
  AUTH_DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1_209_600),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

/** Parse + validate env once at startup. Registered as a Nest config factory. */
export function loadAuthEnv(): AuthEnv {
  return validateEnv(authEnvSchema);
}
