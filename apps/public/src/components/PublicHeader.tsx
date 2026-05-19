'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Logo } from '@tukio/ui/logo';
import { Button } from '@tukio/ui/button';

interface PublicHeaderProps {
  transparent?: boolean;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split(';').find((c) => c.trim().startsWith(`${name}=`));
  return match?.trim().slice(name.length + 1);
}

export function PublicHeader({ transparent = false }: PublicHeaderProps) {
  const locale = useLocale();
  const t = useTranslations('header');
  // Lazy initializer runs only on the client (component is 'use client').
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => readCookie('tukio-session-active') === '1',
  );
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogin() {
    const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:4000';
    const url = new URL(`${gatewayUrl}/v1/auth/login`);
    url.searchParams.set('clientId', 'tukio-web');
    url.searchParams.set('locale', locale);
    window.location.assign(url.toString());
  }

  async function handleLogout() {
    setLoggingOut(true);
    const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:4000';
    const csrfToken = readCookie('tukio-csrf-token') ?? '';
    try {
      await fetch(`${gatewayUrl}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
    } finally {
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

        {isAuthenticated ? (
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
