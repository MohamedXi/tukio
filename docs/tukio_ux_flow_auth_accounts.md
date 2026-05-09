# Tukio — UX Flow: Auth & Accounts (Doc 4)

> Détail des parcours d'authentification et de gestion de compte (customer, pro, admin).
> À lire après : `tukio_spec_v2.md` + `tukio_information_architecture.md` + `tukio_design_brief.md`
> Audience : designer, produit, dev frontend

---

## Sommaire

- [A. Périmètre du document](#a-périmètre-du-document)
- [B. Customer registration & login](#b-customer-registration--login)
- [C. Pro registration & onboarding wizard](#c-pro-registration--onboarding-wizard)
- [D. Customer profile & settings](#d-customer-profile--settings)
- [E. Pro profile & settings](#e-pro-profile--settings)
- [F. Admin auth (separate)](#f-admin-auth-separate)
- [G. Cross-cutting: Keycloak themed pages](#g-cross-cutting-keycloak-themed-pages)
- [H. Account state machine](#h-account-state-machine)
- [I. Open design questions](#i-open-design-questions)

---

## A. Périmètre du document

### Ce que ce doc couvre

| Côté | Écrans | Cible |
|------|--------|-------|
| Customer auth | Register, login, password reset, email verification | MVP |
| Pro auth + onboarding wizard | Register, KYC upload, Stripe Connect redirect, profil pro | MVP |
| Account settings (customer + pro) | Identity, security, notifications, payment methods, company info | MVP / V1 |
| Admin auth | Login, MFA forced setup | MVP |
| KYC flow détaillé | Upload, validation, états | MVP |

### Ce que ce doc ne couvre PAS

- Détail technique de Keycloak (cf. `tukio_spec_v2.md` §2.1 et `tukio_product_tech_alignment.md` ADR-009)
- Création du **premier service** par le pro (cf. `tukio_ux_flow_catalog.md` §B.2)
- Configuration KYC financier Stripe Connect (cf. `tukio_booking_paiements_deepdive.md`)

### Conventions du doc

Mêmes conventions que les Docs 2-3 : wireframes ASCII pour les écrans clés, descriptions plus synthétiques pour les écrans triviaux. Tags `MVP`/`V1`/`V2`.

---

## B. Customer registration & login

### B.0 Vue d'ensemble du flow

```
Acquisition (homepage CTA, /sell, partage)
   │
   ├── [S'inscrire] → auth.tukio.one/registration (Keycloak themed)
   │                  │
   │                  ▼
   │              Email verification → /account (first login dashboard)
   │
   ├── [Se connecter] → auth.tukio.one/login (Keycloak themed)
   │                    │
   │                    ▼
   │                /account (dashboard)
   │
   └── [Mot de passe oublié] → auth.tukio.one/forgot-password
                                │
                                ▼
                            Email reçu → reset → login → /account
```

### B.1 — Customer registration `MVP`

**URL** : `auth.tukio.one/realms/tukio/registration`

**Source domaine** : 2.1 Comptes & utilisateurs

**Note importante** : ces pages sont servies par **Keycloak** avec un thème custom Tukio. Elles ne sont pas codées dans la stack Next.js Tukio — elles sont implémentées en thème Keycloak (Freemarker templates + CSS custom).

#### Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [Logo Tukio]                           │
│                                                     │
│      Créez votre compte Tukio                       │
│                                                     │
│  Trouvez les pros de l'événementiel près de chez    │
│  vous, en confiance.                                │
│                                                     │
│  Email *                                            │
│  ┌───────────────────────────────────────────┐     │
│  │                                           │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  Mot de passe *                                     │
│  ┌───────────────────────────────────────────┐     │
│  │                                       👁  │     │
│  └───────────────────────────────────────────┘     │
│  Au moins 8 caractères, une majuscule, un chiffre   │
│                                                     │
│  Prénom *                                           │
│  ┌───────────────────────────────────────────┐     │
│  │                                           │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  Nom *                                              │
│  ┌───────────────────────────────────────────┐     │
│  │                                           │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ☐ J'accepte les CGU et la Politique de            │
│     confidentialité                                 │
│                                                     │
│  ☐ Je souhaite recevoir des conseils événementiels │
│     par email (optionnel, désinscription possible)  │
│                                                     │
│  [Créer mon compte]                                 │
│                                                     │
│  ─────  ou  ─────                                  │
│                                                     │
│  [📧 Continuer avec Google]      *(V1)*            │
│  [🍎 Continuer avec Apple]       *(V1)*            │
│                                                     │
│  Déjà un compte ? Connectez-vous                    │
│                                                     │
│  Vous êtes professionnel ? Créez un compte pro      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Validation

- Email : format valide + unique (vérification async)
- Password : 8+ chars, 1 majuscule, 1 chiffre minimum
- Prénom + nom : 2+ chars chacun
- CGU : checkbox obligatoire
- Marketing consent : optionnel (RGPD)

#### Comportement post-submit

1. Création compte dans Keycloak avec `role: client`
2. Email de vérification envoyé immédiatement (Resend → template)
3. Redirect vers `auth.tukio.one/realms/tukio/verify-email` (page d'attente)
4. Click email → vérification → redirect vers `tukio.one/account`

#### États

- **Email déjà utilisé** : erreur in-line "Cet email est déjà utilisé. [Connectez-vous] ou [récupérez votre mot de passe]"
- **Password trop faible** : barre de force + message d'aide
- **Submit loading** : bouton désactivé + spinner
- **Server error** : message générique avec ID de support

#### Notes design

- C'est une **première impression** critique. Pages claires, sobres, rassurantes.
- Lien "compte pro" subtil mais visible — éviter que des pros s'inscrivent en customer par erreur.
- Pas de captcha au MVP (friction). À ajouter en V1 si abus détecté (Cloudflare Turnstile).

---

### B.2 — Customer login `MVP`

**URL** : `auth.tukio.one/realms/tukio/login`

#### Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [Logo Tukio]                           │
│                                                     │
│      Connexion à votre compte                       │
│                                                     │
│  Email *                                            │
│  ┌───────────────────────────────────────────┐     │
│  │                                           │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  Mot de passe *                                     │
│  ┌───────────────────────────────────────────┐     │
│  │                                       👁  │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ☑ Rester connecté·e                                │
│                                                     │
│  [Se connecter]                                     │
│                                                     │
│  [Mot de passe oublié ?]                            │
│                                                     │
│  ─────  ou  ─────                                  │
│                                                     │
│  [📧 Continuer avec Google]      *(V1)*            │
│  [🍎 Continuer avec Apple]       *(V1)*            │
│                                                     │
│  Pas encore de compte ? S'inscrire                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Comportement

- "Rester connecté·e" : refresh token long (30 jours vs 7 jours par défaut)
- 5 échecs consécutifs → captcha (V1) ou throttle 15 min
- Si user a MFA activé → second écran TOTP avant accès au dashboard

---

### B.3 — Forgot password `MVP`

**URL** : `auth.tukio.one/realms/tukio/forgot-password`

Standard Keycloak flow :

1. Saisie email
2. Si compte existe : email envoyé (sinon message générique pour ne pas exposer l'existence du compte)
3. Click lien email → page reset password
4. Saisie nouveau password (même règles que registration)
5. Redirect vers login

Templates email customisés aux couleurs Tukio.

---

### B.4 — Email verification `MVP`

#### Pendant l'attente

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [Logo Tukio]                           │
│                                                     │
│   ✉  Vérifiez votre email                          │
│                                                     │
│   Nous avons envoyé un lien de vérification à :     │
│   marie.dupont@example.com                          │
│                                                     │
│   Cliquez sur le lien dans l'email pour activer     │
│   votre compte.                                     │
│                                                     │
│   📬 Pas d'email reçu ?                            │
│   • Vérifiez votre dossier spam                     │
│   • Vérifiez l'orthographe : marie.dupont@…         │
│   • [Renvoyer l'email]                              │
│                                                     │
│   Mauvaise adresse ? [Modifier l'email]             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Email envoyé

```
Objet : Confirmez votre email pour Tukio

Bonjour Marie,

Bienvenue sur Tukio ! Pour activer votre compte, cliquez sur le bouton ci-dessous :

[Activer mon compte]

Le lien est valable 24 heures.

Si vous n'avez pas créé de compte sur Tukio, ignorez cet email.

L'équipe Tukio
```

#### Post-vérification

- Redirect automatique vers `tukio.one/account` (dashboard customer)
- Toast success "Email vérifié ! Bienvenue sur Tukio."
- Si user était en cours de checkout (cas du checkout invité avec création compte automatique) → reprend le tunnel à l'étape interrompue

---

### B.5 — Customer dashboard (first login) `MVP`

**URL** : `/account`

**Différence avec le dashboard récurrent** : la première fois, on guide légèrement. Banner d'accueil + suggestions d'actions.

#### Layout — first login state

```
┌─────────────────────────────────────────────────────────────────┐
│  [Top bar customer]                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Bienvenue sur Tukio, Marie ! 🎉                                │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Pour bien démarrer :                                  │    │
│  │                                                        │    │
│  │  ☑ Compte créé                                         │    │
│  │  ☑ Email vérifié                                       │    │
│  │  ☐ Compléter votre profil → [Compléter]                │    │
│  │  ☐ Trouver votre premier prestataire → [Explorer]      │    │
│  │                                                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Mes réservations (0)                                           │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Vous n'avez pas encore de réservation                 │    │
│  │                                                        │    │
│  │  Découvrez les pros de l'événementiel près de chez    │    │
│  │  vous, en Pays de la Loire.                            │    │
│  │                                                        │    │
│  │  [Explorer le catalogue]                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Une fois la première résa effectuée, le banner "bien démarrer" disparaît.

---

## C. Pro registration & onboarding wizard

### C.0 Vue d'ensemble — le moment le plus critique du funnel pro

**L'objectif** : amener un pro depuis "je clique sur Devenir pro" jusqu'à "ma première fiche est publiée et je suis prêt à recevoir des demandes".

C'est **long** (KYC, Stripe, première fiche), donc il faut :
- Découper en étapes claires avec progression
- Sauvegarder à chaque étape
- Permettre de reprendre plus tard
- Rassurer à chaque blocage potentiel (KYC = "ça va prendre 2-7 jours, vous pouvez quand même préparer votre fiche")

### C.1 — Pro landing `MVP`

**URL** : `/sell`

**Source domaine** : 2.1 Comptes & utilisateurs (acquisition pro)

**Objectif** : convaincre un pro de s'inscrire.

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Top bar public]                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│        Recevez des demandes qualifiées pour                     │
│        votre activité événementielle                            │
│                                                                 │
│        Tukio met en relation les pros de l'événementiel         │
│        avec les organisateurs en Pays de la Loire.              │
│                                                                 │
│        [Devenir pro Tukio]                                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pourquoi rejoindre Tukio ?                                     │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  💡      │  │  🛡       │  │  ⚡      │  │  🤝      │        │
│  │ Visibilité│ │ Paiements│ │ Pas de    │ │ Communauté│        │
│  │ locale    │  │ sécurisés│  │ frais    │ │ de pros  │        │
│  │           │  │           │  │ d'entrée │ │ locaux   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Comment ça marche ?                                            │
│                                                                 │
│  1. Créez votre compte                                          │
│  2. Validez vos documents (24h)                                 │
│  3. Publiez vos services                                        │
│  4. Recevez des demandes                                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tarification                                                   │
│                                                                 │
│  • Inscription gratuite                                         │
│  • Aucun abonnement obligatoire                                 │
│  • Commission de 10 % sur les réservations                      │
│  • Plans payants disponibles dès la V1                          │
│                                                                 │
│  [Voir les tarifs détaillés] *(V1)*                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Témoignages pros (V1, après quelques mois)                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Prêt·e à rejoindre les pros de Tukio ?                         │
│                                                                 │
│  [Devenir pro Tukio]                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CTA principal

`[Devenir pro Tukio]` → `auth.tukio.one/realms/tukio/registration?role=pro`

**Important** : le paramètre `role=pro` indique à Keycloak de provisionner le compte avec le rôle `pro` (au lieu de `client`).

---

### C.2 — Pro registration `MVP`

**URL** : `auth.tukio.one/realms/tukio/registration?role=pro`

Page Keycloak themed avec quelques différences vs registration customer :

```
┌─────────────────────────────────────────────────────┐
│              [Logo Tukio Pro]                       │
│                                                     │
│      Créez votre compte professionnel               │
│                                                     │
│  Email professionnel *                              │
│  ┌───────────────────────────────────────────┐     │
│  │                                           │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  Mot de passe *                                     │
│  Prénom *                                           │
│  Nom *                                              │
│                                                     │
│  Nom de votre entreprise *                          │
│  ┌───────────────────────────────────────────┐     │
│  │                                           │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  Téléphone *                                        │
│  ┌───────────────────────────────────────────┐     │
│  │                                           │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ☐ J'accepte les CGU pros et la Politique de       │
│     confidentialité                                 │
│                                                     │
│  [Créer mon compte pro]                             │
│                                                     │
│  Déjà un compte ? Connectez-vous                    │
└─────────────────────────────────────────────────────┘
```

**Différences** :
- Champs entreprise + téléphone obligatoires dès l'inscription (pour relance KYC)
- CGU pros distinctes (`/seller-terms` vs `/terms`)
- Pas de social login (Google/Apple) au MVP — un compte pro mérite un email/password dédié
- Pas de "marketing consent" (le pro est dans une relation transactionnelle)

#### Post-submit

1. Compte créé Keycloak avec `role: pro` + `kyc_status: pending_documents`
2. Email vérification envoyé
3. Redirect vers verify-email
4. Après vérification → redirect vers `/seller/onboarding/profile` (étape 1 du wizard)

---

### C.3 — Pro onboarding wizard

**URL base** : `/seller/onboarding/*`

**Source domaine** : 2.1 Comptes & utilisateurs

**Objectif** : amener le pro de "compte créé" à "compte vérifié + Stripe configuré + premier service publié".

**4 étapes obligatoires + sortie** :

```
/seller/onboarding/profile        ← Step 1: profil pro détaillé
/seller/onboarding/kyc            ← Step 2: documents KYC
/seller/onboarding/stripe         ← Step 3: Stripe Connect
/seller/onboarding/first-listing  ← Step 4: création premier service
                                     (cf. tukio_ux_flow_catalog.md §B.2)
                                     │
                                     ▼
                                  /seller (dashboard) avec statut "pending_admin_review"
```

**Le pro ne peut pas accéder à `/seller`** (dashboard) tant que les 4 étapes ne sont pas faites au moins une première fois (il peut sauvegarder en brouillon et revenir, mais il ne peut pas "passer" les étapes).

#### Layout commun aux 4 étapes

```
┌─────────────────────────────────────────────────────────────────┐
│  [Top bar pro simplifiée]                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ← Retour                                                       │
│                                                                 │
│  Configuration de votre compte pro — Étape 2 sur 4              │
│                                                                 │
│  ●—●—○—○                                                        │
│  Profil  KYC  Stripe  1ʳᵉ fiche                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Contenu de l'étape]                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Sauvegarder et continuer plus tard]    [← Précédent]  [Suivant →]│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

#### C.3.1 Step 1 — Profile

**URL** : `/seller/onboarding/profile`

```
┌─────────────────────────────────────────────────────────────┐
│  Présentez votre activité                                   │
│                                                             │
│  Ces informations seront visibles sur votre profil public.  │
│                                                             │
│  Photo de profil (logo ou photo)                            │
│  ┌──────────┐                                               │
│  │   📷     │   [Choisir une image]                         │
│  │          │   JPG/PNG/HEIC, 5 Mo max, carré recommandé    │
│  └──────────┘                                               │
│                                                             │
│  Nom commercial (visible publiquement) *                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Event Co Nantes                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Raison sociale *                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ EVENT CO SARL                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SIRET *                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 12345678901234                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  Validation automatique via base SIRENE                     │
│                                                             │
│  Adresse du siège *                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 12 rue des Lilas, 44000 Nantes                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Description courte (visible sur votre profil) *            │
│  280 caractères max                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Spécialiste de la location événementielle en        │   │
│  │ Loire-Atlantique depuis 2018. Mariages, séminaires, │   │
│  │ anniversaires…                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  68 / 280 caractères                                        │
│                                                             │
│  Catégories d'activité *                                    │
│  ☑ Location de matériel                                    │
│    └─ ☑ Tentes & chapiteaux                                │
│    └─ ☑ Mobilier événementiel                              │
│    └─ ☐ Sonorisation & lumière                              │
│  ☐ Services événementiels                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Validation** :
- SIRET : 14 chiffres, validation API SIRENE (auto-remplit raison sociale + adresse si possible)
- Description : 50-280 caractères
- Au moins 1 catégorie d'activité

**Sauvegarde** : à chaque blur de champ (debounce 1s)

---

#### C.3.2 Step 2 — KYC

**URL** : `/seller/onboarding/kyc`

```
┌─────────────────────────────────────────────────────────────┐
│  Vérification de votre identité                             │
│                                                             │
│  Pour des raisons légales et de sécurité, nous devons       │
│  vérifier votre identité avant de publier vos services.     │
│                                                             │
│  Cette vérification prend généralement 24h ouvrées.         │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Pièce d'identité *                                         │
│  Carte d'identité, passeport ou titre de séjour             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │   📄  Glissez votre document ici                    │   │
│  │       ou [Parcourir vos fichiers]                   │   │
│  │                                                     │   │
│  │       JPG, PNG, PDF · 10 Mo max                     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ✓ piece-identite.pdf (1.2 Mo) [×]                         │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Justificatif d'adresse *                                   │
│  Facture (eau, électricité, internet) ou attestation        │
│  d'hébergement de moins de 3 mois                           │
│                                                             │
│  [Zone d'upload similaire]                                  │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Extrait Kbis ou avis de situation INSEE *                  │
│  Document de moins de 3 mois                                │
│                                                             │
│  [Zone d'upload similaire]                                  │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  💡 Vos documents sont chiffrés et accessibles uniquement   │
│  par notre équipe de modération. Ils ne sont jamais         │
│  partagés avec des tiers.                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Comportement

- Upload async, scan antivirus en arrière-plan (cf. media-svc)
- Stockage chiffré at-rest (Cloudflare R2 + clés gérées par Tukio)
- Pas de validation auto au MVP : modération humaine sous 24h
- Status pro passe à `pending_admin_review` à la fin du wizard
- Notification admin (Slack webhook + dashboard)

#### Validation

- 3 documents obligatoires uploadés
- Formats acceptés : JPG, PNG, PDF
- Taille max : 10 Mo par fichier

#### États

- Upload en cours : barre de progression
- Upload réussi : check vert + nom du fichier
- Upload échoué : retry possible
- Document rejeté plus tard par admin : email avec raison + retour à cette étape

---

#### C.3.3 Step 3 — Stripe Connect

**URL** : `/seller/onboarding/stripe`

```
┌─────────────────────────────────────────────────────────────┐
│  Configurez vos paiements                                   │
│                                                             │
│  Pour recevoir vos paiements, nous utilisons Stripe         │
│  Connect, le standard du secteur.                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✓ Conforme PSD2 et RGPD                            │   │
│  │  ✓ Vos coordonnées bancaires ne transitent jamais   │   │
│  │    par les serveurs Tukio                           │   │
│  │  ✓ Tableau de bord pour suivre vos paiements        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Vous allez être redirigé·e vers Stripe pour :              │
│                                                             │
│  • Confirmer votre identité (KYC financier)                 │
│  • Renseigner votre IBAN                                    │
│  • Accepter les CGU Stripe                                  │
│                                                             │
│  Cela prend environ 5 minutes.                              │
│                                                             │
│  💡 Vous pouvez compléter cette étape plus tard et          │
│  préparer votre première fiche en attendant. Toutefois,     │
│  vous ne pourrez pas recevoir de paiements tant que         │
│  Stripe n'a pas validé votre compte.                        │
│                                                             │
│  [Configurer mon compte Stripe]                             │
│                                                             │
│  [Plus tard, passer à l'étape suivante]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Comportement

- Click "Configurer" → redirect vers Stripe Connect Express onboarding (URL générée par `payment-svc`)
- Stripe gère son propre onboarding (KYC financier, IBAN, etc.)
- À la fin → callback vers `/seller/onboarding/stripe/callback`
- Callback vérifie le statut Stripe :
  - `pending` : "Stripe vérifie vos informations sous 1-7 jours"
  - `complete` : check vert, passage à l'étape suivante
  - `restricted` : message d'aide + lien pour compléter

#### Skip autorisé

Le pro peut **passer cette étape** et continuer le wizard. Mais :
- Banner persistant dans le dashboard "Configurez Stripe pour recevoir des paiements"
- Impossible de recevoir des résas tant que Stripe n'est pas complet (ses fiches restent en `unlisted`)

---

#### C.3.4 Step 4 — First listing

**URL** : `/seller/onboarding/first-listing`

**Renvoi vers** : `tukio_ux_flow_catalog.md` §B.2 (wizard de création de service en 10 étapes)

À la fin de la création de la première fiche :
- Modale de félicitations
- Récap : "Votre compte est en cours de validation par notre équipe (sous 24h ouvrées)"
- Redirect vers `/seller` en mode "pending review"

---

### C.4 — Post-onboarding states

#### State 1 : Tout uploadé, en attente admin

```
┌─────────────────────────────────────────────────────────────┐
│  [Banner persistant en haut du dashboard]                   │
│                                                             │
│  ⏳ Votre compte est en cours de validation                 │
│                                                             │
│  Notre équipe vérifie vos documents. Vous recevrez un email │
│  dès que votre compte sera activé (sous 24h ouvrées).       │
│                                                             │
│  En attendant, vous pouvez préparer d'autres fiches.        │
│  Elles seront publiées dès la validation de votre compte.   │
└─────────────────────────────────────────────────────────────┘
```

#### State 2 : Validé par admin

Email + notification in-app :
> 🎉 Votre compte Tukio est validé !
> Votre fiche "Chapiteau 100m² blanc chic" est maintenant visible publiquement.
> [Voir mon profil public]

Dashboard passe en mode normal.

#### State 3 : Rejeté par admin

Email avec **raison structurée** :

```
Objet : Action requise sur votre compte Tukio

Bonjour Jean,

Notre équipe a examiné votre dossier et nous avons besoin de précisions :

🔴 Pièce d'identité illisible
Merci de nous fournir une nouvelle photo bien lisible des deux côtés.

[Mettre à jour mes documents]

Vous pouvez nous contacter à support@tukio.one si vous avez des questions.

L'équipe Tukio
```

Dashboard avec état rejeté : retour à `/seller/onboarding/kyc` pour re-upload.

---

## D. Customer profile & settings

### D.0 Vue d'ensemble

```
/account/profile/
├── /identity              → Nom, email, téléphone, photo
├── /security              → Password, MFA, sessions
├── /notifications         → Préférences emails / push / SMS
└── /company *(V1, B2B)*  → Infos entreprise pour facturation
```

### D.1 — Identity `MVP`

**URL** : `/account/profile/identity`

```
┌─────────────────────────────────────────────────────────────┐
│  Mes informations                                           │
│                                                             │
│  Photo de profil                                            │
│  ┌──────────┐                                               │
│  │   👤     │   [Modifier la photo]                         │
│  └──────────┘                                               │
│                                                             │
│  Prénom *                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Marie                                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Nom *                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Dupont                                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Email *                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ marie.dupont@example.com         [Modifier]         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Téléphone                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ +33 6 12 34 56 78                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│  Utilisé pour les notifications urgentes uniquement         │
│                                                             │
│  Date de naissance (optionnel) *(V1)*                       │
│                                                             │
│  Adresse de livraison par défaut                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ + Ajouter une adresse                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────      │
│                                                             │
│  ⚠ Zone de danger                                           │
│                                                             │
│  Supprimer mon compte                                       │
│  Cette action est définitive. Vos réservations en cours     │
│  doivent être terminées avant.                              │
│  [Supprimer mon compte]                                     │
└─────────────────────────────────────────────────────────────┘
```

#### Comportement modification email

Click `[Modifier]` à côté de l'email → modale :
- Saisie nouvel email + password actuel
- Email envoyé au **nouvel** email avec lien de confirmation
- Tant que pas confirmé : ancien email actif
- Une fois confirmé : bascule + email envoyé à l'ancienne adresse "Votre email a été modifié"

#### Suppression compte

- Vérification : aucune résa active
- Modale de confirmation explicite (taper "SUPPRIMER" pour confirmer)
- Soft-delete côté Tukio (conservation 10 ans pour comptabilité)
- Anonymisation des données perso (RGPD)
- Suppression Keycloak immédiate (plus de login possible)

---

### D.2 — Security `MVP`

**URL** : `/account/profile/security`

```
┌─────────────────────────────────────────────────────────────┐
│  Sécurité                                                   │
│                                                             │
│  Mot de passe                                               │
│  ────────────────────                                       │
│  Dernière modification : il y a 3 mois                      │
│  [Changer mon mot de passe]                                 │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Authentification à deux facteurs (2FA)  *(V1)*            │
│  ────────────────────                                       │
│  ☐ Activée                                                  │
│  Renforcez la sécurité de votre compte avec une             │
│  application d'authentification (Google Authenticator,      │
│  Authy, 1Password…)                                         │
│  [Activer la 2FA]                                           │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Sessions actives                                           │
│  ────────────────────                                       │
│  • Cette session — Chrome sur macOS — Nantes, FR            │
│    Active maintenant                                        │
│                                                             │
│  • Mobile — Safari sur iOS — Nantes, FR                     │
│    Dernière activité il y a 2 jours                         │
│    [Déconnecter cette session]                              │
│                                                             │
│  [Déconnecter toutes les autres sessions]                   │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Connexions tierces  *(V1)*                                │
│  ────────────────────                                       │
│  ☐ Google                                                   │
│  ☐ Apple                                                    │
└─────────────────────────────────────────────────────────────┘
```

#### Changement mot de passe

Click `[Changer mon mot de passe]` → page Keycloak themée :
1. Saisie password actuel
2. Saisie nouveau password (règles minimum)
3. Confirmation
4. Email "Votre mot de passe a été modifié" envoyé

#### Activation 2FA (V1)

1. Affichage QR code TOTP
2. User scanne avec app
3. Saisie 6 chiffres pour valider
4. 10 codes de secours générés à conserver

---

### D.3 — Notifications `V1`

**URL** : `/account/profile/notifications`

```
┌─────────────────────────────────────────────────────────────┐
│  Préférences de notifications                               │
│                                                             │
│  Notifications transactionnelles                            │
│  ────────────────────                                       │
│  Confirmation de réservation, paiement, refund...           │
│  Ces notifications sont obligatoires et ne peuvent pas      │
│  être désactivées.                                          │
│                                                             │
│  📧 Email                              ☑ (obligatoire)      │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Rappels                                                    │
│  ────────────────────                                       │
│  Rappel avant événement, demande d'avis...                  │
│                                                             │
│  📧 Email                              ☑                    │
│  📱 In-app                             ☑                    │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Marketing                                                  │
│  ────────────────────                                       │
│  Conseils événementiels, nouveautés Tukio                   │
│                                                             │
│  📧 Email                              ☐                    │
│                                                             │
│  Vous pouvez vous désinscrire à tout moment.                │
└─────────────────────────────────────────────────────────────┘
```

---

### D.4 — Company info (B2B) `V1`

**URL** : `/account/profile/company`

Visible uniquement si l'utilisateur a coché "Compte entreprise" à l'inscription (ou à la conversion ultérieure).

Contient :
- Raison sociale
- SIRET
- N° TVA intra-UE
- Adresse de facturation
- Comptable / contact financier

→ Permet la facturation au nom de l'entreprise.

---

## E. Pro profile & settings

### E.0 Vue d'ensemble

```
/seller/settings/
├── /profile               → Profil public (vu par les clients)
├── /company               → Infos entreprise (KYC, RIB, mandat fact.)
├── /security              → Password, MFA (recommandée pour pros)
├── /notifications         → Préférences (emails, SMS option, push)
└── /api  *(V2+)*         → Clés API pour intégrations
```

### E.1 — Pro public profile `MVP`

**URL** : `/seller/settings/profile`

C'est le profil **public** vu par les clients via `/pro/{slug}`.

```
┌─────────────────────────────────────────────────────────────┐
│  Profil public                                              │
│                                                             │
│  [Voir mon profil public →]   ← lien vers /pro/{slug}       │
│                                                             │
│  Photo de profil ou logo                                    │
│  ┌──────────┐                                               │
│  │  [logo]  │   [Modifier]                                  │
│  └──────────┘                                               │
│                                                             │
│  Photo de couverture *(V1)*                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [bannière]   [Modifier]                           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Nom commercial                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Event Co Nantes                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Slug URL                                                   │
│  /pro/event-co-nantes [Modifier]                            │
│                                                             │
│  Description courte (visible en haut du profil)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Spécialiste de la location événementielle…          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Description longue *(V1)* (À propos)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Éditeur riche : histoire, équipe, certifs, photos…  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Téléphone affiché publiquement ?                           │
│  ☐ Oui   ☑ Non (recommandé : visible seulement après réservation)│
│                                                             │
│  Site web (optionnel)                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Réseaux sociaux *(V1)*                                    │
│  Instagram, Facebook, LinkedIn, TikTok                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Validation slug

- Slug unique (refus si déjà pris)
- Pas dans la liste des slugs réservés (cf. `tukio_information_architecture.md` §C)
- Modification possible mais conservation de l'ancien slug avec redirect 301 (SEO)

---

### E.2 — Company settings `MVP`

**URL** : `/seller/settings/company`

```
┌─────────────────────────────────────────────────────────────┐
│  Informations entreprise                                    │
│                                                             │
│  Statut KYC : ✅ Vérifié le 15 mars 2026                    │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Raison sociale                                             │
│  EVENT CO SARL                                              │
│  [Modifier les infos légales]                               │
│  ⚠ Une modification déclenche une nouvelle vérification     │
│                                                             │
│  SIRET                                                      │
│  12345678901234                                             │
│                                                             │
│  Statut TVA                                                 │
│  ○ Assujetti·e à la TVA (taux 20 %)                        │
│  ● Non assujetti·e (franchise art. 293 B du CGI)            │
│                                                             │
│  N° TVA intra-UE *(si assujetti)*                          │
│  FR12345678901                                              │
│                                                             │
│  Adresse du siège                                           │
│  12 rue des Lilas, 44000 Nantes                             │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Documents KYC                                              │
│                                                             │
│  ✅ Pièce d'identité   [Voir]                              │
│  ✅ Justificatif d'adresse   [Voir]                        │
│  ✅ Kbis / INSEE   [Voir]                                  │
│                                                             │
│  [Mettre à jour mes documents]                              │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Stripe Connect                                             │
│                                                             │
│  Statut : ✅ Compte vérifié                                 │
│  IBAN : FR76 **** **** **** 1234                            │
│                                                             │
│  [Gérer mon compte Stripe →]                                │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Mandat de facturation                                      │
│                                                             │
│  En vous inscrivant sur Tukio, vous nous avez donné mandat  │
│  d'émettre les factures clients en votre nom.               │
│                                                             │
│  ✅ Mandat signé le 15 mars 2026                            │
│  [Voir le mandat]   [Révoquer le mandat]                    │
└─────────────────────────────────────────────────────────────┘
```

---

### E.3 — Pro security `MVP`

Identique au customer (D.2) avec une recommandation forte d'activer la 2FA :

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ Recommandation                                           │
│                                                             │
│  En tant que professionnel·le, votre compte gère des        │
│  informations financières sensibles. Nous recommandons      │
│  fortement d'activer l'authentification à deux facteurs.    │
│                                                             │
│  [Activer la 2FA maintenant]                                │
└─────────────────────────────────────────────────────────────┘
```

---

### E.4 — Pro notifications `MVP`

```
┌─────────────────────────────────────────────────────────────┐
│  Préférences de notifications                               │
│                                                             │
│  Demandes de réservation (urgent)                           │
│  ────────────────────                                       │
│  Vous avez 48h pour répondre. Manqué = pénalité.            │
│                                                             │
│  📧 Email                              ☑ (obligatoire)      │
│  📱 In-app                             ☑                    │
│  📲 SMS *(option payante V1, 0,10 €/SMS)*                  │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Paiements & finance                                        │
│  ────────────────────                                       │
│  Reversement effectué, échec de paiement, litige            │
│                                                             │
│  📧 Email                              ☑                    │
│  📱 In-app                             ☑                    │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Avis & feedback                                            │
│  ────────────────────                                       │
│                                                             │
│  📧 Email                              ☑                    │
│  📱 In-app                             ☑                    │
│                                                             │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  Newsletter Tukio Pro                                       │
│  ────────────────────                                       │
│  Conseils, bonnes pratiques, nouveautés produit             │
│                                                             │
│  📧 Email mensuel                      ☑                    │
└─────────────────────────────────────────────────────────────┘
```

---

## F. Admin auth (separate)

### F.0 Vue d'ensemble

L'admin se connecte sur **`admin.tukio.one`** uniquement. Sous-domaine séparé pour isolation sécurité.

```
admin.tukio.one
   │
   └── Login Keycloak (themed admin)
       │
       └── MFA TOTP obligatoire (pas de skip possible)
           │
           └── admin.tukio.one/ (dashboard admin)
```

### F.1 — Admin login `MVP`

**URL** : `auth.tukio.one/realms/tukio/login` (avec redirect post-login vers `admin.tukio.one`)

```
┌─────────────────────────────────────────────────────┐
│              [Logo Tukio Admin]                     │
│                                                     │
│      Console d'administration                       │
│                                                     │
│  Email *                                            │
│  Password *                                         │
│                                                     │
│  [Se connecter]                                     │
│                                                     │
│  ⚠ Authentification à deux facteurs requise         │
└─────────────────────────────────────────────────────┘
```

#### Différences vs login customer/pro

- Pas de "S'inscrire" (les admins sont provisionnés manuellement par `admin-super`)
- Pas de "Mot de passe oublié" sur cette page (procédure interne pour reset, support dédié)
- Pas de social login
- MFA obligatoire (pas de skip, contrairement aux pros qui ont MFA optionnelle)

### F.2 — MFA setup forcé `MVP`

**URL** : `auth.tukio.one/realms/tukio/mfa-setup`

À la première connexion admin (avant tout accès au dashboard) :

1. Affichage QR code TOTP + clé secrète
2. User scanne avec app authenticator
3. Saisit 6 chiffres pour valider
4. **10 codes de secours** générés (à imprimer ou stocker en sécurité)
5. Confirmation explicite "J'ai sauvegardé mes codes de secours"
6. Accès au dashboard

### F.3 — Admin user management `V1`

**URL** : `admin.tukio.one/users/admins` (accessible aux `admin-super` uniquement)

Permet à un super-admin d'ajouter / suspendre / supprimer d'autres admins.

```
┌─────────────────────────────────────────────────────────────┐
│  Gestion des admins                            [+ Ajouter]   │
│                                                             │
│  Rôles disponibles :                                        │
│  • admin-super : tous les droits                            │
│  • admin-modo : modération + suspension                     │
│  • admin-support : lecture + actions support basiques       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  alice@tukio.one — admin-super                      │   │
│  │  MFA : ✅ activée — Dernière connexion : aujourd'hui│   │
│  │  [Modifier les droits] [Suspendre]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  bob@tukio.one — admin-modo                         │   │
│  │  MFA : ✅ activée — Dernière connexion : 2 jours    │   │
│  │  [Modifier les droits] [Suspendre]                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Workflow ajout admin

1. `admin-super` clique "+ Ajouter"
2. Saisit email + rôle souhaité
3. Email envoyé à la nouvelle adresse avec lien d'invitation
4. Le nouveau admin clique → setup password + MFA forcé
5. Compte actif

---

## G. Cross-cutting: Keycloak themed pages

### G.1 Pages servies par Keycloak

Ces pages **ne sont pas codées dans la stack Next.js** : elles sont des templates Freemarker servis par Keycloak avec un thème custom Tukio.

| URL | Écran | Cible |
|-----|-------|-------|
| `/realms/tukio/login` | Login | MVP |
| `/realms/tukio/registration` | Register | MVP |
| `/realms/tukio/forgot-password` | Forgot password | MVP |
| `/realms/tukio/verify-email` | Verify email (waiting page) | MVP |
| `/realms/tukio/reset-password` | Reset password (post email click) | MVP |
| `/realms/tukio/mfa-setup` | MFA TOTP setup | MVP (admin) / V1 (autres) |
| `/realms/tukio/mfa-challenge` | MFA TOTP challenge during login | MVP |
| `/realms/tukio/account` | Compte Keycloak natif | **Caché** (UX bypass via redirect vers `/account` ou `/seller`) |
| `/realms/tukio/account-suspended` | Compte suspendu | MVP |
| `/realms/tukio/error` | Erreur générique Keycloak | MVP |

### G.2 Theme requirements

Le thème Keycloak Tukio doit :

- **Match strict** avec le design system Tukio (palette terracotta, typo Fraunces+Inter, espacements)
- Logo Tukio en haut de chaque page
- Pas de "Powered by Keycloak" visible
- Pas de mention Keycloak dans les emails
- Templates emails entièrement custom (objet, contenu, footer)
- Fonts hosted (pas de Google Fonts pour conformité RGPD)
- Responsive
- Accessibilité (RGAA niveau AA)

**Effort dev** : 1-2 semaines pour un dev frontend qui n'a jamais touché à Keycloak. Ressources :
- [Keycloak theming docs](https://www.keycloak.org/docs/latest/server_development/#_themes)
- Boilerplate `keycloakify` (génère les thèmes en React)
- Considérer l'option `keycloakify` pour rester dans l'écosystème React

### G.3 Email templates

Tous les emails Keycloak doivent être customisés :

- `email-verification.ftl`
- `password-reset.ftl`
- `executable-actions.ftl`

Chaque email :
- Object court et clair
- Logo Tukio en haut
- Bouton CTA principal en couleur brand
- Mention RGPD en footer
- Lien désinscription si applicable
- Adresse postale Tukio (obligatoire FR)

---

## H. Account state machine

Vue consolidée des états possibles d'un compte côté Tukio (en plus de l'état Keycloak).

### H.1 Customer states

```
none (inscription en cours)
   ↓ Keycloak: email vérifié
active
   ├── soft_deleted (RGPD : visible admin uniquement)
   └── suspended (modération admin, ex: spam, fraude)
        ↓ admin réactive
        active
        ↓ admin bannit
        banned (compte conservé pour traçabilité, hash conservé pour anti-recréation)
```

### H.2 Pro states

```
pending_email_verification (Keycloak gère)
   ↓ email vérifié
pending_documents (a vérifié email, pas encore uploadé docs)
   ↓ docs uploadés
pending_admin_review (en attente validation admin)
   ↓ admin valide                         ↘ admin rejette
verified (peut publier des services)      rejected (retour à pending_documents)
   ↓ signalements graves / non-respect CGV
suspended (compte gelé : pas de nouvelles publications, services cachés)
   ↓ résolution
verified
   ↓ admin bannit
banned (avec hash conservé)
```

### H.3 Admin states

```
pending_invitation (invité par admin-super, pas encore activé)
   ↓ user accepte invitation + setup MFA
active
   ├── suspended (par autre admin-super)
   └── deleted (impossible de réactiver, doit ré-inviter)
```

---

## I. Open design questions

| # | Question | Reco par défaut |
|---|----------|-----------------|
| **F-01** | Social login Google/Apple : MVP ou V1 ? | **V1** — pas critique au MVP, ajoute complexité Keycloak |
| **F-02** | Captcha sur registration ? | **V1 si abus détecté** — pas au MVP |
| **F-03** | Vérification SIRET auto via API SIRENE ? | **MVP** — gain UX énorme, API gratuite |
| **F-04** | KYC pré-upload ou post-publication 1ère fiche ? | **Pré** — mais on autorise à préparer la fiche en parallèle (cf. C.4 state 1) |
| **F-05** | Skip Stripe Connect pendant onboarding ? | **Oui avec restrictions claires** — pro peut préparer fiches mais pas recevoir résa |
| **F-06** | 2FA obligatoire pour les pros ? | **Non au MVP, recommandée**. Obligatoire en V2 si fraudes constatées |
| **F-07** | Suppression compte : soft-delete ou hard ? | **Soft-delete** côté Tukio (10 ans comptable), suppression Keycloak immédiate |
| **F-08** | Compte client → conversion en compte pro : workflow ? | Ajout du rôle `pro` côté Keycloak + flow KYC, sans perte historique. UI : bouton "Devenir pro" dans `/account` |
| **F-09** | Modification email : confirmation sur ancien et nouveau ? | **Confirmation sur le nouveau, notification sur l'ancien** |
| **F-10** | Impersonation côté admin : que voit l'admin ? | Bandeau rouge persistant "Vous êtes connecté·e en tant que X — [Quitter]". Action loggée dans audit trail. |
| **F-11** | Sessions concurrentes : limite ? | **Pas de limite au MVP**, V1 si besoin |
| **F-12** | Reset password : auto-login post-reset ? | **Non** — sécurité (force re-login avec nouveau password) |

---

*Fin du UX Flow Auth & Accounts — version 1, à itérer.*
