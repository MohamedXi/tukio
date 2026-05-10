import { randomUUID } from 'node:crypto';
import { correlationContext } from './correlation-context.js';

export type FastifyRequest = {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
};
export type FastifyReply = unknown;
export type NextFunction = (err?: unknown) => void;

// Fastify middleware: extracts X-Tukio-Correlation-Id header or generates a new UUID,
// sets request.correlationId, and wraps the rest of the request in the ALS context.
export function correlationMiddleware(
  req: FastifyRequest,
  _reply: FastifyReply,
  done: NextFunction,
): void {
  const header = req.headers['x-tukio-correlation-id'];
  const corrId = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
  req.correlationId = corrId;
  correlationContext.runWithContext(corrId, async () => done()).catch(done);
}
