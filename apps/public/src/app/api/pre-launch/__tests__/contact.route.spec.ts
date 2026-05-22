import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/features/pre-launch/services/resend-client', () => ({
  resendClient: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-id' } }),
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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/pre-launch/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
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
    vi.mocked(resendClient.emails.send).mockResolvedValue({ data: { id: 'email-id' } } as never);
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

  it('returns 502 when Resend email.send throws', async () => {
    vi.mocked(resendClient.emails.send).mockRejectedValueOnce(new Error('Service Unavailable'));
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(502);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-EXTERNAL-001');
  });

  it('returns 422 on invalid email in body', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: 'not-valid' }));
    expect(res.status).toBe(422);
  });
});
