import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { AuthContext } from '@tukio/auth-client/provider';
import type { AuthState } from '@tukio/auth-client/types';
import { PublicHeader } from '../PublicHeader';

const messages = {
  header: {
    categories: 'Catégories',
    becomePro: 'Devenir pro',
    login: 'Connexion',
    logout: 'Déconnexion',
    signup: 'Inscription',
  },
};

function baseState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    user: null,
    role: null,
    status: null,
    locale: 'fr',
    isAuthenticated: false,
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function renderHeader(state: AuthState) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="fr" messages={messages}>
        <AuthContext.Provider value={{ state, gatewayBaseUrl: 'https://api.tukio.test' }}>
          {children}
        </AuthContext.Provider>
      </NextIntlClientProvider>
    );
  }
  return render(<PublicHeader />, { wrapper: Wrapper });
}

describe('PublicHeader auth state (Story 1.4d AC13)', () => {
  it('authenticated → renders the Déconnexion button, not Connexion/Inscription', () => {
    renderHeader(baseState({ isAuthenticated: true, role: 'client', status: 'active' }));
    expect(screen.getByRole('button', { name: 'Déconnexion' })).toBeInTheDocument();
    expect(screen.queryByText('Connexion')).not.toBeInTheDocument();
    expect(screen.queryByText('Inscription')).not.toBeInTheDocument();
  });

  it('not authenticated → renders Connexion + Inscription, not Déconnexion', () => {
    renderHeader(baseState({ isAuthenticated: false }));
    expect(screen.getByText('Connexion')).toBeInTheDocument();
    expect(screen.getByText('Inscription')).toBeInTheDocument();
    expect(screen.queryByText('Déconnexion')).not.toBeInTheDocument();
  });

  it('loading → renders a neutral placeholder (no logged-out flash)', () => {
    renderHeader(baseState({ isLoading: true }));
    expect(screen.getByTestId('auth-cta-loading')).toBeInTheDocument();
    expect(screen.queryByText('Connexion')).not.toBeInTheDocument();
    expect(screen.queryByText('Déconnexion')).not.toBeInTheDocument();
  });

  it('always renders the static nav (Catégories, Devenir pro)', () => {
    renderHeader(baseState({ isAuthenticated: true }));
    expect(screen.getByText('Catégories')).toBeInTheDocument();
    expect(screen.getByText('Devenir pro')).toBeInTheDocument();
  });
});
