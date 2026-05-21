import type { ReactNode } from 'react';

export interface SiteHeaderNavItem {
  /** User-visible label — fed by next-intl t() in consumer apps. */
  label: string;
  /** Internal Next.js href or external URL. */
  href: string;
  /** Highlights the link with brand color + bold + aria-current="page". Default false. */
  active?: boolean;
}

export interface SiteHeaderProps {
  /** Branding slot. If omitted, renders `<Logo size={22}>` by default. */
  logo?: ReactNode;
  /** Right-aligned navigation links. Empty array for landing pages. */
  navItems?: SiteHeaderNavItem[];
  /** Optional locale switcher (rendered before rightSlot). */
  localeSwitcher?: ReactNode;
  /** Free-form right slot — used by Story 0.17 for a "Bientôt en Pays de la Loire" badge. */
  rightSlot?: ReactNode;
  className?: string;
}
