import { getTranslations } from 'next-intl/server';
import { Logo } from '@tukio/ui/patterns/Logo';

interface ComingSoonHeaderProps {
  locale: string;
}

// Minimal Coming Soon header (Story 0.17 design). Distinct from `<SiteHeader>`
// which carries a `border-b` and is used by the institutional/editorial pages.
// Here the body is `bg-cream-50` flat, so no chrome between header and hero.
export async function ComingSoonHeader({ locale }: ComingSoonHeaderProps) {
  const t = await getTranslations({ locale, namespace: 'coming_soon.header' });

  return (
    <header
      role="banner"
      className="flex items-center justify-between px-10 py-6 bg-cream-50 max-md:px-4 max-md:py-5"
    >
      <Logo size={22} />
      <span className="text-xs font-mono uppercase tracking-wider text-charcoal-500">
        {t('badge')}
      </span>
    </header>
  );
}
