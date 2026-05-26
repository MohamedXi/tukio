import { getTranslations } from 'next-intl/server';
import { CreditCard, Check } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';

interface SellerComingSoonPaymentsProps {
  locale: string;
}

const PIPELINE_STEPS = ['clientPays', 'escrow', 'delivery', 'payout'] as const;
const CLIENT_PAYS_ITEMS = ['card', 'wallet', 'sepa', 'installments'] as const;
const YOU_GET_PAID_ITEMS = ['sepa', 'delay', 'tracking', 'invoices'] as const;

// Dark section (charcoal-800 background) with cream-50/cream-200 text.
// Color contrast verified: cream-50 on charcoal-800 = AAA (≥ 7:1), cream-100 on charcoal-800 = AA (≥ 4.5:1).
// Avoid opacity-* utilities on text — they compress contrast ratios below AA.
export async function SellerComingSoonPayments({ locale }: SellerComingSoonPaymentsProps) {
  const t = await getTranslations({ locale, namespace: 'seller_coming_soon.payments' });

  return (
    <section className="px-10 py-18 bg-charcoal-800 text-cream-50 max-md:px-6 max-md:py-14">
      <div className="max-w-300 mx-auto">
        <Kicker color="cream">{t('kicker')}</Kicker>
        <h2 className="text-[36px] font-display font-normal mt-2 mb-3.5 text-cream-50 max-md:text-[28px]">
          {t('title')}
        </h2>
        <p className="text-[15px] text-cream-200 max-w-[620px] leading-[1.6] mb-9">{t('intro')}</p>

        {/* Pipeline 4-col */}
        <div className="grid grid-cols-4 gap-4 mb-10 max-md:grid-cols-2 max-sm:grid-cols-1">
          {PIPELINE_STEPS.map((slug) => (
            <div
              key={slug}
              className="p-4.5 rounded-xl bg-cream-50/[0.04] border border-cream-50/[0.08]"
            >
              <div className="font-display italic text-[28px] text-brand-300 font-normal tracking-tight leading-none">
                {t(`pipeline.${slug}.n`)}
              </div>
              <h3 className="text-[14px] font-semibold mt-3 text-cream-50">
                {t(`pipeline.${slug}.title`)}
              </h3>
              <p className="text-[12px] text-cream-200/85 mt-1.5 leading-[1.55]">
                {t(`pipeline.${slug}.description`)}
              </p>
            </div>
          ))}
        </div>

        {/* Modes paiement 2-col */}
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          <PaymentColumn
            title={t('clientPaysTitle')}
            items={CLIENT_PAYS_ITEMS.map((slug) => ({
              title: t(`clientPaysItems.${slug}.title`),
              description: t(`clientPaysItems.${slug}.description`),
            }))}
            IconComponent={CreditCard}
          />
          <PaymentColumn
            title={t('youGetPaidTitle')}
            items={YOU_GET_PAID_ITEMS.map((slug) => ({
              title: t(`youGetPaidItems.${slug}.title`),
              description: t(`youGetPaidItems.${slug}.description`),
            }))}
            IconComponent={Check}
          />
        </div>

        {/* Stripe Connect partner bloc */}
        <div className="mt-10 p-6 rounded-xl bg-cream-50/[0.06] flex gap-5 items-center max-md:flex-col max-md:items-start">
          <span
            aria-hidden="true"
            className="w-12 h-12 rounded-lg bg-[#635BFF] text-white inline-flex items-center justify-center text-2xl font-bold flex-shrink-0"
          >
            S
          </span>
          <div>
            <h3 className="text-[16px] font-semibold text-cream-50">{t('stripeTitle')}</h3>
            <p className="text-[13px] text-cream-200 mt-1.5 leading-[1.6]">{t('stripeBody')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PaymentColumnItem {
  title: string;
  description: string;
}

function PaymentColumn({
  title,
  items,
  IconComponent,
}: {
  title: string;
  items: PaymentColumnItem[];
  IconComponent: typeof CreditCard;
}) {
  return (
    <div>
      <h3 className="text-[18px] font-semibold text-cream-50 mb-4">{title}</h3>
      <ul className="flex flex-col gap-3.5">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <IconComponent
              size={16}
              color="var(--color-brand-300)"
              strokeWidth={2.5}
              aria-hidden="true"
              className="flex-shrink-0 mt-1"
            />
            <div>
              <div className="text-[14px] font-semibold text-cream-50">{item.title}</div>
              <p className="text-[12px] text-cream-200/75 mt-0.5 leading-[1.5]">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
