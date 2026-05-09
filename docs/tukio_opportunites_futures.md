# Tukio — Opportunités futures

> Pistes de croissance non priorisées pour MVP / V1 / V2.
> Ce document existe pour **ne pas perdre les idées** sans qu'elles polluent les docs opérationnels.
> Audience : tech lead, founder, futurs investisseurs.
> Statut : pas un backlog produit. Ne pas implémenter directement depuis ce doc.

---

## Sommaire

- [A. Pourquoi ce document existe](#a-pourquoi-ce-document-existe)
- [B. Critères de réévaluation](#b-critères-de-réévaluation)
- [C. Pistes documentées](#c-pistes-documentées)
  - [C.1 B2G / Collectivités territoriales](#c1-b2g--collectivités-territoriales)
  - [C.2 Expansion géographique nationale](#c2-expansion-géographique-nationale)
  - [C.3 Expansion européenne](#c3-expansion-européenne)
  - [C.4 Marketplace inter-pros (B2B2B)](#c4-marketplace-inter-pros-b2b2b)
  - [C.5 Intégrations comptables avancées](#c5-intégrations-comptables-avancées)
  - [C.6 Application mobile native](#c6-application-mobile-native)
  - [C.7 Verticales spécialisées (mariage, séminaire, anniversaire)](#c7-verticales-spécialisées)
  - [C.8 Contenu & média (blog, podcast)](#c8-contenu--média)
  - [C.9 Place de marché de talents (DJ, photographes en propre)](#c9-place-de-marché-de-talents)
  - [C.10 Outils SaaS pros (CRM, planning, devis)](#c10-outils-saas-pros)

---

## A. Pourquoi ce document existe

Au cours de la phase de spécification produit (15 documents, 20 600 lignes), plusieurs pistes ont émergé qui ne rentrent pas dans le scope MVP / V1 / V2 mais méritent d'être conservées.

**Règle d'or** : ce qui est dans ce doc n'est **pas** dans la roadmap. Lire ce document doit explicitement signifier "voici ce qu'on ne fait pas, et pourquoi".

Les raisons typiques pour qu'une piste atterrisse ici :
- Pas de validation du marché à ce stade (hypothèse trop spéculative)
- Modèle économique différent du core marketplace (bouture)
- Charge ops / commerciale incompatible avec une équipe < 5 personnes
- Conformité réglementaire spécifique pas encore cadrée
- Dépendance à un volume de transactions qu'on n'a pas encore atteint
- Pivot complet du produit (autre marché)

Quand une piste mérite d'être réétudiée, **on ouvre un chantier dédié** (spec produit complète, persona, business case). On ne l'ajoute pas progressivement à la spec actuelle.

---

## B. Critères de réévaluation

Pour chaque piste, on définit :

1. **Pourquoi c'est intéressant** — la valeur potentielle si on l'embrasse
2. **Pourquoi pas maintenant** — les blocages actuels (volume, équipe, conformité, etc.)
3. **Ce qu'il faudra réétudier** — les questions ouvertes à reprendre quand on rouvrira le sujet
4. **Signaux qui déclencheraient la réévaluation** — événements concrets qui justifieraient de rouvrir le dossier

---

## C. Pistes documentées

### C.1 B2G / Collectivités territoriales

**Ce que c'est** : marketplace adaptée pour les achats publics — communes, intercommunalités, départements, régions — qui organisent régulièrement des événements (vœux, inaugurations, fêtes locales, salons, conférences).

**Pourquoi c'est intéressant** :
- Le segment a un budget événementiel récurrent et prévisible (annuel, voté en conseil)
- Volume potentiel important : Pays de la Loire compte ~1 250 communes + 17 EPCI + 5 départements + 1 région
- Cycle de vente long mais fidélisation forte (3-5 ans typiquement)
- Permet de positionner Tukio comme acteur de l'économie locale (storytelling fort)
- Pas de concurrence directe identifiée sur ce segment en Pays de la Loire

**Pourquoi pas maintenant** :
- Cycle de vente B2G complètement différent du B2C : 3-12 mois entre premier contact et premier achat
- Conformité Code de la commande publique (marchés publics, seuils, MAPA, dématérialisation Chorus Pro)
- Besoin d'un référencement UGAP ou centrale d'achat publique pour gros volumes
- Demande commercial dédié (pas de self-service comme en B2C)
- Personae très différents (DGS, élus, services achats) avec attentes distinctes
- Risque produit : architecture technique potentiellement à revoir (multi-tenants, espaces séparés par collectivité, validation hiérarchique)

**Ce qu'il faudra réétudier** :
- Étude de marché approfondie : volume réel d'achats, tickets moyens, fréquence
- Analyse réglementaire : seuils de marchés, plateforme PLACE, Chorus Pro, RGPD spécifique secteur public
- Architecture produit : workspace dédié vs simple persona ?
- Positionnement : Tukio en marque blanche pour collectivités, ou même marque ?
- Acquisition : rachat de portefeuille existant, partenariat avec asso départementale d'élus, présence salons (Salon des Maires) ?

**Signaux qui déclencheraient la réévaluation** :
- Demande spontanée de 5+ collectivités en Pays de la Loire après 12 mois d'opération
- Stabilisation du modèle B2C (CA mensuel récurrent > 100 K€)
- Embauche d'un commercial expérimenté en B2G
- Levée de fonds permettant de financer 18 mois de cycle de vente sans CA

**Estimation de réouverture** : pas avant V3 (~24-36 mois post-launch), à confirmer selon traction B2C.

---

### C.2 Expansion géographique nationale

**Ce que c'est** : ouverture du marketplace à toute la France métropolitaine après le succès en Pays de la Loire (puis Bretagne en V1 et grandes villes en V2).

**Pourquoi c'est intéressant** :
- Marché français événementiel : ~30 milliards € (B2C + B2B confondus)
- Potentiel de scale 50-100x du volume Pays de la Loire
- Modèle déjà éprouvé localement avant nationalisation = moins de risque

**Pourquoi pas maintenant** :
- Nationalisation prématurée = dilution catalogue + qualité service
- Stratégie d'acquisition pros différente entre PdL (porte-à-porte possible) et France entière (impossible en physique)
- Charge support multipliée
- Risque de perdre le positionnement "local et chaleureux"

**Ce qu'il faudra réétudier** :
- Stratégie de villes : top-down (Paris, Lyon, Marseille, Bordeaux d'abord) ou bottom-up (régions où on a des relais) ?
- Sourcing pros à distance : commercial inside sales vs partenariats associations pros
- Logistique : zones de livraison, frais transport, coordination
- Marque : "Tukio Pays de la Loire" vs "Tukio" tout court
- Ressources : combien de personnes nécessaires pour ouvrir une nouvelle région ?

**Signaux qui déclencheraient la réévaluation** :
- 200+ pros actifs en Pays de la Loire avec NPS pro > 50
- Demandes spontanées de pros / clients de régions hors PdL/Bretagne
- CA mensuel récurrent > 200 K€
- Levée de fonds Série A

**Estimation de réouverture** : V3 (~18-24 mois).

---

### C.3 Expansion européenne

**Ce que c'est** : ouverture du marketplace dans des pays européens à culture événementielle proche — Belgique francophone, Suisse romande, Luxembourg, puis Allemagne, Pays-Bas, Italie, Espagne.

**Pourquoi c'est intéressant** :
- Premier marché plus simple : Belgique francophone (langue, proximité culturelle, conformité UE)
- Effet de leviers technologique : architecture Tukio est conçue pour scale
- Potentiel de différenciation : peu de marketplaces événementielles européennes (vs US où il y en a beaucoup)

**Pourquoi pas maintenant** :
- Conformité multi-pays : TVA intracommunautaire, mandat de facturation par pays, PSD2 par juridiction
- Multi-currency (Euro pour tous au début, mais GBP, CHF en V3+)
- i18n produit complet (FR, EN, NL, DE, ES, IT)
- Stripe Connect : conformité KYC par pays
- Localisation legale : CGU par pays, RGPD national, médiateurs

**Ce qu'il faudra réétudier** :
- Architecture multi-currency et multi-fiscale
- Localisation produit (i18n) et processus de traduction
- Stratégie d'entrée : filiale locale, partenaire local, ou crois sur l'export ?
- Modèle économique adapté : pas tous les pays ont le même appétit pour les marketplaces marketplace

**Signaux qui déclencheraient la réévaluation** :
- Saturation de la France (improbable avant V4-V5)
- Investisseur stratégique européen
- Opportunité d'acquisition d'une marketplace existante en Belgique/Suisse

**Estimation de réouverture** : V4 (~36-48 mois). Très long terme.

---

### C.4 Marketplace inter-pros (B2B2B)

**Ce que c'est** : permettre aux pros d'acheter des prestations à d'autres pros (DJ qui loue du matériel à un loueur, traiteur qui sous-traite la fleur à un fleuriste).

**Pourquoi c'est intéressant** :
- Augmente la **density** du graph de pros — chaque pro devient à la fois vendeur et acheteur
- Volumétrie additionnelle sans acquisition client supplémentaire
- Renforce la dépendance à Tukio (pro qui en utilise plusieurs facettes)
- Permet potentiellement de proposer des "bundles" complets (fleur + traiteur + DJ + lieu)

**Pourquoi pas maintenant** :
- Modèle de tarification différent (commissions plus basses sur B2B, conditions différentes)
- Risque de cannibaliser le booking client (pourquoi un pro ferait passer ses commandes par Tukio si c'est cher ?)
- Complexité workflow : qui paie la commission ? Qui facture qui ?
- Pas de validation de la demande : est-ce vraiment un pain point pros ?

**Ce qu'il faudra réétudier** :
- User research auprès de 20-30 pros actifs : "Comment vous fournissez-vous en prestations complémentaires aujourd'hui ?"
- Modèle économique : commission, abonnement, gratuit ?
- Architecture produit : nouveau persona, ou simple extension du compte pro ?
- Risque concurrentiel : place laissée à Stoik / Wedoo / autres ?

**Signaux qui déclencheraient la réévaluation** :
- Plusieurs pros qui demandent spontanément cette feature
- Identification d'un pain point clair lors d'un user research dédié
- 100+ pros actifs (densité minimale pour qu'il y ait un marché interne)

**Estimation de réouverture** : V2-V3, conditionné à validation user research.

---

### C.5 Intégrations comptables avancées

**Ce que c'est** : connexions natives avec les outils comptables des pros — Pennylane, QuickBooks, Sage, Cegid, Indy — pour pousser automatiquement les factures et reversements.

**Pourquoi c'est intéressant** :
- Réduit énormément la friction comptable des pros
- Différenciation forte vs marketplaces qui n'offrent que CSV
- Peut justifier le passage à un tier supérieur (Business / Enterprise)

**Pourquoi pas maintenant** :
- Demande prioritaire : exports CSV (couvert dans `tukio_ux_flow_monetization.md` §E)
- Ressources de dev limitées vs gain incrémental
- Beaucoup d'outils comptables → complexité de maintenance

**Ce qu'il faudra réétudier** :
- Lesquels des outils sont les plus utilisés par tes pros ?
- API de chaque outil : maturité, documentation, conditions
- Faire en interne ou via Zapier / Make (low-code) ?

**Signaux qui déclencheraient la réévaluation** :
- 30%+ des pros Business / Enterprise qui demandent une intégration spécifique
- Partenariat stratégique avec un éditeur (Pennylane motivé pour intégrer Tukio dans leur catalogue)

**Estimation de réouverture** : V2 (selon retours pros).

---

### C.6 Application mobile native

**Ce que c'est** : applications iOS et Android natives au-delà du web responsive — particulièrement utile pour les pros (notifications urgentes de demandes, gestion en mobilité sur les événements).

**Pourquoi c'est intéressant** :
- Pros gèrent souvent leur activité en mobilité (entre 2 prestations)
- Notifications push critiques pour les demandes urgentes (on a 48h pour répondre)
- Différenciation perçue : "Tukio a une app, pas que Wedoo qui n'a qu'un site"
- Ouverture potentielle à des features mobile-first (scanner QR matériel livré, géolocalisation, signature électronique)

**Pourquoi pas maintenant** :
- Coût de dev élevé (équipe React Native ou Flutter dédiée, ou native Swift + Kotlin)
- App Store / Play Store : politique de validation stricte (notamment pour fees marketplace)
- PWA peut couvrir 80% des besoins au démarrage
- ROI difficile à mesurer avant d'avoir 500+ pros actifs

**Ce qu'il faudra réétudier** :
- PWA + push notifications natifs vs vraie app native
- Stack technique (React Native vs Flutter vs natif)
- Quelle plateforme prioritaire (iOS = pros premium ? Android = pros mainstream ?)
- Submission Apple : quelle structure de prix pour passer la validation marketplace ?

**Signaux qui déclencheraient la réévaluation** :
- 500+ pros actifs
- Plaintes répétées sur l'expérience mobile web
- Concurrent direct qui sort une app

**Estimation de réouverture** : V2-V3.

---

### C.7 Verticales spécialisées

**Ce que c'est** : pivoter ou ajouter des sous-marketplaces dédiées à des verticales spécifiques — Tukio Mariage, Tukio Séminaires, Tukio Anniversaires.

**Pourquoi c'est intéressant** :
- Chaque verticale a ses propres codes UX (exemple : mariage = très visuel, inspiration ; séminaire = devis professionnel, comparatif features)
- SEO plus performant sur des requêtes spécialisées ("location chapiteau mariage Nantes" > "location chapiteau Nantes")
- Possibilité de tarifications différenciées par verticale

**Pourquoi pas maintenant** :
- Fragmentation prématurée du catalogue
- Coût de gestion (3 marketplaces = 3× le travail produit/marketing)
- Pas de validation que les clients raisonnent en "verticale" plutôt qu'en "j'ai besoin d'un chapiteau"

**Ce qu'il faudra réétudier** :
- Analyse des requêtes Google : quels segments ont le plus de volume / le moins de concurrence ?
- Tests A/B : page d'atterrissage spécialisée vs page générique
- ROI marketing : ne suffirait-il pas d'avoir des "univers" éditoriaux (sans architecture produit séparée) ?

**Signaux qui déclencheraient la réévaluation** :
- Une verticale représente > 50% du GMV (signaux du marché qu'il faut spécialiser)
- Acquisition d'un marketplace concurrent verticale

**Estimation de réouverture** : V3.

---

### C.8 Contenu & média

**Ce que c'est** : production de contenu éditorial autour de l'événementiel — blog, podcast, newsletter, guides téléchargeables.

**Pourquoi c'est intéressant** :
- Acquisition organique forte (SEO long-tail, citations presse)
- Positionne Tukio comme expert du secteur
- Permet de capter des leads en haut de funnel (avant qu'ils cherchent un pro précis)
- Différenciation marque

**Pourquoi pas maintenant** :
- Le contenu éditorial est un chantier qui demande des ressources dédiées (rédacteur, SEO specialist)
- ROI lent (12-18 mois pour des résultats SEO)
- Risque de dispersion : faire moyennement plusieurs choses vs bien faire le core

**Note** : ce sujet est partiellement couvert dans `tukio_strategie_acquisition.md` §C.1 (SEO de contenu). Voir là-bas pour les détails.

**Estimation de réouverture** : V1 (intégré à la stratégie d'acquisition).

---

### C.9 Place de marché de talents

**Ce que c'est** : ajout de prestataires individuels (DJ freelance, photographes, animateurs) en plus des entreprises matériel/services.

**Pourquoi c'est intéressant** :
- Élargit considérablement l'offre catalogue
- Touchpoints supplémentaires avec le client (un événement = matériel + talents)
- Tickets moyens potentiellement plus élevés

**Pourquoi pas maintenant** :
- Modèle économique différent : KYC d'auto-entrepreneur, conformité travail dissimulé
- Concurrence frontale avec acteurs spécialisés (BookingForGood, GigSalad)
- Cold start sur un nouveau type d'offre

**Ce qu'il faudra réétudier** :
- Conformité URSSAF / DGFiP pour mise en relation freelances
- Scoring qualité (vidéos demos, références)
- Tarification : commission + frais admin spécifique ?

**Signaux qui déclencheraient la réévaluation** :
- Pros existants demandent à proposer des prestations talents
- Identification de partenaires dans cette niche

**Estimation de réouverture** : V3+.

---

### C.10 Outils SaaS pros

**Ce que c'est** : à terme, transformer Tukio en plateforme SaaS pour pros qui gèrent toute leur activité (CRM, planning, devis, factures, communication clients), pas juste les leads de Tukio.

**Pourquoi c'est intéressant** :
- Augmente la stickiness des pros (passent de "site qui amène des clients" à "site sans lequel ils ne peuvent plus travailler")
- Multiplie les revenus par pro (commission + abonnement + features payantes)
- Crée un fossé concurrentiel énorme (les pros n'iront pas chez un concurrent si tout leur outillage est chez Tukio)

**Pourquoi pas maintenant** :
- Charge produit énorme : c'est un autre produit
- Risque de dilution focus
- Concurrents établis (HoneyBook, Aisle Planner) ont 5+ ans d'avance
- Demande des features que Tukio ne propose pas et n'a pas vocation à proposer (gestion clients hors Tukio, devis personnalisés, etc.)

**Ce qu'il faudra réétudier** :
- Build vs buy (acquisition d'un acteur existant)
- Modèle économique : abonnement complémentaire ? Inclus dans Business / Enterprise ?
- Roadmap : par où commencer ? (devis, planning, factures...)

**Signaux qui déclencheraient la réévaluation** :
- 1 000+ pros actifs sur Tukio
- Demandes répétées des pros pour gérer leur activité au-delà de Tukio
- Investisseur intéressé par la vision "vertical SaaS"

**Estimation de réouverture** : V4-V5, vraiment long terme.

---

*Fin du document — version 1.*

**Maintenance** : ce doc doit être révisé tous les 6 mois pour :
- Retirer les pistes qui ont basculé en roadmap (devenues V1, V2, etc.)
- Ajouter les nouvelles pistes émergées
- Réévaluer les estimations de timing selon la traction réelle
- Documenter les pivots si certaines pistes deviennent stratégiquement obsolètes
