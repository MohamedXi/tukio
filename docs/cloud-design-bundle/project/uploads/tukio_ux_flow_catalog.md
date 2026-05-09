# Tukio — UX Flow: Catalogue (Doc 2)

> Détail écran par écran du domaine catalogue (création/gestion services côté pro + découverte/décision côté customer)
> À lire après : `tukio_spec_v2.md` + `tukio_catalogue_deepdive.md` + `tukio_design_brief.md` + `tukio_information_architecture.md`
> Audience : designer (premier lecteur), produit, dev frontend

---

## Sommaire

- [A. Périmètre du document](#a-périmètre-du-document)
- [B. Pro side — service management](#b-pro-side--service-management)
- [C. Customer side — discovery & decision](#c-customer-side--discovery--decision)
- [D. Cross-cutting states](#d-cross-cutting-states)
- [E. Transitions map](#e-transitions-map)
- [F. Open design questions](#f-open-design-questions)

---

## A. Périmètre du document

### Ce que ce doc couvre

| Côté | Écrans | Cible |
|------|--------|-------|
| **Pro** | Service list, creation wizard (10 steps), preview, edit | MVP |
| **Customer** | Homepage, category page, search results, service detail, public pro profile | MVP |
| **Cross-cutting** | Empty / loading / error states | MVP |

### Ce que ce doc ne couvre PAS

- **Onboarding pro** (cf. Doc 3 à venir, traité avec Booking flows ou comptes)
- **Calendrier de dispo détaillé** (sera dans le doc Booking)
- **Avis** sur fiche service / profil pro (zone listée, mais le flow détaillé est dans le doc Avis)
- **Messagerie / contact pro** (doc Messagerie à venir)

### Conventions du doc

**Wireframes** : ASCII textuels, juste pour figer la **structure** et la **hiérarchie**. Le designer décide du visuel final dans Figma à partir du design brief.

**Notation** :
- `[Bouton]` = CTA cliquable
- `( ) ( ) ( )` = radio / steps
- `[ ]` = checkbox
- `▾` = dropdown
- `🔍` = icône (référence Lucide)
- `…` = troncature ou contenu variable
- `→` = transition vers un autre écran

**Tags par écran** :
- `MVP` : à concevoir et développer pour le lancement
- `V1` / `V2` : différé

---

## B. Pro side — service management

### B.0 Vue d'ensemble du flow

```
/seller/services (list)
    │
    ├── [+ Nouveau service]
    │   └── /seller/services/new (wizard 10 steps)
    │       └── Step 10 → /seller/services/{id} (preview)
    │           ├── [Modifier] → /seller/services/{id}/edit
    │           ├── [Archiver]
    │           └── [Mode preview client] → ouverture nouvelle fenêtre /service/{slug}
    │
    ├── Click sur card service → /seller/services/{id}
    └── Filtres / recherche dans la liste
```

---

### B.1 — Services list `MVP`

**URL** : `/seller/services`

**Source domaine** : 2.2 Catalogue

**Objectif** : permettre au pro de gérer son catalogue (vue d'ensemble, statuts, performance), et de créer un nouveau service.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Top bar pro]  Tableau de bord  Services✓  Réservations  Messages   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Mes services                       [Filtres ▾]    [+ Nouveau service] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🔍 Rechercher dans mes services…                            │   │
│  │  Filtres actifs : Statut: tous │ Catégorie: tous   [Reset]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │ [Photo]      │  │ [Photo]      │  │ [Photo]      │  │ [Photo]  ││
│  │              │  │              │  │              │  │          ││
│  │ Chapiteau    │  │ Chaises      │  │ Mange-debout │  │ Tente    ││
│  │ 100 m²       │  │ pliantes     │  │ chic         │  │ pliable  ││
│  │              │  │              │  │              │  │          ││
│  │ • Publié     │  │ • Brouillon  │  │ • Modération │  │ • Publié ││
│  │ 1 200 €      │  │ 5 €/u        │  │ 80 €/u       │  │ 280 €    ││
│  │ ★ 4.7 (12)   │  │ —            │  │ —            │  │ ★ 4.9 (3)││
│  │ 👁 142 vues  │  │ —            │  │ —            │  │ 👁 87    ││
│  │ 🛒 8 résa    │  │ —            │  │ —            │  │ 🛒 2     ││
│  │              │  │              │  │              │  │          ││
│  │ [···] menu   │  │ [···] menu   │  │ [···] menu   │  │ [···]    ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│
│                                                                     │
│  + Pagination si > 12 services                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Zones de contenu

1. **Header de page** : titre "Mes services" + bouton primary "+ Nouveau service" (toujours visible)
2. **Barre de recherche & filtres** : recherche texte (titre service) + filtres (statut, catégorie, période)
3. **Grille de cards** : 3-4 cards par rangée en desktop, 2 en tablet, 1 en mobile
4. **Card service** : photo + titre + statut badge + prix + note + stats (vues / réservations) + menu actions
5. **Pagination ou infinite scroll** au-delà de N services

#### Statut badges (par service)

| Status enum | Label UI | Couleur badge |
|-------------|----------|---------------|
| `draft` | "Brouillon" | charcoal-400 |
| `pending_review` | "En modération" | warning-500 |
| `published` | "Publié" | success-500 |
| `rejected` | "Rejeté" | error-500 |
| `unlisted` | "Non listé" | charcoal-500 |
| `suspended` | "Suspendu" | error-700 |
| `archived` | "Archivé" | charcoal-300 |

#### Card menu actions

Click sur `[···]` ouvre un dropdown :
- "Voir l'aperçu client" → ouvre `/service/{slug}` dans nouvel onglet
- "Modifier" → `/seller/services/{id}/edit`
- "Dupliquer" *(V1)*
- "Archiver" *(seulement si `published`)*
- "Voir les statistiques" *(V1)*
- "Supprimer" *(seulement si `draft`)*

#### CTAs

- **Primary** (top right) : `[+ Nouveau service]` → `/seller/services/new`
- **Card click** (zone photo + titre) : → `/seller/services/{id}`

#### États

- **Default** : grille de services
- **Empty** (premier login post-onboarding) :
  - Illustration + titre "Vous n'avez pas encore publié de service"
  - Texte "Créez votre premier service pour commencer à recevoir des demandes."
  - CTA primary `[Créer mon premier service]`
- **Empty after filter** : "Aucun service ne correspond à vos filtres" + bouton `[Réinitialiser]`
- **Loading** : 8 skeleton cards
- **Error** : message + bouton `[Réessayer]`

#### Notes design

- La card est l'élément le plus important — elle doit communiquer status et performance en un coup d'œil
- Les stats (vues, résa) sont **clés** pour motiver le pro à optimiser ses fiches → mise en avant
- Sur mobile : vue liste plutôt que grille (1 colonne avec photo plus petite, infos compactées)

---

### B.2 — Service creation wizard `MVP`

**URL base** : `/seller/services/new`

**Source domaine** : 2.2 Catalogue (cf. deep dive section C)

**Objectif** : guider le pro à travers la création d'un service de qualité dès la première fiche, sans le décourager.

**Approche** : wizard en 10 étapes, sauvegarde de brouillon à chaque étape, navigation libre une fois passée par les étapes initiales.

#### Layout commun à toutes les étapes

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Top bar pro]                                          [Avatar ▾]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ← Retour aux services      Étape 4 sur 10                         │
│                                                                     │
│  ●—●—●—●—○—○—○—○—○—○                                              │
│  Cat. Titre Photos Prix Options Liv. Dispo Polit. Récap.            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  Titre de l'étape                                           │   │
│  │  Sous-titre / contexte                                      │   │
│  │                                                             │   │
│  │  [Contenu de l'étape — formulaire spécifique]               │   │
│  │                                                             │   │
│  │                                                             │   │
│  │                                                             │   │
│  │  [Aide contextuelle]                                        │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Sauvegarder en brouillon]              [← Retour]  [Continuer →]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Step indicator

- 10 dots cliquables (une fois l'étape déjà visitée)
- Dot rempli = complété, dot bordure = en cours, dot vide = non visité
- Labels courts sous chaque dot (visible desktop, caché mobile)

#### Step 1 — Category selection

**URL** : `/seller/services/new?step=category`

**Objectif** : orienter le pro vers la bonne taxonomie dès le début (impacte tous les champs suivants).

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Que voulez-vous proposer ?                                 │
│  Choisissez la catégorie qui correspond le mieux à votre    │
│  service. Vous pourrez la modifier plus tard.               │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  📦          │  │  🎉          │                        │
│  │              │  │              │                        │
│  │ Location     │  │ Services     │                        │
│  │ de matériel  │  │ événementiels│                        │
│  │              │  │              │                        │
│  │ Tentes,      │  │ Animation,   │                        │
│  │ mobilier,    │  │ traiteur,    │                        │
│  │ sono…        │  │ logistique…  │                        │
│  │              │  │              │                        │
│  │ ( )          │  │ ( )          │                        │
│  └──────────────┘  └──────────────┘                        │
│                                                             │
│  Une fois sélectionné, choisissez la sous-catégorie :       │
│                                                             │
│  ▾ Choisir une sous-catégorie…                             │
│                                                             │
│  Puis le type précis :                                      │
│                                                             │
│  ▾ Choisir un type…                                         │
│                                                             │
│  Vous ne trouvez pas votre catégorie ?                      │
│  → [Suggérer une catégorie]                                 │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- Sélection en cascade : catégorie → sous-catégorie → type
- Les sous-catégories n'apparaissent qu'après sélection catégorie
- Le type n'apparaît qu'après sélection sous-catégorie
- Suggestion catégorie : ouvre une modale avec formulaire "Décrivez votre service" → email envoyé à l'admin

##### Validation

- Catégorie + sous-catégorie + type tous obligatoires
- Bouton `[Continuer →]` désactivé tant que les 3 ne sont pas remplis

##### Edge case MVP

Au MVP, seules **2 catégories** sont disponibles : *Location de matériel* (avec sous-catégories *Tentes/chapiteaux* et *Mobilier événementiel*). Les autres seront grisées avec mention "Bientôt disponible".

---

#### Step 2 — Title & description

**URL** : `/seller/services/new?step=info`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Décrivez votre service                                     │
│                                                             │
│  Titre de l'annonce *                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Chapiteau 100 m² blanc chic - capacité 80-100…      │   │
│  └─────────────────────────────────────────────────────┘   │
│  72 / 80 caractères   🟢 Bon titre, descriptif et clair    │
│                                                             │
│  Description complète *                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [B] [I] [•] [≡]                                    │   │
│  │                                                     │   │
│  │  Chapiteau de réception en toile blanche…           │   │
│  │                                                     │   │
│  │  ✓ Toile traitée déperlante et anti-UV              │   │
│  │  ✓ Hauteur sous faîtage : 4,5 m                     │   │
│  │  ✓ Pose en 4 h sur terrain plat                     │   │
│  │                                                     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  847 / 5000 caractères  🟡 Description un peu courte —      │
│  ajoutez les conditions de montage et ce qui n'est pas      │
│  inclus pour rassurer le client.                            │
│                                                             │
│  💡 Astuce : pour ce type de service, pensez à mentionner : │
│  • Dimensions et capacité                                   │
│  • Matériaux et qualité                                     │
│  • Ce qui est inclus / non inclus                           │
│  • Conditions de montage (terrain, accès)                   │
│                                                             │
│  Tags (V1) *                                                │
│  [+ Champêtre] [+ Chic] [+ Moderne] …                      │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- **Compteur titre** : feedback temps réel (vert ≥ 30 car., orange < 30, rouge si > 80)
- **Compteur description** : qualité progressive (rouge < 100, orange 100-300, jaune 300-800, vert ≥ 800)
- **Astuce contextuelle** : varie selon le type sélectionné en step 1 (chapiteau ≠ chaises ≠ traiteur)
- **Éditeur riche basique** : gras, italique, listes à puces, paragraphes. Pas de couleurs / fonts custom.
- **Tags** : V1, masqué au MVP

##### Validation

- Titre : min 10 caractères, max 80
- Description : min 100 caractères, max 5000
- Pas de placeholder ipsum accepté

---

#### Step 3 — Photos

**URL** : `/seller/services/new?step=photos`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Photos de votre service                                    │
│                                                             │
│  Min 3 photos · Max 15 · La 1ʳᵉ photo sera votre vitrine    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │       📷  Glissez vos photos ici                     │  │
│  │           ou [Parcourir vos fichiers]                │  │
│  │                                                      │  │
│  │       JPG, PNG, HEIC · 10 Mo max par photo           │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Vos photos (4/15) — glissez pour réorganiser              │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ ⭐       │  │          │  │          │  │          │    │
│  │ [photo]  │  │ [photo]  │  │ [photo]  │  │ [photo]  │    │
│  │ Vitrine  │  │ ★ Princ. │  │ ★ Princ. │  │ ★ Princ. │    │
│  │ [×]      │  │ [×]      │  │ [×]      │  │ [×]      │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                             │
│  💡 Conseils pour de belles photos :                        │
│  1. Vue d'ensemble du produit en lumière naturelle          │
│  2. Détail de la qualité (matériaux, finitions)             │
│  3. En contexte d'événement réel                            │
│  4. Variantes (couleurs, tailles)                           │
│                                                             │
│  [Voir des exemples →]                                      │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- **Drag & drop** zone principale + bouton "Parcourir"
- **Compression côté client** avant upload (resize à 2400px max, qualité 85)
- **Réorganisation drag & drop** des photos uploadées
- **Photo vitrine** = 1ʳᵉ photo (badge ⭐ "Vitrine")
- **Click "Voir des exemples"** : modale avec bons / mauvais exemples par catégorie

##### Validation

- Bloque le passage à l'étape 4 si < 3 photos
- Refus upload si < 1200×800 px (avertissement clair)
- Refus si format non supporté (toast erreur)

##### États

- **Loading upload** : barre de progression par photo + état "En cours… 67 %"
- **Error upload** : toast avec raison ("Photo trop petite", "Format non supporté", "Trop lourde", "Erreur réseau")
- **Empty** : zone drag & drop seule
- **Maximum atteint** : "15 photos atteintes — supprimez-en pour en ajouter d'autres"

---

#### Step 4 — Pricing mode

**URL** : `/seller/services/new?step=pricing-mode`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Comment souhaitez-vous tarifer ?                           │
│  Choisissez le mode qui correspond à votre service.         │
│  Vous pourrez ajuster le détail à l'étape suivante.         │
│                                                             │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │ ( )            │ │ ( )            │ │ ( )            │  │
│  │                │ │                │ │                │  │
│  │  À L'UNITÉ     │ │  AU FORFAIT    │ │  SUR DEVIS     │  │
│  │                │ │                │ │                │  │
│  │  Prix × qté    │ │  Prix fixe     │ │  Prix négocié  │  │
│  │                │ │                │ │                │  │
│  │  Ex : chaises  │ │  Ex : chapiteau│ │  Ex : services │  │
│  │  vaisselle…    │ │  package…      │ │  variables     │  │
│  │                │ │                │ │                │  │
│  │  Bon pour      │ │  Bon pour      │ │  Bon pour      │  │
│  │  matériel      │ │  prestations   │ │  événements    │  │
│  │  multi-unités  │ │  uniques       │ │  complexes     │  │
│  └────────────────┘ └────────────────┘ └────────────────┘  │
│                                                             │
│  💡 Dans le doute, vous pouvez modifier ce choix plus tard. │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- 3 cards radio button (sélection unique)
- Sélection met en surbrillance la card (border brand-500 + light bg)
- Hover : légère élévation

##### Validation

- Sélection obligatoire avant de continuer

##### Edge case MVP

Mode "Sur devis" disponible mais le flow de devis n'est pas dans le MVP côté customer. Le pro peut publier mais le customer aura un CTA "Demander un devis" qui sera désactivé en MVP avec message "Bientôt disponible". À discuter : autoriser ou pas le mode sur devis au MVP ?

> **Recommandation** : retirer le mode "Sur devis" du MVP pour éviter incohérence UX. Le réintroduire avec le flow devis en V1.

---

#### Step 5 — Pricing details

**URL** : `/seller/services/new?step=pricing`

##### Layout — variant "À l'unité"

```
┌─────────────────────────────────────────────────────────────┐
│  Tarif unitaire                                             │
│                                                             │
│  Prix par unité (TTC) *                                     │
│  ┌────────────────┐                                         │
│  │ 5,00       € │                                           │
│  └────────────────┘                                         │
│                                                             │
│  Quantité minimum par réservation *                         │
│  ┌────────────────┐                                         │
│  │     20         │  unités                                 │
│  └────────────────┘                                         │
│                                                             │
│  Quantité maximum (optionnel)                               │
│  ┌────────────────┐                                         │
│  │     200        │  unités                                 │
│  └────────────────┘                                         │
│                                                             │
│  Aperçu du calcul :                                         │
│  Pour 50 unités → 250,00 € TTC                              │
│  Pour 100 unités → 500,00 € TTC                             │
│                                                             │
│  💡 Le prix médian pour ce type de service en               │
│  Loire-Atlantique est de 4,50 €/u (basé sur 23 services).   │
└─────────────────────────────────────────────────────────────┘
```

##### Layout — variant "Forfait"

```
┌─────────────────────────────────────────────────────────────┐
│  Tarif forfaitaire                                          │
│                                                             │
│  Prix forfaitaire (TTC) *                                   │
│  ┌────────────────┐                                         │
│  │ 1 200,00     € │                                         │
│  └────────────────┘                                         │
│                                                             │
│  Ce qui est inclus dans ce prix *                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Toile et structure complète                       │   │
│  │ • Sangles, piquets et lestages                      │   │
│  │ • Plan d'implantation fourni                        │   │
│  │ + Ajouter une ligne                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Ce qui n'est PAS inclus                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Éclairage (proposé en option)                     │   │
│  │ • Plancher (proposé en option)                      │   │
│  │ + Ajouter une ligne                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- Champs prix : auto-format avec espaces et virgule (5 000,00 €)
- Toggle HT/TTC selon statut TVA pro (V1) — au MVP : TTC seulement
- Aperçu calcul (mode unité) : mis à jour en temps réel
- Affichage prix médian : si > 5 services dans la sous-catégorie/zone, sinon caché

##### Validation

- Prix > 0
- Quantité min ≥ 1 (mode unité)
- Si prix s'écarte de ±50 % de la médiane : avertissement (pas blocage) "Votre prix est X % plus élevé/bas que la médiane. Êtes-vous sûr ?"

---

#### Step 6 — Options

**URL** : `/seller/services/new?step=options`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Options (facultatif)                                       │
│  Proposez des add-ons pour augmenter votre panier moyen.    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Option 1                                  [×]      │   │
│  │  Nom *                                              │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ Éclairage LED guirlandes                   │    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  │  Prix supplémentaire (TTC) *                       │   │
│  │  ┌────────────┐                                    │   │
│  │  │ 150,00   € │                                    │   │
│  │  └────────────┘                                    │   │
│  │  Quantité maximum                                  │   │
│  │  ┌────────────┐ ( ) Sans limite                    │   │
│  │  │      1     │                                    │   │
│  │  └────────────┘                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  + Ajouter une option                                       │
│                                                             │
│  [Passer cette étape]                                       │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- Bloc déplaçable / supprimable par option
- Bouton "Passer cette étape" si pas d'option
- Pas de limite de nombre d'options au MVP (à monitorer)

##### Validation

- Si une option est commencée : nom + prix obligatoires
- Sinon, étape skippable

---

#### Step 7 — Delivery zones

**URL** : `/seller/services/new?step=delivery`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Zone de livraison                                          │
│                                                             │
│  Comment définir votre zone ?                               │
│  ( ) Par rayon autour d'une adresse                         │
│  (•) Par codes postaux                                      │
│                                                             │
│  Variant rayon :                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Adresse de départ *                                 │   │
│  │ ┌────────────────────────────────────────────────┐ │   │
│  │ │ 12 rue des Lilas, 44000 Nantes                 │ │   │
│  │ └────────────────────────────────────────────────┘ │   │
│  │                                                     │   │
│  │ Rayon maximum                                       │   │
│  │ ────●─────────── 50 km                             │   │
│  │ 5 km    25 km    50 km    100 km                   │   │
│  │                                                     │   │
│  │ ┌──────────────────────────────────────────────┐  │   │
│  │ │ [Carte avec cercle de zone]                  │  │   │
│  │ └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Frais de livraison                                         │
│  ( ) Livraison gratuite (incluse dans le prix)              │
│  (•) Forfait fixe                                           │
│  ( ) Au km                                                  │
│  ( ) Sur devis                                              │
│                                                             │
│  Forfait : 60,00 € TTC                                      │
│                                                             │
│  💡 Les frais de livraison s'ajoutent au prix du service    │
│  et seront affichés au client dès qu'il aura saisi son      │
│  adresse événement.                                         │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- Switch entre 2 modes de définition de zone (toggle)
- **Variant rayon** : autocomplete adresse (Mapbox / Google) + slider rayon, prévisualisation carte
- **Variant codes postaux** : champs multi-select avec autocomplete sur villes / codes postaux, ou polygones cliquables (V1)
- Mode frais : 4 options en radio buttons, champ contextuel selon choix

##### Validation

- Adresse de départ obligatoire (mode rayon)
- Au moins 1 code postal (mode CP)
- Si "Forfait" : montant > 0
- Si "Au km" : tarif > 0

---

#### Step 8 — Initial availability

**URL** : `/seller/services/new?step=availability`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Disponibilités initiales                                   │
│  Configuration rapide. Vous pourrez ajuster en détail       │
│  depuis votre calendrier après publication.                 │
│                                                             │
│  Inventaire total (combien d'unités possédez-vous ?)        │
│  ┌────────────────┐                                         │
│  │      200       │  unités                                 │
│  └────────────────┘                                         │
│                                                             │
│  Délai minimum avant événement *                            │
│  ┌────────────────┐                                         │
│  │      7         │  jours                                  │
│  └────────────────┘                                         │
│  Le client ne pourra pas réserver moins de X jours avant.   │
│                                                             │
│  Délai entre 2 réservations (buffer)                        │
│  ┌────────────────┐                                         │
│  │      1         │  jour                                   │
│  └────────────────┘                                         │
│  Permet le démontage / nettoyage / préparation.             │
│                                                             │
│  Réservations possibles jusqu'à                             │
│  ┌────────────────┐                                         │
│  │      365       │  jours à l'avance                       │
│  └────────────────┘                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☐ Configurer un calendrier détaillé maintenant     │   │
│  │ Permet de bloquer des dates spécifiques (congés,    │   │
│  │ déjà réservé hors plateforme, etc.)                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- Tous les champs sont **pré-remplis** avec valeurs par défaut sensées
- Pour les services en mode "forfait" sur item unique (chapiteau), un toggle apparaît : "Cet objet ne peut être loué qu'à 1 seul événement à la fois" → set `max_concurrent_bookings = 1`
- Le checkbox "Configurer en détail" mène vers `/seller/calendar` après le wizard (sinon, défauts appliqués)

##### Validation

- Inventaire ≥ 1
- Délais ≥ 0

---

#### Step 9 — Cancellation policy

**URL** : `/seller/services/new?step=policy`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Politique d'annulation                                     │
│  Choisissez la politique qui s'appliquera aux réservations  │
│  de ce service.                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ( ) SOUPLE                                          │   │
│  │  > 30 j : 100 %  · 15-30 j : 100 % · 7-15 j : 75 %  │   │
│  │  < 7 j : 50 %                                       │   │
│  │  Recommandée pour fidéliser les nouveaux clients.   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ (•) STANDARD (recommandée)                          │   │
│  │  > 30 j : 100 %  · 15-30 j : 50 %  · 7-15 j : 25 %  │   │
│  │  < 7 j : 0 %                                        │   │
│  │  Équilibre entre flexibilité client et protection.  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ( ) STRICTE                                         │   │
│  │  > 30 j : 50 %  · 15-30 j : 25 % · 7-15 j : 0 %    │   │
│  │  < 7 j : 0 %                                        │   │
│  │  Pour services à fort coût de réservation.          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  La politique sera affichée clairement sur votre fiche.     │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- 3 cards radio
- Card sélectionnée par défaut : Standard
- Politique custom non disponible au MVP (V1)

---

#### Step 10 — Review & publish

**URL** : `/seller/services/new?step=review`

##### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Aperçu de votre fiche                                      │
│  Voici comment votre service apparaîtra aux clients.        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  [Aperçu de la fiche service tel que rendu publique]│   │
│  │                                                     │   │
│  │  Photo principale + autres                          │   │
│  │  Titre — Pro — Note                                 │   │
│  │  Prix                                               │   │
│  │  Description complète                               │   │
│  │  Options                                            │   │
│  │  Zone de livraison                                  │   │
│  │  Politique d'annulation                             │   │
│  │                                                     │   │
│  │  [Réserver — bouton désactivé en preview]           │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Score de qualité de votre fiche                            │
│  ████████░░ 80/100                                          │
│  💡 Pour atteindre 100, ajoutez : une vidéo (V1) +          │
│  3 photos supplémentaires                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☑ Je certifie que les informations fournies sont    │   │
│  │   exactes et que j'ai les droits sur les photos.    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Sauvegarder en brouillon]            [Publier mon service] │
└─────────────────────────────────────────────────────────────┘
```

##### Comportement

- **Aperçu** = vrai rendu de la fiche client (cf. C.4)
- **Score qualité** = formule de la deep dive catalogue (annexe)
- **CTA "Publier"** désactivé tant que la case n'est pas cochée

##### Post-publication

Selon le statut du pro :
- **Pro `verified` > 30 j et < 3 signalements** : publication directe → `published`
- **Sinon** : passage en `pending_review` → modération admin sous 24 h

##### Modale de confirmation

```
┌─────────────────────────────────────┐
│  🎉 Votre service est publié !      │
│                                     │
│  Votre fiche est maintenant visible │
│  par les clients de votre zone.     │
│                                     │
│  Prochaines étapes :                │
│  • Configurer votre calendrier en   │
│    détail                           │
│  • Activer les notifications email  │
│  • Partager votre fiche             │
│                                     │
│  [Voir ma fiche] [Aller au tableau  │
│                   de bord]          │
└─────────────────────────────────────┘
```

---

### B.3 — Service preview `MVP`

**URL** : `/seller/services/{id}`

**Objectif** : permettre au pro de voir comment sa fiche s'affiche, de consulter ses statistiques, et d'agir (modifier, archiver…).

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Top bar pro]                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ← Retour aux services                                              │
│                                                                     │
│  Chapiteau 100 m² blanc chic       • Publié    [Modifier]   [···]   │
│  Publié le 15 mars 2026                                             │
│                                                                     │
│  ┌──────────────────────────────┬─────────────────────────────┐    │
│  │                              │  Performance                 │    │
│  │  [Aperçu fiche client]       │  ─────────────────           │    │
│  │                              │  👁 142 vues (30 derniers j) │    │
│  │  Comme la verra le client    │  🛒 8 réservations           │    │
│  │                              │  💬 12 messages              │    │
│  │  ...                         │  ⭐ 4.7 / 5 (12 avis)        │    │
│  │                              │                              │    │
│  │                              │  [Voir stats détaillées V1]  │    │
│  │                              │                              │    │
│  │                              │  ─────────────────           │    │
│  │                              │  Disponibilités              │    │
│  │                              │  Inventaire : 2 / 2 dispo    │    │
│  │                              │  Prochaine résa : 22/06/26   │    │
│  │                              │                              │    │
│  │                              │  [Voir calendrier]           │    │
│  └──────────────────────────────┴─────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Menu actions `[···]`

- Voir l'aperçu client (ouvre `/service/{slug}` dans nouvel onglet)
- Dupliquer (V1)
- Archiver
- Voir l'historique de modifications (V1)

---

### B.4 — Service edit `MVP`

**URL** : `/seller/services/{id}/edit`

**Objectif** : permettre de modifier une fiche existante. Différent du wizard car édition libre et non guidée.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Retour à la fiche                                                │
│                                                                     │
│  Modifier : Chapiteau 100 m²                                        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ▼ Catégorie & type                              [Modifier]  │   │
│  │                                                             │   │
│  │ ▼ Titre & description                           [Modifier]  │   │
│  │                                                             │   │
│  │ ▼ Photos (4)                                    [Modifier]  │   │
│  │                                                             │   │
│  │ ▼ Tarification                                  [Modifier]  │   │
│  │                                                             │   │
│  │ ▼ Options (3)                                   [Modifier]  │   │
│  │                                                             │   │
│  │ ▼ Livraison                                     [Modifier]  │   │
│  │                                                             │   │
│  │ ▼ Disponibilités                                [Modifier]  │   │
│  │                                                             │   │
│  │ ▼ Politique d'annulation                        [Modifier]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💡 Les modifications majeures (titre, prix > 20 %, photos)         │
│     repassent en modération sous 24 h.                              │
│                                                                     │
│  [Annuler]                                  [Enregistrer]           │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- Sections accordéons (collapsed par défaut)
- Chaque section ouvre un panneau d'édition similaire à l'étape correspondante du wizard
- Modifs sauvegardées globalement avec `[Enregistrer]`
- Avertissement modale si modif majeure → re-modération

---

## C. Customer side — discovery & decision

### C.1 — Homepage `MVP`

**URL** : `/`

**Source domaine** : 2.2 Catalogue (entrée principale)

**Objectif** : convertir les visiteurs en chercheurs (lancer une recherche) ou en pros (CTA acquisition).

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Tukio]    Catégories  Devenir pro             Connexion  S'inscrire│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│              Trouvez les pros de l'événementiel                     │
│              en Pays de la Loire                                    │
│                                                                     │
│         La marketplace pour organiser vos événements                │
│         simplement, en confiance, près de chez vous.                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Quoi ?      │ Où ?         │ Quand ?              [🔍 Cherc.]│   │
│  │ Chapiteau…  │ Nantes       │ Du 15/06 au 17/06              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Les catégories populaires                                          │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │  📦      │ │  🪑      │ │  🎵 V1   │ │  🍽️ V1   │               │
│  │ Tentes & │ │ Mobilier │ │ Sono &   │ │ Traiteur │               │
│  │ chapit.  │ │ événem.  │ │ lumière  │ │          │               │
│  │ 24 pros  │ │ 18 pros  │ │ Bientôt  │ │ Bientôt  │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Comment ça marche ?                                                │
│                                                                     │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐          │
│  │  1️⃣     │    │  2️⃣     │    │  3️⃣     │    │  4️⃣     │          │
│  │ Cherchez│ →  │ Réservez│ →  │ Confirm.│ →  │ Profitez│          │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Vous êtes professionnel ? Rejoignez Tukio                          │
│  Recevez des leads qualifiés près de chez vous.                     │
│  [Devenir pro]                                                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Témoignages (V1)                                                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Footer]                                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Zones

1. **Hero + search** : promesse + barre de recherche unifiée
2. **Catégories populaires** : entrée alternative au catalogue
3. **Comment ça marche** : rassurance pour primo-visiteurs
4. **CTA pro** : acquisition côté offre
5. **Témoignages** *(V1)*
6. **Footer**

#### Notes design

- Hero : image de fond ou illustration sobre. **Pas** de stock photo générique. Idéal : photo réelle d'événement en PdL (avec accord)
- Recherche : champ "Quand" optionnel (pré-rempli "ce weekend" ou laissé vide)
- Cards catégories grisées si "Bientôt disponible" (au MVP, seules 2 sont actives)
- Mobile : la recherche se transforme en gros bouton qui ouvre un overlay step-by-step

#### États

- **Loading** : skeleton hero
- **Première visite** : modale cookie banner conforme RGPD

---

### C.2 — Category page `MVP`

**URL** : `/category/{slug}` ou `/category/{slug}/{city}` (V1)

**Source domaine** : 2.2 Catalogue + SEO

**Objectif** : page d'atterrissage SEO + entrée filtrée vers les services de la catégorie.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Accueil > Location de tentes & chapiteaux                          │
│                                                                     │
│  Location de tentes & chapiteaux en Pays de la Loire                │
│                                                                     │
│  Vous cherchez un chapiteau, un barnum ou une tente pliable         │
│  pour votre événement ? Découvrez les pros de votre région,         │
│  comparez les prix et réservez en ligne en toute confiance.         │
│                                                                     │
│  [Barre de recherche compacte avec catégorie pré-remplie]           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Sous-catégories                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                      │
│  │ Chapiteaux │ │ Tentes     │ │ Pagodes    │                      │
│  │ de récept. │ │ pliables   │ │ événem.    │                      │
│  └────────────┘ └────────────┘ └────────────┘                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Top services dans cette catégorie                                  │
│                                                                     │
│  [4 service cards]                                                  │
│                                                                     │
│  [Voir tous les services →]                                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  À savoir avant de réserver                                         │
│                                                                     │
│  Article SEO sur le sujet : 200-400 mots avec :                     │
│  - Comment choisir sa tente / son chapiteau                         │
│  - Tarifs moyens en PdL                                             │
│  - Bonnes pratiques (autorisation, terrain…)                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Questions fréquentes                                               │
│                                                                     │
│  ▾ Combien coûte la location d'un chapiteau ?                       │
│  ▾ Quelle taille pour 100 invités ?                                 │
│  ▾ Faut-il une autorisation ?                                       │
│  …                                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### SEO

- `<title>` et meta-desc optimisés par template (avec ville en V1)
- Données structurées Schema.org (`Product` collection, `BreadcrumbList`, `FAQPage`)
- H1 unique, H2 pour sous-catégories et FAQ

---

### C.3 — Search results `MVP`

**URL** : `/search?q=chapiteau&where=nantes&from=2026-06-15&to=2026-06-17`

**Source domaine** : 2.2 Catalogue (recherche)

**Objectif** : afficher les résultats pertinents et permettre au customer de filtrer / trier / naviguer.

#### Layout — desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Top bar avec recherche compacte récap]                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Chapiteaux à Nantes du 15 au 17 juin 2026 — 12 résultats           │
│  [📋 Liste]  [🗺 Carte]                       Trier par : Pertinence ▾│
│                                                                     │
│  ┌──────────────────┬─────────────────────────────────────────────┐ │
│  │  Filtres         │                                             │ │
│  │                  │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │ │
│  │  Prix            │  │ Service  │ │ Service  │ │ Service  │    │ │
│  │  ───●──●─        │  │ Card     │ │ Card     │ │ Card     │    │ │
│  │  100€    2000€   │  └──────────┘ └──────────┘ └──────────┘    │ │
│  │                  │                                             │ │
│  │  Note minimum    │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │ │
│  │  ☐ 3+            │  │          │ │          │ │          │    │ │
│  │  ☑ 4+            │  └──────────┘ └──────────┘ └──────────┘    │ │
│  │  ☐ 4.5+          │                                             │ │
│  │                  │  …                                          │ │
│  │  Distance        │                                             │ │
│  │  10km 25km 50km  │  [Pagination ou load more]                  │ │
│  │                  │                                             │ │
│  │  Sous-catégorie  │                                             │ │
│  │  ☑ Chapiteaux    │                                             │ │
│  │  ☐ Tentes        │                                             │ │
│  │  ☐ Pagodes       │                                             │ │
│  │                  │                                             │ │
│  │  [Réinitialiser] │                                             │ │
│  └──────────────────┴─────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Layout — mobile

- Filtres dans un drawer (bouton "Filtres" visible en haut)
- Toggle vue liste / carte plein écran
- Cards en colonne unique

#### Tris disponibles

- Pertinence (default — algo cf. catalogue deep dive E)
- Prix croissant
- Prix décroissant
- Note décroissante
- Distance croissante
- Plus récents (V1)

#### États

- **Default** : grille de service cards
- **Carte** : map plein écran avec markers cliquables, card overlay sur sélection
- **Empty** :
  ```
  Aucun résultat pour vos critères

  Suggestions :
  - Élargir votre zone de recherche
  - Essayer des dates voisines
  - Voir d'autres sous-catégories

  [Élargir à 50 km]   [Voir d'autres dates]

  Vous voulez être prévenu·e dès qu'un pro publie ?
  [📧 Laissez-nous votre email]
  ```
- **Loading** : 9 skeleton cards
- **Error** : message + bouton retry

---

### C.4 — Service detail `MVP`

**URL** : `/service/{slug}`

**Source domaine** : 2.2 Catalogue (page de conversion clé)

**Objectif** : convaincre le customer de réserver. C'est le **moment de vérité** de la conversion.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Accueil > Tentes & chapiteaux > Chapiteau 100 m² blanc chic        │
│                                                                     │
│  ┌──────────────────────────────────────────────┬────────────────┐  │
│  │ [Photo 1 grande]    [P2] [P3]                │  💰 1 200 €     │  │
│  │                     [P4] [P5]                │     forfait     │  │
│  │ 1/4    [📷 Voir toutes]                      │                 │  │
│  ├──────────────────────────────────────────────┤  Quand ?        │  │
│  │ Chapiteau 100 m² blanc chic                  │  ┌───────────┐  │  │
│  │ Pro : Event Co Nantes ⭐ 4.7 (27 avis)       │  │ Sélection │  │  │
│  │                                              │  │ dates     │  │  │
│  │ Description complète…                        │  └───────────┘  │  │
│  │                                              │                 │  │
│  │ ✓ Toile traitée déperlante…                  │  Quantité       │  │
│  │ ✓ Hauteur 4,5 m                              │  ┌───────────┐  │  │
│  │ ✓ Sangles, piquets inclus                    │  │  − 1 +    │  │  │
│  │                                              │  └───────────┘  │  │
│  │ Options                                      │                 │  │
│  │ ☐ Éclairage LED guirlandes (+150 €)         │  Adresse événem. │  │
│  │ ☐ Plancher (8 €/m²)                         │  ┌───────────┐  │  │
│  │ ☐ Chauffage (+200 €)                         │  │ Saisir…   │  │  │
│  │                                              │  └───────────┘  │  │
│  │ Livraison                                    │                 │  │
│  │ Zone : Loire-Atlantique  [Voir carte]        │  Total estimé   │  │
│  │ Frais : 1,50 €/km depuis Nantes              │  1 200 €        │  │
│  │                                              │  + livraison    │  │
│  │ Politique d'annulation                       │                 │  │
│  │ Standard · 100 % > 30 j · 50 % 15-30 j…       │  [Vérifier la   │  │
│  │ [Voir détail]                                │   disponibilité]│  │
│  │                                              │                 │  │
│  │ Avis (12)                                    │                 │  │
│  │ ⭐ 4.7 · 12 avis                              │                 │  │
│  │ [Liste des 3 derniers avis]                  │                 │  │
│  │ [Voir tous les avis]                         │                 │  │
│  │                                              │                 │  │
│  │ À propos du pro                              │                 │  │
│  │ [Card pro avec lien profil]                  │                 │  │
│  │                                              │                 │  │
│  │ Services similaires                          │                 │  │
│  │ [4 cards de services proches]                │                 │  │
│  └──────────────────────────────────────────────┴────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Zones (priorité décroissante)

1. **Galerie photos** : carrousel principal + miniatures, swipe sur mobile
2. **Sticky booking widget** (droite desktop, bottom mobile) : prix + dates + quantité + adresse + total + CTA
3. **Description**
4. **Options sélectionnables** : impactent le total en temps réel
5. **Livraison** : zone + tarification
6. **Politique d'annulation** : résumé + lien détail
7. **Avis** : note agrégée + 3 derniers + lien tous
8. **Profil pro mini** : card vers profil complet
9. **Services similaires** : recommandations

#### Booking widget — comportement

- Saisie progressive : dates → quantité → adresse → vérification
- **Total estimé** : recalculé en temps réel à chaque modif
- **Bouton CTA** :
  - "Vérifier la disponibilité" tant que pas tous les champs remplis
  - "Réserver" une fois validés
- Click → `/cart` (ajout au panier) avec params dans URL ou state
- Mobile : widget en bottom-sheet sticky, expand au tap

#### États

- **Service unavailable for dates** : "Indisponible aux dates choisies — voir les dates disponibles" + suggestion
- **Pro suspendu** : page non accessible (404 redirect)
- **Service archivé** : "Ce service n'est plus proposé. Voir des services similaires."

#### SEO

- `<title>` : "{titre service} — {nom pro} — Tukio"
- Données structurées : `Product`, `Offer`, `AggregateRating`, `Review`
- Open Graph + Twitter Card pour partage

---

### C.5 — Public pro profile `MVP`

**URL** : `/pro/{slug}`

**Source domaine** : 2.2 Catalogue + 2.7 Avis

**Objectif** : permettre au customer d'évaluer la confiance dans le pro avant de réserver.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────┬───────────────────────────────────────────────────┐│
│  │             │                                                   ││
│  │  [Photo]    │  Event Co Nantes                                  ││
│  │   Pro       │  ⭐ 4.7 (27 avis) · Membre depuis 2024             ││
│  │             │  📍 Nantes, Loire-Atlantique                      ││
│  │             │  💬 Répond généralement en 2 h                    ││
│  │             │                                                   ││
│  │             │  Bio courte (max 280 car.) qui présente le pro,    ││
│  │             │  son expérience, son approche…                    ││
│  └─────────────┴───────────────────────────────────────────────────┘│
│                                                                     │
│  [Tous les services] [À propos] [Avis (27)]                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tous les services (8)                                              │
│                                                                     │
│  [8 service cards]                                                  │
│                                                                     │
│  [Pagination si > 12]                                               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  À propos                                                           │
│                                                                     │
│  Bio détaillée (V1) — 500-2000 mots                                 │
│  Année de création, équipe, certifications, photos coulisses        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Avis (27) ⭐ 4.7                                                   │
│                                                                     │
│  [Distribution des notes — V1]                                      │
│  [Liste des avis avec pagination]                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Notes design

- Au MVP, certaines zones sont "light" si le pro est nouveau (peu d'avis, bio courte) — afficher quand même mais sans donner une impression de page vide
- "Répond généralement en X" : visible seulement si > 5 demandes traitées (échantillon)
- Pas de bouton "Contacter le pro" en MVP : la prise de contact passe obligatoirement par une réservation (anti-désintermédiation)

---

## D. Cross-cutting states

### D.1 — Empty states (catalogue)

| Contexte | Visuel | Message | CTA |
|----------|--------|---------|-----|
| Pas de services côté pro (premier login) | Illustration sobre | "Vous n'avez pas encore publié de service" | "Créer mon premier service" |
| Recherche sans résultats | Illustration loupe | "Aucun service ne correspond" | "Élargir la zone" / "Voir d'autres dates" |
| Catégorie vide (cold start) | Illustration | "Aucun service dans cette catégorie pour le moment" | "Être prévenu" (email capture) |
| Profil pro sans avis | Pas d'illustration | "Aucun avis pour le moment" | — |

### D.2 — Loading states

| Écran | Pattern |
|-------|---------|
| Service list (pro) | 8 skeleton cards |
| Search results | 9 skeleton cards |
| Service detail | Skeleton hero (galerie) + skeleton text blocks |
| Image upload | Progress bar par fichier |
| Booking widget calc | Spinner inline sur le total |

### D.3 — Error states

| Erreur | Comportement |
|--------|--------------|
| API down (search) | Message "Recherche indisponible, réessayez dans un instant" + bouton retry |
| Image upload failed | Toast erreur avec raison, photo retirée de la liste |
| Service not found (404) | Page 404 avec suggestions de catégories |
| Service withdrawn / suspended | Page d'info + redirection vers la catégorie parent |

---

## E. Transitions map

### E.1 — Pro flow

```
/seller/services
   │
   ├── [+ Nouveau] → /seller/services/new (Step 1 → Step 10)
   │                 │
   │                 ├── Step 10 + publish → /seller/services/{id} (preview)
   │                 │
   │                 └── Save draft → /seller/services (avec status `draft`)
   │
   ├── Card click → /seller/services/{id}
   │                 │
   │                 ├── [Modifier] → /seller/services/{id}/edit
   │                 ├── [Aperçu client] → ouverture nouvel onglet /service/{slug}
   │                 ├── [Archiver] → modale confirm → retour /seller/services
   │                 └── [Voir calendrier] → /seller/calendar
```

### E.2 — Customer flow

```
/ (homepage)
   │
   ├── Recherche → /search?q=...
   │
   ├── Click catégorie → /category/{slug}
   │                      │
   │                      └── Card service → /service/{slug}
   │
   └── /search
        │
        ├── Click result card → /service/{slug}
        │                       │
        │                       ├── Click pro mini → /pro/{slug}
        │                       │
        │                       ├── [Réserver] → /cart
        │                       │
        │                       └── [Service similaire] → /service/{autre-slug}
        │
        └── Click marker map → /service/{slug}
```

---

## F. Open design questions

Questions UX qui émergent de ce flow et qui demandent un arbitrage avec le designer ou le founder :

| # | Question | Reco par défaut |
|---|----------|-----------------|
| F-01 | Mode "Sur devis" disponible au MVP ? | **Non** — risque d'incohérence UX (pas de flow devis client). Repoussé V1. |
| F-02 | Card service en grid 3 ou 4 colonnes desktop ? | **3 colonnes** sur résultats (plus de respiration), 4 sur catégorie (plus dense) |
| F-03 | Sticky booking widget mobile ou bottom sheet ? | **Bottom sheet expandable** — pattern Airbnb / Booking |
| F-04 | Galerie photos : carrousel natif ou lightbox ? | **Carrousel + click pour lightbox** plein écran (V1) |
| F-05 | Distribution des notes (1 à 5 stars) sur profil pro ? | V1 — pas au MVP |
| F-06 | Affichage temps de réponse pro ? | À partir de 5 demandes traitées seulement |
| F-07 | Booking widget : précharger l'adresse via géoloc ? | **Oui avec consentement** — UX améliorée |
| F-08 | Wizard creation : sauvegarde automatique (autosave) ? | **Oui à chaque step** — éviter les pertes |
| F-09 | Mode "preview" depuis l'édition pour voir avant publier ? | **Oui** — bouton "Aperçu" dans `/edit` qui ouvre `/seller/services/{id}` |
| F-10 | Carte map dans search : provider Mapbox ou Google ? | **Mapbox** — meilleure flexibilité de style + tarification raisonnable. À valider après devis. |

---

*Fin du UX Flow Catalogue — version 1, à itérer avec le designer.*
