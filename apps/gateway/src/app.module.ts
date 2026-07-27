import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerConfig } from '@fitness/common';
import { loadGatewayEnv, type GatewayEnv } from './config/env';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [() => loadGatewayEnv() as unknown as Record<string, unknown>],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<GatewayEnv, true>) =>
        buildLoggerConfig({
          serviceName: 'gateway',
          level: config.get('LOG_LEVEL', { infer: true }),
          pretty: config.get('NODE_ENV', { infer: true }) !== 'production',
        }),
    }),
    HealthModule,
  ],
})
export class AppModule {}
