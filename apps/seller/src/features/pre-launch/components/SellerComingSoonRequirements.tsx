import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';
import { Spacer } from '@tukio/ui/components/Spacer';

interface SellerComingSoonRequirementsProps {
  locale: string;
}

const PRO_APP_ITEMS = ['siret', 'id', 'activity', 'insurance', 'contact'] as const;
const PAYMENT_ITEMS = ['bankAccount', 'iban', 'stripeKyc', 'kbis'] as const;

export async function SellerComingSoonRequirements({ locale }: SellerComingSoonRequirementsProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.requirements' });

  return (
    <section className="py-14 max-w-[1200px] mx-auto max-md:px-6 max-md:py-10">
      <Kicker>{t('kicker')}</Kicker>
      <h2 className="text-[36px] font-display font-normal mt-2 mb-7 text-charcoal-800 max-md:text-[28px]">
        {t('title')}
      </h2>
      <Spacer />
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <RequirementsCard
          title={t('proAppTitle')}
          items={PRO_APP_ITEMS.map((k) => t(`proAppItems.${k}`))}
        />
        <RequirementsCard
          title={t('paymentTitle')}
          items={PAYMENT_ITEMS.map((k) => t(`paymentItems.${k}`))}
        />
      </div>
    </section>
  );
}

function RequirementsCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-6 rounded-xl bg-cream-50 border border-cream-200">
      <h3 className="text-[17px] font-semibold mb-3.5 text-charcoal-800">{title}</h3>
      <Spacer size={5} />
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-[14px] text-charcoal-700 leading-[1.55]"
          >
            <Check
              size={16}
              color="var(--color-brand-700)"
              strokeWidth={2.5}
              aria-hidden="true"
              className="flex-shrink-0 mt-0.5"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
