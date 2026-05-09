---
title: "Product Brief : tukio.one"
status: "complete"
created: "2026-05-07"
updated: "2026-05-08"
version: "v0.3"
audience: "Founder, équipe produit, design, dev, futurs partenaires, marketing"
inputs:
  - docs/tukio_spec_v2.2.md
  - docs/tukio_design_brief.md
  - docs/tukio_information_architecture.md
  - docs/tukio_product_tech_alignment.md
  - docs/tukio_event_catalog.md
  - docs/tukio_booking_paiements_deepdive.md
  - docs/tukio_booking_svc_deepdive.md
  - docs/tukio_catalogue_deepdive.md
  - docs/tukio_ux_flow_auth_accounts.md
  - docs/tukio_ux_flow_catalog.md
  - docs/tukio_ux_flow_booking.md
  - docs/tukio_ux_flow_communication.md
  - docs/tukio_ux_flow_monetization.md
  - docs/tukio_ux_flow_admin_moderation.md
  - docs/tukio_strategie_acquisition.md
  - docs/tukio_opportunites_futures.md
  - docs/microservices-architecture.md
  - web research (paysage marketplaces événementielles, tendances 2025-2026)
---

# Product Brief : tukio.one

> Document de référence consolidé pour la réalisation du projet.
> Lecture obligatoire avant onboarding produit / design / tech / commercial / marketing.
> Synthèse opérationnelle de l'ensemble des 16 documents Tukio + benchmark marché.

