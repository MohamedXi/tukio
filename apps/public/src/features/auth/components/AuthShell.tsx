import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@tukio/ui/logo';
import { Avatar } from '@tukio/ui/avatar';
import { Typography } from '@tukio/ui/typography';

/**
 * Shared layout for every authentication screen — sign-up, login, password
 * reset, verify-email, etc. Mirrors the Cloud Design "MVP Inscription client"
 * spec: a split form/editorial layout with the editorial column carrying a
 * terracotta gradient + customer testimonial.
 *
 * - `side="right"` (default): form on the left, editorial on the right (sign-up)
 * - `side="left"`: editorial on the left, form on the right (verify-email)
 *
 * The form column scrolls independently on short viewports so users can always
 * reach the CTA. The editorial column also scrolls in case the testimonial is
 * long, but visually it remains the warm half of the page.
 */
export interface EditorialContent {
  /** Small uppercase brand-200 caption above the quote. */
  kicker: string;
  /** Display-font quote (large, italic-feeling without forcing italic). */
  quote: string;
  /** Author name (shown next to the avatar). */
  authorName: string;
  /** Author role / context line under the name. */
  authorRole: string;
}

export interface AuthShellFooterLink {
  href: string;
  label: string;
}

export interface AuthShellProps {
  /** Which side carries the editorial column. Default `"right"`. */
  side?: 'left' | 'right';
  /** Locale prefix used for the legal links in the footer (`/fr/...`). */
  locale: string;
  /** Small uppercase brand-700 caption above the H1. */
  kicker: string;
  /** Page H1 (display font). */
  title: string;
  /** Body copy paragraph under the H1. */
  subtitle: string;
  /** Form/content area — usually the page's interactive block. */
  children: ReactNode;
  /** Editorial column content (quote + author). */
  editorial: EditorialContent;
  /** Footer link block (CGU / Privacy / etc.). */
  footerLinks: AuthShellFooterLink[];
  /** Copyright/credit shown on the far right of the footer. */
  footerCopyright: string;
}

export function AuthShell({
  side = 'right',
  locale: _locale,
  kicker,
  title,
  subtitle,
  children,
  editorial,
  footerLinks,
  footerCopyright,
}: AuthShellProps) {
  void _locale; // currently unused — kept for future locale-scoped footer links
  const formColumn = (
    <section className="flex flex-1 flex-col overflow-y-auto px-6 py-6 md:px-16 md:py-10">
      <Logo size={34} />

      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-5 py-6">
        <header className="flex flex-col gap-2">
          <Typography variant="kicker">{kicker}</Typography>
          <Typography variant="h4" as="h1">
            {title}
          </Typography>
          <Typography variant="body2" color="muted">
            {subtitle}
          </Typography>
        </header>

        {children}
      </div>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {footerLinks.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-charcoal-600">
            <Typography variant="caption" color="subtle">
              {link.label}
            </Typography>
          </Link>
        ))}
        <Typography variant="caption" color="subtle" className="ml-auto">
          {footerCopyright}
        </Typography>
      </footer>
    </section>
  );

  const editorialColumn = (
    <aside
      className="relative hidden flex-1 flex-col overflow-y-auto bg-gradient-to-br from-brand-800 to-brand-600 px-12 py-12 text-cream-50 lg:flex"
      aria-hidden="true"
    >
      <div className="mt-auto flex max-w-md flex-col gap-5">
        {/* Override default kicker color (brand-700) — editorial sits on a
            terracotta background so we need the light brand-200 instead. */}
        <Typography variant="kicker" className="text-brand-200">
          {editorial.kicker}
        </Typography>
        <Typography variant="h3" color="inverse">
          {editorial.quote}
        </Typography>
        <div className="flex items-center gap-3">
          <Avatar name={editorial.authorName} size={36} tone="brand" />
          <div className="flex flex-col gap-0.5">
            <Typography variant="subtitle2" color="inverse">
              {editorial.authorName}
            </Typography>
            <Typography variant="caption" className="text-cream-50/70">
              {editorial.authorRole}
            </Typography>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <main className="flex h-screen w-full bg-cream-50 text-charcoal-700">
      {side === 'right' ? (
        <>
          {formColumn}
          {editorialColumn}
        </>
      ) : (
        <>
          {editorialColumn}
          {formColumn}
        </>
      )}
    </main>
  );
}
