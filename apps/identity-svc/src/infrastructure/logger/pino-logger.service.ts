import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import pino, { type Logger as PinoLoggerInstance } from 'pino';
import type { ILogger, LogMetadata } from '../../domain/ports/logger.port.js';
import type { IConfigService } from '../../domain/ports/config.port.js';
import { CONFIG_SERVICE } from '../../domain/ports/tokens.js';

const PII_REDACT_PATHS = [
  'email',
  'password',
  'phone',
  'metadata.email',
  'metadata.password',
  'metadata.phone',
  '*.email',
  '*.password',
  '*.phone',
];

// Implements ILogger (domain port) + LoggerService (NestJS compat) so it can be
// passed to app.useLogger() to capture NestJS bootstrap/DI logs via Pino.
@Injectable()
export class PinoLoggerService implements ILogger, LoggerService {
  private readonly logger: PinoLoggerInstance;

  constructor(@Inject(CONFIG_SERVICE) private readonly config: IConfigService) {
    const level = config.getLogLevel();
    const isDev = config.getNodeEnv() !== 'production';
    this.logger = pino({
      level,
      base: {
        service: config.getServiceName(),
        version: config.getServiceVersion(),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: PII_REDACT_PATHS,
        censor: '***',
      },
      ...(isDev
        ? {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'SYS:standard' },
            },
          }
        : {}),
    });
  }

  // ILogger interface methods
  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(metadata ?? {}, message);
  }
  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(metadata ?? {}, message);
  }
  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(metadata ?? {}, message);
  }
  error(message: string, metadata?: LogMetadata): void {
    this.logger.error(metadata ?? {}, message);
  }

  // NestJS LoggerService adapter — maps framework log calls to Pino.
  log(message: unknown, context?: string): void {
    this.logger.info(context ? { context } : {}, String(message));
  }
  verbose(message: unknown, context?: string): void {
    this.logger.debug(context ? { context } : {}, String(message));
  }
  fatal(message: unknown, context?: string): void {
    this.logger.fatal(context ? { context } : {}, String(message));
  }
}
