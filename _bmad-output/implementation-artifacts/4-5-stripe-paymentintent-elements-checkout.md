# Story 4.5: Stripe PaymentIntent + Stripe Elements checkout frontend + sync coordination (FR49, NFR1, NFR3, NFR6, NFR47-55)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As a** Customer authentifié Tukio sur `/fr/cart`,
**I want** **payer par carte bancaire via Stripe Elements** (`<PaymentElement>` Stripe.js latest stable) avec **3D Secure SCA Europe support** et **autorisation différée (capture_method='manual')** côté payment-svc Story 4.2 livré + **page confirmation post-3DS-success** (`/fr/checkout/success?bookingId=...`) UX-DR `confirmation` bundle figé,
**So that** le paiement est **PCI DSS compliant** (Tukio ne voit jamais le PAN/CVV — Stripe.js chiffre côté client), **SCA Europe-ready** (3DS automatique si requis par la banque), **autorisé mais non capturé** jusqu'à acceptation Pro Story 4.7 (NFR6 < 800 ms p95 capture latency) et le **tunnel Customer end-to-end MVP** (cart → checkout → payment → confirmation page → bookings list) est **livré complet production-ready**.

Story 4.5 ferme le **tunnel Customer end-to-end MVP critique** Epic 4 :
1. Story 4.1 livré booking-svc Pretre + Booking aggregate + saga producer
2. Story 4.2 livré order-svc + payment-svc Pretre + Stripe PaymentIntent backend + webhook routing
3. Story 4.3 livré cart Zustand + `/fr/cart` page
4. Story 4.4 livré booking submission + 3-layer race conditions + `POST /v1/bookings/checkout-session` endpoint
5. **Story 4.5 livre le frontend Stripe Elements + confirmation page + sync coordination gateway-api ↔ booking-svc ↔ payment-svc — production-ready PCI DSS + SCA Europe**

**Story 4.5 livre** :

- (a) **Décision coordination architecture sync `clientSecret` retour** — problème identifié : Story 4.2 livré `create-payment-intent.usecase.ts` comme **consumer NATS** de `booking.requested.v1` (async). Story 4.5 frontend nécessite `clientSecret` **synchronously** pour render `<PaymentElement>`. Décision Story 4.5 :
  - **AJOUTE sync endpoint payment-svc** `POST /internal/payment-intents/create-for-booking` (NEW Story 4.5 EXTEND Story 4.2 baseline) qui invoque la MÊME logique business `create-payment-intent.usecase` Story 4.2 mais synchronously + returns `clientSecret`. Idempotent via `findByBookingId` UNIQUE constraint Story 4.2 baseline — async consumer Story 4.2 le retrouve déjà et skip.
  - **UPDATE gateway-api `POST /v1/bookings/checkout-session`** Story 4.4 livré — orchestre 2 internal calls sync : (1) `POST /internal/bookings/checkout-session` booking-svc Story 4.4 → returns `bookingId`, (2) `POST /internal/payment-intents/create-for-booking` payment-svc Story 4.5 → returns `paymentIntentClientSecret`. Combine et returns `{ data: { bookingId, paymentIntentClientSecret } }` envelope ADR-014.
  - **Idempotency safety** : si payment-svc sync endpoint déjà appelé (e.g., frontend retry) → returns existing `clientSecret` (no double Stripe API call grâce idempotency key Story 4.2 baseline `correlationId+'-create-pi'`).
  - **Saga events continue** : booking-svc émet `booking.requested.v1` (async), payment-svc async consumer Story 4.2 le traite mais détecte PaymentIntent déjà créé (`findByBookingId returns non-null`) → no-op + log + emit `payment.intent-created.v1` quand-même pour Story 4.2 order-svc dual-gate
  - **Architecture tradeoff** : pragmatic sync coordination pour UX p95 < 1s, événements async pour downstream consumers (Order, audit, notification). Pattern marketplace standard (Stripe Connect docs réf).

- (b) **Frontend `/fr/checkout` page** (`apps/customer/src/app/[locale]/checkout/page.tsx`) — **Server Component initial** + **Client Component `<CheckoutForm>`** pour Stripe Elements :
```tsx
// apps/customer/src/app/[locale]/checkout/page.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CheckoutPageClient } from '@/features/cart-checkout/components/CheckoutPageClient';
import { CheckoutSkeleton } from '@/features/cart-checkout/components/CheckoutSkeleton';
import { requireAuth } from '@tukio/auth-client/server';                                             // Story 1.4 baseline server-side auth helper

export default async function CheckoutPage({ params }: { params: Promise<{ locale: 'fr' | 'en' }> }) {
  const { locale } = await params;
  const { user } = await requireAuth();                                                              // redirects to /auth/login?redirectTo=/checkout if unauthenticated
  const t = await getTranslations({ locale, namespace: 'customer.checkout' });

  return (
    <main aria-labelledby="checkout-heading" className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 id="checkout-heading" className="font-display text-3xl text-charcoal-900 mb-6">{t('title')}</h1>
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutPageClient userLocale={locale} />
      </Suspense>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: 'fr' | 'en' }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'customer.checkout.metadata' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    robots: { index: false, follow: false },                                                         // private page, no SEO
  };
}
```

- (c) **`<CheckoutPageClient>` Client Component** (`apps/customer/src/features/cart-checkout/components/CheckoutPageClient.tsx`) — orchestre cart read (Story 4.3 Zustand) + appel `POST /v1/bookings/checkout-session` + render `<Elements>` + `<PaymentElement>` :
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@tukio/ui/stores/cart.store';
import { CheckoutForm } from './CheckoutForm';
import { CartSummary } from './CartSummary';
import { CheckoutErrorState } from './CheckoutErrorState';
import { EmptyState } from '@tukio/ui/patterns/EmptyState';
import { useCreateCheckoutSession } from '@tukio/api-client/hooks/booking';

// Initialize Stripe.js — single instance shared across mounts (latest stable @stripe/stripe-js v5+)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function CheckoutPageClient({ userLocale }: { userLocale: 'fr' | 'en' }) {
  const router = useRouter();
  const t = useTranslations('customer.checkout');
  const cart = useCartStore();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<CheckoutError | null>(null);
  const createSession = useCreateCheckoutSession();                                                  // TanStack Query mutation Story 4.5

  useEffect(() => {
    if (cart.isEmpty()) return;
    if (clientSecret) return;                                                                         // already initialized

    createSession.mutate(
      { cartId: cart.cartId!, period: derivePeriodFromCart(cart) /* TODO Story 4.5 : period selector UI MVP — see Dev Notes */ },
      {
        onSuccess: ({ bookingId, paymentIntentClientSecret }) => {
          setClientSecret(paymentIntentClientSecret);
          setBookingId(bookingId);
        },
        onError: (err) => {
          setError(mapApiErrorToCheckoutError(err));
        },
      }
    );
  }, [cart, clientSecret, createSession]);

  if (cart.isEmpty()) {
    return (
      <EmptyState
        variant="cart-empty"
        title={t('empty.title')}
        description={t('empty.description')}
        cta={{ label: t('empty.cta'), href: '/category/tents-marquees' }}
      />
    );
  }

  if (error) {
    return <CheckoutErrorState error={error} onRetry={() => { setError(null); setClientSecret(null); }} />;
  }

  if (createSession.isPending || !clientSecret) {
    return <CheckoutSkeleton />;
  }

  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    locale: userLocale,                                                                              // Stripe Elements i18n binding
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: 'var(--color-terracotta-500)',                                                  // Tukio theme tokens — design brief §B
        colorBackground: '#ffffff',
        colorText: 'var(--color-charcoal-900)',
        colorDanger: 'var(--color-error)',
        fontFamily: 'var(--font-sans)',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
      rules: {
        '.Input': { borderColor: 'var(--color-charcoal-300)' },
        '.Input:focus': { borderColor: 'var(--color-terracotta-500)', boxShadow: '0 0 0 3px rgba(229, 102, 73, 0.2)' },
        '.Label': { color: 'var(--color-charcoal-700)', fontWeight: '500' },
      },
    },
    fonts: [{ cssSrc: '/fonts/stylesheet.css' }],                                                     // Tukio font (cf Story 0.3 design system)
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <section aria-label={t('paymentSection.label')} className="lg:col-span-2">
        <Elements stripe={stripePromise} options={elementsOptions}>
          <CheckoutForm bookingId={bookingId!} returnUrl={`${process.env.NEXT_PUBLIC_CUSTOMER_BASE_URL}/${userLocale}/checkout/success?bookingId=${bookingId}`} />
        </Elements>
      </section>
      <aside aria-label={t('summarySection.label')} className="lg:col-span-1">
        <CartSummary readOnly />
      </aside>
    </div>
  );
}
```

- (d) **`<CheckoutForm>` Client Component** (`apps/customer/src/features/cart-checkout/components/CheckoutForm.tsx`) — render `<PaymentElement>` + handle `stripe.confirmPayment` :
```tsx
'use client';
import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@tukio/ui/components/Button';
import { useTranslations } from 'next-intl';
import { useToast } from '@tukio/ui/components/Toast';

