import { Global, Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module.js';
import { LOGGER } from '../../domain/ports/tokens.js';
import { PinoLoggerService } from './pino-logger.service.js';

@Global()
@Module({
  imports: [ConfigurationModule],
  providers: [
    {
      provide: LOGGER,
      useClass: PinoLoggerService,
    },
  ],
  exports: [LOGGER],
})
export class LoggerModule {}
