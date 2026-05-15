# Story 4.6: Pro pending requests page + 48h cron auto-expire + anti-désintermédiation PII masking baseline (FR42, FR45 partial, NFR48, NFR82)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As a** Pro authentifié Tukio (rôle `pro`),
**I want** **voir la liste paginée de mes demandes booking en attente** (`status=pending_pro_acceptance`) sur `/seller/bookings/pending` avec **countdown badge "Expire dans 23h12m"** (deadline 48h SLA NFR48) + **PII Customer masquée** (Marie L., ville approximative) anti-désintermédiation FR45 baseline + **page detail** `/seller/bookings/<id>` avec mêmes infos masquées + **2 CTAs Accepter/Refuser placeholder** (Story 4.7 finalise full transition + Stripe capture) + **EmptyState `seller-no-bookings`** si aucune demande (UX-DR16) + **cron backend `auto-expire-booking.task.ts`** finalise Story 4.1 skeleton → full impl 5min toutes-5min + downstream `booking.refused.v1` (reason `__system_auto_expired__`) consumed par payment-svc Story 4.2 cancel-payment (libère autorisation Stripe) + notification-svc Story 5.4 future email Customer "Désolé, Pro n'a pas répondu" + **reminder cron NFR48** "5 demandes attendent votre réponse" si Pro > 5 pending > 24h (baseline event `pro.reminder-pending-bookings.v1` — Story 5.4 finalise consumer Resend email),
**So that** le Pro a une **vision claire de son délai d'action 48h SLA** (NFR48), respecte l'anti-désintermédiation marketplace FR45 (PII Customer cachée jusqu'à acceptation Story 4.7), et la plateforme garantit la conversion booking via auto-expire (vs bookings éternellement bloqués).

Story 4.6 livre :

- (a) **Frontend `/seller/bookings/pending` page** (`apps/seller/src/app/[locale]/seller/bookings/pending/page.tsx`) — Server Component shell + Client Component liste paginée tri `expiresAt asc` + countdown live :
```tsx
// apps/seller/src/app/[locale]/seller/bookings/pending/page.tsx
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { PendingBookingsListClient } from '@/features/seller/bookings/components/PendingBookingsListClient';
import { PendingBookingsSkeleton } from '@/features/seller/bookings/components/PendingBookingsSkeleton';
import { requireAuth } from '@tukio/auth-client/server';

export default async function PendingBookingsPage({ params }: { params: Promise<{ locale: 'fr' | 'en' }> }) {
  const { locale } = await params;
  await requireAuth({ requiredRole: 'pro' });                                                          // redirects /auth/login if not authenticated + redirects /403 if wrong role
  const t = await getTranslations({ locale, namespace: 'seller.bookings.pending' });
  return (
    <main aria-labelledby="pending-heading" className="container mx-auto px-4 py-6 max-w-5xl">
      <header className="mb-6">
        <h1 id="pending-heading" className="font-display text-3xl text-charcoal-900">{t('title')}</h1>
        <p className="text-charcoal-500 mt-1">{t('subtitle')}</p>
      </header>
      <Suspense fallback={<PendingBookingsSkeleton />}>
        <PendingBookingsListClient />
      </Suspense>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: 'fr' | 'en' }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller.bookings.pending.metadata' });
  return { title: t('pageTitle'), robots: { index: false, follow: false } };                           // private page
}
```

- (b) **`<PendingBookingsListClient>` Client Component** (`apps/seller/src/features/seller/bookings/components/PendingBookingsListClient.tsx`) — TanStack Query `useListProBookings({ status: ['pending_pro_acceptance'], sort: 'expires_at_asc', cursor })` + infinite scroll OR paginate buttons :
```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@tukio/ui/components/Button';
import { EmptyState } from '@tukio/ui/patterns/EmptyState';
import { useListProBookings } from '@tukio/api-client/hooks/booking';
import { PendingBookingCard } from './PendingBookingCard';
import { PendingBookingsSkeleton } from './PendingBookingsSkeleton';
import { Link } from '@/i18n/navigation';

export function PendingBookingsListClient() {
  const t = useTranslations('seller.bookings.pending');
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useListProBookings.infinite({
    status: ['pending_pro_acceptance'],
    sort: 'expires_at_asc',
    pageSize: 20,
  });

  if (isLoading) return <PendingBookingsSkeleton />;
  if (error) return <PendingBookingsErrorState error={error} />;

  const bookings = data?.pages.flatMap((p) => p.items) ?? [];

  if (bookings.length === 0) {
    return (
      <EmptyState
        variant="seller-no-bookings"                                                                   // UX-DR16 Story 0.5 baseline
        title={t('empty.title')}
        description={t('empty.description')}
        cta={{ label: t('empty.cta'), href: '/seller/services' }}                                      // CTA "Optimiser votre fiche service"
      />
    );
  }

  return (
    <section aria-label={t('listLabel')} className="space-y-3">
      <ul className="space-y-3" role="list">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <Link href={`/seller/bookings/${booking.id}`} className="block focus:outline-none focus-visible:ring-2 ring-terracotta-500 rounded-lg">
              <PendingBookingCard booking={booking} />
            </Link>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="ghost" size="lg" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
```

- (c) **`<PendingBookingCard>` feature component** (`apps/seller/src/features/seller/bookings/components/PendingBookingCard.tsx`) — Card avec PII masquée + countdown :
```tsx
'use client';
import { Card } from '@tukio/ui/components/Card';
import { Badge } from '@tukio/ui/components/Badge';
import { Avatar } from '@tukio/ui/components/Avatar';
import { CountdownBadge } from './CountdownBadge';
import { useTranslations, useLocale } from 'next-intl';
import { formatPeriod } from '@/features/seller/bookings/helpers/format-period';
import { formatCurrency } from '@tukio/i18n-client/formatters';

export function PendingBookingCard({ booking }: { booking: PendingBookingResponse }) {
  const t = useTranslations('seller.bookings.pending.card');
  const locale = useLocale();
  // booking.customer.maskedDisplayName = 'Marie L.' (PII masking middleware backend Story 4.6 — full PII Story 4.7 post-accept)
  // booking.customer.approximatePostalArea = '44000 - Nantes' (city only, no full address)

  return (
    <Card className="p-4 flex gap-4 hover:bg-charcoal-50 transition-colors">
      <Avatar size="md" initials={booking.customer.maskedDisplayName.charAt(0)} aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-charcoal-900 truncate">{booking.listingTitle}</h3>
            <p className="text-sm text-charcoal-500">
              {booking.customer.maskedDisplayName} · {booking.customer.approximatePostalArea}
            </p>
          </div>
          <CountdownBadge expiresAt={booking.expiresAt} t={t} />
        </div>
        <div className="text-sm text-charcoal-700 space-y-1">
          <p><strong>{t('periodLabel')}:</strong> {formatPeriod(booking.period, locale)}</p>
          <p><strong>{t('quantityLabel')}:</strong> {booking.quantity}</p>
          {booking.options.length > 0 && (
            <p><strong>{t('optionsLabel')}:</strong> {booking.options.map((o) => o.label).join(', ')}</p>
          )}
          <p className="font-medium text-charcoal-900">
            {t('totalLabel')}: {formatCurrency(booking.totalAmountCents, 'EUR', locale)} <span className="text-charcoal-500">{t('totalNetPro', { netCents: booking.totalAmountCents - booking.commissionCents })}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
```

- (d) **`<CountdownBadge>` component** (`apps/seller/src/features/seller/bookings/components/CountdownBadge.tsx`) — recompute live every 60s :
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@tukio/ui/components/Badge';
import { Clock, AlertTriangle } from 'lucide-react';
import type { useTranslations } from 'next-intl';

export function CountdownBadge({ expiresAt, t }: { expiresAt: string; t: ReturnType<typeof useTranslations> }) {
  const [remaining, setRemaining] = useState(() => computeRemainingMs(expiresAt));

  useEffect(() => {
    if (remaining <= 0) return;                                                                         // expired — no need to tick
    const interval = setInterval(() => setRemaining(computeRemainingMs(expiresAt)), 60_000);            // tick every 60s (vs 1s — battery + perf efficient)
    return () => clearInterval(interval);
  }, [expiresAt, remaining]);

  if (remaining <= 0) {
    return <Badge variant="error" icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}>{t('expired')}</Badge>;
  }

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const variant = hours < 6 ? 'error' : hours < 24 ? 'warning' : 'info';
  const label = hours >= 1
    ? t('expiresInHoursMinutes', { hours, minutes })                                                    // "Expire dans 23h12m"
    : t('expiresInMinutes', { minutes });                                                               // "Expire dans 42 min"
  return (
    <Badge variant={variant} icon={<Clock className="h-4 w-4" aria-hidden="true" />} aria-label={t('countdownAria', { label })}>
      {label}
    </Badge>
  );
}

function computeRemainingMs(expiresAt: string): number {
  return new Date(expiresAt).getTime() - Date.now();
}
```

- (e) **Frontend `/seller/bookings/<id>` detail page** (`apps/seller/src/app/[locale]/seller/bookings/[id]/page.tsx`) — placeholder MVP Story 4.6 + Story 4.7 finalise Accept/Refuse actions :
```tsx
// apps/seller/src/app/[locale]/seller/bookings/[id]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BookingDetailClient } from '@/features/seller/bookings/components/BookingDetailClient';
import { BookingDetailSkeleton } from '@/features/seller/bookings/components/BookingDetailSkeleton';
import { requireAuth } from '@tukio/auth-client/server';

export default async function BookingDetailPage({ params }: { params: Promise<{ locale: 'fr' | 'en'; id: string }> }) {
  const { locale, id } = await params;
  await requireAuth({ requiredRole: 'pro' });
  // booking-svc internal endpoint validates Pro ownership via JWT actor.userProfileId
  return (
    <main aria-labelledby="detail-heading" className="container mx-auto px-4 py-6 max-w-3xl">
      <Suspense fallback={<BookingDetailSkeleton />}>
        <BookingDetailClient bookingId={id} />
      </Suspense>
    </main>
  );
}
```

- (f) **`<BookingDetailClient>` Client Component** — useBookingDetail + render masked PII + 2 CTAs placeholder + chat toggle Story 5.x V1 placeholder :
```tsx
'use client';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@tukio/ui/components/Card';
import { Button } from '@tukio/ui/components/Button';
import { Badge } from '@tukio/ui/components/Badge';
import { useBookingDetail } from '@tukio/api-client/hooks/booking';
import { CountdownBadge } from './CountdownBadge';

