import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CONFIG_SERVICE } from '../../domain/ports/tokens.js';
import { validateEnv } from './env.schema.js';
import { EnvironmentConfigService } from './environment-config.service.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
  ],
  providers: [
    EnvironmentConfigService,
    {
      provide: CONFIG_SERVICE,
      useExisting: EnvironmentConfigService,
    },
  ],
  exports: [EnvironmentConfigService, CONFIG_SERVICE],
})
export class ConfigurationModule {}
