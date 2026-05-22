import { getTranslations } from 'next-intl/server';
import { CreditCard, Shield, MessageSquare, Calendar, BarChart3, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';

interface SellerComingSoonBenefitsProps {
  locale: string;
}

interface BenefitCard {
  slug: 'payment' | 'trust' | 'communication' | 'calendar' | 'stats' | 'admin';
  Icon: LucideIcon;
}

const CARDS: BenefitCard[] = [
  { slug: 'payment', Icon: CreditCard },
  { slug: 'trust', Icon: Shield },
  { slug: 'communication', Icon: MessageSquare },
  { slug: 'calendar', Icon: Calendar },
  { slug: 'stats', Icon: BarChart3 },
  { slug: 'admin', Icon: FileText },
];

export async function SellerComingSoonBenefits({ locale }: SellerComingSoonBenefitsProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.benefits' });

  return (
    <section className="px-10 py-18 bg-cream-100 max-md:px-6 max-md:py-14">
      <div className="max-w-[1200px] mx-auto">
        <Kicker>{t('kicker')}</Kicker>
        <h2 className="text-[36px] font-display font-normal mt-2 mb-7 text-charcoal-800 max-md:text-[28px]">
          {t('title')}
        </h2>

        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
          {CARDS.map(({ slug, Icon }) => (
            <div key={slug} className="p-6 rounded-xl bg-cream-50 border border-cream-200">
              <span className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 inline-flex items-center justify-center mb-3.5">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="text-[17px] font-semibold text-charcoal-800">
                {t(`cards.${slug}.title`)}
              </h3>
              <p className="text-[14px] text-charcoal-600 mt-2 leading-[1.6]">
                {t(`cards.${slug}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
