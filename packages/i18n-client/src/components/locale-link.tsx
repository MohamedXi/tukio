'use client';
import Link, { type LinkProps } from 'next/link';
import type { ReactNode } from 'react';
import { useCurrentLocale } from '../hooks/use-current-locale';

export interface LocaleLinkProps extends Omit<LinkProps, 'href'> {
  href: string;
  children: ReactNode;
  className?: string;
}

// next/link wrapper that automatically prefixes internal hrefs with the
// current locale (`/account` → `/fr/account`). Absolute URLs and external
// links are passed through unchanged.
export function LocaleLink({ href, children, ...props }: LocaleLinkProps) {
  const locale = useCurrentLocale();
  const isInternal = href.startsWith('/') && !href.startsWith('//');
  const localizedHref = isInternal ? `/${locale}${href === '/' ? '' : href}` : href;
  return (
    <Link href={localizedHref} {...props}>
      {children}
    </Link>
  );
}
