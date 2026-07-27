import 'reflect-metadata';
import type { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CorrelationIdMiddleware } from '@fitness/common';
import { AppModule } from './app.module';
import { parseCorsOrigins, type GatewayEnv } from './config/env';
import { createJwtMiddleware } from './proxy/jwt.middleware';

async function bootstrap(): Promise<void> {
  // Body parsing is disabled so proxied requests stream their raw body upstream untouched.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<GatewayEnv, true>);
  const authUrl = config.get('AUTH_SERVICE_URL', { infer: true });
  const coreUrl = config.get('CORE_SERVICE_URL', { infer: true });
  const jwtSecret = config.get('JWT_ACCESS_SECRET', { infer: true });

  // ── Cross-cutting edge concerns ───────────────────────────────────────────────
  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true })),
    credentials: true,
  });

  const correlation = new CorrelationIdMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) => correlation.use(req, res, next));

  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  // ── Reverse proxy ─────────────────────────────────────────────────────────────
  // Public auth routes.
  app.use(
    '/api/auth',
    createProxyMiddleware({
      target: authUrl,
      changeOrigin: true,
      pathRewrite: { '^/api/auth': '/auth' },
    }),
  );

  // Protected core routes — JWT verified at the edge before proxying.
  const jwtGuard = createJwtMiddleware(jwtSecret);
  for (const resource of ['exercises', 'workouts'] as const) {
    app.use(
      `/api/${resource}`,
      jwtGuard,
      createProxyMiddleware({
        target: coreUrl,
        changeOrigin: true,
        pathRewrite: { [`^/api/${resource}`]: `/${resource}` },
      }),
    );
  }

  // ── Aggregated docs (gateway surface + links to per-service Swagger) ───────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fitness — API Gateway')
    .setDescription(
      'Single entry point. Proxies `/api/auth/*` → auth-service and ' +
        '`/api/exercises/*`, `/api/workouts/*` → core-service. ' +
        'Per-service Swagger: auth-service `/docs`, core-service `/docs`.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get('GATEWAY_PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
