import { describe, it, expect, vi, beforeEach } from 'vitest';

const capturedLogs: Array<Record<string, unknown>> = [];

vi.mock('pino', () => ({
  default: vi.fn((options?: { redact?: { paths: string[]; censor: string } }) => {
    const censorMap = new Map<string, string>();
    const paths = options?.redact?.paths ?? [];
    const censor = options?.redact?.censor ?? '[REDACTED]';
    for (const p of paths) censorMap.set(p, censor);
    return {
      info: (payload: Record<string, unknown>) => {
        const redacted: Record<string, unknown> = { ...payload };
        for (const key of Object.keys(redacted)) {
          if (censorMap.has(key)) redacted[key] = censorMap.get(key);
        }
        capturedLogs.push(redacted);
      },
    };
  }),
}));

import { logContact } from '../log-contact.js';

describe('logContact PII redaction (NFR82)', () => {
  beforeEach(() => {
    capturedLogs.length = 0;
  });

  it('redacts email and never logs the raw value', () => {
    logContact({
      email: 'jean@example.com',
      outcome: 'sent',
      category: 'organisateur',
      subject: 'general',
      locale: 'fr',
    });
    expect(capturedLogs).toHaveLength(1);
    const log = capturedLogs[0]!;
    expect(log['email']).toBe('[REDACTED]');
    expect(JSON.stringify(log)).not.toContain('jean@example.com');
  });

  it('emits 8-char hex emailHash', () => {
    logContact({ email: 'jean@example.com', outcome: 'sent' });
    const log = capturedLogs[0]!;
    expect((log['emailHash'] as string).length).toBe(8);
    expect(log['emailHash']).toMatch(/^[a-f0-9]{8}$/);
  });

  it('scrubs email-shaped substrings from errorMessage', () => {
    logContact({
      email: 'foo@bar.com',
      outcome: 'failed',
      errorMessage: 'Failed to send to leaked@example.com: rate limited',
    });
    expect(capturedLogs[0]!['errorMessage']).toBe('[REDACTED]');
  });

  it('logs non-PII fields in plain (category, subject, locale)', () => {
    logContact({
      email: 'foo@bar.com',
      outcome: 'sent',
      category: 'organisateur',
      subject: 'general',
      locale: 'fr',
    });
    const log = capturedLogs[0]!;
    expect(log['category']).toBe('organisateur');
    expect(log['subject']).toBe('general');
    expect(log['locale']).toBe('fr');
  });

  it('silently returns when email is not a string', () => {
    logContact({ email: null as unknown as string, outcome: 'sent' });
    expect(capturedLogs).toHaveLength(0);
  });
});
