# Tukio — Brief Design Global (Doc 0)

> Document fondateur pour le designer
> À lire avant tout travail de design produit
> Doit être lu en complément de : `tukio_spec_v2.md` + les 3 deep dives (Booking, Paiements, Catalogue)
> Statut : draft à valider et figer avec le designer dès l'onboarding

---

## Sommaire

- [A. Positionnement & marque](#a-positionnement--marque)
- [B. Identité visuelle](#b-identité-visuelle)
- [C. Système de design (tokens)](#c-système-de-design-tokens)
- [D. Composants](#d-composants)
- [E. Patterns d'interaction](#e-patterns-dinteraction)
- [F. Responsive & breakpoints](#f-responsive--breakpoints)
- [G. Accessibilité](#g-accessibilité)
- [H. Photos & contenu visuel](#h-photos--contenu-visuel)
- [I. Voix & ton (UX writing)](#i-voix--ton-ux-writing)
- [J. Anti-patterns à éviter](#j-anti-patterns-à-éviter)
- [K. Livrables attendus](#k-livrables-attendus)
- [L. Workflow design — comment on s'organise](#l-workflow-design--comment-on-sorganise)

---

## A. Positionnement & marque

### Le brief en 1 phrase

> *Tukio est la place de marché qui rend l'organisation d'événements plus simple, plus fiable et plus belle, en connectant directement les organisateurs aux professionnels locaux.*

### Promesse

| Côté client | Côté pro |
|-------------|----------|
| "Trouve les bons pros près de chez toi, en confiance, sans appeler 10 personnes." | "Concentre-toi sur ton métier, on s'occupe du reste : visibilité, paiement, paperasse." |

### Attributs de marque (à incarner dans tout le design)

1. **Confiance** — On manipule des transactions à 4 chiffres. Tout doit *respirer le sérieux* sans être austère.
2. **Chaleur** — Un événement, c'est un moment de vie. L'interface ne doit pas être froide ou bureaucratique.
3. **Sobriété** — On n'est pas Pinterest mariage. Pas de surcharge décorative.
4. **Ancrage local** — Différenciation forte vs. plateformes parisiano-centrées ou nationales génériques. *Made in Pays de la Loire* est un atout, pas une limite.
5. **Modernité tranquille** — Ni vieillot, ni "tech bro". On vise une élégance qui ne se démode pas en 2 ans.

### Ce que Tukio **n'est pas**

| Anti-positionnement | Pourquoi |
|--------------------|----------|
| ❌ Pinterest mariage rose poudré | Cantonne au B2C mariage, exclut le B2B et les événements pros |
| ❌ Stripe minimaliste froid | Trop austère pour un produit "moments de vie" |
| ❌ Airbnb aspirationnel touristique | Pas la même promesse, on est pro et utilitaire |
| ❌ Leboncoin brut | Manque de cadre, manque de confiance |
| ❌ MalleàWedding / 1001Listes (style romantique) | Vieillit mal, exclut la cible pro |

### Références mentales utiles (à montrer au designer)

- **Airbnb** mais en plus *chaleureux* (et moins lifestyle)
- **ManoMano** mais en plus *haut de gamme* (moins bricolage, plus événementiel)
- **Le Slip Français** pour le ton *made in France pro mais pas guindé*
- **Le Bon Marché** (digital) pour la sobriété élégante
- **Resy** ou **OpenTable** récent pour la qualité du parcours de réservation
- **Faire** (faire.com) pour la palette neutre chaleureuse

---

## B. Identité visuelle

### Direction de palette recommandée — Terracotta

Trois directions ont été pré-sélectionnées avant ce brief (terracotta, ocre profond, émeraude foncé). **Recommandation : terracotta.**

**Pourquoi terracotta :**
- *Couleur de "fête"* sans tomber dans le rose mariage
- Se distingue radicalement des concurrents tech (violet, bleu, vert vif)
- Fonctionne en **B2C ET B2B** (l'ocre fonctionne moins en B2B, l'émeraude moins en mariage)
- Référence aux *matériaux nobles événementiels* (terre cuite, lin, bois)
- Marche bien avec photos d'événement réels (lumière chaude)
- Robuste sur les saisons (printemps-été = mariages, automne = corporate)

Le designer testera et pourra proposer des ajustements, mais le **registre** doit rester (chaud, désaturé, naturel).

### Palette complète proposée

#### Couleurs de marque (terracotta)

| Token | Hex | Usage |
|-------|-----|-------|
| `brand-50` | `#FCF3EE` | Backgrounds très subtils (banners, hover) |
| `brand-100` | `#F8E0D0` | Hovers boutons secondaires, badges légers |
| `brand-200` | `#F1B996` | États sélectionnés doux |
| `brand-300` | `#E89160` | Accents secondaires |
| `brand-400` | `#DC6E33` | Hovers boutons primaires |
| `brand-500` | `#C2410C` | **Primary** — boutons, liens, focus |
| `brand-600` | `#9A340A` | Pressed state, hovers texte |
| `brand-700` | `#7A2A09` | Texte sur fonds clairs |
| `brand-800` | `#5C2008` | Texte intense |
| `brand-900` | `#3E1606` | Réservé (très sombre) |

#### Neutres chauds (cream + charcoal)

| Token | Hex | Usage |
|-------|-----|-------|
| `cream-50` | `#FAF7F2` | **Page background** par défaut |
| `cream-100` | `#F5F1EA` | Surfaces contrastées légères (cards alt) |
| `cream-200` | `#EBE5D9` | Borders subtiles, dividers |
| `cream-300` | `#DDD4C2` | Borders standards |
| `charcoal-400` | `#6B6657` | Texte muted (placeholders, labels secondaires) |
| `charcoal-500` | `#4A453A` | Texte secondaire |
| `charcoal-600` | `#2F2C25` | Texte body |
| `charcoal-700` | `#1F1D18` | **Texte principal** |
| `charcoal-800` | `#14130F` | Headings sombres |
| `charcoal-900` | `#0A0A07` | Réservé (très sombre, rare) |

> **Règle stricte** : ne **jamais** utiliser de noir pur (`#000`) ni de blanc pur (`#FFF`). On reste dans le registre chaud. Noir pur = froid et trop tech, blanc pur = clinique.

#### Couleurs fonctionnelles (désaturées)

Volontairement **moins saturées** que les couleurs système classiques (Material, Tailwind brut). Cohérence avec le ton sobre.

| Token | Hex | Usage |
|-------|-----|-------|
| `success-50` | `#ECF1ED` | Background succès |
| `success-500` | `#4D7C5E` | Texte / icône succès |
| `success-700` | `#345240` | Hover / pressed |
| `warning-50` | `#F8ECD9` | Background warning |
| `warning-500` | `#B45309` | Texte / icône warning |
| `warning-700` | `#7A380A` | Hover / pressed |
| `error-50` | `#FCE8E8` | Background erreur |
| `error-500` | `#B91C1C` | Texte / icône erreur |
| `error-700` | `#7F1414` | Hover / pressed |
| `info-50` | `#E2EEF3` | Background info |
| `info-500` | `#1E5F7E` | Texte / icône info |
| `info-700` | `#143F54` | Hover / pressed |

> Note importante : `warning-500` (`#B45309`) est volontairement **proche de la palette brand**. C'est cohérent dans le système, mais il faut s'assurer que les warnings ne se confondent pas avec les CTAs primaires. Le designer doit vérifier qu'un warning et un CTA primaire restent distinguables côte à côte (par typo, icône, contexte).

### Typographie

#### Recommandation — pairing serif + sans-serif

Ce duo est ce qui marche le mieux dans l'hôtellerie et l'événementiel haut de gamme. Il apporte **caractère** sur les titres et **lisibilité** sur les textes.

#### Display (titres, marque)

**Recommandation** : *Fraunces* (Google Fonts, libre)
- Variable font (poids et optical sizing)
- Caractère "événementiel" sans être daté
- Excellent rendu en grand format
- Alternatives : *Tiempos Headline* (premium), *Recoleta*, *Canela*

**Usage** : H1, H2, hero titles, citations, marque

#### Body (texte courant, UI)

**Recommandation** : *Inter* (Google Fonts, libre, gratuit)
- Standard de fait pour l'UI moderne
- Excellente lisibilité tous écrans
- Variable font avec optical sizing
- Alternatives : *DM Sans*, *Söhne* (premium), *Geist*

**Usage** : body, navigation, formulaires, boutons, labels

#### Échelle typographique

Modular scale 1.250 (Major Third), une des plus harmonieuses pour le web :

| Token | Size | Line height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 12px / 0.75rem | 1.5 | Labels secondaires, captions |
| `text-sm` | 14px / 0.875rem | 1.5 | Body small, helper text |
| `text-base` | 16px / 1rem | 1.6 | Body par défaut |
| `text-lg` | 20px / 1.25rem | 1.5 | Body large, sous-titres |
| `text-xl` | 25px / 1.5625rem | 1.4 | H4 |
| `text-2xl` | 31px / 1.9375rem | 1.3 | H3 |
| `text-3xl` | 39px / 2.4375rem | 1.2 | H2 |
| `text-4xl` | 49px / 3.0625rem | 1.15 | H1 |
| `text-5xl` | 61px / 3.8125rem | 1.1 | Hero |
| `text-6xl` | 76px / 4.75rem | 1.05 | Display géant (rare) |

#### Poids

- Display (Fraunces) : 400 (regular), 500 (medium), 700 (bold) — pas plus
- Body (Inter) : 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

> **Règle stricte** : ne jamais aller en dessous de 400 (light, thin). Les fines casses se cassent en mobile et perdent en lisibilité.

### Iconographie

**Lib recommandée** : *Lucide* (lucide.dev) — fork moderne de Feather Icons, très complet, libre.

- **Style** : outlined uniquement, stroke 1.5px (pas filled, pas dual-tone)
- **Tailles standard** :
  - 16px : inline avec texte
  - 20px : boutons compacts
  - 24px : taille par défaut UI
  - 32px : grands CTAs, vignettes
  - 48px+ : illustrations, empty states
- **Pas d'emoji dans l'UI** sauf cas exceptionnel délibéré et documenté

### Logo (à concevoir)

Le designer proposera 3 directions. Cadre :

- **Format préféré** : wordmark (Tukio en typo) + symbole optionnel
- **Versions à livrer** :
  - Full lockup (wordmark + symbole)
  - Compact (wordmark seul)
  - Symbole seul (favicon, app icon, avatar)
  - Versions monochromes (sur fond clair, sur fond foncé)
- **Espace de protection** : équivalent hauteur du "T"
- **Taille minimum** : 24px de hauteur
- **Inspirations à donner** : sobre, peut référencer subtilement l'événementiel (pliage tente / arche / point de rendez-vous) mais sans être trop littéral

---

## C. Système de design (tokens)

### Spacing — base 4px

Échelle stricte, cohérente partout :

| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0 | — |
| `space-px` | 1px | Borders fines |
| `space-0.5` | 2px | Très rare |
| `space-1` | 4px | Espacement minimal |
| `space-2` | 8px | Spacing interne icône-texte |
| `space-3` | 12px | Spacing serré |
| `space-4` | 16px | **Spacing par défaut** |
| `space-5` | 20px | Spacing confortable |
| `space-6` | 24px | Sections proches |
| `space-8` | 32px | Sections normales |
| `space-10` | 40px | Sections aérées |
| `space-12` | 48px | Blocs distincts |
| `space-16` | 64px | Sections de page |
| `space-20` | 80px | Headers / sections majeures |
| `space-24` | 96px | Hero sections |

> Pas d'autres valeurs autorisées. Pas de `13px`, `15px`, `18px` arbitraires.

### Border radius

Système discret, pas de "pills" partout (sober design).

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Inputs, badges petits |
| `rounded` | 8px | **Boutons, cards, par défaut** |
| `rounded-md` | 12px | Cards alternatives |
| `rounded-lg` | 16px | Grandes cards, modales |
| `rounded-xl` | 24px | Hero cards (rare) |
| `rounded-full` | 9999px | Avatars, badges ronds, dots |

### Shadows (à utiliser avec parcimonie)

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Default — pas d'ombre par défaut |
| `shadow-sm` | `0 1px 2px rgba(31, 29, 24, 0.05)` | Cards subtiles, hovers |
| `shadow` | `0 2px 8px rgba(31, 29, 24, 0.06)` | Cards interactives |
| `shadow-md` | `0 4px 16px rgba(31, 29, 24, 0.08)` | Dropdowns, popovers |
| `shadow-lg` | `0 12px 32px rgba(31, 29, 24, 0.12)` | Modales |
| `shadow-xl` | `0 24px 64px rgba(31, 29, 24, 0.16)` | Critical CTAs (rare) |

> **Règle** : sober design = on **n'empile pas** d'ombres partout. Un écran type ne devrait pas avoir plus de 2-3 niveaux d'élévation visibles.

### Animation & transitions

**Durées** :
- `fast` : 150ms — micro-interactions (hover, focus)
- `default` : 250ms — transitions standards
- `slow` : 400ms — modales, layouts

**Easings** :
- `ease-out` : default (entrée d'éléments, hovers)
- `ease-in-out` : modales, accordéons
- `ease-in` : sortie d'éléments (rarement utilisé)

**À éviter** :
- ❌ Bouncing / spring exagéré
- ❌ Animations de + de 500ms sur du contenu critique
- ❌ Parallax sauf cas très précis (hero homepage à la rigueur)
- ❌ Auto-play, carrousels qui défilent seuls

---

## D. Composants

Catalogue de composants à concevoir et documenter dans Figma. Marqués `MVP` ou `V1` selon priorité.

### D.1 Boutons

5 variantes, 3 tailles, 4 états par variante :

| Variante | Usage | Apparence |
|----------|-------|-----------|
| `primary` (MVP) | Action principale | Fond `brand-500`, texte `cream-50` |
| `secondary` (MVP) | Action secondaire | Fond `cream-100`, texte `charcoal-700`, border `cream-300` |
| `tertiary` (MVP) | Action tertiaire | Texte `brand-700`, fond transparent |
| `ghost` (V1) | Actions discrètes (icône seul) | Texte `charcoal-600`, hover `cream-100` |
| `danger` (MVP) | Suppressions, annulations | Texte `error-500` (variante outline), ou fond `error-500` (variante full) |

**Tailles** :
- `sm` : 32px H, padding 12-8, text-sm
- `md` : 40px H, padding 16-12, text-base (**default**)
- `lg` : 48px H, padding 20-16, text-base

**États obligatoires** : default, hover, active/pressed, focus (focus ring), disabled, loading.

### D.2 Inputs (formulaires)

À concevoir : text, email, password, number, textarea, select, date, search, file upload.

**Apparence MVP** :
- Fond `cream-50` (sur fond `cream-100`) ou `cream-100` (sur fond `cream-50`)
- Border `cream-300` (1px)
- Focus : border `brand-500` (1px) + outline `brand-500/20` (3px)
- Erreur : border `error-500` + helper text en `error-500`
- Disabled : opacity 0.5, fond `cream-200`
- Padding : 12px H, 16-20px V (selon taille)
- Border radius : `rounded-sm`

**Labels** : toujours visibles (pas de placeholders-only). Position : au-dessus de l'input. Style : `text-sm`, `charcoal-500`, semibold.

**Helper text** : sous l'input, `text-xs`, `charcoal-400` (default) ou `error-500` (erreur).

**Floating labels** : non recommandés (problèmes d'accessibilité, look daté en 2025).

### D.3 Cards

À concevoir, 3 variantes principales :

#### `service-card` (MVP)
Card de service dans les résultats de recherche :
- Photo principale 16:9 (avec carrousel hover sur desktop)
- Titre du service
- Nom du pro + note ⭐ + nb avis
- Prix (depuis / forfait / sur devis)
- Distance + ville
- Badge éventuel (Top Pro, Nouveau, Réponse rapide)
- Heart pour favoris

Variantes : grid (résultats), liste compacte, suggestions.

#### `pro-card` (MVP)
Card de profil pro :
- Avatar pro
- Nom / raison sociale
- Note + nb avis
- Bio courte (~50 mots)
- Bouton "Voir le profil"

#### `summary-card` (MVP)
Card de récap dans checkout / dashboard :
- Layout dense (info-dense)
- Hiérarchie claire (titre → détails → total)

**Apparence cards** :
- Fond `cream-50` (default)
- Border `cream-200` ou `shadow-sm`
- `rounded-md` ou `rounded-lg`
- Hover : légère élévation (`shadow` au lieu de `shadow-sm`)
- Padding : 16px ou 20px

### D.4 Navigation

#### Top bar (MVP)

**Côté client (non connecté)** :
- Logo (gauche)
- Recherche compacte (centre, optionnelle selon page)
- Liens : Catégories, Devenir pro
- Boutons : Connexion, Inscription

**Côté client (connecté)** :
- Logo
- Recherche
- Liens : Catégories
- Avatar utilisateur (dropdown : Mes réservations, Favoris, Paramètres, Déconnexion)
- Notifications (cloche)

**Côté pro (connecté)** :
- Logo
- Liens (selon contexte) : Tableau de bord, Mes services, Réservations, Messages
- Avatar pro
- Notifications

**Côté admin (V1)** : layout très différent, sidebar dédiée. À traiter séparément.

#### Footer (MVP)
- Logo + tagline
- Colonnes : Tukio (À propos, Carrière), Aide, Pour les pros, Légal
- Réseaux sociaux
- Sélecteur langue (V2)
- Copyright + mentions légales

### D.5 Modales & dialogs (MVP)

- Overlay : `charcoal-700/50` (semi-transparent)
- Card centrée : fond `cream-50`, `rounded-lg`, `shadow-lg`
- Max-width : 480px (small), 640px (medium), 800px (large)
- Padding : 24-32px
- Header : titre + close button (X) en haut à droite
- Footer : actions (boutons alignés à droite, primary à droite)
- Animation : fade-in overlay + scale-up card (250ms)

### D.6 Toasts & alerts (MVP)

**Toasts** (notifs ponctuelles) :
- Position : bottom-right (desktop), bottom-center (mobile)
- Auto-dismiss : 4s default, 8s pour erreurs
- Variants : success, error, warning, info
- Stack si plusieurs

**Alerts** (messages persistants in-flow) :
- Layout : icône + titre + description + action optionnelle
- Mêmes variants que toasts
- Closable

### D.7 Empty states (MVP)

À concevoir avec soin — c'est ce qu'on voit le plus souvent au début d'un marketplace.

**Cas à couvrir** :
- Pas de résultats de recherche
- Panier vide
- Aucune réservation (côté client)
- Aucune réservation (côté pro — premier login)
- Aucun service publié (côté pro)
- Aucun message
- Aucun avis encore

**Structure standard** :
- Illustration ou icône grand format (centrée)
- Titre court
- Description rassurante
- CTA pour passer à l'action

### D.8 Loading states (MVP)

À utiliser, **dans cet ordre de préférence** :

1. **Skeleton screens** (preview de la structure) — pour les pages qui chargent
2. **Spinners** circulaires — pour les actions courtes (validation form, paiement)
3. **Progress bars** — pour les actions longues avec progression connue (upload)

> **Règle** : si une action prend < 300ms, ne pas afficher de loader (ça crée juste du flicker).

### D.9 Composants spécialisés (V1 mais à anticiper)

Liste des composants spécifiques au domaine événementiel à concevoir :

- **Calendar / date picker** : avec affichage dispo / non-dispo, sélection plage
- **Quantity selector** : pour les services à l'unité (chaises…)
- **Pricing display** : multi-lignes (sous-total, TVA, frais livraison, total)
- **Reviews display** : note globale + breakdown multi-critères + liste avis
- **Map** : intégration Mapbox / Google avec markers customisés
- **Filter sidebar** : filtres recherche
- **Conversation thread** : messagerie (bulles, timestamps, attachments)
- **File upload** : drag & drop avec preview
- **Step indicator** : pour les wizards (création service, checkout)

---

## E. Patterns d'interaction

### E.1 Navigation principale

**Desktop** : top bar fixe en haut, transparente sur homepage hero (sticky avec fond `cream-50` au scroll).

**Mobile** :
- Top bar fixe simplifiée (logo + hamburger + avatar)
- Menu hamburger en drawer plein écran
- Bottom nav optionnelle pour parcours-clés (V1)

### E.2 Recherche

**Pattern recommandé** : barre de recherche unifiée en homepage hero, avec 3 champs (Quoi / Où / Quand).

**Sur mobile** : la barre devient une grosse "search bar" qui ouvre un overlay plein écran avec les 3 champs en step-by-step.

**Recherche prédictive** : autocomplétion sur le champ "Quoi" (catégories puis types).

### E.3 Formulaires longs

Pour les formulaires de + de 6 champs (ex : création service) :
- Découpage en **étapes** (wizard avec step indicator)
- Sauvegarde en brouillon à chaque étape
- Possibilité de revenir en arrière sans perdre les données
- Bouton "Continuer plus tard" visible

### E.4 Onboarding

**Pro** : wizard guidé en 5-7 étapes (cf. deep dive Catalogue C). Très important : *montrer la progression*, *encourager*, *donner des exemples*.

**Client** : pas d'onboarding obligatoire. L'inscription doit pouvoir se faire en 30 secondes.

### E.5 Confirmations destructrices

Pattern systématique pour : annulation résa, suppression service, suppression compte.

- Modale de confirmation
- Re-formulation explicite de l'action
- Conséquences claires (ex : "Cette action est définitive et entraînera un remboursement à 50 %")
- Bouton primary en variante `danger`
- Bouton secondary "Annuler"

### E.6 Erreurs & retries

**3 niveaux d'erreur** :
- **Inline** (champ form) : juste sous le champ, rouge
- **Toast** : action ponctuelle ratée
- **Page d'erreur** : crash ou 404 / 500

**Toujours proposer une action** : "Réessayer", "Retour", "Contacter le support".

### E.7 Success states

À ne pas surcharger non plus. Pattern :
- Toast vert sobre + redirection auto OU
- Page de confirmation avec récap + next actions

Pas de confettis, pas d'émojis géants, pas d'animations célébratoires (sober).

---

## F. Responsive & breakpoints

### Approche : mobile-first, mais desktop critique

Tukio a un usage différencié :
- **Pros sur le terrain** = mobile (livraisons, montages → consultation rapide depuis chantier)
- **Clients en décision** = desktop fréquent + mobile en croissance
- **Admins** = desktop only

Donc : mobile-first par défaut, avec attention particulière au desktop pour les dashboards pros et l'admin.

### Breakpoints

| Token | Range | Usage |
|-------|-------|-------|
| `xs` | 0 - 480px | Petits mobiles (rare cible spécifique) |
| `sm` | 481 - 640px | Mobiles standards |
| `md` | 641 - 1024px | Tablettes |
| `lg` | 1025 - 1280px | Desktop standard |
| `xl` | 1281 - 1536px | Large desktop |
| `2xl` | 1537+ | Très grands écrans |

### Layout container

| Breakpoint | Max-width content |
|------------|-------------------|
| Mobile / tablet | 100% avec padding 16-24px |
| Desktop (lg) | 1200px |
| Wide (xl+) | 1400px |

> Pas de "full-width" à 1920px+ — devient illisible et perd en cohérence visuelle.

### Touch targets

**Minimum 44 × 44px** pour toute zone tappable sur mobile (Apple HIG / WCAG).

---

## G. Accessibilité

### Cible : RGAA niveau AA

Tukio doit être accessible (obligation légale en France au-delà d'un certain seuil de CA, et bonne pratique de toute façon).

### Règles non négociables

**Contraste** :
- Texte normal : ratio ≥ 4.5:1
- Texte large (≥ 18pt ou 14pt bold) : ≥ 3:1
- UI components / icônes : ≥ 3:1

→ Vérifier la palette proposée avec un outil (Stark, Contrast.app). Le `cream-50` × `charcoal-700` doit passer largement.

**Navigation clavier** :
- Tous les éléments interactifs accessibles au Tab
- Focus ring visible (jamais `outline: none` sans alternative)
- Ordre logique du Tab
- Skip links en haut de page

**Screen readers** :
- HTML sémantique (`<button>`, `<nav>`, `<main>`, `<article>`, …)
- ARIA quand nécessaire (mais pas en remplacement du sémantique)
- `alt` text obligatoire sur toutes les images de contenu
- `aria-label` sur les icon buttons

**Pas d'info uniquement par couleur** :
- Une erreur ne se signale pas que par "rouge" — toujours icône + label texte
- Une dispo "complet" ne se signale pas que par couleur calendrier — texte "Complet"

**Mouvements & motion** :
- Respecter `prefers-reduced-motion` : désactiver animations non essentielles
- Pas de flash > 3 fois par seconde

**Touch targets** : 44 × 44px minimum (cf. F).

---

## H. Photos & contenu visuel

### Direction photo

**Direction recommandée : "réel chaleureux"**

✅ **Faire** :
- Photos d'événements **réels** (avec accord client + pro)
- Lumière naturelle, tons chauds
- Personnes en moment vécu (pas posées artificiellement)
- Espaces / atmosphères, pas que produit
- Diversité (types d'événements, lieux, gens)
- Plan large + détails

❌ **Éviter** :
- Stock photos évidents (couples Shutterstock, équipes business stéréotypées)
- Setups "trop parfaits" (vide, aseptisé, mariage Pinterest)
- Sur-traitement / filtres saturés
- Photos type "catalogue Ikea" pour le matériel (sauf pour fiches produit techniques)

### Photos de fiche service (côté pro)

Voir aussi `tukio_catalogue_deepdive.md` section F.

Le pro upload, mais on **éduque** :
- Tutoriels intégrés ("Comment prendre de bonnes photos de votre matériel")
- Exemples avant/après
- Possibilité (V1) de demander une session photo pro à tarif négocié

### Illustrations

Si besoin d'illustrations (empty states, onboarding, marketing) :

**Style recommandé** :
- Trait dessiné, pas vectoriel "Stripe-like" lisse
- Palette de la marque (terracotta + neutres)
- Pas de personnages génériques type Storyset / Undraw

**Alternatives** :
- Photos abstraites en monochrome (textures, lumière)
- Picto custom dessinés en SVG
- Pas d'illustrations du tout (préférer la photo réelle)

### Pictogrammes / iconographie événementielle

Une mini-bibliothèque de pictos custom pour les catégories événementielles (chapiteau, chaise, sono, traiteur…). À faire dessiner par le designer en cohérence avec Lucide.

---

## I. Voix & ton (UX writing)

### Principes

1. **Vouvoiement** systématique. Pas de "tu" même côté client B2C. C'est une marketplace de transactions sérieuses.
2. **Direct et clair**. Pas de blabla. Pas de marketing creux. *"Réservez maintenant"* > *"Démarrez votre aventure événementielle"*.
3. **Chaleureux mais pas familier**. *"Bonjour Jean"* > *"Salut Jean !"*. Pas d'émojis dans l'UI.
4. **Pas de jargon SaaS** :
   - ❌ "Dashboard" → ✅ "Tableau de bord"
   - ❌ "Onboarding" → ✅ "Démarrage"
   - ❌ "Checkout" → ✅ "Paiement"
   - ❌ "Settings" → ✅ "Paramètres"
   - ❌ "Listing" → ✅ "Annonce" / "Service"
5. **Pas de jargon métier non expliqué** côté client. Un client B2C ne sait pas ce qu'est "KYC".
6. **Erreurs constructives** :
   - ❌ "Erreur"
   - ✅ "Cette adresse n'est pas dans la zone de livraison du pro. Essayez un pro plus proche."
7. **Confirmations rassurantes** :
   - ❌ "OK"
   - ✅ "Votre demande est envoyée. Le pro répondra sous 48 h."
8. **Numéros et dates** : format français. *"15 juin 2025"* > *"06/15/25"*. *"1 200 €"* > *"$1,200.00"*.

### Tone matrix

| Contexte | Ton |
|----------|-----|
| Erreur utilisateur (faute) | Aidant, jamais culpabilisant |
| Erreur système | Honnête, transparent, action proposée |
| Succès simple | Sobre, pas surpromis |
| Action critique (annulation, suppression) | Solennel, sans drama |
| Onboarding | Encourageant, rassurant |
| Marketing / acquisition | Confiant, pas vendeur agressif |

### Glossaire à figer (à compléter au fil du projet)

| Terme | À utiliser | À éviter |
|-------|-----------|----------|
| Le pro | "professionnel", "prestataire", "pro" | "vendor", "merchant", "fournisseur" |
| Le client | "client", "organisateur" | "consumer", "user" |
| L'achat | "réservation" | "commande", "achat" |
| L'annonce | "service", "annonce" | "listing", "produit" |
| L'avis | "avis" | "review", "évaluation" |
| Le paiement | "paiement" | "checkout", "transaction" |

---

## J. Anti-patterns à éviter

Liste explicite de ce qu'**on ne veut pas** sur Tukio. Le designer doit explicitement les écarter.

### Couleurs

- ❌ **Pastels mariage** (rose poudré, sauge, beige rosé) — exclut B2B
- ❌ **Néons tech** (violet électrique, cyan vif) — froid, peu sérieux
- ❌ **Primaires saturées** (rouge vif, bleu Facebook, vert WhatsApp) — cheap
- ❌ **Gradients holographiques / iridescents** — vibe IA-générée, vieillit en 6 mois
- ❌ **Multi-couleurs flashy** (palette rainbow) — manque de personnalité
- ❌ **Noir pur ou blanc pur** — froid, clinique

### Composants & layouts

- ❌ **Glassmorphism / aurora** — trop tendance, vieillit vite
- ❌ **Ombres très diffuses partout** — alourdit, rend l'UI molle
- ❌ **Coins très arrondis (>20px) partout** — style "playful" excessif
- ❌ **Boutons qui font toute la largeur de l'écran** desktop (sauf cas spécifique)
- ❌ **Sidebars sur mobile** par défaut (préférer drawers)
- ❌ **Carrousels auto-play** sur la home — mauvais SEO et accessibilité
- ❌ **Modales en plein écran** systématiques (mobile excepté)

### Typo

- ❌ **Polices light / thin** sous 16px — illisibilité mobile
- ❌ **Justifier le texte** sur le web — espaces irréguliers, mauvaise lisibilité
- ❌ **Plus de 2-3 polices différentes** par page
- ❌ **Tout en MAJUSCULES** sur des paragraphes (acceptable sur très petits labels seulement)

### Animations

- ❌ **Bounce / spring exagéré** — pas le ton sober
- ❌ **Animations de fond auto** (particules, vagues) — distrayant, énergivore
- ❌ **Animations > 500ms** sur du contenu critique
- ❌ **Hover effects sur mobile** (pas de hover en touch)

### Photos & illustrations

- ❌ **Stock photos visibles** (Shutterstock générique) — perte de confiance immédiate
- ❌ **Illustrations Storyset / Undraw** — l'utilisateur les a vues 100 fois ailleurs
- ❌ **Modèles diversité forcée** (façon 3D Notion) — sonne faux
- ❌ **Mockup d'écrans non réalistes** (lorem ipsum visible…) — pas pro

### UX / contenu

- ❌ **Modales d'inscription forcée** dès la 2ᵉ visite
- ❌ **Pop-up newsletter** en cookie banner
- ❌ **Cookie banner intrusif** non conforme RGPD
- ❌ **Disable du JS pour vérifier que le user "n'est pas un bot"** (pratique honnie)
- ❌ **Form de contact en 15 champs** quand 4 suffisent
- ❌ **"Loading..." sans contexte** plus de 3 secondes

---

## K. Livrables attendus

### Phase 1 — Fondations (semaines 1-3)

1. **Recherche & moodboard** (1 semaine)
   - 3 directions visuelles présentées
   - Choix d'une direction par toi
2. **Identité visuelle** (1 semaine)
   - Logo (3 propositions → 1 finale)
   - Application : favicon, logo dark/light, social headers
3. **Design system v0** (1 semaine)
   - Design tokens dans Figma Variables (colors, typo, spacing, radius, shadows)
   - 1 ou 2 composants key (button, input) pour valider la direction

### Phase 2 — Composants & écrans clés (semaines 4-6)

4. **Component library** (Figma)
   - Tous les composants MVP du chapitre D
   - Variantes, états, tailles
   - Documentation (description, usage, props équivalent dev)
5. **Maquettes high-fi des 10 écrans MVP critiques** :
   1. Homepage
   2. Résultats de recherche
   3. Fiche service
   4. Panier / checkout
   5. Création service (assistant pro)
   6. Dashboard pro
   7. Calendrier dispo
   8. Conversation messagerie
   9. Mes réservations (client)
   10. Inscription / connexion

### Phase 3 — Parcours complets (semaines 7-9)

6. **Maquettes des 15-20 écrans MVP restants** (cf. liste section L)
7. **Prototype interactif** (Figma) des 3 parcours critiques :
   - Réservation client de bout en bout
   - Onboarding pro + 1ère fiche
   - Gestion d'une demande de résa (côté pro)

### Phase 4 — Handoff & guidelines (semaine 10)

8. **Guide d'usage** documenté dans Figma (do's & don'ts par composant)
9. **Spec de handoff dev** (mesures, tokens utilisés, états)
10. **Plan d'évolution V1** (composants à ajouter pour V1)

### Critères de qualité

Pour considérer un livrable accepté :

- ✅ Cohérent avec le présent document (palette, typo, tokens, anti-patterns)
- ✅ Responsive testé sur mobile / tablet / desktop
- ✅ Accessibilité vérifiée (contraste, focus states)
- ✅ Empty states + error states + loading states pour chaque écran
- ✅ Documenté en Figma (pas de "j'expliquerai")
- ✅ Pas de générique IA-vibes (cf. anti-patterns J)

---

## L. Workflow design — comment on s'organise

### Documentation produit fournie au designer

Au démarrage, le designer reçoit :

1. **`tukio_spec_v2.md`** — vision, versions, fonctionnalités
2. **`tukio_booking_paiements_deepdive.md`** — domaine booking et paiements détaillé
3. **`tukio_catalogue_deepdive.md`** — domaine catalogue détaillé
4. **`tukio_design_brief.md`** — ce document (Doc 0)

### Documents complémentaires à produire (par toi avec moi)

À créer **après** ce brief, **un par domaine fonctionnel**, structurés comme suit :

#### Doc 1 — Architecture d'information
- Sitemap global
- Navigation principale (client / pro / admin)
- Hiérarchie des écrans
- Permissions

#### Docs 2-9 — Flux UX par domaine

Pour chacun des 8 domaines fonctionnels (cf. spec v2 Partie 2) :
- User journeys complets
- Tous les écrans listés et nommés
- États & transitions (succès / erreur / chargement / vide / désactivé)
- Edge cases UI
- Tags MVP / V1 / V2 par écran
- Notes d'intention pour le designer

> **Reco** : on traite en priorité les flux UX des 3 domaines déjà deep-divés (Catalogue, Booking, Paiements) avant le reste. Le designer peut commencer dessus pendant qu'on rédige la suite.

### Cadence proposée

| Semaine | Toi | Designer |
|---------|-----|----------|
| 1 | Brief designer + valid Doc 0 | Recherche / moodboard |
| 2 | Doc 1 (sitemap) + valid identité | Logo + identité |
| 3 | Doc 2 (Catalogue UX flow) | Design system v0 |
| 4 | Doc 3 (Booking UX flow) | Components + écran 1-3 |
| 5 | Doc 4 (Paiements UX flow) | Écrans 4-6 |
| 6 | Docs 5-9 (autres domaines) | Écrans 7-10 |
| 7-9 | Validations itératives | Écrans 11-25 + prototype |
| 10 | Validation finale | Handoff |

### Validation & itérations

- **Revue tous les vendredis** : tu passes les livrables de la semaine en revue
- **Feedback structuré** : pas de "j'aime / j'aime pas". Format : *"Sur l'écran X, je vois Y, mais je m'attendais à Z parce que [user need]"*
- **Limite de 3 itérations majeures** par livrable pour éviter le scope creep design

### Outils

| Usage | Outil |
|-------|-------|
| Maquettes & design system | Figma |
| Prototypes | Figma (mode prototype) |
| Communication | Slack ou équivalent |
| Reviews async | Loom (vidéos courtes commentées) |
| Spec & docs | Markdown / Notion |
| Versioning | Figma (branches) |

---

## Annexe — Inventaire des écrans MVP

Liste exhaustive des écrans à concevoir pour le MVP, basée sur les 3 deep dives. Total : ~30 écrans.

### Côté client public (non connecté)

1. Homepage
2. Page catégorie (`/categorie/{slug}`)
3. Page sous-catégorie / type
4. Résultats de recherche (list view)
5. Résultats de recherche (map view)
6. Fiche service
7. Profil pro (page publique)
8. Inscription client
9. Connexion
10. Réinitialisation mot de passe
11. Pages légales (CGU, CGV, mentions, RGPD)

### Côté client connecté

12. Dashboard client (mes réservations en cours)
13. Détail d'une réservation
14. Annulation d'une réservation
15. Avis à laisser
16. Messagerie (liste conversations)
17. Conversation détail
18. Favoris
19. Paramètres profil
20. Paramètres paiement (factures, moyens de paiement)
21. Panier (mono-vendeur MVP)
22. Checkout (paiement Stripe)
23. Confirmation post-paiement

### Côté pro

24. Inscription pro (multi-étapes)
25. Onboarding pro (KYC + première fiche, wizard)
26. Dashboard pro
27. Mes services (liste)
28. Création / édition service (wizard)
29. Calendrier dispos
30. Demandes de réservation (à traiter)
31. Réservations confirmées (liste)
32. Détail réservation pro
33. Conversations pro
34. Paramètres pro (profil, RIB, KYC, abonnement)
35. Statistiques basiques (V1, simplifié au MVP)

### Côté admin (MVP minimal)

36. Login admin
37. Dashboard admin (vue d'ensemble)
38. Validation pros
39. Liste des transactions
40. Modération signalements
41. Gestion litiges

---

*Fin du brief design — version 1, à valider avec le designer dès l'onboarding.*
