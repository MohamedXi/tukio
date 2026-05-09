---
title: "Product Brief Distillate : tukio.one"
type: llm-distillate
source: "product-brief-tukio.one.md"
created: "2026-05-08"
updated: "2026-05-08"
version: "v0.3"
purpose: "Token-efficient context for downstream LLM workflows (PRD creation, story generation, design briefs, marketing collateral)"
language: "fr"
audience: "LLM agents BMad (PM, architect, dev, ux, marketer) consommant ce contexte pour produire artefacts dérivés"
---

# Distillate — tukio.one

> Pack de contexte structuré dérivé du product brief. Chaque bullet est self-contained.
> Lecture par LLM downstream : ne pas inférer en dehors de ce qui est explicitement écrit.
> Source détaillée : `product-brief-tukio.one.md` + 16 documents `docs/`.

---

## 1. Identité produit (one-liners non négociables)

- **Nom** : tukio.one ("tukio" = "événement" en swahili — opaque pour cible FR, **tagline obligatoire** dans tous les supports, 3 directions à A/B tester)
- **Catégorie** : marketplace transactionnelle B2B2C de services événementiels en France
- **One-liner intangible** (depuis design brief, ne pas reformuler) : *"Tukio est la place de marché qui rend l'organisation d'événements plus simple, plus fiable et plus belle, en connectant directement les organisateurs aux professionnels locaux."*
- **Promesse client** : *"Trouve les bons pros près de chez toi, en confiance, sans appeler 10 personnes."*
- **Promesse pro** : *"Concentre-toi sur ton métier, on s'occupe du reste : visibilité, paiement, paperasse."*
- **Vision long terme** : devenir ce que **Le Bon Marché** est au commerce — marketplace élégante, ancrée localement, premium, où la confiance est l'expérience par défaut. **NE PAS** chercher à être un Eventbrite français (ticketing public) ou un MalleàWedding moderne (vertical mariage).
- **Founder-led** : basé à Nantes, peut serrer la main aux 50 premiers pros à < 1h de Nantes. Avantage compétitif territorial structurel.

---

## 2. Acteurs & personas (vocabulaire figé)

### Côté client

- **C1 — Particulier** : 25-55 ans, CSP+, organise mariage/anniversaire/baptême/EVJF. Budget Tukio 1k-10k€. Ticket moyen 800€ TTC. Recherche 6-12 mois en amont. LTV ~1 résa (achat unique). Vouvoiement par défaut. **Cible MVP.**
- **C2 — Office manager / responsable événements** : PME 20-200p ou ETI. Séminaires/kick-offs/lancements. Budget Tukio 5k-50k€. Ticket moyen 2 500€ TTC. LTV ~5-9 résa (2-3/an × 2-3 ans). Besoin facturation B2B propre, paiement sur facture, traçabilité comptable. **Cible V1. Priorité acquisition payante** (CAC tolérable 100-300€ vs 30-40€ B2C).
- **C3 — Mairie / association / collectivité** : **V3+ uniquement.** Hors scope MVP/V1/V2 (cycle de vente B2G 3-12 mois, conformité Code commande publique, MAPA, Chorus Pro, persona DGS/élus). Signaux de réouverture : 5+ collectivités demandent spontanément après 12 mois d'opération + CA mensuel récurrent > 100 k€ + commercial B2G dédié.

### Côté pro

