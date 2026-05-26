import pino from 'pino';
import crypto from 'node:crypto';

// Pino redacts the structured keys we explicitly log; errorMessage is scrubbed manually
// before being passed in because it can contain echoed email strings from Resend errors.
const logger = pino({
  redact: {
    paths: [
      'email',
      'firstName',
      'lastName',
      '*.email',
      '*.firstName',
      '*.lastName',
      'errorMessage',
    ],
    censor: '[REDACTED]',
  },
});

// Strip any email-shaped substring (e.g. Resend echoes "Contact with email foo@bar.com").
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
function scrubEmails(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(EMAIL_REGEX, '[REDACTED]');
}

interface SignupLogData {
  email: string;
  outcome: 'created' | 'duplicate' | 'failed' | 'dev_fallback';
  position?: number;
  role?: string;
  locale?: string;
  acquisitionSource?: string;
  acquisitionMedium?: string;
  acquisitionCampaign?: string;
  errorMessage?: string;
}

export function logSignup(data: SignupLogData): void {
  if (typeof data.email !== 'string') return;
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
    acquisitionMedium: data.acquisitionMedium,
    acquisitionCampaign: data.acquisitionCampaign,
    errorMessage: scrubEmails(data.errorMessage),
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
  });
}
