import { cn } from '../../utils/cn';
import { Kicker } from '../../components/Kicker/Kicker';
import type { BlockProps, EditorialPageShellProps } from './EditorialPageShell.types';

/**
 * Two-column editorial shell for institutional pages (About, Privacy, Legal,
 * Contact — Story 0.19). Consumer feeds header + footer slots (typically a
 * `<SiteHeader>` + `<Footer variant="minimal">`) and an arbitrary tree of
 * `<Block>` children for the body.
 *
 * Design replicates `tukio-design/screens/public-pages.jsx` PageShell function.
 */
export function EditorialPageShell({
  kicker,
  title,
  intro,
  maxWidth = 880,
  header,
  footer,
  children,
  className,
}: EditorialPageShellProps) {
  return (
    <div className={cn('min-h-screen flex flex-col bg-cream-50', className)}>
      {header}
      <main
        className="flex-1 mx-auto px-10 py-[72px] pb-24 w-full max-md:px-4 max-md:py-12"
        style={{ maxWidth }}
      >
        {kicker && <Kicker className="mb-3">{kicker}</Kicker>}
        <h1 className="font-display font-normal tracking-[-0.025em] leading-[1.05] text-charcoal-800 mt-3.5 text-[52px] max-md:text-[40px]">
          {title}
        </h1>
        {intro && (
          <p className="mt-[18px] text-[17px] leading-[1.6] text-charcoal-600 max-w-[640px]">
            {intro}
          </p>
        )}
        <div className="mt-12">{children}</div>
      </main>
      {footer}
    </div>
  );
}

EditorialPageShell.displayName = 'EditorialPageShell';

/**
 * Content section inside an `EditorialPageShell`. Renders an `<h2>` title with
 * Fraunces display font + body children. Multiple `<Block>` per page (h2
 * heading hierarchy preserved).
 */
export function Block({ title, children, className }: BlockProps) {
  return (
    <section className={cn('mb-10', className)}>
      <h2 className="text-2xl font-display font-medium text-charcoal-800 mb-3.5">{title}</h2>
      <div
        className={cn(
          'text-[15px] text-charcoal-700 leading-[1.7]',
          // Auto-style inline anchors in editorial body content — brand orange,
          // underline, medium weight. Matches design ref (public-pages.jsx) and
          // user preference. Works on any descendant <a> regardless of parent tag.
          '[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2',
          '[&_a]:transition-colors [&_a:hover]:text-brand-800',
        )}
      >
        {children}
      </div>
    </section>
  );
}

Block.displayName = 'Block';
