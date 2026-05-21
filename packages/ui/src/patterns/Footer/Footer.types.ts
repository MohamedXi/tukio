import type { ReactNode } from 'react';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterPropsBase {
  brandTagline?: string;
  legal?: string;
  legalRight?: string;
  className?: string;
}

export interface FooterFullProps extends FooterPropsBase {
  /** Default variant: 4-column grid + 2-line legal row. Backward-compat with Story 0.5 usages. */
  variant?: 'full';
  columns: FooterColumn[];
}

export interface FooterMinimalProps extends Omit<FooterPropsBase, 'brandTagline' | 'legalRight'> {
  /** Minimal variant: inline logo + copyright + 3 horizontal links. Story 0.16. */
  variant: 'minimal';
  /** Inline horizontal links (typically 2-4). */
  inlineLinks?: FooterLink[];
  /** Optional logo override. If omitted, no logo is rendered (legal text acts as wordmark). */
  logo?: ReactNode;
}

export type FooterProps = FooterFullProps | FooterMinimalProps;
