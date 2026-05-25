import { getTranslations } from 'next-intl/server';
import { LinkedLogo } from '../../../components/LinkedLogo.js';
import { LocaleSwitcherClient } from '../../../components/LocaleSwitcherClient.js';

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
      <LinkedLogo locale={locale} />
      <div className="flex items-center gap-4">
        {/* Hidden below md: the badge text ("Bientôt · Pilote Pays de la Loire")
            collides with the logo on narrow phones. The hero's "En construction"
            pill already carries the coming-soon signal there. */}
        <span className="hidden md:inline text-xs font-mono uppercase tracking-wider text-charcoal-500">
          {t('badge')}
        </span>
        <LocaleSwitcherClient />
      </div>
    </header>
  );
}
