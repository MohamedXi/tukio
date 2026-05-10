import 'reflect-metadata';
import { type LoggerService, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { EnvironmentConfigService } from './infrastructure/config/environment-config.service.js';
import { EnvelopeExceptionFilter } from './infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from './infrastructure/http/interceptors/response-envelope.interceptor.js';
import { LOGGER } from './domain/ports/tokens.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  // Route NestJS internal logs (bootstrap, DI errors) through the Pino adapter.
  app.useLogger(app.get<LoggerService>(LOGGER));

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new EnvelopeExceptionFilter());
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  // ZodValidationPipe enables automatic DTO validation on incoming request bodies
  // for any endpoint that uses Zod-decorated DTOs (e.g. future POST/PATCH routes).
  // EnvelopeExceptionFilter maps any resulting ZodError to 422 VALIDATION-FAILED-001.
  app.useGlobalPipes(new ZodValidationPipe());

  const config = app.get(EnvironmentConfigService);
  const port = config.getPort();

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
