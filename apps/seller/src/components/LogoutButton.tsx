'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useLogout } from '@tukio/auth-client/hooks/use-logout';
import { Button } from '@tukio/ui/button';

export function LogoutButton() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const logout = useLogout();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await logout();
      window.location.assign(`/${locale}/`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void handleLogout()}
      disabled={pending}
      aria-busy={pending}
    >
      {t('logout')}
    </Button>
  );
}
