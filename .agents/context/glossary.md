# Glossary — FR business term ↔ EN identifier

The tech layer is **English-only** (paths, identifiers, DB names, NATS
events, branches). When introducing a new French business term in the
codebase, add it to this table **before** writing the code. Do not invent
synonyms; reuse the canonical EN identifier across all services.

The user-facing **content** stays bilingual (FR/EN via next-intl) — this
glossary only governs the EN identifier on the tech side.

## Canonical mapping

| French (business)                | English (identifier)        | Notes                                                              |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| **Marketplace / shape**          |                             |                                                                    |
| Particulier                      | `customer-b2c`              | B2C customer; Stripe Connect ToS                                   |
| Pro / Professionnel              | `pro` (or `seller`)         | Realm role: `pro`. App folder: `seller`.                           |
| Client professionnel B2B         | `customer-b2b`              | V1+ — multi-user accounts                                          |
| Prestation                       | `service`                   | "Service" as a noun (a thing a pro sells)                          |
| Fiche service                    | `listing`                   | The DB entity. NOT `service` (collides w/ verb in code).           |
| Catégorie / Sous-catégorie       | `category` / `sub-category` | DB `categories` / `sub_categories`                                 |
| Type de service                  | `service-type`              | Column `service_types text[]` on `sub_categories`                  |
| **Booking / Saga**               |                             |                                                                    |
| Réservation                      | `booking`                   | The aggregate. Saga state machine in `booking-svc`.                |
| Demande                          | `request`                   | Initial state of a booking before pro accepts                      |
| Accepter / Refuser               | `accept` / `refuse`         | Pro actions on a booking                                           |
| Délai d'expiration               | `expiration-delay`          | Time-to-decision for the pro                                       |
| Capter / Capture                 | `capture`                   | Stripe PaymentIntent capture step                                  |
| Annulation                       | `cancellation`              | Customer or pro cancellation                                       |
| Politique d'annulation           | `cancellation-policy`       | Pro-defined refund rules                                           |
| Devis                            | `quote`                     | V1+ pre-booking conversation pricing (Story 12.3)                  |
| **Cart / Order**                 |                             |                                                                    |
| Panier                           | `cart`                      | Mono-vendor MVP, multi-vendor parallel saga V1+ (Story 8.2)        |
| Commande                         | `order`                     | Aggregate in `order-svc`                                           |
| Ligne de commande                | `order-line`                | Sub-aggregate of `order`                                           |
| Bon de livraison (BL)            | `delivery-note`             | Used downstream of booking acceptance                              |
| **Payments**                     |                             |                                                                    |
| Paiement                         | `payment`                   | `payment-svc` aggregate                                            |
| Acompte                          | `deposit`                   | 30 % up-front, 70 % later (Story 9.3 — V1+)                        |
| Échéancier                       | `payment-schedule`          | The split payment plan                                             |
| Virement                         | `transfer`                  | Stripe Connect payout to pro                                       |
| Reversement / Payout             | `payout`                    | Synonym; prefer `payout`                                           |
| Facture                          | `invoice`                   | Per-entity, with `invoice_number` Story 4.9                        |
| Remboursement                    | `refund`                    | Story 4.12 — admin tool                                            |
| Mandat 289 CGI                   | `mandate-289-cgi`           | French tax mandate ref — sticks as a stable identifier             |
| TVA                              | `vat`                       | DB column `vat_amount`, `vat_rate`, …                              |
| **Catalog / Listings**           |                             |                                                                    |
| Publier / Dépublier              | `publish` / `unpublish`     | Listing lifecycle verbs                                            |
| Photos                           | `photos`                    | DB column on `listings` (Cloudflare Images IDs)                    |
| Avis client                      | `review`                    | `review-svc` aggregate                                             |
| Note                             | `rating`                    | Numeric component of a review                                      |
| Pondération récence              | `recency-weight`            | Decay function on review aggregate (Story 5.8)                     |
| Badge confiance                  | `trust-badge`               | Story 5.9 — display only when FR review count ≥ threshold          |
| **Identity / Auth**              |                             |                                                                    |
| Compte                           | `account` / `user-profile`  | Keycloak user → `user_profile` row                                 |
| Inscription                      | `registration`              | NOT `signup` (registration is the canonical EN)                    |
| Connexion                        | `login`                     |                                                                    |
| Déconnexion                      | `logout`                    |                                                                    |
| Mot de passe                     | `password`                  |                                                                    |
| Réinitialisation du mot de passe | `password-reset`            | Story 1.5                                                          |
| Vérification d'email             | `email-verification`        | Story 1.6                                                          |
| MFA / 2FA                        | `mfa`                       | Always `mfa` in code (industry standard); `2fa` only in UI strings |
| Code TOTP                        | `totp`                      | Time-based one-time password                                       |
| **Admin / Moderation**           |                             |                                                                    |
| Console admin                    | `admin-console`             | `apps/admin/`                                                      |
| File d'attente                   | `queue`                     | `verification-queue`, `moderation-queue`                           |
| Vérification KYC                 | `kyc-verification`          | Stripe handles the actual KYC                                      |
| Suspension                       | `suspension`                | Soft-state on an account (Story 6.5)                               |
| Bannissement                     | `ban`                       | Hard-state, irreversible without admin-super action                |
| Sanction graduée                 | `graduated-sanction`        | Warning → suspension → ban (Story 6.5)                             |
| Signalement                      | `report`                    | User-submitted abuse report                                        |
| Modération                       | `moderation`                | Admin review of flagged content                                    |
| Journal d'audit                  | `audit-log`                 | Immutable; written via `admin.action.*.v1` events                  |
| **Messaging / Comm**             |                             |                                                                    |
| Message                          | `message`                   |                                                                    |
| Conversation                     | `conversation`              |                                                                    |
| Anti-désintermédiation           | `anti-disintermediation`    | PII masking in messaging (Story 12.1)                              |
| Détection PII                    | `pii-detection`             |                                                                    |
| **Notifications**                |                             |                                                                    |
| Notification                     | `notification`              |                                                                    |
| Préférences                      | `preferences`               | Granular notification settings (Story 11.4 — V1+)                  |
| Relance                          | `reminder`                  | Auto-reminders (review request, pro KYC, …)                        |
| **Pilots / Categories**          |                             |                                                                    |
| Tentes et chapiteaux             | `tents-marquees`            | Pilot category #1 — FR slug `tentes-chapiteaux`                    |
| Mobilier événementiel            | `event-furniture`           | Pilot category #2 — FR slug `mobilier-evenementiel`                |
| Chapiteaux mariage               | `wedding-marquees`          | Sub-cat                                                            |
| Chapiteaux professionnels        | `professional-marquees`     | Sub-cat                                                            |
| Tentes de jardin                 | `garden-tents`              | Sub-cat                                                            |
| Tentes pop-up                    | `pop-up-tents`              | Sub-cat                                                            |
| Chaises                          | `chairs`                    | Sub-cat                                                            |
| Tables                           | `tables`                    | Sub-cat                                                            |
| Linge de table                   | `linens`                    | Sub-cat                                                            |
| Bars et comptoirs                | `bars`                      | Sub-cat                                                            |
| Pistes de danse                  | `dance-floors`              | Sub-cat                                                            |
| Livraison                        | `delivery`                  | Service type                                                       |
| Montage                          | `setup`                     | Service type                                                       |
| Démontage                        | `dismantling`               | Service type                                                       |
| Éclairage                        | `lighting`                  | Service type                                                       |
| Nettoyage                        | `cleaning`                  | Service type                                                       |
| **Compliance / Legal**           |                             |                                                                    |
| RGPD                             | `gdpr`                      | Always lowercase in code                                           |
| CGU / CGV                        | `tos` / `tos-pro`           | Terms of service (customer / pro)                                  |
| Mentions légales                 | `legal-notice`              | Story 7.9                                                          |
| Politique de confidentialité     | `privacy-policy`            | Story 7.9                                                          |
| Droit à l'oubli                  | `right-to-be-forgotten`     | Story 1.9 — soft-delete with RGPD retention window                 |
| Consentement                     | `consent`                   |                                                                    |
| **Operations**                   |                             |                                                                    |
| Disponibilité                    | `availability`              | Pro's calendar slots                                               |
| Créneau                          | `slot`                      | A single bookable time window                                      |
| Rayon de livraison               | `delivery-radius`           | Pro-defined max km from base                                       |
| Prix médian                      | `median-price`              | Auto-displayed on listing publish (Story 3.5)                      |
| Carte                            | `map`                       | Pattern in `@tukio/ui/patterns/Map`                                |
| **Tracking / Analytics**         |                             |                                                                    |
| Acquisition                      | `acquisition`               | Marketing channel attribution                                      |
| Attribution multi-touch          | `multi-touch-attribution`   | Story 7.5                                                          |
| Code parrain                     | `referral-code`             | Story 7.6 (foundation) + 11.3 (rewards V1)                         |
| Programme de fidélité            | `loyalty`                   | Story 16.1 — V2                                                    |
| **Generic system**               |                             |                                                                    |
| Brouillon                        | `draft`                     | Aggregate state                                                    |
| Publié                           | `published`                 | Aggregate state                                                    |
| Archivé                          | `archived`                  | Aggregate state                                                    |
| Suppression douce                | `soft-delete`               | RGPD-compliant; never destructive                                  |
| Audit                            | `audit`                     |                                                                    |
| Métriques                        | `metrics`                   | Prom-client, always EN                                             |

## Adding a new term

1. Identify the **canonical EN identifier** (lowercase-kebab for files /
   tables / events, `camelCase` for code identifiers).
2. Add a row to the table above, keeping it sorted within its section.
3. Use the EN identifier consistently across:
   - File / folder names
   - TypeScript identifiers (types, functions, variables)
   - DB table / column names (`snake_case` adaptation)
   - NATS event names (`<domain>.<entity>.<verb>.v<n>`)
   - URL paths (EN-canonical; FR slug lives in `*_translations`)
4. If the term needs a per-locale slug in URLs, add the FR slug to the
   corresponding `<entity>_translations.slug` column.

## Anti-patterns to refuse

- `commande` as an identifier (use `order`).
- `categorie` in a path (use `category`).
- `livraison` as an event name (use `delivery`).
- Introducing a near-synonym for an existing term (`booking` exists; don't
  add `reservation` as a new EN identifier — pick one).
- Adding French to a `tukioCode` (e.g. `RESERVATION-CONFLIT-001` — use
  `BOOKING-SLOT-TAKEN-001`).