export function CheckoutForm({ bookingId, returnUrl }: { bookingId: string; returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useTranslations('customer.checkout.form');
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Stripe.confirmPayment :
    // - Chiffre CB côté client (PCI DSS — Tukio ne voit jamais le PAN)
    // - Déclenche 3D Secure si requis (Stripe redirect bank → return to returnUrl post-3DS)
    // - PaymentIntent.status devient `requires_capture` (auth différée — capture à l'accept Pro Story 4.7)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',                                                                       // if 3DS not required, stay on page + we navigate manually
    });

    if (error) {
      // Stripe rejected (card declined, 3DS failed, network, etc.)
      // error.type ∈ { 'card_error', 'validation_error', 'authentication_error', 'api_error', ... }
      // error.code ∈ Stripe API codes ('card_declined', 'insufficient_funds', 'authentication_required', etc.)
      setIsSubmitting(false);
      setErrorMessage(mapStripeErrorToUserMessage(error, t));
      // No PII in logs — only error code + paymentIntentId
      console.warn('Stripe confirmPayment error', { code: error.code, type: error.type, bookingId });
      return;
    }

    // 3DS not required (low-risk transaction) — PaymentIntent already in requires_capture
    if (paymentIntent?.status === 'requires_capture') {
      // Backend webhook payment_intent.requires_capture will also fire (idempotent via stripe_events_inbox Story 2.1)
      router.push(`/${userLocale}/checkout/success?bookingId=${bookingId}`);
      return;
    }

    // Edge case : status processing or unexpected
    setIsSubmitting(false);
    setErrorMessage(t('errors.unexpectedStatus', { status: paymentIntent?.status ?? 'unknown' }));
  };

  return (
    <form onSubmit={handleSubmit} aria-label={t('formLabel')} className="space-y-6">
      <div className="bg-white border border-charcoal-200 rounded-lg p-6">
        <h2 className="font-display text-xl text-charcoal-900 mb-4">{t('cardSectionTitle')}</h2>
        <PaymentElement
          options={{
            layout: 'tabs',                                                                          // tabs UX better than accordion for mobile
            fields: {
              billingDetails: {
                name: 'auto',                                                                         // ask if not present in Stripe customer
                email: 'auto',
                phone: 'never',                                                                       // phone never required MVP
                address: { country: 'auto', postalCode: 'auto', line1: 'never', line2: 'never', city: 'never', state: 'never' },  // postal code only for AVS
              },
            },
            terms: { card: 'never' },                                                                // no Stripe terms — we have our own CGU
            wallets: { applePay: 'auto', googlePay: 'auto' },                                        // V1+ Story 14.x
          }}
        />
      </div>
      <div className="bg-charcoal-50 border border-charcoal-200 rounded-lg p-4">
        <p className="text-sm text-charcoal-700">
          <strong>{t('deferredCapture.title')}</strong> {t('deferredCapture.description')}
        </p>
      </div>
      {errorMessage && (
        <div role="alert" aria-live="polite" className="bg-error-50 border border-error-200 text-error-900 rounded-lg p-4">
          {errorMessage}
        </div>
      )}
      <Button type="submit" variant="primary" size="lg" fullWidth disabled={!stripe || isSubmitting} loading={isSubmitting}>
        {isSubmitting ? t('submitting') : t('payCta', { amount: formatCurrency(totalCents, 'EUR', userLocale) })}
      </Button>
      <p className="text-xs text-charcoal-500 text-center">{t('securityNotice')}</p>
    </form>
  );
}
```

- (e) **Page `/fr/checkout/success`** (`apps/customer/src/app/[locale]/checkout/success/page.tsx`) — UX-DR `confirmation` bundle figé Cloud Design `screens/confirmation.jsx`. Server Component avec polling/refetch `useBookingDetail(bookingId)` :
```tsx
// apps/customer/src/app/[locale]/checkout/success/page.tsx
import { Suspense } from 'react';
import { ConfirmationPageClient } from '@/features/cart-checkout/components/ConfirmationPageClient';
import { ConfirmationSkeleton } from '@/features/cart-checkout/components/ConfirmationSkeleton';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@tukio/auth-client/server';

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: 'fr' | 'en' }>;
  searchParams: Promise<{ bookingId?: string; payment_intent?: string; payment_intent_client_secret?: string; redirect_status?: string }>;
}) {
  const { locale } = await params;
  const { bookingId, redirect_status } = await searchParams;
  await requireAuth();
  const t = await getTranslations({ locale, namespace: 'customer.checkout.success' });

  if (!bookingId) redirect(`/${locale}/customer/bookings`);                                          // fallback if user hit URL directly without params

  return (
    <main aria-labelledby="confirmation-heading" className="container mx-auto px-4 py-12 max-w-3xl">
      <Suspense fallback={<ConfirmationSkeleton />}>
        <ConfirmationPageClient bookingId={bookingId} redirectStatus={redirect_status as 'succeeded' | 'requires_action' | 'failed' | undefined} />
      </Suspense>
    </main>
  );
}
```

- (f) **`<ConfirmationPageClient>` Client Component** — consume `useBookingDetail` Story 4.11 future (placeholder MVP : show summary from useCartStore lastCheckoutBooking OR poll booking-svc) + clear cart Zustand:
```tsx
'use client';
import { useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { Card } from '@tukio/ui/components/Card';
import { Button } from '@tukio/ui/components/Button';
import { Badge } from '@tukio/ui/components/Badge';
import { useCartStore } from '@tukio/ui/stores/cart.store';
import { useBookingDetail } from '@tukio/api-client/hooks/booking';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function ConfirmationPageClient({ bookingId, redirectStatus }: { bookingId: string; redirectStatus?: 'succeeded' | 'requires_action' | 'failed' }) {
  const t = useTranslations('customer.checkout.success');
  const locale = useLocale();
  const { data: booking, isLoading, error } = useBookingDetail(bookingId);                          // Story 4.11 hook OR Story 4.5 baseline
  const clearCart = useCartStore((s) => s.clear);

  // Clear cart on mount — payment authorized + Booking created successfully
  useEffect(() => {
    if (redirectStatus === 'succeeded' || (booking && booking.status === 'pending_pro_acceptance')) {
      clearCart();                                                                                  // cart consumed by Story 4.4 backend already, but ensure frontend state matches
    }
  }, [redirectStatus, booking, clearCart]);

  if (isLoading) return <ConfirmationSkeleton />;
  if (error || !booking) return <ConfirmationErrorState bookingId={bookingId} />;

  if (redirectStatus === 'failed') {
    return <PaymentFailedState bookingId={bookingId} />;
  }

  return (
    <article className="text-center space-y-8">
      <div className="flex justify-center">
        <CheckCircle className="h-16 w-16 text-success-500" aria-hidden="true" />
      </div>
      <header>
        <h1 id="confirmation-heading" className="font-display text-3xl text-charcoal-900">{t('title')}</h1>
        <p className="text-charcoal-700 mt-2">{t('subtitle', { proName: booking.proDisplayName })}</p>
      </header>
      <Card className="text-left p-6 space-y-4">
        <div>
          <Badge variant="warning" icon={<Clock className="h-4 w-4" aria-hidden="true" />}>{t('badgePending')}</Badge>
          <p className="text-sm text-charcoal-500 mt-1">{t('acceptanceDeadline', { hours: 48 })}</p>
        </div>
        <div className="border-t border-charcoal-200 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-charcoal-500">{t('listingLabel')}</span>
            <span className="font-medium text-charcoal-900">{booking.listingTitle}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-charcoal-500">{t('periodLabel')}</span>
            <span className="font-medium text-charcoal-900">{formatPeriod(booking.period, locale)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-charcoal-500">{t('totalLabel')}</span>
            <span className="font-medium text-charcoal-900">{formatCurrency(booking.totalAmountCents, 'EUR', locale)}</span>
          </div>
        </div>
        <p className="text-xs text-charcoal-500 italic">{t('cardChargedAfterAcceptance')}</p>
      </Card>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="primary" size="lg" asChild>
          <Link href={`/customer/bookings/${bookingId}`}>{t('viewBookingCta')}</Link>
        </Button>
        <Button variant="ghost" size="lg" asChild>
          <Link href="/category/tents-marquees">{t('continueDiscoveryCta')}</Link>
        </Button>
      </div>
      <p className="text-xs text-charcoal-400">{t('confirmationEmailNotice', { email: '...' })}</p>
    </article>
  );
}
```

- (g) **payment-svc EXTEND Story 4.2 — sync endpoint `POST /internal/payment-intents/create-for-booking`** (`apps/payment-svc/src/infrastructure/http/controllers/payment-intent.controller.ts` NEW) :
```ts
@Controller({ path: 'internal/payment-intents', version: '1' })
@UseGuards(InternalServiceTokenGuard)                                                                  // X-Internal-Service-Token Story 1.10 pattern
export class PaymentIntentInternalController {
  constructor(@Inject(USE_CASES_PROXY) private readonly proxy: UseCasesProxy) {}

  @Post('create-for-booking')
  async createForBooking(@Body() body: CreatePaymentIntentForBookingDto): Promise<SuccessEnvelope<PaymentIntentCreatedResponseDto>> {
    // Idempotent — uses same Story 4.2 create-payment-intent.usecase
    // If PaymentIntent already exists for bookingId → returns existing clientSecret (no double Stripe API call)
    const usecase = this.proxy.getCreatePaymentIntent().getInstance();
    const result = await usecase.execute({
      bookingId: body.bookingId,
      customerProfileId: body.customerProfileId,
      proProfileId: body.proProfileId,
      totalAmountCents: body.totalAmountCents,
      correlationId: body.correlationId,
      source: 'sync-http',                                                                            // distinguishes from async NATS consumer call
    });
    return Envelope.success({
      paymentIntentId: result.paymentIntentId,
      stripePaymentIntentId: result.stripePaymentIntentId,
      clientSecret: result.clientSecret,                                                              // NEW field returned by create-payment-intent.usecase Story 4.2 — already populated by aggregate
      status: result.status,
    });
  }
}
```
- **UPDATE Story 4.2 `create-payment-intent.usecase.ts`** : add idempotency check at start :
```ts
// At start of execute() :
const existing = await this.repo.findByBookingId(input.bookingId);
if (existing && existing.stripePaymentIntentId) {
  this.logger.info('PaymentIntent already exists for booking — returning existing', { bookingId: input.bookingId, source: input.source });
  return { paymentIntentId: existing.id.value, stripePaymentIntentId: existing.stripePaymentIntentId, clientSecret: existing.stripeClientSecret, status: existing.status };
}
// ... rest of logic Story 4.2 baseline
```
- **DTO** `packages/contracts/src/dtos/payment/create-payment-intent-for-booking.dto.ts` NEW

- (h) **gateway-api UPDATE Story 4.4 `bookings.controller.ts` — orchestrate 2 sync internal calls** (`apps/gateway-api/src/usecases/booking/book-listing.forwarder.ts` UPDATE) :
```ts
async execute(input: BookListingForwarderInput): Promise<BookListingResponse> {
  const correlationId = randomUUID();
  // Step 1 — booking-svc creates Booking + emits booking.requested.v1
  const bookingResult = await this.bookingSvcClient.post<{ bookingId: string; status: string }>(
    '/internal/bookings/checkout-session',
    { ...input, correlationId },
  );
  // Step 2 — payment-svc creates Stripe PaymentIntent sync + returns clientSecret
  const paymentResult = await this.paymentSvcClient.post<{ paymentIntentId: string; stripePaymentIntentId: string; clientSecret: string; status: string }>(
    '/internal/payment-intents/create-for-booking',
    {
      bookingId: bookingResult.bookingId,
      customerProfileId: input.customerProfileId,
      proProfileId: input.proProfileId,                                                                // booking-svc returns this in step 1 response
      totalAmountCents: input.totalAmountCents,                                                        // booking-svc returns this in step 1 response
      correlationId,
    },
  );
  return {
    bookingId: bookingResult.bookingId,
    paymentIntentClientSecret: paymentResult.clientSecret,
    status: bookingResult.status,
  };
}
```
- **UPDATE Story 4.4 internal endpoint response** : add `proProfileId` + `totalAmountCents` to booking-svc internal endpoint response for payment-svc consumption
- **UPDATE Story 4.4 `BookListingResponse` DTO** : add `paymentIntentClientSecret: string` field
- **Error handling** : if booking creation fails → return 4xx envelope (3-layer conflict 409, validation 422). If payment-svc creation fails after booking succeeded → log error + compensate (booking-svc emits `booking.cancelled.v1` with cause `payment-intent-creation-failed`) + return 502 envelope `BOOKING-PAYMENT-COORDINATION-001`. Story 4.13 saga watchdog will catch orphan bookings.

- (i) **`@tukio/api-client` hook `useCreateCheckoutSession`** (`packages/api-client/src/hooks/booking/useCreateCheckoutSession.ts` NEW) :
```ts
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: async (input: BookListingRequestDto): Promise<BookListingResponse> => {
      const response = await apiClient.post('/v1/bookings/checkout-session', input);
      return unwrapEnvelope<BookListingResponse>(response);
    },
    // No retry on 409 conflict, 422 validation, 410 unpublished — only on 5xx transient
    retry: (failureCount, error) => {
      const status = error.response?.status;
      if (status && [400, 401, 403, 404, 409, 410, 422, 429].includes(status)) return false;
      return failureCount < 2;
    },
  });
}
```

- (j) **i18n FR/EN strict** :
  - `apps/customer/messages/{fr,en}.json` — namespace `customer.checkout.*` + `customer.checkout.success.*` + `customer.checkout.form.*` + `customer.checkout.errors.*` ~60 keys × 2 langues
  - **Stripe Elements locale** : `loadStripe({ locale: userLocale })` — Stripe natively translates Elements labels + 3DS UI. Tukio fournit le wrapping (titres, CTAs, microcopy).
  - **Tone & voice Tukio FR** : vouvoiement, chaleureux pas familier, pas d'émojis, microcopy proactive (UX spec L774-789). Exemple : `customer.checkout.deferredCapture.description` → "Votre carte sera débitée **uniquement après acceptation par le professionnel** (sous 48h max)." / "Your card will be charged **only after acceptance by the professional** (within 48h)."
  - **i18n CI lint** Story 0.9 `pnpm i18n:audit` pass — both files contain all keys

- (k) **NFR1 PII redaction frontend + NFR3 LCP < 1s + NFR47-55 RGAA AA + NFR6 capture < 800 ms** :
  - **Frontend** : NEVER log `clientSecret`, `paymentMethodId`, billing details côté client — `console.warn` only error.code + error.type + bookingId
  - **NEVER store clientSecret in LocalStorage / SessionStorage / cookies** — held in React state only, garbage collected on page leave
  - **NFR3 LCP < 1s** : Server Component shell render fast, Client Component `<CheckoutPageClient>` lazy-loads `loadStripe` (Stripe.js script ~150 kB gzipped). Lighthouse CI Story 0.11 gate
  - **NFR6 capture < 800 ms p95** : Story 4.2 payment-svc capture-payment.usecase Story 4.2 livré + Story 4.7 Pro accept triggers — Story 4.5 NOT in capture path (Story 4.5 = auth only `requires_capture`)
  - **RGAA AA** : `<PaymentElement>` Stripe natively RGAA AA compliant (keyboard nav, screen reader labels, contrast ratios). Tukio wrapping (`<Button>`, `<form>`, error `role="alert" aria-live="polite"`) RGAA AA per Story 0.5
  - **Focus management** : on submit click, focus moves to error alert if any (Story 0.5 form pattern)
  - Touch targets 44×44 px mobile (`<Button size="lg">` = 48 px Story 0.5)

- (l) **Error handling** — map Stripe error codes → user-friendly i18n messages + retry actions :
  | Stripe `error.code` | User message (i18n key) | Action |
  |---------------------|-------------------------|--------|
  | `card_declined` | `errors.cardDeclined` ("Votre carte a été refusée. Vérifiez les informations ou essayez une autre carte.") | Retry with different card |
  | `insufficient_funds` | `errors.insufficientFunds` ("Fonds insuffisants. Vérifiez votre solde ou essayez une autre carte.") | Retry |
  | `authentication_required` | `errors.authRequired` ("L'authentification 3D Secure a échoué. Réessayez ou contactez votre banque.") | Retry |
  | `expired_card` | `errors.expiredCard` ("Votre carte est expirée.") | Update card |
  | `incorrect_cvc` | `errors.incorrectCvc` ("Le code de sécurité (CVC) est incorrect.") | Retry |
  | `processing_error` | `errors.processingError` ("Erreur temporaire. Réessayez dans quelques instants.") | Retry with backoff |
  | `rate_limit` | `errors.rateLimit` ("Trop de tentatives. Patientez quelques instants.") | Wait + retry |
  | other | `errors.generic` ("Une erreur est survenue. Contactez le support si le problème persiste.") | Contact support |

  **Backend errors** (envelope ADR-014 with `tukioCode`) :
  | `tukioCode` | Frontend handler |
  |-------------|------------------|
  | `BOOKING-CONFLICT-001/002/003` (Story 4.4) | Toast warning + refresh cart + return to /cart |
  | `BOOKING-VALIDATION-001` (cart-not-found, listing-unavailable, multi-line MVP) | EmptyState + back to /cart |
  | `BOOKING-LISTING-UNAVAILABLE-004` (Story 4.1 listing snapshot unavailable) | Redirect /services/<slug> with 410-handling Story 3.10 |
  | `CART-NOT-FOUND-001` (Story 4.3) | Clear cart store + back to /cart EmptyState |
  | `PAYMENT-STRIPE-API-FAILURE-005` (NEW Story 4.5 — sync coordination payment-svc Stripe API down) | Retry with backoff + fallback contact support |
  | `BOOKING-PAYMENT-COORDINATION-001` (NEW Story 4.5 — payment-svc creation failed post-booking-success) | "Réservation enregistrée mais paiement non initié. Notre équipe vous contactera." + emit alert ops |
  | network error / timeout | Toast retry "Connexion interrompue. Réessayez." |

- (m) **Stripe webhook routing Story 4.2 livré — verify** (no Story 4.5 modification) :
  - `payment_intent.requires_capture` → Story 4.2 `process-stripe-webhook.usecase` route → `PaymentIntent.markRequiresCapture()` → outbox `payment.intent-authorized.v1` → order-svc dual-gate Story 4.2
  - `payment_intent.payment_failed` (3DS rejected) → Story 4.2 route → `PaymentIntent.markFailed()` → outbox `payment.intent-failed.v1` → booking-svc consumer Story 4.2 → booking-svc transitions Booking to `cancelled` via `cancel-booking.usecase` Story 4.7/4.8 future (BUT Story 4.5 needs Booking auto-cancel on payment fail — see Dev Notes coordination)
  - **DECISION Story 4.5** : Story 4.2 livre `payment.intent-failed.v1` producer + Story 4.5 ADD new `cancel-booking-on-payment-failure.usecase.ts` baseline (NATS consumer booking-svc) — transition Booking `cancelled` reason `payment_failed` + emit `booking.cancelled.v1` → Story 4.2 order-svc cancel + payment-svc cancel + Story 4.5 frontend confirmation page shows failure state
  - **Idempotency** `stripe_events_inbox` Story 2.1 baseline + Story 4.2 EXTEND covers `payment_intent.*` events

- (n) **Cart auto-clear post-success backend** — Story 4.4 livré `cartRepo.delete(cartId)` post-success. Story 4.5 frontend ADDITIONALLY clears Zustand store post-confirmation page mount to handle :
  - Multi-tab : user has cart open in tab 1 + checks out in tab 2 → tab 1 stale state cleared on next navigation (subscribe to cart cookie change OR `BroadcastChannel` API V1+)
  - 3DS redirect : Stripe redirects user away from page → return URL → mount confirmation page → clear cart Zustand
  - MVP : clear on confirmation page mount sufficient

- (o) **Tests Playwright e2e + Stripe test mode** (`apps/customer/e2e/checkout/checkout.spec.ts` NEW) — 14 scenarios :
  - T1 happy : authenticated user with cart → /fr/checkout → Stripe Elements render + `<PaymentElement>` mounted → enter Stripe test card `4242 4242 4242 4242` → submit → redirect to /fr/checkout/success?bookingId=... → confirmation page render with booking details + clear cart
  - T2 3DS success : Stripe test card `4000 0027 6000 3184` requires 3DS → submit → Stripe 3DS modal → confirm → redirect to success page
  - T3 3DS failed : Stripe test card `4000 0000 0000 0002` declined → error message displayed "Votre carte a été refusée"
  - T4 insufficient funds : Stripe test card `4000 0000 0000 9995` → error "Fonds insuffisants"
  - T5 authentication required failed : Stripe test card `4000 0027 6000 3184` + cancel 3DS → error "L'authentification 3D Secure a échoué"
  - T6 unauthenticated user → redirect to /fr/auth/login?redirectTo=/checkout
  - T7 empty cart → EmptyState + CTA back to /category
  - T8 3-layer conflict 409 (mock simultaneous bookings) → toast warning + redirect /cart
  - T9 listing unpublished mid-checkout → redirect /services/<slug> with 410 banner Story 3.10
  - T10 i18n FR/EN switch on checkout page → Stripe Elements re-renders in EN locale
  - T11 RGAA AA kbd nav full (skip-to-content + form labels + error alerts + axe-core 0 violations)
  - T12 NFR3 LCP < 1s checkout page (Lighthouse CI gate)
  - T13 NFR1 PII redaction : no clientSecret in console.log + no PAN/CVV ever transmitted (Stripe.js iframe isolation)
  - T14 multi-tab : checkout in tab 2 → tab 1 cart cleared on next visit

- (p) **NEW exception `BOOKING-PAYMENT-COORDINATION-001`** + compensation flow + `PAYMENT-STRIPE-API-FAILURE-005` :
  - `apps/booking-svc/src/domain/exception/booking-payment-coordination.exception.ts` (NEW) → 502 `BOOKING-PAYMENT-COORDINATION-001` "Réservation créée mais paiement non initié — notre équipe vous contactera"
  - `apps/payment-svc/src/domain/exception/stripe-api-failure.exception.ts` (NEW) → 502 `PAYMENT-STRIPE-API-FAILURE-005` "Erreur Stripe — réessayez ou contactez le support"
  - **Compensation flow** : if payment-svc sync endpoint fails AFTER booking-svc success → gateway-api forwarder catches + emits compensating `booking.cancelled.v1` (cause: `payment-intent-creation-failed`) via dedicated internal endpoint booking-svc `POST /internal/bookings/<id>/cancel-on-coordination-failure` → Story 4.13 saga watchdog alerts on cleanup

## Acceptance Criteria

1. **AC1 — Frontend `/fr/checkout` Server Component + `<CheckoutPageClient>` Client Component orchestrate Story 4.5 endpoint + Stripe Elements** : Given Story 4.3 livré cart Zustand + Story 1.4 baseline auth helper, When je navigue vers `customer.tukio.one/fr/checkout`, Then :
   - **Server Component shell** `apps/customer/src/app/[locale]/checkout/page.tsx` — `requireAuth()` redirect `/auth/login?redirectTo=/checkout` if unauthenticated
   - **`generateMetadata` Next.js 15** — `robots: { index: false, follow: false }` (private page)
   - **`<Suspense>` fallback `<CheckoutSkeleton>`** during initial render
   - **`<CheckoutPageClient>` Client Component** mount → check cart not empty → `useCreateCheckoutSession.mutate({ cartId, period })` → set state `clientSecret` + `bookingId` → render `<Elements>` provider
   - **Empty cart** → `<EmptyState variant="cart-empty">` Story 0.5 réutilisé
   - **`<Elements>` provider** wraps `<CheckoutForm>` with options `{ clientSecret, locale: userLocale, appearance: tukio-theme, fonts: tukio-font }`
   - **Tests** `@testing-library/react` + Playwright 5 scenarios AC1 (Server Component render, redirect unauthenticated, redirect empty cart, mount + mutate → clientSecret state set, Elements provider receives correct options)

2. **AC2 — `<CheckoutForm>` Client Component + `<PaymentElement>` + `stripe.confirmPayment` flow** : Given AC1 `<Elements>` provider, When je consulte `apps/customer/src/features/cart-checkout/components/CheckoutForm.tsx`, Then :
   - **`<PaymentElement>` mounted** with options `{ layout: 'tabs', fields: { billingDetails: { phone: 'never', address: { postalCode: 'auto' } } }, terms: { card: 'never' } }`
   - **Submit handler** : `stripe.confirmPayment({ elements, confirmParams: { return_url: '/fr/checkout/success?bookingId=...' }, redirect: 'if_required' })`
   - **`redirect: 'if_required'`** — 3DS redirects automatically, low-risk transactions stay on page → manual navigation
   - **Error mapping** : Stripe `error.code` → i18n key (cf story body section l)
   - **PCI DSS strict** : NEVER touch PAN/CVV/clientSecret côté Tukio code — Stripe.js iframe isolation
   - **Submit button** `<Button>` Story 0.5 — `disabled` until `stripe` + `elements` ready + not submitting, `loading` state with spinner
   - **Error UI** `role="alert" aria-live="polite"` + focus management on error (RGAA AA)
   - **Tests** Vitest + axe-core 6 scenarios AC2 (mount Elements, submit happy → redirect, submit 3DS → Stripe handles, submit error each code → user message displayed, button disabled state, RGAA AA kbd nav)

3. **AC3 — Page `/fr/checkout/success` Server + `<ConfirmationPageClient>` + UX-DR confirmation bundle figé** : Given AC2 submit success redirect, When user lands on `customer.tukio.one/fr/checkout/success?bookingId=<id>&redirect_status=succeeded&payment_intent=pi_xxx&payment_intent_client_secret=...`, Then :
   - **Server Component** `apps/customer/src/app/[locale]/checkout/success/page.tsx` — `requireAuth()` + `redirect` to `/customer/bookings` if no `bookingId`
   - **`<ConfirmationPageClient>` consumes `useBookingDetail(bookingId)`** (Story 4.11 future hook OR Story 4.5 baseline — fetch booking-svc internal via gateway-api)
   - **UX-DR `confirmation` bundle figé** Cloud Design `screens/confirmation.jsx` reproduction : CheckCircle icon + title "Demande envoyée au Pro" + 48h delay badge + booking summary + 2 CTAs (View booking + Continue discovery)
   - **Clear cart Zustand store on mount** — `useCartStore((s) => s.clear)` (backend already cleared Story 4.4, frontend sync)
   - **3 states** :
     - `redirect_status=succeeded` OR booking.status='pending_pro_acceptance' → success state
     - `redirect_status=failed` → `<PaymentFailedState>` with retry CTA back to /checkout
     - `redirect_status=requires_action` → polling/refresh until status resolved (edge case 3DS async)
   - **Confirmation email notice** "Un email de confirmation a été envoyé à votre adresse" (Story 5.4 notification-svc consumer)
   - **Tests** Playwright + axe-core 5 scenarios AC3 (happy success state, failed state, requires_action state, no bookingId redirect, clear cart on mount)

4. **AC4 — payment-svc sync endpoint `POST /internal/payment-intents/create-for-booking` EXTEND Story 4.2 with idempotency** : Given Story 4.2 livré `create-payment-intent.usecase.ts` as async NATS consumer, When Story 4.5 ajoute sync endpoint, Then :
   - **NEW controller** `apps/payment-svc/src/infrastructure/http/controllers/payment-intent.controller.ts` with internal-only endpoint + `InternalServiceTokenGuard` Story 1.10 pattern
   - **UPDATE `create-payment-intent.usecase.ts` Story 4.2** : add idempotency check at start (`findByBookingId` → if exists with `stripePaymentIntentId` → return cached). Pattern adds `source: 'sync-http' | 'nats-async'` discriminator to input for logging/metrics
   - **DTO** `packages/contracts/src/dtos/payment/create-payment-intent-for-booking.dto.ts` NEW (Zod)
   - **Response DTO** `packages/contracts/src/dtos/payment/payment-intent-created-response.dto.ts` NEW — `{ paymentIntentId, stripePaymentIntentId, clientSecret, status }`
   - **UPDATE `PaymentIntent` aggregate Story 4.2** : verify `stripeClientSecret` field persistance (Story 4.2 baseline likely has it — Story 4.5 verifies + adds getter `getClientSecret()` if needed)
   - **Idempotency Stripe API** : Story 4.2 baseline uses `correlationId+'-create-pi'` idempotency key — guarantees no duplicate Stripe API call even if endpoint called 2x rapidly
   - **NFR1 PII** : `clientSecret` returned in response BUT never logged (pino redact paths Story 2.1 already covers + Story 4.5 verify)
   - **Tests integration testcontainer Postgres + stripe-mock** 6 scenarios AC4 : happy create, idempotent retry returns existing, concurrent sync + async race → 1 Stripe API call only (mutex via DB UNIQUE constraint Story 4.2 baseline), Stripe API down → throws `StripeApiFailureException` mapped to 502 `PAYMENT-STRIPE-API-FAILURE-005`, internal token guard 401 missing header, source discriminator logged

5. **AC5 — gateway-api UPDATE Story 4.4 `bookings.controller.ts` orchestrates 2 sync internal calls** : Given Story 4.4 livré endpoint `POST /v1/bookings/checkout-session`, When Story 4.5 UPDATE, Then :
   - **UPDATE `apps/gateway-api/src/usecases/booking/book-listing.forwarder.ts`** Story 4.4 baseline — orchestrate 2 sequential sync calls (cf. story body section h)
   - **UPDATE booking-svc internal endpoint response** : add `proProfileId` + `totalAmountCents` fields for payment-svc consumption (UPDATE Story 4.4 `apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts` baseline)
   - **UPDATE `BookListingResponse` DTO** Story 4.4 baseline : add `paymentIntentClientSecret: string` field
   - **Error handling compensation flow** : if booking succeeds + payment fails → emit compensating `booking.cancelled.v1` via NEW internal endpoint `POST /internal/bookings/<id>/cancel-on-coordination-failure` (NEW Story 4.5) → return 502 `BOOKING-PAYMENT-COORDINATION-001`
   - **Latency budget** : combined p95 < 1s (NFR3) — booking-svc p50 ~200ms + payment-svc + Stripe API call p50 ~400ms + overhead p50 ~50ms = p95 budget ~1s feasible
   - **Tests E2E gateway** 8 scenarios AC5 (happy combined, booking conflict 409 stops + no payment call, payment Stripe API down → compensation + 502, latency < 1s p95, envelope shape)

6. **AC6 — `useCreateCheckoutSession` TanStack Query hook + error handling** : Given Story 0.9 baseline TanStack Query, When Story 4.5 ajoute hook, Then :
   - **`packages/api-client/src/hooks/booking/useCreateCheckoutSession.ts`** NEW — `useMutation` + retry policy excluding 4xx terminal errors
   - **TypeScript types** depuis `@tukio/contracts/dtos/booking/book-listing-request.dto.ts` Story 4.4 baseline UPDATE Story 4.5
   - **Tests Vitest + msw** 5 scenarios AC6 (happy, 409 no retry, 422 no retry, 5xx retry × 2, envelope unwrap)
   - **Coverage ≥ 85 %**

7. **AC7 — Stripe.js + @stripe/react-stripe-js latest stable + locale binding + appearance tokens** : Given UX spec L832 baseline + memory `feedback_latest_versions`, When Story 4.5 add deps, Then :
   - **`@stripe/stripe-js`** latest stable v5+ (vérifier `pnpm view @stripe/stripe-js version`)
   - **`@stripe/react-stripe-js`** latest stable v3+ (vérifier `pnpm view @stripe/react-stripe-js version`)
   - **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** env var apps/customer + .env.example + UPDATE Doppler config
   - **`loadStripe(publishableKey)`** singleton instance shared across mounts (NOT in component body — module-scoped)
   - **Locale binding** `locale: userLocale` in `<Elements>` options — Stripe Elements natively i18n FR/EN
   - **Appearance Tukio tokens** : `colorPrimary: 'var(--color-terracotta-500)'`, `colorBackground: '#ffffff'`, fontFamily Tukio, borderRadius 8px (design brief §B harmonized)
   - **Stripe.js script** loaded async + lazy (NOT in `<head>` global — only on `/checkout` route)
   - **Tests** verify `loadStripe` called with correct key + locale + appearance + tree-shaking validation (Stripe.js NOT in /cart bundle)

8. **AC8 — Stripe webhook `payment_intent.payment_failed` → `cancel-booking-on-payment-failure.usecase.ts` NEW booking-svc consumer** : Given Story 4.2 livré webhook routing producer `payment.intent-failed.v1`, When Story 4.5 ajoute booking-svc consumer, Then :
   - **NEW `apps/booking-svc/src/usecases/cancel-booking-on-payment-failure.usecase.ts`** — async NATS consumer subscribes `payment.intent-failed.v1` on `PAYMENT` stream
   - **Logic** : dedup via `InboxConsumer` Story 0.7 wrapper + `bookingRepo.findByPaymentIntent(stripePiId)` OR via `correlationId` lookup → `booking.cancelByCustomer(actorCustomerUserId='system', reason: CancellationReason.fromPaymentFailed())` Story 4.1 aggregate method (UPDATE — add `CancellationReason.fromPaymentFailed()` factory) → `bookingRepo.save()` outbox `booking.cancelled.v1` (reason `payment_failed`) → downstream Story 4.2 order-svc cancel + payment-svc no-op (already canceled by Stripe)
   - **`IBookingRepository.findByPaymentIntent`** UPDATE Story 4.1 — add method
   - **Tests** integration testcontainer Postgres + NATS + stripe-mock 5 scenarios AC8 (happy consume + Booking transitions to cancelled, idempotent retry skip, correlation lookup works, outbox event published, NFR82 audit trace)

9. **AC9 — NEW exceptions `BOOKING-PAYMENT-COORDINATION-001` + `PAYMENT-STRIPE-API-FAILURE-005` + compensation flow** : Given AC5 + AC4, When sync coordination fails, Then :
   - **`apps/booking-svc/src/domain/exception/booking-payment-coordination.exception.ts`** NEW → 502 `BOOKING-PAYMENT-COORDINATION-001`
   - **`apps/payment-svc/src/domain/exception/stripe-api-failure.exception.ts`** NEW → 502 `PAYMENT-STRIPE-API-FAILURE-005` (wraps Stripe SDK errors classified as transient — vs `card_declined` etc. which are PaymentFailedException Story 4.2 baseline)
   - **NEW booking-svc internal endpoint** `POST /internal/bookings/<id>/cancel-on-coordination-failure` — invokes compensating `Booking.cancelByCustomer({ reason: 'payment-intent-creation-failed', actor: 'system' })` + outbox `booking.cancelled.v1`
   - **gateway-api forwarder Story 4.5 catches** payment-svc 502 → calls cancel-on-coordination-failure → returns 502 to frontend with `BOOKING-PAYMENT-COORDINATION-001`
   - **Story 4.13 saga watchdog alert** : Prometheus metric `tukio_booking_payment_coordination_failures_total` increment + Slack alert if > 0/min
   - **Tests E2E gateway** 3 scenarios AC9 (happy compensation, compensation also fails → log alert ops, ops manual intervention runbook)

10. **AC10 — i18n FR/EN namespaces `customer.checkout.*` + Stripe Elements locale + i18n CI audit** : Given Story 0.9 i18n CI audit, When Story 4.5 add namespaces, Then :
    - **`apps/customer/messages/{fr,en}.json`** — namespace `customer.checkout.*` (~60 keys × 2 langues) :
      - `title`, `paymentSection.label`, `summarySection.label`, `empty.title/description/cta`, `form.formLabel/cardSectionTitle/submitting/payCta/securityNotice/deferredCapture.title/description`, `form.errors.{cardDeclined,insufficientFunds,authRequired,expiredCard,incorrectCvc,processingError,rateLimit,generic,unexpectedStatus}`, `success.title/subtitle/badgePending/acceptanceDeadline/listingLabel/periodLabel/totalLabel/cardChargedAfterAcceptance/viewBookingCta/continueDiscoveryCta/confirmationEmailNotice`, `success.failed.title/description/retryCta/contactSupport`, `errors.coordinationFailure/stripeApiFailure/listingUnavailable/cartNotFound`, `metadata.pageTitle/pageDescription`
    - **Tone & voice Tukio FR** : vouvoiement strict + chaleureux pas familier + pas d'émojis + microcopy proactive
    - **i18n CI lint Story 0.9** `pnpm i18n:audit` pass — both files contain all keys, no orphans
    - **Stripe Elements locale** auto-binding via `loadStripe({ locale })` — no Tukio code needed for Stripe UI translations

11. **AC11 — NFR1 PII redaction frontend + NFR3 LCP < 1s checkout page + RGAA AA axe-core 0 violations** : Given Story 2.1 baseline pino backend + Story 0.11 CI Lighthouse + Story 0.9 axe-core baseline, When Story 4.5 implement, Then :
    - **NEVER `console.log(clientSecret)`** in frontend — only `console.warn` error.code + bookingId
    - **NEVER store clientSecret in LocalStorage/SessionStorage/cookies** — React state only, garbage collected
    - **Stripe.js iframe isolation** — Tukio code NEVER touches PAN/CVV (Stripe.js DOM iframe enforces)
    - **NFR3 LCP < 1s checkout page** : Server Component fast shell + lazy `loadStripe` (Stripe.js ~150 kB gzipped) + minimal JS hydration
    - **Lighthouse CI Story 0.11 UPDATE** : add `/fr/checkout` to budgets + Accessibility ≥ 90 + LCP < 1s p75 + CLS < 0,1 + FID < 100ms (NFR3)
    - **axe-core 0 violations** checkout page + form + Stripe Elements wrapping
    - **RGAA AA** : `<form aria-label>` + error `role="alert" aria-live="polite"` + focus management on error + 44×44 px touch targets + skip-to-content link
    - **Stripe Elements native RGAA AA** : Stripe enforces ARIA labels + keyboard nav + screen reader compatibility
    - **Tests security** 6 scenarios AC11 (no PII in logs, no clientSecret in storage, iframe isolation verify, LCP measurement, axe-core 0 violations, keyboard navigation full)

12. **AC12 — Cross-zone Vercel multi-zones `/checkout/*` rewrites verify + middleware auth** : Given Story 0.13 baseline Vercel multi-zones + Story 1.4 middleware + Story 4.3 baseline cart cookie cross-zone, When Story 4.5 verify, Then :
    - **`apps/public/next.config.ts` Story 0.13** : verify rewrites `/checkout/*` → customer.tukio.one ACTIVE (Story 4.3 verified — Story 4.5 re-verify)
    - **`apps/customer/src/middleware.ts` Story 1.4** : `/checkout` route requires auth (redirect `/auth/login?redirectTo=/checkout`) — Story 1.4 baseline pattern reused
    - **Cookie `tukio-cart-id` cross-zone** Story 4.3 baseline réutilisé — checkout reads cart from same cartId
    - **Tests E2E Playwright cross-zone** 2 scenarios AC12 (navigate `tukio.one/services/<slug>` → add cart → `tukio.one/cart` → click "Procéder au paiement" → cross-zone navigation to `customer.tukio.one/fr/checkout` → cart preserved)

13. **AC13 — `cancel-booking-on-payment-failure.usecase.ts` Booking aggregate + IBookingRepository.findByPaymentIntent EXTEND Story 4.1** : Given AC8, When Story 4.5 EXTEND Story 4.1, Then :
    - **UPDATE `apps/booking-svc/src/domain/model/booking.aggregate.ts` Story 4.1** : `cancelByCustomer` method already exists (Story 4.1 baseline) — verify accepts `reason: 'payment_failed'` cancellationReasonCode (Story 4.1 baseline 'system-auto-expired' pattern + Story 4.5 adds 'payment-failed' reason code value)
    - **UPDATE `apps/booking-svc/src/domain/model/value-objects/cancellation-reason.vo.ts` Story 4.1** : add `'payment-failed'` reasonCode + factory `CancellationReason.fromPaymentFailed({ stripePaymentIntentId, stripeErrorCode })`
    - **UPDATE `apps/booking-svc/src/domain/ports/booking-repository.port.ts` Story 4.1** : add method `findByPaymentIntent(stripePaymentIntentId: string): Promise<Booking | null>` — OR `findByCorrelationId` if simpler (correlation propagated through saga)
    - **UPDATE `apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts`** : implement `findByPaymentIntent`/`findByCorrelationId` — use existing `idx_booking_correlation_id` index Story 4.1 baseline ✅
    - **Tests** ≥ 90 % use case coverage NFR71 (5 scenarios AC8)

14. **AC14 — Tests Playwright e2e 14 scenarios + Stripe test mode + axe-core + Lighthouse** : Given AC1-13, When CI runs, Then :
    - **`apps/customer/e2e/checkout/checkout.spec.ts`** NEW — 14 scenarios (cf. story body section o)
    - **Stripe test mode** : `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` + test cards `4242 4242 4242 4242` (happy), `4000 0027 6000 3184` (3DS required), `4000 0000 0000 0002` (declined), `4000 0000 0000 9995` (insufficient funds)
    - **Lighthouse CI Story 0.11 UPDATE** : `/fr/checkout` + `/fr/checkout/success` budgets — Accessibility ≥ 90 + LCP < 1s p75 + CLS < 0,1
    - **axe-core 0 violations** all checkout components
    - **Coverage NFR71** : ≥ 90 % critical components (CheckoutPageClient, CheckoutForm, ConfirmationPageClient) + ≥ 85 % api-client hooks + ≥ 90 % cancel-booking-on-payment-failure.usecase + ≥ 90 % payment-intent.controller (sync endpoint) + ≥ 80 % gateway forwarder UPDATE Story 4.4
    - **Performance assertions** : combined backend p95 < 1s (NFR3) + LCP < 1s p75 (Lighthouse)

15. **AC15 — Lint boundaries + EN strict + latest stable versions + Stripe SDK pin verify** : Given Story 0.6 baseline + memories, When `pnpm lint && pnpm typecheck`, Then :
    - **0 violations boundaries** apps/customer/features/cart-checkout + apps/payment-svc/src/domain (no Stripe SDK import in domain — Stripe SDK calls in infrastructure/external/stripe Story 2.1 baseline)
    - **EN strict** : routes `/checkout`, `/checkout/success`, error codes EN portables, env vars `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` English
    - **i18n FR/EN dès Sprint 0** : zero hardcoded user-facing text + namespaces structure + CI lint
    - **Stripe SDK pin verify latest stable** : `pnpm view stripe version` (backend Story 2.1/4.2), `pnpm view @stripe/stripe-js version`, `pnpm view @stripe/react-stripe-js version` — pinner exact latest stable + UPDATE Story 4.2 SDK version if newer than baseline
    - **TypeScript strict** mode + `noUncheckedIndexedAccess` + `noImplicitOverride` (Sprint 0 baseline)

16. **AC16 — Documentation + runbook + handoff Stories 4.6-4.13** : Given AC1-15 livrés, When je consulte docs, Then :
    - **NEW `docs/runbook/stripe-elements-3ds-debug.md`** (~40 lignes) — debugging guide checkout flow + 3DS Secure scenarios + Stripe test cards reference + webhook routing verification + error mapping debugging + multi-tab edge cases
    - **UPDATE `docs/runbook/stripe-payment-intent-debug.md`** Story 4.2 baseline — add Story 4.5 sync coordination + compensation flow + idempotency cross-source (sync + async)
    - **UPDATE `docs/adr/0006-saga-choreographed.md`** — Implementation Notes : Story 4.5 hybrid sync/async coordination for clientSecret retour (documented pattern + tradeoff)
    - **NEW `docs/adr/0015-checkout-sync-coordination.md`** (NEW ADR Story 4.5) — pragmatic exception to ADR-006 saga choreography for synchronous `clientSecret` UX requirement, documented decision + alternatives considered (polling, SSE)
    - **UPDATE `docs/project-context.md`** — section "Checkout Stripe Elements (Story 4.5)" résumé sync coordination + compensation + idempotency
    - **UPDATE `_bmad-output/implementation-artifacts/4-2-...md`** Completion Notes — Story 4.5 sync endpoint + idempotency check added to create-payment-intent.usecase
    - **UPDATE `_bmad-output/implementation-artifacts/4-3-...md`** Completion Notes — Story 4.5 cart consumed via checkout flow
    - **UPDATE `_bmad-output/implementation-artifacts/4-4-...md`** Completion Notes — Story 4.5 endpoint UPDATE return clientSecret
    - **Commit** `feat(customer,booking-svc,payment-svc,gateway-api,contracts,messaging,api-client): Story 4.5 Stripe Elements checkout frontend + sync coordination gateway-api ↔ booking-svc ↔ payment-svc + idempotency cross-source + cancel-booking-on-payment-failure consumer + compensation flow BOOKING-PAYMENT-COORDINATION-001 + Stripe test mode e2e 14 scenarios + NFR3 LCP < 1s + RGAA AA axe-core + tunnel Customer end-to-end MVP closed`

## Tasks / Subtasks

- [ ] **Task 1 — payment-svc EXTEND Story 4.2 : sync endpoint + idempotency check + DTOs** (AC: #4) — coverage ≥ 90 %
  - [ ] 1.1 — `apps/payment-svc/src/infrastructure/http/controllers/payment-intent.controller.ts` NEW (internal endpoint + InternalServiceTokenGuard)
  - [ ] 1.2 — UPDATE `apps/payment-svc/src/usecases/create-payment-intent.usecase.ts` Story 4.2 — add idempotency check `findByBookingId` at start
  - [ ] 1.3 — `packages/contracts/src/dtos/payment/{create-payment-intent-for-booking,payment-intent-created-response}.dto.ts` NEW Zod
  - [ ] 1.4 — UPDATE `packages/contracts/src/dtos/payment/index.ts` barrel export
  - [ ] 1.5 — UPDATE `apps/payment-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` Story 4.2 — wire PaymentIntentInternalController
  - [ ] 1.6 — `apps/payment-svc/src/domain/exception/stripe-api-failure.exception.ts` NEW (PAYMENT-STRIPE-API-FAILURE-005 → 502)
  - [ ] 1.7 — Tests integration testcontainer Postgres + stripe-mock 6 scenarios AC4

- [ ] **Task 2 — gateway-api UPDATE Story 4.4 forwarder orchestrate sync calls + compensation flow** (AC: #5, #9) — coverage ≥ 85 %
  - [ ] 2.1 — UPDATE `apps/gateway-api/src/usecases/booking/book-listing.forwarder.ts` Story 4.4 — 2 sequential sync internal calls + compensation
  - [ ] 2.2 — UPDATE `apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts` Story 4.4 — add `proProfileId` + `totalAmountCents` to internal endpoint response
  - [ ] 2.3 — UPDATE `packages/contracts/src/dtos/booking/book-listing-request.dto.ts` Story 4.4 → add `BookListingResponse.paymentIntentClientSecret` field
  - [ ] 2.4 — `apps/booking-svc/src/domain/exception/booking-payment-coordination.exception.ts` NEW (BOOKING-PAYMENT-COORDINATION-001 → 502)
  - [ ] 2.5 — NEW booking-svc internal endpoint `POST /internal/bookings/<id>/cancel-on-coordination-failure` for compensation
  - [ ] 2.6 — Tests E2E gateway 8 scenarios AC5 + 3 AC9 (happy combined, conflict 409 short-circuit, payment Stripe down → compensation 502, envelope shape, latency < 1s p95)

- [ ] **Task 3 — `cancel-booking-on-payment-failure.usecase.ts` NEW booking-svc consumer + Booking aggregate UPDATE Story 4.1** (AC: #8, #13) — coverage ≥ 90 %
  - [ ] 3.1 — `apps/booking-svc/src/usecases/cancel-booking-on-payment-failure.usecase.ts` NEW (NATS consumer `payment.intent-failed.v1` on PAYMENT stream)
  - [ ] 3.2 — UPDATE `apps/booking-svc/src/domain/model/value-objects/cancellation-reason.vo.ts` Story 4.1 — add 'payment-failed' reasonCode + factory `fromPaymentFailed`
  - [ ] 3.3 — UPDATE `apps/booking-svc/src/domain/ports/booking-repository.port.ts` Story 4.1 — add `findByCorrelationId(correlationId)` method (or `findByPaymentIntent`)
  - [ ] 3.4 — UPDATE `apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts` Story 4.1 — implement new method using `idx_booking_correlation_id` Story 4.1 baseline ✅
  - [ ] 3.5 — UPDATE `apps/booking-svc/src/infrastructure/messaging/nats/payment-events.consumer.ts` (NEW if not exists Story 4.2 — Story 4.2 livré order-svc payment-events consumer, Story 4.5 ajoute booking-svc payment-events consumer subscribing same stream different durable name)
  - [ ] 3.6 — UPDATE `apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` Story 4.1 — wire new use case + consumer
  - [ ] 3.7 — Tests integration testcontainer Postgres + NATS + stripe-mock 5 scenarios AC8

- [ ] **Task 4 — Stripe.js + @stripe/react-stripe-js deps + env vars + Doppler config** (AC: #7)
  - [ ] 4.1 — `pnpm add -F @tukio/customer @stripe/stripe-js@latest @stripe/react-stripe-js@latest` (verify versions latest stable via `pnpm view`)
  - [ ] 4.2 — UPDATE `apps/customer/.env.example` + Doppler config — add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test key for dev + Doppler prod key)
  - [ ] 4.3 — UPDATE `apps/customer/next.config.ts` — verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` exposed to client bundle
  - [ ] 4.4 — `apps/customer/src/lib/stripe.ts` NEW — singleton `loadStripe(publishableKey)` module-scoped instance
  - [ ] 4.5 — Tests unit verify loadStripe called with correct key + tree-shaking validation (stripe-js NOT in /cart bundle via Bundle Analyzer)

- [ ] **Task 5 — Frontend `/fr/checkout` Server + Client Components** (AC: #1, #2) — coverage ≥ 90 %
  - [ ] 5.1 — `apps/customer/src/app/[locale]/checkout/page.tsx` Server Component
  - [ ] 5.2 — `apps/customer/src/features/cart-checkout/components/CheckoutPageClient.tsx` Client Component (orchestre cart + mutation + Elements provider)
  - [ ] 5.3 — `apps/customer/src/features/cart-checkout/components/CheckoutForm.tsx` Client Component (PaymentElement + stripe.confirmPayment)
  - [ ] 5.4 — `apps/customer/src/features/cart-checkout/components/CheckoutSkeleton.tsx` (Story 0.4 Skeleton pattern)
  - [ ] 5.5 — `apps/customer/src/features/cart-checkout/components/CheckoutErrorState.tsx` (error handler map Stripe + backend codes)
  - [ ] 5.6 — `apps/customer/src/features/cart-checkout/helpers/stripe-error-mapper.ts` (Stripe error.code → i18n key — pure function)
  - [ ] 5.7 — `apps/customer/src/features/cart-checkout/helpers/api-error-mapper.ts` (backend tukioCode → i18n key)
  - [ ] 5.8 — Tests Vitest + @testing-library/react + axe-core 6 scenarios AC2 + 5 scenarios AC1

- [ ] **Task 6 — Frontend `/fr/checkout/success` Server + Client Components** (AC: #3) — coverage ≥ 90 %
  - [ ] 6.1 — `apps/customer/src/app/[locale]/checkout/success/page.tsx` Server Component
  - [ ] 6.2 — `apps/customer/src/features/cart-checkout/components/ConfirmationPageClient.tsx` Client (consume useBookingDetail + clear cart on mount)
  - [ ] 6.3 — `apps/customer/src/features/cart-checkout/components/ConfirmationSkeleton.tsx`
  - [ ] 6.4 — `apps/customer/src/features/cart-checkout/components/PaymentFailedState.tsx` (failed redirect_status state)
  - [ ] 6.5 — `apps/customer/src/features/cart-checkout/components/ConfirmationErrorState.tsx` (booking fetch error fallback)
  - [ ] 6.6 — Tests Playwright + axe-core 5 scenarios AC3

- [ ] **Task 7 — `useCreateCheckoutSession` + `useBookingDetail` (baseline) hooks** (AC: #6) — coverage ≥ 85 %
  - [ ] 7.1 — `packages/api-client/src/hooks/booking/useCreateCheckoutSession.ts` NEW
  - [ ] 7.2 — `packages/api-client/src/hooks/booking/useBookingDetail.ts` NEW baseline (Story 4.11 finalise full + Story 4.5 livre minimal pour confirmation page)
  - [ ] 7.3 — UPDATE `packages/api-client/src/hooks/booking/index.ts` barrel export
  - [ ] 7.4 — Tests Vitest + msw 5 scenarios AC6 each hook (10 total)

- [ ] **Task 8 — i18n FR/EN namespaces `customer.checkout.*` + Stripe locale binding + i18n CI audit** (AC: #10)
  - [ ] 8.1 — `apps/customer/messages/fr.json` UPDATE — add namespace `customer.checkout.*` ~60 keys
  - [ ] 8.2 — `apps/customer/messages/en.json` UPDATE — add namespace `customer.checkout.*` ~60 keys
  - [ ] 8.3 — `pnpm i18n:audit` Story 0.9 CI gate pass

- [ ] **Task 9 — Cross-zone Vercel rewrites verify + middleware auth verify Story 1.4** (AC: #12)
  - [ ] 9.1 — VERIFY `apps/public/next.config.ts` Story 0.13 rewrites `/checkout/*` → customer.tukio.one ACTIVE (Story 4.3 verified)
  - [ ] 9.2 — VERIFY `apps/customer/src/middleware.ts` Story 1.4 — `/checkout` requires auth + redirect to login
  - [ ] 9.3 — Tests E2E Playwright cross-zone 2 scenarios AC12

- [ ] **Task 10 — Tests Playwright e2e 14 scenarios + Stripe test mode + Lighthouse CI + axe-core** (AC: #14) — coverage NFR71
  - [ ] 10.1 — `apps/customer/e2e/checkout/checkout.spec.ts` NEW — 14 scenarios (cf. story body section o)
  - [ ] 10.2 — Stripe test mode setup CI — `STRIPE_TEST_KEY` Doppler dev OR `stripe-mock` testcontainer for self-hosted tests
  - [ ] 10.3 — UPDATE `apps/customer/e2e/lighthouse.config.{ts,js}` Story 0.11 — add `/fr/checkout` + `/fr/checkout/success` budgets + Accessibility ≥ 90 + LCP < 1s + CLS < 0,1
  - [ ] 10.4 — axe-core 0 violations all components AC11

- [ ] **Task 11 — NFR1 PII redaction + security tests + bundle analyzer Stripe.js tree-shaking** (AC: #11) — coverage ≥ 95 %
  - [ ] 11.1 — Verify no `console.log(clientSecret)` patterns in codebase (ESLint custom rule OR manual review)
  - [ ] 11.2 — Verify Zustand store NOT persist clientSecret (only in React state)
  - [ ] 11.3 — Bundle analyzer (`@next/bundle-analyzer`) verify `@stripe/stripe-js` NOT in /cart bundle (tree-shaking) — only /checkout bundle
  - [ ] 11.4 — Tests security 6 scenarios AC11

- [ ] **Task 12 — Lint boundaries + EN strict + Stripe SDK latest stable verify + ADR-0015 NEW** (AC: #15, #16)
  - [ ] 12.1 — `pnpm lint && pnpm typecheck` 0 violations boundaries + strict mode
  - [ ] 12.2 — `pnpm view @stripe/stripe-js version && pnpm view @stripe/react-stripe-js version && pnpm view stripe version` — pin latest stable
  - [ ] 12.3 — UPDATE Story 4.2 Stripe backend SDK if newer than Story 4.2 baseline pin
  - [ ] 12.4 — NEW `docs/adr/0015-checkout-sync-coordination.md` ADR — document pragmatic sync coordination exception to ADR-006

- [ ] **Task 13 — Documentation runbooks + project-context + completion notes + commit** (AC: #16)
  - [ ] 13.1 — NEW `docs/runbook/stripe-elements-3ds-debug.md` (~40 lignes)
  - [ ] 13.2 — UPDATE `docs/runbook/stripe-payment-intent-debug.md` Story 4.2 — add Story 4.5 sync coordination
  - [ ] 13.3 — UPDATE `docs/adr/0006-saga-choreographed.md` — Implementation Notes Story 4.5 hybrid sync/async
  - [ ] 13.4 — UPDATE `docs/project-context.md` — section "Checkout Stripe Elements (Story 4.5)"
  - [ ] 13.5 — UPDATE `_bmad-output/implementation-artifacts/{4-2,4-3,4-4}-...md` Completion Notes — Story 4.5 handoffs
  - [ ] 13.6 — Commit `feat(customer,booking-svc,payment-svc,gateway-api,contracts,messaging,api-client): Story 4.5 Stripe Elements checkout frontend + sync coordination + idempotency cross-source + cancel-booking-on-payment-failure + compensation flow + Stripe test mode e2e 14 + RGAA AA axe-core + NFR3 LCP < 1s + tunnel Customer end-to-end MVP closed`

## Dev Notes

### Pourquoi Story 4.5 = closing customer end-to-end MVP tunnel + ADR-0015 pragmatic exception

Story 4.5 ferme le **tunnel Customer end-to-end MVP critique** (cart → checkout → 3DS payment → confirmation page → bookings list). Sans Story 4.5 :
- Story 4.4 endpoint `POST /v1/bookings/checkout-session` retourne `bookingId` mais pas `clientSecret` → frontend ne peut pas render Stripe Elements → tunnel cassé
- Story 4.2 PaymentIntent ne peut être créé que async via `booking.requested.v1` → trop tardif pour UX < 1s

**Décision pragmatique Story 4.5** : ajouter sync endpoint payment-svc + gateway-api orchestrates 2 internal calls. C'est une **exception documentée ADR-006 saga choreographed** — formalisée dans NEW ADR-0015. Justifications :
1. UX requirement `clientSecret` synchronous (Stripe Elements ne peut pas attendre async event)
2. Idempotency garantie côté payment-svc (UNIQUE constraint `booking_id` + idempotency key Stripe)
3. Saga events continuent async pour downstream (Order, audit, notification) — pas de régression saga R11
4. Pattern utilisé par toutes les marketplaces majeures (Stripe Connect doc reference)

**Story 4.5 = template "sync coordination cross-svc avec compensation flow + idempotency cross-source (sync HTTP + async NATS) + Stripe Elements PCI DSS + 3DS Secure + UX-DR figé bundle Cloud Design"** réutilisable :
- Story 9.x V1 Stripe Billing subscription : même pattern (subscription create sync + webhook events async)
- Story 12.x V1 quotes : même pattern (quote acceptance sync + saga events async)
- Story 14.x V2 mobile : même Stripe Elements pattern adapté React Native (`@stripe/stripe-react-native`)

### Décisions techniques majeures actées Story 4.5

1. **Sync endpoint payment-svc + gateway-api orchestrate (ADR-0015)** — pragmatic exception saga choreography. Documented + justified.

2. **Idempotency cross-source** : `findByBookingId` check au début de `create-payment-intent.usecase` Story 4.2 baseline garantit que sync endpoint + async NATS consumer ne créent qu'1 PaymentIntent côté Stripe. UNIQUE constraint `payment_intent.booking_id` Story 4.2 baseline + idempotency key Stripe `correlationId+'-create-pi'`.

3. **Compensation flow `BOOKING-PAYMENT-COORDINATION-001`** : si booking créé + payment échoue → booking soft-cancelled via internal endpoint. Story 4.13 saga watchdog metric alert. Manual ops intervention runbook documented.

4. **Stripe Elements `<PaymentElement>`** (vs deprecated `<CardElement>`) — supports tous moyens paiement automatiquement (carte + Apple Pay + Google Pay V1+ + SEPA V1+). PCI DSS + SCA Europe + 3DS automatique.

5. **`redirect: 'if_required'`** dans `stripe.confirmPayment` — 3DS redirect automatique si requis par banque, sinon stay-on-page + manual navigation. UX optimal.

6. **`return_url` to `/fr/checkout/success?bookingId=...`** — Stripe redirige après 3DS avec params `payment_intent`, `payment_intent_client_secret`, `redirect_status`. Confirmation page consume `redirect_status` pour rendering state.

7. **Stripe Elements locale binding `loadStripe({ locale })`** — Stripe natively translate UI Elements + 3DS + error messages. Tukio fournit wrapping (titres, CTAs, microcopy).

8. **Stripe.js singleton module-scoped** (vs in component body) — `loadStripe` returns Promise, must be called once + reused across mounts. Pattern Stripe officiel.

9. **Tukio appearance tokens** (`colorPrimary`, `colorBackground`, `fontFamily`) — design brief §B harmonized terracotta theme. CSS variables Tailwind v4 `@theme` Story 0.3 baseline.

10. **NFR1 PII redaction frontend strict** : NEVER `console.log(clientSecret)` + NEVER store clientSecret in storage. Stripe.js iframe isolation garantit Tukio NEVER touche PAN/CVV.

11. **Cart clear post-confirmation page mount** (vs pre-submit) — backend Story 4.4 already clears cart on success. Frontend Zustand store sync on confirmation page mount. Multi-tab handled via cookie cross-zone + LocalStorage Story 4.3 baseline.

12. **NEW `cancel-booking-on-payment-failure.usecase.ts` NATS consumer booking-svc** — async cleanup when Stripe webhook `payment_intent.payment_failed` fires. Booking soft-cancelled → downstream Order cancel Story 4.2 + Story 5.4 email "Paiement échoué" (Story 5.4 future).

13. **`findByCorrelationId` (vs `findByPaymentIntent`)** — simpler reverse-lookup using `correlationId` propagated through saga. `idx_booking_correlation_id` Story 4.1 baseline ✅. Avoids cross-svc denormalization.

14. **Period selector UI deferred Story 4.5 baseline** — cart Story 4.3 added with `period: null`. Story 4.5 frontend needs period before submit. **Decision MVP** : period inferred from cart line `period` field if set, OTHERWISE Story 4.5 frontend includes minimal period picker (date + duration) inline on `/fr/checkout` page (Calendar Story 0.5 atom pattern réutilisé OR shadcn/ui date-range-picker). Story 4.5 implements period picker inline checkout (not separate step) — V1+ may move to dedicated step.

15. **Multi-line cart NOT supported MVP** (Story 4.4 baseline enforcement) — Story 4.5 frontend uses `cart.lines[0]` for period selection + summary. Multi-line V1 Story 8.x.

16. **EN strict + Clean Architecture explicit + Envelope ADR-014 + latest stable versions + lint boundaries strict + i18n FR/EN + RGAA AA + PCI DSS + SCA Europe** memories — toutes respectées.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| **`@stripe/stripe-js`** | Stripe.js client-side | **latest stable v5+** | Vérifier `pnpm view @stripe/stripe-js version` — singleton via `loadStripe` |
| **`@stripe/react-stripe-js`** | React wrapper | **latest stable v3+** | Vérifier `pnpm view @stripe/react-stripe-js version` |
| **`stripe`** | Backend SDK Story 2.1/4.2 baseline | **latest stable** | Vérifier `pnpm view stripe version` ; Story 4.2 may already pinned ; Story 4.5 BUMP if newer |
| **`stripe-mock`** | Testcontainer Stripe API | latest (Stripe officiel) | Story 2.1 baseline |
| **`@stripe/stripe-mock-go`** | OR alternative test env | — | Optional |
| `@tanstack/react-query` | API hooks `useCreateCheckoutSession` | (Story 0.9 baseline) | v5 latest |
| `next-intl` | i18n FR/EN | (Story 0.9 baseline) | 4.x si stable |
| `next` | Next.js 15 App Router + Server Components | (Sprint 0 baseline) | force-dynamic checkout (private) + Server Component shell |
| `@tukio/ui` | Card, Button, EmptyState, Badge, Skeleton | (Stories 0.4/0.5 baseline) | Réutilisé |
| `@tukio/api-client` | TanStack Query hooks typés | (Story 0.9 baseline) | UPDATE — ajoute `hooks/booking/{useCreateCheckoutSession,useBookingDetail}` |
| `@tukio/contracts` | Zod DTOs payment + booking | (Story 0.2 baseline) | UPDATE — ajoute `dtos/payment/create-payment-intent-for-booking,payment-intent-created-response.dto.ts` |
| `@tukio/auth-client` | Server-side `requireAuth` helper | (Story 1.4 baseline) | Réutilisé |
| `@playwright/test` | E2E tests + Stripe test mode | (Story 0.9 baseline) | 14 scenarios checkout |
| `vitest` | Unit tests | (Story 0.9 baseline) | v3.x latest |
| `axe-core` + `@axe-core/playwright` | RGAA AA tests | (Story 0.9 baseline) | 0 violations checkout |
| `@next/bundle-analyzer` | Bundle tree-shaking Stripe.js verification | latest stable | Tasks 11.3 |

### Project Structure cible

```
# ====== NEW Story 4.5 frontend ======

apps/customer/src/
├─ app/[locale]/checkout/
│  ├─ page.tsx                                                                                          # NEW — Server Component shell + requireAuth + Suspense
│  └─ success/page.tsx                                                                                  # NEW — Server Component shell confirmation
├─ features/cart-checkout/
│  ├─ components/
│  │  ├─ CheckoutPageClient.tsx + spec                                                                  # NEW Client (Elements provider + mutation orchestrate)
│  │  ├─ CheckoutForm.tsx + spec                                                                        # NEW Client (PaymentElement + stripe.confirmPayment)
│  │  ├─ CheckoutSkeleton.tsx                                                                           # NEW (Story 0.4 Skeleton pattern)
│  │  ├─ CheckoutErrorState.tsx + spec                                                                  # NEW (error handler map)
│  │  ├─ ConfirmationPageClient.tsx + spec                                                              # NEW Client (consume useBookingDetail + clear cart)
│  │  ├─ ConfirmationSkeleton.tsx                                                                       # NEW
│  │  ├─ ConfirmationErrorState.tsx + spec                                                              # NEW
│  │  ├─ PaymentFailedState.tsx + spec                                                                  # NEW (failed redirect_status state)
│  │  └─ PeriodPicker.tsx + spec                                                                        # NEW MVP minimal date-range picker (V1+ dedicated step)
│  └─ helpers/
│     ├─ stripe-error-mapper.ts + spec                                                                  # NEW pure (Stripe error.code → i18n key)
│     ├─ api-error-mapper.ts + spec                                                                     # NEW pure (backend tukioCode → i18n key)
│     ├─ derive-period-from-cart.ts + spec                                                              # NEW helper
│     └─ format-period.ts + spec                                                                        # NEW i18n formatter
├─ lib/stripe.ts                                                                                        # NEW — loadStripe singleton module-scoped
└─ messages/{fr,en}.json                                                                                # UPDATE — namespace customer.checkout.* ~60 keys

# ====== NEW Story 4.5 backend (payment-svc EXTEND Story 4.2) ======

apps/payment-svc/src/
├─ infrastructure/http/controllers/payment-intent.controller.ts                                         # NEW (internal sync endpoint)
├─ usecases/create-payment-intent.usecase.ts                                                            # UPDATE Story 4.2 — add idempotency check findByBookingId
├─ domain/exception/stripe-api-failure.exception.ts                                                     # NEW (PAYMENT-STRIPE-API-FAILURE-005 → 502)
└─ infrastructure/usecases-proxy/usecases-proxy.module.ts                                                # UPDATE Story 4.2 — wire PaymentIntentInternalController

# ====== NEW Story 4.5 backend (booking-svc EXTEND Story 4.1) ======

apps/booking-svc/src/
├─ usecases/cancel-booking-on-payment-failure.usecase.ts + spec                                         # NEW (NATS consumer payment.intent-failed.v1)
├─ usecases/cancel-on-coordination-failure.usecase.ts + spec                                            # NEW (internal endpoint compensation)
├─ infrastructure/http/controllers/booking.controller.ts                                                # UPDATE Story 4.4 — add proProfileId + totalAmountCents to response + NEW endpoint POST /internal/bookings/<id>/cancel-on-coordination-failure
├─ infrastructure/messaging/nats/payment-events.consumer.ts                                             # NEW (booking-svc consumer payment.intent-failed.v1 — distinct durable name from Story 4.2 order-svc consumer)
├─ domain/model/value-objects/cancellation-reason.vo.ts                                                 # UPDATE Story 4.1 — add 'payment-failed' reasonCode + factory
├─ domain/ports/booking-repository.port.ts                                                              # UPDATE Story 4.1 — add findByCorrelationId(correlationId)
├─ infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts                        # UPDATE Story 4.1 — implement findByCorrelationId using idx_booking_correlation_id baseline
├─ domain/exception/booking-payment-coordination.exception.ts                                           # NEW (BOOKING-PAYMENT-COORDINATION-001 → 502)
└─ infrastructure/usecases-proxy/usecases-proxy.module.ts                                               # UPDATE Story 4.1 — wire new use case + consumer

# ====== NEW Story 4.5 backend (gateway-api UPDATE Story 4.4) ======

apps/gateway-api/src/
├─ usecases/booking/book-listing.forwarder.ts                                                           # UPDATE Story 4.4 — orchestrate 2 sync internal calls + compensation
└─ infrastructure/http/controllers/bookings.controller.ts                                               # UPDATE Story 4.4 — return paymentIntentClientSecret in response

# ====== UPDATE @tukio/contracts ======

packages/contracts/src/
├─ dtos/payment/
│  ├─ create-payment-intent-for-booking.dto.ts                                                          # NEW
│  ├─ payment-intent-created-response.dto.ts                                                            # NEW
│  └─ index.ts                                                                                          # UPDATE barrel export
├─ dtos/booking/
│  ├─ book-listing-request.dto.ts                                                                       # UPDATE Story 4.4 — add paymentIntentClientSecret to response DTO
│  ├─ book-listing-response.dto.ts                                                                      # NEW (extract from book-listing-request for clarity)
│  └─ index.ts                                                                                          # UPDATE

# ====== UPDATE @tukio/api-client ======

packages/api-client/src/hooks/booking/
├─ useCreateCheckoutSession.ts + spec                                                                   # NEW
├─ useBookingDetail.ts + spec                                                                           # NEW baseline (Story 4.11 finalise full)
└─ index.ts                                                                                             # UPDATE barrel export

# ====== UPDATE infra ======

apps/customer/.env.example                                                                              # UPDATE — add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
apps/customer/next.config.ts                                                                            # UPDATE — verify NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY exposed
apps/customer/e2e/checkout/checkout.spec.ts                                                             # NEW 14 tests Playwright
apps/customer/e2e/lighthouse.config.{ts,js}                                                             # UPDATE Story 0.11 — add /fr/checkout + /fr/checkout/success budgets

# ====== UPDATE docs ======

docs/adr/0015-checkout-sync-coordination.md                                                             # NEW ADR (pragmatic exception ADR-006)
docs/runbook/stripe-elements-3ds-debug.md                                                               # NEW ~40 lignes
docs/runbook/stripe-payment-intent-debug.md                                                             # UPDATE Story 4.2 — add Story 4.5 sync coordination
docs/adr/0006-saga-choreographed.md                                                                     # UPDATE Implementation Notes Story 4.5
docs/project-context.md                                                                                 # UPDATE — section "Checkout Stripe Elements (Story 4.5)"
_bmad-output/implementation-artifacts/4-2-...md                                                         # UPDATE Completion Notes
_bmad-output/implementation-artifacts/4-3-...md                                                         # UPDATE Completion Notes
_bmad-output/implementation-artifacts/4-4-...md                                                         # UPDATE Completion Notes

# Estimation : ~35 nouveaux + ~18 updates = ~53 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (contracts), 0.4 (Skeleton/Button/Card/Badge atomics), 0.5 (patterns EmptyState/Modal/Toast/PricingDisplay), 0.6 (Pretre + boundaries lint), 0.7 (@tukio/messaging InboxConsumer), 0.9 (TanStack Query + next-intl + axe-core baseline + i18n CI lint), 0.10 (docker-compose dev), 0.11 (CI Lighthouse + perf budgets + axe-core gate), 0.13 (Vercel multi-zones rewrites — `/checkout/*`), 1.2 (gateway KeycloakJwtGuard + envelope + throttle), 1.4 (login flow + middleware + auth callback), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact), 2.1 (payment-svc Pretre baseline + StripeConnectService + stripe-mock testcontainer + pino redact PaymentIntent paths Story 4.2 extended), 3.10 (listing detail public + ListingUnpublishedException 410), 4.1 (booking-svc Pretre + Booking aggregate + state machine + IAvailabilityLockPort + idx_booking_correlation_id index baseline — Story 4.5 EXTEND), 4.2 (payment-svc + create-payment-intent.usecase NATS consumer + StripePaymentGatewayService + idempotency keys + pino redact extended — Story 4.5 EXTEND sync endpoint + idempotency check), 4.3 (cart Zustand store @tukio/ui/stores cross-apps + ICartRepository — Story 4.5 CONSUME via Story 4.4), 4.4 (booking submission + 3-layer race conditions + POST /v1/bookings/checkout-session endpoint — Story 4.5 UPDATE return clientSecret). UX spec L246-256 (cart-checkout customer screens), L755-770 (Zustand state management), L811-832 (stack frontend latest stable @stripe/stripe-js), L1110-1148 (atomic design), L1474 (cart.checkout.deferredCapture microcopy). Architecture lines 419-422 (multi-zones rewrites), 756-789 (feature-based), 2120-2164 (Pretre canonical), 2341-2378 (saga booking-payment flow).

1. **API responses envelope ADR-014** — toutes responses gateway-api wrapped. Error codes ENV-PORTABLES `BOOKING-PAYMENT-COORDINATION-001` + `PAYMENT-STRIPE-API-FAILURE-005` (NEW Story 4.5).

2. **ADR-001 Clean Architecture strict** — payment-svc domain pure (no Stripe SDK in domain — Story 2.1 baseline). Stripe SDK calls in infrastructure/external/stripe Story 2.1 baseline. Lint boundaries enforced.

3. **ADR-006 saga choreographed + NEW ADR-0015 sync coordination exception** — pragmatic sync coordination for `clientSecret` UX requirement. Documented + justified.

4. **ADR-007 transactional outbox** — Story 4.5 booking-svc consumer `cancel-booking-on-payment-failure.usecase` uses outbox publish `booking.cancelled.v1` after Booking save.

5. **ADR-008 internal endpoint authentication** — Story 4.5 NEW payment-svc internal sync endpoint uses `InternalServiceTokenGuard` (X-Internal-Service-Token) Story 1.10 pattern.

6. **ADR-013 frontend multi-zones Vercel** — Story 0.13 baseline rewrites `/checkout/*` → customer.tukio.one verified Story 4.5.

7. **NFR1 RGPD + PCI DSS** — PII redaction frontend (NO clientSecret in console/storage) + Stripe.js iframe isolation (Tukio NEVER touches PAN/CVV) + backend pino redact paths Story 2.1/4.2 extended.

8. **NFR3 LCP < 1s checkout page** — Lighthouse CI Story 0.11 gate.

9. **NFR6 capture < 800 ms p95** — Story 4.2 capture-payment.usecase + Story 4.7 Pro accept (Story 4.5 NOT in capture path — auth only).

10. **NFR47-55 RGAA AA** — `<PaymentElement>` natively compliant + Tukio wrapping axe-core 0 violations + keyboard nav full + focus management.

11. **NFR71 coverage thresholds** — ≥ 95 % security tests + ≥ 90 % critical components + ≥ 85 % api-client hooks + ≥ 90 % use cases + ≥ 80 % infrastructure.

12. **EN strict + i18n FR/EN strict + latest stable versions + Clean Architecture + Envelope + Pretre boundaries** memories.

### Previous Story Intelligence

**Story 0.2 (contracts)** : Story 4.5 ajoute DTOs `dtos/payment/create-payment-intent-for-booking,payment-intent-created-response.dto.ts` + UPDATE `dtos/booking/book-listing-request.dto.ts` Story 4.4 baseline.

**Story 0.4 (atomics Skeleton/Button/Card/Badge)** : Story 4.5 réutilise directement. `<Skeleton>` pour loading states + `<Button>` form submit + `<Card>` summary + `<Badge>` status.

**Story 0.5 (patterns EmptyState/Modal/Toast/PricingDisplay)** : Story 4.5 réutilise `<EmptyState variant="cart-empty">` empty + `<Toast>` errors.

**Story 0.6 (Pretre + boundaries lint)** : Story 4.5 EXTEND payment-svc + booking-svc — boundaries lint enforcement réutilisé.

**Story 0.7 (@tukio/messaging InboxConsumer)** : Story 4.5 `cancel-booking-on-payment-failure.usecase` uses `InboxConsumer<PaymentIntentFailedEvent>` wrapper Story 0.7.

**Story 0.9 (TanStack Query + next-intl + axe-core + i18n CI lint)** : Story 4.5 réutilise infrastructure complète.

**Story 0.10 (docker-compose dev)** : Story 4.5 add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` Doppler config — no docker-compose change.

**Story 0.11 (CI Lighthouse + perf budgets)** : Story 4.5 add `/fr/checkout` + `/fr/checkout/success` budgets + Accessibility ≥ 90 + LCP < 1s.

**Story 0.13 (Vercel multi-zones)** : Story 4.5 verify `/checkout/*` rewrites cross-zone (Story 4.3 verified — Story 4.5 re-verify).

**Story 1.2 (gateway KeycloakJwtGuard + envelope + throttle)** : Story 4.5 UPDATE Story 4.4 `bookings.controller` + forwarder — auth required + throttle réutilisé.

**Story 1.4 (login flow + middleware + auth callback)** : Story 4.5 `requireAuth` helper réutilisé + middleware `/checkout` auth required.

**Story 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact)** : Story 4.5 NEW payment-svc internal sync endpoint uses Story 1.10 pattern.

**Story 2.1 (payment-svc Pretre baseline + StripeConnectService + stripe-mock testcontainer + pino redact paths)** : Story 4.5 EXTEND payment-svc — réutilise stripe-mock + pino redact + `apps/payment-svc/.env.example` Story 2.1 baseline.

**Story 3.10 (listing detail + ListingUnpublishedException 410)** : Story 4.5 frontend handles 410 redirect to `/services/<slug>` with Story 3.10 unavailable error page.

**Story 4.1 (booking-svc Pretre + Booking aggregate + state machine + IAvailabilityLockPort + idx_booking_correlation_id baseline)** : Story 4.5 EXTEND :
- UPDATE `cancellation-reason.vo.ts` Story 4.1 — add 'payment-failed' reasonCode + factory
- UPDATE `booking-repository.port.ts` Story 4.1 — add `findByCorrelationId` method
- UPDATE `booking.typeorm.repository.ts` Story 4.1 — implement `findByCorrelationId` using `idx_booking_correlation_id` baseline ✅
- ADD NEW use case `cancel-booking-on-payment-failure.usecase.ts` + `cancel-on-coordination-failure.usecase.ts`
- ADD NEW exception `booking-payment-coordination.exception.ts`

**Story 4.2 (order-svc + payment-svc Pretre saga consumers + create-payment-intent.usecase async NATS consumer + StripePaymentGatewayService + idempotency keys + stripe_events_inbox + pino redact extended)** : Story 4.5 EXTEND :
- UPDATE `create-payment-intent.usecase.ts` Story 4.2 — add idempotency check `findByBookingId` at start
- ADD NEW sync endpoint `POST /internal/payment-intents/create-for-booking` invoking same use case
- ADD NEW exception `stripe-api-failure.exception.ts` (PAYMENT-STRIPE-API-FAILURE-005 → 502)

**Story 4.3 (cart Zustand store @tukio/ui/stores cross-apps + ICartRepository)** : Story 4.5 CONSUME :
- Frontend reads cart from Zustand store
- Cart cleared post-confirmation page mount (backend Story 4.4 already cleared)
- Multi-line MVP rejected by Story 4.4 backend (mono-vendor Story 4.3 invariant)

**Story 4.4 (booking submission + 3-layer race conditions + POST /v1/bookings/checkout-session endpoint)** : Story 4.5 UPDATE :
- UPDATE forwarder to orchestrate 2 sync calls (booking-svc + payment-svc)
- UPDATE booking-svc internal endpoint response to include `proProfileId` + `totalAmountCents`
- UPDATE response DTO to include `paymentIntentClientSecret`
- Compensation flow on payment failure post-booking

### What this story does NOT do (out of scope)

- ❌ **Stripe capture trigger at Pro accept** → Story 4.7 (Story 4.5 livre auth only `requires_capture` — capture is Story 4.7 Pro action)
- ❌ **Pro pending requests page UI** → Story 4.6
- ❌ **Customer cancellation flow + refund policy** → Story 4.8
- ❌ **Invoice generation TVA mandat 289 CGI** → Story 4.9
- ❌ **Auto-payout cron J+1** → Story 4.10
- ❌ **Customer/Pro bookings list/detail UI** → Story 4.11 (Story 4.5 livre baseline `useBookingDetail` hook for confirmation page — Story 4.11 finalise full)
- ❌ **Admin refund + reconciliation** → Story 4.12
- ❌ **Saga monitoring R11 full Grafana saga-health + PagerDuty** → Story 4.13 (Story 4.5 livre baseline metric `tukio_booking_payment_coordination_failures_total` + Slack alert basic)
- ❌ **Saved payment methods** → Story 9.x V1 (FR50)
- ❌ **30/70 échéancier** → Story 9.x V1 (FR51)
- ❌ **Customer invoices UI download** → Story 4.11 / 8.x V1 (FR52)
- ❌ **Apple Pay / Google Pay wallets** → V1+ (Story 4.5 wallets `auto` in PaymentElement options but MVP no specific integration — V1 finalise)
- ❌ **SEPA Direct Debit / Bancontact / Sofort** → V1+ (Story 4.5 `<PaymentElement>` auto-supports if Stripe account enabled — MVP focuses on cards FR market)
- ❌ **Multi-vendor parallel saga V1** → Story 8.x V1 (Story 4.5 mono-vendor MVP — Story 4.3 cart invariant enforced)
- ❌ **Period selector dedicated step page** → V1+ enhancement (Story 4.5 inline period picker on checkout page MVP)
- ❌ **Frontend Stripe Identity / KYC** → already done Story 2.x Pro onboarding (Customer no KYC MVP)

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 4.5` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :

1. **`apps/payment-svc/src/usecases/create-payment-intent.usecase.ts`** Story 4.2 livré — **CRITICAL : lire l'état Story 4.2 complet pour préserver injection ports + Stripe gateway call + outbox publish + correlationId propagation + idempotency key Stripe**. Story 4.5 ajoute UNIQUEMENT idempotency check `findByBookingId` au début de `execute()` + `source` discriminator param.

2. **`apps/payment-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`** Story 4.2 livré — **CRITICAL : préserver 6 use cases wired Story 4.2 + ports**. Story 4.5 ajoute UNIQUEMENT `PaymentIntentInternalController` provider.

3. **`apps/gateway-api/src/usecases/booking/book-listing.forwarder.ts`** Story 4.4 livré — **CRITICAL : préserver Story 4.4 forwarder logic + correlationId propagation + error mapping 3-layer conflicts**. Story 4.5 ajoute 2ᵉ sync call payment-svc + combine response + compensation flow.

4. **`apps/gateway-api/src/infrastructure/http/controllers/bookings.controller.ts`** Story 4.4 livré — **CRITICAL : préserver auth + throttle + Zod**. Story 4.5 modifie UNIQUEMENT response type to include `paymentIntentClientSecret`.

5. **`apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts`** Story 4.4 livré — **CRITICAL : préserver internal endpoint cart + booking creation + envelope**. Story 4.5 ajoute response fields `proProfileId` + `totalAmountCents` (already in Booking aggregate) + NEW endpoint `POST /internal/bookings/<id>/cancel-on-coordination-failure`.

6. **`packages/contracts/src/dtos/booking/book-listing-request.dto.ts`** Story 4.4 livré — UPDATE response DTO `BookListingResponse` add `paymentIntentClientSecret: string` field.

7. **`apps/booking-svc/src/domain/model/value-objects/cancellation-reason.vo.ts`** Story 4.1 livré — **CRITICAL : préserver Story 4.1 reasonCode enum + factory + actor types**. Story 4.5 ADD 'payment-failed' reasonCode + factory `fromPaymentFailed`.

8. **`apps/booking-svc/src/domain/ports/booking-repository.port.ts`** Story 4.1 livré — **CRITICAL : préserver 6 méthodes Story 4.1 + Story 4.3 add cart methods Story 4.4 add findStuckSagas**. Story 4.5 ADD `findByCorrelationId(correlationId): Promise<Booking | null>`.

9. **`apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts`** Story 4.1 livré (UPDATE Story 4.4 + Story 4.5) — **CRITICAL : préserver transactional outbox drain + optimistic lock + GIST error mapping Story 4.4**. Story 4.5 ADD `findByCorrelationId` impl using `idx_booking_correlation_id` Story 4.1 baseline ✅.

10. **`apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`** Story 4.1/4.3/4.4 livré — UPDATE wire NEW use cases (`cancel-booking-on-payment-failure`, `cancel-on-coordination-failure`).

11. **`apps/customer/messages/{fr,en}.json`** Story 4.3 livré — UPDATE add `customer.checkout.*` namespace ~60 keys × 2.

12. **`apps/customer/next.config.ts`** + `.env.example` — UPDATE add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env.

13. **`apps/customer/e2e/lighthouse.config.{ts,js}`** Story 0.11/4.3 livré — UPDATE add `/fr/checkout` + `/fr/checkout/success` budgets.

14. **`docs/adr/0006-saga-choreographed.md`** — UPDATE Implementation Notes Story 4.5 hybrid sync/async.

15. **`docs/runbook/stripe-payment-intent-debug.md`** Story 4.2 livré — UPDATE add Story 4.5 sync coordination + compensation.

16. **`docs/project-context.md`** Story 1.10 baseline — UPDATE add "Checkout Stripe Elements (Story 4.5)" section.

17. **`_bmad-output/implementation-artifacts/{4-2,4-3,4-4}-...md`** — UPDATE Completion Notes Story 4.5 handoffs.

**Lire l'état complet de chaque UPDATE file avant édition** — particularly :
- `create-payment-intent.usecase.ts` Story 4.2 (preserve Stripe API call + idempotency key + outbox + correlationId)
- `book-listing.forwarder.ts` Story 4.4 (preserve forwarder logic + error mapping)
- `booking.typeorm.repository.ts` Story 4.1+4.4 (preserve transactional outbox + optimistic lock + GIST)

### Testing Standards

- **Coverage ≥ 95 %** security tests (PII redaction)
- **Coverage ≥ 90 %** critical components (CheckoutPageClient, CheckoutForm, ConfirmationPageClient, PaymentFailedState)
- **Coverage ≥ 90 %** use cases (cancel-booking-on-payment-failure, cancel-on-coordination-failure)
- **Coverage ≥ 90 %** payment-intent.controller (sync endpoint) + create-payment-intent.usecase idempotency UPDATE
- **Coverage ≥ 85 %** api-client hooks (useCreateCheckoutSession, useBookingDetail baseline)
- **Coverage ≥ 85 %** gateway forwarder UPDATE Story 4.4 (orchestration + compensation)
- **Coverage ≥ 80 %** infrastructure (booking-svc payment-events.consumer + booking.controller cancel-on-coordination-failure endpoint)
- **Tests Vitest unit + integration + axe-core RGAA AA + Playwright e2e Stripe test mode**
- **Stripe test cards** : `4242 4242 4242 4242` (happy), `4000 0027 6000 3184` (3DS), `4000 0000 0000 0002` (declined), `4000 0000 0000 9995` (insufficient funds)
- **Lighthouse CI** : `/fr/checkout` + `/fr/checkout/success` Accessibility ≥ 90 + LCP < 1s + CLS < 0,1 + FID < 100ms (NFR3)
- **Lint boundaries strict 0 violations** payment-svc/domain + booking-svc/domain + apps/customer/features
- **EN strict + i18n CI audit** `pnpm i18n:audit` Story 0.9 pass
- **NFR71 coverage thresholds enforced CI Story 0.11**

### Project Structure Notes

✅ **Aligné** UX spec L246-256 (cart-checkout customer screens including `cart checkout` screens/checkout.jsx figé + confirmation.jsx figé), L755-770 (Zustand state Story 4.3 baseline réutilisé), L811-832 (stack frontend Stripe.js + react-stripe-js latest), L1110-1148 (atomic design + feature-based), L1474 (cart.checkout.deferredCapture microcopy FR + EN) ; Architecture lines 419-422 (multi-zones rewrites checkout), 756-789 (feature-based), 2120-2164 (Pretre canonical), 2341-2378 (saga booking-payment flow étape 6 customer paye via Stripe Elements + step 7 Pro accept + step 8 capture) ; PRD §FR49 (Stripe Elements + capture différée — Story 4.5 livre frontend backend déjà Story 4.2), §NFR3 (< 1s p95 checkout), §NFR6 (capture < 800 ms — Story 4.5 NOT in capture path), §NFR1 (PII redaction + PCI DSS + SCA Europe), §NFR47-55 (RGAA AA), §NFR58 (hreflang systematic), §NFR71 (coverage thresholds) ; Stories 0.2/0.4/0.5/0.6/0.7/0.9/0.10/0.11/0.13/1.2/1.4/1.10/2.1/3.10/4.1/4.2/4.3/4.4 ; memories Tukio (feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions).

⚠️ **Déviations** :
- **NEW ADR-0015** sync coordination — documented exception to ADR-006 saga choreography (pragmatic UX requirement for `clientSecret` synchronous return). Justified.
- Period picker inline checkout (MVP) vs dedicated step (V1+) — documented decision.

⚠️ **Décisions clés Story 4.5** :
- Sync coordination via NEW payment-svc endpoint + gateway-api orchestrate (ADR-0015)
- Idempotency cross-source (sync HTTP + async NATS) via `findByBookingId` check
- Compensation flow on payment failure post-booking (BOOKING-PAYMENT-COORDINATION-001)
- Stripe Elements `<PaymentElement>` (vs deprecated `<CardElement>`) + locale binding + appearance tokens
- `redirect: 'if_required'` (UX optimal — stay-on-page low-risk)
- return_url `/fr/checkout/success` UX-DR confirmation figé
- NEW NATS consumer `cancel-booking-on-payment-failure.usecase`
- NEW `findByCorrelationId` repo method (vs cross-svc denormalization)
- PII redaction strict (no clientSecret in logs/storage)
- Cart clear post-confirmation mount (Story 4.4 backend + Story 4.5 frontend)
- Stripe.js singleton module-scoped
- Period picker inline MVP (V1+ dedicated step)
- Multi-line cart NOT supported MVP (Story 4.4 enforces — Story 8.x V1)

### References

- [Source: epics.md#Epic-4-Story-4.5 — Lines 1662-1678]
- [Source: prd.md#FR49 (Stripe Elements + capture différée), #NFR1 (RGPD + PCI DSS + SCA Europe), #NFR3 (< 1s p95 checkout), #NFR6 (capture < 800 ms — Story 4.5 NOT in capture path), #NFR47-55 (RGAA AA), #NFR58 (hreflang), #NFR71 (coverage)]
- [Source: architecture.md — ADR-001 Clean Architecture, ADR-003 DB per service, ADR-006 saga choreographed (+ NEW ADR-0015 sync coordination exception Story 4.5), ADR-007 transactional outbox, ADR-008 internal endpoint authentication, ADR-013 multi-zones Vercel, ADR-014 envelope, Pretre canonical lines 2120-2164, saga booking-payment flow lines 2341-2378, multi-zones rewrites lines 419-422, feature-based lines 756-789]
- [Source: ux-design-specification.md — L246-256 (cart-checkout customer screens), L755-770 (Zustand state Story 4.3 baseline), L811-832 (stack frontend Stripe.js + react-stripe-js latest), L1110-1148 (atomic design + feature-based), L1474 (cart.checkout.deferredCapture microcopy FR + EN)]
- [Source: Stories 0.2/0.4/0.5/0.6/0.7/0.9/0.10/0.11/0.13/1.2/1.4/1.10/2.1/3.10/4.1/4.2/4.3/4.4]
- [External: https://stripe.com/docs/payments/payment-element — Stripe PaymentElement docs]
- [External: https://stripe.com/docs/payments/payment-intents — Stripe PaymentIntent docs]
- [External: https://stripe.com/docs/payments/3d-secure — 3D Secure flow]
- [External: https://stripe.com/docs/payments/save-during-payment — capture_method='manual' docs (Story 4.2 baseline)]
- [External: https://stripe.com/docs/testing — Stripe test cards reference]
- [External: https://github.com/stripe/stripe-js — @stripe/stripe-js GitHub]
- [External: https://github.com/stripe/react-stripe-js — @stripe/react-stripe-js GitHub]
- [External: https://stripe.com/docs/strong-customer-authentication — SCA Europe regulatory context]
- [External: https://pages.nist.gov/800-63-3/sp800-63b.html — PCI DSS guidelines (Tukio NEVER touches PAN/CVV via Stripe.js iframe isolation)]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir par dev-story)

### Debug Log References

### Completion Notes List

(points d'attention pour :
- **Story 4.6 (pro pending requests page UI)** : independent from Story 4.5 ; consumes `list-pro-bookings.usecase` Story 4.1 livré
- **Story 4.7 (pro accept/refuse + Stripe capture)** : Pro accept triggers `booking.confirmed.v1` → Story 4.2 `capture-payment.usecase` capture Stripe → NFR6 < 800 ms p95 capture latency. Story 4.5 NOT in capture path (auth only `requires_capture`).
- **Story 4.8 (customer cancellation flow + refund policy)** : Story 4.5 doesn't touch cancellation post-acceptance. Story 4.8 finalise.
- **Story 4.9 (invoice TVA art. 289 CGI)** : Story 4.5 doesn't touch invoicing — Story 4.2 baseline `generate-invoices.usecase` skeleton + Story 4.9 full impl.
- **Story 4.10 (auto-payout cron J+1)** : Story 4.5 doesn't touch payouts — Story 4.10 finalise full.
- **Story 4.11 (customer + pro bookings list/detail UI)** : Story 4.5 livre baseline `useBookingDetail` hook for confirmation page — Story 4.11 finalise full hooks + UI bookings list/detail pages.
- **Story 4.12 (admin refund + reconciliation)** : Story 4.5 doesn't touch admin — Story 4.12 finalise.
- **Story 4.13 (saga monitoring R11 alerts + Grafana saga-health full)** : Story 4.5 baseline metric `tukio_booking_payment_coordination_failures_total` + Slack alert. Story 4.13 finalise full dashboard + PagerDuty + Tempo traces.
- **Story 5.4 (notification-svc — consume booking + payment events → email templates Resend)** : Story 5.4 will consume `booking.confirmed.v1` (from Story 4.7) + `booking.cancelled.v1` (from Story 4.5/4.7/4.8) + `payment.intent-captured.v1` (Story 4.2) → email templates "Réservation confirmée" / "Paiement échoué" / etc.
- **Story 8.x V1 (B2B + multi-vendor parallel saga)** : Story 4.5 mono-vendor pattern reusable — multi-vendor needs separate checkout flow with N-PaymentIntents parallel.
- **Story 9.x V1 (Stripe Billing subscription + saved cards FR50 + 30/70 échéancier FR51)** : Story 4.5 pattern reusable (sync coordination + idempotency + saga events).
- **Story 14.x V2 (mobile native React Native)** : Story 4.5 pattern adaptable via `@stripe/stripe-react-native` (replaces `@stripe/stripe-js`). Apple Pay + Google Pay native V2.)

### File List

(à remplir par dev-story)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-15
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 4 — Booking, Cart & Payment Saga (MVP) — **closing customer end-to-end MVP tunnel + Stripe Elements PCI DSS + SCA Europe**
- **Sprint cible** : Sprint 5 (5ᵉ story Epic 4 — closes tunnel Customer end-to-end MVP cart → checkout → payment → confirmation — Stories 4.6/4.7/4.8/4.10/4.11/4.12/4.13 livrables in parallel après Story 4.5)
- **Estimation effort** : **7-9 jours** (1 dev fullstack senior + Stripe expertise — payment-svc EXTEND sync endpoint + idempotency check + Stripe API failure exception + gateway-api forwarder UPDATE Story 4.4 orchestrate + compensation flow + booking-svc EXTEND cancel-on-payment-failure consumer + cancel-on-coordination-failure + findByCorrelationId + CancellationReason 'payment-failed' + 2 new exceptions + frontend Server + Client Components checkout + confirmation pages + period picker inline + Stripe Elements + appearance Tukio tokens + locale binding + i18n FR/EN ~60 keys × 2 + cross-zone Vercel verify + middleware auth verify + Stripe.js + react-stripe-js latest stable deps + Doppler env + NEW ADR-0015 + 2 runbooks + UPDATE 3 stories completion notes + 14 Playwright e2e scenarios Stripe test mode + Lighthouse CI gates + axe-core RGAA + bundle analyzer tree-shaking + ~53 fichiers)
- **Dépendances upstream** :
  - Stories 0.2 (contracts), 0.4 (atomics Skeleton/Button/Card/Badge), 0.5 (patterns EmptyState/Modal/Toast/PricingDisplay), 0.6 (Pretre + boundaries lint), 0.7 (@tukio/messaging InboxConsumer), 0.9 (TanStack Query + next-intl + axe-core + i18n CI lint), 0.10 (docker-compose dev), 0.11 (CI Lighthouse + perf budgets + axe-core gate), 0.13 (Vercel multi-zones rewrites — `/checkout/*`)
  - Stories 1.2 (gateway KeycloakJwtGuard + envelope + throttle), 1.4 (login flow + middleware + auth callback + requireAuth helper), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact)
  - Stories 2.1 (payment-svc Pretre baseline + StripeConnectService + stripe-mock testcontainer + pino redact PaymentIntent paths Story 4.2 extended), 3.10 (listing detail + ListingUnpublishedException 410 — Story 4.5 frontend handles)
  - **Story 4.1 (booking-svc Pretre + Booking aggregate + state machine + IAvailabilityLockPort + idx_booking_correlation_id baseline — Story 4.5 EXTEND with cancel-on-payment-failure + findByCorrelationId)**
  - **Story 4.2 (payment-svc + create-payment-intent.usecase async NATS consumer + StripePaymentGatewayService + idempotency keys + stripe_events_inbox + pino redact extended — Story 4.5 EXTEND sync endpoint + idempotency check)**
  - **Story 4.3 (cart Zustand store @tukio/ui/stores cross-apps + ICartRepository — Story 4.5 CONSUME via Story 4.4)**
  - **Story 4.4 (booking submission + 3-layer race conditions + POST /v1/bookings/checkout-session endpoint — Story 4.5 UPDATE return clientSecret + compensation flow + orchestration)**
- **Dépendances downstream** (Epic 4 + cross-Epic) :
  - Story 4.6 (pro pending requests page — independent)
  - Story 4.7 (pro accept/refuse + Stripe capture — NFR6 capture < 800 ms — Story 4.5 NOT in capture path)
  - Story 4.8 (customer cancellation flow + refund policy)
  - Story 4.9 (invoice TVA art. 289 CGI)
  - Story 4.10 (auto-payout cron J+1)
  - Story 4.11 (customer + pro bookings list/detail UI — Story 4.5 livre baseline useBookingDetail hook)
  - Story 4.12 (admin refund + reconciliation)
  - Story 4.13 (saga monitoring R11 alerts — Story 4.5 baseline metric + Slack alert basic)
  - Story 5.4 (notification-svc — consume booking + payment events → email templates Resend)
  - Stories Epic 8 V1 (B2B + multi-vendor — pattern reusable)
  - Stories Epic 9 V1 (Stripe Billing subscription FR50 + 30/70 échéancier FR51 — pattern reusable)
  - Stories Epic 14 V2 (mobile native React Native — adaptable via @stripe/stripe-react-native)
- **FRs covered** :
  - **FR49** ✅ Customer paie par CB via Stripe Elements + autorisation différée (capture_method='manual') + 3D Secure SCA Europe
  - **FR47 partial** ✅ Booking lifecycle creation `pending_pro_acceptance` + transition to `cancelled` on payment_failed
- **NFRs touchés** :
  - **NFR1** ✅ RGPD + PCI DSS PII redaction strict frontend + Stripe.js iframe isolation + SCA Europe 3DS
  - **NFR3** ✅ Checkout page LCP < 1s p75 + combined backend p95 < 1s (Lighthouse CI + Prometheus histogram)
  - **NFR6** N/A (Story 4.5 NOT in capture path — Story 4.7 finalise capture NFR6)
  - **NFR42** ✅ Outbox publish `booking.cancelled.v1` from cancel-on-payment-failure consumer
  - **NFR43 baseline** ✅ Metric `tukio_booking_payment_coordination_failures_total` + Slack alert basic (Story 4.13 finalise full)
  - **NFR47-55** ✅ RGAA AA + axe-core 0 violations + Stripe Elements native compliant + Tukio wrapping aria-labels
  - **NFR58** ✅ hreflang systematic (Story 0.13 baseline)
  - **NFR71** ✅ Coverage thresholds enforced (≥ 95 % security + ≥ 90 % components/usecases + ≥ 85 % gateway/hooks + ≥ 80 % infra)
  - **NFR82** ✅ Audit `booking.cancelled.v1` (reason 'payment-failed') consumed Story 2.7 audit_log automatically

> **Prochaine story → Story 4.6** (Pro pending requests page UI — independent backend Stories 4.1/4.2 livré, consume `list-pro-bookings.usecase` Story 4.1 + 48h countdown + masquage PII anti-désintermédiation). Story 4.7 (pro accept/refuse + Stripe capture) closes the booking lifecycle backend MVP. Stories 4.8/4.10/4.11/4.12/4.13 livrables in parallel après Story 4.5/4.6/4.7.

---

**Dev agent next steps :**
1. Lire ce file complètement (~ 950 lignes)
2. Vérifier upstream Stories 0.2/0.4/0.5/0.6/0.7/0.9/0.10/0.11/0.13/1.2/1.4/1.10/2.1/3.10/4.1/4.2/4.3/4.4 implémentées (`sprint-status.yaml` — Stories 4.1 + 4.2 + 4.3 + 4.4 doivent être `done` AVANT Story 4.5 dev)
3. **Lire l'état complet de chaque UPDATE file Story 4.2/4.4 avant édition** — particularly :
   - `create-payment-intent.usecase.ts` Story 4.2 (preserve Stripe API call + idempotency key + outbox)
   - `book-listing.forwarder.ts` Story 4.4 (preserve forwarder logic + error mapping)
   - `booking.typeorm.repository.ts` Story 4.1/4.4 (preserve transactional outbox + optimistic lock + GIST)
4. **Vérifier `pnpm view @stripe/stripe-js version && pnpm view @stripe/react-stripe-js version && pnpm view stripe version`** latest stable juste avant impl (memory `feedback_latest_versions`)
5. Implémenter Tasks 1-13 dans l'ordre :
   - **Tasks 1-3 backend payment-svc EXTEND + gateway-api UPDATE + booking-svc EXTEND** (Phase 1, ~2 jours)
   - **Task 4 Stripe.js deps + Doppler env** (Phase 2, ~0.5 jour)
   - **Tasks 5-6 frontend checkout + confirmation pages + components** (Phase 3, ~2 jours)
   - **Task 7 api-client hooks** (Phase 4, ~0.5 jour)
   - **Tasks 8-9 i18n + cross-zone verify** (Phase 5, ~0.5 jour)
   - **Tasks 10-11 e2e + Lighthouse + axe-core + bundle analyzer + security** (Phase 6, ~1.5 jours)
   - **Tasks 12-13 lint + ADR-0015 NEW + docs runbooks + commit** (Phase 7, ~0.5 jour)
6. Lancer `pnpm lint && pnpm typecheck && pnpm test --coverage` + Stripe test mode e2e après chaque jalon
7. Commit Story 4.5 quand :
   - 0 violations boundaries lint payment-svc/domain + booking-svc/domain + apps/customer/features/cart-checkout
   - Coverage NFR71 thresholds (≥ 95 % security + ≥ 90 % components/usecases + ≥ 85 % gateway/hooks + ≥ 80 % infra)
   - 14 Playwright e2e scenarios pass + Stripe test cards + axe-core 0 violations + Lighthouse `/fr/checkout` Accessibility ≥ 90 + LCP < 1s + CLS < 0,1
   - Bundle analyzer verify `@stripe/stripe-js` NOT in /cart bundle (tree-shaking OK)
   - NEW ADR-0015 documented + reviewed
   - Handoff Stories 4.6-4.13 + 5.4 + 8.x V1 + 9.x V1 + 14.x V2 documented project-context + completion notes Stories 4.2 + 4.3 + 4.4 updated
   - PR ouvert vers `develop` (jamais main per git workflow Tukio memory)
