import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from '@fitness/common';

/**
 * Global pipes and filters of the HTTP stack. Shared by `main.ts` and the e2e tests so both
 * validate requests and render RFC 7807 errors exactly the same way.
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
