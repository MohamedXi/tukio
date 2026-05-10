import { Global, Module } from '@nestjs/common';
import { correlationContext, CORRELATION_CONTEXT } from './correlation-context.js';

@Global()
@Module({
  providers: [
    {
      provide: CORRELATION_CONTEXT,
      useValue: correlationContext,
    },
  ],
  exports: [CORRELATION_CONTEXT],
})
export class CorrelationContextModule {}
