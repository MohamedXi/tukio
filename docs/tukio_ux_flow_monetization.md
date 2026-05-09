# Tukio — UX Flow: Monetization (Doc 6)

> Détail des parcours de gestion financière : abonnements pros, facturation customer, payouts pro, finance plateforme côté admin.
> À lire après : `tukio_spec_v2.md` (§2.4 et §2.5) + `tukio_booking_paiements_deepdive.md` + `tukio_ux_flow_booking.md` (tunnel checkout)
> Audience : designer, produit, dev frontend, dev backend (payment-svc + order-svc)

---

## Sommaire

- [A. Périmètre du document](#a-périmètre-du-document)
- [B. Customer billing screens](#b-customer-billing-screens)
- [C. Pro subscription management](#c-pro-subscription-management)
- [D. Pro billing & payouts](#d-pro-billing--payouts)
- [E. Pro accounting exports (V1)](#e-pro-accounting-exports-v1)
- [F. Admin finance dashboard](#f-admin-finance-dashboard)
- [G. Admin manual operations](#g-admin-manual-operations)
- [H. Communication patterns (emails financiers)](#h-communication-patterns-emails-financiers)
- [I. Compliance & legal display](#i-compliance--legal-display)
- [J. Open design questions](#j-open-design-questions)

---

## A. Périmètre du document

### Ce que ce doc couvre

| Domaine | Côté | Écrans / Flux | Cible |
|---------|------|---------------|-------|
| Customer billing | `/account/billing/*` | Moyens de paiement, factures | V1 |
| Pro subscription | `/seller/subscription/*` | Tiers, upgrade/downgrade, factures abo | V1 |
| Pro billing | `/seller/billing/*` | Factures émises, payouts reçus, exports | MVP / V1 |
| Admin finance | `admin.tukio.one/finance/*` | Commissions, MRR, refunds, reconciliation | MVP / V1 |
| Admin manual ops | Refunds manuels, ajustements | MVP |
| Emails transactionnels | Notifications financières | MVP |

### Ce que ce doc ne couvre PAS

- **Tunnel checkout customer** (cf. `tukio_ux_flow_booking.md` §B)
- **Politiques d'annulation et refunds clients** (cf. `tukio_ux_flow_booking.md` §C.3)
- **Stripe Connect onboarding pro** (cf. `tukio_ux_flow_auth_accounts.md` §C.3.3)
- **Architecture Stripe technique détaillée** (cf. `tukio_booking_paiements_deepdive.md` §C)
- **Workflow litiges** (cf. Doc 7 — Admin & Moderation à venir)

### Convention d'affinité

Ce doc regroupe deux domaines (Abonnements 2.5 + Paiements/Billing volet gestion 2.4) parce qu'ils partagent :
- La même infrastructure Stripe (Connect + Billing)
- Le même volet "back-office argent" (vs le volet transactionnel déjà couvert)
- Les mêmes interfaces visuelles (tableaux financiers, exports, factures)

---

## B. Customer billing screens

### B.0 Vue d'ensemble

```
/account/billing/
├── /methods               → Moyens de paiement enregistrés (V1)
└── /invoices              → Historique factures (V1)
```

> **Note MVP** : au MVP, pas de page dédiée billing. Les factures arrivent par email au moment du paiement, et le moyen de paiement est saisi à chaque réservation. La gestion des moyens de paiement persistents arrive en V1 avec les acomptes/échéanciers.

### B.1 — Payment methods `V1`

**URL** : `/account/billing/methods`

**Source domaine** : 2.4 Paiements

**Objectif** : permettre au customer de gérer ses cartes enregistrées pour les futures réservations et les paiements échelonnés.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Top bar customer]                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Mes moyens de paiement                                             │
│                                                                     │
│  Vos cartes sont stockées de manière sécurisée par Stripe.          │
│  Tukio n'a jamais accès à vos données bancaires complètes.          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💳 Visa se terminant par 4242        Carte par défaut      │   │
│  │     Expire 12/2027                                          │   │
│  │                                                             │   │
│  │     [Définir comme principale] [Supprimer]                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💳 Mastercard se terminant par 5555                        │   │
│  │     Expire 03/2026 ⚠ Expire bientôt                         │   │
│  │                                                             │   │
│  │     [Définir comme principale] [Supprimer]                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [+ Ajouter une carte]                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- **Ajout** : modale Stripe Elements (formulaire CB sécurisé)
- **Suppression** : modale de confirmation, refusée si carte attachée à un échéancier en cours
- **Carte par défaut** : utilisée pour les paiements échelonnés (acomptes V1) et pré-remplissage checkout

#### États

- **Empty** :
  ```
  Vous n'avez pas encore de moyen de paiement enregistré.
  Vos cartes seront enregistrées automatiquement après votre première réservation
  (avec votre consentement).

  [Ajouter une carte]
  ```
- **Carte expirée** : badge rouge, action "Mettre à jour" (V2)
- **Carte expire bientôt** (< 60 jours) : badge orange

---

### B.2 — Invoices history `V1`

**URL** : `/account/billing/invoices`

**Source domaine** : 2.4 Paiements (volet facturation)

**Objectif** : permettre au customer de retrouver et télécharger ses factures (notamment pour B2B).

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mes factures                                                       │
│                                                                     │
│  Filtres : [Toutes (8)] [Cette année] [2025] [Précédentes]         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📄 Facture TUK-EVN-2026-0042                                │   │
│  │     15 juin 2026                                            │   │
│  │     Event Co Nantes — Chapiteau 100 m²                      │   │
│  │     1 395,00 € TTC                                          │   │
│  │     Statut : ✓ Payée                                        │   │
│  │                                                             │   │
│  │     [Voir]   [Télécharger PDF]                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📄 Facture TUK-LOC-2026-0038                                │   │
│  │     22 mai 2026                                             │   │
│  │     Loca Events — 100 chaises pliantes                      │   │
│  │     500,00 € TTC                                            │   │
│  │     Statut : ✓ Payée                                        │   │
│  │                                                             │   │
│  │     [Voir]   [Télécharger PDF]                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📄 Facture TUK-EVN-2026-0028 (Avoir)                        │   │
│  │     5 mai 2026                                              │   │
│  │     Event Co Nantes — Refund partiel                        │   │
│  │     -210,00 € TTC                                           │   │
│  │     Statut : ✓ Émis                                         │   │
│  │                                                             │   │
│  │     [Voir]   [Télécharger PDF]                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Détails facture (page individuelle)

**URL** : `/account/billing/invoices/{id}`

Vue PDF-like dans le navigateur :

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Retour aux factures              [Télécharger PDF]               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  [Logo Tukio]                                               │   │
│  │                                                             │   │
│  │  FACTURE                                  N° TUK-EVN-2026-0042│
│  │                                          Date : 15/06/2026  │   │
│  │                                                             │   │
│  │  Émetteur (mandat de facturation)                           │   │
│  │  Tukio SAS au nom et pour le compte de :                    │   │
│  │  EVENT CO SARL                                              │   │
│  │  12 rue des Lilas — 44000 Nantes                            │   │
│  │  SIRET : 12345678901234                                     │   │
│  │                                                             │   │
│  │  Destinataire                                               │   │
│  │  Marie Dupont                                               │   │
│  │  18 avenue Carnot — 44000 Nantes                            │   │
│  │                                                             │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │                                                             │   │
│  │  Description           Qté    PU HT    Total HT    TVA      │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  Chapiteau 100 m²     1     1 000 €  1 000 €     20 %      │   │
│  │  Éclairage LED        1       125 €    125 €     20 %      │   │
│  │  Frais de livraison   1        37 €     37 €     20 %      │   │
│  │                                                             │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │                                                             │   │
│  │                                       Total HT   1 162,50 € │   │
│  │                                       TVA 20 %     232,50 € │   │
│  │                                       ─────────────────────  │   │
│  │                                       Total TTC  1 395,00 € │   │
│  │                                                             │   │
│  │  Mode de paiement : Carte bancaire (••••4242)               │   │
│  │  Date du paiement : 15/06/2026                              │   │
│  │                                                             │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │                                                             │   │
│  │  Facture émise par Tukio SAS au nom et pour le compte de    │   │
│  │  EVENT CO SARL en application de l'article 289 du CGI.      │   │
│  │                                                             │   │
│  │  Tukio SAS — RCS Nantes 123 456 789                         │   │
│  │  Siège : ... — TVA intracom : FR12345678901                 │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- Génération PDF côté serveur (`order-svc` avec template HTML → PDF via Puppeteer ou pdfkit)
- Stockage dans Cloudflare R2 (10 ans)
- Téléchargement direct du PDF
- Vue HTML responsive pour aperçu mobile

---

## C. Pro subscription management

### C.0 Vue d'ensemble — les 3 tiers (rappel)

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

### C.1 — Subscription overview `V1`

**URL** : `/seller/subscription`

**Source domaine** : 2.5 Abonnements professionnels

**Objectif** : permettre au pro de voir son tier actuel, comparer avec les autres, upgrade/downgrade.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Top bar pro]                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Mon abonnement                                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  Plan actuel : Business                                     │   │
│  │  29,00 € / mois — facturé tous les mois                     │   │
│  │                                                             │   │
│  │  Prochaine facturation : 1 juillet 2026                     │   │
│  │  Sur la carte se terminant par 4242                         │   │
│  │                                                             │   │
│  │  Avantages activés :                                        │   │
│  │  ✓ Commission réduite (10 % au lieu de 15 %)                │   │
│  │  ✓ Services illimités                                       │   │
│  │  ✓ Réponse aux avis                                         │   │
│  │  ✓ Stats avancées                                           │   │
│  │  ✓ 1 boost de mise en avant par mois                        │   │
│  │  ✓ Support sous 24 h                                        │   │
│  │                                                             │   │
│  │  [Changer de plan] [Modifier le moyen de paiement]          │   │
│  │  [Annuler mon abonnement]                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────          │
│                                                                     │
│  Comparer les plans                                                 │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ Starter      │ │ Business     │ │ Enterprise   │                │
│  │              │ │              │ │              │                │
│  │ Gratuit      │ │ 29 € / mois  │ │ Sur devis    │                │
│  │              │ │              │ │              │                │
│  │ Commission   │ │ Commission   │ │ Commission   │                │
│  │ 15 %         │ │ 10 %         │ │ 5 % + frais  │                │
│  │              │ │              │ │              │                │
│  │ ✓ 5 services │ │ ✓ Illimité   │ │ ✓ Illimité   │                │
│  │ ✗ Réponses   │ │ ✓ Réponses   │ │ ✓ Réponses   │                │
│  │ ✗ Stats      │ │ ✓ Stats      │ │ ✓ Stats avancées│             │
│  │ ✗ Boost      │ │ ✓ 1 / mois   │ │ ✓ Illimité   │                │
│  │ ✗ Équipe     │ │ ✓ 3 max      │ │ ✓ Illimité   │                │
│  │              │ │              │ │              │                │
│  │ [Plan actuel] │ │ Plan actuel  │ │ [Nous contact.]│             │
│  │              │ │ ●●● Plan en  │ │              │                │
│  │              │ │ cours        │ │              │                │
│  │              │ │              │ │              │                │
│  │ [Downgrader] │ │              │ │              │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│                                                                     │
│  💡 Le break-even pour passer de Starter à Business :               │
│  580 € de CA mensuel sur Tukio. Avec votre activité actuelle,       │
│  vous économisez ~120 € par mois en commission.                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- **Plan actuel** : highlighting visuel sur le card du tier en cours
- **CTA dynamique** par card selon le tier actuel :
  - Card du plan actuel : pas de CTA (juste badge "Plan actuel")
  - Card d'un plan supérieur : "Passer à X" → upgrade
  - Card d'un plan inférieur : "Downgrader vers X" → modale avec impact
  - Enterprise : toujours "Nous contacter" → ouvre formulaire
- **Calcul break-even** : algo simple basé sur historique CA du pro sur les 3 derniers mois

### C.2 — Subscription change flow `V1`

#### Upgrade Starter → Business

**URL** : `/seller/subscription/change?to=business`

#### Layout — étape 1 : récap

```
┌─────────────────────────────────────────────────────────────────────┐
│  Passer à Business                                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Récapitulatif                                              │   │
│  │                                                             │   │
│  │  Plan actuel : Starter (gratuit, commission 15 %)           │   │
│  │  Nouveau plan : Business                                    │   │
│  │                                                             │   │
│  │  ─────────────────────────────────────────────────────      │   │
│  │                                                             │   │
│  │  Frais d'abonnement      29,00 € HT / mois                  │   │
│  │  TVA 20 %                 5,80 € / mois                     │   │
│  │  ─────────────────────                                      │   │
│  │  Total mensuel TTC       34,80 € / mois                     │   │
│  │                                                             │   │
│  │  ─────────────────────────────────────────────────────      │   │
│  │                                                             │   │
│  │  Vos avantages immédiats :                                  │   │
│  │  ✓ Commission ramenée à 10 % (économie ~5 % sur futures résa)│  │
│  │  ✓ Services illimités (vous avez actuellement 4/5 utilisés) │   │
│  │  ✓ Réponse à vos avis                                       │   │
│  │  ✓ Stats avancées débloquées                                │   │
│  │  ✓ Support sous 24 h (vs 72 h)                              │   │
│  │                                                             │   │
│  │  ─────────────────────────────────────────────────────      │   │
│  │                                                             │   │
│  │  💡 Période d'essai gratuite de 14 jours                    │   │
│  │  Vous pouvez annuler à tout moment pendant les 14 premiers  │   │
│  │  jours sans être facturé·e.                                 │   │
│  │                                                             │   │
│  │  Première facturation : 20 mai 2026                         │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Annuler]                              [Continuer]                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Étape 2 — Saisie moyen de paiement

```
┌─────────────────────────────────────────────────────────────────────┐
│  Moyen de paiement                                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Stripe Elements - card form]                              │   │
│  │                                                             │   │
│  │  N° de carte                                                │   │
│  │  ┌────────────────────────────────────┐                     │   │
│  │  │ XXXX XXXX XXXX XXXX                │                     │   │
│  │  └────────────────────────────────────┘                     │   │
│  │                                                             │   │
│  │  Date d'expiration   CVC                                    │   │
│  │  ┌────────────┐ ┌────────┐                                  │   │
│  │  │ MM/AA      │ │ 123    │                                  │   │
│  │  └────────────┘ └────────┘                                  │   │
│  │                                                             │   │
│  │  Nom sur la carte                                           │   │
│  │  ┌────────────────────────────────────┐                     │   │
│  │  └────────────────────────────────────┘                     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ☑ J'accepte les CGV pros et autorise le prélèvement mensuel       │
│     de 34,80 € TTC                                                  │
│                                                                     │
│  ☐ Je préfère payer annuellement (à venir V2)                      │
│                                                                     │
│  [← Retour]                       [Activer Business]                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- Stripe Elements pour la carte (PCI-DSS compliant, pas de CB sur les serveurs Tukio)
- 3DS si déclenché par la banque
- Création abonnement Stripe Billing avec `trial_period_days: 14`
- Bascule du tier Tukio à `business` immédiatement (avantages activés)
- Webhook `customer.subscription.created` → met à jour `identity-svc.subscription_tier` et `payment-svc.commission_rate`

#### Étape 3 — Confirmation

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              ✓                                                      │
│                                                                     │
│      Bienvenue dans Business !                                      │
│                                                                     │
│  Votre essai gratuit a démarré.                                     │
│  Première facturation : 20 mai 2026 (dans 14 jours)                 │
│                                                                     │
│  Vos avantages sont déjà actifs.                                    │
│                                                                     │
│  📧 Email de confirmation envoyé.                                   │
│                                                                     │
│  [Découvrir les nouvelles fonctionnalités]                          │
│  [Retour au tableau de bord]                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### C.3 — Downgrade flow `V1`

#### Cas Business → Starter

**URL** : `/seller/subscription/change?to=starter`

#### Layout — récap impact

```
┌─────────────────────────────────────────────────────────────────────┐
│  Passer à Starter                                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⚠ Impact du downgrade                                      │   │
│  │                                                             │   │
│  │  Vos avantages Business seront perdus à partir du           │   │
│  │  1 juillet 2026 (fin de votre période en cours).            │   │
│  │                                                             │   │
│  │  Conséquences :                                             │   │
│  │                                                             │   │
│  │  • Commission : 15 % au lieu de 10 %                        │   │
│  │  • Vos 8 services publiés > limite Starter (5)              │   │
│  │    Les 3 services les plus récents passeront en             │   │
│  │    "non listés" jusqu'à ce que vous en archiviez d'autres.  │   │
│  │  • Vous ne pourrez plus répondre aux nouveaux avis          │   │
│  │  • Stats avancées désactivées                               │   │
│  │  • Vos 2 membres d'équipe perdront leur accès               │   │
│  │  • Support sous 72 h (vs 24 h)                              │   │
│  │                                                             │   │
│  │  ─────────────────────────────────────────────────────      │   │
│  │                                                             │   │
│  │  💰 Estimation de l'impact financier                        │   │
│  │                                                             │   │
│  │  Avec votre CA mensuel actuel (~3 200 €) :                  │   │
│  │  • Économie d'abonnement : +29 € / mois                     │   │
│  │  • Surcoût commission : -160 € / mois (5 % de plus)         │   │
│  │  ─────────────────────────────────────────────────────      │   │
│  │  Coût net estimé : -131 € / mois                            │   │
│  │                                                             │   │
│  │  Êtes-vous sûr·e de vouloir downgrader ?                    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Pourquoi downgradez-vous ? (optionnel)                             │
│  ▾ Sélectionnez une raison                                          │
│                                                                     │
│  Commentaire (optionnel)                                            │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                                                         │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  [Annuler — rester en Business]    [Confirmer le downgrade]         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Raisons de downgrade (dropdown — analytics churn)

- Trop cher
- Pas assez de fonctionnalités utiles
- Activité saisonnière, je reviendrai
- Je quitte Tukio
- Autre

#### Comportement post-confirmation

- Subscription Stripe : `cancel_at_period_end: true`
- Tier Tukio reste `business` jusqu'à la fin de la période payée
- Email confirmation : "Votre passage en Starter prendra effet le 1 juillet 2026"
- À la date d'effet :
  - Webhook `customer.subscription.deleted`
  - Tier → `starter`
  - Commission → 15 %
  - Services excédentaires → status `unlisted`
  - Membres d'équipe → désactivés
  - Email de bienvenue Starter

### C.4 — Cancellation `V1`

**URL** : `/seller/subscription/cancel`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Annuler mon abonnement Business                                    │
│                                                                     │
│  ⚠ Attention : annuler votre abonnement Business vous fera          │
│  basculer en Starter.                                               │
│                                                                     │
│  [Voir l'impact d'un passage en Starter] (lien vers C.3)            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Avant de partir, dites-nous pourquoi                       │   │
│  │                                                             │   │
│  │  ○ Trop cher                                                │   │
│  │  ○ Pas assez de fonctionnalités utiles                      │   │
│  │  ○ Activité saisonnière                                     │   │
│  │  ○ Je quitte Tukio                                          │   │
│  │  ○ Autre                                                    │   │
│  │                                                             │   │
│  │  Pouvez-vous nous en dire plus ?                            │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │                                                       │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Votre Business reste actif jusqu'au 1 juillet 2026                 │
│  (fin de votre période en cours).                                   │
│                                                                     │
│  [Garder mon abonnement]               [Confirmer l'annulation]     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- Identique au downgrade Business → Starter (techniquement, c'est la même chose)
- Captation de la raison pour analytics
- Pas d'engagement, pas de pénalité
- Réactivation possible à tout moment avant fin de période

### C.5 — Subscription invoices `V1`

**URL** : `/seller/subscription/invoices`

Liste des factures d'abonnement (différentes des factures clients qu'il émet via le mandat) :

```
┌─────────────────────────────────────────────────────────────────────┐
│  Factures de mon abonnement                                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Tukio Business — Mai 2026          34,80 € TTC ✓ Payée     │   │
│  │  Facturée le 1 mai 2026                                     │   │
│  │  [Télécharger]                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Tukio Business — Avril 2026        34,80 € TTC ✓ Payée     │   │
│  │  Facturée le 1 avril 2026                                   │   │
│  │  [Télécharger]                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ...                                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Format des factures conforme article 289 CGI : Tukio émet à son propre nom (pas mandat ici, c'est Tukio qui facture l'abo).

### C.6 — Failed payment recovery `V1`

**Workflow automatique de relance Stripe** : 3 tentatives sur 7 jours (smart retries).

**Si toutes échouent** :

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠ Banner persistant en haut du dashboard                           │
│                                                                     │
│  Le paiement de votre abonnement Business a échoué                  │
│                                                                     │
│  Mettez à jour votre moyen de paiement avant le 7 juin 2026 pour    │
│  conserver vos avantages Business. Sans action, vous serez basculé  │
│  en Starter automatiquement.                                        │
│                                                                     │
│  [Mettre à jour le paiement]                                        │
└─────────────────────────────────────────────────────────────────────┘
```

Email J+1, J+3, J+7 si non résolu.

---

## D. Pro billing & payouts

### D.0 Vue d'ensemble

```
/seller/billing/
├── /invoices              → Factures émises (mandat de fact. au nom du pro)
├── /payouts               → Reversements Stripe reçus
└── /exports               → Exports comptables CSV/PDF (V1)
```

### D.1 — Issued invoices `MVP`

**URL** : `/seller/billing/invoices`

**Source domaine** : 2.4 Paiements (mandat de facturation)

**Objectif** : permettre au pro de retrouver les factures émises **en son nom** par Tukio (mandat de facturation).

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mes factures émises                                                │
│                                                                     │
│  Ces factures sont émises par Tukio en votre nom et pour votre      │
│  compte (mandat de facturation, art. 289 CGI). Elles correspondent  │
│  aux paiements de vos clients.                                      │
│                                                                     │
│  Filtres :  [Toutes (45)]  [Cette année]  [2025]  [Précédentes]    │
│                                                                     │
│  Stats globales (12 derniers mois) :                                │
│  💰 CA total facturé : 38 420 € TTC                                 │
│  📄 45 factures émises                                              │
│                                                                     │
│  [Télécharger toutes les factures de la période] (ZIP)              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📄 TUK-EVN-2026-0042                                        │   │
│  │  15 juin 2026                                               │   │
│  │  Marie Dupont — Chapiteau 100 m²                            │   │
│  │  1 395,00 € TTC (1 162,50 € HT)                             │   │
│  │                                                             │   │
│  │  Détail :                                                   │   │
│  │  • Facture client : 1 395 €                                 │   │
│  │  • Commission Tukio (10 %) : -116,25 € HT                   │   │
│  │  • Vous touchez : 1 255,80 €                                │   │
│  │  • Reversement prévu : 16/06/2026                           │   │
│  │                                                             │   │
│  │  [Voir]   [Télécharger PDF]                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📄 TUK-EVN-2026-0040                                        │   │
│  │  10 juin 2026                                               │   │
│  │  Pierre Martin — 100 chaises pliantes                       │   │
│  │  500,00 € TTC                                               │   │
│  │  ...                                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Détail facture

Vue identique à B.2 mais côté pro (avec le détail commission visible).

### D.2 — Payouts `MVP`

**URL** : `/seller/billing/payouts`

**Source domaine** : 2.4 Paiements (Stripe Connect)

**Objectif** : permettre au pro de suivre ses reversements et de réconcilier avec son compte bancaire.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mes reversements                                                   │
│                                                                     │
│  Les reversements sont effectués automatiquement le lendemain de    │
│  l'événement, sur votre IBAN enregistré chez Stripe.                │
│                                                                     │
│  Stats (12 derniers mois) :                                         │
│  💰 Total reversé : 34 578,00 € (45 paiements)                      │
│  📅 Délai moyen : 1,2 jours après événement                         │
│                                                                     │
│  Filtres :  [Tous (45)]  [Reversés (43)]  [En attente (2)]         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⏳ En attente — événement à venir                          │   │
│  │  Marie Dupont — Chapiteau 100 m² (15-17 juin)               │   │
│  │  Montant : 1 255,80 €                                       │   │
│  │  Reversement prévu : 18/06/2026                             │   │
│  │                                                             │   │
│  │  [Voir le détail]                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ Reversé le 23/05/2026                                    │   │
│  │  Pierre Martin — 100 chaises pliantes (22 mai)              │   │
│  │  Montant : 450,00 €                                         │   │
│  │  IBAN : FR76 **** **** **** 1234                            │   │
│  │  Référence Stripe : po_1NXXX...                             │   │
│  │                                                             │   │
│  │  [Voir le détail]   [Voir la facture associée]              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ Reversé le 06/05/2026                                    │   │
│  │  ...                                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Détail d'un reversement

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Retour aux reversements                                          │
│                                                                     │
│  Reversement du 23 mai 2026 — 450,00 €                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Détails financiers                                         │   │
│  │                                                             │   │
│  │  Réservation : Pierre Martin — 100 chaises pliantes         │   │
│  │  Événement : 22 mai 2026                                    │   │
│  │                                                             │   │
│  │  Total client (TTC)              500,00 €                   │   │
│  │  Commission Tukio (10 % HT)      -41,67 € HT                │   │
│  │  TVA 20 % sur commission          -8,33 €                   │   │
│  │  ─────────────────────                                      │   │
│  │  Net reversé                     450,00 €                   │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Détails techniques                                         │   │
│  │                                                             │   │
│  │  ID Stripe Transfer : tr_1NXXX...                           │   │
│  │  ID Stripe Payout : po_1NXXX...                             │   │
│  │  IBAN destinataire : FR76 **** **** **** 1234               │   │
│  │  Date de transfer Stripe : 23/05/2026 09:14                 │   │
│  │  Date d'arrivée bancaire estimée : 24/05/2026               │   │
│  │                                                             │   │
│  │  [Voir dans Stripe Connect →]                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Documents associés                                         │   │
│  │                                                             │   │
│  │  📄 Facture client TUK-LOC-2026-0040                         │   │
│  │  📄 Note de commission TUK-CMS-2026-0040                     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### États

- **En attente** : événement à venir, fonds gelés chez Tukio
- **À reverser** : événement passé, transfer en cours
- **Reversé** : transfer effectué, montant en route vers la banque
- **Retenu** : litige ouvert, transfer suspendu (info admin)
- **Échoué** : problème compte Stripe (KYC expiré, etc.) → action requise

### D.3 — Negative balance recovery `V1`

**Cas** : refund après transfer effectué → solde négatif chez Stripe pour le pro.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠ Banner urgent en haut du dashboard pro                           │
│                                                                     │
│  Votre solde Stripe est négatif : -150,00 €                         │
│                                                                     │
│  Suite à un refund client après reversement, votre solde Stripe     │
│  est devenu négatif. Il sera automatiquement compensé par vos       │
│  prochains reversements.                                            │
│                                                                     │
│  Si vous n'avez pas de réservations à venir, contactez-nous pour    │
│  régulariser.                                                       │
│                                                                     │
│  [Plus d'infos]   [Contacter le support]                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## E. Pro accounting exports (V1)

### E.1 — Exports overview `V1`

**URL** : `/seller/billing/exports`

**Objectif** : permettre au pro (ou à son comptable) de récupérer les données financières dans un format exploitable.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Exports comptables                                                 │
│                                                                     │
│  Exportez vos données pour votre comptabilité ou pour transmission  │
│  à votre expert-comptable.                                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Période                                                    │   │
│  │                                                             │   │
│  │  ○ Mois en cours                                            │   │
│  │  ● Mois précédent                                           │   │
│  │  ○ Trimestre en cours                                       │   │
│  │  ○ Trimestre précédent                                      │   │
│  │  ○ Année en cours                                           │   │
│  │  ○ Période personnalisée                                    │   │
│  │      Du [01/05/2026]  au  [31/05/2026]                      │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Format d'export                                            │   │
│  │                                                             │   │
│  │  ☑ CSV (Excel, LibreOffice)                                 │   │
│  │  ☑ PDF récapitulatif                                        │   │
│  │  ☐ Toutes les factures (ZIP de PDFs)                        │   │
│  │  ☐ Format Pennylane (V2)                                    │   │
│  │  ☐ Format QuickBooks (V2)                                   │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Contenu                                                    │   │
│  │                                                             │   │
│  │  ☑ Factures émises (mandat)                                 │   │
│  │  ☑ Notes de commission Tukio                                │   │
│  │  ☑ Reversements Stripe                                      │   │
│  │  ☐ Détail TVA                                               │   │
│  │  ☐ Avoirs / refunds                                         │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💡 Aperçu :                                                        │
│  Période : Mai 2026                                                 │
│  • 12 factures émises (4 580 € TTC)                                 │
│  • 12 commissions Tukio (458 € HT + 91,60 € TVA)                    │
│  • 12 reversements (4 030 €)                                        │
│                                                                     │
│  [Annuler]                              [Générer l'export]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- Génération async (peut prendre 10-30s pour de gros exports)
- Download direct si rapide, sinon email avec lien quand prêt
- Exports stockés 30 jours puis supprimés
- Historique des derniers exports accessible

### E.2 — CSV export structure `V1`

Structure suggérée du CSV (à valider avec un expert-comptable) :

```csv
date,type,reference,client_name,description,amount_ht,vat_rate,vat_amount,amount_ttc,commission_ht,net_to_pro
15/06/2026,facture,TUK-EVN-2026-0042,Marie Dupont,Chapiteau 100 m² - 15-17 juin,1162.50,20.00,232.50,1395.00,116.25,1255.80
22/05/2026,facture,TUK-LOC-2026-0040,Pierre Martin,100 chaises pliantes - 22 mai,416.67,20.00,83.33,500.00,41.67,450.00
23/05/2026,reversement,po_1NXXX,Pierre Martin,Reversement Stripe,,,,,,450.00
05/05/2026,refund,TUK-EVN-2026-0028,Lucie Bernard,Refund partiel,-175.00,20.00,-35.00,-210.00,-17.50,-192.50
```

---

## F. Admin finance dashboard

### F.0 Vue d'ensemble

```
admin.tukio.one/finance/
├── /                      → Dashboard global
├── /commissions           → Commissions perçues
├── /subscriptions         → MRR, ARR, churn (V1)
├── /refunds               → Historique refunds
└── /reconciliation        → Stripe ↔ Tukio reconciliation
```

### F.1 — Finance dashboard `MVP`

**URL** : `admin.tukio.one/finance/`

**Audience** : `admin-super` (financial overview), `admin-support` lecture seule

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Sidebar admin]                                                    │
│  ──────────                                                         │
│  Dashboard                                                          │
│  Users                                                              │
│  Catalog                                                            │
│  Transactions                                                       │
│  Reports                                                            │
│  Finance ✓                                                          │
│  ...                                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Finance — Vue d'ensemble                                           │
│                                                                     │
│  Période :  [Mai 2026 ▾]                                            │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │  GMV         │ │  Take rate   │ │  MRR (V1)    │ │  Refunds   │ │
│  │              │ │              │ │              │ │            │ │
│  │  84 320 €    │ │  10,2 %      │ │  1 218 €     │ │  -2 450 €  │ │
│  │  +18 % vs M-1│ │  Stable     │ │  +8 % vs M-1 │ │  2,9 % GMV │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │  Commissions │ │  Reversements│ │  Disputes    │ │  Encours   │ │
│  │              │ │              │ │              │ │            │ │
│  │  8 600 €     │ │  72 870 €    │ │  3 (180 €)   │ │  12 540 €  │ │
│  │              │ │              │ │  0,2 % GMV   │ │  À reverser│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  ─────────────────────────────────────────────────────────          │
│                                                                     │
│  📊 Évolution mensuelle (12 derniers mois)                          │
│                                                                     │
│  [Graphique stacked : GMV / Commissions / MRR]                      │
│                                                                     │
│  ─────────────────────────────────────────────────────────          │
│                                                                     │
│  🔴 Alertes                                                         │
│                                                                     │
│  • 2 refunds > 1000 € en attente de validation [Voir]               │
│  • 1 dispute Stripe non résolue depuis 5 jours [Voir]               │
│  • Reconciliation Stripe : 1 divergence détectée [Voir]             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### KPIs cards (MVP)

| KPI | Définition | Trend |
|-----|------------|-------|
| **GMV** | Gross Merchandise Value : total TTC des transactions sur la période | vs M-1 |
| **Take rate** | Commissions / GMV | Stable / dérive |
| **MRR** *(V1)* | Monthly Recurring Revenue (abonnements) | vs M-1 |
| **Refunds** | Total des refunds sur la période + % du GMV | vs M-1 |
| **Commissions** | Total commissions perçues | vs M-1 |
| **Reversements** | Total versé aux pros | vs M-1 |
| **Disputes** | Nombre + montant des disputes Stripe | % du GMV |
| **Encours** | Montant en attente de reversement | Stock |

### F.2 — Commissions detail `MVP`

**URL** : `admin.tukio.one/finance/commissions`

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Commissions — Mai 2026                                             │
│                                                                     │
│  Total : 8 600 € HT                                                 │
│                                                                     │
│  Répartition par tier :                                             │
│  • Starter (15 %) : 5 200 € (60 %)                                  │
│  • Business (10 %) : 2 800 € (33 %)                                 │
│  • Enterprise (5 %) : 600 € (7 %)                                   │
│                                                                     │
│  ─────────────────────────────────────────────────────────          │
│                                                                     │
│  Top 10 pros par commission générée                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ Rank | Pro              | Tier      | GMV       | Comm.  │      │
│  │ ──── | ───────────────  | ──────── | ───────── | ────── │      │
│  │  1   | Event Co Nantes  | Business | 14 200 €  | 1 420 €│      │
│  │  2   | Loca Events      | Starter  | 8 900 €   | 1 335 €│      │
│  │  3   | Mariage Tradition| Business |  9 500 €  |   950 €│      │
│  │ ...                                                      │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  📊 Indicateur de concentration                                     │
│                                                                     │
│  Top 5 pros = 38 % du GMV (cible : < 50 %)                          │
│  Top 10 pros = 62 % du GMV                                          │
│                                                                     │
│  ⚠ Si le top 5 dépasse 50 %, le risque de dépendance devient        │
│  préoccupant. Stratégie de diversification de l'offre à activer.    │
│                                                                     │
│  [Exporter en CSV]                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### F.3 — Subscriptions tracking `V1`

**URL** : `admin.tukio.one/finance/subscriptions`

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Abonnements — Mai 2026                                             │
│                                                                     │
│  📊 MRR (Monthly Recurring Revenue)                                 │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │  MRR actuel  │ │  ARR         │ │  Churn       │                │
│  │              │ │              │ │              │                │
│  │  1 218 €     │ │  14 616 €    │ │  3,2 %       │                │
│  │  +8 % vs M-1 │ │  +22 % vs Q-1│ │  Cible: < 5 %│                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│                                                                     │
│  Évolution MRR (12 derniers mois) :                                 │
│  [Graphique waterfall : new MRR + expansion - churn]                │
│                                                                     │
│  ─────────────────────────────────────────────────────────          │
│                                                                     │
│  Répartition des abonnés                                            │
│                                                                     │
│  • Starter (gratuit) : 245 pros                                     │
│  • Business : 42 pros (taux conversion : 14,6 %)                    │
│  • Enterprise : 3 pros                                              │
│                                                                     │
│  ─────────────────────────────────────────────────────────          │
│                                                                     │
│  Mouvement du mois                                                  │
│                                                                     │
│  ✅ Nouveaux Business (12)                                          │
│  ✅ Upgrades Starter→Business (8)                                   │
│  ⚠ Downgrades Business→Starter (2)                                  │
│  ❌ Annulations (1)                                                 │
│                                                                     │
│  Raisons d'annulation (3 derniers mois)                             │
│  • Trop cher : 35 %                                                 │
│  • Activité saisonnière : 28 %                                      │
│  • Pas assez utilisé : 22 %                                         │
│  • Quitté Tukio : 10 %                                              │
│  • Autre : 5 %                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### F.4 — Refunds history `MVP`

**URL** : `admin.tukio.one/finance/refunds`

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Refunds — Mai 2026                                                 │
│                                                                     │
│  Total refunds : 2 450,00 € (12 refunds)                            │
│  Ratio sur GMV : 2,9 % (cible < 5 %)                                │
│                                                                     │
│  Filtres : [Tous (12)] [Annulation client (8)]                      │
│            [Annulation pro (2)] [Litige (2)]                        │
│            [Période ▾]                                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Date     | Booking      | Type       | Montant  | Statut   │   │
│  │ ──────── | ──────────── | ────────── | ──────── | ──────── │   │
│  │ 25/05/26 | TUK-2026-... | Client     | -210 €   | ✓ Effct. │   │
│  │ 22/05/26 | TUK-2026-... | Pro        | -1 395 € | ⏳ En cours│   │
│  │ 20/05/26 | TUK-2026-... | Litige     | -500 €   | ✓ Effct. │   │
│  │ ...                                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Exporter CSV]                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## G. Admin manual operations

### G.1 — Manual refund `MVP`

**Trigger** : depuis `admin.tukio.one/transactions/bookings/{id}` (vue admin du booking)

**Restriction** : `admin-super` uniquement (impact $$$)

#### Modale

```
┌─────────────────────────────────────────────────────────────────────┐
│  Refund manuel — Booking TUK-2026-0042                              │
│                                                                     │
│  ⚠ Action sensible — sera loggée dans l'audit trail                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Récap booking                                              │   │
│  │                                                             │   │
│  │  Customer : Marie Dupont                                    │   │
│  │  Pro : Event Co Nantes                                      │   │
│  │  Service : Chapiteau 100 m²                                 │   │
│  │  Total payé : 1 395,00 €                                    │   │
│  │  Statut booking : confirmed                                 │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Type de refund                                                     │
│  ○ Total (1 395,00 €)                                              │
│  ● Partiel : Montant : ┌──────────┐                                │
│                        │ 500,00 € │                                 │
│                        └──────────┘                                 │
│                                                                     │
│  Qui supporte ?                                                     │
│  ○ Le pro (débité de son compte Stripe)                             │
│  ● Tukio (geste commercial — débité de la commission)               │
│  ○ Réparti : Pro X € / Tukio Y €                                    │
│                                                                     │
│  Raison * (visible dans audit trail)                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Geste commercial suite incident logistique du pro            │   │
│  │ (chaises livrées avec retard de 2h)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Notification                                                       │
│  ☑ Notifier le customer par email                                  │
│  ☑ Notifier le pro par email                                       │
│                                                                     │
│  Message au customer (optionnel)                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Bonjour Marie, suite à votre signalement…                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Confirmation requise                                       │   │
│  │  Tapez "REFUND" pour confirmer                              │   │
│  │  ┌──────────────┐                                           │   │
│  │  │              │                                           │   │
│  │  └──────────────┘                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Annuler]                          [Confirmer le refund]           │
└─────────────────────────────────────────────────────────────────────┘
```

#### Comportement

- Validation Stripe en temps réel (peut échouer si solde négatif côté pro)
- Loggé dans audit trail avec timestamp + admin_id + raison + montant
- Email automatique au customer + pro selon options
- Mise à jour booking status
- Émission event NATS `payment.refunded.v1` pour cohérence

### G.2 — Stripe reconciliation `V1`

**URL** : `admin.tukio.one/finance/reconciliation`

**Objectif** : détecter les divergences entre Stripe (source de vérité paiements) et la DB Tukio.

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Réconciliation Stripe ↔ Tukio                                      │
│                                                                     │
│  Dernière exécution : 6 mai 2026 à 03:00 (cron quotidien)           │
│  Statut : ⚠ 1 divergence détectée                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Divergence : Booking TUK-2026-0042                         │   │
│  │                                                             │   │
│  │  Côté Tukio                  Côté Stripe                    │   │
│  │  Status : confirmed          Status : succeeded             │   │
│  │  Montant : 1 395 €           Montant : 1 295 € ⚠            │   │
│  │  Capture : 15/06/2026        Capture : 15/06/2026           │   │
│  │                                                             │   │
│  │  Différence : 100 €                                         │   │
│  │                                                             │   │
│  │  [Voir détail]   [Marquer comme résolu]                     │   │
│  │  [Aligner sur Stripe]   [Investiguer]                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────          │
│                                                                     │
│  Historique des réconciliations                                     │
│                                                                     │
│  • 5 mai 2026 — ✓ OK (0 divergence)                                 │
│  • 4 mai 2026 — ✓ OK                                                │
│  • 3 mai 2026 — ⚠ 1 divergence (résolue)                            │
│  ...                                                                │
│                                                                     │
│  [Lancer une réconciliation manuelle]                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## H. Communication patterns (emails financiers)

### H.1 Customer emails

| Trigger | Subject |
|---------|---------|
| Booking confirmé + paiement capturé | "Votre paiement de X € a été effectué pour votre réservation chez {pro}" + facture en PJ |
| Refund effectué (annulation, litige) | "Votre remboursement de X € a été effectué" |
| Échec paiement échéancier (V1) | "Action requise : votre paiement n'a pas pu être prélevé" |
| Carte expire bientôt (V1) | "Mettez à jour votre moyen de paiement" |

### H.2 Pro emails

| Trigger | Subject |
|---------|---------|
| Booking accepté → capture imminente | "Réservation confirmée — paiement en cours" |
| Reversement effectué | "Vous avez reçu un paiement de X € pour {client}" |
| Solde négatif | "Action requise : votre solde Stripe est négatif" |
| Échec paiement abonnement (V1) | "Mettez à jour votre carte pour conserver vos avantages Business" |
| Abonnement renouvelé (V1) | "Votre abonnement Business a été renouvelé — facture en PJ" |
| Période d'essai expire bientôt (V1) | "Votre essai Business expire dans 3 jours" |

### H.3 Templates — principes

- Logo Tukio + signature email cohérente
- Montants en gras, format français (1 395,00 €)
- PJ : factures en PDF
- Bouton CTA principal toujours visible
- Mention RGPD + désinscription en footer

---

## I. Compliance & legal display

### I.1 Mandat de facturation — affichage

Sur chaque facture émise par Tukio au nom du pro, mention obligatoire :

> Facture émise par Tukio SAS au nom et pour le compte de {nom_du_pro} ({SIRET}) en application de l'article 289 du CGI

### I.2 TVA — 3 cas à gérer

(cf. `tukio_booking_paiements_deepdive.md` §C.6 pour le détail)

| Cas | Mention TVA sur facture |
|-----|-------------------------|
| Pro non assujetti (franchise) | "TVA non applicable, art. 293 B du CGI" |
| Pro assujetti, client B2C FR | TVA 20 % normale |
| Pro assujetti, client B2B intra-UE avec n° valide | "Autoliquidation, art. 283-2 du CGI" |

**Détection automatique du cas** :
- À la création de la facture (`order-svc`)
- Snapshot du statut TVA pro + données client
- Application de la mention correspondante

### I.3 Conservation

- **Factures** : 10 ans (obligation FR), stockage immutable Cloudflare R2
- **Logs paiements** : 7 ans (Stripe + Tukio)
- **Audit trail admin actions** : indéfiniment, append-only

### I.4 RGPD

- Suppression de compte customer : anonymisation données perso au-delà du délai utile (10 ans pour comptable), conservation des écritures comptables

---

## J. Open design questions

| # | Question | Reco par défaut |
|---|----------|-----------------|
| **J-01** | Affichage des moyens de paiement customer au MVP ou V1 ? | **V1** — pas critique au MVP. À ajouter avec acomptes/échéancier |
| **J-02** | Annual billing pour Business (tarif réduit) ? | **V2** — testable après stabilité Business mensuel |
| **J-03** | Période d'essai 14 jours sur Business ? | **Oui MVP/V1** — réduit la friction d'upgrade |
| **J-04** | Affichage de la commission Tukio sur la facture client ? | **Non** — mandat de facturation. Le client voit le total payé. Détail visible côté pro. |
| **J-05** | Plan Enterprise : sur devis ou tarif public ? | **Sur devis** — chaque cas est différent (gros volumes, intégrations) |
| **J-06** | Reversement immédiat ou J+1 ? | **J+1** au MVP — couvre le risque de dispute initiale. Reconsidérer Same-day en V2 |
| **J-07** | Modèle accounting export : CSV custom ou format standard ? | **CSV custom au MVP**, intégrations Pennylane/QuickBooks en V2 |
| **J-08** | Affichage break-even Starter→Business ? | **Oui** — augmente conversion Business |
| **J-09** | Permettre annulation immédiate vs fin de période ? | **Fin de période** (standard SaaS, garde MRR) |
| **J-10** | Réconciliation Stripe : auto-correction ou manuelle ? | **Manuelle au MVP** — admin investigue. Auto en V2 si patterns clairs. |
| **J-11** | Refund manuel admin : un montant max sans escalation ? | **Pas de plafond** mais **double validation** > 1000 € (admin-super requis) |
| **J-12** | Solde négatif pro : compensation auto ou manuelle ? | **Auto sur prochains reversements** + alerte si > 500 € depuis > 30 j |
| **J-13** | Multi-currency au MVP ? | **Non, EUR only** — ajouter quand expansion internationale (V3+) |
| **J-14** | Pro tier visible publiquement ? | **Pas le tier explicite**. "Top Pro" / badge si Business+ et critères qualité (V1) |

---

*Fin du UX Flow Monetization — version 1, à itérer.*
