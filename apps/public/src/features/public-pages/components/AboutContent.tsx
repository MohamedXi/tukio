import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { Block } from '@tukio/ui/patterns/EditorialPageShell';

interface AboutContentProps {
  locale: string;
}

export async function AboutContent({ locale }: AboutContentProps) {
  const t = await getTranslations({ locale, namespace: 'about.blocks' });

  return (
    <>
      <Block title={t('why.title')}>
        <p className="mb-3">{t('why.p1')}</p>
        <p>{t('why.p2')}</p>
      </Block>

      <Block title={t('whatPlatform.title')}>
        <div className="grid grid-cols-2 gap-4 mt-2 max-sm:grid-cols-1">
          {(['0', '1', '2', '3'] as const).map((i) => (
            <div key={i} className="p-5 rounded-xl bg-cream-50 border border-cream-200">
              <h3 className="text-[16px] font-semibold text-charcoal-800 mb-2">
                {t(`whatPlatform.cards.${i}.title`)}
              </h3>
              <p className="text-[13px] text-charcoal-600 leading-[1.6] m-0">
                {t(`whatPlatform.cards.${i}.description`)}
              </p>
            </div>
          ))}
        </div>
      </Block>

      <Block title={t('comparison.title')}>
        <p className="mb-6">{t('comparison.intro')}</p>
        <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
          {/* Without tukio.one */}
          <div className="p-5 rounded-xl bg-cream-100" aria-label={t('comparison.without.kicker')}>
            <div className="text-[11px] font-mono tracking-[0.08em] uppercase text-charcoal-500 mb-2.5">
              {t('comparison.without.kicker')}
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {(['0', '1', '2', '3', '4'] as const).map((i) => (
                <li key={i} className="text-[13px] text-charcoal-600">
                  · {t(`comparison.without.items.${i}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* With tukio.one */}
          <div
            className="p-5 rounded-xl bg-brand-50 border border-brand-100"
            aria-label={t('comparison.with.kicker')}
          >
            <div className="text-[11px] font-mono tracking-[0.08em] uppercase text-brand-700 mb-2.5">
              {t('comparison.with.kicker')}
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {(['0', '1', '2', '3', '4'] as const).map((i) => (
                <li key={i} className="text-[13px] text-charcoal-700 flex items-start gap-2">
                  <Check
                    size={14}
                    className="text-brand-700 flex-shrink-0 mt-0.5"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span>{t(`comparison.with.items.${i}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Block>

      <Block title={t('anchored.title')}>
        <p className="mb-3">{t('anchored.p1')}</p>
        <p>{t('anchored.p2')}</p>
      </Block>

      <Block title={t('commitments.title')}>
        <ul className="pl-5 m-0">
          {(['0', '1', '2', '3'] as const).map((i) => (
            <li key={i} className="mb-2 last:mb-0">
              {t(`commitments.items.${i}`)}
            </li>
          ))}
        </ul>
      </Block>
    </>
  );
}
