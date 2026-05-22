import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock service modules (module-level singletons) — cleaner than mocking the SDKs
vi.mock('@/features/pre-launch/services/resend-client', () => ({
  resendClient: {
    contacts: {
      create: vi.fn().mockResolvedValue({ data: { id: 'contact-id' } }),
      list: vi.fn().mockResolvedValue({ data: { data: Array.from({ length: 100 }) } }),
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

vi.mock('@/features/pre-launch/services/log-signup', () => ({
  logSignup: vi.fn(),
}));

vi.mock('@/features/pre-launch/services/compute-position', () => ({
  computePosition: vi.fn().mockResolvedValue(248),
  getCachedPosition: vi.fn().mockResolvedValue(200),
}));

import { POST } from '../signup/route.js';
import { resendClient } from '@/features/pre-launch/services/resend-client';
import { signupRatelimit } from '@/features/pre-launch/services/rate-limit-client';

function makeRequest(body: unknown, cookieHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/pre-launch/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
  role: 'organisateur',
  rgpdOptIn: true,
  locale: 'fr',
};

describe('POST /api/pre-launch/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resendClient.contacts.create).mockResolvedValue({ data: { id: 'cid' } } as never);
    vi.mocked(resendClient.contacts.list).mockResolvedValue({
      data: { data: Array.from({ length: 100 }) },
    } as never);
    vi.mocked(signupRatelimit.limit).mockResolvedValue({
      success: true,
      reset: Date.now() + 60_000,
    } as never);
  });

  it('returns 200 with position on happy path', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; position: number };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.position).toBe(248);
  });

  it('returns 422 on invalid email', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: 'not-an-email' }));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-VALIDATION-001');
  });

  it('returns 422 on missing body', async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(422);
  });

  it('returns 200 alreadySubscribed when Resend returns 422 (duplicate)', async () => {
    const resendErr = Object.assign(new Error('duplicate'), { statusCode: 422 });
    vi.mocked(resendClient.contacts.create).mockRejectedValueOnce(resendErr);
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; alreadySubscribed?: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alreadySubscribed).toBe(true);
  });

  it('returns 502 when Resend is down', async () => {
    const resendErr = Object.assign(new Error('Service Unavailable'), { statusCode: 503 });
    vi.mocked(resendClient.contacts.create).mockRejectedValueOnce(resendErr);
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as { ok: boolean; error: { tukioCode: string } };
    expect(res.status).toBe(502);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-EXTERNAL-001');
  });

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(signupRatelimit.limit).mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 30_000,
    } as never);
    const res = await POST(makeRequest(VALID_BODY));
    const body = (await res.json()) as {
      ok: boolean;
      error: { tukioCode: string; retryAfter: number };
    };
    expect(res.status).toBe(429);
    expect(body.error.tukioCode).toBe('PRE-LAUNCH-RATE-LIMITED-001');
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('passes acquisition source from tk_acq cookie', async () => {
    const payload = { source: 'google_ads', medium: 'cpc', campaign: 'launch' };
    const cookie = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const res = await POST(makeRequest(VALID_BODY, `tk_acq=${cookie}`));
    expect(res.status).toBe(200);
  });

  it('calls resendClient.contacts.create with correct fields', async () => {
    await POST(makeRequest(VALID_BODY));
    expect(vi.mocked(resendClient.contacts.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'marie@example.com',
        firstName: 'Marie',
        lastName: 'Dupont',
        unsubscribed: false,
      }),
    );
  });
});