export function BookingDetailClient({ bookingId }: { bookingId: string }) {
  const t = useTranslations('seller.bookings.detail');
  const locale = useLocale();
  const { data: booking, isLoading, error } = useBookingDetail(bookingId);

  if (isLoading) return <BookingDetailSkeleton />;
  if (error) return <BookingDetailErrorState error={error} />;
  if (!booking) return null;

  return (
    <article className="space-y-6">
      <header>
        <h1 id="detail-heading" className="font-display text-2xl text-charcoal-900">{booking.listingTitle}</h1>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant={statusVariant(booking.status)}>{t(`statuses.${booking.status}`)}</Badge>
          {booking.status === 'pending_pro_acceptance' && <CountdownBadge expiresAt={booking.expiresAt} t={t} />}
        </div>
      </header>
      <Card className="p-6 space-y-4">
        <section aria-label={t('customerSectionLabel')}>
          <h2 className="font-medium text-charcoal-900 mb-2">{t('customerHeading')}</h2>
          {booking.status === 'pending_pro_acceptance' ? (
            <>
              <p className="text-charcoal-700">{booking.customer.maskedDisplayName} · {booking.customer.approximatePostalArea}</p>
              <p className="text-xs text-charcoal-500 mt-1 italic">{t('piiMaskedNoticePending')}</p>
              {/* Anti-désintermédiation FR45 baseline — full PII Story 4.7 post-accept */}
            </>
          ) : (
            <>
              <p className="text-charcoal-700">{booking.customer.fullName} · {booking.customer.email} · {booking.customer.phone}</p>
              <p className="text-xs text-charcoal-500 mt-1 italic">{t('piiRevealedNoticeConfirmed')}</p>
            </>
          )}
        </section>
        <section aria-label={t('bookingSectionLabel')} className="border-t border-charcoal-200 pt-4">
          <h2 className="font-medium text-charcoal-900 mb-2">{t('bookingHeading')}</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-charcoal-500">{t('periodLabel')}</dt><dd className="text-charcoal-900">{formatPeriod(booking.period, locale)}</dd></div>
            <div className="flex justify-between"><dt className="text-charcoal-500">{t('quantityLabel')}</dt><dd className="text-charcoal-900">{booking.quantity}</dd></div>
            {booking.options.length > 0 && (
              <div className="flex justify-between"><dt className="text-charcoal-500">{t('optionsLabel')}</dt><dd className="text-charcoal-900">{booking.options.map((o) => o.label).join(', ')}</dd></div>
            )}
            <div className="flex justify-between font-medium pt-2"><dt className="text-charcoal-900">{t('totalLabel')}</dt><dd className="text-charcoal-900">{formatCurrency(booking.totalAmountCents, 'EUR', locale)}</dd></div>
            <div className="flex justify-between text-charcoal-500 text-xs"><dt>{t('commissionLabel')}</dt><dd>{formatCurrency(booking.commissionCents, 'EUR', locale)}</dd></div>
            <div className="flex justify-between text-charcoal-700 text-xs"><dt>{t('netProLabel')}</dt><dd>{formatCurrency(booking.totalAmountCents - booking.commissionCents, 'EUR', locale)}</dd></div>
          </dl>
        </section>
      </Card>
      {booking.status === 'pending_pro_acceptance' && (
        <div className="flex flex-col sm:flex-row gap-3" role="group" aria-label={t('actionsLabel')}>
          {/* Story 4.7 finalises full Accept + Refuse + Stripe capture trigger. Story 4.6 baseline placeholder CTAs */}
          <Button variant="primary" size="lg" className="flex-1" disabled aria-describedby="actions-deferred-notice">
            {t('acceptCta')}
          </Button>
          <Button variant="ghost" size="lg" className="flex-1" disabled aria-describedby="actions-deferred-notice">
            {t('refuseCta')}
          </Button>
        </div>
      )}
      <p id="actions-deferred-notice" className="text-xs text-charcoal-500 text-center italic">{t('actionsDeferredStory4_7')}</p>
      {/* Story 5.x V1 chat toggle placeholder */}
      <Button variant="ghost" size="sm" disabled aria-describedby="chat-deferred-notice">{t('chatCta')}</Button>
      <p id="chat-deferred-notice" className="text-xs text-charcoal-500 italic">{t('chatDeferredEpic5')}</p>
    </article>
  );
}
```

- (g) **Backend `auto-expire-booking.usecase.ts` FULL impl** (`apps/booking-svc/src/usecases/auto-expire-booking.usecase.ts`) — Story 4.1 livré skeleton, Story 4.6 finalise :
```ts
@Injectable()
export class AutoExpireBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookingRepo: IBookingRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    private readonly logger: Logger,
    private readonly meter: Meter,                                                                      // Prometheus
  ) {}

  async execute(): Promise<{ expiredCount: number; errorCount: number }> {
    const BATCH_SIZE = 100;
    const now = new Date();
    let expiredCount = 0;
    let errorCount = 0;

    // Iterate until no more expiring bookings — handle backlog if cron was down
    while (true) {
      const expiringBookings = await this.bookingRepo.findPendingExpiringBefore(now, BATCH_SIZE);       // Story 4.1 baseline + uses idx_booking_pending_expires_at partial index ✅
      if (expiringBookings.length === 0) break;

      for (const booking of expiringBookings) {
        try {
          booking.autoExpire();                                                                          // Story 4.1 aggregate method baseline — transitions to refused + appends BookingRefusedEvent reason '__system_auto_expired__'
          await this.bookingRepo.save(booking);                                                          // transactional outbox drain Story 4.1 baseline — booking.refused.v1 published
          expiredCount++;
          this.logger.info('Booking auto-expired', { bookingId: booking.id.value, correlationId: booking.correlationId });
          this.meter.bookingAutoExpiredCounter.inc({ outcome: 'success' });
        } catch (err) {
          errorCount++;
          this.logger.error('Failed to auto-expire booking', { bookingId: booking.id.value, error: err });
          this.meter.bookingAutoExpiredCounter.inc({ outcome: 'error' });
          // Continue — don't fail entire batch on single booking error
        }
      }

      if (expiringBookings.length < BATCH_SIZE) break;                                                   // last batch
    }

    return { expiredCount, errorCount };
  }
}
```

- (h) **Backend cron task `auto-expire-booking.task.ts`** (`apps/booking-svc/src/infrastructure/scheduling/auto-expire-booking.task.ts` NEW) — `@Cron('*/5 * * * *')` toutes 5 minutes :
```ts
@Injectable()
export class AutoExpireBookingTask {
  constructor(@Inject(USE_CASES_PROXY) private readonly proxy: UseCasesProxy, private readonly logger: Logger) {}

  @Cron('*/5 * * * *', { name: 'auto-expire-bookings', timeZone: 'Europe/Paris' })
  async run(): Promise<void> {
    const start = Date.now();
    const usecase = this.proxy.getAutoExpireBooking().getInstance();
    try {
      const { expiredCount, errorCount } = await usecase.execute();
      const durationMs = Date.now() - start;
      this.logger.info('Auto-expire cron tick complete', { expiredCount, errorCount, durationMs });
      if (errorCount > 0) {
        // Slack alert if errors > 0 — Story 4.13 will finalise full saga monitoring
      }
    } catch (err) {
      this.logger.error('Auto-expire cron tick failed', { error: err });
      // No throw — cron framework handles retries on next tick
    }
  }
}
```

- (i) **Backend PII masking interceptor** (`apps/booking-svc/src/infrastructure/http/interceptors/booking-pii-mask.interceptor.ts` NEW) — anti-désintermédiation FR45 baseline. Story 4.6 livre baseline (mask Customer PII when booking.status === 'pending_pro_acceptance' AND actor.role === 'pro'). Story 4.7 finalise full reveal post-accept :
```ts
@Injectable()
export class BookingPiiMaskInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const actor: Actor = request.actor;                                                                  // from KeycloakJwtGuard Story 1.2
    return next.handle().pipe(
      map((response) => this.applyMask(response, actor)),
    );
  }

  private applyMask(response: unknown, actor: Actor): unknown {
    if (!isBookingResponse(response)) return response;
    const booking = response.data ?? response;
    // Anti-désintermédiation rules :
    // 1. Pro viewing pending_pro_acceptance booking → MASK Customer PII (full name → initials, email/phone → null, address → approximate postal area only)
    // 2. Pro viewing confirmed/completed/cancelled booking → full PII revealed (post-accept Story 4.7)
    // 3. Customer viewing own booking → always full PII (own data)
    // 4. Admin viewing any → full PII (audit)
    if (actor.role === 'pro' && booking.status === 'pending_pro_acceptance') {
      booking.customer = {
        ...booking.customer,
        fullName: undefined,                                                                              // remove full name
        email: undefined,
        phone: undefined,
        address: undefined,
        maskedDisplayName: this.toMaskedName(booking.customer.fullName),                                  // 'Marie L.' from 'Marie Lefèvre'
        approximatePostalArea: this.toApproximatePostalArea(booking.customer.address),                    // '44000 - Nantes' from full address
      };
    }
    return response;
  }

  private toMaskedName(fullName?: string): string {
    if (!fullName) return '';
    const [firstName, ...lastParts] = fullName.split(' ');
    const lastInitial = lastParts.join(' ').charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}.`;                                                                // "Marie L."
  }

  private toApproximatePostalArea(address?: { postalCode?: string; city?: string }): string {
    if (!address?.postalCode && !address?.city) return '';
    const postalCodeArea = address?.postalCode ? `${address.postalCode.slice(0, 2)}000` : '';             // round to département (e.g., 44320 → 44000)
    return `${postalCodeArea}${address?.city ? ` - ${address.city}` : ''}`;
  }
}
```
- **Wire interceptor** in `booking.controller.ts` Story 4.4 baseline + new internal-pro-bookings endpoint Story 4.6 :
```ts
@UseInterceptors(BookingPiiMaskInterceptor)
@Get('pro/list')                                                                                          // internal endpoint — gateway-api forwarder calls
async listProBookings(@Query() query: ListProBookingsQuery, @ActorContext() actor: Actor) { ... }
```

- (j) **Backend cron reminder `> 5 pending > 24h`** (`apps/booking-svc/src/infrastructure/scheduling/pending-bookings-reminder.task.ts` NEW) — NFR48 baseline :
```ts
@Injectable()
export class PendingBookingsReminderTask {
  @Cron('0 10 * * *', { name: 'pending-bookings-reminder', timeZone: 'Europe/Paris' })                   // Daily at 10:00 Europe/Paris (business hours)
  async run(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 3600_000);
    const proStats = await this.bookingRepo.findProsWithStaleManyPendingBookings({ olderThan: oneDayAgo, minCount: 5 });
    for (const { proProfileId, pendingCount, oldestPendingAt } of proStats) {
      await this.eventPublisher.publish(new ProReminderPendingBookingsEvent({
        proProfileId, pendingCount, oldestPendingAt, raisedAt: new Date(),
      }));
    }
  }
}
```
- **UPDATE `IBookingRepository`** Story 4.1 — add method `findProsWithStaleManyPendingBookings({ olderThan, minCount })` (uses `idx_booking_pro_pending_expires` Story 4.1 partial index — efficient query)
- **NEW event** `packages/contracts/src/events/pro/reminder-pending-bookings.v1.{schema.json,ts}` — Story 5.4 future consumer notification-svc Resend email "5 demandes attendent votre réponse"

- (k) **gateway-api endpoint `GET /v1/seller/bookings/pending`** + forwarder → booking-svc internal `GET /internal/bookings/pro/list?status=pending_pro_acceptance&sort=expires_at_asc&cursor=...` :
  - **Controller** `apps/gateway-api/src/infrastructure/http/controllers/seller-bookings.controller.ts` NEW
  - **Auth + Role** : `@UseGuards(KeycloakJwtGuard)` + `@Roles('pro')` + `@Throttle({ default: { limit: 60, ttl: 60_000 } })` (60/min/Pro)
  - **Zod query** `ListProBookingsQuerySchema` (status array, sort, cursor, pageSize)
  - **Forwarder** `apps/gateway-api/src/usecases/seller/list-pro-bookings.forwarder.ts` NEW — calls booking-svc internal with `proProfileId` derived from JWT actor + `X-Internal-Service-Token` Story 1.10 pattern
  - **DTO** `packages/contracts/src/dtos/booking/{list-pro-bookings-query,pending-booking-response,booking-detail-pro-response}.dto.ts` NEW Zod
  - **PII masked response shape** — `customer.maskedDisplayName + approximatePostalArea` (NOT fullName/email/phone) for `pending_pro_acceptance` status
  - **Cursor pagination** Story 2.3 baseline réutilisé (`(updated_at DESC, id DESC)` keyset)

- (l) **TanStack Query hook `useListProBookings`** + `useBookingDetail` UPDATE Story 4.5 baseline (`packages/api-client/src/hooks/booking/`) :
  - **`useListProBookings.ts`** NEW — supports `infinite` variant (cursor pagination) + base `useQuery` variant
  - **`useBookingDetail.ts`** UPDATE Story 4.5 baseline — verify works for both Customer + Pro views (different masked PII per actor)
  - **Coverage ≥ 85 %**

