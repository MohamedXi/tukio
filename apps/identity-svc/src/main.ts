import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { EnvironmentConfigService } from './infrastructure/config/environment-config.service.js';
import { EnvelopeExceptionFilter } from './infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from './infrastructure/http/interceptors/response-envelope.interceptor.js';
import { LOGGER } from './domain/ports/tokens.js';
import type { ILogger } from './domain/ports/logger.port.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new EnvelopeExceptionFilter());

  const logger = app.get<ILogger>(LOGGER);
  const config = app.get(EnvironmentConfigService);
  const port = config.getPort();

  await app.listen(port, '0.0.0.0');
  logger.info('identity-svc listening', { port, env: config.getNodeEnv() });
}

void bootstrap();
