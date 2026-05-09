# Tukio — Stratégie d'acquisition (demande client)

> Stratégie d'acquisition de la demande côté **client** (les organisateurs qui vont chercher des pros).
> Couvre SEO, payant, bouche-à-oreille, parrainage, partenariats.
> À lire en parallèle de Sprint 0 — les décisions ici impactent l'architecture produit.
> Audience : tech lead (impact produit/tech), founder (décisions business), futur·e marketer.

---

## Sommaire

- [A. Contexte & enjeu](#a-contexte--enjeu)
- [B. Économie de l'acquisition Tukio](#b-économie-de-lacquisition-tukio)
- [C. Acquisition organique (SEO)](#c-acquisition-organique-seo)
- [D. Acquisition payante](#d-acquisition-payante)
- [E. Bouche-à-oreille & parrainage](#e-bouche-à-oreille--parrainage)
- [F. Partenariats stratégiques](#f-partenariats-stratégiques)
- [G. Mix par phase (MVP / V1 / V2)](#g-mix-par-phase-mvp--v1--v2)
- [H. Implications produit & tech](#h-implications-produit--tech)
- [I. Métriques & dashboards](#i-métriques--dashboards)
- [J. Risques & arbitrages](#j-risques--arbitrages)
- [K. Décisions à prendre](#k-décisions-à-prendre)

---

## A. Contexte & enjeu

### A.1 Le risque #1 de Tukio

C'est la marketplace côté **demande** qui est le plus difficile à amorcer, pas l'offre. Les pros, on peut les démarcher en physique en Pays de la Loire (50 pros en 3 mois est faisable). Mais sans clients qui passent commande, les pros vont quitter la plateforme dans les 6 mois.

**Métrique à surveiller** : ratio de réservations par pro actif. Si un pro Business fait < 2 résa / mois sur Tukio, il quittera au bout de 6 mois (le coût d'opportunité du temps consacré à la plateforme dépasse le revenu).

**Donc** : si l'acquisition demande échoue, l'offre s'effondre, et Tukio meurt. C'est un risque plus immédiat que la conformité TVA (R1) ou le LCEN (R2).

### A.2 Spécificités du marché événementiel

L'acquisition événementiel a 3 caractéristiques structurantes :

1. **Achat ponctuel et important** : un client cherche un chapiteau **une fois** dans sa vie (mariage) ou 2-3 fois par an (B2B). Pas de récurrence naturelle, donc pas de remarketing facile.
2. **Recherche très en amont** : les organisateurs commencent leurs recherches 6-12 mois avant l'événement. Le funnel est long.
3. **Trust est critique** : un mariage qui rate à cause d'un chapiteau qui n'est pas livré, c'est dramatique. Les avis et la réputation pèsent énormément dans la décision.

Conséquences pour la stratégie d'acquisition :
- **SEO long-tail** est ROI-positif (les requêtes spécifiques convertissent bien)
- **Acquisition payante** est coûteuse car CAC élevé (mais possiblement justifié sur ticket moyen 1000-3000€)
- **Bouche-à-oreille** est très puissant (un mariage réussi = la mariée parle à ses amies pour les leurs)
- **Reviews** doivent être visibles et nombreuses dès le début

### A.3 Cadre stratégique

Tukio a 3 leviers d'acquisition à articuler intelligemment :

```
┌─────────────────────────────────────────────────┐
│  Acquisition organique (SEO + contenu)          │
│  → CAC bas long terme, mais ROI à 12+ mois      │
└─────────────────────────────────────────────────┘
              +
┌─────────────────────────────────────────────────┐
│  Acquisition payante (Google + Meta Ads)        │
│  → ROI rapide mais CAC qui monte avec la concu  │
└─────────────────────────────────────────────────┘
              +
┌─────────────────────────────────────────────────┐
│  Bouche-à-oreille / partenariats                │
│  → CAC quasi-zéro mais volume limité            │
└─────────────────────────────────────────────────┘
```

**MVP (mois 1-6)** : 70% bouche-à-oreille / partenariats, 20% SEO foundation, 10% payant pour valider.
**V1 (mois 7-18)** : 50% SEO, 30% payant, 20% partenariats.
**V2 (mois 19-36)** : 40% SEO, 40% payant, 20% partenariats.

---

## B. Économie de l'acquisition Tukio

### B.1 Hypothèses de base à valider

Tous les chiffres ci-dessous sont des **hypothèses de travail**, pas des faits observés. À valider avec les premières données réelles.

| Variable | Hypothèse | Source / raisonnement |
|----------|-----------|----------------------|
| Ticket moyen B2C | 800 € TTC | Marketplaces comparables FR |
| Ticket moyen B2B | 2 500 € TTC | Idem |
| Mix B2C / B2B au MVP | 70 / 30 | Géographie PdL |
| Take rate pondérée | ~10% | Mix Starter (15%) + Business (10%) |
| Marge brute par transaction | 80 € (B2C) / 250 € (B2B) | TR × ticket |
| Taux de conversion visiteur → résa | 2-3% | Marketplaces b2c standard |
| Taux de complétion (résa demandée → confirmée) | 70% | Estimé selon réactivité pros |
| LTV client B2C | 1 résa | Achat unique typique |
| LTV client B2B | 2-3 résa / an pendant 2-3 ans | Récurrence séminaires |

### B.2 CAC cibles

À partir de ces hypothèses, voici les CAC cibles maximaux pour rester ROI-positif :

**B2C** (hypothèse 1 résa LTV) :
- Marge brute par client : 80 €
- CAC max acceptable : **30-40 €** (ratio LTV/CAC = 2-2.5×)
- CAC payant cible : 25 €
- CAC organique cible : 5-10 €

**B2B** (hypothèse 2-3 résa sur 2-3 ans) :
- Marge brute par client sur LTV : 500-1500 €
- CAC max acceptable : **100-300 €**
- CAC payant cible : 80-150 €
- CAC organique cible : 20-50 €

**Implication** : le segment B2B tolère beaucoup mieux l'acquisition payante. Au MVP avec budget limité, on devrait probablement **investir l'acquisition payante en priorité sur B2B**.

### B.3 Volume cible

Pour qu'un pro Business ait 2 résa / mois, on a besoin de :
- 2 résa confirmées / 70% taux complétion = ~3 demandes / mois
- 3 demandes / 2.5% conversion = ~120 visiteurs uniques / mois sur ses fiches

Avec 50 pros au MVP, on a besoin de **6 000 visiteurs uniques mensuels** sur le site.

**Réaliste ?** À 30 € CAC moyen, ça fait 6000 × 30 = 180 000 € / mois de marketing. Évidemment hors de portée.

**Donc** : l'acquisition payante seule ne peut pas amorcer Tukio. Il faut absolument que SEO + bouche-à-oreille fournissent la majorité du trafic, surtout pendant les 6 premiers mois.

---

## C. Acquisition organique (SEO)

### C.1 Stratégie de contenu

**Cible principale** : requêtes de recherche d'organisateurs en amont de leur décision.

**Catégories de requêtes** :

1. **Requêtes transactionnelles locales** (priorité 1)
   - "location chapiteau nantes", "location chaises mariage 44", "traiteur séminaire angers"
   - Volume modéré (100-1000 / mois par requête), conversion forte (5-10%)
   - **C'est le cœur du SEO Tukio**

2. **Requêtes informationnelles** (priorité 2)
   - "comment organiser un mariage en pays de la loire", "checklist séminaire entreprise"
   - Volume élevé (1000-10000), conversion plus faible (1-2%)
   - Sert à capter le trafic en amont du funnel

3. **Requêtes de marque / autorité** (priorité 3)
   - "tukio", "tukio.one", "marketplace événementiel"
   - Volume initialement nul, croît avec la notoriété

### C.2 Architecture SEO du site

**Pages cibles SEO** (déjà couvertes dans l'IA, je rappelle pour cohérence) :

```
/                                          # homepage
/recherche                                 # résultats de recherche
/categorie/{categorie-slug}                # ex: /categorie/tentes-chapiteaux
/categorie/{cat}/{sous-cat}                # ex: /categorie/tentes-chapiteaux/chapiteaux
/categorie/{cat}/{sous-cat}/{ville}        # ex: /.../chapiteaux/nantes
/service/{slug-service}                    # ex: /service/chapiteau-100m2-blanc-chic
/pro/{slug-pro}                            # ex: /pro/event-co-nantes
/blog/{slug-article}                       # blog éditorial
```

**Points critiques** :

- **Pages locales** (`/categorie/X/Y/ville`) : génération automatique pour toutes les villes principales de PdL au MVP, puis FR entière en V1. Chaque page : H1 unique, paragraphe d'intro local-spécifique, liste des pros disponibles dans la zone. Si pas de pros : noindex.
- **Slugs FR** : SEO en français même si URLs anglais (`/category/...` est moins bon que `/categorie/...`). **À acter avec le tech lead** : slugs FR mais structure d'URL EN ?
- **Schema.org markup** : `LocalBusiness` sur les fiches pros, `Service` sur les fiches services, `Review` agregé. Critique pour rich snippets Google.
- **Sitemap XML** segmenté : sitemap-services.xml, sitemap-pros.xml, sitemap-cities.xml, sitemap-blog.xml. Soumission Search Console.
- **Performance** : Core Web Vitals impeccables (impact direct ranking). Vercel + Next.js gèrent ça nativement, mais à monitorer.

### C.3 Contenu éditorial (blog)

**Volume MVP** : 2 articles / mois (~24 articles en 12 mois).
**Volume V1** : 4 articles / mois (objectif 100+ articles indexés à fin V1).

**Format type** :
- 1500-2500 mots par article (sweet spot SEO)
- Structuration claire (H1, H2, H3 hiérarchisés)
- Images optimisées (WebP, alt text)
- Liens internes vers fiches services/pros pertinentes (maillage)
- Ressources actionnables (checklists téléchargeables, calculateurs)

**Templates d'articles** :

1. **"Comment organiser X en Y"** — ex: "Comment organiser un mariage en Pays de la Loire en 12 mois"
2. **"Combien coûte X"** — ex: "Combien coûte la location d'un chapiteau pour 100 personnes ?"
3. **"X meilleurs Y"** — ex: "Les 10 plus beaux lieux de mariage en Loire-Atlantique"
4. **Checklists** — ex: "Checklist complète de mariage en Pays de la Loire" (CTA téléchargement → email capture)
5. **Cas client** — ex: "Comment Marie a organisé son mariage de rêve à Pornichet" (témoignages valant interview)

**Production** : freelance rédacteur SEO (~150-200 €/article au MVP) ou interne si l'équipe le permet. **Ne pas générer du contenu IA pur** — Google de plus en plus dur sur ce point depuis les Helpful Content Updates.

### C.4 Backlinks (link building)

**Sources prioritaires** :

1. **Médias locaux PdL** : Ouest-France, Presse Océan, Wik, Le Journal des Entreprises Pays de la Loire. Une mention dans Ouest-France sur la couverture événementielle locale = lien d'autorité.
2. **Annuaires professionnels** : Pages Jaunes (gratuit), Yelp, Google Business Profile (critique pour SEO local).
3. **Partenariats croisés** : MOU avec acteurs locaux (mairies pour leurs guides "fêter votre événement à X"), associations (Wedding planners de Loire-Atlantique).
4. **Relations presse** : pitch de la marketplace à 2-3 médias clés au lancement, puis 1 fois par trimestre sur les chiffres ou des stories.

**À éviter** : achat de backlinks, échanges manifestement artificiels, articles invités sur des sites de faible autorité. Pénalités Google.

### C.5 SEO local (Google Business Profile)

Tukio n'est pas un commerce physique mais peut créer un GBP en tant que **"plateforme de services événementiels"** avec adresse Nantes. À tester :
- Posts hebdomadaires (nouveautés catalogue, actualités)
- Photos régulières
- Avis (encourager les premiers clients à laisser un avis Google en plus de l'avis Tukio)

Beaucoup de marketplaces oublient ce levier — facile et gratuit.

### C.6 Mesure SEO

**KPIs primaires** :
- Trafic organique mensuel total
- Top 100 mots-clés en suivi (via Ahrefs ou alternative open-source)
- Position moyenne sur les 50 mots-clés priorité 1 (objectif top 5 à 12 mois)
- Taux de conversion organique (visiteur → demande de booking)

**KPIs secondaires** :
- Backlinks acquis (avec score d'autorité moyen)
- Articles blog publiés
- CTR moyen depuis Google Search Console
- Part du trafic organique vs payant (devrait passer de 30% MVP à 70%+ V2)

---

## D. Acquisition payante

### D.1 Canaux

**Google Ads (priorité 1)** : Search ads ciblant les requêtes transactionnelles à fort intent.

**Meta Ads (Facebook + Instagram, priorité 2)** : Display + retargeting + lookalike audiences.

**Pas au MVP** : LinkedIn Ads (B2B mais cher), TikTok Ads (audience pas alignée), affiliés (pas la masse critique).

### D.2 Google Ads — stratégie

**Search ads** sur requêtes transactionnelles :
- Campagnes structurées par catégorie + zone géographique
- Ex: "Chapiteaux Nantes", "Chaises Pliantes Angers", "Traiteurs PdL"
- Bid strategy : Maximize conversions au démarrage, puis tCPA quand on a 30+ conversions

**Performance Max** : à tester en V1 quand on a un catalogue de plusieurs centaines de fiches services. Permet de toucher YouTube + Display + Gmail. Mais demande beaucoup de matériel créatif.

**Budget MVP** : 1 500 € / mois pendant 3 mois pour valider les CACs. Soit ~1 500 / 25 € CAC = 60 acquisitions/mois maximum.

**Ce qu'il NE faut pas faire au MVP** :
- ❌ Bid sur "événementiel" en broad match : trop cher (~5-10 €/clic), trop large
- ❌ Display Network sans retargeting : peu efficace
- ❌ Ouvrir 50 campaignes en parallèle : impossible à optimiser

### D.3 Meta Ads — stratégie

**Audiences principales** :

1. **Mariés en préparation** (6-18 mois avant mariage)
   - Ciblage : intérêts "mariage", "wedding planner", âge 25-40, géo PdL
   - Créa : carousels visuels de fiches services prestige
2. **Organisateurs B2B**
   - Ciblage : titres "Office Manager", "Communication Manager", "Event Manager"
   - Créa : témoignages clients B2B + CTA téléchargement guide
3. **Retargeting visiteurs site**
   - Audience : ont visité une fiche service mais pas converti
   - Créa : rappel de la fiche vue + témoignages

**Budget MVP** : 800 € / mois.

### D.4 Tracking et attribution

Critique de bien tracker pour prendre des décisions :

**Outils** :
- **Google Analytics 4** + **Plausible** (privacy-friendly, RGPD-compliant) — Plausible en source primaire pour cohérence RGPD
- **Stripe** pour la conversion finale
- **PostHog** (recommandé) pour le funnel produit (event tracking, sessions replay)
- **Server-side tracking** via gateway-api (pour fiabiliser face aux ad-blockers)

**Événements à tracker** :
- `page_view` (toutes pages)
- `search_performed` (requête + filtres)
- `service_viewed` (fiche service)
- `pro_viewed` (fiche pro)
- `booking_request_started` (entrée tunnel)
- `booking_request_submitted` (création résa)
- `booking_confirmed` (paiement validé)

**Attribution** : multi-touch (last non-direct click au MVP, data-driven en V2). UTM params systématiques sur toutes les campagnes.

**À acter avec le tech lead** :
- ✅ Tracking côté serveur dès le MVP (impact gateway-api, ~3 jours dev)
- ✅ PostHog ou alternative (~1 jour setup)
- ✅ UTM params consolidés en DB pour reporting (`origin_source`, `origin_medium`, `origin_campaign` sur user et booking)

### D.5 Mesure paid

**KPIs** :
- CAC par canal (objectif < 30 € B2C, < 150 € B2B)
- ROAS (Return On Ad Spend) — objectif > 2× sur budget mensuel
- Conversions par jour
- Taux de conversion landing page (par campagne)
- Score de qualité Google Ads (objectif > 7)

---

## E. Bouche-à-oreille & parrainage

### E.1 Programme de parrainage client

**Mécanique simple** (V1) :

```
Client A (qui a déjà réservé sur Tukio) parraine Client B
   ↓
Client B s'inscrit avec lien parrainage A
   ↓
Client B fait sa première réservation > 200 €
   ↓
A reçoit un crédit de 30 € sur prochaine réservation
B reçoit un crédit de 30 € sur cette réservation
```

**Pourquoi cette méca** :
- **Symétrique** : motivation pour A *et* B → meilleur taux d'activation
- **Conditionnée à une vraie résa** : évite la fraude (pas de crédit sur visite ou inscription seule)
- **Plafond 200 €** : évite que ça impacte les petites résa
- **Crédit d'achat futur** : pas un retrait cash, donc Tukio garde la trésorerie

**Coût total** : 60 € par paire de réservations. Si la résa B est 800 €, marge brute Tukio = 80 €. Donc 80 - 60 = 20 € net.

**À acter avec le tech lead** : structure DB pour codes de parrainage, attribution lors de l'inscription, crédits sur compte client. ~3-4 jours de dev. **Pas au MVP**, V1.

### E.2 Programme apporteurs d'affaires (B2B)

**Cible** : wedding planners indépendants, agences événementielles, lieux de réception (qui orientent leurs clients vers des prestataires complémentaires).

**Mécanique** :
- Apporteur s'inscrit comme partenaire
- Lien tracké unique par apporteur
- Sur chaque résa générée par ses leads → 5% commission sur le ticket

Si un wedding planner amène 10 mariages/an × 1500 € moyen × 5% = 750 €/an de revenu pour lui. Faible pour lui, mais zéro effort. Pour Tukio : acquisition à coût ~5% (similaire au CAC payant) mais avec **forte qualité** (clients déjà qualifiés par le planner).

**À acter** : V1, pas MVP. Demande dashboard partenaire dédié.

### E.3 Activités physiques (MVP, gratuit)

Tu es à Nantes, exploite-le.

**Salons et événements à viser au MVP** :
- Salon du Mariage de Nantes (annuel)
- Salon du Mariage d'Angers
- Forum événementiel CCI Nantes Saint-Nazaire
- Salon des Maires Pays de la Loire (B2G — préparation pour réouverture C.1)
- Networking inter-pros locaux

**Présence physique** :
- Stand au Salon du Mariage : 2-3 K€ pour la première fois (à amortir sur 50 résa générées dans l'année)
- Workshops gratuits "Comment organiser votre mariage sans stress" : faire venir 30-50 organisateurs potentiels par session

### E.4 Mesure bouche-à-oreille

**KPIs** :
- Taux de parrainage : % de clients qui parrainent au moins 1 personne
- Coefficient viral (K-factor) : nombre de nouveaux clients par client existant
- NPS client : indicateur de propension à recommander
- Source d'acquisition "ami / pro / partenaire" dans le formulaire d'inscription (open question)

---

## F. Partenariats stratégiques

### F.1 Partenariats catalogue (lieux de réception)

**Concept** : Tukio devient le partenaire prestataire recommandé de lieux de réception locaux.

**Cible Pays de la Loire** :
- Châteaux de Loire-Atlantique : Château de la Bretesche, Château de la Sébinière, etc.
- Domaines viticoles avec espace réception
- Salles municipales d'envergure

**Mécanique** :
- Le lieu liste les fiches Tukio sur sa propre page "prestataires recommandés"
- Tukio offre une visibilité réciproque sur le lieu via un encart
- Lien tracké, commission éventuelle (5%)

**Premier contact** : MVP, en physique, avec une démo produit faite main.

### F.2 Partenariats associations

**Cible** :
- Wedding planners en réseau (Atelier 1932, etc.)
- CGEM Pays de la Loire (Confédération Générale des Petites et Moyennes Entreprises) — pour le B2B
- Réseau des Femmes du Tourisme — public féminin organisateur

**Logique** : Tukio sponsorise ou intervient à un événement de l'asso, en échange d'une visibilité auprès des membres.

### F.3 Partenariats média

Cf. §C.4 (backlinks). À structurer en relations presse durables, pas en one-shots.

---

## G. Mix par phase (MVP / V1 / V2)

### G.1 MVP (mois 1-6)

**Objectif** : 6 000 visiteurs / mois minimum à fin de période, 80 résa / mois.

**Mix budgétaire** :

| Levier | Budget mensuel | Effort temps |
|--------|----------------|--------------|
| **Bouche-à-oreille / partenariats physiques** | 500 € (salon, déplacements) | 30% |
| **SEO foundation** (contenu de base, technique) | 1 000 € (rédacteur freelance) | 40% |
| **Google Ads** (test) | 1 000 € | 15% |
| **Meta Ads** (test) | 500 € | 10% |
| **Outillage** (PostHog, Plausible, Search Console) | 200 € | 5% |
| **Total** | **~3 200 €/mois** | |

**Décisions critiques** :
- Pas de retargeting Meta avant d'avoir 1 000 visiteurs/mois (sinon trop peu d'audience)
- SEO blog démarre dès le mois 1 (12 mois de retard = 12 mois de retard)
- Une priorisation claire entre B2B et B2C : **commencer B2B** car CAC tolérable plus élevé

### G.2 V1 (mois 7-18)

**Objectif** : 30 000 visiteurs / mois, 400 résa / mois.

**Mix budgétaire** :

| Levier | Budget mensuel | Effort |
|--------|----------------|--------|
| **SEO contenu** (4 articles/mois) | 1 500 € | 25% |
| **Google Ads** (Search + Performance Max test) | 4 000 € | 20% |
| **Meta Ads** (full funnel) | 2 500 € | 15% |
| **Programme parrainage client** | 800 € (crédits émis) | 10% |
| **Partenariats** (commissions apporteurs) | 1 200 € | 15% |
| **Salons et events** | 600 € | 10% |
| **Outillage** | 400 € | 5% |
| **Total** | **~11 000 €/mois** | |

### G.3 V2 (mois 19-36)

**Objectif** : 100 000 visiteurs / mois, 1 500 résa / mois.

**Mix budgétaire** :

| Levier | Budget mensuel |
|--------|----------------|
| **SEO contenu** (8-10 articles/mois + équipe interne) | 4 000 € |
| **Google Ads** | 12 000 € |
| **Meta Ads** | 7 000 € |
| **Programmes parrainage / fidélité** | 3 000 € |
| **Partenariats (commissions)** | 5 000 € |
| **Relations presse / influence** | 2 000 € |
| **Total** | **~33 000 €/mois** |

---

## H. Implications produit & tech

Cette section décrit ce qui doit être pré-câblé dans le produit / tech pour que la stratégie d'acquisition soit possible. **Ces implications doivent être discutées avec le tech lead avant Sprint 0**.

### H.1 Tracking infrastructure

**À implémenter dès Sprint 0** :

- **UTM params persistance** : `gateway-api` capture les UTMs à l'arrivée et les stocke dans une session, puis les attribue à l'inscription user et à la booking. Schema additionnel sur les tables `users` et `bookings` :
  ```
  acquisition_source       TEXT   -- 'organic', 'google_ads', 'meta_ads', 'referral', 'direct', 'partner'
  acquisition_medium       TEXT
  acquisition_campaign     TEXT
  acquisition_referral_id  TEXT   -- si parrainage / partenaire
  acquisition_first_touch  TIMESTAMPTZ
  acquisition_last_touch   TIMESTAMPTZ
  ```

- **Server-side tracking** : événements business critiques (booking_request_started, booking_confirmed) émis depuis `gateway-api` directement vers PostHog / GA4. Évite les ad-blockers et améliore la fiabilité.

- **PostHog setup** : 1 jour de dev, gratuit jusqu'à 1M events/mois.

**À implémenter en V1** :

- **Programme de parrainage** : table `referral_codes` (code, owner_user_id, created_at, expires_at) + table `referral_attributions` (referrer_id, referred_id, code, created_at, status). Logic d'attribution au moment de l'inscription du filleul. Crédits stockés dans `user_credits` (montant, expiration).

- **Apporteurs d'affaires (B2B)** : extension du système de parrainage avec rôle "partner" + dashboard dédié.

### H.2 SEO infrastructure

**À implémenter dès Sprint 0** :

- **Slugs SEO-friendly** : `/service/chapiteau-100m2-blanc-chic-nantes` (FR avec accents normalisés). À discuter avec tech lead — si convention "URLs en EN" est tenue (cf. doc IA), alors slugs FR uniquement (`/service/{slug}` est OK, le slug peut être FR).

- **Meta tags dynamiques** : chaque page (fiche service, fiche pro, catégorie) génère son propre title, description, OG tags. Templates côté Next.js avec `<Metadata />` server-side.

- **Sitemap XML auto-généré** : segmenté par type d'entité, mis à jour quotidiennement. Premier sitemap critique : pros + services publiés.

- **Schema.org JSON-LD** : injecté dans chaque page. Schema `Service`, `LocalBusiness`, `BreadcrumbList`, `AggregateRating` (sur les fiches pros avec reviews).

**À implémenter en V1** :

- **Pages locales générées** : pour chaque combo (catégorie, sous-catégorie, ville), si > 3 pros disponibles → page créée automatiquement. Sinon noindex.
- **Maillage interne** : liens contextuels entre fiches pros / services / catégories / blog.
- **Page blog** complète : `/blog`, `/blog/{slug}`, navigation par tags, RSS feed.

### H.3 Performance / Core Web Vitals

À monitorer dès le MVP :

- **LCP** (Largest Contentful Paint) < 2.5s
- **INP** (Interaction to Next Paint) < 200ms
- **CLS** (Cumulative Layout Shift) < 0.1

Vercel + Next.js gèrent nativement, mais surveiller via Search Console + Lighthouse CI.

### H.4 Conversion optimization

**À implémenter en V1** :

- **A/B testing framework** : intégré à PostHog ou via GrowthBook (déjà mentionné dans Research_Report cross-cutting concerns). Permet de tester variantes de pages de conversion.

- **Heatmaps** : Hotjar ou alternative open-source (PostHog inclut ça). Identifier les frictions sur les pages clés.

- **Session replay** (avec consentement RGPD) : voir où les utilisateurs bloquent dans le tunnel.

### H.5 Email marketing

**Au MVP** : déjà couvert par `notification-svc` pour les emails transactionnels. Pas d'emails marketing au MVP.

**En V1** : intégrer un outil d'email marketing — Klaviyo (cher mais puissant), Loops (moderne, simple), Brevo (français, RGPD-compliant). Newsletter mensuelle aux clients + nurturing leads non convertis.

**Implication tech** : exposer un endpoint `notification-svc` pour synchroniser les contacts avec l'outil tiers (idempotent, RGPD-aware).

---

## I. Métriques & dashboards

### I.1 Dashboard MVP (à mettre en place avant launch)

**Top of funnel** :
- Visiteurs uniques quotidiens / hebdomadaires / mensuels (Plausible)
- Sources de trafic (organique, payant, direct, referral, social)
- Pages les plus visitées
- Taux de rebond global

**Middle of funnel** :
- Recherches effectuées
- Fiches services vues
- Fiches pros vues
- Conversion visiteur → recherche → fiche → demande

**Bottom of funnel** :
- Demandes de booking créées
- Demandes acceptées par les pros
- Réservations confirmées (paiement)
- CA total
- CA par segment (B2C / B2B)

**Acquisition** :
- CAC par canal (calcul mensuel)
- Coût par lead (intermediaire)
- ROAS par campagne payante
- Parts du trafic par source

### I.2 Frequency

- **Quotidien** : top of funnel + ventes
- **Hebdomadaire** : full funnel + acquisition par canal
- **Mensuel** : revue stratégique + arbitrages budgétaires

### I.3 Outillage recommandé

| Outil | Usage | Coût |
|-------|-------|------|
| **Plausible** | Web analytics RGPD | ~10 €/mois |
| **PostHog** | Product analytics, funnels, A/B tests, session replay | Gratuit < 1M events/mois |
| **Google Search Console** | SEO Google | Gratuit |
| **Bing Webmaster Tools** | SEO Bing | Gratuit |
| **Ahrefs (lite) ou Mangools** | SEO research, backlinks | 30-100 €/mois |
| **Google Ads Editor** | Gestion campagnes | Gratuit |
| **Meta Ads Manager** | Idem | Gratuit |
| **Looker Studio** | Dashboards consolidés | Gratuit |

**Total tooling** : ~150 €/mois.

---

## J. Risques & arbitrages

### J.1 Risque #1 : SEO ROI lent

**Risque** : le SEO prend 6-12 mois minimum pour produire du trafic significatif. Pendant ce temps, on dépend du payant et du bouche-à-oreille.

**Mitigation** :
- Démarrer le SEO **dès Sprint 0** (technique) et le contenu dès le mois 1
- Budget payant pour combler le gap pendant la rampe SEO
- Bouche-à-oreille physique pour les premiers clients (impossible de skipper Salon Mariage)

### J.2 Risque #2 : CAC payant qui explose

**Risque** : la concurrence sur "location chapiteau Nantes" peut faire monter les CPC. Si Hutter ou un concurrent national entre sur le créneau, les coûts s'envolent.

**Mitigation** :
- Diversification des canaux dès le début
- Investissement SEO comme contre-pouvoir long terme
- Marque forte (notoriété → trafic direct) → priorité à la stratégie marque

### J.3 Risque #3 : taux de conversion plus bas que prévu

**Hypothèse** : 2-3% visiteur → résa. Si réalité = 0.5%, tout l'écosystème s'effondre.

**Mitigation** :
- A/B tests systématiques en V1
- User research régulier (10 utilisateurs/mois interviewés)
- UX flow optimisé (déjà fait dans `tukio_ux_flow_*` docs)

### J.4 Risque #4 : marketplace asymétrique

**Risque** : on attire trop de clients sans avoir assez d'offre, ou inversement. Les deux sont mortels.

**Mitigation** :
- Suivi quotidien du **ratio offre/demande** par catégorie
- Frein actif sur les ads si trop de demandes pas servies (frustration → churn)
- Recrutement actif pros si trop d'offres dans une catégorie sans demandes

### J.5 Risque #5 : dépendance à un canal

**Risque** : si Google change son algorithme et qu'on perd 50% du SEO, on meurt si on n'a pas diversifié.

**Mitigation** :
- Mix d'au moins 3 canaux significatifs dès V1
- Données first-party (email + bouche-à-oreille) → indépendance des plateformes

---

## K. Décisions à prendre

### K.1 Décisions immédiates (avant Sprint 0)

| Décision | Reco | Impact |
|----------|------|--------|
| **K-01** Stack tracking : PostHog vs Mixpanel vs autre ? | **PostHog** (open-source, hosted EU possible, RGPD friendly, inclus session replay + A/B + funnels) | 1 jour setup |
| **K-02** Web analytics : Plausible vs GA4 vs cookie consent ? | **Plausible** (pas de cookies, RGPD natif) + GA4 en backup pour cross-référencer | 0.5 jour |
| **K-03** Server-side tracking dès le MVP ou en V1 ? | **MVP** (impact gateway-api modeste, fiabilité ad-block) | 3 jours dev |
| **K-04** Schema acquisition_* sur user et booking dès Sprint 0 ? | **Oui** (impossible à rétro-fitter sans perte de données) | 1 jour migration |
| **K-05** Stratégie slug SEO : FR ou EN ? | **FR** (impact SEO majeur, pas de coût technique additionnel) | 0 jour |

### K.2 Décisions à V1

| Décision | Reco |
|----------|------|
| **K-06** Programme de parrainage en V1 ou plus tard ? | V1 (mois 7-9), après stabilisation MVP |
| **K-07** Email marketing tool ? | Brevo (FR, RGPD, intégrations Stripe natives) |
| **K-08** Première campagne Performance Max ? | Mois 12+, après avoir 30+ conversions / mois |

### K.3 Décisions à V2

| Décision | Reco |
|----------|------|
| **K-09** Embauche marketer interne ? | Oui à V2 (volume justifie un full-time) |
| **K-10** Programme apporteurs B2B ? | Oui en V2 (volume B2B significatif) |
| **K-11** Investissement RP / influence ? | Oui en V2 (notoriété nationale en construction) |

---

*Fin du document — version 1.*

**Maintenance** : ce doc doit être révisé tous les 3 mois pour ajuster :
- Hypothèses CAC (avec données réelles)
- Mix budgétaire selon performance des canaux
- Nouvelles opportunités émergées (chaînes, partenaires)
- Nouvelles menaces concurrentielles
