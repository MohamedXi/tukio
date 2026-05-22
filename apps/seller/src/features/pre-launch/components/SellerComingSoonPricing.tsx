import { getTranslations } from 'next-intl/server';
import { Kicker } from '@tukio/ui/components/Kicker';

interface SellerComingSoonPricingProps {
  locale: string;
}

const CARDS = ['registration', 'commission', 'payout'] as const;

export async function SellerComingSoonPricing({ locale }: SellerComingSoonPricingProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.pricing' });

  return (
    <section className="px-10 py-18 max-w-[1200px] mx-auto max-md:px-6 max-md:py-14">
      <Kicker>{t('kicker')}</Kicker>
      <h2 className="text-[36px] font-display font-normal mt-2 mb-3.5 text-charcoal-800 max-md:text-[28px]">
        {t('title')}
      </h2>
      <p className="text-[15px] text-charcoal-600 max-w-[600px] mb-8 leading-[1.6]">{t('intro')}</p>

      <div className="grid grid-cols-3 gap-4 mb-8 max-md:grid-cols-1">
        {CARDS.map((slug) => (
          <div
            key={slug}
            className="p-6 rounded-xl bg-cream-50 border border-cream-200 text-center"
          >
            <div className="font-display font-normal text-[48px] text-brand-600 tracking-tight leading-none mb-4">
              {t(`cards.${slug}.value`)}
            </div>
            <h3 className="text-[15px] font-semibold text-charcoal-800">
              {t(`cards.${slug}.title`)}
            </h3>
            <p className="text-[13px] text-charcoal-600 mt-1.5 leading-[1.55]">
              {t(`cards.${slug}.description`)}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[13px] text-charcoal-500 leading-[1.6] p-4 bg-cream-100 rounded-lg">
        {t('disclaimer')}
      </p>
    </section>
  );
}
