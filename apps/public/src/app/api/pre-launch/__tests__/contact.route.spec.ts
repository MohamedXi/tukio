import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/features/pre-launch/services/resend-client', () => ({
  resendClient: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }),
    },
  },
}));

vi.mock('@/features/pre-launch/services/rate-limit-client', () => ({
  signupRatelimit: {
    limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60_000 }),
  },
  contactRatelimit: {
    limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60_000 }),
  },
}));

vi.mock('@/features/pre-launch/services/log-contact', () => ({
  logContact: vi.fn(),
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html><body>email</body></html>'),
}));

import { POST } from '../contact/route.js';
import { resendClient } from '@/features/pre-launch/services/resend-client';
import { contactRatelimit } from '@/features/pre-launch/services/rate-limit-client';

const ORIGIN = 'http://localhost:3000';

function makeRequest(body: unknown, opts: { origin?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'sec-fetch-site': 'same-origin',
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.origin === undefined) headers['origin'] = ORIGIN;
  else if (opts.origin !== null) headers['origin'] = opts.origin;
  const json = JSON.stringify(body);
  headers['content-length'] = String(Buffer.byteLength(json, 'utf-8'));
  return new NextRequest(`${ORIGIN}/api/pre-launch/contact`, {
    method: 'POST',
    headers,
    body: json,
  });
}

const VALID_BODY = {
  firstName: 'Jean',
  lastName: 'Martin',
  email: 'jean@example.com',
  category: 'organisateur',
  subject: 'general',
  message: 'Bonjour, ceci est un message de test assez long.',
  locale: 'fr',
};

describe('POST /api/pre-launch/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['RESEND_API_KEY'] = 're_test_key';
    process.env['RESEND_FROM_ADDRESS'] = 'Tukio <noreply@tukio.one>';
    process.env['CONTACT_INBOX'] = 'contact@tukio.one';
    process.env['NEXT_PUBLIC_BASE_URL'] = ORIGIN;
    vi.mocked(resendClient.emails.send).mockResolvedValue({
      data: { id: 'email-id' },
      error: null,
    } as never);
    vi.mocked(contactRatelimit.limit).mockResolvedValue({
      success: true,
      reset: Date.now() + 60_000,
    } as never);
  });

  it('returns 200 on happy path', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('calls resendClient.emails.send with replyTo set to sender email', async () => {
    await POST(makeRequest(VALID_BODY));
    expect(vi.mocked(resendClient.emails.send)).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'jean@example.com' }),
    );
  });

  it('returns 422 on message too short', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, message: 'short' }));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(422);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-VALIDATION-001');
  });

  it('returns 422 on missing body', async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(422);
  });

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(contactRatelimit.limit).mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 30_000,
    } as never);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('returns 502 when Resend email.send returns error (new shape)', async () => {
    vi.mocked(resendClient.emails.send).mockResolvedValueOnce({
      data: null,
      error: { name: 'service_unavailable', message: 'Service Unavailable' },
    } as never);
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(502);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-EXTERNAL-001');
  });

  it('returns 502 when Resend email.send throws', async () => {
    vi.mocked(resendClient.emails.send).mockRejectedValueOnce(new Error('Boom'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });

  it('returns 403 when cross-origin', async () => {
    const res = await POST(makeRequest(VALID_BODY, { origin: 'https://evil.com' }));
    // Default sec-fetch-site: 'same-origin' overrides origin check, so we need a fresh request
    const evilReq = new NextRequest(`${ORIGIN}/api/pre-launch/contact`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.com',
        'sec-fetch-site': 'cross-site',
        'content-length': String(JSON.stringify(VALID_BODY).length),
      },
      body: JSON.stringify(VALID_BODY),
    });
    const res2 = await POST(evilReq);
    expect(res2.status).toBe(403);
    // First call (with same-origin header) succeeded, so res.status would be 200.
    expect(res.status).toBe(200);
  });

  it('returns 422 on invalid email in body', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: 'not-valid' }));
    expect(res.status).toBe(422);
  });

  it('returns 422 on email with CRLF (header injection guard)', async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, email: 'attacker@evil.com\r\nBcc: victim@target.com' }),
    );
    expect(res.status).toBe(422);
  });
});
