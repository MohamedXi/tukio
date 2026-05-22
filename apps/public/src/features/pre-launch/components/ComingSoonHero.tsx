import { getTranslations } from 'next-intl/server';
import { Pill } from '@tukio/ui/components/Pill';

interface ComingSoonHeroProps {
  locale: string;
}

export async function ComingSoonHero({ locale }: ComingSoonHeroProps) {
  const t = await getTranslations({ locale, namespace: 'coming_soon' });

  return (
    <section className="flex flex-col justify-center pt-16 pb-20 px-20 max-md:px-6 max-md:pt-10 max-md:pb-12">
      <Pill pulseDot variant="brand" className="w-fit">
        {t('hero.pillLabel')}
      </Pill>

      <h1 className="font-display font-normal text-[64px] leading-[1.02] tracking-tight text-charcoal-800 max-w-[560px] mt-6 max-md:text-[44px]">
        {t('hero.titleLine1')}
        <br />
        <em className="italic text-brand-600">{t('hero.titleLine2Emphasis')}</em>
      </h1>

      <p className="text-[18px] text-charcoal-600 mt-6 max-w-[480px] leading-[1.6] max-md:text-[16px]">
        {t('hero.pitch')}
      </p>

      <p className="text-[14px] text-charcoal-500 mt-4 max-w-[460px] leading-[1.55]">
        {t('hero.subPitch')}
      </p>

      <div className="mt-10 pt-6 border-t border-cream-200 flex gap-8 max-md:gap-6">
        <div className="inline-flex flex-col gap-1">
          <span className="font-display text-[22px] font-medium text-charcoal-800">
            {t('hero.stat1Value')}
          </span>
          <span className="font-mono uppercase tracking-wider text-[11px] text-charcoal-500">
            {t('hero.stat1Label')}
          </span>
        </div>
        <div className="inline-flex flex-col gap-1">
          <span className="font-display text-[22px] font-medium text-charcoal-800">
            {t('hero.stat2Value')}
          </span>
          <span className="font-mono uppercase tracking-wider text-[11px] text-charcoal-500">
            {t('hero.stat2Label')}
          </span>
        </div>
        <div className="inline-flex flex-col gap-1">
          <span className="font-display text-[22px] font-medium text-charcoal-800">
            {t('hero.stat3Value')}
          </span>
          <span className="font-mono uppercase tracking-wider text-[11px] text-charcoal-500">
            {t('hero.stat3Label')}
          </span>
        </div>
      </div>
    </section>
  );
}
