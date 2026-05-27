'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@tukio/auth-client/hooks/use-auth';
import { useAuthContext } from '@tukio/auth-client/provider';
import { useLogout } from '@tukio/auth-client/hooks/use-logout';
import { Logo } from '@tukio/ui/logo';
import { Button } from '@tukio/ui/button';

interface PublicHeaderProps {
  transparent?: boolean;
}

export function PublicHeader({ transparent = false }: PublicHeaderProps) {
  const locale = useLocale();
  const t = useTranslations('header');
  // Story 1.4d AC13 — auth state comes from the AuthProvider context (whoami)
  // instead of an ad-hoc cookie read in useState, which evaluated to "" during
  // SSR and froze the header in the logged-out state after login.
  const { isAuthenticated, isLoading } = useAuth();
  const { gatewayBaseUrl } = useAuthContext();
  const logout = useLogout();
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogin() {
    // Use gatewayBaseUrl from AuthProvider context (already resolved at SSR time
    // from NEXT_PUBLIC_GATEWAY_URL) instead of bracket-notation process.env access
    // which Next.js does not statically inline at build time.
    const url = new URL(`${gatewayBaseUrl}/v1/auth/login`);
    url.searchParams.set('client_id', 'tukio-web');
    url.searchParams.set('locale', locale);
    window.location.assign(url.toString());
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // Full reload to the locale home so every client cache resets.
      window.location.assign(`/${locale}`);
    }
  }

  return (
    <header
      className={[
        'flex items-center gap-6 px-10 py-4',
        transparent
          ? 'bg-transparent border-b border-transparent'
          : 'sticky top-0 z-30 bg-cream-50 border-b border-cream-200',
      ].join(' ')}
    >
      <Link href={`/${locale}`} aria-label="Tukio — accueil">
        <Logo size={30} />
      </Link>

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
        <a
          href={`/${locale}/categories`}
          className="text-sm font-medium text-charcoal-600 hover:text-charcoal-900 px-3 py-2 rounded-md hover:bg-cream-100 transition-colors"
        >
          {t('categories')}
        </a>
        <a
          href={`/${locale}/seller/onboarding`}
          className="text-sm font-medium text-charcoal-600 hover:text-charcoal-900 px-3 py-2 rounded-md hover:bg-cream-100 transition-colors"
        >
          {t('becomePro')}
        </a>

        {isLoading ? (
          // Neutral placeholder while whoami resolves — avoids a logged-out
          // flash that then snaps to "Déconnexion" (AC13).
          <div
            className="h-9 w-24 rounded-md bg-cream-100 animate-pulse"
            aria-hidden="true"
            data-testid="auth-cta-loading"
          />
        ) : isAuthenticated ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            aria-busy={loggingOut}
          >
            {t('logout')}
          </Button>
        ) : (
          <>
            <button
              onClick={handleLogin}
              className="text-sm font-medium text-charcoal-600 hover:text-charcoal-900 px-3 py-2 rounded-md hover:bg-cream-100 transition-colors cursor-pointer"
            >
              {t('login')}
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                window.location.href = `/${locale}/auth/sign-up`;
              }}
            >
              {t('signup')}
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}
