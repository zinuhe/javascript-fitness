import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { CoreEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  configureApp(app);

  const config = app.get(ConfigService<CoreEnv, true>);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fitness — Core Service')
    .setDescription('Exercises, workouts and progress API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get('CORE_SERVICE_PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
