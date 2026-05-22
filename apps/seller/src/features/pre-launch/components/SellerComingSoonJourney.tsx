import { getTranslations } from 'next-intl/server';
import { Kicker } from '@tukio/ui/components/Kicker';

interface SellerComingSoonJourneyProps {
  locale: string;
}

const STEPS = ['signup', 'proRequest', 'validation', 'stripe', 'publish'] as const;

export async function SellerComingSoonJourney({ locale }: SellerComingSoonJourneyProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.journey' });

  return (
    <section className="px-10 py-14 bg-cream-100 max-md:px-6 max-md:py-10">
      <div className="max-w-[1200px] mx-auto">
        <Kicker>{t('kicker')}</Kicker>
        <h2 className="text-[36px] font-display font-normal mt-2 mb-7 text-charcoal-800 max-md:text-[28px]">
          {t('title')}
        </h2>

        <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
          {STEPS.map((slug) => (
            <div key={slug} className="p-[18px] rounded-xl bg-cream-50 border border-cream-200">
              <div className="font-display font-normal italic text-[30px] text-brand-500 tracking-tight leading-none">
                {t(`steps.${slug}.n`)}
              </div>
              <h3 className="text-[14px] font-semibold mt-4 text-charcoal-800">
                {t(`steps.${slug}.title`)}
              </h3>
              <p className="text-[12px] text-charcoal-600 mt-2 leading-[1.6]">
                {t(`steps.${slug}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
