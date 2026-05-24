import { cn } from '../../utils/cn';
import { Kicker } from '../../components/Kicker/Kicker';
import type { BlockProps, EditorialPageShellProps } from './EditorialPageShell.types';
import { Spacer } from '../../../../ui/src/components/Spacer/Spacer';
import { Fragment } from 'react';

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
          <Fragment>
            <Spacer size={4} />
            <p className="mt-[18px] text-[17px] leading-[1.6] text-charcoal-600 max-w-[640px]">
              {intro}
            </p>
          </Fragment>
        )}
        <div className="mt-5">{children}</div>
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
    <section className={cn(className)}>
      <h2 className="text-2xl font-display font-medium text-charcoal-800 mb-3.5">{title}</h2>
      <div className="mt-2 text-[15px] text-charcoal-700 leading-[1.7]">{children}</div>
    </section>
  );
}

Block.displayName = 'Block';
