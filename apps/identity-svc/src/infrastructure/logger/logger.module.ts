import { Global, Module } from '@nestjs/common';
import { LOGGER } from '../../domain/ports/tokens.js';
import { PinoLoggerService } from './pino-logger.service.js';

@Global()
@Module({
  providers: [
    {
      provide: LOGGER,
      useClass: PinoLoggerService,
    },
  ],
  exports: [LOGGER],
})
export class LoggerModule {}
