'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { isLocale } from '@tukio/i18n-client/config';
import type { Role } from '@tukio/auth-client';

const SELLER_BASE_FALLBACK = 'http://localhost:3002';

function resolveSellerBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_SELLER_BASE_URL'];
  if (raw && raw.length > 0) return raw;
  return SELLER_BASE_FALLBACK;
}

interface UserAvatarDropdownProps {
  firstName?: string;
  lastName?: string;
  email?: string;
  role: Role | null;
}

export function UserAvatarDropdown({ firstName, lastName, email, role }: UserAvatarDropdownProps) {
  const t = useTranslations('Home');
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : 'fr';
  const [open, setOpen] = useState(false);

  const initials =
    firstName && lastName
      ? `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
      : (email?.[0]?.toUpperCase() ?? '?');

  const isCustomer = role === 'client';
  const isPro = role === 'pro';

  function handleBecomePro() {
    const target = `${resolveSellerBaseUrl()}/${locale}/seller/onboarding/identity`;
    if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  }

  function handleProSpace() {
    const target = `${resolveSellerBaseUrl()}/${locale}/seller/dashboard`;
    if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  }

  return (
    <div className="relative" data-testid="user-avatar-dropdown">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-cream-50 hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        data-testid="avatar-trigger"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu utilisateur"
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-cream-200 bg-white py-1 shadow-lg focus:outline-none"
          data-testid="avatar-menu"
        >
          {email && (
            <div className="border-b border-cream-100 px-4 py-2">
              <p className="truncate text-xs text-charcoal-500">{email}</p>
            </div>
          )}

          {isCustomer && (
            <button
              type="button"
              role="menuitem"
              onClick={handleBecomePro}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-charcoal-700 hover:bg-brand-50 hover:text-brand-700"
              data-testid="become-pro-cta"
            >
              <span>🚀</span>
              <span>{t('becomePro')}</span>
            </button>
          )}

          {isPro && (
            <button
              type="button"
              role="menuitem"
              onClick={handleProSpace}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-charcoal-700 hover:bg-brand-50 hover:text-brand-700"
              data-testid="pro-space-link"
            >
              <span>💼</span>
              <span>{t('proSpace')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
