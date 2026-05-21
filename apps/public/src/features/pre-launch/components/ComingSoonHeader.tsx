import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';

interface ComingSoonHeaderProps {
  locale: string;
}

export async function ComingSoonHeader({ locale }: ComingSoonHeaderProps) {
  const t = await getTranslations({ locale, namespace: 'coming_soon.header' });

  return (
    <SiteHeader
      rightSlot={
        <span className="text-xs font-mono uppercase tracking-wider text-charcoal-500">
          {t('badge')}
        </span>
      }
    />
  );
}
