---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation-skipped
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
status: complete
completedAt: "2026-05-08"
releaseMode: phased
vision:
  statement: 'Devenir la référence française de l''événementiel local. Place de marché transactionnelle B2B2C connectant organisateurs (particuliers, entreprises) et pros artisanaux locaux, avec réservation + paiement + facturation intégrés. À horizon 24-36 mois : couverture nationale, configurateur intelligent, marketplace de talents, premiers déploiements internationaux.'
  differentiator: 'Vélocité d''exécution territoriale founder-led + discipline produit/tech dès Sprint 0 + branding sobre chaleureux (B2C ET B2B) + rails Stripe Connect Express + architecture microservices propre. L''unfair advantage n''est pas tech, c''est territorial.'
  coreInsight: 'Le vide de marché = aucun acteur français n''offre réservation tunnellisée + paiement sécurisé + ancrage territorial pour la diversité d''événements. Tukio parie que transaction + confiance + ancrage local valent plus que la portée nationale d''Eventbrite ou le SEO de Mariages.net.'
  oneLinerIntangible: 'Tukio est la place de marché qui rend l''organisation d''événements plus simple, plus fiable et plus belle, en connectant directement les organisateurs aux professionnels locaux.'
  promiseClient: 'Trouve les bons pros près de chez toi, en confiance, sans appeler 10 personnes.'
  promisePro: 'Concentre-toi sur ton métier, on s''occupe du reste : visibilité, paiement, paperasse.'
  metaphoreLongTerme: 'Être ce que Le Bon Marché est au commerce — place de marché élégante, ancrée localement, premium dans son segment.'
  antiPositioning:
    - 'Ne PAS être un Eventbrite français (ticketing public)'
    - 'Ne PAS être un MalleàWedding moderne (vertical mariage)'
classification:
  projectType: web_app
  projectTypeNotes: 'Marketplace / two-sided platform B2B2C (Next.js 15 SPA/PWA + 10 microservices NestJS). Caractère saas_b2b partiel (tiers d''abonnement, RBAC, multi-tenant pro) mais B2C demeure majoritaire au MVP.'
  domain: general
  domainNotes: 'E-commerce / marketplace (pas listé en CSV). Concerns fintech-adjacentes : Stripe Connect Express, KYC light, mandat de facturation art. 289 CGI, PSD2 indirect.'
  complexity: medium-high
  complexityDrivers:
    - 'TVA marketplace + mandat art. 289 CGI (R1)'
    - 'Statut hybride éditeur/hébergeur LCEN (R2)'
    - 'RGPD multi-couche'
    - 'PSD2 indirect via Stripe Connect'
    - 'Architecture microservices (10 services) avec saga choréographée distribuée'
    - 'Two-sided marketplace cold-start (RA1)'
    - 'i18n FR + EN dès Sprint 0 (ADR-012)'
    - '~50 events NATS dans le catalogue'
  projectContext: 'greenfield-code-brownfield-docs'
  projectContextNotes: 'Repos tukio-one-api/ et tukio-one-front/ vides. 16 docs Tukio (~17 400 lignes) + brief v0.3 (~700 lignes) consolident l''intent produit et tech sans code écrit. Le PRD doit traduire les docs en specs implémentables.'
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-tukio.one.md
  - _bmad-output/planning-artifacts/product-brief-tukio.one-distillate.md
  - docs/tukio_spec_v2.2.md
  - docs/tukio_design_brief.md
  - docs/tukio_information_architecture.md
  - docs/tukio_catalogue_deepdive.md
  - docs/tukio_booking_paiements_deepdive.md
  - docs/tukio_ux_flow_catalog.md
  - docs/tukio_ux_flow_booking.md
  - docs/tukio_ux_flow_auth_accounts.md
  - docs/tukio_ux_flow_communication.md
  - docs/tukio_ux_flow_monetization.md
  - docs/tukio_ux_flow_admin_moderation.md
  - docs/microservices-architecture.md
  - docs/tukio_product_tech_alignment.md
  - docs/tukio_booking_svc_deepdive.md
  - docs/tukio_event_catalog.md
  - docs/tukio_strategie_acquisition.md
  - docs/tukio_opportunites_futures.md
documentCounts:
  briefs: 2
  research: 0
  brainstorming: 0
  projectDocs: 17
workflowType: 'prd'
projectName: 'tukio.one'
loadStrategy: 'primary-on-demand'
---

# Product Requirements Document - tukio.one

**Author:** Ismael
**Date:** 2026-05-08

## Table des matières

