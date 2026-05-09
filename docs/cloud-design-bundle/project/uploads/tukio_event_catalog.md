# Tukio — NATS Event Catalog

> Référence exhaustive de tous les events NATS du système Tukio. Ground truth pour `@tukio/contracts`.
> À lire avant tout développement backend qui produit ou consomme des events.
> Audience : tech lead, devs backend, devs frontend (pour comprendre les flows asynchrones).

---

## Sommaire

- [A. Conventions](#a-conventions)
- [B. Event envelope](#b-event-envelope)
- [C. NATS topology](#c-nats-topology)
- [D. Events by service](#d-events-by-service)
  - [D.1 identity-svc](#d1-identity-svc)
  - [D.2 catalog-svc](#d2-catalog-svc)
  - [D.3 booking-svc](#d3-booking-svc)
  - [D.4 order-svc](#d4-order-svc)
  - [D.5 payment-svc](#d5-payment-svc)
  - [D.6 messaging-svc](#d6-messaging-svc)
  - [D.7 review-svc](#d7-review-svc)
  - [D.8 media-svc](#d8-media-svc)
  - [D.9 notification-svc](#d9-notification-svc)
- [E. Cross-service flows](#e-cross-service-flows)
- [F. Subscription matrix](#f-subscription-matrix)
- [G. Versioning policy](#g-versioning-policy)
- [H. Implementation in @tukio/contracts](#h-implementation-in-tukiocontracts)

---

## A. Conventions

### A.1 Subject naming

Format : `<service>.<aggregate>.<event-or-command>.v<n>`

Règles :
- **Lowercase** uniquement
- **Tokens** séparés par des points (`.`)
- **Tokens composés** séparés par des tirets (`-`)
- **Suffix de version** obligatoire (`.v1`, `.v2`)
- **Préfixe `cmd.`** pour les commandes (rares en architecture choréographée)
- **Préfixe `dlq.`** pour les dead letters

Exemples valides :
```
booking.reservation.requested.v1
catalog.listing.published.v1
payment.intent.captured.v1
identity.user.kyc-verified.v1
cmd.payment.capture.v1
dlq.booking
```

Exemples invalides :
```
BookingRequested              ❌ pas de PascalCase
booking_requested             ❌ underscores
booking.requested             ❌ pas de version
booking.reservation.created   ❌ "created" trop générique, préférer "requested"
```

### A.2 Event vs command

- **Event** : un fait passé, immuable, qui s'est déjà produit. `booking.requested.v1`
- **Command** : une intention, qui peut être rejetée, traitée, retardée. `cmd.payment.capture.v1`

Tukio utilise **massivement des events**, rarement des commands (saga choréographée). Les commands sont réservées aux cas où un service demande explicitement à un autre de faire quelque chose (pattern request/reply ponctuel).

### A.3 Verbe au passé

Les events nomment toujours un fait passé :
- `requested` (pas `request`)
- `confirmed` (pas `confirm`)
- `published` (pas `publish`)
- `cancelled` (pas `cancel`)

Cela rend explicite que l'event décrit ce qui **vient de se produire**.

### A.4 Idempotence garantie

- Tout producer publie avec un header NATS `Nats-Msg-Id` égal à l'`id` ULID de l'envelope
- JetStream déduplique sur cette base (fenêtre 2 minutes par défaut)
- Tout consumer écrit dans son `inbox` table avant tout side-effect (cf. `Research_Report.md` §3.2)

---

## B. Event envelope

Tous les events partagent la même envelope inspirée de CloudEvents :

```json
{
  "id": "01HXXX...",
  "type": "booking.reservation.requested.v1",
  "source": "booking-svc",
  "time": "2026-05-06T10:00:00Z",
  "actor": {
    "type": "user",
    "id": "kc-uuid-of-actor"
  },
  "correlationId": "01HYY...",
  "causationId": "01HZZ...",
  "data": {
    /* event-specific payload, see §D */
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string (ULID) | Identifiant unique de l'event. Sert de clé de déduplication. |
| `type` | string | Subject NATS (= identifiant du contrat) |
| `source` | string | Nom du service émetteur (ex : `booking-svc`) |
| `time` | string (ISO 8601 UTC) | Date/heure d'émission |
| `actor` | object \| null | Qui a déclenché l'event |
| `actor.type` | enum | `user`, `system`, `admin`, `webhook` |
| `actor.id` | string \| null | UUID Keycloak si `user` ou `admin`, sinon source |
| `correlationId` | string (ULID) | Identifiant de saga (suivi end-to-end) |
| `causationId` | string (ULID) \| null | ID de l'event qui a causé celui-ci (généalogie) |
| `data` | object | Payload métier spécifique à l'event |

### B.1 TypeScript shared type

Dans `@tukio/contracts/src/envelope.ts` :

```typescript
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  time: string;
  actor: Actor | null;
  correlationId: string;
  causationId: string | null;
  data: T;
}

export interface Actor {
  type: 'user' | 'system' | 'admin' | 'webhook';
  id: string | null;
}
```

Chaque event-specific type étend cette structure :

```typescript
export type BookingRequestedV1 = DomainEvent<BookingRequestedV1Data>;

export interface BookingRequestedV1Data {
  bookingId: string;
  customerId: string;
  // ...
}
```

---

## C. NATS topology

### C.1 Streams

Un stream JetStream par service producteur. Chaque stream capture les events sous le préfixe `<service>.>`.

| Stream | Subjects | Retention | Replicas (prod) |
|--------|----------|-----------|-----------------|
| `IDENTITY` | `identity.>` | 14 j / 5 GB | R3 |
| `CATALOG` | `catalog.>` | 14 j / 5 GB | R3 |
| `BOOKING` | `booking.>` | 14 j / 5 GB | R3 |
| `ORDER` | `order.>` | 14 j / 5 GB | R3 |
| `PAYMENT` | `payment.>` | 30 j / 10 GB | R3 |
| `MESSAGING` | `messaging.>` | 7 j / 2 GB | R3 |
| `REVIEW` | `review.>` | 14 j / 2 GB | R3 |
| `MEDIA` | `media.>` | 7 j / 2 GB | R3 |
| `NOTIFICATION` | `notification.>` | 7 j / 2 GB | R3 |
| `DLQ` | `dlq.>` | 90 j / 5 GB | R3 |
| `CMD` | `cmd.>` | 7 j / 1 GB | R3 |

Note : `PAYMENT` a une rétention plus longue parce que les events Stripe peuvent arriver tardivement (disputes, refunds différés).

### C.2 Consumers

Convention de nommage : `<consumer-service>-on-<event>` ou `<consumer-service>-<purpose>`.

Exemples :
- `notification-on-booking-requested`
- `catalog-on-booking-confirmed`
- `meilisearch-indexer-on-listing-published`
- `analytics-on-payment-captured`

Caractéristiques par défaut :
- `durable: true` (state persisté)
- `deliver_policy: new` (skip backlog si nouveau consumer)
- `ack_policy: explicit` (acknowledgment manuel)
- `max_deliver: 5` (puis DLQ)
- `ack_wait: 30s` (timeout avant retry)

---

## D. Events by service

### D.1 identity-svc

Le service identity gère le profil métier des users (au-delà de l'auth Keycloak).

#### `identity.user.registered.v1`

**Émis quand** : un user complète sa vérification email côté Keycloak et son profil métier est créé dans `identity-svc`.

**Trigger** : webhook Keycloak → `identity-svc.OnUserVerifiedUseCase`.

**Data** :
```typescript
{
  userId: string;          // Keycloak sub UUID
  email: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'pro';
  locale: 'fr-FR';
  registeredAt: string;    // ISO 8601
}
```

**Consumers** :
- `notification-svc` → email de bienvenue
- `analytics` → tracking inscription

---

#### `identity.profile.updated.v1`

**Émis quand** : un user met à jour son profil (nom, photo, préférences notif).

**Data** :
```typescript
{
  userId: string;
  changedFields: Array<'firstName' | 'lastName' | 'avatarUrl' | 'phone' | 'locale' | 'notificationPrefs'>;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}
```

**Consumers** :
- `notification-svc` → si `notificationPrefs` changé, mise à jour subscriptions email
- `audit-log` → trace du changement

---

#### `identity.kyc.submitted.v1`

**Émis quand** : un pro a uploadé tous ses documents KYC.

**Data** :
```typescript
{
  userId: string;
  providerId: string;
  documentTypes: Array<'id_card' | 'address_proof' | 'kbis'>;
  submittedAt: string;
}
```

**Consumers** :
- `notification-svc` → alerte admin Slack ("nouveau KYC à valider")
- Admin dashboard widget

---

#### `identity.kyc.verified.v1`

**Émis quand** : un admin a validé le KYC d'un pro.

**Data** :
```typescript
{
  userId: string;
  providerId: string;
  verifiedAt: string;
  verifiedBy: string;          // admin user ID
}
```

**Consumers** :
- `catalog-svc` → autorise la publication directe des fiches (sans modération systématique)
- `notification-svc` → email "Votre compte est validé !"
- `payment-svc` → si Stripe Connect en `pending`, peut activer flag `kyc_complete`

---

#### `identity.kyc.rejected.v1`

**Émis quand** : un admin rejette le KYC.

**Data** :
```typescript
{
  userId: string;
  providerId: string;
  rejectedAt: string;
  rejectedBy: string;
  reason: 'document_unreadable' | 'document_expired' | 'mismatch_identity' | 'other';
  message: string;             // détail textuel pour le pro
}
```

**Consumers** :
- `notification-svc` → email avec détail + lien re-upload

---

#### `identity.user.suspended.v1`

**Émis quand** : un admin suspend un user.

**Data** :
```typescript
{
  userId: string;
  role: 'customer' | 'pro';
  suspendedBy: string;
  suspendedUntil: string;      // ISO 8601 (date fin suspension)
  reason: string;              // enum + détail
  notes: string;
}
```

**Consumers** :
- `catalog-svc` → masque les fiches du pro
- `booking-svc` → flag les bookings actifs
- `messaging-svc` → bascule conversations en read-only
- `notification-svc` → email user suspendu

---

#### `identity.user.unsuspended.v1`

**Émis quand** : suspension expire ou est levée manuellement par admin.

**Data** :
```typescript
{
  userId: string;
  role: 'customer' | 'pro';
  unsuspendedAt: string;
  unsuspendedBy: string | null;   // null si expiration auto
}
```

**Consumers** :
- `catalog-svc` → republie les fiches
- `messaging-svc` → réactive conversations
- `notification-svc` → email réactivation

---

#### `identity.user.banned.v1`

**Émis quand** : un admin-super bannit un user.

**Data** :
```typescript
{
  userId: string;
  role: 'customer' | 'pro';
  bannedBy: string;
  bannedAt: string;
  reason: string;
  hashedSignatures: {
    email: string;             // sha256(email)
    siret: string | null;
    phone: string | null;
  };
}
```

**Consumers** :
- `catalog-svc` → archive définitive des fiches
- `booking-svc` → annule bookings actifs (event `booking.cancelled.v1` avec reason `user_banned`)
- `payment-svc` → annule reversements en attente, cancel subscriptions
- `messaging-svc` → archive conversations
- `notification-svc` → email user
- `anti-fraud-svc` (V1) → ajoute hashes à la banlist

---

#### `identity.subscription-tier.changed.v1`

**Émis quand** : le tier d'un pro change (Starter ↔ Business ↔ Enterprise).

**Trigger** : webhook Stripe `customer.subscription.created/updated/deleted` → `payment-svc` → cascade vers `identity-svc`.

**Data** :
```typescript
{
  userId: string;
  providerId: string;
  oldTier: 'starter' | 'business' | 'enterprise';
  newTier: 'starter' | 'business' | 'enterprise';
  effectiveAt: string;         // ISO 8601 (peut être futur si downgrade fin de période)
  stripeSubscriptionId: string | null;
}
```

**Consumers** :
- `payment-svc` → met à jour le commission_rate appliqué aux futures transactions
- `catalog-svc` → applique limites (services max, photos max) si downgrade
- `messaging-svc` → check feature flags (réponse aux avis V1)
- `notification-svc` → email confirmation changement

---

### D.2 catalog-svc

#### `catalog.listing.created.v1`

**Émis quand** : un pro crée un brouillon de fiche service.

**Data** :
```typescript
{
  listingId: string;
  providerId: string;
  categoryId: string;
  subcategoryId: string;
  typeId: string;
  title: string;
  status: 'draft';
  createdAt: string;
}
```

**Consumers** :
- `analytics` → stats catalog growth

---

#### `catalog.listing.published.v1`

**Émis quand** : une fiche est publiée (soit après modération admin, soit en publication directe pour pros vérifiés).

**Data** :
```typescript
{
  listingId: string;
  providerId: string;
  categoryId: string;
  subcategoryId: string;
  typeId: string;
  title: string;
  description: string;
  pricing: {
    mode: 'unit' | 'forfait' | 'quote';
    amountCents: number;
    currency: 'EUR';
    minQuantity: number | null;
    maxQuantity: number | null;
  };
  cancellationPolicy: 'flexible' | 'standard' | 'strict';
  city: string;
  postalCode: string;
  geo: { lat: number; lng: number } | null;
  publishedAt: string;
}
```

**Consumers** :
- **`catalog-svc` itself** (internal Meilisearch indexer) → indexation pour recherche
- `notification-svc` → newsletter pros (digest hebdo)
- `analytics`

---

#### `catalog.listing.updated.v1`

**Émis quand** : un pro modifie une fiche déjà publiée.

**Data** :
```typescript
{
  listingId: string;
  providerId: string;
  changedFields: string[];     // ['title', 'description', 'photos', 'pricing']
  requiresRemoderation: boolean;  // true si modif majeure
}
```

**Consumers** :
- Meilisearch indexer → re-indexation
- `booking-svc` → snapshot des bookings actifs reste figé (pas d'impact)

---

#### `catalog.listing.unpublished.v1`

**Émis quand** : un pro retire une fiche, ou admin la suspend.

**Data** :
```typescript
{
  listingId: string;
  providerId: string;
  reason: 'by_pro' | 'by_admin' | 'pro_suspended' | 'pro_banned';
  unpublishedAt: string;
}
```

**Consumers** :
- Meilisearch indexer → suppression de l'index
- `booking-svc` → flag bookings futurs ; alerte admin si bookings actifs

---

#### `catalog.listing.archived.v1`

**Émis quand** : une fiche est archivée définitivement.

**Data** :
```typescript
{
  listingId: string;
  providerId: string;
  archivedAt: string;
  archivedBy: 'pro' | 'admin' | 'system';
}
```

---

#### `catalog.listing.rejected.v1`

**Émis quand** : un admin rejette une fiche en modération.

**Data** :
```typescript
{
  listingId: string;
  providerId: string;
  rejectedBy: string;
  reason: 'low_quality_photos' | 'insufficient_description' | 'aberrant_price' | 'inappropriate_content' | 'other';
  message: string;             // commentaire admin pour le pro
}
```

**Consumers** :
- `notification-svc` → email pro avec raison

---

#### `catalog.availability.changed.v1`

**Émis quand** : le pro modifie ses disponibilités (calendrier, blocages).

**Data** :
```typescript
{
  listingId: string;
  providerId: string;
  changeType: 'block' | 'unblock' | 'inventory_changed' | 'rules_changed';
  affectedPeriod: { from: string; to: string } | null;
  newInventory: number | null;
}
```

**Consumers** :
- `booking-svc` → mise à jour read-model dispo (pas critique : la source de vérité reste `catalog-svc`)
- Meilisearch indexer → mise à jour facette "available"

---

#### `catalog.category.created.v1` / `catalog.category.updated.v1`

**Émis quand** : un admin gère la taxonomie.

**Data** :
```typescript
{
  categoryId: string;
  parentId: string | null;     // pour sous-catégories
  level: 1 | 2 | 3;
  name: string;
  slug: string;
  active: boolean;
}
```

**Consumers** :
- Frontend cache busting
- Meilisearch indexer (si re-classification de fiches existantes)

---

### D.3 booking-svc

cf. `tukio_booking_svc_deepdive.md` §A.4 pour la liste détaillée.

#### `booking.requested.v1`

**Émis quand** : un customer crée une demande de booking (POST /v1/bookings).

**Data** :
```typescript
{
  bookingId: string;
  customerId: string;
  providerId: string;
  listingId: string;
  period: { from: string; to: string };
  quantity: number;
  options: Array<{ optionId: string; label: string; quantity: number; priceCents: number }>;
  pricing: {
    subtotalCents: number;
    optionsCents: number;
    deliveryCents: number;
    totalCents: number;
    currency: 'EUR';
  };
  deliveryAddress: {
    street: string;
    postalCode: string;
    city: string;
  };
  cancellationPolicy: 'flexible' | 'standard' | 'strict';
  timeoutAt: string;           // ISO 8601, généralement +48h
}
```

**Consumers** :
- `order-svc` → crée draft Order
- `notification-svc` → email customer "Demande envoyée" + email pro "Nouvelle demande"
- `analytics`

---

#### `booking.accepted.v1`

**Émis quand** : le pro accepte la demande.

**Data** :
```typescript
{
  bookingId: string;
  customerId: string;
  providerId: string;
  acceptedAt: string;
  message: string | null;        // message optionnel du pro
}
```

**Consumers** :
- `order-svc` → marque Order ready_for_payment
- `payment-svc` → capture du PaymentIntent (transition auth → captured)
- `messaging-svc` → crée la conversation
- `notification-svc` → email customer "Confirmé !"

---

#### `booking.refused.v1`

**Émis quand** : le pro refuse.

**Data** :
```typescript
{
  bookingId: string;
  customerId: string;
  providerId: string;
  refusedAt: string;
  reason: 'unavailable' | 'out_of_zone' | 'insufficient_stock' | 'incompatible_request' | 'other';
  message: string | null;
}
```

**Consumers** :
- `order-svc` → cancel order
- `payment-svc` → cancel auth (no capture, no refund needed)
- `notification-svc` → email customer "Demande refusée + alternatives"
- `catalog-svc` → réouverture du slot dispo (déjà fait via `slot_released` ci-dessous)

---

#### `booking.timed-out.v1`

**Émis quand** : 48h s'écoulent sans réponse pro.

**Trigger** : cron `TimeoutPendingBookingsUseCase`.

**Data** :
```typescript
{
  bookingId: string;
  customerId: string;
  providerId: string;
  timedOutAt: string;
  originalRequestedAt: string;
}
```

**Consumers** : identique à `booking.refused.v1` + alerte admin pour le pro (stat de réactivité).

---

#### `booking.confirmed.v1`

**Émis quand** : le payment a été capturé avec succès → booking firm.

**Trigger** : `OnOrderPaidUseCase` (consumer de `order.paid.v1`).

**Data** :
```typescript
{
  bookingId: string;
  orderId: string;
  customerId: string;
  providerId: string;
  period: { from: string; to: string };
  totalCents: number;
}
```

**Consumers** :
- `notification-svc` → email customer "Paiement confirmé, RDV le X" + facture en PJ
- `messaging-svc` → débloque accès à la conversation
- `analytics`

---

#### `booking.completed.v1`

**Émis quand** : la date de fin de booking est passée et tout s'est bien déroulé.

**Trigger** : cron `CompleteFinishedBookingsUseCase`.

**Data** :
```typescript
{
  bookingId: string;
  orderId: string;
  customerId: string;
  providerId: string;
  completedAt: string;
}
```

**Consumers** :
- `payment-svc` → schedule payout pro (J+1)
- `review-svc` → enable review submission window
- `notification-svc` → email J+1 "Comment s'est passé ?"
- `analytics`

---

#### `booking.cancelled.v1`

**Émis quand** : annulation par client, par pro, ou par système.

**Data** :
```typescript
{
  bookingId: string;
  orderId: string | null;        // null si annulé avant order
  customerId: string;
  providerId: string;
  cancelledBy: 'customer' | 'pro' | 'system';
  reason: string;
  refundAmountCents: number;
  refundPercentage: number;
}
```

**Consumers** :
- `payment-svc` → trigger refund Stripe (partial ou total)
- `order-svc` → cancel order
- `notification-svc` → emails customer + pro avec montant refund
- `catalog-svc` → release slot

---

#### `booking.slot-released.v1`

**Émis quand** : un slot d'inventaire est libéré (refus, annulation, timeout, payment failed).

**Data** :
```typescript
{
  slotId: string;
  listingId: string;
  bookingId: string;
  period: { from: string; to: string };
  quantity: number;
}
```

**Consumers** :
- `catalog-svc` → mise à jour read-model dispo
- Meilisearch indexer → recalcul facette availability

---

#### `booking.disputed.v1`

**Émis quand** : un litige est ouvert sur un booking.

**Data** :
```typescript
{
  bookingId: string;
  litigationId: string;
  openedBy: 'customer' | 'pro';
  type: 'service_not_conforming' | 'late_delivery' | 'damage' | 'no_show' | 'other';
  description: string;
}
```

**Consumers** :
- `payment-svc` → fige les reversements liés
- `notification-svc` → emails parties + admin
- Admin dashboard alert

---

### D.4 order-svc

#### `order.created.v1`

**Émis quand** : `order-svc` crée un draft Order suite à `booking.requested.v1`.

**Data** :
```typescript
{
  orderId: string;
  customerId: string;
  bookingIds: string[];        // V1 multi-vendor : peut contenir plusieurs
  status: 'draft';
  pricing: {
    subtotalCents: number;
    optionsCents: number;
    deliveryCents: number;
    totalCents: number;
    vatCents: number;
    currency: 'EUR';
  };
  taxBreakdown: {
    proSubjectToVat: boolean;
    vatRate: number;            // 0.20 ou 0
    vatExemptionReason: string | null;  // ex: "art. 293 B CGI"
  };
}
```

**Consumers** :
- `analytics`

---

#### `order.ready-for-payment.v1`

**Émis quand** : tous les bookings de l'order ont été acceptés par leur pro.

**Data** :
```typescript
{
  orderId: string;
  customerId: string;
  bookingIds: string[];
  totalCents: number;
}
```

**Consumers** :
- `payment-svc` → capture le PaymentIntent (transition auth → captured)

---

#### `order.paid.v1`

**Émis quand** : le payment a été capturé avec succès.

**Data** :
```typescript
{
  orderId: string;
  customerId: string;
  bookingIds: string[];
  paidAmountCents: number;
  invoiceId: string;
  invoicePdfUrl: string;        // URL R2
  paidAt: string;
}
```

**Consumers** :
- `booking-svc` → marque les bookings `confirmed`
- `notification-svc` → email customer + PJ facture
- `analytics`

---

#### `order.cancelled.v1`

**Émis quand** : un order est annulé (suite refus pro, payment failed, annulation client).

**Data** :
```typescript
{
  orderId: string;
  customerId: string;
  bookingIds: string[];
  cancelledAt: string;
  reason: string;
}
```

**Consumers** :
- `payment-svc` → cancel auth ou trigger refund
- `notification-svc`

---

#### `order.refunded.v1`

**Émis quand** : un refund (total ou partiel) a été effectué sur un order.

**Data** :
```typescript
{
  orderId: string;
  customerId: string;
  refundedAmountCents: number;
  remainingAmountCents: number;
  refundType: 'cancellation_policy' | 'manual_admin' | 'dispute_resolution' | 'pro_refusal_after_capture';
  triggeredBy: string | null;    // admin user ID si manual, sinon null
  creditNoteId: string | null;   // ID de l'avoir généré
  creditNotePdfUrl: string | null;
  refundedAt: string;
}
```

**Consumers** :
- `notification-svc` → email customer "Remboursement effectué"
- `analytics`

---

### D.5 payment-svc

#### `payment.intent.created.v1`

**Émis quand** : `payment-svc` a créé un Stripe PaymentIntent en mode `manual_capture`.

**Data** :
```typescript
{
  paymentIntentId: string;       // pi_xxx
  orderId: string;
  customerId: string;
  amountCents: number;
  currency: 'EUR';
  clientSecret: string;          // pour le frontend
  status: 'requires_confirmation';
}
```

**Consumers** :
- Frontend (via API gateway sync response, pas via NATS — mais event archivé pour audit)
- `analytics`

---

#### `payment.authorized.v1`

**Émis quand** : le PaymentIntent passe en `requires_capture` (CB autorisée mais pas débitée).

**Data** :
```typescript
{
  paymentIntentId: string;
  orderId: string;
  customerId: string;
  amountCents: number;
  authorizedAt: string;
}
```

**Consumers** :
- `notification-svc` → email "Demande envoyée, paiement autorisé en attente de confirmation"

---

#### `payment.captured.v1`

**Émis quand** : la capture Stripe a réussi (suite à `booking.accepted.v1` → `order.ready-for-payment.v1`).

**Data** :
```typescript
{
  paymentIntentId: string;
  chargeId: string;             // ch_xxx
  orderId: string;
  customerId: string;
  amountCents: number;
  feeCents: number;             // fees Stripe
  netCents: number;             // amount - fee
  capturedAt: string;
}
```

**Consumers** :
- `order-svc` → marque order paid
- `analytics`

---

#### `payment.failed.v1`

**Émis quand** : la capture échoue (CB refusée, fonds insuffisants après autorisation).

**Data** :
```typescript
{
  paymentIntentId: string;
  orderId: string;
  customerId: string;
  failureCode: string;           // 'card_declined', 'insufficient_funds', etc.
  failureMessage: string;
  failedAt: string;
}
```

**Consumers** :
- `booking-svc` → cancel les bookings, release slots (compensation saga)
- `order-svc` → cancel order
- `notification-svc` → email customer
- Admin alert (cas rare et critique)

---

#### `payment.refunded.v1`

**Émis quand** : un refund Stripe a été effectué (auto via cancellation policy, ou manual admin).

**Data** :
```typescript
{
  refundId: string;             // re_xxx Stripe
  paymentIntentId: string;
  orderId: string;
  customerId: string;
  refundedAmountCents: number;
  totalRefundedCents: number;   // cumul si refunds multiples
  reason: 'cancellation_policy' | 'manual_admin' | 'dispute' | 'pro_refusal';
  metadata: {
    triggeringEvent: string;     // ex: 'booking.cancelled.v1'
    triggeringEntityId: string;
  };
  refundedAt: string;
}
```

**Consumers** :
- `order-svc` → mise à jour status (partially_refunded / fully_refunded)
- `booking-svc` → log dans timeline
- `notification-svc` → email customer
- `analytics`

---

#### `payment.payout.scheduled.v1`

**Émis quand** : un payout vers le pro a été programmé Stripe (transfer en attente).

**Trigger** : cron `SchedulePayoutsUseCase` qui scanne `booking.completed` events.

**Data** :
```typescript
{
  payoutId: string;
  bookingId: string;
  providerId: string;
  amountCents: number;          // net pro après commission
  commissionCents: number;
  scheduledFor: string;          // J+1 typiquement
  stripeTransferId: string | null;  // null si transfer pas encore créé
}
```

**Consumers** :
- `notification-svc` → email pro "Reversement programmé"

---

#### `payment.payout.completed.v1`

**Émis quand** : le payout Stripe est arrivé sur le compte bancaire du pro.

**Data** :
```typescript
{
  payoutId: string;
  stripePayoutId: string;       // po_xxx
  providerId: string;
  bookingId: string;
  amountCents: number;
  arrivalDate: string;
}
```

**Consumers** :
- `notification-svc` → email pro "Paiement reçu"
- `analytics`

---

#### `payment.dispute.opened.v1`

**Émis quand** : Stripe notifie un dispute (chargeback).

**Trigger** : webhook Stripe `charge.dispute.created` → `payment-svc`.

**Data** :
```typescript
{
  disputeId: string;            // dp_xxx Stripe
  chargeId: string;
  orderId: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  amountCents: number;
  reason: string;               // raisons Stripe (fraudulent, product_not_received...)
  evidenceDueBy: string;
}
```

**Consumers** :
- `booking-svc` → flag booking `disputed`
- `notification-svc` → email pro (urgence) + alert admin
- Admin dashboard

---

#### `payment.dispute.resolved.v1`

**Émis quand** : un dispute Stripe est résolu (won ou lost).

**Data** :
```typescript
{
  disputeId: string;
  outcome: 'won' | 'lost';
  amountCents: number;
  refundIssued: boolean;
  resolvedAt: string;
}
```

**Consumers** :
- `booking-svc` → met à jour status booking
- `payment-svc` interne → si lost, gère le solde négatif provider
- `notification-svc`

---

#### `payment.subscription.created.v1`

**Émis quand** : un pro souscrit à un tier payant (Business / Enterprise) via Stripe Billing.

**Data** :
```typescript
{
  stripeSubscriptionId: string;
  providerId: string;
  tier: 'business' | 'enterprise';
  startDate: string;
  trialEndsAt: string | null;   // 14 jours typiquement pour Business
  amountCents: number;          // prix mensuel TTC
}
```

**Consumers** :
- `identity-svc` → met à jour `subscription_tier` du profil
- `payment-svc` → met à jour le `commission_rate` interne
- `notification-svc` → email "Bienvenue dans Business"

---

#### `payment.subscription.updated.v1`

**Émis quand** : un changement sur la subscription (upgrade tier, méthode de paiement, etc.).

**Data** :
```typescript
{
  stripeSubscriptionId: string;
  providerId: string;
  changes: Array<'tier' | 'payment_method' | 'billing_cycle'>;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}
```

**Consumers** :
- `identity-svc` → cascade tier change
- `notification-svc`

---

#### `payment.subscription.cancelled.v1`

**Émis quand** : un pro annule sa subscription (effective fin de période).

**Data** :
```typescript
{
  stripeSubscriptionId: string;
  providerId: string;
  cancelledAt: string;
  effectiveAt: string;          // fin de période payée
  cancellationReason: string;
}
```

**Consumers** :
- `identity-svc` → planifie le downgrade vers Starter à `effectiveAt`
- `notification-svc`

---

#### `payment.subscription.payment-failed.v1`

**Émis quand** : un prélèvement de subscription échoue (smart retries Stripe).

**Data** :
```typescript
{
  stripeSubscriptionId: string;
  providerId: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  willCancelAt: string | null;
  amountCents: number;
}
```

**Consumers** :
- `notification-svc` → email pro "Action requise"
- Frontend banner persistant

---

### D.6 messaging-svc

#### `messaging.conversation.created.v1`

**Émis quand** : une conversation est ouverte (suite à `booking.accepted.v1` ou `booking.refused.v1` avec message).

**Data** :
```typescript
{
  conversationId: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  initiatedBy: 'pro_acceptance' | 'pro_refusal_with_message';
  createdAt: string;
}
```

**Consumers** :
- `notification-svc` (futurs messages)

---

#### `messaging.message.sent.v1`

**Émis quand** : un message est envoyé.

**Data** :
```typescript
{
  messageId: string;
  conversationId: string;
  senderId: string;
  senderRole: 'customer' | 'pro';
  contentLength: number;        // pour analytics, pas le contenu lui-même
  hasAttachments: boolean;
  flags: Array<'phone_detected' | 'email_detected' | 'url_detected' | 'suspicious_keyword'>;
  sentAt: string;
}
```

Note : le **contenu textuel** n'est PAS dans l'event (RGPD + size). Les autres services qui ont besoin du contenu (anti-désintermédiation V1) lisent via API interne ou stockent dans `messaging-svc`.

**Consumers** :
- `notification-svc` → push notification au destinataire (si offline)
- `analytics`
- `anti-fraud-svc` (V1) → analyse patterns

---

#### `messaging.message.flagged.v1`

**Émis quand** : un message est signalé (par regex auto V1, ou par signalement utilisateur).

**Data** :
```typescript
{
  messageId: string;
  conversationId: string;
  flagSource: 'auto_regex' | 'user_report' | 'admin_review';
  flagType: 'phone' | 'email' | 'url_external' | 'suspicious_keyword' | 'inappropriate' | 'other';
  reportedBy: string | null;     // user ID si user_report
  flaggedAt: string;
}
```

**Consumers** :
- Admin dashboard (file modération)
- `notification-svc` (alerte admin si multiples flags sur même conv)

---

### D.7 review-svc

#### `review.submitted.v1`

**Émis quand** : un customer publie un avis.

**Data** :
```typescript
{
  reviewId: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  listingId: string;
  ratings: {
    overall: number;            // 1-5
    quality?: number;           // V1
    punctuality?: number;
    communication?: number;
    valueForMoney?: number;
  };
  commentLength: number;
  hasAttachments: boolean;       // V1 photos
  submittedAt: string;
}
```

**Consumers** :
- `catalog-svc` → recalcul agrégé note pro + score listing
- Meilisearch indexer → mise à jour facette avis
- `notification-svc` → email pro "Nouvel avis ⭐⭐⭐⭐⭐"
- `analytics`

---

#### `review.published.v1`

**Émis quand** : un avis devient visible publiquement (auto-pub ou post-modération).

**Data** :
```typescript
{
  reviewId: string;
  providerId: string;
  listingId: string;
  publishedAt: string;
}
```

**Consumers** :
- Frontend cache busting (pages `/service/{slug}` et `/pro/{slug}`)

---

#### `review.modified.v1`

**Émis quand** : le customer modifie son avis (dans la fenêtre de 30 jours).

**Data** :
```typescript
{
  reviewId: string;
  customerId: string;
  changedFields: Array<'overall' | 'comment' | 'multi_criteria'>;
  modifiedAt: string;
}
```

**Consumers** :
- `catalog-svc` → recalcul note agrégée

---

#### `review.deleted.v1`

**Émis quand** : un avis est supprimé (par customer, ou par admin suite signalement).

**Data** :
```typescript
{
  reviewId: string;
  customerId: string;
  providerId: string;
  deletedBy: 'customer' | 'admin';
  reason: string | null;
  deletedAt: string;
}
```

**Consumers** :
- `catalog-svc` → recalcul note agrégée
- `notification-svc` → email pro si suppression admin

---

#### `review.flagged.v1`

**Émis quand** : un avis est signalé par un pro.

**Data** :
```typescript
{
  reviewId: string;
  flaggedBy: string;             // pro user ID
  reason: 'fake_review' | 'inappropriate_language' | 'unfair_competition' | 'defamation' | 'off_topic' | 'other';
  details: string;
  flaggedAt: string;
}
```

**Consumers** :
- Admin dashboard (file modération)
- `notification-svc` → alert admin

---

#### `review.pro-response.published.v1` *(V1)*

**Émis quand** : un pro répond à un avis (V1, tier Business+).

**Data** :
```typescript
{
  reviewId: string;
  responseId: string;
  providerId: string;
  publishedAt: string;
}
```

**Consumers** :
- `notification-svc` → email customer "Le pro a répondu à votre avis"
- Frontend cache busting

---

### D.8 media-svc

#### `media.upload.requested.v1`

**Émis quand** : un user demande une URL presigned pour uploader un fichier.

**Data** :
```typescript
{
  uploadId: string;
  userId: string;
  fileType: 'image' | 'video' | 'document';
  mimeType: string;
  sizeBytes: number;
  context: 'listing_photo' | 'kyc_document' | 'message_attachment' | 'review_photo' | 'profile_avatar';
  contextId: string | null;     // listingId, bookingId, etc.
}
```

**Consumers** :
- `analytics`

---

#### `media.upload.completed.v1`

**Émis quand** : l'upload R2 est complet (notification client → backend).

**Data** :
```typescript
{
  uploadId: string;
  userId: string;
  storageKey: string;            // path R2
  publicUrl: string | null;      // null pour KYC (privé)
  uploadedAt: string;
}
```

**Consumers** :
- `media-svc` interne → trigger scan antivirus + génération dérivés

---

#### `media.processed.v1`

**Émis quand** : le fichier est scanné, dérivés générés (thumbnails images, transcoding video V2).

**Data** :
```typescript
{
  mediaId: string;
  uploadId: string;
  derivatives: {
    thumbnail?: string;          // URL R2 du thumbnail
    medium?: string;
    large?: string;
  };
  scanResult: 'clean' | 'suspicious' | 'malicious';
  processedAt: string;
}
```

**Consumers** :
- Service consommateur (catalog-svc, review-svc, identity-svc selon `context`)
- Frontend (via subscription user-specific)

---

#### `media.rejected.v1`

**Émis quand** : un fichier est rejeté (antivirus, format, contenu inapproprié).

**Data** :
```typescript
{
  uploadId: string;
  userId: string;
  reason: 'malware_detected' | 'invalid_format' | 'too_large' | 'inappropriate_content';
  rejectedAt: string;
}
```

**Consumers** :
- `notification-svc` → notification user
- Admin alert si patterns suspects

---

### D.9 notification-svc

`notification-svc` est principalement un **consumer** de tous les autres services. Il émet peu d'events, principalement pour traçabilité.

#### `notification.delivered.v1`

**Émis quand** : un email/SMS/push a été délivré avec succès.

**Data** :
```typescript
{
  notificationId: string;
  userId: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  templateId: string;
  triggerEvent: string;          // ex: 'booking.confirmed.v1'
  deliveredAt: string;
  providerMessageId: string | null;  // ID Resend, Twilio, etc.
}
```

**Consumers** :
- `analytics`
- Admin support (debug "L'email est-il bien parti ?")

---

#### `notification.failed.v1`

**Émis quand** : la délivrance échoue (bounce, invalid email, etc.).

**Data** :
```typescript
{
  notificationId: string;
  userId: string;
  channel: 'email' | 'sms' | 'push';
  templateId: string;
  failureReason: string;         // 'hard_bounce', 'soft_bounce', 'unreachable', etc.
  failedAt: string;
}
```

**Consumers** :
- `identity-svc` → flag email invalide si hard bounce répété
- Admin alert si > seuil

---

## E. Cross-service flows

### E.1 Booking-payment saga (canonical)

cf. `tukio_booking_svc_deepdive.md` §G pour le détail complet. Récap des events :

```
Customer flow:
  POST /v1/bookings
    → booking.requested.v1
        → order.created.v1 (consumer: order-svc)
        → notification (customer + pro)

Pro accepts:
  POST /v1/bookings/:id/accept
    → booking.accepted.v1
        → order.ready-for-payment.v1
            → payment.captured.v1 (success path)
                → order.paid.v1
                    → booking.confirmed.v1
                        → notification (customer)
                        → messaging.conversation.created.v1
            → payment.failed.v1 (error path)
                → order.cancelled.v1
                → booking.cancelled.v1 (with reason: payment_failed)
                → booking.slot-released.v1
                → admin alert

Event date passes:
  cron CompleteFinishedBookingsUseCase
    → booking.completed.v1
        → payment.payout.scheduled.v1
        → review email J+1
```

### E.2 Cancellation flow

```
Customer cancels:
  POST /v1/bookings/:id/cancel
    → booking.cancelled.v1
        → booking.slot-released.v1
        → payment.refunded.v1 (Stripe partial/full)
        → order.refunded.v1
        → notification (customer + pro)
```

### E.3 Pro lifecycle

```
Registration:
  Keycloak email verified webhook
    → identity.user.registered.v1
        → notification welcome

KYC submitted:
  POST /v1/identity/kyc
    → identity.kyc.submitted.v1
        → admin alert

Admin validates:
  Admin clicks "Validate KYC"
    → identity.kyc.verified.v1
        → catalog (allows direct publication)
        → notification email

Pro creates listing → wizard step 10:
  POST /v1/listings/:id/publish
    → catalog.listing.created.v1
    → catalog.listing.published.v1 (if pro verified) OR pending_review
        → meilisearch index
```

### E.4 Subscription lifecycle

```
Pro subscribes Business:
  Stripe Checkout success → webhook
    → payment.subscription.created.v1
        → identity.subscription-tier.changed.v1
            → catalog (apply Business limits/features)
            → payment-svc (update commission_rate)
            → notification welcome Business

Pro downgrades Business → Starter:
  POST /v1/subscriptions/cancel
    → payment.subscription.cancelled.v1 (effective end of period)

End of period:
  Stripe webhook customer.subscription.deleted
    → identity.subscription-tier.changed.v1 (with new tier: starter)
        → catalog (enforce limits, archive overflowing listings)
        → payment-svc (revert commission_rate)
        → notification "Bienvenue Starter"
```

### E.5 Moderation flow

```
User reports a message:
  POST /v1/messages/:id/report
    → messaging.message.flagged.v1
        → admin dashboard alert

Admin decides "Suspend pro 7 days":
  POST /v1/admin/users/:id/suspend
    → identity.user.suspended.v1
        → catalog (hide listings)
        → booking (flag active bookings)
        → messaging (read-only)
        → notification (user + reporter)
```

---

## F. Subscription matrix

Quel service consume quel event. Vue synthétique pour repérer les dépendances.

| Event \ Consumer | identity | catalog | booking | order | payment | messaging | review | media | notification | analytics |
|---|---|---|---|---|---|---|---|---|---|---|
| `identity.user.registered.v1` | | | | | | | | | ✅ | ✅ |
| `identity.kyc.verified.v1` | | ✅ | | | ✅ | | | | ✅ | |
| `identity.user.suspended.v1` | | ✅ | ✅ | | | ✅ | | | ✅ | |
| `identity.user.banned.v1` | | ✅ | ✅ | | ✅ | ✅ | | | ✅ | |
| `identity.subscription-tier.changed.v1` | | ✅ | | | ✅ | ✅ | | | ✅ | |
| `catalog.listing.published.v1` | | ✅* | | | | | | | ✅ | ✅ |
| `catalog.listing.unpublished.v1` | | ✅* | ✅ | | | | | | | |
| `catalog.availability.changed.v1` | | ✅* | ✅ | | | | | | | |
| `booking.requested.v1` | | | | ✅ | | | | | ✅ | ✅ |
| `booking.accepted.v1` | | | | ✅ | ✅ | ✅ | | | ✅ | |
| `booking.refused.v1` | | | | ✅ | ✅ | | | | ✅ | |
| `booking.confirmed.v1` | | | | | | ✅ | | | ✅ | ✅ |
| `booking.completed.v1` | | | | | ✅ | | ✅ | | ✅ | ✅ |
| `booking.cancelled.v1` | | ✅ | | ✅ | ✅ | | | | ✅ | |
| `booking.disputed.v1` | | | | | ✅ | | | | ✅ | |
| `order.paid.v1` | | | ✅ | | | | | | ✅ | ✅ |
| `order.cancelled.v1` | | | | | ✅ | | | | ✅ | |
| `payment.captured.v1` | | | | ✅ | | | | | | ✅ |
| `payment.failed.v1` | | | ✅ | ✅ | | | | | ✅ | |
| `payment.refunded.v1` | | | ✅ | ✅ | | | | | ✅ | ✅ |
| `payment.dispute.opened.v1` | | | ✅ | | | | | | ✅ | |
| `payment.subscription.created.v1` | ✅ | | | | | | | | ✅ | |
| `payment.subscription.cancelled.v1` | ✅ | | | | | | | | ✅ | |
| `messaging.message.flagged.v1` | | | | | | | | | ✅ | |
| `review.submitted.v1` | | ✅ | | | | | | | ✅ | ✅ |
| `review.deleted.v1` | | ✅ | | | | | | | ✅ | |
| `media.processed.v1` | depends | depends | | | | depends | depends | | | |

(*) consommation interne au service (Meilisearch indexer dans `catalog-svc`).

---

## G. Versioning policy

### G.1 Backward-compatible changes (no version bump)

Ces changements peuvent être faits sur la même version `v1` sans casser les consumers existants :

- **Ajout d'un champ optionnel** dans `data`
- **Ajout d'une nouvelle valeur** dans un enum (les consumers doivent gérer le cas "valeur inconnue" gracefully)
- **Augmentation de la précision** d'un champ (ex: `int` → `bigint` si supporté)

### G.2 Breaking changes (version bump v1 → v2)

Ces changements nécessitent une nouvelle version :

- Suppression d'un champ
- Renommage d'un champ
- Changement de type d'un champ
- Restriction d'un enum (suppression d'une valeur)
- Changement de sémantique sans changer le shape

### G.3 Migration v1 → v2

1. **Phase 1 — Dual emission** (durée : 30 jours minimum)
   - Le producer émet sur `event.type.v1` ET `event.type.v2` simultanément
   - Les consumers existants continuent de consommer `v1`
   - Les nouveaux consumers (et ceux qui le souhaitent) migrent vers `v2`

2. **Phase 2 — Deprecation v1**
   - Annoncer le sunset de `v1` aux équipes consommatrices
   - Délai de migration : 30 jours minimum

3. **Phase 3 — Sunset v1**
   - Le producer arrête d'émettre `v1`
   - Les schemas `v1` restent dans `@tukio/contracts` (taggés `@deprecated`)

### G.4 No deletions

On **ne supprime jamais** un type d'event de `@tukio/contracts`. Les anciens types restent archivés (avec `@deprecated`) pour permettre :
- L'analyse d'events historiques
- La migration tardive de consumers
- La compréhension des logs anciens

---

## H. Implementation in @tukio/contracts

### H.1 Package structure

```
packages/contracts/
├─ src/
│  ├─ envelope.ts               # DomainEvent<T>, Actor types
│  ├─ events/
│  │  ├─ identity/
│  │  │  ├─ user-registered-v1.ts
│  │  │  ├─ kyc-verified-v1.ts
│  │  │  └─ index.ts
│  │  ├─ catalog/
│  │  │  ├─ listing-published-v1.ts
│  │  │  └─ index.ts
│  │  ├─ booking/
│  │  │  ├─ booking-requested-v1.ts
│  │  │  ├─ booking-accepted-v1.ts
│  │  │  ├─ booking-confirmed-v1.ts
│  │  │  └─ index.ts
│  │  └─ ... (other services)
│  ├─ schemas/                   # JSON Schema files (for runtime validation)
│  │  ├─ identity/
│  │  ├─ catalog/
│  │  └─ ...
│  └─ index.ts                   # public exports
├─ package.json
└─ tsconfig.json
```

### H.2 Per-event file structure

```typescript
// src/events/booking/booking-requested-v1.ts

import { DomainEvent } from '../../envelope';

/**
 * Emitted when a customer creates a booking request.
 *
 * @producer booking-svc
 * @consumers order-svc, notification-svc, analytics
 * @since v1
 */
export const BOOKING_REQUESTED_V1_TYPE = 'booking.reservation.requested.v1' as const;

export interface BookingRequestedV1Data {
  bookingId: string;
  customerId: string;
  providerId: string;
  listingId: string;
  period: {
    from: string;  // ISO 8601
    to: string;
  };
  quantity: number;
  options: BookingOption[];
  pricing: BookingPricing;
  deliveryAddress: BookingAddress;
  cancellationPolicy: 'flexible' | 'standard' | 'strict';
  timeoutAt: string;
}

export interface BookingOption {
  optionId: string;
  label: string;
  quantity: number;
  priceCents: number;
}

export interface BookingPricing {
  subtotalCents: number;
  optionsCents: number;
  deliveryCents: number;
  totalCents: number;
  currency: 'EUR';
}

export interface BookingAddress {
  street: string;
  postalCode: string;
  city: string;
}

export type BookingRequestedV1 = DomainEvent<BookingRequestedV1Data>;
```

### H.3 JSON Schema (runtime validation)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://contracts.tukio.one/booking/booking-requested-v1.schema.json",
  "title": "BookingRequestedV1",
  "description": "Emitted when a customer creates a booking request.",
  "type": "object",
  "required": ["id", "type", "source", "time", "correlationId", "data"],
  "properties": {
    "id": { "type": "string", "pattern": "^[0-9A-Z]{26}$" },
    "type": { "const": "booking.reservation.requested.v1" },
    "source": { "const": "booking-svc" },
    "time": { "type": "string", "format": "date-time" },
    "correlationId": { "type": "string", "pattern": "^[0-9A-Z]{26}$" },
    "causationId": {
      "anyOf": [
        { "type": "string", "pattern": "^[0-9A-Z]{26}$" },
        { "type": "null" }
      ]
    },
    "actor": {
      "type": "object",
      "required": ["type", "id"],
      "properties": {
        "type": { "enum": ["user", "system", "admin", "webhook"] },
        "id": { "type": ["string", "null"] }
      }
    },
    "data": {
      "type": "object",
      "required": ["bookingId", "customerId", "providerId", "listingId", "period", "quantity", "pricing", "deliveryAddress", "cancellationPolicy", "timeoutAt"],
      "properties": {
        "bookingId": { "type": "string" },
        "customerId": { "type": "string" },
        "providerId": { "type": "string" },
        "listingId": { "type": "string" },
        "period": {
          "type": "object",
          "required": ["from", "to"],
          "properties": {
            "from": { "type": "string", "format": "date-time" },
            "to": { "type": "string", "format": "date-time" }
          }
        },
        "quantity": { "type": "integer", "minimum": 1 },
        "options": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["optionId", "label", "quantity", "priceCents"],
            "properties": {
              "optionId": { "type": "string" },
              "label": { "type": "string" },
              "quantity": { "type": "integer", "minimum": 1 },
              "priceCents": { "type": "integer", "minimum": 0 }
            }
          }
        },
        "pricing": {
          "type": "object",
          "required": ["subtotalCents", "optionsCents", "deliveryCents", "totalCents", "currency"],
          "properties": {
            "subtotalCents": { "type": "integer", "minimum": 0 },
            "optionsCents": { "type": "integer", "minimum": 0 },
            "deliveryCents": { "type": "integer", "minimum": 0 },
            "totalCents": { "type": "integer", "minimum": 0 },
            "currency": { "const": "EUR" }
          }
        },
        "deliveryAddress": {
          "type": "object",
          "required": ["street", "postalCode", "city"],
          "properties": {
            "street": { "type": "string" },
            "postalCode": { "type": "string", "pattern": "^[0-9]{5}$" },
            "city": { "type": "string" }
          }
        },
        "cancellationPolicy": { "enum": ["flexible", "standard", "strict"] },
        "timeoutAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

### H.4 Test contract — schema compatibility

Dans chaque service producer/consumer, un test CI valide la conformité au schéma :

```typescript
// In booking-svc test/contract/booking-requested-v1.spec.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '@tukio/contracts/schemas/booking/booking-requested-v1.schema.json';
import { captureBookingRequestedEvent } from '../helpers/capture-events';

describe('booking.requested.v1 contract', () => {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  it('matches the published JSON Schema', async () => {
    // Run a real scenario producing the event
    const event = await captureBookingRequestedEvent();

    const valid = validate(event);
    if (!valid) {
      console.error('Schema validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });
});
```

### H.5 Versioning in code

```typescript
// In a producer
import {
  BOOKING_REQUESTED_V1_TYPE,
  BookingRequestedV1Data,
} from '@tukio/contracts';

// In a consumer — type-safe handler
import { BookingRequestedV1 } from '@tukio/contracts';

@EventPattern(BOOKING_REQUESTED_V1_TYPE)
async handle(@Payload() event: BookingRequestedV1) {
  // event.data is fully typed
  await this.useCase.execute(event.data);
}
```

---

*End of Event Catalog — version 1, to iterate as the system evolves.*

**Next steps for Sprint 0** :
1. Initialize `packages/contracts` monorepo package
2. Implement TypeScript types for the 10 most critical events (booking + payment + identity)
3. Implement JSON Schemas for the same set
4. Write contract validation tests in producers and consumers
5. Document deprecation process when first `v2` ships
