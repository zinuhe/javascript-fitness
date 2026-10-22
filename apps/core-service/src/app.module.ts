import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerConfig, CorrelationIdMiddleware } from '@fitness/common';
import { loadCoreEnv, type CoreEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Load the repo-root .env when running from the app dir (pnpm dev); ignored in Docker.
      envFilePath: ['../../.env'],
      load: [() => loadCoreEnv() as unknown as Record<string, unknown>],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<CoreEnv, true>) =>
        buildLoggerConfig({
          serviceName: 'core-service',
          level: config.get('LOG_LEVEL', { infer: true }),
          pretty: config.get('NODE_ENV', { infer: true }) === 'development',
        }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ExercisesModule,
    WorkoutsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
