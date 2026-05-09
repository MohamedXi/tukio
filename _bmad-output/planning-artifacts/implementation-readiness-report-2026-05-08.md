---
date: 2026-05-08
project: tukio.one
workflow: bmad-check-implementation-readiness
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
status: complete
filesIncluded:
  prd: _bmad-output/planning-artifacts/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux: _bmad-output/planning-artifacts/ux-design-specification.md
  productBrief: _bmad-output/planning-artifacts/product-brief-tukio.one.md
  productBriefDistillate: _bmad-output/planning-artifacts/product-brief-tukio.one-distillate.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-08
**Project:** tukio.one

---

## Step 1 — Document Discovery

### Inventaire des artefacts de planification

Localisation scannée : `_bmad-output/planning-artifacts/`

#### PRD Documents

**Whole Documents:**
- `prd.md` (113 KB, 1 425 lignes, modifié le 2026-05-08)

**Sharded Documents:** _aucun_

#### Architecture Documents

**Whole Documents:**
- `architecture.md` (153 KB, 2 810 lignes, modifié le 2026-05-08)

**Sharded Documents:** _aucun_

#### Epics & Stories Documents

**Whole Documents:**
- `epics.md` (270 KB, 2 646 lignes, modifié le 2026-05-08)

**Sharded Documents:** _aucun_

#### UX Design Documents

**Whole Documents:**
- `ux-design-specification.md` (89 KB, 1 487 lignes, modifié le 2026-05-08)

**Sharded Documents:** _aucun_

#### Documents de contexte (input PRD)

- `product-brief-tukio.one.md` (86 KB, 1 467 lignes)
- `product-brief-tukio.one-distillate.md` (54 KB, 728 lignes)

> Non requis pour cette évaluation, mais conservés comme contexte.

### Issues détectés

- **Duplicates :** aucun (zéro version shardée concurrente)
- **Documents manquants :** aucun (PRD, Architecture, Epics, UX → tous présents)

### Décision

✅ Inventaire complet et sans conflit — prêt pour l'analyse PRD (Step 2).

---

## Step 2 — PRD Analysis

> Source : `prd.md` (1 425 lignes, status `complete` 2026-05-08, releaseMode `phased`).
> Tags de phase entre crochets (sans tag = MVP par défaut).

### Functional Requirements

#### A. User & Identity Management (FR1-FR17)

- **FR1** : Visitor peut s'inscrire en tant que Customer particulier (B2C) avec email + mot de passe, en moins de 30 secondes
- **FR2** : Customer peut s'inscrire en tant qu'entreprise cliente (B2B) avec raison sociale, SIRET et facturation pro `[V1]`
- **FR3** : Visitor peut s'inscrire en tant que Pro avec soumission documents (SIRET, RIB, pièce d'identité) — le compte reste en `pending_admin_review` jusqu'à validation
- **FR4** : Customer / Pro / Admin peut se connecter avec email + mot de passe via Keycloak
- **FR5** : Customer / Pro peut se connecter via login social Google ou Apple `[V1]`
- **FR6** : Customer Enterprise peut se connecter via SSO SAML fédéré `[V2]`
- **FR7** : Customer / Pro / Admin peut récupérer son mot de passe par email (reset link Keycloak)
- **FR8** : Customer / Pro / Admin doit vérifier son adresse email avant toute transaction
- **FR9** : Admin doit activer une 2FA TOTP obligatoire à la création de son compte
- **FR10** : Pro peut activer une 2FA TOTP optionnelle sur son compte `[V1]`
- **FR11** : Pro peut compléter son profil enrichi (portfolio, équipe, certifications) `[V1]`
- **FR12** : Pro peut soumettre une vérification d'identité complète via Stripe Identity `[V1]`
- **FR13** : Customer ayant un rôle `client` peut convertir son compte en Pro (ajout rôle `pro` Keycloak + flow KYC) sans perte d'historique `[V1]`
- **FR14** : Customer / Pro peut consulter et modifier ses informations de profil
- **FR15** : Customer / Pro peut supprimer son compte (soft-delete, conservation comptable 10 ans, anonymisation post-délai utile)
- **FR16** : System empêche la création de plusieurs comptes Pro sur le même SIRET (sauf cas Enterprise groupes)
- **FR17** : System bloque l'accès aux fonctionnalités transactionnelles pour les comptes non vérifiés (email) ou non encore validés (Pro `pending_admin_review`)

#### B. Catalog & Discovery (FR18-FR33)

- **FR18** : Visitor peut effectuer une recherche par catégorie + ville + date sur la barre de recherche
- **FR19** : Visitor peut filtrer les résultats par capacité, prix, options et autres facettes
- **FR20** : Visitor peut consulter la fiche d'un Service (titre, description, photos, tarifs, options, zone livraison, délai, avis, politique d'annulation)
- **FR21** : Visitor peut consulter le profil public d'un Pro (bio, services proposés, avis agrégés)
- **FR22** : Visitor peut accéder aux pages de catégorie (`/category/{slug}`) et pages locales catégorie × ville (`/category/{slug}/{city}`) `[V1 pour pages locales générées auto]`
- **FR23** : Pro peut créer une fiche Service avec 3 photos minimum (bloquant) et jusqu'à 15 photos maximum
- **FR24** : Pro peut éditer ou retirer une fiche Service publiée
- **FR25** : Pro peut définir une tarification à l'unité ou forfaitaire `[MVP]` ; tarification sur devis `[V1]`
- **FR26** : Pro peut renseigner une zone de livraison et un délai minimum de réservation
- **FR27** : Pro peut intégrer une vidéo via embed YouTube / Vimeo `[V1]`
- **FR28** : Pro peut gérer un calendrier de disponibilité (blocage de dates, périodes indisponibles) `[V1]`
- **FR29** : Pro peut partager un inventaire (`InventoryPool`) entre plusieurs fiches Service du même compte `[V1]`
- **FR30** : System auto-publie une fiche Service si Pro `verified` > 30 j ET < 3 signalements (sinon modération a posteriori)
- **FR31** : System affiche le prix médian de la catégorie sur la fiche catégorie pour transparence client
- **FR32** : System empêche publication d'un Service avec tarif déviant > ±50 % de la médiane (soft warning)
- **FR33** : System indexe automatiquement chaque Service publié dans Meilisearch, 1 index par locale

#### C. Booking & Order Lifecycle (FR34-FR48)

- **FR34** : Customer peut réserver un Service à une date donnée (réservation directe MVP, demande de devis personnalisé `[V1]`)
- **FR35** : Customer peut composer un panier mono-vendeur MVP, panier multi-vendeurs `[V1]`
- **FR36** : Customer peut consulter ses réservations passées et à venir dans son espace
- **FR37** : Customer peut visualiser les détails d'une réservation (statut, prestataire, date, options, total, factures)
- **FR38** : Customer peut annuler une réservation selon la politique d'annulation choisie (3 templates : souple / standard / strict)
- **FR39** : Customer peut signaler une situation exceptionnelle (force majeure) lors d'une annulation, ouvrant une dispute médiée Admin `[V1]`
- **FR40** : Customer peut demander une modification de réservation (date, options) `[V1]`
- **FR41** : Customer peut effectuer une réservation conditionnelle avec option de 48 h `[V1]`
- **FR42** : Pro peut consulter sa file de demandes en attente (`pending_pro_acceptance`) avec délai d'expiration visible
- **FR43** : Pro peut accepter ou refuser une demande de réservation
- **FR44** : Pro peut proposer un devis personnalisé en réponse à une demande de devis `[V1]`
- **FR45** : Pro voit ses informations Customer masquées tant qu'il n'a pas accepté la demande (anti-désintermédiation R6)
- **FR46** : Pro peut proposer une modification de réservation au Customer `[V1]`
- **FR47** : System maintient le cycle de vie d'une réservation à travers ses statuts (`request → accepted → confirmed → completed | cancelled | refused`) avec audit trail complet
- **FR48** : System gère les conflits de disponibilité avec 3 layers (Redis lock, DB exclusion constraint, optimistic locking)

#### D. Payments & Financial (FR49-FR66)

