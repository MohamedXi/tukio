import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

interface FastifyRequestWithCookies {
  cookies?: Record<string, string | undefined>;
}

/**
 * `@Cookies('tk_acq')` → returns the cookie value (or `undefined`). Fastify's
 * `@fastify/cookie` plugin must be registered in main.ts for `request.cookies`
 * to be populated.
 */
export const Cookies = createParamDecorator(
  (name: string, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<FastifyRequestWithCookies>();
    const value = req.cookies?.[name];
    return value;
  },
);
