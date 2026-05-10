import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { BackendActor } from '../types/actor.js';

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BackendActor => {
    const request = ctx.switchToHttp().getRequest<{ actor: BackendActor }>();
    return request.actor;
  },
);
