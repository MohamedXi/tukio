---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-core-experience
  - step-04-emotional-response
  - step-05-inspiration
  - step-06-design-system
  - step-07-defining-experience
  - step-08-visual-foundation
  - step-09-design-directions
  - step-10-user-journeys
  - step-11-component-strategy
  - step-12-ux-patterns
  - step-13-responsive-accessibility
  - step-14-complete
status: 'complete'
lastStep: 14
completedAt: '2026-05-08'
inputDocuments:
  # Strate consolidée (planning artifacts)
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/product-brief-tukio.one.md
  - _bmad-output/planning-artifacts/product-brief-tukio.one-distillate.md
  # Strate produit (docs source)
  - docs/tukio_spec_v2.2.md
  - docs/tukio_design_brief.md
  - docs/tukio_information_architecture.md
  - docs/tukio_catalogue_deepdive.md
  - docs/tukio_booking_paiements_deepdive.md
  # Strate UX flows (matière première du Cloud Design)
  - docs/tukio_ux_flow_catalog.md
  - docs/tukio_ux_flow_booking.md
  - docs/tukio_ux_flow_auth_accounts.md
  - docs/tukio_ux_flow_communication.md
  - docs/tukio_ux_flow_monetization.md
  - docs/tukio_ux_flow_admin_moderation.md
  # Strate backend
  - docs/microservices-architecture.md
  - docs/tukio_product_tech_alignment.md
  - docs/tukio_booking_svc_deepdive.md
  - docs/tukio_event_catalog.md
  # Strate go-to-market
  - docs/tukio_strategie_acquisition.md
  - docs/tukio_opportunites_futures.md
  # Bundle Claude Design (UI déjà designée)
  - docs/cloud-design-bundle/README.md
  - docs/cloud-design-bundle/chats/chat1.md
  - docs/cloud-design-bundle/project/styles/tokens.css
  - docs/cloud-design-bundle/project/tukio.one.html
  - docs/cloud-design-bundle/project/screens/  # 31 fichiers JSX (cf. inventaire Step 1)
documentCounts:
  prd: 1
  architecture: 1
  brief: 2
  uxFlows: 6
  projectDocs: 11
  cloudDesignBundle: 1
  cloudDesignScreens: 31
workflowType: 'ux-design-specification'
workflowMode: 'adapted-from-existing-cloud-design'
project_name: 'tukio.one'
user_name: 'Ismael'
date: '2026-05-08'
cloudDesignBundlePath: 'docs/cloud-design-bundle/'
cloudDesignSourceUrl: 'https://api.anthropic.com/v1/design/h/jNynbSjrQloEthEBD0A8wQ?open_file=tukio.one.html'
---

# UX Design Specification — tukio.one

**Author:** Ismael
**Date:** 2026-05-08
**Workflow Mode:** Adapté à partir d'un design Cloud Design (Anthropic Design) existant — pas de design from scratch

---

> Ce document spécifie l'UX de tukio.one en s'appuyant sur :
> - Le **bundle Claude Design** existant (`docs/cloud-design-bundle/`) — 31 écrans designés + design system tokens.css
> - Le **PRD** (130 FRs + 84 NFRs)
> - L'**Architecture** (14 ADRs + project structure 4 apps multi-zones feature-based)
> - Les **6 UX flows** sources (`docs/tukio_ux_flow_*.md`) qui ont servi de matière première au Cloud Design
> - Le **design brief** (`docs/tukio_design_brief.md`) — palette, typo, voix, anti-patterns
>
> Le pipeline est **adapté** au cas Tukio (UI déjà designée) : audit du design existant → design system documentation → gap analysis → interaction patterns/states → accessibility → responsive multi-zones → microcopy FR/EN → tokens code-ready → validation/handoff.

## Executive Summary

### Project Vision (UX perspective)

**tukio.one est une marketplace transactionnelle B2B2C dédiée à l'événementiel français**, où chaque interaction utilisateur doit incarner *Confiance, Chaleur, Sobriété, Ancrage local et Modernité tranquille* (5 attributs de marque du design brief §A).

**One-liner UX (intangible, design brief §A)** :
> *Tukio est la place de marché qui rend l'organisation d'événements plus simple, plus fiable et plus belle, en connectant directement les organisateurs aux professionnels locaux.*

**Promesse client** : *"Trouve les bons pros près de chez toi, en confiance, sans appeler 10 personnes."*
**Promesse pro** : *"Concentre-toi sur ton métier, on s'occupe du reste : visibilité, paiement, paperasse."*

**Direction visuelle figée** (cohérent design brief + extraction `tokens.css` du Cloud Design) :
- Palette **terracotta** (`brand-500 = #C2410C`) + neutres chauds **cream/charcoal** + fonctionnels désaturés
- Typographie **Fraunces** (display, italic-friendly) + **Inter** (body) + **JetBrains Mono** (code/labels)
- Composants atomiques figés : `.tk-btn` (primary/secondary/tertiary/ghost), `.tk-input`, `.tk-badge`, `.tk-card`, `.tk-stars`, `.tk-ph` (placeholders rayés monospace)
- Modular scale typo 1.250 (12px → 76px), spacing base 4px, radius 4-24px, shadows warm-tinted
- **Aucune photo stock** : placeholders rayés monospace explicites ("photo événement réel") jusqu'à intégration de vraies photos

**Voix & ton (design brief §I, non négociable)** :
- **Vouvoiement systématique** — pas de "tu" même côté client B2C
- Direct et clair, pas de blabla marketing creux
- Chaleureux mais pas familier (*"Bonjour Jean"* > *"Salut Jean !"*)
- **Pas d'émojis dans l'UI** (sauf cloche 🔔 notifications V1)
- Pas de jargon SaaS : "Tableau de bord" pas "Dashboard", "Réservation" pas "Booking"

### Target Users

**6 personas du PRD §6 + admin** :

#### Côté client

