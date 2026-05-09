# Tukio — UX Flow: Communication (Doc 5)

> Détail des parcours messagerie (chat customer ↔ pro) et avis (collecte, modération, affichage).
> À lire après : `tukio_spec_v2.md` (§2.6 et §2.7) + `tukio_information_architecture.md` + `tukio_ux_flow_booking.md`
> Audience : designer, produit, dev frontend

---

## Sommaire

- [A. Périmètre du document](#a-périmètre-du-document)
- [B. Messagerie — context & règles](#b-messagerie--context--règles)
- [C. Customer messaging](#c-customer-messaging)
- [D. Pro messaging](#d-pro-messaging)
- [E. Anti-désintermédiation](#e-anti-désintermédiation)
- [F. Reviews — context & règles](#f-reviews--context--règles)
- [G. Customer review flow](#g-customer-review-flow)
- [H. Pro review handling](#h-pro-review-handling)
- [I. Reviews display (public)](#i-reviews-display-public)
- [J. Cross-cutting states](#j-cross-cutting-states)
- [K. Open design questions](#k-open-design-questions)

---

## A. Périmètre du document

### Ce que ce doc couvre

| Domaine | Côté | Écrans | Cible |
|---------|------|--------|-------|
| **Messagerie** | Customer | Conversations list, conversation detail, attachments | MVP / V1 |
| **Messagerie** | Pro | Conversations list (pro-side), conversation detail | MVP / V1 |
| **Avis** | Customer | Review form (post-event), review edit | MVP / V1 |
| **Avis** | Pro | Reviews received list, reply form (V1) | MVP / V1 |
| **Avis** | Public | Review display on service page + pro profile | MVP / V1 |

### Ce que ce doc ne couvre PAS

- Modération admin (cf. Doc 7)
- Notifications push détaillées (cf. `tukio_information_architecture.md` §K)
- L'aspect technique WebSocket (cf. spec backend)
- La note réciproque pro → client en V1 (mentionnée mais flow détaillé séparé si besoin)

### Conventions

Mêmes conventions que les Docs précédents.

---

## B. Messagerie — context & règles

### B.1 Pourquoi une messagerie intégrée ?

Trois raisons fondamentales :

1. **Anti-désintermédiation** : si pro et client peuvent s'échanger leurs coordonnées hors plateforme, ils contournent la commission. Tukio meurt.
2. **Traçabilité litiges** : en cas de litige, l'admin doit pouvoir consulter les échanges pour trancher.
3. **Expérience utilisateur** : ne pas avoir à donner son numéro de téléphone à un inconnu pour organiser un événement = confort réel.

### B.2 Quand peut-on s'écrire ?

| Contexte | Cible MVP | Cible V1 |
|----------|-----------|----------|
| Pendant `pending_pro_acceptance` (avant acceptation) | ❌ | ✅ |
| Après acceptation pro | ✅ | ✅ |
| Pendant un devis (avant booking) | ❌ | ✅ |
| Après l'événement (post-completion) | ✅ (90 jours) | ✅ (90 jours) |
| Conversation libre sans booking lié | ❌ | ❌ (jamais) |

**Décision MVP** : la messagerie n'est **active qu'après acceptation pro**. Avant, le client ne peut que regarder la fiche et décider. Cette restriction est cohérente avec :
- L'anti-désintermédiation (pas d'échange "donne-moi ton numéro et je réserve" via Tukio en mode demande de devis)
- La simplicité du MVP (pas de chat libre à modérer)

**En V1** : ajout de la messagerie devis (chat libre uniquement dans le contexte "Demander un devis" sur une fiche).

### B.3 Anatomie d'une conversation

```
Conversation
├── id
├── bookingId (1:1 avec une booking — au MVP)
├── customerId
├── providerId
├── status (active | archived | locked_by_admin)
├── lastMessageAt
├── unreadByCustomerCount
├── unreadByProviderCount
└── messages[]
    ├── id
    ├── senderId (customer ou pro)
    ├── content (text)
    ├── attachments (V1)
    ├── sentAt
    ├── readAt (par destinataire)
    └── flagged (true si signalé)
```

### B.4 Règles de modération en place

- **Détection regex** (V1) sur emails, téléphones, URLs externes, identifiants réseaux sociaux → masquage automatique avec avertissement
- **Rate limiting** : max 3 messages/heure vers un user qui n'a pas répondu (anti-spam)
- **Pièces jointes** (V1) : scan antivirus + restriction MIME type (PDF, images uniquement)
- **Signalement** : tout user peut signaler un message → file de modération admin
- **Lock par admin** : en cas de litige, admin peut figer la conversation en lecture seule

### B.5 Notifications

| Trigger | Canal | Délai |
|---------|-------|-------|
| Nouveau message reçu | Email (si non lu après 1h) + In-app (V1) | Immédiat |
| 3 messages non lus | Email résumé | Toutes les 6h |
| Message signalé | Notif admin (Slack webhook) | Immédiat |

---

## C. Customer messaging

### C.0 Vue d'ensemble du flow

```
Booking confirmée
   │
   │ Notification "Vous pouvez maintenant échanger avec [Pro]"
   ▼
/account/messages (liste)
   │
   ├── Click conversation → /account/messages/{id}
   │                        │
   │                        ├── Lecture historique
   │                        ├── Envoi message
   │                        ├── Upload attachment (V1)
   │                        └── Signalement message
   │
   └── Filtres : actives / archivées
```

### C.1 — Conversations list `MVP`

**URL** : `/account/messages`

**Source domaine** : 2.6 Messagerie

**Objectif** : retrouver une conversation existante, voir les non-lus, accéder rapidement aux pros actifs.

#### Layout — desktop

```
┌─────────────────────────────────────────────────────────────────┐
│  [Top bar customer]                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mes messages                                                   │
│                                                                 │
│  Filtres : [Tous (5)]  [Non lus (2)]  [Archivés]               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ● [Avatar Pro]  Event Co Nantes                        │   │
│  │     Chapiteau 100 m² · Du 15 au 17 juin                 │   │
│  │     "Bonjour Marie, je confirme bien la livraison à…"   │   │
│  │     il y a 2 heures                              [2]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ● [Avatar Pro]  Loca Events                            │   │
│  │     100 chaises · Le 22 juin                            │   │
│  │     "Vous : Parfait, à samedi !"                        │   │
│  │     hier                                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │    [Avatar Pro]  Event Co Nantes                        │   │
│  │     Mobilier lounge · Le 5 mai                          │   │
│  │     Conversation terminée                               │   │
│  │     il y a 3 semaines                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Card par conversation

Chaque card affiche :
- **Indicateur non-lu** (point coloré ●) si messages non lus
- **Avatar du pro** (rond)
- **Nom commercial du pro**
- **Contexte de la résa** (titre service + dates)
- **Aperçu du dernier message** (max 80 caractères, troncature avec …)
- **Préfixe "Vous :"** si dernier message envoyé par le customer
- **Timestamp relatif** ("il y a 2h", "hier", "il y a 3 semaines")
- **Badge nombre de non-lus** (si > 0)

#### Filtres

- **Tous** (default) : toutes conversations actives + archivées
- **Non lus** : seulement celles avec messages non lus
- **Archivés** : conversations terminées (auto-archivées 90 jours après dernier message)

#### États

- **Empty** :
  ```
  Aucun message pour le moment

  Vous pourrez échanger avec un pro dès qu'une réservation
  sera confirmée.

  [Explorer le catalogue]
  ```
- **Loading** : 5 skeleton cards
- **Error** : message + retry

#### CTAs

- Click sur card → `/account/messages/{id}`
- Pas de bouton "Nouveau message" (au MVP, pas de chat libre)

---

### C.2 — Conversation detail `MVP`

**URL** : `/account/messages/{id}`

**Source domaine** : 2.6 Messagerie

**Objectif** : lire l'historique et envoyer des messages.

#### Layout — desktop

```
┌─────────────────────────────────────────────────────────────────┐
│  [Top bar customer]                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ← Retour aux messages                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Avatar]  Event Co Nantes  ⭐ 4.7                       │   │
│  │            En ligne il y a 5 min                         │   │
│  │  ─────────────────────────────────────                   │   │
│  │  📅 Réservation : Chapiteau 100 m²                       │   │
│  │  Du 15 au 17 juin 2026 · Confirmée                       │   │
│  │  [Voir la réservation]                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ──── Mardi 5 mai 2026 ────                            │   │
│  │                                                         │   │
│  │             ┌────────────────────────────────────────┐  │   │
│  │             │ Bonjour ! Hâte de travailler avec vous │  │   │
│  │             │ pour votre événement.                  │  │   │
│  │             │                              14:32 ✓✓ │  │   │
│  │             └────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌────────────────────────────────────┐                 │   │
│  │  │ Bonjour Marie, je confirme bien la │                 │   │
│  │  │ livraison le 15 à 9h. Pouvez-vous  │                 │   │
│  │  │ confirmer l'accès véhicule jusqu'à │                 │   │
│  │  │ 10m du lieu de pose ?              │                 │   │
│  │  │                              15:14 │                 │   │
│  │  └────────────────────────────────────┘                 │   │
│  │  Event Co Nantes                                        │   │
│  │                                                         │   │
│  │             ┌────────────────────────────────────────┐  │   │
│  │             │ Oui sans problème, le portail est      │  │   │
│  │             │ à 5m du lieu prévu.                    │  │   │
│  │             │                              15:32 ✓✓ │  │   │
│  │             └────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  │  ──── Aujourd'hui ────                                 │   │
│  │                                                         │   │
│  │  ┌────────────────────────────────────┐                 │   │
│  │  │ Parfait. Une dernière question :   │                 │   │
│  │  │ avez-vous prévu un éclairage ?     │                 │   │
│  │  │                              10:45 │                 │   │
│  │  └────────────────────────────────────┘                 │   │
│  │  Event Co Nantes                          [Signaler]    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Tapez votre message…                                   │   │
│  │                                                         │   │
│  │  📎 *(V1)*                                  [Envoyer]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Zones

1. **Header conversation** : avatar pro + nom + note + statut "en ligne il y a X" (V1) + lien vers résa
2. **Pinned booking card** (sous le header) : rappel de la résa avec lien direct
3. **Messages stream** : bulles alignées à droite (customer) / gauche (pro), regroupées par jour
4. **Composer** : textarea + bouton envoyer + attachment (V1)

#### Bulles de message

- **Bulle customer (envoyée)** : alignée droite, fond `cream-200`, coins arrondis avec coin bas-droit moins arrondi
- **Bulle pro (reçue)** : alignée gauche, fond `cream-100`, coin bas-gauche moins arrondi
- **Timestamp** : sous chaque bulle, `text-xs`, `charcoal-400`
- **Indicateurs lecture** :
  - `✓` (envoyé)
  - `✓✓` (lu) — couleur `brand-500`
- **Nom pro** affiché sous chaque bulle pro pour clarté (utile dans une longue conversation)

#### Composer

- **Auto-resize** textarea (max 6 lignes visibles, scroll au-delà)
- **Enter pour envoyer** (Shift+Enter pour nouvelle ligne)
- **Caractère max** : 4000 par message
- **Compteur** discret sous le composer si > 3500
- **État disabled** :
  - Si conversation `archived` : composer caché, message "Cette conversation est archivée"
  - Si conversation `locked_by_admin` : composer caché, message "Cette conversation est en cours d'examen par notre équipe"

#### Comportement

- **Auto-scroll** vers le dernier message à l'ouverture
- **Marquage lu automatique** quand le message est visible (intersection observer)
- **Polling toutes les 5s** au MVP (V1 : WebSocket pour temps réel)
- **Optimistic UI** : message affiché immédiatement après envoi, mise à jour avec timestamp réel quand serveur ACK
- **Retry automatique** si envoi échoue (3 tentatives) puis affichage erreur "Réessayer"

#### États

- **Empty** (conversation jamais utilisée) :
  ```
  Premier échange avec [Nom Pro]

  Vous pouvez maintenant discuter avec votre prestataire pour
  finaliser les détails de l'événement.

  💡 Vos coordonnées personnelles ont été partagées avec le pro
  pour faciliter la logistique.
  ```
- **Loading older messages** (scroll vers le haut) : spinner inline
- **Network offline** : banner "Vous êtes hors ligne. Vos messages seront envoyés à la reconnexion."

---

### C.3 — Message actions `MVP`

#### Long press / hover sur un message

Affiche un menu d'actions :
- **Copier** le texte
- **Signaler** (si message reçu, pas envoyé par soi)

#### Signalement d'un message

Click "Signaler" → modale :

```
┌─────────────────────────────────────┐
│  Signaler ce message                │
│                                     │
│  Pourquoi signalez-vous ce message ?│
│                                     │
│  ○ Contenu inapproprié              │
│  ○ Tentative de contournement       │
│    (numéro, email, autre site)      │
│  ○ Spam ou promotion                │
│  ○ Comportement menaçant            │
│  ○ Autre                            │
│                                     │
│  Précisez (optionnel) :             │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Annuler]      [Envoyer]           │
└─────────────────────────────────────┘
```

Post-signalement :
- Toast confirmation "Signalement envoyé. Notre équipe va l'examiner."
- Message reste visible côté customer (pas de masquage immédiat)
- Notification admin instantanée (Slack webhook)
- Décision admin sous 24h ouvrées

---

### C.4 — Attachments (V1)

**Cible** : V1

#### Layout dans le composer

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Tapez votre message…                                   │
│                                                         │
│  ┌───────────────────────────┐                          │
│  │ 📄 plan-implantation.pdf │  [×]                     │
│  │ 245 Ko                    │                          │
│  └───────────────────────────┘                          │
│                                                         │
│  📎  [Envoyer]                                          │
└─────────────────────────────────────────────────────────┘
```

#### Règles

- **Formats acceptés** : PDF, JPG, PNG, HEIC
- **Taille max** : 10 Mo par fichier
- **Nombre max** : 5 fichiers par message
- **Scan antivirus** asynchrone (status `pending` → `clean` ou `infected`)
- **Si infected** : fichier rejeté, message d'erreur

#### Affichage dans la bulle

Pour les images : preview thumbnail cliquable → lightbox plein écran.
Pour les PDF : icône + nom du fichier + bouton "Télécharger".

---

## D. Pro messaging

### D.1 — Conversations list (pro view) `MVP`

**URL** : `/seller/messages`

**Différences vs customer view** :

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Top bar pro]                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Messages                                                       │
│                                                                 │
│  Filtres : [Tous (12)]  [Non lus (4)]  [Sans réponse (2)]      │
│             [Archivés]                                          │
│                                                                 │
│  Tri :  [Plus récents ▾]                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ● [Avatar Customer]  Marie Dupont                      │   │
│  │     Chapiteau 100 m² · Du 15 au 17 juin                 │   │
│  │     "Parfait, à samedi !"                               │   │
│  │     il y a 2 heures                              [1]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ● [Avatar Customer]  Pierre Martin            ⏱ 6h     │   │
│  │     100 chaises · Le 22 juin                            │   │
│  │     "Pouvez-vous confirmer le lieu de livraison ?"      │   │
│  │     hier                                         [3]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Différences spécifiques pro

- **Filtre "Sans réponse"** : conversations où le dernier message est du customer et non répondu depuis > 4h
- **Indicateur ⏱ X** : affiche depuis combien de temps le message est en attente de réponse (alerte si > 4h)
- **Métrique en haut (V1)** : "Temps de réponse moyen : 1h32 — 🟢 Excellent"

#### États

- **Empty** : "Aucun message pour le moment. Les messages des clients apparaîtront ici une fois leurs réservations acceptées."

---

### D.2 — Conversation detail (pro view) `MVP`

**URL** : `/seller/messages/{id}`

**Différences vs customer view** :

#### Header différent

```
┌─────────────────────────────────────────────────────────┐
│  [Avatar]  Marie Dupont                                 │
│            1ʳᵉ réservation Tukio                        │
│  ─────────────────────────────────────                  │
│  📅 Réservation : Chapiteau 100 m²                      │
│  Du 15 au 17 juin 2026 · Confirmée                      │
│  [Voir la réservation]                                  │
│  ─────────────────────────────────────                  │
│  📞 Téléphone : 06 12 34 56 78  (visible après accept.) │
│  📧 Email : marie.dupont@example.com                    │
└─────────────────────────────────────────────────────────┘
```

Le pro voit :
- **Identité customer** : prénom + nom
- **Historique customer** : "1ʳᵉ réservation Tukio" / "5 réservations Tukio" (preuve sociale)
- **Coordonnées contact** : téléphone + email (révélés post-acceptation, cf. ADR §C UX flow booking)

#### Templates de réponse (V1)

Pro peut sauvegarder des templates fréquents :

```
┌─────────────────────────────────────────────────────────┐
│  Tapez votre message…                                   │
│                                                         │
│  📎  📋 Templates ▾  [Envoyer]                          │
└─────────────────────────────────────────────────────────┘

Click sur 📋 Templates :
- "Confirmation livraison"
- "Demande info complémentaire"
- "Confirmation montage J-1"
- "+ Créer un template"
```

#### Notes internes (V1)

Pro peut ajouter des notes invisibles pour le customer :

```
┌─────────────────────────────────────────────────────────┐
│  💬 Note interne (visible uniquement par vous)          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Client exigeant, prévoir 30 min de plus pour    │   │
│  │ le montage.                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Sauvegarder]                                          │
└─────────────────────────────────────────────────────────┘
```

---

## E. Anti-désintermédiation

### E.1 Les patterns à détecter

Détection regex au moment de l'envoi (côté serveur, pas côté client) :

| Pattern | Exemple détecté |
|---------|------------------|
| Email | `john@example.com`, `john[at]example.com`, `john (a) example com` |
| Téléphone FR | `06 12 34 56 78`, `+33 6 12 34 56 78`, `0612345678`, `06.12.34.56.78` |
| URLs externes | `https://...`, `www.example.com`, `example.com` |
| Identifiants réseaux | `@username`, `WhatsApp 06...`, `mon insta : @x` |
| Variantes obfusquées | `j o h n @ e x a m p l e`, `zero six douze...` |

### E.2 Comportement à la détection

3 stratégies possibles, à débattre avec le founder :

#### Stratégie 1 — Masquage transparent (recommandée MVP)

```
Message envoyé : "Tu peux m'appeler au 06 12 34 56 78"

Affiché chez destinataire : "Tu peux m'appeler au [numéro masqué]"
```

Avec banner discret au-dessus : "Pour votre sécurité, les coordonnées personnelles sont masquées dans la messagerie."

#### Stratégie 2 — Blocage de l'envoi

L'envoi est refusé. Toast d'erreur :
> "Votre message contient des coordonnées personnelles qui ne peuvent pas être partagées via la messagerie. Vos coordonnées sont déjà visibles dans le détail de la réservation."

#### Stratégie 3 — Avertissement sans blocage

L'envoi passe mais flag interne pour modération admin.

**Ma reco** : **Stratégie 1 au MVP** (masquage), car :
- Pas frustrant pour les users (le message passe)
- Anti-désintermédiation efficace
- Pas de faux positifs bloquants

### E.3 Faux positifs

Cas réels à gérer :
- Adresse événement dans un message : "Livraison au 12 rue des Lilas, 44000 Nantes" → ne pas masquer (adresse normale)
- Numéro de chambre/référence : "Salle 06 du château" → ne pas masquer
- Date format français : "15.06.2026" → ne pas confondre avec téléphone

Solution : **whitelist contextuelle** + tests réguliers sur dataset réel.

### E.4 Logging des détections

Chaque détection est loggée (sans le contenu, juste le type de pattern + conversation ID) pour :
- Calibrer les regex (ratio détection / faux positif)
- Détecter les pros / clients récidivistes (alerte admin si > 5 tentatives)

---

## F. Reviews — context & règles

### F.1 Pourquoi les avis sont critiques

Pour un marketplace local en cold-start, les premiers avis sont **vitaux** :
- Sans avis, les pros ne convertissent pas (clients méfiants)
- Sans pros qui convertissent, pas de plus-value pour les clients
- Spirale négative possible si on n'amorce pas

### F.2 Modèle d'avis MVP

```
Review
├── id
├── bookingId (1:1 — un avis par booking)
├── customerId
├── providerId
├── listingId (snapshoté)
├── rating (1-5 étoiles, entier)
├── content (text, 50-2000 caractères)
├── photos (V1, max 3)
├── status (pending_moderation | published | rejected | hidden)
├── publishedAt
├── editableUntil (publishedAt + 30 jours)
├── proResponse (V1 — réponse du pro, 1 seule)
└── reportCount
```

### F.3 Modèle V1 — Avis multi-critères

En V1, l'avis a **4 dimensions** :

| Critère | Échelle |
|---------|---------|
| Qualité du service | 1-5 |
| Ponctualité | 1-5 |
| Communication | 1-5 |
| Rapport qualité/prix | 1-5 |

Note globale = moyenne arithmétique des 4 critères (arrondie à 0,1 près).

### F.4 Quand un avis peut-il être laissé ?

- **Trigger** : booking → status `completed` (cron J+1 après date événement)
- **Demande envoyée** : email J+1 + relance J+7
- **Lien valable** : 30 jours après publication
- **Modification** : possible 30 jours après publication
- **Suppression par customer** : impossible (mais peut éditer pour mettre à jour)

### F.5 Affichage agrégé

Sur la fiche service et le profil pro :

```
⭐ 4.7 sur 23 avis
(12 avis sur les 6 derniers mois)
```

**Calcul** : moyenne pondérée par récence — avis < 6 mois pèsent 2× plus.

### F.6 Modération

- **Pré-modération** des avis 1 ou 2 étoiles : passage en `pending_moderation` automatique pour vérifier qu'il n'y a pas d'insultes / diffamation
- **Pré-modération des avis 3-5 étoiles** : pas obligatoire (publication directe), mais signalement post-publication possible
- **Modération sur signalement** : tout avis signalé passe en file admin sous 24h

### F.7 Règles fortes

- Un avis n'est valide que si :
  - Le customer a une booking `completed`
  - L'avis est laissé dans les 90 jours après l'événement
  - C'est le **premier avis** de ce customer pour cette booking (pas de doublon)
- Pour notes ≤ 2 : commentaire **min 100 caractères** obligatoire (pas de "1 étoile sans contexte")
- Pour notes 3-5 : commentaire **min 50 caractères**

---

## G. Customer review flow

### G.0 Vue d'ensemble

```
Booking → status `completed` (J+1)
   │
   │ Email "Comment s'est passé votre événement ?"
   │ + In-app notification "À évaluer"
   ▼
Click email OU /account/bookings/{id}/review
   ▼
Formulaire d'avis
   │
   │ [Publier mon avis]
   ▼
Avis publié (ou pending_moderation si note ≤ 2)
   ▼
Possibilité d'éditer pendant 30 jours
```

### G.1 — Email de demande d'avis `MVP`

Envoyé J+1 après l'événement.

```
Objet : Comment s'est passé votre événement ? 🎉

Bonjour Marie,

Votre événement avec Event Co Nantes s'est-il bien déroulé ?

Votre avis aide d'autres clients à choisir leurs prestataires
en confiance, et soutient Event Co dans son activité.

[Laisser un avis]

Cela vous prendra moins de 2 minutes.

Merci !
L'équipe Tukio
```

**Relance J+7** : email plus court, ton décontracté.

### G.2 — Review form (MVP — note unique)

**URL** : `/account/bookings/{id}/review`

#### Layout MVP

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Retour à la réservation                                      │
│                                                                 │
│  Comment s'est passé votre événement ?                          │
│                                                                 │
│  Chapiteau 100 m² blanc chic                                    │
│  Event Co Nantes · Le 15 juin 2026                              │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Note globale *                                                 │
│  ☆ ☆ ☆ ☆ ☆                                                    │
│                                                                 │
│  Votre commentaire *                                            │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │ Décrivez votre expérience pour aider d'autres       │       │
│  │ clients…                                            │       │
│  │                                                     │       │
│  │                                                     │       │
│  └─────────────────────────────────────────────────────┘       │
│  Min 50 caractères                                              │
│                                                                 │
│  💡 Bon à savoir                                                │
│  Votre avis sera visible publiquement (votre prénom +           │
│  initiale de nom). Le pro pourra y répondre publiquement (V1).  │
│                                                                 │
│  Vous pouvez modifier votre avis pendant 30 jours.              │
│                                                                 │
│  [Plus tard]                              [Publier mon avis]    │
└─────────────────────────────────────────────────────────────────┘
```

#### Comportement note

- 5 étoiles cliquables (et hover : surlignage progressif comme la plupart des sites)
- Note sélectionnée : étoiles pleines en `brand-500`
- Hover sur étoile : preview de la note ("Très bon", "Bon", "Moyen", "Décevant", "Mauvais")
- Si note ≤ 2 : message d'aide apparaît : "Pour mieux comprendre votre expérience, merci de détailler (min 100 caractères)"

#### Validation

- Note obligatoire (1-5)
- Commentaire min 50 caractères (100 si note ≤ 2)

### G.3 — Review form (V1 — multi-critères)

#### Layout V1

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Retour à la réservation                                      │
│                                                                 │
│  Comment s'est passé votre événement ?                          │
│                                                                 │
│  Chapiteau 100 m² blanc chic                                    │
│  Event Co Nantes · Le 15 juin 2026                              │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Évaluez chaque critère                                         │
│                                                                 │
│  Qualité du service *                                           │
│  ☆ ☆ ☆ ☆ ☆                                                    │
│  Le matériel correspond-il à vos attentes ?                     │
│                                                                 │
│  Ponctualité *                                                  │
│  ☆ ☆ ☆ ☆ ☆                                                    │
│  Livraison et reprise dans les temps ?                          │
│                                                                 │
│  Communication *                                                │
│  ☆ ☆ ☆ ☆ ☆                                                    │
│  Réactivité, clarté des échanges                                │
│                                                                 │
│  Rapport qualité/prix *                                         │
│  ☆ ☆ ☆ ☆ ☆                                                    │
│                                                                 │
│  Note globale calculée : 4,5 / 5                                │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Votre commentaire *                                            │
│  [Textarea]                                                     │
│                                                                 │
│  Photos de l'événement (optionnel) *(V1)*                       │
│  [+ Ajouter des photos] · 3 max                                 │
│                                                                 │
│  ☐ Recommanderiez-vous ce pro ?                                 │
│                                                                 │
│  [Plus tard]                              [Publier mon avis]    │
└─────────────────────────────────────────────────────────────────┘
```

### G.4 — Post-publication

#### Confirmation immédiate

```
┌─────────────────────────────────────┐
│  ✓ Merci pour votre avis !          │
│                                     │
│  Votre avis a été publié.           │
│                                     │
│  Vous pouvez le modifier pendant    │
│  30 jours.                          │
│                                     │
│  [Voir mon avis]                    │
│  [Retour aux réservations]          │
└─────────────────────────────────────┘
```

#### Si avis ≤ 2 (pré-modération)

```
┌─────────────────────────────────────┐
│  ✓ Avis enregistré                  │
│                                     │
│  Notre équipe va examiner votre     │
│  avis sous 24h ouvrées avant        │
│  publication.                       │
│                                     │
│  Vous serez notifié·e par email.    │
│                                     │
│  [Retour aux réservations]          │
└─────────────────────────────────────┘
```

### G.5 — Edit review `MVP`

**URL** : `/account/bookings/{id}/review` (même URL, mode édition si avis existe)

Pendant 30 jours après publication, le customer peut modifier son avis. Au-delà : lecture seule.

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Retour à la réservation                                      │
│                                                                 │
│  Modifier votre avis                                            │
│                                                                 │
│  Vous pouvez modifier votre avis pendant encore 22 jours.       │
│                                                                 │
│  [Mêmes champs que création, pré-remplis]                       │
│                                                                 │
│  [Annuler]                              [Enregistrer]           │
└─────────────────────────────────────────────────────────────────┘
```

Modification = nouvelle révision (audit trail), pas de "perte" de l'historique.

---

## H. Pro review handling

### H.0 Vue d'ensemble

```
Avis publié sur fiche pro
   │
   │ Notification "Vous avez un nouvel avis ⭐⭐⭐⭐⭐"
   ▼
/seller/reviews
   │
   ├── Lecture des avis
   ├── Réponse à un avis (V1, Business+)
   ├── Signalement d'un avis abusif
   └── Filtres : tous / non répondus / signalés
```

### H.1 — Reviews list (pro view) `MVP`

**URL** : `/seller/reviews`

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Top bar pro]                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Avis reçus                                                     │
│                                                                 │
│  Vue d'ensemble                                                 │
│  ⭐ 4.7 sur 23 avis (12 sur les 6 derniers mois)                │
│  Distribution :                                                  │
│  ⭐⭐⭐⭐⭐  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 18                               │
│  ⭐⭐⭐⭐    ▓▓▓ 3                                              │
│  ⭐⭐⭐      ▓▓ 2                                                │
│  ⭐⭐        0                                                   │
│  ⭐          0                                                   │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Filtres : [Tous (23)]  [Non répondus (5)]  [Avec photos (V1)]  │
│  Tri :  [Plus récents ▾]                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⭐⭐⭐⭐⭐  Marie D. — il y a 2 jours                        │   │
│  │  Chapiteau 100 m² · Réservation du 15 juin              │   │
│  │                                                         │   │
│  │  "Excellent service ! Le chapiteau était parfaitement   │   │
│  │  monté à l'arrivée des invités, et l'équipe a été très  │   │
│  │  pro tout au long. Je recommande !"                     │   │
│  │                                                         │   │
│  │  [Répondre] *(V1)*    [Signaler]                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⭐⭐⭐  Pierre M. — il y a 1 semaine                       │   │
│  │  Mobilier lounge · Réservation du 5 mai                 │   │
│  │                                                         │   │
│  │  "Matériel correct mais livraison avec 1h de retard,    │   │
│  │  un peu juste pour l'événement…"                        │   │
│  │                                                         │   │
│  │  Votre réponse :                                        │   │
│  │  "Bonjour Pierre, désolé pour ce retard…"               │   │
│  │                                                         │   │
│  │  [Modifier la réponse] *(V1)*                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Filtres

- **Tous** (default)
- **Non répondus** (V1)
- **Avec photos** (V1)
- **3 étoiles ou moins** (V1, pour traiter les négatifs en priorité)

### H.2 — Reply to a review (V1, Business+)

**URL** : `/seller/reviews/{id}/reply`

#### Restrictions

- Seuls les pros tier `Business` ou supérieur peuvent répondre
- **1 seule réponse** par avis (pas d'échange)
- Limite : 1000 caractères
- Pas modifiable après envoi (sauf admin)

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Répondre à l'avis de Pierre M.                                 │
│                                                                 │
│  Avis original :                                                │
│  ⭐⭐⭐ "Matériel correct mais livraison avec 1h de retard…"     │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Votre réponse                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ Bonjour Pierre, je vous remercie pour votre         │       │
│  │ retour. Le retard de livraison était dû à un        │       │
│  │ embouteillage exceptionnel sur la rocade. Nous      │       │
│  │ avons depuis renforcé notre temps de marge…         │       │
│  └─────────────────────────────────────────────────────┘       │
│  187 / 1000 caractères                                          │
│                                                                 │
│  💡 Bonnes pratiques pour répondre :                            │
│  • Restez professionnel·le, même face à la critique             │
│  • Reconnaissez le problème s'il y en a un                      │
│  • Expliquez ce que vous avez mis en place pour l'éviter        │
│  • Évitez les justifications excessives                         │
│                                                                 │
│  [Annuler]                              [Publier ma réponse]    │
└─────────────────────────────────────────────────────────────────┘
```

### H.3 — Signaler un avis abusif `MVP`

**URL** : modale depuis `/seller/reviews`

#### Cas légitimes de signalement

- Insultes ou diffamation
- Avis ne correspondant pas à une vraie prestation (faux avis)
- Tentative de chantage / extorsion
- Contenu illégal
- Erreur évidente (avis posté sur le mauvais service)

#### Modale

```
┌─────────────────────────────────────┐
│  Signaler cet avis                  │
│                                     │
│  Pourquoi signalez-vous cet avis ?  │
│                                     │
│  ○ Insultes ou diffamation          │
│  ○ Faux avis (pas une vraie résa)   │
│  ○ Tentative de chantage            │
│  ○ Contenu illégal                  │
│  ○ Posté sur le mauvais service     │
│  ○ Autre                            │
│                                     │
│  Précisez (recommandé) :            │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Annuler]      [Envoyer]           │
└─────────────────────────────────────┘
```

#### Post-signalement

- Avis reste visible publiquement pendant l'examen
- File modération admin sous 24h
- Décision : maintenir / supprimer / modifier (rare)

---

## I. Reviews display (public)

### I.1 — Sur la fiche service `MVP`

Cf. `tukio_ux_flow_catalog.md` C.4 — section "Avis (12)".

```
┌─────────────────────────────────────────────────────────┐
│  Avis (23)                                              │
│  ⭐ 4.7 — 23 avis vérifiés                              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ⭐⭐⭐⭐⭐  Marie D. — il y a 2 jours                │   │
│  │                                                 │   │
│  │  "Excellent service ! Le chapiteau était        │   │
│  │  parfaitement monté…"                           │   │
│  │                                                 │   │
│  │  Voir plus                                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Affichage 3 derniers avis]                            │
│                                                         │
│  [Voir tous les avis (23)]                              │
└─────────────────────────────────────────────────────────┘
```

#### Click "Voir tous les avis"

Ouvre une modale ou redirige vers `/pro/{slug}#reviews`.

### I.2 — Sur le profil pro `MVP`

Cf. `tukio_ux_flow_catalog.md` C.5.

```
┌─────────────────────────────────────────────────────────────────┐
│  Avis (23)                                                      │
│                                                                 │
│  Note globale  ⭐ 4.7                                            │
│                                                                 │
│  Distribution (V1) :                                            │
│  ⭐⭐⭐⭐⭐  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 18                                  │
│  ⭐⭐⭐⭐    ▓▓▓ 3                                                 │
│  ⭐⭐⭐      ▓▓ 2                                                  │
│                                                                 │
│  Filtres : [Tous]  [Avec photos]  [Plus récents ▾]              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⭐⭐⭐⭐⭐  Marie D. — il y a 2 jours                        │   │
│  │  Chapiteau 100 m² (réservation vérifiée)                │   │
│  │                                                         │   │
│  │  "Excellent service ! Le chapiteau était parfaitement   │   │
│  │  monté à l'arrivée des invités…"                        │   │
│  │                                                         │   │
│  │  [Photos V1]                                            │   │
│  │                                                         │   │
│  │  Réponse de Event Co Nantes : *(V1)*                    │   │
│  │  ┌───────────────────────────────────────────────┐     │   │
│  │  │ Merci Marie pour ce retour ! Au plaisir de    │     │   │
│  │  │ travailler à nouveau avec vous.               │     │   │
│  │  └───────────────────────────────────────────────┘     │   │
│  │                                                         │   │
│  │  [Signaler]                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Pagination : 10 avis par page]                                │
└─────────────────────────────────────────────────────────────────┘
```

### I.3 — Affichage anonymisé

L'auteur de l'avis est affiché comme **prénom + initiale de nom** :
- Marie Dupont → "Marie D."
- Jean-Pierre Lefèvre → "Jean-Pierre L."

Pas de photo de profil customer affichée (préserve l'anonymat).

### I.4 — Mention "Réservation vérifiée"

Sous chaque avis : mention "Chapiteau 100 m² (réservation vérifiée)".

C'est un **signal de confiance** majeur — chaque avis correspond à une vraie booking sur Tukio. Pas de faux avis possibles.

### I.5 — Signalement d'un avis (côté visiteur)

Tout visiteur (connecté ou non) peut signaler un avis qui semble abusif. Click "Signaler" → modale similaire à H.3 mais avec catégories adaptées au visiteur :

- Insultes
- Spam ou promotion
- Contenu illégal
- Manifestement faux

---

## J. Cross-cutting states

### J.1 Empty states

| Contexte | Message | CTA |
|----------|---------|-----|
| Customer — aucune conversation | "Aucun message pour le moment. Vous pourrez échanger avec un pro dès qu'une réservation sera confirmée." | "Explorer le catalogue" |
| Pro — aucune conversation | "Aucun message pour le moment. Les messages des clients apparaîtront ici une fois leurs réservations acceptées." | — |
| Customer — aucun avis à laisser | "Aucun avis en attente. Bonne nouvelle : tous vos événements passés sont évalués !" | — |
| Pro — aucun avis reçu | "Aucun avis pour le moment. Les avis apparaîtront ici dès que vos premiers événements seront terminés." | — |

### J.2 Loading states

- Conversations list : 5 skeleton cards
- Conversation detail : skeleton header + 3 skeleton bulles
- Reviews list : 5 skeleton cards
- Review form : skeleton structure

### J.3 Error states

- Conversation impossible à charger : message + bouton retry
- Échec envoi message : retry auto x3 puis affichage erreur "Réessayer"
- Échec publication avis : message + sauvegarde brouillon en local

### J.4 Notifications consolidées

Liste des notifications transverses générées par messagerie + avis :

| Trigger | Cible | Canal MVP | Canal V1 |
|---------|-------|-----------|----------|
| Nouveau message reçu (customer) | Customer | Email (si non lu 1h) | + In-app |
| Nouveau message reçu (pro) | Pro | Email (si non lu 1h) | + In-app + SMS option |
| Message signalé | Admin | Slack | Slack + dashboard |
| Avis publié | Pro | Email | + In-app |
| Avis signalé | Admin | Slack | Slack + dashboard |
| Demande d'avis (J+1) | Customer | Email | + In-app |
| Relance demande d'avis (J+7) | Customer | Email | + In-app |
| Réponse pro à avis (V1) | Customer | Email | + In-app |

---

## K. Open design questions

| # | Question | Reco par défaut |
|---|----------|-----------------|
| **F-01** | Messagerie temps réel WebSocket dès MVP ou polling ? | **Polling 5s au MVP**, WebSocket en V1 — pas critique au début |
| **F-02** | Pièces jointes : MVP ou V1 ? | **V1** — complexité (scan AV, stockage, modération) |
| **F-03** | Anti-désintermédiation : masquage / blocage / warning ? | **Masquage** (stratégie 1) — best UX/sécurité |
| **F-04** | Note réciproque pro → client en V1 ? | **Oui en V1** — visible aux autres pros, masquée aux customers |
| **F-05** | Pré-modération avis ≤ 2 étoiles ? | **Oui** — éviter avis insultants en ligne directe |
| **F-06** | Modification avis : oui / non / délai ? | **Oui pendant 30 jours** post-publication |
| **F-07** | Affichage photos dans avis : MVP ou V1 ? | **V1** — pas vital au MVP, complexité modération photos |
| **F-08** | Réponse pro aux avis : tous tiers ou Business+ ? | **Business+** — incentive abonnement |
| **F-09** | Avis multi-critères au MVP ou V1 ? | **MVP : note unique** — V1 : multi-critères. Migrer les notes existantes en "qualité" |
| **F-10** | Messagerie pour devis (V1) : conversation séparée ou même thread ? | **Même thread** : la conversation devis devient la conversation booking après acceptation |
| **F-11** | Conversations groupées multi-bookings (même customer × pro plusieurs résa) ? | **Une conversation par booking au MVP**, regroupement V1 si demandé |
| **F-12** | Customer peut-il supprimer son avis ? | **Non** (mais peut éditer pendant 30j). Anonymisation automatique en cas de suppression de compte. |

---

*Fin du UX Flow Communication — version 1, à itérer.*
