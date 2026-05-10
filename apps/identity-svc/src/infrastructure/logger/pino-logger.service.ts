import { Injectable } from '@nestjs/common';
import pino, { type Logger as PinoLoggerInstance } from 'pino';
import type { ILogger, LogMetadata } from '../../domain/ports/logger.port.js';

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

@Injectable()
export class PinoLoggerService implements ILogger {
  private readonly logger: PinoLoggerInstance;

  constructor() {
    const level = (process.env.LOG_LEVEL ?? 'info') as pino.LevelWithSilent;
    const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';
    this.logger = pino({
      level,
      base: {
        service: 'identity-svc',
        version: process.env.SERVICE_VERSION ?? '0.0.0',
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
}
