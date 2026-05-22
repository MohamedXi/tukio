import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture every log line emitted by pino by intercepting its output stream.
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

import { logSignup } from '../log-signup.js';

describe('logSignup PII redaction (NFR82)', () => {
  beforeEach(() => {
    capturedLogs.length = 0;
  });

  it('redacts email and never logs the raw value', () => {
    logSignup({
      email: 'marie@example.com',
      outcome: 'created',
      position: 248,
      role: 'organisateur',
      locale: 'fr',
      acquisitionSource: 'google_ads',
    });
    expect(capturedLogs).toHaveLength(1);
    const log = capturedLogs[0]!;
    expect(log['email']).toBe('[REDACTED]');
    expect(JSON.stringify(log)).not.toContain('marie@example.com');
  });

  it('emits an 8-char hex emailHash that does NOT reveal the email', () => {
    logSignup({ email: 'marie@example.com', outcome: 'created' });
    const log = capturedLogs[0]!;
    expect(typeof log['emailHash']).toBe('string');
    expect((log['emailHash'] as string).length).toBe(8);
    expect(log['emailHash']).toMatch(/^[a-f0-9]{8}$/);
  });

  it('emailHash is case-insensitive (lowercases input)', () => {
    logSignup({ email: 'Marie@Example.com', outcome: 'created' });
    const log1 = capturedLogs[0]!['emailHash'];
    capturedLogs.length = 0;
    logSignup({ email: 'marie@example.com', outcome: 'created' });
    const log2 = capturedLogs[0]!['emailHash'];
    expect(log1).toEqual(log2);
  });

  it('scrubs email-shaped substrings from errorMessage', () => {
    logSignup({
      email: 'jean@example.com',
      outcome: 'failed',
      errorMessage: 'Contact with email leaked@example.com already exists',
    });
    const log = capturedLogs[0]!;
    expect(log['errorMessage']).toBe('[REDACTED]');
  });

  it('logs non-PII fields in plain (role, locale, acquisitionSource)', () => {
    logSignup({
      email: 'foo@bar.com',
      outcome: 'created',
      role: 'organisateur',
      locale: 'fr',
      acquisitionSource: 'google_ads',
    });
    const log = capturedLogs[0]!;
    expect(log['role']).toBe('organisateur');
    expect(log['locale']).toBe('fr');
    expect(log['acquisitionSource']).toBe('google_ads');
  });

  it('emits a fresh correlationId per call', () => {
    logSignup({ email: 'a@b.com', outcome: 'created' });
    logSignup({ email: 'a@b.com', outcome: 'created' });
    expect(capturedLogs[0]!['correlationId']).not.toEqual(capturedLogs[1]!['correlationId']);
  });

  it('emits ISO 8601 timestamp', () => {
    logSignup({ email: 'a@b.com', outcome: 'created' });
    expect(capturedLogs[0]!['timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('silently returns when email is not a string (defensive)', () => {
    logSignup({ email: undefined as unknown as string, outcome: 'created' });
    expect(capturedLogs).toHaveLength(0);
  });
});
