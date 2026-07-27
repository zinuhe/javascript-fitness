import { z } from 'zod';
import { baseEnvSchema, validateEnv } from '@fitness/config';

const gatewayEnvSchema = baseEnvSchema.extend({
  GATEWAY_PORT: z.coerce.number().int().positive().default(3000),
  AUTH_SERVICE_URL: z.string().url(),
  CORE_SERVICE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  // Comma-separated list of allowed CORS origins.
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function loadGatewayEnv(): GatewayEnv {
  return validateEnv(gatewayEnvSchema);
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
