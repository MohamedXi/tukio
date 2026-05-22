import { getTranslations } from 'next-intl/server';
import { Zap } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';
import { CrossZoneCta } from './CrossZoneCta';

interface SellerComingSoonHeroProps {
  locale: string;
}

export async function SellerComingSoonHero({ locale }: SellerComingSoonHeroProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.hero' });

  return (
    <section className="px-10 py-[72px] pb-14 max-md:px-6 max-md:py-12">
      <div className="max-w-[1200px] mx-auto grid grid-cols-[1.1fr_1fr] gap-14 items-center max-lg:grid-cols-1 max-lg:gap-10">
        {/* Left col */}
        <div>
          <Kicker>{t('kicker')}</Kicker>

          <h1 className="font-display font-normal text-[60px] tracking-tight leading-[1.02] text-charcoal-800 mt-3.5 max-w-[520px] max-md:text-[44px]">
            {t('titleLine1')} <em className="italic text-brand-600">{t('titleLine2Emphasis')}</em>.
          </h1>

          <p className="text-[17px] text-charcoal-600 mt-4 leading-[1.6] max-w-[520px]">
            {t('pitch')}
          </p>

          <div className="mt-7 p-4 bg-brand-50 border border-brand-100 rounded-xl flex gap-3 items-start">
            <Zap
              size={18}
              color="var(--color-brand-700)"
              aria-hidden="true"
              className="flex-shrink-0 mt-0.5"
            />
            <div>
              <div className="text-[14px] font-semibold text-brand-700">{t('bannerTitle')}</div>
              <p className="text-[13px] text-charcoal-700 mt-1 leading-[1.5]">
                {t('bannerBody')}{' '}
                <CrossZoneCta locale={locale} variant="link">
                  {t('bannerCta')}
                </CrossZoneCta>
              </p>
            </div>
          </div>
        </div>

        {/* Right col — placeholder gradient visual */}
        <div
          role="img"
          aria-label={t('visualAlt')}
          className="aspect-square rounded-2xl border border-cream-50/40 max-lg:max-w-[480px] max-lg:mx-auto max-lg:w-full"
          style={{
            background: 'linear-gradient(160deg, var(--color-brand-100), var(--color-brand-300))',
          }}
        />
      </div>
    </section>
  );
}