- **FR49** : Customer peut payer une réservation par carte bancaire via Stripe Elements (autorisation différée, capture à l'acceptation Pro)
- **FR50** : Customer peut sauvegarder une carte de paiement pour usage futur `[V1]`
- **FR51** : Customer peut payer en 2 échéances 30/70 (acompte + solde avant l'événement) `[V1]`
- **FR52** : Customer peut consulter et télécharger ses factures dans son espace `[V1]`
- **FR53** : Pro peut visualiser ses transactions, commissions Tukio, frais Stripe, et payouts attendus
- **FR54** : Pro peut télécharger ses factures émises par Tukio en son nom (mandat art. 289 CGI)
- **FR55** : Pro peut exporter ses transactions au format CSV ou PDF pour comptabilité `[V1]`
- **FR56** : Pro peut consulter ses payouts Stripe Connect et leur statut (en attente / versé)
- **FR57** : Pro peut souscrire à un tier d'abonnement (Starter 0 € / Business 29 €/mois / Enterprise sur devis) `[V1]`
- **FR58** : Pro peut changer de tier d'abonnement (upgrade / downgrade) avec proratisation `[V1]`
- **FR59** : Pro peut résilier son abonnement à la fin de la période en cours (sans engagement) `[V1]`
- **FR60** : Pro Enterprise peut intégrer Tukio à son outil comptable (Pennylane, QuickBooks API directe) `[V2]`
- **FR61** : Admin peut effectuer un remboursement total ou partiel d'une transaction
- **FR62** : Admin peut consulter les disputes Stripe en cours et soumettre l'evidence trail Tukio à Stripe
- **FR63** : Admin peut consulter le rapprochement Stripe ↔ Tukio (commissions, payouts, balance plateforme)
- **FR64** : System gère 3 cas de TVA (pro non-assujetti / B2C / B2B intra-UE) lors de la facturation
- **FR65** : System reverse automatiquement le montant Pro à J+1 après l'événement, après déduction de la commission
- **FR66** : System dérive le tier d'abonnement Pro depuis l'état Stripe Subscription (jamais l'inverse)

#### E. Messaging & Communication (FR67-FR74)

- **FR67** : Customer / Pro peut consulter ses conversations dans son espace
- **FR68** : Customer / Pro peut échanger des messages texte dans une conversation liée à une réservation
- **FR69** : Customer / Pro peut échanger des messages dans un chat libre avant booking (devis) `[V1]`
- **FR70** : Customer / Pro peut envoyer des pièces jointes (PDF, images) `[V1]`
- **FR71** : Customer / Pro peut effectuer une recherche dans l'historique de ses conversations `[V1]`
- **FR72** : System masque automatiquement les emails et numéros de téléphone détectés par regex tant que la réservation n'est pas confirmée (anti-désintermédiation) `[V1]`
- **FR73** : System applique un rate limiting anti-spam (max 3 messages/h vers un Customer non répondant)
- **FR74** : System conserve les messages 5 ans pour litiges et conformité

#### F. Reviews & Reputation (FR75-FR82)

- **FR75** : Customer peut laisser un avis (note 1-5 + commentaire texte) après un événement
- **FR76** : Customer peut laisser un avis multi-critères (qualité, ponctualité, com, rapport qualité/prix) `[V1]`
- **FR77** : Pro tier Business+ peut répondre publiquement à un avis Customer `[V1]`
- **FR78** : Pro peut laisser un avis réciproque sur le Customer (visible aux autres Pros uniquement) `[V1]`
- **FR79** : Visitor peut consulter les avis agrégés d'un Service ou d'un Pro
- **FR80** : Customer / Pro peut signaler un avis comme abusif
- **FR81** : System envoie une demande d'avis automatique J+1 après l'événement, avec relance J+7
- **FR82** : System pondère les avis par récence (avis < 6 mois pèsent 2× plus dans la note agrégée)

#### G. Moderation & Administration (FR83-FR95)

- **FR83** : Admin (`admin-support`) peut consulter la file de validation Pro et valider/rejeter un dossier KYC
- **FR84** : Admin (`admin-modo` ou `admin-super`) peut suspendre un compte (Customer ou Pro) avec un motif documenté
- **FR85** : Admin (`admin-super`) peut bannir définitivement un compte (avec hash IP/email/téléphone conservé pour anti-recréation)
- **FR86** : Admin peut consulter les signalements (services, avis, comptes, messages) et statuer
- **FR87** : Admin peut ouvrir, médier et clôturer un litige avec workflow structuré (ouverture → médiation 48 h → résolution → clôture, réouverture 15 j) `[V1]`
- **FR88** : Admin peut appliquer une sanction graduée (avertissement → suspension publication 7 j → suspension compte 30 j → bannissement)
- **FR89** : Admin peut consulter et exporter le journal d'audit immuable des actions admin
- **FR90** : Admin (`admin-super`) peut créer, modifier ou révoquer les comptes admin (provisionnement manuel uniquement)
- **FR91** : Admin (`admin-super`) peut éditer la taxonomie produit (catégories, sous-catégories, types, tags secondaires)
- **FR92** : Admin (`admin-modo` ou `admin-super`) peut effectuer un replay d'event NATS pour réparer une saga échouée `[V1]` (sensible 🔴, audit obligatoire)
- **FR93** : Admin peut impersonifier un user pour debug `[V1]` (sensible 🔴, audit obligatoire)
- **FR94** : System enregistre toutes les actions admin sensibles dans une table immuable append-only (timestamp, admin_id, action, target, reason)
- **FR95** : System interdit toute suppression ou modification du journal d'audit, même par `admin-super`

#### H. Internationalization & Localization (FR96-FR104)

- **FR96** : Visitor accède au site avec une locale détectée auto à partir de `Accept-Language` (fallback `fr`)
- **FR97** : Customer / Pro peut explicitement choisir sa locale d'affichage (`fr` / `en`), persistance en cookie + préférence compte
- **FR98** : Visitor peut naviguer sur des URLs locale-prefixées (`/fr/...` ou `/en/...`) avec hreflang systématique
- **FR99** : Pro peut saisir titre/description en français obligatoirement, et en anglais optionnellement (fallback FR + badge UI)
- **FR100** : System affiche un badge UI "Disponible uniquement en français" sur la version EN d'une fiche sans traduction EN
- **FR101** : Pro peut traduire le contenu en EN, optionnellement avec pré-remplissage automatique (DeepL ou GPT) `[V1]`
- **FR102** : System envoie les emails transactionnels dans la locale du destinataire (FR ou EN)
- **FR103** : System maintient des index de recherche distincts par locale (`listings_fr`, `listings_en`)
- **FR104** : System fournit les pages légales (CGU, CGV, PC, mentions légales) en FR et EN (FR fait foi juridiquement)

#### I. Acquisition & Growth (FR105-FR116)

- **FR105** : System tracke les UTM params (`source`, `medium`, `campaign`) et les persiste lors de l'inscription user et de la création booking
- **FR106** : System émet les events business critiques (`page_view`, `search_performed`, `service_viewed`, `pro_viewed`, `booking_request_started`, `booking_request_submitted`, `booking_confirmed`) en server-side via gateway-api
- **FR107** : Customer peut générer un code de parrainage et le partager `[V1]`
- **FR108** : Customer peut s'inscrire avec un code de parrainage et déclencher un crédit de 30 € symétrique à sa première résa > 200 € `[V1]`
- **FR109** : Customer peut consulter ses crédits de parrainage actifs et leur date d'expiration `[V1]`
- **FR110** : Wedding Planner / Apporteur d'affaires peut s'inscrire en tant que partenaire avec dashboard dédié et lien tracké unique `[V1]`
- **FR111** : Apporteur peut consulter ses commissions générées (5 % sur chaque résa via son lien) et leur statut `[V1]`
- **FR112** : Customer peut s'abonner à une newsletter d'événements / contenus blog (opt-in explicite) `[V1]`
- **FR113** : Visitor peut s'inscrire à une checklist téléchargeable (CTA email capture, ex : "Checklist mariage en PdL") `[V1]`
- **FR114** : Customer peut bénéficier d'un programme de fidélité (-5 % à la 3ᵉ résa) `[V2]`
- **FR115** : System génère automatiquement les sitemaps XML segmentés par locale + type d'entité, mis à jour quotidiennement
- **FR116** : System publie automatiquement le balisage Schema.org JSON-LD adapté à chaque type de page (`Service`, `LocalBusiness`, `BreadcrumbList`, `AggregateRating`, `Organization`)

#### J. Notifications (FR117-FR125)

- **FR117** : Customer / Pro peut consulter ses notifications in-app (cloche 🔔) `[V1]`
- **FR118** : Customer / Pro peut configurer ses préférences de notification par catégorie (transactional non désactivable, important, marketing opt-in)
- **FR119** : System envoie un email transactionnel à chaque event business clé (confirmation booking, acceptation/refus, rappels J-7 et J-1, demande d'avis J+1, validation pro, payout)
- **FR120** : System envoie une notification SMS pour les events urgents `[V1]` (option Pro payante)
- **FR121** : System envoie une notification web push aux utilisateurs PWA `[V1]`
- **FR122** : System envoie une notification mobile push aux utilisateurs de l'app native `[V2]`
- **FR123** : System regroupe les notifications de messages non lus après 3 messages consécutifs sans réponse pour éviter le spam
- **FR124** : Admin peut éditer les templates d'emails dans le back-office `[V1]`
- **FR125** : Admin peut envoyer une newsletter à un segment Customer ou Pro `[V2]`

#### K. Configurateur & Smart Features (FR126-FR130)

- **FR126** : Customer peut utiliser un configurateur d'événement qui assemble plusieurs Services en un devis unique selon ses besoins (date, capacité, type, budget) `[V2]`
- **FR127** : Customer peut recevoir des recommandations personnalisées de Services basées sur son historique `[V2]`
- **FR128** : Pro peut sous-traiter une partie d'une réservation à un autre Pro avec splits Stripe gérés automatiquement `[V2]`
- **FR129** : Pro tier Business+ peut consulter des analytics avancées (benchmarks anonymisés vs catégorie, suggestions de prix) `[V2]`
- **FR130** : Pro Enterprise peut bénéficier de badges "vérifié", "pro de l'année" affichés publiquement `[V2]`

**Total FRs : 130** — répartition par phase :
| Phase | Count |
|---|---:|
| MVP (no tag) | 70 |
| V1 | 47 |
| V2 | 12 |
| V3+ | 0 (vision listée hors numérotation FR) |

### Non-Functional Requirements

#### Performance (NFR1-NFR8)

- **NFR1** : Latence p95 search Meilisearch < 150 ms sur tous endpoints `/api/search/*` (1 index/locale, mémoire pré-warmée)
- **NFR2** : Rendu SSR page publique p95 < 800 ms côté Vercel edge (incluant fetch via gateway-api)
- **NFR3** : Tunnel checkout doit charger Stripe Elements < 1 s p95
- **NFR4** : Latence p95 livraison message WebSocket via `messaging-svc` < 200 ms (Redis pub/sub local)
- **NFR5** : Core Web Vitals : LCP < 2,5 s, INP < 200 ms, CLS < 0,1 sur 4G mobile, mesurés via Lighthouse CI sur chaque PR
- **NFR6** : Capture différée Stripe (PaymentIntent confirm → capture) < 800 ms p95
- **NFR7** : Bundle JS initial homepage < 150 KB gzipped ; aucun chunk > 200 KB gzipped sans justification
- **NFR8** : Aucune page publique > 1,5 MB de poids total (incluant images optimisées AVIF/WebP)

#### Security (NFR9-NFR20)

- **NFR9** : HTTPS/TLS partout avec HSTS + redirect HTTP → HTTPS
- **NFR10** : mTLS inter-services en production (`gateway-api` ↔ services downstream)
- **NFR11** : JWT Keycloak RS256 validés via JWKS (cache 10 min côté gateway), re-vérification dans chaque service downstream (defence-in-depth)
- **NFR12** : 2FA TOTP obligatoire pour tous les comptes Admin à la création
- **NFR13** : 0 secret en clair, gestion via K8s Secrets + vault (Doppler ou AWS Secrets Manager)
- **NFR14** : Tukio ne touche jamais aux numéros de carte (Stripe Elements iframe), scope PCI-DSS SAQ-A
- **NFR15** : Pièces d'identité KYC pros chiffrées at-rest sur Cloudflare R2 (server-side encryption)
- **NFR16** : PII redaction systématique sur les logs (pas d'email, téléphone, SIRET, numéros de paiement)
- **NFR17** : Rate limiting `gateway-api` par IP + par user authentifié, alerte sur abus (> 10 req/s soutenu sur endpoint sensible)
- **NFR18** : Scan dépendances bloquant en CI (Dependabot ou Snyk) sur CVE critique non patchable
- **NFR19** : Toute action Admin sensible (refund, ban, replay event, impersonation) tracée dans le journal d'audit immuable
- **NFR20** : Bannissement utilisateur conserve hash IP/email/téléphone (légal sous 6 ans, à valider avocat)

#### Compliance & Privacy (NFR21-NFR30)

- **NFR21** : Statut hybride hébergeur LCEN + tiers de confiance paiement, aucune modération pré-publication systématique. Audit avocat numérique avant lancement
- **NFR22** : Mandat de facturation art. 289 CGI signé à l'onboarding, Tukio émet la facture en son nom
- **NFR23** : 3 cas TVA gérés (pro non-assujetti / B2C / B2B intra-UE), audit expert-comptable spécialisé marketplace obligatoire avant V1
- **NFR24** : Factures émises conservées 10 ans (obligation légale FR)
- **NFR25** : Soft-delete sur comptes user supprimés (conservation comptable 10 ans, anonymisation post-délai utile)
- **NFR26** : Tout user peut exercer ses droits RGPD (accès, rectification, effacement, portabilité), réponse < 30 jours ouvrés `[V1]`
- **NFR27** : Stack analytique RGPD-compliant : Plausible (sans cookies, EU), PostHog (EU, opt-in session replay), Brevo FR
- **NFR28** : Consentement explicite obligatoire pour toute fonctionnalité analytique nécessitant un cookie (PostHog session replay)
- **NFR29** : Pages légales versionnées FR + EN dès MVP (FR fait foi juridiquement)
- **NFR30** : Tout payment Stripe > 30 € en EU déclenche 3DS Secure (natif Stripe Elements), pas de bypass

#### Scalability (NFR31-NFR38)

- **NFR31** : Architecture supporte cible MVP 6 000 visiteurs/mois et 80 résa/mois sans dégradation > 10 %
- **NFR32** : Architecture supporte cible V1 30 000 visiteurs/mois et 400 résa/mois sans modification structurelle (scaling horizontal)
- **NFR33** : Architecture supporte cible V2 100 000 visiteurs/mois et 1 500 résa/mois ; split `payment-svc` en deployment dédié dès production
- **NFR34** : NATS JetStream traverse 10 000 events/sec sans backpressure
- **NFR35** : `catalog-svc` indexe nouveau Service publié dans Meilisearch < 5 s (sync via consumer NATS sur `catalog.listing.translation.published.v1`)
- **NFR36** : `messaging-svc` supporte 5 000 utilisateurs WebSocket concurrents avant split en deployment dédié
- **NFR37** : `notification-svc` envoie 10 000 emails/jour sans queue saturée
- **NFR38** : Saisonnalité PdL (pic mai-septembre) impose capacité 3× moyenne annuelle, auto-scaling horizontal dès V1

#### Reliability & Availability (NFR39-NFR46)

- **NFR39** : `gateway-api` disponibilité ≥ 99,5 % MVP, ≥ 99,9 % V1+ (mesurée mensuellement)
- **NFR40** : NATS JetStream replicas R3 en production avec DLQ stream dédié (R12 mitigation)
- **NFR41** : Consumer lag NATS < 100 messages nominal, alerte si > 1 000
- **NFR42** : Outbox relay PG LISTEN/NOTIFY avec fallback polling 30 s, alerte si > 100 messages outbox `pending` depuis > 1 min (R13)
- **NFR43** : Toute saga booking-payment bloquée > 5 min déclenche alerte admin avec replay manuel possible (R11 critique)
- **NFR44** : Sauvegarde PostgreSQL daily snapshot + WAL archiving, RPO < 5 min, RTO < 1 h
- **NFR45** : Tous appels externes critiques (Stripe API, Resend, Meilisearch sync) avec retries exponentiels + circuit breaker timeout 3 s
- **NFR46** : Tests chaos sur saga booking-payment obligatoires en CI sur chaque PR touchant `booking-svc`, `order-svc`, `payment-svc`

#### Accessibility (NFR47-NFR55)

- **NFR47** : Frontend respecte RGAA niveau AA (équiv. WCAG 2.1 AA) sur tous parcours publics et authentifiés
- **NFR48** : Contraste texte normal ≥ 4,5:1, texte large ≥ 3:1, UI components et icônes ≥ 3:1
- **NFR49** : Tous éléments interactifs accessibles au clavier (Tab) avec focus ring visible et ordre logique
- **NFR50** : Toutes images de contenu ont `alt` text non vide ; icon buttons ont `aria-label` ; lint rule bloquante en CI
- **NFR51** : Aucune information critique véhiculée uniquement par la couleur (erreurs avec icône + texte, etc.)
- **NFR52** : Frontend respecte `prefers-reduced-motion`, aucun flash > 3 fois/seconde
- **NFR53** : Touch targets mobile ≥ 44 × 44 px (WCAG 2.1 AA + Apple HIG)
- **NFR54** : Score Lighthouse Accessibility ≥ 90 par PR (CI gate), tests Playwright + axe-core obligatoires sur parcours critiques
- **NFR55** : Audit manuel RGAA expert externe obligatoire avant lancement V0, tests utilisateurs handicap en V1

#### Internationalization (NFR56-NFR60)

- **NFR56** : Aucun texte UI hardcodé, tous strings via `useTranslations()` de `next-intl` (ADR-012, K-12)
- **NFR57** : Toute PR ajoutant/modifiant une page DOIT inclure traductions `messages/fr.json` + `messages/en.json`, CI check bloquant
- **NFR58** : URLs systématiquement locale-prefixées (`/fr/...` ou `/en/...`) avec hreflang propre, slug par locale dans `<entity>_translations`
- **NFR59** : Emails transactionnels Resend templates dupliqués FR + EN, sélectionnés selon locale destinataire
- **NFR60** : Meilisearch maintient 1 index par locale (`listings_fr`, `listings_en`) avec tokenization native

#### Observability (NFR61-NFR66)

- **NFR61** : Tous services émettent traces OpenTelemetry avec correlation IDs propagés à travers la saga, exportées vers Tempo
- **NFR62** : Métriques business critiques (NATS lag, outbox lag, saga duration p95, payment success rate, search p95, etc.) en Prometheus format, alertables dans Alertmanager
- **NFR63** : Tous events business critiques émis server-side via gateway-api (résistant ad-block) et visibles dans PostHog
- **NFR64** : UTM params persistés sur tables `users` et `bookings` dès Sprint 0 (impossibles à rétro-fitter — K-04 critique)
- **NFR65** : Dashboards opérationnels Looker Studio + Plausible + PostHog couvrent : top funnel quotidien, full funnel + acquisition canal hebdo, revue stratégique mensuelle
- **NFR66** : Logs applicatifs sans PII, redaction systématique côté `gateway-api` et `notification-svc`

#### Maintainability (NFR67-NFR74)

- **NFR67** : Tous services backend respectent pattern Pretre (`domain/usecases/infrastructure` + `UseCaseProxy` factory), `eslint-plugin-boundaries` Sprint 0 bloque imports cross-bounded-context
- **NFR68** : Domain layer (`domain/`) sans aucun import NestJS, tests unitaires triviaux (mocks plain)
- **NFR69** : Events NATS suivent convention `<service>.<aggregate>.<event>.v<n>` lowercase, schémas versionnés dans `@tukio/contracts` (JSON Schema + types TS), ADR pour rompre BC
- **NFR70** : Toute décision architecturale structurante = ADR documentée dans `docs/adr/`
- **NFR71** : Couverture tests minimale par service : 80 % `domain/`, 70 % `usecases/`, 50 % `infrastructure/`, CI gate bloquant
- **NFR72** : Tout PR migration schema DB DOIT inclure script rollback testé
- **NFR73** : Code passe lint, format, typecheck, tests sur chaque PR, aucun merge `main` sans CI verte
- **NFR74** : Conventions nommage figées (Pro/provider, Client/customer, etc.) enforced via lint rules custom + review obligatoire pour tout nouveau bounded context

#### Integration (NFR75-NFR79)

- **NFR75** : Stripe webhooks endpoint unique sur `payment-svc`, transformés en NATS events internes ; aucun autre service ne consomme les webhooks Stripe directement
- **NFR76** : Keycloak emit webhooks consommés par `identity-svc` (mirror attributs métier) + job réconciliation quotidien drift detection (R8)
- **NFR77** : Aucun appel HTTP-to-HTTP entre services downstream sauf exception documentée `booking-svc` → `catalog-svc` (vérification dispo temps réel à la création booking)
- **NFR78** : Retries exponentiels avec circuit breaker (timeout 3 s) obligatoires sur tous appels externes critiques
- **NFR79** : API INSEE SIRENE consultée à l'onboarding pro (auto-check), fallback validation manuelle admin si indisponible

#### Operability (NFR80-NFR84)

- **NFR80** : Déploiement initial MVP colocaté en 3 unités (`core-api` = gateway+identity+catalog+booking+order+payment, `workers` = messaging+review+notification+media, `nats`) sur 1 cluster K8s/namespace (R15 mitigation)
- **NFR81** : `payment-svc` splitté en deployment dédié dès production V0 release (sécurité PCI-DSS-adjacent)
- **NFR82** : `notification-svc`, `media-svc`, `messaging-svc`, `catalog-svc` splittables en deployment dédié sur trigger explicite (volumes documentés stratégie deployment §12.3)
- **NFR83** : Toute migration DB backward-compatible (deux versions coexistent) pour rolling deployments sans downtime
- **NFR84** : Tous services exposent `/health` (liveness), `/ready` (readiness), `/metrics` (Prometheus scraping) pour K8s probes

**Total NFRs : 84** sur 10 catégories.

### Additional Requirements (constraints, integrations, assumptions)

#### Contraintes domaine (transversales)

- **R1 — TVA marketplace** : audit expert-comptable spécialisé marketplace **obligatoire avant V1** (500-1 500 €), 3 cas TVA, mandat art. 289 CGI signé onboarding, conservation factures 10 ans
- **R2 — Statut LCEN** : pas de modération pré-publication systématique (sinon bascule éditeur), audit avocat numérique avant lancement
- **R6 — Anti-désintermédiation** : coordonnées masquées avant acceptation, regex emails/téléphones (config centrale `@tukio/contracts`) `[V1]`
- **R10 — RGPD vs comptable 10 ans** : anonymisation post-délai utile, soft-delete au MVP, workflow droits RGPD V1
- **R11 — Saga booking-payment** : tests chaos en CI obligatoires, replay possible via outil admin V1, monitoring inbox/outbox lag, alertes > 5 min
- **R12 — NATS JetStream perte de message** : R3 replicas, DLQ stream dédié, monitoring consumer lag
- **R13 — Outbox relay panne** : healthcheck dédié, fallback polling 30 s
- **R15 — Coût opérationnel 10 services** : déploiement 3 unités MVP, split par service quand bottleneck mesuré
- **RA1 — Acquisition demande échoue** : risque opérationnel #1, stratégie formalisée mix 3 leviers MVP, sourcing physique côté demande aussi
- **i18n FR + EN dès Sprint 0** (ADR-012) : `next-intl` + locale-prefix URL + tables `*_translations` + 1 index Meilisearch/locale + templates email Resend FR + EN
- **Conventions nommage figées** : UI/produit FR/EN selon locale, code/DB/API/events EN strict, paths URL EN jamais FR

#### Intégrations critiques (synthèse §Domain)

| Intégration | Service Tukio | Niveau | Phase |
|-------------|---------------|--------|-------|
| Stripe Connect Express | `payment-svc` | 🔴 critique | MVP |
| Stripe Billing | `payment-svc` | 🔴 critique | V1 |
| Stripe Identity | `identity-svc` | 🟠 élevé | V1 |
| Keycloak 25 (Phasetwo managé MVP) | `identity-svc` + `gateway-api` | 🔴 critique | MVP |
| Cloudflare R2 + Images | `media-svc` | 🟠 élevé | MVP |
| Resend | `notification-svc` | 🟠 élevé | MVP |
| Brevo | `notification-svc` | 🟡 moyen | V1 |
| Meilisearch (1 index/locale) | `catalog-svc` | 🔴 critique | MVP |
| API INSEE SIRENE | `identity-svc` | 🟢 faible | MVP |
| Plausible | front public | 🟡 moyen | MVP |
| PostHog (hosted EU) | front + `gateway-api` | 🟠 élevé | MVP |
| DeepL ou GPT-4 | `catalog-svc` | 🟡 moyen | V1 |

#### Critères de sortie par phase

- **MVP** : 50 pros actifs (≥ 1 résa), 100 résa payées sans litige bloquant, NPS > 40, CAC pro soutenable, ~6 000 visiteurs/mois
- **V1** : 1ᵉʳ mois (commissions + abos) > coûts variables, ≥ 200 abonnés Business (MRR ≥ 5 800 €), conversion Starter→Business > 15 %, churn < 5 %
- **V2** : taux rebooking client > 25 %, panier moyen multi-vendeurs +30 % vs V1, ≥ 20 comptes Enterprise actifs, ARR > 500 k€

#### Hypothèses de scoping (ressources & timing)

- Équipe MVP : ~4-5 ETP (founder + tech lead + 1 backend mid + 1 frontend senior + 0,5 designer + 0,5-1 admin support) + freelances (designer, rédacteur SEO)
- Équipe V1 : ~6-7 ETP (+ 1 backend, + 1 admin support, + 0,5 email marketer)
- Équipe V2 : ~10-12 ETP (+ marketer interne, + AM Enterprise, + 1-2 dev mobile, + 0,5 RP)
- Budget acquisition : MVP ~3 200 €/mois, V1 ~11 000 €/mois, V2 ~33 000 €/mois

### PRD Completeness Assessment

#### Points forts

✅ **Numérotation systématique et stable** — FR1-FR130 + NFR1-NFR84, séquentiels, couverture déclarée des 6 user journeys (J1-J6) + 11 capabilities + 8 domaines fonctionnels du brief.

✅ **Phasing explicite** — chaque FR a son tag `[MVP|V1|V2|V3+]`, permettant une traçabilité claire vers epics MVP / V1 / V2.

✅ **Acteurs métier précisés** — Visitor / Customer / Pro / Admin (avec sous-rôles `admin-support|modo|super`) / System.

✅ **Risques mitigés référencés** — chaque NFR critique pointe vers un risque (R1-R15, RA1) du domaine, avec seuils chiffrés (lag NATS, outbox, saga > 5 min, etc.).

✅ **Intégrations cataloguées** — 12 intégrations externes listées avec service propriétaire, niveau de criticité, et phase d'introduction.

✅ **i18n FR/EN traité comme contrainte structurelle Sprint 0** (ADR-012) et reflété dans 9 FRs (H) + 5 NFRs + contraintes NFR56-60.

✅ **Anti-patterns explicités** — modération pré-publication, paths FR, hardcoded strings, HTTP-to-HTTP cross-service, webhooks Stripe distribués.

#### Ambiguïtés / zones à valider durant Steps 3-5

⚠️ **FR105 + FR106** (UTM tracking + events server-side) sont MVP-tagged mais NFR64 stipule "persistés dès Sprint 0 (impossibles à rétro-fitter — K-04 critique)" → vérifier qu'au moins 1 epic MVP couvre Sprint 0 sur le schema `acquisition_*`.

⚠️ **FR30** (auto-publication conditionnelle si `verified` > 30 j ET < 3 signalements) implique que la file de modération a posteriori existe AU MVP, mais FR87 (workflow litige structuré) et FR92 (replay event) sont V1. Couture entre modération basique MVP et workflow V1 à valider dans les epics.

⚠️ **FR48** (3 layers protection dispos) est MVP, mais "Inventory pool" partagé (FR29) est V1. Vérifier que les 3 layers MVP sont implémentables sans inventory pool, et que l'ajout V1 ne casse pas les locks existants.

⚠️ **FR62** (disputes Stripe + evidence trail Tukio) est MVP, mais FR70 (pièces jointes messagerie) est V1 — comment l'evidence trail MVP fonctionne-t-il sans pièces jointes ? À tracer dans Step 3/4 (UX & epic).

⚠️ **FR79** (avis agrégés visibles) est MVP, mais FR82 (pondération récence) est non taggé → MVP par défaut. Vérifier que la formule de pondération est figée dès la 1ʳᵉ implémentation pour éviter recalcul rétroactif.

⚠️ **FR74** (conservation messages 5 ans) ↔ NFR25 (anonymisation post-délai utile) → définir clairement le délai utile pour les messages dans le PRD ou dans une story.

⚠️ **FR91** (édition taxonomie produit) est non taggé (donc MVP par défaut) mais aucun outil de back-office MVP n'est explicité. Le brief MVP parle de "vue transactions/litiges" mais pas de CRUD taxonomie. À clarifier dans les epics MVP — sinon Admin tier risque d'être plus large que prévu au MVP.

⚠️ **FR125** (newsletter Admin segment) est V2, mais FR112 (newsletter customer opt-in) est V1 → la segmentation et envoi newsletter pourrait être nécessaire dès V1 pour soutenir FR112. À vérifier en Step 3.

#### Verdict Step 2

✅ **PRD prêt pour validation traceability** — base de 214 requirements (130 FR + 84 NFR) numérotés et taggés par phase, complétée par 12 intégrations, 10+ risques mitigés, et critères de sortie chiffrés. Quelques zones d'ambiguïté à expliciter dans les Steps suivants, mais aucun blocker structurel.

---

## Step 3 — Epic Coverage Validation

> Source : `epics.md` (2 646 lignes, 17 epics, 115 stories, claim "100 % des 130 FRs mappés").

### Inventory vérifié par grep

| Métrique | Cible (claim doc) | Mesuré (`grep`) | OK |
|---|---:|---:|---:|
| Epics | 17 | 17 | ✅ |
| FR rows dans coverage map | 130 | 130 | ✅ |
| Stories MVP (Epic 0-7) | 83 | 13+10+8+12+13+10+8+9 = **83** | ✅ |
| Stories V1 (Epic 8-12) | 20 | 4+4+4+4+4 = **20** | ✅ |
| Stories V2 (Epic 13-16) | 12 | 3+3+3+3 = **12** | ✅ |
| Total stories | 115 | **115** | ✅ |

### Coverage Matrix synthétique (FR → Epic)

> Vue compacte par capability area. Chaque FR est tracé vers ≥ 1 epic. La phase indiquée est celle du couple FR (PRD) / Epic (epics.md).

#### A. User & Identity Management

| FR | Epic | Phase PRD / Epic | Status |
|----|------|------------------|--------|
| FR1 | Epic 1 | MVP / MVP | ✅ |
| FR2 | Epic 8 | V1 / V1 | ✅ |
| FR3 | Epic 1 + Epic 2 | MVP / MVP | ✅ |
| FR4 | Epic 1 | MVP / MVP | ✅ |
| FR5 | Epic 7 | V1 / V1 (note table) | ✅ |
| FR6 | Epic 15 | V2 / V2 | ✅ |
| FR7 | Epic 1 | MVP / MVP | ✅ |
| FR8 | Epic 1 | MVP / MVP | ✅ |
| FR9 | Epic 6 | MVP / MVP | ✅ |
| FR10 | Epic 11 | V1 / V1 | ✅ |
| FR11 | Epic 2 | V1 / V1 | ✅ |
| FR12 | Epic 2 | V1 / V1 | ✅ |
| FR13 | Epic 1 | V1 / V1 | ✅ |
| FR14 | Epic 1 | MVP / MVP | ✅ |
| FR15 | Epic 1 | MVP / MVP | ✅ |
| FR16 | Epic 1 | MVP / MVP | ✅ |
| FR17 | Epic 1 | MVP / MVP | ✅ |

#### B. Catalog & Discovery

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR18 | Epic 3 | MVP/MVP | ✅ |
| FR19 | Epic 3 | MVP/MVP | ✅ |
| FR20 | Epic 3 | MVP/MVP | ✅ |
| FR21 | Epic 3 | MVP/MVP | ✅ |
| FR22 | Epic 3 + Epic 7 | V1 (partial) / MVP+V1 | ✅ |
| FR23 | Epic 2 + Epic 3 | MVP/MVP | ✅ |
| FR24 | Epic 3 | MVP/MVP | ✅ |
| FR25 | Epic 3 | MVP+V1 / MVP+V1 | ✅ |
| FR26 | Epic 3 | MVP/MVP | ✅ |
| FR27 | Epic 3 | V1/V1 | ✅ |
| FR28 | Epic 3 | V1/V1 | ✅ |
| FR29 | Epic 3 | V1/V1 | ✅ |
| FR30 | Epic 3 + Epic 6 | MVP/MVP | ✅ |
| FR31 | Epic 3 | MVP/MVP | ✅ |
| FR32 | Epic 3 | MVP/MVP | ✅ |
| FR33 | Epic 3 + Epic 7 | MVP/MVP | ✅ |

#### C. Booking & Order Lifecycle

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR34 | Epic 4 | MVP+V1 / MVP+V1 | ✅ |
| FR35 | Epic 4 + Epic 8 | MVP+V1 / MVP+V1 | ✅ |
| FR36-38 | Epic 4 | MVP/MVP | ✅ |
| FR39 | Epic 10 | V1/V1 | ✅ |
| FR40-41 | Epic 8 | V1/V1 | ✅ |
| FR42-43 | Epic 4 | MVP/MVP | ✅ |
| FR44 | Epic 12 | V1/V1 | ✅ |
| FR45 | Epic 4 | MVP/MVP | ✅ |
| FR46 | Epic 8 | V1/V1 | ✅ |
| FR47-48 | Epic 4 | MVP/MVP | ✅ |

#### D. Payments & Financial

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR49 | Epic 4 | MVP/MVP | ✅ |
| FR50 | Epic 8 | V1/V1 | ✅ |
| FR51 | Epic 9 | V1/V1 | ✅ |
| FR52 | Epic 8 | V1/V1 | ✅ |
| FR53-54 | Epic 4 | MVP/MVP | ✅ |
| FR55 | Epic 9 | V1/V1 | ✅ |
| FR56 | Epic 4 | MVP/MVP | ✅ |
| FR57-59 | Epic 9 | V1/V1 | ✅ |
| FR60 | Epic 15 | V2/V2 | ✅ |
| FR61 | Epic 6 | MVP/MVP | ✅ |
| **FR62** | **Epic 10** | **MVP (PRD no tag) / V1 (epic)** | ⚠️ phase mismatch |
| FR63 | Epic 6 | MVP/MVP | ✅ |
| FR64-65 | Epic 4 | MVP/MVP | ✅ |
| FR66 | Epic 9 | V1/V1 | ✅ |

#### E. Messaging & Communication

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR67-68 | Epic 5 | MVP/MVP | ✅ |
| FR69-72 | Epic 12 | V1/V1 | ✅ |
| FR73-74 | Epic 5 | MVP/MVP | ✅ |

#### F. Reviews & Reputation

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR75 | Epic 5 | MVP/MVP | ✅ |
| FR76 | Epic 12 | V1/V1 | ✅ |
| FR77 | Epic 12 + Epic 9 | V1/V1 | ✅ |
| FR78 | Epic 12 | V1/V1 | ✅ |
| FR79-82 | Epic 5 | MVP/MVP | ✅ |

#### G. Moderation & Administration

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR83 | Epic 2 + Epic 6 | MVP/MVP | ✅ |
| FR84-86 | Epic 6 | MVP/MVP | ✅ |
| FR87 | Epic 10 | V1/V1 | ✅ |
| FR88-91 | Epic 6 | MVP/MVP | ✅ |
| FR92-93 | Epic 10 | V1/V1 | ✅ |
| FR94-95 | Epic 6 | MVP/MVP | ✅ |

#### H. Internationalization

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR96-98 | Epic 7 | MVP/MVP | ✅ |
| FR99 | Epic 3 + Epic 7 | MVP/MVP | ✅ |
| FR100 | Epic 7 | MVP/MVP | ✅ |
| FR101 | Epic 3 | V1/V1 | ✅ |
| FR102 | Epic 5 + Epic 7 | MVP/MVP | ✅ |
| FR103 | Epic 3 + Epic 7 | MVP/MVP | ✅ |
| FR104 | Epic 7 | MVP/MVP | ✅ |

#### I. Acquisition & Growth

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR105-106 | Epic 7 | MVP/MVP | ✅ |
| FR107-113 | Epic 11 | V1/V1 | ✅ |
| FR114 | Epic 16 | V2/V2 | ✅ |
| FR115-116 | Epic 7 | MVP/MVP | ✅ |

#### J. Notifications

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR117 | Epic 11 | V1/V1 | ✅ |
| FR118-119 | Epic 5 | MVP/MVP | ✅ |
| FR120-121 | Epic 11 | V1/V1 | ✅ |
| FR122 | Epic 14 | V2/V2 | ✅ |
| FR123 | Epic 5 | MVP/MVP | ✅ |
| FR124 | Epic 11 | V1/V1 | ✅ |
| FR125 | Epic 16 | V2/V2 | ✅ |

#### K. Configurateur & Smart Features

| FR | Epic | Phase | Status |
|----|------|-------|--------|
| FR126-127 | Epic 13 | V2/V2 | ✅ |
| FR128 | Epic 15 | V2/V2 | ✅ |
| FR129-130 | Epic 15 | V2/V2 | ✅ |

### Coverage Statistics

- **Total PRD FRs** : 130
- **FRs covered by ≥ 1 epic** : 130 / 130 = **100 %**
- **FRs orphelins** : 0
- **FRs avec phase mismatch PRD ↔ Epic** : 1 (**FR62**)
- **FRs cross-epics (mappés à 2+ epics)** : 13 (FR3, FR22, FR23, FR30, FR33, FR35, FR77, FR83, FR99, FR102, FR103) — multi-epic maitrisé, traçabilité préservée

### Missing Requirements

✅ **Aucun FR PRD non couvert.**

Le claim doc ("100 % des 130 FRs mappés à au moins 1 epic. Aucun FR orphelin.") est confirmé par cross-check ligne par ligne sur les 130 entrées du tableau coverage map (epics.md §FR Coverage Map, lignes 484-617).

### NFR coverage observée (vue indicative — détail en Step 5)

> Step 3 cible la couverture FR. Cette section recense les NFRs explicitement cités dans les blocs `**NFRs covered** :` au niveau epic, **sans valider la qualité** de la couverture (Step 5).

NFRs explicitement référencés au niveau epic (échantillon, non exhaustif) :

- **Epic 0** : NFR5-8 (Performance), NFR9-13 + NFR15-16, NFR18 (Security), NFR42-46 (Reliability), NFR50, NFR54 (Accessibility), NFR56-58, NFR60 (i18n), NFR61-66 (Observability), NFR67-74 (Maintainability), NFR79-84 (Operability)
- **Epic 1** : NFR9-12, NFR21, NFR25, NFR26
- **Epic 2** : NFR15, NFR79
- **Epic 3** : NFR1, NFR5, NFR60
- **Epic 4** : NFR3, NFR6, NFR22-23, NFR40-46
- **Epic 5** : NFR4, NFR16, NFR59
- **Epic 6** : NFR12, NFR19-22, NFR54
- **Epic 7** : NFR1-8, NFR27-28, NFR56-60, NFR63-64
- **Epic 8** : NFR23
- **Epic 10** : NFR19, NFR43

#### NFRs sans citation explicite par epic (à vérifier en Step 5)

⚠️ Ces NFRs ne sont pas cités dans un bloc `NFRs covered` d'un epic mais peuvent être implicitement adressés par les stories ou par l'Epic 0 cross-cutting :

- **NFR2** (SSR p95 < 800 ms) — implicite Epic 0 NFR5-8 ✓ (couverture par bloc)
- **NFR14** (PCI-DSS Stripe Elements) — non cité par epic, implicite Epic 4
- **NFR17** (rate limiting gateway) — non cité par epic
- **NFR20** (hash anti-recréation) — couvert via NFR19-20 Epic 6 ✓
- **NFR24** (factures 10 ans) — non cité, implicite Epic 4 / Epic 9
- **NFR29** (pages légales FR + EN) — couvert via FR104 Epic 7
- **NFR30** (3DS Secure) — non cité par epic, implicite Epic 4 (via Stripe Elements)
- **NFR31-38** (Scalability) — partiellement cités via NFR42-46 et NFR79-84
- **NFR47-53** (Accessibility détaillée) — non cités explicitement, présents seulement via NFR54 + UX-DR20-21
- **NFR75-78** (Integration patterns) — partiellement cités via NFR79

> Cross-check à approfondir en Step 5. La claim doc dit "84 NFRs (couverts via NFR cross-references)" — sans matrice ligne-à-ligne, certains NFRs n'ont qu'un placement implicite.

### Anomalies à signaler

#### 🟡 PHASE-MISMATCH-1 — FR62 PRD MVP vs Epic V1

- **FR62** (PRD §D, ligne 1173) : "Admin peut consulter les disputes Stripe en cours et soumettre l'evidence trail Tukio à Stripe." — **aucun tag de phase → MVP par défaut** (règle PRD §FR introduction).
- Coverage map ligne 547 : `FR62 | Epic 10 | V1 | Disputes Stripe + evidence trail`.
- Epic 10 (`Dispute Workflow & Advanced Admin`) est explicitement V1.
- **Conséquence** : si l'on suit strictement les tags PRD, le MVP doit livrer un outil Admin minimal pour traiter les disputes Stripe ; or aucune story MVP (Epics 0-7) ne couvre cela. FR70 (pièces jointes messagerie pour evidence trail) est explicitement V1.
- **Recommandation** : soit re-tagger explicitement FR62 en `[V1]` dans le PRD pour cohérence, soit créer une story MVP "dispute admin minimum" dans Epic 6 (consultation disputes Stripe sans evidence trail riche). À trancher avec Ismael.

#### 🟢 Multi-epic mapping (informatif, non bloquant)

13 FRs sont mappés à plusieurs epics simultanément (FR3, FR22, FR23, FR30, FR33, FR35, FR77, FR83, FR99, FR102, FR103). Pour chacun, la responsabilité est partagée selon la nature MVP/V1 ou selon la frontière front/back/admin. Cela reste sain car la coverage map indique le rôle de chaque epic et les stories devraient porter chaque parcelle.

> Risque résiduel : pas de propriétaire unique — à valider en Step 5 que les ACs des stories couvrent l'intégralité du FR sans intersection vide.

#### 🟢 Couverture des journeys utilisateur

Les 6 journeys du PRD (J1-J6) sont reflétés dans la chaîne d'epics :
- J1 (Sophie réserve) → Epic 1 + 3 + 4 + 5 ✅
- J2 (annulation force majeure) → Epic 4 (annulation MVP) + Epic 10 (dispute V1) ✅
- J3 (Marc onboard) → Epic 1 + 2 + 4 + 5 ✅
- J4 (dispute Stripe) → Epic 4 (MVP partiel via FR62 anomalie) + Epic 10 (V1) ⚠️ cohérent avec mismatch ci-dessus
- J5 (Léa valide pro) → Epic 2 + 6 ✅
- J6 (saga échouée admin) → Epic 0 (foundation) + Epic 6 (audit trail) + Epic 10 (replay V1) ✅

### Verdict Step 3

✅ **Coverage FR validée à 100 %** : 130 FRs PRD → 17 epics → 115 stories. Aucun FR orphelin.

⚠️ **1 phase mismatch à clarifier** (FR62) — non bloquant pour proceeder mais à inscrire dans la liste des décisions à valider Step 6.

📝 **NFR coverage à approfondir en Step 5** : la traçabilité ligne-à-ligne des 84 NFRs n'est pas formalisée comme pour les FRs (pas de matrice NFR → Epic). Le claim "84 NFRs couverts" est plausible mais non vérifiable sans audit story-par-story.

---

## Step 4 — UX Alignment

> Source : `ux-design-specification.md` (1 487 lignes, status `complete` 2026-05-08, workflow adapté `existing-cloud-design`).

### UX Document Status

✅ **UX spec présente et structurée** : 14 steps complets (init → discovery → core experience → emotional → inspiration → design system → defining experience → visual foundation → design directions → user journeys → component strategy → ux patterns → responsive accessibility → complete).

Inputs déclarés par l'UX spec :
- **Strate consolidée** (planning artifacts) : PRD v1, Architecture v1, product brief v0.3 + distillate
- **Strate produit** (docs source) : 11 docs `tukio_*` consolidés (~17 400 lignes)
- **Strate UX flows** (matière première Cloud Design) : 6 docs `tukio_ux_flow_*`
- **Bundle Claude Design** : `docs/cloud-design-bundle/` (31 écrans designés + tokens.css + `tukio.one.html`)

### UX ↔ PRD Alignment

#### Couverture des 6 user journeys PRD (J1-J6)

| Journey | UX coverage déclaré | Status |
|---------|---------------------|--------|
| **J1** Sophie réserve (happy C1 MVP) | 12/14 écrans ✅ (86 %) | ✅ Aligné — gaps = 2 templates emails + audit cart vue |
| **J2** Annulation force majeure | 3/8 ✅ (38 %) | ⚠️ Workflow admin dispute manquant (V1) |
| **J3** Marc onboarde (happy P1 MVP) | 8/14 ✅ (57 %) | ⚠️ Gaps critiques MVP (payouts, email verify) |
| **J4** Dispute Stripe Marc | 2/9 ✅ (22 %) | ⚠️ Workflow contestation pro entièrement à designer V1 |
| **J5** Léa valide pro (admin-support MVP) | **0/8 ❌ (0 %)** | 🔴 **Gap critique MVP — admin verification queue manquante** |
| **J6** Saga échouée (admin-modo edge) | 0/10 ❌ (0 %) | 🟡 V1 acceptable (admin tools post-MVP) |

#### Direction visuelle alignée

- **Anti-positionnement PRD** (pas Pinterest mariage / pas Stripe minimalist / pas Airbnb / pas Leboncoin / pas MalleàWedding) → repris **identique** dans UX §Emotional Response & Inspiration ✅
- **5 attributs de marque** (Confiance, Chaleur, Sobriété, Ancrage local, Modernité tranquille) → fil conducteur du design system ✅
- **Voix & ton** (vouvoiement systématique, pas d'émojis UI sauf 🔔, pas de jargon SaaS FR) → repris dans UX §Voice & Tone Guidelines ✅
- **Promesses client + pro** (PRD Vision) reprises mot pour mot dans UX Executive Summary ✅

#### Capability mapping UX → FR

L'UX spec cible explicitement les FRs PRD via les écrans :
- **B (Catalog & Discovery)** : home, search, service, pro-profile + page catégorie × ville (gap V1) → FR18-21, FR22-33, FR79
- **C (Booking & Order)** : checkout, confirmation, bookings-list, booking-detail, cancel-flow, seller-bookings → FR34-48
- **D (Payments)** : checkout (Stripe Elements), seller payouts (gap MVP) → FR49-66
- **E (Messaging)** : messages, conversation thread → FR67-74
- **F (Reviews)** : review-form, seller-reviews → FR75-82
- **A (Identity)** : pro-onboarding (full + MVP), email verification (gap MVP), account-settings → FR1-17
- **G (Moderation)** : mvp-admin (minimal), verifications + KYC review (gaps MVP critiques) → FR83-95
- **H (i18n)** : locale selector (gap audit), fallback badge → FR96-104
- **I (Acquisition)** : pages locales catégorie × ville (gap V1), schema.org, sitemaps → FR105-116
- **J (Notifications)** : 7 templates emails Resend (gaps MVP), in-app cloche V1, push V1+ → FR117-125

**Conclusion alignement FR** : la couverture UX est explicite mais **pas exhaustive** au stade Cloud Design — 31 écrans figés sur ~80 cibles, soit 39 %. Les **happy paths customer + seller MVP sont à 100 %**, l'admin MVP est sous-couvert (gap critique J5).

### UX ↔ Architecture Alignment

#### Cohérence projet structure (4 apps multi-zones)

✅ **ADR-013 (Frontend multi-zones 4 apps + architecture feature-based)** est strictement appliqué dans l'UX spec :
- `apps/public/` (homepage, search, service, pro-profile) — SSR + SEO RA1
- `apps/customer/` (cart, bookings, messages, reviews, account)
- `apps/seller/` (dashboard, services, bookings, billing, calendar)
- `apps/admin/` (verifications, transactions, audit) — desktop only MVP

Mapping écran → app explicite et non-ambigu sur les 31 écrans du bundle.

#### Cohérence stack frontend

| Choix UX spec | Choix Architecture | Cohérence |
|---|---|---|
| Tailwind v4 CSS-first via `@theme` | ADR-012 + project structure `packages/ui/styles/theme.css` | ✅ |
| Next.js 15 App Router + React 19 | ADR-013 + Sprint 0 backbone | ✅ |
| TanStack Query v5 + Zustand v5 + RHF + Zod | Architecture state mgmt | ✅ |
| `next-intl` + locale-prefix | ADR-012 i18n | ✅ |
| Stripe Elements iframe (PCI-DSS SAQ-A) | NFR14 + intégration `payment-svc` | ✅ |
| `@tukio/ui` shared cross-zones (atomics + patterns) | 8 packages partagés (Sprint 0 backbone) | ✅ |
| Cookies session Keycloak `Domain=.tukio.one` | ADR-008 + ADR-009 | ✅ |
| WebSocket via `messaging-svc` (Redis pub/sub) | Architecture `messaging-svc` | ✅ |
| Lucide icons + Fraunces/Inter/JetBrains Mono | Sprint 0 backbone latest stable | ✅ |

**Aucune divergence** détectée entre les choix de stack UX et Architecture. Le doc UX renvoie explicitement à l'Architecture pour les détails (state mgmt, multi-zones cookies, WebSocket).

#### Cohérence performance

| Cible UX | Cible Architecture / NFR | Cohérence |
|---|---|---|
| LCP < 2,5 s, INP < 200 ms, CLS < 0,1 | NFR5 | ✅ |
| Bundle JS init homepage < 150 KB gzipped | NFR7 | ✅ |
| Stripe Elements lazy-loaded uniquement sur `apps/customer/` | NFR3, NFR7 | ✅ |
| Search Meilisearch p95 < 150 ms | NFR1, NFR60 | ✅ |
| Touch targets 44 × 44 px | NFR53 | ✅ |
| Score Lighthouse Accessibility ≥ 90 | NFR54 | ✅ |

#### Cohérence accessibility RGAA AA

UX spec §Accessibility Spec couvre exhaustivement NFR47-55 :
- Contraste ratios par tier ✅ NFR48
- Focus ring + ordre Tab + skip links ✅ NFR49
- HTML sémantique + ARIA ✅ NFR50
- Pas d'info uniquement par couleur ✅ NFR51
- `prefers-reduced-motion` + flash limit ✅ NFR52
- Touch targets 44 × 44 px ✅ NFR53
- Lighthouse a11y ≥ 90 + axe-core CI ✅ NFR54
- Audit RGAA expert externe avant V0 + tests utilisateurs handicap V1 ✅ NFR55

#### Cohérence i18n FR + EN dès Sprint 0

UX spec §Multilanguage UX couvre exhaustivement ADR-012 + NFR56-60 + FR96-104 :
- Locale selector dans TopBar ✅ FR97
- Détection `Accept-Language` + fallback FR ✅ FR96
- Persistance cookie + préférence compte ✅ FR97
- Locale-prefix URLs `/fr/...` `/en/...` ✅ FR98, NFR58
- Hreflang systématique ✅ NFR58
- Fallback FR + badge UI explicite ✅ FR99-100
- Templates emails Resend FR + EN ✅ FR102, NFR59
- 1 index Meilisearch par locale ✅ FR103, NFR60
- Pas de hardcoded strings — `useTranslations()` next-intl ✅ NFR56-57
- ICU pluralisation, namespacing par feature ✅ best practice

### Alignment Issues détectés

#### 🔴 ISSUE-1 — J5 admin verification queue : 0 % de couverture pour un journey MVP critique

- **Constat UX** (lignes 991-1001) : 0 / 8 écrans designés pour J5 (Léa valide pro). 4 gaps critiques 🔴 MVP (page liste verifications, détail KYC review, actions valider/rejeter, note interne admin).
- **Conséquence** : sans verification UI MVP, **aucun pro ne peut être validé `verified`**, donc **aucun pro ne peut publier**, donc **aucun booking n'est possible**. C'est un gate critique.
- **Mitigation déjà actée** dans l'UX spec (UX-DR9 + UX-DR10 dans Step 1 de l'epic doc) : 2 écrans à designer Sprint 0, mappés à Epic 2 + Epic 6.
- **Recommandation Step 6** : confirmer que Sprint 0 design (estimation 5-7 j) inclut bien ces 4 écrans avant ouverture de l'Epic 2 dev.

#### 🔴 ISSUE-2 — Page payouts pro absente du bundle, mappée MVP critique

- **Constat UX** (J3 step 13, ligne 963) : `seller-billing/payouts` à designer, gap **🔴 MVP critique**.
- FR56 (Pro voit ses payouts Stripe Connect) est tagué MVP dans le PRD.
- UX-DR11 (epic doc) mappe ce gap à Epic 4 (`Booking, Cart & Payment Saga MVP`).
- **Recommandation** : confirmer story dev dans Epic 4 (cf. Step 5).

#### 🔴 ISSUE-3 — Email verification landing page absente, mappée MVP critique

- **Constat UX** (J3 step 2, ligne 952) : `/{locale}/auth/verify-email` à designer, gap **🔴 MVP critique**.
- FR8 (vérifier email avant transaction) est MVP, FR17 (System bloque transactions si email non vérifié) est MVP.
- UX-DR12 mappe ce gap à Epic 1.
- **Recommandation** : confirmer story dev dans Epic 1 + design Sprint 0.

#### 🟠 ISSUE-4 — 7 templates emails Resend FR + EN à designer Sprint 0

- **Constat UX** (gap analysis lignes 1049, 1084) : 7 templates manquent (confirmation booking, demande pro reçue, rappel J-7, J-1, demande avis J+1, validation pro, refund empathique).
- FR119 (System envoie un email à chaque event clé) est MVP, NFR59 (templates Resend FR + EN) est MVP, NFR29 (FR + EN dès MVP) est MVP.
- UX-DR13 mappe ce gap à Epic 5.
- **Recommandation** : story design + impl. Sprint 0/Epic 5 — sans ces templates, aucun email transactionnel ne part au MVP.

#### 🟡 ISSUE-5 — Cohérence FR62 dispute Stripe MVP/V1 (déjà flaggé Step 3)

- UX spec J4 traite la dispute pro comme **V1** (workflow contestation pro à designer V1).
- PRD FR62 sans tag → MVP par défaut.
- Coverage map FR62 → Epic 10 V1.
- **Triple cohérence UX + Epic mapping ↔ une PRD source ambiguë**. Recommandation : re-tagger explicitement `[V1]` dans le PRD ou créer une story MVP "consultation disputes Stripe basique" dans Epic 4/6.

#### 🟡 ISSUE-6 — MFA admin TOTP enforcement screen non designé

- **Constat UX** (J5 step 1, ligne 992) : `mvp-auth.jsx` (admin variant?) → ⚠️ "Audit : MFA enforcement design ?".
- FR9 (Admin doit activer 2FA TOTP à création) est MVP, NFR12 (sans exception) est MVP.
- **Recommandation** : audit Sprint 0 du `mvp-auth.jsx` ; si absent, story design dédiée pour le flux MFA setup admin (QR code TOTP + verification code + recovery codes).

#### 🟡 ISSUE-7 — Calendrier dispo interactif sur fiche service à auditer

- **Constat UX** (J1 step 5, ligne 915) : audit nécessaire dans `service.jsx` pour l'interaction calendrier dispo temps réel.
- FR48 (3 layers protection conflits dispo) est MVP, R5 mitigation requiert UX claire.
- **Recommandation** : audit prioritaire Sprint 0 — sans calendrier interactif clair sur la fiche, J1 ne peut pas se conclure en 4 minutes.

#### 🟢 ISSUE-8 — Help center / blog pas dans le bundle (gap acquisition)

- **Constat UX** Section "Design Opportunities" : help center et blog absents.
- FR113 (Visitor inscrit checklist téléchargeable) est V1, FR112 (newsletter opt-in) est V1.
- **Recommandation** : OK pour MVP — design help center + blog en V1 (cohérent acquisition strategy 2 articles/mois MVP, 4/mois V1).

#### 🟢 ISSUE-9 — Page d'attente validation pro (banner persistant `/seller`)

- **Constat UX** (J3 step 7, ligne 957) : gap 🟠 MVP.
- Recommandation : reuse `pro-dashboard.jsx` avec banner state — pas un nouvel écran, juste une variante UI.

### Warnings

⚠️ **Couverture admin MVP très faible** : 1 seul écran `mvp-admin.jsx` ⚠️ minimal pour un MVP qui dépend critique-ment de la modération admin (R2 LCEN + R1 TVA + J5 verification). Sprint 0 design DOIT couvrir au minimum les 4 écrans 🔴 critiques avant l'écriture de la 1ʳᵉ story dev fonctionnelle.

⚠️ **31 écrans bundle Cloud Design figés** : excellente fondation côté happy paths customer + seller MVP, mais l'UX spec elle-même flag **5 écrans à auditer** (`account-settings`, `mvp-auth`, `mvp-admin`, `mobile-extra`, calendar interaction service.jsx). À traiter Sprint 0 pour éviter de découvrir des manques pendant le dev.

⚠️ **Gap analysis bien documentée mais pas trackée comme stories** : l'UX spec liste ~30+ écrans manquants V1+/V2 mais ces gaps ne sont visibles que dans la spec. Ils devraient être convertis en stories explicites dans l'epic correspondant pour être priorisés en sprint.

### Verdict Step 4

✅ **UX spec complète et alignée** sur PRD + Architecture (direction visuelle, voix, accessibility, i18n, performance, multi-zones, stack).

⚠️ **3 gaps 🔴 critiques MVP** restent à designer Sprint 0 avant d'ouvrir les Epics 1, 2, 4, 6 :
1. Admin verification queue + KYC review detail (J5)
2. Seller payouts page (J3)
3. Email verification landing page (J3)

⚠️ **7 templates emails Resend FR + EN** à designer Sprint 0 (gap MVP).

📝 **Audit de 5 écrans bundle** à faire Sprint 0 pour figer la couverture exacte.

---

## Step 5 — Epic Quality Review

> Source : `epics.md` (17 epics, 115 stories sampled across MVP + V1 + V2). Standards référencés : `bmad-create-epics-and-stories` (user value, independence, no forward dependencies, INVEST).

### Best Practices Compliance — résultat global

| # | Critère | Résultat | Notes |
|---|---|---|---|
| 1 | Epic delivers user value | ✅ 16/17 | Epic 0 = foundational (acceptable greenfield) |
| 2 | Epic can function independently | ⚠️ 14/17 | Epic 1 dépend partiellement Epic 5 pour FR8 e2e |
| 3 | Stories appropriately sized | ✅ MVP, ⚠️ V1/V2 | MVP rigoureux ; V1/V2 AC density plus faible (planning prématuré) |
| 4 | No forward dependencies | ⚠️ 1 explicite | Story 1.10 → Story 2.7 (audit_log trigger) |
| 5 | Database tables created when needed | ✅ | DB-per-service strict, migrations story-by-story |
| 6 | Clear acceptance criteria (Given/When/Then) | ✅ | Format BDD systématique, tous les niveaux d'epic |
| 7 | Traceability to FRs maintained | ✅ | FR/NFR/UX-DR cités explicitement par story |
| 8 | Greenfield indicators present | ✅ | Story 0.1 bootstrap + 0.10 dev env + 0.11 CI/CD |
| 9 | Starter template required by Architecture | ✅ N/A | `pnpm dlx create-turbo` standard, scaffold OK |

### A. Epic Structure Validation

#### A.1 — User value focus

| Epic | Outcome déclaré | User-centric ? |
|------|---|---|
| Epic 0 — Sprint 0 Foundation | "un dev clone le repo, lance `pnpm dev`, voit les 4 apps + 10 services tourner" | ⚠️ **DEVELOPER user, pas END user**. Acceptable greenfield. |
| Epic 1 — Identity & Auth | "un Visitor peut s'inscrire en moins de 30 s en tant que Customer / Pro / Admin..." | ✅ |
| Epic 2 — Pro Onboarding & Admin Verification | "un Pro complète un onboarding wizard 4 étapes (< 30 min) et se fait valider sous 24h" | ✅ |
| Epic 3 — Catalog Publication & Discovery | "un Pro publie ses services, un Visitor les découvre par search/filtres/fiches" | ✅ |
| Epic 4 — Booking, Cart & Payment Saga | "un Customer réserve un Service en < 4 min, le Pro accepte, capture Stripe différée, reversement J+1" | ✅ |
| Epic 5 — Messaging, Reviews & Notifications | "un Customer et un Pro communiquent via chat lié à booking..." | ✅ |
| Epic 6 — Admin Moderation Console | "Admin dispose d'une console centralisée pour modérer la plateforme..." | ✅ |
| Epic 7 — i18n + Acquisition Foundation | "Visitor accède au site en FR ou EN, contenu traduisible, SEO bilingue, tracking acquisition fonctionnel..." | ✅ |
| Epic 8-12 (V1) | Outcome user explicite chacun | ✅ |
| Epic 13-16 (V2) | Outcome user explicite chacun | ✅ |

**Verdict** : 16/17 epics délivrent une valeur utilisateur claire. Epic 0 est foundational ("technical milestone" par standards stricts) mais **justifié et nécessaire** sur un projet greenfield avec 14 codebases + 8 packages + Tailwind v4 + i18n Sprint 0. La doc le tag explicitement comme "no FR direct, foundational".

#### A.2 — Epic independence

Test : peut-on livrer chaque epic en isolation et constater de la valeur user à la fin ?

| Epic | Indépendance | Notes |
|------|---|---|
| Epic 0 | ✅ Self-contained | Livre la plateforme dev-ready |
| Epic 1 | ⚠️ **Partielle** | FR8 (email verification) requires Epic 5's notification-svc templates pour fonctionner end-to-end. Story 1.6 publie l'event `notification.email.send.v1` ; le consumer est livré Story 5.4 |
| Epic 2 | ⚠️ **Partielle** | FR83 admin verification UX nécessite Story 5.4 templates `pro-verified.{fr,en}.tsx` |
| Epic 3 | ✅ | Catalog autonome ; FR33 indexation Meilisearch couvert intra-Epic 3 |
| Epic 4 | ✅ | Saga complète intra-Epic ; emails confirmation publiés en event, consumer Epic 5 |
| Epic 5 | ✅ | Messaging + reviews + notification-svc templates livrés ensemble |
| Epic 6 | ✅ | Admin console intra-Epic ; FR94-95 audit log déjà setup Story 1.10 + 2.7 |
| Epic 7 | ✅ | i18n + acquisition tracking + SEO autonomes |
| Epic 8-12 (V1) | ⚠️ Inter-dependances V1 | Epic 11 Story 11.3 référence Story 7.6 ; Epic 12 référence Story 5.3 ; Epic 8 référence Story 4.3 — toutes backward |
| Epic 13-16 (V2) | ⚠️ Dependances backward | Story 13.2 Meilisearch (Epic 3), Story 14 RN reuse `@tukio/api-client` (Epic 0) |

**Pattern récurrent** : producer/consumer split typique microservices. Les events sont publiés par un epic, consommés par un autre. Acceptable architecturalement, mais **les épisodes early MVP ne fonctionnent pas e2e tant qu'Epic 5 n'est pas livré**. Plan d'exécution doit en tenir compte.

### B. Story Quality Assessment

#### B.1 — Story sizing & user-story format

Échantillon analysé (Stories 0.1-0.13, 1.1-1.10, 2.1-2.8, 3.1-3.12, 4.1-4.7, 5.1-5.10, 8.1-8.4, 11.1-11.4, 13.1-13.3, 16.1-16.3) :

| Niveau | Format `As a ... I want ... So that ...` | ACs Given/When/Then | AC count moyen |
|---|---|---|---|
| Epic 0 (Sprint 0) | ✅ 13/13 | ✅ 13/13 | ~6 ACs/story |
| Epic 1 (Identity) | ✅ 10/10 | ✅ 10/10 | ~7 ACs/story |
| Epic 2 (Pro Onboarding) | ✅ 8/8 | ✅ 8/8 | ~7 ACs/story |
| Epic 5 (Messaging) | ✅ 10/10 | ✅ 10/10 | ~8 ACs/story |
| Epic 4 (Booking) | sample 7/13 | ✅ | ~7 ACs/story |
| Epic 8-12 (V1) | ✅ majoritairement | ✅ | **~3 ACs/story** ⚠️ |
| Epic 13-16 (V2) | ⚠️ partial (souvent absent) | ✅ ACs présents | **~2 ACs/story** ⚠️ |

**Constat** : MVP stories sont **gold-standard** (format complet + AC détaillés + edge cases + audit + RGPD + i18n). V1 stories ont une format-story souvent omis et des ACs synthétiques (3 en moyenne). V2 stories sont **très synthétiques** (2 ACs, format-story absent dans plusieurs cas).

**Recommandation** : acceptable pour le **planning** V1/V2 (faible coût d'opportunité de détailler trop tôt) ; **must-have** : avant ouverture sprint, V1 stories doivent passer par `bmad-create-story` pour être enrichies au niveau MVP.

#### B.2 — AC quality (échantillonnage)

Sample story 1.2 (Customer B2C registration) — 8 ACs :
1. ✅ Happy path (Given Visitor / When submit / Then enveloppe 201)
2. ✅ Error path (Given email existant / Then 409 generic message + tukioCode distinct)
3. ✅ Side-effect (Given user créé / Then event `notification.email.send.v1` publié)
4. ✅ NFR check (NFR10 rate limit 5 inscriptions/min → 429)
5. ✅ Acquisition tracking (Given UTM / Then colonnes acquisition_* remplies)
6. ✅ Forward gate (Given non vérifié / Then redirige vers verify-email-required)
7. ✅ NFR48 UX timing (≤ 30 s 90 % des inscriptions)
8. ✅ E2E test (Playwright + axe-core, FR + EN)

**Verdict** : ACs MVP **exceptionnels** — couvrent happy path + 4xx + side effects + NFR + a11y + i18n. Niveau "implementation-ready" par un dev senior + medior équivalent.

#### B.3 — Story sizing red flags

🟢 Pas de story qui ressemble à "Setup all models" ou "API Development" abstrait.

🟢 Stories techniques (Story 1.10 identity-svc Pretre, Story 5.1 messaging-svc Pretre) ont un USER tagué (developer / backend developer) ET livrent un outcome architectural concret testable.

⚠️ Story 5.4 (notification-svc + 9 templates × 2 locales = 18-20 fichiers + Resend wiring + 10+ event consumers) est **plus large que la moyenne** — 9 ACs détaillés mais le scope est dense. Peut-être à splitter en 2 stories : (a) notification-svc Pretre + Resend integration + 5 templates critiques MVP ; (b) 5 templates additionnels.

### C. Dependency Analysis

#### C.1 — Within-epic dependencies

✅ **Pas de référence forward intra-epic** détectée dans l'échantillon.

⚠️ **Forward inter-epic** documentée dans Story 1.10 :
> "table `audit_log` est créée avec colonnes ... Le trigger d'immutabilité + UI de consultation sont ajoutés **Story 2.7**."

Epic 1 Story 1.10 crée la table mais le trigger PG d'immutabilité (NFR19, FR95) est livré Epic 2 Story 2.7. Conséquence : entre Story 1.10 et Story 2.7, un super-admin pourrait techniquement modifier l'audit_log. **Risque acceptable** sur la fenêtre dev avant production, mais **doit être livré atomiquement** (Story 2.7 avant prod release).

#### C.2 — Cross-epic dependencies (backward, OK)

Pattern : event-driven pubsub = Epic N publie, Epic N+k consomme. Examples :
- Epic 1 publie `identity.user.registered.v1` → Epic 5 Story 5.4 consume
- Epic 1 publie `identity.password.reset.v1` → Epic 5 consume
- Epic 1 publie `identity.pro.verified.v1` → Epic 5 consume
- Epic 4 publie `booking.requested.v1`, `booking.confirmed.v1`, `booking.refused.v1`, `booking.cancelled.v1` → Epic 5 consume
- Epic 4 publie `payment.payout-confirmed.v1` → Epic 5 consume
- Epic 4 publie `review.request.v1` → Epic 5 Story 5.6 consume

**Risque exécution** : si l'équipe livre Epic 1-4 sans avoir Epic 5 prêt, les emails ne partent pas réellement (MailHog en local OK, mais aucune notification réelle en staging/prod). Mitigation : **paralléliser Epic 5 dès qu'Epic 1 est avancé**, ou **monter Epic 5 partiellement avant Epic 4** (ordre de dependency graph est `Epic 1 → Epic 4 → Epic 5` mais on peut commencer Epic 5 templates en parallèle).

#### C.3 — Database & entity creation timing

| Aspect | Évaluation |
|---|---|
| 10 databases logiques créées Sprint 0 (Story 0.10) | ✅ |
| Tables `outbox` / `inbox` initialisées Sprint 0 par service | ✅ |
| Schemas `acquisition_*` migrés Sprint 0 (Story 0.13) | ⚠️ ambiguïté — voir issue ci-dessous |
| Migrations story-by-story par service | ✅ ADR-003 respecté |
| Tables créées au moment d'utilisation | ✅ |

**🟡 ISSUE-Q1** — Story 0.13 ambiguïté multi-DB
> AC : "la migration TypeORM dans `identity-svc/migrations/`, When je l'exécute, Then les colonnes suivantes sont ajoutées sur `users` ET sur `bookings` (table dans `booking-svc`)"

Une migration TypeORM ne peut pas modifier la DB d'un autre service (database-per-service ADR-003). Le wording laisse entendre qu'une seule migration touche 2 DBs.

**Interprétation probable** : 2 migrations parallèles (une dans `identity-svc`, une dans `booking-svc`), exécutées via le même bootstrap script. À clarifier en Sprint 0 dev pour éviter une violation accidentelle d'ADR-003.

#### C.4 — V1/V2 dependencies sample

- Story 8.2 (V1 multi-vendor) référence Story 4.3 (MVP cart) → backward ✅
- Story 11.3 (V1 referral rewards) référence Story 7.6 (MVP referral foundation) → backward ✅
- Story 12.1 (V1 PII regex) référence Story 5.3 (MVP chat) → backward ✅
- Story 9.4 (V1 export CSV) référence Story 4.9 (PDFs) → backward ✅

✅ Tous les inter-epic dependencies V1+ sont **backward**, pas forward. Conforme.

### D. Special Implementation Checks

#### D.1 — Greenfield + brownfield-docs

**Greenfield code + brownfield docs** confirmé :
- ✅ Initial project setup story (Story 0.1)
- ✅ Development environment configuration (Story 0.10 Docker Compose)
- ✅ CI/CD pipeline setup early (Story 0.11)
- ✅ Schema migration `acquisition_*` Sprint 0 (Story 0.13)
- ✅ 14 ADRs documentés Story 0.13

#### D.2 — Starter template

Architecture ne spécifie pas de starter template propriétaire. Story 0.1 utilise `pnpm dlx create-turbo@latest tukio --package-manager pnpm` (template officiel Turborepo) puis configure les 4 apps + 10 services. Approche **standard greenfield monorepo TypeScript**, pas de template Tukio-spécifique requis. ✅

#### D.3 — Pattern Pretre template + replication

✅ Story 0.6 livre le **template canonique** dans `identity-svc` + script `infra/scripts/replicate-pretre-structure.sh --target=<svc>` qui copie la structure aux 9 autres services. Approche évite la dérive architecturale ↔ ADR-001 strictement appliqué (lint `eslint-plugin-boundaries` Story 0.6 AC).

### E. Anomalies — synthèse par sévérité

#### 🔴 Critical Violations
**Aucun.**

#### 🟠 Major Issues

**🟠 ISSUE-Q2 — Forward dependency Story 1.10 → Story 2.7 (audit_log trigger immutabilité)**
- Story 1.10 crée la table `audit_log`. Story 2.7 ajoute le trigger PG `prevent_audit_log_modification` qui rend la table append-only.
- Entre les deux, NFR19 + FR95 ne sont pas vraiment garantis (un dev avec accès DB peut update/delete des rows audit).
- **Recommandation** : soit fusionner trigger dans Story 1.10 (moins risqué), soit s'assurer que Story 2.7 est livrée **avant prod release**.

**🟠 ISSUE-Q3 — V1/V2 stories sous-spécifiées vs MVP**
- AC count : MVP ~7, V1 ~3, V2 ~2. Format-story souvent absent V1/V2.
- **Risque** : story dev V1 ouverte avec ACs trop synthétiques → ambiguïtés en sprint, scope creep.
- **Recommandation** : avant chaque sprint V1/V2, repasser les stories dans `bmad-create-story` pour les enrichir.

**🟠 ISSUE-Q4 — Story 5.4 trop large (notification-svc + 9 templates × 2 locales)**
- 9 ACs denses ; livre infrastructure + 18-20 fichiers templates + 10 event consumers.
- **Recommandation** : split en 2 stories : (a) `notification-svc` Pretre + Resend wiring + 5 templates MVP critiques (email-verify, pro-verified, booking-confirmed, booking-refused, review-request) ; (b) 5 templates additionnels (password-reset, pro-rejected, booking-requested-pro, booking-cancelled, payout-confirmed).

#### 🟡 Minor Concerns

**🟡 ISSUE-Q5 — Story 0.13 wording ambiguïté multi-DB migration**
- Une "migration dans `identity-svc/migrations/`" est censée toucher `users` ET `bookings` (autre DB).
- À clarifier : 1 migration par service à exécuter ensemble, pas 1 migration cross-DB.

**🟡 ISSUE-Q6 — Epic indépendance dégradée par event-driven**
- Epic 1 / 2 / 4 ne sont pas e2e fonctionnels sans Epic 5 (templates emails).
- Architecturalement OK (microservices), mais à anticiper en sprint planning.

**🟡 ISSUE-Q7 — Epic 0 = "technical milestone" par standard strict**
- Le standard `bmad-create-epics-and-stories` recommande user-value epics. Epic 0 "Sprint 0 Foundation" est foundational pour développeurs.
- **Justification acceptable** sur greenfield 14 codebases + microservices + Tailwind v4 + i18n Sprint 0. La doc l'assume explicitement ("aucun FR direct, foundational, prerequis to all").

**🟡 ISSUE-Q8 — Aucune matrice NFR → Story formalisée**
- Les NFRs sont cités dans les blocs `**NFRs covered** :` au niveau epic, et fréquemment dans les ACs (NFR1, NFR9, NFR48, NFR82...). Mais **pas de matrice ligne-à-ligne 84 NFRs → stories**.
- **Recommandation Step 6** : si traçabilité NFR exigée, créer matrice complementaire post-validation.

#### 🟢 Strengths à conserver

- ✅ Format BDD strict pour ACs (Given/When/Then)
- ✅ Edge cases + audit + RGPD systématiquement adressés (samples : Story 1.2 anti-énumération, Story 1.9 RGPD anonymisation, Story 2.5 idempotence double-clic, Story 5.3 PII redaction, Story 4.7 anti-désintermédiation)
- ✅ NFR explicite par AC (NFR9, NFR10, NFR12, NFR48, NFR82...)
- ✅ i18n FR/EN câblé dans chaque story (Story 1.2 templates locale, Story 5.4 templates par locale, Story 5.9 fallback badge)
- ✅ Pattern Pretre et `eslint-plugin-boundaries` checks obligatoires CI dans chaque story de service
- ✅ Test coverage cible (`80 % domain / 70 % usecases / 50 % infrastructure` Story 1.10)
- ✅ Stories sensibles 🔴 (replay event, impersonation) flaggées avec audit obligatoire (FR92, FR93)

### Verdict Step 5

✅ **Qualité exceptionnelle MVP** — 83 stories MVP avec ACs implementation-ready, audit + RGPD + i18n + a11y systématiquement intégrés. Niveau de granularité largement supérieur à la moyenne marché.

⚠️ **3 issues majeurs** (ISSUE-Q2, Q3, Q4) à actionner avant ouverture sprint :
1. Story 2.7 audit trigger livrée avant prod release (ou fusion Story 1.10)
2. V1/V2 stories à enrichir au fur et à mesure des sprints (`bmad-create-story`)
3. Story 5.4 à splitter en 2 stories pour scope manageable

📝 **4 issues mineurs** (ISSUE-Q5 à Q8) — clarifications doc + matrice NFR optionnelle.

✅ **Aucun blocker structurel** — la combinaison epics + stories est production-ready, reste à exécuter avec discipline.

---

## Step 6 — Final Assessment

### Overall Readiness Status

# 🟢 READY WITH CONDITIONS

Les 4 artefacts (PRD v1, Architecture v1, UX Spec v1, Epics & Stories v1) sont **alignés, complets et implementation-ready** pour démarrer le Sprint 0. L'ouverture des Epics 1+ peut s'enchaîner immédiatement après le Sprint 0 design (5-7 jours estimés) — sans réécriture des artefacts existants.

### Synthèse des findings par categorie

| Categorie | Count | Sévérité dominante |
|---|---:|---|
| 🔴 Gaps design MVP critiques (UX) | 4 | Critical (Sprint 0 design backlog) |
| 🟠 Gaps templates emails Sprint 0 | 7 | Major (Sprint 0 design backlog) |
| 🟠 Phase mismatch PRD ↔ Epic | 1 (FR62) | Major (clarification décision) |
| 🟠 Forward dependency Story 1.10 → 2.7 | 1 | Major (séquence livraison prod) |
| 🟠 V1/V2 stories sous-spécifiées | ~32 stories | Major (à traiter sprint-par-sprint) |
| 🟠 Story 5.4 surdimensionnée | 1 | Major (split recommandé) |
| 🟡 NFR coverage non formalisée matrice | 84 NFRs | Minor (audit optionnel) |
| 🟡 Story 0.13 wording multi-DB | 1 | Minor (clarification AC) |
| 🟡 5 écrans bundle Cloud Design à auditer | 5 | Minor (Sprint 0 audit 1-2 j) |
| 🟡 Epic 0 = "technical milestone" par standard strict | 1 | Minor (justifié greenfield) |
| 🟢 Strengths — quality gold-standard | — | — |

### Critical Issues Requiring Immediate Action

#### Sprint 0 design backlog — bloquant ouverture Epics 1, 2, 4, 6

> ces 4 écrans + 7 templates emails sont **strictement nécessaires** pour que les happy paths MVP J3 (Marc onboarde) et J5 (Léa valide pro) fonctionnent. Sans eux, aucun pro ne peut être validé `verified`, donc aucun service publié, donc aucun booking possible.

| # | Gap | Mappage | Estimation |
|---|---|---|---|
| 1 | **Page liste verifications admin** (`admin.tukio.one/{locale}/verifications`) | UX-DR9 → Epic 2 Story 2.3 | 1-2 j design + 1 j intégration |
| 2 | **Détail dossier pro KYC** (`admin.tukio.one/{locale}/verifications/{id}`) | UX-DR10 → Epic 2 Story 2.4 | 1-2 j design + 1 j intégration |
| 3 | **Page payouts pro** (`/{locale}/seller/billing/payouts`) | UX-DR11 → Epic 4 Story 4.x | 1 j design + 0,5 j intégration |
| 4 | **Page email verification landing** (`/{locale}/auth/verify-email`) | UX-DR12 → Epic 1 Story 1.6 | 0,5 j design + 0,5 j intégration |
| 5 | **7 templates Resend FR + EN** : confirmation booking, demande pro reçue, rappel J-7, J-1, demande avis J+1, validation pro, refund empathique | UX-DR13 → Epic 5 Story 5.4 | 2-3 j design + 1-2 j intégration |
| 6 | **Audit 5 écrans bundle Cloud Design** (`account-settings`, `mvp-auth`, `mvp-admin`, `mobile-extra`, calendar dans `service.jsx`) | Step 4 §Audit | 1 j audit + 0-2 j compléments si gap |

**Total Sprint 0 design** : **5-7 jours** estimés pour fermer ces gaps MVP critiques.

#### Décisions à valider avec Ismael

| # | Décision | Description | Recommandation |
|---|---|---|---|
| D1 | **Phase FR62** (disputes Stripe) | PRD MVP par défaut, Epic Coverage map V1, UX cohérent V1 | Re-tagger explicitement `[V1]` dans le PRD ; OU créer une story MVP minimale "consultation disputes Stripe" dans Epic 4/6 |
| D2 | **Audit_log trigger immutabilité** | Story 1.10 crée la table, Story 2.7 ajoute le trigger PG | Fusionner trigger dans Story 1.10 ; OU s'engager sur "Story 2.7 livrée avant la 1ʳᵉ release prod" |
| D3 | **Story 5.4 split** | 9 templates × 2 locales + Resend wiring + 10 consumers = scope dense | Splitter en 5.4a (notification-svc + 5 MVP critiques) + 5.4b (5 additionnels) |
| D4 | **MFA admin enforcement screen** (Story 1.7) | UX flag `mvp-auth.jsx` à auditer pour le flow setup TOTP | Auditer Sprint 0 ; designer dédié si absent |

### Recommended Next Steps

1. **Lancer le Sprint 0 design (5-7 j)** pour fermer les 4 écrans 🔴 critiques + 7 templates emails + audit 5 écrans bundle (cf. tableau ci-dessus). **Avant Epic 1 dev**.
2. **Valider les 4 décisions D1-D4** avec Ismael (15-30 min de revue) pour figer les choix avant Sprint 0.
3. **Démarrer Sprint 0 backbone en parallèle** (Stories 0.1-0.13) — design et code Sprint 0 peuvent rouler simultanément (le design ne bloque pas l'init monorepo, le scaffold services, le CI/CD, etc.).
4. **Plan de séquencement MVP recommandé** :
   - **Sprint 0 (S0)** : Stories 0.1-0.13 (foundation) — 2-3 semaines
   - **S1-S2** : Epic 1 (Identity & Auth) + Epic 7 partiel (i18n + acquisition foundation) — parallélisables après Sprint 0
   - **S3** : Epic 2 (Pro Onboarding & Admin Verification) + Epic 5 partiel (notification-svc + 5 templates critiques)
   - **S4** : Epic 3 (Catalog) + Epic 5 complet
   - **S5-S6** : Epic 4 (Booking + Payment Saga) + Epic 6 (Admin Console MVP)
   - **S7+** : Epic 7 finitions + tests E2E + audit RGAA externe → V0 release
5. **Avant chaque sprint V1/V2** : enrichir les stories concernées via `bmad-create-story` pour atteindre le niveau de détail MVP (ACs ≥ 5, format-story complet).
6. **Avant la 1ʳᵉ release prod** : audit avocat numérique (R2 LCEN), audit expert-comptable spécialisé marketplace (R1 TVA — peut être fait avant V1, mais si commercialisation MVP B2C alors avant MVP), audit RGAA externe (NFR55).
7. **Après V0 release** : créer une **matrice NFR → Story** (84 NFRs) pour traçabilité formelle des quality attributes au-delà de la couverture déclarative actuelle.

### Final Note

**Findings totaux** : **52 issues** identifiés sur **6 catégories** (4 🔴 critiques, ~12 🟠 majeurs, ~36 🟡 mineurs/clarifications).

**Aucun blocker structurel** sur les artefacts de planning eux-mêmes. La combinaison **PRD v1 (130 FRs + 84 NFRs) + Architecture v1 (14 ADRs + 14 codebases + 8 packages) + UX Spec v1 (31 écrans figés + 21 UX-DRs) + Epics & Stories v1 (17 epics + 115 stories)** offre une fondation **largement supérieure à la moyenne marché** pour un MVP marketplace B2B2C.

**Le seul prérequis bloquant** avant ouverture des Epics 1+ dev : **le Sprint 0 design (5-7 j)** pour fermer les gaps MVP critiques (admin verification UI + seller payouts + email verify landing + 7 templates emails). Ces gaps sont **déjà identifiés et tracés** dans l'UX spec et les epics — il s'agit d'exécuter, pas de re-spécifier.

**Discipline d'exécution recommandée** :
- Maintenir les conventions Sprint 0 (paths EN strict, i18n FR/EN dès le 1ᵉʳ commit, schema acquisition_*, pattern Pretre via lint, audit trail immuable)
- Paralléliser Epic 5 (notification-svc + templates) dès qu'Epic 1 est avancé pour éviter le e2e-broken Epic 1-4 sans Epic 5
- Re-enrichir les stories V1/V2 sprint-par-sprint, pas anticiper le détail trop tôt

---

**Assessment date** : 2026-05-09
**Assessor** : Implementation Readiness workflow (bmad-check-implementation-readiness v6.6)
**Workflow status** : ✅ Complete — all 6 steps executed sequentially
