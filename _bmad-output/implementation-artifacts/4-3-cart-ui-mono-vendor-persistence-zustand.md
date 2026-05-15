# Story 4.3: Cart UI mono-vendor + persistence Zustand + cross-zone guest+user sync (`/fr/cart`)

Status: ready-for-dev

> ⚠️ **ADR-016 / Story 0.14 (2026-05-15) — frontend topology pivot — IMPACT MAJEUR sur cette story**
> `apps/customer` a été mergé dans `apps/public` (apex `tukio.one` unifié).
> Conséquences architecturales sur ce cart store :
> - **Le cross-zone cookie `tukio-cart-id` n'est plus nécessaire** : listing detail (Story 3.10) et cart page vivent maintenant dans la même app `apps/public` sur le même domain → **LocalStorage zone-local suffit**, pas besoin de bridge cookie cross-subdomain.
> - **Le store Zustand peut rester dans `packages/ui/src/stores/`** (toujours partagé avec `apps/seller` cross-zone) OU être déplacé dans `apps/public/src/features/cart/stores/` (plus simple — la justification UX spec L766-768 disparaît post-merge).
> - **Le merge anonymous → customer** post-login devient trivial (même origin, même LocalStorage).
> - **Routes `/fr/cart` et `/fr/checkout`** : à placer dans `apps/public/[locale]/(authenticated)/cart/` (route group Story 0.14, gated par middleware).
> - Toute référence ci-dessous à `customer.tukio.one` se lit `tukio.one`.
> Cette story bénéficie d'une simplification significative — re-évaluer le scope LocalStorage-only avant implémentation.
> Voir `docs/adr/0016-frontend-topology-pivot-apex-unified.md` et Story 0.14.

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As a** frontend developer Tukio (gardien design system `@tukio/ui` + feature-based architecture customer app + i18n FR/EN strict + Zustand store discipline + cross-zone state sync multi-zones Vercel),
**I want** **livrer le tunnel cart MVP end-to-end** : Zustand `cartStore` shared cross-apps (apps/public listing detail Story 3.10 → apps/customer cart page Story 4.3) + persistence dual-layer (cookie cross-zone `tukio-cart-id` + LocalStorage zone-local + backend `POST /v1/carts/<cartId>/lines` sync pour Customer authentifié) + page `/fr/cart` mono-vendor + modal warning replace-cart si autre Pro + `<EmptyState variant="cart-empty">` + redirect login preserving cart state + CTA "Procéder au paiement" → `/fr/checkout` (placeholder Story 4.4/4.5) — with :

- (a) **Zustand `cartStore` shared cross-apps** (`packages/ui/src/stores/cart.store.ts`) — décision : **promote cart store to `@tukio/ui/stores/`** (vs `apps/customer/features/cart-checkout/stores/` per UX spec L766-768) parce que Story 3.10 listing detail vit dans `apps/public` (zone parent) ET le cart page vit dans `apps/customer` (zone enfant) — multi-zones Vercel ne partagent PAS le bundle, donc le store DOIT être dans le package shared `@tukio/ui` pour être consommé par les 2 apps avec la même API + même types + même persist config. Pattern Zustand v5 latest stable + `persist` middleware + `subscribeWithSelector` + `immer` pour mutations cohérentes :
```ts
// packages/ui/src/stores/cart.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';

export interface CartLineSnapshot {
  listingId: string;
  listingSlug: string;          // for routing back to listing detail
  listingSnapshot: {              // frozen at add-to-cart time — anti-changement prix post-add
    titleFr: string;
    titleEn: string | null;
    photoThumbnailUrl: string | null;
    pricing: { mode: 'unit' | 'package'; amountCents: number; currency: 'EUR'; unit?: string; minQuantity?: number | null; maxQuantity?: number | null; packageDescription?: string };
    serviceArea: { originPostalCode: string; deliveryRadiusKm: number; minLeadTimeDays: number };
    proProfileId: string;          // mono-vendor enforcement key
    proDisplayName: string;        // for UI display + replace-cart modal
    proUserProfileId: string;      // for self-booking check (epic Story 4.1 invariant)
  };
  quantity: number;
  period: { startAt: string; endAt: string } | null;  // null si pas encore picked (cart minimal MVP — full period selection in checkout Story 4.5)
  options: { id: string; label: string; priceCents: number }[];  // MVP empty array — V1+ FR
  addedAt: string;                // ISO 8601
  lineId: string;                 // local UUID v7 — different from backend cart_line.id when synced
}

export interface CartState {
  cartId: string | null;          // null until first line added — UUID v7 nanoid set on first add
  lines: CartLineSnapshot[];
  proProfileId: string | null;    // computed mono-vendor key — null if cart empty
  lastSyncedAt: string | null;    // ISO 8601 — last successful backend sync (for authenticated Customer)
  syncStatus: 'idle' | 'syncing' | 'error';
  // Computed
  isEmpty: () => boolean;
  isMultiVendor: (newProProfileId: string) => boolean;
  totalAmountCents: () => number;
  totalCount: () => number;
  // Actions
  addLine: (input: Omit<CartLineSnapshot, 'lineId' | 'addedAt'>) => { kind: 'added' } | { kind: 'multi_vendor_warning'; existingProDisplayName: string; newProDisplayName: string; pendingLine: CartLineSnapshot } | { kind: 'self_booking_forbidden' };
  replaceCart: (pendingLine: CartLineSnapshot) => void;  // confirm multi-vendor warning modal
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  // Backend sync (no-op si guest)
  syncToBackend: (authenticatedUserId: string | null) => Promise<void>;
  hydrateFromBackend: (authenticatedUserId: string | null) => Promise<void>;
}

export const useCartStore = create<CartState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        cartId: null,
        lines: [],
        proProfileId: null,
        lastSyncedAt: null,
        syncStatus: 'idle',
        isEmpty: () => get().lines.length === 0,
        isMultiVendor: (newProProfileId) => {
          const current = get().proProfileId;
          return current !== null && current !== newProProfileId;
        },
        totalAmountCents: () => get().lines.reduce((sum, line) => sum + computeLineTotal(line), 0),
        totalCount: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
        addLine: (input) => {
          const state = get();
          // mono-vendor enforcement
          if (state.proProfileId && state.proProfileId !== input.listingSnapshot.proProfileId) {
            // pending modal warning — caller dispatches replace UI
            const pendingLine: CartLineSnapshot = { ...input, lineId: nanoid(), addedAt: new Date().toISOString() };
            return { kind: 'multi_vendor_warning', existingProDisplayName: state.lines[0]?.listingSnapshot.proDisplayName ?? '', newProDisplayName: input.listingSnapshot.proDisplayName, pendingLine };
          }
          set((draft) => {
            if (!draft.cartId) draft.cartId = nanoid();
            const newLine: CartLineSnapshot = { ...input, lineId: nanoid(), addedAt: new Date().toISOString() };
            // merge by listingId — same listing added twice → bump quantity (MVP simple)
            const existing = draft.lines.find((l) => l.listingId === input.listingId);
            if (existing) {
              existing.quantity += input.quantity;
            } else {
              draft.lines.push(newLine);
              draft.proProfileId = input.listingSnapshot.proProfileId;
            }
          });
          return { kind: 'added' };
        },
        replaceCart: (pendingLine) => {
          set((draft) => {
            draft.cartId = nanoid();  // new cart for new vendor
            draft.lines = [pendingLine];
            draft.proProfileId = pendingLine.listingSnapshot.proProfileId;
          });
        },
        updateQuantity: (lineId, quantity) => {
          set((draft) => {
            const line = draft.lines.find((l) => l.lineId === lineId);
            if (!line) return;
            if (quantity <= 0) {
              draft.lines = draft.lines.filter((l) => l.lineId !== lineId);
              if (draft.lines.length === 0) {
                draft.cartId = null;
                draft.proProfileId = null;
              }
            } else {
              const max = line.listingSnapshot.pricing.maxQuantity;
              const min = line.listingSnapshot.pricing.minQuantity ?? 1;
              line.quantity = Math.max(min, max ? Math.min(quantity, max) : quantity);
            }
          });
        },
        removeLine: (lineId) => {
          set((draft) => {
            draft.lines = draft.lines.filter((l) => l.lineId !== lineId);
            if (draft.lines.length === 0) {
              draft.cartId = null;
              draft.proProfileId = null;
            }
          });
        },
        clear: () => {
          set((draft) => {
            draft.cartId = null;
            draft.lines = [];
            draft.proProfileId = null;
            draft.lastSyncedAt = null;
          });
        },
        syncToBackend: async (authenticatedUserId) => { /* implementation Tasks 5+6 */ },
        hydrateFromBackend: async (authenticatedUserId) => { /* implementation Tasks 5+6 */ },
      })),
      {
        name: 'tukio-cart',
        storage: createJSONStorage(() => localStorage),     // zone-local — guest cart visible per-zone
        partialize: (state) => ({ cartId: state.cartId, lines: state.lines, proProfileId: state.proProfileId, lastSyncedAt: state.lastSyncedAt }),
        version: 1,
        migrate: (persistedState, version) => persistedState, // V1+ schema migration helper
      }
    )
  )
);

// Helper exported with store
export function computeLineTotal(line: CartLineSnapshot): number {
  const base = line.listingSnapshot.pricing.mode === 'unit'
    ? line.listingSnapshot.pricing.amountCents * line.quantity
    : line.listingSnapshot.pricing.amountCents; // package = flat
  const optionsTotal = line.options.reduce((sum, o) => sum + o.priceCents, 0);
  return base + optionsTotal;
}
```

- (b) **Cross-zone cookie `tukio-cart-id`** (Domain=`.tukio.one`, Path=`/`, SameSite=Lax, Secure, **non-HttpOnly** car lu côté client par les apps) — pattern Story 1.4 KeycloakAuthMiddleware cookie strategy réutilisé. Le cookie ne contient que le `cartId` (UUID v7 nanoid) — il sert de **pont cross-zone** entre `apps/public` (zone parent `tukio.one`) et `apps/customer` (sous-zone `customer.tukio.one`). Le contenu cart vit dans LocalStorage zone-local (per-zone, mais le cartId unique permet de hydrate from backend en cross-zone si user authentifié). Pour guest (non-authentifié), si le user navigue de `tukio.one/services/<slug>` → `customer.tukio.one/cart`, le cookie shared garantit que le LocalStorage zone-customer peut être hydraté depuis le backend (`GET /v1/carts/<cartId>` — endpoint MVP minimal Story 4.3) si jamais cart-id existe côté backend (cas user qui avait login précédemment + s'est logged out OU multi-device).

- (c) **Page `/fr/cart`** (`apps/customer/src/app/[locale]/cart/page.tsx`) — **`'use client'`** (Zustand store + interactivity heavy) — layout :
```tsx
'use client';
import { useTranslations } from 'next-intl';
import { useCartStore, computeLineTotal } from '@tukio/ui/stores/cart.store';
import { Card } from '@tukio/ui/components/Card';
import { Button } from '@tukio/ui/components/Button';
import { Badge } from '@tukio/ui/components/Badge';
import { PricingDisplay } from '@tukio/ui/patterns/PricingDisplay';
import { EmptyState } from '@tukio/ui/patterns/EmptyState';
import { QuantitySelector } from '@tukio/ui/patterns/QuantitySelector';
import { CartLineItem } from '@/features/cart-checkout/components/CartLineItem';
import { CartSummary } from '@/features/cart-checkout/components/CartSummary';
import { useAuth } from '@tukio/auth-client/hooks';
import { useRouter } from '@/i18n/navigation';

export default function CartPage() {
  const t = useTranslations('customer.cart');
  const router = useRouter();
  const { user } = useAuth();
  const lines = useCartStore((s) => s.lines);
  const isEmpty = useCartStore((s) => s.isEmpty());
  const totalAmountCents = useCartStore((s) => s.totalAmountCents());

  if (isEmpty) {
    return (
      <main aria-labelledby="cart-heading">
        <h1 id="cart-heading" className="sr-only">{t('title')}</h1>
        <EmptyState
          variant="cart-empty"
          title={t('empty.title')}
          description={t('empty.description')}
          cta={{ label: t('empty.cta'), href: '/category/tents-marquees' }}    // points to public zone — Next.js Link cross-zone via Vercel rewrites
        />
      </main>
    );
  }

  const handleCheckout = () => {
    if (!user) {
      // preserve cart state — Zustand persist already in LocalStorage, redirect with redirectTo
      router.push(`/auth/login?redirectTo=${encodeURIComponent('/checkout')}`);
      return;
    }
    router.push('/checkout');   // Story 4.4/4.5 livre la page checkout
  };

  return (
    <main aria-labelledby="cart-heading" className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 id="cart-heading" className="font-display text-3xl text-charcoal-900 mb-6">{t('title')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section aria-label={t('linesSection.label')} className="lg:col-span-2 space-y-4">
          {lines.map((line) => (
            <CartLineItem key={line.lineId} line={line} />
          ))}
        </section>
        <aside aria-label={t('summarySection.label')} className="lg:col-span-1">
          <CartSummary totalAmountCents={totalAmountCents} onCheckout={handleCheckout} />
        </aside>
      </div>
    </main>
  );
}
```

- (d) **`<CartLineItem>` feature-component** (`apps/customer/src/features/cart-checkout/components/CartLineItem.tsx`) :
```tsx
'use client';
import { Card } from '@tukio/ui/components/Card';
import { Button } from '@tukio/ui/components/Button';
import { QuantitySelector } from '@tukio/ui/patterns/QuantitySelector';
import { useCartStore, computeLineTotal } from '@tukio/ui/stores/cart.store';
import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency } from '@tukio/i18n-client/formatters';
import { Trash2 } from 'lucide-react';

export function CartLineItem({ line }: { line: CartLineSnapshot }) {
  const t = useTranslations('customer.cart.line');
  const locale = useLocale();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const title = locale === 'en' ? (line.listingSnapshot.titleEn ?? line.listingSnapshot.titleFr) : line.listingSnapshot.titleFr;
  const showFallbackBadge = locale === 'en' && !line.listingSnapshot.titleEn;

  return (
    <Card className="p-4 flex gap-4">
      {/* Thumbnail or Placeholder */}
      {line.listingSnapshot.photoThumbnailUrl ? (
        <img src={line.listingSnapshot.photoThumbnailUrl} alt="" className="w-24 h-24 rounded-md object-cover" loading="lazy" />
      ) : (
        <div className="w-24 h-24 rounded-md bg-charcoal-100 flex items-center justify-center" aria-hidden="true">…</div>
      )}
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-charcoal-900">
              <a href={`https://tukio.one/${locale}/services/${line.listingSnapshot.listingSlug}`} className="hover:underline focus:outline-none focus-visible:ring-2 ring-terracotta-500">
                {title}
              </a>
              {showFallbackBadge && <span className="ml-2 inline-block"><Badge variant="info" size="sm">{t('fallbackBadgeFr')}</Badge></span>}
            </h3>
            <p className="text-sm text-charcoal-500">{line.listingSnapshot.proDisplayName}</p>
          </div>
          <Button variant="ghost" size="sm" iconOnly aria-label={t('removeAria', { title })} onClick={() => removeLine(line.lineId)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <QuantitySelector
            min={line.listingSnapshot.pricing.minQuantity ?? 1}
            max={line.listingSnapshot.pricing.maxQuantity ?? undefined}
            value={line.quantity}
            onChange={(q) => updateQuantity(line.lineId, q)}
            aria-label={t('quantityAria', { title })}
          />
          <span className="font-medium text-charcoal-900">
            {formatCurrency(computeLineTotal(line), 'EUR', locale)}
          </span>
        </div>
      </div>
    </Card>
  );
}
```

- (e) **`<CartSummary>` feature-component** (`apps/customer/src/features/cart-checkout/components/CartSummary.tsx`) — wraps `<PricingDisplay>` Story 0.5 :
```tsx
'use client';
import { Card } from '@tukio/ui/components/Card';
import { Button } from '@tukio/ui/components/Button';
import { PricingDisplay } from '@tukio/ui/patterns/PricingDisplay';
import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency } from '@tukio/i18n-client/formatters';

