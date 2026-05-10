import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import {
  ActorPropagationInterceptor,
  ACTOR_HEADER,
  LOCALE_HEADER,
  encodeActor,
} from './actor-propagation.interceptor.js';
import type { BackendActor } from '../types/actor.js';

const baseActor: BackendActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  role: 'pro',
  roles: ['pro'],
  locale: 'fr',
  email: 'p@t.one',
  emailVerified: true,
  amr: ['pwd', 'totp'],
};

function buildCtx(headers: Record<string, string | undefined>, actor: BackendActor | undefined) {
  const request = { headers, actor };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function h() {},
    getClass: () => class C {},
  } as unknown as Parameters<ActorPropagationInterceptor['intercept']>[0];
}

describe('ActorPropagationInterceptor — inbound stripping & enrichment', () => {
  const interceptor = new ActorPropagationInterceptor();
  const next = { handle: () => of('ok') };

  it('strips client-supplied X-Tukio-Actor on PUBLIC routes (no actor)', async () => {
    const headers = { [ACTOR_HEADER]: 'forged-attacker-payload' };
    const ctx = buildCtx(headers, undefined);
    await new Promise((r) => interceptor.intercept(ctx, next).subscribe(() => r(undefined)));
    expect(headers[ACTOR_HEADER]).toBeUndefined();
  });

  it('strips client-supplied X-Tukio-Locale on PUBLIC routes', async () => {
    const headers = { [LOCALE_HEADER]: 'attacker-en' };
    const ctx = buildCtx(headers, undefined);
    await new Promise((r) => interceptor.intercept(ctx, next).subscribe(() => r(undefined)));
    expect(headers[LOCALE_HEADER]).toBeUndefined();
  });

  it('overwrites client-supplied X-Tukio-Actor with trusted Actor on authenticated routes', async () => {
    const headers: Record<string, string | undefined> = { [ACTOR_HEADER]: 'forged' };
    const ctx = buildCtx(headers, baseActor);
    await new Promise((r) => interceptor.intercept(ctx, next).subscribe(() => r(undefined)));
    expect(headers[ACTOR_HEADER]).toBe(encodeActor(baseActor));
    expect(headers[LOCALE_HEADER]).toBe('fr');
  });
});

describe('encodeActor — wire-format projection', () => {
  it('projects only safe fields (drops email/amr/acr)', () => {
    const encoded = encodeActor({
      ...baseActor,
      email: 'private@confidential.com',
      acr: '2',
    });
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8')) as Record<
      string,
      unknown
    >;
    expect(decoded).toMatchObject({
      userId: baseActor.userId,
      role: 'pro',
      roles: ['pro'],
      locale: 'fr',
      emailVerified: true,
    });
    expect(decoded).not.toHaveProperty('email');
    expect(decoded).not.toHaveProperty('amr');
    expect(decoded).not.toHaveProperty('acr');
  });
});