1. [Executive Summary](#executive-summary)
2. [Project Classification](#project-classification)
3. [Success Criteria](#success-criteria) — User / Business / Technical / Measurable Outcomes
4. [Product Scope](#product-scope) — MVP / Growth Features / Vision
5. [User Journeys](#user-journeys) — 6 journeys narratifs (J1-J6) + capability summary
6. [Domain-Specific Requirements](#domain-specific-requirements) — Compliance, Technical Constraints, Integrations, Risk Mitigations, Patterns, Anti-patterns
7. [Web Application Specific Requirements](#web-application-specific-requirements) — Browser Matrix, Responsive, Performance, SEO, Accessibility, Real-time, UX Writing, Implementation
8. [Project Scoping & Phased Development](#project-scoping--phased-development) — MVP Strategy, Resources, Risk-Based Scoping, Budget par phase
9. [Functional Requirements](#functional-requirements) — 130 FRs sur 11 capability areas (A à K)
10. [Non-Functional Requirements](#non-functional-requirements) — 84 NFRs sur 10 catégories (Performance, Security, Compliance, Scalability, Reliability, Accessibility, i18n, Observability, Maintainability, Integration, Operability)

---

## Executive Summary

**tukio.one** est une marketplace transactionnelle B2B2C dédiée à l'organisation d'événements en France. Elle connecte directement les organisateurs (particuliers, entreprises) aux professionnels événementiels locaux (loueurs de matériel, traiteurs, prestataires son/lumière, mobilier, animateurs, lieux), avec réservation, paiement et facturation intégrés de bout en bout.

Le marché de l'événementiel français reste fragmenté entre annuaires sans transaction (Mariages.net, ABC Salles), généralistes inadaptés au service événementiel à la demande (Eventbrite, Luma sur le ticketing public), verticaux mariage à esthétique datée (MalleàWedding, 1001Listes), et petites annonces sans cadre de confiance (Leboncoin). Aucun acteur n'offre aujourd'hui une expérience *réservation tunnellisée + paiement sécurisé + ancrage territorial* pour la diversité d'événements (mariage, anniversaire, séminaire, lancement produit, fête associative). **Tukio se positionne précisément sur ce vide.**

L'ambition à 24-36 mois : devenir la référence française de l'événementiel local — le lieu unique où particuliers, entreprises et collectivités assemblent des événements en confiance, où les pros artisanaux retrouvent leur capacité à se concentrer sur leur métier, et où chaque transaction laisse une trace utile (avis vérifiés, facturation conforme, comptabilité automatisée). Trajectoire en 4 versions :

- **MVP** (3-4 mois) — valider la transaction, 50 pros + 100 réservations payées en Loire-Atlantique + Maine-et-Loire
- **V1** (+3 mois) — marketplace complète & monétisable, B2B activé, 3 tiers d'abonnement, Pays de la Loire complet + Bretagne
- **V2** (+3 mois) — croissance & rétention, app mobile native, 4 grandes agglos FR (Paris, Lyon, Bordeaux, Marseille)
- **V3+** — scale, internationalisation ciblée (Belgique → Suisse → Maroc), B2G/collectivités, marketplace de talents, API publique, IA matching

**Promesse côté client** : *"Trouve les bons pros près de chez toi, en confiance, sans appeler 10 personnes."*
**Promesse côté pro** : *"Concentre-toi sur ton métier, on s'occupe du reste : visibilité, paiement, paperasse."*
**One-liner intangible (depuis le design brief)** : *Tukio est la place de marché qui rend l'organisation d'événements plus simple, plus fiable et plus belle, en connectant directement les organisateurs aux professionnels locaux.*

Cinq facteurs convergent en 2026 pour rendre ce produit possible et timely : reprise durable du live post-Covid (CAGR 5-7 % multi-année sur > 50 Md$ globalement, dynamique comparable en France), maturité de Stripe Connect Express (intégration 6-8 semaines en 2026 vs 18 mois en 2018), Keycloak managé (Phasetwo) qui supprime la dette identité, saturation des annuaires sans transaction (utilisateurs prêts à payer pour de la qualité), et un founder-led local qu'aucune plateforme nationale ne peut répliquer en cold-start sur un marché ultra-local par nature.

### What Makes This Special

L'unfair advantage principal **n'est pas un fossé technologique** — il tient en cinq axes :

1. **Vélocité d'exécution territoriale** — le founder, basé à Nantes, peut serrer la main aux 50 premiers pros à moins d'1 h de route. Aucune plateforme nationale (Eventbrite, Luma) ne peut répliquer ce socle de confiance en cold-start sur un marché ultra-local par nature.
2. **Discipline produit & tech dès Sprint 0** — 16 documents source consolidés (~17 400 lignes) + brief v0.3 (~700 lignes), 12 ADRs (incluant l'i18n), conventions figées, taxonomie produit/code rigoureusement séparée (Pro/Client en UI vs provider/customer en code). La dette structurelle est payée *avant* le premier commit, pas en V1.
3. **Branding sobre & chaleureux ciblant B2C ET B2B** — palette terracotta + typo serif/sans-serif (Fraunces) + tons "modernité tranquille". Positionne loin du tech-bro austère et loin du Pinterest mariage rose. Permet de capturer **à la fois** le mariage particulier et le séminaire d'entreprise — segment que ne touchent ni les verticaux mariage (cantonnés au B2C romantique) ni les plateformes corporate B2B-only (Bizzabo, Cvent).
4. **Rails Stripe Connect Express mature** — conformité PSD2 simplifiée, KYC géré par Stripe, splits multi-vendeurs natifs, capture différée standard. Six à huit semaines d'intégration en 2026.
5. **Architecture microservices NestJS hexagonale propre dès le démarrage** — 10 services figés (`gateway-api`, `identity-svc`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`), NATS JetStream + transactional outbox + saga choréographée, database-per-service, pattern Pretre strict. Pas de monolithe à découper en V1, pas de dette technique structurelle à rembourser.

**Le pari produit** : sur un marché ultra-local par nature, *transaction + confiance + ancrage territorial* valent plus pour les utilisateurs que la portée nationale d'un Eventbrite ou le SEO accumulé d'un Mariages.net. La métaphore long terme : être ce que **Le Bon Marché** est au commerce — la place de marché élégante, ancrée localement, premium dans son segment, où la confiance est l'expérience par défaut.

**Anti-positionnement structurant** : Tukio n'est pas un Eventbrite français (ticketing public), ni un MalleàWedding moderne (vertical mariage rose poudré), ni un Stripe minimaliste froid, ni un Airbnb aspirationnel touristique, ni un Leboncoin brut.

## Project Classification

| Dimension | Valeur | Détail |
|-----------|--------|--------|
| **Project type** | `web_app` (marketplace / two-sided platform B2B2C) | Frontend Next.js 15 (SPA + PWA V1 + native V2), gateway API REST + 10 microservices NestJS, PWA V1, mobile native V2. Caractère `saas_b2b` partiel (3 tiers d'abonnement, RBAC granulaire, multi-tenant pro) sans être pur enterprise SaaS — B2C demeure majoritaire au MVP. |
| **Domain** | `general` (e-commerce / marketplace) avec concerns fintech-adjacentes | Pas listé explicitement dans la taxonomie BMad. Touche fintech-adjacent via Stripe Connect Express, KYC light pro, mandat de facturation art. 289 CGI, PSD2 indirect — sans être un produit fintech. |
| **Complexity** | `medium-high` | 8 drivers structurants : TVA marketplace (R1, audit expert-comptable obligatoire avant V1), statut hybride éditeur/hébergeur LCEN (R2, audit avocat numérique), RGPD multi-couche, PSD2 indirect via Stripe, architecture microservices avec saga distribuée, two-sided cold-start (RA1 = risque opérationnel #1), i18n FR + EN dès Sprint 0 (ADR-012), ~50 events NATS au catalogue. |
| **Project context** | Greenfield code + brownfield documentation | Singularité du projet : repos `tukio-one-api/` et `tukio-one-front/` vides à date, mais ~17 400 lignes de docs Tukio + ~700 lignes de brief v0.3 + distillate v0.3 consolident l'intent produit et tech. **Ce PRD doit traduire cette documentation en specs implémentables, pas explorer le marché ni définir la stratégie.** |

### Concerns transversaux (à propager dans tous les requirements downstream)

- **TVA marketplace + mandat art. 289 CGI** (R1) — audit expert-comptable spécialisé marketplace **obligatoire avant V1** (500-1 500 €). Tukio émet la facture au nom du pro. 3 cas TVA gérés (non assujetti / B2C / B2B intra-UE).
- **Statut hybride éditeur/hébergeur LCEN** (R2) — pas de modération pré-publication systématique (sinon bascule éditeur). Audit avocat numérique avant lancement.
- **RGPD multi-couche** — stack analytique RGPD-compliant (Plausible sans cookies + PostHog hosted EU + Brevo FR), soft-delete avec anonymisation post-délai utile, audit trail immuable des actions admin, droits d'accès/rectification/effacement/portabilité workflow admin V1.
- **Acquisition demande = risque opérationnel #1** (RA1) — un pro Business doit faire ≥ 2 résa/mois pour rester sur la plateforme ; sans clients qui passent commande, l'offre s'effondre dans les 6 mois. Stratégie formalisée dans `tukio_strategie_acquisition.md` (mix 3 leviers MVP, K-01 à K-11).
- **i18n FR + EN dès Sprint 0** (ADR-012) — `next-intl` + locale-prefix URL `/{locale}/...` + schéma multilingue côté `catalog-svc` (`listing_translations`, `category_translations`, `pro_profile_translations`) + 1 index Meilisearch par locale + templates email Resend FR + EN. App **non internationalisée géographiquement** au MVP (France only) mais **bilingue linguistiquement** dès le départ — cas d'usage : utilisateur résidant en France qui préfère parler anglais. Override la décision K-05 (slugs FR) du `tukio_strategie_acquisition.md`.
- **Conventions de nommage figées** — UI/produit en FR/EN selon locale, code/DB/API/events en EN strict. Tous les paths URL en EN (jamais FR). "Buyer" interdit en code (utiliser `customer`). "Seller" reste seulement dans URLs (`/seller/*`). Référence canonique : `tukio_information_architecture.md` §C, étendue par ADR-012.

## Success Criteria

### User Success

**Côté client (organisateur)** — la plateforme délivre quand le client passe en quelques heures de "j'ai pas le temps d'appeler 10 personnes" à une réservation **payée et confirmée**, sans appeler personne ni avancer de virement.

- **Délai de mise en relation** : un client qui démarre sa recherche réserve dans les **2 heures suivant sa première recherche** (médiane). Mesuré sur le funnel `search_performed` → `booking_request_started` → `booking_confirmed`.
- **Confiance perçue** : NPS client **> 40** dès la sortie MVP, **> 50** à V1.
- **Taux de transformation visiteur → réservation confirmée** : 2-3 % au MVP (hypothèse à valider), tendant vers 4 % en V2.
- **Moment "aha"** : le client voit en un écran (i) le tarif tout-compris, (ii) la disponibilité confirmée à sa date, (iii) les avis vérifiés du pro, et (iv) la garantie "remboursé si non livré" (capture différée). Pas de devis manuel à attendre.
- **Délai médian de première réponse pro** : < 2 h (si pas de message reçu, le client n'attend pas — la plateforme l'a alerté du timing).

**Côté pro** — la plateforme délivre quand le pro consacre **moins de 30 % de son temps à l'admin** (au lieu des 30-50 % constatés actuellement) et reçoit ses paiements **garantis** sans relance.

- **Délai de validation du dossier pro** : < 24 h (objectif admin opérationnel)
- **Taux de complétion d'inscription pro** : > 60 % (objectif onboarding)
- **Délai de reversement** : J+1 après l'événement, automatique
- **Taux d'acceptation des demandes** : > 80 % (signal que les leads sont qualifiés)
- **Adoption MFA pro** : > 30 % en V1 (sécurisation des comptes pros actifs)
- **Promesse intangible mesurable** : un pro Business qui a passé son onboarding fait **≥ 2 réservations/mois** dans ses 6 premiers mois (en dessous → risque churn structurel, alerte ops).

**Côté admin Tukio** — la plateforme délivre quand la modération reste sous contrôle d'1-2 personnes au MVP.

- Délai moyen résolution litige : **< 7 jours**
- % litiges résolus à l'amiable : majoritaire (objectif > 80 %)
- Volume signalements / 1 000 transactions : surveillé hebdo, seuil d'alerte à figer

### Business Success

**Économie unitaire saine au MVP** — pas de subvention par cash externe pour acquérir des pros.

- **CAC client B2C** : < 30-40 € (hypothèse, à valider sur les premières données)
- **CAC client B2B** : < 100-300 €
- **CAC pro** : 30-100 € (sourcing physique founder + outbound)
- **Marge brute par résa B2C** : ~80 € (TR 10 % × ticket 800 €)
- **Marge brute par résa B2B** : ~250 €
- **Break-even pro** : 3-5 transactions

**Cibles par version** — *l'inflexion business arrive en V1.*

| Version | Métriques de sortie |
|---------|---------------------|
| **MVP** (mois 3-4) | 50 pros actifs (≥ 1 résa) • 100 résa payées sans litige bloquant • NPS > 40 • CAC pro soutenable • ~6 000 visiteurs/mois fin de période • ~80 résa/mois fin de période |
| **V1** (mois 6-7) | 1er mois où (commissions + abos) > coûts variables • ≥ 200 abonnés Business (MRR ≥ 5 800 €) • Conversion Starter → Business > 15 % à 6 mois • < 5 % résa en litige • Churn mensuel < 5 % • Délai médian 1ʳᵉ réponse pro < 2 h • ~30 000 visiteurs/mois • ~400 résa/mois |
| **V2** (mois 9-10) | Taux rebooking client > 25 % • Panier moyen multi-vendeurs +30 % vs V1 • ≥ 20 comptes Enterprise actifs • ARR > 500 k€ • PdL complet + Bretagne + 4 grandes agglos FR • ~100 000 visiteurs/mois • ~1 500 résa/mois |

**Métriques permanentes (suivies en continu)** :

- **GMV** (volume total transigé)
- **Net commission** = commissions encaissées − frais Stripe
- **MRR** sur abonnements
- **Take rate effective** = (commissions + abos) / GMV
- **Ratio MRR / commissions > 30 %** à 6 mois V1 (mesure de diversification anti-cyclique)
- **Concentration GMV** (% top 10 pros) — surveillée hebdo, alerte à seuil
- **Ratio offre/demande par catégorie** — surveillé **quotidien**, frein actif sur ads si déséquilibre

### Technical Success

**Disponibilité & performance**

- Disponibilité **gateway-api** : 99,5 % MVP, 99,9 % V1+
- Latence p95 search Meilisearch : **< 150 ms**
- Core Web Vitals : LCP **< 2,5 s**, INP **< 200 ms**, CLS **< 0,1**

**Robustesse de la saga distribuée booking-payment** (R11 critique)

- NATS consumer lag : alerte si **> 1 000 messages**
- Outbox pending lag : alerte si **> 100 messages / > 1 min**
- Saga booking-payment échouée : alerte si **> 5 min**
- Tests chaos en CI obligatoires sur le flow saga

**Conformité technique**

- HTTPS/TLS partout, mTLS inter-services en prod
- 0 secret en clair, PII redaction sur logs
- Audit trail immuable des actions admin (table immutable côté `identity-svc`, append-only)
- Schéma `acquisition_*` migré sur `users` + `bookings` dès Sprint 0 (impossible à rétro-fitter)
- i18n FR + EN câblé dès Sprint 0 (next-intl + tables de traductions + 1 index Meilisearch par locale)

**Tracking & analytics**

- 100 % des events business critiques (`page_view`, `search_performed`, `service_viewed`, `pro_viewed`, `booking_request_started`, `booking_request_submitted`, `booking_confirmed`) trackés côté serveur via `gateway-api` (résistant ad-block)
- UTM params systématiques sur toutes les campagnes, persistés en DB

### Measurable Outcomes

**Outcomes acquisition (RA1 = risque opérationnel #1)**

- Part trafic organique vs payant : **30 % MVP → 70 %+ V2**
- ROAS > **2×** sur budget mensuel d'acquisition
- Score qualité Google Ads > **7**
- Position moyenne sur top 50 mots-clés priorité 1 : **top 5 à 12 mois**
- Délai entre 1ʳᵉ visite et 1ʳᵉ réservation client : médiane **< 7 jours** (en V1, après stabilisation des fonctionnalités)

**Outcomes qualité service (R3, R6, R9 mitigations)**

- Taux de dispute Stripe : **< 0,5 %**
- Taux de dépôt d'avis : **> 40 %**
- Note moyenne plateforme : à figer une fois 100 résa atteintes (objectif **≥ 4,5 / 5**)
- Concentration GMV top 10 pros : surveillée hebdo, **objectif < 50 %** à V1

**Outcomes monétisation V1+**

- Conversion Starter → Business : **> 15 % à 6 mois**
- Adoption boost (Business+) : **> 50 %** des comptes Business utilisent leur boost mensuel inclus
- Adoption Stats avancées (Business+) : **> 70 %** consultent leur dashboard analytics ≥ 1×/semaine

## Product Scope

### MVP — Minimum Viable Product

**Hypothèse à valider** : *des pros sont prêts à payer une commission pour des leads qui se convertissent en réservations payées sur la plateforme.*

**Périmètre géo** : Loire-Atlantique (44) + Maine-et-Loire (49). Couverture physique founder-led.

**Fonctionnel inclus** :

- **Comptes** : inscription client B2C particulier, inscription pro avec validation manuelle admin (KYC light : SIRET + RIB + pièce d'identité), MFA admin obligatoire, vérification email obligatoire avant transaction
- **Catalogue** : 2 catégories pilotes (*tentes & chapiteaux* + *mobilier événementiel*), fiche service basique (3-15 photos, description, tarif unité/forfait, zone livraison, délai), recherche catégorie + ville + date via Meilisearch, taxonomie 3 niveaux figée admin, ranking transparent, affichage prix médian fiche catégorie
- **Booking** : réservation directe (pas de devis), panier mono-vendeur, calendrier dispo (Redis lock + DB exclusion + optimistic locking, 3 layers), 3 templates politique annulation (souple/standard/strict)
- **Paiements** : Stripe Connect Express, capture différée (autorisation → capture à acceptation pro), commission fixe **10 %**, reversement automatique J+1, refund manuel admin, mandat de facturation art. 289 CGI
- **Messagerie** : chat client ↔ pro lié à la réservation (pas de chat libre), notifications email Resend basiques (FR + EN)
- **Avis** : note 1-5 + commentaire texte, demande automatique J+1, modération a posteriori
- **Admin** : validation pros, modération signalements basique, vue transactions/litiges
- **Légal** : CGU/CGV/PC/mentions légales versionnés FR + EN dès le MVP (FR fait foi juridiquement), RGPD basique
- **Acquisition tech (K-01-K-05)** : pages locales `/{locale}/category/{slug}/{city}` générées auto si > 3 pros, schema.org JSON-LD, sitemap par locale + hreflang, Plausible + PostHog hosted EU, tracking server-side, schema `acquisition_*` en DB
- **i18n FR + EN dès Sprint 0** (ADR-012) : `next-intl` (zéro hardcodé en frontend), locale-prefix URLs `/{locale}/...`, `listing_translations` + `category_translations` + `pro_profile_translations`, 1 index Meilisearch par locale, templates email Resend FR + EN, saisie pro FR obligatoire + EN optionnel (fallback FR + badge UI)

**Volontairement exclus du MVP** :

- Comptes B2B (entreprises clientes)
- Devis personnalisés / négociation tarifaire
- Panier multi-vendeurs
- Échéanciers / acomptes / paiements fractionnés
- Subscription tiers pros (tout le monde sur le même plan)
- Avis multi-critères
- Application mobile native
- API publique
- Internationalisation hors France
- Programme parrainage / apporteurs B2B
- B2G / collectivités

### Growth Features (Post-MVP)

#### V1 (~+3 mois) — *Marketplace complète & monétisable*

**Périmètre géo** : Pays de la Loire complet (44/49/72/85/53) + Bretagne (35/22/29/56).

- **Comptes B2B** (entreprises clientes), profil pro enrichi (portfolio, équipe, certifs), KYC complet Stripe Identity, login social Google + Apple, MFA optionnel pros, conversion compte client → pro (ajout rôle Keycloak)
- **Catalogue** : toutes catégories cibles, tarification flexible (unité/forfait/devis), gestion dispos avancée (calendrier, blocages, **inventory pool partagé** entre fiches d'un même pro), vidéos YouTube/Vimeo embed
- **Booking** : panier multi-vendeurs (N PaymentIntents groupés par Order), demande de devis personnalisé, réservation conditionnelle option 48 h
- **Paiements** : **3 tiers d'abonnement** (Starter 0 € 15 % / Business 29 €/mois 10 % / Enterprise sur devis 5 % + frais fixes), acomptes 30/70 modulables, échéanciers personnalisables (Stripe SetupIntent + cron), factures PDF auto, gestion TVA 3 cas
- **Messagerie** : chat libre avant booking, pièces jointes (scan antivirus), recherche historique, anti-désintermédiation regex (config dans `@tukio/contracts`)
- **Avis** : multi-critères (qualité/ponctualité/com/prix), réponse pro Business+, note réciproque pro → client (visible aux autres pros)
- **Admin & litiges** : workflow ouverture → médiation 48 h → résolution → clôture (réouverture 15 j possible), dashboard modération, rôles granulaires Keycloak (`admin-super/support/modo`), remboursement partiel admin, sanctions graduelles (avertissement → suspension publication 7 j → suspension compte 30 j → bannissement avec hash anti-recréation)
- **Pro dashboard** : stats revenus/conversion/occupation/temps réponse, export comptable CSV/PDF
- **Acquisition** : programme parrainage clients (table `referral_codes`, crédits 30 € symétriques sur résa > 200 €), apporteurs B2B (rôle "partner" + dashboard dédié, commission 5 %), email marketing **Brevo** (FR + EN), A/B testing PostHog/GrowthBook, heatmaps + session replay (consentement RGPD), page blog complète

#### V2 (~+3 mois) — *Croissance & rétention*

**Périmètre géo** : grandes agglos FR (Paris, Lyon, Bordeaux, Marseille).

- Configurateur d'événements (assistant assemble plusieurs services en un devis)
- Recommandations personnalisées clients (historique)
- Co-traitance entre pros (un pro sous-traite à un autre, splits gérés)
- Programme de fidélité client (-5 % à la 3ᵉ résa)
- Tier Enterprise complet : SLA 4 h, account manager, intégrations comptables (Pennylane, QuickBooks API directe)
- B2B SSO via Keycloak SAML federation
- Analytics pros avancées : benchmarks anonymisés, suggestions de prix
- Vérification renforcée : badges "vérifié", "pro de l'année"
- SEO programmatique avancé (catégorie × ville étendue), embauche marketer interne
- **Application mobile native** iOS / Android (priorité côté pro)
- 1ʳᵉ campagne Performance Max Google (mois 12+, après 30+ conversions/mois stables)

### Vision (Future)

V3+ — pistes documentées dans `tukio_opportunites_futures.md`. **Aucune n'est dans la roadmap formelle ; réouverture conditionnée à des signaux explicites.**

- **Internationalisation** ciblée selon affinités réseau (Belgique → Suisse → Maroc)
- **API publique** pour intégrations tierces (CRMs événementiels, ERP B2B, plateformes de wedding planning)
- **IA matching client ↔ pro** (configurateur intelligent)
- **White-label** pour grandes marques événementielles (groupes hôteliers, traiteurs nationaux, agences)
- **Marketplace de talents** (intermittents, animateurs, DJ, photographes)
- **Outils SaaS pros** (CRM, planning, devis, factures) — vision long terme V4-V5
- **B2G / collectivités territoriales** (~1 250 communes + 17 EPCI + 5 départements + 1 région en PdL) — V3+ conditionné à 5+ collectivités demandant spontanément après 12 mois + CA mensuel récurrent > 100 k€ + commercial B2G dédié
- **Verticales spécialisées** (Tukio Mariage, Tukio Séminaires) — V3 si une verticale > 50 % du GMV

## User Journeys

> Six journeys narratifs couvrant les acteurs primaires (client C1, pro P1), un acteur secondaire B2B (client C2 en V1), un cycle d'edge case (litige/annulation), et les deux journeys admin (validation pro + médiation litige). Chaque journey est tracé sur les **5 phases de transaction Tukio** (Découverte → Intention → Transaction → Exécution → Clôture).

### J1 — Sophie organise son mariage à La Baule (client C1, happy path MVP)

**Persona** : Sophie, 32 ans, ingénieure à Nantes. Elle se marie le **15 juin 2026** à La Baule, 80 invités. Budget chapiteau + mobilier : ~3 500 €. Elle a déjà passé 6 heures sur Mariages.net et Leboncoin sans trouver de prestataires fiables avec des tarifs clairs.

**Opening Scene — la frustration**
*Mardi soir, 22 h. Sophie est sur Mariages.net depuis 1 h. Elle a contacté 5 loueurs de chapiteaux par formulaire ; 2 ont répondu avec un PDF illisible, 3 silence radio. Une amie lui parle de Tukio. Elle clique.*

**Rising Action — la découverte**
- Sur `/fr/category/location-tentes-chapiteaux/la-baule` (page locale générée), elle voit **6 fiches** avec photos, tarifs tout-compris, et badges "Disponibilité confirmée pour le 15/06"
- Elle filtre par **capacité ≥ 80 personnes** et **prix < 4 000 €** → 3 fiches restent
- Elle ouvre `/fr/service/chapiteau-100m2-blanc-chic-pornichet` : 12 photos, description, options (chauffage, plancher), zone livraison La Baule incluse, politique d'annulation "standard" expliquée en 3 lignes, **24 avis vérifiés (4,7/5)**
- Elle voit le prix médian de la catégorie (3 100 €) → ce service à 3 400 € est dans la fourchette, légère prime justifiée par les avis

**Climax — la décision en 4 minutes**
- Elle clique "Réserver pour le 15/06/2026" → calendrier confirme dispo en temps réel
- Tunnel checkout `/fr/cart` → `/fr/cart/shipping` (adresse) → `/fr/cart/checkout`
- Stripe Elements : carte → 3DS → autorisation
- Écran de confirmation : *"Votre demande est envoyée à Pornichet Events. Le paiement sera capturé uniquement après acceptation du pro (sous 48 h max). Vous serez remboursé en intégralité si refus ou non-livraison."*
- Email Resend en FR (locale détectée) : confirmation de demande + lien vers `/fr/account/bookings/{id}`

**Resolution — la confiance**
- 4 h plus tard, message du pro dans `/fr/account/messages/{id}` : *"Bonjour Sophie, c'est confirmé pour le 15/06. Voulez-vous l'option chauffage ?"*
- Sophie répond, choisit l'option, Stripe capture le montant ajusté
- J-7 : email rappel logistique (livraison 14/06 14h)
- J+1 après l'événement : email "Comment s'est passé votre mariage ? Laissez un avis"
- Sophie laisse une note 5/5, recommande Tukio à 2 amies en story Instagram

**Capabilities révélées** : recherche faceted Meilisearch, fiche service riche, calendrier dispo temps réel, locale-prefix URL + i18n, Stripe Connect Express + capture différée, messagerie liée à booking, notifications transactionnelles email FR, demande d'avis automatique.

---

### J2 — Sophie, son mariage est annulé (client C1, edge case)

**Persona** : Même Sophie. À J-3 du mariage, sa belle-mère décède. Tout doit être annulé.

**Opening Scene**
*Mardi 12/06, 9 h. Sophie ouvre Tukio en larmes. Elle ne sait pas si elle pourra annuler ou si elle perd ses 3 400 €.*

**Rising Action**
- `/fr/account/bookings/{id}/cancel` — workflow guidé
- L'écran lui rappelle la politique d'annulation "standard" : remboursement 80 % à J-3, 50 % à J-1, 0 % le jour J
- Cas hors politique standard : option **"Je suis dans une situation exceptionnelle (hospitalisation, décès, force majeure)"** → ouvre un litige géré par admin Tukio
- Sophie sélectionne ce cas, joint un certificat de décès, soumet

**Climax — la médiation**
- 3 h plus tard, un admin Tukio (admin-modo) ouvre le dossier dans `admin.tukio.one/transactions/disputes/{id}`
- Il contacte le pro via la messagerie : *"Cas de force majeure documenté. Position de Tukio : remboursement 100 %. Acceptez-vous ?"*
- Pornichet Events accepte (coût d'image vs gain transactionnel, et le pro a déjà 90 % d'avis 5★)
- Admin déclenche refund Stripe full → Sophie reçoit 3 400 € en J+5

**Resolution**
- Sophie reçoit un email humain en FR du support : *"Toutes nos condoléances. Votre remboursement est en cours."*
- Elle ne supprime pas son compte. 8 mois plus tard, elle organise un baptême et revient sur Tukio.

**Capabilities révélées** : workflow annulation guidé avec politiques, ouverture de dispute, dashboard admin moderation, refund manuel admin, messagerie admin/pro, audit trail immuable, gestion communication empathique (templates email modulables).

---

### J3 — Marc onboarde sur Tukio (pro P1, happy path MVP)

**Persona** : Marc, 38 ans, gérant de **Pornichet Events** (loueur chapiteaux + mobilier). 4 employés. CA 280 k€/an. Il dépend de Mariages.net (450 €/mois) et de bouches-à-oreille saturés. Le founder Tukio l'a contacté en personne au Salon du Mariage de Nantes en mars.

**Opening Scene — la promesse**
*Lundi matin. Marc reçoit un email du founder Tukio : "Voici ton code d'accès. 30 min pour créer ton profil, et je passe te voir mercredi pour t'aider à publier ta première fiche."*

**Rising Action — l'onboarding**
- Inscription sur `auth.tukio.one/realms/tukio/registration` → email vérifié
- Redirect `/fr/seller/onboarding/profile` : nom commercial, raison sociale, SIRET, bio, photo profil
- `/fr/seller/onboarding/kyc` : upload pièce d'identité + justificatif d'adresse
- `/fr/seller/onboarding/stripe` : redirect Stripe Connect Express → KYC financier (3-7 j de délai)
- `/fr/seller/onboarding/first-listing` : Marc crée sa fiche "Chapiteau 100m² Blanc Chic" — 12 photos, 3 modes tarification, options chauffage/plancher, zone livraison Loire-Atlantique
- Statut compte : `pending_admin_review` → page d'attente *"Votre dossier est en cours de validation, vous serez notifié sous 24 h"*

**Climax — la validation et la 1ère résa**
- 18 h plus tard, email Resend : *"Votre compte Pornichet Events est validé. Bienvenue sur Tukio."*
- Statut → `verified`. Fiche service publiée.
- Mercredi, le founder passe à Pornichet, fait un café, montre le dashboard pro.
- Vendredi 23 h, **première demande de Sophie** apparaît dans `/fr/seller/bookings?status=pending`
- Marc reçoit notification email + (V1) push : *"Nouvelle demande pour le 15/06/2026"*
- Coordonnées Sophie masquées avant acceptation. Marc voit ville/date/options, accepte.
- Stripe capture → email "Paiement en cours, reversement J+1 après l'événement"

**Resolution — la rétention**
- Marc fait 4 résa via Tukio le mois suivant. Coût marketing Tukio : 10 % de commission (vs 450 €/mois fixe sur Mariages.net pour 1-2 leads non transformés)
- Il évalue : *"Tukio coûte ~20 % moins cher et amène des leads qualifiés. Je résilie Mariages.net dans 3 mois."*

**Capabilities révélées** : onboarding pro 4 étapes wizard, KYC light + Stripe Identity (V1), validation admin manuelle, anti-désintermédiation (coordonnées masquées), capture différée Stripe, dashboard pro avec to-do urgent, notifications transactionnelles, messagerie liée à booking.

---

### J4 — Marc reçoit un dispute Stripe (pro P1, edge case)

**Persona** : Même Marc. 6 mois après son inscription. 47 résa réalisées.

**Opening Scene**
*Mardi 11h. Marc reçoit un email Stripe : "Une dispute a été ouverte par votre client sur la transaction du 18/05 (1 200 €)."*

**Rising Action**
- Marc se connecte à `/fr/seller/billing/payouts` → voit la transaction marquée "Dispute en cours"
- Il ouvre le détail dans `/fr/seller/bookings/{id}` : la cliente (B2B, séminaire d'entreprise) prétend que le chapiteau n'a pas été livré
- Marc voit l'audit trail Tukio : photos de livraison qu'il avait uploadées dans la messagerie le jour J, signature électronique du destinataire (V1)
- Il clique "Contester la dispute" → formulaire pre-rempli avec evidence trail Tukio (messagerie complète, photos, signature, avis 5★ laissé après l'événement par la cliente elle-même !)

**Climax — l'evidence trail gagne**
- Tukio soumet le dossier à Stripe sous 48 h
- Stripe tranche **en faveur de Marc** : la cliente avait signé la livraison ET laissé un avis 5★. Pas de remboursement, dispute close.
- Marc reçoit un email de Tukio : *"Votre evidence trail a permis de gagner cette dispute. Aucun impact sur vos payouts futurs."*

**Resolution — la confiance dans la plateforme**
- Marc réalise que sans Tukio, il aurait perdu 1 200 € sur un simple e-mail à sa banque. Sa loyalty plateforme augmente.

**Capabilities révélées** : evidence trail systématique (R9 mitigation), audit trail messagerie immuable, intégration disputes Stripe → endpoint webhook unique `payment-svc`, photos uploadées dans messagerie comme preuves, signature électronique livraison (V1), workflow contestation guidé pour le pro.

---

### J5 — Une admin valide un nouveau pro (admin-support, MVP)

**Persona** : Léa, 28 ans, admin-support Tukio. Elle traite la file `pending_admin_review` chaque matin. Objectif < 24 h de délai moyen.

**Opening Scene**
*9h05. Léa ouvre `admin.tukio.one/verifications` (sous-domaine séparé, MFA TOTP obligatoire).*

**Rising Action**
- File d'attente : 3 dossiers à traiter. Elle ouvre le premier : "Pornichet Events / Marc D."
- `admin.tukio.one/verifications/{id}` : SIRET vérifié auto via API INSEE, RIB extrait pour vérification cohérence, pièce d'identité en image, photo profil, bio
- Elle compare le SIRET avec la raison sociale → match
- Pièce d'identité lisible, conforme. Bio sobre, pas d'éléments alarmants.

**Climax — la décision**
- Léa clique "Valider" + ajoute une note interne : "SIRET vérifié, KYC OK, 1ère catégorie tentes"
- Action loggée dans audit trail immuable (table `admin_actions` côté `identity-svc`)
- Event NATS `admin.action.pro_verified.v1` émis → consommé par `notification-svc` (email Resend FR au pro) + `identity-svc` (mirror status `verified`)

**Resolution**
- Marc reçoit son email de validation 18 h après inscription. Léa traite ses 2 autres dossiers en 12 min.

**Capabilities révélées** : sous-domaine `admin.tukio.one` séparé, MFA admin obligatoire, workflow pro verification queue, audit trail immuable des actions admin (event `admin.action.*.v1`), templates email transactionnels par locale, RBAC granulaire Keycloak (`admin-support` peut valider mais pas suspendre).

---

### J6 — Litige booking-payment partiellement échoué (admin-modo, edge case ops)

**Persona** : Yann, 32 ans, admin-modo (rôle plus senior que admin-support). Alerté par Slack à 14h32 : *"Saga booking-payment échouée pour booking 7a2e8f, > 5 min."*

**Opening Scene — la production sous tension**
*Yann ouvre `admin.tukio.one/transactions/bookings/7a2e8f`. La saga a échoué entre `payment.intent.captured.v1` (OK) et `booking.confirmed.v1` (jamais émis). Le client a été débité, mais le booking est resté en `pending_pro_acceptance`.*

**Rising Action — l'investigation**
- Yann consulte le dashboard observabilité (Prometheus + Tempo) : `booking-svc` a crashé pendant 90 secondes (OOM kill). Le replay automatique a tenté 3 fois sans succès car l'event était dans la DLQ.
- Il vérifie l'inbox table de `booking-svc` : event `payment.intent.captured.v1` présent, pas encore traité.
- Il clique "Replay event" dans `admin.tukio.one/transactions/disputes/{id}` (outil admin sécurisé V1) → l'event est ré-injecté dans le NATS stream
- `booking-svc` consomme, émet `booking.confirmed.v1` → saga complète

**Climax — la résolution**
- Le pro reçoit son email de notification "Nouvelle demande" 10 min après le crash original (au lieu de 30 secondes nominales)
- Le client n'a aucune visibilité du problème. Tout fonctionne pour lui.
- Yann ferme l'incident, log la cause (OOM kill `booking-svc`), crée un ticket d'augmentation de mémoire pour les pods K8s.

**Resolution — la mitigation R11 a fonctionné**
- L'alerte (saga > 5 min) a déclenché à temps. L'evidence trail (logs centralisés + correlation IDs) a permis de comprendre en < 10 min. Le replay manuel a évité tout impact client.

**Capabilities révélées** : saga choréographée avec correlation IDs (ADR-006), monitoring NATS consumer lag + outbox lag (R12, R13), DLQ stream dédié, alertes admin sur sagas bloquées > 5 min (R11), outil admin "Replay event" (V1, sensible 🔴, audit obligatoire), observabilité OpenTelemetry + Tempo, RBAC `admin-modo` peut faire ces actions, `admin-support` non.

### Journey Requirements Summary

Les 6 journeys ci-dessus révèlent les **familles de capabilities** que le PRD doit expliciter dans la suite (Functional Requirements, Domain Requirements, Technical Requirements). Synthèse :

| Capability area | Journeys concernés | Couvert par services |
|-----------------|--------------------|--------------------|
| **Search & discovery** (faceted, geo, locale-aware) | J1 | `catalog-svc` + Meilisearch |
| **Listing publication & onboarding pro** | J3, J5 | `catalog-svc`, `media-svc`, `identity-svc` + Keycloak |
| **Booking lifecycle** (request → accept → confirm → complete) | J1, J2, J3, J6 | `booking-svc` + `order-svc` |
| **Payment** (capture différée, refund, dispute, payout) | J1, J2, J4 | `payment-svc` + Stripe Connect Express |
| **Messaging** (lié à booking, anti-désintermédiation, evidence trail) | J1, J2, J3, J4 | `messaging-svc` |
| **Reviews** (1-5, demande automatique, modération a posteriori) | J1, J2 | `review-svc` |
| **Notifications** (email FR/EN, in-app V1, push V2) | Tous | `notification-svc` + Resend |
| **Admin moderation** (pro verification, dispute mediation, replay event) | J5, J6 | distribué + `gateway-api` (RBAC) + table audit `identity-svc` |
| **i18n** (locale detection, content translations, email per locale) | Tous | front `next-intl` + `catalog-svc` translations + `notification-svc` templates |
| **Observability & resilience** (alertes saga, NATS lag, outbox lag) | J6 | OpenTelemetry + Prometheus + Tempo cross-service |
| **Audit trail immuable** | J5, J6 | event `admin.action.*` consommé par `identity-svc` |
| **RBAC granulaire** (super/modo/support, customer/pro) | J5, J6 | Keycloak roles + `gateway-api` enforcement |

**Journeys implicites V1+** non détaillés ici mais à couvrir dans le PRD :

- **C2 Office Manager** organisant un séminaire B2B avec panier multi-vendeurs (V1)
- **P3 Pro saisonnier** sur tier Starter (V1)
- **Pro qui passe Starter → Business** via `/fr/seller/subscription/change` (V1)
- **Client qui devient pro** (conversion compte, ajout role Keycloak `pro`)
- **Admin-super** qui crée un autre admin, suspend / banne un user, audit trail consultation
- **Apporteur d'affaires B2B** (wedding planner partner) avec dashboard dédié (V1)
- **Workflow litige V1 complet** : ouverture → médiation 48 h → résolution → clôture (réouverture 15 j possible)

## Domain-Specific Requirements

> Tukio.one est classifié `general` (e-commerce / marketplace) côté taxonomie BMad, mais sa complexité réelle est **medium-high** à cause de 8 drivers structurants documentés ci-dessous. Cette section consolide les contraintes domaine que tous les requirements downstream (functional, technical, security) doivent respecter.

### Compliance & Regulatory

#### Statut juridique de la plateforme — hybride hébergeur LCEN + tiers de confiance

- Tukio se positionne comme **hébergeur LCEN** par défaut, avec **modération a posteriori uniquement** (signalements → admin queue → décision graduée). Cf. spec v2.2 Q10.
- **PAS de modération pré-publication systématique** : sinon bascule en statut éditeur, responsabilité accrue (R2 critique).
- **Audit avocat numérique obligatoire avant le lancement** pour valider ce positionnement hybride et figer les CGU/CGV en conséquence.
- Sur les paiements, Tukio est **tiers de confiance** : capture Stripe au nom du pro, mandat de facturation art. 289 CGI signé à l'onboarding, reversement automatique J+1.

#### TVA & facturation marketplace (R1 critique)

- **Mandat de facturation art. 289 CGI** signé à l'onboarding pro : Tukio émet la facture **au nom du pro**.
- **3 cas TVA gérés** :
  - Pro non-assujetti (franchise en base) : TVA non applicable, mention "TVA non applicable, art. 293 B du CGI"
  - B2C client français : TVA française du pro applicable
  - B2B intra-UE : autoliquidation client, TVA non collectée (avec validation numéro de TVA intracommunautaire)
- **Audit expert-comptable spécialisé marketplace OBLIGATOIRE avant V1** (500-1 500 €) — risque #1. Couvre : conformité mandat, traitement TVA par cas, retenue à la source pros étrangers (V3+), IRPP/BIC pros particuliers, tenue des registres marketplace.
- **Conservation factures : 10 ans** (obligation légale FR).

#### RGPD & données personnelles

- **Stack analytique RGPD-compliant** : Plausible (sans cookies, hosting EU), PostHog (hosted EU, opt-in session replay uniquement), Brevo FR (email marketing V1).
- **Politique de confidentialité** claire et accessible — versionnée FR + EN dès le MVP (FR fait foi juridiquement).
- **DPO désigné** (interne ou externe) avant lancement.
- **Soft-delete** sur les comptes utilisateur : conservation données comptables 10 ans (obligation), **anonymisation** des données perso au-delà du délai utile (R10 mitigation).
- **Droits utilisateurs** (accès, rectification, effacement, portabilité) — workflow admin V1.
- **Consentement explicite** pour cookies, finalités marketing, session replay PostHog.
- **PII redaction** systématique sur les logs centralisés.

#### Conformité paiement (PSD2 indirect via Stripe Connect Express)

- **Stripe Connect Express** délègue le KYC financier des pros à Stripe → conformité PSD2 simplifiée.
- **3DS Secure** obligatoire sur les paiements EU > 30 € (géré nativement par Stripe Elements).
- **Mandat SEPA** non utilisé au MVP (carte uniquement).
- **PCI-DSS** : Tukio ne touche jamais aux numéros de carte (Stripe Elements iframe) → scope SAQ-A minimal.

#### Conformité sectorielle

- **CGU / CGV / Politique de confidentialité / Mentions légales** dès le MVP, versionnés FR + EN (la version FR fait foi juridiquement, l'EN est traduction d'information).
- **Bannissement utilisateur** : conservation hash IP / email / téléphone pour anti-recréation (légal sous 6 ans, à valider avocat).
- **Audit trail immuable** des actions admin (table append-only `admin_actions` côté `identity-svc`, alimentée par events NATS `admin.action.*.v1`) — preuves en cas de litige ou contrôle.

### Technical Constraints

#### Sécurité

- **HTTPS/TLS partout** (HSTS activé, redirect HTTP → HTTPS systématique).
- **mTLS inter-services** en production (gateway-api ↔ services downstream).
- **JWT Keycloak RS256** validé via JWKS cache 10 min côté `gateway-api` ; re-vérification defence-in-depth dans chaque service downstream.
- **MFA TOTP obligatoire** pour tous les comptes admin dès leur création.
- **0 secret en clair** : secrets management via Kubernetes Secrets + vault (Doppler/AWS Secrets Manager à figer Sprint 0).
- **Rate limiting** centralisé sur `gateway-api` (par IP + par user authentifié).
- **Anti-désintermédiation** : coordonnées client masquées avant acceptation pro ; détection regex emails/téléphones dans `messaging-svc` V1 (config centralisée dans `@tukio/contracts`).
- **eslint-plugin-boundaries** dès Sprint 0 : pas d'import cross-bounded-context dans le code.

#### Privacy & data handling

- **Database per service** (ADR-003) : isolation stricte des données entre domaines (booking ne lit pas `users`, etc.).
- **Chiffrement at-rest** des pièces d'identité KYC pros (Cloudflare R2 server-side encryption).
- **Logs sans données perso** : PII redaction côté `gateway-api` et `notification-svc`.
- **Cookies** : Plausible n'en pose aucun. PostHog : opt-in explicite. Brevo : opt-in marketing strictement (RGPD).

#### Performance

- **Latence p95 search Meilisearch < 150 ms** (1 index par locale, mémoire pré-warmée).
- **Core Web Vitals** : LCP < 2,5 s, INP < 200 ms, CLS < 0,1 (impact direct ranking SEO).
- **Capture différée Stripe** sub-seconde (PaymentIntent confirm < 800 ms p95).
- **NATS JetStream consumer lag** : alerte > 1 000 messages ; cible fonctionnement nominal < 100.
- **Outbox relay PG LISTEN/NOTIFY** : alerte > 100 messages pending > 1 min ; fallback polling 30 s en cas de panne.

#### Disponibilité

- **gateway-api** : 99,5 % MVP, 99,9 % V1+.
- **payment-svc** : déploiement dédié dès la production (isolation sécurité PCI-DSS-adjacent).
- **NATS JetStream** : replicas R3 en prod, DLQ stream dédié, monitoring consumer lag (R12 mitigation).
- **Saga booking-payment** : alerte si bloquée > 5 min ; tests chaos en CI obligatoires (R11 critique).
- **Backup PostgreSQL** : daily snapshot + WAL archiving, RPO < 5 min, RTO < 1 h.

### Integration Requirements

| Intégration | Service Tukio | Critique | Notes |
|-------------|---------------|----------|-------|
| **Stripe Connect Express** | `payment-svc` | 🔴 | Webhooks unique endpoint sur `payment-svc`, transformés en events NATS pour les autres services. KYC financier délégué. |
| **Stripe Billing** | `payment-svc` | 🔴 (V1) | Subscription tiers Starter/Business/Enterprise. Tier dérivé de l'état Stripe (jamais l'inverse). |
| **Stripe Identity** | `identity-svc` | 🟠 (V1) | KYC complet pro V1. Au MVP : docs manuels uploadés, validation admin. |
| **Keycloak 25** (Phasetwo managé MVP) | `identity-svc` + `gateway-api` | 🔴 | OIDC RS256, social login Google + Apple V1, SAML V2 Enterprise. Webhooks → identity-svc pour mirror profil métier. |
| **Cloudflare R2 + Cloudflare Images** | `media-svc` | 🟠 | Stockage objet médias + CDN + transformations à la volée. |
| **Resend** | `notification-svc` | 🟠 | Emails transactionnels FR + EN (templates par locale dès MVP). |
| **Brevo** (V1+) | `notification-svc` | 🟡 | Emails marketing FR + EN, sync contacts opt-in idempotent. |
| **Meilisearch** (1 index par locale) | `catalog-svc` | 🔴 | Sync via consumer NATS sur events `catalog.listing.translation.published.v1`. Managed Cloud (~30 €/mois) ou self-hosted Docker. |
| **API INSEE SIRENE** | `identity-svc` (validation pro) | 🟢 | Vérification SIRET à l'onboarding (auto-check). |
| **Plausible** | front public | 🟡 | Web analytics RGPD. Pas d'intégration backend, juste script tag (privacy-first). |
| **PostHog** (hosted EU) | front + `gateway-api` | 🟠 | Product analytics, funnels, A/B. Server-side via gateway pour fiabilité ad-block. |
| **DeepL ou GPT-4** (V1+) | `catalog-svc` (translation auto) | 🟡 | Pré-remplissage auto traductions FR → EN, pro édite/valide. K-14. |

#### Architecture des intégrations critiques

- **Webhooks externes** : un seul endpoint par fournisseur, hébergé dans le service "owner" (Stripe → `payment-svc`, Keycloak → `identity-svc`). Transformation en events NATS internes.
- **Aucune intégration externe sortante** ne contourne `gateway-api` côté frontend (CSP stricte).
- **Retries exponentiels** sur tous les appels externes critiques (Stripe API, Resend, Meilisearch sync) avec circuit breaker (timeout 3 s côté gateway).

### Risk Mitigations (synthèse domaine)

#### Risques critiques 🔴

- **R1 — TVA marketplace mal conforme** → Audit expert-comptable spécialisé avant V1 (500-1 500 €). Mandat art. 289 CGI signé à l'onboarding. 3 cas TVA gérés explicitement dans `order-svc`.
- **R2 — Statut éditeur LCEN involontaire** → Pas de modération pré-publication systématique (auto-publication si pro `verified` > 30 j ET < 3 signalements). Audit avocat numérique avant lancement.
- **R11 — Saga booking-payment partiellement échouée** → Tests chaos en CI, replay possible via outil admin (V1, sensible 🔴, audit obligatoire), monitoring inbox/outbox lag, alertes admin > 5 min.

#### Risques élevés 🟠

- **R3 — Concentration GMV sur peu de pros** → Métrique de concentration top 10 surveillée hebdo, diversification active de l'offre (sourcing nouveaux pros si déséquilibre).
- **R4 — Cold-start côté offre** → Sourcing pro physique en PdL — 50 premiers pros recrutés en main propre par le founder.
- **R5 — Race conditions sur dispos** → 3 layers : Redis lock distribué + DB exclusion constraint + optimistic locking applicatif.
- **R12 — NATS JetStream perte de message** → Replicas R3 en prod, DLQ stream dédié, monitoring consumer lag (alerte > 1 000 msg).
- **R13 — Outbox relay (PG LISTEN/NOTIFY) en panne** → Healthcheck dédié, fallback polling 30 s, alerte si > 100 messages outbox `pending` depuis > 1 min.
- **R15 — Coût opérationnel des 10 services dès MVP** → Co-localisation 1 cluster K8s/namespace au MVP (3 unités de déploiement). Séparer par traffic uniquement quand bottleneck mesuré.
- **RA1 — Acquisition demande échoue** (risque opérationnel #1) → Stratégie formalisée dans `tukio_strategie_acquisition.md`. Mix 3 leviers MVP (bouche-à-oreille + SEO foundation + payant test). Sourcing physique côté demande aussi (Salons Mariage Nantes/Angers, partenariats lieux de réception).

#### Risques moyens 🟡

- **R6 — Anti-désintermédiation insuffisante** → Coordonnées masquées avant acceptation pro. Détection regex emails/téléphones en messagerie V1, config centralisée `@tukio/contracts`.
- **R7 — Stripe Connect KYC long (1-7 j)** → UX d'attente claire, possibilité de préparer fiches en parallèle (pas bloqué tant que dossier non validé).
- **R8 — Sync Keycloak ↔ identity-svc drift** → Webhooks Keycloak + job de réconciliation quotidien (compare Keycloak users vs identity-svc profiles, alerte si drift).
- **R9 — Disputes Stripe (chargebacks) tardifs** → Evidence trail systématique : avis, échanges messagerie, photos livraison, signature électronique V1.
- **R10 — RGPD vs conservation comptable 10 ans** → Anonymisation des données perso au-delà du délai utile, conservation sélective des données comptables.
- **R14 — Database per service complexité opérationnelle** → MVP : 10 databases logiques sur 1 instance Postgres physique. Backup unifié. Séparer en instances dédiées seulement si bottleneck mesuré.

### Domain Patterns à respecter (résumé pour les requirements downstream)

- **Two-sided marketplace cold-start** : prioriser l'offre physique founder-led en MVP, puis basculer sur la demande (acquisition formalisée). Suivi quotidien du ratio offre/demande par catégorie ; frein actif sur ads si déséquilibre.
- **Capture différée + reversement J+1** : pattern marketplace standard pour résoudre la confiance bilatérale (client paie en autorisation, pro accepte avant capture, reversement après livraison).
- **Mandat de facturation art. 289 CGI** : pattern standard marketplace FR pour émettre les factures au nom du pro tout en simplifiant la conformité TVA.
- **Database-per-service avec event sourcing partiel** (outbox + inbox) : pattern microservices standard pour cohérence éventuelle sans coupling fort.
- **Saga choréographée pour transactions distribuées** : pattern recommandé pour 4-5 étapes, à upgrader vers orchestrator (Temporal) si > 8 étapes ou besoin de vue centralisée d'état.
- **i18n par locale-prefix + tables de traductions** : pattern Next.js + `next-intl` standard, scalable vers V3+ autres langues sans migration destructive.
- **Audit trail immuable append-only** pour actions sensibles admin : pattern conformité standard.

### Anti-patterns à éviter (issus du brief et du tech alignment)

- ❌ Modération pré-publication systématique (bascule éditeur LCEN)
- ❌ Coordonnées client visibles avant acceptation pro (désintermédiation)
- ❌ Pay-to-rank pur (boost oui, mais transparent et limité avec badge)
- ❌ Frais cachés découverts au checkout (cf. tendance FTC junk-fee)
- ❌ Engagement sur abonnements (résiliation libre fin de période, RGPD-friendly)
- ❌ Cross-service joins SQL ou tables partagées (ADR-003)
- ❌ HTTP-to-HTTP entre services downstream (sauf exception booking → catalog dispo temps réel)
- ❌ Webhook Stripe dans plusieurs services (un seul endpoint dans `payment-svc`)
- ❌ Texte hardcodé dans le frontend (ADR-012 i18n)
- ❌ Paths URL en français (cf. `tukio_information_architecture.md` §C, paths EN strict)
- ❌ Stockage `title` / `description` mono-colonne sur `listings` (utiliser `listing_translations` K-13)

## Web Application Specific Requirements

### Project-Type Overview

Tukio.one est une **web application Next.js 15 (App Router)** déployée en **hybride SSR + client components** :

- **Pages publiques** (homepage, search, fiches catégories/services/pros, blog, légal) → SSR avec server components Next.js 15. Critique pour SEO (RA1 = risque opérationnel #1, le SEO doit fonctionner dès le mois 1).
- **Espaces connectés** (`/account/*`, `/seller/*`) → mix client components + server components selon les besoins (interactivité riche + auth-gated content).
- **Console admin** (sous-domaine séparé `admin.tukio.one`) → desktop-only au MVP, layout sidebar + content (cf. design brief §H.4).
- **PWA** ajoutée en V1 (manifest, service worker, install prompt côté pro pour usage terrain).
- **Application mobile native** (iOS + Android) en V2 via React Native ou Flutter, **priorité côté pro** (gestion mobile sur le terrain : confirmations, photos livraison, signatures).

### Technical Architecture Considerations

#### Stack frontend

- **Next.js 15** (App Router) avec React 19, TypeScript end-to-end
- **`next-intl`** pour i18n FR + EN (ADR-012) — locale-prefix URL `/{locale}/...`, messages JSON par locale, server components-aware
- **Tailwind CSS** pour le design system (palette terracotta du design brief), **shadcn/ui** ou équivalent pour la lib de composants accessibles
- **Lucide** pour l'iconographie standard, picto custom SVG pour les catégories événementielles spécifiques
- **Fraunces** (Google Fonts, variable) pour les titres display, sans-serif lisible (à figer designer) pour le body
- **PostHog SDK** côté client pour product analytics, **Plausible** script tag pour web analytics RGPD
- **Stripe Elements** (iframe) pour le tunnel checkout (`/cart/checkout`) — Tukio ne touche jamais aux numéros de carte, scope PCI SAQ-A minimal
- **WebSocket client** pour la messagerie temps réel (sync via Redis pub/sub côté `messaging-svc`)
- **Zod** pour la validation côté client + serveur (cohérent avec `@tukio/contracts` côté backend)

#### Stack frontend — anti-patterns

- ❌ Pas de Redux / Zustand global au MVP — privilégier React Query (TanStack Query) pour le state serveur + useState/useReducer pour le state local
- ❌ Pas de CSS-in-JS runtime (styled-components, emotion) — Tailwind statique pour préserver les Core Web Vitals
- ❌ Pas de `next-i18next` (deprecated pour App Router) — `next-intl` est la stack figée
- ❌ Pas de bundling de strings UI dans les composants — tout passe par `useTranslations()` de `next-intl`
- ❌ Pas de "use client" abusif — préférer server components quand possible (SSR + plus rapide)

### Browser Matrix

**Stratégie** : evergreen browsers uniquement. Pas de support legacy IE / Safari < 16.

| Browser | Versions supportées | Notes |
|---------|---------------------|-------|
| Chrome / Chromium-based (Edge, Opera, Brave, Arc) | Last 2 versions | Marché majoritaire desktop + Android |
| Firefox | Last 2 versions | Desktop |
| Safari | iOS 16+, macOS Safari 16+ | Marché Apple critique pour cible CSP+ |
| Samsung Internet | Last 2 versions | Marché Android secondaire |
| **Internet Explorer** | ❌ Non supporté | EOL Microsoft 2022, 0 % de la cible Tukio |
| **Safari < 16** | ❌ Non supporté | Manque de fonctionnalités modernes (CSS nesting, Container Queries) |

**Test matrix CI** :
- Playwright tests sur Chromium + Firefox + WebKit (équivalent Safari) pour les parcours critiques (search, checkout, onboarding pro)
- BrowserStack ou équivalent pour validation manuelle pré-release sur Safari iOS réel

### Responsive Design

**Approche : mobile-first, mais desktop critique** (cf. design brief §F).

Usage différencié à respecter :
- **Pros sur le terrain** = mobile (livraisons, montages, consultation rapide depuis chantier)
- **Clients en décision** = desktop fréquent (mariage = recherche le soir sur ordinateur) + mobile en croissance
- **Admins** = desktop only

**Breakpoints figés** (Tailwind tokens cohérents avec design brief §F) :

| Token | Range | Cible |
|-------|-------|-------|
| `xs` | 0 - 480px | Petits mobiles (rare cible spécifique) |
| `sm` | 481 - 640px | Mobiles standards |
| `md` | 641 - 1024px | Tablettes |
| `lg` | 1025 - 1280px | Desktop standard |
| `xl` | 1281 - 1536px | Large desktop |
| `2xl` | 1537+ | Très grands écrans |

**Layout container** :
- Mobile / tablet : 100 % avec padding 16-24 px
- Desktop (`lg`) : max-width 1 200 px
- Wide (`xl+`) : max-width 1 400 px
- **Jamais de full-width 1 920 px+** (illisible, perd cohérence visuelle)

**Touch targets** : minimum **44 × 44 px** pour toute zone tappable sur mobile (Apple HIG / WCAG 2.1 AA).

### Performance Targets

#### Core Web Vitals (impact direct ranking SEO)

- **LCP** (Largest Contentful Paint) : **< 2,5 s** sur 4G mobile
- **INP** (Interaction to Next Paint) : **< 200 ms**
- **CLS** (Cumulative Layout Shift) : **< 0,1**

Vercel + Next.js gèrent nativement, mais à monitorer via Search Console + Lighthouse CI sur chaque PR.

#### Latences fonctionnelles

- **Search Meilisearch p95** : < 150 ms (1 index par locale, mémoire pré-warmée)
- **Page server-side rendering p95** : < 800 ms (incluant fetch des données via gateway-api)
- **Stripe Elements load** : < 1 s (iframe lazy-loaded au moment du checkout)
- **WebSocket message delivery p95** : < 200 ms (Redis pub/sub local)
- **Image LCP** : Cloudflare Images avec format auto (AVIF si supporté, WebP fallback), srcset responsive, lazy loading sauf hero image above-the-fold

#### Bundle size budgets

- **Initial JS bundle** (homepage non connectée) : < 150 KB gzipped
- **Initial CSS** : < 20 KB gzipped
- **Total page weight homepage** : < 1,5 MB (incluant images)
- **Code splitting** par route (Next.js App Router le fait nativement) — aucun chunk > 200 KB gzipped sans justification

#### Caching strategy

- **Static assets** (JS, CSS, fonts, images) : `Cache-Control: public, max-age=31536000, immutable`
- **HTML pages publiques** (catégories, services, pros) : `Cache-Control: public, max-age=60, stale-while-revalidate=300` côté Vercel edge
- **Espaces connectés** : `Cache-Control: private, no-store` (jamais cachés)
- **API responses** via `gateway-api` : ETag + If-None-Match ; cache léger sur les endpoints idempotent (catalog search, listing detail public)

### SEO Strategy

> Synthèse opérationnelle de `tukio_strategie_acquisition.md` §C + ADR-012 i18n.

#### Pages cibles SEO (paths EN, locale-prefix)

```
/{locale}/                                          # homepage par locale
/{locale}/search                                    # résultats de recherche
/{locale}/category/{slug}                           # ex: /fr/category/location-tentes-chapiteaux
/{locale}/category/{slug}/{city}                    # ex: /fr/category/.../nantes (V1, généré auto si > 3 pros)
/{locale}/service/{slug}                            # ex: /fr/service/chapiteau-100m2-blanc-chic-pornichet
/{locale}/pro/{slug}                                # ex: /fr/pro/event-co-nantes
/{locale}/blog/{slug}                               # blog éditorial V1
```

#### Critères SEO non négociables

- **Slugs FR + EN distincts** stockés en table `<entity>_translations` (K-13). Ex : `/fr/service/chapiteau-100m2` ≠ `/en/service/100m2-elegant-marquee`.
- **Hreflang systématique** (`<link rel="alternate" hreflang="fr" href="...">`, `hreflang="en"`, `hreflang="x-default"`) pour signaler les versions linguistiques à Google.
- **Meta tags dynamiques par page et par locale** via Next.js `<Metadata>` server-side, avec `alternates.languages`.
- **Sitemap XML segmenté par locale + type d'entité** : `sitemap-services-fr.xml`, `sitemap-services-en.xml`, `sitemap-pros-fr.xml`, etc., référencés dans `sitemap.xml` racine. Mise à jour quotidienne.
- **Schema.org JSON-LD** : `Service`, `LocalBusiness`, `BreadcrumbList`, `AggregateRating` (sur les fiches pros avec reviews), `Organization` (homepage). Critique pour rich snippets Google.
- **`robots.txt`** : autorise tout `/{locale}/...` indexable, bloque `/account/*`, `/seller/*`, `admin.*` (`noindex` headers en backup).
- **Reserved slugs** anti-collision routes : `search`, `category`, `service`, `pro`, `account`, `seller`, `cart`, `help`, `blog`, `pricing`, `sell`, `about`, `contact`, `terms`, `sales-terms`, `privacy`, `cookies`, `legal`, `api`, `auth`, `admin`, `static`, `www`, `fr`, `en` (table `reserved_slugs`).
- **Stable URLs** : un slug ne change pas après publication. Modification → conservation ancien slug avec redirect 301.

#### SEO local (Google Business Profile)

- Création GBP "Tukio" en tant que plateforme de services événementiels avec adresse Nantes
- Posts hebdomadaires (nouveautés catalogue, actualités)
- Encourager les premiers clients à laisser un avis Google **en plus** de l'avis Tukio
- Lever facile et gratuit que beaucoup de marketplaces oublient

#### Backlinks (link building V1)

- **Médias locaux PdL** : Ouest-France, Presse Océan, Wik, Le Journal des Entreprises Pays de la Loire
- **Annuaires pros** : Pages Jaunes, Yelp, Google Business Profile (déjà cité)
- **Partenariats croisés** : MOU avec mairies pour leurs guides "fêter votre événement à X", associations de wedding planners
- **Relations presse** : pitch à 2-3 médias clés au lancement, puis 1 fois par trimestre
- ❌ Pas d'achat de backlinks, pas d'échanges artificiels (pénalités Google).

#### Volume éditorial

- **MVP** : 2 articles blog/mois (~24 articles à fin d'année 1)
- **V1** : 4 articles/mois (cible 100+ articles indexés à fin V1)
- **Format** : 1 500 - 2 500 mots, structure claire (H1, H2, H3 hiérarchisés), images optimisées (WebP, alt text), liens internes vers fiches services/pros (maillage)
- **Templates récurrents** : "Comment organiser X en Y", "Combien coûte X", "Les N meilleurs Y", checklists téléchargeables (CTA email capture)
- ❌ **Pas de contenu IA pur** (Helpful Content Updates Google de plus en plus stricts)

#### Référencement EN

L'app est non internationalisée géographiquement au MVP, mais le SEO EN cible :
- Anglophones résidant en France (à valider sur les premières données réelles)
- Early signal pour V3+ international (Belgique → Suisse → Maroc)

### Accessibility Level

**Cible : RGAA niveau AA** (équivalent WCAG 2.1 AA).

Justification : obligation légale en France au-delà d'un certain seuil de CA (et bonne pratique générale). Le marketplace doit être accessible à tous les organisateurs et pros, indépendamment de leurs capacités.

#### Règles non négociables (cf. design brief §G)

**Contraste**
- Texte normal : ratio **≥ 4,5:1**
- Texte large (≥ 18 pt ou 14 pt bold) : **≥ 3:1**
- UI components / icônes : **≥ 3:1**
- Vérifier la palette terracotta avec un outil (Stark, Contrast.app). Le `cream-50` × `charcoal-700` doit passer largement.

**Navigation clavier**
- Tous les éléments interactifs accessibles au Tab
- Focus ring visible (jamais `outline: none` sans alternative `focus-visible`)
- Ordre logique du Tab
- **Skip links** en haut de page

**Screen readers**
- HTML sémantique (`<button>`, `<nav>`, `<main>`, `<article>`, `<aside>`, …)
- ARIA quand nécessaire (mais pas en remplacement du sémantique)
- `alt` text obligatoire sur toutes les images de contenu
- `aria-label` sur les icon buttons

**Pas d'info uniquement par couleur**
- Une erreur ne se signale pas que par "rouge" — toujours icône + label texte
- Une dispo "complet" ne se signale pas que par couleur calendrier — texte "Complet" ou hachures

**Mouvements & motion**
- Respecter `prefers-reduced-motion` : désactiver animations non essentielles
- Pas de flash > 3 fois par seconde

**Touch targets** : 44 × 44 px minimum (WCAG 2.1 AA + Apple HIG)

#### Validation accessibility

- **axe-core** intégré aux tests Playwright sur les parcours critiques (CI)
- **Lighthouse Accessibility audit** sur chaque PR (score ≥ 90)
- **Audit manuel RGAA** par un expert avant le lancement public (V0 release)
- **Tests utilisateurs** avec personnes en situation de handicap en V1

### Real-time Features

- **Messagerie chat client ↔ pro** lié à un booking : WebSocket via `messaging-svc`, sync via Redis pub/sub. Latence p95 < 200 ms.
- **Calendrier dispo en temps réel** sur les fiches services : 3 layers de protection contre les race conditions (Redis lock distribué + DB exclusion constraint + optimistic locking applicatif). Cohérent avec ADR R5.
- **Notifications in-app** (cloche 🔔) en V1 — push WebSocket via `notification-svc`. Au MVP : email-only.
- **Web push** en V1 (PWA) ; **Mobile push** en V2 (app native).
- **Statut de saga** mis à jour en temps réel pour le client pendant le checkout (capture en cours → confirmation reçue) — UX rassurante en cas de latence Stripe.

### UX Writing — voix & ton

> Référence canonique : `tukio_design_brief.md` §I. À respecter strictement dans tous les messages UI, emails, microcopy.

- **Vouvoiement systématique** — Pas de "tu" **même côté client B2C**. C'est une marketplace de transactions sérieuses (corrige une erreur du brief v0.3 §8 qui parlait de tutoiement côté pro).
- **Direct et clair** — pas de blabla. *"Réservez maintenant"* > *"Démarrez votre aventure événementielle"*.
- **Chaleureux mais pas familier** — *"Bonjour Jean"* > *"Salut Jean !"*. Pas d'émojis dans l'UI.
- **Pas de jargon SaaS** — "Tableau de bord" > "Dashboard", "Démarrage" > "Onboarding", "Paiement" > "Checkout", "Paramètres" > "Settings", "Annonce/Service" > "Listing".
- **Pas de jargon métier non expliqué** côté client (ne pas dire "KYC" au client B2C).

### Implementation Considerations

#### Sprint 0 livrables frontend

- Setup Next.js 15 (App Router) + TypeScript strict + Tailwind + shadcn/ui (ou équivalent)
- Setup `next-intl` avec messages `messages/fr.json` + `messages/en.json` vides à initialiser
- Setup Plausible + PostHog (1 j chacun)
- Setup Stripe Elements integration côté front
- Setup design tokens (palette terracotta, typo Fraunces) en variables Tailwind
- Setup tests Playwright avec axe-core integration
- Setup Lighthouse CI dans le pipeline GitHub Actions
- Initialiser sitemap XML generator + robots.txt + Schema.org JSON-LD helpers
- Setup `<Metadata>` server-side avec `alternates.languages` automatique

#### Skip sections (pas pertinent pour Tukio)

- ❌ **Native features** (camera, GPS device API, etc.) → pas de mobile native au MVP/V1, V2 seulement
- ❌ **CLI commands** → pas applicable (web app, pas un dev tool)

#### Anti-régressions critiques

- Tout PR qui ajoute une page **DOIT** ajouter ses traductions dans `messages/fr.json` + `messages/en.json` (CI check)
- Tout PR qui modifie une route critique (search, checkout, onboarding) **DOIT** passer les tests Playwright + axe-core (CI gate)
- Tout PR qui ajoute une image **DOIT** avoir `alt` text non-vide (lint rule)
- Tout PR qui modifie un schéma `<entity>_translations` **DOIT** documenter la migration (review obligatoire)

## Project Scoping & Phased Development

> Le détail fonctionnel par phase est déjà dans la section "Product Scope" plus haut. Cette section consolide la **stratégie scoping**, les **hypothèses de ressources**, et la **logique risk-based** qui justifient les boundaries entre MVP / V1 / V2 / V3+.

### MVP Strategy & Philosophy

**Approche MVP : Validation MVP (avec biais Revenue MVP).**

Le brief §13 le formule explicitement : *"Hypothèse à valider : des pros sont prêts à payer une commission pour des leads qui se convertissent en réservations payées sur la plateforme."* Le MVP n'est pas un *Experience MVP* (faire kiffer les premiers users) ni un *Platform MVP* (poser les rails techniques) — c'est un **MVP de validation business** avec un critère de sortie chiffré : 50 pros actifs (≥ 1 résa chacun) + 100 réservations payées sans litige bloquant.

**Le minimum qui ferait dire :**
- *aux clients* : "Ah, je peux vraiment réserver un chapiteau avec paiement sécurisé en 5 minutes ?" → search + fiche service riche + tunnel checkout Stripe + capture différée
- *aux pros* : "Tukio m'amène des leads qualifiés et me paie en J+1, sans paperasse." → onboarding KYC light + dashboard pro + acceptation booking + reversement automatique
- *à un investisseur / banquier* : "C'est une marketplace transactionnelle qui fonctionne, avec take rate 10 % et économie unitaire saine." → 50 pros payants + 100 résa + CAC pro mesuré soutenable + NPS > 40

**Le fastest path to validated learning** est cohérent avec la stratégie **founder-led territoriale** : sourcing pro physique (50 pros recrutés en main propre par le founder à < 1 h de Nantes) + acquisition demande hybride (bouche-à-oreille physique + SEO foundation Sprint 0 + payant test). Aucun feature qui ne soit pas strictement nécessaire pour qu'une transaction ait lieu de bout en bout n'est dans le MVP.

**Anti-philosophy MVP** :
- ❌ Pas de "Big Bang" launch avec 10 catégories — **2 catégories pilotes** (tentes/chapiteaux + mobilier événementiel) suffisent pour valider l'hypothèse
- ❌ Pas de B2B au MVP — le B2C particulier est le segment de validation le plus rapide à activer (cycle de vente court vs B2B 3-12 mois)
- ❌ Pas de tiers d'abonnement au MVP — tout le monde sur le même plan (commission fixe 10 %), réduit la complexité produit + Stripe Billing + UI tier différencié
- ❌ Pas de panier multi-vendeurs au MVP — chaque résa = un pro (mono-vendeur), repoussé V1 quand l'architecture saga aura prouvé sa stabilité sur le mono-vendeur d'abord

### Resource Requirements

#### Équipe MVP (~3-4 mois)

| Rôle | Effectif | Source |
|------|----------|--------|
| **Founder / Product / Sales** | 1 (Ismael) | Founder-led |
| **Tech lead / Backend dev senior** | 1 | Embauche / co-founder tech |
| **Frontend dev senior** | 1 | Embauche / freelance long terme |
| **Backend dev mid** | 1 | Embauche / freelance |
| **Designer** | 0,5 ETP | Freelance (palette terracotta + UX flows déjà brieffés) |
| **Admin / modération opérationnel** | 0,5-1 ETP | À recruter dès les premières résa (vérification pros + support 1ʳᵉ ligne) |
| **Rédacteur SEO** | Variable | Freelance (~150-200 €/article, 2 articles/mois) |

**Total équipe MVP ≈ 4-5 personnes ETP** + freelances (designer + rédacteur SEO). Cohérent avec un solo founder + 1ʳᵉ levée pré-seed.

#### Équipe V1 (~+3 mois)

Ajouts :
- 1 dev backend supplémentaire (saga multi-vendor, échéanciers, B2B)
- 1 admin support supplémentaire (workflow litige V1, médiation)
- Email marketer / growth (peut être 0,5 ETP partagé)

**Total équipe V1 ≈ 6-7 personnes ETP.**

#### Équipe V2 (~+3 mois)

Ajouts :
- 1 marketer interne full-time (cf. K-09 du `tukio_strategie_acquisition.md` — "embauche marketer interne en V2 quand volume justifie un full-time")
- 1 account manager Enterprise
- 1-2 devs mobile (React Native ou Flutter)
- 1 RP / influence (peut être 0,5 ETP partagé)

**Total équipe V2 ≈ 10-12 personnes ETP.**

### Scoping Decision Framework — analyse must-have / nice-to-have par version

#### MVP — Must-have absolus (sans lesquels le MVP n'existe pas)

Pour chaque user journey couvert par le MVP (J1 client happy path, J3 pro onboarding, J5 admin verification) :

- **J1 Sophie réserve** : search Meilisearch (locale-aware), fiche service riche (3-15 photos, dispo temps réel), tunnel checkout Stripe (capture différée), email confirmation, messagerie liée à booking, demande d'avis automatique J+1
- **J3 Marc s'inscrit et reçoit sa 1ʳᵉ résa** : inscription Keycloak + email vérifié, onboarding wizard 4 étapes, KYC light + Stripe Connect Express, validation admin manuelle, dashboard pro avec to-do urgent, acceptation booking, reversement J+1
- **J5 Léa valide un pro** : sous-domaine `admin.tukio.one` séparé, MFA TOTP obligatoire, file `pending_admin_review`, action loggée dans audit trail, event NATS `admin.action.pro_verified.v1`

**Non négociable au MVP** :
- i18n FR + EN dès Sprint 0 (ADR-012 — impossible à rétro-fitter sans douleur sur le schema DB)
- Schema `acquisition_*` sur `users` + `bookings` (K-04 — idem rétro-fit impossible)
- Tracking server-side via gateway-api (résistant ad-block, base RA1)
- CGU/CGV/PC/mentions légales versionnés FR + EN (légal MVP)
- Mandat de facturation art. 289 CGI (R1 — sinon pas de monétisation conforme)
- Audit trail immuable des actions admin (R2 — preuves LCEN)

#### MVP — Nice-to-have repoussés en V1

Le brief liste ces éléments comme "exclus volontairement du MVP". Aucun n'est ré-évalué ici sans signal explicite — ils restent en V1 :

- Comptes B2B
- Devis personnalisés
- Panier multi-vendeurs
- Échéanciers / acomptes
- Subscription tiers pros
- Avis multi-critères
- App mobile native
- Programme parrainage / apporteurs

#### V1 — Must-have business (sans lesquels la monétisation n'arrive pas)

- 3 tiers d'abonnement (Starter / Business / Enterprise) — sinon pas d'inflexion business mensuelle
- Panier multi-vendeurs — sinon pas de panier moyen multi-prestataires (KPI V2)
- B2B activé — sinon le segment C2 (Office Manager) reste hors atteinte alors que son CAC est mieux toléré
- Workflow litige structuré — sinon les disputes restent ad-hoc et coûteuses
- Programme parrainage clients — sinon pas de mécanique organique de croissance demande

#### V2 — Must-have rétention (sans lesquels le rebooking ne décolle pas)

- Configurateur d'événements — différenciateur fort sur le panier moyen
- Recommandations perso — base de la rétention client (rebooking > 25 %)
- Tier Enterprise complet (SLA, AM, intégrations comptables) — sinon pas de comptes Enterprise activés
- App mobile native (priorité pro) — sinon les pros sur le terrain restent en friction
- Performance Max Google ads — sinon pas de scale acquisition

### Risk-Based Scoping

Le scoping a été conçu pour mitiger explicitement chaque grand risque identifié.

#### Risques techniques mitigés par le scoping

- **R11 saga booking-payment** : le MVP démarre **mono-vendeur** uniquement → la saga ne traverse que 3 services (booking → order → payment), pas N-vendeurs. Le multi-vendor V1 attend que la stabilité mono-vendeur soit prouvée en production sur 100+ résa.
- **R5 race conditions sur dispos** : pas de panier multi-vendeurs au MVP → les locks Redis + DB exclusion + optimistic locking sont validés sur un seul slot avant complexification.
- **R15 coût opérationnel des 10 services** : déploiement en 3 unités au MVP (core-api / workers / nats) plutôt que 10 services autonomes. Split par service uniquement quand bottleneck mesuré.

#### Risques marché mitigés par le scoping

- **RA1 acquisition demande** (risque opérationnel #1) : SEO foundation câblée dès Sprint 0 (locale-prefix, sitemap par locale, hreflang, Schema.org) — impossible à rétro-fitter avec qualité. Pages locales générées dès qu'un seuil de 3 pros par catégorie × ville est atteint. Mix budgétaire 3 leviers MVP (~3 200 €/mois).
- **R4 cold-start côté offre** : 2 catégories pilotes seulement → concentration des efforts founder-led sur tents + mobilier (forte complémentarité, panier moyen élevé). Pas de dispersion sur 10 catégories qui aurait cassé le sourcing physique.
- **R3 concentration GMV** : surveillé hebdo dès le MVP (top 10 pros < 50 % du GMV V1) → diversification active de l'offre par catégorie si déséquilibre.

#### Risques ressources mitigés par le scoping

- **Si l'équipe est plus petite que prévu** (3 dev au lieu de 4) : le scope MVP reste tenable, on étire le delay (4 mois → 5 mois) sans dilution feature. Pas de feature à moitié faite.
- **Si la levée pré-seed est retardée** : le mode founder-led + 1 tech lead permet de tenir 6 mois de bootstrap avant de devoir compléter l'équipe.
- **Si le sourcing physique est lent** (< 50 pros à mois 4) : le critère de sortie MVP n'est pas atteint, on prolonge avant d'attaquer V1 (pas de V1 sans validation MVP).

#### Risques conformité mitigés par le scoping

- **R1 TVA marketplace** : audit expert-comptable spécialisé prévu **avant V1** (pas avant MVP — au MVP, les volumes sont assez faibles pour valider en interne avec mandat art. 289 CGI standard ; mais bloqué pour scaler V1 si pas audité).
- **R2 statut éditeur LCEN** : audit avocat numérique **avant lancement** (gate critique avant ouverture publique).
- **R10 RGPD vs comptable 10 ans** : workflow d'anonymisation post-délai utile dans V1, soft-delete au MVP suffit pour les premiers cas.

### Budget Acquisition par Phase (synthèse `tukio_strategie_acquisition.md`)

| Phase | Budget mensuel acquisition | Mix dominant |
|-------|---------------------------|--------------|
| **MVP** (mois 1-6) | **~3 200 €/mois** | Bouche-à-oreille / partenariats physiques (500 €) + SEO foundation freelance (1 000 €) + Google Ads test (1 000 €) + Meta Ads test (500 €) + outillage (200 €) |
| **V1** (mois 7-18) | **~11 000 €/mois** | SEO contenu interne ou freelance (1 500 €) + Google Ads (4 000 €) + Meta Ads (2 500 €) + parrainage clients (800 €) + apporteurs B2B (1 200 €) + salons/events (600 €) + outillage (400 €) |
| **V2** (mois 19-36) | **~33 000 €/mois** | SEO interne 4 000 € + Google Ads 12 000 € + Meta Ads 7 000 € + fidélité 3 000 € + partenariats 5 000 € + RP/influence 2 000 € |

### Confirmation des décisions de scope

✅ **Aucune réduction de scope user-explicit** n'a été appliquée silencieusement. Tout ce qui figure dans le brief v0.3 §13 et dans la section Product Scope du PRD est conservé.

✅ **Aucune phase n'a été inventée** : MVP / V1 / V2 / V3+ sont les phases explicitement définies par Ismael dans la spec v2.2.

✅ **Aucune anticipation V0 sub-MVP** : si le founder veut tester un encore plus minimal (ex : landing page + waitlist avant tout) ce sera une décision explicite, pas un scope à inventer ici.

✅ **Tous les requirements identifiés dans les 16 docs source + brief v0.3 sont rangés dans une phase**. Rien n'est silencieusement dropped.

## Functional Requirements

> **Capability contract** : chaque FR est testable, implementation-agnostic, et fait référence à un acteur métier précis. Tout feature non listé ici n'existera pas dans le produit final. Numérotation séquentielle à travers les capability areas pour traçabilité downstream (epics, stories, tests).
>
> Acteurs : **Visitor** (non-authentifié), **Customer** (client B2C ou B2B), **Pro** (provider, statut `verified`), **Admin** (rôle `admin-support` / `admin-modo` / `admin-super` selon RBAC), **System** (process automatisés Tukio).
>
> Tag de phase entre crochets : `[MVP]`, `[V1]`, `[V2]`, `[V3+]`. Sans tag → MVP par défaut.

### A. User & Identity Management

- **FR1** : Visitor peut s'inscrire en tant que Customer particulier (B2C) avec email + mot de passe, en moins de 30 secondes
- **FR2** : Customer peut s'inscrire en tant qu'entreprise cliente (B2B) avec raison sociale, SIRET et facturation pro `[V1]`
- **FR3** : Visitor peut s'inscrire en tant que Pro avec soumission documents (SIRET, RIB, pièce d'identité) — le compte reste en `pending_admin_review` jusqu'à validation
- **FR4** : Customer / Pro / Admin peut se connecter avec email + mot de passe via Keycloak
- **FR5** : Customer / Pro peut se connecter via login social Google ou Apple `[V1]`
- **FR6** : Customer Enterprise peut se connecter via SSO SAML fédéré `[V2]`
- **FR7** : Customer / Pro / Admin peut récupérer son mot de passe par email (reset link Keycloak)
- **FR8** : Customer / Pro / Admin doit vérifier son adresse email avant toute transaction
- **FR9** : Admin doit activer une 2FA TOTP obligatoire à la création de son compte
- **FR10** : Pro peut activer une 2FA TOTP optionnelle sur son compte `[V1]`
- **FR11** : Pro peut compléter son profil enrichi (portfolio, équipe, certifications) `[V1]`
- **FR12** : Pro peut soumettre une vérification d'identité complète via Stripe Identity `[V1]`
- **FR13** : Customer ayant un rôle `client` peut convertir son compte en Pro (ajout rôle `pro` côté Keycloak + flow KYC) sans perte d'historique `[V1]`
- **FR14** : Customer / Pro peut consulter et modifier ses informations de profil
- **FR15** : Customer / Pro peut supprimer son compte (soft-delete avec conservation comptable 10 ans, anonymisation au-delà du délai utile)
- **FR16** : System empêche la création de plusieurs comptes Pro sur le même SIRET (sauf cas Enterprise groupes)
- **FR17** : System bloque l'accès aux fonctionnalités transactionnelles pour les comptes non vérifiés (email non vérifié) ou non encore validés (Pro `pending_admin_review`)

### B. Catalog & Discovery

- **FR18** : Visitor peut effectuer une recherche par catégorie + ville + date sur la barre de recherche
- **FR19** : Visitor peut filtrer les résultats par capacité, prix, options et autres facettes
- **FR20** : Visitor peut consulter la fiche d'un Service (titre, description, photos, tarifs, options, zone livraison, délai, avis, politique d'annulation)
- **FR21** : Visitor peut consulter le profil public d'un Pro (bio, services proposés, avis agrégés)
- **FR22** : Visitor peut accéder aux pages de catégorie générales (`/category/{slug}`) et pages locales catégorie × ville (`/category/{slug}/{city}`) `[V1 pour pages locales générées auto]`
- **FR23** : Pro peut créer une fiche Service avec 3 photos minimum (bloquant) et jusqu'à 15 photos maximum
- **FR24** : Pro peut éditer ou retirer une fiche Service publiée
- **FR25** : Pro peut définir une tarification à l'unité ou forfaitaire pour un Service `[MVP pour ces 2 modes]` ; tarification sur devis `[V1]`
- **FR26** : Pro peut renseigner une zone de livraison et un délai minimum de réservation pour un Service
- **FR27** : Pro peut intégrer une vidéo via embed YouTube ou Vimeo sur sa fiche Service `[V1]`
- **FR28** : Pro peut gérer un calendrier de disponibilité (blocage de dates, périodes indisponibles) `[V1]`
- **FR29** : Pro peut partager un inventaire (`InventoryPool`) entre plusieurs fiches Service du même compte `[V1]`
- **FR30** : System auto-publie une fiche Service si le Pro est `verified` depuis > 30 jours et a < 3 signalements (sinon modération a posteriori)
- **FR31** : System affiche le prix médian de la catégorie sur la fiche catégorie pour transparence client
- **FR32** : System empêche la publication d'un Service avec un tarif déviant de plus de ±50 % de la médiane catégorie (soft warning, pas blocage strict)
- **FR33** : System indexe automatiquement chaque Service publié dans le moteur de recherche, avec un index dédié par locale

### C. Booking & Order Lifecycle

- **FR34** : Customer peut réserver un Service à une date donnée (réservation directe au MVP, demande de devis personnalisé en `[V1]`)
- **FR35** : Customer peut composer un panier mono-vendeur au MVP, panier multi-vendeurs `[V1]`
- **FR36** : Customer peut consulter ses réservations passées et à venir dans son espace
- **FR37** : Customer peut visualiser les détails d'une réservation (statut, prestataire, date, options, total, factures)
- **FR38** : Customer peut annuler une réservation selon la politique d'annulation choisie par le Pro (3 templates standards : souple / standard / strict)
- **FR39** : Customer peut signaler une situation exceptionnelle (force majeure) lors d'une annulation, ouvrant une dispute médiée par Admin `[V1]`
- **FR40** : Customer peut demander une modification de réservation (date, options) `[V1]`
- **FR41** : Customer peut effectuer une réservation conditionnelle avec option de 48 h `[V1]`
- **FR42** : Pro peut consulter sa file de demandes en attente (`pending_pro_acceptance`) avec délai d'expiration visible
- **FR43** : Pro peut accepter ou refuser une demande de réservation
- **FR44** : Pro peut proposer un devis personnalisé en réponse à une demande de devis `[V1]`
- **FR45** : Pro voit ses informations Customer masquées tant qu'il n'a pas accepté la demande (anti-désintermédiation R6)
- **FR46** : Pro peut proposer une modification de réservation au Customer `[V1]`
- **FR47** : System maintient le cycle de vie d'une réservation à travers ses statuts (`request → accepted → confirmed → completed | cancelled | refused`) avec audit trail complet
- **FR48** : System gère les conflits de disponibilité avec 3 layers de protection (Redis lock, DB exclusion constraint, optimistic locking)

### D. Payments & Financial

- **FR49** : Customer peut payer une réservation par carte bancaire via Stripe Elements (autorisation différée, capture à l'acceptation Pro)
- **FR50** : Customer peut sauvegarder une carte de paiement pour usage futur `[V1]`
- **FR51** : Customer peut payer en 2 échéances 30/70 (acompte à la réservation, solde avant l'événement) `[V1]`
- **FR52** : Customer peut consulter et télécharger ses factures dans son espace `[V1]`
- **FR53** : Pro peut visualiser ses transactions, commissions Tukio, frais Stripe, et payouts attendus
- **FR54** : Pro peut télécharger ses factures émises par Tukio en son nom (mandat art. 289 CGI)
- **FR55** : Pro peut exporter ses transactions au format CSV ou PDF pour comptabilité `[V1]`
- **FR56** : Pro peut consulter ses payouts Stripe Connect et leur statut (en attente / versé)
- **FR57** : Pro peut souscrire à un tier d'abonnement (Starter gratuit / Business 29 €/mois / Enterprise sur devis) `[V1]`
- **FR58** : Pro peut changer de tier d'abonnement (upgrade / downgrade) avec proratisation `[V1]`
- **FR59** : Pro peut résilier son abonnement à la fin de la période en cours (sans engagement) `[V1]`
- **FR60** : Pro Enterprise peut intégrer Tukio à son outil comptable (Pennylane, QuickBooks API directe) `[V2]`
- **FR61** : Admin peut effectuer un remboursement total ou partiel d'une transaction
- **FR62** : Admin peut consulter les disputes Stripe en cours et soumettre l'evidence trail Tukio à Stripe
- **FR63** : Admin peut consulter le rapprochement Stripe ↔ Tukio (commissions encaissées, payouts envoyés, balance plateforme)
- **FR64** : System gère 3 cas de TVA (pro non-assujetti / B2C / B2B intra-UE) lors de la facturation
- **FR65** : System reverse automatiquement le montant Pro à J+1 après l'événement, après déduction de la commission
- **FR66** : System dérive le tier d'abonnement Pro depuis l'état Stripe Subscription (jamais l'inverse)

### E. Messaging & Communication

- **FR67** : Customer / Pro peut consulter ses conversations dans son espace
- **FR68** : Customer / Pro peut échanger des messages texte dans une conversation liée à une réservation
- **FR69** : Customer / Pro peut échanger des messages dans un chat libre avant booking (pour devis) `[V1]`
- **FR70** : Customer / Pro peut envoyer des pièces jointes (PDF, images) `[V1]`
- **FR71** : Customer / Pro peut effectuer une recherche dans l'historique de ses conversations `[V1]`
- **FR72** : System masque automatiquement les emails et numéros de téléphone détectés par regex dans les messages tant que la réservation n'est pas confirmée (anti-désintermédiation) `[V1]`
- **FR73** : System applique un rate limiting anti-spam (max 3 messages/h vers un Customer qui n'a pas répondu)
- **FR74** : System conserve les messages 5 ans pour litiges et conformité

### F. Reviews & Reputation

- **FR75** : Customer peut laisser un avis (note 1-5 + commentaire texte) après un événement
- **FR76** : Customer peut laisser un avis multi-critères (qualité, ponctualité, communication, rapport qualité/prix) `[V1]`
- **FR77** : Pro tier Business+ peut répondre publiquement à un avis Customer `[V1]`
- **FR78** : Pro peut laisser un avis réciproque sur le Customer (visible aux autres Pros uniquement) `[V1]`
- **FR79** : Visitor peut consulter les avis agrégés d'un Service ou d'un Pro
- **FR80** : Customer / Pro peut signaler un avis comme abusif
- **FR81** : System envoie une demande d'avis automatique J+1 après l'événement, avec relance J+7
- **FR82** : System pondère les avis par récence (avis < 6 mois pèsent 2× plus dans la note agrégée)

### G. Moderation & Administration

- **FR83** : Admin (`admin-support`) peut consulter la file de validation Pro et valider/rejeter un dossier KYC
- **FR84** : Admin (`admin-modo` ou `admin-super`) peut suspendre un compte (Customer ou Pro) avec un motif documenté
- **FR85** : Admin (`admin-super`) peut bannir définitivement un compte (avec hash IP/email/téléphone conservé pour anti-recréation)
- **FR86** : Admin peut consulter les signalements d'utilisateurs (services, avis, comptes, messages) et statuer
- **FR87** : Admin peut ouvrir, médier et clôturer un litige avec workflow structuré (ouverture → médiation 48 h → résolution → clôture, réouverture possible 15 j) `[V1]`
- **FR88** : Admin peut appliquer une sanction graduée (avertissement → suspension publication 7 j → suspension compte 30 j → bannissement)
- **FR89** : Admin peut consulter et exporter le journal d'audit immuable des actions admin
- **FR90** : Admin (`admin-super`) peut créer, modifier ou révoquer les comptes admin (provisionnement manuel uniquement)
- **FR91** : Admin (`admin-super`) peut éditer la taxonomie produit (catégories, sous-catégories, types, tags secondaires)
- **FR92** : Admin (`admin-modo` ou `admin-super`) peut effectuer un replay d'event NATS pour réparer une saga échouée `[V1]` (sensible 🔴, audit obligatoire)
- **FR93** : Admin peut impersonifier un user pour debug `[V1]` (sensible 🔴, audit obligatoire)
- **FR94** : System enregistre toutes les actions admin sensibles dans une table immuable append-only avec timestamp, admin_id, action, target, reason
- **FR95** : System interdit toute suppression ou modification du journal d'audit, même par `admin-super`

### H. Internationalization & Localization

- **FR96** : Visitor accède au site avec une locale détectée automatiquement à partir de `Accept-Language` (fallback `fr` si non détecté)
- **FR97** : Customer / Pro peut explicitement choisir sa locale d'affichage (`fr` ou `en`), avec persistance en cookie + préférence compte
- **FR98** : Visitor peut naviguer sur des URLs locale-prefixées (`/fr/...` ou `/en/...`) avec hreflang systématique vers les autres locales
- **FR99** : Pro peut saisir le titre et la description de sa fiche Service en français obligatoirement, et en anglais optionnellement (fallback FR pour les visiteurs locale `en` si EN absent)
- **FR100** : System affiche un badge UI "Disponible uniquement en français" sur la version EN d'une fiche Service sans traduction EN
- **FR101** : Pro peut traduire le contenu de sa fiche Service en EN, optionnellement avec pré-remplissage automatique via traduction (DeepL ou GPT) `[V1]`
- **FR102** : System envoie les emails transactionnels dans la locale du destinataire (FR ou EN)
- **FR103** : System maintient des index de recherche distincts par locale (`listings_fr`, `listings_en`)
- **FR104** : System fournit les pages légales (CGU, CGV, PC, mentions légales) en FR et EN (FR fait foi juridiquement)

### I. Acquisition & Growth

- **FR105** : System tracke les UTM params (`source`, `medium`, `campaign`) à l'arrivée du Visitor et les persiste lors de l'inscription user et de la création booking
- **FR106** : System émet les events business critiques (`page_view`, `search_performed`, `service_viewed`, `pro_viewed`, `booking_request_started`, `booking_request_submitted`, `booking_confirmed`) en server-side via gateway-api (résistant ad-block)
- **FR107** : Customer peut générer un code de parrainage et le partager avec d'autres personnes `[V1]`
- **FR108** : Customer peut s'inscrire avec un code de parrainage et déclencher un crédit de 30 € pour lui et 30 € pour le parrain à sa première résa > 200 € `[V1]`
- **FR109** : Customer peut consulter ses crédits de parrainage actifs et leur date d'expiration `[V1]`
- **FR110** : Wedding Planner / Apporteur d'affaires peut s'inscrire en tant que partenaire avec un dashboard dédié et un lien tracké unique `[V1]`
- **FR111** : Apporteur peut consulter ses commissions générées (5 % sur chaque résa via son lien) et leur statut `[V1]`
- **FR112** : Customer peut s'abonner à une newsletter d'événements / contenus blog (opt-in explicite) `[V1]`
- **FR113** : Visitor peut s'inscrire à une checklist téléchargeable (CTA email capture, ex : "Checklist mariage en Pays de la Loire") `[V1]`
- **FR114** : Customer peut bénéficier d'un programme de fidélité (-5 % à la 3ᵉ résa) `[V2]`
- **FR115** : System génère automatiquement les sitemaps XML segmentés par locale + type d'entité, mis à jour quotidiennement
- **FR116** : System publie automatiquement le balisage Schema.org JSON-LD adapté à chaque type de page (`Service`, `LocalBusiness`, `BreadcrumbList`, `AggregateRating`, `Organization`)

### J. Notifications

- **FR117** : Customer / Pro peut consulter ses notifications in-app (cloche 🔔) `[V1]`
- **FR118** : Customer / Pro peut configurer ses préférences de notification par catégorie (transactional non désactivable, important, marketing opt-in)
- **FR119** : System envoie un email transactionnel à chaque event business clé (confirmation booking, acceptation/refus, rappels J-7 et J-1, demande d'avis J+1, validation pro, payout)
- **FR120** : System envoie une notification SMS pour les events urgents `[V1]` (option Pro payante)
- **FR121** : System envoie une notification web push aux utilisateurs PWA `[V1]`
- **FR122** : System envoie une notification mobile push aux utilisateurs de l'app native `[V2]`
- **FR123** : System regroupe les notifications de messages non lus après 3 messages consécutifs sans réponse pour éviter le spam
- **FR124** : Admin peut éditer les templates d'emails dans le back-office `[V1]`
- **FR125** : Admin peut envoyer une newsletter à un segment Customer ou Pro `[V2]`

### K. Configurateur & Smart Features

- **FR126** : Customer peut utiliser un configurateur d'événement qui assemble plusieurs Services en un devis unique selon ses besoins (date, capacité, type d'événement, budget) `[V2]`
- **FR127** : Customer peut recevoir des recommandations personnalisées de Services basées sur son historique `[V2]`
- **FR128** : Pro peut sous-traiter une partie d'une réservation à un autre Pro avec splits Stripe gérés automatiquement `[V2]`
- **FR129** : Pro tier Business+ peut consulter des analytics avancées (benchmarks anonymisés vs catégorie, suggestions de prix) `[V2]`
- **FR130** : Pro Enterprise peut bénéficier de badges "vérifié", "pro de l'année" affichés publiquement `[V2]`

### Capability Coverage Validation

✅ **Couverture des 6 user journeys** :
- J1 (Sophie réserve) → FR18-21, FR23-32, FR34-37, FR49, FR67-68, FR75, FR81, FR97-98, FR102, FR105-106, FR119
- J2 (annulation force majeure) → FR38-39, FR61, FR87-88, FR94, FR119
- J3 (Marc s'inscrit) → FR3, FR4, FR8-9, FR23-26, FR42-43, FR45, FR53-54, FR56, FR65, FR83, FR94, FR119
- J4 (dispute Stripe) → FR62, FR70, FR74, FR94, FR119
- J5 (Léa valide pro) → FR9, FR83, FR89, FR94-95
- J6 (saga échouée admin-modo) → FR89, FR92, FR94-95

✅ **Couverture des 8 domaines fonctionnels du brief** :
- 9.1 Comptes → A (FR1-17)
- 9.2 Catalogue → B (FR18-33)
- 9.3 Booking → C (FR34-48)
- 9.4 Paiements → D (FR49-66)
- 9.5 Abonnements → D (FR57-60, FR66)
- 9.6 Messagerie → E (FR67-74)
- 9.7 Avis → F (FR75-82)
- 9.8 Modération → G (FR83-95)

✅ **Couverture transverse** :
- Notifications → J (FR117-125)
- i18n → H (FR96-104)
- Acquisition → I (FR105-116)
- Configurateur & smart V2 → K (FR126-130)

✅ **Couverture des 11 capabilities révélées dans Journey Requirements Summary** :
- Search & discovery → B
- Listing publication & onboarding pro → A, B
- Booking lifecycle → C
- Payment → D
- Messaging → E
- Reviews → F
- Notifications → J
- Admin moderation → G
- i18n → H
- Observability & resilience → couvert par NFRs (Step 10)
- Audit trail → G (FR89, FR94-95)
- RBAC granulaire → A (rôles), G (admin scoping)

**Total : 130 FRs sur 11 capability areas**, dépasse la cible 20-50 FRs typique mais reste justifié par la complexité d'une marketplace B2B2C transactionnelle multi-rôles avec 8 domaines fonctionnels distincts. Aucun split possible sans perte de granularité.

## Non-Functional Requirements

> Quality attributes testables et chiffrés pour Tukio.one. Les seuils sont issus du brief v0.3 §15 (métriques) + §17 (risques) + Domain Requirements ci-dessus + Web Application Specific Requirements. Numérotation séquentielle. Tag de phase entre crochets quand le seuil évolue par version.

### Performance

- **NFR1** : La latence p95 du search Meilisearch doit être < 150 ms sur tous les endpoints `/api/search/*` (1 index par locale, mémoire pré-warmée).
- **NFR2** : Le rendu server-side d'une page publique p95 doit être < 800 ms, mesuré côté Vercel edge (incluant fetch via gateway-api).
- **NFR3** : Le tunnel checkout (`/cart/checkout`) doit charger Stripe Elements en moins de 1 seconde p95.
- **NFR4** : La latence p95 de livraison d'un message WebSocket via `messaging-svc` doit être < 200 ms (Redis pub/sub local).
- **NFR5** : Les Core Web Vitals doivent respecter LCP < 2,5 s, INP < 200 ms, CLS < 0,1 sur 4G mobile, mesurés via Lighthouse CI sur chaque PR.
- **NFR6** : La capture différée Stripe (PaymentIntent confirm → capture) doit s'exécuter en moins de 800 ms p95.
- **NFR7** : Le bundle JS initial de la homepage non connectée doit être < 150 KB gzipped ; le total bundle JS d'une route doit avoir aucun chunk > 200 KB gzipped sans justification documentée.
- **NFR8** : Aucune page publique ne doit dépasser 1,5 MB de poids total (incluant images optimisées format auto AVIF/WebP).

### Security

- **NFR9** : Toutes les communications client-serveur doivent utiliser HTTPS/TLS avec HSTS activé ; redirect HTTP → HTTPS systématique.
- **NFR10** : Toutes les communications inter-services en production doivent utiliser mTLS (`gateway-api` ↔ services downstream).
- **NFR11** : Tous les JWT Keycloak doivent être signés en RS256 et validés via JWKS (cache 10 min côté `gateway-api`) ; chaque service downstream doit re-vérifier le JWT (defence in depth).
- **NFR12** : Tous les comptes Admin doivent activer la 2FA TOTP à la création du compte, sans exception.
- **NFR13** : Aucun secret applicatif ne doit être stocké en clair dans le code ou la configuration ; gestion via Kubernetes Secrets + vault (Doppler ou AWS Secrets Manager).
- **NFR14** : Tukio ne doit jamais toucher aux numéros de carte bancaire ; le tunnel paiement utilise exclusivement Stripe Elements (iframe), scope PCI-DSS SAQ-A.
- **NFR15** : Les pièces d'identité KYC pros stockées sur Cloudflare R2 doivent être chiffrées at-rest (server-side encryption R2).
- **NFR16** : Les logs centralisés (OpenTelemetry → Tempo) doivent appliquer une PII redaction systématique (pas d'email, téléphone, SIRET ou numéros de paiement).
- **NFR17** : Le `gateway-api` doit appliquer un rate limiting par IP + par user authentifié, avec alerte sur abus (> 10 req/s soutenu sur un endpoint sensible).
- **NFR18** : Chaque PR introduisant du code DOIT passer un scan de dépendances (Dependabot ou Snyk) bloquant en cas de CVE critique non patchable.
- **NFR19** : Toute action Admin sensible (refund, ban, replay event, impersonation) doit être tracée dans le journal d'audit immuable avec timestamp, admin_id, action, target, reason, et ne peut jamais être modifiée ou supprimée même par `admin-super`.
- **NFR20** : Le bannissement utilisateur conserve un hash IP/email/téléphone (légal sous 6 ans, à valider avocat) pour anti-recréation.

### Compliance & Privacy

- **NFR21** : Le statut juridique de Tukio est hybride hébergeur LCEN + tiers de confiance paiement ; aucune modération pré-publication systématique n'est implémentée (gating R2). Audit avocat numérique obligatoire avant le lancement public.
- **NFR22** : Tout pro doit signer un mandat de facturation art. 289 CGI à l'onboarding ; Tukio émet la facture en son nom.
- **NFR23** : System gère 3 cas TVA distincts (pro non-assujetti / B2C / B2B intra-UE) ; un audit expert-comptable spécialisé marketplace est obligatoire avant V1 (R1 critique).
- **NFR24** : Toutes les factures émises sont conservées 10 ans (obligation légale FR).
- **NFR25** : System applique soft-delete sur les comptes utilisateur supprimés (conservation données comptables 10 ans, anonymisation des données perso au-delà du délai utile, R10).
- **NFR26** : Tout user peut exercer ses droits RGPD (accès, rectification, effacement, portabilité) via un workflow Admin ; cible de réponse < 30 jours ouvrés `[V1]`.
- **NFR27** : Les outils analytiques de la stack doivent être RGPD-compliant : Plausible (sans cookies, hosted EU), PostHog (hosted EU, opt-in session replay uniquement), Brevo FR (email marketing V1).
- **NFR28** : Toute fonctionnalité analytique nécessitant un cookie (PostHog session replay) doit obtenir un consentement explicite au préalable.
- **NFR29** : Les pages légales (CGU, CGV, Politique de Confidentialité, Mentions légales) sont versionnées en FR + EN dès le MVP ; la version FR fait foi juridiquement.
- **NFR30** : Tout payment Stripe > 30 € en EU doit déclencher 3DS Secure (géré nativement par Stripe Elements) ; pas de bypass.

### Scalability

- **NFR31** : L'architecture doit supporter sans dégradation > 10 % la cible MVP de 6 000 visiteurs uniques mensuels et 80 réservations/mois.
- **NFR32** : L'architecture doit supporter la cible V1 de 30 000 visiteurs/mois et 400 réservations/mois sans modification structurelle (uniquement scaling horizontal des services).
- **NFR33** : L'architecture doit supporter la cible V2 de 100 000 visiteurs/mois et 1 500 réservations/mois ; le split de `payment-svc` en deployment dédié dès la production permet l'isolation requise.
- **NFR34** : NATS JetStream doit traverser 10 000 events/sec sans backpressure (sweet spot du choix ADR-002, à reviser au-delà).
- **NFR35** : Le `catalog-svc` doit indexer un nouveau Service publié dans Meilisearch en moins de 5 secondes (sync via consumer NATS sur `catalog.listing.translation.published.v1`).
- **NFR36** : Le `messaging-svc` doit supporter 5 000 utilisateurs WebSocket concurrents avant split en deployment dédié.
- **NFR37** : Le `notification-svc` doit pouvoir envoyer 10 000 emails/jour sans queue saturée ; déploiement dédié au-delà.
- **NFR38** : La saisonnalité événementielle Pays de la Loire (pic mai-septembre, creux hivernal) impose une capacité 3× la moyenne annuelle pendant le pic ; auto-scaling horizontal à activer dès V1.

### Reliability & Availability

- **NFR39** : Le `gateway-api` doit avoir une disponibilité ≥ 99,5 % au MVP, ≥ 99,9 % à partir de V1 (mesurée mensuellement).
- **NFR40** : NATS JetStream doit fonctionner en mode replicas R3 en production avec un DLQ stream dédié (R12 mitigation).
- **NFR41** : Le consumer lag NATS doit être < 100 messages en fonctionnement nominal ; alerte si > 1 000 messages.
- **NFR42** : L'outbox relay PG LISTEN/NOTIFY doit avoir un fallback polling 30 s en cas de panne ; alerte si > 100 messages outbox `pending` depuis > 1 min (R13 mitigation).
- **NFR43** : Toute saga booking-payment bloquée > 5 min doit déclencher une alerte admin avec replay manuel possible (R11 critique).
- **NFR44** : La sauvegarde PostgreSQL doit être daily snapshot + WAL archiving avec RPO < 5 min et RTO < 1 h.
- **NFR45** : Tous les appels externes critiques (Stripe API, Resend, Meilisearch sync) doivent avoir des retries exponentiels + circuit breaker avec timeout 3 s côté gateway.
- **NFR46** : Les tests chaos sur le flow saga booking-payment doivent être obligatoires en CI sur chaque PR touchant les services concernés (`booking-svc`, `order-svc`, `payment-svc`).

### Accessibility

- **NFR47** : Le frontend doit respecter RGAA niveau AA (équivalent WCAG 2.1 AA) sur tous les parcours publics et authentifiés.
- **NFR48** : Le contraste texte normal doit avoir un ratio ≥ 4,5:1 ; texte large (≥ 18 pt ou 14 pt bold) ≥ 3:1 ; UI components et icônes ≥ 3:1.
- **NFR49** : Tous les éléments interactifs doivent être accessibles au clavier (Tab) avec un focus ring visible et un ordre de tabulation logique.
- **NFR50** : Toutes les images de contenu doivent avoir un `alt` text non vide ; les icon buttons doivent avoir un `aria-label` ; lint rule bloquante en CI.
- **NFR51** : Aucune information critique ne doit être véhiculée uniquement par la couleur (erreurs avec icône + texte, états calendrier avec hachures texte).
- **NFR52** : Le frontend doit respecter `prefers-reduced-motion` et désactiver les animations non essentielles ; aucun flash > 3 fois par seconde.
- **NFR53** : Tous les touch targets sur mobile doivent mesurer au minimum 44 × 44 px (WCAG 2.1 AA + Apple HIG).
- **NFR54** : Le score Lighthouse Accessibility doit être ≥ 90 sur chaque PR (CI gate) ; les tests Playwright + axe-core sont obligatoires sur les parcours critiques (search, checkout, onboarding pro).
- **NFR55** : Un audit manuel RGAA par un expert externe est obligatoire avant le lancement public de la V0 ; tests utilisateurs avec personnes en situation de handicap en V1.

### Internationalization

- **NFR56** : Aucun texte UI ne doit être hardcodé dans le code frontend ; tous les strings passent par `useTranslations()` de `next-intl` (ADR-012, K-12).
- **NFR57** : Toute PR ajoutant ou modifiant une page DOIT inclure les traductions correspondantes dans `messages/fr.json` ET `messages/en.json` ; CI check bloquant.
- **NFR58** : Les URLs sont systématiquement locale-prefixées (`/fr/...` ou `/en/...`) avec hreflang propre ; chaque entité `listing`, `category`, `pro_profile` a un slug par locale stocké dans `<entity>_translations`.
- **NFR59** : Les emails transactionnels via Resend ont des templates dupliqués FR + EN, sélectionnés selon la locale du destinataire (cookie + préférence compte si connecté, sinon `Accept-Language` avec fallback FR).
- **NFR60** : Meilisearch maintient 1 index par locale (`listings_fr`, `listings_en`) avec tokenization native par langue ; sync via consumer NATS sur events `catalog.listing.translation.published.v1`.

### Observability

- **NFR61** : Tous les services émettent des traces OpenTelemetry avec correlation IDs propagés à travers la saga distribuée ; les traces sont exportées vers Tempo.
- **NFR62** : Toutes les métriques business critiques (NATS consumer lag, outbox pending lag, saga duration p95, payment success rate, search p95, etc.) sont exposées en Prometheus format et alertables dans Alertmanager.
- **NFR63** : Tous les events business critiques (`page_view`, `search_performed`, `service_viewed`, `pro_viewed`, `booking_request_started`, `booking_request_submitted`, `booking_confirmed`) sont émis en server-side via gateway-api (résistant ad-block) et visibles dans PostHog.
- **NFR64** : Les UTM params sont persistés sur les tables `users` et `bookings` dès Sprint 0 (impossibles à rétro-fitter sans perte de données — K-04 critique).
- **NFR65** : Les dashboards opérationnels Looker Studio + Plausible + PostHog couvrent : top of funnel (quotidien), full funnel + acquisition par canal (hebdo), revue stratégique + arbitrages budgétaires (mensuel).
- **NFR66** : Les logs applicatifs ne contiennent jamais de PII ; redaction systématique côté `gateway-api` et `notification-svc`.

### Maintainability

- **NFR67** : Tous les services backend respectent le pattern Pretre (`domain/usecases/infrastructure` + `UseCaseProxy` factory) ; `eslint-plugin-boundaries` configuré dès Sprint 0 bloque tout import cross-bounded-context.
- **NFR68** : Le domain layer (`domain/`) ne doit avoir aucun import NestJS ; tests unitaires triviaux (mocks plain).
- **NFR69** : Tous les events NATS suivent la convention `<service>.<aggregate>.<event>.v<n>` lowercase ; tout schéma d'event est versionné dans `@tukio/contracts` (JSON Schema + types TS dérivés) ; ADR requis pour rompre la backward compatibility.
- **NFR70** : Toute décision architecturale structurante doit faire l'objet d'une ADR documentée dans `docs/adr/` du repo backend.
- **NFR71** : La couverture de tests minimale par service est : 80 % sur `domain/`, 70 % sur `usecases/`, 50 % sur `infrastructure/`. CI gate bloquant.
- **NFR72** : Tout PR de migration de schema DB DOIT inclure un script de rollback testé.
- **NFR73** : Le code doit passer les checks lint, format, typecheck, et tests sur chaque PR ; aucun merge sur `main` sans CI verte.
- **NFR74** : Les conventions de nommage figées (Pro/provider, Client/customer, etc.) sont enforced via lint rules custom + review obligatoire pour tout nouveau bounded context.

### Integration

- **NFR75** : Stripe webhooks ont un endpoint unique sur `payment-svc` ; les events sont transformés en NATS events internes pour les autres services. Aucun autre service ne consomme directement les webhooks Stripe.
- **NFR76** : Keycloak emit des webhooks consommés par `identity-svc` qui maintient un mirror des attributs métier ; un job de réconciliation quotidien détecte les drift (R8 mitigation).
- **NFR77** : Aucun appel HTTP-to-HTTP entre services downstream n'est autorisé sauf l'exception documentée `booking-svc` → `catalog-svc` pour vérification dispo temps réel à la création d'un booking.
- **NFR78** : Les retries exponentiels avec circuit breaker (timeout 3 s) sont obligatoires sur tous les appels externes critiques.
- **NFR79** : L'API INSEE SIRENE est consultée à l'onboarding pro pour vérifier le SIRET (auto-check) ; en cas d'indisponibilité de l'API, le dossier passe en validation manuelle admin.

### Operability

- **NFR80** : Le déploiement initial MVP est colocaté en 3 unités (`core-api` = gateway+identity+catalog+booking+order+payment, `workers` = messaging+review+notification+media, `nats`) sur un seul cluster K8s/namespace pour limiter le burden ops (R15 mitigation).
- **NFR81** : `payment-svc` doit être splitté en deployment dédié dès la production V0 release (sécurité PCI-DSS-adjacent, isolation totale).
- **NFR82** : `notification-svc`, `media-svc`, `messaging-svc`, `catalog-svc` doivent pouvoir être splittés en deployment dédié sur trigger explicite (volumes documentés dans la stratégie deployment §12.3).
- **NFR83** : Toute migration DB doit être backward-compatible (deux versions doivent pouvoir coexister) pour permettre des rolling deployments sans downtime.
- **NFR84** : Tous les services doivent exposer des endpoints `/health` (liveness) et `/ready` (readiness) pour Kubernetes probes ; `/metrics` pour Prometheus scraping.
