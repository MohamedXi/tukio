import type { BackendActor } from '@tukio/auth/types';
import { WhoamiUseCase } from './whoami.usecase.js';

const baseActor: BackendActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  role: 'client',
  roles: ['client'],
  locale: 'fr',
  email: 'alice@example.com',
  emailVerified: true,
  amr: ['pwd'],
};

describe('WhoamiUseCase (Story 1.4b AC5)', () => {
  let useCase: WhoamiUseCase;

  beforeEach(() => {
    useCase = new WhoamiUseCase();
  });

  it('projects a Customer actor to a valid WhoamiResponseDto', () => {
    const dto = useCase.execute({ actor: baseActor });
    expect(dto.userId).toBe(baseActor.userId);
    expect(dto.email).toBe('alice@example.com');
    expect(dto.role).toEqual(['client']);
    expect(dto.status).toBe('active');
    expect(dto.locale).toBe('fr');
    expect(dto.emailVerified).toBe(true);
    expect(dto.mfaEnabled).toBe(false);
  });

  it('projects a Pro actor with role=pro', () => {
    const dto = useCase.execute({
      actor: { ...baseActor, role: 'pro', roles: ['client', 'pro'] },
    });
    expect(dto.role).toEqual(['client', 'pro']);
  });

  it('projects an Admin actor with TOTP mfaEnabled true', () => {
    const dto = useCase.execute({
      actor: {
        ...baseActor,
        role: 'admin-super',
        roles: ['admin-super'],
        amr: ['pwd', 'totp'],
      },
    });
    expect(dto.role).toEqual(['admin-super']);
    expect(dto.mfaEnabled).toBe(true);
  });

  it('falls back to actor.role when actor.roles is empty', () => {
    const dto = useCase.execute({
      actor: { ...baseActor, roles: [] },
    });
    expect(dto.role).toEqual(['client']);
  });

  it('keeps multiple roles untouched', () => {
    const dto = useCase.execute({
      actor: {
        ...baseActor,
        role: 'admin-modo',
        roles: ['admin-modo', 'admin-support'],
      },
    });
    expect(dto.role).toEqual(['admin-modo', 'admin-support']);
  });

  it('falls back to pending_email_verification when actor email not verified', () => {
    const dto = useCase.execute({
      actor: { ...baseActor, emailVerified: false },
    });
    expect(dto.status).toBe('pending_email_verification');
  });
});
