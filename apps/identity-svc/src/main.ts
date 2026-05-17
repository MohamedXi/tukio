import 'reflect-metadata';
import { type LoggerService, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { EnvironmentConfigService } from './infrastructure/config/environment-config.service.js';
import { EnvelopeExceptionFilter } from './infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from './infrastructure/http/interceptors/response-envelope.interceptor.js';
import { LOGGER } from './domain/ports/tokens.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 3;
const MAX_PARTS_PER_REQUEST = 5;
const MAX_FIELD_SIZE_BYTES = 1 * 1024 * 1024;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  // Register @fastify/multipart before any route handling.
  // Story 1.3b — `POST /internal/pros` uses multipart for KYC file uploads.
  // Story 1.3b review P2/P7 — throwFileSizeLimit makes oversized uploads fail
  // explicitly (413) instead of silently truncating the buffer. files/parts/
  // fieldSize caps defeat DoS via request inflation.
  await app.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: MAX_FILES_PER_REQUEST,
      parts: MAX_PARTS_PER_REQUEST,
      fieldSize: MAX_FIELD_SIZE_BYTES,
    },
  });

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
