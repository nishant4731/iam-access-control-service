import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { initTracing } from './common/tracing/tracing';

async function bootstrap(): Promise<void> {
  // Start tracing before the app so instrumentation can hook in.
  await initTracing();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's logs through Pino for structured JSON output.
  app.useLogger(app.get(Logger));

  // Global input validation — whitelist strips unknown props; transform applies
  // class-transformer so nested DTOs are instantiated.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Consistent, non-leaking error responses across HTTP + GraphQL.
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`IAM Access Control Service listening on port ${port} (GraphQL at /graphql)`);
}

void bootstrap();
