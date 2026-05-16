import 'reflect-metadata';
import { type LoggerService, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { ZodValidationPipe } from 'nestjs-zod';
import { correlationMiddleware } from '@tukio/messaging/correlation/middleware';
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

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyCookie);
  // Story 0.7 correlation propagation — sets request.correlationId from
  // `X-Tukio-Correlation-Id` (or mints a uuid) and wraps the request lifecycle
  // in AsyncLocalStorage so downstream code can grab it without explicit
  // parameter passing.
  fastify.addHook('onRequest', (req, reply, done) => {
    correlationMiddleware(req, reply, (err) =>
      // Fastify's HookHandlerDoneFunction is typed `(err?: Error)` — coerce
      // unknown into Error|undefined so the hook contract is satisfied.
      done(err instanceof Error ? err : undefined),
    );
  });

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new EnvelopeExceptionFilter());
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  // ZodValidationPipe validates `@Body() dto: <CreateZodDto>()`-typed handler
  // params. Invalid bodies surface as ZodError which the EnvelopeExceptionFilter
  // maps to 422 VALIDATION-FAILED-001.
  app.useGlobalPipes(new ZodValidationPipe());

  const config = app.get(EnvironmentConfigService);
  const port = config.getPort();

  // Browser-facing endpoints (POST /v1/auth/customer/register, …) are called
  // from the Next.js apps with `withCredentials: true`. CORS spec disallows
  // wildcard origins when credentials are sent, so list the exact frontends.
  // Configurable via CORS_ORIGINS env (comma-separated). Dev defaults to the
  // 3 local Next.js ports.
  app.enableCors({
    origin: config.getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Tukio-Correlation-Id',
      'X-Tukio-Locale',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['Retry-After', 'X-Tukio-Correlation-Id'],
    maxAge: 86_400,
  });

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
