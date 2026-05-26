import { getTranslations } from 'next-intl/server';
import { Kicker } from '@tukio/ui/components/Kicker';
import { CrossZoneCta } from './CrossZoneCta';

interface SellerComingSoonFinalCtaProps {
  locale: string;
}

export async function SellerComingSoonFinalCta({ locale }: SellerComingSoonFinalCtaProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.finalCta' });
  const apexBaseUrl = process.env['NEXT_PUBLIC_PUBLIC_BASE_URL'] ?? 'https://tukio.one';

  return (
    <section className="px-10 py-18 text-center max-md:px-6 max-md:py-14">
      <div className="max-w-[640px] mx-auto">
        <Kicker>{t('kicker')}</Kicker>
        <h2 className="text-[36px] font-display font-normal mt-2 mb-3.5 text-charcoal-800 max-md:text-[28px]">
          {t('title')}
        </h2>
        <p className="text-[15px] text-charcoal-600 leading-[1.6] mb-7">{t('body')}</p>

        <div className="inline-flex gap-3 flex-wrap justify-center max-sm:flex-col max-sm:items-stretch">
          <CrossZoneCta locale={locale} variant="primary" size="lg">
            {t('ctaPrimary')}
          </CrossZoneCta>
          <a
            href={`${apexBaseUrl}/${locale}/contact`}
            className="inline-flex items-center justify-center h-12 px-6 rounded-md font-semibold text-sm bg-transparent text-brand-700 hover:bg-brand-50 border border-brand-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            {t('ctaContact')}
          </a>
        </div>
      </div>
    </section>
  );
}
