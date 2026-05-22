import pino from 'pino';
import crypto from 'node:crypto';

const logger = pino({
  redact: {
    paths: ['email', 'firstName', 'lastName', '*.email', '*.firstName', '*.lastName'],
    censor: '[REDACTED]',
  },
});

interface SignupLogData {
  email: string;
  outcome: 'created' | 'duplicate' | 'failed';
  position?: number;
  role?: string;
  locale?: string;
  acquisitionSource?: string;
  errorMessage?: string;
}

export function logSignup(data: SignupLogData): void {
  const emailHash = crypto
    .createHash('sha256')
    .update(data.email.toLowerCase())
    .digest('hex')
    .slice(0, 8);
  logger.info({
    event: 'pre_launch_signup',
    outcome: data.outcome,
    emailHash,
    email: '[REDACTED]',
    position: data.position,
    role: data.role,
    locale: data.locale,
    acquisitionSource: data.acquisitionSource,
    errorMessage: data.errorMessage,
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
  });
}