- (m) **i18n FR/EN namespaces `seller.bookings.*`** :
  - `apps/seller/messages/{fr,en}.json` — namespaces `seller.bookings.pending.*` + `seller.bookings.detail.*` + `seller.bookings.card.*` ~45 keys × 2 langues
  - **Microcopy proactive Tukio** (UX spec L774-789) : "Pas de demandes pour le moment. Restez actif pour augmenter votre visibilité" + "Expire dans 23h12m" + microcopy anti-désintermédiation "Pour protéger les deux parties, les coordonnées du client sont révélées après acceptation de la demande" + reminder "Vous avez {count} demandes en attente depuis plus de 24h"
  - **i18n CI lint Story 0.9** `pnpm i18n:audit` pass

- (n) **NEW event schema `pro.reminder-pending-bookings.v1`** (`packages/contracts/src/events/pro/reminder-pending-bookings.v1.{schema.json,ts}`) :
```ts
export interface ProReminderPendingBookingsEventV1 {
  eventId: string; eventType: 'pro.reminder-pending-bookings.v1'; eventVersion: 'v1'; occurredAt: string;
  correlationId: string;
  actor: { userId: 'system'; role: 'system'; locale: 'fr' };
  aggregate: { type: 'pro-profile'; id: string };
  payload: { proProfileId: string; pendingCount: number; oldestPendingAt: string; raisedAt: string };
}
```
- NEW NATS stream `PRO` (NEW Story 4.6) OR add to existing `BOOKING` stream subject `pro.reminder-pending-bookings.v1` — **décision Story 4.6** : reuse `BOOKING` stream (event semantically related to bookings)

- (o) **NFR48 reminder Prometheus metric** : `tukio_pro_reminder_pending_bookings_total{}` counter — incremented per cron tick par event published. Story 5.4 finalise Slack alert "Many Pros with stale bookings — engagement issue".

- (p) **Tests Playwright e2e 8 scenarios** (`apps/seller/e2e/bookings/pending.spec.ts` NEW) :
  - T1 happy : Pro authenticated → /seller/bookings/pending → 3 pending bookings rendered + countdown badges + sort by expires_at_asc
  - T2 empty state : 0 pending → `<EmptyState variant="seller-no-bookings">` UX-DR16 + CTA optimise listing
  - T3 click on card → navigate to /seller/bookings/<id> → detail page render with masked PII + 2 disabled CTAs Story 4.7 placeholder
  - T4 PII masked on pending : "Marie L." + "44000 - Nantes" + NO email/phone/full address
  - T5 countdown live update : wait 60s → badge text updates (from "23h12m" → "23h11m") OR mock setInterval
  - T6 unauthenticated → redirect /auth/login?redirectTo=/seller/bookings/pending
  - T7 wrong role (customer) → 403 page
  - T8 RGAA AA kbd nav full + axe-core 0 violations + Lighthouse Accessibility ≥ 90

- (q) **Tests integration backend** : auto-expire cron + reminder cron + interceptor + repository new methods :
  - `apps/booking-svc/test/integration/auto-expire-booking.integration-spec.ts` — testcontainer Postgres seed 100 bookings (50 expired, 50 not) → cron tick → assert 50 auto-expired + 50 unchanged + outbox `booking.refused.v1` × 50
  - `apps/booking-svc/test/integration/pending-bookings-reminder.integration-spec.ts` — seed Pros with various pending counts/ages → cron tick → assert events emitted only for `> 5 pending > 24h`
  - `apps/booking-svc/test/integration/booking-pii-mask.interceptor.integration-spec.ts` — verify masking applied per actor.role + booking.status combinations (4 scenarios)
  - `apps/booking-svc/test/integration/list-pro-bookings.integration-spec.ts` — cursor pagination + sort expires_at_asc + filter by status array

## Acceptance Criteria

1. **AC1 — Frontend `/seller/bookings/pending` page Server + Client Components + auth pro role + EmptyState seller-no-bookings** : Given Story 0.5 baseline `<EmptyState variant="seller-no-bookings">` (UX spec L1243) + Story 1.4 baseline `requireAuth`, When je navigue vers `customer.tukio.one/fr/seller/bookings/pending` (or apps/seller domain seller.tukio.one), Then :
   - **Server Component shell** `apps/seller/src/app/[locale]/seller/bookings/pending/page.tsx` — `requireAuth({ requiredRole: 'pro' })` redirect /auth/login if unauthenticated + 403 if wrong role
   - **`<Suspense>` fallback `<PendingBookingsSkeleton>`** (Story 0.4 Skeleton pattern)
   - **`<PendingBookingsListClient>` Client Component** — `useListProBookings.infinite({ status: ['pending_pro_acceptance'], sort: 'expires_at_asc', pageSize: 20 })`
   - **`<EmptyState variant="seller-no-bookings">`** Story 0.5 baseline réutilisé si 0 résultats (UX-DR16) — title + description + CTA "Optimiser ma fiche" → `/seller/services`
   - **Cursor pagination** "Charger plus" button OR scroll-based (Story 2.3 baseline) — `useListProBookings.infinite` returns `fetchNextPage`, `hasNextPage`
   - **Generate metadata** `robots: { index: false, follow: false }` (private)
   - **Tests Vitest + Playwright** 4 scenarios AC1 (happy 3 bookings, empty state, unauthenticated redirect, wrong role 403)

2. **AC2 — `<PendingBookingCard>` feature component + PII masking display + countdown badge** : Given AC1, When je consulte `apps/seller/src/features/seller/bookings/components/PendingBookingCard.tsx`, Then :
   - **Avatar default initials** from `booking.customer.maskedDisplayName.charAt(0)` (Story 0.4 Avatar atom)
   - **Display** : `<h3>` listingTitle + `<p>` "Marie L. · 44000 - Nantes" (maskedDisplayName + approximatePostalArea — NEVER fullName/email/phone)
   - **Period + quantity + options** display formatted via `formatPeriod` + i18n
   - **Total amount + commission breakdown** : `totalAmountCents` + `commissionCents` deduction → netProCents shown
   - **`<CountdownBadge>`** mounted with `expiresAt` prop — variant changes by remaining time (info > 24h, warning < 24h, error < 6h, error "Expired" if ≤ 0)
   - **Hover effect** Card transition-colors charcoal-50
   - **Tests** + axe-core 5 scenarios AC2

3. **AC3 — `<CountdownBadge>` live update every 60s + variant transitions** : Given AC2, When CountdownBadge mounted, Then :
   - **`useState + useEffect + setInterval(60_000ms)`** — recompute remaining every 60s (NOT every 1s — battery + perf efficient + countdown precision 1min sufficient for 48h SLA)
   - **Variant transitions** : `info` (> 24h), `warning` (6-24h), `error` (< 6h OR expired)
   - **Display formats** : `"Expire dans 23h12m"` (hours + minutes), `"Expire dans 42 min"` (< 1h), `"Expiré"` (≤ 0)
   - **`aria-label`** `t('countdownAria', { label })` for screen readers
   - **Cleanup** `clearInterval` on unmount (no memory leak)
   - **Tests Vitest + fakeTimers** 6 scenarios AC3 (initial render variants, tick 60s → label update, expire mid-mount, no-tick once expired, cleanup on unmount, RTL: aria-label correct)

4. **AC4 — Frontend `/seller/bookings/<id>` detail page Server + Client + PII masked rendering + 2 placeholder CTAs Story 4.7** : Given AC1 + Story 4.5 livré `useBookingDetail` baseline, When je clique sur card → `/seller/bookings/<id>`, Then :
   - **Server Component shell** `apps/seller/src/app/[locale]/seller/bookings/[id]/page.tsx` — `requireAuth({ requiredRole: 'pro' })`
   - **`<BookingDetailClient>` consume `useBookingDetail(bookingId)`** Story 4.5 baseline
   - **Conditional PII rendering** : if `booking.status === 'pending_pro_acceptance'` → masked (maskedDisplayName + approximatePostalArea) + notice "Pour protéger les deux parties..." ; else → full PII + post-accept notice
   - **Status badge** Story 0.4 `<Badge>` with variant per status
   - **CountdownBadge** if pending
   - **Booking details `<dl>`** : period, quantity, options, total + commission breakdown + netPro
   - **2 CTAs Story 4.7 placeholder** : `<Button variant="primary" disabled>` "Accepter" + `<Button variant="ghost" disabled>` "Refuser" with `aria-describedby` notice "Story 4.7 livre full Accept/Refuse + Stripe capture"
   - **Chat toggle Story 5.x placeholder** : disabled button with notice "Epic 5 chat"
   - **Tests Vitest + Playwright** 6 scenarios AC4 (happy pending masked PII, happy confirmed full PII, status badge each variant, CTAs disabled, chat placeholder, axe-core 0 violations)

5. **AC5 — Backend `auto-expire-booking.usecase.ts` FULL impl** : Given Story 4.1 livré skeleton + `IBookingRepository.findPendingExpiringBefore` baseline, When Story 4.6 finalise, Then :
   - **UPDATE `apps/booking-svc/src/usecases/auto-expire-booking.usecase.ts`** Story 4.1 — full impl (cf. story body section g) : batch iteration BATCH_SIZE=100 + `booking.autoExpire()` Story 4.1 method + `repository.save()` transactional outbox drain + Prometheus metric `tukio_booking_auto_expired_total{outcome}` + error isolation per-booking (continue on individual failure)
   - **Returns `{ expiredCount, errorCount }`** for cron observability
   - **Tests unit + integration** 8 scenarios AC5 (happy 50 expired, mixed expired + not, empty result no-op, error mid-batch continues, > BATCH_SIZE iteration, outbox event published per booking, repository save failure isolated, metric instrumented)

6. **AC6 — Backend `auto-expire-booking.task.ts` cron @Cron('*/5 * * * *')** : Given AC5 + Story 1.9 baseline `@nestjs/schedule`, When Story 4.6 ajoute task, Then :
   - **NEW `apps/booking-svc/src/infrastructure/scheduling/auto-expire-booking.task.ts`** — `@Cron('*/5 * * * *', { name: 'auto-expire-bookings', timeZone: 'Europe/Paris' })` toutes 5 minutes
   - **Invokes `AutoExpireBookingUseCase.execute()`** via UseCaseProxy Story 0.6 pattern
   - **Logging structured pino** : tick start + duration + counts
   - **Slack alert IF `errorCount > 0`** baseline — Story 4.13 finalise full saga monitoring
   - **`ScheduleModule.forRoot()`** wired in `app.module.ts` (Story 1.9 baseline pattern réutilisé)
   - **UPDATE `apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`** — wire `AutoExpireBookingUseCase` provider
   - **Tests integration** : cron tick triggers via `@nestjs/schedule` test helper + assert use case invoked + log produced

7. **AC7 — Backend PII masking interceptor `BookingPiiMaskInterceptor` anti-désintermédiation FR45 baseline** : Given Story 1.2 baseline `KeycloakJwtGuard` + Actor context + Story 4.1 Booking aggregate, When Story 4.6 ajoute interceptor, Then :
   - **NEW `apps/booking-svc/src/infrastructure/http/interceptors/booking-pii-mask.interceptor.ts`** — implements `NestInterceptor` (cf. story body section i)
   - **4 mask rules** :
     - Pro + `pending_pro_acceptance` → mask (maskedDisplayName + approximatePostalArea, NO fullName/email/phone/address)
     - Pro + other status → full PII (post-accept reveal Story 4.7)
     - Customer + own booking → full PII (own data — verify ownership via `booking.customerProfileId === actor.userProfileId`)
     - Admin + any → full PII (audit access)
   - **`toMaskedName` helper** : "Marie Lefèvre" → "Marie L." (first name + last initial)
   - **`toApproximatePostalArea` helper** : "44320 Saint-Sébastien" → "44000 - Nantes" (department-level postal code + city)
   - **Wire interceptor** in `booking.controller.ts` Story 4.4 + NEW pro-bookings endpoint
   - **PII never logged** (Story 1.10 pino redact baseline + Story 4.6 extends if needed)
   - **Tests integration testcontainer Postgres** 8 scenarios AC7 (each combination + edge cases : missing customer.address, non-French postal code, anonymous user 401, etc.)
   - **Note: Story 4.7 finalises FULL anti-désintermédiation Reveal** post-accept + audit `booking.pii-revealed.v1` event. Story 4.6 baseline interceptor sufficient MVP.

