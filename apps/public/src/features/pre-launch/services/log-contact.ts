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
      'errorMessage',
    ],
    censor: '[REDACTED]',
  },
});

const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
function scrubEmails(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(EMAIL_REGEX, '[REDACTED]');
}

interface ContactLogData {
  email: string;
  outcome: 'sent' | 'failed' | 'dev_fallback';
  category?: string;
  subject?: string;
  locale?: string;
  errorMessage?: string;
}

export function logContact(data: ContactLogData): void {
  if (typeof data.email !== 'string') return;
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
    errorMessage: scrubEmails(data.errorMessage),
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
  });
}
