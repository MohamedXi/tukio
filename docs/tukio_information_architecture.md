# Tukio — Information Architecture (Doc 1)

> Document structurant : sitemap, navigation, permissions, conventions URL et techniques
> À lire après : `tukio_spec_v2.md` + `tukio_design_brief.md` (Doc 0)
> Audience : produit, design, dev (frontend + backend), SEO

---

## Sommaire

- [A. Convention technique globale](#a-convention-technique-globale)
- [B. Architecture macro & sous-domaines](#b-architecture-macro--sous-domaines)
- [C. URL conventions](#c-url-conventions)
- [D. Public sitemap (non connecté)](#d-public-sitemap-non-connecté)
- [E. Customer area sitemap](#e-customer-area-sitemap)
- [F. Seller area sitemap](#f-seller-area-sitemap)
- [G. Admin sitemap](#g-admin-sitemap)
- [H. Navigation patterns](#h-navigation-patterns)
- [I. Permissions matrix](#i-permissions-matrix)
- [J. Cross-cutting & utility pages](#j-cross-cutting--utility-pages)
- [K. Notifications — où, quand, comment](#k-notifications--où-quand-comment)
- [L. Version tagging (MVP / V1 / V2)](#l-version-tagging-mvp--v1--v2)

---

## A. Convention technique globale

Règle figée et appliquée à tout le projet (code, docs, infra, urls).

### En anglais (technique)

- URLs et routes (paths)
- Noms de fichiers, dossiers, modules
- Variables, fonctions, classes, constantes
- Tables et colonnes de base de données
- Endpoints API
- Status enums, event names, role names
- Code comments
- Commit messages
- Documentation technique (READMEs, API docs, function docstrings)
- Identifiers techniques (slugs de catégories, tags, etc. quand ils servent d'IDs)

### En français (utilisateur final)

- Strings d'interface utilisateur (UI labels, boutons, placeholders, messages d'erreur)
- Pages marketing, blog, centre d'aide
- Emails / SMS envoyés aux utilisateurs
- Documentation produit destinée à l'équipe métier (les specs comme celle-ci)

### Cas particulier — slugs dynamiques

Les *paths* d'URL sont en anglais (`/service/{slug}`, `/category/{slug}`), mais la *valeur du slug* dérive du contenu (donc en français) :

| URL | Path EN | Slug value | Origine |
|-----|---------|-----------|---------|
| `/service/chapiteau-100m2-blanc-chic` | `/service/{slug}` | `chapiteau-100m2-blanc-chic` | Titre français saisi par le pro |
| `/category/location-tentes-chapiteaux` | `/category/{slug}` | `location-tentes-chapiteaux` | Nom français de la catégorie (config admin) |
| `/pro/event-co-nantes` | `/pro/{slug}` | `event-co-nantes` | Nom commercial du pro |

Les catégories ont aussi un **technical code** (English, e.g. `tents-marquees`) utilisé en interne pour les filtres et les références API, séparé du slug FR utilisé en URL pour le SEO.

```
Category {
  id:           uuid
  code:         "tents-marquees"           // identifier technique EN
  slug:         "location-tentes-chapiteaux"  // slug URL FR
  display_name: "Location de tentes & chapiteaux"  // label UI FR
}
```

### Naming conventions

| Élément | Style | Exemple |
|---------|-------|---------|
| URLs / paths | kebab-case | `/seller/billing/invoices` |
| File names (components) | PascalCase ou kebab-case selon framework | `BookingDetail.tsx` ou `booking-detail.tsx` |
| Variables, functions | camelCase | `createBooking`, `userId` |
| Classes | PascalCase | `BookingService`, `PaymentProcessor` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PHOTOS_PER_LISTING` |
| DB tables | snake_case, plural | `bookings`, `service_categories` |
| DB columns | snake_case | `created_at`, `pro_id` |
| Status enums | snake_case | `pending_pro_acceptance`, `cancelled_by_client` |
| Event names | snake_case dotted | `booking.created`, `payment.captured` |
| API endpoints | kebab-case | `POST /api/bookings/{id}/cancel` |
| Roles (Keycloak) | kebab-case | `admin-super`, `pro` |

---

## B. Architecture macro & sous-domaines

### Subdomain split

3 sous-domaines pour 3 contextes distincts. Séparation volontaire (sécurité, isolation, opérationnel).

| Sous-domaine | Rôle | Audience | Cible |
|--------------|------|----------|-------|
| `tukio.one` (apex) | App principale (public + customer + seller) | Tous utilisateurs finaux | MVP |
| `auth.tukio.one` | Pages Keycloak (login, register, MFA, reset password) | Tous utilisateurs (transit) | MVP |
| `admin.tukio.one` | Console d'administration | Admins uniquement | MVP |
| `api.tukio.one` *(optionnel)* | API publique exposée | Intégrations tierces | V3+ |
| `static.tukio.one` ou CDN | Assets statiques (images, fonts) | Servi par CDN | MVP |

### Pourquoi cette séparation ?

- **`auth.tukio.one`** : convention Keycloak. Le sous-domaine dédié facilite l'isolation des cookies de session, la customisation de thème, et permet à terme une migration vers un autre IdP sans casser les URLs.
- **`admin.tukio.one`** : isolation cruciale pour la sécurité. En cas de compromission XSS sur `tukio.one`, l'admin reste protégé. Permet aussi des règles WAF / IP allowlist différentes (admin accessible uniquement depuis IPs équipe par exemple).
- **Pas de séparation customer/seller** par sous-domaine : un même utilisateur peut être à la fois customer et seller (cf. `tukio_spec_v2.md` 2.1, doublon email autorisé). La séparation se fait par chemin URL.

### Path architecture (sur `tukio.one`)

```
tukio.one/
├── (public marketing)
│   ├── /                       → Homepage
│   ├── /sell                   → Seller landing (acquisition pros)
│   ├── /pricing                → Subscription tiers (V1)
│   ├── /about                  → Page corporate
│   ├── /contact                → Formulaire contact
│   ├── /help                   → Help center
│   └── /blog                   → Blog (V1)
│
├── (public catalog)
│   ├── /search                 → Search results
│   ├── /category/{slug}        → Category page
│   ├── /category/{slug}/{city} → Category × city (V1)
│   ├── /service/{slug}         → Service detail page
│   └── /pro/{slug}             → Public pro profile
│
├── (legal & utility)
│   ├── /terms, /sales-terms, /privacy, /cookies, /legal
│   └── /404, /500, /maintenance
│
├── (cart / checkout — accessible to public, auth required at payment)
│   └── /cart, /cart/shipping, /cart/checkout, /cart/confirmation/{order_id}
│
├── (customer area — auth required, role: client)
│   └── /account/*
│
└── (seller area — auth required, role: pro)
    └── /seller/*
```

---

## C. URL conventions

### General rules

1. **Tout en anglais** pour les paths.
2. **kebab-case** : `/sales-terms`, pas `/salesterms` ou `/sales_terms`.
3. **Pas de trailing slash** systématique (redirect 301 vers la version sans slash final).
4. **HTTPS only**, HSTS activé. Redirect HTTP → HTTPS.
5. **Pas de www** (apex `tukio.one`, redirect 301 depuis `www.tukio.one`).
6. **Stable URLs** : un slug ne change pas après publication. Si modification → conserver l'ancien slug avec redirect 301.
7. **Indexable par défaut** sauf espaces authentifiés (`/seller/*`, `/account/*`, admin → `noindex`).
8. **Pas de paramètres techniques visibles** dans les URLs publiques. *(`/service/chapiteau-100m2-blanc-chic` pas `/service?id=42`.)*

### Slug rules par entité

| Entité | Pattern | Origine | Langue |
|--------|---------|---------|--------|
| Category | `{name-french}` | Admin config | FR (SEO) |
| Service (listing) | `{title-short}` (généré, ajusté unique) | Pro saisie | FR |
| Pro | `{business-name-short}` (ajusté unique) | Pro saisie | FR ou neutre |
| City | `{city-name}` (sans "le-", "la-", etc.) | Référentiel INSEE | FR |
| Blog post | `{title-short}` | Auteur | FR |

### Reserved slugs

Liste des slugs réservés (refus à l'inscription / publication, pour éviter les collisions de routes) :

```
search, category, service, pro, account, seller, cart, help, blog,
pricing, sell, about, contact, terms, sales-terms, privacy, cookies,
legal, api, auth, admin, static, www
```

Stockage : table `reserved_slugs` côté DB, vérification à toute création (pro slug, service slug, etc.).

### Keycloak URLs (sur `auth.tukio.one`)

Standard Keycloak — pas modifiables sans dev custom :

| URL | Usage |
|-----|-------|
| `auth.tukio.one/realms/tukio/protocol/openid-connect/auth` | Endpoint OIDC |
| `auth.tukio.one/realms/tukio/login` | Login page (thème custom) |
| `auth.tukio.one/realms/tukio/registration` | Register page |
| `auth.tukio.one/realms/tukio/account` | Compte Keycloak natif (caché côté UX, on redirige vers `/account`) |

**Important UX** : on ne renvoie **jamais** l'utilisateur vers le compte Keycloak natif (`/realms/tukio/account`). Tout ce qui touche au profil utilisateur passe par `/account` ou `/seller` côté Tukio. Keycloak est invisible sauf au moment du login/register.

---

## D. Public sitemap (non connecté)

Pages accessibles sans authentification. Indexables sauf mention.

### D.1 Marketing pages (cible : acquisition)

| URL | Écran | Cible | Notes |
|-----|-------|-------|-------|
| `/` | Homepage | MVP | Hero + search + categories + CTA pro |
| `/sell` | Seller landing | MVP | Pitch acquisition pro + CTA inscription |
| `/pricing` | Subscription tiers | V1 | Comparaison Starter/Business/Enterprise |
| `/about` | Page corporate | V1 | Histoire, équipe, valeurs |
| `/contact` | Formulaire contact | MVP | Catégorie de contact (sales / support / press) |
| `/help` | Help center / FAQ | V1 | Articles structurés par thème |
| `/help/{category}` | Aide — catégorie | V1 | ex : `/help/payments` |
| `/help/{category}/{article}` | Aide — article | V1 | ex : `/help/payments/refunds` |
| `/blog` | Liste articles | V1 | SEO + content marketing |
| `/blog/{slug}` | Article | V1 | Détail article |

### D.2 Catalog pages (cible : conversion)

| URL | Écran | Cible | Notes |
|-----|-------|-------|-------|
| `/search` | Search results | MVP | Avec filtres en querystring |
| `/search?q=chapiteau&where=nantes&from=2026-06-15&to=2026-06-17` | Filtered results | MVP | Querystring lisible (`q`, `where`, `from`, `to`) |
| `/category/{slug}` | Category page | MVP | Liste services + contenu SEO |
| `/category/{slug}/{city}` | Category × city | V1 | Programmatique, contenu unique par ville |
| `/service/{slug}` | Service detail | MVP | Détail complet + booking CTA |
| `/pro/{slug}` | Public pro profile | MVP | Bio, services, avis |

### D.3 Legal pages

| URL | Écran | Cible |
|-----|-------|-------|
| `/terms` | Conditions générales d'utilisation | MVP |
| `/sales-terms` | Conditions générales de vente | MVP |
| `/seller-terms` | CGV pour les pros | V1 |
| `/privacy` | Politique de confidentialité (RGPD) | MVP |
| `/cookies` | Politique cookies | MVP |
| `/legal` | Mentions légales | MVP |

### D.4 Auth pages (transit)

L'utilisateur est *redirigé* vers ces URLs Keycloak depuis l'app. Il ne les tape pas directement.

| URL | Écran | Cible |
|-----|-------|-------|
| `auth.tukio.one/.../login` | Login | MVP |
| `auth.tukio.one/.../registration` | Register | MVP |
| `auth.tukio.one/.../forgot-password` | Reset password | MVP |
| `auth.tukio.one/.../verify-email` | Email verification | MVP |
| `auth.tukio.one/.../mfa-setup` | MFA setup | MVP (admins) / V1 (autres) |

### D.5 Public error pages

| URL | Écran | Cible |
|-----|-------|-------|
| `/404` | Not found | MVP |
| `/500` | Server error | MVP |
| `/maintenance` | Scheduled maintenance | MVP |

---

## E. Customer area sitemap

Préfixe : `/account/*`. Auth requise (role Keycloak `client`). Toutes les pages en `noindex`.

### E.1 Overview

```
/account/
├── /                              → Dashboard (active bookings, upcoming)
├── /bookings                      → All my bookings (filterable list)
│   ├── /bookings/{id}             → Booking detail
│   ├── /bookings/{id}/review      → Leave a review
│   └── /bookings/{id}/cancel      → Cancellation workflow
├── /messages                      → My conversations
│   └── /messages/{id}             → Conversation detail
├── /favorites                     → Saved services & pros (V1)
├── /quotes                        → My quote requests (V1)
│   └── /quotes/{id}               → Quote detail
├── /billing                       → Payment methods & invoices
│   ├── /billing/methods           → Saved cards
│   └── /billing/invoices          → Invoice history
├── /profile                       → Personal info
│   ├── /profile/identity          → Name, email, phone
│   ├── /profile/security          → Password, MFA
│   ├── /profile/notifications     → Preferences (email, push)
│   └── /profile/company           → If B2B (V1)
└── /delete                        → Account deletion workflow
```

### E.2 Customer screens — detail

| URL | Écran | Cible | Source domaine fonctionnel |
|-----|-------|-------|---------------------------|
| `/account` | Customer dashboard | MVP | 2.1 / 2.3 |
| `/account/bookings` | Bookings list | MVP | 2.3 |
| `/account/bookings/{id}` | Booking detail | MVP | 2.3 |
| `/account/bookings/{id}/review` | Review form | MVP | 2.7 |
| `/account/bookings/{id}/cancel` | Guided cancellation | MVP | 2.3 |
| `/account/messages` | Conversations list | MVP | 2.6 |
| `/account/messages/{id}` | Conversation | MVP | 2.6 |
| `/account/favorites` | Favorites | V1 | 2.2 |
| `/account/quotes` | Quote requests | V1 | 2.3 |
| `/account/billing/methods` | Payment methods | V1 | 2.4 |
| `/account/billing/invoices` | Invoices | V1 | 2.4 |
| `/account/profile/identity` | Profile identity | MVP | 2.1 |
| `/account/profile/security` | Security (MFA, pwd) | MVP | 2.1 |
| `/account/profile/notifications` | Notif preferences | V1 | 2.1 |

### E.3 Checkout funnel (hors `/account`)

Le tunnel checkout vit en dehors de `/account` car il est aussi accessible (en partie) aux non-connectés (qui doivent se logger / s'inscrire à l'étape paiement).

```
/cart                              → Cart view
/cart/shipping                     → Delivery & billing addresses
/cart/checkout                     → Stripe Elements payment
/cart/confirmation/{order_id}      → Post-payment confirmation
```

---

## F. Seller area sitemap

Préfixe : `/seller/*`. Auth requise (role Keycloak `pro`). Toutes les pages en `noindex`.

### F.1 Overview

```
/seller/
├── /                              → Dashboard (KPIs, pending requests)
├── /onboarding                    → Onboarding wizard (post-registration)
│   ├── /onboarding/profile        → Step 1: pro profile
│   ├── /onboarding/kyc            → Step 2: documents (KYC)
│   ├── /onboarding/stripe         → Step 3: Stripe Connect
│   └── /onboarding/first-listing  → Step 4: first service
├── /services                      → My services (listings)
│   ├── /services/new              → Create (wizard)
│   ├── /services/{id}             → Detail / preview
│   └── /services/{id}/edit        → Edit
├── /bookings                      → Requests & confirmed bookings
│   ├── /bookings?status=pending   → Pending requests queue
│   ├── /bookings/{id}             → Booking detail
│   └── /bookings/{id}/edit        → Modification proposal (V1)
├── /quotes                        → Quote requests (V1)
│   ├── /quotes/{id}               → Detail
│   └── /quotes/{id}/reply         → Quote creation/edit
├── /messages                      → Customer conversations
│   └── /messages/{id}             → Conversation
├── /calendar                      → Availability calendar
├── /reviews                       → Received reviews
│   └── /reviews/{id}/reply        → Reply to a review (V1, Business+)
├── /analytics                     → Stats & analytics (V1)
├── /billing                       → Invoices + received payouts
│   ├── /billing/invoices          → Issued invoices
│   ├── /billing/payouts           → Received / upcoming payouts
│   └── /billing/exports           → Accounting exports
├── /subscription                  → Subscription management (V1)
│   ├── /subscription/change       → Upgrade/downgrade
│   └── /subscription/invoices     → Subscription invoices (Stripe Billing)
├── /team                          → Multi-user (V1, Business+)
│   ├── /team/invite               → Invite a member
│   └── /team/{user_id}            → Member detail/edit
└── /settings                      → Pro settings
    ├── /settings/profile          → Pro identity
    ├── /settings/company          → SIRET, RIB, mandat de fact.
    ├── /settings/security         → MFA, sessions
    ├── /settings/notifications    → Notif preferences
    └── /settings/api              → API keys (V2+)
```

### F.2 Seller dashboard — anatomy

L'écran le plus important côté pro. Vu plusieurs fois par jour. Doit montrer en un coup d'œil :

| Bloc | Contenu | Cible |
|------|---------|-------|
| **To handle** (top, urgent) | Pending requests, unread messages, quote requests | MVP |
| **Upcoming** | Next 3 events | MVP |
| **Recent activity** | Latest bookings, latest reviews, latest payouts | MVP |
| **Key metrics** | MTD revenue, response rate, average rating | V1 |
| **Recommendations** | "Complete your profile", "Activate boost", etc. | V1 |

### F.3 Seller onboarding wizard

Après inscription Keycloak + email vérifié, le pro tombe sur `/seller/onboarding/profile`. Il **ne peut pas accéder** à `/seller` tant que les 4 étapes ne sont pas complétées (sauf retour ultérieur, brouillon sauvegardé).

| Étape | URL | Contenu |
|-------|-----|---------|
| 1 | `/seller/onboarding/profile` | Nom commercial, raison sociale, SIRET, bio, photo profil |
| 2 | `/seller/onboarding/kyc` | Upload pièce d'identité, justificatif d'adresse |
| 3 | `/seller/onboarding/stripe` | Redirect Stripe Connect Express (financial KYC) |
| 4 | `/seller/onboarding/first-listing` | Création du premier service (cf. catalogue deep dive) |

À l'issue : compte en `pending_admin_review`. Le pro voit une page d'attente *"Votre compte est en cours de validation, vous serez notifié sous 24 h"* + accès au dashboard en lecture seule.

---

## G. Admin sitemap

**Sous-domaine séparé** : `admin.tukio.one`. Auth requise (rôles Keycloak `admin-*`). MFA obligatoire dès l'inscription.

### G.1 Overview

```
admin.tukio.one/
├── /                              → Global dashboard (platform KPIs)
├── /users                         → User management
│   ├── /users/customers           → Customer list
│   ├── /users/customers/{id}      → Customer detail
│   ├── /users/pros                → Pro list
│   ├── /users/pros/{id}           → Pro detail
│   └── /users/admins              → Admin management (super only)
├── /verifications                 → Pro verification queue
│   └── /verifications/{id}        → Pending pro file detail
├── /catalog                       → Catalog moderation
│   ├── /catalog/services          → Services list
│   ├── /catalog/services/{id}     → Service detail (modo)
│   ├── /catalog/categories        → Taxonomy management
│   ├── /catalog/tags              → Tag management
│   └── /catalog/moderation-queue  → Moderation queue
├── /transactions                  → Bookings & payments
│   ├── /transactions/bookings     → All bookings
│   ├── /transactions/bookings/{id} → Detail
│   ├── /transactions/payments     → Stripe view (transactions)
│   └── /transactions/disputes     → Disputes workflow
│       └── /transactions/disputes/{id} → Dispute detail
├── /reports                       → User-flagged reports (moderation)
│   └── /reports/{id}              → Report detail
├── /finance                       → Platform finance
│   ├── /finance/commissions       → Collected commissions
│   ├── /finance/subscriptions     → MRR, ARR, churn
│   ├── /finance/refunds           → Refund history
│   └── /finance/reconciliation    → Stripe ↔ Tukio reconciliation
├── /communication                 → Comm tools
│   ├── /communication/emails      → Email templates (V1)
│   ├── /communication/notifications → Push & in-app (V1)
│   └── /communication/broadcasts  → Newsletters (V2)
├── /analytics                     → Detailed KPIs (V1)
├── /support                       → Support tickets (V1)
│   └── /support/{id}              → Ticket detail
├── /config                        → Platform configuration
│   ├── /config/general            → General settings
│   ├── /config/commissions        → Rates per tier
│   ├── /config/categories         → Taxonomy editor
│   ├── /config/promotions         → Boosts, featuring
│   └── /config/legal              → CGU/CGV (versions)
└── /audit                         → Audit trail (admin logs)
```

### G.2 Critical admin tools

| Outil | Usage | Cible | Sensible ? |
|-------|-------|-------|------------|
| **Pro verification** | Approve/reject KYC files | MVP | 🟠 |
| **Manual refund** | Refund a transaction | MVP | 🔴 (impact $$$) |
| **Account suspend** | Suspend a user | MVP | 🟠 |
| **Account ban** | Permanent ban | V1 | 🔴 |
| **User impersonation** | Login as user (debug) | V1 | 🔴 (audit obligatoire) |
| **Transaction edit** | Manual booking fix | V1 | 🔴 |
| **Data export** | RGPD / accounting | V1 | 🟠 |

> **Règle absolue** : toute action sensible (🔴) est loggée dans l'audit trail (immutable, append-only) avec `timestamp` + `admin_id` + `action` + `target` + `reason`. L'audit ne peut **jamais** être effacé, même par `admin-super`.

---

## H. Navigation patterns

### H.1 Top bar — public (non connecté)

**Desktop :**
```
[Tukio]  [Compact search]   Catégories  Devenir pro  | Connexion  S'inscrire
```

**Mobile :**
```
[≡]  [Tukio]                                          [🔍]
```
Le hamburger ouvre un drawer plein écran avec : Catégories, Devenir pro, Aide, Blog, Connexion, S'inscrire.

> Les **labels UI** restent en français. Les routes (`/sell`, `/help`, etc.) sont en anglais en backend.

### H.2 Top bar — customer connecté

**Desktop :**
```
[Tukio]  [Compact search]   Catégories  | [🔔]  [Avatar ▾]
```

**Avatar dropdown :**
- Tableau de bord
- Mes réservations
- Mes messages (avec badge non lus)
- Mes favoris
- Mon profil
- ─────────
- Devenir pro (si pas pro déjà)
- Aide
- ─────────
- Déconnexion

### H.3 Top bar — seller connecté

**Desktop :**
```
[Tukio Pro]  Tableau de bord  Services  Réservations  Messages  Calendrier  | [🔔]  [Avatar ▾]
```

**Notes :**
- Le logo affiche "Tukio Pro" (ou variante visuelle) pour signaler le contexte
- Le pro peut switcher en mode customer si son compte le permet (V1)
- Dropdown avatar : Mon profil pro, Statistiques, Abonnement, Paramètres, Aide pro, Mode client (V1), Déconnexion

**Mobile :**
- Top bar simplifiée (logo + hamburger + avatar)
- Drawer hamburger avec navigation complète
- **Bottom nav** (V1) : Accueil / Demandes / Messages / Calendrier / Plus

### H.4 Top bar — admin

**Sous-domaine admin** = layout dédié, sidebar à gauche.

```
┌──────────┬─────────────────────────────────────┐
│ [Logo]   │  Current admin page                 │
│          │                                     │
│ Dashboard│                                     │
│ Users    │                                     │
│ Catalog  │  Content                            │
│ Trans.   │                                     │
│ Reports  │                                     │
│ Finance  │                                     │
│ Config   │                                     │
│ Audit    │                                     │
│          │                                     │
│ [Avatar] │                                     │
└──────────┴─────────────────────────────────────┘
```

Pas de version mobile au MVP — admin desktop only. (À reconsidérer V1 si besoin terrain.)

### H.5 Footer

Présent sur toutes les pages publiques. Réduit ou absent sur les espaces connectés (`/seller`, `/account`) où il prend de la place inutile.

**Colonnes (labels FR, routes EN) :**
- **Tukio** : À propos (`/about`), Carrière, Presse
- **Aide** : Centre d'aide (`/help`), Contact (`/contact`), FAQ
- **Pour les pros** : Devenir pro (`/sell`), Tarifs (`/pricing`), Aide pro (`/help/pros`)
- **Légal** : CGU (`/terms`), CGV (`/sales-terms`), Confidentialité (`/privacy`), Mentions légales (`/legal`)
- **Réseaux sociaux** (icônes)

**Bottom :**
- Copyright "© 2026 Tukio — Marketplace événementielle"
- Mention "Made in Pays de la Loire" *(optionnel mais cohérent avec le positionnement)*

---

## I. Permissions matrix

### I.1 Matrix par rôle × action (extrait)

Légende : ✅ accès / ❌ pas d'accès / 👀 lecture seule / ⚠ accès conditionnel

| Action | Public | Customer | Pro non vérifié | Pro vérifié | admin-support | admin-modo | admin-super |
|--------|--------|----------|-----------------|-------------|---------------|------------|-------------|
| View homepage | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View service page | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View pro profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book a service | ❌ → login | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publish a service | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Edit own service | ❌ | ❌ | ❌ | ✅ | ❌ | ⚠ (modo) | ✅ |
| Accept a booking | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Cancel own booking (customer) | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Cancel booking on behalf | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manual refund | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Verify pro account | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Suspend user | ❌ | ❌ | ❌ | ❌ | ⚠ (warning only) | ✅ | ✅ |
| Ban user | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Moderate report | ❌ | ❌ | ❌ | ❌ | 👀 | ✅ | ✅ |
| Edit taxonomy | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit trail | ❌ | ❌ | ❌ | ❌ | 👀 | 👀 | ✅ |
| Impersonate user | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (logged) |
| Edit admin roles | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### I.2 Additional rules

**Sur la propriété des données** :
- Un pro voit *uniquement* ses services, ses réservations, ses messages
- Un customer voit *uniquement* ses réservations, ses messages
- Un admin voit toute la plateforme (selon son niveau)

**Sur l'évolution des rôles** :
- Un customer peut devenir pro (ajout du role `pro` côté Keycloak après onboarding KYC)
- Un pro peut redevenir uniquement customer (retrait du role `pro` après désactivation)
- Un admin n'est *jamais* converti depuis customer/pro (provisionnement manuel par super-admin uniquement)

**Sur les sessions multiples** :
- Un user avec roles `client` ET `pro` voit l'interface customer par défaut
- Toggle "Passer en espace pro" dans le menu (V1)

---

## J. Cross-cutting & utility pages

### J.1 Error pages

| Erreur | URL | Comportement |
|--------|-----|--------------|
| 404 Not Found | catch-all | Page custom avec recherche + retour homepage |
| 403 Forbidden | catch-all | Page custom selon rôle (login si non connecté, "Accès refusé" si rôle insuffisant) |
| 500 Internal Error | catch-all | Page custom avec ID d'erreur Sentry pour le support |
| 503 Service Unavailable | `/maintenance` | Page maintenance planifiée |

**Règle** : aucune page d'erreur ne doit exposer de détails techniques (stack trace, paths internes). Référence Sentry uniquement.

### J.2 Special states

| Cas | URL | Comportement |
|-----|-----|--------------|
| Email non vérifié | `/verify-email` | Bloque l'accès aux features transactionnelles |
| KYC pro en cours | `/seller` (banner persistant) | Lecture seule + CTA vers onboarding |
| Compte suspendu | `/account-suspended` | Page d'info + contact support |
| Compte banni | Logout forcé + page d'info | Aucun accès, pas de re-login possible |
| Pays non supporté | `/unsupported-country` (V2) | Liste pays cible, alerte d'inscription |

### J.3 SEO utility URLs

| URL | Contenu | Cible |
|-----|---------|-------|
| `/sitemap.xml` | Sitemap XML auto-généré | MVP |
| `/robots.txt` | Robots.txt avec règles `noindex` | MVP |
| `/manifest.json` | Web app manifest (PWA V1) | V1 |
| `/.well-known/security.txt` | Contact sécurité | MVP |

---

## K. Notifications — où, quand, comment

### K.1 Channels

| Canal | Cible MVP | Cible V1 | Cible V2 |
|-------|-----------|----------|----------|
| **Email** | ✅ | ✅ | ✅ |
| **In-app** (cloche 🔔) | ❌ | ✅ | ✅ |
| **SMS** | ❌ | ✅ (option pro payante) | ✅ |
| **Web push** | ❌ | ✅ (PWA) | ✅ |
| **Mobile push** | ❌ | ❌ | ✅ (app native) |

### K.2 Send rules per event (MVP excerpt)

| Event | Email customer | Email pro | In-app | Notes |
|-------|---------------|-----------|--------|-------|
| `email.verified` | ✅ | ✅ | — | Confirmation simple |
| `pro.verified` | — | ✅ | — | Important, début d'activité |
| `pro.rejected` | — | ✅ | — | Avec raison |
| `booking.requested` | — | ✅ | V1 | Urgent, à traiter sous 48 h |
| `booking.accepted` | ✅ | — | V1 | Début phase exécution |
| `booking.refused` | ✅ | — | V1 | Avec refund auto |
| `payment.failed` | ✅ | — | V1 | Avec lien retry |
| `payout.completed` | — | ✅ | V1 | Info comptable |
| `event.reminder.7d` | ✅ | ✅ | — | Logistique |
| `event.reminder.1d` | ✅ | ✅ | — | Logistique |
| `review.requested` (J+1) | ✅ | — | V1 | Lien direct vers form |
| `review.received` | — | ✅ | V1 | Encourager la réponse (V1) |
| `message.new` | ✅ (si non lu après 1 h) | ✅ (si non lu après 1 h) | V1 | Regroupé après 3 messages non lus |

### K.3 User preferences

Dans `/account/profile/notifications` (customer) et `/seller/settings/notifications` (pro), l'utilisateur peut désactiver par catégorie :

- **Transactional** *(non désactivables)* : booking confirmation, payment, refund, pro verification
- **Important** : reminders J-7, J-1, review request
- **Marketing** : newsletter, news, special offers

**Règle légale** : les notifs marketing nécessitent un opt-in explicite (RGPD).

---

## L. Version tagging (MVP / V1 / V2)

### L.1 Vue récapitulative — MVP screens

Liste exhaustive des écrans à concevoir et développer pour le MVP (~44 écrans).

#### Public / non connecté (~10 écrans)
1. Homepage `/`
2. Seller landing `/sell`
3. Contact `/contact`
4. Search `/search`
5. Category page `/category/{slug}`
6. Service detail `/service/{slug}`
7. Public pro profile `/pro/{slug}`
8. Legal pages (4 écrans `/terms`, `/sales-terms`, `/privacy`, `/legal`)
9. 404 / 500 / Maintenance
10. Keycloak themed auth pages (login, register, forgot, verify-email)

#### Customer area (~9 écrans)
11. Customer dashboard `/account`
12. Bookings list `/account/bookings`
13. Booking detail `/account/bookings/{id}`
14. Review form `/account/bookings/{id}/review`
15. Cancellation `/account/bookings/{id}/cancel`
16. Conversations list `/account/messages`
17. Conversation `/account/messages/{id}`
18. Profile identity `/account/profile/identity`
19. Security `/account/profile/security`

#### Checkout funnel (~4 écrans)
20. Cart `/cart`
21. Shipping `/cart/shipping`
22. Payment `/cart/checkout`
23. Confirmation `/cart/confirmation/{order_id}`

#### Seller area (~15 écrans)
24. Onboarding profile `/seller/onboarding/profile`
25. Onboarding KYC `/seller/onboarding/kyc`
26. Onboarding Stripe `/seller/onboarding/stripe`
27. Onboarding first listing `/seller/onboarding/first-listing`
28. Seller dashboard `/seller`
29. Services list `/seller/services`
30. New service `/seller/services/new`
31. Edit service `/seller/services/{id}/edit`
32. Booking requests/list `/seller/bookings`
33. Booking detail (pro view) `/seller/bookings/{id}`
34. Pro conversations list `/seller/messages`
35. Pro conversation `/seller/messages/{id}`
36. Calendar `/seller/calendar`
37. Profile settings `/seller/settings/profile`
38. Company settings `/seller/settings/company`

#### Admin (~6 MVP minimal)
39. Admin login (Keycloak themed)
40. Admin dashboard `admin.tukio.one/`
41. Pro verifications `admin.tukio.one/verifications`
42. Pro file detail `admin.tukio.one/verifications/{id}`
43. Transactions list `admin.tukio.one/transactions/bookings`
44. Reports queue `admin.tukio.one/reports`

**Total MVP : ~44 écrans**.

### L.2 V1 additions (estimation ~30 écrans)

- Extended marketing pages (`/pricing`, `/blog`, `/help`)
- B2B customer area (`/account/profile/company`)
- Quotes (customer + pro)
- Multi-vendor (impact sur écrans existants + nouveaux statuts)
- Pro subscriptions (`/seller/subscription/*`)
- Pro stats (`/seller/analytics`)
- Advanced admin moderation
- Disputes management (`admin.tukio.one/transactions/disputes`)
- Etc.

### L.3 V2 additions (estimation ~20+ écrans)

- Event configurator
- Personalized recommendations
- Co-subcontracting
- Loyalty program
- Native mobile (parcours refonte)
- B2B SSO (admin config)
- Etc.

---

## Annexe — Map vers les domaines fonctionnels

Pour chaque domaine fonctionnel (`tukio_spec_v2.md` Partie 2), liste des écrans concernés. Permet au designer de retrouver rapidement quels écrans relèvent de quel domaine pour les UX flows.

| Domaine | Écrans concernés |
|---------|-----------------|
| **2.1 Comptes** | Pages auth Keycloak, `/account/profile/*`, `/seller/onboarding/*`, `/seller/settings/*`, admin verifications |
| **2.2 Catalogue** | `/`, `/search`, `/category/*`, `/service/*`, `/pro/*`, `/seller/services/*` |
| **2.3 Booking** | `/service/*` (cta), `/cart/*`, `/account/bookings/*`, `/seller/bookings/*` |
| **2.4 Paiements** | `/cart/checkout`, `/cart/confirmation`, `/account/billing/*`, `/seller/billing/*` |
| **2.5 Abos pros** | `/pricing`, `/seller/subscription/*`, admin `/finance/subscriptions` |
| **2.6 Messagerie** | `/account/messages/*`, `/seller/messages/*` |
| **2.7 Avis** | `/account/bookings/{id}/review`, `/seller/reviews/*`, fiche service & profil pro (affichage) |
| **2.8 Modération** | `admin.tukio.one/verifications`, `/reports`, `/transactions/disputes`, `/audit` |

---

*Fin du document — version 1.1, à itérer avec retours design.*
