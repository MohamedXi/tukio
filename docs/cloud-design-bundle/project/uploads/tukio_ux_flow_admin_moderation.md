# Tukio — UX Flow: Admin & Moderation (Doc 7)

> Détail des parcours back-office Tukio : modération, gestion utilisateurs, litiges, audit, dashboards transversaux.
> À lire après : `tukio_spec_v2.md` (§2.8) + `tukio_information_architecture.md` (§I admin) + Doc 5 (signalements messagerie/avis) + Doc 6 (finance admin)
> Audience : designer, produit, dev frontend, dev backend, opérations

---

## Sommaire

- [A. Périmètre du document](#a-périmètre-du-document)
- [B. Principes du back-office](#b-principes-du-back-office)
- [C. Admin global dashboard](#c-admin-global-dashboard)
- [D. Reports queue](#d-reports-queue)
- [E. Litigation workflow](#e-litigation-workflow)
- [F. User moderation](#f-user-moderation)
- [G. Catalog moderation](#g-catalog-moderation)
- [H. Audit trail](#h-audit-trail)
- [I. Roles & permissions matrix](#i-roles--permissions-matrix)
- [J. Anti-recreation patterns](#j-anti-recreation-patterns)
- [K. Open design questions](#k-open-design-questions)

---

## A. Périmètre du document

### Ce que ce doc couvre

| Domaine | Écrans / Workflows | Cible |
|---------|---------------------|-------|
| Dashboard admin transverse | Vue d'ensemble multi-domaines | MVP |
| Reports queue | File de signalements (messages, avis, fiches, users) | MVP |
| Litigation workflow | Litiges client/pro avec médiation 48h | MVP |
| User moderation | Suspension graduée, ban, audit | MVP |
| Catalog moderation | Validation fiches, retrait, drapeaux | MVP |
| Audit trail | Historique immutable des actions admin | MVP |
| RBAC | Roles admin-super / admin-modo / admin-support | MVP |
| Anti-recreation | Hash conservation post-ban | MVP |

### Ce que ce doc ne couvre PAS

- **Finance admin** (cf. Doc 6 — Monetization §F-G)
- **Workflows transactionnels** (cf. Doc 3 — Booking)
- **Configuration plateforme** (catégories, taxonomie, tiers tarifaires) — annexe IA admin
- **Page d'auth admin** (cf. Doc 4 — Auth & Accounts §F)

### Hiérarchie des rôles (rappel)

| Rôle | Pouvoirs |
|------|----------|
| `admin-super` | Tous droits. Refunds > 1000 €, ban, gestion admins, config plateforme |
| `admin-modo` | Modération content + suspension users (≤ 30j), gestion signalements |
| `admin-support` | Lecture seule + actions support basiques (réassigner conv., notes internes) |

---

## B. Principes du back-office

### B.1 Sobriété d'abord

Le back-office Tukio n'est **pas** un outil grand public. Il est utilisé par 3-10 personnes en interne. Donc :

- **Pas de dark mode au MVP** — gain marginal vs coût de maintenance
- **Pas d'animations** — friction inutile
- **Densité d'information** plus haute que côté customer/pro (les admins sont des power users)
- **Tableaux dépassent la largeur d'écran** : OK si scroll horizontal naturel
- **Filtres avancés** : libellés courts, raccourcis clavier (V1)

### B.2 Toute action est traçable

Chaque action admin :
- Logguée dans audit trail immutable (cf. §H)
- Visible dans l'historique du compte/booking/avis ciblé
- Notifiée à l'utilisateur affecté (sauf actions de surveillance silencieuse)

### B.3 Friction proportionnelle au risque

| Action | Friction |
|--------|----------|
| Lecture d'un compte user | Aucune |
| Note interne sur un user | Aucune |
| Masquage d'un avis | Confirmation simple |
| Suspension user 7 jours | Modale avec raison obligatoire |
| Suspension user 30 jours | Modale avec raison + commentaire détaillé |
| Ban définitif | Modale + saisie "BAN" + double admin (V1) |
| Refund > 1000 € | Modale + saisie "REFUND" + admin-super requis |

### B.4 Convention sous-domaine

Tout le back-office vit sur **`admin.tukio.one`**. Aucun lien vers ce sous-domaine depuis les apps customer/pro. Les admins se connectent directement.

---

## C. Admin global dashboard

### C.1 — Dashboard `MVP`

**URL** : `admin.tukio.one/`

**Audience** : tous les rôles admin

**Objectif** : vue d'ensemble de la plateforme avec accès rapide aux actions urgentes.

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Header admin] Tukio Admin · alice@tukio.one (admin-super) [Logout] │
├───────────┬──────────────────────────────────────────────────────────┤
│           │                                                          │
│ Sidebar   │  Dashboard                                               │
│           │                                                          │
│ Dashboard │  Période : [Aujourd'hui ▾]  Rafraîchi il y a 2 min       │
│ Reports ⓘ │                                                          │
│ Users     │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ Catalog   │  │ GMV jour │ │ Bookings │ │ Pros KYC │ │ Reports  │   │
│ Bookings  │  │          │ │ en cours │ │ en attnt │ │ ouverts  │   │
│ Finance   │  │ 4 280 €  │ │ 12       │ │ 3 ⚠      │ │ 7 ⚠      │   │
│ Reports   │  │ +14 % vs │ │ Stable   │ │ +1 vs    │ │ +2 vs    │   │
│ Audit log │  │ M-1 même │ │          │ │ hier     │ │ hier     │   │
│ Settings  │  │ jour     │ │          │ │          │ │          │   │
│           │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│           │                                                          │
│           │  ─────────────────────────────────────────────           │
│           │                                                          │
│           │  🔴 À traiter en priorité                                │
│           │                                                          │
│           │  ┌────────────────────────────────────────────────────┐ │
│           │  │ ⚠ 1 litige > 5 jours sans résolution               │ │
│           │  │   Client: Marie D. · Pro: Event Co · 1 395 €       │ │
│           │  │   [Voir le litige]                                 │ │
│           │  └────────────────────────────────────────────────────┘ │
│           │                                                          │
│           │  ┌────────────────────────────────────────────────────┐ │
│           │  │ ⚠ 3 KYC pros en attente > 24h                      │ │
│           │  │   [Voir la file]                                   │ │
│           │  └────────────────────────────────────────────────────┘ │
│           │                                                          │
│           │  ┌────────────────────────────────────────────────────┐ │
│           │  │ ⚠ 2 refunds > 1000 € à valider                     │ │
│           │  │   [Voir]                                           │ │
│           │  └────────────────────────────────────────────────────┘ │
│           │                                                          │
│           │  ─────────────────────────────────────────────────       │
│           │                                                          │
│           │  📊 Activité                                             │
│           │                                                          │
│           │  Inscriptions clients : 12 (+8 vs hier)                  │
│           │  Inscriptions pros : 2                                   │
│           │  Fiches publiées : 5 (1 modération en cours)             │
│           │  Réservations confirmées : 12                            │
│           │                                                          │
│           │  Volume signalements (7j) :                              │
│           │  • Messages : 8 (-2 vs S-1)                              │
│           │  • Avis : 3                                              │
│           │  • Fiches : 1                                            │
│           │  • Users : 0                                             │
│           │                                                          │
│           │  ─────────────────────────────────────────────────       │
│           │                                                          │
│           │  Top alertes                                             │
│           │                                                          │
│           │  🟠 Pro Event Co : 3 signalements ce mois                │
│           │  🟠 Catégorie "Tentes" : taux refus pros 65 % (cible<50%)│
│           │  🟢 Reconciliation Stripe : OK                           │
│           │                                                          │
└───────────┴──────────────────────────────────────────────────────────┘
```

#### Composants

1. **Sidebar persistante** : navigation entre sections
2. **KPIs cards** : 4 indicateurs critiques selon période
3. **À traiter en priorité** : alertes actionables (litiges, KYC, refunds)
4. **Activité** : volume opérationnel
5. **Top alertes** : signaux faibles (à investiguer)

#### Différences par rôle

| Rôle | Vue spéciale |
|------|--------------|
| `admin-super` | Tous les KPIs + finance + alertes refund |
| `admin-modo` | KPIs hors finance + signalements + KYC |
| `admin-support` | KPIs lecture seule + tickets support |

---

## D. Reports queue

### D.1 — All reports `MVP`

**URL** : `admin.tukio.one/reports`

**Source domaine** : 2.8 Modération (centralisation des signalements)

**Objectif** : file de signalements unifiée (messages + avis + fiches + users + bookings).

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Signalements                                                         │
│                                                                       │
│  Filtres :                                                            │
│  Type :  [Tous (15)] [Message (8)] [Avis (3)] [Fiche (1)]             │
│          [User (0)] [Booking (3)]                                     │
│                                                                       │
│  Statut : [À traiter (7)] [En cours (2)] [Résolus (6)] [Tous]         │
│  Priorité : [Toutes ▾]                                                │
│                                                                       │
│  Tri : [Plus ancien d'abord ▾] [Plus récent] [Priorité]               │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🔴 Priorité haute · Reporté il y a 2h                        │   │
│  │                                                              │   │
│  │ Type : Message · Conv #conv-1234                             │   │
│  │ Reporter : Marie Dupont (client)                             │   │
│  │ Cible : Event Co Nantes (pro)                                │   │
│  │ Raison : Tentative de contact hors plateforme                │   │
│  │                                                              │   │
│  │ Aperçu : « Bonjour, mon mobile est le 06.12.34.56.78,        │   │
│  │ contactez-moi directement pour le futur… »                   │   │
│  │                                                              │   │
│  │ [Examiner]                                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🟠 Priorité moyenne · Reporté il y a 6h                      │   │
│  │                                                              │   │
│  │ Type : Avis · Review #rev-892                                │   │
│  │ Reporter : Loca Events (pro)                                 │   │
│  │ Cible : avis de Pierre Martin (1⭐)                           │   │
│  │ Raison : Diffamation                                         │   │
│  │                                                              │   │
│  │ [Examiner]                                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Priorité automatique

Calculée en fonction de :

| Critère | Score |
|---------|-------|
| Type de raison (urgence : harcèlement, fraude…) | 0-3 |
| Volume de signalements précédents sur la cible | 0-2 |
| Tier du reporter (pro Business > Starter > anonyme) | 0-1 |
| Délai depuis création | 0-2 |

Score total : 0-8
- 6-8 : 🔴 Haute (SLA 4h)
- 3-5 : 🟠 Moyenne (SLA 24h)
- 0-2 : 🟢 Basse (SLA 48h)

### D.2 — Report detail `MVP`

**URL** : `admin.tukio.one/reports/{id}`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Retour à la file                                                   │
│                                                                       │
│  Signalement #rep-1234 · 🔴 Haute · Reporté il y a 2h                 │
│                                                                       │
│  ┌────────────────────────────────────┬───────────────────────────┐ │
│  │                                    │                           │ │
│  │ Détails                            │ Décision                  │ │
│  │                                    │                           │ │
│  │ Type : Message                     │ Quelle action ?           │ │
│  │ Reporter : Marie Dupont            │                           │ │
│  │ Email reporter : marie@...         │ [Aucune action]           │ │
│  │ Raison : Tentative contact         │ [Avertir le pro]          │ │
│  │ hors plateforme                    │ [Masquer le message]      │ │
│  │ Date : 6 mai 2026 14:32            │ [Suspendre 7 jours]       │ │
│  │                                    │ [Suspendre 30 jours]      │ │
│  │ ─────────────────────────────      │ [Bannir]                  │ │
│  │                                    │                           │ │
│  │ Cible                              │                           │ │
│  │ Type : Pro                         │                           │ │
│  │ Nom : Event Co Nantes              │                           │ │
│  │ Tier : Business                    │                           │ │
│  │ Status : Actif                     │                           │ │
│  │ KYC : Vérifié 15/03/2026           │                           │ │
│  │                                    │                           │ │
│  │ Historique :                       │                           │ │
│  │ • 3 signalements ce mois           │                           │ │
│  │ • 1 avertissement 04/2026          │                           │ │
│  │ • Score modération : 65/100        │                           │ │
│  │                                    │                           │ │
│  │ [Voir profil complet]              │                           │ │
│  │                                    │                           │ │
│  │ ─────────────────────────────      │                           │ │
│  │                                    │                           │ │
│  │ Contenu signalé                    │                           │ │
│  │                                    │                           │ │
│  │ Conversation #conv-1234            │                           │ │
│  │ [Avatar] Event Co Nantes           │                           │ │
│  │  > Bonjour, mon mobile est le      │                           │ │
│  │    06.12.34.56.78, contactez-moi   │                           │ │
│  │    directement pour le futur,      │                           │ │
│  │    on fera 10% de moins.           │                           │ │
│  │  Envoyé : 6 mai 2026 14:25         │                           │ │
│  │  Flag regex : phone_number_pattern │                           │ │
│  │                                    │                           │ │
│  │ [Voir conversation complète]       │                           │ │
│  │                                    │                           │ │
│  └────────────────────────────────────┴───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

#### Modale de décision (exemple : "Suspendre 7 jours")

```
┌──────────────────────────────────────────────────────┐
│  Suspendre Event Co Nantes pendant 7 jours           │
│                                                      │
│  ⚠ Conséquences :                                    │
│  • Les services seront masqués pendant 7 jours       │
│  • Les bookings en cours seront maintenus            │
│  • Le pro ne pourra plus se connecter                │
│  • Les nouvelles demandes seront refusées            │
│                                                      │
│  Raison interne (visible audit trail) *              │
│  ▾ Sélectionnez                                      │
│  ☑ Anti-désintermédiation                            │
│                                                      │
│  Commentaire détaillé *                              │
│  ┌────────────────────────────────────────────────┐ │
│  │ 3e signalement ce mois pour partage de coords  │ │
│  │ téléphone hors plateforme. Précédemment        │ │
│  │ averti le 04/2026. Suspension graduée.         │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Message au pro (envoyé par email) *                 │
│  ┌────────────────────────────────────────────────┐ │
│  │ Bonjour,                                       │ │
│  │                                                │ │
│  │ Suite à plusieurs signalements concernant des  │ │
│  │ tentatives de contact hors plateforme, votre   │ │
│  │ compte est suspendu pour 7 jours.              │ │
│  │                                                │ │
│  │ Nous vous rappelons que toute communication    │ │
│  │ doit transiter par Tukio (CGU §X).             │ │
│  │                                                │ │
│  │ Pour contester, répondez à cet email.          │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [Annuler]                  [Confirmer suspension]   │
└──────────────────────────────────────────────────────┘
```

#### Comportement

- Action exécutée → écriture audit trail + email auto au user + email au reporter ("Votre signalement a été traité")
- Statut report → `resolved`
- Si action affecte le user (suspension/ban) → emission event NATS `identity.user.suspended.v1` consommé par tous les services pour application cohérente

### D.3 — Sanctions graduées

#### Echelle standard

```
1ère infraction mineure       → Note interne (pas d'action user)
2ème infraction mineure       → Avertissement par email
3ème infraction mineure        → Suspension 7 jours
4ème infraction               → Suspension 30 jours
5ème infraction OU 1 grave    → Ban définitif
```

#### Infractions graves (ban direct possible)

- Fraude avérée
- Harcèlement caractérisé
- Contenu illégal (haine, pédoporn, etc.)
- Fausses factures / blanchiment
- Vol d'identité
- Récidive après ban

---

## E. Litigation workflow

### E.1 Cycle de vie d'un litige

```
[Customer ou pro signale un problème post-événement]
   ↓
litigation.opened
   │ Auto-création + email aux 2 parties + alert admin
   ↓
litigation.under_mediation
   │ Phase de médiation 48h
   │ Les 2 parties peuvent ajouter des messages/preuves
   │ Admin peut intervenir si besoin
   ↓
[3 issues possibles]
   ├── Accord amiable (refund partiel/total/aucun)
   ├── Décision admin (si accord impossible)
   └── Escalade Stripe dispute (si action côté Stripe)
   ↓
litigation.resolved
   │ Audit trail + emails final
   │ 15 jours pour réouverture si nouvelle preuve
   ↓
litigation.closed
```

### E.2 — Litigation list `MVP`

**URL** : `admin.tukio.one/litigations`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Litiges                                                              │
│                                                                       │
│  Filtres : [Ouverts (3)] [Médiation (2)] [Résolus (8)] [Fermés]      │
│                                                                       │
│  Tri : [SLA risque ▾] [Plus récent] [Montant]                         │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🔴 Ouvert depuis 5 jours · ⚠ Hors SLA                        │   │
│  │                                                              │   │
│  │ Litige #lit-1042                                             │   │
│  │ Booking : TUK-2026-0042 · 1 395 €                            │   │
│  │ Client : Marie Dupont                                        │   │
│  │ Pro : Event Co Nantes                                        │   │
│  │                                                              │   │
│  │ Initiateur : Client                                          │   │
│  │ Type : Service non conforme                                  │   │
│  │                                                              │   │
│  │ Statut : Aucune réponse pro depuis 48h                       │   │
│  │                                                              │   │
│  │ [Examiner et trancher]                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🟠 Médiation en cours · J+2/4                                │   │
│  │                                                              │   │
│  │ Litige #lit-1041                                             │   │
│  │ Booking : TUK-2026-0040 · 500 €                              │   │
│  │ Client : Pierre Martin                                       │   │
│  │ Pro : Loca Events                                            │   │
│  │ Type : Retard de livraison                                   │   │
│  │                                                              │   │
│  │ Dernier échange : Il y a 4h (Pro)                            │   │
│  │                                                              │   │
│  │ [Voir]                                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### E.3 — Litigation detail `MVP`

**URL** : `admin.tukio.one/litigations/{id}`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Retour                                                             │
│                                                                       │
│  Litige #lit-1042 · 🔴 Hors SLA · J+5                                 │
│                                                                       │
│  ┌────────────────────────────────────┬───────────────────────────┐ │
│  │                                    │                           │ │
│  │ Booking concerné                   │ Actions admin             │ │
│  │                                    │                           │ │
│  │ TUK-2026-0042                      │ Saisir en médiation :     │ │
│  │ Chapiteau 100 m²                   │ [+ Ajouter un message     │ │
│  │ 15-17 juin 2026                    │   admin]                  │ │
│  │ 1 395 € TTC                        │                           │ │
│  │                                    │ Trancher le litige :      │ │
│  │ Client : Marie Dupont              │ [Refund total]            │ │
│  │ Pro : Event Co Nantes              │ [Refund partiel]          │ │
│  │                                    │ [Refus refund]            │ │
│  │ [Voir booking complet]             │                           │ │
│  │                                    │ Escalade :                │ │
│  │ ─────────────────────────────      │ [Ouvrir dispute Stripe]   │ │
│  │                                    │                           │ │
│  │ Timeline                           │ Prolonger médiation :     │ │
│  │                                    │ [+ 24h]                   │ │
│  │ 1/06 16:42 · Litige ouvert         │                           │ │
│  │  par Client                        │                           │ │
│  │  Type : Service non conforme       │                           │ │
│  │                                    │                           │ │
│  │ 1/06 16:42 · Email envoyé          │                           │ │
│  │  Client + Pro                      │                           │ │
│  │                                    │                           │ │
│  │ 1/06 17:18 · Message Client        │                           │ │
│  │  « Le chapiteau livré était sale  │                           │ │
│  │    et présentait des accrocs… »    │                           │ │
│  │  + 3 photos jointes                │                           │ │
│  │                                    │                           │ │
│  │ 2/06 09:30 · Message Pro           │                           │ │
│  │  « Le chapiteau était propre à    │                           │ │
│  │    la livraison, voici les photos  │                           │ │
│  │    de notre check-in… »            │                           │ │
│  │  + 2 photos jointes                │                           │ │
│  │                                    │                           │ │
│  │ 4/06 10:00 · Aucune nouvelle       │                           │ │
│  │  réponse depuis 48h                │                           │ │
│  │                                    │                           │ │
│  │ ─────────────────────────────      │                           │ │
│  │                                    │                           │ │
│  │ Preuves rassemblées                │                           │ │
│  │                                    │                           │ │
│  │ • Photo client (3) [Voir]          │                           │ │
│  │ • Photo pro check-in (2) [Voir]    │                           │ │
│  │ • Conversation messagerie [Voir]   │                           │ │
│  │ • Historique signalements pro      │                           │ │
│  │                                    │                           │ │
│  └────────────────────────────────────┴───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

#### Modale "Refund partiel"

```
┌──────────────────────────────────────────────────────┐
│  Trancher le litige — Refund partiel                 │
│                                                      │
│  Total payé : 1 395 €                                │
│                                                      │
│  Montant à rembourser au client *                    │
│  ┌──────────────┐                                    │
│  │ 350,00 €     │                                    │
│  └──────────────┘                                    │
│  Soit 25 % du total                                  │
│                                                      │
│  Qui supporte ?                                      │
│  ● Le pro (débit Stripe)                             │
│  ○ Tukio (geste commercial)                          │
│  ○ Réparti                                           │
│                                                      │
│  Justification de la décision *                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Pro a livré chapiteau dans état imparfait       │ │
│  │ (accrocs visibles sur photos client). Pro       │ │
│  │ admet implicitement (pas de réponse depuis      │ │
│  │ 48h aux nouvelles preuves). Refund partiel     │ │
│  │ 25 % en compensation.                          │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Message au client *                                 │
│  ┌────────────────────────────────────────────────┐ │
│  │ Bonjour Marie, après examen des preuves…        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Message au pro *                                    │
│  ┌────────────────────────────────────────────────┐ │
│  │ Bonjour, après médiation, nous avons décidé… │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [Annuler]                          [Confirmer]      │
└──────────────────────────────────────────────────────┘
```

#### Réouverture (15 jours)

Pendant 15 jours après résolution, l'une des 2 parties peut **rouvrir le litige** avec nouvelle preuve. Workflow identique au litige initial.

Au-delà, le litige est `closed` définitivement (pas de réouverture possible sauf escalade Stripe).

---

## F. User moderation

### F.1 — Users list `MVP`

**URL** : `admin.tukio.one/users`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Utilisateurs                                                         │
│                                                                       │
│  Recherche : [🔍 nom, email, ID, SIRET…]                              │
│                                                                       │
│  Filtres :                                                            │
│  Type : [Tous] [Customer (245)] [Pro (51)] [Admin (4)]                │
│  Statut : [Actifs] [Suspendus] [Bannis] [Tous]                        │
│  Tier pro : [Tous] [Starter] [Business] [Enterprise]                  │
│  Date inscription : [Tout] [7j] [30j] [90j] [Custom]                  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ ID    | Nom               | Type     | Statut    | Inscr. │     │
│  │ ───── | ───────────────── | ──────── | ────────  | ────── │     │
│  │ usr-1 | Event Co Nantes   | Pro Bus. | Actif     | 03/26  │     │
│  │ usr-2 | Marie Dupont      | Customer | Actif     | 04/26  │     │
│  │ usr-3 | Loca Events       | Pro Star.| Actif     | 03/26  │     │
│  │ usr-4 | Pierre Martin     | Customer | Suspendu  | 02/26  │     │
│  │ usr-5 | Truc Events       | Pro Star.| Banni     | 02/26  │     │
│  │ ...                                                          │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

### F.2 — User detail `MVP`

**URL** : `admin.tukio.one/users/{id}`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Retour                                                             │
│                                                                       │
│  Event Co Nantes · Pro Business · ✓ Actif                             │
│                                                                       │
│  Tabs : [Profil ✓] [Activité] [Modération] [Audit] [Notes internes]   │
│                                                                       │
│  ┌────────────────────────────────────┬───────────────────────────┐ │
│  │                                    │                           │ │
│  │ Profil                             │ Actions                   │ │
│  │                                    │                           │ │
│  │ Identité                           │ [Avertir]                 │ │
│  │ Nom : Event Co Nantes              │ [Suspendre 7j]            │ │
│  │ Email : contact@eventco.fr         │ [Suspendre 30j]           │ │
│  │ Tel : +33 6 XX XX XX XX            │ [Bannir]                  │ │
│  │ Inscription : 15 mars 2026         │                           │ │
│  │ Dernière connexion : aujourd'hui   │ ─────────                 │ │
│  │                                    │ [Impersonner]             │ │
│  │ Pro Info                           │ (admin-super)             │ │
│  │ SIRET : 12345678901234             │                           │ │
│  │ Raison soc. : EVENT CO SARL        │ [Reset password]          │ │
│  │ TVA : FR12345678901                │ [Forcer logout]           │ │
│  │ Tier : Business                    │                           │ │
│  │ Membre équipe (3) [Voir]           │                           │ │
│  │                                    │                           │ │
│  │ KYC                                │                           │ │
│  │ ✓ Pièce identité [Voir]            │                           │ │
│  │ ✓ Justif. adresse [Voir]           │                           │ │
│  │ ✓ Kbis [Voir]                      │                           │ │
│  │ Vérifié le : 15/03/2026            │                           │ │
│  │                                    │                           │ │
│  │ Stripe                             │                           │ │
│  │ ✓ Compte Connect actif             │                           │ │
│  │ IBAN : FR76 **** **** 1234         │                           │ │
│  │                                    │                           │ │
│  │ [Voir profil public]               │                           │ │
│  │                                    │                           │ │
│  └────────────────────────────────────┴───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

#### Tab "Activité"

- Bookings : 45 (3 actifs, 42 complétés, 0 annulés)
- Avis : 27 (note moyenne 4.7)
- Messages envoyés : 234
- CA total Tukio : 38 420 €

#### Tab "Modération"

- Score modération (calcul interne)
- Avertissements reçus : 1 (avril 2026)
- Suspensions : 0
- Signalements : 3 (à explorer)

#### Tab "Audit"

Toutes les actions admin sur ce user (immutable).

#### Tab "Notes internes"

Champ libre pour les admins, visible par tous les admins. Append-only avec auteur + timestamp.

```
6 mai 2026 — alice@tukio.one
"Pro investi, présent au meet-up Tukio Nantes du 04/2026. À surveiller mais bonne foi présumée."

15 mars 2026 — bob@tukio.one
"KYC validé. Documents conformes. Onboarding complet en 18min."
```

### F.3 — Suspension flow

Cf. modale §D.2 (déjà traité).

#### Réactivation après suspension

Suspension expire automatiquement. Email envoyé au user :

```
Objet : Votre compte Tukio est réactivé

Bonjour Jean,

Votre suspension a pris fin. Votre compte est maintenant à nouveau actif.

Nous vous rappelons l'importance de respecter nos CGU pour préserver
notre communauté.

[Accéder à mon compte]
```

### F.4 — Ban flow

#### Modale ban

```
┌──────────────────────────────────────────────────────┐
│  ⚠ Bannir Event Co Nantes — ACTION DÉFINITIVE        │
│                                                      │
│  Conséquences :                                      │
│  • Compte désactivé immédiatement                    │
│  • Tous services masqués                             │
│  • Messagerie en lecture seule                       │
│  • Aucune nouvelle inscription possible avec :       │
│    - Cet email                                       │
│    - Ce SIRET                                        │
│    - Ces documents KYC                               │
│  • Bookings actifs : annulés avec refund client      │
│  • Reversements en attente : annulés                 │
│                                                      │
│  Raison du ban (visible audit) *                     │
│  ▾ Sélectionnez                                      │
│  ☑ Fraude répétée                                    │
│                                                      │
│  Justification détaillée *                           │
│  Min 200 caractères                                  │
│  ┌────────────────────────────────────────────────┐ │
│  │ 3 cas de fausses factures détectés sur 2026… │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Message au user (envoyé par email) *                │
│  ┌────────────────────────────────────────────────┐ │
│  │                                                │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Confirmation requise                        │    │
│  │ Tapez "BAN" pour confirmer                  │    │
│  │ ┌──────────────┐                            │    │
│  │ │              │                            │    │
│  │ └──────────────┘                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  En V1 : double validation par 2 admins-super       │
│                                                      │
│  [Annuler]                          [Confirmer BAN]  │
└──────────────────────────────────────────────────────┘
```

#### Comportement post-ban

- Status user → `banned`
- Hash conservation (cf. §J)
- Bookings actifs annulés (event NATS `booking.cancelled` avec raison `user_banned`)
- Reversements en attente annulés
- Email user envoyé
- Audit trail rempli

---

## G. Catalog moderation

### G.1 — Catalog moderation queue `MVP`

**URL** : `admin.tukio.one/catalog/pending`

**Audience** : `admin-modo`, `admin-super`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Modération catalogue                                                 │
│                                                                       │
│  Filtres : [En attente (5)] [Rejetés (2)] [Tous]                      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ ⏳ En attente depuis 18h                                   │     │
│  │                                                            │     │
│  │ [Photo] Chapiteau 100 m²                                   │     │
│  │         Event Co Nantes (Pro Business, KYC ✓)              │     │
│  │         Catégorie : Tentes & chapiteaux                    │     │
│  │         Prix : 1 200 € forfait                             │     │
│  │                                                            │     │
│  │         [Examiner]                                         │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ ⏳ En attente depuis 22h                                   │     │
│  │                                                            │     │
│  │ [Photo] 100 chaises pliantes                               │     │
│  │         Loca Events (Pro Starter, KYC ✓)                   │     │
│  │         Catégorie : Mobilier événementiel                  │     │
│  │         Prix : 5 € unité                                   │     │
│  │                                                            │     │
│  │         [Examiner]                                         │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

### G.2 — Listing moderation detail `MVP`

**URL** : `admin.tukio.one/catalog/pending/{id}`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Retour                                                             │
│                                                                       │
│  Examen : Chapiteau 100 m²                                            │
│                                                                       │
│  ┌────────────────────────────────────┬───────────────────────────┐ │
│  │                                    │                           │ │
│  │ Aperçu fiche                       │ Décision                  │ │
│  │                                    │                           │ │
│  │ [Aperçu de la fiche tel que vu     │ [Approuver et publier]    │ │
│  │  par les clients]                  │ [Rejeter]                 │ │
│  │                                    │                           │ │
│  │ ─────────────────────────────      │ Drapeaux automatiques :   │ │
│  │                                    │ ✓ Photos qualité OK       │ │
│  │ Métadonnées admin                  │ ✓ Description ≥ 100 chars │ │
│  │                                    │ ⚠ Prix légèrement bas     │ │
│  │ Pro : Event Co Nantes              │   (médiane catégorie:1500)│ │
│  │ Tier : Business                    │ ✓ Pas de mots-clés bannis │ │
│  │ Score modération pro : 85/100      │                           │ │
│  │                                    │                           │ │
│  │ Historique pro :                   │                           │ │
│  │ • 7 fiches publiées                │                           │ │
│  │ • 0 rejet précédent                │                           │ │
│  │ • 1 avertissement (signalement     │                           │ │
│  │   message hors plateforme)         │                           │ │
│  │                                    │                           │ │
│  └────────────────────────────────────┴───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

#### Modale rejet

```
┌──────────────────────────────────────────────────────┐
│  Rejeter cette fiche                                 │
│                                                      │
│  Raison du rejet *                                   │
│  ☑ Photos de mauvaise qualité                       │
│  ☐ Description insuffisante                         │
│  ☐ Prix manifestement aberrant                       │
│  ☐ Catégorie inadéquate                             │
│  ☐ Contenu interdit (CGU)                           │
│  ☐ Photos volées (TinEye flag)                      │
│  ☐ Autre                                             │
│                                                      │
│  Message au pro * (constructif)                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Bonjour, votre fiche n'a pas pu être validée    │ │
│  │ pour les raisons suivantes :                   │ │
│  │                                                │ │
│  │ - 2 photos sont floues (photo 1 et 4)          │ │
│  │ - Une photo est en très basse résolution       │ │
│  │                                                │ │
│  │ Merci de mettre à jour ces photos avec des     │ │
│  │ images nettes et bien éclairées. La fiche      │ │
│  │ repassera en modération automatiquement.       │ │
│  │                                                │ │
│  │ Bonne continuation !                           │ │
│  │ L'équipe Tukio                                 │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [Annuler]                       [Envoyer le rejet]  │
└──────────────────────────────────────────────────────┘
```

### G.3 — Auto-publication rules

(cf. `tukio_ux_flow_catalog.md` §B.2 step 10)

| Cas | Comportement |
|-----|--------------|
| Pro `verified` > 30 j ET < 3 signalements | Publication directe (`published`) |
| Pro nouveau ou avec signalements | `pending_review` → modération sous 24h |
| Modification majeure d'une fiche existante | Repasse en `pending_review` |

---

## H. Audit trail

### H.1 — Audit log `MVP`

**URL** : `admin.tukio.one/audit`

**Audience** : `admin-super` (tous), `admin-modo` (lecture seule de leurs propres actions)

**Objectif** : historique immutable de toutes les actions admin pour conformité et traçabilité.

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Audit Trail                                                          │
│                                                                       │
│  Filtres :                                                            │
│  Admin : [Tous] [alice] [bob] [carol]                                 │
│  Type d'action : [Toutes] [User] [Catalog] [Finance] [Système]        │
│  Période : [7j ▾] [30j] [Custom]                                      │
│                                                                       │
│  Recherche : [🔍 user, booking, action…]                              │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Date/Heure          | Admin     | Action       | Cible    │     │
│  │ ────────────────────|───────────|──────────────|────────  │     │
│  │ 06/05/26 14:32:18  | alice     | suspend_user| usr-1234 │     │
│  │ 06/05/26 11:18:42  | bob       | hide_review | rev-892  │     │
│  │ 06/05/26 09:15:03  | alice     | manual_refund| bkg-1042│     │
│  │ 05/05/26 17:42:11  | bob       | reject_listing|lst-998 │     │
│  │ 05/05/26 12:30:55  | carol     | impersonate  | usr-2341 │     │
│  │ ...                                                       │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  [Exporter CSV (RGPD)]                                                │
└──────────────────────────────────────────────────────────────────────┘
```

### H.2 — Audit entry detail `MVP`

**URL** : `admin.tukio.one/audit/{id}`

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Retour                                                             │
│                                                                       │
│  Action #adt-78421                                                    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Détails                                                     │   │
│  │                                                              │   │
│  │  Date/Heure : 6 mai 2026 à 14:32:18 UTC                      │   │
│  │  Admin : alice@tukio.one (admin-super)                       │   │
│  │  IP : 81.122.XX.XX                                           │   │
│  │  User Agent : Chrome 124 / macOS                             │   │
│  │                                                              │   │
│  │  ─────────────────────────────────────────────               │   │
│  │                                                              │   │
│  │  Action : suspend_user                                       │   │
│  │  Cible : usr-1234 (Event Co Nantes — pro)                    │   │
│  │  Durée : 7 jours                                             │   │
│  │  Raison : anti_disintermediation                             │   │
│  │                                                              │   │
│  │  Justification (texte libre) :                               │   │
│  │  « 3e signalement ce mois pour partage de coords téléphone   │   │
│  │  hors plateforme. Précédemment averti le 04/2026.            │   │
│  │  Suspension graduée. »                                       │   │
│  │                                                              │   │
│  │  ─────────────────────────────────────────────               │   │
│  │                                                              │   │
│  │  Référence(s) :                                              │   │
│  │  • Signalement : rep-1234 [Voir]                             │   │
│  │  • Conversation : conv-1234 [Voir]                           │   │
│  │                                                              │   │
│  │  ─────────────────────────────────────────────               │   │
│  │                                                              │   │
│  │  Conséquences appliquées :                                   │   │
│  │  ✓ Status user → suspended_until 13/05/2026                  │   │
│  │  ✓ 8 services masqués                                        │   │
│  │  ✓ Email user envoyé                                         │   │
│  │  ✓ Email reporter envoyé                                     │   │
│  │  ✓ Event NATS identity.user.suspended.v1 émis                │   │
│  │                                                              │   │
│  │  ─────────────────────────────────────────────               │   │
│  │                                                              │   │
│  │  Hash audit (intégrité) :                                    │   │
│  │  3a8b... (lié au hash précédent #adt-78420)                  │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### H.3 Propriétés de l'audit trail

- **Append-only** : aucune modification possible après écriture
- **Hash chain** : chaque entrée référence le hash de la précédente (détection altération)
- **Conservation indéfinie** au MVP (potentiellement archivage froid après 5 ans)
- **Indexation** : recherche par admin, action, cible, date
- **Export CSV** : pour audits externes / contrôle CNIL

---

## I. Roles & permissions matrix

### I.1 Matrice complète

| Action | admin-super | admin-modo | admin-support |
|--------|:-----------:|:----------:|:-------------:|
| **Reports** | | | |
| Voir reports | ✅ | ✅ | ✅ |
| Décider sur report | ✅ | ✅ | ❌ |
| **Users** | | | |
| Voir profil | ✅ | ✅ | ✅ |
| Notes internes | ✅ | ✅ | ✅ |
| Avertir | ✅ | ✅ | ❌ |
| Suspendre 7j | ✅ | ✅ | ❌ |
| Suspendre 30j | ✅ | ✅ | ❌ |
| Bannir | ✅ | ❌ | ❌ |
| Impersonner | ✅ | ❌ | ❌ |
| Reset password | ✅ | ❌ | ✅ (avec ticket) |
| Forcer logout | ✅ | ✅ | ❌ |
| **Catalog** | | | |
| Voir fiches | ✅ | ✅ | ✅ |
| Approuver fiche | ✅ | ✅ | ❌ |
| Rejeter fiche | ✅ | ✅ | ❌ |
| Retirer fiche publiée | ✅ | ✅ | ❌ |
| **Bookings** | | | |
| Voir bookings | ✅ | ✅ | ✅ |
| Forcer annulation | ✅ | ✅ | ❌ |
| **Finance** | | | |
| Voir dashboard finance | ✅ | ❌ | ✅ (lecture) |
| Refund < 1000 € | ✅ | ✅ | ❌ |
| Refund > 1000 € | ✅ | ❌ | ❌ |
| Voir reconciliation Stripe | ✅ | ❌ | ❌ |
| **Litigation** | | | |
| Voir litiges | ✅ | ✅ | ✅ |
| Médier (messages) | ✅ | ✅ | ❌ |
| Trancher litige | ✅ | ✅ | ❌ |
| Escalader Stripe | ✅ | ❌ | ❌ |
| **Audit** | | | |
| Voir audit complet | ✅ | ❌ (que ses actions) | ❌ (que ses actions) |
| Exporter audit | ✅ | ❌ | ❌ |
| **Settings** | | | |
| Gérer admins | ✅ | ❌ | ❌ |
| Config plateforme | ✅ | ❌ | ❌ |
| Gérer catégories | ✅ | ✅ | ❌ |
| Gérer tiers tarifaires | ✅ | ❌ | ❌ |

### I.2 Implementation

- **JWT claims** : rôle inscrit dans le token Keycloak (`realm_access.roles`)
- **Frontend** : guards par route + masquage UI conditionnel
- **Backend** : middlewares de contrôle sur chaque endpoint admin
- **Tests** : matrice de permissions testée explicitement

---

## J. Anti-recreation patterns

### J.1 Le problème

Un user banni peut tenter de :
- Recréer un compte avec un nouvel email
- Réutiliser le même SIRET avec une nouvelle entité
- Réutiliser les mêmes documents KYC
- Utiliser des données légèrement modifiées (nom, adresse)

### J.2 Patterns de défense `MVP`

#### J.2.1 Hash conservation post-ban

À chaque ban, on conserve un **hash** des éléments identifiants :

| Élément | Hashing | Conservation |
|---------|---------|--------------|
| Email | sha256 | Indéfini |
| SIRET | sha256 | Indéfini |
| Téléphone | sha256 | Indéfini |
| Pièce identité (n° ou hash du document) | sha256 du n° + hash perceptual du fichier | Indéfini |
| Justificatif d'adresse (hash perceptual) | pHash | 5 ans |
| IP de la dernière connexion | sha256 | 1 an |

**Stockage** : table `banned_signatures` séparée, accessible uniquement aux admins.

#### J.2.2 Vérification à l'inscription

À chaque nouvelle inscription pro, le système vérifie :

```
1. Hash email → match dans banned_signatures ? → blocage
2. Hash SIRET → match ? → blocage
3. Hash téléphone → match ? → blocage
```

Si match → modale au user :

```
┌──────────────────────────────────────────────────────┐
│  Inscription impossible                              │
│                                                      │
│  Votre inscription ne peut pas être validée pour des │
│  raisons de sécurité.                                │
│                                                      │
│  Si vous pensez qu'il s'agit d'une erreur, contactez │
│  notre support à appeals@tukio.one en mentionnant    │
│  votre situation.                                    │
│                                                      │
│  [Retour]                                            │
└──────────────────────────────────────────────────────┘
```

Volontairement vague pour ne pas confirmer l'existence d'un ban dans la base.

#### J.2.3 Vérification au moment KYC

Au moment du KYC :

```
1. Hash perceptual du fichier pièce identité → match ? → flag pour modération
2. Hash perceptual du fichier justificatif adresse → match ? → flag
3. N° pièce identité (extrait par OCR V1) → match ? → flag
```

Si flag → modération manuelle obligatoire (pas de blocage auto pour éviter les faux positifs perceptual hash).

### J.2.4 Appeals process

Un user banni peut faire appel via `appeals@tukio.one`. L'admin-super examine et peut :
- Maintenir le ban (réponse motivée par email)
- Lever le ban (suppression du hash de la table `banned_signatures`, action loggée audit)

---

## K. Open design questions

| # | Question | Reco par défaut |
|---|----------|-----------------|
| **K-01** | Double validation pour ban : MVP ou V1 ? | **V1** — au MVP, simple confirmation suffit. Double validation V1 quand équipe admin > 5 |
| **K-02** | Notification reporters de signalement résolu ? | **Oui MVP** (transparence + engagement) |
| **K-03** | Réouverture litige post-résolution : 15 jours ? | **15 jours** au MVP, à ajuster selon retours |
| **K-04** | Impersonate admin : visible côté user ? | **Non** au MVP (debug + support discret), audit trail suffit |
| **K-05** | Notes internes : visibles entre admins ou privées ? | **Visibles entre admins** (collaboration) |
| **K-06** | Hash photos KYC pour anti-recreation : MVP ou V1 ? | **V1** — pHash perceptual lib pas triviale. MVP : juste email/SIRET/tel |
| **K-07** | Audit trail : exportable comment ? | **CSV pour compliance**, JSON pour analyses internes |
| **K-08** | SLA modération signalements : afficher ? | **Oui en interne** (motivation équipe), pas publiquement |
| **K-09** | Auto-modération via IA (V2) | **V2** — coût/bénéfice à mesurer |
| **K-10** | Bot detection inscriptions : MVP ? | **Non MVP**, V1 si abus avéré (Cloudflare Turnstile) |
| **K-11** | Whitelist IPs pour admin login ? | **V1** quand stable. Ajout MFA sufisant au MVP |
| **K-12** | Alerte automatique admin si plusieurs signalements même cible ? | **Oui MVP** (3 signalements en 7 jours sur même cible → alert Slack) |
| **K-13** | Consentement explicite RGPD au moment du ban (kept hash) ? | **Mention dans CGU** suffit (intérêt légitime + protection plateforme) |
| **K-14** | Blacklist domaines email (gmail, etc.) : permise ? | **Non au MVP** (trop de faux positifs). Whitelist domaines suspects (V1) |

---

*Fin du UX Flow Admin & Moderation — version 1, à itérer.*
