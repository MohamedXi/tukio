import type { ReactNode } from 'react';
import { cn } from '@tukio/ui/utils/cn';

interface CrossZoneCtaProps {
  locale: string;
  variant?: 'primary' | 'tertiary' | 'link';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}

// Server Component — zero JS. Cross-zone link to apex `tukio.one/${locale}/coming-soon?role=pro`
// which pre-fills the "Professionnel" radio (Story 0.17 AC4).
//
// Plausible custom event "Devenir Pro CTA Click" is captured via the tagged-events
// CSS class pattern (Story 0.21) — no Client Component migration needed.

// Plausible tagged-events convention: `plausible-event-name=My+Event` reads
// "My Event" at click time. Plus signs replace spaces in CSS class names.
const PLAUSIBLE_CLICK_CLASS = 'plausible-event-name=Devenir+Pro+CTA+Click';
export function CrossZoneCta({
  locale,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: CrossZoneCtaProps) {
  const apexBaseUrl = process.env['NEXT_PUBLIC_PUBLIC_BASE_URL'] ?? 'https://tukio.one';
  const href = `${apexBaseUrl}/${locale}/coming-soon?role=pro`;
  const plausibleLocaleClass = `plausible-event-locale=${locale}`;

  if (variant === 'link') {
    return (
      <a
        href={href}
        rel="noopener noreferrer"
        className={cn(
          'font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 transition-colors',
          PLAUSIBLE_CLICK_CLASS,
          plausibleLocaleClass,
          className,
        )}
      >
        {children}
      </a>
    );
  }

  const sizeMap = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  } as const;
  const variantMap = {
    primary:
      'bg-brand-600 text-cream-50 hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40',
    tertiary: 'bg-transparent text-brand-700 hover:bg-brand-50 border border-brand-200',
  } as const;

  return (
    <a
      href={href}
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none',
        sizeMap[size],
        variantMap[variant],
        PLAUSIBLE_CLICK_CLASS,
        plausibleLocaleClass,
        className,
      )}
    >
      {children}
    </a>
  );
}
