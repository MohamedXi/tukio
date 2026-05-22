import { getTranslations } from 'next-intl/server';
import { Tent, Package, Flame, Sparkles, Zap, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';

interface SellerComingSoonProfessionsProps {
  locale: string;
}

interface ProfessionCard {
  slug: 'tents' | 'furniture' | 'catering' | 'decoration' | 'soundLight' | 'animation';
  Icon: LucideIcon;
}

const CARDS: ProfessionCard[] = [
  { slug: 'tents', Icon: Tent },
  { slug: 'furniture', Icon: Package },
  { slug: 'catering', Icon: Flame },
  { slug: 'decoration', Icon: Sparkles },
  { slug: 'soundLight', Icon: Zap },
  { slug: 'animation', Icon: User },
];

export async function SellerComingSoonProfessions({ locale }: SellerComingSoonProfessionsProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.professions' });

  return (
    <section className="px-10 py-14 max-w-[1200px] mx-auto max-md:px-6 max-md:py-10">
      <Kicker>{t('kicker')}</Kicker>
      <h2 className="text-[36px] font-display font-normal mt-2 mb-3 text-charcoal-800 max-md:text-[28px]">
        {t('title')}
      </h2>
      <p className="text-[15px] text-charcoal-600 mb-7 max-w-[640px] leading-[1.6]">{t('intro')}</p>

      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2 max-sm:grid-cols-1">
        {CARDS.map(({ slug, Icon }) => (
          <div key={slug} className="p-[18px] rounded-xl bg-cream-50 border border-cream-200">
            <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 inline-flex items-center justify-center mb-3">
              <Icon size={18} aria-hidden="true" />
            </span>
            <h3 className="text-[15px] font-semibold text-charcoal-800">
              {t(`cards.${slug}.title`)}
            </h3>
            <p className="text-[13px] text-charcoal-600 mt-1 leading-[1.55]">
              {t(`cards.${slug}.description`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
