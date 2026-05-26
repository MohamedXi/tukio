import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';

interface ComingSoonSuccessHeroProps {
  locale: string;
  firstName: string;
  position: number;
}

export async function ComingSoonSuccessHero({
  locale,
  firstName,
  position,
}: ComingSoonSuccessHeroProps) {
  const t = await getTranslations({ locale, namespace: 'coming_soon.success' });

  return (
    <main id="main-content" className="flex-1 flex items-center justify-center p-10 max-md:p-6">
      <div className="max-w-[560px] text-center w-full">
        <div className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-success-50 border-2 border-success-500">
          <Check size={36} color="var(--color-success-700)" strokeWidth={2.5} />
        </div>

        <div className="mt-6">
          <Kicker color="success">{t('kicker')}</Kicker>
        </div>

        <h1 className="font-display font-normal text-[44px] tracking-tight text-charcoal-800 mt-3 leading-[1.05] max-md:text-[36px]">
          {t('titleLine1')}{' '}
          <em className="italic text-brand-600">
            {firstName}
            {t('titleEmphasisSuffix')}
          </em>
        </h1>

        <p className="text-[16px] text-charcoal-600 mt-4 leading-[1.6]">
          {t.rich('positionMessage', {
            position,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>

        <div className="mt-8 p-5 bg-cream-100 rounded-md text-left">
          <p className="text-[13px] font-semibold text-charcoal-800 mb-2">{t('meanwhileTitle')}</p>
          <p className="text-[13px] text-charcoal-600 leading-[1.6]">
            {t('meanwhileLead')}{' '}
            <a
              href={`mailto:contact@tukio.one?subject=${encodeURIComponent(t('meanwhileMailSubject'))}`}
              className="text-brand-700 font-semibold hover:text-brand-800 transition-colors"
            >
              {t('meanwhileCta')}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
