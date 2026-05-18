import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LoginCta } from './LoginCta.js';

const GATEWAY_URL = 'http://localhost:4000';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_GATEWAY_URL', GATEWAY_URL);
  vi.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    assign: vi.fn(),
    search: '',
  } as unknown as Location);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('LoginCta', () => {
  it('renders the sign-in button with provided label', () => {
    render(<LoginCta locale="fr" ctaLabel="Se connecter" loadingLabel="Connexion…" />);
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('navigates to gateway-api /v1/auth/login without next when search is empty', () => {
    render(<LoginCta locale="fr" ctaLabel="Se connecter" loadingLabel="Connexion…" />);
    fireEvent.click(screen.getByRole('button'));
    const assign = window.location.assign as ReturnType<typeof vi.fn>;
    expect(assign).toHaveBeenCalledOnce();
    const called = new URL(assign.mock.calls[0][0] as string);
    expect(called.pathname).toBe('/v1/auth/login');
    expect(called.searchParams.get('clientId')).toBe('tukio-web');
    expect(called.searchParams.get('locale')).toBe('fr');
    expect(called.searchParams.has('next')).toBe(false);
  });

  it('forwards ?next param when present in window.location.search', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign: vi.fn(),
      search: '?next=https%3A%2F%2Ftukio.one%2Ffr%2Faccount',
    } as unknown as Location);
    render(<LoginCta locale="en" ctaLabel="Sign in" loadingLabel="Signing in…" />);
    fireEvent.click(screen.getByRole('button'));
    const assign = window.location.assign as ReturnType<typeof vi.fn>;
    const called = new URL(assign.mock.calls[0][0] as string);
    expect(called.searchParams.get('next')).toBe('https://tukio.one/fr/account');
    expect(called.searchParams.get('locale')).toBe('en');
  });

  it('sets aria-busy=true and disables button when clicked', async () => {
    render(<LoginCta locale="fr" ctaLabel="Se connecter" loadingLabel="Connexion…" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-busy', 'true');
      expect(btn).toBeDisabled();
    });
  });

  it('shows loading label while aria-busy', async () => {
    render(<LoginCta locale="fr" ctaLabel="Se connecter" loadingLabel="Connexion…" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Connexion…');
    });
  });
});
