import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../config/config.module.js';
import { INSEE_SIRET_VALIDATOR } from '../../../domain/ports/tokens.js';
import { InseeSiretValidatorService } from './insee-siret-validator.service.js';

@Module({
  imports: [ConfigurationModule],
  providers: [
    {
      provide: INSEE_SIRET_VALIDATOR,
      useClass: InseeSiretValidatorService,
    },
  ],
  exports: [INSEE_SIRET_VALIDATOR],
})
export class InseeModule {}
