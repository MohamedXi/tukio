# Tukio — Deep Dive : Booking & Paiements

> Document de référence pour les domaines les plus critiques du produit
> À lire en complément de `tukio_spec_v2.md` (Partie 2, sections 2.3 et 2.4)
> Audience : produit, dev, design, légal/compta

---

## Sommaire

- [A. Vue d'ensemble — cycle de vie d'une transaction](#a-vue-densemble--cycle-de-vie-dune-transaction)
- [B. Booking — Parcours détaillés](#b-booking--parcours-détaillés)
- [C. Paiements — Flows techniques](#c-paiements--flows-techniques)
- [D. Edge cases critiques](#d-edge-cases-critiques)
- [E. Décisions à valider](#e-décisions-à-valider)

---

## A. Vue d'ensemble — cycle de vie d'une transaction

Une transaction Tukio se décompose en **5 phases** qu'il faut garder en tête. Chaque phase a ses écrans côté client, ses notifications côté pro, ses appels Stripe, et ses risques de défaillance.

### Schéma macro

```
PHASE 1 — DÉCOUVERTE          PHASE 2 — INTENTION         PHASE 3 — TRANSACTION
┌──────────────────┐          ┌──────────────────┐         ┌──────────────────┐
│ Client cherche   │  →       │ Client ajoute au │   →     │ Paiement Stripe  │
│ Voit fiches      │          │ panier / demande │         │ Création résa    │
│ Compare          │          │ devis            │         │ Notif pro        │
└──────────────────┘          └──────────────────┘         └──────────────────┘
                                                                    │
                                                                    ▼
PHASE 5 — CLÔTURE             PHASE 4 — EXÉCUTION
┌──────────────────┐          ┌──────────────────┐
│ Reversement pro  │  ←       │ Pro accepte      │
│ Avis             │          │ Événement a lieu │
│ Facturation      │          │ Confirmation     │
└──────────────────┘          └──────────────────┘
```

### Phases — vue rapide

| Phase | Acteur principal | Durée typique | Risque max |
|-------|------------------|---------------|-------------|
| 1. Découverte | Client | minutes à jours | Abandon avant ajout panier |
| 2. Intention | Client | minutes | Abandon panier |
| 3. Transaction | Client + Stripe | secondes | Échec paiement |
| 4. Exécution | Pro | jours à mois | Refus pro / litige |
| 5. Clôture | Système + Pro | jours | Fonds bloqués / disputes |

---

## B. Booking — Parcours détaillés

### B.1 Parcours "Réservation directe" (MVP — mono-vendeur, paiement intégral)

C'est le parcours **par défaut du MVP**. Tous les autres parcours sont des dérivations de celui-ci. Si ce parcours est nickel, le MVP marche.

#### Étape 1 — Recherche & découverte

**Écran 1.1 — Page d'accueil**
- Hero : barre de recherche unique (catégorie + ville + date)
- Catégories en avant
- Témoignages clients (preuve sociale, vide au début → cacher tant que < 5 avis publiés)
- CTA pro : "Vous êtes professionnel ? Rejoignez Tukio"

**Écran 1.2 — Résultats de recherche**
- Filtres : prix (slider), note minimum, distance, dispo aux dates choisies
- Tri : pertinence (default), prix croissant, note, distance
- Carte interactive (toggle list/map)
- État vide : "Pas encore de pro disponible aux dates choisies — laissez-nous votre email pour être prévenu"

**Écran 1.3 — Fiche service**
- Carrousel photos
- Titre, pro (avec note agrégée), zone de livraison
- Prix unitaire OU forfait OU "Sur devis"
- Description longue
- Avis (3 derniers + lien vers tous)
- Sélecteur de dates + quantité
- Bouton "Vérifier la disponibilité" → "Réserver"
- Encart "À propos du pro" avec lien vers profil pro complet

**Décisions UX à figer :**
- Voir la dispo en temps réel avant de saisir les dates ? **Oui** — calendrier interactif qui grise les jours indisponibles. C'est ce qui marche sur Airbnb, Booking, etc. C'est aussi un fort signal de confiance.
- Afficher le prix TTC ou HT ? **TTC en B2C, switch HT/TTC pour B2B** (V1). Au MVP : TTC partout puisque pas de B2B.

#### Étape 2 — Ajout au panier & checkout

**Écran 2.1 — Récapitulatif panier**
- Liste des items (1 seul au MVP, mono-vendeur)
- Détail prix : sous-total + frais livraison + TVA = total
- Coordonnées de livraison (adresse événement)
- Coordonnées de facturation (différentes ou identiques)
- Politique d'annulation appliquée (résumé clair)
- CGV à cocher
- CTA "Procéder au paiement"

**Écran 2.2 — Paiement Stripe**
- Stripe Elements embarqué (pas de redirection)
- 3DSecure si déclenché (banque)
- Loading state pendant la confirmation

**Écran 2.3 — Confirmation**
- "Votre demande de réservation est envoyée au pro"
- Récap de la commande
- Statut : "En attente d'acceptation par le pro (sous 48 h max)"
- Numéro de commande
- Email de confirmation envoyé en parallèle
- Lien vers la conversation messagerie avec le pro

**État UX critique : "j'ai payé mais c'est pas encore confirmé"**
C'est psychologiquement dur pour le client. Il faut surcommuniquer :
- Indiquer clairement *"Aucun montant n'a encore été débité"* (avec capture d'autorisation différée — voir section C)
- Compteur visuel : "Le pro a 48 h pour répondre"
- Message "Si le pro ne répond pas, vous serez automatiquement remboursé"

#### Étape 3 — Acceptation pro

**Côté pro :**

**Écran 3.1 — Notification**
- Email + push (V1) + SMS (option en V1, payant)
- Subject email : "Nouvelle demande de réservation — répondez sous 48 h"
- Lien direct vers la résa dans le dashboard

**Écran 3.2 — Détail de la demande dans dashboard pro**
- Détails client (nom, prénom, email, téléphone) — *attention : seulement après acceptation* pour anti-désintermédiation au MVP. À reconsidérer si ça frustre les pros.
- Service réservé, dates, quantité
- Lieu de livraison
- Montant total + commission Tukio + ce que le pro touchera
- Bouton "Accepter" / "Refuser" / "Demander modification"
- Champ message libre (optionnel)

**Décision à prendre : la commission est-elle visible côté pro ?**
**Recommandation : OUI**, et même mise en avant. Transparence totale. Affichage du type :
> Total client : 600,00 €
> Commission Tukio (10 %) : 60,00 €
> **Vous touchez : 540,00 €** *(reversé sous 24 h après l'événement)*

C'est plus honnête et ça réduit le risque de désintermédiation.

#### Étape 4 — Confirmation & exécution

Une fois acceptation pro :
- Capture du paiement Stripe
- Email au client : "Votre réservation est confirmée"
- Échange d'infos de contact débloqué (téléphone du pro visible)
- Conversation ouverte pour finaliser logistique

**Avant l'événement :**
- Email rappel à J-7 (pro et client)
- Email rappel à J-1 (pro et client)
- Lien "Modifier ma réservation" actif jusqu'à J-7 (selon politique d'annulation)

**Après l'événement (J+1) :**
- Email client : "Comment s'est passé votre événement ?" → demande d'avis
- Transfer Stripe vers le pro (J+1 minuit)
- Marquage résa = `completed`

#### États de la réservation

```
┌─────────────────────────────┐
│ draft (panier non payé)     │
└──────────┬──────────────────┘
           │ Paiement Stripe OK (capture différée)
           ▼
┌─────────────────────────────┐
│ pending_pro_acceptance      │ ← Timeout 48h → cancelled_timeout
└──┬──────────────────────────┘
   │ Pro accepte                Pro refuse
   ▼                            ▼
┌─────────────┐            ┌──────────────────┐
│ confirmed   │            │ refused_by_pro   │
└──┬──────────┘            └──┬───────────────┘
   │ Date événement passée      │ Refund auto
   ▼                            ▼
┌─────────────┐            ┌──────────────────┐
│ completed   │            │ refunded         │
└──┬──────────┘            └──────────────────┘
   │ Avis envoyé après 24h
   ▼
┌─────────────┐
│ reviewed    │
└─────────────┘

Branches alternatives depuis confirmed :
- cancelled_by_client (selon CGV → refund partiel/total/aucun)
- cancelled_by_pro (refund total + pénalité pro)
- modified (avenant validé par les deux parties)
- disputed (litige ouvert, fonds gelés)
```

---

### B.2 Parcours "Demande de devis" (V1)

Pour les services packagés ou sur devis, le client envoie une demande **avant** de payer.

#### Différences clés vs réservation directe

1. **Pas d'engagement financier** au moment de la demande
2. **Échange messagerie** avant tout paiement
3. **Le pro construit un devis personnalisé** (montant, conditions, contenu)
4. **Le client accepte le devis** → flux paiement standard à partir de là

#### Workflow

**Étape 1 — Demande**
- Sur la fiche service : "Demander un devis" au lieu de "Réserver"
- Formulaire structuré :
  - Date (ou plage)
  - Lieu
  - Nombre d'invités / quantité
  - Description libre du besoin
  - Budget approximatif (optionnel mais recommandé)
- Le pro reçoit la demande dans son inbox messagerie

**Étape 2 — Élaboration du devis**
- Pro envoie un devis structuré (pas du texte libre) :
  - Lignes : description + quantité + prix unitaire + total
  - Conditions (paiement, annulation, livraison)
  - Validité du devis (30 jours par défaut)
- Possibilité d'aller-retour de négociation (le devis a des versions)

**Étape 3 — Acceptation devis**
- Le client accepte → bascule directement en flow paiement
- Le devis devient le récapitulatif de commande
- À partir de là : flow réservation directe standard

#### Décisions à figer

- **Quel format pour le devis ?** Recommandation : devis structuré côté Tukio (pas un PDF uploadé), car il faut pouvoir le transformer en commande. Génération PDF en sortie possible.
- **Le pro peut-il modifier les conditions par rapport à sa fiche standard ?** Oui pour le devis personnalisé, sinon ça n'a pas d'intérêt. *Mais* la politique d'annulation reste celle de Tukio (pas de zones grises).
- **Délai de réponse cible pro pour un devis ?** Notif rappel à 24h, demande explicite "Le pro répond généralement en X heures" sur la fiche. Pas de pénalité au début.

---

### B.3 Parcours "Panier multi-vendeurs" (V1)

**Le parcours le plus complexe.** Tout le risque produit/technique est concentré ici.

#### Le problème à résoudre

Un client organise un événement → veut 50 chaises (Pro A) + 1 tente (Pro B) + traiteur (Pro C). Il veut :
- **Une seule expérience d'achat** (sinon il va sur 3 sites différents)
- **Un seul paiement** (pas saisir sa CB 3 fois)
- **Une seule facture client** (lisibilité)
- **Une seule conversation** (ou alors bien organisées)

Mais en interne il y a 3 transactions distinctes, 3 acceptations, 3 reversements, 3 SAV potentiels.

#### Architecture choisie

**Une "commande" (`Order`) qui contient N "réservations" (`Booking`), chacune avec un pro.**

```
Order (id, client, total, payment_intent_id, status)
  ├── Booking_1 (pro_A, items, status, transfer_id)
  ├── Booking_2 (pro_B, items, status, transfer_id)
  └── Booking_3 (pro_C, items, status, transfer_id)
```

#### Modèle d'acceptation : "par pro" (pas atomique)

Décision validée plus tôt. Chaque `Booking` est accepté/refusé indépendamment.

**Conséquence sur le paiement :**
- Le client paie le total à Stripe → autorisation pour le total
- **Capture progressive** : on capture seulement la part des pros qui acceptent au fil de l'eau
- Si tous acceptent → capture totale
- Si certains refusent → capture partielle + autorisation libérée pour le reste

**⚠ Limite Stripe à anticiper :** Stripe ne permet pas de capture partielle multiple sur un seul PaymentIntent (seulement *une* capture, totale ou partielle). Donc :
- **Solution recommandée** : N PaymentIntents séparés (un par pro/booking) regroupés via une `Order` côté Tukio. Le client ne voit qu'un seul checkout, mais en backend c'est N intents.
- **Avantage** : indépendance complète, capture/refund par booking sans impact sur les autres
- **Inconvénient** : N relevés bancaires côté client (ex : 3 lignes sur le relevé). À gérer en com : "Vous verrez plusieurs lignes sur votre relevé, une par prestataire — montant total inchangé"

**Alternative à considérer** : Stripe Checkout avec `transfer_data[destination]` par item, mais limité dans la flexibilité de captures différées.

#### Workflow client

**Étape 1 — Constitution du panier**
- Le client ajoute des services de N pros
- Le panier groupe par pro (visuellement) : "Pro A — 320 €", "Pro B — 280 €"
- Affichage clair : "Cette commande contient des prestataires différents. Chacun acceptera sa partie indépendamment."
- Sous-totaux par pro + total général

**Étape 2 — Checkout**
- Un seul écran de paiement
- Stripe Elements
- Confirmation : "Vous serez débité au total de X € — chaque prestataire confirmera sa partie sous 48 h"

**Étape 3 — Suivi de la commande**
- Page "Ma commande" avec **statut par booking** :
  - "Pro A — ✅ Confirmé"
  - "Pro B — ⏳ En attente"
  - "Pro C — ❌ Refusé — vous serez remboursé sous 5 jours"
- Vue temporelle claire (pas une seule status pour la commande entière)

#### Workflow pro

Chaque pro ne voit *que sa partie* du panier. Il ne sait pas qu'il y a d'autres pros impliqués (sauf info contextuelle utile : "Cette commande fait partie d'un événement multi-prestataires").

**À considérer** : permettre au pro de voir les autres pros impliqués peut créer de la coordination spontanée (le pro tente A appelle le traiteur Pro B pour caler la livraison). Mais ça ouvre aussi la porte à la désintermédiation. **Reco MVP : non visible. V1 : visible une fois la commande confirmée par tous.**

#### Edge cases multi-vendeurs

| Cas | Solution |
|-----|----------|
| 1 pro sur 3 refuse | Refund partiel auto au client. Reste de la commande continue. |
| 1 pro ne répond pas (timeout 48 h) | = refus implicite. Refund partiel auto. |
| Tous les pros refusent | Refund total. Commande passée en `cancelled`. |
| 1 pro accepte puis annule plus tard | Refund de sa partie + flag pénalité pour le pro. |
| Client veut annuler l'ensemble | Politique d'annulation appliquée *par booking* (chaque pro a potentiellement sa politique). Affichage clair de l'impact financier avant validation. |
| Panier mixte direct + sur devis | **Pas géré au V1.** Soit tout en direct, soit tout en devis. À cadrer V2 si besoin. |

---

### B.4 Parcours "Modification de réservation" (V1)

Une fois la résa confirmée, les deux parties peuvent vouloir modifier (dates, quantités, options).

#### Workflow

1. **L'initiateur (client OU pro)** propose une modification structurée :
   - Nouveaux paramètres
   - Impact sur le prix (calcul automatique)
   - Justification (champ texte)
2. **L'autre partie** reçoit une notif et doit accepter/refuser
3. **Si accepté** :
   - Si plus cher → débit complémentaire au client
   - Si moins cher → refund partiel
   - Si à coût constant → simple update des paramètres
4. **Si refusé** → la résa originale tient

#### Règles métier

- Pas de modification possible à moins de J-7 (sauf accord exceptionnel admin)
- Pas de modification possible si la résa est en `disputed`
- Trail d'audit : on garde la version originale ET la version modifiée

---

### B.5 Parcours "Annulation"

#### Annulation par le client

**Avant acceptation pro** : libre, refund total automatique.

**Après acceptation pro** : application de la matrice d'annulation.

**Écran d'annulation client :**
- Récap de la résa
- Politique appliquée (avec calcul transparent) :
  > "Vous annulez 12 jours avant l'événement. Selon les conditions, vous serez remboursé à 50 % (300 € sur 600 €)."
- Champ raison (optionnel mais recommandé pour analytics)
- Confirmation explicite (modale)

#### Annulation par le pro après acceptation

C'est **grave** : c'est la pire expérience client possible. Politique stricte :

- Refund **total** automatique au client (incluant frais Tukio absorbés)
- Notification immédiate au client avec excuses + suggestions de re-booking sur services similaires
- **Pénalité pro** :
  - 1ʳᵉ fois : avertissement
  - 2ᵉ fois : suspension publication 7 jours
  - 3ᵉ fois : downgrade Business → Starter forcé + suspension 30 jours
  - 4ᵉ fois : bannissement
- Note réciproque négative impossible à éviter pour le pro

#### Annulation pour cause "force majeure"

Cas réels : décès, hospitalisation, incident grave. Workflow particulier :
- Demande exceptionnelle traitée par admin
- Justificatifs demandés
- Décision au cas par cas, possibilité de geste commercial Tukio

---

## C. Paiements — Flows techniques

### C.1 Architecture Stripe Connect

#### Comptes et liens

```
┌────────────────────────────────────┐
│   Tukio (Plateforme Stripe)        │
│   - account_id principal           │
│   - 1 connected account par pro    │
└────┬───────────────────────────────┘
     │
     ├─── Pro A → acct_1234 (Express, FR)
     ├─── Pro B → acct_5678 (Express, FR)
     └─── Pro C → acct_9012 (Express, FR)
```

#### Modèle de flux : "Destination charge"

Le client paie sur le compte Tukio, et Stripe transfère automatiquement (ou différé) au compte connecté du pro, en gardant la commission.

```javascript
// Création PaymentIntent côté Tukio (mono-vendeur)
const paymentIntent = await stripe.paymentIntents.create({
  amount: 60000, // 600 € en centimes
  currency: 'eur',
  capture_method: 'manual', // ⚠ capture différée — clé !
  application_fee_amount: 6000, // 60 € de commission Tukio
  transfer_data: {
    destination: 'acct_1234', // pro A
  },
  metadata: {
    booking_id: 'bkg_abc123',
    order_id: 'ord_xyz789',
  },
});
```

**Pourquoi `capture_method: manual` ?**
- Au moment du checkout, on **autorise** le paiement (réservation des fonds sur la CB du client) mais on ne **capture** pas encore.
- La capture se fait *quand le pro accepte*.
- Si le pro refuse ou timeout → on annule l'autorisation, le client n'est jamais débité.

**⚠ Limite : autorisation valide 7 jours max sur Stripe** (sauf cartes pro 30 jours). Si la résa est dans 6 mois et que le pro accepte tout de suite, il faut capturer immédiatement à l'acceptation. C'est OK : entre acceptation et événement, c'est Tukio qui détient les fonds, pas Stripe.

#### Webhooks critiques à gérer

Liste minimale pour le MVP :

| Webhook | Action |
|---------|--------|
| `payment_intent.succeeded` | Capture confirmée → marquer booking `confirmed` (si on capture immédiatement) ou `pending_pro_acceptance` (si capture différée) |
| `payment_intent.payment_failed` | Échec paiement → afficher erreur au client, ne pas créer la résa |
| `payment_intent.canceled` | Autorisation annulée (timeout pro) → marquer booking `refused_by_pro` |
| `charge.refunded` | Refund effectué → marquer booking `refunded` + email client |
| `charge.dispute.created` | Chargeback bancaire → URGENCE : alerter admin, geler les fonds pro |
| `transfer.created` | Reversement effectué → log + notif pro |
| `account.updated` (Connect) | Changement de statut KYC pro → update UI pro (ex : "documents requis") |

**Règle d'or : tous les webhooks Stripe doivent être idempotents** (ne jamais traiter 2 fois le même event). Stripe peut renvoyer un webhook plusieurs fois.

```javascript
// Pseudo-code idempotence
async function handleWebhook(event) {
  const existing = await db.webhookEvents.findOne({ stripe_event_id: event.id });
  if (existing) return; // déjà traité, on ignore

  await db.transaction(async (trx) => {
    await processEvent(event, trx);
    await trx.webhookEvents.insert({
      stripe_event_id: event.id,
      processed_at: now(),
    });
  });
}
```

---

### C.2 Splits multi-vendeurs (V1)

Comme évoqué en B.3, l'architecture retenue : **N PaymentIntents distincts**, regroupés côté Tukio par une entité `Order`.

```javascript
// Création d'une commande multi-vendeurs
async function createMultiVendorOrder(cart) {
  const order = await db.orders.create({ client_id: cart.client_id, status: 'pending' });

  const intents = await Promise.all(
    cart.bookings.map(booking =>
      stripe.paymentIntents.create({
        amount: booking.total_cents,
        currency: 'eur',
        capture_method: 'manual',
        application_fee_amount: booking.commission_cents,
        transfer_data: { destination: booking.pro_stripe_account_id },
        metadata: {
          order_id: order.id,
          booking_id: booking.id,
          pro_id: booking.pro_id,
        },
      })
    )
  );

  return { order, intents };
}
```

**UX côté client :**
- Stripe Elements présente N paiements, mais on simule un **paiement unique** en confirmant les intents en série dans le browser (avec un seul écran 3DS si plusieurs).
- En pratique, la plupart des wallets et 3DS gèrent bien ce flow.

**Alternative** : si Stripe sort `Subscription Schedules` ou nouveaux outils dédiés, à reconsidérer. Vérifier la doc Stripe au moment du dev.

---

### C.3 Acomptes et échéanciers (V1)

#### Cas standard : acompte 30 % à la résa, solde à J-7

```
T=0 (résa)         T=J-7              T=J (événement)
   │                  │                    │
   ├──30% capturé───→ ├──70% capturé────→ │
   │                  │                    │
   │                  │                    │
   Client : autorisation totale (100%)
   Capture : par tranches selon échéancier
```

**Implémentation Stripe :**
- Option A : 1 PaymentIntent avec capture totale, mais on attend J-7. ❌ Limite des 7 jours.
- Option B : 1 PaymentIntent avec capture partielle (30 %) à T=0, puis nouveau PaymentIntent à J-7 sur une carte sauvegardée. ✅ Marche.
- Option C : Stripe `SetupIntent` pour sauvegarder la carte + facturer à dates voulues. ✅ Plus propre.

**Recommandation : option C** (`SetupIntent` + paiements offline déclenchés par cron à dates voulues).

```javascript
// À la résa
const setupIntent = await stripe.setupIntents.create({
  customer: client.stripe_customer_id,
  usage: 'off_session',
});
// Confirmer côté client → carte sauvegardée

// Premier paiement (acompte)
await stripe.paymentIntents.create({
  amount: depositAmount,
  customer: client.stripe_customer_id,
  payment_method: paymentMethodId,
  off_session: true,
  confirm: true,
  /* ...transfer_data, application_fee_amount */
});

// Deuxième paiement (solde) — déclenché par cron à J-7
await stripe.paymentIntents.create({
  amount: balanceAmount,
  customer: client.stripe_customer_id,
  payment_method: paymentMethodId,
  off_session: true,
  confirm: true,
  /* ... */
});
```

**⚠ Risque carte expirée / refusée à la 2ᵉ échéance :**
- Stripe envoie un événement `payment_intent.payment_failed`
- Tukio tente 3 fois sur 7 jours
- Si toujours échec → notif client + admin (gestion manuelle)
- Si pas de paiement → résa peut être annulée par le pro (sans pénalité pour lui)

**Recommandation UX** : afficher au client à H-72 avant le solde un email *"Vérifiez que votre carte est valide"* avec lien vers gestion moyens de paiement.

---

### C.4 Refunds

#### Cas et politiques

| Cas | Type refund | Délai | Qui paie ? |
|-----|-------------|-------|------------|
| Pro refuse résa | Total | Auto (cancel autorisation) | Personne — pas de capture eu lieu |
| Annulation client (matrice CGV) | Partiel ou total | Manuel ou auto (selon délai) | Client perd la part non remboursée selon CGV |
| Annulation pro post-acceptation | Total + frais | Auto + investigation | **Tukio absorbe les frais Stripe** + applique pénalité pro |
| Litige résolu en faveur client | Partiel ou total | Manuel admin | Selon décision (pro perd la somme, ou Tukio fait geste commercial) |
| Chargeback bancaire | Selon résolution Stripe | 60 jours | Si pro perd : retenu sur ses transferts futurs. Si frauduleux : Tukio peut absorber. |

#### Refund après transfer effectué

**Cas problématique :** événement le 1er juin → transfer pro J+1 (2 juin) → litige ouvert le 5 juin → admin tranche en faveur client le 15 juin → il faut récupérer l'argent du pro.

Stripe permet de débiter le compte connecté du pro :

```javascript
await stripe.refunds.create({
  payment_intent: 'pi_xxx',
  reverse_transfer: true, // récupère l'argent du pro
  refund_application_fee: true, // récupère aussi la commission Tukio
});
```

Si le pro n'a pas assez de solde sur son compte Stripe (cash flow problem côté pro) → solde négatif → procédure de recouvrement Stripe + Tukio. À documenter dans les CGV pro : "Vous vous engagez à maintenir un solde suffisant…"

#### Frais Stripe en cas de refund

- **CB classique** : Stripe rembourse les frais. ✅
- **Apple Pay / Google Pay** : idem. ✅
- **SEPA Direct Debit (V1 B2B)** : frais NON remboursés. ⚠

À provisionner.

---

### C.5 Subscription billing (V1)

Stripe Connect (pour les paiements clients) et Stripe Billing (pour les abos pros) sont **deux produits Stripe distincts** mais peuvent cohabiter.

#### Architecture

```
Pro Tukio
  ├── Compte connecté Stripe (Express) → pour recevoir paiements clients
  └── Customer Stripe (sur Tukio platform account) → pour payer son abo Business
```

Le pro a donc *deux relations Stripe* :
1. Il *reçoit* de l'argent via son compte connecté
2. Il *paie* Tukio pour son abo via un Customer + Subscription

#### Workflow upgrade Starter → Business

1. Pro clique "Passer Business" dans dashboard
2. Tukio crée un `Customer` Stripe + une `Subscription` (avec trial 14 jours)
3. Le pro saisit sa CB → carte sauvegardée pour facturation récurrente
4. Webhook `customer.subscription.created` → bascule du tier Tukio → commission passe à 10 %
5. Email confirmation + facture première période

#### Webhooks subscription critiques

| Webhook | Action |
|---------|--------|
| `customer.subscription.created` | Tier upgrade → MAJ commission |
| `customer.subscription.updated` | Changement de plan, période, etc. |
| `customer.subscription.deleted` | Résiliation → downgrade automatique vers Starter |
| `invoice.payment_succeeded` | Paiement abo OK → conserver tier |
| `invoice.payment_failed` | Paiement échoué → relances Stripe (smart retries) |
| `customer.subscription.trial_will_end` | Trial bientôt fini → email pro J-3 |

**Règle critique** : le tier Tukio est dérivé de l'état Stripe Subscription, **jamais l'inverse**. Si Stripe dit "subscription canceled", Tukio bascule en Starter, point. Pas de "free Enterprise" possible par bug de sync.

---

### C.6 TVA et facturation

#### Les 3 cas TVA à gérer

**Cas 1 — Pro non assujetti (micro-entrepreneur en franchise de TVA)**
- Mention obligatoire sur facture : *"TVA non applicable, art. 293 B du CGI"*
- Prix affiché = prix payé
- **Tukio** doit collecter et reverser la TVA sur **sa propre commission** (Tukio est assujetti dès le 1er euro)
- Le pro reçoit donc : (montant TTC client) − (commission Tukio HT) − (TVA sur commission Tukio collectée par Tukio)

**Cas 2 — Pro assujetti, client B2C (particulier FR)**
- TVA 20 % collectée par le pro et reversée à l'État
- Tukio collecte sa TVA sur sa commission (B2B avec le pro)
- 2 factures : Tukio → Client (au nom du pro, mandat de facturation) + Tukio → Pro (commission)

**Cas 3 — Pro assujetti, client B2B intra-UE**
- Si client a un n° TVA intra-UE valide → autoliquidation, mention *"Autoliquidation, art. 283-2 du CGI"*, montant HT facturé
- Sinon → TVA 20 % FR

#### Mandat de facturation

Tukio facture **au nom et pour le compte** du pro. C'est légalement possible mais nécessite :
- Mandat signé entre Tukio et chaque pro (à l'inscription)
- Facture qui mentionne Tukio comme émetteur ET le pro comme prestataire
- Numérotation **continue par pro** (pas par Tukio)

**Mention type** :
> "Facture émise par Tukio au nom et pour le compte de [Nom du Pro] — SIRET [XXX] — en application de l'article 289 du CGI"

#### Numérotation des factures

- Séquence continue, sans saut, par pro
- Format suggéré : `TUK-{pro_id_court}-{année}-{numéro_séquentiel}` → `TUK-A12-2025-0042`
- Alternative : `{pro_siren}-{année}-{numéro}` si on veut être strict sur le rattachement légal au pro

#### Conservation

- 10 ans pour les factures (obligation FR)
- Stockage immuable (pas de suppression possible, même par admin)
- Format PDF/A pour archivage long terme
- Backup off-site quotidien

#### ⚠ Avertissement

**Je ne suis pas comptable.** Tout ce bloc TVA/facturation **doit être validé par un expert-comptable spécialisé e-commerce/marketplace** avant le code. Risque de redressement fiscal très lourd si mal fait. C'est probablement le risque #1 du projet en termes de coût potentiel.

Coût indicatif d'une consultation : 500-1500 € pour un audit complet de la mécanique. Pas négociable.

---

## D. Edge cases critiques

Liste consolidée des cas qui ont déjà tué d'autres marketplaces. À tester systématiquement avant chaque release.

### D.1 Race conditions sur disponibilités

**Scénario :** 2 clients réservent le dernier créneau dispo en même temps (ms d'écart).

**Solution technique :**
- Lock Redis pendant la durée du checkout (10 minutes max)
- Vérification *après* paiement Stripe : si le slot est pris depuis, refund auto + message d'excuse
- Vérification *idempotente* dans la transaction DB de création de booking

```javascript
async function reserveSlot(serviceId, dates) {
  const lockKey = `slot:${serviceId}:${dates.start}-${dates.end}`;
  const lock = await redis.set(lockKey, clientId, 'NX', 'EX', 600); // lock 10min
  if (!lock) throw new Error('SLOT_BEING_BOOKED');

  // ... process booking ...

  await redis.del(lockKey);
}
```

### D.2 Dispute Stripe (chargeback) longtemps après l'événement

**Scénario :** Client conteste le paiement 45 jours après l'événement (mauvaise expérience, ou fraude CB).

**Conséquences :**
- Stripe gèle le montant + 15 € de frais
- Si Tukio ne fournit pas de preuve sous 7-21 jours → perte automatique
- Si le pro a déjà été reversé → solde négatif côté pro

**Solution :**
- **Évidence trail** systématique : conserver toutes les preuves d'exécution (avis, échanges messagerie, photos livraison si pertinent, signatures de réception)
- Workflow automatique : à chaque dispute → admin alerté + UI dédiée pour soumettre les preuves
- CGV pro qui prévoient le débit en cas de dispute perdue

### D.3 Pro qui ferme son compte Stripe Connect en cours de résa

**Scénario :** Pro a une résa confirmée pour dans 3 mois → il désactive son compte Stripe (par erreur ou de mauvaise foi).

**Conséquences :** Tukio ne peut plus lui transférer les fonds.

**Solution :**
- Webhook `account.application.deauthorized` → flag urgent admin
- Email + SMS pro pour ré-onboarding immédiat
- Si pro ne réagit pas sous 7 jours → bascule des résas en `at_risk`, email proactif au client (transparence)

### D.4 Données fiscales pro qui changent en cours de résa

**Scénario :** Pro était en franchise TVA → dépasse les seuils en cours d'année → devient assujetti. Mais les résas en cours ont été créées sur l'ancien régime.

**Solution :**
- Snapshot du régime fiscal au moment de la création de chaque résa
- La facture est émise selon le régime au moment de la résa, pas au moment de la facturation
- Le pro doit régulariser au prochain événement (notif Tukio)

### D.5 Modification de prix du service après résa

**Scénario :** Le pro change ses tarifs → résas existantes restent au prix d'origine.

**Solution :**
- Snapshot du prix dans la table `bookings` au moment de la création
- Le service peut évoluer, les bookings sont des **photos figées**

### D.6 Refund partiel sur commande multi-vendeurs avec code promo

**Scénario :** Client a -10 % de promo sur 600 € → paie 540 €. 1 pro refuse (200 € de sa partie). Combien rembourser ?

**Solution :**
- Le code promo est appliqué *au prorata* de chaque booking
- Refund proratisé : (200 / 600) × 540 = 180 € remboursés
- Le client garde la promo sur le reste de la commande

À documenter clairement dans les CGV.

### D.7 Annulation pour non-paiement du solde (échéancier)

**Scénario :** Acompte 30 % payé. Solde refusé par la banque le jour du prélèvement.

**Solution :**
- 3 tentatives Stripe sur 7 jours
- Si toujours échec → email client + pro avec proposition :
  - Le client paie le solde sur lien de paiement direct (deadline 48 h)
  - Si rien : la résa est annulée, l'acompte est conservé selon politique d'annulation appliquée à la date d'annulation effective
- Pro alerté tout du long, peut décider d'attendre ou d'annuler

### D.8 Conflit entre statut Stripe et statut Tukio (sync drift)

**Scénario :** Webhook Stripe perdu (extrêmement rare mais possible) → on pense que la résa est confirmée alors que le paiement a échoué.

**Solution :**
- **Job de réconciliation quotidien** qui compare `bookings` côté Tukio avec `payment_intents` côté Stripe
- Toute divergence → alerte admin
- Permet de détecter aussi les bugs de code

---

## E. Décisions à valider

| # | Décision | Reco par défaut | Impact |
|---|----------|-----------------|--------|
| D-01 | Capture immédiate ou différée au MVP ? | Différée (manual capture) | Meilleure UX en cas de refus pro |
| D-02 | Visibilité commission côté pro ? | Visible et mise en avant | Transparence + anti-désintermédiation |
| D-03 | Coordonnées client visibles avant ou après acceptation ? | Après acceptation | Anti-désintermédiation |
| D-04 | Architecture multi-vendeurs : 1 ou N PaymentIntents ? | N PaymentIntents | Flexibilité capture/refund par pro |
| D-05 | Les pros se voient entre eux dans une commande multi ? | Non au V1, à reconsidérer V2 | Anti-désintermédiation |
| D-06 | Acompte par défaut au V1 : 30/70 ou 50/50 ? | 30/70 à J-7 | Standard du marché événementiel |
| D-07 | Politique annulation : imposée ou choisie par pro ? | Choisie par pro parmi 3 templates Tukio | Souplesse + cohérence |
| D-08 | SMS pour notifs critiques (acceptation, paiement) ? | Oui en V1 (option payante pour pro) | Urgence des résas événementielles |
| D-09 | Stripe Billing pour abos OU autre ? | Stripe Billing | Cohérence + pas un autre service à intégrer |
| D-10 | Mandat de facturation : générique ou personnalisé par pro ? | Générique signé à l'onboarding | Simplification |
| D-11 | Stockage factures : on platform ou Stripe Storage ? | On platform (Cloudflare R2) | Contrôle + immuabilité |
| D-12 | Période de conservation des messageries ? | 5 ans (litiges) | Conformité + utilité litige |
| D-13 | Géolocalisation auto à la connexion (pour search) ? | Oui avec consentement | UX améliorée |
| D-14 | Compte client unique ou séparation B2C/B2B ? | Unique avec tag "type" | Simplification, conversion B2C → B2B facilitée |
| D-15 | Devis : modifiable après envoi par le pro ? | Oui si pas encore accepté | Souplesse négociation |

---

## Annexes — référentiels rapides

### Statuts de réservation (booking)

| Status | Description | Action possible |
|--------|-------------|-----------------|
| `draft` | Panier non payé | Compléter checkout |
| `pending_pro_acceptance` | Payé, en attente pro | Pro accepte/refuse |
| `confirmed` | Pro a accepté | Modifier, annuler |
| `completed` | Événement passé | Avis, dispute |
| `reviewed` | Avis posté | Aucune |
| `refused_by_pro` | Pro a refusé | Aucune (refund auto) |
| `cancelled_by_client` | Client a annulé | Aucune |
| `cancelled_by_pro` | Pro a annulé après accepter | Pénalité pro |
| `cancelled_timeout` | Pro n'a pas répondu sous 48h | Aucune |
| `disputed` | Litige ouvert | Workflow litige |
| `refunded` | Remboursé (après dispute ou erreur) | Aucune |

### Statuts de paiement (payment intent côté Tukio)

| Status | Stripe equiv | Description |
|--------|--------------|-------------|
| `pending` | `requires_payment_method` | En attente de saisie CB |
| `processing` | `processing` | Stripe vérifie (3DS, etc.) |
| `authorized` | `requires_capture` | Autorisé, pas encore capturé |
| `captured` | `succeeded` | Argent débité |
| `partially_refunded` | `succeeded` + refund partiel | Refund partiel effectué |
| `refunded` | `succeeded` + refund total | Refund total effectué |
| `failed` | `requires_payment_method` (après échec) | Échec paiement |
| `canceled` | `canceled` | Autorisation annulée |

### Statuts d'abonnement pro

| Status | Description |
|--------|-------------|
| `none` | Starter (pas d'abo) |
| `trialing` | Période d'essai 14 j |
| `active` | Abo en cours, payé |
| `past_due` | Échec paiement, en relance |
| `canceled_at_period_end` | Résiliation programmée |
| `canceled` | Résilié, downgradé Starter |

---

*Fin du deep dive — version 1, à itérer après validation des 15 décisions.*
