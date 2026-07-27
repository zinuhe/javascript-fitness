import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_HEADER } from '../http/correlation-id.middleware';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
  /** Pretty-print logs (dev). In production emit raw JSON for log aggregators. */
  pretty?: boolean;
}

/**
 * Builds a `nestjs-pino` configuration: structured JSON logs, per-request correlation id,
 * and redaction of sensitive fields. Pass the result to `LoggerModule.forRoot(...)`.
 */
export function buildLoggerConfig(options: LoggerOptions): Params {
  const { serviceName, level = 'info', pretty = false } = options;

  return {
    pinoHttp: {
      name: serviceName,
      level,
      base: { service: serviceName },
      genReqId: (req: IncomingMessage) =>
        (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? randomUUID(),
      customProps: (req: IncomingMessage) => ({
        correlationId: req.headers[CORRELATION_ID_HEADER],
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.refreshToken',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
      transport: pretty
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:standard' } }
        : undefined,
    },
  };
}
