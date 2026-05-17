import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../config/config.module.js';
import { MEDIA_STORAGE } from '../../../domain/ports/tokens.js';
import { R2MediaStorageService } from './r2-media-storage.service.js';

@Module({
  imports: [ConfigurationModule],
  providers: [
    {
      provide: MEDIA_STORAGE,
      useClass: R2MediaStorageService,
    },
  ],
  exports: [MEDIA_STORAGE],
})
export class R2Module {}
