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
  /**
   * Optional badge rendered immediately after the logo, inside the same left
   * group as navItems (gap-8). Used by public pages for the "En construction"
   * chip that anchors the brand block in the pre-launch design grammar.
   */
  badge?: ReactNode;
  /** Navigation links rendered in the left group, after logo + badge. */
  navItems?: SiteHeaderNavItem[];
  /** Optional locale switcher (rendered before rightSlot). */
  localeSwitcher?: ReactNode;
  /** Free-form right-aligned slot — typically a CTA link. */
  rightSlot?: ReactNode;
  className?: string;
}