8. **AC8 — Backend reminder cron `pending-bookings-reminder.task.ts` NFR48** : Given Story 1.9 baseline `@nestjs/schedule` + NFR48 48h SLA, When Story 4.6 ajoute, Then :
   - **NEW `apps/booking-svc/src/infrastructure/scheduling/pending-bookings-reminder.task.ts`** — `@Cron('0 10 * * *', { name: 'pending-bookings-reminder', timeZone: 'Europe/Paris' })` daily at 10:00 business hours
   - **UPDATE `IBookingRepository`** Story 4.1 — add method `findProsWithStaleManyPendingBookings({ olderThan: Date, minCount: number }): Promise<{ proProfileId: string; pendingCount: number; oldestPendingAt: Date }[]>` (uses `idx_booking_pro_pending_expires` Story 4.1 partial index ✅ — efficient `GROUP BY pro_profile_id HAVING COUNT(*) > 5`)
   - **TypeORM impl** uses raw query OR query builder + GROUP BY proProfileId
   - **Emit `pro.reminder-pending-bookings.v1`** event via `OutboxPublisher` per stale Pro
   - **NEW event schema** `packages/contracts/src/events/pro/reminder-pending-bookings.v1.{schema.json,ts}` (cf. story body section n)
   - **Prometheus metric** `tukio_pro_reminder_pending_bookings_total{}` counter
   - **Story 5.4 future** : notification-svc consumer → Resend email FR/EN "5 demandes attendent votre réponse"
   - **Tests integration** 5 scenarios AC8 (no stale Pros → no events, 1 stale Pro 6 pending → 1 event, edge cases minCount boundary 5 vs 6, idempotent multi-cron-tick same day no duplicate emails via inbox dedup Story 5.4 future, metric instrumented)

9. **AC9 — gateway-api endpoint `GET /v1/seller/bookings/pending` + forwarder + Zod + auth pro role + throttle** : Given Story 1.2 baseline + Story 2.3 cursor pagination + Story 4.6 PII masking interceptor, When Story 4.6 ajoute, Then :
   - **NEW `apps/gateway-api/src/infrastructure/http/controllers/seller-bookings.controller.ts`** — endpoints `GET /v1/seller/bookings/pending` + `GET /v1/seller/bookings/:id`
   - **Auth required** : `@UseGuards(KeycloakJwtGuard)` + `@Roles('pro')` + `@Throttle({ default: { limit: 60, ttl: 60_000 } })` (60/min/Pro)
   - **Zod query validation** `ListProBookingsQuerySchema` (status array, sort, cursor, pageSize)
   - **Forwarder** `apps/gateway-api/src/usecases/seller/list-pro-bookings.forwarder.ts` NEW — derives `proProfileId` from JWT actor → calls booking-svc internal `GET /internal/bookings/pro/list?proProfileId=...&status=...&sort=...&cursor=...` (X-Internal-Service-Token Story 1.10 pattern)
   - **NEW booking-svc internal endpoint** `apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts` UPDATE Story 4.4 baseline — add `GET /internal/bookings/pro/list` with `BookingPiiMaskInterceptor` applied
   - **DTOs NEW** `packages/contracts/src/dtos/booking/{list-pro-bookings-query,pending-booking-response,booking-detail-pro-response}.dto.ts` Zod
   - **Tests E2E gateway** 8 scenarios AC9 (happy paginated, sort verify, status filter, masked PII verify response shape, cursor pagination cross-pages stable, auth missing 401, wrong role 403, throttle 429)

10. **AC10 — TanStack Query hook `useListProBookings` infinite + base variants** : Given Story 0.9 baseline TanStack Query, When Story 4.6 ajoute, Then :
    - **NEW `packages/api-client/src/hooks/booking/useListProBookings.ts`** — exports `useListProBookings(input)` (base `useQuery`) + `useListProBookings.infinite(input)` (`useInfiniteQuery` for cursor pagination)
    - **Cache key** `['proBookings', proProfileId, status, sort]`
    - **`staleTime: 30s`** — refetch on mount/focus
    - **TypeScript types** depuis `@tukio/contracts/dtos/booking/list-pro-bookings-query.dto.ts`
    - **Tests Vitest + msw** 6 scenarios AC10 (happy fetch, infinite scroll cursor + flatMap, cache invalidation on mutation, error handler, refetch on focus, types)
    - **Coverage ≥ 85 %**

11. **AC11 — i18n FR/EN namespaces `seller.bookings.pending.*` + `seller.bookings.detail.*` + `seller.bookings.card.*` + i18n CI audit** : Given Story 0.9 i18n CI lint, When Story 4.6 ajoute, Then :
    - **`apps/seller/messages/{fr,en}.json`** UPDATE — namespaces ~45 keys × 2 langues :
      - `seller.bookings.pending.title/subtitle/listLabel/loadMore`
      - `seller.bookings.pending.empty.title/description/cta`
      - `seller.bookings.pending.metadata.pageTitle`
      - `seller.bookings.detail.heading/customerSectionLabel/customerHeading/bookingSectionLabel/bookingHeading/periodLabel/quantityLabel/optionsLabel/totalLabel/commissionLabel/netProLabel/piiMaskedNoticePending/piiRevealedNoticeConfirmed/acceptCta/refuseCta/actionsLabel/actionsDeferredStory4_7/chatCta/chatDeferredEpic5`
      - `seller.bookings.detail.statuses.{pending_pro_acceptance,confirmed,completed,cancelled,refused}`
      - `seller.bookings.card.periodLabel/quantityLabel/optionsLabel/totalLabel/totalNetPro/countdownAria/expired/expiresInHoursMinutes/expiresInMinutes`
    - **Tone & voice Tukio FR** : vouvoiement, chaleureux pas familier, microcopy proactive anti-désintermédiation
    - **i18n CI lint Story 0.9** `pnpm i18n:audit` pass — both files contain all keys

12. **AC12 — NEW event schema `pro.reminder-pending-bookings.v1` + NATS subject on BOOKING stream** : Given Story 0.2 baseline contracts + Story 0.7 NATS streams, When Story 4.6 ajoute, Then :
    - **NEW `packages/contracts/src/events/pro/reminder-pending-bookings.v1.{schema.json,ts}`** (cf. story body section n)
    - **NEW directory** `packages/contracts/src/events/pro/` + `index.ts` barrel
    - **UPDATE `packages/contracts/src/events/index.ts`** barrel export
    - **NATS subject** `pro.reminder-pending-bookings.v1` on existing `BOOKING` stream (no new stream — semantically related to bookings)
    - **JSON Schema v7** validation + types auto-generated (Story 0.2 `json-schema-to-typescript`)
    - **Story 5.4 future** : notification-svc consumer subscribes + sends Resend email

13. **AC13 — Cross-zone Vercel multi-zones `/seller/*` rewrites verify (Story 0.13 baseline)** : Given Story 0.13 baseline + Story 4.5 verified `/checkout/*` rewrites, When Story 4.6 verify, Then :
    - **VERIFY `apps/public/next.config.ts`** Story 0.13 — rewrites `/seller/*` → seller.tukio.one (Story 2.2 baseline likely scaffolded — Story 4.6 re-verify)
    - **VERIFY `apps/customer/next.config.ts`** if needed for cross-app navigation
    - **`apps/seller/src/middleware.ts`** Story 1.4 baseline — `/seller/*` requires auth + role `pro`
    - **Tests E2E Playwright cross-zone** 2 scenarios AC13 (navigate `tukio.one` → `seller.tukio.one/fr/seller/bookings/pending` cross-zone OK + cookie auth preserved)

14. **AC14 — Tests Playwright e2e 8 scenarios + axe-core RGAA AA + Lighthouse CI** : Given AC1-13, When CI runs, Then :
    - **`apps/seller/e2e/bookings/pending.spec.ts`** NEW — 8 scenarios (cf. story body section p)
    - **Tests integration backend** : 4 specs (auto-expire, reminder, interceptor, list-pro-bookings repo)
    - **axe-core 0 violations** all components AC2/AC3/AC4
    - **Lighthouse CI Story 0.11 UPDATE** : add `/fr/seller/bookings/pending` + `/fr/seller/bookings/<seed-id>` budgets — Accessibility ≥ 90 + LCP < 1.5s p75 (private page — less strict than public NFR3 < 1s)
    - **Coverage NFR71** : ≥ 90 % components (PendingBookingCard, CountdownBadge, BookingDetailClient, EmptyState wiring) + ≥ 90 % usecases (auto-expire FULL + reminder skeleton) + ≥ 90 % interceptor BookingPiiMaskInterceptor + ≥ 85 % gateway controller + ≥ 85 % api-client hook + ≥ 80 % infrastructure (cron tasks + repository new methods)

15. **AC15 — Lint boundaries strict + EN strict + Stack latest stable** : Given Story 0.6 baseline + memories, When `pnpm lint && pnpm typecheck`, Then :
    - **0 violations boundaries** apps/booking-svc/src/usecases (auto-expire FULL pure use case logic) + apps/booking-svc/src/infrastructure (cron tasks + interceptor) + apps/seller/features/seller/bookings
    - **EN strict** : routes `/seller/bookings/pending`, identifiers, env vars
    - **i18n FR/EN strict** + namespaces `seller.bookings.*` + CI lint pass
    - **Stack latest stable** : `@nestjs/schedule` (Story 1.9 baseline), `@tanstack/react-query` v5 (Story 0.9), `lucide-react` (Story 0.4)
    - **TypeScript strict mode** + `noUncheckedIndexedAccess`

16. **AC16 — Documentation runbook + project-context + completion notes Stories 4.1/4.7 + commit** : Given AC1-15 livrés, When je consulte docs, Then :
    - **NEW `docs/runbook/booking-auto-expire-debug.md`** (~30 lignes) — debugging guide auto-expire cron + how to manually trigger + monitoring metrics + edge cases (cron downtime backlog, batch size tuning, error isolation)
    - **UPDATE `docs/project-context.md`** — section "Pro Pending Bookings + Auto-Expire (Story 4.6)" résumé `/seller/bookings/pending` page + countdown badge + PII masking interceptor + auto-expire cron + reminder cron
    - **UPDATE `_bmad-output/implementation-artifacts/4-1-...md`** Completion Notes List — Story 4.6 finalise `auto-expire-booking.usecase` skeleton FULL impl + cron + `findPendingExpiringBefore` repository method consumed + UPDATE `IBookingRepository` add `findProsWithStaleManyPendingBookings`
    - **UPDATE `_bmad-output/implementation-artifacts/4-7-...md`** (if exists) OR add note for Story 4.7 handoff — Story 4.6 livre baseline PII masking + 2 placeholder CTAs Accept/Refuse + chat toggle ; Story 4.7 finalise full Accept/Refuse + Stripe capture + full PII reveal + audit event
    - **UPDATE `_bmad-output/implementation-artifacts/4-5-...md`** Completion Notes — `useBookingDetail` Story 4.5 baseline réutilisé Pro + Customer views (different masked response per actor)
    - **Commit** `feat(seller,booking-svc,gateway-api,contracts,api-client): Story 4.6 Pro pending bookings page + auto-expire cron full + PII masking interceptor anti-désintermédiation baseline + reminder cron NFR48 + 8 Playwright e2e + RGAA AA + Lighthouse CI gate seller-bookings UX-DR figé`

## Tasks / Subtasks

