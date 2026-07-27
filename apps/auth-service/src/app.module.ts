import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerConfig, CorrelationIdMiddleware } from '@fitness/common';
import { loadAuthEnv, type AuthEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Load the repo-root .env when running from the app dir (pnpm dev). In Docker the
      // file is absent and env comes from compose — a missing file is silently ignored.
      envFilePath: ['../../.env'],
      // Fail fast: the whole env is parsed + validated once at startup.
      load: [() => loadAuthEnv() as unknown as Record<string, unknown>],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AuthEnv, true>) =>
        buildLoggerConfig({
          serviceName: 'auth-service',
          level: config.get('LOG_LEVEL', { infer: true }),
          pretty: config.get('NODE_ENV', { infer: true }) !== 'production',
        }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
