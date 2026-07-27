import { z } from 'zod';
import { baseEnvSchema, validateEnv } from '@fitness/config';

const coreEnvSchema = baseEnvSchema.extend({
  CORE_SERVICE_PORT: z.coerce.number().int().positive().default(3002),
  CORE_DATABASE_URL: z.string().url(),
  // Shared with auth-service so core can verify access tokens (defense in depth).
  JWT_ACCESS_SECRET: z.string().min(32),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;

export function loadCoreEnv(): CoreEnv {
  return validateEnv(coreEnvSchema);
}
