# Tukio — Spécification Fonctionnelle v2.1

> Marketplace B2B2C de services événementiels (tukio.one)
> Document de référence : versions, fonctionnalités, architecture, décisions consolidées
> Statut : v2.1 — supersede v2.0

---

## Changelog

**v2.1** *(version courante)*
- Ajout de Keycloak comme infrastructure d'authentification
- Q1 (géographie) : Paris → **Pays de la Loire** (Loire-Atlantique + Maine-et-Loire en priorité)
- Réponses validées aux 10 questions ouvertes
- Consolidation des 33 décisions actées dans les deep dives (Booking + Paiements + Catalogue)
- Nouvelle section : *Architecture technique*
- Liens vers les 3 deep dives produits

**v2.0**
- Document initial : versions MVP/V1/V2/V3, 8 domaines fonctionnels détaillés, audit du spec v1

---

## Sommaire

- [Partie 1 — Stratégie de versions](#partie-1--stratégie-de-versions)
- [Partie 2 — Fonctionnalités détaillées](#partie-2--fonctionnalités-détaillées)
- [Partie 3 — Décisions consolidées & architecture](#partie-3--décisions-consolidées--architecture)
- [Documents complémentaires](#35--documents-complémentaires)

---

# Partie 1 — Stratégie de versions

## Principes directeurs

1. **Chaque version doit être commercialisable seule.** Pas de feature à moitié faite qui attend la suivante.
2. **L'ordre suit la valeur business**, pas la facilité technique. Le MVP doit prouver que pros + clients transigent.
3. **Une feature = un chiffre business à bouger.** Si on ne sait pas quelle métrique elle déplace, elle attend.
4. **Versions courtes, pas de "big bang".** Cible : MVP en 3-4 mois, V1 à +6 mois, V2 à +12 mois.

## Vue d'ensemble

| Version | Cible business | Durée estimée | Critère de sortie |
|---------|---------------|----------------|--------------------|
| **MVP (v0.1)** | Valider la transaction pro ↔ client | ~3-4 mois | 50 pros actifs + 100 réservations payées |
| **V1 (v1.0)** | Marketplace complète & monétisable | ~3 mois | Premier mois rentable sur la commission + abos |
| **V2 (v2.0)** | Croissance & rétention | ~3 mois | Taux de rebooking client > 25 % |
| **V3+** | Scale & expansion | ouvert | Multi-pays / mobile native / API publique |

---

## MVP (v0.1) — "Prouver la transaction"

**Hypothèse à valider :** des pros sont prêts à payer une commission pour des leads qui se convertissent en réservations payées sur la plateforme.

**Périmètre géographique :** Pays de la Loire, prioritairement **Loire-Atlantique (44) + Maine-et-Loire (49)**. Couverture physique possible depuis Nantes (founder peut serrer la main aux 50 premiers pros, avantage compétitif).

**Scope strict — uniquement ce qui est nécessaire pour qu'une transaction ait lieu de bout en bout.**

### Inclus

- **Comptes & authentification** *(via Keycloak)*
  - Inscription client (particulier uniquement, pas encore B2B)
  - Inscription pro avec validation manuelle par un admin (KYC light : SIRET, RIB, pièce d'identité)
  - Auth email + mot de passe, reset password, vérification email
  - Admins = MFA obligatoire (TOTP)
- **Catalogue**
  - 2 catégories pilotes : *tentes & chapiteaux* + *mobilier événementiel*
  - Fiche service : photos (3-15), description, tarif unitaire ou forfait, zone de livraison, délai de réservation, options
  - Recherche par catégorie + ville + date
- **Booking**
  - Réservation directe (pas de devis personnalisé)
  - Cart **mono-vendeur** (un panier = un pro)
  - Sélection de dates + quantité (avec calendrier dispo)
- **Paiements**
  - Stripe Connect Express
  - Capture différée (autorisation à la commande, capture à l'acceptation pro)
  - Commission fixe unique (10 %)
  - Reversement automatique à J+1 après l'événement
  - Remboursement manuel par admin
- **Messagerie**
  - Chat client ↔ pro lié à une réservation (pas de chat libre avant booking)
  - Notifications email basiques
- **Avis**
  - Note unique 1-5 étoiles + commentaire texte
  - Demande d'avis envoyée 24 h après l'événement
- **Admin**
  - Validation des comptes pros
  - Modération signalements basique
  - Vue des transactions et des litiges
- **Légal & conformité**
  - CGU / CGV / Politique de confidentialité
  - Consentement RGPD basique
  - Mentions légales

### Exclus du MVP (volontairement)

- Comptes B2B (entreprises clientes)
- Devis personnalisés / négociation tarifaire
- Panier multi-vendeurs
- Échéanciers / acomptes / paiements fractionnés
- Subscription tiers pros (tout le monde sur le même plan)
- Avis multi-critères
- Application mobile
- API publique
- Internationalisation (FR uniquement)

### Critères de sortie de MVP

- 50 pros validés et actifs (au moins 1 réservation chacun)
- 100 réservations payées sans litige bloquant
- NPS client > 40
- Coût d'acquisition pro mesuré et soutenable

---

## V1 (v1.0) — "Marketplace complète"

**Objectif :** transformer le MVP en produit qui se vend, qui retient et qui se monétise sur deux leviers (commission + abos).

**Extension géographique :** Pays de la Loire complet (44/49/72/85/53) + Bretagne (35/22/29/56).

### Ajouts par rapport au MVP

- **Comptes**
  - Comptes B2B (entreprises clientes) avec facturation pro
  - Profil pro enrichi : portfolio, équipe, certifications
  - KYC complet via Stripe Identity
  - Login social Google + Apple (via Keycloak)
  - MFA optionnel pour les pros (TOTP)
- **Catalogue**
  - Toutes les catégories cibles (équipement complet + services packagés)
  - Tarification flexible : à l'unité, par package, *sur devis*
  - Gestion des disponibilités (calendrier de dispo / blocage de dates / inventaire partagé)
  - Vidéos (YouTube/Vimeo embed)
- **Booking**
  - **Panier multi-vendeurs** (un panier = N pros, paiement unique, splits côté Stripe)
  - Demande de devis personnalisé avant booking
  - Réservation conditionnelle (option de 48 h)
- **Paiements**
  - **Subscription tiers** : Starter (gratuit, commission 15 %), Business (29 €/mois, commission 10 %), Enterprise (sur devis, commission 5 %)
  - Acomptes (ex : 30 % à la résa, 70 % avant l'événement)
  - Échéanciers personnalisables par le pro
  - Facturation PDF automatique (client + pro)
  - Gestion TVA selon statut du pro
- **Messagerie**
  - Chat libre avant booking (pour devis)
  - Pièces jointes (PDF, images)
  - Recherche dans l'historique
  - Anti-désintermédiation (masquage email/téléphone)
- **Avis**
  - Avis multi-critères (qualité, ponctualité, communication, rapport qualité/prix)
  - Réponse du pro à un avis
  - Note réciproque pro → client
- **Admin & litiges**
  - Workflow de litige structuré (ouverture → médiation → résolution)
  - Tableau de bord modération
  - Outils de remboursement partiel
  - Rôles admin granulaires (super, support, modérateur)
- **Pro dashboard**
  - Stats : revenus, conversion, taux d'occupation, temps de réponse
  - Export comptable CSV/PDF

### Critères de sortie de V1

- Premier mois où (commissions + abonnements) > coûts variables
- Au moins 200 abonnés Business
- < 5 % des réservations en litige

---

## V2 (v2.0) — "Croissance & rétention"

**Objectif :** faire revenir les clients (rebooking) et augmenter le panier moyen.

**Extension géographique :** grandes agglos françaises (Paris, Lyon, Bordeaux, Marseille).

### Ajouts

- **Configurateur d'événements** : assistant qui assemble plusieurs services en un seul devis
- **Recommandations personnalisées** clients basées sur historique
- **Co-traitance entre pros** (un pro sous-traite à un autre, splits gérés)
- **Programme de fidélité client** (ex : -5 % à la 3ᵉ résa)
- **Tier Enterprise complet** : SLA, account manager, intégrations comptables (Pennylane, QuickBooks)
- **B2B SSO** (via Keycloak SAML federation) pour comptes Enterprise
- **Analytics pros avancées** : benchmarks anonymisés, suggestions de prix
- **Vérification renforcée** : badges "vérifié", "pro de l'année"
- **SEO programmatique** : pages catégorie × ville
- **Application mobile native** (iOS / Android), priorité côté pro

### Critères de sortie de V2

- Taux de rebooking client > 25 %
- Panier moyen multi-vendeurs en hausse de +30 % vs V1
- Au moins 20 comptes Enterprise

---

## V3+ — Long terme (vision)

À cadrer plus tard, options possibles :

- Internationalisation (Belgique → Suisse → Maroc selon réseau)
- API publique pour intégrations tierces
- IA de matching client ↔ pro
- White-label pour grandes marques événementielles
- Marketplace de talents (intermittents, animateurs, DJ)

---

# Partie 2 — Fonctionnalités détaillées

> Cette partie reste structurée par domaine fonctionnel.
> Pour les 3 domaines critiques (Catalogue, Booking, Paiements), un **deep dive dédié** existe — référencé dans chaque section concernée.

## 2.1 — Comptes & utilisateurs *(Keycloak + DB Tukio)*

### Architecture d'identité

**Keycloak** est l'autorité d'identité (IdP) pour Tukio. Il gère :
- Inscription / connexion / logout
- Vérification email
- Reset password
- MFA (TOTP)
- Login social (Google, Apple — V1)
- Sessions et refresh tokens (OIDC)
- B2B SSO via SAML (V2, pour comptes Enterprise)

**La base de données Tukio** stocke :
- Données métier (profil, KYC docs, services, bookings, etc.)
- Mapping `keycloak_user_id` → `tukio_user_id`
- Attributs métier non-auth (subscription_tier, kyc_status, stripe_*, etc.)

### Realm Keycloak — structure

```
realm: "tukio"
├── clients
│   ├── tukio-web (frontend Next.js)
│   ├── tukio-admin (interface admin)
│   ├── tukio-api (backend → tokens M2M)
│   └── tukio-mobile (V2)
├── roles (realm-level)
│   ├── client
│   ├── pro
│   ├── admin-support
│   ├── admin-modo
│   └── admin-super
└── identity providers (V1)
    ├── google
    └── apple
```

### Trois acteurs

| Acteur | Rôle Keycloak | Statut métier |
|--------|---------------|---------------|
| **Client** (B2C / B2B) | `client` | actif / suspendu |
| **Pro** | `pro` | `pending_documents` / `pending_admin_review` / `verified` / `suspended` / `banned` |
| **Admin** | `admin-{support\|modo\|super}` | actif / suspendu |

### User stories clés

| ID | Story | Acteur | Cible |
|----|-------|--------|-------|
| US-AUTH-01 | Je m'inscris en tant que client particulier en 30 s | Client | MVP |
| US-AUTH-02 | Je m'inscris en tant que pro et soumets mes documents | Pro | MVP |
| US-AUTH-03 | Un admin valide ou rejette mon dossier pro | Admin | MVP |
| US-AUTH-04 | Je récupère mon mot de passe par email | Tous | MVP |
| US-AUTH-05 | Je m'inscris en tant qu'entreprise cliente | Client B2B | V1 |
| US-AUTH-06 | Je passe la KYC complète Stripe Identity | Pro | V1 |
| US-AUTH-07 | Je modifie mon profil pro (portfolio, équipe, certifs) | Pro | V1 |
| US-AUTH-08 | Je m'inscris/connecte avec Google ou Apple | Tous | V1 |
| US-AUTH-09 | J'active la 2FA sur mon compte | Pro / Admin | V1 (obligatoire admin dès MVP) |
| US-AUTH-10 | Je connecte mon SSO entreprise (SAML) | Client Enterprise | V2 |

### KYC à 2 niveaux

À ne pas confondre :

| KYC | Géré par | Cible | Quand |
|-----|----------|-------|-------|
| **KYC identité** | Keycloak (compte vérifié) + Tukio (docs admin) | Tous les pros | Inscription |
| **KYC financier** | Stripe Identity (V1) ou docs manuels (MVP) | Pros recevant des paiements | Avant 1ʳᵉ résa |

### Règles métier

- **Validation pro** : un pro ne peut publier aucun service tant que son dossier n'est pas validé (status = `verified` côté Tukio).
- **Email vérifié obligatoire** (via Keycloak) avant toute transaction.
- **Suppression de compte** : soft-delete pour conserver les données comptables 10 ans.
- **Multi-comptes pro interdits** sur le même SIRET sauf cas Enterprise (groupes).

### États du compte pro (côté Tukio, en plus de l'état Keycloak)

```
pending_email_verification (Keycloak gère)
   ↓ (email vérifié)
pending_documents
   ↓ (docs uploadés)
pending_admin_review
   ↓ (admin valide)         ↘ (admin rejette)
verified                    rejected → peut re-soumettre
   ↓ (signalements graves)
suspended
   ↓ (résolution)
verified
   ↓ (admin bannit)
banned (avec hash conservé pour anti-recréation)
```

### Edge cases

- Pro qui change de SIRET (passage micro → SAS) → ré-onboarding KYC partiel
- Compte client qui devient pro (upgrade) → conversion via ajout du rôle `pro` côté Keycloak + flow KYC, sans perte d'historique
- Doublon email côté client et pro : **autorisé** (deux profils distincts liés au même email Keycloak via attributs de rôle)

### Dépendances

- **Keycloak** (self-hosted ou managé via Phasetwo / Red Hat SSO)
- **Stripe Identity** (KYC financier) — V1
- Service email transactionnel (Resend recommandé)
- Stockage sécurisé des pièces d'identité (chiffrement at-rest)

### Métriques

- Taux de complétion d'inscription pro (objectif > 60 %)
- Délai moyen de validation admin (objectif < 24 h)
- Taux de rejet KYC (à surveiller)
- Taux d'adoption MFA (objectif 100 % admins, > 30 % pros V1)

---

## 2.2 — Catalogue & services

> 📄 **Deep dive complet** : `tukio_catalogue_deepdive.md` (taxonomie, fiche pro, disponibilités, recherche, médias, 18 décisions actées)

**Synthèse** :
- Architecture à 3 niveaux : Catégorie → Sous-catégorie → Type
- Taxonomie figée gérée par admins
- 3 modes de tarification : à l'unité / forfait / sur devis
- Disponibilités à 4 dimensions : inventaire, concurrence dans le temps, buffer, blocages
- Auto-publication si pro vérifié + < 3 signalements ; modération a posteriori sinon
- Algorithme de ranking transparent, pas de pay-to-rank pur

---

## 2.3 — Booking & panier multi-vendeurs

> 📄 **Deep dive complet** : `tukio_booking_paiements_deepdive.md` (parcours détaillés, états, 15 décisions actées)

**Synthèse** :
- 5 phases d'une transaction : découverte → intention → transaction → exécution → clôture
- 4 parcours distincts : réservation directe (MVP), demande de devis (V1), panier multi-vendeurs (V1), modification (V1)
- Capture différée Stripe au MVP (autorisation puis capture à l'acceptation)
- Multi-vendeurs en V1 : N PaymentIntents distincts groupés par `Order` côté Tukio
- Politique d'annulation : 3 templates (souple / standard / strict) + custom V1

---

## 2.4 — Paiements & facturation

> 📄 **Deep dive complet** : `tukio_booking_paiements_deepdive.md` (Stripe Connect, splits, échéanciers, refunds, TVA, factures)

**Synthèse** :
- Stripe Connect Express (le pro a un compte Stripe lié à Tukio)
- Modèle "destination charge" avec `application_fee_amount`
- Subscription tiers gérés via Stripe Billing (séparé du Connect)
- Mandat de facturation Tukio → Client au nom du pro (art. 289 CGI)
- 3 cas TVA à gérer (non assujetti / B2C / B2B intra-UE)
- ⚠ **Audit obligatoire par expert-comptable spécialisé marketplace avant V1** — risque #1 du projet

---

## 2.5 — Abonnements professionnels

### Tiers (rappel)

| Feature | Starter | Business | Enterprise |
|---------|---------|----------|------------|
| Prix | 0 € | 29 €/mois | sur devis |
| Commission | 15 % | 10 % | 5 % + frais fixes |
| Services publiés | 5 max | illimité | illimité |
| Photos par service | 5 max | illimité | illimité |
| Réponse aux avis | ❌ | ✅ | ✅ |
| Stats avancées | ❌ | ✅ | ✅ |
| Mise en avant (boost) | ❌ | 1 boost/mois | illimité |
| Multi-utilisateurs | ❌ | 3 max | illimité |
| Account manager | ❌ | ❌ | ✅ |
| SLA support | 72 h | 24 h | 4 h |
| Intégrations comptables | ❌ | CSV | API directe |
| SSO entreprise (SAML) | ❌ | ❌ | ✅ (V2) |

### Règles métier clés

- Aucun engagement (résiliation libre fin de période)
- Période d'essai 14 jours sur Business à l'inscription
- Échec paiement : 3 tentatives sur 7 jours → bascule auto Starter
- **Tier Tukio dérivé de l'état Stripe Subscription, jamais l'inverse** (sécurité : pas de "free Enterprise" possible)

### Métriques

- Conversion Starter → Business (objectif > 15 % à 6 mois)
- ARR (annual recurring revenue)
- Churn mensuel (objectif < 5 %)
- Ratio MRR / commissions (mesure de diversification)

---

## 2.6 — Messagerie

### Synthèse fonctionnelle

- Chat client ↔ pro lié à une réservation (MVP)
- Chat libre avant booking pour devis (V1)
- Anti-désintermédiation : détection regex emails/téléphones avec masquage tant que résa non confirmée (V1)
- Pièces jointes avec scan antivirus (V1)
- Rétention 5 ans (litiges et conformité)
- Rate limiting anti-spam : max 3 messages/h vers un client qui n'a pas répondu

### Métriques

- Délai médian de première réponse pro (objectif < 2 h)
- Taux de conversation → réservation
- Taux de signalement par message

---

## 2.7 — Avis & évaluations

### Synthèse fonctionnelle

- Note unique 1-5 + commentaire (MVP)
- Note multi-critères (qualité, ponctualité, com, prix) en V1
- Réponse pro aux avis (V1, tier Business+)
- Note réciproque pro → client (V1, visible aux autres pros)
- Demande d'avis automatique J+1 après événement, relance J+7
- Modération a posteriori sur signalement
- Pondération par récence : avis < 6 mois pèsent 2× plus dans la note agrégée

### Métriques

- Taux de dépôt d'avis (objectif > 40 %)
- Note moyenne plateforme
- Volume signalements / 1000 avis

---

## 2.8 — Modération & administration

### Synthèse fonctionnelle

- Validation manuelle des dossiers pros (MVP)
- Workflow de litige structuré (V1) : ouverture → médiation 48 h → résolution → clôture (réouverture possible 15 j)
- Sanctions graduelles : avertissement → suspension publication 7 j → suspension compte 30 j → bannissement
- Bannissement : conservation hash IP/email/téléphone pour anti-recréation
- Audit trail immuable de toutes les actions admin
- Rôles granulaires (V1) : `admin-super`, `admin-support`, `admin-modo` (gérés via Keycloak)

### Métriques

- Délai moyen de résolution litige (objectif < 7 jours)
- % litiges résolus à l'amiable
- Coût moyen par litige
- Volume signalements / 1000 transactions

---

# Partie 3 — Décisions consolidées & architecture

## 3.1 — Réponses aux 10 questions ouvertes

Toutes validées avec le founder.

| # | Question | Décision |
|---|----------|----------|
| **Q1** | Périmètre géographique au lancement ? | **Pays de la Loire** prioritairement Loire-Atlantique (44) + Maine-et-Loire (49). Bretagne en V1, grandes agglos FR en V2. |
| **Q2** | Catégories pilotes au MVP ? | **Tentes/chapiteaux + mobilier événementiel** (forte complémentarité, panier moyen élevé). |
| **Q3** | Acceptation atomique ou par pro pour multi-vendeurs ? | **Atomique au MVP** (sans objet, mono-vendeur), **par pro en V1**. |
| **Q4** | Stripe Express ou Custom ? | **Express** (KYC géré par Stripe, dashboard intégré, conformité PSD2 simplifiée). |
| **Q5** | Mobile : responsive, PWA ou native ? | **Responsive MVP, PWA V1, native V2** (priorité côté pro, terrain). |
| **Q6** | Modération internalisée ou outsourcée ? | **Internalisée au début (1-2 personnes)**, outsourcing partiel V1 sur tâches simples. Litiges toujours en interne. |
| **Q7** | Stack technique ? | **Mono-repo full-stack** : Next.js 15 + PostgreSQL + Keycloak + Stripe Connect + Cloudflare R2 + Resend + Upstash Redis. |
| **Q8** | Politique de prix imposée ou libre ? | **Libre avec garde-fous** : flag à ±50 % de la médiane catégorie. Affichage prix médian sur fiche catégorie. |
| **Q9** | Marque "Tukio" tel quel ? | **Tukio + tagline obligatoire** ("événement" en swahili est opaque pour cible FR). 3 directions à A/B tester. |
| **Q10** | Statut éditeur ou hébergeur ? | **Hybride** : hébergeur LCEN + tiers de confiance pour le paiement. **Pas de modération pré-publication systématique** (sinon bascule éditeur). À faire valider par avocat numérique avant lancement. |

## 3.2 — Décisions actées dans les deep dives

### Booking & Paiements *(15 décisions D-01 à D-15 — voir deep dive)*

Highlights :
- Capture différée au MVP (D-01)
- Commission visible côté pro avec mise en avant (D-02)
- Coordonnées client visibles **après** acceptation pro (D-03)
- N PaymentIntents pour multi-vendeurs (D-04)
- Acompte 30/70 à J-7 par défaut V1 (D-06)
- Annulation : 3 templates Tukio + custom V1 (D-07)
- Stripe Billing pour les abos (D-09)
- Mandat de facturation générique signé à l'onboarding (D-10)

### Catalogue & Services *(18 décisions C-01 à C-18 — voir deep dive)*

Highlights :
- 2 catégories pilotes au MVP (C-01)
- Pas de multi-catégorisation (C-02)
- Tags secondaires : liste fermée admin ~30 tags (C-03)
- Photos minimum 3 (bloquant), max 15 (C-05, C-11)
- Vidéo en V1 (C-06)
- Stock affiché client : non au MVP, V1 si < 20 % (C-08)
- Politique annulation : 3 templates au MVP, custom V1 (C-12)
- Auto-publication : pro `verified` > 30 j et < 3 signalements (C-13)
- Modération a posteriori (C-14)

## 3.3 — Architecture technique

### Stack proposé (Q7 validé)

| Couche | Choix | Justification |
|--------|-------|---------------|
| Frontend | Next.js 15 (App Router) | SSR pour SEO, hybridation client/serveur, écosystème mature |
| Backend (API) | Next.js API routes (MVP) → service Node séparé (V1+) | Vélocité MVP, séparation quand le besoin émerge |
| Base de données | PostgreSQL (managé : Supabase ou Neon) | Robuste, FTS suffisant au MVP, écosystème ORM |
| ORM | Prisma ou Drizzle | Type-safe, migrations |
| Auth / IdP | **Keycloak** (self-hosted ou Phasetwo) | OIDC standard, multi-acteurs, MFA, SSO B2B-ready |
| Paiements | Stripe Connect Express + Stripe Billing | Standard marketplace, conformité simplifiée |
| Médias | Cloudflare R2 + Cloudflare Images | Stockage objet économique + CDN + transformations |
| Emails | Resend | Simple, deliverability solide, prix raisonnable |
| Cache & locks | Upstash Redis (managé serverless) | Locks dispo, sessions, rate limiting |
| Recherche | Postgres FTS au MVP → Meilisearch en V1 | Évite la complexité prématurée |
| Observabilité | Sentry + Axiom (logs) + Upstash QStash (jobs) | Stack légère, suffisante MVP/V1 |
| Hébergement | Vercel (frontend) + Render/Railway (services) | Mono-repo Vercel-friendly, services dédiés pour Keycloak/jobs |

### Flux d'authentification — Keycloak intégré

```
1. Client web (Next.js) → redirect Keycloak login
2. Keycloak authentifie (email/pwd ou social) → délivre access_token + refresh_token (OIDC)
3. Client web → appel API Tukio avec access_token (Bearer)
4. API Tukio → vérifie token (introspection ou JWKS) + récupère user_id Keycloak
5. API Tukio → mapping user_id Keycloak → user Tukio (DB) + rôles + scopes métier
6. Réponse API
```

### Mapping identités cross-systèmes

Un utilisateur Tukio est lié à plusieurs identités externes :

```
TukioUser (table interne)
  ├── id (uuid)
  ├── keycloak_user_id (sub OIDC)
  ├── stripe_customer_id (pour abos pro et facturation client)
  ├── stripe_connect_account_id (pour pros uniquement, pour recevoir paiements)
  ├── role (client | pro | admin)
  ├── created_at, updated_at
  └── ... (attributs métier)
```

### Considérations Keycloak — opérationnel

**Avantages confirmés :**
- Standardisation auth (OIDC) → indépendance vis-à-vis du framework
- Multi-acteurs propre (rôles realm-level)
- B2B SSO V2 sans refactor (Keycloak gère SAML federation natif)
- MFA built-in, social login facile

**Coûts opérationnels à anticiper :**
- Self-hosted Keycloak demande une instance dédiée (Postgres séparée pour Keycloak + monitoring)
- Alternative MVP : **Phasetwo** (Keycloak managé) pour éviter d'opérer l'infra. Tarifs et quotas à vérifier directement sur leur site.
- Customisation des thèmes Keycloak (login pages aux couleurs Tukio) : 1-2 semaines de travail
- Flows de registration custom (pro multi-step) : Keycloak supporte mais demande config avancée

**Reco MVP** : démarrer en **Phasetwo** pour éviter l'opérationnel, basculer vers self-hosted en V2 si besoins de customisation très avancée.

## 3.4 — Risques actualisés

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| **R1** | TVA & facturation marketplace mal conformes | 🔴 Critique | Audit expert-comptable spécialisé **avant V1** (500-1500 €) |
| **R2** | Statut éditeur LCEN involontaire (modération pré-pub) | 🔴 Critique | Pas de modération systématique pré-publication. Audit avocat numérique |
| **R3** | Concentration GMV sur peu de pros | 🟠 Élevé | Métrique de concentration suivie hebdo. Diversification active de l'offre |
| **R4** | Cold-start côté offre (catalogue vide) | 🟠 Élevé | Sourcing pro physique en PdL (avantage géographique) — 50 premiers pros recrutés en main propre |
| **R5** | Race conditions sur dispos | 🟠 Élevé | Locks Redis + idempotence transaction DB. Refund auto si conflit post-paiement |
| **R6** | Anti-désintermédiation insuffisante | 🟡 Moyen | Coordonnées client masquées avant acceptation. Détection regex en messagerie V1 |
| **R7** | Stripe Connect KYC long (1-7 jours) | 🟡 Moyen | UX : "votre compte est en cours de vérification, vous pouvez compléter votre fiche en attendant" |
| **R8** | Sync Keycloak ↔ Tukio drift | 🟡 Moyen | Job de réconciliation quotidien + webhooks Keycloak (events) |
| **R9** | Disputes Stripe (chargebacks) tardifs | 🟡 Moyen | Evidence trail systématique : avis, échanges, photos. CGV pro qui prévoient le débit |
| **R10** | RGPD vs conservation comptable 10 ans | 🟡 Moyen | Anonymisation données perso au-delà du délai utile, conservation écritures comptables |

## 3.5 — Documents complémentaires

Tous produits, à lire dans cet ordre selon le besoin :

| Doc | Quand le lire | Lignes |
|-----|---------------|--------|
| **`tukio_spec_v2.md`** *(ce document)* | Vision et référence générale | ~750 |
| **`tukio_catalogue_deepdive.md`** | Avant tout dev/design sur le catalogue | 847 |
| **`tukio_booking_paiements_deepdive.md`** | Avant tout dev/design sur le booking ou les paiements | 854 |
| **`tukio_design_brief.md`** *(Doc 0)* | Avant tout travail de design | 940 |

À produire ensuite (cf. `tukio_design_brief.md` section L) :
- **Doc 1 — Architecture d'information** (sitemap, navigation, permissions) — *prochaine étape*
- Docs 2-9 — Flux UX par domaine (en priorité Catalogue, Booking, Paiements)

---

*Fin du document — version 2.1, supersede v2.0.*