const COMMISSION_RATE_MVP = 0.15;   // FR65 MVP — Story 9.x V1 tiers

export function CartSummary({ totalAmountCents, onCheckout }: { totalAmountCents: number; onCheckout: () => void }) {
  const t = useTranslations('customer.cart.summary');
  const locale = useLocale();
  const commissionCents = Math.round(totalAmountCents * COMMISSION_RATE_MVP);
  const proRevenueCents = totalAmountCents - commissionCents;
  // TVA placeholder Story 4.9 finalisera — MVP afficher "Calculé au checkout"

  return (
    <Card className="p-6 sticky top-24 space-y-4" role="region" aria-label={t('label')}>
      <h2 className="font-display text-xl text-charcoal-900">{t('title')}</h2>
      <PricingDisplay
        lines={[
          { label: t('subtotalHt'), value: formatCurrency(proRevenueCents, 'EUR', locale), variant: 'default' },
          { label: t('tukioCommission'), value: formatCurrency(commissionCents, 'EUR', locale), variant: 'default', tooltip: t('tukioCommissionTooltip') },
          { label: t('vat'), value: t('vatComputedAtCheckout'), variant: 'muted' },
        ]}
        total={{ label: t('total'), value: formatCurrency(totalAmountCents, 'EUR', locale), variant: 'highlighted' }}
      />
      <p className="text-sm text-charcoal-500">{t('deferredCaptureNotice')}</p>
      <Button variant="primary" size="lg" fullWidth onClick={onCheckout}>
        {t('checkoutCta')}
      </Button>
      <p className="text-xs text-charcoal-400 text-center">{t('cancellationPolicy')}</p>
    </Card>
  );
}
```

- (f) **`<MultiVendorWarningModal>` feature-component** (`apps/customer/src/features/cart-checkout/components/MultiVendorWarningModal.tsx`) — Story 3.10 `CtaReserveSticky.tsx` UPDATE dispatchera ce modal en consume du retour `addLine({ kind: 'multi_vendor_warning' })` :
```tsx
'use client';
import { Modal } from '@tukio/ui/components/Modal';
import { Button } from '@tukio/ui/components/Button';
import { useTranslations } from 'next-intl';

export interface MultiVendorWarningModalProps {
  open: boolean;
  existingProDisplayName: string;
  newProDisplayName: string;
  onReplace: () => void;
  onKeep: () => void;
}