- **C1 — Particulier organisateur** *(MVP, cible #1 acquisition)* : 25-55 ans, CSP+, organise mariage/anniversaire/baptême. Budget 1k-10k€. Recherche 6-12 mois en amont. **Mobile-first à terme + desktop dominant pour la décision.** *Pain UX* : "j'ai pas le temps d'appeler 10 personnes" → la plateforme doit délivrer une réservation confirmée en < 4 minutes (Journey J1).
- **C2 — Office manager / responsable événements entreprise** *(V1)* : PME/ETI, séminaires/kick-offs. Budget 5k-50k€/événement. Besoin facturation B2B propre, traçabilité comptable, paiement sur facture. *Pain UX* : "Je veux 1 facture, pas 5".
- **C3 — Mairie / association / collectivité** *(V3+ uniquement, hors scope MVP/V1/V2)*

#### Côté pro

- **P1 — TPE / artisan événementiel local** *(MVP, sourcing physique founder-led)* : 1-10 personnes, CA 50k-500k€/an. **Mobile-first sur le terrain** (livraisons, montages). *Seuil de rétention critique : ≥ 2 résa/mois sinon churn 6 mois* — l'UX dashboard pro doit rendre les leads et les actions à traiter immédiatement visibles.
- **P2 — Pro premium / agence événementielle** *(V2 Enterprise)* : > 500k€/an. Besoin SLA, AM, intégrations comptables, SSO entreprise, analytics avancées.
- **P3 — Pro saisonnier / freelance** *(V1)* : 5-30 événements/an, tier Starter (commission 15 %).

#### Côté admin Tukio

- 1-2 modérateurs internes au MVP. **Desktop only** (sous-domaine `admin.tukio.one` séparé, MFA TOTP obligatoire). Workflow file de validation → décisions graduées (avertissement → suspension → bannissement). Audit trail immuable.

### Key Design Challenges

**Issus du croisement PRD + Architecture + Design Brief + Audit du bundle Cloud Design** :

#### 1. Two-sided marketplace cold-start (RA1, risque opérationnel #1)

L'UX doit créer **immédiatement** la confiance des deux côtés malgré le catalogue restreint au démarrage (50 pros × 2 catégories pilotes au MVP). Implications :
- Côté client : **transparence radicale** (prix tout-compris, capture différée explicite, garantie remboursement, avis vérifiés visibles)
- Côté pro : **time-to-first-booking** rapide (onboarding wizard 4 étapes < 30 min) + dashboard avec urgence claire
- Anti-patterns : pas de feature dazzle au MVP (configurateur, recommendations, fidélité = V1+/V2)

#### 2. Capturer simultanément B2C particulier ET B2B entreprise

Concurrent direct des verticaux mariage Pinterest-rose (cantonne au B2C romantique) ET des plateformes corporate B2B-only (Bizzabo/Cvent austères). Implications UX :
- Direction visuelle qui marche pour le mariage **ET** le séminaire : terracotta chaleureux mais sobre, jamais "rose poudré"
- Anti-positionnement explicite : pas Pinterest mariage, pas Stripe minimalist froid, pas Airbnb aspirationnel touristique, pas Leboncoin brut
- Bascule espace customer ↔ seller fluide pour les comptes hybrides V1+

#### 3. i18n FR/EN dès Sprint 0 sans internationalisation géographique

Cas d'usage particulier : **utilisateur résidant en France qui préfère parler anglais**. App pas internationalisée géographiquement (France only) mais bilingue linguistiquement (ADR-012). Implications UX :
- Locale-prefix URLs `/fr/...` `/en/...` partout
- Sélecteur locale visible dans le header, persistance cookie + préférence compte
- Fallback FR avec **badge UI explicite** "Disponible uniquement en français" sur les fiches services sans traduction EN (FR99-100)
- Templates email Resend FR + EN — locale du destinataire pioché sur profil

#### 4. Saga distribuée booking-payment visible (R11, risque tech critique)

5 étapes saga (`requested → accepted → captured → confirmed → completed`) avec capture différée Stripe. L'UX doit **rassurer le client pendant les transitions** sans exposer la complexité backend :
- Status visible et compréhensible côté customer (`/account/bookings/{id}` doit refléter l'état réel)
- Côté pro, la file `pending_pro_acceptance` doit afficher délai d'expiration (FR42)
- Anti-désintermédiation : coordonnées client masquées avant acceptation pro (FR45)

#### 5. Acquisition demande SEO-driven (RA1 mitigation, NFR47-55)

Le SEO est le canal #1 d'acquisition. Implications UX :
- **Pages publiques (apps/public/)** doivent être optimisées Core Web Vitals (LCP < 2,5s, INP < 200ms, CLS < 0,1)
- Bundle JS initial < 150 KB gzipped (NFR7) → composants lourds (Stripe Elements, calendrier, map) en dynamic imports uniquement sur `apps/customer/`
- Schema.org JSON-LD injecté côté serveur (Service, LocalBusiness, BreadcrumbList, AggregateRating, Organization)
- Hreflang systématique entre les locales

#### 6. Accessibilité RGAA AA (NFR47-55, obligation légale FR)

- Contrast ratio ≥ 4,5:1 sur texte normal (déjà OK avec `cream-50` × `charcoal-700`)
- Navigation clavier 100% (focus ring visible, ordre Tab logique, skip links)
- HTML sémantique strict (`<button>`, `<nav>`, `<main>`, etc.)
- Touch targets 44×44 px minimum mobile (WCAG + Apple HIG)
- `prefers-reduced-motion` respecté
- `axe-core` intégré aux tests Playwright sur parcours critiques (CI gate)
- Audit RGAA externe avant V0 release

#### 7. Brownfield design + greenfield code

Le bundle Claude Design contient **31 écrans déjà designés** mais le projet code est greenfield. L'UX spec doit :
- Documenter le design system extracté pour qu'il soit code-ready (`packages/ui/src/tokens/`)
- Identifier les écrans **manquants** vs PRD (cf. §Gap Analysis Step 4)
- Expliquer comment les 31 écrans Claude Design **mappent vers les 4 apps multi-zones** (ADR-013)

### Design Opportunities

#### 1. Direction terracotta comme signature mémorable

Aucun concurrent FR n'utilise cette palette : Mariages.net rose, ABC Salles bleu corporate, Eventbrite orange vif US, Luma violet tech. Le terracotta + Fraunces italic crée une **signature instantanément reconnaissable** — capitalisé dans le bundle Cloud Design.

#### 2. Placeholders rayés monospace comme système de "honesty UX"

Le bundle utilise `.tk-ph` avec rayures monospace + label explicite ("photo événement réel") plutôt que stock photos. **Opportunité** : transformer cette convention en **promesse marketing** ("nos photos sont vraies, prises lors de vrais événements") quand on intégre les vraies photos pros au MVP.

#### 3. Confiance par les états visibles

L'UX type marketplace cache souvent les états backend. Tukio peut **transformer la transparence en différenciation** :
- "Capture à l'acceptation pro" expliqué clairement au checkout (vs "votre carte sera débitée maintenant")
- Délai d'acceptation visible (48h max)
- Statut saga reflété côté customer en temps réel
- Garantie remboursement pré-pré-événement explicite, pas en petit caractères

#### 4. Wizard d'onboarding pro comme produit en soi

Bundle a déjà un `pro-onboarding.jsx` + `mvp-pro-onboarding.jsx`. **Opportunité** : faire de cet onboarding un *moment* (4 étapes guidées avec feedback positif à chaque étape, pas un tunnel administratif). Le founder l'utilisera physiquement pour onboarder les 50 premiers pros — l'UX doit être agréable à montrer en démo.

#### 5. Mobile pro-first dès V1 (PWA), V2 native

Bundle a déjà des écrans `mobile.jsx`, `mobile-account.jsx`, `mobile-extra.jsx`. **Opportunité** : prioriser PWA installable côté `apps/seller/` dès V1 (pros sur le terrain) avec push notifications urgentes (nouvelles demandes < 48h). Les pros reçoivent les leads "comme une app native" sans attendre V2.

#### 6. Helpcenter + blog comme acquisition + rétention

Pas dans le bundle (gap). **Opportunité** : design d'un help center riche + blog SEO-optimisé (RA1 mitigation, 2 articles/mois MVP, 4/mois V1). Les checklists téléchargeables ("Checklist mariage en Pays de la Loire") génèrent leads opt-in pour `notification-svc` Brevo V1.

## Audit du Cloud Design existant

> Le bundle Claude Design est préservé dans `docs/cloud-design-bundle/`. Les 31 écrans designés constituent le point de départ de l'UX spec. Cette section catalogue ce qui existe et son état.

### 31 écrans inventoriés

#### Système & shared

| Écran | Fichier | Mapping | État |
|-------|---------|---------|------|
| Design system (tokens, composants, voix) | `screens/design-system.jsx` + `styles/tokens.css` | Source de vérité `packages/ui/` | ✅ Figé |
| Logo (3 directions) | `screens/logo.jsx` | `packages/ui/src/icons/Logo.tsx` | ✅ Figé |
| Shared layouts (top nav, footer, helpers) | `screens/_shared.jsx` | `packages/ui/src/patterns/` + `apps/<app>/shared/layouts/` | ✅ Figé |

#### Public (apps/public/)

| Écran | Fichier | Path Next.js | Capability area | État |
|-------|---------|--------------|-----------------|------|
| Homepage | `screens/home.jsx` | `/{locale}/` | B (catalog/discovery) | ✅ Figé |
| Search results | `screens/search.jsx` | `/{locale}/search` | B | ✅ Figé |
| Service detail | `screens/service.jsx` | `/{locale}/service/{slug}` | B | ✅ Figé |
| Public pro profile | `screens/pro-profile.jsx` | `/{locale}/pro/{slug}` | A + F (display avis) | ✅ Figé |

#### Customer (apps/customer/)

| Écran | Fichier | Path Next.js | Capability | État |
|-------|---------|--------------|------------|------|
| Cart checkout | `screens/checkout.jsx` | `/{locale}/cart/checkout` | C + D | ✅ Figé |
| Confirmation | `screens/confirmation.jsx` | `/{locale}/cart/confirmation/{orderId}` | C + D | ✅ Figé |
| Bookings list | `screens/bookings-list.jsx` | `/{locale}/account/bookings` | C | ✅ Figé |
| Booking detail | `screens/booking-detail.jsx` | `/{locale}/account/bookings/{id}` | C | ✅ Figé |
| Cancel flow | `screens/cancel-flow.jsx` | `/{locale}/account/bookings/{id}/cancel` | C (+ G force majeure dispute) | ✅ Figé |
| Review form | `screens/review-form.jsx` | `/{locale}/account/bookings/{id}/review` | F | ✅ Figé |
| Messages | `screens/messages.jsx` | `/{locale}/account/messages` + `/{locale}/account/messages/{id}` | E | ✅ Figé |
| Account settings | `screens/account-settings.jsx` | `/{locale}/account/profile/identity` (+ peut-être autres) | A | ⚠️ À auditer (couvre quels sous-écrans ?) |

#### Seller (apps/seller/)

| Écran | Fichier | Path Next.js | Capability | État |
|-------|---------|--------------|------------|------|
| Pro dashboard | `screens/pro-dashboard.jsx` | `/{locale}/seller/` | C + tous | ✅ Figé |
| Pro onboarding wizard | `screens/pro-onboarding.jsx` | `/{locale}/seller/onboarding/{step}` | A | ✅ Figé (V1 complet 5 étapes) |
| Pro onboarding MVP | `screens/mvp-pro-onboarding.jsx` | `/{locale}/seller/onboarding/{step}` | A (variante MVP simplifiée) | ✅ Figé |
| Seller bookings | `screens/seller-bookings.jsx` | `/{locale}/seller/bookings` | C | ✅ Figé |
| Seller calendar | `screens/seller-calendar.jsx` | `/{locale}/seller/calendar` | B (dispo) | ✅ Figé (V1) |
| Seller profile edit | `screens/seller-profile-edit.jsx` | `/{locale}/seller/settings/profile` | A | ✅ Figé |
| Seller reviews | `screens/seller-reviews.jsx` | `/{locale}/seller/reviews` | F | ✅ Figé |
| Seller service create | `screens/seller-service-create.jsx` | `/{locale}/seller/services/new` (V1 wizard complet) | B | ✅ Figé |
| MVP service create (simplifié) | `screens/mvp-service-create.jsx` | `/{locale}/seller/services/new` (variante MVP) | B | ✅ Figé |

#### Admin (apps/admin/)

| Écran | Fichier | Path | Capability | État |
|-------|---------|------|------------|------|
| MVP admin (minimal) | `screens/mvp-admin.jsx` | `admin.tukio.one/...` | G | ⚠️ Minimal — 1 seul écran. **Tous les autres écrans admin V1+ sont à designer.** |

#### Auth (Keycloak themed)

| Écran | Fichier | Path | Capability | État |
|-------|---------|------|------------|------|
| MVP auth | `screens/mvp-auth.jsx` | `auth.tukio.one/...` (Keycloak themed) | A | ⚠️ À auditer (couvre login/register ?). MFA setup, forgot password, verify email, MFA enforcement admin probablement à designer en plus. |

#### Mobile (V2 native, mais aussi PWA V1)

| Écran | Fichier | Cible | État |
|-------|---------|-------|------|
| Mobile homepage | `screens/mobile.jsx` | `apps/public/` responsive | ✅ Figé |
| Mobile customer account | `screens/mobile-account.jsx` | `apps/customer/` responsive | ✅ Figé |
| Mobile extras | `screens/mobile-extra.jsx` | divers (probablement seller mobile) | ⚠️ À détailler |

#### Roadmap V1+/V2/V3 (previews — pas figées)

| Écran | Fichier | Phase | État |
|-------|---------|-------|------|
| V1 commerce features (multi-vendor, abos, etc.) | `screens/v1-commerce.jsx` | V1 preview | 🟡 Draft |
| V1 trust + V2/V3 (configurateur, fidélité, mobile native) | `screens/v1-trust-and-v2v3.jsx` | V1+/V2+ preview | 🟡 Draft |

### État global du design existant

- **22 écrans figés** (✅) : direction visuelle complète, UI prête à coder en React/Next.js + `@tukio/ui`
- **5 écrans à auditer** (⚠️) : couverture exacte à valider (account-settings, mvp-auth, mobile-extra, mvp-admin minimaliste, peut-être 1 ou 2 autres)
- **2 previews V1+/V2/V3** (🟡) : direction validée mais pas écrans complets
- **~30+ écrans manquants** vs PRD (cf. Step 4 §Gap Analysis détaillée)

### Couverture des 6 user journeys du PRD

| Journey | Écrans couverts | Couverture | Manquants |
|---------|------------------|------------|-----------|
| **J1 Sophie réserve (happy C1 MVP)** | home → search → service → checkout → confirmation → bookings-list → booking-detail → review-form → messages | ✅ **100 %** | — |
| **J2 Annulation force majeure (edge C1)** | cancel-flow + (admin manquant pour la dispute mediation) | ⚠️ **60 %** | Admin dispute mediation screen, customer cancellation policy education |
| **J3 Marc onboarde (happy P1 MVP)** | pro-onboarding (full) + mvp-pro-onboarding + pro-dashboard + seller-bookings + seller-service-create | ✅ **100 %** | — |
| **J4 Dispute Stripe (edge P1)** | seller-bookings (probablement avec état dispute) + admin manquant | ⚠️ **40 %** | Pro contestation form (evidence trail), admin dispute submission UX |
| **J5 Léa valide pro (admin-support MVP)** | mvp-admin (couvre la file ?) | ⚠️ **30 %** | KYC review detail, audit trail viewer, decision actions UX |
| **J6 Saga échouée (admin-modo edge)** | rien (gap critique) | ❌ **0 %** | Saga monitoring dashboard, replay event UI, observability inline |

**Résultat** : excellent côté **happy paths customer + seller MVP** (J1 + J3 = 100 %), **incomplet côté admin** (J4-J5-J6 → 30-60 %). Le gap admin est attendu : Cloud Design a livré le coeur produit, l'admin V1+ reste à designer.

## Core User Experience

> Cette section consolide les choix d'expérience utilisateur déjà actés dans le PRD §5 (5 phases de transaction) + les 6 user journeys (J1-J6) + le bundle Cloud Design (31 écrans). Le détail des parcours par écran est dans la §"Audit du Cloud Design existant" ci-dessus.

### Core User Action

**LE UN qui définit la valeur produit** : un client transforme une intention floue ("trouver un chapiteau pour mon mariage en juin") en une **réservation payée et confirmée** en moins de 4 minutes, sans appeler personne ni avancer de virement (cf. Journey J1 du PRD §User Journeys).

Ce parcours canonique = **Home → Search → Service → Checkout → Confirmation** est entièrement designé dans le bundle Cloud Design (`screens/{home,search,service,checkout,confirmation}.jsx`) avec :
- Recherche faceted Meilisearch dès la home (catégorie + ville + date)
- Fiche service riche (3-15 photos, tarif tout-compris, options, délai, politique d'annulation)
- Tunnel checkout Stripe Elements avec **capture différée explicitée** dans la copy ("Votre carte sera débitée uniquement après acceptation du pro")
- Confirmation rassurante avec next steps (rappels J-7, J-1, demande d'avis J+1)

**Symétrique côté pro** : un pro qui reçoit une nouvelle demande peut **accepter ou refuser en moins de 30 secondes** via `/seller/bookings?status=pending` (cf. `screens/seller-bookings.jsx`), avec coordonnées client masquées avant acceptation (FR45) et délai d'expiration visible (FR42).

### Platform Requirements

| Plateforme | Version | Cible |
|------------|---------|-------|
| **Web responsive** (Next.js 15) | MVP | 4 apps multi-zones : `public` + `customer` + `seller` + `admin` |
| **PWA installable** | V1 | Côté `apps/seller/` prioritaire (pros sur le terrain), push notifications urgentes |
| **App mobile native** (iOS + Android) | V2 | Priorité côté pro encore, avec features mobile-first (scanner QR matériel livré, signature électronique, géolocalisation pour livraisons) |

**Touch-based + mouse/keyboard** : touch targets 44×44 px minimum (WCAG + Apple HIG), focus ring visible pour navigation clavier (NFR49).

**Pas d'offline** au MVP/V1. PWA V1 met en cache les pages statiques + les listings vus, mais les actions transactionnelles (booking, paiement, message) requièrent connexion.

**Capabilities device** :
- Géolocalisation (V1) : optionnelle pour pré-remplir le champ "ville" de la search
- Camera (V2 native) : photos directes depuis l'app pro (livraison, signature)
- Push notifications (V1 PWA / V2 native) : urgences pros, rappels événement

### Effortless Interactions

Interactions qui doivent être **instantanées et zéro-friction** :

| Interaction | UX cible | Bundle Cloud Design |
|-------------|----------|---------------------|
| Search par catégorie + ville + date | Autocomplétion sur "Quoi", carousel catégories visibles depuis la home | `screens/home.jsx`, `screens/search.jsx` |
| Filtrage facets (capacité, prix, options) | Filter sidebar avec compteurs en temps réel | `screens/search.jsx` |
| Calendrier dispo temps réel sur fiche service | Sélection de plage avec indicateur dispo/non-dispo en couleur sobre | À designer dans `screens/service.jsx` (audit nécessaire) |
| Checkout Stripe | Stripe Elements iframe (lazy-loaded), 3DS Secure transparent, 1-clic carte sauvegardée V1 | `screens/checkout.jsx` |
| Acceptation / refus pro | Boutons primary/danger avec icônes claires, modale confirmation destructrice | `screens/seller-bookings.jsx` |
| Switch locale FR ↔ EN | Sélecteur dans le header, persistance immédiate (cookie + reload route locale-prefixed) | À ajouter dans `_shared.jsx` (gap audit) |
| Toggle customer ↔ seller (V1, comptes hybrides) | Dropdown avatar avec "Passer en espace pro" | À designer V1 |

**Anti-patterns interdits** (cohérent design brief §J) :
- ❌ Modale obligatoire au load (newsletter, cookies bombardés) — utiliser cookie banner sobre conforme RGPD
- ❌ Auto-play vidéos
- ❌ Hover-only interactions (mobile incompatible)
- ❌ Scroll hijacking
- ❌ Loading spinner > 2s sans feedback (utiliser skeleton screens, design brief §D.8)

### Critical Success Moments

**Moments où l'UX peut faire/défaire la confiance utilisateur** :

| Moment | Côté | Mesure UX | Bundle existant |
|--------|------|-----------|-----------------|
| **"Aha" client** : voir prix tout-compris + dispo confirmée + avis vérifiés sur la même fiche | C1/C2 | Délai entre arrivée fiche et clic "Réserver" < 90 s | ✅ `screens/service.jsx` |
| **Confirmation booking** : statut clair "en attente acceptation pro" avec délai max | C1/C2 | NPS booking-flow > 50 | ✅ `screens/confirmation.jsx` |
| **1ère acceptation pro reçue** : délai < 4h pour 90 % des résa MVP | P1 | Délai médian < 2 h (NFR — délai médian de 1ère réponse pro) | ✅ `screens/seller-bookings.jsx` |
| **Reversement J+1** visible côté pro après l'événement | P1 | Pro voit virement + facture dans `/seller/billing/payouts` sans relance | ⚠️ Gap : `seller-billing.jsx` à designer |
| **Demande d'avis J+1** : email + page form fluide | C1/C2 | Taux dépôt avis > 40 % | ✅ `screens/review-form.jsx` |
| **Validation pro J+18h** : email "Compte validé" + accès dashboard | P1 | Délai < 24h (NFR — délai moyen validation admin) | ✅ `screens/pro-dashboard.jsx` |
| **Annulation force majeure** : empathie + remboursement clair | C1/C2 | Customer ne supprime pas son compte, revient | ✅ `screens/cancel-flow.jsx` |
| **Saga échouée admin-modo** : alerte → replay → résolution invisible côté user | Admin / J6 | RTO < 10 min sur saga bloquée | ❌ Gap critique : à designer V1+ |

**Failure points à éviter absolument** :
- Délai d'acceptation pro qui dépasse 48h sans rappel automatique côté client
- Capture Stripe avant acceptation pro (= rupture de promesse "remboursé si refus")
- Stale data sur calendrier dispo (race condition non détectée → over-booking)
- Modale d'erreur générique sans `tukioCode` ni action de récupération
- Anti-désintermédiation cassée (email/téléphone visible avant acceptation → désintermédiation client/pro hors plateforme)

## Emotional Response & Inspiration

> Direction émotionnelle figée par le design brief §A et exécutée dans le bundle Cloud Design. Cette section consolide pour traçabilité.

### Emotional Response cible

**Quand un user arrive sur tukio.one, il doit ressentir** :

| Émotion | Côté C1 (mariage) | Côté C2 (B2B) | Côté P1 (artisan) |
|---------|-------------------|----------------|---------------------|
| **Confiance immédiate** | "C'est sérieux, mes 3 400 € sont protégés" | "Je peux justifier en compta, c'est clair" | "Tukio paie en J+1, sans relance" |
| **Chaleur sans niaiserie** | "Pas Pinterest mariage, mais pas froid" | "Pas Stripe austère, ça respire" | "On me parle comme un pro, pas un user" |
| **Sobriété qui rassure** | "L'interface ne me déconcentre pas" | "Pas de gimmick marketing" | "Je vois mes leads urgents en 1 coup d'œil" |
| **Ancrage local valorisant** | "Made in Pays de la Loire — c'est mon coin" | "Une plateforme française qui pense fiscalité française" | "Le founder m'a serré la main au Salon" |
| **Modernité tranquille** | "Ça vieillira pas en 2 ans" | "Outil pro mais pas tech-bro" | "Y'a une app pro, c'est pas un site bricolé" |

**5 attributs de marque non négociables** (design brief §A) : Confiance, Chaleur, Sobriété, Ancrage local, Modernité tranquille. Tout choix UI/UX qui contredit l'un de ces attributs doit être rejeté.

**Ce que les utilisateurs ne doivent JAMAIS ressentir** (anti-positionnement design brief §A) :
- ❌ "C'est du Pinterest mariage rose poudré" (cantonne au B2C romantique)
- ❌ "C'est du Stripe minimaliste froid" (austère pour des moments de vie)
- ❌ "C'est un Airbnb aspirationnel touristique" (mauvaise promesse, on est utilitaire)
- ❌ "C'est du Leboncoin brut" (manque de cadre)
- ❌ "C'est du MalleàWedding / 1001Listes vieillot" (vieillit mal)

### Inspiration (références mentales — design brief §A)

Six références mentales utilisées par le bundle Cloud Design comme garde-fous :

| Référence | Pour quoi | Contre-exemple Tukio |
|-----------|-----------|---------------------|
| **Airbnb** | Onboarding & confiance, fiches services | ...mais en plus *chaleureux* (et moins lifestyle) |
| **ManoMano** | Catalogue produits événementiels | ...mais en plus *haut de gamme* (moins bricolage) |
| **Le Slip Français** | Ton "made in France pro mais pas guindé" | Pas trop branding-driven, focus utilité |
| **Le Bon Marché** (digital) | Sobriété élégante, hiérarchie tipo | Pas trop éditorial, on reste transactionnel |
| **Resy / OpenTable** récent | Qualité du parcours de réservation | Pas l'aspect lifestyle resto |
| **Faire** (faire.com) | Palette neutre chaleureuse | Pas l'aspect grossiste / B2B-only |

**Métaphore long terme officialisée** (PRD §Vision) : *"Être ce que **Le Bon Marché** est au commerce — la place de marché élégante, ancrée localement, premium dans son segment, où la confiance est l'expérience par défaut."*

### Direction visuelle exécutée dans le bundle

Le bundle Cloud Design a **exécuté ces directions à fond** plutôt que de proposer 2-3 variantes A/B (cf. chat transcript) :

- **Une seule direction terracotta** (vs ocre profond ou émeraude foncé qui étaient les alternatives initiales du design brief §B)
- **Pas de Tweaks panel** publié au final (le panneau pour switcher palette/density/hero variant n'a pas été inclus)
- **Une seule typo display** : Fraunces avec italic-friendly (pas de pairing alternatif testé)
- **Une seule iconography** : Lucide (à compléter par picto custom événementiels)

**Conséquence pour Sprint 0** : la direction visuelle est figée. Si après les 50 premiers pros / 100 premières résa, le founder veut tester une variante (palette ocre pour B2B uniquement, par ex.), ce sera un A/B test post-MVP avec mesure NPS à l'appui — pas une décision au lancement.

## Design System Documentation

> Le design system Tukio est extrait directement du bundle Cloud Design (`docs/cloud-design-bundle/project/styles/tokens.css` + `_shared.jsx`). Cette section le rend **code-ready** pour `packages/ui/src/` consommé par les 4 apps multi-zones (ADR-013).
>
> **Stack frontend** : **Tailwind v4** (CSS-first config via `@theme`), **Next.js 15** + React 19, **TypeScript** strict. Toujours latest stable (cf. mémoire `feedback_latest_versions.md`).

### Architecture du package `@tukio/ui`

```
packages/ui/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ styles/
│  │  ├─ theme.css                                # ← SOURCE DE VÉRITÉ Tailwind v4 @theme
│  │  └─ globals.css                              # reset léger + @import 'tailwindcss' + @import 'theme.css'
│  ├─ tokens/                                    # accès programmatique TS (charts, Stripe theme, etc.)
│  │  ├─ colors.ts
│  │  ├─ typography.ts
│  │  ├─ spacing.ts
│  │  ├─ radius.ts
│  │  ├─ shadows.ts
│  │  ├─ breakpoints.ts
│  │  ├─ animations.ts
│  │  └─ index.ts
│  ├─ stores/                                    # Zustand stores cross-apps
│  │  ├─ locale.store.ts                          # locale FR/EN (sync cookie)
│  │  ├─ theme.store.ts                           # V2 si dark mode
│  │  └─ index.ts
│  ├─ components/                                 # atomics React 19
│  │  ├─ Button/{Button.tsx,Button.spec.tsx,index.ts}
│  │  ├─ Input/{Input.tsx,Input.spec.tsx,index.ts}
│  │  ├─ Label/, Helper/, FormField/
│  │  ├─ Badge/, Card/, Divider/, Stars/, Avatar/
│  │  ├─ Modal/, Toast/, Alert/
│  │  ├─ Skeleton/, Spinner/, ProgressBar/
│  │  ├─ Placeholder/                             # .tk-ph striped monospace
│  │  └─ ...
│  ├─ patterns/                                   # composites
│  │  ├─ TopBar/, Footer/
│  │  ├─ ConversationThread/
│  │  ├─ ReviewsDisplay/, PricingDisplay/
│  │  ├─ AvailabilityCalendar/
│  │  ├─ FilterSidebar/
│  │  ├─ FileUpload/
│  │  ├─ StepIndicator/
│  │  ├─ Map/                                     # Mapbox/Google wrapper
│  │  ├─ EmptyState/                              # 7 variants design brief §D.7
│  │  └─ ...
│  ├─ icons/
│  │  ├─ Logo/{Logo.tsx,LogoMark.tsx}
│  │  ├─ Lucide/                                  # re-exports stables Lucide latest
│  │  └─ custom/{Marquee,Chair,Lighting,Catering,...}.tsx  # picto custom événementiels
│  ├─ providers/
│  │  └─ ThemeProvider.tsx
│  └─ index.ts
└─ stories/                                       # Storybook V1+ optionnel
```

### Tailwind v4 CSS-first config

> **Tailwind v4** utilise une approche **CSS-first** : les design tokens vivent dans un fichier CSS via la directive `@theme`. Plus de `tailwind.config.ts` racine pour les tokens — le TypeScript reste utile pour l'accès programmatique (charts, Stripe Elements theme, etc.) mais n'alimente PAS Tailwind.

#### `packages/ui/src/styles/theme.css` — source de vérité Tailwind v4

```css
/* packages/ui/src/styles/theme.css
   Tukio Design System — extracted from Cloud Design bundle (tokens.css)
   Tailwind v4 @theme directive — CSS-first config */

@theme {
  /* ─── Brand: terracotta ────────────────────────────────────── */
  --color-brand-50:  #FCF3EE;
  --color-brand-100: #F8E0D0;
  --color-brand-200: #F1B996;
  --color-brand-300: #E89160;
  --color-brand-400: #DC6E33;
  --color-brand-500: #C2410C;
  --color-brand-600: #9A340A;
  --color-brand-700: #7A2A09;
  --color-brand-800: #5C2008;
  --color-brand-900: #3E1606;

  /* ─── Neutres chauds ───────────────────────────────────────── */
  --color-cream-50:  #FAF7F2;
  --color-cream-100: #F5F1EA;
  --color-cream-200: #EBE5D9;
  --color-cream-300: #DDD4C2;
  --color-charcoal-400: #6B6657;
  --color-charcoal-500: #4A453A;
  --color-charcoal-600: #2F2C25;
  --color-charcoal-700: #1F1D18;
  --color-charcoal-800: #14130F;
  --color-charcoal-900: #0A0A07;

  /* ─── Functional désaturés ─────────────────────────────────── */
  --color-success-50:  #ECF1ED;
  --color-success-500: #4D7C5E;
  --color-success-700: #345240;
  --color-warning-50:  #F8ECD9;
  --color-warning-200: #F0D8B8;
  --color-warning-500: #B45309;
  --color-warning-700: #7A380A;
  --color-error-50:    #FCE8E8;
  --color-error-500:   #B91C1C;
  --color-error-700:   #7F1414;
  --color-danger-50:   #FCE8E8;
  --color-danger-500:  #C84838;
  --color-danger-600:  #B53A2B;
  --color-danger-700:  #8E2C20;
  --color-info-50:     #E2EEF3;
  --color-info-500:    #1E5F7E;
  --color-info-700:    #143F54;

  /* ─── Typography ───────────────────────────────────────────── */
  --font-display: "Fraunces", "Tiempos Headline", Georgia, serif;
  --font-body:    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* Modular scale 1.250 (Major Third) */
  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-lg:   20px;
  --text-xl:   25px;
  --text-2xl:  31px;
  --text-3xl:  39px;
  --text-4xl:  49px;
  --text-5xl:  61px;
  --text-6xl:  76px;

  /* ─── Spacing (base 4px) ───────────────────────────────────── */
  --spacing-0:  0px;
  --spacing-1:  4px;
  --spacing-2:  8px;
  --spacing-3:  12px;
  --spacing-4:  16px;
  --spacing-5:  20px;
  --spacing-6:  24px;
  --spacing-8:  32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-24: 96px;

  /* ─── Radius ───────────────────────────────────────────────── */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* ─── Shadows (warm-tinted, charcoal-700 base) ─────────────── */
  --shadow-sm: 0 1px 2px rgba(31, 29, 24, 0.05);
  --shadow:    0 2px 8px rgba(31, 29, 24, 0.06);
  --shadow-md: 0 4px 16px rgba(31, 29, 24, 0.08);
  --shadow-lg: 0 12px 32px rgba(31, 29, 24, 0.12);
  --shadow-xl: 0 24px 64px rgba(31, 29, 24, 0.16);

  /* ─── Breakpoints (cohérent design brief §F) ───────────────── */
  --breakpoint-xs: 0px;
  --breakpoint-sm: 481px;
  --breakpoint-md: 641px;
  --breakpoint-lg: 1025px;
  --breakpoint-xl: 1281px;
  --breakpoint-2xl: 1537px;

  /* ─── Animations ───────────────────────────────────────────── */
  --animate-typing: tk-typing 1.4s ease-in-out infinite;
}

/* ─── Keyframes ─────────────────────────────────────────────── */
@keyframes tk-typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-3px); opacity: 1; }
}

@keyframes tk-modal-enter {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes tk-shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

/* ─── prefers-reduced-motion ───────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

#### `packages/ui/src/styles/globals.css` — entry point partagé

```css
/* packages/ui/src/styles/globals.css */
@import "tailwindcss";          /* Tailwind v4 — remplace @tailwind base/components/utilities */
@import "./theme.css";           /* @theme tokens Tukio */

/* Reset léger + base styles cohérents avec design brief */
:root {
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--color-charcoal-700);
  background: var(--color-cream-50);
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--color-charcoal-800);
  text-wrap: balance;
}

p { margin: 0; text-wrap: pretty; }
a { color: inherit; text-decoration: none; }

::selection { background: var(--color-brand-200); color: var(--color-charcoal-800); }
```

#### Consommation par les 4 apps Next.js

```css
/* apps/public/src/app/globals.css */
@import "@tukio/ui/styles/globals.css";

/* Si l'app a des overrides spécifiques, les ajouter ici (rare) */
```

### TypeScript Tokens (accès programmatique)

Les fichiers `packages/ui/src/tokens/*.ts` restent utiles pour : charts (recharts/visx/d3), Stripe Elements theme (Stripe attend des hex strings), tests visuels Playwright, PostHog tagging, génération automatique de docs.

```typescript
// packages/ui/src/tokens/colors.ts
export const colors = {
  brand: { 50: '#FCF3EE', 100: '#F8E0D0', 200: '#F1B996', 300: '#E89160', 400: '#DC6E33', 500: '#C2410C', 600: '#9A340A', 700: '#7A2A09', 800: '#5C2008', 900: '#3E1606' },
  cream: { 50: '#FAF7F2', 100: '#F5F1EA', 200: '#EBE5D9', 300: '#DDD4C2' },
  charcoal: { 400: '#6B6657', 500: '#4A453A', 600: '#2F2C25', 700: '#1F1D18', 800: '#14130F', 900: '#0A0A07' },
  success: { 50: '#ECF1ED', 500: '#4D7C5E', 700: '#345240' },
  warning: { 50: '#F8ECD9', 200: '#F0D8B8', 500: '#B45309', 700: '#7A380A' },
  error: { 50: '#FCE8E8', 500: '#B91C1C', 700: '#7F1414' },
  danger: { 50: '#FCE8E8', 500: '#C84838', 600: '#B53A2B', 700: '#8E2C20' },
  info: { 50: '#E2EEF3', 500: '#1E5F7E', 700: '#143F54' },
} as const;

// idem typography.ts, spacing.ts, radius.ts, shadows.ts, breakpoints.ts, animations.ts
```

**Synchronisation `theme.css` ↔ `tokens.ts`** : à terme, écrire un script `pnpm tokens:sync` qui parse `theme.css` et regénère les fichiers TS. Pour le MVP : maintenir manuellement les deux (faible volume de tokens).

### Règles d'usage des tokens

- **Jamais de `#000` ni `#FFF` purs** — toujours `charcoal-X` ou `cream-X` (registre chaud)
- `brand-500` = action principale (CTA primary, focus ring, links)
- `cream-50` = page background par défaut
- `charcoal-700` = texte principal (contrast ratio ≥ 4,5:1 vs `cream-50` — vérifié RGAA AA)
- `warning-500` proche de `brand-500` → différencier par typo (font-weight 600+) + icône `<AlertTriangle>` Lucide
- `danger-X` réservé aux actions destructrices irréversibles (Annuler résa, Supprimer compte, Bannir user)
- Hover states dérivés : primary → `brand-400`, secondary → `cream-200`, tertiary → `brand-50`, ghost → `cream-100`
- **Pas de mode sombre au MVP/V1** — décision V2+ si demande client. Si activé : inversion `cream` ↔ `charcoal` pour surfaces, `brand-X` reste figé.

### Règles d'usage typographique

- **Display (Fraunces)** : `<h1>`, `<h2>`, `<h3>`, `<h4>` uniquement — `font-weight: 500`, `letter-spacing: -0.01em`, `text-wrap: balance`, color `charcoal-800`
- **Body (Inter)** : tout le reste, `font-feature-settings: "ss01", "cv11"`, `text-rendering: optimizeLegibility`
- **Mono (JetBrains Mono)** : labels meta (placeholders, status badges techniques admin, code snippets), `font-size: 11-12px`, `letter-spacing: 0.04em`, `text-transform: uppercase`
- **Fraunces italic** sur les **accents éditoriaux** uniquement (titres marketing, sous-titres hero, citations clients) — pas dans les UI transactionnels (boutons, formulaires, dashboards)
- `text-wrap: balance` sur tous les `<h*>` (élimine les widows en headings)
- `text-wrap: pretty` sur `<p>` (élimine les widows + orphans en body)

### Composants atomiques — règles

- `<Button>` : variants `primary | secondary | tertiary | ghost | danger`, sizes `sm | default | lg`. Touch target `lg` (48px) sur mobile (NFR53 WCAG 2.1 AA).
- `<Input>` : avec `<Label>`, `<Helper>`, error state, prefix/suffix slots, clear button optionnel
- `<Badge>` : variants `brand | success | warning | info | neutral`, padding `2px 8px`, font `text-xs` weight 500
- `<Card>`, `<Modal>`, `<Toast>`, `<Alert>`, `<Avatar>`, `<Stars>` : extraits du bundle, code-ready
- `<Placeholder>` : pattern striped monospace explicite (cohérent .tk-ph du bundle), conservé tant que catalogue pas peuplé de vraies photos
- `<Skeleton>`, `<Spinner>`, `<ProgressBar>` : loading states (cf. design brief §D.8 — pas de loader si action < 300 ms)

### Patterns (composites)

| Pattern | Usage | Bundle source |
|---------|-------|---------------|
| `<TopBar>` | Header app, variants public/customer/seller/admin | `_shared.jsx` |
| `<Footer>` | Footer pages publiques (cf. design brief §H.5) | `_shared.jsx` |
| `<ConversationThread>` | Chat client/pro (FR67-74) | `messages.jsx` |
| `<ReviewsDisplay>` | Note globale + breakdown multi-critères + liste avis (V1) | `service.jsx`, `pro-profile.jsx` |
| `<PricingDisplay>` | Multi-lignes (sous-total, TVA, frais livraison, total) | `service.jsx`, `checkout.jsx` |
| `<AvailabilityCalendar>` | Sélection plage avec dispo/non-dispo | `service.jsx`, `seller-calendar.jsx` |
| `<FilterSidebar>` | Filtres recherche faceted (FR19) | `search.jsx` |
| `<FileUpload>` | Drag & drop avec preview (V1 messagerie + KYC pro) | `mvp-pro-onboarding.jsx`, `pro-onboarding.jsx` |
| `<StepIndicator>` | Wizards (création service, checkout, onboarding) | `pro-onboarding.jsx`, `seller-service-create.jsx` |
| `<Map>` | Mapbox/Google avec markers customisés | À designer V1 |
| `<EmptyState>` | 7 variants design brief §D.7 | À cataloguer Sprint 0 |
| `<ErrorPage>` | 404, 500, maintenance | À designer (gap) |

### State Management

> Référence canonique : Architecture §Frontend Architecture. Récap pour les agents downstream qui consultent uniquement la spec UX.

| Type de state | Solution | Usage Tukio |
|---------------|----------|-------------|
| **Server state** (data fetched, mutations, cache HTTP) | **TanStack Query** v5 | 90 % du state — listings, bookings, messages, profil. Wrappé dans `@tukio/api-client` avec hooks typés. |
| **UI state local** (form input, modal open, accordion expanded) | **`useState` / `useReducer`** natif React | Dans le composant qui le possède, pas plus haut. |
| **UI state global persistant** | **Zustand** v5 | Cas restreints uniquement : locale, theme, panier non-loggé pré-checkout. |
| **Form state** | **React Hook Form** + Zod resolver | Tous les formulaires (validation cohérente avec `@tukio/contracts`). |

**Localisation des stores Zustand** :
- `packages/ui/src/stores/` — stores shared cross-apps (locale, theme V2)
- `apps/<app>/src/features/<feature>/stores/` — stores feature-specific (ex : `cart.store.ts` dans `apps/customer/features/cart-checkout/`)

**Zustand n'a pas besoin de provider** (zero-config). Les stores s'importent directement : `import { useLocaleStore } from '@tukio/ui/stores'`.

❌ **Pas de Redux / MobX / Context API** pour state global lourd.

### Voice & Tone Guidelines

> Cf. design brief §I (référence canonique). Récap exécutoire pour l'UX writing :

| Règle | Faire ✅ | Ne pas faire ❌ |
|-------|----------|------------------|
| **Vouvoiement systématique** | "Réservez votre chapiteau" | "Réserve ton chapiteau" |
| **Direct et clair** | "Votre paiement est sécurisé. Vous serez débité après acceptation du pro." | "Démarrez votre aventure événementielle inoubliable !" |
| **Chaleureux mais pas familier** | "Bonjour Sophie" | "Salut Sophie ! 🎉" |
| **Pas d'émojis dans l'UI** | Icônes Lucide | 🎉 ⭐ 💸 |
| **Pas de jargon SaaS FR** | "Tableau de bord", "Réservation", "Paramètres" | "Dashboard", "Booking", "Settings" |
| **Pas de jargon métier non expliqué** côté C1 | "Document d'identité du professionnel" | "KYC" |
| **Microcopy proactive** sur les frictions | "Votre dossier est en cours de validation, vous serez notifié sous 24 h." | Loading spinner muet |
| **Empathie sur les erreurs** | "Cette date n'est plus disponible. Voici 3 alternatives proches :" | "Erreur 409. Conflict." |

**Tableaux de microcopy par parcours** : à compiler au Step 8 — Microcopy FR + EN.

### Iconography

- **Lucide** (latest stable) comme bibliothèque de base, re-exports stables dans `@tukio/ui/icons/Lucide/`
- **Picto custom événementiels** à dessiner pour les catégories produit Sprint 0 : tente, chaise, sono, traiteur, fleur, etc.
- Style trait dessiné (vs vectoriel "Stripe-like" lisse) — cohérent design brief §H.3
- ❌ Pas de personnages illustrés génériques type Storyset/Undraw
- ❌ Pas d'émojis

### Photos & Visual Content

Direction "réel chaleureux" (design brief §H) :

✅ **Faire** : photos événements **réels** (avec accord client + pro), lumière naturelle, tons chauds, personnes en moment vécu, plan large + détails

❌ **Éviter** : stock photos évidents, setups "trop parfaits" (vide, aseptisé), sur-traitement / filtres saturés

**MVP** : utiliser `<Placeholder>` rayé monospace explicite ("Photo événement réel") tant que le catalogue n'a pas 50 pros avec leurs vraies photos. C'est la convention "honesty UX" du bundle.

**V1+** : tutoriels intégrés dans onboarding pro pour aider à uploader de bonnes photos. Possibilité (V1+) de proposer une session photo pro à tarif négocié.

### Stack frontend latest stable

> Cf. mémoire `feedback_latest_versions.md`. **Toujours latest stable** — vérifier `pnpm view <package> version` au Sprint 0 avant figeage.

| Package | Version | Notes |
|---------|---------|-------|
| **Tailwind CSS** | **v4.x latest** | CSS-first config via `@theme`, plus de `tailwind.config.ts` |
| Next.js | 15.x latest | App Router, Turbopack stable, React 19 |
| React | 19.x | RSC, Suspense, async transitions |
| TypeScript | 5.x latest | Strict mode |
| pnpm | 10.x | Workspaces |
| Turborepo | 2.x | Affected-builds |
| **TanStack Query** | **5.x latest** | Server state |
| **Zustand** | **5.x latest** | UI global persistant (locale, theme, cart guest) |
| **React Hook Form** | **7.x latest** | Forms + Zod resolver |
| Zod | 4.x si stable, sinon 3.x dernière | Schemas partagés `@tukio/contracts` |
| next-intl | 4.x si stable, sinon 3.x dernière | i18n FR/EN |
| Vitest | 3.x latest | Tests frontend |
| Playwright | latest | Tests E2E + axe-core |
| shadcn/ui | latest (Tailwind v4 compatible) | Composants base |
| Lucide | latest | Icons |
| Stripe.js | latest | + @stripe/react-stripe-js latest |

### Migration plan tokens.css (Cloud Design v3-style) → theme.css (v4)

| Étape | Action |
|-------|--------|
| 1 | Copier `docs/cloud-design-bundle/project/styles/tokens.css` → renommer variables en `--color-*`, `--font-*`, `--text-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--breakpoint-*` selon convention v4 |
| 2 | Wrap dans `@theme { ... }` directive |
| 3 | Supprimer les classes utilitaires custom du bundle (`.tk-btn`, `.tk-input`, etc.) — remplacées par les composants React typés `<Button>`, `<Input>` |
| 4 | Garder `.tk-ph` placeholder pattern dans `theme.css` ou en composant React `<Placeholder>` |
| 5 | Tester rendu visuel pixel-match avec le bundle Cloud Design (`tukio.one.html` comme référence) |
| 6 | Initialiser `pnpm dlx shadcn@latest init` dans `apps/public/` puis copier dans les 3 autres apps |
| 7 | Câbler `<ThemeProvider>` dans `apps/<app>/src/shared/providers/` |
| 8 | Tests unitaires composants atomiques (Vitest) |

**Critère de sortie Story design system Sprint 0** : les 4 apps Next.js démarrent en `pnpm dev`, importent `<Button>`, `<Input>`, `<Card>` depuis `@tukio/ui`, le rendu visuel match exactement le bundle Cloud Design (terracotta + Fraunces + Inter + spacing 4px).

## Defining Experience, Visual Foundation & Design Directions (consolidation)

> Sections largement couvertes par les Steps 2-6. Cette section consolide pour traçabilité et boucle ce qui n'a pas été explicité ailleurs.

### Defining Experience — résumé exécutoire

L'expérience Tukio se résume à **3 promesses tenues simultanément** :

1. **"Je trouve en confiance, sans appeler"** (côté C1/C2) — délivré par : search facets, fiches services riches, capture différée Stripe, avis vérifiés, transparence des prix, garantie de remboursement explicite. Couvert par les écrans `home → search → service → checkout → confirmation` du bundle.
2. **"On me donne du travail, pas du temps perdu"** (côté P1/P2/P3) — délivré par : onboarding wizard 4 étapes < 30 min, dashboard avec urgence claire, acceptation < 30 sec, reversement J+1 visible, anti-désintermédiation protégée. Couvert par les écrans `pro-onboarding → pro-dashboard → seller-bookings → seller-calendar → seller-reviews` du bundle.
3. **"On garantit le cadre"** (côté admin Tukio) — délivré par : validation pro, modération a posteriori, workflow litige V1, audit trail immuable, sanctions graduelles. Couvert partiellement par `mvp-admin` du bundle, complétion V1+ requise (gap §Audit).

**Métrique unique de succès UX** : un client qui arrive sur la home termine sa réservation payée et confirmée en moins de **4 minutes**, et un pro reçoit cette demande en moins de **30 minutes**, et l'accepte en moins de **2 heures** (médiane).

### Visual Foundation — résumé exécutoire

Foundation **figée** dans Step 6 + bundle Cloud Design :

- **Palette** : terracotta `brand-500 #C2410C` + cream/charcoal + functional désaturés (success/warning/error/info/danger)
- **Typo** : Fraunces (display, italic-friendly accents éditoriaux) + Inter (body) + JetBrains Mono (labels meta)
- **Modular scale** : 1.250 (Major Third), `text-xs` 12px → `text-6xl` 76px
- **Spacing** : base 4px, échelle 1-24
- **Radius** : 4-24px + full
- **Shadows** : warm-tinted (rgba `charcoal-700`)
- **Breakpoints** : xs (0-480) → 2xl (1537+), max-width 1200-1400px
- **Implementation** : Tailwind v4 CSS-first via `@theme` (cf. Step 6)

### Design Directions — résumé exécutoire

3 directions ont été pré-sélectionnées dans le design brief §B (terracotta, ocre profond, émeraude foncé). **Le bundle Cloud Design a tranché : terracotta** (cf. chat transcript). Ce choix est **figé** et exécuté à fond dans les 31 écrans.

**Pas de variantes A/B au lancement** — exécution unifiée. Le founder pourra A/B tester post-MVP (50 pros + 100 résa atteints) avec mesure NPS si une variante semble pertinente (par ex : palette ocre pour cible B2B Enterprise V2).

**Tweaks panel** (palette/density/hero variant switcher) **mentionné mais NON inclus** dans le bundle final — décision pragmatique du Cloud Design pour livrer plus vite. Pas de re-création nécessaire au MVP : la palette est figée, point.

### Anti-directions explicitement rejetées

(Cohérent design brief §A et bundle Cloud Design)

- ❌ **Pinterest mariage rose poudré** (cantonne au B2C romantique)
- ❌ **Stripe minimaliste froid** (austère pour des moments de vie)
- ❌ **Airbnb aspirationnel touristique** (mauvaise promesse, on est utilitaire)
- ❌ **Leboncoin brut** (manque de cadre)
- ❌ **MalleàWedding / 1001Listes vieillot** (vieillit mal)
- ❌ **Mode sombre au MVP/V1** (V2+ si demande)
- ❌ **Variantes UI A/B** au lancement (post-MVP uniquement)
- ❌ **Skins multiples** (admin sombre, B2B custom, etc.) — un seul skin terracotta partagé

## User Journeys — Screen Mapping & Gap Analysis

> Cette section trace les **6 user journeys du PRD** (J1-J6) écran par écran, avec :
> - **Status bundle** : ✅ figé / ⚠️ à auditer / 🟡 draft / ❌ gap
> - **Priorité Sprint 0** pour les gaps : 🔴 MVP bloquant / 🟠 MVP nice-to-have / 🟡 V1 / 🟢 V2+
>
> Cohérent avec le PRD §User Journeys + Architecture §Project Structure (mapping FRs → fichiers).

### J1 — Sophie réserve son chapiteau (Customer C1, happy path MVP)

> *Persona : Sophie, 32 ans, Nantaise, mariage à La Baule le 15/06/2026. Budget chapiteau ~3 400 €. Délai entre première recherche et réservation confirmée : < 4 minutes.*

| Étape | Écran Cloud Design | Path Next.js | App | Status | Note |
|-------|---------------------|---------------|------|--------|------|
| 1. Découverte | `home.jsx` | `/{locale}/` | public | ✅ | Hero + search 3-champs + carousel catégories |
| 2. Search initial | `search.jsx` | `/{locale}/search?q=chapiteau&where=la-baule&from=2026-06-15` | public | ✅ | Filter sidebar facets + résultats |
| 3. Page locale catégorie × ville | À designer | `/{locale}/category/location-tentes-chapiteaux/la-baule` | public | ❌ MVP V1 | 🟠 — gap, V1 (RA1 SEO mitigation) |
| 4. Fiche service | `service.jsx` | `/{locale}/service/chapiteau-100m2-blanc-chic-pornichet` | public | ✅ | 12 photos, tarif tout-compris, options, dispo, avis, politique |
| 5. Calendrier dispo (interactif) | dans `service.jsx` (à auditer) | idem | public | ⚠️ | Audit nécessaire — interaction dispo en temps réel |
| 6. Tunnel cart | `checkout.jsx` (audit /cart pré-checkout?) | `/{locale}/cart` puis `/{locale}/cart/shipping` | customer | ⚠️ | Bundle a `checkout.jsx` mais pas séparé pré-checkout cart vue. **Audit Sprint 0 : cart vue + shipping address peut être fusionné dans checkout.jsx ou écrans séparés à designer.** |
| 7. Checkout Stripe Elements | `checkout.jsx` | `/{locale}/cart/checkout` | customer | ✅ | Stripe Elements iframe, capture différée explicitée |
| 8. Confirmation | `confirmation.jsx` | `/{locale}/cart/confirmation/{orderId}` | customer | ✅ | Récap booking + next steps + lien vers `/account/bookings/{id}` |
| 9. Email confirmation Resend (FR) | `notification-svc` template | (email externe) | — | 🟠 MVP | Template email à designer Sprint 0 |
| 10. Liste bookings espace client | `bookings-list.jsx` | `/{locale}/account/bookings` | customer | ✅ | |
| 11. Détail booking | `booking-detail.jsx` | `/{locale}/account/bookings/{id}` | customer | ✅ | Statut saga visible (pending pro / accepted / confirmed) |
| 12. Messagerie liée booking | `messages.jsx` | `/{locale}/account/messages/{conversationId}` | customer | ✅ | WebSocket chat, anti-désintermédiation regex visible |
| 13. Email rappel J-7 + J-1 | `notification-svc` templates | (email externe) | — | 🟠 MVP | Templates emails à designer Sprint 0 |
| 14. Demande d'avis J+1 | `review-form.jsx` | `/{locale}/account/bookings/{id}/review` | customer | ✅ | Note 1-5 + commentaire (multi-critères V1) |

**Couverture J1** : **12/14 ✅** (86 %), 2 gaps templates email (🟠 MVP) + audit cart vue.

### J2 — Annulation force majeure (Customer C1, edge case)

> *Persona : Même Sophie. À J-3, sa belle-mère décède. Tout doit être annulé. Cas hors politique standard → dispute médiée par admin.*

| Étape | Écran Cloud Design | Path Next.js | App | Status | Note |
|-------|---------------------|---------------|------|--------|------|
| 1. Workflow annulation guidé | `cancel-flow.jsx` | `/{locale}/account/bookings/{id}/cancel` | customer | ✅ | 3 templates politique (souple/standard/strict) + cas exceptionnel |
| 2. Upload justificatif (force majeure) | dans `cancel-flow.jsx` (audit) | idem | customer | ⚠️ | Audit Sprint 0 : `<FileUpload>` pattern intégré ? |
| 3. Confirmation soumission | dans `cancel-flow.jsx` | idem | customer | ✅ | Page success + indication "Notre équipe vous recontacte sous 48h" |
| 4. Dashboard admin dispute (médiation) | À designer | `admin.tukio.one/transactions/disputes/{id}` | admin | ❌ V1 | 🟡 — gap, V1 (workflow dispute structuré) |
| 5. Conversation admin ↔ pro (proposition refund 100%) | `messaging-svc` UI admin | (pas dans bundle) | admin | ❌ V1 | 🟡 — gap, V1 |
| 6. Action admin "Refund full" | À designer | `admin.tukio.one/transactions/disputes/{id}/refund` | admin | ❌ V1 | 🟡 — gap, V1 (RBAC `admin-modo`/`admin-super`) |
| 7. Email confirmation refund (Resend, empathique) | Template emails | (email externe) | — | 🟠 MVP-V1 | À designer (template emails empathiques pour litiges) |
| 8. Booking détail statut "cancelled_with_refund" | `booking-detail.jsx` (variant) | `/{locale}/account/bookings/{id}` | customer | ✅ | Reuse écran existant avec status mapping |

**Couverture J2** : **3/8 ✅** (38 %), 4 gaps admin V1 + 1 gap audit + 1 gap email. Le **workflow dispute admin structuré est l'élément critique manquant pour J2 complet**.

### J3 — Marc onboarde sur Tukio (Pro P1, happy path MVP)

> *Persona : Marc, 38 ans, gérant de Pornichet Events. Founder l'a contacté au Salon du Mariage de Nantes. Onboarding < 30 min.*

| Étape | Écran Cloud Design | Path Next.js | App | Status | Note |
|-------|---------------------|---------------|------|--------|------|
| 1. Inscription Keycloak | `mvp-auth.jsx` | `auth.tukio.one/realms/tukio/registration` | auth | ⚠️ | Audit : `mvp-auth` couvre register ? sinon design Keycloak themed pages |
| 2. Email vérification | Template + landing page | `/{locale}/auth/verify-email` (frontend) | public | ❌ MVP | 🔴 — gap critique, page landing post-clic email |
| 3. Onboarding wizard step 1 — Profil | `pro-onboarding.jsx` (étape 1) ou `mvp-pro-onboarding.jsx` | `/{locale}/seller/onboarding/profile` | seller | ✅ | 2 versions disponibles (V1 complet + MVP simplifié) |
| 4. Onboarding wizard step 2 — KYC docs | idem (étape 2) | `/{locale}/seller/onboarding/kyc` | seller | ✅ | Upload pièce ID + RIB + justificatif d'adresse |
| 5. Onboarding wizard step 3 — Stripe Connect | idem (étape 3) | `/{locale}/seller/onboarding/stripe` | seller | ✅ | Redirect Stripe Connect Express |
| 6. Onboarding wizard step 4 — 1ère fiche service | `mvp-service-create.jsx` (MVP) ou `seller-service-create.jsx` (V1) | `/{locale}/seller/onboarding/first-listing` | seller | ✅ | 2 versions disponibles |
| 7. Page d'attente "validation admin" | À designer | `/{locale}/seller` (banner persistant) | seller | ❌ MVP | 🟠 — gap, lecture seule + CTA support si délai > 24h |
| 8. Email validation pro reçu | Template | (email externe) | — | 🟠 MVP | À designer (template "Bienvenue sur Tukio") |
| 9. 1ère connexion dashboard pro | `pro-dashboard.jsx` | `/{locale}/seller/` | seller | ✅ | To-do urgent + upcoming + recent activity |
| 10. 1ère demande client (notification) | `messaging-svc` push + email | (notification externe) | — | 🟠 MVP V1 | Email immédiat MVP + push V1 |
| 11. Acceptation booking | `seller-bookings.jsx` | `/{locale}/seller/bookings/{id}` | seller | ✅ | Boutons accept/refuse + coordonnées masquées avant accept |
| 12. Capture Stripe + email confirmation | `payment-svc` + template email | (notification) | — | ✅ Backend | Couvert architecture, email à designer |
| 13. Reversement J+1 visible | `seller-bookings.jsx` ou `seller-billing/payouts` | `/{locale}/seller/billing/payouts` | seller | ❌ MVP | 🔴 — gap critique : `seller-billing` pages à designer |
| 14. Facture pro téléchargeable | `seller-billing/invoices` | `/{locale}/seller/billing/invoices` | seller | ❌ MVP-V1 | 🟠 — gap, V1 (mais MVP a besoin d'au moins lister les payouts) |

**Couverture J3** : **8/14 ✅** (57 %), 6 gaps. **Critiques MVP** : page d'attente validation pro + page payouts pro + email vérification page + email "bienvenue" + email "1ère demande" + email validation.

### J4 — Marc reçoit un dispute Stripe (Pro P1, edge case)

> *Persona : Même Marc, 6 mois après inscription. 47 résa réalisées. Cliente B2B prétend non-livraison alors que tout était OK.*

| Étape | Écran Cloud Design | Path Next.js | App | Status | Note |
|-------|---------------------|---------------|------|--------|------|
| 1. Email Stripe "dispute opened" | (email externe Stripe + relais Tukio) | (notification) | — | 🟡 V1 | Tukio doit envoyer un email contextualisé en plus de Stripe |
| 2. Détail booking avec status "dispute" | `seller-bookings.jsx` (variant) ou `booking-detail.jsx` (variant) | `/{locale}/seller/bookings/{id}` | seller | ⚠️ V1 | Audit : variant `dispute_open` du booking ? |
| 3. Dashboard payouts avec transaction "Dispute en cours" | `seller-billing/payouts` | `/{locale}/seller/billing/payouts` | seller | ❌ V1 | 🟡 V1 — page dédiée |
| 4. Audit trail messagerie de la booking | dans `messages.jsx` ou booking-detail | idem | seller | ✅ Partiel | Audit trail visible via messages déjà |
| 5. Photos de livraison (uploadées avant) | Reuse `<FileUpload>` pattern | (dans messages ou booking) | seller | ⚠️ | Audit Sprint 0 |
| 6. Signature électronique destinataire (V1) | À designer | dans booking-detail (variant V1) | seller | ❌ V1 | 🟡 V1 |
| 7. Formulaire "Contester la dispute" pre-rempli | À designer | `/{locale}/seller/bookings/{id}/dispute/respond` | seller | ❌ V1 | 🟡 V1 — evidence trail Tukio auto-aggregé |
| 8. Soumission Tukio → Stripe (backend, invisible UI) | `payment-svc` | (backend) | — | ✅ Backend | Couvert architecture |
| 9. Email résultat dispute (gain ou perte) | Template | (email externe) | — | 🟡 V1 | |

**Couverture J4** : **2/9 ✅** (22 %), 7 gaps V1. **Workflow dispute pro structuré entièrement à designer V1**.

### J5 — Léa valide un nouveau pro (Admin-support, MVP)

> *Persona : Léa, 28 ans, admin-support Tukio. File `pending_admin_review` traitée chaque matin. Délai cible < 24h.*

| Étape | Écran Cloud Design | Path Next.js | App | Status | Note |
|-------|---------------------|---------------|------|--------|------|
| 1. Login admin + MFA TOTP | `mvp-auth.jsx` (admin variant?) | `auth.tukio.one/admin/login` | auth | ⚠️ | Audit : MFA enforcement design ? |
| 2. Dashboard admin (file pending) | `mvp-admin.jsx` | `admin.tukio.one/` | admin | ⚠️ | mvp-admin minimal — couvre la file ? À auditer |
| 3. Liste file `pending_admin_review` | `mvp-admin.jsx` ou nouveau `verifications` page | `admin.tukio.one/verifications` | admin | ❌ MVP | 🔴 — gap critique MVP : page liste verifications |
| 4. Détail dossier pro KYC | À designer | `admin.tukio.one/verifications/{id}` | admin | ❌ MVP | 🔴 — gap critique MVP : SIRET INSEE + KYC docs viewer + bio + photo profil |
| 5. Action "Valider" / "Rejeter avec raison" | dans verifications detail | idem | admin | ❌ MVP | 🔴 — gap critique MVP |
| 6. Note interne admin (ex: "SIRET vérifié, KYC OK") | dans verifications detail | idem | admin | ❌ MVP | 🔴 — gap critique MVP |
| 7. Audit trail action loggée + event NATS | (backend) | — | — | ✅ Backend | Couvert architecture |
| 8. Email validation envoyé pro | Template Resend | (notification) | — | 🟠 MVP | À designer template |

**Couverture J5** : **0/8 ✅** (0 % design dédié), 7 gaps **dont 4 critiques MVP 🔴**. **L'admin verification queue est THE gap critique MVP** — sans elle, pas de validation pro possible, pas de pro `verified`, pas de booking possible.

### J6 — Saga booking-payment partiellement échouée (Admin-modo, edge case ops)

> *Persona : Yann, 32 ans, admin-modo. Alerté Slack à 14h32 : "Saga booking-payment échouée pour booking 7a2e8f, > 5 min".*

| Étape | Écran Cloud Design | Path Next.js | App | Status | Note |
|-------|---------------------|---------------|------|--------|------|
| 1. Slack alerte (Grafana Alertmanager) | (externe) | — | — | ✅ Backend | Couvert architecture observability |
| 2. Login admin + MFA | comme J5 | `auth.tukio.one/admin/login` | auth | ⚠️ | |
| 3. Dashboard transactions bookings | À designer | `admin.tukio.one/transactions/bookings` | admin | ❌ V1 | 🟡 V1 — liste transactions |
| 4. Détail booking en saga échouée (timeline visible) | À designer | `admin.tukio.one/transactions/bookings/{id}` | admin | ❌ V1 | 🟡 V1 — saga state visible avec correlation IDs |
| 5. Dashboard observabilité Prometheus + Tempo | (Grafana Cloud externe, pas Tukio) | (externe) | — | ✅ Backend | Couvert architecture, dashboards Grafana |
| 6. Inbox table viewer (booking-svc) | À designer | `admin.tukio.one/transactions/sagas/{correlationId}` | admin | ❌ V1 | 🟡 V1 — outil sensible 🔴, audit obligatoire |
| 7. Action "Replay event" (RBAC `admin-modo`+) | À designer | dans saga viewer ou disputes | admin | ❌ V1 | 🟡 V1 — confirmation destructrice + audit trail |
| 8. Confirmation replay → suivi état saga | dans saga viewer | idem | admin | ❌ V1 | 🟡 V1 |
| 9. Notification interne "saga résolue" + audit log | (interne, backend) | — | — | ✅ Backend | Event `admin.action.event_replayed.v1` audit trail |
| 10. Ticket K8s mémoire (post-mortem) | (externe — outils ops, pas Tukio) | — | — | ✅ Backend | Hors scope UX |

**Couverture J6** : **0/10 ✅** (0 % UX dédié — backend OK), 5 gaps V1 admin-modo. **Pas critique MVP** (les premières sagas échouées peuvent être traitées en backend direct + Grafana avant d'avoir une UI dédiée). À prioriser **V1** pour fiabilité ops.

### V1+ Implicit Journeys (couverture)

| Journey implicite | Bundle existant | Gaps |
|-------------------|------------------|------|
| **C2 Office Manager — séminaire B2B multi-vendor V1** | Réutilise apps customer + cart-checkout | Multi-vendor cart UI à designer V1, B2B billing/SIRET fields, paiement sur facture |
| **P3 Pro saisonnier — tier Starter V1** | Réutilise apps seller + onboarding | Subscription tier choice screen V1 |
| **Pro qui passe Starter → Business V1** | À designer | `seller/subscription/change` page |
| **Client qui devient Pro (conversion compte)** | Réutilise pro-onboarding | Bouton "Devenir pro" dans dropdown avatar customer + intro flow V1 |
| **Apporteur d'affaires B2B (wedding planner partner V1)** | À designer | Dashboard partner + lien tracké + commissions |
| **Workflow litige V1 complet (médiation 48h)** | cancel-flow + admin disputes | Médiation step admin V1 |

### Gap Analysis — Priority Matrix

#### 🔴 Critiques MVP — bloquant le lancement

| Gap | Journey | Sprint 0 priority |
|-----|---------|--------------------|
| **Page liste verifications admin** (`admin.tukio.one/verifications`) | J5 | Story 0.x — Admin verification queue |
| **Détail dossier pro KYC + actions valider/rejeter** (`admin.tukio.one/verifications/{id}`) | J5 | Story 0.x — Admin KYC review |
| **Page payouts pro** (`/seller/billing/payouts`) | J3 | Story 0.x — Seller payouts visibility |
| **Page email vérification landing** (`/{locale}/auth/verify-email`) | J3 | Story 0.x — Email verification gate |

#### 🟠 MVP nice-to-have / V0.5

| Gap | Journey | Note |
|-----|---------|------|
| Page d'attente "validation pro" (banner persistant `/seller`) | J3 | Reuse `pro-dashboard.jsx` avec banner state |
| **Templates emails Resend** (FR + EN) : confirmation booking, rappel J-7, J-1, demande avis J+1, validation pro, 1ère demande pro, refund | J1, J2, J3 | À designer Sprint 0 — toutes les templates clés |
| Cart vue séparée du checkout (audit Sprint 0) | J1 | Peut être dans `checkout.jsx` step 1 |
| Audit du `<FileUpload>` pattern dans cancel-flow + KYC | J2, J3 | Audit Sprint 0 |

#### 🟡 V1

| Gap | Journey | Note |
|-----|---------|------|
| **Workflow admin dispute médiation** (`admin.tukio.one/transactions/disputes/{id}`) | J2 | V1 critical — dispute structuré 48h |
| Pages locales catégorie × ville (`/category/{slug}/{city}`) générées auto | J1 | V1 SEO mitigation |
| Workflow pro contestation dispute Stripe + evidence trail | J4 | V1 |
| Signature électronique livraison V1 | J4 | |
| `seller/billing/invoices` + `seller/billing/exports` | J3 | V1 — facturation comptable |
| Saga monitoring + replay event admin-modo | J6 | V1 — fiabilité ops |
| Dashboard transactions admin complet | J6 | V1 |
| Pages B2B Multi-vendor cart UI | C2 | V1 |
| Subscription tier choice + change pages | P3 | V1 |
| Apporteurs B2B partner dashboard | V1 implicite | V1 |

#### 🟢 V2+

| Gap | Note |
|-----|------|
| Configurateur événement (assistant assemble services) | V2 (FR126) |
| Recommandations perso clients | V2 (FR127) |
| Co-traitance pros (sub-contracting) | V2 (FR128) |
| Programme fidélité client (-5 % à la 3ᵉ résa) | V2 (FR114) |
| Tier Enterprise complet (SLA dashboard, AM, intégrations comptables Pennylane/QuickBooks) | V2 |
| Application mobile native iOS/Android | V2 (PWA V1 partiellement compense) |
| B2B SSO Keycloak SAML | V2 |
| Analytics pros avancées (benchmarks anonymisés, suggestions prix) | V2 |
| Badges "vérifié" / "pro de l'année" | V2 |

### Total gaps screens

- **🔴 Critiques MVP** : **4 écrans** (admin verification queue, admin KYC review detail, seller payouts, email verification landing) + ~7 templates emails
- **🟠 MVP nice-to-have** : ~6 (banner validation, audits, templates additionnels)
- **🟡 V1** : ~25-30 écrans (dispute médiation, sagas admin, B2B multi-vendor, subscription, partners, finance pro complet, etc.)
- **🟢 V2+** : ~15 écrans (configurateur, recommandations, mobile native, Enterprise)

**Total architecture cible** : ~80 écrans à terme. Bundle Cloud Design **a déjà couvert 31 (39 %)**, dont les **happy paths MVP customer + seller à 100 %**. C'est une excellente fondation.

### Next Steps Sprint 0 design

Pour démarrer Sprint 0 sereinement :

1. **Auditer** les 5 écrans ⚠️ (`account-settings`, `mvp-auth`, `mvp-admin`, `mobile-extra`, `service.jsx` calendar interaction)
2. **Designer les 4 critiques MVP** 🔴 (admin verification queue + detail, seller payouts, email verification landing) — 5-7 jours estimés
3. **Designer les 7 templates emails** Resend FR + EN
4. **Adapter le design system Tailwind v4** (cf. Step 6 migration plan) — 2-3 jours estimés
5. **Tests visuels Playwright** sur les 22 écrans figés (assertion contre le bundle Cloud Design)

**Critère de sortie design Sprint 0** : 22 écrans figés bundle + 4 nouveaux écrans MVP critiques + 7 templates emails + design system Tailwind v4 = couverture **100 % MVP avant l'écriture de la 1ère story dev fonctionnelle**.

## Component Strategy, UX Patterns, Responsive & Accessibility

> Cette section consolide la stratégie composants (architecture atomic/pattern/feature), les patterns d'interaction et states (loading/error/empty/success/destructive), le motion design, la stratégie responsive multi-zones et la spec accessibility RGAA AA. C'est le **rule book** des dev agents pour produire des écrans cohérents au-delà du bundle Cloud Design existant.

### Component Strategy

#### 3 niveaux de composants — où vit quoi

```
@tukio/ui                                 ← Niveau 1 : ATOMICS + PATTERNS shared cross-apps
├─ components/ (atomics)
│  └─ Button, Input, Badge, Card, Modal, Toast, Avatar, Stars,
│     Skeleton, Spinner, Placeholder, FormField, Label, Helper, etc.
└─ patterns/ (composites cross-domain)
   └─ TopBar, Footer, ConversationThread, ReviewsDisplay, PricingDisplay,
      AvailabilityCalendar, FilterSidebar, FileUpload, StepIndicator, Map,
      EmptyState, ErrorPage

apps/<app>/src/features/<feature>/components/    ← Niveau 2 : FEATURE-SPECIFIC components
│
│   Composants qui n'ont de sens que dans le contexte d'UNE feature.
│   Ex : `BookingAcceptForm` dans seller/features/bookings/components/
│        `CartLineItem` dans customer/features/cart-checkout/components/
│        `ServiceCard` dans public/features/catalog/components/  (variant pour catalog)

apps/<app>/src/shared/                            ← Niveau 3 : APP-SPECIFIC shared
└─ layouts/ (PublicLayout, CustomerLayout, SellerLayout, AdminLayout)
   utils/, providers/
```

#### Décision tree — où placer un nouveau composant

```
Nouveau composant à créer ?
│
├─ Utilisé par ≥ 2 apps (public + customer + seller + admin) ?
│  ├─ OUI → @tukio/ui/components/ (atomic) ou @tukio/ui/patterns/ (composite)
│  └─ NON ↓
│
├─ Utilisé par ≥ 2 features dans la même app ?
│  ├─ OUI → apps/<app>/src/shared/ (rare — privilégier @tukio/ui si réutilisable)
│  └─ NON ↓
│
└─ Spécifique à une feature ?
   └─ OUI → apps/<app>/src/features/<feature>/components/
```

#### Anatomie d'un composant @tukio/ui

```
packages/ui/src/components/Button/
├─ Button.tsx                          # composant React
├─ Button.spec.tsx                     # tests Vitest
├─ Button.stories.tsx                  # Storybook V1+ optionnel
├─ index.ts                            # public API : export { Button } + types
└─ types.ts                            # types ButtonVariant, ButtonSize, ButtonProps
```

Conventions :
- 1 composant = 1 dossier (pas un seul fichier)
- `index.ts` re-exporte explicitement (pas de `export *`)
- Tests co-locatés (Vitest + Testing Library)
- Stories Storybook V1+ si Storybook activé
- Types extracted dans `types.ts` si > 5 lignes
- Props interface exposée publiquement (`ButtonProps` exportée pour composition)

#### Composition rules

- ✅ **Composer au niveau supérieur** : un `<BookingAcceptForm>` (feature) compose des `<Button>` + `<Input>` + `<Modal>` (atomics) + `<StepIndicator>` (pattern)
- ❌ **Ne jamais étendre un atomic via classes Tailwind locales** : si un atomic doit être customisable, exposer une prop (`variant`, `size`) — pas de `className="bg-brand-300"` qui override
- ✅ **Variants explicits** : props `variant: 'primary' | 'secondary' | ...` avec union types stricts
- ❌ **Pas de polymorphic components** au MVP (`<Button as="a">` complexité TypeScript) — utiliser un `<LinkButton>` distinct si besoin

### UX Patterns — interaction states

#### Loading states (NFR + design brief §D.8)

**Hiérarchie d'usage** :

| Pattern | Usage | Composant @tukio/ui | Quand |
|---------|-------|---------------------|-------|
| **Skeleton screens** | Pages qui chargent (preview de la structure) | `<Skeleton>` | Initial load (LCP, listings, fiches services) |
| **Spinner** | Actions courtes | `<Spinner>` | Form submit (1-3 s), refetch, mutation |
| **Progress bar** | Actions longues à progression connue | `<ProgressBar>` | Upload fichier, export PDF, génération facture |
| **Pas de loader** | Action < 300 ms | — | Évite flicker |

**Règles** :
- **Skeleton screens** doivent **respecter la layout finale** (pas de "rectangle gris générique")
- Spinner : `<Spinner size="sm" />` inline dans button avec `aria-busy="true"`, ou centré dans `<Card>` pour fetch partiel
- Progress bar : avec label `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- **Loading message accessible** : aria-live="polite" avec texte "Chargement..." pour screen readers

#### Error states

**3 niveaux d'erreur** (cf. design brief §E.6) :

| Niveau | Pattern | Composant | Cas |
|--------|---------|-----------|-----|
| **Inline** (champ form) | Texte rouge sous le champ + icône `<AlertCircle>` | `<FormField error={...}>` | Validation Zod côté client (immediate) |
| **Toast** | Notif éphémère bottom-right (8s pour errors) | `<Toast variant="error">` | Mutation ratée (network, 4xx, 5xx) |
| **Page d'erreur** | Page custom avec ID Sentry + action récupération | `<ErrorPage>` (404, 500) | Crash, route not found, server error |

**Toujours proposer une action de récupération** :
- ✅ "Réessayer" (avec retry mutation)
- ✅ "Retour" (router.back())
- ✅ "Contacter le support" (ouvrir mailto: ou intercom)
- ❌ Jamais d'erreur muette ("Une erreur s'est produite" sans action)

**Format error envelope ADR-014** consommé par le frontend :

```tsx
const mutation = useCreateBooking();

mutation.mutate(data, {
  onError: (envelope) => {
    // envelope = { method, code, error: { tukioCode, ... }, meta }
    switch (envelope.error.tukioCode) {
      case 'BOOKING-CONFLICT-001':
        toast.error(t('booking.errors.notAvailable'));
        break;
      case 'PAYMENT-3DS-REQUIRED-002':
        // Redirect vers 3DS challenge Stripe
        break;
      default:
        toast.error(t('common.errors.generic', { code: envelope.error.tukioCode }));
        captureException(envelope); // Sentry
    }
  },
});
```

#### Empty states (cf. design brief §D.7)

**7 variants à designer** :

| Variant | Cas | Action CTA |
|---------|-----|------------|
| `<EmptyState variant="search-no-results">` | Search avec 0 result | "Effacer les filtres" |
| `<EmptyState variant="cart-empty">` | `/cart` sans item | "Découvrir les services" |
| `<EmptyState variant="customer-no-bookings">` | `/account/bookings` | "Découvrir les services" |
| `<EmptyState variant="seller-no-bookings">` | `/seller/bookings?status=pending` | "Optimiser votre fiche service" |
| `<EmptyState variant="seller-no-services">` | `/seller/services` | "Créer mon premier service" |
| `<EmptyState variant="messages-empty">` | `/account/messages` ou `/seller/messages` | "Trouver un service" |
| `<EmptyState variant="reviews-empty">` | sur fiche service / pro | (pas de CTA, juste rassurer) |

**Structure standard** : illustration ou icône grand format + titre court (`text-xl/2xl` font-display) + description rassurante (`text-base charcoal-500`) + CTA primary.

#### Success states (cf. design brief §E.7)

- ✅ Toast vert sobre (`<Toast variant="success">`) + redirection auto si pertinent
- ✅ Page de confirmation avec récap + next actions (`screens/confirmation.jsx` est l'exemple canonique)
- ❌ **Pas de confettis, émojis géants, animations célébratoires**

#### Confirmations destructrices (cf. design brief §E.5)

Pattern systématique pour : annulation résa, suppression service, suppression compte, bannissement user.

```tsx
<DestructiveConfirmModal
  title={t('booking.cancel.confirmTitle')}
  description={t('booking.cancel.confirmDescription', { refundPercent: 50, eventDate: format(booking.eventDate, 'dd/MM/yyyy') })}
  consequences={[
    t('booking.cancel.consequence.refund', { amount: '850 €' }),
    t('booking.cancel.consequence.notifyPro'),
    t('booking.cancel.consequence.irreversible'),
  ]}
  primaryActionVariant="danger"
  primaryActionLabel={t('booking.cancel.confirmButton')}
  onConfirm={() => mutation.mutate({ bookingId })}
  cancelLabel={t('common.actions.back')}
/>
```

**Règles** : re-formulation explicite + conséquences listées + bouton primary `danger` + ESC + click outside ferme (pas d'engagement par défaut).

### Motion Design

#### Animations autorisées

| Animation | Token | Usage |
|-----------|-------|-------|
| Fade in/out | 150ms ease-out | Modales, toasts, tooltips |
| Scale (modale) | 250ms ease-out (`scale: 0.95 → 1`) | Apparition modale |
| Skeleton shimmer | `tk-shimmer` keyframes | Skeleton screens |
| Typing indicator | `tk-typing` keyframes | Messagerie chat |

#### Règles motion (NFR52 + design brief §G)

- **`prefers-reduced-motion: reduce`** strictement respecté
- **Aucun flash** > 3 fois par seconde
- **Animations < 350ms** sur transitions UI
- **Pas d'animation célébratoire** au MVP
- **Interactions pointer/touch équivalentes** (pas de hover-only effect)
- **Focus ring visible** : `focus-visible:ring-2 focus-visible:ring-brand-500/[.18]`

### Responsive Strategy

#### Breakpoints (rappel design brief §F)

| Token | Range | Usage |
|-------|-------|-------|
| `xs` | 0-480 | Petits mobiles |
| `sm` | 481-640 | Mobiles standards |
| `md` | 641-1024 | Tablettes |
| `lg` | 1025-1280 | Desktop standard |
| `xl` | 1281-1536 | Large desktop |
| `2xl` | 1537+ | Très grands écrans |

#### Layout container

| Breakpoint | Max-width content |
|------------|-------------------|
| Mobile / tablet | 100% avec padding 16-24px |
| Desktop (`lg`) | 1200px |
| Wide (`xl+`) | 1400px |

❌ **Jamais de full-width 1920px+**.

#### Approche mobile-first ciblée par audience

| App | Audience | Stratégie |
|-----|----------|-----------|
| `apps/public/` | Mobile + Desktop équilibré | **Mobile-first** strict, optimisé Core Web Vitals (NFR1-8) |
| `apps/customer/` | Mobile + Desktop équilibré | Mobile-first, Stripe Elements + tunnel checkout impeccables sur les 2 |
| `apps/seller/` | **Mobile dominant** (pros sur le terrain) | Mobile-first **prioritaire**, PWA installable V1 |
| `apps/admin/` | Desktop only | **Desktop-first**, pas de version mobile MVP |

#### Touch targets (NFR53)

- **Minimum 44 × 44 px** sur toute zone tappable mobile
- Boutons par défaut `40px` height NE respectent PAS → mobile DOIT utiliser `<Button size="lg">` (48px) OU padding accru
- Liens texte cliquables : zone tappable étendue via `padding: 12px` minimum

#### Navigation patterns mobile (cf. design brief §H)

**Public + Customer + Seller** :
- Top bar simplifiée : logo + hamburger + avatar
- Drawer hamburger plein écran

**Seller mobile (V1+)** :
- **Bottom navigation** (V1) : Accueil / Demandes / Messages / Calendrier / Plus
- Push notifications urgentes (PWA V1, native V2)

**Admin** : pas de version mobile au MVP — desktop only avec sidebar gauche.

#### Multi-zones navigation (Vercel rewrites)

- Cookies session Keycloak partagés via `Domain=.tukio.one`
- Inter-app links : `<a href="/account/bookings">` (PAS `<Link>` Next.js cross-zone)
- Composant `<CrossZoneLink>` dans `@tukio/ui` qui wrappe `<a>` avec analytics + accessibility
- **Page transitions cross-zone = full reload** (acceptable car rare)

### Accessibility Spec (RGAA AA / WCAG 2.1 AA — NFR47-55)

#### Cible : RGAA niveau AA

Justification (NFR47) : obligation légale FR au-delà d'un seuil de CA + bonne pratique générale.

#### Règles non négociables (cf. design brief §G + NFR47-55)

##### Contraste

- Texte normal : ratio ≥ 4,5:1 — `cream-50` × `charcoal-700` ✅
- Texte large (≥ 18 pt ou 14 pt bold) : ≥ 3:1
- UI components / icônes : ≥ 3:1
- Vérification : Stark Figma + axe-core CI

##### Navigation clavier

- Tous les éléments interactifs accessibles au Tab
- **Focus ring visible** (jamais `outline: none` sans alternative)
- Ordre de tab logique (DOM order match visual)
- **Skip links** en haut de page
- Modale ESC ferme + focus trapped à l'intérieur

##### Screen readers

- HTML sémantique strict (`<button>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<header>`, `<footer>`)
- ARIA en complément uniquement :
  - `aria-label` sur icon buttons
  - `aria-describedby` pour helper texts
  - `aria-live="polite"` pour toasts non-critiques, `aria-live="assertive"` pour errors
  - `aria-busy` sur loading states
  - `role="status"` sur success messages
- `alt` text obligatoire — lint rule bloquante CI

##### Pas d'info uniquement par couleur

- Erreur : couleur rouge **+ icône** + label texte
- Calendrier dispo : couleur bg **+ texte/hachures** ("Complet")
- Statut booking : couleur badge **+ texte** ("En attente", "Confirmé")

##### Touch targets

- 44 × 44 px minimum mobile (NFR53)

##### Focus management

- Modale ouverte : auto-focus sur 1er input/CTA
- Modale fermée : focus retourne à l'élément déclencheur
- Page change : focus reset to `<h1>` ou skip link

#### Validation accessibility (NFR54-55)

| Validation | Outil | Quand |
|------------|-------|-------|
| **axe-core** auto | Playwright tests E2E | Sur chaque PR (parcours critiques) |
| **Lighthouse Accessibility** | Lighthouse CI | Sur chaque PR (score ≥ 90 obligatoire) |
| **Audit manuel RGAA** | Expert externe | Avant V0 release public — gate critique |
| **Tests utilisateurs** | Personnes en situation de handicap | V1+ (5-10 personnes) |

#### Accessibility checklist par composant atomic @tukio/ui

| Composant | Vérifications obligatoires |
|-----------|----------------------------|
| `<Button>` | Focus ring, aria-busy si loading, aria-disabled si disabled, label visible (pas seulement icône sauf aria-label) |
| `<Input>` | `<Label htmlFor>` + `<Helper aria-describedby>`, error `aria-invalid` + `aria-describedby` vers error msg, autocomplete attribute |
| `<Modal>` | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + `aria-describedby`, focus trap, ESC ferme |
| `<Toast>` | `role="status"` (info/success) ou `role="alert"` (error), aria-live correspondant |
| `<Stars>` | `role="img"` + `aria-label="4.7 sur 5 étoiles"` |
| `<Avatar>` | Initials only : `aria-label` avec nom complet ; image : `alt` text contextualisé |
| `<Badge>` | Si conveyant info status : `aria-label` explicite ; sinon décoratif `aria-hidden="true"` |
| `<Placeholder>` | `role="img"` + `aria-label` avec label explicite |
| `<FilterSidebar>` | `<fieldset>` + `<legend>` par groupe, `aria-expanded` + `aria-controls` |
| `<AvailabilityCalendar>` | Navigation clavier (arrow keys), `aria-label` par jour, `role="grid"` |
| `<ConversationThread>` | `aria-live="polite"` sur nouveaux messages, scroll auto avec `aria-relevant="additions"` |

#### Special states accessibility

- **Loading skeleton** : `aria-busy="true"` sur container parent, `<span class="sr-only">{t('common.loading')}</span>`
- **Empty state** : `<h2>` + description + CTA — sémantique normale
- **Error page** : `<h1>` avec code, description claire, action de récupération
- **404 SEO** : `noindex` + `<link rel="canonical" href="/">`

### Multilanguage UX (i18n FR + EN, ADR-012)

#### Sélecteur locale (à ajouter dans `<TopBar>` — gap audit Step 2)

- Top bar : dropdown ou switcher discret "FR / EN"
- Persiste cookie `tukio-locale` (`Domain=.tukio.one`) + préférence compte
- Au switch : redirect même route avec locale prefix changé (`/fr/...` → `/en/...`)
- **Pas de modal de bienvenue** "Choose your language" au 1er load

#### Detection locale (cf. NFR96, FR96)

- 1ʳᵉ visite : `Accept-Language` header → fallback `fr`
- Persistance cookie 1 an
- Compte connecté : préférence `identity-svc.userPreferences.locale`, sync avec cookie au login

#### Fallback FR pour contenu user-generated EN manquant (FR99-100)

- Backend retourne FR avec `data.fallbackUsed: true` + `data.requestedLocale: 'en'`
- UI : badge sobre `<Badge variant="info">{t('listing.availableOnlyInFrench')}</Badge>`
- Texte : "Disponible uniquement en français" / "Only available in French"
- **Pas de blocage** — fallback gracieux

#### Microcopy bilingue (à compiler, exemples)

Tous les strings UI dans `messages/fr.json` + `messages/en.json` (NFR56-57). Conventions :

- **Namespacing par feature** : `common.*`, `booking.*`, `payment.*`, etc.
- **ICU MessageFormat** pluralisation : `'{count, plural, =0 {Aucun avis} =1 {1 avis} other {# avis}}'`
- **Pas de string fragmenté** → placeholders rich text de next-intl

| Clé | FR | EN |
|-----|----|----|
| `common.loading` | Chargement... | Loading... |
| `booking.cancel.confirmTitle` | Annuler ma réservation | Cancel my booking |
| `booking.errors.notAvailable` | Cette date n'est plus disponible. Voici des alternatives. | This date is no longer available. Here are some alternatives. |
| `seller.dashboard.urgentBadge` | À traiter sous {hours}h | To handle within {hours}h |
| `auth.verifyEmail.title` | Vérifiez votre adresse email | Verify your email address |
| `cart.checkout.deferredCapture` | Vous serez débité après acceptation par le professionnel | You will be charged after acceptance by the professional |

### Cross-feature implementation rules (récap des règles d'or)

- ✅ **Toujours** consommer les composants `@tukio/ui` plutôt que de réimplémenter
- ✅ **Toujours** utiliser `<FormField>` pour les inputs (label + helper + error standardisés)
- ✅ **Toujours** ajouter `aria-label` sur icon buttons et icon-only links
- ✅ **Toujours** valider les props avec types TypeScript stricts (no `any`)
- ✅ **Toujours** tester les composants atomiques (Vitest + Testing Library), patterns critiques (Playwright)
- ❌ **Jamais** de `style={{ ... }}` inline (utiliser Tailwind ou CSS variables)
- ❌ **Jamais** de texte hardcoded (utiliser `useTranslations()` next-intl)
- ❌ **Jamais** de path URL en français (cf. NFR58)
- ❌ **Jamais** de `outline: none` sans alternative `focus-visible`
- ❌ **Jamais** de couleur seule pour véhiculer une info (toujours + icône + texte)