- **P1 — TPE / artisan événementiel local** : 1-10p, CA 50k-500k€/an, basé PdL au MVP puis Bretagne V1. Loueurs chapiteaux, traiteurs, mobilier, son/lumière, animateurs, photographes, fleuristes événementiels. Mobile-first sur le terrain. **Cible MVP, sourcing physique founder-led.** **Seuil de rétention : ≥ 2 résa/mois pour pro Business** sinon churn dans 6 mois (coût d'opportunité > revenu).
- **P2 — Pro premium / agence événementielle** : > 500k€/an, équipes 10-50p. Traiteurs haut de gamme, lieux de réception. Besoin SLA, AM, intégrations comptables (Pennylane, QuickBooks), SSO entreprise. **Cible V2 Enterprise.**
- **P3 — Pro saisonnier / freelance occasionnel** : 5-30 événements/an. Tier Starter (gratuit, commission 15 %) en canal complémentaire. **Cible V1.**

### Admin

- 1-2 modérateurs internes au MVP. Outsourcing partiel V1 (tâches simples uniquement, litiges et décisions graves toujours en interne).
- **3 rôles Keycloak granulaires V1** : `admin-super`, `admin-support`, `admin-modo`.

### États acteurs Keycloak (figés)

- **Client** (B2C/B2B) : rôle `client`, statut `actif|suspendu`
- **Pro** : rôle `pro`, statut `pending_documents → pending_admin_review → verified ↔ suspended → banned (avec hash anti-recréation)`
- **Admin** : rôle `admin-{support|modo|super}`, statut `actif|suspendu`
- **MFA TOTP obligatoire** pour admins dès MVP, optionnel pour pros V1 (objectif > 30 % adoption V1)

---

## 3. Décisions actées non négociables (Q1-Q10 + ADRs + 33 deep dives)

### Q1-Q10 (founder-validated)

- **Q1 Géographie** : Pays de la Loire prioritairement Loire-Atlantique (44) + Maine-et-Loire (49) au MVP. Bretagne V1. Grandes agglos FR V2.
- **Q2 Catégories pilotes MVP** : *tentes/chapiteaux* + *mobilier événementiel* (forte complémentarité, panier moyen élevé)
- **Q3 Acceptation** : atomique au MVP (mono-vendeur), par pro en V1 (multi-vendeur)
- **Q4 Stripe** : Express (KYC géré par Stripe, dashboard intégré, conformité PSD2 simplifiée)
- **Q5 Mobile** : responsive MVP → PWA V1 → native V2 (priorité côté pro, terrain)
- **Q6 Modération** : internalisée 1-2p au début, outsourcing partiel V1 sur tâches simples, **litiges toujours en interne**
- **Q7 Stack** : mono-repo full-stack, Next.js 15 + PostgreSQL + Keycloak + Stripe Connect + Cloudflare R2 + Resend + Upstash Redis (override v2.2 : 10 microservices NestJS hexagonaux)
- **Q8 Pricing** : libre avec garde-fous (flag à ±50 % de la médiane catégorie). Affichage prix médian sur fiche catégorie.
- **Q9 Marque** : Tukio + tagline obligatoire (3 directions A/B test à figer)
- **Q10 Statut éditeur/hébergeur** : hybride hébergeur LCEN + tiers de confiance paiement. **Pas de modération pré-publication systématique** (sinon bascule éditeur). À valider avocat numérique avant lancement.

### 11 ADRs (à copier dans `docs/adr/` du repo backend dès Sprint 0)

- **ADR-001** : Pattern Pretre strict dans tous les services (`domain/usecases/infrastructure` + `UseCaseProxy`). Pas de raccourci au prétexte que "c'est qu'un MVP". Lint `eslint-plugin-boundaries` dès Sprint 0.
- **ADR-002** : NATS JetStream via `@horizon-republic/nestjs-jetstream` (vs Kafka/RabbitMQ). Sweet spot < 10k events/sec, faible burden ops. Reviser à 100k+ events/sec ou 10+ devs.
- **ADR-003** : Database per service (`tukio_<service>`), no shared tables, no cross-service join. MVP : 10 DBs sur 1 instance Postgres physique.
- **ADR-004** : `booking-svc` (lifecycle slot) ET `order-svc` (cart/totals/factures) = 2 services distincts. Frontend doit savoir distinguer dans certains écrans.
- **ADR-005** : Meilisearch dès MVP (override spec v2.1 qui disait Postgres FTS au MVP). 2 datastores dans `catalog-svc` : Postgres source of truth + Meilisearch read-side index. Sync via consumer interne sur events `catalog.listing.published.v1`.
- **ADR-006** : Saga choréographée (pas d'orchestrator type Temporal) pour le flow booking-payment. État distribué entre booking/order/payment-svc. Réintroduire orchestrator si workflow > 8 étapes.
- **ADR-007** : Outbox pattern partout (table `outbox` PostgreSQL + relais via PG LISTEN/NOTIFY). Bibliothèque `@tukio/messaging` dès Sprint 0.
- **ADR-008** : `gateway-api` est le seul accès public. Aucun service downstream exposé directement. Communication interne HTTP (mTLS prod) ou NATS.
- **ADR-009** : Keycloak (auth, sessions, password, MFA, social login) + identity-svc (profil métier, KYC, subscription tier, préférences notifs) séparés. Sync via webhooks Keycloak. Job de réconciliation quotidien.
- **ADR-010** : TypeORM par défaut + raw SQL (`*.query.ts` dans `infrastructure/persistence/queries/`) pour read-heavy paths (catalog search). Migration Drizzle/Prisma reportée.
- **ADR-011** : Package `@tukio/contracts` dès Sprint 0 (JSON Schema par event versionné, types TS dérivés, `DomainEvent<T>`, DTOs HTTP partagés). Tout nouvel event/DTO passe par PR sur ce package.
- **ADR-012** : i18n FR + EN dès Sprint 0 (next-intl + locale-prefix URL `/{locale}/...` + schéma multilingue catalog + 1 index Meilisearch par locale). App **non internationalisée géographiquement** au MVP (France only) mais **bilingue linguistiquement** dès le départ. Cas d'usage : utilisateur résidant en France qui préfère parler anglais. Override de la décision K-05 (slugs FR) du `tukio_strategie_acquisition.md`.

### 33 décisions deep dives

- **Booking & Paiements (15 décisions D-01 à D-15)** :
  - D-01 Capture différée Stripe au MVP (autorisation à la commande, capture à l'acceptation pro)
  - D-02 Commission visible côté pro avec mise en avant du net perçu
  - D-03 Coordonnées client visibles **après** acceptation pro (anti-désintermédiation)
  - D-04 N PaymentIntents distincts pour multi-vendeurs (V1)
  - D-06 Acompte 30/70 à J-7 par défaut V1
  - D-07 Annulation : 3 templates Tukio (souple/standard/strict) au MVP + custom V1
  - D-09 Stripe Billing pour les abonnements (séparé du Connect)
  - D-10 Mandat de facturation générique signé à l'onboarding pro (art. 289 CGI)
- **Catalogue & Services (18 décisions C-01 à C-18)** :
  - C-01 2 catégories pilotes au MVP (tentes/chapiteaux + mobilier)
  - C-02 Pas de multi-catégorisation
  - C-03 Tags secondaires : liste fermée admin (~30 tags)
  - C-05/C-11 Photos minimum 3 (bloquant), max 15
  - C-06 Vidéo en V1 (YouTube/Vimeo embed)
  - C-08 Stock affiché client : non au MVP, V1 si < 20 %
  - C-12 Politique annulation : 3 templates au MVP, custom V1
  - C-13 Auto-publication si pro `verified` > 30 j et < 3 signalements
  - C-14 Modération a posteriori (cohérent statut hébergeur LCEN)

### Décisions tech acquisition (K-01 à K-11)

- **K-01** PostHog (open-source, hosted EU, RGPD-friendly, inclut session replay + A/B + funnels). Setup 1j.
- **K-02** Plausible (sans cookies, RGPD natif) + GA4 backup. Setup 0,5j.
- **K-03** Server-side tracking dès le MVP via `gateway-api` (impact modeste, fiabilité ad-block). Dev 3j.
- **K-04** Schema `acquisition_*` sur tables `users` ET `bookings` dès Sprint 0 (`acquisition_source`, `acquisition_medium`, `acquisition_campaign`, `acquisition_referral_id`, `acquisition_first_touch`, `acquisition_last_touch`). **Impossible à rétro-fitter sans perte de données.** Migration 1j.
- **K-05** Stratégie slug SEO : **OVERRIDE par ADR-012.** Locale-prefix `/{locale}/...` + slug par locale (cf. K-12 à K-15). Décision originale "slugs FR" du `tukio_strategie_acquisition.md` est dépassée.
- **K-12** Stack i18n frontend : **`next-intl`** sur Next.js 15 App Router. Tous les strings UI dans `messages/fr.json` + `messages/en.json`. **Zéro texte hardcodé en frontend.** Setup 2j + ~3j refactor au fil des écrans.
- **K-13** Schema catalog multilingue : **table `listing_translations`** (`listing_id`, `locale`, `title`, `description`, `slug`, `meta_title`, `meta_description`) + idem pour `categories`, `pro_profiles`, `blog_posts`, `help_articles`. Migration 2j. Approche scalable vers V3+ (autres langues).
- **K-14** Saisie pro contenu multilingue : MVP = FR obligatoire + EN optionnel, fallback FR pour visiteurs locale `en` si EN manquant + badge UI "Disponible uniquement en français". V1 = pré-remplissage auto via DeepL/GPT, pro édite/valide.
- **K-15** Search Meilisearch i18n : **1 index par locale** (`listings_fr`, `listings_en`). Sync via consumer NATS sur events `catalog.listing.translation.published.v1`. Setup 1j.
- **K-06** Programme parrainage clients en V1 (mois 7-9), pas MVP
- **K-07** Email marketing tool : **Brevo** (FR, RGPD-compliant, intégrations Stripe natives)
- **K-08** Première campagne Performance Max Google : mois 12+ après 30+ conversions/mois stables
- **K-09** Embauche marketer interne : V2 (volume justifie full-time)
- **K-10** Programme apporteurs B2B (commissions 5%) : V2 quand volume B2B significatif
- **K-11** Investissement RP / influence : V2 (notoriété nationale en construction)

---

## 4. Rejected ideas / anti-positionnements (NE PAS proposer en downstream)

### Anti-positionnement marque

- ❌ Pinterest mariage rose poudré → cantonne au B2C mariage, exclut B2B/événements pros
- ❌ Stripe minimaliste froid → trop austère pour produit "moments de vie"
- ❌ Airbnb aspirationnel touristique → pas la même promesse, on est pro et utilitaire
- ❌ Leboncoin brut → manque de cadre, manque de confiance
- ❌ MalleàWedding / 1001Listes (style romantique) → vieillit mal, exclut cible pro

### Anti-monétisations

- ❌ Vente de leads à des prestataires non-actifs sur la plateforme
- ❌ Scraping de fiches prestataires sans consentement
- ❌ Pay-to-rank pur (boosts oui, mais transparents et limités, badge visible)
- ❌ Frais cachés découverts au checkout (cf. tendance FTC junk-fee 2025)
- ❌ Engagement sur abonnements (résiliation libre fin de période)

### Anti-patterns visuels

- ❌ Boutons primaires roses bonbon
- ❌ Emojis dans les CTAs
- ❌ Fonds blancs purs (`#FFF`) ou noir pur (`#000`) — registre chaud uniquement
- ❌ Photos d'événements sur-saturées Instagram
- ❌ Typographies fantaisistes pour les prix

### Anti-features (exclus volontairement, par version)

- **MVP exclus** : comptes B2B, devis personnalisés, panier multi-vendeurs, échéanciers/acomptes, subscription tiers (tout le monde sur même plan), avis multi-critères, app mobile, API publique, internationalisation, parrainage/apporteurs
- **V1 exclus** : SAML SSO Enterprise (V2), config événementiel complet (V2), co-traitance pros (V2), Performance Max ads (V2)
- **Toutes versions exclus** : ticketing public type Eventbrite, vente de produits hors-événement, internationalisation hors France au MVP/V1 (V3+)

### Anti-tech (rejected technical paths)

- ❌ Postgres FTS pour la recherche (Meilisearch dès MVP, ADR-005)
- ❌ Booking et Order = 1 seul service (gardés séparés, ADR-004)
- ❌ Cross-service joins SQL ou tables partagées (ADR-003)
- ❌ HTTP-to-HTTP entre services downstream (sauf exception booking → catalog pour vérif dispo temps réel). Tout le reste passe par NATS.
- ❌ `Transport.NATS` natif NestJS (utiliser `@horizon-republic/nestjs-jetstream` car native ne gère pas JetStream)
- ❌ Orchestrator type Temporal pour la saga booking-payment (choréographée suffit pour 4-5 étapes, ADR-006)
- ❌ "Buyer" en code (utiliser `customer`). "Seller" reste seulement dans URLs (`/seller/*`).
- ❌ Drizzle ou Prisma au MVP (TypeORM par défaut, ADR-010 — migrer si pain réel)
- ❌ Schema Registry (Kafka pattern). Gérer via JSON Schema dans `@tukio/contracts`.
- ❌ **Texte hardcodé dans le frontend** (ADR-012). Pas même un `"Loading..."` placeholder. Tout passe par `next-intl` et les fichiers `messages/{fr,en}.json`. PR rejetée si elle introduit du texte UI directement dans un composant.
- ❌ **Paths URL en français** (`/categorie/...`, `/produits/...`). Tous les paths sont en EN (cf. IA doc §C : `/category/...`, `/service/...`, `/pro/...`, `/seller/...`, `/account/...`, `/cart/...`).
- ❌ Slugs purement FR sans locale-prefix (override K-05 par ADR-012). Désormais : `/fr/service/{slug-fr}` ET `/en/service/{slug-en}` distincts.
- ❌ Stockage du contenu user-generated dans une seule colonne `title` / `description` de la table `listings`. Utiliser table de traductions `listing_translations` (K-13).
- ❌ Index Meilisearch unique multi-langue. **1 index par locale** (`listings_fr`, `listings_en`) pour tokenization correcte (K-15).

### Pistes futures rejetées de la roadmap MVP/V1/V2

(Documentées dans `tukio_opportunites_futures.md`. Estimations de réouverture conditionnées à signaux explicites.)
- B2G/Collectivités → V3+
- Expansion nationale (hors PdL/Bretagne/4 grandes agglos V2) → V3
- Expansion européenne (Belgique → Suisse → Maroc) → V4
- Marketplace inter-pros (B2B2B) → V2-V3 conditionné user research
- Intégrations comptables avancées (Pennylane, QuickBooks API directe) → V2 Enterprise
- App mobile native → V2-V3 quand 500+ pros actifs
- Verticales spécialisées (Tukio Mariage, Tukio Séminaires) → V3 si une verticale > 50 % du GMV
- Marketplace de talents (DJ, photographes en propre, freelances) → V3+
- Outils SaaS pros (CRM, planning, devis, factures) → V4-V5

---

## 5. Scope par version (compact, exhaustif)

### MVP (v0.1, ~3-4 mois) — "Prouver la transaction"

- **Hypothèse** : pros prêts à payer commission pour leads qui se convertissent
- **Géo** : Loire-Atlantique (44) + Maine-et-Loire (49)
- **Comptes** : inscription client B2C particulier, inscription pro avec validation manuelle, KYC light (SIRET + RIB + pièce d'identité), MFA admin obligatoire, vérification email obligatoire avant transaction
- **Catalogue** : 2 catégories pilotes, fiche service basique (3-15 photos, description, tarif unité/forfait, zone livraison, délai), recherche catégorie+ville+date Meilisearch, taxonomie 3 niveaux figée admin, ranking transparent, affichage prix médian fiche catégorie
- **Booking** : réservation directe (pas de devis), panier mono-vendeur, calendrier dispo (Redis lock + DB exclusion + optimistic locking 3 layers), 3 templates politique annulation
- **Paiements** : Stripe Connect Express, capture différée (autorisation → capture à acceptation pro), commission fixe **10 %**, reversement automatique J+1, refund manuel admin, mandat facturation art. 289 CGI
- **Messagerie** : chat client↔pro lié à réservation (pas de chat libre), notifications email Resend basiques
- **Avis** : note 1-5 + commentaire, demande automatique J+1, modération a posteriori
- **Admin** : validation pros, modération signalements basique, vue transactions/litiges
- **Légal** : CGU/CGV/PC, RGPD basique, mentions légales — **versionnés FR + EN dès le MVP** (FR fait foi juridiquement, EN traduction d'information)
- **Acquisition tech (K-01-K-05)** : pages locales générées, schema.org, sitemap par locale (hreflang), Plausible + PostHog, tracking server-side, schema `acquisition_*` en DB
- **i18n FR + EN dès Sprint 0 (ADR-012, K-12-K-15)** : `next-intl` (zéro hardcodé en frontend), locale-prefix URLs `/{locale}/...`, tables `listing_translations` + `category_translations` + `pro_profile_translations`, 1 index Meilisearch par locale, templates email Resend FR + EN, saisie pro FR obligatoire + EN optionnel (fallback FR)
- **Critères sortie** : 50 pros actifs (≥1 résa chacun), 100 résa payées sans litige bloquant, NPS client > 40, CAC pro mesuré soutenable, ~6 000 visiteurs uniques mensuels en fin de période, ~80 résa/mois fin de période

### V1 (v1.0, +3 mois) — "Marketplace complète & monétisable"

- **Géo** : PdL complet (44/49/72/85/53) + Bretagne (35/22/29/56)
- **Ajouts comptes** : B2B entreprises clientes, profil pro enrichi (portfolio, équipe, certifs), KYC complet Stripe Identity, login social Google/Apple, MFA optionnel pros, conversion compte client→pro (ajout rôle Keycloak)
- **Ajouts catalogue** : toutes catégories cibles, tarification flexible (unité/forfait/devis), gestion dispos avancée (calendrier, blocages, **inventory pool partagé** entre fiches d'un même pro), vidéos
- **Ajouts booking** : panier multi-vendeurs (N PaymentIntents groupés par Order), demande devis personnalisé, réservation conditionnelle option 48h
- **Ajouts paiements** : **3 tiers d'abonnement** (Starter 0€ 15% / Business 29€/mois 10% / Enterprise sur devis 5%+frais fixes), acomptes 30/70 modulables, échéanciers personnalisables (Stripe SetupIntent + cron), factures PDF auto, gestion TVA 3 cas (non assujetti / B2C / B2B intra-UE)
- **Ajouts messagerie** : chat libre avant booking, pièces jointes (scan antivirus), recherche historique, anti-désintermédiation regex (config dans `@tukio/contracts`)
- **Ajouts avis** : multi-critères (qualité/ponctualité/com/prix), réponse pro Business+, note réciproque pro→client (visible aux autres pros), pondération récence (avis < 6 mois pèsent 2× plus)
- **Ajouts admin & litiges** : workflow ouverture → médiation 48h → résolution → clôture (réouverture 15j possible), dashboard modération, rôles granulaires Keycloak (`admin-super/support/modo`), remboursement partiel admin, sanctions graduelles (avertissement → suspension publication 7j → suspension compte 30j → bannissement avec hash anti-recréation)
- **Ajouts pro dashboard** : stats revenus/conversion/occupation/temps réponse, export comptable CSV/PDF
- **Ajouts acquisition** : programme parrainage clients (table `referral_codes`, crédits 30€ symétriques sur résa > 200€), apporteurs B2B (rôle "partner" + dashboard dédié, commission 5%), email marketing Brevo, A/B testing PostHog/GrowthBook, heatmaps + session replay, page blog complète
- **Critères sortie** : 1er mois où (commissions + abonnements) > coûts variables, ≥ 200 abonnés Business (MRR ≥ 5 800€), conversion Starter→Business > 15% à 6 mois, < 5% résa en litige, churn mensuel < 5%, ~30 000 visiteurs/mois, ~400 résa/mois

### V2 (v2.0, +3 mois) — "Croissance & rétention"

- **Géo** : grandes agglos FR (Paris, Lyon, Bordeaux, Marseille)
- **Ajouts** : configurateur événement (assistant assemble plusieurs services), recommandations perso clients (historique), co-traitance entre pros (splits gérés), programme fidélité client (-5% à la 3ᵉ résa), tier Enterprise complet (SLA 4h, AM, intégrations Pennylane/QuickBooks), B2B SSO via Keycloak SAML federation, analytics pros avancées (benchmarks anonymisés, suggestions prix), badges "vérifié"/"pro de l'année", SEO programmatique avancé, app mobile native (iOS/Android, **priorité côté pro**), 1ʳᵉ campagne Performance Max Google
- **Critères sortie** : taux rebooking client > 25%, panier moyen multi-vendeurs +30% vs V1, ≥ 20 comptes Enterprise actifs, ARR > 500 k€, ~100 000 visiteurs/mois, ~1 500 résa/mois

### V3+ (long terme, ouvert)

- Internationalisation (Belgique → Suisse → Maroc selon réseau)
- API publique pour intégrations tierces
- IA matching client↔pro (configurateur intelligent)
- White-label pour grandes marques événementielles
- Marketplace de talents (intermittents, animateurs, DJ, photographes)
- Outils SaaS pros (CRM/planning/devis/factures)
- B2G / collectivités territoriales
- Verticales spécialisées (Tukio Mariage, Tukio Séminaires)

---

## 6. Modèle économique (compact)

### Commissions

- **MVP** : 10 % fixe sur chaque transaction, via Stripe `application_fee_amount`. Pas d'abonnement, pas de frais d'inscription, pas de frais cachés.
- **V1+** : tiers d'abonnement Stripe Billing (séparé du Connect)
  - **Starter** : 0€/mois, commission 15%, 5 services max, 5 photos/service, pas de réponse aux avis, pas de stats avancées, SLA 72h
  - **Business** : 29€/mois, commission 10%, services illimités, photos illimitées, réponse aux avis, stats avancées, 1 boost/mois, multi-utilisateurs (3 max), SLA 24h, intégration CSV. **Période d'essai 14j à l'inscription.**
  - **Enterprise** : sur devis, commission 5% + frais fixes, multi-utilisateurs illimité, AM, SLA 4h, API directe comptable, SSO SAML (V2)

### Règles métier abonnement (immutables)

- Aucun engagement (résiliation libre fin de période)
- Échec paiement : 3 tentatives sur 7 jours → bascule auto Starter
- **Tier Tukio dérivé de l'état Stripe Subscription, jamais l'inverse** (sécurité : pas de "free Enterprise" exploit)
- Webhooks Stripe → seul `payment-svc` est endpoint, transforme en NATS events `subscription.created/updated/deleted` pour `identity-svc`

### Économie unitaire (hypothèses, à valider)

- Panier moyen B2C : ~800€ TTC
- Panier moyen B2B : ~2 500€ TTC
- Mix B2C/B2B au MVP : 70/30
- Take rate pondérée : ~10% (mix Starter 15% + Business 10%)
- Marge brute B2C : ~80€ par résa (TR × ticket)
- Marge brute B2B : ~250€ par résa
- Frais Stripe : ~1,4% + 0,25€ (+0,5% cross-border si applicable)
- LTV B2C : ~1 résa (achat unique)
- LTV B2B : ~5-9 résa (2-3/an × 2-3 ans)
- **CAC max acceptable B2C** : 30-40€ (LTV/CAC = 2-2,5×)
- **CAC max acceptable B2B** : 100-300€
- Break-even pro : 3-5 transactions

### Leviers complémentaires V2+

- Boosts payants (déjà en V1 inclus dans Business)
- Featured listings payants (V2)
- Intégrations comptables premium (V2 Enterprise)
- Assurance annulation (V2+, à valider)
- BNPL ticket (V3+, à explorer)

---

## 7. Architecture technique (compact)

### Stack figé

- **Frontend** : Next.js 15 App Router (SSR pour SEO)
- **Backend** : NestJS 11 (Fastify adapter), 10 microservices hexagonaux pattern Pretre
- **API Gateway** : NestJS gateway-api (BFF, JWT validation Keycloak RS256 via JWKS cache 10 min, rate limiting, fan-out)
- **DB** : PostgreSQL 16, **1 database par service** (`tukio_<service>`), MVP 10 DBs sur 1 instance physique
- **ORM** : TypeORM par défaut + raw SQL `*.query.ts` pour read-heavy paths
- **Auth/IdP** : Keycloak 25 (Phasetwo managé au MVP)
- **Messaging** : NATS JetStream 2.10+ via `@horizon-republic/nestjs-jetstream` (replicas R3 prod, DLQ stream dédié)
- **Paiements** : Stripe Connect Express + Stripe Billing (séparés)
- **Recherche** : Meilisearch dès MVP (managé Cloud ~30€/mois ou Docker self-hosted)
- **Médias** : Cloudflare R2 + Cloudflare Images (transformations)
- **Email transactionnel** : Resend (templates FR + EN dès MVP)
- **Email marketing** (V1+) : Brevo
- **i18n frontend** : `next-intl` (Next.js 15 App Router), messages JSON par locale (`messages/fr.json`, `messages/en.json`), zéro texte hardcodé en code frontend, locale-prefix URL `/{locale}/...`, hreflang systématique, fallback locale `fr`
- **Cache & locks & WebSocket pub/sub** : Upstash Redis
- **Observabilité** : OpenTelemetry + Prometheus + Tempo
- **Product analytics** : PostHog hosted EU (gratuit < 1M events/mois)
- **Web analytics** : Plausible (~10€/mois) + GA4 backup
- **Hébergement** : Vercel (frontend) + Kubernetes (backend, 1 cluster/namespace au MVP)

### 10 microservices (noms figés, ADR requis pour modifier)

```
gateway-api     identity-svc    catalog-svc     booking-svc     order-svc
payment-svc     messaging-svc   review-svc      notification-svc media-svc
```

### Mapping domaines fonctionnels ↔ services

- **2.1 Comptes** → `identity-svc` + Keycloak (externe)
- **2.2 Catalogue** → `catalog-svc` + `media-svc`
- **2.3 Booking & cart** → `booking-svc` (lifecycle slot) + `order-svc` (cart payable, totaux, factures)
- **2.4 Paiements** → `payment-svc` + `order-svc` (factures via mandat)
- **2.5 Abonnements pros** → `payment-svc` (Stripe Billing) + `identity-svc` (tier sync via webhooks)
- **2.6 Messagerie** → `messaging-svc` (WebSocket via Redis pub/sub)
- **2.7 Avis** → `review-svc`
- **2.8 Modération & admin** → distribué (tous les services) + `gateway-api` (RBAC). **Pas de service "admin" dédié** — endpoints `/admin/*` distribués avec rôles `admin-*`. Audit trail centralisé via NATS event `admin.action.*` consommé par `notification-svc` et stocké table immutable côté `identity-svc`.
- **(transverse) Notifications** → `notification-svc` (consume tous events, génère emails Resend / in-app / SMS V1, templates centralisés)
- **(transverse) API publique / Auth** → `gateway-api`

### Communication inter-services (2 canaux uniquement)

1. **Synchrone HTTP/REST via gateway uniquement** (frontend appelle gateway, fan-out vers downstream avec circuit breaker timeout 3s). **Aucun appel HTTP-to-HTTP entre services downstream sauf 1 exception** : `booking-svc` → `catalog-svc` pour vérif dispo temps réel à création booking.
2. **Asynchrone NATS JetStream + transactional outbox** (PG LISTEN/NOTIFY, pas polling) pour tous les events de domaine.

**Patterns clés** :
- Saga choréographée (pas d'orchestrator) pour flow booking-payment (ADR-006). État distribué entre booking/order/payment-svc, reconstruction via correlation IDs.
- Transactional outbox dans chaque service producteur (ADR-007), bibliothèque commune `@tukio/messaging`
- Inbox table dans chaque service consommateur (idempotence)
- Event versioning via suffixe `v1`/`v2` avec coexistence pendant migration
- Convention events : `<service>.<aggregate>.<event>.v<n>` lowercase, ~50 events catalogués dans `tukio_event_catalog.md` (ground truth de `@tukio/contracts`)

### Architecture interne services (pattern Pretre)

```
service-svc/src/
├─ domain/        # pure TS, zero NestJS imports (model, ports + Symbol tokens, service stateless, exception)
├─ usecases/      # 1 classe par use case, méthode execute()
└─ infrastructure/ (persistence TypeORM, messaging NATS publisher/consumers/outbox relay, http controllers/DTOs/guards, logger/config/exception, usecases-proxy DynamicModule)
```

### Stratégie déploiement MVP

- **Codebase split day 1** (10 codebases distinctes) → **3 unités déploiement au MVP** :
  - **core-api** : gateway-api + identity-svc + catalog-svc + booking-svc + order-svc + payment-svc (tous synchrones)
  - **workers** : messaging-svc + review-svc + notification-svc + media-svc (event-driven, latence-tolérants)
  - **nats** : NATS JetStream cluster R3
- + Postgres 1 instance, Redis 1 Upstash
- **Quand splitter** :
  - `payment-svc` en deployment dédié dès la production (sécurité PCI-DSS-adjacent)
  - `notification-svc` quand > 10k emails/jour
  - `media-svc` quand > 1000 uploads/jour
  - `messaging-svc` quand WebSocket users concurrents > 5000
  - `catalog-svc` si search devient bottleneck (mémoire Meilisearch)

### Authentification flux requête

1. Client → gateway-api avec Bearer JWT (Keycloak RS256)
2. Gateway vérifie via JWKS (cache 10 min)
3. Gateway forward downstream + header signé `x-tukio-actor`
4. Service downstream re-vérifie JWT (defence in depth) + résout l'actor

### Mapping identités cross-systèmes

```
Keycloak User (sub UUID, source of truth auth)
   ↕ webhooks
identity-svc Profile (source of truth métier)
   ├── userId (= Keycloak sub)
   ├── role (customer | pro | admin)
   ├── kycStatus, kycVerifiedAt
   ├── subscriptionTier (starter | business | enterprise)
   ├── stripeCustomerId
   └── stripeConnectAccountId (pros uniquement)
```

Autres services stockent uniquement `userId` Keycloak, résolvent détails via gateway BFF ou cache local mis à jour par events `identity.*.v1`.

### KYC à 2 niveaux (à ne pas confondre)

- **KYC identité** : Keycloak (compte vérifié) + Tukio (docs admin) — pour tous les pros, à l'inscription
- **KYC financier** : Stripe Identity (V1) ou docs manuels (MVP) — pour pros recevant des paiements, avant 1ʳᵉ résa

### Sprint 0 backbone (à livrer avant Sprint 1)

- Lectures équipe : ce brief + spec v2.2 + product-tech-alignment + booking-svc deepdive + strategie-acquisition
- Initialiser `docs/adr/` avec les 11 ADRs
- Setup `@tukio/contracts` (vide, prêt pour Sprint 1)
- Setup `@tukio/messaging` (wrapper NATS JetStream + outbox helpers)
- Setup `@tukio/auth` (`KeycloakJwtGuard` + `Roles` decorator + types `Actor`)
- Setup `@tukio/testing` (testcontainers helpers)
- Setup PostHog (1j) + Plausible (0,5j)
- Server-side tracking via gateway-api (3j)
- Migration schema `acquisition_*` sur `users` + `bookings` (1j) — **impossible à rétro-fitter sans perte de données**
- Locale-prefix URLs `/fr/...` + `/en/...` (cf. ADR-012, **override** K-05 sur slugs FR)
- Meta tags dynamiques par locale + sitemap XML segmenté par locale (hreflang) + Schema.org JSON-LD côté Next.js
- **i18n FR + EN dès Sprint 0 (ADR-012)** : setup `next-intl` (2j), externaliser tous les strings UI dans `messages/fr.json` + `messages/en.json`, migration tables `listing_translations` + `category_translations` + `pro_profile_translations` (2j), 1 index Meilisearch par locale (1j), templates email Resend FR + EN, pages légales versionnées FR + EN, saisie pro FR obligatoire + EN optionnel
- Docker Compose local complet (services infra)
- CI pipeline pour 1 service exemple (`catalog-svc`)
- Lint rules `eslint-plugin-boundaries`
- ADR template prêt pour les futures décisions

### Documents tech à produire ensuite

- **`tukio_payment_svc_deepdive.md`** (~2000 lignes estimées) avant Sprint 4 — équivalent au booking-svc deepdive : saga Stripe complète, refunds, payouts, disputes, subscriptions Billing
- **Mockups Figma** à partir du design brief + UX flows, en parallèle du Sprint 0

---

## 8. Stratégie acquisition (compact)

### Risque opérationnel #1

- **Acquisition demande côté client = risque #1 opérationnel.** Plus immédiat que conformité TVA (R1) ou LCEN (R2).
- Métrique seuil : pro Business doit faire **≥ 2 résa/mois** sinon churn dans 6 mois
- 50 pros au MVP → besoin **6 000 visiteurs uniques mensuels** (3 demandes/mois × 50 / taux conversion 2,5%)

### 3 leviers à articuler

- **SEO + contenu** : CAC bas long terme, ROI 12+ mois, démarrage Sprint 0 obligatoire
- **Payant Google + Meta Ads** : ROI rapide, CAC monte avec concurrence
- **Bouche-à-oreille / partenariats** : CAC quasi-zéro, volume limité au début mais essentiel MVP

### Mix budgétaire par phase (€/mois)

- **MVP (mois 1-6)** : ~3 200€/mois → bouche-à-oreille/partenariats physiques 500€ (30% temps), SEO foundation 1 000€ (40% temps), Google Ads test 1 000€ (15%), Meta Ads test 500€ (10%), outillage 200€ (5%). Objectif 6 000 visiteurs/mois fin de période, 80 résa/mois.
- **V1 (mois 7-18)** : ~11 000€/mois → SEO contenu 1 500€ (4 articles/mois), Google Ads 4 000€, Meta Ads 2 500€, parrainage clients 800€ (crédits émis), apporteurs B2B 1 200€, salons/events 600€, outillage 400€. Objectif 30 000 visiteurs/mois, 400 résa/mois.
- **V2 (mois 19-36)** : ~33 000€/mois → SEO interne 4 000€, Google Ads 12 000€, Meta Ads 7 000€, fidélité 3 000€, partenariats 5 000€, RP/influence 2 000€. Objectif 100 000 visiteurs/mois, 1 500 résa/mois.

### SEO foundations (Sprint 0)

- **Cible #1** : requêtes transactionnelles locales ("location chapiteau nantes", "marquee rental nantes", "traiteur séminaire angers") — volume 100-1000/mois/requête, conversion 5-10%
- **Pages cibles** (paths EN, locale-prefix `/fr/` ou `/en/` — ADR-012) : `/{locale}/`, `/{locale}/search`, `/{locale}/category/{slug}` puis `/{locale}/category/{slug}/{city}` (générées auto si > 3 pros, sinon noindex), `/{locale}/service/{slug}`, `/{locale}/pro/{slug}`, `/{locale}/blog/{slug}`
- **Tech à câbler** : locale-prefix URL (override K-05), meta tags dynamiques server-side par locale (`<Metadata>` avec `alternates.languages`), sitemap XML segmenté par locale + hreflang, Schema.org JSON-LD (`Service`, `LocalBusiness`, `BreadcrumbList`, `AggregateRating`), Core Web Vitals (LCP < 2,5s, INP < 200ms, CLS < 0,1)
- **Volume éditorial** : 2 articles/mois MVP, 4/mois V1, 100+ articles indexés à fin V1. Pas de contenu IA pur (Helpful Content Updates Google).
- **Backlinks prioritaires** : Ouest-France, Presse Océan, Wik, Le Journal des Entreprises PdL, Pages Jaunes, Google Business Profile (critique SEO local)

### Acquisition payante priorités

- **Google Ads (priorité 1)** : Search ads sur requêtes transactionnelles, structurées par catégorie + zone géo. Bid strategy : Maximize conversions au démarrage, tCPA après 30+ conversions. Performance Max à tester en V1+.
- **Meta Ads (priorité 2)** : 3 audiences — mariés en préparation (6-18 mois), B2B Office Manager/Event Manager, retargeting visiteurs site
- **Pas au MVP** : LinkedIn Ads (cher), TikTok Ads (audience pas alignée), affiliés (pas de masse critique)
- **Priorité B2B** : CAC tolérable plus élevé (100-300€) → investir payant en priorité B2B au MVP

### Bouche-à-oreille & partenariats

- **Programme parrainage clients (V1)** : symétrique 30€/30€ sur résa B > 200€, crédit (pas cash) sur prochaine résa. Coût 60€/paire. Sur résa 800€ → marge brute 80€ → net 20€. Tables `referral_codes` (code, owner, expires_at) + `referral_attributions` (referrer, referred, code, status). 3-4j dev.
- **Apporteurs d'affaires B2B (V1)** : wedding planners, agences, lieux. 5% commission. Rôle "partner" + dashboard dédié.
- **Activités physiques MVP** : Salon Mariage Nantes (annuel, stand 2-3k€ amorti sur 50 résa/an), Salon Mariage Angers, Forum événementiel CCI Nantes-St-Nazaire, networking inter-pros locaux
- **Partenariats catalogue MVP** : châteaux LA (Bretesche, Sébinière), domaines viticoles avec espace réception, salles municipales. Le lieu liste fiches Tukio sur sa page "prestataires recommandés". Lien tracké, commission 5%.

### Tracking infrastructure (à câbler dès Sprint 0)

- **Schema additionnel** sur `users` ET `bookings` : `acquisition_source` (organic|google_ads|meta_ads|referral|direct|partner), `acquisition_medium`, `acquisition_campaign`, `acquisition_referral_id`, `acquisition_first_touch`, `acquisition_last_touch`
- **Events serveur** via gateway-api : `page_view`, `search_performed`, `service_viewed`, `pro_viewed`, `booking_request_started`, `booking_request_submitted`, `booking_confirmed`
- **UTM params systématiques** sur toutes les campagnes
- **Attribution** : multi-touch, last non-direct click au MVP, data-driven en V2

### Outillage marketing (~150€/mois total)

| Outil | Usage | Coût |
|-------|-------|------|
| Plausible | Web analytics RGPD | ~10€/mois |
| PostHog | Product analytics, funnels, A/B, session replay | Gratuit < 1M events/mois |
| Google Search Console | SEO Google | Gratuit |
| Bing Webmaster Tools | SEO Bing | Gratuit |
| Ahrefs Lite ou Mangools | SEO research, backlinks | 30-100€/mois |
| Looker Studio | Dashboards consolidés | Gratuit |

### Cadence dashboards

- **Quotidien** : top of funnel + ventes + ratio offre/demande
- **Hebdomadaire** : full funnel + acquisition par canal + concentration GMV
- **Mensuel** : revue stratégique + arbitrages budgétaires marketing

---

## 9. Conformité & légal (compact)

- **Statut juridique** : hybride hébergeur LCEN + tiers de confiance paiement. **PAS de modération pré-publication systématique** (sinon bascule éditeur). À valider avocat numérique avant lancement.
- **TVA marketplace** : mandat de facturation art. 289 CGI signé à l'onboarding pro. Tukio émet facture au nom du pro. 3 cas TVA (non assujetti / B2C / B2B intra-UE). ⚠ **Audit expert-comptable spécialisé marketplace OBLIGATOIRE avant V1** (R1, 500-1500€).
- **RGPD** : Plausible (sans cookies) + PostHog hosted EU + Brevo FR = stack RGPD-compliant. Session replay PostHog uniquement avec consentement explicite. DPO désigné. Soft-delete : conservation données comptables 10 ans, anonymisation données perso au-delà délai utile (R10). Droit accès/rectification/effacement/portabilité workflow admin V1.
- **Données pros** : chiffrement at-rest pièces d'identité. KYC financier Stripe Identity (V1) ou docs manuels (MVP).
- **Bannissement** : conservation hash IP/email/téléphone pour anti-recréation (légal sous 6 ans, à valider avocat)
- **Audit trail immuable** des actions admin (table immutable `identity-svc`, alimentée par events NATS `admin.action.*`)
- **Tech** : HTTPS/TLS partout, mTLS inter-services en prod, secrets management (pas de secrets en clair), logs sans données perso (PII redaction)
- **CGU/CGV/PC/mentions légales** dès MVP

---

## 10. Conventions nommage (figées, ADR requis pour modifier)

### Vocabulaire produit / vocabulaire code

| Concept | UI/produit/spec FR | Backend code/DB/API/events EN |
|---------|--------------------|--------------------------------|
| Pro qui vend | **Pro** | **provider** |
| Client qui achète | **Client** | **customer** |
| Admin | **Admin** | **admin** |
| Annonce | **Service**, **fiche service** | **listing** |
| Réservation | **Réservation** | **booking** |
| Commande payable | **Commande** | **order** |
| Avis | **Avis** | **review** |

**Règle d'or** : visible utilisateur = FR ; code/DB/API/events/logs = EN. Mapping UI↔code en couche présentation (DTOs/presenters). **"Buyer" interdit en code.** "Seller" reste seulement dans URLs (`/seller/*`).

### URLs

> Référence : `tukio_information_architecture.md` §C, étendue par ADR-012 (i18n).

- **Tous les paths en EN** : `/seller/*`, `/account/*`, `/cart/*`, `/category/{slug}`, `/service/{slug}`, `/pro/{slug}`, `/blog/{slug}`. **Aucun path en FR jamais.**
- **kebab-case** : `/sales-terms`, pas `/salesterms` ni `/sales_terms`
- **Locale-prefix systématique** : `/{locale}/...` avec `locale ∈ {fr, en}` (ADR-012). Ex : `/fr/category/location-tentes-chapiteaux`, `/en/category/marquee-rental`
- **Slug par locale** : 2 slugs distincts par entité (FR + EN), stockés dans `<entity>_translations`
- **Hreflang** systématique pour signaler les versions linguistiques
- **Détection locale** : `Accept-Language` à la 1ʳᵉ visite, fallback `fr`. Choix utilisateur persistant (cookie + préférence compte si connecté).
- **Reserved slugs** (anti-collision routes) : `search`, `category`, `service`, `pro`, `account`, `seller`, `cart`, `help`, `blog`, `pricing`, `sell`, `about`, `contact`, `terms`, `sales-terms`, `privacy`, `cookies`, `legal`, `api`, `auth`, `admin`, `static`, `www`, `fr`, `en`. Stockés en table `reserved_slugs`.
- **Stable URLs** : un slug ne change pas après publication (modif → conservation ancien slug avec redirect 301)
- **Sous-domaines** : `tukio.one` (apex app), `auth.tukio.one` (Keycloak), `admin.tukio.one` (console admin), `static.tukio.one` ou CDN (assets), `api.tukio.one` (V3+ API publique)
- **Category technical code** : chaque catégorie a un `code` EN (ex : `tents-marquees`) utilisé en interne pour filtres/API, séparé du `slug` localisé utilisé en URL

### i18n (ADR-012)

- **Stack** : `next-intl` sur Next.js 15 App Router
- **Messages** : `messages/fr.json` + `messages/en.json` — **aucun texte UI hardcodé** (PR rejetée si introduction de string en clair dans un composant)
- **Convention de clés** : namespacing par feature (`booking.confirmation.title`, `seller.onboarding.kyc.cta`)
- **Pluralisation/formatage** : ICU MessageFormat (intégré à `next-intl`), `Intl.DateTimeFormat`, `Intl.NumberFormat`
- **Schéma DB multilingue** : pour chaque entité user-facing → table `<entity>_translations(<entity>_id, locale, ...localized_fields...)`. Entités concernées : listings, categories, pro_profiles, blog_posts, help_articles
- **Saisie pro contenu** : MVP = FR obligatoire + EN optionnel + fallback FR + badge UI "Disponible uniquement en français" en mode EN si traduction manquante. V1 = pré-remplissage auto via DeepL/GPT, pro édite/valide.
- **Search Meilisearch** : 1 index par locale (`listings_fr`, `listings_en`), sync via consumer NATS sur events `catalog.listing.translation.published.v1`
- **Emails Resend** : templates en double FR + EN dès le MVP, locale du destinataire pioché sur le profil utilisateur
- **Pages légales** : versionnées FR + EN. Mention "La version française fait foi juridiquement" sur la version EN.
- **Géographie** : pas internationalisée géographiquement au MVP (France uniquement) mais bilingue linguistiquement dès Sprint 0. Cas d'usage : utilisateur résidant en France qui préfère parler anglais.

### Events NATS

- Format : `<service>.<aggregate>.<event>.v<n>` lowercase, dashes pour tokens composés
- Exemples : `catalog.listing.published.v1`, `booking.requested.v1`, `payment.intent.captured.v1`, `subscription.created.v1`, `admin.action.user_banned.v1`

### Marque Tukio

- Tagline obligatoire dans tous les supports (3 directions à A/B test, à figer en MVP)
- Palette terracotta : `brand-500 = #C2410C` (primary), `cream-50 = #FAF7F2` (page background), `charcoal-700 = #1F1D18` (texte principal)
- **Jamais de noir pur (#000) ni blanc pur (#FFF)** — registre chaud uniquement
- Typographie display : Fraunces (Google Fonts, libre, variable). Body : sans-serif lisible (à figer designer). Pairing serif + sans-serif standard hôtellerie/événementiel haut de gamme.
- Ton : vouvoiement client B2C par défaut, tutoiement pro B2B. Pas de jargon technique côté client. Pas de "fun" forcé sur friction (litige, refus KYC).

---

## 11. Métriques cibles (par version + permanentes)

### Sortie MVP

- 50 pros validés et actifs (≥1 résa chacun)
- 100 résa payées sans litige bloquant
- NPS client > 40
- CAC pro mesuré soutenable
- Délai moyen validation pro < 24h
- Taux complétion inscription pro > 60%
- ~6 000 visiteurs uniques mensuels en fin de période
- ~80 résa/mois fin de période

### Sortie V1

- 1er mois où (commissions + abonnements) > coûts variables
- ≥ 200 abonnés Business à 29€/mois (MRR ≥ 5 800€)
- Conversion Starter → Business > 15% à 6 mois
- < 5% résa en litige
- Churn mensuel < 5%
- Délai médian 1ʳᵉ réponse pro < 2h
- ~30 000 visiteurs/mois, ~400 résa/mois

### Sortie V2

- Taux rebooking client > 25%
- Panier moyen multi-vendeurs +30% vs V1
- ≥ 20 comptes Enterprise actifs
- ARR > 500 k€
- Couverture : PdL complet + Bretagne + 4 grandes agglos FR
- ~100 000 visiteurs/mois, ~1 500 résa/mois

### Permanentes business

- GMV (volume total transigé)
- Net commission (commissions encaissées − frais Stripe)
- MRR (abonnements)
- Take rate effective ((commissions + abos) / GMV)
- Concentration GMV (% top 10 pros) — surveillé hebdo, alerte si > seuil
- CAC par canal (objectif < 30€ B2C, < 150€ B2B)
- LTV par persona
- Ratio offre/demande par catégorie — surveillé quotidien (frein actif sur ads si déséquilibre)
- Réservations par pro Business — alerte si < 2/mois (risque churn 6 mois)

### Permanentes qualité service

- Taux dispute < 0,5%
- Délai reversement J+1
- Taux dépôt avis > 40%
- Note moyenne plateforme
- Délai moyen résolution litige < 7j
- Volume signalements / 1 000 transactions

### Permanentes acquisition

- ROAS > 2× sur budget mensuel
- Score qualité Google Ads > 7
- Position moyenne top 50 mots-clés priorité 1 : top 5 à 12 mois
- Part trafic organique vs payant : 30% MVP → 70%+ V2

### Permanentes tech

- Disponibilité gateway-api : 99,5% MVP, 99,9% V1+
- Latence p95 search < 150ms
- NATS consumer lag (alerte > 1000 msg)
- Outbox pending lag (alerte > 100 msg / > 1 min)
- Saga booking-payment échouée > 5 min (alerte)
- Core Web Vitals : LCP < 2,5s, INP < 200ms, CLS < 0,1

---

## 12. Risques (tous, avec mitigations)

### R1-R15 (produit & tech)

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| R1 | TVA & facturation marketplace mal conformes | 🔴 | Audit expert-comptable spécialisé avant V1 (500-1 500€) |
| R2 | Statut éditeur LCEN involontaire | 🔴 | Pas de modération systématique pré-pub. Audit avocat numérique |
| R3 | Concentration GMV sur peu de pros | 🟠 | Métrique concentration suivie hebdo. Diversification active |
| R4 | Cold-start côté offre | 🟠 | Sourcing pro physique en PdL — 50 premiers pros en main propre |
| R5 | Race conditions sur dispos | 🟠 | 3 layers : Redis lock + DB exclusion constraint + optimistic locking |
| R6 | Anti-désintermédiation insuffisante | 🟡 | Coordonnées masquées avant acceptation. Détection regex messagerie V1 |
| R7 | Stripe Connect KYC long (1-7j) | 🟡 | UX d'attente claire, préparer fiches en parallèle |
| R8 | Sync Keycloak ↔ identity-svc drift | 🟡 | Job réconciliation quotidien + webhooks Keycloak |
| R9 | Disputes Stripe tardifs | 🟡 | Evidence trail systématique (avis, échanges, photos) |
| R10 | RGPD vs conservation comptable 10 ans | 🟡 | Anonymisation données perso au-delà délai utile |
| R11 | Saga booking-payment partiellement échouée | 🔴 | Tests chaos en CI, replay possible, monitoring inbox/outbox lag, alertes admin > 5 min |
| R12 | NATS JetStream perte de message | 🟠 | Replicas R3 prod, DLQ stream dédié, monitoring consumer lag (alerte > 1000 msg) |
| R13 | Outbox relay PG LISTEN/NOTIFY en panne | 🟠 | Healthcheck dédié + fallback polling 30s + alerte si > 100 outbox pending > 1 min |
| R14 | Database per service complexité opérationnelle | 🟡 | MVP : 10 DBs sur 1 instance Postgres. Backup unifié. Séparer si bottleneck mesuré |
| R15 | Coût opérationnel des 10 services dès MVP | 🟠 | Co-localiser dans 1 cluster K8s/namespace au MVP. Séparer par traffic seulement quand justifié |

### RA1-RA5 (acquisition demande, risque opérationnel #1)

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| RA1 | Acquisition demande échoue → pros quittent dans 6 mois → offre s'effondre | 🔴 | Stratégie formalisée §11 brief + tukio_strategie_acquisition.md. Mix 3 leviers MVP. Sourcing physique côté demande (Salons Mariage Nantes/Angers). |
| RA2 | SEO ROI lent (6-12 mois minimum) | 🟠 | SEO démarré dès Sprint 0 (technique) + contenu mois 1. Payant pour combler le gap |
| RA3 | CAC payant qui explose (concurrence) | 🟠 | Diversification canaux dès le début. SEO contre-pouvoir long terme. Marque forte → trafic direct |
| RA4 | Taux conversion < 2-3% | 🟠 | A/B tests systématiques V1 (PostHog/GrowthBook). User research régulier 10 interviews/mois |
| RA5 | Marketplace asymétrique (offre/demande déséquilibrée) | 🟠 | Suivi quotidien ratio par catégorie. Frein actif sur ads si trop de demandes pas servies. Recrutement actif pros si offre faible sur catégorie |

### Risques business à surveiller

- **Saisonnalité PdL** : pic mai-septembre (mariages), creux hivernal → diversifier vers événements corporate (séminaires, soirées de fin d'année) pour lisser
- **Dépendance Stripe** : pas de plan B identifié — accepté comme risque de plateforme
- **Dépendance à un canal** (Google algo change) : mix d'au moins 3 canaux significatifs dès V1, données first-party (email + bouche-à-oreille)

---

## 13. Open questions / ambiguïtés résiduelles

- **Tagline marque** : 3 directions à A/B tester, pas encore figée. Décision MVP. **À fournir en FR + EN** dès la sélection (ADR-012).
- **Stratégie URL i18n** : ADR-012 a tranché sur locale-prefix `/{locale}/...`, mais l'IA doc `tukio_information_architecture.md` §C n'est **pas encore mise à jour** pour refléter la décision. Action : mettre à jour l'IA doc dans une prochaine itération pour expliciter le locale-prefix.
- **Modération bilingue** : règles d'auto-publication (pro `verified` > 30j et < 3 signalements) — un service publié uniquement en FR est-il considéré "publiable" pour la version EN avec fallback, ou doit-il avoir une traduction EN ? Recommandation par défaut : auto-publication FR ne dépend pas de la version EN (cf. K-14 fallback).
- **Référencement SEO de la version EN au MVP** : avec l'app non internationalisée géographiquement, le SEO EN ciblera-t-il vraiment des utilisateurs résidant en France ? Hypothèse : oui (anglophones en France) + early signal pour V3+ international, mais à valider sur les premières données réelles.
- **Body typeface** (sans-serif) : à figer avec le designer (Fraunces validé pour display)
- **Plan B Stripe** : aucun identifié, accepté comme risque
- **Acquisition demande côté C2 B2B** : la stratégie privilégie payant B2B (CAC tolérable plus élevé) mais les canaux payants spécifiques B2B (LinkedIn ? salons CCI ?) ne sont pas chiffrés au-delà du général
- **Frequency emails marketing post-V1** : non spécifié au-delà de "newsletter mensuelle clients + nurturing leads non convertis"
- **Politique boost / mise en avant V1** : "1 boost/mois pour Business" mais le mécanisme exact (durée du boost, placement, transparence vis-à-vis du client) n'est pas figé
- **Gestion des cas TVA edge** : pro qui change de SIRET (passage micro → SAS) → ré-onboarding KYC partiel mentionné, mais migration des factures historiques non détaillée
- **B2G** : signaux de réouverture documentés (5+ collectivités demandent + CA mensuel récurrent > 100k€), mais pas de chantier dédié ouvert tant que ces signaux ne sont pas atteints

---

## 14. Documents source (16 docs, ~20 600 lignes)

### Strate produit (PMs, founder, design)

- `docs/tukio_spec_v2.2.md` (~770) — spec fonctionnelle complète, 8 domaines, ADRs, risques. **Ground truth produit.**
- `docs/tukio_design_brief.md` (~940) — positionnement, palette terracotta, typo, tons, anti-patterns
- `docs/tukio_information_architecture.md` (~780) — URLs, sitemap, RBAC, sous-domaines
- `docs/tukio_catalogue_deepdive.md` (~847) — taxonomie, fiche pro, dispos, recherche, médias, 18 décisions C-01-C-18
- `docs/tukio_booking_paiements_deepdive.md` (~854) — parcours détaillés, états, 15 décisions D-01-D-15

### Strate UX flows (designers, devs frontend)

- `docs/tukio_ux_flow_catalog.md` (~1 385) — création/gestion services pro + découverte client
- `docs/tukio_ux_flow_booking.md` (~1 441) — tunnel checkout + gestion réservations + workflow pro
- `docs/tukio_ux_flow_auth_accounts.md` (~1 387) — inscription, onboarding pro, profils, paramètres
- `docs/tukio_ux_flow_communication.md` (~1 119) — messagerie + avis
- `docs/tukio_ux_flow_monetization.md` (~1 317) — abonnements + factures + payouts + finance admin
- `docs/tukio_ux_flow_admin_moderation.md` (~1 144) — back-office admin complet

### Strate backend (tech lead, devs backend)

- `docs/microservices-architecture.md` (~700) — architecture API microservices
- `docs/tukio_product_tech_alignment.md` (~546) — réconciliation produit ↔ tech, 11 ADRs, 10 incohérences résolues I-01-I-10, mapping domaines/services
- `docs/tukio_booking_svc_deepdive.md` (~2 339) — implémentation détaillée service le plus critique
- `docs/tukio_event_catalog.md` (~2 028) — ground truth ~50 events NATS, base de `@tukio/contracts`

### Strate go-to-market & stratégie

- `docs/tukio_strategie_acquisition.md` — stratégie acquisition demande complète : CAC, SEO, payant, parrainage, partenariats, mix par phase, 11 décisions tech K-01-K-11
- `docs/tukio_opportunites_futures.md` — 10 pistes hors roadmap (B2G C.1, expansion FR C.2, expansion EU C.3, B2B2B C.4, intégrations comptables C.5, mobile native C.6, verticales C.7, contenu C.8, marketplace talents C.9, SaaS pros C.10) avec critères de réouverture

### Brief consolidé

- `_bmad-output/planning-artifacts/product-brief-tukio.one.md` (~700 lignes, 19 sections) — point d'entrée unique de réalisation

---

*Distillate v0.3 — token-efficient context pour LLM downstream. Ne contient que ce qui est dans les docs source + décisions explicites du founder. Toute inférence au-delà = hallucination.*
*Dernière mise à jour : 2026-05-08.*
*v0.3 — corrections paths EN (alignés sur `tukio_information_architecture.md` §C), ajout ADR-012 (i18n FR/EN dès Sprint 0) + K-12 à K-15, override de la décision K-05 (slugs FR) du doc d'acquisition.*