export function MultiVendorWarningModal(props: MultiVendorWarningModalProps) {
  const t = useTranslations('customer.cart.multiVendorWarning');
  return (
    <Modal
      open={props.open}
      onClose={props.onKeep}
      title={t('title')}
      description={t('description', { existingPro: props.existingProDisplayName, newPro: props.newProDisplayName })}
      requireExplicitClose={false}                         // not destructive — informational decision
      ariaLabelledBy="multi-vendor-warning-title"
    >
      <p className="text-charcoal-700">{t('body', { existingPro: props.existingProDisplayName })}</p>
      <p className="text-sm text-charcoal-500 mt-2">{t('multiVendorComingV1')}</p>
      <div className="flex gap-3 mt-6 justify-end">
        <Button variant="ghost" onClick={props.onKeep}>{t('keepCart')}</Button>
        <Button variant="primary" onClick={props.onReplace}>{t('replaceCart')}</Button>
      </div>
    </Modal>
  );
}
```

- (g) **Story 3.10 `CtaReserveSticky.tsx` UPDATE** (`apps/public/src/features/public/service-detail/components/CtaReserveSticky.tsx`) — Story 3.10 livre un placeholder `router.push('/{locale}/cart?listingId=...')`. Story 4.3 transforme en :
```tsx
'use client';
import { Button } from '@tukio/ui/components/Button';
import { useCartStore } from '@tukio/ui/stores/cart.store';
import { useToast } from '@tukio/ui/components/Toast';
import { MultiVendorWarningModal } from '@/features/public/service-detail/components/MultiVendorWarningModal';
import { useRouter } from '@/i18n/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function CtaReserveSticky({ listing }: { listing: ListingDetailResponse }) {
  const t = useTranslations('public.serviceDetail.cta');
  const router = useRouter();
  const toast = useToast();
  const addLine = useCartStore((s) => s.addLine);
  const [warning, setWarning] = useState<null | { existingPro: string; newPro: string; pendingLine: CartLineSnapshot }>(null);

  const handleReserve = () => {
    const result = addLine({
      listingId: listing.id,
      listingSlug: listing.slug,
      listingSnapshot: { /* derive from listing */ },
      quantity: listing.pricing.minQuantity ?? 1,
      period: null,                                          // picked at checkout Story 4.5
      options: [],
    });
    if (result.kind === 'multi_vendor_warning') {
      setWarning({ existingPro: result.existingProDisplayName, newPro: result.newProDisplayName, pendingLine: result.pendingLine });
      return;
    }
    if (result.kind === 'self_booking_forbidden') {
      toast.show({ variant: 'error', title: t('selfBookingTitle'), description: t('selfBookingDescription') });
      return;
    }
    toast.show({ variant: 'success', title: t('addedTitle'), description: t('addedDescription'), action: { label: t('addedSeeCart'), onClick: () => router.push('/cart') } });
  };

  const handleReplace = () => {
    if (!warning) return;
    useCartStore.getState().replaceCart(warning.pendingLine);
    setWarning(null);
    toast.show({ variant: 'success', title: t('replacedTitle'), action: { label: t('addedSeeCart'), onClick: () => router.push('/cart') } });
  };

  return (
    <>
      <div className="sticky top-24 lg:top-32 z-10 lg:static lg:z-0 fixed bottom-0 left-0 right-0 lg:relative bg-white border-t lg:border-t-0 p-4 lg:p-6">
        <Button variant="primary" size="lg" fullWidth onClick={handleReserve}>{t('reserve')}</Button>
        <p className="text-sm text-charcoal-500 text-center mt-2">{t('deferredCaptureExplanation')}</p>
      </div>
      <MultiVendorWarningModal
        open={warning !== null}
        existingProDisplayName={warning?.existingPro ?? ''}
        newProDisplayName={warning?.newPro ?? ''}
        onReplace={handleReplace}
        onKeep={() => setWarning(null)}
      />
    </>
  );
}
```

- (h) **Backend cart persistence — booking-svc EXTEND Story 4.1 baseline** :
  - **DB migration** `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-CreateCartTables.ts` — tables `cart` + `cart_line` dans `tukio_booking` (per epic L1637 "MVP simple table dans `tukio_booking`") :
    ```sql
    CREATE TABLE cart (
      id UUID PRIMARY KEY,                                                                          -- UUID v7 — matches frontend cartId
      customer_profile_id UUID NULL,                                                                -- NULL for guest carts — populated when user logs in + merges
      pro_profile_id UUID NULL,                                                                     -- mono-vendor MVP — NULL if cart empty
      total_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
      total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                          -- for cron expire-stale-carts > 30 days V1+
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );
    CREATE INDEX idx_cart_customer ON cart (customer_profile_id) WHERE customer_profile_id IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX idx_cart_last_activity ON cart (last_activity_at) WHERE deleted_at IS NULL;
    CREATE TRIGGER cart_updated_at BEFORE UPDATE ON cart FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    CREATE TABLE cart_line (
      id UUID PRIMARY KEY,                                                                          -- UUID v7
      cart_id UUID NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
      listing_id UUID NOT NULL,                                                                     -- FK logique cross-svc → catalog-svc.listing.id
      listing_snapshot JSONB NOT NULL,                                                              -- frozen at add-to-cart time (anti-changement prix MVP)
      quantity INTEGER NOT NULL CHECK (quantity >= 1),
      period_start_at TIMESTAMPTZ NULL,                                                             -- MVP NULL at add — picked at checkout
      period_end_at TIMESTAMPTZ NULL,
      options JSONB NOT NULL DEFAULT '[]'::jsonb,
      unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
      line_total_cents BIGINT NOT NULL CHECK (line_total_cents >= 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_cart_line_cart ON cart_line (cart_id);
    CREATE UNIQUE INDEX uniq_cart_line_listing ON cart_line (cart_id, listing_id);                  -- 1 line per (cart, listing) — merge by listing on add
    CREATE TRIGGER cart_line_updated_at BEFORE UPDATE ON cart_line FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    ```
  - **Domain extension** `apps/booking-svc/src/domain/model/cart/` (NEW sub-folder dans booking-svc Story 4.1) — choix architecture : **simple `Cart` aggregate + `CartLine` entity** (mono-vendor invariant + total computation), pas de state machine (cart est mutable jusqu'à checkout) :
    - `cart.aggregate.ts` — `{ id, customerProfileId?, proProfileId?, lines: CartLine[], lastActivityAt, version, uncommittedEvents }` + méthodes `addLine(listingSnapshot, quantity, options, period?)` (mono-vendor invariant + self-booking-forbidden invariant + merge-by-listing) + `updateLineQuantity(lineId, qty)` + `removeLine(lineId)` + `replaceForNewVendor(pendingLine)` + `clear()` + `assignToCustomer(customerProfileId)` (anonymous → authenticated merge)
    - `cart-line.entity.ts` — `{ id, listingId, listingSnapshot: ListingSnapshot (VO réutilisé Story 4.1), quantity, options, period?, unitPriceCents, lineTotalCents, currency }`
    - `value-objects/cart-id.vo.ts` — `CartId` UUID v7 (réutilise pattern Story 4.1)
    - **NO state machine** (cart is mutable, no transitions)
    - **`uncommittedEvents` minimal** Story 4.3 — pas d'outbox event MVP (cart est UI-only, pas business event nécessaire MVP). Story 4.4 transformera cart → Booking via `book-listing.usecase.ts` Story 4.1 baseline.
  - **3 ports** `apps/booking-svc/src/domain/ports/cart/` :
    - `cart-repository.port.ts` (`ICartRepository`) — `findById(id)`, `findByCustomerProfileId(customerProfileId)` (1 active per customer MVP), `save(cart)`, `delete(id)` (hard delete on checkout success Story 4.4)
    - Réutilise `IListingSnapshotPort` Story 4.1 livré (cross-svc HTTP catalog-svc)
    - Réutilise `IEventPublisher` Story 0.7 (optional — MVP no events from cart, V1+ peut émettre `cart.line-added.v1` pour analytics)
  - **5 use cases** `apps/booking-svc/src/usecases/cart/` :
    - `get-cart.usecase.ts` — `{ cartId, customerProfileId? }` → returns `Cart` (full impl) — handles guest (cartId only) + authenticated (customerProfileId from JWT)
    - `add-cart-line.usecase.ts` — `{ cartId, listingId, quantity, options, customerProfileId?, period? }` → calls `listingSnapshot.fetch(listingId)` (Story 4.1 `IListingSnapshotPort` réutilisé) + `cart.addLine(snapshot, quantity, options, period)` + invariants + `repository.save(cart)`
    - `update-cart-line.usecase.ts` — `{ cartId, lineId, quantity }`
    - `remove-cart-line.usecase.ts` — `{ cartId, lineId }`
    - `merge-anonymous-cart-to-customer.usecase.ts` — `{ guestCartId, customerProfileId }` — invoked on login Story 1.4 callback (cf. Files to UPDATE) : `cart.assignToCustomer(customerProfileId)` + merge with existing customer cart si conflit (replace existing OR keep most recent — MVP : "keep guest cart, discard old customer cart" decision documented)
  - **Exceptions** `apps/booking-svc/src/domain/exception/cart/` :
    - `cart-not-found.exception.ts` → 404 `CART-NOT-FOUND-001`
    - `cart-mono-vendor-violation.exception.ts` → 409 `CART-MONO-VENDOR-VIOLATION-002` (backend safety net — frontend bloque déjà via modal, mais backend valide aussi)
    - `cart-self-booking-forbidden.exception.ts` → 422 `CART-SELF-BOOKING-FORBIDDEN-003` (pro ne peut pas réserver son propre listing)
    - `cart-line-not-found.exception.ts` → 404 `CART-LINE-NOT-FOUND-004`
    - `cart-validation.exception.ts` → 422 `CART-VALIDATION-005`

- (i) **HTTP endpoints booking-svc + gateway-api forwarder** — pattern Story 0.6/1.10/4.1 réutilisé. gateway-api est seule surface publique (ADR-008) :
  - **gateway-api endpoints** (`apps/gateway-api/src/infrastructure/http/controllers/carts.controller.ts` NEW) :
    - `GET /v1/carts/:cartId` → `get-cart.forwarder.ts` → booking-svc internal `GET /internal/carts/:cartId?customerProfileId=<from-jwt>` — returns enveloppe `{ data: { cartId, lines: CartLineResponse[], totals } }`
    - `POST /v1/carts/:cartId/lines` → `add-cart-line.forwarder.ts` — body `{ listingId, quantity, options?, period? }` — auth optional (guest OR authenticated via Keycloak JWT)
    - `PATCH /v1/carts/:cartId/lines/:lineId` → `update-cart-line.forwarder.ts` — body `{ quantity }`
    - `DELETE /v1/carts/:cartId/lines/:lineId` → `remove-cart-line.forwarder.ts`
    - **Throttling** Story 1.2 réutilisé : 30 req/min/IP for guest, 60 req/min/user authenticated
    - **Enveloppe ADR-014** : toutes responses wrapped
  - **booking-svc internal endpoints** (`apps/booking-svc/src/infrastructure/http/controllers/cart.controller.ts` NEW — co-located with future booking endpoints Story 4.4) :
    - `GET /internal/carts/:cartId?customerProfileId=<optional>` (X-Internal-Service-Token Story 1.10 pattern)
    - `POST /internal/carts/:cartId/lines`
    - `PATCH /internal/carts/:cartId/lines/:lineId`
    - `DELETE /internal/carts/:cartId/lines/:lineId`
    - `POST /internal/carts/merge` (called by gateway-api on login Story 1.4 callback to merge guest cart to customer)
  - **DTOs** `packages/contracts/src/dtos/cart/` (NEW) :
    - `cart-detail.dto.ts` — `CartDetailResponseSchema` Zod
    - `add-cart-line-request.dto.ts` — `AddCartLineRequestSchema`
    - `update-cart-line-request.dto.ts`
    - `cart-line-response.dto.ts` — réutilise `ListingSnapshot` shape Story 4.1

- (j) **`@tukio/api-client` hooks** (`packages/api-client/src/hooks/cart/`) — TanStack Query hooks typés :
  - `useCart.ts` — `useQuery({ queryKey: ['cart', cartId, locale], queryFn: () => apiClient.get(`/v1/carts/${cartId}`).then(unwrapEnvelope), enabled: !!cartId, staleTime: 30s })`
  - `useAddCartLine.ts` — `useMutation({ mutationFn: (input) => apiClient.post(`/v1/carts/${cartId}/lines`, input).then(unwrapEnvelope), onSuccess: invalidate(['cart', cartId]) })`
  - `useUpdateCartLine.ts` — similar
  - `useRemoveCartLine.ts` — similar
  - Tests Vitest + msw (mock fetch) — coverage ≥ 85 %

- (k) **i18n FR/EN namespaces** :
  - `apps/customer/messages/{fr,en}.json` — namespace `customer.cart.*` ~30 keys (title, empty.title/description/cta, line.removeAria, line.quantityAria, line.fallbackBadgeFr, summary.title/subtotalHt/tukioCommission/tukioCommissionTooltip/vat/vatComputedAtCheckout/total/deferredCaptureNotice/checkoutCta/cancellationPolicy, multiVendorWarning.title/description/body/keepCart/replaceCart/multiVendorComingV1, errors.*)
  - `apps/public/messages/{fr,en}.json` — UPDATE `public.serviceDetail.cta.*` Story 3.10 — add keys `addedTitle/addedDescription/addedSeeCart/replacedTitle/selfBookingTitle/selfBookingDescription`
  - **i18n CI lint Story 0.9** : both files contain all keys, no orphans, no missing (`pnpm i18n:audit`)

- (l) **Cross-zone cookie strategy + Vercel multi-zones rewrites** :
  - **Cookie set** : when `cartStore.addLine` returns `{ kind: 'added' }`, set/refresh cookie `tukio-cart-id` Domain=.tukio.one Path=/ SameSite=Lax Secure (non-HttpOnly — readable by JS in both zones). Via `document.cookie = 'tukio-cart-id=...; ...'` côté client OR helper `@tukio/i18n-client/cookies.ts` (Story 0.9 baseline) extend.
  - **Vercel multi-zones (Story 0.13)** : `apps/public/next.config.ts` rewrites `/cart/*` → customer.tukio.one. Story 0.13 baseline + Story 4.3 verify route mappings include `/cart` + `/checkout` + `/auth/login`.
  - **Cross-zone hydration** : `apps/customer/src/app/[locale]/cart/page.tsx` reads cookie `tukio-cart-id` at mount via `document.cookie` or middleware (next-intl middleware Story 0.9 extend). If `localStorage.tukio-cart` is empty BUT cookie has `cartId`, trigger `cartStore.hydrateFromBackend(cartId, authenticatedUserId)` (calls `GET /v1/carts/<cartId>`).

- (m) **NFR3 LCP < 1s checkout — applicable to cart page hydration** :
  - Cart page is Client Component (Zustand) → hydration cost. Optimisations :
    - LocalStorage read sync (Zustand `persist` rehydration) — no network call MVP guest
    - Backend sync (`useCart`) lazy après render initial (loading state via Suspense)
    - No heavy data fetches in cart page MVP — lines come from LocalStorage hydrated state
    - Preload critical assets (Card, Button, PricingDisplay) via Tailwind v4 `@tukio/ui` tree-shaken
  - Lighthouse CI Story 0.11 add `/fr/cart` à budgets list (LCP < 1s p75, FID < 100ms)

- (n) **Tests** : `apps/customer/e2e/cart/cart.spec.ts` (NEW Playwright e2e) 12 scenarios :
  - T1 happy add-to-cart from listing detail → cart page render line item correctly
  - T2 multi-vendor warning modal triggers + replace confirms + cart reset to new vendor only
  - T3 multi-vendor warning + "keep" closes modal + cart unchanged
  - T4 quantity update + total recalculates + max/min enforcement
  - T5 remove line + empty state when last removed
  - T6 empty cart state with EmptyState variant cart-empty + CTA back to category
  - T7 unauthenticated checkout → redirect /auth/login?redirectTo=/checkout + after login, redirect back + cart preserved
  - T8 authenticated checkout → /checkout (placeholder Story 4.5)
  - T9 cross-zone cookie persistence : add line from /services/<slug> (public zone) → navigate to /cart (customer zone) → line is visible (cookie + LocalStorage cross-zone hydration)
  - T10 self-booking-forbidden (pro tries to add own listing) → error toast, line NOT added
  - T11 RGAA AA full kbd nav + axe-core 0 violations + Lighthouse Accessibility ≥ 90
  - T12 NFR3 LCP < 1s p75 cart page + 0 CLS during hydration

## Acceptance Criteria

1. **AC1 — Zustand `cartStore` shared `@tukio/ui/stores/cart.store.ts` + persist + immer + mono-vendor invariant** : Given Story 0.7 baseline + UX spec L755-770, When je consulte `packages/ui/src/stores/cart.store.ts`, Then :
   - **Zustand v5 latest stable** (`pnpm view zustand version` puis pinner latest stable — UX spec L824 baseline)
   - **`persist` middleware** + `createJSONStorage(() => localStorage)` + `name: 'tukio-cart'` + `version: 1` + `partialize` (exclude transient `syncStatus`)
   - **`subscribeWithSelector` middleware** pour fine-grained subscriptions
   - **`immer` middleware** pour mutations cohérentes (draft.lines.push, draft.proProfileId = ...)
   - **API publique** : `cartId, lines, proProfileId, lastSyncedAt, syncStatus, isEmpty(), isMultiVendor(newProProfileId), totalAmountCents(), totalCount(), addLine(input), replaceCart(pendingLine), updateQuantity(lineId, qty), removeLine(lineId), clear(), syncToBackend(authenticatedUserId), hydrateFromBackend(authenticatedUserId)` (cf. story body section a)
   - **`addLine` return type discriminated union** : `{ kind: 'added' } | { kind: 'multi_vendor_warning'; existingProDisplayName; newProDisplayName; pendingLine } | { kind: 'self_booking_forbidden' }`
   - **Mono-vendor invariant** enforced : si `proProfileId !== null && proProfileId !== input.listingSnapshot.proProfileId` → `{ kind: 'multi_vendor_warning' }`
   - **Self-booking-forbidden invariant** : si user authenticated et `input.listingSnapshot.proUserProfileId === authenticatedUser.id` → `{ kind: 'self_booking_forbidden' }`. (Note : MVP simplifié — l'invariant complet est validé backend Story 4.1 livré dans `Booking.create` — Story 4.3 cart layer best-effort UX, pas blocker hard.)
   - **Merge-by-listing on add** : si listingId déjà dans lines → bump quantity (vs append duplicate line)
   - **`computeLineTotal(line)` helper exported** : `mode='unit'` → `amountCents × quantity + options.sum`, `mode='package'` → `amountCents + options.sum` (flat)
   - **Tests Vitest ≥ 95 %** : 25 cases (addLine happy + addLine self-booking-forbidden + addLine multi-vendor returns warning + replaceCart resets + updateQuantity min/max boundaries + updateQuantity 0 removes line + removeLine + clear + isEmpty + isMultiVendor true/false + totalAmountCents unit/package mix + totalCount + persist round-trip LocalStorage + version migrate v1 placeholder + immer draft mutations safe)

2. **AC2 — Cross-zone cookie `tukio-cart-id` + cookie helper** : Given multi-zones Vercel Story 0.13 + UX spec cross-zone shared, When je consulte `packages/i18n-client/src/cookies.ts` (UPDATE Story 0.9 baseline) OR NEW `packages/ui/src/stores/cart-cookie.ts`, Then :
   - **Helper exposé** : `setCartIdCookie(cartId: string)` (called by `cartStore` on first `addLine` success) + `getCartIdCookie()` (read on app mount) + `clearCartIdCookie()` (called on `cart.clear()`)
   - **Cookie attrs** : `Domain=.tukio.one`, `Path=/`, `SameSite=Lax`, `Secure` (prod), `Max-Age=2592000` (30 days), **non-HttpOnly** (readable by JS) — `__Host-` prefix non utilisé car Domain partagé cross-zones requis
   - **Subscription Zustand** : `useCartStore.subscribe((state) => state.cartId, (cartId) => cartId ? setCartIdCookie(cartId) : clearCartIdCookie())` — sync automatique cookie ↔ store
   - **`hydrateFromBackend` implementation** : if `getCartIdCookie() && localStorage.tukio-cart is empty OR stale (lastSyncedAt > 5min ago)`, call `apiClient.get('/v1/carts/<cartId>')` → populate store. Concurrence-safe (singleton hydration flag).
   - Tests : cookie set on first add, cookie cleared on clear(), cookie readable cross-zone simulation, hydrateFromBackend invoked once (no duplicate calls)

3. **AC3 — Page `/fr/cart` Client Component + 3 layout states (empty / authenticated / unauthenticated)** : Given AC1 + AC2, When je navigue vers `customer.tukio.one/fr/cart`, Then :
   - **Route** : `apps/customer/src/app/[locale]/cart/page.tsx` — Client Component (`'use client'` — Zustand interactivity heavy)
   - **Layout responsive** : `lg:grid-cols-3` (lines 2/3 + summary 1/3 sticky-top desktop) → mobile `grid-cols-1` (lines puis summary stacked, summary sticky bottom OR inline depending UX bundle)
   - **Empty state** : if `cartStore.isEmpty()` → render `<EmptyState variant="cart-empty">` Story 0.5 (UX spec L1241 — already declared variant) avec title/description/cta (`/category/tents-marquees` cross-zone link via Vercel rewrites)
   - **Loaded state authenticated** : render `<CartLineItem>` × N + `<CartSummary>` avec computed totals + CTA "Procéder au paiement" → `router.push('/checkout')` (Story 4.4/4.5 livre)
   - **Loaded state unauthenticated** : same as authenticated EXCEPT CTA Checkout → `router.push('/auth/login?redirectTo=/checkout')` preserving cart state in LocalStorage (cart persistant cross-redirect)
   - **`<MultiVendorWarningModal>`** mounted conditionally
   - **RGAA AA** : `<h1 id="cart-heading">` + `<main aria-labelledby="cart-heading">` + `<section aria-label>` lines + `<aside aria-label>` summary + skip-to-content link (Story 0.5 layout pattern)
   - Tests `@testing-library/react` 8 scenarios AC3

4. **AC4 — `<CartLineItem>` feature-component** : Given AC3, When je consulte `apps/customer/src/features/cart-checkout/components/CartLineItem.tsx`, Then :
   - **Thumbnail** (photoThumbnailUrl OR `<Placeholder>` Story 0.4 fallback) + `loading="lazy"`
   - **Title link** vers `/services/<slug>` (cross-zone public) — i18n FR/EN selon `useLocale()` + fallback badge `<Badge variant="info">` si EN missing (NFR60 UX-DR19)
   - **Pro display name** sub-line
   - **`<QuantitySelector>` Story 0.5** pattern réutilisé — min/max enforcement
   - **Total line** formatted via `formatCurrency` (Story 0.9 i18n-client baseline)
   - **Remove button** `<Button variant="ghost" iconOnly>` Lucide `<Trash2>` + `aria-label` i18n
   - **Tests** `@testing-library/react` 6 scenarios + axe-core 0 violations

5. **AC5 — `<CartSummary>` feature-component + `<PricingDisplay>` wrap + commission display + deferred capture notice** : Given AC3 + Story 0.5 PricingDisplay, When je consulte `apps/customer/src/features/cart-checkout/components/CartSummary.tsx`, Then :
   - **`<PricingDisplay>` Story 0.5** réutilisé avec lines `subtotalHt`, `tukioCommission` (tooltip explicatif transparence FR65), `vat` (placeholder "Calculé au checkout" MVP — Story 4.9 finalise full 3 cas)
   - **Total highlighted** + currency EUR formatted via `formatCurrency`
   - **Deferred capture notice** : UX spec L1474 `cart.checkout.deferredCapture` — "Vous serez débité après acceptation par le professionnel" / "You will be charged after acceptance by the professional"
   - **Cancellation policy reminder** mini-line (link learn-more vers `/help/cancellation-policies`)
   - **CTA Button** `<Button variant="primary" size="lg" fullWidth>` — onClick dispatché par parent (authentifié ou non)
   - **Sticky top desktop** (`sticky top-24`) + inline mobile
   - **Tests** 4 scenarios + axe-core 0 violations

6. **AC6 — `<MultiVendorWarningModal>` feature-component + Modal pattern Story 0.5** : Given AC1 `addLine` returns `multi_vendor_warning`, When le warning fire, Then :
   - **Modal `@tukio/ui/components/Modal` Story 0.5** (Radix Dialog wrapper) `open={warning !== null}` + `requireExplicitClose={false}` (informational, pas destructive)
   - **Title + description i18n** mentioning `existingProDisplayName` + `newProDisplayName`
   - **Body** explanation + `multiVendorComingV1` notice ("Le panier mono-vendeur ne supporte qu'un Pro à la fois — multi-vendor V1")
   - **2 CTAs** : "Garder le panier" (variant ghost, dismisses modal + cart unchanged) + "Remplacer le panier" (variant primary, calls `cartStore.replaceCart(pendingLine)` + closes + toast success)
   - **RGAA AA** : focus-trap + ESC closes + return focus to triggering element + `aria-labelledby="multi-vendor-warning-title"`
   - **Tests** 4 scenarios

7. **AC7 — Story 3.10 `CtaReserveSticky.tsx` UPDATE — replace placeholder with full add-to-cart** : Given Story 3.10 livré (placeholder `router.push('/{locale}/cart?listingId=...')`), When Story 4.3 UPDATE, Then :
   - **`CtaReserveSticky.tsx` UPDATE** : replace `router.push` with `cartStore.addLine(...)` dispatch + branch on return discriminated union (added → toast success + optional "Voir le panier" CTA / multi_vendor_warning → setState modal / self_booking_forbidden → toast error)
   - **Toast feedback Story 0.5 `<Toast variant="success">`** ("Service ajouté au panier" + "Voir le panier" action button) + reduced motion respect
   - **`<MultiVendorWarningModal>` mounted in apps/public** (NEW component co-located `apps/public/src/features/public/service-detail/components/MultiVendorWarningModal.tsx` — OR import from `apps/customer` via `@tukio/ui/patterns/` promote — **décision recommandée** : promote `MultiVendorWarningModal` vers `@tukio/ui/patterns/MultiVendorWarningModal/` shared cross-apps (Story 0.5 pattern) car même besoin Story 4.3 cart page + Story 3.10 listing detail)
   - **Optional period selector** — MVP : period picker is deferred to checkout Story 4.5. `addLine` called avec `period: null`. UX bundle `screens/service.jsx` peut avoir un date picker — Story 4.3 inspect bundle + decide if include MVP OR defer Story 4.5 (recommendation : **defer Story 4.5** — cart page is purely listing + quantity selection, period at checkout step).
   - **Tests** : 5 scenarios (add success + multi_vendor warning + self-booking forbidden + replace cart + toast accessibility)

8. **AC8 — booking-svc EXTEND : Cart aggregate + 5 use cases + cross-svc listing snapshot fetch** : Given Story 4.1 livré booking-svc Pretre + `IListingSnapshotPort` + outbox/inbox patterns, When Story 4.3 EXTEND, Then :
   - **Cart aggregate** (`apps/booking-svc/src/domain/model/cart/cart.aggregate.ts`) — pas de state machine (cart mutable), invariants : mono-vendor (proProfileId match across lines), self-booking-forbidden (customerProfileId ≠ pro.userProfileId), merge-by-listing on addLine, totals computation
   - **`CartLine` entity** + **`CartId` VO** (UUID v7 réutilise Story 4.1 pattern)
   - **`ICartRepository` port** — 4 méthodes (findById, findByCustomerProfileId, save, delete)
   - **5 use cases** :
     - `get-cart.usecase.ts` — full (returns Cart or null)
     - `add-cart-line.usecase.ts` — full (calls `IListingSnapshotPort.fetchSnapshot` Story 4.1 réutilisé + `cart.addLine`)
     - `update-cart-line.usecase.ts` — full
     - `remove-cart-line.usecase.ts` — full
     - `merge-anonymous-cart-to-customer.usecase.ts` — full (called by gateway-api on login Story 1.4 callback)
   - **5 exceptions** ENV-PORTABLES `CART-*-00X` ADR-014 mapping (cart-not-found, mono-vendor-violation, self-booking-forbidden, line-not-found, validation)
   - **`UseCasesProxyModule` UPDATE Story 4.1** — wire 5 new use cases + `ICartRepository` impl
   - **Coverage ≥ 90 %** domain Cart + 5 use cases (NFR71)
   - **Lint boundaries strict** — Cart domain pure (no Stripe/axios/@nestjs imports)

9. **AC9 — booking-svc DB migration `cart` + `cart_line` tables + indexes + trigger** : Given Story 4.1 baseline migration pattern, When Story 4.3 ajoute migration, Then :
   - **Migration** `<timestamp>-CreateCartTables.ts` — tables `cart` + `cart_line` (cf. story body section h) + indexes partials (`idx_cart_customer`, `idx_cart_last_activity`, `idx_cart_line_cart`, `uniq_cart_line_listing`) + trigger `updated_at` + check constraints (quantity ≥ 1, amounts ≥ 0)
   - **`down()` migration** : DROP cascade ordre inverse FK + indexes + tables + triggers
   - **TypeORM entities + repository** `TypeormCartRepository implements ICartRepository` + mapper aggregate ↔ entity
   - **Tests integration testcontainer Postgres** 6 scenarios : migration up/down + check constraints + cascade FK CART → CART_LINE + UNIQUE constraint (cart_id, listing_id) prevents duplicate listing lines

10. **AC10 — gateway-api `carts.controller.ts` + 4 endpoints + Zod validation + throttle + enveloppe ADR-014** : Given Story 1.2 livré KeycloakJwtGuard + envelope filter, When Story 4.3 ajoute gateway-api, Then :
    - **`apps/gateway-api/src/infrastructure/http/controllers/carts.controller.ts`** (NEW) — 4 endpoints (GET cart, POST line, PATCH line, DELETE line)
    - **Auth optional Guard** — endpoints acceptent guest (no JWT) OR authenticated (JWT validated, customerProfileId derived from `actor.id`)
    - **Throttle** : `@Throttle({ default: { limit: 30, ttl: 60_000 } })` guest, override authenticated `60/min` (Story 1.2 pattern)
    - **Zod validation** body + params via DTOs `@tukio/contracts/dtos/cart/*`
    - **4 forwarders** `apps/gateway-api/src/usecases/cart/{get,add,update,remove}-cart-line.forwarder.ts` → booking-svc internal HTTP X-Internal-Service-Token
    - **Error mapping** : CART-*-00X → enveloppe 404/409/422 via global ExceptionFilter
    - **Tests E2E gateway** 8 scenarios AC10 (happy CRUD + auth optional + multi-vendor 409 + self-booking 422 + cart-not-found 404 + throttle 429 + enveloppe shape)

11. **AC11 — Anonymous cart → Customer cart merge on login (Story 1.4 callback UPDATE)** : Given Story 1.4 livré login flow KeycloakAuthMiddleware + JWT exchange callback, When Customer logs in WHILE having guest cart cookie, Then :
    - **`apps/customer/src/middleware.ts` UPDATE Story 1.4** : on `auth/callback` success, detect cookie `tukio-cart-id` AND `lastSyncedAt === null` OR `customerProfileId` mismatch → call `POST /v1/carts/merge` `{ guestCartId, customerProfileId }` → backend `merge-anonymous-cart-to-customer.usecase.ts`
    - **Backend merge logic** :
      - Si Customer n'avait pas de cart existant → reassign `guestCart.customerProfileId = newCustomerProfileId` + persist
      - Si Customer avait un cart existant → MVP decision **"keep guest cart, discard old customer cart"** (most recent intent). V1+ peut offrir UI choice. Old customer cart soft-deleted.
    - **Frontend** `cartStore.syncToBackend` invoked post-merge avec authenticated user
    - **Tests E2E** 4 scenarios : guest cart + login fresh customer → cart assigned, guest cart + login customer with existing cart → guest wins, multi-tab login race → idempotent merge (cart-id transaction safe)

12. **AC12 — `@tukio/api-client` hooks `useCart`, `useAddCartLine`, `useUpdateCartLine`, `useRemoveCartLine`** : Given Story 0.9 livré TanStack Query baseline, When Story 4.3 ajoute hooks, Then :
    - **`packages/api-client/src/hooks/cart/{useCart,useAddCartLine,useUpdateCartLine,useRemoveCartLine}.ts`** — TanStack Query v5 hooks typés via `@tukio/contracts/dtos/cart/*`
    - **`useCart`** : `useQuery({ queryKey: ['cart', cartId, locale], queryFn: () => apiClient.get('/v1/carts/<cartId>').then(unwrapEnvelope), enabled: !!cartId, staleTime: 30s })`
    - **Mutations** : `useMutation` + onSuccess invalidate cart query + optimistic update Zustand store (pattern Story 0.9)
    - **Tests Vitest + msw** 5 scenarios chaque hook AC12 (happy fetch + 404 cart-not-found + 409 multi-vendor + optimistic rollback on mutation error + cache invalidation)
    - **Coverage ≥ 85 %**

13. **AC13 — i18n FR/EN namespaces `customer.cart.*` + `public.serviceDetail.cta.*` UPDATE + i18n CI audit** : Given Story 0.9 i18n CI audit `pnpm i18n:audit`, When Story 4.3 add namespace, Then :
    - **`apps/customer/messages/{fr,en}.json`** — namespace `customer.cart.*` ~30 keys × 2 (cf. story body section k)
    - **`apps/public/messages/{fr,en}.json`** UPDATE — namespace `public.serviceDetail.cta.*` add 6 keys (`addedTitle`, `addedDescription`, `addedSeeCart`, `replacedTitle`, `selfBookingTitle`, `selfBookingDescription`) × 2 langues
    - **i18n CI lint** `pnpm i18n:audit` Story 0.9 réutilisé — both files contain all keys, no orphans
    - **Tone & voice** Tukio FR : vouvoiement systématique, chaleureux pas familier, pas d'émojis, microcopy proactive (UX spec L774-789)

14. **AC14 — Cross-zone Vercel multi-zones rewrites verification + `/fr/cart` route accessible from public zone** : Given Story 0.13 multi-zones Vercel scaffolded, When Story 4.3 verify, Then :
    - **`apps/public/next.config.ts`** Story 0.13 — verify rewrites `/cart/*` → `customer.tukio.one/cart/*` actif + verify `/checkout/*` → `customer.tukio.one/checkout/*` (Story 4.4/4.5 future) + verify `/auth/login` → identity middleware Story 1.4
    - **Cookie sharing test** : E2E Playwright navigate `tukio.one/fr/services/<slug>` → add cart → navigate `tukio.one/fr/cart` (rewrites kicks in) → cart visible (cookie cross-zone OK + LocalStorage hydration if customer zone first-load uses backend hydrate)
    - **`<Link>` Next.js cross-zone** : `apps/public` components href `/cart` rendered ne casse pas pas hydration (rewrites transparent)
    - Tests E2E 2 scenarios cross-zone navigation

15. **AC15 — `<EmptyState variant="cart-empty">` Story 0.5 reuse — pas de NEW variant** : Given UX spec L1241 `<EmptyState variant="cart-empty">` declared, When je consulte Story 0.5 livré, Then variant déjà créé (Story 0.5 livre 7 variants — cf. UX spec L1240-1246). Story 4.3 NE crée PAS un new variant — utilise comme-est avec props `title`, `description`, `cta`. **Verify Story 0.5 baseline livré ce variant** — sinon Story 4.3 PR ajoute le variant (cas edge — if Story 0.5 didn't ship cart-empty, Story 4.3 PR add it to `packages/ui/src/patterns/EmptyState/EmptyState.tsx`).

16. **AC16 — Tests Playwright e2e 12 scenarios + Lighthouse CI + axe-core RGAA AA** : Given AC1-15, When tests CI run, Then :
    - **`apps/customer/e2e/cart/cart.spec.ts`** 12 scenarios (cf. story body section n) — happy add-from-listing + multi-vendor warning replace + multi-vendor keep + quantity update min/max + remove + empty state + unauthenticated checkout redirect + authenticated checkout placeholder + cross-zone cookie persistence + self-booking-forbidden + RGAA AA kbd nav + NFR3 LCP < 1s
    - **Lighthouse CI Story 0.11 UPDATE** : add `/fr/cart` à budgets list + assert Accessibility ≥ 90 + LCP < 1s p75 (NFR3) + CLS < 0,1 + FID < 100ms
    - **axe-core 0 violations** cart page + multi-vendor modal + line item + summary
    - **Coverage NFR71** : ≥ 90 % critical components (CartLineItem, CartSummary, MultiVendorWarningModal, page.tsx) + ≥ 85 % gateway carts.controller + ≥ 80 % api-client hooks + ≥ 90 % Zustand store
    - **Test perf** : add 10 lines + render < 100ms (Vitest profiler benchmark)

17. **AC17 — Lint boundaries strict + EN strict + Stack frontend latest stable** : Given Story 0.6 baseline + memories Tukio, When `pnpm lint` 2 apps + booking-svc, Then :
    - **0 violations boundaries** sur `apps/booking-svc/src/domain/model/cart/**` (Cart aggregate + entity + VOs pure — no NestJS/TypeORM/I/O imports)
    - **0 violations** sur `apps/booking-svc/src/usecases/cart/**` (use cases consume ports only)
    - **0 violations** `apps/customer/src/features/cart-checkout/**` (feature-based, no cross-feature internal imports)
    - **EN strict** : files + identifiers + DB cols/tables + URLs paths (`/cart`, `/checkout`, `/cart-line` PAS `/panier`) — memory `feedback_tech_layer_english`
    - **i18n FR/EN dès Sprint 0** : zéro hardcoded user-facing text — memory `feedback_i18n_frontend`
    - **Stack frontend latest stable** : Zustand v5 + Next.js 15 + React 19 + Tailwind v4 + TanStack Query v5 + next-intl 4.x + React Hook Form 7.x — memory `feedback_latest_versions`
    - **Tests RGAA AA** + `<EmptyState>` + `<Modal>` + `<PricingDisplay>` + `<QuantitySelector>` Story 0.5 atomics réutilisés (zero re-implementation)

## Tasks / Subtasks

- [ ] **Task 1 — Zustand `cartStore` shared `@tukio/ui/stores/cart.store.ts` + persist + immer + cookie helper** (AC: #1, #2) — coverage ≥ 95 %
  - [ ] 1.1 — `packages/ui/src/stores/cart.store.ts` (Zustand v5 + persist + immer + subscribeWithSelector — full API per AC1)
  - [ ] 1.2 — `packages/ui/src/stores/cart-cookie.ts` (helper `setCartIdCookie`, `getCartIdCookie`, `clearCartIdCookie` + subscription cart store ↔ cookie sync)
  - [ ] 1.3 — `packages/ui/src/stores/index.ts` barrel export `useCartStore`, `computeLineTotal`, `cart-cookie helpers`
  - [ ] 1.4 — UPDATE `packages/ui/package.json` add `zustand` + `nanoid` + `immer` latest stable deps (vérifier `pnpm view zustand version` etc.)
  - [ ] 1.5 — Tests Vitest 25 cases AC1 + 5 cases AC2 cookie

- [ ] **Task 2 — Page `/fr/cart` apps/customer + 3 layout states + Multi-vendor modal** (AC: #3, #5, #6) — coverage ≥ 90 %
  - [ ] 2.1 — `apps/customer/src/app/[locale]/cart/page.tsx` Client Component
  - [ ] 2.2 — `apps/customer/src/features/cart-checkout/components/CartSummary.tsx` + spec — wraps `<PricingDisplay>` Story 0.5
  - [ ] 2.3 — `apps/customer/src/features/cart-checkout/components/MultiVendorWarningModal.tsx` + spec (NEW — OR promote to `@tukio/ui/patterns/` shared with Story 3.10 — recommandation : **promote to @tukio/ui/patterns/MultiVendorWarningModal/**)
  - [ ] 2.4 — Tests Vitest `@testing-library/react` + axe-core 8 + 4 + 4 scenarios

- [ ] **Task 3 — `<CartLineItem>` feature-component + `<QuantitySelector>` Story 0.5 wrap** (AC: #4) — coverage ≥ 90 %
  - [ ] 3.1 — `apps/customer/src/features/cart-checkout/components/CartLineItem.tsx` + spec
  - [ ] 3.2 — Verify Story 0.5 `<QuantitySelector>` réutilisable (UX spec L1117 mentioned in patterns) — si pas livré Story 0.5, ajouter à `packages/ui/src/patterns/QuantitySelector/` Story 4.3 PR
  - [ ] 3.3 — Tests Vitest + axe-core 6 scenarios

- [ ] **Task 4 — Story 3.10 `CtaReserveSticky.tsx` UPDATE — replace placeholder with full add-to-cart action** (AC: #7) — coverage ≥ 90 %
  - [ ] 4.1 — UPDATE `apps/public/src/features/public/service-detail/components/CtaReserveSticky.tsx` Story 3.10 — replace `router.push('/cart?listingId=...')` with `cartStore.addLine(...)` dispatch + branch on return discriminated union
  - [ ] 4.2 — Mount `<MultiVendorWarningModal>` (from `@tukio/ui/patterns/` shared OR inline) in `apps/public`
  - [ ] 4.3 — Toast feedback via `@tukio/ui/components/Toast` Story 0.5
  - [ ] 4.4 — UPDATE `apps/public/messages/{fr,en}.json` — add `public.serviceDetail.cta.*` 6 keys × 2
  - [ ] 4.5 — Tests Vitest 5 scenarios AC7 + e2e Playwright cross-zone scenario (Task 11)

- [ ] **Task 5 — booking-svc EXTEND : Cart aggregate + CartLine entity + VOs + 5 ports/methods + 5 exceptions** (AC: #8) — coverage ≥ 95 %
  - [ ] 5.1 — `apps/booking-svc/src/domain/model/cart/cart.aggregate.ts` + spec
  - [ ] 5.2 — `apps/booking-svc/src/domain/model/cart/cart-line.entity.ts` + spec
  - [ ] 5.3 — `apps/booking-svc/src/domain/model/cart/value-objects/cart-id.vo.ts` (réutilise pattern Story 4.1)
  - [ ] 5.4 — `apps/booking-svc/src/domain/ports/cart-repository.port.ts` (`ICartRepository`)
  - [ ] 5.5 — `apps/booking-svc/src/domain/exception/cart/{cart-not-found,cart-mono-vendor-violation,cart-self-booking-forbidden,cart-line-not-found,cart-validation}.exception.ts` + `toEnvelope()`
  - [ ] 5.6 — Tests domain ≥ 95 % 25+ cases (Cart invariants + mono-vendor + self-booking-forbidden + merge-by-listing + totals)

- [ ] **Task 6 — booking-svc 5 use cases cart + UseCasesProxyModule UPDATE Story 4.1** (AC: #8, #11) — coverage ≥ 90 %
  - [ ] 6.1 — `apps/booking-svc/src/usecases/cart/get-cart.usecase.ts` + spec
  - [ ] 6.2 — `apps/booking-svc/src/usecases/cart/add-cart-line.usecase.ts` + spec (calls `IListingSnapshotPort.fetchSnapshot` Story 4.1 réutilisé)
  - [ ] 6.3 — `apps/booking-svc/src/usecases/cart/update-cart-line.usecase.ts` + spec
  - [ ] 6.4 — `apps/booking-svc/src/usecases/cart/remove-cart-line.usecase.ts` + spec
  - [ ] 6.5 — `apps/booking-svc/src/usecases/cart/merge-anonymous-cart-to-customer.usecase.ts` + spec (called Story 1.4 callback)
  - [ ] 6.6 — UPDATE `apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` Story 4.1 — wire 5 cart use cases + `ICartRepository` impl
  - [ ] 6.7 — Tests use cases ≥ 90 % AC8 + AC11 (10+15 = 25 scenarios)

- [ ] **Task 7 — booking-svc DB migration `cart` + `cart_line` + entities + TypeORM repository + mapper** (AC: #9) — coverage ≥ 80 %
  - [ ] 7.1 — `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-CreateCartTables.ts` (up + down + indexes + check constraints + trigger updated_at + UNIQUE constraint)
  - [ ] 7.2 — Entities `cart.entity.ts` + `cart-line.entity.ts`
  - [ ] 7.3 — `cart.typeorm.repository.ts` (`TypeormCartRepository implements ICartRepository` — 4 méthodes + mapper)
  - [ ] 7.4 — `cart.mapper.ts` static aggregate ↔ entity
  - [ ] 7.5 — Tests integration testcontainer Postgres 6 scenarios AC9 (migration up/down, check constraints, cascade FK, UNIQUE constraint)

- [ ] **Task 8 — gateway-api `carts.controller.ts` + 4 endpoints + Zod + throttle + DTOs `@tukio/contracts/dtos/cart/*`** (AC: #10) — coverage ≥ 85 %
  - [ ] 8.1 — `packages/contracts/src/dtos/cart/{cart-detail,add-cart-line-request,update-cart-line-request,cart-line-response,merge-cart-request}.dto.ts` Zod schemas
  - [ ] 8.2 — `packages/contracts/src/dtos/cart/index.ts` barrel export
  - [ ] 8.3 — UPDATE `packages/contracts/src/dtos/index.ts` — add cart export
  - [ ] 8.4 — `apps/gateway-api/src/infrastructure/http/controllers/carts.controller.ts` (4 endpoints + Zod + throttle + auth optional KeycloakJwtGuard variant)
  - [ ] 8.5 — `apps/gateway-api/src/usecases/cart/{get,add,update,remove,merge}-cart-line.forwarder.ts` (5 forwarders → booking-svc internal)
  - [ ] 8.6 — `apps/booking-svc/src/infrastructure/http/controllers/cart.controller.ts` (NEW internal endpoints — co-located avec future booking endpoints Story 4.4)
  - [ ] 8.7 — Tests E2E gateway 8 scenarios AC10

- [ ] **Task 9 — `@tukio/api-client` hooks `useCart` + mutations** (AC: #12) — coverage ≥ 85 %
  - [ ] 9.1 — `packages/api-client/src/hooks/cart/useCart.ts`
  - [ ] 9.2 — `packages/api-client/src/hooks/cart/useAddCartLine.ts` + optimistic update
  - [ ] 9.3 — `packages/api-client/src/hooks/cart/useUpdateCartLine.ts`
  - [ ] 9.4 — `packages/api-client/src/hooks/cart/useRemoveCartLine.ts`
  - [ ] 9.5 — `packages/api-client/src/hooks/cart/index.ts` barrel export
  - [ ] 9.6 — Tests Vitest + msw 5 scenarios chaque hook AC12

- [ ] **Task 10 — i18n FR/EN namespaces + i18n CI audit** (AC: #13)
  - [ ] 10.1 — `apps/customer/messages/{fr,en}.json` — namespace `customer.cart.*` ~30 keys × 2
  - [ ] 10.2 — UPDATE `apps/public/messages/{fr,en}.json` — add `public.serviceDetail.cta.*` 6 keys × 2
  - [ ] 10.3 — `pnpm i18n:audit` Story 0.9 baseline CI gate verify

- [ ] **Task 11 — Cross-zone Vercel multi-zones rewrites verification + anonymous → customer merge on login Story 1.4 callback** (AC: #11, #14)
  - [ ] 11.1 — VERIFY `apps/public/next.config.ts` Story 0.13 rewrites `/cart/*` + `/checkout/*` + `/auth/login` actif (UPDATE if missing)
  - [ ] 11.2 — UPDATE `apps/customer/src/middleware.ts` Story 1.4 — on auth/callback success, detect cookie `tukio-cart-id` + trigger `POST /v1/carts/merge` via `useMutation` post-mount
  - [ ] 11.3 — Tests E2E 4 scenarios merge anonymous → customer AC11 + 2 scenarios cross-zone navigation AC14

- [ ] **Task 12 — Tests Playwright e2e 12 scenarios + Lighthouse CI + axe-core RGAA AA** (AC: #16) — coverage NFR71
  - [ ] 12.1 — `apps/customer/e2e/cart/cart.spec.ts` (NEW 12 tests AC16 — happy CRUD + multi-vendor warning + unauthenticated checkout redirect + cross-zone + self-booking-forbidden + RGAA + NFR3 LCP)
  - [ ] 12.2 — Lighthouse CI Story 0.11 UPDATE — add `/fr/cart` à budgets list + Accessibility ≥ 90 + LCP < 1s + CLS < 0,1 + FID < 100ms (NFR3)
  - [ ] 12.3 — axe-core integration tests in components specs (CartLineItem, CartSummary, MultiVendorWarningModal, page.tsx)
  - [ ] 12.4 — Coverage NFR71 thresholds enforced

- [ ] **Task 13 — Lint boundaries strict + EN strict + commit handoff Stories 4.4-4.5** (AC: #17)
  - [ ] 13.1 — `pnpm lint` 0 violations boundaries booking-svc/domain/model/cart + apps/customer/features/cart-checkout
  - [ ] 13.2 — `pnpm typecheck` 0 errors strict mode all workspaces
  - [ ] 13.3 — UPDATE `docs/project-context.md` — section "Cart MVP (Story 4.3)" résumé Zustand store cross-apps + booking-svc cart extension + cross-zone cookie + handoff Stories 4.4-4.5
  - [ ] 13.4 — UPDATE `_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md` Completion Notes List — handoff Story 4.3 (cart extension dans booking-svc — `tukio_booking.cart` + `cart_line` tables + 5 use cases cart livrés)
  - [ ] 13.5 — UPDATE `_bmad-output/implementation-artifacts/3-10-listing-detail-public-page.md` Completion Notes List — `CtaReserveSticky` no longer placeholder, full cart integration Story 4.3 livrée
  - [ ] 13.6 — Commit `feat(customer,public,booking-svc,gateway-api,ui,api-client,contracts): Story 4.3 cart UI mono-vendor + Zustand store shared cross-apps + cross-zone cookie + booking-svc cart aggregate + 5 use cases + merge anonymous→customer + Lighthouse Accessibility/LCP gates + Multi-vendor warning modal + i18n FR/EN strict`

## Dev Notes

### Pourquoi Story 4.3 ferme la couche Visitor → Customer pre-checkout MVP

Story 4.3 est la **dernière story Visitor pré-checkout** Epic 4 (avant les stories backend saga 4.4 race conditions + 4.5 Stripe Elements frontend). Sans Story 4.3, le CTA Reserve Story 3.10 reste un placeholder `router.push('/cart')` qui n'a pas de page derrière. Story 4.3 livre la **chaîne complète UI Visitor → Customer ajoute au panier → consulte panier → procède au paiement** :

- Story 3.10 livre listing detail public — placeholder CTA `/cart`
- **Story 4.3 livre cart UI + persistence + cross-zone state sync**
- Story 4.4 livre booking submission + 3-layer race conditions (consume cart via `POST /v1/bookings/checkout-session` qui transforme cart → Booking via `book-listing.usecase.ts` Story 4.1 baseline)
- Story 4.5 livre Stripe Elements checkout frontend (consume `clientSecret` Story 4.2 baseline)

**Story 4.3 = template "Zustand store shared cross-apps + persistence dual-layer (cookie cross-zone + LocalStorage zone-local + backend sync) + feature-component composition (atoms `@tukio/ui` + patterns + feature-scoped composables) + mono-vendor invariant frontend AND backend"** réutilisable pour Story 8.x V1 multi-vendor cart (parallel saga) + Story 11.x V1 favorites/wishlist persistence + Story 12.x V1 chat libre pre-booking (similar cross-zone Zustand store + cookie strategy).

### Décisions techniques majeures actées Story 4.3

1. **Cart store dans `@tukio/ui/stores/` shared (vs `apps/customer/features/cart-checkout/stores/` per UX spec L766-768)** — UX spec mentionne 2 emplacements possibles. Story 4.3 décision : **`@tukio/ui/stores/`** car le store doit être consommé par `apps/public` (Story 3.10 listing detail CTA) ET `apps/customer` (cart page). Multi-zones Vercel = bundle isolés par zone, donc le store doit vivre dans le package shared. Trade-off : `@tukio/ui` n'est plus "UI components only" mais "UI components + shared stores" — c'est cohérent avec UX spec L767-770 (`packages/ui/src/stores/` declared as valid location pour shared cross-apps stores).

2. **Persistence dual-layer : cookie cross-zone `tukio-cart-id` + LocalStorage zone-local + backend `tukio_booking.cart` table** — résout 3 use cases :
   - **Guest cross-zone navigation** : cookie partagé permet à `apps/customer/cart` page de reconnaître le cart créé sur `apps/public/services/<slug>`
   - **Authenticated multi-device** : backend persistence permet reprise cross-device (laptop + mobile)
   - **Login merge** : anonymous cart → customer cart via `POST /v1/carts/merge` callback Story 1.4

3. **Backend cart dans booking-svc (EXTEND Story 4.1), pas nouveau cart-svc** — epic L1637 décide explicitement : "cart-svc gère la persistence backend pour reprise cross-device — MVP simple table dans `tukio_booking`". Story 4.3 implémente comme **extension booking-svc** : pas de nouveau microservice (over-engineering MVP), juste tables `cart` + `cart_line` dans `tukio_booking` DB + Cart aggregate domain layer + 5 use cases + HTTP controllers internes. V1+ pourrait extraire si besoin scale (mais 100+ resa/mois MVP ne justifie pas).

4. **Cart aggregate sans state machine (vs Booking/Order aggregates)** — Cart est mutable jusqu'au checkout (pas de lifecycle transitions). Architecture : simple `Cart` aggregate + `CartLine` entity + invariants (mono-vendor, self-booking-forbidden, merge-by-listing, totals computation). **No outbox events MVP** — cart actions sont UI-only, pas business events (V1+ analytics peut émettre `cart.line-added.v1`).

5. **Mono-vendor MVP strict** — frontend bloque via `<MultiVendorWarningModal>` + backend bloque via `CartMonoVendorViolationException` (defense in depth). V1 (Story 8.x) introduira multi-vendor avec orchestration parallel saga — Story 4.3 baseline mono-vendor + invariant clair facilitera migration V1.

6. **`MultiVendorWarningModal` promote à `@tukio/ui/patterns/`** (vs apps-local) — Story 3.10 cart CTA + Story 4.3 cart page utilisent le même modal. Promote pattern Story 0.5 EmptyState/ErrorPage shared cross-apps réutilisé. Évite duplication.

7. **`addLine` return discriminated union** (`{kind:'added'|'multi_vendor_warning'|'self_booking_forbidden'}`) — Pattern explicite > exceptions/throws pour UI flow control. Frontend dispatche modal/toast selon kind.

8. **Period selection deferred to checkout Story 4.5** — Cart page MVP n'inclut PAS le date picker (period: null à add). Decision : minimiser cart complexity, period live au checkout step où il intéragit avec disponibilité backend Story 4.4 (3-layer race conditions). Bundle UX `screens/checkout.jsx` (figé) inclut probablement le picker. V1+ peut migrer picker au cart si besoin.

9. **Cookie `tukio-cart-id` non-HttpOnly** (vs auth cookies HttpOnly Story 1.4) — cart cookie doit être readable côté client par les apps (sync Zustand store ↔ cookie). Non sensitive (juste un UUID cart, pas auth), donc OK. `SameSite=Lax + Secure + Domain=.tukio.one` couvre CSRF + cross-zone.

10. **Merge anonymous cart → customer cart : "keep guest cart, discard old customer cart" MVP** — Decision : le cart le plus récent (= le guest cart qui a triggered le login) wins. Old customer cart (peut-être abandonné) soft-deleted. V1+ peut offrir UI choice à l'utilisateur. Documente decision in `merge-anonymous-cart-to-customer.usecase.ts`.

11. **NFR3 LCP < 1s cart page** — Cart page Client Component (Zustand) → hydration cost. Mitigations :
    - LocalStorage rehydration sync (no network)
    - Backend `useCart` lazy (Suspense fallback)
    - Tailwind v4 tree-shaken, minimal JS
    - Lighthouse CI Story 0.11 gate fail-fast

12. **EN strict + i18n FR/EN dès Sprint 0 + RGAA AA + latest stable versions + Clean Architecture + Envelope ADR-014 + feature-based architecture + atomic design `@tukio/ui`** memories — toutes respectées.

13. **Stack frontend latest stable** (memory `feedback_latest_versions`) : Zustand v5 + Next.js 15 + React 19 + Tailwind v4 + TanStack Query v5 + next-intl 4.x + React Hook Form 7.x + immer latest + nanoid latest. **Vérifier `pnpm view <pkg> version`** avant freezing — Story 4.3 vérifiera juste avant impl.

14. **No backwards compatibility hacks** — Story 4.3 nouveau cart, pas de migration legacy.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| **`zustand`** | State management Zustand store cart | **v5 latest stable** | Vérifier `pnpm view zustand version` ; UX spec L824 baseline |
| **`immer`** | Mutations cohérentes Zustand draft | latest stable v10+ | Middleware Zustand intégré |
| **`nanoid`** | Cart UUID v7-like (Story 4.3 MVP — `uuid` v11 v7 possible mais nanoid plus léger frontend) | latest stable v5+ | URL-safe, 21 chars default OK pour cart IDs |
| **`@tanstack/react-query`** | API hooks | (Story 0.9 baseline) | v5 latest stable |
| **`next-intl`** | i18n FR/EN | (Story 0.9 baseline) | 4.x si stable |
| **`@tukio/ui`** | Card, Button, Badge, Modal, Toast, QuantitySelector, PricingDisplay, EmptyState | (Stories 0.4/0.5 baseline) | UPDATE — ajoute `stores/cart.store.ts` + promote MultiVendorWarningModal pattern |
| **`@tukio/api-client`** | TanStack Query hooks typés | (Story 0.9 baseline) | UPDATE — ajoute hooks cart |
| **`@tukio/contracts`** | Zod DTOs cart | (Story 0.2 baseline) | UPDATE — ajoute `dtos/cart/*` |
| **`@tukio/i18n-client`** | formatCurrency formatters | (Story 0.9 baseline) | Réutilisé |
| **`lucide-react`** | Icons `<Trash2>` etc. | (Story 0.4 baseline) | Réutilisé |
| **`typeorm`** | Postgres ORM | (Story 0.6 baseline) | Migration `cart` + `cart_line` tables |
| **`zod`** | Schema validation DTOs | (Story 0.2 baseline) | v4.x si stable, sinon v3.x dernière |
| **`@playwright/test`** | E2E tests | (Story 0.9 baseline) | 12 scenarios cart |
| **`vitest`** | Unit tests frontend | (Story 0.9 baseline) | v3.x latest |
| **`axe-core` + `@axe-core/playwright`** | RGAA AA tests | (Story 0.9 baseline) | 0 violations cart components |

### Project Structure cible

```
# ====== NEW Story 4.3 frontend ======

packages/ui/src/
├─ stores/
│  ├─ cart.store.ts + spec                                                                            # NEW Story 4.3 — Zustand store shared cross-apps
│  ├─ cart-cookie.ts + spec                                                                            # NEW — cookie helper cross-zone
│  └─ index.ts                                                                                         # NEW — barrel export
└─ patterns/
   └─ MultiVendorWarningModal/                                                                         # NEW promoted — shared cross-apps Story 4.3 + Story 3.10
      ├─ MultiVendorWarningModal.tsx + spec
      ├─ index.ts
      └─ types.ts

# Vérifier Story 0.5 livré ces patterns réutilisés Story 4.3 (si gap, Story 4.3 PR ajoute) :
# - <PricingDisplay> ✅ Story 0.5
# - <EmptyState variant="cart-empty"> ✅ Story 0.5 (UX spec L1241)
# - <QuantitySelector> ⚠️ vérifier livré Story 0.5 (UX spec L1117 mentioned) — sinon Story 4.3 add

apps/customer/src/
├─ app/[locale]/cart/
│  └─ page.tsx                                                                                         # NEW Story 4.3 — Client Component cart page
├─ features/cart-checkout/
│  ├─ components/
│  │  ├─ CartLineItem.tsx + spec                                                                       # NEW Story 4.3
│  │  ├─ CartSummary.tsx + spec                                                                        # NEW Story 4.3
│  │  └─ index.ts                                                                                      # NEW barrel (limited exports)
│  ├─ services/                                                                                        # (TanStack hooks réutilisés depuis @tukio/api-client — pas de service local)
│  └─ index.ts                                                                                         # NEW barrel
└─ messages/
   ├─ fr.json                                                                                          # UPDATE — namespace customer.cart.* ~30 keys
   └─ en.json                                                                                          # UPDATE — namespace customer.cart.* ~30 keys

apps/public/src/
├─ features/public/service-detail/components/
│  └─ CtaReserveSticky.tsx                                                                             # UPDATE Story 3.10 — replace placeholder with full add-to-cart action
└─ messages/
   ├─ fr.json                                                                                          # UPDATE — public.serviceDetail.cta.* add 6 keys
   └─ en.json                                                                                          # UPDATE — public.serviceDetail.cta.* add 6 keys

# Vérifier Story 0.13 multi-zones rewrites
apps/public/next.config.ts                                                                             # VERIFY Story 0.13 — `/cart/*` rewrites → customer.tukio.one (UPDATE si manquant)

# Customer middleware UPDATE Story 1.4 callback
apps/customer/src/middleware.ts                                                                        # UPDATE Story 1.4 — on auth/callback, trigger POST /v1/carts/merge if cookie tukio-cart-id present

# ====== NEW Story 4.3 backend (booking-svc EXTEND Story 4.1) ======

apps/booking-svc/src/
├─ domain/
│  ├─ model/cart/
│  │  ├─ cart.aggregate.ts + spec                                                                      # NEW Story 4.3 — Cart aggregate (no state machine, mono-vendor invariant)
│  │  ├─ cart-line.entity.ts + spec                                                                    # NEW
│  │  └─ value-objects/cart-id.vo.ts                                                                   # NEW (UUID v7 pattern Story 4.1)
│  ├─ ports/cart-repository.port.ts                                                                    # NEW (ICartRepository)
│  └─ exception/cart/
│     ├─ cart-not-found.exception.ts                                                                   # NEW (CART-NOT-FOUND-001 → 404)
│     ├─ cart-mono-vendor-violation.exception.ts                                                       # NEW (CART-MONO-VENDOR-VIOLATION-002 → 409)
│     ├─ cart-self-booking-forbidden.exception.ts                                                      # NEW (CART-SELF-BOOKING-FORBIDDEN-003 → 422)
│     ├─ cart-line-not-found.exception.ts                                                              # NEW (CART-LINE-NOT-FOUND-004 → 404)
│     └─ cart-validation.exception.ts                                                                  # NEW (CART-VALIDATION-005 → 422)
├─ usecases/cart/
│  ├─ get-cart.usecase.ts + spec                                                                       # NEW Story 4.3
│  ├─ add-cart-line.usecase.ts + spec                                                                  # NEW (calls IListingSnapshotPort.fetchSnapshot Story 4.1)
│  ├─ update-cart-line.usecase.ts + spec                                                               # NEW
│  ├─ remove-cart-line.usecase.ts + spec                                                               # NEW
│  └─ merge-anonymous-cart-to-customer.usecase.ts + spec                                               # NEW (called Story 1.4 callback)
└─ infrastructure/
   ├─ usecases-proxy/usecases-proxy.module.ts                                                          # UPDATE Story 4.1 — wire 5 cart use cases + ICartRepository impl
   ├─ persistence/typeorm/
   │  ├─ entities/{cart,cart-line}.entity.ts                                                           # NEW (2)
   │  ├─ repositories/cart.typeorm.repository.ts + integration spec                                    # NEW
   │  ├─ mappers/cart.mapper.ts + spec                                                                 # NEW
   │  └─ migrations/<timestamp>-CreateCartTables.ts                                                    # NEW (cart + cart_line + indexes + constraints + trigger)
   └─ http/controllers/cart.controller.ts                                                              # NEW internal endpoints — co-located avec future booking endpoints Story 4.4

apps/gateway-api/src/
├─ infrastructure/http/controllers/carts.controller.ts                                                 # NEW — 4 public endpoints (GET cart, POST line, PATCH line, DELETE line) + 1 merge endpoint
└─ usecases/cart/
   ├─ get-cart.forwarder.ts                                                                            # NEW
   ├─ add-cart-line.forwarder.ts                                                                       # NEW
   ├─ update-cart-line.forwarder.ts                                                                    # NEW
   ├─ remove-cart-line.forwarder.ts                                                                    # NEW
   └─ merge-cart.forwarder.ts                                                                          # NEW

# ====== UPDATE @tukio/contracts ======

packages/contracts/src/
├─ dtos/cart/                                                                                          # NEW directory
│  ├─ cart-detail.dto.ts                                                                               # NEW (CartDetailResponseSchema Zod)
│  ├─ add-cart-line-request.dto.ts                                                                     # NEW (AddCartLineRequestSchema)
│  ├─ update-cart-line-request.dto.ts                                                                  # NEW
│  ├─ cart-line-response.dto.ts                                                                        # NEW (réutilise ListingSnapshot Story 4.1)
│  ├─ merge-cart-request.dto.ts                                                                        # NEW
│  └─ index.ts                                                                                         # NEW barrel
└─ dtos/index.ts                                                                                       # UPDATE — add cart export

# ====== UPDATE @tukio/api-client ======

packages/api-client/src/hooks/cart/                                                                    # NEW directory
├─ useCart.ts + spec                                                                                   # NEW
├─ useAddCartLine.ts + spec                                                                            # NEW
├─ useUpdateCartLine.ts + spec                                                                         # NEW
├─ useRemoveCartLine.ts + spec                                                                         # NEW
└─ index.ts                                                                                            # NEW barrel

# ====== UPDATE infra ======

apps/customer/e2e/cart/cart.spec.ts                                                                    # NEW 12 tests Playwright AC16
apps/public/e2e/lighthouse.config.{ts,js}                                                              # UPDATE Story 0.11 — add /fr/cart à budgets + Accessibility ≥ 90 + LCP < 1s + CLS < 0,1

# ====== UPDATE docs ======

docs/project-context.md                                                                                # UPDATE — section "Cart MVP (Story 4.3)"
_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md                     # UPDATE Completion Notes List — handoff Story 4.3 (cart extension booking-svc)
_bmad-output/implementation-artifacts/3-10-listing-detail-public-page.md                               # UPDATE Completion Notes List — CtaReserveSticky no longer placeholder

# Estimation : ~50 nouveaux + ~12 updates = ~62 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (`@tukio/contracts` DTOs), 0.4 (atomics Badge/Card/Button/Toast), 0.5 (patterns PricingDisplay/EmptyState/Modal/QuantitySelector), 0.6 (Pretre baseline + boundaries lint), 0.9 (TanStack Query + next-intl + i18n CI lint + axe-core baseline), 0.10 (docker-compose), 0.11 (CI Lighthouse + perf budgets + axe-core gate), 0.13 (Vercel multi-zones rewrites), 1.2 (gateway KeycloakJwtGuard + envelope filter + throttle), 1.4 (login flow + KeycloakAuthMiddleware + auth callback), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token), 3.10 (listing detail + CtaReserveSticky placeholder — Story 4.3 UPDATE), 4.1 (booking-svc Pretre + IListingSnapshotPort + outbox/inbox + DB migration patterns — Story 4.3 EXTEND avec cart aggregate). UX spec L246-256 (cart-checkout customer features), L755-770 (state management Zustand), L811-832 (stack frontend latest stable), L1110-1148 (component decision tree shared vs feature-scoped), L1241 (EmptyState cart-empty variant), L1326 (apps/customer mobile + desktop équilibré). Architecture lines 419-422 (multi-zones rewrites cart), lines 756-789 (frontend feature-based), lines 806-819 (customer app feature mapping cart-checkout), lines 858-870 (state management Zustand v5 latest), lines 2120-2164 (Pretre canonical), lines 2208-2241 (`@tukio/ui` shared cross-apps + stores), lines 2331 (mapping FR34-48 cart-checkout customer).

1. **API responses envelope ADR-014** — toutes responses gateway-api wrapped `{ method, code, data | error, meta }`. Error codes `CART-*-00X` enveloppe (5 codes).

2. **ADR-001 Clean Architecture strict** — booking-svc cart domain pure (`apps/booking-svc/src/domain/model/cart/**` no NestJS/TypeORM/axios imports). Use cases consume ports. Lint boundaries enforced eslint-plugin-boundaries Story 0.6.

3. **ADR-003 DB per service strict** — cart vit dans `tukio_booking` (booking-svc DB) — cohérent avec epic L1637 "MVP simple table dans `tukio_booking`". Pas de cross-DB SELECT.

4. **ADR-008 internal endpoint authentication** — gateway-api → booking-svc internal `POST /internal/carts/:cartId/lines` avec `X-Internal-Service-Token` header (Doppler — Story 1.10 pattern réutilisé).

5. **ADR-013 frontend multi-zones Vercel** — Story 0.13 baseline ; Story 4.3 verify rewrites `/cart/*` → customer.tukio.one actif. Cookie `tukio-cart-id` `Domain=.tukio.one` bridge cross-zone.

6. **ADR-014 envelope** — toutes responses gateway-api wrapped + error codes ENV-PORTABLES `CART-*-00X`.

7. **State management Zustand v5 (UX spec L755-770)** — store cart shared dans `@tukio/ui/stores/cart.store.ts`. `persist` middleware LocalStorage + `subscribeWithSelector` + `immer`. Cookie cross-zone helper. Pattern réutilisable Stories Epic 11 V1 favorites/wishlist + Epic 12 V1 chat libre.

8. **Atomic design `@tukio/ui` shared cross-apps (UX spec L1110-1148)** — `<Card>`, `<Button>`, `<Badge>`, `<Modal>`, `<Toast>`, `<QuantitySelector>`, `<PricingDisplay>`, `<EmptyState variant="cart-empty">` réutilisés (zero re-implementation). `<MultiVendorWarningModal>` promote à `@tukio/ui/patterns/` shared cross-apps.

9. **Feature-based architecture (Architecture L756-789)** — `apps/customer/src/features/cart-checkout/{components,services,index.ts}` strict. No `components/` at root. Public API barrel limited exports. Lint rule `eslint-plugin-boundaries` frontend.

10. **EN strict (memory `feedback_tech_layer_english`)** — paths `/cart`, `/checkout`, identifiers `cart-line`, DB tables `cart` + `cart_line` (not `panier` + `ligne_panier`). i18n bilingual frontend, but technical layer EN.

11. **i18n FR/EN dès Sprint 0 (memory `feedback_i18n_frontend`)** — zéro hardcoded user-facing text + namespaces `customer.cart.*` + `public.serviceDetail.cta.*` + CI lint `pnpm i18n:audit` Story 0.9 baseline.

12. **NFR3 LCP < 1s checkout (cart page) + Lighthouse CI Story 0.11 gate fail-fast** — Tailwind v4 tree-shaken + Client Component minimal hydration + LocalStorage rehydration sync.

13. **NFR47-55 RGAA AA accessibility** — axe-core 0 violations + kbd nav full + `aria-labelledby/labels` + focus-trap Modal + 44×44px touch targets + reduced motion respect.

14. **NFR58 hreflang systematic** — Story 0.13 baseline + Story 3.9 helper réutilisé (cart page applies hreflang FR/EN automatically).

15. **NFR71 coverage thresholds** — ≥ 95 % Zustand store + ≥ 90 % critical components (CartLineItem, CartSummary, MultiVendorWarningModal, page.tsx) + ≥ 90 % Cart domain + ≥ 90 % cart use cases + ≥ 85 % gateway controllers + ≥ 85 % api-client hooks + ≥ 80 % infrastructure (TypeORM repo + migrations testcontainer).

16. **Latest stable versions (memory `feedback_latest_versions`)** — Zustand v5 + Next.js 15 + React 19 + Tailwind v4 + TanStack Query v5 + next-intl 4.x + immer + nanoid latest.

### Previous Story Intelligence

**Story 0.2 (`@tukio/contracts`)** : Story 4.3 ajoute DTOs `dtos/cart/*` Zod schemas. Pattern Story 0.2 baseline réutilisé.

**Story 0.4 (atomics Card, Button, Badge, Toast, Placeholder)** : Story 4.3 réutilise directement. `<Toast variant="success">` pour add-to-cart feedback. `<Card>` pour CartLineItem + CartSummary. `<Badge variant="info">` pour fallback FR badge. `<Placeholder>` thumbnail fallback.

**Story 0.5 (patterns PricingDisplay, EmptyState 7 variants, Modal, QuantitySelector, ErrorPage 3 variants)** : Story 4.3 réutilise `<PricingDisplay>` dans CartSummary + `<EmptyState variant="cart-empty">` (UX spec L1241 — déjà declared variant) + `<Modal>` pour MultiVendorWarningModal + `<QuantitySelector>` dans CartLineItem (verify Story 0.5 livré — sinon Story 4.3 PR add).

**Story 0.6 (Pretre baseline + replicate + boundaries lint)** : Story 4.3 extend booking-svc Story 4.1 baseline (pas de nouveau service). Boundaries lint enforcement réutilisé.

**Story 0.9 (TanStack Query + next-intl + i18n CI lint + use-debounce + axe-core baseline)** : Story 4.3 réutilise infrastructure TanStack Query + next-intl + i18n CI audit + axe-core CI gate Story 0.9 baseline.

**Story 0.11 (CI Lighthouse + perf budgets + axe-core gate)** : Story 4.3 add `/fr/cart` à budgets Lighthouse + Accessibility ≥ 90 + LCP < 1s + CLS < 0,1 (NFR3).

**Story 0.13 (Vercel multi-zones rewrites)** : Story 4.3 verify rewrites `/cart/*` → customer.tukio.one + `/checkout/*` + `/auth/login` actif.

**Story 1.2 (gateway KeycloakJwtGuard + envelope filter + throttle)** : Story 4.3 réutilise pattern carts.controller — auth optional Guard variant (guest OR authenticated) + throttle 30/min guest, 60/min authenticated.

**Story 1.4 (login flow + KeycloakAuthMiddleware + auth callback)** : Story 4.3 UPDATE `apps/customer/src/middleware.ts` Story 1.4 baseline — on auth/callback success, trigger `POST /v1/carts/merge` if cookie `tukio-cart-id` present.

**Story 1.10 (identity-svc internal endpoints + X-Internal-Service-Token)** : Story 4.3 réutilise pattern internal endpoint authentication pour booking-svc cart controllers.

**Story 3.1 (Catalog data model + categories seed)** : Story 4.3 références category slug pour EmptyState CTA `/category/tents-marquees` cross-zone link.

**Story 3.10 (listing detail public + `CtaReserveSticky` placeholder)** : Story 4.3 **UPDATE** `CtaReserveSticky.tsx` — replace `router.push('/cart?listingId=...')` placeholder with full `cartStore.addLine(...)` dispatch + toast + multi-vendor modal.

**Story 4.1 (booking-svc Pretre + Booking aggregate + `IListingSnapshotPort` + outbox/inbox patterns + DB migration template)** : Story 4.3 **EXTEND** booking-svc :
- Réutilise `IListingSnapshotPort` Story 4.1 pour `add-cart-line.usecase.ts` (fetch listing snapshot frozen at add-to-cart time)
- Réutilise `ListingSnapshot` VO Story 4.1 pour `cart_line.listing_snapshot` JSONB column
- Réutilise pattern UUID v7 (`uuid` v11+ `v7()`) pour `CartId`
- Réutilise migration template Story 4.1 pour `cart` + `cart_line` tables
- Réutilise `UseCasesProxyModule` DynamicModule wire pattern
- Réutilise exception `toEnvelope()` pattern Story 4.1 — codes `CART-*-00X`
- Lint boundaries strict pattern Story 4.1 — cart domain pure

**Story 4.2 (order-svc + payment-svc Pretre saga consumers — Story 4.2 livré juste avant Story 4.3 dans le sprint Epic 4)** : Story 4.3 ne consume PAS directement Story 4.2 (cart est pré-checkout, pas saga). MAIS Story 4.4 (booking submission) transforme cart → Booking via `book-listing.usecase.ts` Story 4.1 baseline qui trigger la saga Story 4.1/4.2 livré.

### What this story does NOT do (out of scope)

- ❌ **Booking submission backend + 3-layer race conditions FR48** → Story 4.4 (Story 4.3 livre cart UI + `book-listing.usecase` Story 4.1 baseline consommera cart for booking creation)
- ❌ **Stripe Elements frontend checkout UI + PaymentIntent client_secret** → Story 4.5 (Story 4.3 CTA "Procéder au paiement" → `/checkout` placeholder route Story 4.5 livre)
- ❌ **Period date picker** → Story 4.5 checkout flow (Story 4.3 add-to-cart avec `period: null`)
- ❌ **Multi-vendor cart parallel saga V1** → Story 8.x V1 (Story 4.3 mono-vendor strict + modal warning)
- ❌ **Cart expiration cron (> 30 days stale)** → V1+ stretch (Story 4.3 livre `last_activity_at` field baseline)
- ❌ **Saved cards (FR50 V1)** → Story 9.x V1+ (Story 4.3 MVP no saved payment methods)
- ❌ **B2B customer cart fields (SIRET, billing address split)** → Story 8.x V1 B2B (Story 4.3 MVP B2C only — `customer_profile_id` simple)
- ❌ **Quantity selector with custom unit (vs MVP simple integer)** → MVP integer min/max from `pricing.minQuantity/maxQuantity` (Story 3.2 baseline)
- ❌ **Inventory pool partagé (FR29 V1)** → V1+ Epic 9+ (Story 4.3 MVP each cart line is independent listing instance)
- ❌ **Cart-svc separate microservice** → V1+ scale stretch (Story 4.3 MVP extends booking-svc DB)
- ❌ **Outbox events from cart actions** → V1+ analytics (Story 4.3 MVP no NATS events — cart is UI state only, business events come from Booking saga Story 4.1/4.2)
- ❌ **`Cart` aggregate state machine** → no state machine (cart is mutable until checkout, no transitions)
- ❌ **Auto-publish median price comparison in cart** → Story 3.5/3.12 baseline median lives at listing display, not cart context
- ❌ **Schema.org Cart JSON-LD** → not standard Schema.org pattern (no Schema.org cart type) — Story 4.3 N/A

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 4.3` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :

1. **`apps/public/src/features/public/service-detail/components/CtaReserveSticky.tsx`** Story 3.10 livré — **CRITICAL : lire l'état Story 3.10 complet pour préserver layout responsive sticky desktop/mobile + breakpoints + i18n keys + existing tests Story 3.10**. Story 4.3 transforme uniquement `onClick` handler — gardez tout le rest comme-est (sticky positioning, button variant, deferred capture explanation text, etc.).
2. **`apps/public/messages/{fr,en}.json`** Story 3.10 livré — add 6 keys `public.serviceDetail.cta.*` (préserver les ~35 keys existantes Story 3.10).
3. **`apps/customer/src/middleware.ts`** Story 1.4 livré — add post-callback hook to trigger cart merge if cookie `tukio-cart-id` present. **CRITICAL : lire le middleware Story 1.4 complet pour préserver JWT validation + cookie auth handling + redirect logic existing**.
4. **`apps/public/next.config.ts`** Story 0.13 — VERIFY rewrites `/cart/*` actif. Si manquant, UPDATE pour ajouter.
5. **`apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`** Story 4.1 livré — UPDATE wire 5 cart use cases + `ICartRepository` impl. **CRITICAL : préserver Story 4.1 baseline wires (9 booking use cases + 4 ports → impls Story 4.1) — ajouter, pas remplacer**.
6. **`packages/contracts/src/dtos/index.ts`** — UPDATE barrel export new cart dtos.
7. **`apps/customer/e2e/lighthouse.config.{ts,js}`** OR `apps/public/e2e/lighthouse.config.{ts,js}` Story 0.11 — UPDATE add `/fr/cart` à budgets list + Accessibility ≥ 90 + LCP < 1s + CLS < 0,1.
8. **`docs/project-context.md`** Story 1.10 livré baseline — add section "Cart MVP (Story 4.3)".
9. **`_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md`** — UPDATE Completion Notes List handoff Story 4.3 done (cart extension dans booking-svc — `tukio_booking.cart` + `cart_line` tables + 5 use cases cart livrés).
10. **`_bmad-output/implementation-artifacts/3-10-listing-detail-public-page.md`** — UPDATE Completion Notes List — `CtaReserveSticky` no longer placeholder, full cart integration Story 4.3 livré.

**Lire l'état complet de chaque UPDATE file avant édition** — particularly :
- `CtaReserveSticky.tsx` Story 3.10 (preserve sticky layout + breakpoints + i18n keys existants)
- `middleware.ts` Story 1.4 (preserve auth flow JWT + cookie handling)
- `usecases-proxy.module.ts` Story 4.1 (preserve 9 booking use cases existing wires)

### Testing Standards

- **Coverage ≥ 95 % Zustand store** (`cart.store.ts` + `cart-cookie.ts`)
- **Coverage ≥ 90 % critical components** (CartLineItem, CartSummary, MultiVendorWarningModal, page.tsx, CtaReserveSticky updated)
- **Coverage ≥ 90 % Cart domain** (booking-svc/domain/model/cart/**) + 5 exceptions
- **Coverage ≥ 90 % 5 use cases cart** (booking-svc/usecases/cart/**)
- **Coverage ≥ 85 % gateway carts.controller + forwarders**
- **Coverage ≥ 85 % api-client hooks cart**
- **Coverage ≥ 80 % infrastructure** (TypeORM repo + migration testcontainer Postgres + booking-svc cart controller internal)
- **Tests Vitest unit + integration** + **Playwright e2e 12 scenarios** + **axe-core RGAA AA 0 violations**
- **Lighthouse CI** : `/fr/cart` Accessibility ≥ 90 + LCP < 1s + CLS < 0,1 + FID < 100ms (NFR3)
- **Lint boundaries strict** 0 violations booking-svc/domain/model/cart + apps/customer/features/cart-checkout
- **EN strict + i18n CI audit** `pnpm i18n:audit` Story 0.9 pass
- **NFR71 coverage thresholds enforced CI Story 0.11**

### Project Structure Notes

✅ **Aligné** UX spec L246-256 (cart-checkout customer features), L755-770 (Zustand state management), L811-832 (stack frontend latest stable), L1110-1148 (component decision tree shared @tukio/ui patterns), L1241 (EmptyState cart-empty variant), L1326 (mobile + desktop équilibré customer); Architecture lines 419-422 (multi-zones rewrites cart), 756-789 (frontend feature-based), 806-819 (customer cart-checkout feature), 858-870 (Zustand v5 latest), 2120-2164 (Pretre canonical), 2208-2241 (@tukio/ui shared + stores), 2331 (FR34-48 → customer cart-checkout); PRD §FR47 (Booking lifecycle — cart is pre-checkout), §FR49 (Stripe Elements — Story 4.5 finalise), §NFR3 (LCP < 1s cart page), §NFR42 (saga resilience — cart is UI-only, no events MVP), §NFR47-55 (RGAA AA), §NFR58 (hreflang systematic), §NFR60 (fallback FR/EN UGC), §NFR71 (coverage thresholds); Stories 0.2/0.4/0.5/0.6/0.9/0.10/0.11/0.13/1.2/1.4/1.10/3.10/4.1; memories `feedback_clean_architecture_explicit`, `feedback_api_envelope_response`, `feedback_tech_layer_english`, `feedback_i18n_frontend`, `feedback_latest_versions`.

⚠️ **Déviations** : aucune significative. Cart store dans `@tukio/ui/stores/` (vs UX spec mentioned both `@tukio/ui/stores/` ET `apps/customer/features/cart-checkout/stores/` — Story 4.3 décision documentée Dev Notes : shared cross-apps justifie `@tukio/ui`). Cart aggregate sans state machine (vs Booking/Order state machines) — par design (cart mutable). Backend cart in booking-svc (not new cart-svc) — explicit epic L1637 decision.

⚠️ **Décisions clés Story 4.3** :
- Zustand store dans `@tukio/ui/stores/` shared cross-apps (justification multi-zones)
- Persistence dual-layer : cookie cross-zone `.tukio.one` + LocalStorage zone-local + backend `tukio_booking.cart` table
- Backend cart EXTEND booking-svc (pas nouveau cart-svc — epic décision L1637)
- Cart aggregate SANS state machine (mutable UI state)
- Mono-vendor MVP strict + `<MultiVendorWarningModal>` promoted `@tukio/ui/patterns/`
- `addLine` return discriminated union (added/multi_vendor_warning/self_booking_forbidden)
- Period selection deferred Story 4.5 checkout
- Cookie `tukio-cart-id` non-HttpOnly (readable by JS for store sync)
- Merge anonymous → customer "keep guest cart, discard old customer cart" MVP
- NO outbox events from cart actions MVP (V1+ analytics)
- NFR3 LCP < 1s Lighthouse CI gate
- 12 Playwright e2e scenarios + axe-core RGAA AA + NFR71 coverage thresholds

### References

- [Source: epics.md#Epic-4-Story-4.3 — Lines 1628-1644]
- [Source: prd.md#FR47 (Booking lifecycle), #FR49 (Stripe Elements — Story 4.5 finalise), #NFR3 (LCP < 1s), #NFR42 (saga resilience — cart UI-only no events MVP), #NFR47-55 (RGAA AA), #NFR58 (hreflang), #NFR60 (fallback FR/EN), #NFR71 (coverage thresholds)]
- [Source: architecture.md — ADR-001 Clean Architecture, ADR-003 DB per service (cart in tukio_booking), ADR-008 internal endpoint authentication, ADR-013 frontend multi-zones Vercel, ADR-014 envelope, lines 419-422 multi-zones rewrites cart, lines 756-789 frontend feature-based, lines 806-819 customer cart-checkout feature, lines 858-870 Zustand v5 latest, lines 2120-2164 Pretre canonical, lines 2208-2241 @tukio/ui shared + stores, lines 2331 mapping FR34-48 customer cart-checkout]
- [Source: ux-design-specification.md — L246-256 (cart-checkout customer screens), L755-770 (state management Zustand), L811-832 (stack frontend latest), L1110-1148 (component decision tree shared @tukio/ui), L1241 (EmptyState cart-empty variant), L1326 (mobile + desktop équilibré customer), L1474 (cart.checkout.deferredCapture microcopy FR + EN)]
- [Source: Stories 0.2 (contracts DTOs), 0.4 (atomics Card/Button/Badge/Toast/Placeholder), 0.5 (patterns PricingDisplay/EmptyState/Modal/QuantitySelector — verify Story 0.5 livré QuantitySelector), 0.6 (Pretre baseline + boundaries lint), 0.9 (TanStack Query + next-intl + i18n CI lint + axe-core baseline + formatCurrency), 0.10 (docker-compose), 0.11 (CI Lighthouse + perf budgets + axe-core gate), 0.13 (Vercel multi-zones rewrites), 1.2 (gateway KeycloakJwtGuard + envelope filter + throttle), 1.4 (login flow + KeycloakAuthMiddleware + auth callback), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token), 3.1 (catalog categories seed), 3.10 (listing detail public + CtaReserveSticky placeholder — Story 4.3 UPDATE), 4.1 (booking-svc Pretre + IListingSnapshotPort + outbox/inbox + DB migration patterns — Story 4.3 EXTEND avec cart aggregate)]
- [External: https://github.com/pmndrs/zustand — Zustand v5 docs]
- [External: https://github.com/pmndrs/zustand/tree/main/docs/integrations — persist middleware docs]
- [External: https://immerjs.github.io/immer/ — Immer middleware docs]
- [External: https://github.com/ai/nanoid — Nanoid URL-safe IDs]
- [External: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates — TanStack Query optimistic updates pattern]
- [External: https://nextjs.org/docs/app/api-reference/file-conventions/middleware — Next.js 15 middleware (cart merge on auth callback)]
- [External: https://vercel.com/docs/edge-network/rewrites — Vercel multi-zones rewrites]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir par dev-story)

### Debug Log References

### Completion Notes List

(points d'attention pour :
- **Story 4.4** (booking submission + 3-layer race conditions FR48 — consume cart via `POST /v1/bookings/checkout-session` qui transforme `cart` → `Booking` via Story 4.1 `book-listing.usecase` baseline. Story 4.4 ajoute Layer 2 GIST exclusion constraint + Layer 3 optimistic lock + `booking.conflict-detected.v1` event + chaos tests. Cart is consumed + clear() post-Booking creation.)
- **Story 4.5** (Stripe Elements checkout frontend + PaymentIntent client_secret — Story 4.5 livre la page `/checkout` placeholder Story 4.3 + consume `clientSecret` returned by Story 4.2 `create-payment-intent.usecase`. Cart state encore visible at /checkout pour final review avant payment.)
- **Story 4.6** (pro pending requests page — independent backend Story 4.3, no overlap)
- **Story 4.7** (pro accept/refuse + Stripe capture — independent backend Story 4.3, no overlap)
- **Story 4.11** (customer bookings list/detail UI — réutilise `<Card>`, `<PricingDisplay>` patterns réutilisés Story 4.3)
- **Story 5.4** (notification-svc cart abandonment emails V1+ — V1 stretch consume `cart.line-added.v1` analytics event if added V1)
- **Story 8.x V1 multi-vendor cart** — Story 4.3 mono-vendor invariant baseline + `<MultiVendorWarningModal>` will be replaced by multi-vendor cart flow + parallel saga orchestration. V1 promote Cart aggregate to multi-vendor with `vendors: Map<proProfileId, CartVendorBucket>` structure.
- **Story 11.x V1 favorites/wishlist** — réutilise Story 4.3 pattern Zustand store shared `@tukio/ui/stores/` + cookie cross-zone + backend sync `tukio_<svc>` table.
- **Story 12.x V1 chat libre pre-booking** — réutilise Story 4.3 pattern feature-based composition + `<Modal>` + `<Toast>` UX.)

### File List

(à remplir par dev-story)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-14
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 4 — Booking, Cart & Payment Saga (MVP) — **tunnel Visitor → Customer pre-checkout MVP**
- **Sprint cible** : Sprint 5 (3ᵉ story Epic 4 — peut run en parallèle avec Story 4.2 saga consumers ou Story 4.4 race conditions selon team capacity — Story 4.3 indépendante backend Stories 4.1/4.2 livrés)
- **Estimation effort** : **6-8 jours** (1 dev fullstack senior — Zustand store shared `@tukio/ui` + 4 frontend components customer + UPDATE Story 3.10 CtaReserveSticky + booking-svc cart aggregate + 5 use cases + DB migration + gateway-api 5 endpoints + TanStack Query hooks + i18n FR/EN + cross-zone Vercel verify + merge anonymous→customer Story 1.4 callback + 12 Playwright e2e + Lighthouse CI gate + axe-core RGAA + lint boundaries + ~62 fichiers)
- **Dépendances upstream** :
  - Stories 0.2 (contracts), 0.4 (atomics Card/Button/Badge/Toast/Placeholder), 0.5 (patterns PricingDisplay/EmptyState/Modal/QuantitySelector — verify QuantitySelector livré), 0.6 (Pretre + boundaries lint), 0.9 (TanStack Query + next-intl + i18n CI audit + axe-core), 0.10 (docker-compose), 0.11 (CI Lighthouse + perf budgets), 0.13 (Vercel multi-zones rewrites)
  - Stories 1.2 (gateway KeycloakJwtGuard + envelope + throttle), 1.4 (login flow + middleware + callback), 1.10 (identity-svc internal endpoints pattern)
  - Stories 3.1 (catalog categories seed), 3.10 (listing detail public + CtaReserveSticky placeholder — Story 4.3 UPDATE)
  - **Story 4.1 (booking-svc Pretre + IListingSnapshotPort + outbox/inbox + DB migration patterns — Story 4.3 EXTEND avec cart aggregate dans booking-svc)**
- **Dépendances downstream** (Epic 4 + cross-Epic) :
  - Story 4.4 (booking submission + 3-layer race conditions — consume cart for Booking creation)
  - Story 4.5 (Stripe Elements checkout frontend — placeholder route `/checkout` livré Story 4.3 redirect target)
  - Story 4.6 (pro pending requests page — independent)
  - Story 4.11 (customer bookings list/detail UI — réutilise patterns `<Card>` + `<PricingDisplay>`)
  - Story 5.4 (notification-svc — V1+ cart abandonment emails consume `cart.line-added.v1` if added V1)
  - Stories Epic 8 V1 (multi-vendor cart — Story 4.3 mono-vendor baseline)
  - Stories Epic 11 V1 (favorites/wishlist — réutilise pattern Zustand store shared)
- **FRs covered** :
  - **FR34 partial** ✅ Cart UI mono-vendor MVP (`add to cart` from listing → cart page review)
  - **FR35 partial** ✅ Customer can review cart before checkout (cart page + summary + commission transparency)
  - **FR47 partial** ✅ Cart is pre-Booking layer — Booking lifecycle starts Story 4.4 `book-listing.usecase`
- **NFRs touchés** :
  - **NFR3** ✅ Cart page LCP < 1s p75 (Lighthouse CI gate)
  - **NFR42** N/A (cart MVP no outbox events)
  - **NFR47-55** ✅ RGAA AA + axe-core 0 violations + kbd nav full
  - **NFR58** ✅ hreflang systematic (Story 0.13 baseline)
  - **NFR60** ✅ Fallback FR/EN UGC (badge "Available in French only" si EN missing)
  - **NFR71** ✅ Coverage thresholds enforced (95 % store + 90 % components/domain/usecases + 85 % gateway/hooks + 80 % infra)
  - **NFR82** N/A (cart actions not audited — V1+ peut ajouter `cart.line-added.v1` analytics event)

> **Prochaine story → Story 4.4** (booking submission + 3-layer race conditions FR48 R5 critique — consume cart Story 4.3 via `POST /v1/bookings/checkout-session` qui transforme cart → Booking via Story 4.1 `book-listing.usecase` baseline + add Layer 2 GIST exclusion constraint + Layer 3 optimistic lock + `booking.conflict-detected.v1` event + chaos tests singleton process race). Story 4.4 + Story 4.5 (Stripe Elements frontend) doivent être livrées avant que le tunnel Customer end-to-end soit utilisable end-to-end MVP. Story 4.3 livre la PRE-checkout layer, Story 4.4 livre le booking submission backend, Story 4.5 livre le checkout payment frontend.

---

**Dev agent next steps :**
1. Lire ce file complètement (~ 730 lignes)
2. Vérifier upstream Stories 0.2/0.4/0.5/0.6/0.9/0.10/0.11/0.13/1.2/1.4/1.10/3.1/3.10/4.1 implémentées (`sprint-status.yaml` — Story 4.1 doit être `done` AVANT Story 4.3 dev — Stories 3.10/0.13/1.4 doivent être `done` pour CtaReserveSticky update + Vercel rewrites + middleware login callback)
3. **Vérifier Story 0.5 livré `<QuantitySelector>`** — si pas livré, Story 4.3 PR ajoute à `packages/ui/src/patterns/QuantitySelector/`
4. **Vérifier `pnpm view zustand version` + `pnpm view immer version` + `pnpm view nanoid version`** latest stable juste avant impl (memory `feedback_latest_versions`)
5. **Lire l'état complet de chaque UPDATE file Story 3.10/1.4/4.1 avant édition** — particularly :
   - `CtaReserveSticky.tsx` Story 3.10 (preserve sticky layout responsive + i18n + tests existing)
   - `middleware.ts` Story 1.4 (preserve JWT validation + cookie auth handling)
   - `usecases-proxy.module.ts` Story 4.1 (preserve 9 booking use cases wires existing)
6. Implémenter Tasks 1-13 dans l'ordre :
   - **Tasks 1-2 frontend Zustand store + cart page + components** (Phase 1, ~2 jours)
   - **Tasks 3-4 CartLineItem + CtaReserveSticky UPDATE Story 3.10** (Phase 2, ~1 jour)
   - **Tasks 5-7 booking-svc EXTEND cart aggregate + 5 use cases + DB migration** (Phase 3, ~2 jours)
   - **Tasks 8-9 gateway-api endpoints + api-client hooks** (Phase 4, ~1 jour)
   - **Tasks 10-11 i18n + cross-zone verify + merge anonymous→customer Story 1.4 callback** (Phase 5, ~0.5 jour)
   - **Tasks 12-13 e2e tests + Lighthouse + commit + handoff** (Phase 6, ~1.5 jour)
7. Lancer `pnpm lint && pnpm typecheck && pnpm test --coverage` après chaque jalon
8. Commit Story 4.3 quand :
   - 0 violations boundaries lint booking-svc/domain/model/cart + apps/customer/features/cart-checkout
   - Coverage NFR71 thresholds (≥ 95 % store + ≥ 90 % critical components + ≥ 90 % domain/usecases + ≥ 85 % gateway/hooks + ≥ 80 % infra)
   - 12 Playwright e2e scenarios pass + axe-core 0 violations + Lighthouse `/fr/cart` Accessibility ≥ 90 + LCP < 1s + CLS < 0,1
   - Cross-zone cookie e2e scenario pass (add from `tukio.one/services/<slug>` → navigate `/cart` → cart visible)
   - Handoff Stories 4.4-4.5 + 8.x V1 multi-vendor documented project-context + completion notes Stories 4.1 + 3.10 updated
   - PR ouvert vers `develop` (jamais main per git workflow Tukio memory)
