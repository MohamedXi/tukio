# Tukio — Deep Dive : Catalogue & Services

> Document de référence pour le domaine catalogue
> À lire en complément de `tukio_spec_v2.md` (Partie 2, section 2.2) et `tukio_booking_paiements_deepdive.md`
> Audience : produit, dev, design, SEO

---

## Sommaire

- [A. Vue d'ensemble — l'objet "service"](#a-vue-densemble--lobjet-service)
- [B. Taxonomie & catégorisation](#b-taxonomie--catégorisation)
- [C. Création & édition d'un service par le pro](#c-création--édition-dun-service-par-le-pro)
- [D. Disponibilités & inventaire](#d-disponibilités--inventaire)
- [E. Recherche & découverte côté client](#e-recherche--découverte-côté-client)
- [F. Photos & médias](#f-photos--médias)
- [G. Edge cases](#g-edge-cases)
- [H. Décisions à valider](#h-décisions-à-valider)

---

## A. Vue d'ensemble — l'objet "service"

### Le modèle conceptuel

Un **service** est l'unité élémentaire du catalogue Tukio. C'est ce qu'un pro publie et ce qu'un client réserve. Tout le système gravite autour.

3 niveaux de complexité prévus :

| Niveau | Cible | Exemple |
|--------|-------|---------|
| **Service simple** | MVP | 1 fiche = 1 chose réservable. Ex : "Chaise pliante blanche" à 5 €/unité |
| **Service avec options** | MVP | Service simple + add-ons facultatifs. Ex : Chapiteau 100 m² + option éclairage + option plancher |
| **Package** | V1 | Plusieurs services groupés à prix forfaitaire. Ex : "Pack mariage 100 invités" = 1 chapiteau + 100 chaises + 10 tables + éclairage |
| **Configuration personnalisée** | V2 | Assistant qui assemble dynamiquement plusieurs services selon des critères client | Mariage 80 invités, budget 5k → propose 3 packages |

**Décision MVP** : on traite uniquement *Service simple* + *Service avec options*. Les packages arrivent en V1, le configurateur en V2.

### Modèle de données — entités principales

```
Service (publié par 1 pro)
  ├── id, pro_id, status, slug, created_at, updated_at
  ├── title, description, category_id, sub_category_id, type_id
  ├── pricing_mode (unit | forfait | quote)
  ├── unit_price OR forfait_price OR null (si quote)
  ├── min_quantity, max_quantity (pour mode unit)
  ├── delivery_zones[] (codes postaux ou polygones)
  ├── delivery_fee_mode (free | flat | per_km)
  ├── delivery_fee_value
  ├── photos[]
  ├── video_url (V1)
  ├── tags[] (recherche)
  ├── policies (annulation, paiement)
  ├── lead_time_days (délai mini avant événement)
  ├── stats (views, conversion, ratings_avg)
  └── options[] → ServiceOption
        ├── id, service_id, label
        ├── price (delta sur prix de base)
        ├── is_required (false par défaut)
        └── max_quantity

Availability (séparé du Service pour scaler)
  ├── service_id
  ├── total_inventory (combien d'unités le pro possède)
  ├── max_concurrent_bookings (pour services packagés type chapiteau)
  ├── preparation_buffer_days (délai entre 2 résas)
  ├── blocked_dates[] (dates manuellement bloquées)
  └── recurring_rules[] (ex : "indisponible tous les lundis")

Booking (côté résa, pour rappel)
  └── service_snapshot (copie du Service au moment de la résa)
```

### Les 3 modes de tarification — choix du pro à la création

| Mode | Quand | Exemple | Implémentation |
|------|-------|---------|----------------|
| **À l'unité (`unit`)** | Stock multiple, prix proportionnel | 50 chaises × 5 € = 250 € | `unit_price × quantity + options + delivery` |
| **Forfait (`forfait`)** | Item unique, prix fixe | 1 chapiteau 100 m² = 1 200 € | `forfait_price + options + delivery` |
| **Sur devis (`quote`)** | Trop variable pour prix affiché | "Animation mariage" | Pas de prix affiché, demande de devis obligatoire |

**Règle** : un service ne peut combiner qu'**un seul mode principal** + des options. Pas de mix complexe au MVP/V1.

---

## B. Taxonomie & catégorisation

### Architecture à 3 niveaux : Catégorie → Sous-catégorie → Type

Cette hiérarchie est **figée et gérée par les admins**. Les pros classent leurs services dans cette structure mais ne peuvent pas créer de nouvelles entrées.

**Pourquoi figée ?**
- Cohérence SEO (URLs propres, pages catégories indexables)
- Cohérence UX (filtres prévisibles)
- Lutte contre le spam et les classifications créatives
- Permet de générer des pages SEO programmatiques (V2)

**Comment ajouter une catégorie ?** Demande pro → admin évalue → ajout si > 5 pros le réclament et que le marché est cohérent avec Tukio.

### Taxonomie au lancement MVP (2 catégories pilotes)

#### 📦 Location de matériel

**Tentes & chapiteaux**
- Chapiteau de réception (capacité > 50 personnes)
- Tente pliable / barnum (1-50 personnes)
- Pagode événementielle
- Tente stretch / Bedouin
- Voile d'ombrage / parasol XXL

**Mobilier événementiel**
- Tables (rondes, rectangulaires, hautes / mange-debout, basses, buffet)
- Chaises (pliantes, cérémoniales, lounge, design, transparentes / "Napoléon")
- Tribunes & gradins
- Estrades & podiums
- Bars mobiles & comptoirs
- Vestiaires mobiles

### Roadmap d'ajout des catégories (V1 → V2)

**V1 — Ajout :**

📦 *Location de matériel*
- Sonorisation & lumière (enceintes, micros, régies, projecteurs, machines à fumée)
- Vaisselle & art de la table (assiettes, verres, couverts, nappage)
- Cuisine & buffet (fours, frigos, plancha, tables de réchaud)
- Chauffage & climatisation (parasols chauffants, brasero, ventilo XXL)
- Décoration (arches florales, photo booth, fonds de scène, mange-debout déco)

🎉 *Services événementiels*
- Animation (DJ, live band, animation enfants, magicien, photobooth)
- Restauration (traiteur, food truck, bar mobile, service de mixologie)
- Logistique (livraison + montage, sécurité, vestiaire avec personnel)

**V2 — Ajout :**

🎁 *Packages clés en main* (catégorie spéciale)
- Mariage
- Anniversaire d'entreprise / séminaire
- Lancement produit
- Cocktail VIP
- Anniversaire enfant

### Classification — règles métier

- **1 service = 1 type principal** (obligatoire)
- **Tags secondaires** (V1) : un pro peut ajouter 5 tags max pour enrichir la recherche (ex : "champêtre", "chic", "minimaliste")
- **Refus de classification** : si le pro essaie de classer un service hors de la taxonomie, l'admin peut le rejeter à la modération avec un message type *"Cette catégorie n'existe pas encore sur Tukio. Vous pouvez la suggérer en répondant à cet email."*

### Décision : multi-catégorisation autorisée ?

Un même service peut-il être listé dans 2 catégories différentes ? Ex : un chapiteau qui sert aussi de "tente lounge" → catégorie "Tente" ET catégorie "Lounge" ?

**Recommandation : non, pas de multi-catégorisation.**
- Encourage le pro à dupliquer la fiche s'il vise vraiment 2 usages → meilleure SEO sur chaque
- Évite la dilution des résultats de recherche
- Plus simple à maintenir

---

## C. Création & édition d'un service par le pro

### Le contexte — premier service vs édition

Le **premier service** est un moment critique de l'onboarding pro. Il faut maximiser la complétion. C'est la fonctionnalité où on accepte d'être plus directif (assistant guidé, défauts intelligents, exemples) que pour les fiches suivantes.

### Workflow — création du premier service (assistant guidé)

#### Étape 1 — Choix de la catégorie

**Écran 1.1 — Sélection guidée**
- "Que voulez-vous proposer sur Tukio ?"
- Grandes catégories visuelles avec illustrations
- Au tap → sous-catégories
- Au tap → types
- Si le type cherché n'existe pas → "Suggérer une catégorie" (formulaire admin)

**État UX :** rassurant, "vous pourrez modifier plus tard"

#### Étape 2 — Informations de base

**Écran 2.1 — Titre & description**
- **Titre** (max 80 car.) : placeholder intelligent selon la catégorie
  - *Exemple pour "Chaise pliante"* : "Chaise pliante blanche - événement extérieur"
- **Description** (100-5000 car.) : éditeur riche basique (gras, listes, sauts de ligne)
- **Bullet points encouragés** : aide à la lisibilité
- **Compteur de qualité** : feedback temps réel
  - "🟡 Description un peu courte — ajoutez quelques détails sur l'usage et l'expérience"
  - "🟢 Description complète — bon travail !"

**Aide à la rédaction** : pour chaque type de service, suggestions de sections à couvrir. Ex pour un chapiteau :
- Dimensions (m²)
- Capacité (nombre de personnes assises / debout)
- Matériaux et qualité (toile, structure)
- Inclus dans la location (sangles, piquets, etc.)
- Non inclus (éclairage, chauffage…)
- Conditions de montage (terrain, accès véhicule)

#### Étape 3 — Photos

**Écran 3.1 — Upload**
- Drag & drop OU bouton classique
- Compression automatique côté client (avant upload)
- Min 3 photos, max 15
- Recommandation visuelle : "Première photo = vitrine. Choisissez la plus engageante."
- Photos type recommandées :
  1. Vue d'ensemble du produit
  2. Détail / qualité
  3. En contexte d'événement réel
  4. Variantes / options
- Réorganisation par drag & drop

**État UX critique :** ne **jamais** publier une fiche sans 3 photos minimum. Bloquer activement, expliquer pourquoi.

#### Étape 4 — Tarification

**Écran 4.1 — Choix du mode**

3 cards visuelles côte à côte :

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  À L'UNITÉ       │  │  AU FORFAIT       │  │  SUR DEVIS       │
│                  │  │                   │  │                  │
│  Prix × quantité │  │  Prix fixe        │  │  Prix négocié    │
│                  │  │                   │  │                  │
│  Idéal : chaises,│  │  Idéal : chapiteau│  │  Idéal : services│
│  vaisselle,      │  │  package,         │  │  variables,      │
│  matériel multiple│  │  prestation unique│  │  événements      │
│                  │  │                   │  │  complets        │
│  ☐ Je choisis    │  │  ☐ Je choisis    │  │  ☐ Je choisis    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Écran 4.2 — Détails selon le mode**

*Si "À l'unité"* :
- Prix unitaire HT/TTC (toggle selon statut TVA pro)
- Quantité minimum par réservation (ex : 20 chaises mini)
- Quantité maximum par réservation (ex : 200 chaises max)
- Affichage live : "Pour 50 unités → 250 € TTC"

*Si "Forfait"* :
- Prix forfaitaire
- Inclus / non inclus (champs structurés)

*Si "Sur devis"* :
- Pas de prix
- Fourchette indicative facultative (ex : "À partir de 800 €")
- Le client devra envoyer une demande de devis

**Écran 4.3 — Options (facultatif)**
- Ajouter des options : nom + prix delta + quantité max
- Cas d'usage typique :
  - Chapiteau 100 m² avec option *éclairage LED (+150 €)*, option *plancher (+8 €/m²)*
  - Sonorisation avec option *technicien sur place (+200 €)*
- Skipable, mais encouragé

#### Étape 5 — Livraison & zones

**Écran 5.1 — Zone de couverture**

3 modes de définition :
1. **Rayon autour de l'adresse pro** (le plus simple) : adresse + slider rayon en km
2. **Codes postaux** : multi-sélecteur visuel (carte cliquable + liste)
3. **Polygones libres** (V1) : tracé sur carte

Recommandation MVP : **modes 1 + 2** uniquement.

**Écran 5.2 — Frais de livraison**

Choix entre :
- **Livraison gratuite** (incluse dans le prix)
- **Forfait fixe** (ex : 60 € quel que soit le lieu dans la zone)
- **Au km** (ex : 1,50 €/km depuis adresse pro)
- **Sur devis** (calcul personnalisé après demande)

**Décision UX clé** : afficher *toujours* le prix de livraison estimé sur la fiche dès que le client a saisi son adresse. Pas de surprise au checkout.

#### Étape 6 — Disponibilités initiales

**Écran 6.1 — Setup rapide**

L'objectif : éviter de demander un calendrier complet le jour 1. Réglages par défaut :
- Disponible 7j/7
- Délai mini : 7 jours avant événement
- Stock illimité (peut être ajusté plus tard)

Le pro coche "Configurer plus en détail" → écran avancé (voir section D).

#### Étape 7 — Politiques

**Écran 7.1 — Annulation**

Choix entre 3 templates Tukio + custom :

| Template | < 7j | 7-15j | 15-30j | > 30j |
|----------|-------|-------|--------|-------|
| **Souple** | 50 % | 75 % | 100 % | 100 % |
| **Standard** (default) | 0 % | 25 % | 50 % | 100 % |
| **Stricte** | 0 % | 0 % | 25 % | 50 % |
| Custom | À définir par pro (V1) |

Le pro voit en clair l'impact pour le client. Affiché aussi sur la fiche service.

#### Étape 8 — Récap & publication

**Écran 8.1 — Prévisualisation**
- La fiche affichée comme la verra le client
- Score de qualité : "Votre fiche est complète à 85 % — ajoutez une vidéo pour atteindre 100 %"
- Bouton "Publier" OU "Sauvegarder en brouillon"

**Workflow post-publication** :
- Pro vérifié depuis > 30 jours et < 3 signalements → publication immédiate
- Sinon → file de modération admin (sous 24 h)
- Email de confirmation au pro
- Première fiche publiée → email de félicitations + tips pour les suivantes

### Workflow — édition d'une fiche existante

Plus simple, pas d'assistant guidé :
- Écran "Mes services" (liste avec stats : vues, conversions, dernière résa)
- Edit inline ou page complète
- **Versioning** : conserver les 5 dernières versions pour rollback admin si besoin
- Re-modération automatique si modifs > 30 % (heuristique : titre, prix, photos)

### États & transitions d'un service

```
draft (brouillon, jamais publié)
   ↓ Pro soumet pour publication
pending_review (modération admin)
   ↓ admin valide                     ↘ admin rejette (raison)
published                              rejected → retour draft
   ↓ pro modifie                       ↑ pro corrige et re-soumet
[re-modération si majeure]
   ↓ pro archive
archived (visible pour historique mais plus dispo à la résa)

Branches alternatives depuis published :
- unlisted (auto si pro suspendu — pas visible mais conservé)
- suspended (manuel admin sur signalement — plus modifiable par pro)
```

### Modération — règles auto vs humaine

**Auto-publication** (sans passer par modération humaine) si :
- Pro `verified` depuis > 30 jours
- < 3 signalements actifs sur ses services
- Modifs mineures (description, prix < ±20 %)

**File modération humaine** sinon :
- SLA : < 24 h
- Outils admin : voir avant/après, valider, rejeter avec raison structurée
- Modèles de raisons : "Photos non conformes", "Prix manifestement erroné", "Catégorie inadaptée", "Description insuffisante", "Contenu interdit"

---

## D. Disponibilités & inventaire

C'est techniquement le bloc le plus subtil du catalogue. Une mauvaise gestion = double-bookings = perte de confiance immédiate.

### Les 4 dimensions à gérer

Pour un service donné, la disponibilité dépend de :

1. **Inventaire absolu** : combien d'unités le pro possède au total ?
   - *Ex : Pro a 200 chaises. Quelles que soient les dates, il ne peut pas en louer 250.*
2. **Concurrence dans le temps** : combien de réservations en parallèle ?
   - *Ex : Un chapiteau ne peut être qu'à 1 endroit le même week-end.*
3. **Buffer de préparation** : délai entre 2 résas pour démontage/montage/nettoyage ?
   - *Ex : Entre une résa qui finit dimanche et une qui commence lundi → besoin d'1 jour buffer.*
4. **Blocages manuels** : congés, maintenance, événements perso ?
   - *Ex : Pro bloque toute la semaine du 15 août.*

### Modèle de données

```
ServiceAvailability
  ├── service_id
  ├── total_inventory           # ex: 200 (chaises)
  ├── max_concurrent_bookings   # ex: 1 (chapiteau unique) ou null (illimité)
  ├── preparation_buffer_days   # ex: 1
  ├── min_notice_days           # ex: 7 (résa à minimum 7 jours d'avance)
  ├── max_advance_days          # ex: 365 (pas de résa à + d'1 an)
  └── default_availability      # 'available' | 'unavailable'

AvailabilityException (overrides ponctuelles)
  ├── service_id
  ├── start_date, end_date
  ├── type ('blocked' | 'available' | 'partial')
  ├── available_quantity (si type = 'partial')
  └── reason (interne, pour le pro)

RecurringRule (V1)
  ├── service_id
  ├── pattern (ex : 'every_monday', 'first_weekend_of_month')
  ├── action ('block' | 'allow')
  └── valid_from, valid_until
```

### Calcul de disponibilité — algorithme

Pour répondre à "Le service X est-il disponible du 15 au 17 juin pour Y unités ?" :

```
1. Récupérer total_inventory du service
2. Lister toutes les bookings 'confirmed' OR 'pending_pro_acceptance' qui chevauchent
   les dates demandées (en tenant compte du preparation_buffer_days)
3. Calculer la somme des quantités déjà réservées sur la période
4. Si default_availability = 'unavailable', vérifier qu'il existe une exception 'available'
5. Vérifier qu'aucune exception 'blocked' ne couvre les dates
6. Retourner : (total_inventory - somme_reservée) >= Y ?
```

**Cas limite — services à `max_concurrent_bookings = 1`** (ex : chapiteau unique) :
- Plus simple : 1 résa active = pas de nouvelle résa possible
- Affichage côté client : calendrier avec dates barrées

### Interface pro — calendrier

**Écran principal — vue calendrier**
- Mensuel par défaut, switch hebdo / quotidien
- Code couleur :
  - 🟢 Disponible
  - 🟡 Partiellement réservé (avec quantité résiduelle)
  - 🔴 Complet
  - ⚫ Bloqué manuellement
  - 🔵 Réservation confirmée (cliquable → détail)
- Drag pour bloquer une plage
- Click sur jour → détail des résas / actions

**Workflow "bloquer une période"** (cas typique : congés)
1. Click "Bloquer dates"
2. Sélectionner plage
3. Raison (visible seulement par admin Tukio si litige)
4. Confirmation avec impact : "X demandes en attente sur cette période — elles seront refusées automatiquement"

### Lock pendant checkout (anti race conditions)

Voir aussi `tukio_booking_paiements_deepdive.md` D.1.

**Workflow :**
1. Client lance checkout → lock Redis sur (service_id, dates, quantité) pour 10 min
2. Si autre client tente la même dispo pendant ce lock → vérification + erreur "Cette disponibilité est en cours de réservation, réessayez dans quelques minutes"
3. Lock libéré : à la confirmation paiement OU au timeout 10 min
4. **Garantie** : à la création effective du booking, vérification finale dans une transaction DB. Si conflit → refund auto Stripe.

### Décisions à figer

- **Affichage du stock disponible côté client ?**
  - Recommandation : **non** au MVP (juste "disponible / non disponible"). Affichage en V1 *seulement si* le stock devient < 20 % ("Plus que 8 chaises sur cette période").
  - Pourquoi : afficher 200 chaises dispo sur une fiche peut sembler vide / industriel. À tester.
- **Pré-réservation tentative ("hold") sans paiement ?**
  - Pas au MVP. En V1 avec l'option 48 h (déjà spec'é dans booking).
- **Synchronisation calendrier externe (Google, iCal) ?**
  - V2. Très demandé par les pros qui ont déjà leurs outils.

---

## E. Recherche & découverte côté client

### Les parcours d'entrée

Un client arrive sur le catalogue par 3 voies :

| Voie | Fréquence (estimation) | Implications |
|------|------------------------|--------------|
| Recherche directe (homepage) | ~50 % | Optimiser la barre de recherche |
| Page catégorie / SEO | ~30 % | Pages catégorie soignées, contenu, SEO |
| Lien direct (partage, ads) | ~20 % | Fiches service autonomes (pas d'orphelins UX) |

### Barre de recherche — anatomie

**3 champs principaux** sur la homepage :

1. **Quoi ?** (catégorie ou mot-clé)
   - Autocomplétion intelligente : suggère catégories puis types puis services populaires
   - Si saisie hors taxonomie : recherche full-text dans titres/descriptions
2. **Où ?**
   - Auto-géoloc avec consentement (ville détectée pré-remplie)
   - Saisie libre avec autocomplétion (Mapbox / Google)
   - Sélection rayon : 10 / 25 / 50 / 100 km
3. **Quand ?**
   - Calendrier date début / date fin
   - Option "flexible" : "n'importe quel weekend de juin"
   - Pré-rempli sur "ce weekend" si pas saisi

**Soumission** → page résultats.

### Page résultats — structure

#### Filtres latéraux (gauche en desktop, drawer en mobile)

- **Prix** : slider min/max (ajusté à la distribution réelle de la cat)
- **Note minimum** : 3⭐ / 4⭐ / 4.5⭐
- **Distance** : 10 / 25 / 50 / 100 km
- **Disponibilité** : dates exactes (already filtered) ou "à partir de…"
- **Caractéristiques** (V1, par catégorie) :
  - Tentes : capacité (50, 100, 200, 500+ pers.) / extérieur / chauffé / etc.
  - Mobilier : type / matériau / style
- **Tags / styles** (V1) : champêtre, chic, moderne, etc.
- **Sous-catégories** (si on est sur une catégorie large)

#### Tris

- **Pertinence** (default — voir algo ci-dessous)
- **Prix croissant**
- **Prix décroissant**
- **Note décroissante**
- **Distance croissante**
- **Plus récents** (V1)

#### Cards de résultats

Chaque card affiche :
- Photo principale (carrousel au survol)
- Titre du service + nom du pro
- Note moyenne + nombre d'avis
- Prix (depuis / forfait / sur devis)
- Distance
- Badge éventuel ("Top Pro", "Nouveau", "Réponse rapide")
- Heart pour ajouter aux favoris

**État vide** :
- "Aucun résultat pour vos critères"
- Suggestions : élargir la zone, dates voisines, catégories proches
- CTA : "Laissez-nous votre email, on vous prévient dès qu'un pro publie"

### Algorithme de ranking — pertinence

C'est un sujet aussi important que la fiche elle-même : **un pro mal classé ne reçoit pas de leads, peu importe la qualité de sa fiche.**

#### Score = combinaison pondérée

```
score = w1 * pertinence_textuelle      // match catégorie/mots-clés
      + w2 * proximité_géographique     // 1 / log(distance + 1)
      + w3 * note_pro                   // (rating - 3) / 2 (centré)
      + w4 * volume_avis                // log(nb_avis + 1) / log(50)
      + w5 * complétude_fiche          // 0 à 1
      + w6 * taux_réponse_pro          // % de demandes auxquelles le pro a répondu
      + w7 * délai_réponse              // 1 / log(heures + 1)
      + w8 * conversion_historique     // taux de transformation vue → résa
      + w9 * tier_subscription         // boost Business : +0.05, Enterprise : +0.10
      + w10 * boost_actif              // Business utilise un "boost" : +0.20 sur 7j
      + w11 * fraîcheur                // léger boost pour les nouveaux pros (cold start)
      + petite_aléa                    // pour rotation et fairness
```

**Pondérations indicatives à valider après tests :**
- w1 (pertinence) : 25 %
- w2 (distance) : 20 %
- w3 (note) : 10 %
- w4 (volume) : 5 %
- w5 (complétude) : 8 %
- w6 (taux réponse) : 10 %
- w7 (délai réponse) : 5 %
- w8 (conversion) : 7 %
- w9 (tier) : 3 %
- w10 (boost) : variable (impulsion temporaire)
- w11 (fraîcheur) : 5 %
- aléa : 2 %

**Principes éthiques à respecter :**
- **Transparence** : afficher pourquoi un résultat est mis en avant ("Résultat sponsorisé" / "Mis en avant par le boost du pro")
- **Pas de pay-to-rank pur** : le tier d'abonnement donne un *coup de pouce*, pas une domination. Un pro Starter avec 50 avis 4.9 doit pouvoir battre un pro Business avec 5 avis 3.8.
- **Cold start** : un nouveau pro doit recevoir des leads *quelque part* dans les 50 premiers résultats même sans historique. Sinon impossible d'amorcer.

#### Implémentation pragmatique

- **MVP** : SQL simple avec filtres + tri sur 1-2 dimensions (pertinence textuelle Postgres FTS + distance). Pondérations en dur dans le code.
- **V1** : moteur dédié (Meilisearch / Typesense / Algolia). Score calculé côté moteur. Pondérations configurables via admin UI.
- **V2** : modèle ML léger (apprentissage sur clics et conversions).

### SEO & pages catégories

#### Pages à créer (dès le MVP)

- `/categorie/{slug}` : ex `/categorie/location-tentes-chapiteaux`
- `/categorie/{slug}/{ville}` : ex `/categorie/location-tentes-chapiteaux/nantes` (V1, programmatique)
- `/service/{slug}` : ex `/service/chapiteau-100m2-blanc-chic`
- `/pro/{slug}` : ex `/pro/event-co-nantes`

Chaque page doit avoir :
- Title et meta description optimisés (template par type)
- H1 unique
- Contenu de cat/sous-cat (texte SEO 200-400 mots, à rédiger pour les principales)
- Données structurées Schema.org (`Product`, `LocalBusiness`, `Service`, `Review`)
- Sitemap XML auto-généré
- Pages indexables, pas de `noindex`

#### Pages programmatiques (V1)

Génération auto pour combinaisons (catégorie × ville × top pros / services). Attention au duplicate content : varier le contenu par ville (témoignages locaux, données INSEE pop, événements régionaux).

**Cible MVP** : 50 pages SEO bien soignées plutôt que 5000 médiocres.

---

## F. Photos & médias

### Règles de qualité

- **Minimum 3 photos** par service publié (bloquant)
- **Maximum 15 photos** (pour ne pas alourdir)
- **Résolution mini** : 1200 × 800 px (pour qualité web et mobile)
- **Formats acceptés** : JPG, PNG, HEIC (iPhone), WebP
- **Poids max upload** : 10 Mo par photo
- **Compression auto** post-upload (côté serveur) :
  - 3 tailles générées : thumbnail (400 px), medium (1200 px), large (2400 px)
  - Format de sortie : WebP avec fallback JPG
  - CDN distribution (Cloudflare R2 + Cloudflare Image)

### Règles de contenu

❌ Interdit :
- Logos / filigranes d'autres marques
- Numéros de téléphone, emails, URL visibles sur photo (anti-désintermédiation)
- Photos manifestement issues de banques d'images stock (Shutterstock etc.)
- Contenu sexuellement suggestif, violent
- Photos de personnes identifiables sans consentement (RGPD)

✅ Recommandé :
- Photos en situation réelle d'événement (avec accord client)
- Détails de qualité (matériaux, finitions)
- Variantes (couleurs, tailles)

### Modération photos

**Au MVP** : modération humaine systématique pour les pros non-`verified` ou première fiche.

**En V1** : ajout d'une couche auto :
- OCR pour détecter logos / textes sur images (anti-désintermédiation)
- Détection NSFW basique (Cloudflare AI ou equivalent)
- Reverse image search pour détecter photos volées (V2)

### Vidéos (V1)

- Format : YouTube / Vimeo embed (pas d'upload direct au début → trop coûteux infra)
- 1 vidéo max par service
- Durée recommandée : 30-90 secondes
- Affichage : vignette dans le carrousel photos, lecture inline modale

### Photos de couverture pro vs photos de service

À distinguer clairement :
- **Photos de profil pro** : visage / logo + bannière
- **Photos de service** : le produit / la prestation lui-même

Un pro a 1 profil mais N services, donc N galeries séparées.

---

## G. Edge cases

### G.1 Pro change radicalement sa fiche après 50 vues

**Scénario** : Service "Chapiteau 100 m²" → pro le transforme en "Chapiteau 50 m² + bar mobile".

**Impact** : URL et SEO existants pointent vers contenu différent.

**Solution** :
- Si modifs structurelles (catégorie, type, prix > 50 % d'écart, > 50 % du texte modifié) → re-modération obligatoire
- Conservation du slug original (URL stable)
- Versionning interne (admin peut comparer les versions)

### G.2 Service hors zone de livraison réservé par erreur

**Scénario** : Client à Bordeaux trouve un pro de Nantes (filtre cassé ou bug) → réserve.

**Solutions** :
- Vérification serveur du code postal *avant* validation paiement
- Si hors zone : erreur claire "Ce pro ne livre pas à votre adresse"
- Cas où le pro accepte quand même hors zone → coup de pouce livraison négocié en messagerie

### G.3 Stock partagé entre plusieurs services du même pro

**Scénario** : Pro a 100 chaises. Il publie 3 fiches : "Chaise blanche pliante", "Chaise noire pliante", "Chaise design lounge". Le stock est partagé physiquement (sa réserve) mais déclaré sur 3 fiches.

**Solution V1 — "Inventaire partagé"** :
- Concept de "lot d'inventaire" parent (ex : "Stock chaises pliantes" = 100 unités)
- Plusieurs fiches consomment du même lot
- Calcul de dispo prend en compte les résas sur tous les services du lot

**Au MVP** : pas géré, le pro doit déclarer un sous-stock par fiche (50 + 50 par exemple) et accepter des sur-réservations potentielles. Communication claire à l'onboarding.

### G.4 Pro avec service "sur devis" qui ne répond jamais

**Scénario** : Service "sur devis" attractif, pro reçoit demandes mais ignore.

**Conséquences** : frustration client, mauvaise image plateforme.

**Solutions** :
- Stat publique sur la fiche : "Répond généralement en X heures"
- Si taux de réponse < 50 % sur 30 jours → fiche basculée en mode "averti" (badge moins visible)
- Si taux < 30 % → service auto-`unlisted` jusqu'à ce que le pro réagisse
- Dashboard pro : alerte rouge si demandes en attente > 24 h

### G.5 Plusieurs pros ont des services quasi-identiques

**Scénario** : 3 pros à Nantes proposent "Chaise pliante blanche" à 5 €. Comment différencier ?

**Solutions UX** :
- Mise en avant : note, nombre d'avis, distance, taux de réponse
- Photos de qualité différentes (le pro qui investit dans des belles photos gagne)
- Note réciproque (pro → client) : encourage les pros à se positionner
- L'algo de ranking gère le tri (cf. section E)

### G.6 Prix volontairement abusif (dumping ou surfacturation)

**Scénario** : Un pro publie "Chaise pliante" à 0,50 €/unité (dumping) ou 50 €/unité (surfacturation).

**Solution** :
- Au moment de la publication : check de la médiane catégorie/sous-catégorie
- Si écart > ±50 % → flag pour modération (pas blocage)
- Modérateur évalue : erreur de saisie ? Démarche commerciale agressive ? Tentative de manipulation ?
- Possibilité de fenêtre de prix recommandée affichée au pro lors de la création : "La plupart des pros similaires affichent entre X et Y €/unité"

### G.7 Fiche dupliquée par un pro malveillant

**Scénario** : Pro recopie mot pour mot la fiche d'un concurrent, photos volées.

**Détection** :
- Hash perceptuel des photos (pHash) → détecte les doublons même légèrement modifiés
- Similarité textuelle (cosine similarity sur descriptions) → flag si > 85 %

**Action** :
- Modération + contact aux deux parties
- Si confirmé vol → suspension du pro fautif

---

## H. Décisions à valider

| # | Décision | Reco par défaut | Impact |
|---|----------|-----------------|--------|
| C-01 | Catégories au MVP : 1 ou 2 ? | 2 (tentes + mobilier) | Vivacité du test marché |
| C-02 | Multi-catégorisation autorisée ? | Non | Cohérence SEO et search |
| C-03 | Tags secondaires libres ou liste fermée ? | Liste fermée admin (~30 tags) | Lutte contre le spam |
| C-04 | Le pro peut suggérer une nouvelle catégorie ? | Oui, formulaire vers admin | Croissance naturelle taxonomie |
| C-05 | Photos minimum par fiche ? | 3 (bloquant) | Qualité catalogue |
| C-06 | Vidéo accessible au MVP ? | Non, V1 | Complexité infra |
| C-07 | Pricing mode "à l'unité" obligatoire min/max ? | Oui (min) — max optionnel | Évite les commandes irréalistes |
| C-08 | Affichage du stock disponible côté client ? | Non au MVP, V1 si stock < 20 % | À tester |
| C-09 | Définition zone livraison : rayon, codes postaux, ou les deux ? | Les deux dès MVP | Souplesse pro |
| C-10 | Frais livraison "au km" : à partir de quelle adresse ? | Adresse du pro (déclarative) | Simplicité |
| C-11 | Nombre de photos maximum ? | 15 | UX (chargement) |
| C-12 | Politique d'annulation : 3 templates ou personnalisable ? | 3 templates au MVP, custom V1 | Cohérence client |
| C-13 | Auto-publication seuils : 30 jours / 3 signalements ? | Validés | Équilibre qualité / vélocité |
| C-14 | Modération pré-publication systématique en V1+ ? | Non (a posteriori avec algos) | Évite statut éditeur LCEN |
| C-15 | Nb de pages SEO programmatiques au lancement ? | 50-100 (manuelles) | Qualité > quantité |
| C-16 | Synchronisation calendrier externe (iCal) ? | V2 | Coût/bénéfice à confirmer |
| C-17 | Inventaire partagé entre fiches d'un même pro ? | V1 (au MVP : sous-stocks déclaratifs) | Fonctionnalité demandée |
| C-18 | Note minimum pour rester en page 1 résultats ? | Pas de seuil dur, l'algo gère | Évite l'exclusion brutale |

---

## Annexes

### Score de qualité d'une fiche (proposition)

Heuristique pour l'indicateur "complétude" affiché au pro :

| Critère | Points |
|---------|--------|
| Titre > 30 caractères | 5 |
| Description > 300 caractères | 10 |
| Description > 800 caractères | +5 |
| ≥ 3 photos | 15 |
| ≥ 6 photos | +10 |
| Au moins 1 photo en situation | +5 |
| Vidéo (V1) | +10 |
| Au moins 1 option configurée | 10 |
| Politique d'annulation choisie | 5 |
| Zone de livraison définie (pas par défaut) | 10 |
| Tags renseignés | 5 |
| Note moyenne ≥ 4 (V1) | 10 |
| **Total** | **100** |

Affichage : barre de progression + "Boostez votre fiche : ajoutez X pour atteindre Y%"

### Catégories MVP — fiche-type

**Exemple complet — "Chapiteau 100 m² blanc chic"**

```yaml
title: "Chapiteau 100 m² blanc chic - capacité 80-100 invités"
category: location_materiel
subcategory: tentes_chapiteaux
type: chapiteau_reception
description: |
  Chapiteau de réception en toile blanche de 10 × 10 m (100 m²),
  idéal pour mariages, séminaires d'entreprise ou anniversaires
  jusqu'à 100 invités assis.

  ✓ Toile traitée déperlante et anti-UV
  ✓ Hauteur sous faîtage : 4,5 m
  ✓ Pose en 4 h sur terrain plat
  ✓ Sangles, piquets et lestages inclus
  ✓ Plan d'implantation fourni

  Non inclus :
  - Éclairage (option +150 €)
  - Plancher (option +8 €/m²)
  - Chauffage (option +200 € si < 15°C)

  Conditions :
  - Accès véhicule à moins de 30 m du lieu de pose
  - Terrain plat, herbe ou stabilisé
  - Hauteur libre min : 5 m
pricing_mode: forfait
forfait_price: 1200
options:
  - label: "Éclairage LED guirlandes"
    price: 150
    is_required: false
  - label: "Plancher (par m²)"
    price: 8
    is_required: false
    max_quantity: 100
  - label: "Chauffage (à partir de < 15°C)"
    price: 200
    is_required: false
delivery_zones:
  - postal_codes: ["44000", "44100", "44200", "44300", "44400", "44600", "44700"]
delivery_fee_mode: per_km
delivery_fee_value: 1.5  # €/km
photos:
  - cover.jpg
  - detail_toile.jpg
  - en_situation_mariage.jpg
  - vue_interieur.jpg
  - vue_nocturne.jpg
lead_time_days: 14
inventory:
  total_inventory: 2
  max_concurrent_bookings: 2
  preparation_buffer_days: 1
policies:
  cancellation: standard
```

---

*Fin du deep dive Catalogue — version 1, à itérer après validation des 18 décisions.*