- [ ] **Task 1 — Backend `auto-expire-booking.usecase.ts` FULL impl + cron task @Cron('*/5 * * * *')** (AC: #5, #6) — coverage ≥ 90 %
  - [ ] 1.1 — UPDATE `apps/booking-svc/src/usecases/auto-expire-booking.usecase.ts` Story 4.1 skeleton → full batch iteration BATCH_SIZE=100 + error isolation + metric
  - [ ] 1.2 — NEW `apps/booking-svc/src/infrastructure/scheduling/auto-expire-booking.task.ts` (@Cron 5 min Europe/Paris)
  - [ ] 1.3 — UPDATE `apps/booking-svc/src/app.module.ts` — verify ScheduleModule.forRoot + wire AutoExpireBookingTask provider
  - [ ] 1.4 — UPDATE `apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` — wire AutoExpireBookingUseCase
  - [ ] 1.5 — Add Prometheus metric `tukio_booking_auto_expired_total{outcome}` (Story 0.12 baseline prom-client)
  - [ ] 1.6 — Tests unit + integration 8 scenarios AC5 + 2 scenarios AC6

- [ ] **Task 2 — Backend `BookingPiiMaskInterceptor` + 4 mask rules + helpers** (AC: #7) — coverage ≥ 90 %
  - [ ] 2.1 — NEW `apps/booking-svc/src/infrastructure/http/interceptors/booking-pii-mask.interceptor.ts`
  - [ ] 2.2 — Helper `toMaskedName('Marie Lefèvre') → 'Marie L.'`
  - [ ] 2.3 — Helper `toApproximatePostalArea({ postalCode, city })` department-level
  - [ ] 2.4 — Wire interceptor in `booking.controller.ts` Story 4.4 baseline + NEW pro-bookings endpoint
  - [ ] 2.5 — Tests integration testcontainer Postgres 8 scenarios AC7 (each role × status combination + edge cases)

- [ ] **Task 3 — Backend reminder cron `pending-bookings-reminder.task.ts` NFR48 + repo method + event schema** (AC: #8, #12) — coverage ≥ 90 %
  - [ ] 3.1 — UPDATE `apps/booking-svc/src/domain/ports/booking-repository.port.ts` Story 4.1 — add `findProsWithStaleManyPendingBookings({ olderThan, minCount })`
  - [ ] 3.2 — UPDATE `apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts` Story 4.1 — implement using `idx_booking_pro_pending_expires` partial index baseline ✅ + GROUP BY proProfileId
  - [ ] 3.3 — NEW `apps/booking-svc/src/infrastructure/scheduling/pending-bookings-reminder.task.ts` (@Cron daily 10:00 Europe/Paris)
  - [ ] 3.4 — NEW `packages/contracts/src/events/pro/reminder-pending-bookings.v1.{schema.json,ts}` + index.ts
  - [ ] 3.5 — UPDATE `packages/contracts/src/events/index.ts` barrel export pro/
  - [ ] 3.6 — Add Prometheus metric `tukio_pro_reminder_pending_bookings_total{}`
  - [ ] 3.7 — Tests integration 5 scenarios AC8

- [ ] **Task 4 — gateway-api endpoint `GET /v1/seller/bookings/pending` + forwarder + Zod + auth pro + throttle** (AC: #9) — coverage ≥ 85 %
  - [ ] 4.1 — NEW `apps/gateway-api/src/infrastructure/http/controllers/seller-bookings.controller.ts` (2 endpoints: pending list + detail)
  - [ ] 4.2 — NEW `apps/gateway-api/src/usecases/seller/list-pro-bookings.forwarder.ts` + `get-pro-booking-detail.forwarder.ts`
  - [ ] 4.3 — NEW DTOs `packages/contracts/src/dtos/booking/{list-pro-bookings-query,pending-booking-response,booking-detail-pro-response}.dto.ts` Zod
  - [ ] 4.4 — UPDATE `packages/contracts/src/dtos/booking/index.ts` barrel export
  - [ ] 4.5 — UPDATE booking-svc internal endpoint `apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts` Story 4.4 — add `GET /internal/bookings/pro/list` + `GET /internal/bookings/pro/<id>` with `BookingPiiMaskInterceptor` applied
  - [ ] 4.6 — Tests E2E gateway 8 scenarios AC9

- [ ] **Task 5 — Frontend `/seller/bookings/pending` Server + Client Components** (AC: #1) — coverage ≥ 90 %
  - [ ] 5.1 — NEW `apps/seller/src/app/[locale]/seller/bookings/pending/page.tsx` Server Component
  - [ ] 5.2 — NEW `apps/seller/src/features/seller/bookings/components/PendingBookingsListClient.tsx` (useListProBookings.infinite + EmptyState)
  - [ ] 5.3 — NEW `apps/seller/src/features/seller/bookings/components/PendingBookingsSkeleton.tsx` (Story 0.4 Skeleton pattern)
  - [ ] 5.4 — NEW `apps/seller/src/features/seller/bookings/components/PendingBookingsErrorState.tsx`
  - [ ] 5.5 — Tests Vitest + Playwright 4 scenarios AC1

- [ ] **Task 6 — Frontend `<PendingBookingCard>` + `<CountdownBadge>` + helpers** (AC: #2, #3) — coverage ≥ 90 %
  - [ ] 6.1 — NEW `apps/seller/src/features/seller/bookings/components/PendingBookingCard.tsx`
  - [ ] 6.2 — NEW `apps/seller/src/features/seller/bookings/components/CountdownBadge.tsx` (useState + setInterval 60s)
  - [ ] 6.3 — NEW `apps/seller/src/features/seller/bookings/helpers/format-period.ts` (i18n FR/EN)
  - [ ] 6.4 — Tests Vitest + fakeTimers + axe-core 5 AC2 + 6 AC3

- [ ] **Task 7 — Frontend `/seller/bookings/<id>` detail Server + Client + 2 CTAs Story 4.7 placeholder** (AC: #4) — coverage ≥ 90 %
  - [ ] 7.1 — NEW `apps/seller/src/app/[locale]/seller/bookings/[id]/page.tsx` Server Component
  - [ ] 7.2 — NEW `apps/seller/src/features/seller/bookings/components/BookingDetailClient.tsx` (useBookingDetail + masked PII conditional + 2 disabled CTAs + chat toggle disabled)
  - [ ] 7.3 — NEW `BookingDetailSkeleton.tsx` + `BookingDetailErrorState.tsx`
  - [ ] 7.4 — Tests 6 scenarios AC4

- [ ] **Task 8 — `useListProBookings` + `useBookingDetail` hooks** (AC: #10) — coverage ≥ 85 %
  - [ ] 8.1 — NEW `packages/api-client/src/hooks/booking/useListProBookings.ts` (base + infinite variants)
  - [ ] 8.2 — UPDATE Story 4.5 `useBookingDetail` baseline — verify Pro view returns masked PII per backend interceptor
  - [ ] 8.3 — UPDATE `packages/api-client/src/hooks/booking/index.ts` barrel export
  - [ ] 8.4 — Tests Vitest + msw 6 scenarios AC10

- [ ] **Task 9 — i18n FR/EN namespaces + i18n CI audit** (AC: #11)
  - [ ] 9.1 — UPDATE `apps/seller/messages/fr.json` — namespaces `seller.bookings.{pending,detail,card}.*` ~45 keys
  - [ ] 9.2 — UPDATE `apps/seller/messages/en.json` — namespaces ~45 keys
  - [ ] 9.3 — `pnpm i18n:audit` Story 0.9 pass

- [ ] **Task 10 — Cross-zone Vercel rewrites verify + middleware auth role pro** (AC: #13)
  - [ ] 10.1 — VERIFY `apps/public/next.config.ts` Story 0.13 — rewrites `/seller/*` → seller.tukio.one ACTIVE
  - [ ] 10.2 — VERIFY `apps/seller/src/middleware.ts` Story 1.4 — `/seller/*` requires auth + role 'pro' + redirect 403 if wrong role
  - [ ] 10.3 — Tests E2E Playwright cross-zone 2 scenarios AC13

- [ ] **Task 11 — Tests Playwright e2e 8 scenarios + axe-core + Lighthouse CI** (AC: #14)
  - [ ] 11.1 — NEW `apps/seller/e2e/bookings/pending.spec.ts` (8 scenarios AC14)
  - [ ] 11.2 — UPDATE `apps/seller/e2e/lighthouse.config.{ts,js}` Story 0.11 — add `/fr/seller/bookings/pending` + `/fr/seller/bookings/<seed-id>` budgets (Accessibility ≥ 90 + LCP < 1.5s p75)
  - [ ] 11.3 — axe-core 0 violations all components

- [ ] **Task 12 — Lint boundaries + EN strict + commit handoff Story 4.7** (AC: #15, #16)
  - [ ] 12.1 — `pnpm lint && pnpm typecheck` 0 violations + 0 errors
  - [ ] 12.2 — NEW `docs/runbook/booking-auto-expire-debug.md`
  - [ ] 12.3 — UPDATE `docs/project-context.md` — section "Pro Pending Bookings + Auto-Expire (Story 4.6)"
  - [ ] 12.4 — UPDATE Stories 4.1/4.5 Completion Notes — Story 4.6 handoffs
  - [ ] 12.5 — Commit Story 4.6

## Dev Notes

### Pourquoi Story 4.6 = Pro UX baseline + auto-expire production-ready

Story 4.6 livre :
1. **Pro UX critique** : sans dashboard pending bookings, Pro ne peut pas répondre aux demandes Customer → tunnel booking cassé bout-en-bout
2. **Auto-expire 48h SLA production-ready** : Story 4.1 livre seulement skeleton ; sans cron actif, bookings restent éternellement bloqués + autorisation Stripe non-libérée + customer mécontent + commission Tukio non-générée
3. **Anti-désintermédiation baseline FR45** : PII masking minimal pour `pending_pro_acceptance` empêche Pro de contacter Customer hors plateforme avant booking confirmé
4. **NFR48 reminder cron** : engage Pros endormis (engagement marketplace clé)

Story 4.6 NE livre PAS l'accept/refuse business logic — Story 4.7 finalise (Stripe capture trigger + full PII reveal + audit event). Story 4.6 livre les **2 placeholder CTAs disabled** + le **frame UI** + **backend foundation cron**.

**Story 4.6 = template "Pro dashboard list + detail + countdown live + masked PII + auto-expire cron + reminder cron + PII masking interceptor"** réutilisable :
- Story 4.11 (customer + pro bookings list/detail UI) : réutilise `useBookingDetail` + cursor pagination + PII masking interceptor pattern
- Story 5.x V1 quotes : même pattern Pro inbox + countdown SLA
- Story 6.x admin moderation queue : même pattern list + filter + cursor

### Décisions techniques majeures actées Story 4.6

1. **Countdown badge tick every 60s (vs every 1s)** — 48h SLA precision 1 minute suffisante UX. Battery + perf efficient (60× moins d'updates) + cleanup interval on unmount. `setInterval` only while remaining > 0.

2. **PII masking via interceptor backend** (vs frontend masking) — defense in depth :
   - Frontend would expose full PII in network response → DevTools inspection bypass → Pro could scrape emails
   - Backend interceptor masks at HTTP layer BEFORE response sent → strict zero-PII-leak guarantee
   - Frontend "trust the response" pattern — display whatever backend sends
   - Interceptor wires per-controller annotation `@UseInterceptors(BookingPiiMaskInterceptor)`

3. **Department-level postal area** (`44320` → `44000 - Nantes`) — round to département + city only (no full address). Sufficient to inform Pro of service area without leaking specific address. Anti-désintermédiation FR45 standard.

4. **`toMaskedName('Marie Lefèvre')` → `'Marie L.'`** — first name + last initial. Standard marketplace pattern (Airbnb, Vinted, etc.). Sufficient for Pro to know "qui je vais servir" without enabling out-of-platform contact.

5. **Cron `@Cron('*/5 * * * *')` 5-min granularity** (vs every minute or 10 min) — balance freshness vs DB load. 48h SLA + 5-min granularity = max delay 5 minutes between expiration moment + auto-expire trigger. Acceptable UX.

6. **Cron tick `Europe/Paris` timezone** — cohérent avec NFR43 Europe market focus + cron `auto-payout` Story 4.10 future also Europe/Paris.

7. **BATCH_SIZE=100 + iterate until empty** — handle backlog if cron was down OR many simultaneous expirations. Memory-efficient streaming approach (vs loading 10k expired bookings at once).

8. **Error isolation per-booking** — if 1 booking fails (e.g., concurrent admin modification), continue with next. NOT fail entire batch. Logged + metric incremented.

9. **`pro.reminder-pending-bookings.v1` event subject on existing BOOKING stream** (vs NEW PRO stream) — semantically related to bookings + avoids NATS stream proliferation. V1+ may extract PRO stream if many pro-specific events.

10. **Cron reminder daily at 10:00 Europe/Paris business hours** — Pro receive email at start of business day. NOT 6am (intrusive) NOT 18h (end of day, less effective).

11. **Story 4.7 deferred** : full accept/refuse + Stripe capture + full PII reveal + audit event `booking.pii-revealed.v1` (NEW Story 4.7). Story 4.6 baseline interceptor masks default + Story 4.7 unmasks for `confirmed/completed/cancelled` status post-accept.

12. **`useBookingDetail` Story 4.5 baseline réutilisé** — Pro + Customer view distinct via JWT actor.role inferred backend interceptor. Same hook, different masked response.

13. **`requireAuth({ requiredRole: 'pro' })` server-side helper** Story 1.4 baseline — verify Story 1.4 livré le `requiredRole` param (sinon Story 4.6 PR add).

14. **Stack frontend latest stable** : Next.js 15 + React 19 + TanStack Query v5 + next-intl 4.x + Tailwind v4 + `@nestjs/schedule` (Story 1.9 baseline).

15. **EN strict + Clean Architecture + Envelope ADR-014 + i18n FR/EN strict + RGAA AA + Pretre boundaries + latest stable** memories — toutes respectées.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `@nestjs/schedule` | Cron @Cron decorators | (Story 1.9 baseline) | `auto-expire-booking.task` + `pending-bookings-reminder.task` |
| `@tanstack/react-query` | API hooks `useListProBookings` infinite + `useBookingDetail` | (Story 0.9 baseline) | v5 latest stable |
| `next-intl` | i18n FR/EN | (Story 0.9 baseline) | 4.x si stable |
| `next` | Next.js 15 App Router + Server Components | (Sprint 0 baseline) | apps/seller already scaffolded Story 2.2 |
| `@tukio/ui` | Card, Button, Badge, Avatar, Skeleton, EmptyState | (Stories 0.4/0.5 baseline) | Réutilisés |
| `@tukio/api-client` | TanStack hooks typés | (Story 0.9 baseline) | UPDATE — ajoute `useListProBookings` |
| `@tukio/contracts` | Zod DTOs + event schemas | (Story 0.2 baseline) | UPDATE — ajoute `dtos/booking/list-pro-bookings-query` + `events/pro/reminder-pending-bookings.v1` |
| `lucide-react` | Icons Clock + AlertTriangle | (Story 0.4 baseline) | Réutilisé |
| `prom-client` | Prometheus metrics | (Story 0.12 baseline) | Counters auto-expire + reminder |
| `@playwright/test` | E2E tests | (Story 0.9 baseline) | 8 scenarios |
| `vitest` | Unit tests + fakeTimers countdown | (Story 0.9 baseline) | v3.x latest |
| `axe-core` + `@axe-core/playwright` | RGAA AA | (Story 0.9 baseline) | 0 violations |

### Project Structure cible

```
# ====== NEW Story 4.6 frontend ======

apps/seller/src/
├─ app/[locale]/seller/bookings/
│  ├─ pending/page.tsx                                                                                  # NEW Server Component shell
│  └─ [id]/page.tsx                                                                                     # NEW Server Component shell detail
└─ features/seller/bookings/
   ├─ components/
   │  ├─ PendingBookingsListClient.tsx + spec                                                           # NEW Client (useListProBookings.infinite + EmptyState)
   │  ├─ PendingBookingsSkeleton.tsx                                                                    # NEW
   │  ├─ PendingBookingsErrorState.tsx + spec                                                           # NEW
   │  ├─ PendingBookingCard.tsx + spec                                                                  # NEW (Avatar + masked PII + period + total + CountdownBadge)
   │  ├─ CountdownBadge.tsx + spec                                                                      # NEW (useState + setInterval 60s + variant transitions)
   │  ├─ BookingDetailClient.tsx + spec                                                                 # NEW (useBookingDetail + masked PII conditional + 2 placeholder CTAs)
   │  ├─ BookingDetailSkeleton.tsx                                                                      # NEW
   │  └─ BookingDetailErrorState.tsx + spec                                                             # NEW
   ├─ helpers/
   │  └─ format-period.ts + spec                                                                        # NEW (i18n FR/EN period formatting)
   └─ index.ts                                                                                          # NEW barrel

apps/seller/messages/{fr,en}.json                                                                       # UPDATE — namespaces seller.bookings.{pending,detail,card}.* ~45 keys
apps/seller/e2e/bookings/pending.spec.ts                                                                # NEW 8 tests Playwright
apps/seller/e2e/lighthouse.config.{ts,js}                                                               # UPDATE Story 0.11 — add seller bookings budgets

# ====== NEW Story 4.6 backend (booking-svc EXTEND Story 4.1) ======

apps/booking-svc/src/
├─ usecases/auto-expire-booking.usecase.ts                                                              # UPDATE Story 4.1 skeleton → FULL impl batch + metric
├─ infrastructure/scheduling/
│  ├─ auto-expire-booking.task.ts                                                                       # NEW (@Cron '*/5 * * * *' Europe/Paris)
│  └─ pending-bookings-reminder.task.ts                                                                 # NEW (@Cron '0 10 * * *' daily 10:00)
├─ infrastructure/http/interceptors/booking-pii-mask.interceptor.ts                                     # NEW (anti-désintermédiation FR45 baseline)
├─ infrastructure/http/controllers/booking.controller.ts                                                # UPDATE Story 4.4 — add internal endpoints GET /internal/bookings/pro/list + /internal/bookings/pro/:id + apply interceptor
├─ domain/ports/booking-repository.port.ts                                                              # UPDATE Story 4.1 — add findProsWithStaleManyPendingBookings
├─ infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts                        # UPDATE Story 4.1 — implement new method (GROUP BY proProfileId + partial index)
├─ infrastructure/usecases-proxy/usecases-proxy.module.ts                                               # UPDATE Story 4.1/4.4 — wire 2 new tasks + AutoExpireBookingUseCase fully
└─ app.module.ts                                                                                        # UPDATE Story 4.1 — verify ScheduleModule.forRoot wired

apps/booking-svc/test/integration/
├─ auto-expire-booking.integration-spec.ts                                                              # NEW
├─ pending-bookings-reminder.integration-spec.ts                                                        # NEW
├─ booking-pii-mask.interceptor.integration-spec.ts                                                     # NEW
└─ list-pro-bookings.integration-spec.ts                                                                # NEW

# ====== NEW Story 4.6 backend (gateway-api) ======

apps/gateway-api/src/
├─ infrastructure/http/controllers/seller-bookings.controller.ts                                        # NEW (2 endpoints + auth pro + throttle)
└─ usecases/seller/
   ├─ list-pro-bookings.forwarder.ts                                                                    # NEW
   └─ get-pro-booking-detail.forwarder.ts                                                               # NEW

# ====== UPDATE @tukio/contracts ======

packages/contracts/src/
├─ events/pro/                                                                                          # NEW directory
│  ├─ reminder-pending-bookings.v1.{schema.json,ts}                                                     # NEW
│  └─ index.ts                                                                                          # NEW
├─ events/index.ts                                                                                      # UPDATE barrel export pro/
├─ dtos/booking/
│  ├─ list-pro-bookings-query.dto.ts                                                                    # NEW
│  ├─ pending-booking-response.dto.ts                                                                   # NEW
│  ├─ booking-detail-pro-response.dto.ts                                                                # NEW
│  └─ index.ts                                                                                          # UPDATE barrel export

# ====== UPDATE @tukio/api-client ======

packages/api-client/src/hooks/booking/
├─ useListProBookings.ts + spec                                                                         # NEW (base + infinite variants)
└─ index.ts                                                                                             # UPDATE barrel export
└─ useBookingDetail.ts                                                                                  # VERIFY Story 4.5 baseline — Pro view masked PII per backend interceptor

# ====== UPDATE docs ======

docs/runbook/booking-auto-expire-debug.md                                                               # NEW ~30 lignes
docs/project-context.md                                                                                 # UPDATE — section "Pro Pending Bookings + Auto-Expire (Story 4.6)"
_bmad-output/implementation-artifacts/4-1-...md                                                         # UPDATE Completion Notes — auto-expire FULL impl
_bmad-output/implementation-artifacts/4-5-...md                                                         # UPDATE Completion Notes — useBookingDetail reused Pro view

# Estimation : ~30 nouveaux + ~10 updates = ~40 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (contracts), 0.4 (atomics Card/Button/Badge/Avatar/Skeleton), 0.5 (patterns EmptyState/CountdownBadge variant — verify if CountdownBadge promoted to @tukio/ui), 0.6 (Pretre + boundaries lint), 0.7 (@tukio/messaging OutboxPublisher), 0.9 (TanStack Query + next-intl + axe-core + i18n CI lint), 0.10 (docker-compose), 0.11 (CI Lighthouse + perf budgets), 0.12 (Prometheus + Grafana baseline), 0.13 (Vercel multi-zones rewrites — verify /seller/* active), 1.2 (gateway KeycloakJwtGuard + envelope + throttle + Roles decorator), 1.4 (login flow + middleware + requireAuth helper Story 1.4 baseline server-side), 1.9 (@nestjs/schedule baseline ScheduleModule.forRoot pattern), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token pattern + pino redact), 2.2 (apps/seller scaffolded baseline + onboarding wizard), 2.3 (cursor pagination canonical Story 2.3), 4.1 (booking-svc Pretre + Booking aggregate + autoExpire method baseline + auto-expire-booking.usecase skeleton + idx_booking_pending_expires_at + idx_booking_pro_pending_expires partial indexes baseline — Story 4.6 EXTEND finalise FULL), 4.4 (booking.controller.ts internal endpoints baseline — Story 4.6 EXTEND add 2 pro endpoints), 4.5 (useBookingDetail baseline — Story 4.6 réutilise Pro view via PII masking interceptor). UX spec L264 `screens/seller-bookings.jsx` figé bundle, L1243 EmptyState seller-no-bookings UX-DR16, L1474 microcopy seller. Architecture lines 412 (apps/seller role pro), 419-422 (multi-zones rewrites /seller/*), 826-838 (seller features mapping), 2331 (FR34-48 seller bookings).

1. **API responses envelope ADR-014** — toutes responses gateway-api wrapped. No new error codes — réutilise Story 4.1 `BOOKING-NOT-FOUND-002` for missing booking.

2. **ADR-001 Clean Architecture strict** — auto-expire usecase pure logic (no NestJS/TypeORM). Cron task in infrastructure/scheduling. Interceptor in infrastructure/http. Lint boundaries enforced.

3. **ADR-003 DB per service strict** — auto-expire + reminder cron query `tukio_booking` only via repository ports.

4. **ADR-006 saga choreographed** — `booking.refused.v1` (reason `__system_auto_expired__`) consumed Story 4.2 payment-svc cancel-payment + Story 5.4 future notification-svc email + Story 2.7 audit_log automatic.

5. **ADR-007 transactional outbox** — auto-expire emits `booking.refused.v1` via `OutboxPublisher` Story 0.7 (transactional with `booking.save`).

6. **ADR-008 internal endpoint authentication** — booking-svc internal pro-bookings endpoints use `InternalServiceTokenGuard` Story 1.10 pattern.

7. **ADR-013 frontend multi-zones Vercel** — Story 0.13 baseline `/seller/*` rewrites — Story 4.6 verifies.

8. **NFR1 RGPD + anti-désintermédiation FR45** — PII masking interceptor strict. NO PII in logs (Story 1.10 pino redact baseline). Story 4.7 finalises post-accept reveal.

9. **NFR43 saga alert > 5 min** — auto-expire cron failure logged + metric → Story 4.13 future Grafana saga-health alert.

10. **NFR48 Pro engagement SLA** — reminder cron `> 5 pending > 24h` baseline + event emitted → Story 5.4 future Resend email.

11. **NFR71 coverage thresholds** — ≥ 90 % components + ≥ 90 % usecases + ≥ 90 % interceptor + ≥ 85 % gateway/hooks + ≥ 80 % infrastructure.

12. **NFR82 audit** — `booking.refused.v1` (auto-expired) consumed Story 2.7 audit_log automatically.

13. **RGAA AA (NFR47-55)** — axe-core 0 violations + keyboard nav full + `aria-label` countdown screen reader + 44×44 px touch targets + focus management.

14. **EN strict + Clean Architecture + Envelope + Pretre + latest stable + feature-based + atomic design** memories.

### Previous Story Intelligence

**Story 0.2 (contracts)** : Story 4.6 ajoute event `pro.reminder-pending-bookings.v1` + 3 DTOs booking pro.

**Story 0.4 (atomics Avatar/Card/Button/Badge/Skeleton)** : Story 4.6 réutilise directement. `<Avatar size="md" initials>` + `<Badge variant>` + `<Card>` hover + `<Skeleton>` loading.

**Story 0.5 (patterns EmptyState 7 variants — seller-no-bookings declared UX-DR16)** : Story 4.6 réutilise `<EmptyState variant="seller-no-bookings">` directement.

**Story 0.6 (Pretre + boundaries lint)** : Story 4.6 EXTEND booking-svc — lint boundaries.

**Story 0.7 (@tukio/messaging OutboxPublisher)** : Story 4.6 auto-expire publishes `booking.refused.v1` via OutboxPublisher.

**Story 0.9 (TanStack Query + next-intl + axe-core + i18n CI)** : Story 4.6 réutilise infrastructure.

**Story 0.10 (docker-compose)** : no change.

**Story 0.11 (CI Lighthouse + perf budgets)** : Story 4.6 add `/fr/seller/bookings/pending` + detail to budgets.

**Story 0.12 (Prometheus + Grafana baseline)** : Story 4.6 instruments 2 new metrics counters.

**Story 0.13 (Vercel multi-zones)** : Story 4.6 verify `/seller/*` rewrites active.

**Story 1.2 (gateway KeycloakJwtGuard + Roles + envelope + throttle)** : Story 4.6 réutilise pattern `@Roles('pro')` + throttle.

**Story 1.4 (login + middleware + requireAuth + auth callback)** : Story 4.6 réutilise `requireAuth({ requiredRole: 'pro' })` server-side helper.

**Story 1.9 (@nestjs/schedule baseline ScheduleModule.forRoot)** : Story 4.6 réutilise pour 2 cron tasks.

**Story 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact)** : Story 4.6 réutilise pattern internal endpoint.

**Story 2.2 (apps/seller scaffolded + onboarding wizard)** : Story 4.6 ajoute `features/seller/bookings/` dans apps/seller baseline.

**Story 2.3 (cursor pagination canonical)** : Story 4.6 réutilise pour `useListProBookings.infinite`.

**Story 4.1 (booking-svc Pretre + Booking aggregate + autoExpire method + auto-expire-booking.usecase skeleton + idx_booking_pending_expires_at + idx_booking_pro_pending_expires partial indexes + booking.refused.v1 schema)** : Story 4.6 EXTEND :
- UPDATE `auto-expire-booking.usecase.ts` skeleton → FULL impl batch
- UPDATE `IBookingRepository` — add `findProsWithStaleManyPendingBookings`
- Réutilise `findPendingExpiringBefore` Story 4.1 baseline + `Booking.autoExpire()` method baseline
- Réutilise `booking.refused.v1` schema Story 4.1 baseline (`reason: '__system_auto_expired__'` sentinel)

**Story 4.4 (booking.controller.ts internal endpoints + bookings.controller.ts gateway-api baseline)** : Story 4.6 EXTEND :
- UPDATE booking-svc internal endpoint controller — add `GET /internal/bookings/pro/list` + `/internal/bookings/pro/:id`
- NEW gateway-api `seller-bookings.controller.ts` (distinct from `bookings.controller.ts` Story 4.4 customer-facing)

**Story 4.5 (useBookingDetail baseline)** : Story 4.6 réutilise pour `<BookingDetailClient>` Pro view — backend interceptor returns different masked response per actor.role.

### What this story does NOT do (out of scope)

- ❌ **Pro accept/refuse business logic + Stripe capture trigger** → Story 4.7 (Story 4.6 livre 2 placeholder disabled CTAs)
- ❌ **Full PII reveal post-accept + audit `booking.pii-revealed.v1` event** → Story 4.7
- ❌ **Customer cancellation flow + refund policy** → Story 4.8
- ❌ **Invoice generation TVA mandat 289 CGI** → Story 4.9
- ❌ **Auto-payout cron J+1** → Story 4.10 (Story 4.6 livre `complete-booking.usecase` skeleton Story 4.1 baseline — Story 4.10 finalise full cron)
- ❌ **Customer bookings list/detail UI** → Story 4.11 (Story 4.6 livre Pro side only)
- ❌ **Admin refund + reconciliation** → Story 4.12
- ❌ **Saga monitoring R11 full Grafana saga-health + PagerDuty** → Story 4.13 (Story 4.6 baseline metric + log alert)
- ❌ **notification-svc Resend email "Désolé Pro n'a pas répondu"** → Story 5.4 (Story 4.6 baseline event emitted)
- ❌ **notification-svc Resend email "5 demandes attendent votre réponse"** → Story 5.4 (Story 4.6 baseline event emitted)
- ❌ **Story 5.x V1 chat anti-désintermédiation regex masking** → Story 5.x V1 (Story 4.6 baseline placeholder chat toggle disabled)
- ❌ **Pro multi-listing pending count breakdown UI** → V1+ enhancement (Story 4.6 MVP flat list)
- ❌ **Pro filter bar (date range, listing, period type)** → V1+ enhancement (Story 4.6 MVP simple list)
- ❌ **Pro mobile push notifications** → Story 11.x V1 PWA + push
- ❌ **Manual block availability (V1 FR28)** → Story 4.4 baseline skeleton + Story 8.x V1 finalise

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 4.6` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :

1. **`apps/booking-svc/src/usecases/auto-expire-booking.usecase.ts`** Story 4.1 skeleton — **CRITICAL : lire l'état Story 4.1 complet pour préserver port injection signature + invocation pattern**. Story 4.6 finalise FULL batch + metric.

2. **`apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts`** Story 4.4 baseline — **CRITICAL : préserver endpoints Story 4.4 (POST /internal/bookings/checkout-session + cancel-on-coordination-failure Story 4.5) + cart.controller Story 4.3 separation**. Story 4.6 ajoute 2 NEW internal endpoints pro/list + pro/:id with `BookingPiiMaskInterceptor`.

3. **`apps/booking-svc/src/domain/ports/booking-repository.port.ts`** Story 4.1 baseline — **CRITICAL : préserver 6 méthodes Story 4.1 + Story 4.3 cart + Story 4.4 findStuckSagas + Story 4.5 findByCorrelationId**. Story 4.6 ADD `findProsWithStaleManyPendingBookings`.

4. **`apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts`** — **CRITICAL : préserver Story 4.1 transactional outbox + Story 4.4 optimistic lock + GIST + Story 4.5 findByCorrelationId**. Story 4.6 ADD `findProsWithStaleManyPendingBookings` impl using `idx_booking_pro_pending_expires` partial index baseline ✅ + GROUP BY proProfileId.

5. **`apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`** Story 4.1/4.3/4.4/4.5 livré — UPDATE wire 2 new tasks + AutoExpireBookingUseCase fully (was skeleton wire Story 4.1).

6. **`apps/booking-svc/src/app.module.ts`** Story 4.1 baseline — VERIFY ScheduleModule.forRoot wired (Story 1.9 baseline pattern). If not, ADD.

7. **`packages/contracts/src/events/index.ts`** — UPDATE barrel export `events/pro/` directory.

8. **`packages/contracts/src/dtos/booking/index.ts`** — UPDATE barrel export 3 NEW DTOs.

9. **`packages/api-client/src/hooks/booking/index.ts`** — UPDATE barrel export `useListProBookings`.

10. **`packages/api-client/src/hooks/booking/useBookingDetail.ts`** Story 4.5 baseline — VERIFY Pro view returns masked PII (no code change if backend interceptor handles).

11. **`apps/seller/messages/{fr,en}.json`** Story 2.2 baseline — UPDATE add `seller.bookings.*` namespaces.

12. **`apps/seller/e2e/lighthouse.config.{ts,js}`** Story 0.11 — UPDATE add seller bookings budgets.

13. **`docs/project-context.md`** — UPDATE add section.

14. **`_bmad-output/implementation-artifacts/{4-1,4-5}-...md`** — UPDATE Completion Notes Story 4.6 handoffs.

**Lire l'état complet de chaque UPDATE file avant édition** — particularly :
- `auto-expire-booking.usecase.ts` Story 4.1 (preserve skeleton signature + ports)
- `booking.typeorm.repository.ts` (preserve all 4 stories of methods + transactional outbox + optimistic lock + GIST)
- `booking.controller.ts` Story 4.4 (preserve all endpoints customer + cart)

### Testing Standards

- **Coverage ≥ 90 %** components frontend (PendingBookingsListClient, PendingBookingCard, CountdownBadge, BookingDetailClient)
- **Coverage ≥ 90 %** use cases (auto-expire FULL impl)
- **Coverage ≥ 90 %** interceptor BookingPiiMaskInterceptor
- **Coverage ≥ 85 %** gateway controller + forwarders
- **Coverage ≥ 85 %** api-client hooks (useListProBookings)
- **Coverage ≥ 80 %** infrastructure (cron tasks + repository new method)
- **Tests Vitest unit + fakeTimers (CountdownBadge tick)** + **integration testcontainer Postgres + NATS** + **Playwright e2e 8 scenarios** + **axe-core RGAA AA 0 violations** + **Lighthouse CI**
- **Lint boundaries strict 0 violations** + **EN strict** + **i18n CI audit pass**

### Project Structure Notes

✅ **Aligné** : architecture lines 412 (apps/seller role pro), 419-422 (multi-zones rewrites /seller/*), 826-838 (seller features mapping bookings), 858-870 (Zustand v5 — Story 4.6 N/A no Zustand needed), 2120-2164 (Pretre canonical), 2208-2241 (@tukio/ui shared), 2331 (FR34-48 → seller features bookings) ; UX spec L264 (screens/seller-bookings.jsx figé bundle), L1243 (EmptyState seller-no-bookings UX-DR16), L1474 (microcopy seller) ; PRD §FR42 (Pro pending requests 48h), §FR45 (anti-désintermédiation — Story 4.7 finalise full Story 4.6 baseline), §NFR48 (Pro engagement SLA), §NFR82 (audit `booking.refused.v1` auto-expired), §NFR47-55 (RGAA AA) ; Stories 0.2/0.4/0.5/0.6/0.7/0.9/0.10/0.11/0.12/0.13/1.2/1.4/1.9/1.10/2.2/2.3/4.1/4.4/4.5 ; memories Tukio.

⚠️ **Déviations** : aucune significative. Anti-désintermédiation interceptor backend-only (vs frontend masking too) = defense in depth = security best practice.

⚠️ **Décisions clés Story 4.6** :
- Countdown badge 60s tick (vs 1s) — efficient
- PII masking interceptor backend (vs frontend) — defense in depth
- Department-level postal area + "Marie L." standard marketplace pattern
- Cron `@Cron('*/5 * * * *')` 5-min granularity auto-expire
- BATCH_SIZE=100 + iterate until empty
- Error isolation per-booking
- Reminder cron daily 10:00 Europe/Paris business hours
- `pro.reminder-pending-bookings.v1` on BOOKING stream (vs NEW PRO stream — semantic)
- Story 4.7 deferred full accept/refuse + Stripe capture + full PII reveal + audit event
- `useBookingDetail` Story 4.5 baseline réutilisé Pro view (backend handles masking)
- 2 placeholder disabled CTAs in detail page + chat toggle placeholder
- EmptyState seller-no-bookings Story 0.5 baseline réutilisé directly

### References

- [Source: epics.md#Epic-4-Story-4.6 — Lines 1679-1693]
- [Source: prd.md#FR42 (Pro pending requests 48h), #FR45 (anti-désintermédiation — Story 4.7 finalise full), #NFR1 (RGPD), #NFR48 (Pro engagement SLA), #NFR82 (audit), #NFR47-55 (RGAA AA), #NFR71 (coverage)]
- [Source: architecture.md — ADR-001 Clean Architecture, ADR-003 DB per service, ADR-006 saga choreographed, ADR-007 transactional outbox, ADR-008 internal endpoint auth, ADR-013 multi-zones Vercel, ADR-014 envelope, lines 412 (apps/seller role pro), 419-422 (multi-zones rewrites /seller/*), 826-838 (seller features bookings mapping), 2120-2164 (Pretre canonical), 2208-2241 (@tukio/ui shared), 2331 (FR34-48 → seller bookings)]
- [Source: ux-design-specification.md — L264 (screens/seller-bookings.jsx figé bundle), L1243 (EmptyState seller-no-bookings UX-DR16), L1474 (microcopy seller booking)]
- [Source: Stories 0.2/0.4/0.5/0.6/0.7/0.9/0.10/0.11/0.12/0.13/1.2/1.4/1.9/1.10/2.2/2.3/4.1/4.4/4.5]
- [External: https://docs.nestjs.com/techniques/task-scheduling — NestJS @nestjs/schedule docs Cron decorator]
- [External: https://www.postgresql.org/docs/16/queries-with.html — Postgres GROUP BY + partial index pattern]
- [External: https://docs.nestjs.com/interceptors — NestJS Interceptors pattern]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir par dev-story)

### Debug Log References

### Completion Notes List

(points d'attention pour :
- **Story 4.7 (pro accept/refuse + Stripe capture trigger + full PII reveal + audit booking.pii-revealed.v1 event)** : Story 4.7 enables 2 CTAs Accept/Refuse Story 4.6 placeholder + transitions Booking via Story 4.1 aggregate methods + payment-svc capture Story 4.2 + Story 4.6 BookingPiiMaskInterceptor unmasks for `confirmed/completed` status post-accept (already implemented Story 4.6) + NEW audit event `booking.pii-revealed.v1` (Story 4.7) when Pro first views post-accept booking
- **Story 4.8 (customer cancellation flow + refund policy)** : independent
- **Story 4.10 (auto-payout cron J+1)** : reuses pattern Story 4.6 `@Cron` task scheduling. `complete-booking.usecase` Story 4.1 skeleton + Story 4.10 finalise full
- **Story 4.11 (customer + pro bookings list/detail UI)** : reuses `useListProBookings` + cursor pagination Story 4.6 pattern, adds Customer-side `/customer/bookings` + detail
- **Story 4.12 (admin refund + reconciliation)** : reuses BookingPiiMaskInterceptor Story 4.6 pattern (admin sees full PII)
- **Story 4.13 (saga monitoring R11)** : consumes `tukio_booking_auto_expired_total` metric Story 4.6 baseline + Grafana dashboard saga-health
- **Story 5.4 (notification-svc Resend email templates)** : consumes Story 4.6 events `pro.reminder-pending-bookings.v1` + `booking.refused.v1` (auto-expired reason) → email Pro "5 demandes attendent" + email Customer "Désolé Pro n'a pas répondu". notification-svc Pretre baseline Story 5.4 + Resend integration
- **Story 5.x V1 (chat anti-désintermédiation regex masking FR45/R6)** : Story 4.6 baseline chat toggle disabled placeholder — Story 5.x V1 finalise full chat + PII regex detection
- **Story 8.x V1 (multi-vendor parallel saga + B2B)** : Story 4.6 mono-vendor pattern reusable per-vendor)

### File List

(à remplir par dev-story)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-15
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 4 — Booking, Cart & Payment Saga (MVP) — **Pro UX critique + auto-expire 48h SLA production-ready + anti-désintermédiation baseline**
- **Sprint cible** : Sprint 5 (6ᵉ story Epic 4 — peut run en parallèle avec Story 4.7 si team capacity allows — Story 4.6 independent backend Stories 4.1/4.4/4.5 livrés)
- **Estimation effort** : **5-7 jours** (1 dev fullstack senior — auto-expire-booking.usecase FULL + cron + reminder cron + BookingPiiMaskInterceptor + 2 gateway endpoints + 4 frontend components + 2 frontend pages + CountdownBadge live tick + EmptyState reuse + i18n FR/EN ~45 keys + cross-zone verify + repo new methods + 4 integration tests + 8 Playwright e2e + Lighthouse + axe-core + ~40 fichiers)
- **Dépendances upstream** :
  - Stories 0.2 (contracts), 0.4 (atomics Avatar/Card/Button/Badge/Skeleton), 0.5 (patterns EmptyState seller-no-bookings UX-DR16), 0.6 (Pretre + boundaries lint), 0.7 (@tukio/messaging OutboxPublisher), 0.9 (TanStack Query + next-intl + axe-core + i18n CI lint), 0.10 (docker-compose), 0.11 (CI Lighthouse + perf budgets), 0.12 (Prometheus + Grafana baseline), 0.13 (Vercel multi-zones rewrites)
  - Stories 1.2 (gateway KeycloakJwtGuard + Roles + envelope + throttle), 1.4 (login flow + middleware + requireAuth helper Story 1.4 baseline server-side), 1.9 (@nestjs/schedule baseline ScheduleModule.forRoot), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact)
  - Stories 2.2 (apps/seller scaffolded baseline + onboarding wizard), 2.3 (cursor pagination canonical)
  - **Story 4.1 (booking-svc Pretre + Booking aggregate + autoExpire method + auto-expire-booking.usecase skeleton + idx_booking_pending_expires_at + idx_booking_pro_pending_expires partial indexes + booking.refused.v1 schema — Story 4.6 EXTEND FULL impl)**
  - Story 4.4 (booking.controller.ts internal endpoints baseline — Story 4.6 EXTEND add pro endpoints)
  - Story 4.5 (useBookingDetail baseline — Story 4.6 réutilise Pro view via interceptor backend)
- **Dépendances downstream** (Epic 4 + cross-Epic) :
  - **Story 4.7 (pro accept/refuse + Stripe capture + full PII reveal + audit event)** : enables disabled CTAs Story 4.6 placeholders + reuses BookingPiiMaskInterceptor Story 4.6 (already handles post-accept reveal via status filter)
  - Story 4.8 (customer cancellation flow)
  - Story 4.10 (auto-payout cron J+1 — reuses cron pattern Story 4.6)
  - Story 4.11 (customer + pro bookings list/detail UI — reuses useListProBookings + cursor pagination + interceptor pattern)
  - Story 4.12 (admin refund — reuses BookingPiiMaskInterceptor for admin full PII access)
  - Story 4.13 (saga monitoring R11 — consumes auto-expired metric)
  - Story 5.4 (notification-svc — consumes `pro.reminder-pending-bookings.v1` + `booking.refused.v1` events → Resend emails)
  - Story 5.x V1 (chat anti-désintermédiation regex — Story 4.6 baseline chat toggle disabled placeholder)
  - Story 8.x V1 (multi-vendor parallel saga + B2B — mono-vendor pattern reusable)
- **FRs covered** :
  - **FR42** ✅ Pro pending requests page with 48h deadline countdown
  - **FR45 baseline** ✅ Anti-désintermédiation PII masking interceptor (Story 4.7 finalises full post-accept reveal + audit event)
- **NFRs touchés** :
  - **NFR1** ✅ RGPD + PII masking strict (no fullName/email/phone for pending status)
  - **NFR42** ✅ Outbox publish `booking.refused.v1` via Story 0.7 pattern
  - **NFR48** ✅ Pro engagement reminder cron baseline `> 5 pending > 24h` + event emitted
  - **NFR47-55** ✅ RGAA AA + axe-core 0 violations + countdown screen reader aria-label
  - **NFR71** ✅ Coverage thresholds enforced
  - **NFR82** ✅ Audit `booking.refused.v1` (reason `__system_auto_expired__`) consumed Story 2.7 audit_log automatically

> **Prochaine story → Story 4.7** (pro accept/refuse workflow + Stripe capture trigger + full PII reveal + audit event — enables disabled CTAs Story 4.6 placeholders + Booking aggregate transitions Story 4.1 + payment-svc capture Story 4.2 + Customer email notification "Pro a accepté" Story 5.4 future). Story 4.6 + 4.7 ensemble closes the Pro side of booking lifecycle MVP. Stories 4.8/4.10/4.11/4.12/4.13 parallel after.

---

**Dev agent next steps :**
1. Lire ce file complètement (~ 900 lignes)
2. Vérifier upstream Stories 0.2/0.4/0.5/0.6/0.7/0.9/0.10/0.11/0.12/0.13/1.2/1.4/1.9/1.10/2.2/2.3/4.1/4.4/4.5 implémentées (`sprint-status.yaml` — Stories 4.1 + 4.4 + 4.5 doivent être `done` AVANT Story 4.6 dev)
3. **Lire l'état complet de chaque UPDATE file Story 4.1/4.4/4.5 avant édition** — particularly :
   - `auto-expire-booking.usecase.ts` Story 4.1 skeleton (preserve ports + signature)
   - `booking.typeorm.repository.ts` (preserve all 4 stories of methods + transactional outbox + optimistic lock + GIST)
   - `booking.controller.ts` Story 4.4 (preserve all endpoints customer + cart)
4. Implémenter Tasks 1-12 dans l'ordre :
   - **Tasks 1-3 backend auto-expire FULL + interceptor + reminder cron + repo methods** (Phase 1, ~1.5-2 jours)
   - **Task 4 gateway-api endpoints + forwarders + DTOs + booking-svc internal endpoints** (Phase 2, ~1 jour)
   - **Tasks 5-7 frontend pages + components** (Phase 3, ~2 jours)
   - **Task 8 api-client hooks** (Phase 4, ~0.5 jour)
   - **Tasks 9-10 i18n + cross-zone verify** (Phase 5, ~0.5 jour)
   - **Tasks 11-12 e2e + Lighthouse + axe-core + lint + docs + commit** (Phase 6, ~1 jour)
5. Lancer `pnpm --filter=booking-svc lint && pnpm --filter=booking-svc test --coverage` + `pnpm --filter=seller lint && pnpm --filter=seller test --coverage` après chaque jalon
6. Commit Story 4.6 quand :
   - 0 violations boundaries lint booking-svc/usecases + apps/seller/features
   - Coverage NFR71 thresholds (≥ 90 % components/usecases/interceptor + ≥ 85 % gateway/hooks + ≥ 80 % infra)
   - 8 Playwright e2e + axe-core 0 violations + Lighthouse Accessibility ≥ 90 + LCP < 1.5s
   - 4 integration backend tests pass (auto-expire, reminder, interceptor, list-pro)
   - Handoff Stories 4.7/5.4/8.x V1 documented project-context + completion notes Stories 4.1 + 4.5 updated
   - PR ouvert vers `develop`
