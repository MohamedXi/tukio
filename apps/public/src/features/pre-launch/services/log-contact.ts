import pino from 'pino';
import crypto from 'node:crypto';

const logger = pino({
  redact: {
    paths: [
      'email',
      'firstName',
      'lastName',
      'message',
      '*.email',
      '*.firstName',
      '*.lastName',
      '*.message',
    ],
    censor: '[REDACTED]',
  },
});

interface ContactLogData {
  email: string;
  outcome: 'sent' | 'failed';
  category?: string;
  subject?: string;
  locale?: string;
  errorMessage?: string;
}

export function logContact(data: ContactLogData): void {
  const emailHash = crypto
    .createHash('sha256')
    .update(data.email.toLowerCase())
    .digest('hex')
    .slice(0, 8);
  logger.info({
    event: 'pre_launch_contact',
    outcome: data.outcome,
    emailHash,
    email: '[REDACTED]',
    category: data.category,
    subject: data.subject,
    locale: data.locale,
    errorMessage: data.errorMessage,
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
  });
}