## Sommaire

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Vision & ambition](#2-vision--ambition)
3. [Contexte de marché & opportunité](#3-contexte-de-marché--opportunité)
4. [Le problème](#4-le-problème)
5. [La solution & expérience produit](#5-la-solution--expérience-produit)
6. [Cibles & personas](#6-cibles--personas)
7. [Positionnement & différenciation](#7-positionnement--différenciation)
8. [Identité de marque & expérience](#8-identité-de-marque--expérience)
9. [Périmètre fonctionnel par domaine](#9-périmètre-fonctionnel-par-domaine)
10. [Modèle économique & monétisation](#10-modèle-économique--monétisation)
11. [Stratégie d'acquisition de la demande](#11-stratégie-dacquisition-de-la-demande)
12. [Architecture technique](#12-architecture-technique)
13. [Roadmap & versions](#13-roadmap--versions)
14. [Opportunités futures (hors roadmap)](#14-opportunités-futures-hors-roadmap)
15. [Critères de succès & métriques](#15-critères-de-succès--métriques)
16. [Conformité & légal](#16-conformité--légal)
17. [Risques & mitigations](#17-risques--mitigations)
18. [Conventions, gouvernance & nommage](#18-conventions-gouvernance--nommage)
19. [Documents de référence](#19-documents-de-référence)

---

## 1. Synthèse exécutive

**tukio.one** est une **marketplace transactionnelle B2B2C** dédiée à l'organisation d'événements en France. Elle connecte directement les **organisateurs** (particuliers, entreprises) aux **professionnels événementiels locaux** (loueurs de matériel, traiteurs, prestataires son/lumière, mobilier, animateurs, lieux), avec **réservation, paiement et facturation intégrés**.

**Promesse côté client :** *"Trouve les bons pros près de chez toi, en confiance, sans appeler 10 personnes."*
**Promesse côté pro :** *"Concentre-toi sur ton métier, on s'occupe du reste : visibilité, paiement, paperasse."*

**Trajectoire produit en 4 étapes**, chacune commercialisable seule, chacune mesurée sur un chiffre business :

| Version | Cible business | Durée | Critère de sortie |
|---------|---------------|-------|--------------------|
| **MVP (v0.1)** | Valider la transaction pro ↔ client | ~3-4 mois | 50 pros actifs + 100 réservations payées |
| **V1 (v1.0)** | Marketplace complète & monétisable | ~3 mois | Premier mois rentable sur commission + abos |
| **V2 (v2.0)** | Croissance & rétention | ~3 mois | Taux de rebooking client > 25 % |
| **V3+** | Scale & expansion | Ouvert | Multi-pays / mobile native / B2G / API publique |

**Lancement géographique :** Pays de la Loire, prioritairement **Loire-Atlantique (44) + Maine-et-Loire (49)**. Couverture physique possible depuis Nantes — le founder peut serrer la main aux 50 premiers pros, avantage compétitif difficile à répliquer pour des plateformes nationales.

**Stack & architecture :** monorepo full-stack — Next.js 15 + `next-intl` (frontend i18n FR/EN), **NestJS 11 hexagonal en 10 microservices** (backend), Keycloak 25 (identité), Stripe Connect Express (paiements), NATS JetStream (events), PostgreSQL 16 (database-per-service, **schéma multilingue** sur les entités user-facing du `catalog-svc`), Meilisearch 1 index par locale (recherche), Cloudflare R2 (médias), Resend (emails FR + EN), Upstash Redis (cache & locks). Microservices déployés en **3 unités au MVP** pour limiter le burden ops, splitables service par service ensuite selon le trafic.

**i18n FR + EN dès Sprint 0** (ADR-012) : l'app n'est **pas internationalisée géographiquement** au MVP (France uniquement) mais **bilingue linguistiquement** dès le départ — cas d'usage cible : utilisateur résidant en France qui préfère parler anglais. Tout texte UI passe par `next-intl` (zéro hardcodé), tout contenu user-generated (services, profils pros, catégories) est stocké dans des tables de traductions, paths URL avec locale-prefix `/fr/...` ou `/en/...`.

**Risque #1 opérationnel :** ce n'est pas la conformité TVA ni le LCEN — c'est l'**acquisition de la demande côté client**. Les pros peuvent être démarchés en physique (50 en 3 mois faisable). Sans clients qui passent commande, les pros quittent la plateforme dans les 6 mois. La stratégie d'acquisition (cf. §11) est aussi structurante que la roadmap produit.

---

## 2. Vision & ambition

### Vision (24-36 mois)

Devenir **la référence française de l'événementiel local** : le lieu unique où particuliers, entreprises et collectivités assemblent des événements de bout en bout en confiance, où les pros artisanaux retrouvent leur capacité à se concentrer sur leur métier, et où chaque transaction laisse une trace utile (avis vérifiés, facturation conforme, comptabilité automatisée).

L'ambition n'est pas d'être un *Eventbrite français* (ticketing public) ni un *MalleàWedding moderne* (vertical mariage). C'est d'être ce que **Le Bon Marché** est au commerce — la place de marché élégante, ancrée localement, premium dans son segment, où la confiance est l'expérience par défaut.

### Horizon long terme (V3+, 36 mois et au-delà)

Les pistes formellement documentées dans `tukio_opportunites_futures.md` (cf. §14) : B2G/collectivités, expansion nationale, expansion européenne, marketplace inter-pros (B2B2B), intégrations comptables avancées, app mobile native, verticales spécialisées (mariage/séminaire/anniversaire), contenu/média, marketplace de talents (DJ, photographes), outils SaaS pros (CRM/planning/devis).

**Règle d'or** : ces pistes ne sont **pas** dans la roadmap MVP/V1/V2. Elles existent pour ne pas perdre les idées sans polluer les docs opérationnels. Quand une piste mérite d'être réétudiée, on ouvre un chantier dédié.

### Principes directeurs (toutes versions)

1. **Chaque version doit être commercialisable seule.** Pas de feature à moitié faite qui attend la suivante.
2. **L'ordre suit la valeur business**, pas la facilité technique.
3. **Une feature = un chiffre business à bouger.** Si on ne sait pas quelle métrique elle déplace, elle attend.
4. **Versions courtes, pas de "big bang".** Cible : MVP en 3-4 mois, V1 à +6 mois, V2 à +12 mois.

---

## 3. Contexte de marché & opportunité

### Taille & dynamique du marché

- **Marché de l'événementiel français** : ~30 Md€ B2C+B2B confondus (estimation `tukio_strategie_acquisition.md`), ~80 Md€ tout segment cumulé y compris matériel et lieux.
- **Online event ticketing global** (référence sectorielle adjacente) : ~53 Md$ en 2025 → ~56,6 Md$ en 2026, CAGR ~6,7 %.
- **Économie créative & événements** convergent : adoption croissante d'événements physiques par les créateurs, dépenses ad créateurs USA +26 % YoY en 2025.

### Tendances structurantes 2025-2026

- **Démocratisation des rails de paiement marketplace** (Stripe Connect, Mangopay) : conformité PSD2 quasi clé-en-main, KYC géré par l'opérateur.
- **Exigences accrues de transparence des frais** (FTC junk-fee rule USA mai 2025, équivalents EU en discussion) : avantage aux plateformes qui affichent un prix tout-compris.
- **AI-driven discovery** devient table-stakes : ranking personnalisé, recherche conversationnelle, recommandations.
- **Mobile-first organisateurs B2B** : les office managers organisent depuis leur smartphone.
- **Crise de confiance B2C** sur Leboncoin / annuaires : besoin de plateformes structurées avec garantie paiement et avis vérifiés.

### Paysage concurrentiel

| Catégorie | Acteurs | Forces | Faiblesses |
|-----------|---------|--------|------------|
| **Annuaires verticaux mariage** | Mariages.net, Zankyou, MalleàWedding, 1001Listes | Trafic SEO, notoriété B2C mariage | Pas de transaction, esthétique datée, vertical mariage uniquement |
| **Annuaires lieux** | ABC Salles, 1001Salles | Couverture lieux | Pas de transaction, mise à jour aléatoire |
| **Plateformes ticketing** | Eventbrite, Luma, Weezevent | Excellent pour billetterie publique | Pas adaptés au service événementiel à la demande |
| **Plateformes corporate** | Bizzabo, Cvent, Splash | Outils événements pros | Cher, anglo-saxon, pas de marketplace pro |
| **Petites annonces** | Leboncoin | Trafic | Pas de cadre, pas de confiance, pas de paiement |
| **Wedding planners digitaux** | Bridebook, WeddingWire | Couverture mariage | Vertical mariage, pas de transaction directe |

**Le vide de marché :** aucun acteur n'offre aujourd'hui en France une expérience **réservation tunnellisée + paiement sécurisé + ancrage territorial** pour la diversité des événements (mariage, anniversaire, séminaire, lancement produit, fête associative). Tukio se positionne précisément sur ce vide.

### Pourquoi maintenant

1. **Reprise durable du live post-Covid** : multi-année 5-7 % CAGR sur une base > 50 Md$ ailleurs, dynamique comparable en France.
2. **Stripe Connect Express** est mature : ce qui aurait coûté 18 mois d'intégration en 2018 est faisable en 6-8 semaines en 2026.
3. **Keycloak managé** (Phasetwo, Red Hat SSO) supprime la dette identité.
4. **Saturation des annuaires sans transaction** : utilisateurs et pros sont prêts à payer pour de la qualité.
5. **Founder-led local** : le marché de l'événementiel est ultra-local. Une plateforme qui démarre en serrant les mains a un avantage durable sur des concurrents nationaux.

---

## 4. Le problème

### Côté organisateur

Organiser un événement aujourd'hui, c'est une **chasse au trésor coûteuse en temps et en énergie** :

- **Découverte fragmentée** : 4-7 onglets ouverts (annuaires, Google, Instagram, Mariages.net, Leboncoin, recommandations Facebook).
- **Devis manuels** : appels téléphoniques, mails sans tarif, attentes 48-72 h, formats incomparables.
- **Disponibilité opaque** : on découvre 5 prestataires intéressants, dont 3 ne sont pas dispos à la date voulue — info qu'on n'aurait pas eue avant 3 jours.
- **Acomptes par virement, sans garantie** : risque de no-show prestataire, zéro recours en cas de litige.
- **Coordination multi-prestataires** subie par le client : chacun envoie son contrat, sa facture, son RIB.
- **Trace post-événement** : aucune comptabilité unifiée, aucune traçabilité des avis pour l'organisation suivante.

**Conséquences mesurables :**
- 15-30 h passées par événement structurant (mariage, séminaire 50p)
- 10-25 % de dérive budgétaire vs intention initiale
- 1 organisateur sur 4 abandonne en cours et rabat son ambition

### Côté professionnel

Les pros artisanaux de l'événementiel souffrent d'un modèle d'acquisition vétuste :

- **Bouche-à-oreille saturé** : croissance plafonnée à la zone géographique du téléphone.
- **Référencements payants peu rentables** : Mariages.net 200-500 €/mois sans garantie de leads qualifiés.
- **Devis manuels chronophages** : 30-60 min par devis, taux de transformation < 20 %.
- **Trésorerie subie** : acomptes par virement encaissés en J+5 à J+30, soldes parfois jamais payés.
- **Paperasse** : factures, échéanciers, recouvrement, relances — temps non facturable.
- **Visibilité réduite** : ils n'ont ni le SEO d'un annuaire ni l'audience d'un Instagram bien tenu.

**Conséquences mesurables :**
- 30-50 % du temps pro dédié à l'admin (vs 10-20 % attendu)
- CAC opaque, taux de transformation invisible
- Risque permanent d'impayés (5-10 % du CA)

### Côté écosystème

Le marché actuel oblige les **deux camps à se débrouiller seuls**, ce qui crée des friction structurelles : pros sous-utilisés, clients déçus, et aucune confiance accumulée à travers les transactions. Une plateforme qui orchestre les 5 phases (découverte → intention → transaction → exécution → clôture) capture une valeur structurellement non capturée aujourd'hui.

---

## 5. La solution & expérience produit

Tukio orchestre les **5 phases d'une transaction événementielle** de bout en bout. Chaque phase est conçue comme un produit autonome, mais s'enchaîne sans rupture pour l'utilisateur.

### Phase 1 — Découverte

- **Recherche par catégorie / ville / date** sur la home et la barre persistante.
- **Catégorisation à 3 niveaux** : Catégorie → Sous-catégorie → Type. Taxonomie figée, gérée par les admins (pas de tags libres pros).
- **Fiches services riches** : 3 photos minimum (bloquant), 15 maximum, description, tarif (unité / forfait / sur devis), zone de livraison, délai minimum de réservation, options, politique d'annulation (3 templates : souple / standard / strict).
- **Ranking transparent** sans pay-to-rank pur : pertinence textuelle + géolocalisation + récence + score de qualité (avis, taux de réponse, taux d'acceptation).
- **Mise en avant payante** (boost) en V1, mais visible et limitée (badge "mis en avant"), pas de fausses places organiques.
- **Affichage prix médian par catégorie** sur la fiche catégorie : transparence client, garde-fou pricing.

### Phase 2 — Intention

- **Messagerie liée à la réservation** (MVP) : pas de chat libre avant booking, on évite la désintermédiation.
- **Chat libre avant booking** (V1) pour devis personnalisés.
- **Demande de devis personnalisé** (V1) : le client précise contexte, le pro propose un tarif spécifique avant capture.
- **Panier multi-vendeurs** (V1) : un panier = N pros, un seul paiement, splits Stripe automatiques.
- **Réservation conditionnelle** (V1) : option de 48 h réservée le temps de finaliser le contexte.

### Phase 3 — Transaction

- **Paiement par carte avec capture différée** (Stripe Connect Express) :
  - Autorisation à la commande
  - Capture à l'acceptation pro
  - Reversement automatique J+1 après l'événement
- **Coordonnées client masquées** avant acceptation pro (anti-désintermédiation).
- **Commission visible côté pro** avec mise en avant du net perçu.
- **Acomptes 30/70** par défaut V1 (modulables par le pro).
- **Échéanciers personnalisables** (V1) — payment-svc gère via Stripe SetupIntent + cron.
- **Mandat de facturation** signé à l'onboarding pro : Tukio émet la facture au nom du pro (art. 289 CGI).
- **3 cas TVA gérés** : pro non-assujetti (franchise), B2C, B2B intra-UE.

### Phase 4 — Exécution

- **Chat structuré** avec audit trail.
- **Anti-désintermédiation** (V1) : détection regex emails/téléphones avec masquage tant que la résa n'est pas confirmée.
- **Pièces jointes** (V1) avec scan antivirus.
- **Notifications email** (Resend) : confirmation, rappel J-7, rappel J-1, demande d'avis J+1.
- **Notifications in-app & SMS** (V1).

### Phase 5 — Clôture

- **Demande d'avis automatique J+1** après l'événement, relance J+7.
- **Note unique 1-5 + commentaire** (MVP).
- **Avis multi-critères** (V1) : qualité, ponctualité, communication, rapport qualité/prix.
- **Réponse pro** (V1, tier Business+).
- **Note réciproque pro → client** (V1, visible aux autres pros).
- **Pondération par récence** : avis < 6 mois pèsent 2× plus.
- **Litiges** (V1) : workflow ouverture → médiation 48 h → résolution → clôture (réouverture possible 15 j), remboursement partiel par admin.

### Cycles annexes

- **Onboarding pro** : inscription → soumission documents (KYC light MVP, Stripe Identity V1) → validation admin manuelle (objectif < 24 h) → publication services.
- **Onboarding client** : inscription → vérification email → réservation possible. Pas de KYC client.
- **Modération continue** : signalement par n'importe quel utilisateur → file admin → décision graduée (avertissement → suspension publication 7 j → suspension compte 30 j → bannissement avec hash anti-recréation).

---

## 6. Cibles & personas

### Côté client

#### Persona C1 — Particulier organisateur événement personnel structurant

- **Profil** : 25-55 ans, urbain ou périurbain, CSP+ moyenne supérieure
- **Situation** : organise un mariage, anniversaire significatif (30/40/50 ans), baptême, EVJF/EVG
- **Budget Tukio** : 1 000 - 10 000 € (l'événement total peut être 10×)
- **Ticket moyen estimé** : 800 € TTC (hypothèse `tukio_strategie_acquisition.md`)
- **Recherche** : commence 6-12 mois avant l'événement, achat ponctuel (LTV ~1 résa)
- **Comportement** : compare 3-5 prestataires par catégorie, lit les avis avant de contacter, prêt à payer une légère prime pour la fiabilité
- **Pain points** : "Je ne sais pas si je peux faire confiance" / "J'ai pas le temps d'appeler 10 personnes" / "On m'a déjà fait des fausses promesses"
- **Cible** : MVP

#### Persona C2 — Office manager / responsable événements entreprise

- **Profil** : entreprise locale (PME 20-200 personnes) ou ETI nationale
- **Situation** : organise séminaires, kick-offs, lancements produits, journées d'équipe, soirées de fin d'année
- **Budget Tukio** : 5 000 - 50 000 € par événement
- **Ticket moyen estimé** : 2 500 € TTC
- **Recherche** : récurrence 2-3 résa/an pendant 2-3 ans (LTV ~5-9 résa)
- **Comportement** : besoin de devis multi-prestataires consolidés, facturation B2B propre, traçabilité comptable, paiement sur facture (V1)
- **Pain points** : "Je veux 1 facture, pas 5" / "Je dois pouvoir justifier en compta" / "Mon DAF refuse les acomptes par virement"
- **Cible** : V1 (B2B activé). **Priorité acquisition payante** car CAC tolérable plus élevé (cf. §11.2).

#### Persona C3 — Mairie / association / collectivité

- **Profil** : commune ou association locale, événements publics
- **Cible** : **V3+ uniquement** — opportunité documentée mais hors scope MVP/V1/V2 (cycle de vente B2G long 3-12 mois, conformité Code de la commande publique, MAPA, Chorus Pro, persona spécifique DGS/élus/services achats). Détail complet : `tukio_opportunites_futures.md` §C.1.
- **Signaux de réouverture** : 5+ collectivités demandant spontanément après 12 mois d'opération, stabilisation modèle B2C (CA mensuel récurrent > 100 K€), embauche d'un commercial expérimenté en B2G.

### Côté pro

#### Persona P1 — TPE / artisan événementiel local

- **Profil** : 1-10 personnes, artisan ou petite société, basé en Pays de la Loire (MVP) puis Bretagne (V1)
- **Métiers** : loueurs de tentes/chapiteaux, traiteurs, mobilier événementiel, son/lumière, animateurs, photographes, fleuristes événementiels
- **CA** : 50 k€ - 500 k€/an
- **Pain points** : leads opaques, paperasse, trésorerie subie, croissance plafonnée
- **Comportement** : mobile-first sur le terrain, pas digital-native mais prêt à apprendre un outil simple
- **Seuil de rétention** : un pro Business doit faire **≥ 2 résa/mois** sur Tukio sinon il quitte la plateforme dans les 6 mois (coût d'opportunité du temps consacré > revenu généré)
- **Cible** : MVP (1ère cible, sourcing physique)

#### Persona P2 — Pro premium / agence événementielle

- **Profil** : agences événementielles, traiteurs haut de gamme, lieux de réception
- **CA** : > 500 k€/an, équipes 10-50 personnes
- **Comportement** : besoin d'outils analytiques, intégrations comptables (Pennylane, QuickBooks), account manager, SLA support, SSO entreprise
- **Cible** : V2 Enterprise

#### Persona P3 — Pro saisonnier / freelance occasionnel

- **Profil** : pros qui font 5-30 événements/an en complément d'une autre activité
- **Comportement** : Starter (gratuit, commission 15 %) — utilisé comme canal d'acquisition complémentaire
- **Cible** : V1

### Côté admin Tukio

- **1-2 modérateurs internes** au MVP (validation pros, médiation litiges)
- **Outsourcing partiel V1** sur tâches simples (vérification photos, modération signalements basiques) — litiges et décisions graves toujours en interne
- **Rôles granulaires** (V1) : `admin-super`, `admin-support`, `admin-modo` — gérés via Keycloak

### Acteurs Keycloak (réalisme métier)

| Acteur | Rôle Keycloak | Statut métier |
|--------|---------------|---------------|
| **Client** (B2C / B2B) | `client` | actif / suspendu |
| **Pro** | `pro` | `pending_documents` / `pending_admin_review` / `verified` / `suspended` / `banned` |
| **Admin** | `admin-{support\|modo\|super}` | actif / suspendu |

---

## 7. Positionnement & différenciation

### Le brief en 1 phrase (depuis le design brief, intangible)

> *Tukio est la place de marché qui rend l'organisation d'événements plus simple, plus fiable et plus belle, en connectant directement les organisateurs aux professionnels locaux.*

### Matrice de différenciation

| Axe | Le marché actuel | Tukio |
|-----|------------------|-------|
| **Périmètre** | Verticaux mariage, ou ticketing pur | Toute occasion (B2C + B2B + collectivités V3+), service événementiel généraliste |
| **Transaction** | Annuaires sans paiement, ou ticketing événementiel | Réservation + paiement + paperasse end-to-end |
| **Ancrage** | Plateformes parisiano-centrées ou anglo-saxonnes | *Made in Pays de la Loire*, founder physique sur le terrain |
| **Confiance** | Coordonnées dès le 1er clic, zéro garantie | Coordonnées révélées après acceptation, capture différée Stripe, mandat de facturation |
| **Esthétique** | Pinterest mariage rose, Stripe minimal froid, Leboncoin brut | Terracotta chaleureux, sobriété élégante, *modernité tranquille* |
| **Pro-friendly** | Commissions opaques, paiements lents | Commission visible (10 % MVP, 5-15 % selon tier V1), reversement J+1, abonnement Business 29 €/mois pour réduire la commission |
| **Modération** | Quasi inexistante (Leboncoin) ou intrusive (annuaires verticaux) | Modération a posteriori, hybride éditeur/hébergeur LCEN, audit trail immuable |

### Unfair advantage

L'avantage compétitif principal **n'est pas un fossé technologique**. C'est :

1. **Vélocité d'exécution territoriale** : le founder serre la main aux 50 premiers pros à moins d'1 h de Nantes. Aucune plateforme nationale ne peut répliquer ce socle de confiance en cold-start.
2. **Discipline produit & tech dès Sprint 0** : 11 ADRs, 16 documents consolidés, conventions figées. Au lieu de naviguer à vue, on capitalise.
3. **Branding sobre & chaleureux** : palette terracotta + typo serif/sans-serif positionne Tukio loin de l'esthétique tech-bro et loin du Pinterest mariage. Cible **B2C ET B2B**.
4. **Rails de paiement Stripe Connect** : conformité PSD2 simplifiée, KYC géré, splits multi-vendeurs natifs.
5. **Architecture microservices propre dès le démarrage** : pas de dette technique structurelle à payer en V1.

### Anti-positionnement (ce que Tukio **n'est pas**)

| Anti-positionnement | Pourquoi |
|---------------------|----------|
| ❌ Pinterest mariage rose poudré | Cantonne au B2C mariage, exclut le B2B et événements pros |
| ❌ Stripe minimaliste froid | Trop austère pour un produit "moments de vie" |
| ❌ Airbnb aspirationnel touristique | Pas la même promesse, on est pro et utilitaire |
| ❌ Leboncoin brut | Manque de cadre, manque de confiance |
| ❌ MalleàWedding / 1001Listes (style romantique) | Vieillit mal, exclut la cible pro |

### Références mentales (à montrer aux designers et au comité de direction)

- **Airbnb** mais en plus *chaleureux* (et moins lifestyle)
- **ManoMano** mais en plus *haut de gamme* (moins bricolage, plus événementiel)
- **Le Slip Français** pour le ton *made in France pro mais pas guindé*
- **Le Bon Marché** (digital) pour la sobriété élégante
- **Resy** ou **OpenTable** récent pour la qualité du parcours de réservation
- **Faire** (faire.com) pour la palette neutre chaleureuse

---

## 8. Identité de marque & expérience

### Attributs de marque (à incarner partout)

1. **Confiance** — On manipule des transactions à 4 chiffres. Tout doit *respirer le sérieux* sans être austère.
2. **Chaleur** — Un événement, c'est un moment de vie. L'interface ne doit pas être froide ou bureaucratique.
3. **Sobriété** — Pas de surcharge décorative. Pas Pinterest mariage.
4. **Ancrage local** — *Made in Pays de la Loire* est un atout, pas une limite.
5. **Modernité tranquille** — Ni vieillot, ni "tech bro". Élégance qui ne se démode pas en 2 ans.

### Direction visuelle

**Palette principale : terracotta**, choisie pour sa polyvalence B2C/B2B, sa différenciation vs concurrents tech (violet/bleu/vert vif), et sa cohérence avec les matériaux nobles événementiels (terre cuite, lin, bois).

- `brand-500` : `#C2410C` (primary)
- `cream-50` : `#FAF7F2` (page background par défaut)
- `charcoal-700` : `#1F1D18` (texte principal)
- Couleurs fonctionnelles désaturées (success, warning, error, info)
- **Règle stricte** : jamais de noir pur (`#000`) ni blanc pur (`#FFF`) — registre chaud uniquement

### Typographie

- **Display (titres)** : Fraunces (Google Fonts, libre), variable font, caractère événementiel sans être daté
- **Body (textes)** : sans-serif lisible (à figer avec le designer)
- **Pairing serif + sans-serif** : standard hôtellerie/événementiel haut de gamme

### Voix & ton (UX writing)

- **Vouvoiement par défaut côté client B2C** (on touche à des moments de vie, vouvoyer protège)
- **Tutoiement côté pro B2B** (relation de travail, plus directe)
- **Pas de jargon technique** côté client (pas "PaymentIntent", pas "checkout 3DS"), traductions soignées
- **Pas de "fun" forcé** : les moments de friction (litige, refus KYC) doivent rester sobres et rassurants
- **Microcopy bilingue UI/code** (cf. §18) : Pro/Client en UI, provider/customer en code

### Anti-patterns visuels

- ❌ Boutons primaires roses bonbon
- ❌ Emojis dans les CTAs
- ❌ Fonds blancs purs
- ❌ Photos d'événements sur-saturées Instagram
- ❌ Typographies fantaisistes pour les prix

---

## 9. Périmètre fonctionnel par domaine

Les **8 domaines fonctionnels** Tukio (qui ne mappent pas 1-pour-1 sur les 10 microservices, cf. §12.4).

### 9.1 Comptes & utilisateurs

**Architecture identité** : Keycloak (auth) + identity-svc (profil métier).

**Réalisations clés :**
- Inscription client en 30 s (MVP)
- Inscription pro avec validation manuelle admin (KYC light MVP : SIRET + RIB + pièce d'identité)
- Auth email/mot de passe + reset password + vérification email obligatoire avant transaction
- MFA TOTP obligatoire pour admins dès MVP, optionnel pour pros V1
- Login social Google + Apple en V1
- B2B SSO SAML pour comptes Enterprise V2
- KYC complet via Stripe Identity en V1
- Multi-comptes pro interdits sur le même SIRET sauf cas Enterprise
- Soft-delete : conservation données comptables 10 ans
- Bannissement : hash IP/email/téléphone conservé pour anti-recréation

**Métriques clés :**
- Taux de complétion d'inscription pro (objectif > 60 %)
- Délai moyen de validation admin (< 24 h)
- Taux de rejet KYC (à surveiller)
- Adoption MFA (100 % admins, > 30 % pros V1)

### 9.2 Catalogue & services

**Réalisations clés :**
- Architecture taxonomique 3 niveaux : Catégorie → Sous-catégorie → Type
- 2 catégories pilotes au MVP : *tentes & chapiteaux* + *mobilier événementiel*
- Toutes catégories cibles en V1 (équipement complet + services packagés)
- Fiche service : 3-15 photos (3 minimum bloquant), description, tarif, options, zone de livraison, délai minimum
- Vidéos (YouTube/Vimeo embed) en V1
- 3 modes de tarification : à l'unité / forfait / sur devis (sur devis = V1)
- Disponibilités à 4 dimensions : inventaire, concurrence dans le temps, buffer, blocages
- Inventory pool partagé entre fiches d'un même pro (V1, entité `InventoryPool`)
- Recherche par catégorie + ville + date (Meilisearch dès MVP)
- Auto-publication si pro `verified` > 30 j et < 3 signalements ; modération a posteriori sinon
- Affichage prix médian sur la fiche catégorie (transparence client)
- Tags secondaires : liste fermée admin (~30 tags)
- Algorithme de ranking transparent : pertinence + géo + récence + qualité ; **pas de pay-to-rank pur**

**Métriques clés :**
- Nombre de services publiés
- Taux de complétion fiche (objectif > 80 %)
- Recherche → vue fiche → contact (funnel)

### 9.3 Booking & panier multi-vendeurs

**Réalisations clés :**
- 5 phases de transaction (cf. §5)
- Réservation directe au MVP (pas de devis), panier mono-vendeur
- Demande de devis personnalisé en V1
- Panier multi-vendeurs en V1 : N PaymentIntents distincts groupés par `Order` côté Tukio
- Réservation conditionnelle (option 48 h) en V1
- 3 templates de politique d'annulation (souple / standard / strict) + custom V1
- Cart calendrier dispo en temps réel (locks Redis + DB exclusion constraint + optimistic locking — 3 layers)
- Acceptation pro atomique au MVP (mono-vendeur), par pro en V1 (multi-vendeur)
- Capture différée Stripe (autorisation à la commande, capture à l'acceptation pro)
- Acomptes 30/70 par défaut V1 (modulables)
- Modification de réservation en V1

**Métriques clés :**
- Taux d'acceptation pro (objectif > 80 %)
- Délai médian de première réponse pro (< 2 h)
- Taux de transformation conversation → réservation
- Panier moyen, panier multi-vendeurs en V1
- **Taux de complétion** (résa demandée → confirmée) : hypothèse 70 % à valider

### 9.4 Paiements & facturation

**Réalisations clés :**
- Stripe Connect Express (le pro a un compte Stripe lié à Tukio)
- Modèle "destination charge" avec `application_fee_amount`
- Reversement automatique J+1 après l'événement
- Subscription tiers via Stripe Billing (séparé du Connect)
- Mandat de facturation Tukio → Client au nom du pro (art. 289 CGI)
- 3 cas TVA : non assujetti / B2C / B2B intra-UE
- Refunds manuels admin au MVP, partiels en V1
- Disputes Stripe gérés via evidence trail systématique
- Échéanciers personnalisables en V1 (Stripe SetupIntent + cron)
- Factures PDF automatiques (client + pro) en V1
- Webhooks Stripe : `payment-svc` est l'unique endpoint, transforme en events NATS pour les autres services
- ⚠ **Audit obligatoire par expert-comptable spécialisé marketplace avant V1** (risque #1 conformité)

**Métriques clés :**
- GMV (gross merchandise value)
- Net commission (commissions encaissées - frais Stripe)
- Délai de reversement
- Taux de dispute (objectif < 0,5 %)

### 9.5 Abonnements professionnels

**3 tiers :**

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

**Règles métier clés :**
- Aucun engagement (résiliation libre fin de période)
- Période d'essai 14 jours sur Business à l'inscription pro
- Échec paiement : 3 tentatives sur 7 jours → bascule auto Starter
- **Tier Tukio dérivé de l'état Stripe Subscription, jamais l'inverse** (pas de "free Enterprise" exploit possible)

**Métriques clés :**
- Conversion Starter → Business (objectif > 15 % à 6 mois)
- ARR (annual recurring revenue)
- Churn mensuel (objectif < 5 %)
- Ratio MRR / commissions (mesure de diversification)

### 9.6 Messagerie

**Réalisations clés :**
- Chat client ↔ pro lié à une réservation au MVP (pas de chat libre)
- Chat libre avant booking pour devis en V1
- WebSocket via Redis pub/sub
- Anti-désintermédiation V1 : détection regex emails/téléphones avec masquage tant que résa non confirmée
- Pièces jointes V1 : PDF, images, scan antivirus
- Recherche dans l'historique V1
- Rate limiting anti-spam : max 3 messages/h vers un client qui n'a pas répondu
- Rétention 5 ans (litiges et conformité)

**Métriques clés :**
- Délai médian de première réponse pro (< 2 h)
- Taux de conversation → réservation
- Taux de signalement par message

### 9.7 Avis & évaluations

**Réalisations clés :**
- Note unique 1-5 + commentaire au MVP
- Note multi-critères en V1 (qualité, ponctualité, com, prix)
- Réponse pro aux avis V1 (tier Business+)
- Note réciproque pro → client V1 (visible aux autres pros)
- Demande d'avis automatique J+1 après événement, relance J+7
- Modération a posteriori sur signalement
- Pondération par récence : avis < 6 mois pèsent 2× plus dans la note agrégée

**Métriques clés :**
- Taux de dépôt d'avis (objectif > 40 %)
- Note moyenne plateforme
- Volume signalements / 1 000 avis

### 9.8 Modération & administration

**Réalisations clés :**
- Validation manuelle des dossiers pros au MVP
- Modération signalements basique au MVP, internalisée 1-2 personnes
- Outsourcing partiel V1 sur tâches simples (litiges toujours en interne)
- Workflow de litige structuré V1 : ouverture → médiation 48 h → résolution → clôture (réouverture possible 15 j)
- Sanctions graduelles : avertissement → suspension publication 7 j → suspension compte 30 j → bannissement
- Bannissement : hash IP/email/téléphone conservé pour anti-recréation
- Audit trail immuable de toutes les actions admin (table immutable côté `identity-svc`, alimentée via NATS event `admin.action.*`)
- Rôles granulaires V1 (Keycloak) : `admin-super`, `admin-support`, `admin-modo`
- Pas de service "admin" dédié — endpoints `/admin/*` distribués sur chaque service avec RBAC

**Métriques clés :**
- Délai moyen de résolution litige (< 7 jours)
- % litiges résolus à l'amiable
- Coût moyen par litige
- Volume signalements / 1 000 transactions

### Notifications (transverse)

- `notification-svc` consume tous les events des autres services
- Templates centralisés (back-office admin V1)
- Email transactionnel via Resend
- SMS V1, push notifications V2 (mobile)

---

## 10. Modèle économique & monétisation

### Revenus

#### MVP : commission unique fixe

- **10 % de commission** sur chaque transaction, prélevée automatiquement via Stripe `application_fee_amount`
- Pas d'abonnement, pas de frais d'inscription, pas de frais cachés
- Vu côté pro, vu côté client (transparence)

#### V1 : commission + abonnement (modèle 2-leviers)

- **Tier Starter** (gratuit, 15 % commission) : entrée à zéro friction, pour pros saisonniers ou occasionnels
- **Tier Business** (29 €/mois, 10 % commission) : pros actifs, ROI dès 3-4 transactions/mois
- **Tier Enterprise** (sur devis, 5 % + frais fixes) : agences et pros premium

**Objectif V1** : ratio MRR / commissions > 30 % à 6 mois (mesure de diversification anti-cyclique).

#### V2+ : leviers complémentaires

- **Boosts payants** (mise en avant, déjà en V1 inclus dans Business)
- **Featured listings** payants (V2, déjà partiellement V1)
- **Intégrations comptables premium** (Pennylane, QuickBooks API directe — V2 Enterprise)
- **Assurance annulation** (V2+, à valider)
- **BNPL ticket** (V3+, à explorer)

### Économie unitaire (modèle MVP)

| Métrique | Hypothèse |
|----------|-----------|
| Panier moyen B2C | ~800 € TTC |
| Panier moyen B2B | ~2 500 € TTC |
| Mix B2C/B2B au MVP | ~70/30 |
| Take rate pondérée | ~10 % (mix Starter 15 % + Business 10 %) |
| Marge brute par résa B2C | ~80 € (TR × ticket) |
| Marge brute par résa B2B | ~250 € |
| Frais Stripe par transaction | ~1,4 % + 0,25 € (+ 0,5 % cross-border si applicable) |
| LTV client B2C | ~1 résa (achat unique) |
| LTV client B2B | ~5-9 résa (2-3/an × 2-3 ans) |
| CAC max acceptable B2C | 30-40 € (ratio LTV/CAC = 2-2,5×) |
| CAC max acceptable B2B | 100-300 € |
| Break-even pro | 3-5 transactions |

### Vision financière

- **Sortie MVP** : valider que les économies sont saines (pas de subvention par cash externe pour acquérir des pros)
- **Sortie V1** : premier mois où (commissions + abonnements) > coûts variables — *l'inflexion business*
- **Sortie V2** : ARR > 500 k€, MRR diversifié > 30 %

### Anti-monétisations (ce que Tukio **ne fait pas**)

- ❌ Vente de leads à des prestataires non-actifs sur la plateforme
- ❌ Scraping de fiches prestataires sans consentement
- ❌ Pay-to-rank pur (boosts oui, mais transparents et limités)
- ❌ Frais cachés découverts au checkout (cf. tendance FTC)
- ❌ Engagement sur abonnements (résiliation libre fin de période)

---

## 11. Stratégie d'acquisition de la demande

> Synthèse exécutive de `tukio_strategie_acquisition.md` (lecture intégrale recommandée pour le tech lead avant Sprint 0).

### 11.1 Pourquoi c'est le risque opérationnel #1

C'est la **demande** qui est le plus difficile à amorcer, pas l'offre. Sans clients qui passent commande, les pros quittent dans les 6 mois. Si l'acquisition demande échoue → l'offre s'effondre → Tukio meurt. **Ce risque est plus immédiat que la conformité TVA (R1) ou le LCEN (R2).**

**Métrique d'alerte critique** : un pro Business doit faire **≥ 2 résa/mois** pour rester sur la plateforme. Avec 50 pros au MVP, on a besoin de **6 000 visiteurs uniques mensuels** sur le site (3 demandes/mois × 50 pros / taux conversion 2,5 %).

### 11.2 Spécificités du marché événementiel

3 caractéristiques structurantes :

1. **Achat ponctuel et important** : un client cherche un chapiteau **une fois** dans sa vie (mariage) ou 2-3×/an (B2B). Pas de récurrence naturelle, pas de remarketing facile.
2. **Recherche très en amont** : organisateurs commencent 6-12 mois avant l'événement. Funnel long.
3. **Trust est critique** : un mariage qui rate à cause d'un chapiteau non livré = drame. Avis et réputation pèsent énormément.

**Conséquences :**
- SEO long-tail = ROI-positif (requêtes spécifiques convertissent bien)
- Acquisition payante coûteuse mais justifiable sur ticket moyen 1 000-3 000 €
- Bouche-à-oreille très puissant
- Reviews visibles et nombreuses dès le début = critique

### 11.3 Cadre stratégique — 3 leviers à articuler

| Levier | CAC | ROI | Volume |
|--------|-----|-----|--------|
| **Acquisition organique (SEO + contenu)** | Bas long terme | 12+ mois | Élevé à terme |
| **Acquisition payante (Google + Meta Ads)** | Modéré | Rapide | Modéré, monte avec la concurrence |
| **Bouche-à-oreille / partenariats** | Quasi-zéro | Variable | Limité au début |

**Implication** : l'acquisition payante seule ne peut pas amorcer Tukio (180 k€/mois théoriques pour 6 000 visiteurs à 30 € CAC = hors de portée). SEO + bouche-à-oreille doivent fournir la majorité du trafic, surtout les 6 premiers mois.

**Priorité acquisition payante : B2B** au MVP, car CAC tolérable plus élevé (100-300 € vs 30-40 € en B2C).

### 11.4 Mix budgétaire par phase

#### MVP (mois 1-6) — ~3 200 €/mois

| Levier | Budget mensuel | Effort temps |
|--------|----------------|--------------|
| Bouche-à-oreille / partenariats physiques | 500 € (salons, déplacements) | 30 % |
| SEO foundation (contenu de base, technique) | 1 000 € (rédacteur freelance) | 40 % |
| Google Ads (test) | 1 000 € | 15 % |
| Meta Ads (test) | 500 € | 10 % |
| Outillage (PostHog, Plausible, Search Console) | 200 € | 5 % |

**Objectif** : 6 000 visiteurs/mois, 80 résa/mois en fin de période.

#### V1 (mois 7-18) — ~11 000 €/mois

SEO contenu (1 500 €) + Google Ads Search/PMax (4 000 €) + Meta full-funnel (2 500 €) + parrainage clients (800 € crédits émis) + commissions apporteurs B2B (1 200 €) + salons/events (600 €) + outillage (400 €).

**Objectif** : 30 000 visiteurs/mois, 400 résa/mois.

#### V2 (mois 19-36) — ~33 000 €/mois

SEO interne (4 000 €) + Google Ads (12 000 €) + Meta (7 000 €) + parrainage/fidélité (3 000 €) + partenariats (5 000 €) + RP/influence (2 000 €).

**Objectif** : 100 000 visiteurs/mois, 1 500 résa/mois.

### 11.5 SEO — fondations dès Sprint 0

**Cible principale** : requêtes transactionnelles locales ("location chapiteau nantes", "traiteur séminaire angers") — volume modéré 100-1 000/mois/requête, conversion forte 5-10 %. **C'est le cœur du SEO Tukio.**

**Pages cibles** (paths en anglais, alignés sur `tukio_information_architecture.md` §C, locale-prefix `/fr/` ou `/en/` cf. ADR-012) :
- `/{locale}/` (homepage)
- `/{locale}/search` (résultats)
- `/{locale}/category/{slug}` puis `/{locale}/category/{slug}/{city}` (pages locales générées V1)
- `/{locale}/service/{slug}` (slug dérivé du titre — FR ou EN selon locale du contenu)
- `/{locale}/pro/{slug}`
- `/{locale}/blog/{slug}`

**Critique tech à câbler dès Sprint 0** :
- **i18n FR + EN dès Sprint 0** via `next-intl` — zéro texte hardcodé dans le frontend, tous les strings UI dans des fichiers de messages JSON (`messages/fr.json`, `messages/en.json`)
- **Locale-prefix dans l'URL** (`/fr/...`, `/en/...`) avec `hreflang` propre + détection `Accept-Language` à la 1ʳᵉ visite, fallback locale `fr` (cible MVP)
- **Slug par locale** : un service publié en FR a un slug FR (`/fr/service/chapiteau-100m2`) ; sa version traduite EN a son propre slug EN (`/en/service/100m2-elegant-marquee`). Les `listing_translations` portent le slug par locale.
- **Meta tags dynamiques** par page et par locale (Next.js `<Metadata />` server-side, `alternates.languages`)
- **Sitemap XML segmenté** : services, pros, villes, blog — un sitemap par locale + `<xhtml:link rel="alternate" hreflang>`
- **Schema.org JSON-LD** : `Service`, `LocalBusiness`, `BreadcrumbList`, `AggregateRating`
- **Core Web Vitals** : LCP < 2,5 s, INP < 200 ms, CLS < 0,1

**Volume éditorial** : 2 articles/mois MVP, 4/mois V1 (100+ articles indexés à fin V1). Pas de contenu IA pur (Helpful Content Updates Google de plus en plus stricts).

### 11.6 Acquisition payante

**Google Ads (priorité 1)** : Search ads sur requêtes transactionnelles, structurées par catégorie + zone géo. Bid strategy : Maximize conversions au démarrage, tCPA après 30+ conversions. **Performance Max** à tester en V1 quand catalogue > centaines de fiches.

**Meta Ads (priorité 2)** : 3 audiences principales — mariés en préparation (6-18 mois), organisateurs B2B (titres "Office Manager"/"Event Manager"), retargeting visiteurs site.

**Pas au MVP** : LinkedIn Ads (cher), TikTok Ads (audience pas alignée), affiliés (pas de masse critique).

### 11.7 Bouche-à-oreille & partenariats

**Programme de parrainage client (V1)** — mécanique symétrique :
- Client A parraine B → B s'inscrit → B fait sa 1ʳᵉ résa > 200 € → A et B reçoivent chacun 30 € de crédit
- Coût total : 60 €/paire ; sur résa B 800 € → marge brute 80 € → net 20 €
- Plafond 200 € évite l'impact sur petites résa
- Crédit (pas cash) → trésorerie préservée

**Programme apporteurs d'affaires B2B (V1)** : wedding planners, agences événementielles, lieux de réception. 5 % commission sur résa générée par leur lien tracké. CAC ~5 % avec qualité élevée (clients déjà qualifiés).

**Activités physiques (MVP, gratuit)** :
- Salon du Mariage de Nantes (annuel)
- Salon du Mariage d'Angers
- Forum événementiel CCI Nantes Saint-Nazaire
- Networking inter-pros locaux
- Stand au Salon Mariage : 2-3 k€ amortis sur 50 résa générées dans l'année

**Partenariats catalogue (MVP)** : châteaux de Loire-Atlantique (Bretesche, Sébinière), domaines viticoles avec espace réception, salles municipales. Le lieu liste les fiches Tukio sur sa page "prestataires recommandés". Lien tracké, commission éventuelle 5 %.

### 11.8 Implications produit & tech (à câbler dès Sprint 0)

| Décision | Reco | Effort |
|----------|------|--------|
| **K-01** Stack tracking | **PostHog** (open-source, hosted EU, RGPD-friendly, inclut session replay + A/B + funnels) | 1 j setup |
| **K-02** Web analytics | **Plausible** (sans cookies, RGPD natif) + GA4 backup | 0,5 j |
| **K-03** Server-side tracking dès le MVP | **Oui** (impact gateway-api modeste, fiabilité ad-block) | 3 j dev |
| **K-04** Schema `acquisition_*` sur tables `users` et `bookings` dès Sprint 0 | **Oui** (impossible à rétro-fitter) | 1 j migration |
| **K-05** Stratégie slug SEO (override de `tukio_strategie_acquisition.md`) | **Locale-prefix `/{locale}/...`** + slug par locale, indexable FR et EN simultanément (cf. ADR-012). L'IA `tukio_information_architecture.md` §C est à mettre à jour pour refléter les locale prefixes. | 1-2 j |
| **K-12** Stack i18n frontend | **`next-intl`** (best fit Next.js 15 App Router avec SSR + locale prefix). Zéro texte hardcodé en frontend, tous les strings UI dans `messages/fr.json` + `messages/en.json`. | 2 j setup + ~3 j refactor au fil des écrans |
| **K-13** Schema catalog multilingue | **Table `listing_translations`** (`listing_id`, `locale`, `title`, `description`, `slug`, `meta_title`, `meta_description`) + idem pour `categories`, `pro_profiles`. Approche scalable vers V3+ autres langues. | 2 j migration |
| **K-14** Saisie pro contenu multilingue | **MVP** : FR obligatoire + EN optionnel, fallback FR si traduction EN absente. **V1** : pré-remplissage auto via DeepL/GPT, pro peut éditer/valider. | 0 j MVP / 3-5 j V1 |
| **K-15** Search Meilisearch i18n | **1 index par locale** (`listings_fr`, `listings_en`) avec sync via consumer NATS sur les events `catalog.listing.translation.published.v1`. Recherche côté locale courante de l'user. | 1 j setup |

**Schema additionnel** sur `users` et `bookings` :
```
acquisition_source       TEXT   -- 'organic', 'google_ads', 'meta_ads', 'referral', 'direct', 'partner'
acquisition_medium       TEXT
acquisition_campaign     TEXT
acquisition_referral_id  TEXT   -- si parrainage / partenaire
acquisition_first_touch  TIMESTAMPTZ
acquisition_last_touch   TIMESTAMPTZ
```

**Events à tracker** côté serveur via `gateway-api` : `page_view`, `search_performed`, `service_viewed`, `pro_viewed`, `booking_request_started`, `booking_request_submitted`, `booking_confirmed`. UTM params systématiques sur toutes campagnes.

### 11.9 Outillage marketing

| Outil | Usage | Coût |
|-------|-------|------|
| Plausible | Web analytics RGPD | ~10 €/mois |
| PostHog | Product analytics, funnels, A/B, session replay | Gratuit < 1M events/mois |
| Google Search Console | SEO Google | Gratuit |
| Bing Webmaster Tools | SEO Bing | Gratuit |
| Ahrefs Lite ou Mangools | SEO research, backlinks | 30-100 €/mois |
| Looker Studio | Dashboards consolidés | Gratuit |

**Total tooling** : ~150 €/mois.

### 11.10 Risques d'acquisition

| Risque | Mitigation |
|--------|------------|
| **SEO ROI lent** (6-12 mois minimum) | Démarrer SEO dès Sprint 0 (technique) + contenu mois 1 + payant pour combler le gap |
| **CAC payant qui explose** (concurrence) | Diversification canaux, investissement SEO contre-pouvoir long terme, marque forte pour trafic direct |
| **Taux de conversion plus bas que prévu** (< 2-3 %) | A/B tests systématiques V1, user research régulier (10/mois), UX flow optimisé |
| **Marketplace asymétrique** (trop de demande sans offre, ou inverse) | Suivi quotidien ratio offre/demande par catégorie, frein actif sur ads si déséquilibre |
| **Dépendance à un canal** (Google algo change) | Mix d'au moins 3 canaux significatifs dès V1, données first-party (email + bouche-à-oreille) |

### 11.11 Email marketing

- **MVP** : pas d'emails marketing, uniquement transactionnels via `notification-svc` + Resend
- **V1** : intégrer outil — recommandation **Brevo** (FR, RGPD-compliant, intégrations Stripe natives). Newsletter mensuelle clients + nurturing leads non convertis. `notification-svc` expose endpoint sync contacts (idempotent, RGPD-aware).

---

## 12. Architecture technique

### 12.1 Stack confirmé

| Couche | Choix | Justification |
|--------|-------|---------------|
| **Frontend** | Next.js 15 (App Router) | SSR pour SEO, hybridation client/serveur, écosystème mature |
| **Backend** | **NestJS 11 (Fastify adapter)** — 10 microservices | Architecture hexagonal (pattern Pretre), TypeScript end-to-end |
| **API Gateway** | NestJS gateway-api (BFF) | Point d'entrée unique, JWT validation, rate limiting |
| **Base de données** | PostgreSQL 16 — **1 database par service** | Isolation stricte. MVP : 10 DBs sur 1 instance physique |
| **ORM** | TypeORM (par défaut) + raw SQL pour read-heavy | Compatible avec pattern Pretre |
| **Auth / IdP** | **Keycloak 25** (Phasetwo managé au MVP) | OIDC standard, multi-acteurs, MFA, social login |
| **Messaging async** | **NATS JetStream 2.10+** (`@horizon-republic/nestjs-jetstream`) | Persistence, replay, DLQ, faible burden ops |
| **Paiements** | Stripe Connect Express + Stripe Billing | Standard marketplace, conformité PSD2 simplifiée |
| **Recherche** | **Meilisearch dès MVP** (ADR-005) | Postgres FTS insuffisant pour facettes + geo |
| **Médias** | Cloudflare R2 + Cloudflare Images | Stockage objet + CDN + transformations |
| **Emails (transactionnels)** | Resend (templates FR + EN dès MVP) | Simple, deliverability solide |
| **Email marketing (V1)** | Brevo | FR, RGPD-compliant |
| **i18n frontend** | **`next-intl`** + messages JSON par locale (`messages/fr.json`, `messages/en.json`) | Zéro texte hardcodé en frontend. Locale-prefix dans l'URL. Détection `Accept-Language`, fallback `fr`. Cf. ADR-012. |
| **Cache & locks** | Upstash Redis | Locks dispo, sessions, rate limiting, pub/sub WebSocket |
| **Observabilité** | OpenTelemetry + Prometheus + Tempo | Stack légère mais complète |
| **Product analytics** | PostHog (self-hosted EU) | RGPD, A/B tests, funnels, session replay |
| **Web analytics** | Plausible (+GA4 backup) | RGPD natif, sans cookies |
| **Hébergement** | Vercel (frontend) + Kubernetes (backend services) | Mono-repo, K8s namespace au MVP |

### 12.2 Architecture globale — 10 microservices

```
                           ┌────────────────────────┐
   web / mobile  ───TLS──▶ │      gateway-api       │ ◀── Keycloak JWKS (cached)
                           │  (Nest 11 + Fastify)   │
                           └─────────┬──────────────┘
                                     │ HTTP (mTLS en prod)
        ┌────────────┬───────────────┼───────────────┬────────────┐
        ▼            ▼               ▼               ▼            ▼
   catalog-svc  booking-svc     order-svc      payment-svc   identity-svc
     │            │                │              │              │
     ▼            ▼                ▼              ▼              ▼
   Postgres    Postgres         Postgres      Postgres       Postgres
        \           |              |              /             /
         \          ▼              ▼             /             /
          ─────────▶  NATS JetStream cluster  ◀───────────────
                              ▲       ▲
                              │       │
                       notification-svc, media-svc, review-svc, messaging-svc
```

**10 services** (codebase split day 1) : `gateway-api`, `identity-svc`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`.

### 12.3 Stratégie de déploiement MVP

**Codebase split, deployment colocation** :

```
10 codebases distinctes  →  3 unités de déploiement au MVP

Unité 1 — core-api : gateway-api, identity-svc, catalog-svc,
                     booking-svc, order-svc, payment-svc
Unité 2 — workers : messaging-svc, review-svc, notification-svc, media-svc
Unité 3 — nats : NATS JetStream cluster R3
+ postgres : 1 instance physique, 10 databases logiques
+ redis : 1 instance Upstash
```

**Quand splitter** :
- `payment-svc` en deployment dédié dès la production (sécurité PCI-DSS-adjacent)
- `notification-svc` quand volume > 10 k emails/jour
- `media-svc` quand volume upload > 1 000/jour
- `messaging-svc` quand WebSocket users concurrents > 5 000
- `catalog-svc` si search devient le bottleneck

### 12.4 Mapping domaines fonctionnels ↔ microservices

| # | Domaine fonctionnel | Service(s) backend |
|---|---------------------|---------------------|
| 9.1 | Comptes & utilisateurs | `identity-svc` + Keycloak |
| 9.2 | Catalogue & services | `catalog-svc` + `media-svc` |
| 9.3 | Booking & panier | `booking-svc` + `order-svc` |
| 9.4 | Paiements & facturation | `payment-svc` + `order-svc` |
| 9.5 | Abonnements pros | `payment-svc` (Stripe Billing) + `identity-svc` (tier sync) |
| 9.6 | Messagerie | `messaging-svc` |
| 9.7 | Avis | `review-svc` |
| 9.8 | Modération & administration | Distribué (tous les services) + `gateway-api` |
| (transverse) | Notifications | `notification-svc` |
| (transverse) | API publique / Auth | `gateway-api` |

### 12.5 Architecture interne des services — pattern Pretre

Chaque service suit la structure hexagonale **`domain/` / `usecases/` / `infrastructure/`** avec **`UseCaseProxy`** factory pattern :

```
service-svc/
├─ src/
│  ├─ domain/                    # pure TypeScript, zero NestJS imports
│  │  ├─ model/                  # aggregates, value objects
│  │  ├─ ports/                  # interfaces + Symbol tokens
│  │  ├─ service/                # domain services stateless
│  │  └─ exception/
│  ├─ usecases/                  # 1 classe par use case, méthode execute()
│  └─ infrastructure/
│     ├─ persistence/            # TypeORM repositories
│     ├─ messaging/              # NATS publisher + consumers + outbox relay
│     ├─ http/                   # controllers, DTOs, guards
│     ├─ logger/, config/, exception/
│     └─ usecases-proxy/         # central wiring (DynamicModule)
```

### 12.6 Communication inter-services

**2 canaux uniquement** :

1. **Synchrone (HTTP/REST via gateway uniquement)** : le frontend appelle le gateway, qui fan-out vers les services downstream avec circuit breaker (timeout 3 s).
2. **Asynchrone (NATS JetStream + transactional outbox)** : tous les events de domaine. **Aucun appel HTTP-to-HTTP entre services downstream.** Une seule exception : `booking-svc` interroge `catalog-svc` pour vérifier la dispo en temps réel à la création d'un booking.

**Patterns clés** :
- **Saga choréographée** (pas d'orchestrator) pour le flow booking-payment (ADR-006)
- **Transactional outbox** dans chaque service producteur (ADR-007), via PG LISTEN/NOTIFY
- **Inbox table** dans chaque service consommateur (idempotence)
- **Event versioning** via suffixe (`v1`, `v2`) avec coexistence pendant migration

Convention events NATS : `<service>.<aggregate>.<event>.v<n>` lowercase. ~50 events au catalog (cf. `tukio_event_catalog.md`).

### 12.7 Authentification — flux requête

```
1. Client → gateway-api avec Bearer JWT (Keycloak RS256)
2. Gateway vérifie via JWKS (cache 10 min)
3. Gateway forward au service downstream + header signé `x-tukio-actor`
4. Service downstream re-vérifie le JWT (defence in depth) + résout l'actor
```

### 12.8 ADRs (Architecture Decision Records)

Les **11 décisions structurantes** consolidées :

| ADR | Décision | Justification courte |
|-----|----------|----------------------|
| **001** | Pattern Pretre strict dans tous les services | Cohérence inter-services, domaine testable trivialement |
| **002** | NATS JetStream (vs Kafka/RabbitMQ) | Sweet spot < 10 k events/sec, faible burden ops |
| **003** | Database per service, no shared tables | Découplage strict, scaling indépendant |
| **004** | Booking et Order = 2 services distincts | Lifecycles différents, multi-vendor V1 plus propre |
| **005** | Meilisearch dès le MVP | Postgres FTS insuffisant pour facettes + geo |
| **006** | Saga choréographée (pas d'orchestrator) | Suffisant pour 4-5 étapes, complexité raisonnable |
| **007** | Outbox pattern partout | Cohérence transactionnelle DB ↔ events |
| **008** | gateway-api seul accès public | Surface attaque minimale, auth centralisée |
| **009** | Keycloak + identity-svc séparés | Flexibilité long-terme, possible swap Keycloak |
| **010** | TypeORM par défaut + raw SQL pour read-heavy | Pragmatique, pas d'over-engineering |
| **011** | `@tukio/contracts` package dès Sprint 0 | Discipline events, type-safety end-to-end |
| **012** | **i18n FR + EN dès Sprint 0** : `next-intl` côté front, locale-prefix `/{locale}/...` dans l'URL, schéma multilingue côté `catalog-svc` (`listing_translations` + `category_translations` + `pro_profile_translations`), 1 index Meilisearch par locale. **Override** la décision K-05 (slugs FR) de `tukio_strategie_acquisition.md`. | Aligné sur l'IA `tukio_information_architecture.md` §C (paths EN), étendu à la dimension i18n. App **non internationalisée géographiquement** au MVP (FR uniquement) mais **bilingue linguistiquement** dès Sprint 0 — cas d'usage : utilisateur résidant en France qui préfère parler anglais. |

Ces ADRs doivent être copiés dans `docs/adr/` du repo backend dès Sprint 0.

### 12.9 Sprint 0 — backbone à livrer

À faire avant Sprint 1 :

**Lectures équipe** : ce brief + `tukio_spec_v2.2.md` + `tukio_product_tech_alignment.md` + `tukio_booking_svc_deepdive.md` + `tukio_strategie_acquisition.md`

**ADRs & libs partagées** :
- Initialiser `docs/adr/` avec les 11 ADRs
- Setup `@tukio/contracts` (vide, prêt pour Sprint 1)
- Setup `@tukio/messaging` avec wrapper NATS JetStream + outbox helpers
- Setup `@tukio/auth` avec `KeycloakJwtGuard` + `Roles` decorator + types `Actor`
- Setup `@tukio/testing` avec testcontainers helpers

**Acquisition / SEO / tracking (décisions K-01 à K-05)** :
- Setup PostHog (1 j) + Plausible (0,5 j)
- Server-side tracking via `gateway-api` (3 j)
- Migration `acquisition_*` sur tables `users` et `bookings` (1 j)
- Locale-prefix URLs `/fr/...` + `/en/...` (cf. ADR-012, **override** K-05 sur slugs FR)
- Meta tags dynamiques par locale + sitemap XML segmenté par locale (avec hreflang) + Schema.org JSON-LD

**i18n FR + EN dès Sprint 0 (décisions K-12 à K-15, ADR-012)** :
- Setup `next-intl` côté Next.js 15 App Router (2 j)
- Externaliser tous les strings UI dans `messages/fr.json` + `messages/en.json` — **zéro texte hardcodé en frontend**
- Migration schéma multilingue côté `catalog-svc` : tables `listing_translations`, `category_translations`, `pro_profile_translations` (2 j)
- 1 index Meilisearch par locale (`listings_fr`, `listings_en`) avec sync via consumer NATS (1 j)
- Templates email Resend en FR + EN dès le MVP
- Pages légales (`/terms`, `/sales-terms`, `/privacy`, `/cookies`, `/legal`) versionnées FR + EN
- Saisie pro MVP : FR obligatoire + EN optionnel, fallback FR si EN absent. V1 : pré-remplissage auto via DeepL/GPT, pro édite/valide.

**Infra & CI** :
- Docker Compose local complet (services infra)
- CI pipeline pour 1 service exemple (`catalog-svc`)
- Lint rules `eslint-plugin-boundaries` configurées
- ADR template prêt pour les futures décisions

---

## 13. Roadmap & versions

### MVP (v0.1) — "Prouver la transaction" — ~3-4 mois

**Hypothèse à valider** : des pros sont prêts à payer une commission pour des leads qui se convertissent en réservations payées sur la plateforme.

**Périmètre géo** : Loire-Atlantique (44) + Maine-et-Loire (49).

**Inclus :**
- Comptes : inscription client B2C (particulier), inscription pro avec validation manuelle, KYC light (SIRET, RIB, pièce d'identité), MFA admin obligatoire
- Catalogue : 2 catégories pilotes (tentes & chapiteaux + mobilier événementiel), fiche service basique, recherche catégorie + ville + date
- Booking : réservation directe, panier mono-vendeur, sélection de dates + quantité
- Paiements : Stripe Connect Express, capture différée, commission fixe 10 %, reversement J+1, refund manuel admin
- Messagerie : chat lié à la réservation, notifications email basiques
- Avis : note 1-5 + commentaire, demande automatique J+1
- Admin : validation pros, modération signalements, vue transactions/litiges
- Légal : CGU/CGV/PC, RGPD basique, mentions légales — **versionnés FR + EN dès le MVP**
- **Acquisition / SEO** : pages locales générées, schema.org, sitemap par locale (hreflang), Plausible + PostHog, tracking server-side, schema `acquisition_*` en DB
- **i18n FR + EN dès Sprint 0** : `next-intl` (zéro texte hardcodé), locale-prefix URLs, `listing_translations` + `category_translations` + `pro_profile_translations`, 1 index Meilisearch par locale, templates email Resend FR + EN, saisie pro FR obligatoire + EN optionnel (fallback FR)

**Exclus volontairement :**
- Comptes B2B
- Devis personnalisés
- Panier multi-vendeurs
- Échéanciers / acomptes
- Subscription tiers (tout le monde sur le même plan)
- Avis multi-critères
- App mobile
- API publique
- Internationalisation
- Programme parrainage / apporteurs

**Critères de sortie :**
- 50 pros validés et actifs (≥ 1 réservation chacun)
- 100 réservations payées sans litige bloquant
- NPS client > 40
- CAC pro mesuré et soutenable
- ~6 000 visiteurs uniques mensuels
- ~80 réservations/mois en fin de période

### V1 (v1.0) — "Marketplace complète" — +3 mois

**Objectif** : transformer le MVP en produit qui se vend, qui retient et qui se monétise sur 2 leviers.

**Périmètre géo** : Pays de la Loire complet (44/49/72/85/53) + Bretagne (35/22/29/56).

**Ajouts :**
- Comptes B2B (entreprises clientes), profil pro enrichi (portfolio, équipe, certifs), KYC complet Stripe Identity, login social Google/Apple, MFA optionnel pros
- Catalogue : toutes catégories cibles, tarification flexible (unité/forfait/devis), gestion dispos avancée (calendrier, blocages, inventory pool), vidéos
- Booking : panier multi-vendeurs, demande de devis, réservation conditionnelle 48 h
- Paiements : 3 tiers d'abonnement (Starter/Business/Enterprise), acomptes 30/70, échéanciers, factures PDF, gestion TVA
- Messagerie : chat libre avant booking, pièces jointes, recherche historique, anti-désintermédiation regex
- Avis : multi-critères, réponse pro (Business+), note réciproque
- Admin & litiges : workflow structuré ouverture → médiation 48 h → résolution, dashboard modération, rôles granulaires
- Pro dashboard : stats revenus/conversion/occupation/temps réponse, export comptable
- **Acquisition** : programme parrainage clients (table `referral_codes`, crédits), apporteurs B2B (rôle "partner" + dashboard dédié), email marketing Brevo, A/B testing PostHog/GrowthBook, heatmaps + session replay, page blog complète

**Critères de sortie :**
- Premier mois où (commissions + abonnements) > coûts variables
- Au moins 200 abonnés Business
- < 5 % des réservations en litige
- ~30 000 visiteurs/mois, ~400 résa/mois

### V2 (v2.0) — "Croissance & rétention" — +3 mois

**Objectif** : faire revenir les clients (rebooking) et augmenter le panier moyen.

**Périmètre géo** : grandes agglos françaises (Paris, Lyon, Bordeaux, Marseille).

**Ajouts :**
- Configurateur d'événements (assistant qui assemble plusieurs services en un devis)
- Recommandations perso clients (historique)
- Co-traitance entre pros (un pro sous-traite à un autre, splits gérés)
- Programme de fidélité client (-5 % à la 3ᵉ résa)
- Tier Enterprise complet : SLA, account manager, intégrations comptables (Pennylane, QuickBooks)
- B2B SSO via Keycloak SAML federation
- Analytics pros avancées : benchmarks anonymisés, suggestions de prix
- Vérification renforcée : badges "vérifié", "pro de l'année"
- SEO programmatique avancé (pages catégorie × ville étendues, RP/influence, embauche marketer interne)
- Application mobile native (iOS / Android), priorité côté pro
- Première campagne Performance Max Google (mois 12+, après 30+ conversions/mois stables)

**Critères de sortie :**
- Taux de rebooking client > 25 %
- Panier moyen multi-vendeurs +30 % vs V1
- Au moins 20 comptes Enterprise
- ~100 000 visiteurs/mois, ~1 500 résa/mois

### V3+ — Long terme

Pistes possibles (cf. §14 et `tukio_opportunites_futures.md`) :
- Internationalisation (Belgique → Suisse → Maroc selon réseau)
- API publique pour intégrations tierces
- IA de matching client ↔ pro
- White-label pour grandes marques événementielles
- Marketplace de talents (intermittents, animateurs, DJ, photographes)
- Outils SaaS pros (CRM, planning, devis, factures)
- B2G / collectivités territoriales
- Verticales spécialisées (Tukio Mariage, Tukio Séminaires)

**Aucune de ces pistes n'est dans la roadmap formelle.** Réouverture conditionnée à des signaux explicites listés dans le doc opportunités.

---

## 14. Opportunités futures (hors roadmap)

> Synthèse de `tukio_opportunites_futures.md`. Lecture intégrale recommandée avant tout pivot.

**Règle d'or** : ce qui est dans cette section n'est **pas** dans la roadmap. Lire cette section signifie *"voici ce qu'on ne fait pas, et pourquoi"*. Pour rouvrir une piste, on ouvre un chantier dédié (spec produit, persona, business case).

| # | Piste | Pourquoi pas maintenant | Estimation réouverture |
|---|-------|-------------------------|------------------------|
| **C.1** | **B2G / Collectivités** | Cycle de vente long (3-12 mois), Code de la commande publique, MAPA, Chorus Pro, persona DGS/élus, commercial dédié | V3 (24-36 mois) si traction B2C stable |
| **C.2** | **Expansion géographique nationale** | Nationalisation prématurée = dilution catalogue + qualité service. Sourcing pros à distance ≠ Pays de la Loire physique | V3 (18-24 mois) après 200+ pros PdL avec NPS > 50 |
| **C.3** | **Expansion européenne** | Conformité multi-pays (TVA, PSD2, Stripe KYC), multi-currency, i18n complet, localisation légale | V4 (36-48 mois) très long terme |
| **C.4** | **Marketplace inter-pros (B2B2B)** | Modèle économique différent, risque de cannibalisation, pas de validation user research | V2-V3 conditionné à user research dédié |
| **C.5** | **Intégrations comptables avancées** (Pennylane, QuickBooks, Sage, Cegid, Indy) | CSV couvre déjà, ressources de dev limitées, complexité de maintenance | V2 selon retours pros (30 %+ Business+ qui demandent) |
| **C.6** | **Application mobile native** | Coût dev élevé, App Store policies marketplace strictes, PWA couvre 80 % au démarrage | V2-V3 quand 500+ pros actifs |
| **C.7** | **Verticales spécialisées** (Tukio Mariage, Tukio Séminaires, Tukio Anniversaires) | Fragmentation prématurée du catalogue, coût de gestion 3×, validation user manquante | V3 si une verticale > 50 % du GMV |
| **C.8** | **Contenu & média** (blog, podcast, newsletter) | Demande ressources dédiées, ROI lent. Partiellement intégré §11 (SEO contenu) | V1 intégré à la stratégie d'acquisition |
| **C.9** | **Marketplace de talents** (DJ, photographes en propre) | KYC auto-entrepreneur, conformité travail dissimulé, concurrence frontale (BookingForGood, GigSalad) | V3+ |
| **C.10** | **Outils SaaS pros** (CRM, planning, devis, factures pour la totalité de l'activité du pro) | Charge produit énorme, dilution focus, concurrents 5+ ans d'avance (HoneyBook, Aisle Planner) | V4-V5 très long terme |

**Maintenance du doc opportunités** : révision tous les 6 mois pour retirer les pistes basculées en roadmap, ajouter les nouvelles pistes, réévaluer le timing.

---

## 15. Critères de succès & métriques

### Métriques produit (par version)

#### Sortie MVP

- 50 pros validés et actifs (≥ 1 réservation chacun)
- 100 réservations payées sans litige bloquant
- NPS client > 40
- CAC pro mesuré et soutenable
- Délai moyen de validation pro < 24 h
- Taux de complétion d'inscription pro > 60 %
- ~6 000 visiteurs uniques mensuels en fin de période
- ~80 réservations/mois en fin de période

#### Sortie V1

- Premier mois où (commissions + abonnements) > coûts variables
- ≥ 200 abonnés Business à 29 €/mois (MRR ≥ 5 800 €)
- Conversion Starter → Business > 15 % à 6 mois
- < 5 % de réservations en litige
- Churn mensuel < 5 %
- Délai médian de première réponse pro < 2 h
- ~30 000 visiteurs/mois, ~400 résa/mois

#### Sortie V2

- Taux de rebooking client > 25 %
- Panier moyen multi-vendeurs +30 % vs V1
- ≥ 20 comptes Enterprise actifs
- ARR > 500 k€
- Couverture : Pays de la Loire complet + Bretagne + 4 grandes agglos FR
- ~100 000 visiteurs/mois, ~1 500 résa/mois

### Métriques business permanentes

- **GMV** (Gross Merchandise Value) — volume total transigé
- **Net commission** = commissions encaissées − frais Stripe
- **MRR** (Monthly Recurring Revenue) sur abonnements
- **Take rate effective** = (commissions + abos) / GMV
- **Concentration GMV** (% top 10 pros) — surveillé hebdo
- **Coût d'acquisition** (client / pro) — par canal
- **LTV** (lifetime value) — par persona
- **Ratio offre/demande** par catégorie — surveillé quotidien (frein actif sur ads si déséquilibre)
- **Réservations par pro Business** — alerte si pro < 2 résa/mois (risque de churn 6 mois)

### Métriques acquisition (synthèse §11)

#### Top of funnel
- Visiteurs uniques quotidiens / hebdo / mensuels (Plausible)
- Sources de trafic (organique, payant, direct, referral, social)
- Pages les plus visitées
- Taux de rebond global

#### Middle of funnel
- Recherches effectuées
- Fiches services / pros vues
- Conversion visiteur → recherche → fiche → demande

#### Bottom of funnel
- Demandes de booking créées
- Demandes acceptées par les pros
- Réservations confirmées (paiement)
- CA total et par segment B2C/B2B

#### Acquisition payante
- CAC par canal (objectif < 30 € B2C, < 150 € B2B)
- ROAS (objectif > 2× sur budget mensuel)
- Score de qualité Google Ads (objectif > 7)

#### SEO
- Trafic organique mensuel
- Top 100 mots-clés en suivi (Ahrefs ou alternative)
- Position moyenne sur 50 mots-clés priorité 1 (objectif top 5 à 12 mois)
- Part trafic organique vs payant (30 % MVP → 70 %+ V2)

### Métriques qualité service

- Taux de dispute (objectif < 0,5 %)
- Délai de reversement (objectif J+1)
- Taux de dépôt d'avis (objectif > 40 %)
- Note moyenne plateforme
- Délai moyen de résolution litige (< 7 j)
- Volume signalements / 1 000 transactions

### Métriques opérationnelles tech

- Disponibilité gateway-api (objectif 99,5 % MVP, 99,9 % V1+)
- Latence p95 search (< 150 ms)
- NATS consumer lag (alerte > 1 000 msg)
- Outbox pending lag (alerte > 100 msg / > 1 min)
- Saga booking-payment échoués > 5 min (alerte)
- Core Web Vitals : LCP < 2,5 s, INP < 200 ms, CLS < 0,1

### Cadence dashboards

- **Quotidien** : top of funnel + ventes + ratio offre/demande
- **Hebdomadaire** : full funnel + acquisition par canal + concentration GMV
- **Mensuel** : revue stratégique + arbitrages budgétaires marketing

---

## 16. Conformité & légal

### Statut juridique de la plateforme

**Hybride éditeur / hébergeur LCEN + tiers de confiance pour le paiement** (Q10 spec) :
- Hébergeur LCEN par défaut → modération a posteriori uniquement
- **Pas de modération pré-publication systématique** (sinon bascule éditeur, responsabilité accrue)
- À faire valider par avocat numérique avant lancement

### TVA & facturation marketplace

- **Mandat de facturation** signé à l'onboarding pro : Tukio émet la facture **au nom du pro** (art. 289 CGI)
- 3 cas TVA gérés : pro non-assujetti (franchise) / B2C / B2B intra-UE
- ⚠ **Audit obligatoire par expert-comptable spécialisé marketplace avant V1** — risque #1 conformité (R1)
- Conservation factures : 10 ans (obligation légale)

### RGPD & données personnelles

- Consentement RGPD basique au MVP (cookies, finalités)
- Politique de confidentialité claire et accessible
- DPO désigné (interne ou externe)
- **Soft-delete** : conservation données comptables 10 ans, **anonymisation** des données perso au-delà du délai utile (R10)
- Droit d'accès, rectification, effacement, portabilité — workflow admin V1
- **Plausible (sans cookies)** + **PostHog hosted EU** + **Brevo (FR)** = stack RGPD-compliant
- Session replay PostHog uniquement avec consentement explicite

### Données pros & paiements

- Stockage sécurisé des pièces d'identité (chiffrement at-rest)
- KYC financier via Stripe Identity (V1) ou docs manuels (MVP)
- Stripe Connect Express → conformité PSD2 simplifiée (KYC géré par Stripe)

### Conformité sectorielle

- **CGU / CGV / PC / mentions légales** dès le MVP, **versionnés FR + EN** (la version FR fait foi juridiquement, l'EN est une traduction d'information)
- **Bannissement** : conservation hash IP/email/téléphone pour anti-recréation (légal sous 6 ans, à valider avocat)
- **Audit trail immuable** des actions admin (preuves en cas de litige)

### Conformité tech

- HTTPS/TLS partout
- mTLS inter-services en prod
- Secrets management (pas de secrets en clair)
- Logs sans données perso (PII redaction)

---

## 17. Risques & mitigations

### Risques produit & tech (R1-R15)

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| **R1** | TVA & facturation marketplace mal conformes | 🔴 Critique | Audit expert-comptable spécialisé **avant V1** (500-1 500 €) |
| **R2** | Statut éditeur LCEN involontaire (modération pré-pub) | 🔴 Critique | Pas de modération systématique pré-publication. Audit avocat numérique |
| **R3** | Concentration GMV sur peu de pros | 🟠 Élevé | Métrique de concentration suivie hebdo. Diversification active de l'offre |
| **R4** | Cold-start côté offre (catalogue vide) | 🟠 Élevé | Sourcing pro physique en PdL — 50 premiers pros recrutés en main propre |
| **R5** | Race conditions sur dispos | 🟠 Élevé | 3 layers : Redis lock + DB exclusion constraint + optimistic locking |
| **R6** | Anti-désintermédiation insuffisante | 🟡 Moyen | Coordonnées masquées avant acceptation. Détection regex en messagerie V1 |
| **R7** | Stripe Connect KYC long (1-7 jours) | 🟡 Moyen | UX d'attente claire, possibilité de préparer fiches en parallèle |
| **R8** | Sync Keycloak ↔ identity-svc drift | 🟡 Moyen | Job de réconciliation quotidien + webhooks Keycloak |
| **R9** | Disputes Stripe (chargebacks) tardifs | 🟡 Moyen | Evidence trail systématique : avis, échanges, photos |
| **R10** | RGPD vs conservation comptable 10 ans | 🟡 Moyen | Anonymisation données perso au-delà du délai utile |
| **R11** | Saga booking-payment partiellement échouée | 🔴 Critique | Tests chaos en CI, replay possible, monitoring inbox/outbox lag, alertes admin > 5 min |
| **R12** | NATS JetStream perte de message | 🟠 Élevé | Replicas R3 prod, DLQ stream dédié, monitoring consumer lag (alerte > 1000 msg) |
| **R13** | Outbox relay (PG LISTEN/NOTIFY) en panne | 🟠 Élevé | Healthcheck dédié + fallback polling 30 s + alerte si > 100 outbox pending > 1 min |
| **R14** | Database per service complexité opérationnelle | 🟡 Moyen | MVP : 10 databases sur 1 instance Postgres. Backup unifié. Séparer si bottleneck mesuré |
| **R15** | Coût opérationnel des 10 services dès MVP | 🟠 Élevé | Co-localiser dans 1 cluster K8s/namespace au MVP. Séparer par traffic seulement quand justifié |

### Risques d'acquisition demande (RA1-RA5) — risque opérationnel #1

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| **RA1** | **Acquisition demande échoue** → pros quittent dans 6 mois → offre s'effondre | 🔴 Critique | Stratégie d'acquisition formalisée (§11, `tukio_strategie_acquisition.md`). Mix 3 leviers MVP. Sourcing physique côté demande (Salon Mariage Nantes/Angers). |
| **RA2** | SEO ROI lent (6-12 mois minimum) | 🟠 Élevé | SEO démarré dès Sprint 0 (technique) + contenu mois 1. Payant pour combler le gap |
| **RA3** | CAC payant qui explose (concurrence) | 🟠 Élevé | Diversification canaux dès le début. SEO contre-pouvoir long terme. Marque forte → trafic direct |
| **RA4** | Taux de conversion plus bas que prévu (< 2-3 %) | 🟠 Élevé | A/B tests systématiques V1 (PostHog/GrowthBook). User research régulier (10 interviews/mois) |
| **RA5** | Marketplace asymétrique (offre/demande déséquilibrée) | 🟠 Élevé | Suivi quotidien ratio par catégorie. Frein actif sur ads si trop de demandes pas servies. Recrutement actif pros si offre faible sur catégorie |

### Risques business additionnels (à surveiller)

- **Saisonnalité Pays de la Loire** : pic mai-septembre (mariages), creux hivernal — diversifier vers événements corporate (séminaires, soirées de fin d'année) pour lisser
- **Dépendance Stripe** : pas de plan B identifié — accepté comme risque de plateforme
- **Dépendance à un canal** (Google algo change) : mix d'au moins 3 canaux significatifs dès V1, données first-party (email + bouche-à-oreille)

---

## 18. Conventions, gouvernance & nommage

### Vocabulaire produit / vocabulaire code

| Concept | UI / produit / spec FR | Backend code / DB / API / events EN |
|---------|------------------------|--------------------------------------|
| Le pro qui vend | **Pro** | **provider** |
| Le client qui achète | **Client** | **customer** |
| L'admin | **Admin** | **admin** |
| L'annonce | **Service**, **fiche service** | **listing** |
| La réservation | **Réservation** | **booking** |
| La commande payable | **Commande** | **order** |
| L'avis | **Avis** | **review** |

**Règle d'or :**
- Tout ce qui est **visible utilisateur** : terminologie française produit
- Tout ce qui est **code, DB, API, events, logs** : terminologie anglaise backend
- Le mapping UI ↔ code se fait en couche présentation (DTOs / presenters)

### Noms de services backend (figés, ADR requis pour modifier)

```
gateway-api
identity-svc
catalog-svc
booking-svc
order-svc
payment-svc
messaging-svc
review-svc
notification-svc
media-svc
```

### Convention URL

> Référence canonique : `tukio_information_architecture.md` §C, étendue par ADR-012 (i18n FR/EN).

- **Tous les paths sont en anglais** : `/seller/*`, `/account/*`, `/cart/*`, `/category/{slug}`, `/service/{slug}`, `/pro/{slug}`, `/blog/{slug}`. **Jamais de path en français.**
- **kebab-case** pour les paths : `/sales-terms`, pas `/salesterms` ni `/sales_terms`
- **Locale-prefix dans l'URL** : `/{locale}/...` avec `locale ∈ {fr, en}` (ADR-012). Ex : `/fr/category/location-tentes-chapiteaux`, `/en/category/marquee-rental`
- **Slug par locale** : un service publié dans les 2 langues a 2 slugs différents (`/fr/service/chapiteau-100m2-blanc-chic` ≠ `/en/service/100m2-elegant-marquee`). Stockés dans `listing_translations(listing_id, locale, title, slug, description, ...)`.
- **Hreflang** systématique pour signaler les versions linguistiques (`<link rel="alternate" hreflang="fr" href="..."/>`, etc.)
- **Détection locale** : `Accept-Language` à la 1ʳᵉ visite, fallback `fr` (cible MVP). Choix utilisateur persistant (cookie + préférence compte si connecté).
- **Reserved slugs** (cf. IA §C) : `search`, `category`, `service`, `pro`, `account`, `seller`, `cart`, `help`, `blog`, `pricing`, `sell`, `about`, `contact`, `terms`, `sales-terms`, `privacy`, `cookies`, `legal`, `api`, `auth`, `admin`, `static`, `www`, `fr`, `en`. Stockés en table `reserved_slugs`, vérifiés à toute création.
- **Stable URLs** : un slug ne change pas après publication. Modification → conservation de l'ancien slug avec redirect 301.
- **Sous-domaines** : `tukio.one` (apex app), `auth.tukio.one` (Keycloak), `admin.tukio.one` (console admin), `static.tukio.one` ou CDN (assets), `api.tukio.one` (V3+ API publique)
- **Category technical code** : chaque catégorie a un `code` EN (ex : `tents-marquees`) utilisé en interne pour filtres/API, séparé du `slug` localisé utilisé en URL

### Convention i18n (ADR-012)

- **Stack frontend** : `next-intl` sur Next.js 15 App Router
- **Messages JSON par locale** : `messages/fr.json`, `messages/en.json` — **aucun texte hardcodé dans le code frontend**, pas même un placeholder `"Loading..."`
- **Convention de clés** : namespacing par feature (`booking.confirmation.title`, `seller.onboarding.kyc.cta`)
- **Pluralisation et formatage** via ICU MessageFormat (intégré à `next-intl`)
- **Dates / nombres / monnaies** : `Intl.DateTimeFormat`, `Intl.NumberFormat` avec locale courante
- **Schéma DB multilingue** : pour chaque entité user-facing (listings, categories, pro profiles, blog posts, help articles) → table `<entity>_translations(<entity>_id, locale, ...localized_fields...)`. Garantit l'extensibilité vers V3+ (autres langues) sans migration destructive.
- **Saisie pro contenu** :
  - **MVP** : titre/description en FR obligatoires, EN optionnel. Fallback FR pour visiteurs locale `en` si traduction EN absente. Affichage badge UI "Disponible uniquement en français" en mode EN si traduction manquante.
  - **V1** : pré-remplissage auto EN via traduction (DeepL ou GPT) au moment de la sauvegarde, pro doit valider/éditer avant publication EN.
- **Search Meilisearch** : 1 index par locale (`listings_fr`, `listings_en`) pour tokenization correcte. Sync via consumer NATS sur les events `catalog.listing.translation.published.v1`.
- **Emails Resend** : templates en double FR + EN dès le MVP, locale du destinataire pioché sur le profil utilisateur.
- **Pages légales** : versionnées FR + EN. Mention "La version française fait foi juridiquement" sur la version EN.

### Note de cohérence avec l'IA doc existant

`tukio_information_architecture.md` §C définit aujourd'hui une stratégie "paths EN + slugs FR" qui était cohérente pour un MVP francophone unique. **Avec l'ADR-012, l'IA doc doit être mise à jour** pour refléter le locale-prefix (`/{locale}/...`) et les slugs par locale. Décision K-05 (slugs FR) du `tukio_strategie_acquisition.md` est officiellement **overridée**. Les autres règles de l'IA (paths EN, kebab-case, reserved slugs, sitemap, etc.) restent valides.

### Convention events NATS

`<service>.<aggregate>.<event>.v<n>` lowercase, dashes pour tokens composés.
Exemples : `catalog.listing.published.v1`, `booking.requested.v1`, `payment.intent.captured.v1`.
Catalogue exhaustif : `tukio_event_catalog.md` (~50 events, ground truth de `@tukio/contracts`).

### Marque "Tukio"

- Nom seul opaque pour la cible FR ("événement" en swahili)
- **Tagline obligatoire** dans tous les supports — 3 directions à A/B tester (à figer en MVP)

### Gouvernance documentaire

- 16 documents Tukio en source of truth, ce brief les consolide
- Toute modification structurelle d'un document → mise à jour synchrone du brief
- Décisions tech structurantes → ADR copié dans `docs/adr/` du repo backend
- Versioning sémantique : `v0.1` → `v1.0` → `v2.0` calé sur les sorties produit
- **Doc opportunités** : révision tous les 6 mois (retirer pistes basculées en roadmap, ajouter nouvelles, réévaluer timing)
- **Doc stratégie acquisition** : révision tous les 3 mois (ajuster CAC avec données réelles, mix budgétaire selon performance, nouvelles opportunités/menaces)

---

## 19. Documents de référence

### Strate produit (PMs, founder, design)

| Doc | Contenu | Lignes |
|-----|---------|--------|
| `tukio_spec_v2.2.md` | Spec fonctionnelle complète, 8 domaines, ADRs, risques | ~770 |
| `tukio_design_brief.md` | Positionnement, palette, typo, tons, anti-patterns | 940 |
| `tukio_information_architecture.md` | URLs, sitemap, RBAC, sous-domaines | 780 |
| `tukio_catalogue_deepdive.md` | Taxonomie, fiche pro, dispos, recherche, médias, 18 décisions | 847 |
| `tukio_booking_paiements_deepdive.md` | Parcours détaillés, états, 15 décisions | 854 |

### Strate UX flows (designers, devs frontend)

| Doc | Domaines couverts | Lignes |
|-----|-------------------|--------|
| `tukio_ux_flow_catalog.md` | Création/gestion services pro + découverte client | 1 385 |
| `tukio_ux_flow_booking.md` | Tunnel checkout + gestion réservations + workflow pro | 1 441 |
| `tukio_ux_flow_auth_accounts.md` | Inscription, onboarding pro, profils, paramètres | 1 387 |
| `tukio_ux_flow_communication.md` | Messagerie + avis | 1 119 |
| `tukio_ux_flow_monetization.md` | Abonnements + factures + payouts + finance admin | 1 317 |
| `tukio_ux_flow_admin_moderation.md` | Back-office admin complet | 1 144 |

### Strate backend (tech lead, devs backend)

| Doc | Contenu | Lignes |
|-----|---------|--------|
| `microservices-architecture.md` | Architecture API microservices, base de toute discussion tech | ~700 |
| `tukio_product_tech_alignment.md` | Réconciliation produit ↔ tech, 11 ADRs | 546 |
| `tukio_booking_svc_deepdive.md` | Implémentation détaillée du service le plus critique | 2 339 |
| `tukio_event_catalog.md` | Ground truth de tous les events NATS | 2 028 |

### Strate go-to-market & stratégie

| Doc | Contenu |
|-----|---------|
| `tukio_strategie_acquisition.md` | Stratégie d'acquisition demande complète : CAC, SEO, payant, parrainage, partenariats, mix par phase, 11 décisions tech |
| `tukio_opportunites_futures.md` | 10 pistes hors roadmap (B2G, expansion, B2B2B, mobile native, etc.) avec critères de réouverture |

### Documents à produire

- **`tukio_payment_svc_deepdive.md`** — équivalent au booking-svc deep dive pour `payment-svc` (saga Stripe complète, refunds, payouts, disputes, subscriptions Billing). ~2 000 lignes estimées. À produire avant Sprint 4.
- **Mockups Figma** à partir du design brief + UX flows. À déclencher en parallèle du Sprint 0.

---

*Brief executif consolidé v0.3 — supersede aucun document, complète les 16 documents Tukio comme point d'entrée unique.*
*Dernière mise à jour : 2026-05-08.*
*v0.3 — corrections paths EN (alignés sur `tukio_information_architecture.md` §C), ajout ADR-012 (i18n FR/EN dès Sprint 0), override de la décision K-05 (slugs FR) du doc d'acquisition.*
