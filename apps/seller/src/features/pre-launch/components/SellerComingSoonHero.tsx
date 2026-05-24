import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Zap } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';
import { CrossZoneCta } from './CrossZoneCta';
import { Spacer } from '@tukio/ui/components/Spacer';

interface SellerComingSoonHeroProps {
  locale: string;
}

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 bg-cream-100 border-b border-cream-200">
      <span className="w-2.5 h-2.5 rounded-full bg-cream-300" />
      <span className="w-2.5 h-2.5 rounded-full bg-cream-300" />
      <span className="w-2.5 h-2.5 rounded-full bg-cream-300" />
    </div>
  );
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
          <Spacer size={10} />
          <p className="text-[17px] text-charcoal-600 mt-4 leading-[1.6] max-w-[520px]">
            {t('pitch')}
          </p>
          <Spacer size={5} />
          <div className="p-4 bg-brand-50 border border-brand-100 rounded-xl flex gap-3 items-start">
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

        {/* Right col — product preview (mockups of the future pro space) */}
        <div className="relative max-lg:max-w-[560px] max-lg:mx-auto max-lg:w-full lg:pb-14 lg:pr-6">
          <span className="absolute -top-3 left-4 z-20 rounded-full bg-charcoal-800 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-cream-50">
            {t('previewBadge')}
          </span>

          {/* Calendar — primary frame */}
          <figure className="relative overflow-hidden rounded-xl border border-cream-200 bg-white shadow-[0_24px_60px_-20px_rgba(75,69,57,0.35)]">
            <WindowDots />
            <Image
              src="/preview/seller-calendar.webp"
              alt={t('previewCalendarAlt')}
              width={1600}
              height={1096}
              priority
              sizes="(max-width: 1024px) 90vw, 45vw"
              className="block h-auto w-full"
            />
          </figure>

          {/* Service pricing — floating peek (overlaps on desktop, stacks on mobile) */}
          <figure className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-[0_28px_70px_-18px_rgba(75,69,57,0.45)] lg:absolute lg:-bottom-6 lg:-right-2 lg:w-[54%] max-lg:mx-auto max-lg:mt-5 max-lg:w-[80%]">
            <WindowDots />
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src="/preview/seller-service-pricing.webp"
                alt={t('previewPricingAlt')}
                fill
                sizes="(max-width: 1024px) 70vw, 25vw"
                className="object-cover object-top"
              />
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
