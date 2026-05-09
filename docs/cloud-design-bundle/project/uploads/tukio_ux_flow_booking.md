# Tukio — UX Flow: Booking (Doc 3)

> Détail écran par écran du domaine booking : tunnel checkout customer, gestion des réservations côté customer et pro
> À lire après : `tukio_spec_v2.md` + `tukio_booking_paiements_deepdive.md` + `tukio_design_brief.md` + `tukio_information_architecture.md` + `tukio_ux_flow_catalog.md`
> Audience : designer (premier lecteur), produit, dev frontend

---

## Sommaire

- [A. Périmètre du document](#a-périmètre-du-document)
- [B. Customer side — checkout funnel](#b-customer-side--checkout-funnel)
- [C. Customer side — booking management](#c-customer-side--booking-management)
- [D. Pro side — request handling](#d-pro-side--request-handling)
- [E. Pro side — calendar management](#e-pro-side--calendar-management)
- [F. Edge cases & special states](#f-edge-cases--special-states)
- [G. Transitions map](#g-transitions-map)
- [H. Notifications during the flow](#h-notifications-during-the-flow)
- [I. Open design questions](#i-open-design-questions)

---

## A. Périmètre du document

### Ce que ce doc couvre

| Côté | Écrans | Cible |
|------|--------|-------|
| **Customer checkout** | Cart, shipping, checkout (payment), confirmation | MVP |
| **Customer booking management** | Bookings list, booking detail, cancellation, review form | MVP |
| **Pro request handling** | Pending requests, booking detail (pro view), accept/refuse modals | MVP |
| **Pro calendar** | Calendar view, date blocking, availability rules | MVP |

### Ce que ce doc ne couvre PAS

- **Le flow paiement Stripe Elements** côté technique (cf. `tukio_booking_paiements_deepdive.md` C.1)
- **Le détail messagerie** entre client et pro (doc Messagerie à venir)
- **Le détail des avis** (doc Avis à venir)
- **Multi-vendor cart** (V1 — sera traité dans une révision de ce doc)
- **Devis personnalisés** (V1 — doc séparé)

### Conventions du doc

Mêmes conventions que `tukio_ux_flow_catalog.md` : wireframes ASCII, notation `[Bouton]`, `→` pour transitions, tags `MVP`/`V1`/`V2`.

---

## B. Customer side — checkout funnel

### B.0 — Vue d'ensemble du tunnel

```
/service/{slug}
   │
   │ [Réserver] (avec dates, qty, adresse pré-remplis dans booking widget)
   ▼
/cart
   │
   │ [Continuer]
   ▼
/cart/shipping
   │
   │ [Continuer vers le paiement]
   ▼
[ Auth required — redirect vers Keycloak si non connecté ]
   │
   ▼
/cart/checkout
   │
   │ [Payer X €]
   ▼
[ Stripe processing ]
   │
   ▼
/cart/confirmation/{order_id}
   │
   │ [Voir ma réservation]
   ▼
/account/bookings/{id}
```

**Principes du tunnel** :
- **3 étapes max** entre `/service/{slug}` et le paiement
- **1 seul écran de paiement** (pas de redirection externe Stripe)
- **Auth différée** : on demande la connexion juste avant le paiement, pas avant
- **Pas de surprise** : le total final est visible dès `/cart`
- **Possibilité de revenir en arrière** sans perdre la sélection

---

### B.1 — Cart `MVP`

**URL** : `/cart`

**Source domaine** : 2.3 Booking

**Objectif** : récap de la sélection client, dernière chance de modifier, transition naturelle vers la suite.

> **MVP** : panier mono-vendeur (1 service unique d'1 seul pro). En V1 : multi-vendeurs.

#### Layout — desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  Étape 1 sur 3 : Votre panier                                       │
│  ●—●—●                                                              │
│  Panier  Livraison  Paiement                                        │
│                                                                     │
│  ┌────────────────────────────────────┬────────────────────────┐   │
│  │                                    │                        │   │
│  │  Votre sélection                   │  Récapitulatif         │   │
│  │                                    │                        │   │
│  │  ┌──────────────────────────────┐  │  Sous-total    1200 €  │   │
│  │  │ [Photo]  Chapiteau 100 m²    │  │  Options        150 €  │   │
│  │  │          Event Co Nantes ⭐4.7│  │  Livraison      45 €   │   │
│  │  │                              │  │  ─────────────────     │   │
│  │  │ Du 15 au 17 juin 2026 (3 j)  │  │  Total       1 395 €   │   │
│  │  │ Quantité : 1                 │  │                        │   │
│  │  │ Adresse : 12 rue X, Nantes   │  │  TVA incluse           │   │
│  │  │                              │  │                        │   │
│  │  │ Options sélectionnées :      │  │  [Continuer]           │   │
│  │  │ ✓ Éclairage LED (+150 €)    │  │                        │   │
│  │  │                              │  │  🔒 Paiement sécurisé  │   │
│  │  │ Sous-total : 1 395 €         │  │                        │   │
│  │  │                              │  └────────────────────────┘   │
│  │  │ [Modifier]   [Retirer]       │                                │
│  │  └──────────────────────────────┘                                │
│  │                                                                  │
│  │  💡 Bon à savoir                                                │
│  │  • Votre carte sera autorisée mais pas débitée                  │
│  │  • Vous serez débité·e quand le pro confirme                    │
│  │  • Le pro a 48h pour répondre, sinon refund auto                │
│  │                                                                  │
│  └──────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

#### Layout — mobile

- Step indicator simplifié en haut
- Récap empilé verticalement (sélection → totaux → CTA)
- CTA `[Continuer]` sticky en bas

#### Zones

1. **Step indicator** : 3 étapes (Panier / Livraison / Paiement), active sur "Panier"
2. **Section sélection** : la résa en cours avec photo, infos, prix
3. **Section récap (sticky desktop)** : sous-total + options + livraison + total + CTA
4. **Bloc "bon à savoir"** : rassurance sur le mécanisme capture différée

#### CTAs

- **Primary** : `[Continuer]` → `/cart/shipping`
- **Secondary** : `[Modifier]` → retour vers `/service/{slug}` avec params préservés
- **Tertiary** : `[Retirer]` → modale confirm "Vider le panier ?" → si oui, retour homepage

#### États

- **Default** : 1 service dans le panier
- **Empty** :
  ```
  Votre panier est vide

  Découvrez les pros de l'événementiel près de chez vous.

  [Explorer le catalogue]
  ```
- **Loading** : skeleton avec structure 2 colonnes
- **Service unavailable** (le service a été retiré pendant que le panier était ouvert) :
  - Banner d'alerte rouge en haut
  - "Ce service n'est plus disponible. Voici des alternatives proches : ..."
  - 3 cards de services similaires
- **Dates plus disponibles** (un autre client vient de réserver) :
  - Banner orange : "Les dates choisies ne sont plus disponibles"
  - Suggestion de dates alternatives
  - CTA "Modifier la sélection"

#### Notes design

- Le bloc "bon à savoir" est **critique pour la confiance** : c'est ce qui rassure le client sur le fait qu'il ne sera pas débité immédiatement. Ne pas le cacher dans une FAQ.
- Désactiver tout temps de chargement si on peut (state local pendant la transition vers shipping)

---

### B.2 — Shipping & billing addresses `MVP`

**URL** : `/cart/shipping`

**Source domaine** : 2.3 Booking + 2.4 Paiements

**Objectif** : collecter les infos client nécessaires (livraison événement, facturation) avec un minimum de friction.

#### Layout — desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  Étape 2 sur 3 : Adresses                                           │
│  ●—●—●                                                              │
│  Panier  Livraison  Paiement                                        │
│                                                                     │
│  ┌────────────────────────────────────┬────────────────────────┐   │
│  │                                    │                        │   │
│  │  Adresse de l'événement *          │  Récap (sticky)        │   │
│  │                                    │                        │   │
│  │  Adresse                           │  Chapiteau 100 m²      │   │
│  │  ┌──────────────────────────────┐  │  Du 15 au 17 juin      │   │
│  │  │ 12 rue des Lilas             │  │                        │   │
│  │  └──────────────────────────────┘  │  Sous-total   1200 €   │   │
│  │                                    │  Options       150 €   │   │
│  │  Code postal      Ville            │  Livraison      45 €   │   │
│  │  ┌────────┐  ┌──────────────────┐  │  ─────────────         │   │
│  │  │ 44000  │  │ Nantes           │  │  Total      1 395 €    │   │
│  │  └────────┘  └──────────────────┘  │                        │   │
│  │                                    │  [Continuer vers       │   │
│  │  Compléments (digicode, étage…)    │   le paiement]         │   │
│  │  ┌──────────────────────────────┐  │                        │   │
│  │  │                              │  │                        │   │
│  │  └──────────────────────────────┘  │                        │   │
│  │                                    │                        │   │
│  │  Instructions pour le pro          │                        │   │
│  │  (optionnel)                       │                        │   │
│  │  ┌──────────────────────────────┐  │                        │   │
│  │  │ Accès véhicule possible…     │  │                        │   │
│  │  └──────────────────────────────┘  │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────  │                        │   │
│  │                                    │                        │   │
│  │  Coordonnées de contact            │                        │   │
│  │                                    │                        │   │
│  │  Prénom *          Nom *           │                        │   │
│  │  ┌────────────┐  ┌─────────────┐   │                        │   │
│  │  │            │  │             │   │                        │   │
│  │  └────────────┘  └─────────────┘   │                        │   │
│  │                                    │                        │   │
│  │  Email *                           │                        │   │
│  │  ┌──────────────────────────────┐  │                        │   │
│  │  │                              │  │                        │   │
│  │  └──────────────────────────────┘  │                        │   │
│  │                                    │                        │   │
│  │  Téléphone *                       │                        │   │
│  │  ┌──────────────────────────────┐  │                        │   │
│  │  │                              │  │                        │   │
│  │  └──────────────────────────────┘  │                        │   │
│  │  Le pro vous contactera pour       │                        │   │
│  │  finaliser la livraison.           │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────  │                        │   │
│  │                                    │                        │   │
│  │  ☑ Adresse de facturation          │                        │   │
│  │     identique à l'adresse événem.  │                        │   │
│  │                                    │                        │   │
│  │  [Si décoché : adresse facturation │                        │   │
│  │   complète à saisir]               │                        │   │
│  │                                    │                        │   │
│  └────────────────────────────────────┴────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Zones

1. **Adresse événement** (lieu de livraison)
2. **Coordonnées contact** (nom, email, tel)
3. **Adresse de facturation** (identique par défaut)
4. **Récap (sticky)**

#### Comportement

- **Auto-complete adresse** : Mapbox / Google Places API
- **Vérification zone de livraison** : à la saisie du code postal/ville, vérification que le pro livre dans cette zone. Si non → message d'erreur "Le pro ne livre pas à cette adresse" + suggestions
- **Vérification frais de livraison** : recalcul du total en temps réel selon distance (mode "au km") ou forfait selon zone
- **Si user déjà connecté** : pré-remplir nom, email, téléphone depuis le profil
- **Si pas connecté** : on demande quand même les infos (création de compte automatique post-paiement avec ces infos, pas de blocage)

#### Validation

- Adresse complète obligatoire
- Code postal valide (5 chiffres FR)
- Email format valide
- Téléphone valide (FR ou international avec +)
- Au moins prénom + nom

#### États

- **Adresse hors zone** : message rouge in-line + le bouton "Continuer" reste actif mais ouvre une modale "Le pro ne livre pas ici. Voulez-vous chercher d'autres pros ?" → retour `/search`
- **Adresse non trouvée par autocomplete** : permettre saisie manuelle avec warning "Vérifiez bien l'adresse"
- **Update livraison après modif adresse** : transition douce du total avec animation des chiffres

#### CTAs

- **Primary** : `[Continuer vers le paiement]` → `/cart/checkout` (avec gate auth si non connecté)

---

### B.3 — Auth gate (transit)

**Comportement, pas un écran à proprement parler**

Si l'utilisateur n'est **pas connecté** au moment de cliquer "Continuer vers le paiement" depuis `/cart/shipping` :

```
Click [Continuer vers le paiement]
   ↓
Modale ou page de gate :
   "Connectez-vous ou créez un compte pour finaliser votre réservation"
   [Se connecter]   [Créer un compte]   [Continuer en invité]
   ↓
Si "Se connecter" → redirect Keycloak login
   - Login successful → callback → return to /cart/checkout
Si "Créer un compte" → redirect Keycloak registration
   - Register successful → email verification → callback → /cart/checkout
Si "Continuer en invité" → /cart/checkout (account créé en arrière-plan post-paiement)
```

**Décision UX importante (à arbitrer en F-01) :**

Soit on **force la création de compte** avant paiement (plus de données, meilleur funnel post-achat), soit on **autorise le checkout invité** (meilleur taux de conversion immédiat).

> **Reco** : autoriser le checkout invité au MVP, mais avec création de compte automatique post-paiement (l'email et le téléphone saisis sont utilisés pour créer un compte Keycloak, l'utilisateur reçoit un mail "définissez votre mot de passe"). Best of both worlds.

---

### B.4 — Checkout (payment) `MVP`

**URL** : `/cart/checkout`

**Source domaine** : 2.4 Paiements

**Objectif** : finaliser le paiement avec friction minimale et rassurance maximale.

#### Layout — desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  Étape 3 sur 3 : Paiement                                           │
│  ●—●—●                                                              │
│  Panier  Livraison  Paiement                                        │
│                                                                     │
│  ┌────────────────────────────────────┬────────────────────────┐   │
│  │                                    │                        │   │
│  │  Méthode de paiement               │  Récap (sticky)        │   │
│  │                                    │                        │   │
│  │  💳 Carte bancaire                 │  Chapiteau 100 m²      │   │
│  │     Visa, Mastercard, AmEx         │  Du 15 au 17 juin      │   │
│  │                                    │                        │   │
│  │  ┌──────────────────────────────┐  │  Adresse :             │   │
│  │  │ [Stripe Elements - card]     │  │  12 rue des Lilas      │   │
│  │  │                              │  │  44000 Nantes          │   │
│  │  │ N° de carte                  │  │                        │   │
│  │  │ ┌────────────────────────┐   │  │  Sous-total   1200 €   │   │
│  │  │ │ XXXX XXXX XXXX XXXX    │   │  │  Options       150 €   │   │
│  │  │ └────────────────────────┘   │  │  Livraison      45 €   │   │
│  │  │                              │  │  ─────────────         │   │
│  │  │ Date d'expir.   CVC          │  │  Total      1 395 €    │   │
│  │  │ ┌──────────┐ ┌────────┐      │  │  TVA incluse           │   │
│  │  │ │ MM/AA    │ │ 123    │      │  │                        │   │
│  │  │ └──────────┘ └────────┘      │  │  [Payer 1 395 €]       │   │
│  │  │                              │  │                        │   │
│  │  │ Nom sur la carte             │  │  🔒 Paiement sécurisé  │   │
│  │  │ ┌────────────────────────┐   │  │     Stripe             │   │
│  │  │ │                        │   │  │                        │   │
│  │  │ └────────────────────────┘   │  │                        │   │
│  │  └──────────────────────────────┘  │                        │   │
│  │                                    │                        │   │
│  │  ☐ Mémoriser ma carte pour mes    │                        │   │
│  │     prochaines réservations        │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────  │                        │   │
│  │                                    │                        │   │
│  │  Conditions                        │                        │   │
│  │                                    │                        │   │
│  │  ☑ J'accepte les CGV et la         │                        │   │
│  │     politique d'annulation         │                        │   │
│  │                                    │                        │   │
│  │  ⓘ Politique d'annulation :        │                        │   │
│  │  • > 30 j : remboursement total   │                        │   │
│  │  • 15-30 j : 50 %                  │                        │   │
│  │  • 7-15 j : 25 %                   │                        │   │
│  │  • < 7 j : aucun remboursement     │                        │   │
│  │                                    │                        │   │
│  │  ⓘ Comment ça marche ?             │                        │   │
│  │  1. Votre carte est autorisée      │                        │   │
│  │  2. Le pro a 48h pour confirmer   │                        │   │
│  │  3. À l'acceptation : débit        │                        │   │
│  │  4. Si refus : aucun débit         │                        │   │
│  │                                    │                        │   │
│  └────────────────────────────────────┴────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- **Stripe Elements embedded** (pas de redirection)
- **3DS si déclenché** : modale en overlay sans quitter la page
- **Bouton "Payer X €"** :
  - Désactivé tant que la card form n'est pas valide ET les CGV pas cochées
  - État loading pendant la confirmation Stripe (10-15s max)
  - Pas de double-click possible (disable instant après click)
- **Capture différée** : techniquement c'est `payment_method.create` + `payment_intent.confirm` avec `capture_method: manual`. Aucun débit immédiat.

#### États

- **Default** : formulaire prêt
- **Card validation error** : erreur in-line sous le champ (Stripe gère)
- **3DS challenge** : modale Stripe overlay, pas de quitter la page
- **Payment processing** : bouton en loading state ("Traitement... — Ne rafraîchissez pas la page")
- **Payment success** : redirect immédiat → `/cart/confirmation/{order_id}`
- **Payment failed** : message d'erreur clair + bouton "Réessayer" — pas de perte de données saisies
- **Authentication required (3DS échoué)** : message + retry
- **Card declined** : message clair, suggestion d'utiliser une autre carte

#### Notes design

- Tous les éléments de **rassurance** doivent être **visibles sans scroll** sur desktop : logo Stripe, "Paiement sécurisé", explication capture différée
- La politique d'annulation est affichée en clair, pas cachée derrière un lien
- Le bouton CTA porte le **montant exact** : "Payer 1 395 €" pas "Payer maintenant" (impact mesuré sur conversion)

---

### B.5 — Confirmation `MVP`

**URL** : `/cart/confirmation/{order_id}`

**Source domaine** : 2.3 Booking + 2.4 Paiements

**Objectif** : confirmer le succès, expliquer la suite, et rediriger vers le suivi.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                   ✓                                                 │
│           (icône de confirmation, sobre)                            │
│                                                                     │
│              Votre demande a bien été envoyée                       │
│                                                                     │
│  Numéro de commande : #TUK-2026-00042                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  [Photo]  Chapiteau 100 m² blanc chic                       │   │
│  │           Event Co Nantes                                   │   │
│  │                                                             │   │
│  │  Du 15 au 17 juin 2026                                      │   │
│  │  12 rue des Lilas, 44000 Nantes                             │   │
│  │                                                             │   │
│  │  Total autorisé : 1 395 € TTC                               │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Et maintenant ?                                                    │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │  1️⃣            │  │  2️⃣            │  │  3️⃣            │        │
│  │                │  │                │  │                │        │
│  │  Pro reçoit    │  │  Confirmation  │  │  Préparation   │        │
│  │  votre demande │  │  sous 48h max  │  │  événement     │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                     │
│  📧 Un email de confirmation vous a été envoyé à                    │
│     contact@example.com                                             │
│                                                                     │
│  💡 Bon à savoir                                                   │
│  • Aucun montant n'a encore été débité                             │
│  • Vous pouvez échanger avec le pro dès maintenant                 │
│  • Si le pro ne répond pas sous 48h, refund automatique            │
│                                                                     │
│  [Voir ma réservation]   [Échanger avec le pro]                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- Page accessible **uniquement** après un paiement réussi (vérification token côté serveur)
- Si le user accède à l'URL plus tard (refresh, bookmark) : redirect vers `/account/bookings/{id}` après auth
- En arrière-plan : tracking analytics (conversion event), email envoyé, notification pro envoyée

#### CTAs

- **Primary** : `[Voir ma réservation]` → `/account/bookings/{id}`
- **Secondary** : `[Échanger avec le pro]` → `/account/messages/{conversation_id}` (créée automatiquement)

#### Notes design

- Le **"aucun montant débité"** doit être **très visible**. C'est ce qui calme l'anxiété du client.
- Compter le bénéfice psychologique de la **timeline visuelle** "1️⃣ → 2️⃣ → 3️⃣" : ça ancre la suite et réduit le besoin de relancer
- Pas de confettis, pas d'animations célébratoires (sober design — cf. design brief J)

---

## C. Customer side — booking management

### C.1 — Bookings list `MVP`

**URL** : `/account/bookings`

**Source domaine** : 2.3 Booking

**Objectif** : permettre au customer de retrouver ses réservations, voir leur statut, et agir.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Top bar customer]                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Mes réservations                                                   │
│                                                                     │
│  Filtres :  [Toutes (5)]  [À venir (2)]  [En attente (1)]          │
│             [Passées (2)]  [Annulées (0)]                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  En attente de confirmation                                 │   │
│  │                                                             │   │
│  │  [Photo]  Chapiteau 100 m² blanc chic                       │   │
│  │           Event Co Nantes                                   │   │
│  │           Du 15 au 17 juin 2026                             │   │
│  │           1 395 € (autorisé, non débité)                    │   │
│  │                                                             │   │
│  │           ⏳ Le pro a 36h pour répondre                     │   │
│  │                                                             │   │
│  │           [Voir détail]   [Messages (1)]                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Confirmé                                                   │   │
│  │                                                             │   │
│  │  [Photo]  100 chaises pliantes blanches                     │   │
│  │           Loca Events                                       │   │
│  │           Le 22 juin 2026 (dans 3 semaines)                 │   │
│  │           500 €                                             │   │
│  │                                                             │   │
│  │           [Voir détail]   [Messages]   [Annuler]            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Terminé · À évaluer                                        │   │
│  │                                                             │   │
│  │  [Photo]  Mobilier lounge - séminaire                       │   │
│  │           Event Co Nantes                                   │   │
│  │           Le 5 mai 2026                                     │   │
│  │           2 100 €                                           │   │
│  │                                                             │   │
│  │           ⭐ Comment s'est passé votre événement ?          │   │
│  │           [Laisser un avis]                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Filtres rapides (tabs)

- **Toutes** (default)
- **À venir** : bookings avec date événement future, status `confirmed`
- **En attente** : status `pending_pro_acceptance`
- **Passées** : status `completed` ou `reviewed`
- **Annulées** : status `cancelled_*` ou `refunded`

#### Card par réservation — variantes selon statut

| Statut | Header de card | CTA principal | CTA secondaires |
|--------|----------------|---------------|-----------------|
| `pending_pro_acceptance` | "En attente de confirmation" + ⏳ countdown | Voir détail | Messages |
| `confirmed` | "Confirmé" | Voir détail | Messages, Annuler |
| `completed` | "Terminé · À évaluer" | Laisser un avis | Voir détail |
| `reviewed` | "Terminé" | Voir détail | — |
| `cancelled_*` | "Annulé" | Voir détail | — |
| `refused_by_pro` | "Refusé par le pro · Refund effectué" | Voir détail | Voir d'autres pros |

#### États

- **Empty** :
  ```
  Vous n'avez pas encore de réservation

  Découvrez les pros de l'événementiel près de chez vous.

  [Explorer le catalogue]
  ```
- **Loading** : 3 skeleton cards
- **Error** : message + retry

---

### C.2 — Booking detail (customer view) `MVP`

**URL** : `/account/bookings/{id}`

**Source domaine** : 2.3 Booking

**Objectif** : tout savoir sur sa réservation, agir si besoin (annuler, messager, laisser un avis).

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Retour à mes réservations                                        │
│                                                                     │
│  Chapiteau 100 m² blanc chic                                        │
│  Réservation #TUK-2026-00042 · En attente de confirmation           │
│                                                                     │
│  ┌────────────────────────────────────┬────────────────────────┐   │
│  │                                    │                        │   │
│  │  Statut                            │  Actions disponibles   │   │
│  │  ⏳ En attente de confirmation     │                        │   │
│  │  Le pro a 36h pour répondre        │  [Messages (1)]        │   │
│  │                                    │  [Annuler]             │   │
│  │  Suivi de la demande                │  [Modifier] (V1)       │   │
│  │  ●─○─○─○                            │                        │   │
│  │  Demandée  Acceptée  Préparation    │                        │   │
│  │            Réalisée                 │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────                          │   │
│  │                                    │                        │   │
│  │  Détails                           │                        │   │
│  │                                    │                        │   │
│  │  [Photo]  Event Co Nantes          │                        │   │
│  │           ⭐ 4.7 (27 avis)          │                        │   │
│  │           [Voir le profil]         │                        │   │
│  │                                    │                        │   │
│  │  Dates                             │                        │   │
│  │  Du 15 juin au 17 juin 2026 (3 j)  │                        │   │
│  │                                    │                        │   │
│  │  Lieu                              │                        │   │
│  │  12 rue des Lilas                  │                        │   │
│  │  44000 Nantes                      │                        │   │
│  │                                    │                        │   │
│  │  Quantité                          │                        │   │
│  │  1 chapiteau                       │                        │   │
│  │                                    │                        │   │
│  │  Options                           │                        │   │
│  │  ✓ Éclairage LED guirlandes        │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────                          │   │
│  │                                    │                        │   │
│  │  Détail du paiement                │                        │   │
│  │                                    │                        │   │
│  │  Sous-total              1 200 €   │                        │   │
│  │  Options                   150 €   │                        │   │
│  │  Livraison                  45 €   │                        │   │
│  │  ─────────────                     │                        │   │
│  │  Total                   1 395 €   │                        │   │
│  │  TVA incluse                       │                        │   │
│  │                                    │                        │   │
│  │  Statut paiement                   │                        │   │
│  │  💳 Carte autorisée (••••4242)     │                        │   │
│  │  Aucun débit pour le moment        │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────                          │   │
│  │                                    │                        │   │
│  │  Politique d'annulation            │                        │   │
│  │  Standard                          │                        │   │
│  │  • > 30 j : 100 %                  │                        │   │
│  │  • 15-30 j : 50 %                  │                        │   │
│  │  • 7-15 j : 25 %                   │                        │   │
│  │  • < 7 j : aucun remboursement     │                        │   │
│  │                                    │                        │   │
│  │  Aujourd'hui à J-43 → 100 % rembrt │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────                          │   │
│  │                                    │                        │   │
│  │  Historique                        │                        │   │
│  │  • 02/05 14:32 — Demande envoyée   │                        │   │
│  │  • 02/05 14:32 — Email confirm.    │                        │   │
│  │                                    │                        │   │
│  └────────────────────────────────────┴────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Zones

1. **Status timeline** : 4 étapes ●─○─○─○ visuelles
2. **Pro card mini** : photo, nom, note, lien profil
3. **Détails de la résa** : dates, lieu, quantité, options
4. **Détail paiement** : breakdown total + statut paiement
5. **Politique d'annulation** : avec calcul actualisé selon date
6. **Historique** : événements timestampés (transparence)
7. **Actions sticky (droite desktop, bottom mobile)** : selon statut

#### CTAs selon statut

| Statut | Actions disponibles |
|--------|---------------------|
| `pending_pro_acceptance` | Messages, Annuler (libre, refund 100 %) |
| `confirmed` | Messages, Annuler (selon politique), Modifier (V1) |
| `completed` | Messages, Laisser un avis |
| `reviewed` | Messages, Voir mon avis |
| `cancelled_*` | Messages (lecture seule), Voir refund |
| `refused_by_pro` | Voir d'autres pros similaires |

---

### C.3 — Cancellation flow `MVP`

**URL** : `/account/bookings/{id}/cancel`

**Source domaine** : 2.3 Booking (cancellation policy)

**Objectif** : permettre au customer d'annuler en pleine connaissance de cause (impact financier transparent).

#### Layout — étape 1 : récap impact

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Retour à la réservation                                          │
│                                                                     │
│  Annuler votre réservation                                          │
│                                                                     │
│  Chapiteau 100 m² blanc chic                                        │
│  Du 15 au 17 juin 2026                                              │
│  Event Co Nantes                                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  Impact de l'annulation                                     │   │
│  │                                                             │   │
│  │  Date d'annulation : aujourd'hui (02/05)                    │   │
│  │  Date événement : 15/06 (J-44)                              │   │
│  │                                                             │   │
│  │  Selon la politique d'annulation :                          │   │
│  │  > 30 j → remboursement à 100 %                             │   │
│  │                                                             │   │
│  │  Vous serez remboursé·e de : 1 395,00 €                     │   │
│  │  Délai : 5 à 10 jours ouvrés                                │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Raison de l'annulation (optionnel)                                 │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ ▾ Choisir une raison                                    │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  Commentaire (optionnel)                                            │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                                                         │       │
│  │                                                         │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  [Conserver ma réservation]      [Confirmer l'annulation]           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Raisons proposées (dropdown)

- Mon événement est annulé
- Je change de prestataire
- Erreur lors de la réservation
- Le pro ne répond pas
- Autre

#### Étape 2 — modale de confirmation (destructive)

```
┌─────────────────────────────────┐
│  Confirmer l'annulation ?       │
│                                 │
│  Cette action est définitive.   │
│                                 │
│  Vous serez remboursé·e de :    │
│  1 395,00 €                     │
│                                 │
│  Délai : 5-10 jours ouvrés.     │
│                                 │
│  [Retour]  [Confirmer]          │
└─────────────────────────────────┘
```

#### Comportement

- Calcul du refund **dynamique** selon la date courante (si on annule à J-31 vs J-30, ce n'est pas la même chose)
- Si annulation = 100 % refund automatique → bouton "Confirmer" est en variante `secondary` (action neutre)
- Si annulation = 0 % refund → bouton "Confirmer" en variante `danger` (rouge)
- Affichage clair de la perte si applicable : "Vous perdrez 1 395 € en annulant maintenant"

#### Post-annulation

Redirection vers une page de confirmation :

```
┌─────────────────────────────────┐
│  ✓                              │
│  Votre réservation est annulée  │
│                                 │
│  Refund : 1 395 €               │
│  Délai : 5-10 jours ouvrés      │
│                                 │
│  📧 Confirmation envoyée par    │
│     email                       │
│                                 │
│  [Retour à mes réservations]    │
│  [Découvrir d'autres pros]      │
└─────────────────────────────────┘
```

---

### C.4 — Review form `MVP`

**URL** : `/account/bookings/{id}/review`

**Source domaine** : 2.7 Avis (déclenché depuis 2.3 Booking)

**Objectif** : collecter un avis qualitatif post-événement.

> **Note** : le détail complet du flow Avis sera dans le Doc 5 (UX Flow Reviews). Ici, juste l'écran de formulaire pour cohérence du flow booking.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Retour à la réservation                                          │
│                                                                     │
│  Comment s'est passé votre événement ?                              │
│                                                                     │
│  Chapiteau 100 m² blanc chic                                        │
│  Event Co Nantes · Le 15 juin 2026                                  │
│                                                                     │
│  Note globale *                                                     │
│  ☆ ☆ ☆ ☆ ☆                                                        │
│                                                                     │
│  Votre commentaire *                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │ Décrivez votre expérience pour aider d'autres clients…      │   │
│  │                                                             │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Min 50 caractères                                                  │
│                                                                     │
│  💡 Bon à savoir                                                   │
│  Votre avis sera visible publiquement (votre prénom + initiale     │
│  de nom). Le pro pourra y répondre.                                 │
│                                                                     │
│  [Plus tard]                              [Publier mon avis]        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Validation

- Note obligatoire (1-5)
- Commentaire min 50 caractères
- Si note ≤ 2 → commentaire min 100 caractères (pour éviter "1 étoile sans contexte")

#### Comportement

- Avis modifiable pendant 30 jours
- Pas de modale de confirm (action constructive, pas destructive)

---

## D. Pro side — request handling

### D.1 — Pending requests dashboard widget `MVP`

**URL** : `/seller` (vu depuis le dashboard pro)

**Source domaine** : 2.3 Booking

**Objectif** : afficher les demandes urgentes en haut du dashboard pro pour qu'elles soient traitées rapidement.

#### Layout (zone du dashboard)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ⚠ À traiter (3)                                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⏳ Nouvelle demande · Reste 36h                            │   │
│  │                                                             │   │
│  │  [Photo client]  Marie Dupont                               │   │
│  │                  Chapiteau 100 m² · 15-17 juin              │   │
│  │                  1 395 € (vous toucherez 1 255 €)           │   │
│  │                  📍 12 rue des Lilas, Nantes                │   │
│  │                                                             │   │
│  │  [Refuser]                          [Voir détail / Accepter]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⏳ Nouvelle demande · Reste 12h ⚠                          │   │
│  │  ...                                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Voir toutes les demandes →]                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- **Tri** : urgence (countdown ascendant), puis date de demande
- **Coloration urgence** : orange si < 24h, rouge si < 6h
- **Affichage commission** : transparence totale "Total client X € — Commission Tukio Y € — Vous toucherez Z €"
- **Anti-désintermédiation** : nom du client visible (prénom + nom), mais email et téléphone **cachés** jusqu'à acceptation

---

### D.2 — Bookings list (pro view) `MVP`

**URL** : `/seller/bookings` ou `/seller/bookings?status=pending`

**Source domaine** : 2.3 Booking

**Objectif** : vue complète des demandes et réservations côté pro.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Réservations                                                       │
│                                                                     │
│  Filtres :  [À traiter (3)]  [Confirmées (8)]  [Terminées (12)]    │
│             [Annulées (1)]   [Toutes]                              │
│                                                                     │
│  Tri :  [Urgence ▾]                                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⏳ Reste 36h pour répondre                                 │   │
│  │  Marie Dupont · Chapiteau 100 m² · 15-17 juin               │   │
│  │  1 395 € (vous toucherez 1 255 €)                           │   │
│  │  📍 Nantes 44000                                             │   │
│  │  [Voir détail]                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ Confirmé · Événement dans 19 j                           │   │
│  │  Pierre Martin · 100 chaises · 22 juin                      │   │
│  │  500 € (vous toucherez 450 €)                               │   │
│  │  📍 Saint-Nazaire 44600                                      │   │
│  │  [Voir détail]   [Messages]                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ...                                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Tris possibles

- Urgence (default si filtre "À traiter")
- Date événement croissant
- Date événement décroissant
- Date demande
- Montant croissant / décroissant

---

### D.3 — Booking detail (pro view) `MVP`

**URL** : `/seller/bookings/{id}`

**Source domaine** : 2.3 Booking

**Objectif** : vue complète d'une demande pour permettre une décision éclairée (accepter / refuser / messager).

#### Layout — pour une demande `pending_pro_acceptance`

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Retour aux réservations                                          │
│                                                                     │
│  Demande de Marie Dupont · ⏳ Reste 36h pour répondre               │
│                                                                     │
│  ┌────────────────────────────────────┬────────────────────────┐   │
│  │                                    │                        │   │
│  │  Détails de la demande             │  Actions               │   │
│  │                                    │                        │   │
│  │  Service : Chapiteau 100 m²        │  [Accepter]            │   │
│  │  Quantité : 1                      │                        │   │
│  │                                    │  [Refuser]             │   │
│  │  Dates                             │                        │   │
│  │  Du 15 juin 2026 au 17 juin 2026   │  [Demander modif.] V1  │   │
│  │  (3 jours)                         │                        │   │
│  │                                    │  [Messages (0)]        │   │
│  │  Lieu                              │                        │   │
│  │  12 rue des Lilas                  │                        │   │
│  │  44000 Nantes                      │                        │   │
│  │  [Voir sur la carte]               │                        │   │
│  │  ~ 8 km de votre adresse           │                        │   │
│  │                                    │                        │   │
│  │  Options                           │                        │   │
│  │  ✓ Éclairage LED guirlandes        │                        │   │
│  │                                    │                        │   │
│  │  Instructions client               │                        │   │
│  │  "Accès véhicule possible jusqu'à  │                        │   │
│  │  10m du lieu de pose. Préférez     │                        │   │
│  │  livraison matin avant 10h."       │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────                          │   │
│  │                                    │                        │   │
│  │  Détail financier                  │                        │   │
│  │                                    │                        │   │
│  │  Total client          1 395 €     │                        │   │
│  │  Commission Tukio (10%) -140 €     │                        │   │
│  │  ─────────────                     │                        │   │
│  │  Vous toucherez       1 255 €      │                        │   │
│  │                                    │                        │   │
│  │  Reversement : J+1 après l'événem. │                        │   │
│  │  (≈ 18/06/2026)                    │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────                          │   │
│  │                                    │                        │   │
│  │  Client                            │                        │   │
│  │                                    │                        │   │
│  │  [Avatar]  Marie Dupont            │                        │   │
│  │            Membre depuis 2026      │                        │   │
│  │            1ʳᵉ réservation Tukio   │                        │   │
│  │                                    │                        │   │
│  │  Email et téléphone visibles       │                        │   │
│  │  après acceptation                 │                        │   │
│  │                                    │                        │   │
│  │  ─────────────────────────────────                          │   │
│  │                                    │                        │   │
│  │  Vérification dispos               │                        │   │
│  │  ✓ Aucune autre résa sur ces dates │                        │   │
│  │  ✓ Stock OK (2 / 2 dispos)         │                        │   │
│  │                                    │                        │   │
│  └────────────────────────────────────┴────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement — acceptation

Click sur `[Accepter]` → modale :

```
┌─────────────────────────────────────────┐
│  Confirmer l'acceptation ?              │
│                                         │
│  En acceptant, vous vous engagez à :    │
│                                         │
│  ✓ Honorer la réservation               │
│    Du 15 au 17 juin 2026                │
│                                         │
│  ✓ Livrer à l'adresse indiquée          │
│    12 rue des Lilas, 44000 Nantes       │
│                                         │
│  ✓ Le client sera débité de 1 395 €     │
│    Vous toucherez 1 255 €               │
│    (reversé après l'événement)          │
│                                         │
│  Message au client (optionnel)          │
│  ┌─────────────────────────────────┐   │
│  │ Bonjour Marie, je confirme…     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Retour]    [Confirmer l'acceptation]  │
└─────────────────────────────────────────┘
```

À l'acceptation :
- Booking → status `confirmed`
- Stripe : capture du paiement (`paymentIntent.capture()`)
- Email au client : "Votre réservation est confirmée"
- Coordonnées client (email, tel) débloquées côté pro
- Conversation messagerie créée (avec le message optionnel comme premier message)

#### Comportement — refus

Click sur `[Refuser]` → modale :

```
┌─────────────────────────────────────────┐
│  Refuser cette demande ?                │
│                                         │
│  Le client sera notifié et remboursé    │
│  intégralement.                         │
│                                         │
│  Raison du refus *                      │
│  ▾ Choisir une raison                  │
│                                         │
│  Message au client (recommandé)         │
│  ┌─────────────────────────────────┐   │
│  │ Bonjour, je suis désolé mais…   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Retour]               [Confirmer le   │
│                          refus]         │
└─────────────────────────────────────────┘
```

##### Raisons de refus (dropdown)

- Indisponible aux dates demandées
- Hors zone de livraison
- Quantité insuffisante en stock
- Demande incompatible avec mes conditions
- Autre

À la confirmation :
- Booking → status `refused_by_pro`
- Stripe : autorisation annulée (`paymentIntent.cancel()`)
- Email au client avec raison + suggestion d'autres pros

#### États selon statut booking

| Statut | Affichage | Actions disponibles |
|--------|-----------|---------------------|
| `pending_pro_acceptance` | Compte à rebours, encadré urgence | Accepter, Refuser, Messages, Demander modif (V1) |
| `confirmed` | Détails complets + coords client | Messages, Annuler (avec pénalité), Modifier (V1) |
| `completed` | Vue finale | Messages, Voir avis client (s'il existe) |
| `cancelled_by_client` | Détails + reason si fournie | Messages (lecture seule) |
| `refused_by_pro` | Vue archive | — |
| `disputed` | Banner urgent, encadré rouge | Voir le litige, Messages |

---

### D.4 — Modification request (V1)

**URL** : `/seller/bookings/{id}/edit` (pro initie) ou modifié depuis `/account/bookings/{id}` (client initie)

**Cible** : V1

**Objectif** : permettre au pro ou au client de proposer une modification (dates, quantité) avec validation de l'autre partie.

> Détaillé en V1, hors scope MVP.

---

## E. Pro side — calendar management

### E.1 — Calendar view `MVP`

**URL** : `/seller/calendar`

**Source domaine** : 2.2 Catalogue (disponibilités) + 2.3 Booking (résa visibles)

**Objectif** : vue d'ensemble des disponibilités, possibilité de bloquer/débloquer des dates.

#### Layout — vue mensuelle

```
┌─────────────────────────────────────────────────────────────────────┐
│  Calendrier                                                         │
│                                                                     │
│  Service :  ▾ Tous mes services (8) / Chapiteau 100 m²              │
│  Vue :      [Mois]  [Semaine]  [Jour]            [< Mai 2026 >]     │
│                                                                     │
│  Légende : 🟢 Dispo · 🟡 Partiel · 🔴 Complet · ⚫ Bloqué · 🔵 Résa  │
│                                                                     │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐                       │
│  │ Lun │ Mar │ Mer │ Jeu │ Ven │ Sam │ Dim │                       │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                       │
│  │     │     │     │     │  1  │  2  │  3  │                       │
│  │     │     │     │     │  🟢 │ 🔵  │ 🔵  │                       │
│  │     │     │     │     │     │ Pierre M.│  │                     │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                       │
│  │  4  │  5  │  6  │  7  │  8  │  9  │ 10  │                       │
│  │  🟢 │ 🟢 │ 🟢 │ 🟢 │ 🟢 │ 🟢 │ 🟢 │                       │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                       │
│  │ 11  │ 12  │ 13  │ 14  │ 15  │ 16  │ 17  │                       │
│  │ ⚫  │ ⚫  │ ⚫  │ 🟢 │ 🔵  │ 🔵  │ 🔵  │                       │
│  │ Vac.│ Vac.│ Vac.│     │ Marie D. (en attente) ⏳                 │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                       │
│  │ 18  │ 19  │ 20  │ 21  │ 22  │ 23  │ 24  │                       │
│  │  🟢 │  🟢 │ 🟢 │ 🟢 │ 🔵  │ 🔵  │ 🟢 │                       │
│  │     │     │     │     │ J. Lefèvre   │     │                    │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                       │
│  │ ... │     │     │     │     │     │     │                       │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘                       │
│                                                                     │
│  [+ Bloquer une période]    [Configurer les règles]                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- **Filtre service** : tous les services ou un service spécifique
- **Vue par défaut** : mois courant
- **Click sur jour** : panneau latéral avec détail (résa, blocages, actions)
- **Click sur résa** : redirect vers `/seller/bookings/{id}`
- **Drag-select sur calendrier** : sélectionner une plage pour bloquer
- **Code couleur** : vert (dispo), jaune (partiel — quantité < total), rouge (complet), noir/gris (bloqué manuellement), bleu (résa confirmée)

#### Vue détail d'un jour (panneau latéral)

```
┌─────────────────────────────┐
│  Vendredi 15 juin 2026      │
│                             │
│  Disponibilité : 🔵 Réservé │
│                             │
│  Réservation                │
│  ┌─────────────────────┐   │
│  │ Marie Dupont        │   │
│  │ Chapiteau 100 m²    │   │
│  │ 15-17 juin (3 j)    │   │
│  │ ⏳ En attente        │   │
│  │                     │   │
│  │ [Voir détail →]     │   │
│  └─────────────────────┘   │
│                             │
│  Stock                      │
│  1 / 2 dispo                │
│                             │
│  [Bloquer ce jour]          │
└─────────────────────────────┘
```

---

### E.2 — Block period modal `MVP`

**Trigger** : depuis `/seller/calendar` via `[+ Bloquer une période]` ou drag-select

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  Bloquer une période                                │
│                                                     │
│  Service                                            │
│  ▾ Tous mes services / Chapiteau 100 m²             │
│                                                     │
│  Du *           Au *                                │
│  ┌──────────┐  ┌──────────┐                         │
│  │ 11/05    │  │ 13/05    │                         │
│  └──────────┘  └──────────┘                         │
│                                                     │
│  Toute la journée                                   │
│  ☑ Oui                                              │
│                                                     │
│  Raison (interne, non visible client)               │
│  ┌────────────────────────────────────────────┐    │
│  │ Vacances                                   │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  ⚠ 1 demande de réservation est en attente sur    │
│  cette période. Si vous bloquez ces dates, la       │
│  demande sera automatiquement refusée.              │
│                                                     │
│  [Annuler]               [Bloquer ces dates]        │
└─────────────────────────────────────────────────────┘
```

#### Comportement

- Si conflit avec une résa `confirmed` : impossible (bloque l'action avec message)
- Si conflit avec une demande `pending_pro_acceptance` : avertissement (la demande sera refusée auto)
- Si conflit avec un autre blocage : merge les blocages

---

### E.3 — Recurring rules (V1)

**URL** : `/seller/calendar/rules`

**Cible** : V1

Permet de définir des règles récurrentes : "Indisponible tous les lundis", "Indisponible 1ʳᵉ semaine d'août chaque année", etc.

> Détaillé en V1, hors scope MVP.

---

## F. Edge cases & special states

### F.1 — Pro timeout (no response in 48h)

**Comportement** :
- Job cron (toutes les 15 min) : check des bookings `pending_pro_acceptance` avec `created_at` > 48h
- Pour chaque match :
  - Booking → `cancelled_timeout`
  - Stripe : `paymentIntent.cancel()` → autorisation annulée
  - Email customer : "Le pro n'a pas répondu, votre réservation est annulée. Aucun débit. Voici d'autres pros similaires."
  - Email pro : "Vous avez manqué une demande. Améliorez votre temps de réponse."
  - Stat impactée pour le pro (taux de réponse)

### F.2 — Customer cancels during pro pending

Customer peut annuler à tout moment pendant `pending_pro_acceptance`. Refund 100 % automatique (autorisation annulée). Pas de pénalité.

### F.3 — Conflit de disponibilité (race condition)

**Cas** : 2 customers tentent de réserver le même créneau au même moment.

**Workflow** :
1. Customer A click "Réserver" → lock Redis pour 10 min
2. Customer B click "Réserver" pendant le lock → erreur "Cette disponibilité est en cours de réservation, réessayez dans quelques minutes"
3. Customer A finalise paiement → booking créé, lock libéré
4. Customer B re-tente après 10 min → check disponibilité → "Plus disponible aux dates choisies"

**Edge case sur paiement réussi mais conflit DB** :
1. Customer A et B paient quasi-simultanément (hors lock pour raison X)
2. À la création de booking : transaction DB atomique → 1 réussit, l'autre échoue
3. Customer perdant : refund automatique Stripe + email d'excuse + suggestion alternative

### F.4 — Stripe webhook delayed/missed

**Cas** : webhook `payment_intent.succeeded` non reçu pour cause de panne réseau.

**Mitigation** :
- Job de réconciliation quotidien : compare bookings avec status `pending_pro_acceptance` vs Stripe paymentIntents
- Si divergence détectée : alerte admin + correction manuelle si nécessaire
- Idempotence sur webhook (cf. deep dive booking C.1)

### F.5 — Service supprimé entre cart et checkout

**Cas** : pro retire son service pendant que le customer est dans le tunnel.

**Comportement** :
- À chaque étape du tunnel : revérifier la disponibilité du service
- Si service supprimé → banner alerte "Ce service n'est plus disponible" + redirect vers homepage avec suggestion

### F.6 — KYC pro pas finalisé au moment de l'acceptation

**Cas** : pro a publié un service mais son KYC Stripe n'est pas encore validé. Une demande arrive, il accepte.

**Comportement** :
- Capture Stripe **échoue** (pas de compte Connect actif)
- Booking → status `confirmed` malgré tout MAIS flag `payment_pending`
- Email pro : "Finalisez votre KYC pour recevoir le paiement"
- Email client : aucun (pour ne pas inquiéter)
- Si KYC pas finalisé sous 7 jours → admin alerté → décision manuelle

---

## G. Transitions map

### G.1 — Customer side

```
/service/{slug}
   │ [Réserver]
   ▼
/cart
   │ [Continuer]
   ▼
/cart/shipping
   │ [Continuer vers le paiement]
   │ → Auth gate (si non connecté)
   ▼
/cart/checkout
   │ [Payer X €]
   │ → Stripe processing
   ▼
/cart/confirmation/{order_id}
   │ [Voir ma réservation]
   ▼
/account/bookings/{id}
   │
   ├── [Messages] → /account/messages/{conversation_id}
   ├── [Annuler] → /account/bookings/{id}/cancel
   │              │ [Confirmer]
   │              ▼ (post cancellation)
   │              /account/bookings (avec banner success)
   │
   └── [Laisser un avis] → /account/bookings/{id}/review
                            │ [Publier]
                            ▼
                            /account/bookings/{id} (avis publié)
```

### G.2 — Pro side

```
[Email notification "Nouvelle demande"]
   │ Click email
   ▼
/seller/bookings/{id}
   │
   ├── [Accepter] → modale confirm → /seller/bookings/{id} (confirmed)
   │                                  │
   │                                  └── [Messages] → /seller/messages/{conv}
   │
   ├── [Refuser] → modale confirm avec raison → /seller/bookings (filtre Refusées)
   │
   └── [Messages] → /seller/messages/{conv}

/seller (dashboard)
   │
   ├── Widget "À traiter" → /seller/bookings/{id}
   │
   └── Quick action "Voir calendrier" → /seller/calendar
                                          │
                                          └── Click jour → panneau détail
                                                           │
                                                           └── [Voir détail résa] → /seller/bookings/{id}
```

---

## H. Notifications during the flow

Synthèse des notifications envoyées pendant le flow booking. Cohérent avec `tukio_information_architecture.md` K.

### H.1 — Customer notifications

| Trigger | Email | In-app (V1) | SMS (V1) |
|---------|-------|-------------|----------|
| Booking créé (post-paiement) | ✅ "Votre demande est envoyée" | ✅ | — |
| Pro accepte | ✅ "Réservation confirmée" | ✅ | — |
| Pro refuse | ✅ "Demande refusée + alternatives" | ✅ | — |
| Pro timeout | ✅ "Aucune réponse, refund auto" | ✅ | — |
| Rappel J-7 | ✅ Logistique | — | — |
| Rappel J-1 | ✅ Logistique | — | — |
| Demande d'avis (J+1) | ✅ "Comment s'est passé l'événement" | ✅ | — |
| Refund effectué | ✅ Confirmation | ✅ | — |
| Annulation par pro | ✅ "Votre réservation est annulée" | ✅ | ✅ |

### H.2 — Pro notifications

| Trigger | Email | In-app (V1) | SMS (V1) |
|---------|-------|-------------|----------|
| Nouvelle demande | ✅ "Demande à traiter sous 48h" | ✅ | ✅ option payante |
| Rappel demande non traitée à H-24 | ✅ Urgence | ✅ | — |
| Rappel demande non traitée à H-6 | ✅ Urgence | ✅ | ✅ option |
| Customer annule | ✅ Notification + détails | ✅ | — |
| Reversement effectué | ✅ "Vous avez été payé X €" | ✅ | — |
| Avis reçu | ✅ "Nouvel avis ⭐⭐⭐⭐⭐" | ✅ | — |
| Litige ouvert | ✅ Urgence | ✅ | ✅ |

---

## I. Open design questions

| # | Question | Reco par défaut |
|---|----------|-----------------|
| F-01 | Force account creation avant paiement, ou checkout invité ? | **Checkout invité** + création compte automatique post-paiement |
| F-02 | Step indicator visible sur mobile ? | **Oui mais simplifié** (juste "Étape X sur 3") |
| F-03 | Affichage temps de réponse moyen pro sur fiche service ? | À partir de 5 demandes traitées |
| F-04 | Adresse facturation distincte par défaut ou identique ? | **Identique par défaut** (90 % des cas), checkbox pour décocher |
| F-05 | Confirmation post-paiement : page ou modale ? | **Page dédiée** — moment important, mérite l'écran |
| F-06 | Animation de succès post-paiement (confettis, etc.) ? | **Non** (sober design) — juste un check sobre |
| F-07 | Compte à rebours visible côté customer ? | **Oui** ("Le pro a 36h pour répondre") — transparence |
| F-08 | Visibilité du nom client côté pro avant acceptation ? | **Prénom + nom**. Email/tel cachés. |
| F-09 | Modale de confirmation à l'acceptation pro ? | **Oui** — c'est un engagement contractuel |
| F-10 | Calendrier pro : vue par défaut mois ou semaine ? | **Mois** sur desktop, **semaine** sur mobile |
| F-11 | Sticky récap (panier) sur mobile ? | **Bottom sheet collapsable** |
| F-12 | Auto-refresh status booking pendant qu'on regarde la page ? | **Polling toutes les 30s** côté customer (pour voir l'acceptation pro live), pas de polling agressif |
| F-13 | Feedback utilisateur après refund (timing affiché) ? | **5-10 jours ouvrés** — explicite, pas "quelques jours" |
| F-14 | Possibilité de modifier sa résa après acceptation ? | V1 (workflow d'avenant) — au MVP : annuler + nouvelle résa si besoin |

---

*Fin du UX Flow Booking — version 1, à itérer avec le designer et après tests utilisateurs.*
