---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories-epic-0
  - step-03-create-stories-epic-1
  - step-03-create-stories-epic-2
  - step-03-create-stories-epic-3
  - step-03-create-stories-epic-4
  - step-03-create-stories-epic-5
  - step-03-create-stories-epic-6
  - step-03-create-stories-epic-7
  - step-03-create-stories-epic-8
  - step-03-create-stories-epic-9
  - step-03-create-stories-epic-10
  - step-03-create-stories-epic-11
  - step-03-create-stories-epic-12
  - step-03-create-stories-epic-13
  - step-03-create-stories-epic-14
  - step-03-create-stories-epic-15
  - step-03-create-stories-epic-16
  - step-03-create-stories-complete
  - step-04-final-validation
  - step-04-mvp-patch-applied
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'epics-and-stories'
project_name: 'tukio.one'
user_name: 'Ismael'
date: '2026-05-08'
---

# tukio.one — Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **tukio.one**, decomposing the requirements from the PRD, UX Design Specification and Architecture into implementable stories.

Inputs primaires :
- **PRD** v1 (130 FRs + 84 NFRs)
- **Architecture** v1 (14 ADRs + project structure 14 codebases + 8 packages partagés + Sprint 0 backbone)
- **UX Design Specification** v1 (31 écrans Cloud Design figés + design system Tailwind v4 + gap analysis ~50 écrans manquants priorisés MVP/V1/V2 + accessibility RGAA AA)

## Requirements Inventory

### Functional Requirements

> 130 FRs extraits du PRD §Functional Requirements (11 capability areas A à K). Tag de phase entre crochets : `[MVP]` (par défaut, sans tag), `[V1]`, `[V2]`, `[V3+]`.

#### A. User & Identity Management

- **FR1** : Visitor peut s'inscrire en tant que Customer particulier (B2C) avec email + mot de passe, en moins de 30 secondes.
- **FR2** : Customer peut s'inscrire en tant qu'entreprise cliente (B2B) avec raison sociale, SIRET et facturation pro `[V1]`.
- **FR3** : Visitor peut s'inscrire en tant que Pro avec soumission documents (SIRET, RIB, pièce d'identité) — le compte reste en `pending_admin_review` jusqu'à validation.
- **FR4** : Customer / Pro / Admin peut se connecter avec email + mot de passe via Keycloak.
- **FR5** : Customer / Pro peut se connecter via login social Google ou Apple `[V1]`.
- **FR6** : Customer Enterprise peut se connecter via SSO SAML fédéré `[V2]`.
- **FR7** : Customer / Pro / Admin peut récupérer son mot de passe par email (reset link Keycloak).
- **FR8** : Customer / Pro / Admin doit vérifier son adresse email avant toute transaction.
- **FR9** : Admin doit activer une 2FA TOTP obligatoire à la création de son compte.
- **FR10** : Pro peut activer une 2FA TOTP optionnelle sur son compte `[V1]`.
- **FR11** : Pro peut compléter son profil enrichi (portfolio, équipe, certifications) `[V1]`.
- **FR12** : Pro peut soumettre une vérification d'identité complète via Stripe Identity `[V1]`.
- **FR13** : Customer ayant un rôle `client` peut convertir son compte en Pro (ajout rôle `pro` côté Keycloak + flow KYC) sans perte d'historique `[V1]`.
- **FR14** : Customer / Pro peut consulter et modifier ses informations de profil.
- **FR15** : Customer / Pro peut supprimer son compte (soft-delete avec conservation comptable 10 ans, anonymisation au-delà du délai utile).
- **FR16** : System empêche la création de plusieurs comptes Pro sur le même SIRET (sauf cas Enterprise groupes).
- **FR17** : System bloque l'accès aux fonctionnalités transactionnelles pour les comptes non vérifiés (email non vérifié) ou non encore validés (Pro `pending_admin_review`).

#### B. Catalog & Discovery

- **FR18** : Visitor peut effectuer une recherche par catégorie + ville + date sur la barre de recherche.
- **FR19** : Visitor peut filtrer les résultats par capacité, prix, options et autres facettes.
- **FR20** : Visitor peut consulter la fiche d'un Service (titre, description, photos, tarifs, options, zone livraison, délai, avis, politique d'annulation).
- **FR21** : Visitor peut consulter le profil public d'un Pro (bio, services proposés, avis agrégés).
- **FR22** : Visitor peut accéder aux pages de catégorie générales (`/category/{slug}`) et pages locales catégorie × ville (`/category/{slug}/{city}`) `[V1 pour pages locales générées auto]`.
- **FR23** : Pro peut créer une fiche Service avec 3 photos minimum (bloquant) et jusqu'à 15 photos maximum.
- **FR24** : Pro peut éditer ou retirer une fiche Service publiée.
- **FR25** : Pro peut définir une tarification à l'unité ou forfaitaire pour un Service `[MVP pour ces 2 modes]` ; tarification sur devis `[V1]`.
- **FR26** : Pro peut renseigner une zone de livraison et un délai minimum de réservation pour un Service.
- **FR27** : Pro peut intégrer une vidéo via embed YouTube ou Vimeo sur sa fiche Service `[V1]`.
- **FR28** : Pro peut gérer un calendrier de disponibilité (blocage de dates, périodes indisponibles) `[V1]`.
- **FR29** : Pro peut partager un inventaire (`InventoryPool`) entre plusieurs fiches Service du même compte `[V1]`.
- **FR30** : System auto-publie une fiche Service si le Pro est `verified` depuis > 30 jours et a < 3 signalements (sinon modération a posteriori).
- **FR31** : System affiche le prix médian de la catégorie sur la fiche catégorie pour transparence client.
- **FR32** : System empêche la publication d'un Service avec un tarif déviant de plus de ±50 % de la médiane catégorie (soft warning, pas blocage strict).
- **FR33** : System indexe automatiquement chaque Service publié dans le moteur de recherche, avec un index dédié par locale.

#### C. Booking & Order Lifecycle

- **FR34** : Customer peut réserver un Service à une date donnée (réservation directe au MVP, demande de devis personnalisé en `[V1]`).
- **FR35** : Customer peut composer un panier mono-vendeur au MVP, panier multi-vendeurs `[V1]`.
- **FR36** : Customer peut consulter ses réservations passées et à venir dans son espace.
- **FR37** : Customer peut visualiser les détails d'une réservation (statut, prestataire, date, options, total, factures).
- **FR38** : Customer peut annuler une réservation selon la politique d'annulation choisie par le Pro (3 templates standards : souple / standard / strict).
- **FR39** : Customer peut signaler une situation exceptionnelle (force majeure) lors d'une annulation, ouvrant une dispute médiée par Admin `[V1]`.
- **FR40** : Customer peut demander une modification de réservation (date, options) `[V1]`.
- **FR41** : Customer peut effectuer une réservation conditionnelle avec option de 48 h `[V1]`.
- **FR42** : Pro peut consulter sa file de demandes en attente (`pending_pro_acceptance`) avec délai d'expiration visible.
- **FR43** : Pro peut accepter ou refuser une demande de réservation.
- **FR44** : Pro peut proposer un devis personnalisé en réponse à une demande de devis `[V1]`.
- **FR45** : Pro voit ses informations Customer masquées tant qu'il n'a pas accepté la demande (anti-désintermédiation R6).
- **FR46** : Pro peut proposer une modification de réservation au Customer `[V1]`.
- **FR47** : System maintient le cycle de vie d'une réservation à travers ses statuts (`request → accepted → confirmed → completed | cancelled | refused`) avec audit trail complet.
- **FR48** : System gère les conflits de disponibilité avec 3 layers de protection (Redis lock, DB exclusion constraint, optimistic locking).

#### D. Payments & Financial

- **FR49** : Customer peut payer une réservation par carte bancaire via Stripe Elements (autorisation différée, capture à l'acceptation Pro).
- **FR50** : Customer peut sauvegarder une carte de paiement pour usage futur `[V1]`.
- **FR51** : Customer peut payer en 2 échéances 30/70 (acompte à la réservation, solde avant l'événement) `[V1]`.
- **FR52** : Customer peut consulter et télécharger ses factures dans son espace `[V1]`.
- **FR53** : Pro peut visualiser ses transactions, commissions Tukio, frais Stripe, et payouts attendus.
- **FR54** : Pro peut télécharger ses factures émises par Tukio en son nom (mandat art. 289 CGI).
- **FR55** : Pro peut exporter ses transactions au format CSV ou PDF pour comptabilité `[V1]`.
- **FR56** : Pro peut consulter ses payouts Stripe Connect et leur statut (en attente / versé).
- **FR57** : Pro peut souscrire à un tier d'abonnement (Starter gratuit / Business 29 €/mois / Enterprise sur devis) `[V1]`.
- **FR58** : Pro peut changer de tier d'abonnement (upgrade / downgrade) avec proratisation `[V1]`.
- **FR59** : Pro peut résilier son abonnement à la fin de la période en cours (sans engagement) `[V1]`.
- **FR60** : Pro Enterprise peut intégrer Tukio à son outil comptable (Pennylane, QuickBooks API directe) `[V2]`.
- **FR61** : Admin peut effectuer un remboursement total ou partiel d'une transaction.
- **FR62** : Admin peut consulter les disputes Stripe en cours et soumettre l'evidence trail Tukio à Stripe.
- **FR63** : Admin peut consulter le rapprochement Stripe ↔ Tukio (commissions encaissées, payouts envoyés, balance plateforme).
- **FR64** : System gère 3 cas de TVA (pro non-assujetti / B2C / B2B intra-UE) lors de la facturation.
- **FR65** : System reverse automatiquement le montant Pro à J+1 après l'événement, après déduction de la commission.
- **FR66** : System dérive le tier d'abonnement Pro depuis l'état Stripe Subscription (jamais l'inverse).

#### E. Messaging & Communication

- **FR67** : Customer / Pro peut consulter ses conversations dans son espace.
- **FR68** : Customer / Pro peut échanger des messages texte dans une conversation liée à une réservation.
- **FR69** : Customer / Pro peut échanger des messages dans un chat libre avant booking (pour devis) `[V1]`.
- **FR70** : Customer / Pro peut envoyer des pièces jointes (PDF, images) `[V1]`.
- **FR71** : Customer / Pro peut effectuer une recherche dans l'historique de ses conversations `[V1]`.
- **FR72** : System masque automatiquement les emails et numéros de téléphone détectés par regex dans les messages tant que la réservation n'est pas confirmée (anti-désintermédiation) `[V1]`.
- **FR73** : System applique un rate limiting anti-spam (max 3 messages/h vers un Customer qui n'a pas répondu).
- **FR74** : System conserve les messages 5 ans pour litiges et conformité.

#### F. Reviews & Reputation

- **FR75** : Customer peut laisser un avis (note 1-5 + commentaire texte) après un événement.
- **FR76** : Customer peut laisser un avis multi-critères (qualité, ponctualité, communication, rapport qualité/prix) `[V1]`.
- **FR77** : Pro tier Business+ peut répondre publiquement à un avis Customer `[V1]`.
- **FR78** : Pro peut laisser un avis réciproque sur le Customer (visible aux autres Pros uniquement) `[V1]`.
- **FR79** : Visitor peut consulter les avis agrégés d'un Service ou d'un Pro.
- **FR80** : Customer / Pro peut signaler un avis comme abusif.
- **FR81** : System envoie une demande d'avis automatique J+1 après l'événement, avec relance J+7.
- **FR82** : System pondère les avis par récence (avis < 6 mois pèsent 2× plus dans la note agrégée).

#### G. Moderation & Administration

- **FR83** : Admin (`admin-support`) peut consulter la file de validation Pro et valider/rejeter un dossier KYC.
- **FR84** : Admin (`admin-modo` ou `admin-super`) peut suspendre un compte (Customer ou Pro) avec un motif documenté.
- **FR85** : Admin (`admin-super`) peut bannir définitivement un compte (avec hash IP/email/téléphone conservé pour anti-recréation).
- **FR86** : Admin peut consulter les signalements d'utilisateurs (services, avis, comptes, messages) et statuer.
- **FR87** : Admin peut ouvrir, médier et clôturer un litige avec workflow structuré (ouverture → médiation 48 h → résolution → clôture, réouverture possible 15 j) `[V1]`.
- **FR88** : Admin peut appliquer une sanction graduée (avertissement → suspension publication 7 j → suspension compte 30 j → bannissement).
- **FR89** : Admin peut consulter et exporter le journal d'audit immuable des actions admin.
- **FR90** : Admin (`admin-super`) peut créer, modifier ou révoquer les comptes admin (provisionnement manuel uniquement).
- **FR91** : Admin (`admin-super`) peut éditer la taxonomie produit (catégories, sous-catégories, types, tags secondaires).
- **FR92** : Admin (`admin-modo` ou `admin-super`) peut effectuer un replay d'event NATS pour réparer une saga échouée `[V1]` (sensible 🔴, audit obligatoire).
- **FR93** : Admin peut impersonifier un user pour debug `[V1]` (sensible 🔴, audit obligatoire).
- **FR94** : System enregistre toutes les actions admin sensibles dans une table immuable append-only avec timestamp, admin_id, action, target, reason.
- **FR95** : System interdit toute suppression ou modification du journal d'audit, même par `admin-super`.

#### H. Internationalization

- **FR96** : Visitor accède au site avec une locale détectée automatiquement à partir de `Accept-Language` (fallback `fr` si non détecté).
- **FR97** : Customer / Pro peut explicitement choisir sa locale d'affichage (`fr` ou `en`), avec persistance en cookie + préférence compte.
- **FR98** : Visitor peut naviguer sur des URLs locale-prefixées (`/fr/...` ou `/en/...`) avec hreflang systématique vers les autres locales.
- **FR99** : Pro peut saisir le titre et la description de sa fiche Service en français obligatoirement, et en anglais optionnellement (fallback FR pour les visiteurs locale `en` si EN absent).
- **FR100** : System affiche un badge UI "Disponible uniquement en français" sur la version EN d'une fiche Service sans traduction EN.
- **FR101** : Pro peut traduire le contenu de sa fiche Service en EN, optionnellement avec pré-remplissage automatique via traduction (DeepL ou GPT) `[V1]`.
- **FR102** : System envoie les emails transactionnels dans la locale du destinataire (FR ou EN).
- **FR103** : System maintient des index de recherche distincts par locale (`listings_fr`, `listings_en`).
- **FR104** : System fournit les pages légales (CGU, CGV, PC, mentions légales) en FR et EN (FR fait foi juridiquement).

#### I. Acquisition & Growth

- **FR105** : System tracke les UTM params (`source`, `medium`, `campaign`) à l'arrivée du Visitor et les persiste lors de l'inscription user et de la création booking.
- **FR106** : System émet les events business critiques (`page_view`, `search_performed`, `service_viewed`, `pro_viewed`, `booking_request_started`, `booking_request_submitted`, `booking_confirmed`) en server-side via gateway-api (résistant ad-block).
- **FR107** : Customer peut générer un code de parrainage et le partager avec d'autres personnes `[V1]`.
- **FR108** : Customer peut s'inscrire avec un code de parrainage et déclencher un crédit de 30 € pour lui et 30 € pour le parrain à sa première résa > 200 € `[V1]`.
- **FR109** : Customer peut consulter ses crédits de parrainage actifs et leur date d'expiration `[V1]`.
- **FR110** : Wedding Planner / Apporteur d'affaires peut s'inscrire en tant que partenaire avec un dashboard dédié et un lien tracké unique `[V1]`.
- **FR111** : Apporteur peut consulter ses commissions générées (5 % sur chaque résa via son lien) et leur statut `[V1]`.
- **FR112** : Customer peut s'abonner à une newsletter d'événements / contenus blog (opt-in explicite) `[V1]`.
- **FR113** : Visitor peut s'inscrire à une checklist téléchargeable (CTA email capture, ex : "Checklist mariage en Pays de la Loire") `[V1]`.
- **FR114** : Customer peut bénéficier d'un programme de fidélité (-5 % à la 3ᵉ résa) `[V2]`.
- **FR115** : System génère automatiquement les sitemaps XML segmentés par locale + type d'entité, mis à jour quotidiennement.
- **FR116** : System publie automatiquement le balisage Schema.org JSON-LD adapté à chaque type de page (`Service`, `LocalBusiness`, `BreadcrumbList`, `AggregateRating`, `Organization`).

#### J. Notifications

- **FR117** : Customer / Pro peut consulter ses notifications in-app (cloche 🔔) `[V1]`.
- **FR118** : Customer / Pro peut configurer ses préférences de notification par catégorie (transactional non désactivable, important, marketing opt-in).
- **FR119** : System envoie un email transactionnel à chaque event business clé (confirmation booking, acceptation/refus, rappels J-7 et J-1, demande d'avis J+1, validation pro, payout).
- **FR120** : System envoie une notification SMS pour les events urgents `[V1]` (option Pro payante).
- **FR121** : System envoie une notification web push aux utilisateurs PWA `[V1]`.
- **FR122** : System envoie une notification mobile push aux utilisateurs de l'app native `[V2]`.
- **FR123** : System regroupe les notifications de messages non lus après 3 messages consécutifs sans réponse pour éviter le spam.
- **FR124** : Admin peut éditer les templates d'emails dans le back-office `[V1]`.
- **FR125** : Admin peut envoyer une newsletter à un segment Customer ou Pro `[V2]`.

#### K. Configurateur & Smart Features

- **FR126** : Customer peut utiliser un configurateur d'événement qui assemble plusieurs Services en un devis unique selon ses besoins (date, capacité, type d'événement, budget) `[V2]`.
- **FR127** : Customer peut recevoir des recommandations personnalisées de Services basées sur son historique `[V2]`.
- **FR128** : Pro peut sous-traiter une partie d'une réservation à un autre Pro avec splits Stripe gérés automatiquement `[V2]`.
- **FR129** : Pro tier Business+ peut consulter des analytics avancées (benchmarks anonymisés vs catégorie, suggestions de prix) `[V2]`.
- **FR130** : Pro Enterprise peut bénéficier de badges "vérifié", "pro de l'année" affichés publiquement `[V2]`.

### NonFunctional Requirements

> 84 NFRs extraits du PRD §Non-Functional Requirements (11 catégories).

#### Performance (NFR1-8)

- **NFR1** : Latence p95 du search Meilisearch < 150 ms sur tous les endpoints `/api/search/*` (1 index par locale, mémoire pré-warmée).
- **NFR2** : Rendu server-side d'une page publique p95 < 800 ms, mesuré côté Vercel edge.
- **NFR3** : Tunnel checkout (`/cart/checkout`) doit charger Stripe Elements en moins de 1 seconde p95.
- **NFR4** : Latence p95 de livraison d'un message WebSocket via `messaging-svc` < 200 ms.
- **NFR5** : Core Web Vitals : LCP < 2,5 s, INP < 200 ms, CLS < 0,1 sur 4G mobile, mesurés via Lighthouse CI sur chaque PR.
- **NFR6** : Capture différée Stripe (PaymentIntent confirm → capture) < 800 ms p95.
- **NFR7** : Bundle JS initial homepage < 150 KB gzipped ; aucun chunk > 200 KB gzipped sans justification.
- **NFR8** : Aucune page publique > 1,5 MB de poids total (incluant images optimisées AVIF/WebP).

#### Security (NFR9-20)

- **NFR9** : Toutes les communications client-serveur en HTTPS/TLS avec HSTS activé ; redirect HTTP → HTTPS.
- **NFR10** : Toutes les communications inter-services en production en mTLS (`gateway-api` ↔ services downstream).
- **NFR11** : Tous les JWT Keycloak signés en RS256, validés via JWKS (cache 10 min côté `gateway-api`), re-vérifiés dans chaque service downstream.
- **NFR12** : Tous les comptes Admin doivent activer la 2FA TOTP à la création, sans exception.
- **NFR13** : Aucun secret applicatif stocké en clair ; gestion via Kubernetes Secrets + Doppler (MVP) → AWS Secrets Manager / HashiCorp Vault (V2).
- **NFR14** : Tukio ne touche jamais aux numéros de carte ; tunnel paiement utilise Stripe Elements (iframe), scope PCI-DSS SAQ-A.
- **NFR15** : Pièces d'identité KYC pros stockées sur Cloudflare R2 chiffrées at-rest (server-side encryption R2).
- **NFR16** : Logs centralisés (OpenTelemetry → Tempo) avec PII redaction systématique.
- **NFR17** : `gateway-api` applique rate limiting par IP + user authentifié, alerte sur abus.
- **NFR18** : Chaque PR passe scan dépendances (Dependabot ou Snyk) bloquant si CVE critique non patchable.
- **NFR19** : Toute action Admin sensible (refund, ban, replay event, impersonation) tracée dans journal audit immuable.
- **NFR20** : Bannissement utilisateur conserve hash IP/email/téléphone (légal sous 6 ans) pour anti-recréation.

#### Compliance & Privacy (NFR21-30)

- **NFR21** : Statut juridique hybride hébergeur LCEN + tiers de confiance paiement ; aucune modération pré-publication systématique. Audit avocat numérique avant lancement.
- **NFR22** : Tout pro signe mandat de facturation art. 289 CGI à l'onboarding ; Tukio émet la facture en son nom.
- **NFR23** : System gère 3 cas TVA distincts (non assujetti / B2C / B2B intra-UE) ; audit expert-comptable spécialisé marketplace obligatoire avant V1.
- **NFR24** : Toutes les factures émises conservées 10 ans (obligation légale FR).
- **NFR25** : Soft-delete sur comptes utilisateur supprimés (conservation données comptables 10 ans, anonymisation post-délai utile).
- **NFR26** : Tout user peut exercer ses droits RGPD (accès, rectification, effacement, portabilité) via workflow Admin ; cible < 30 j ouvrés `[V1]`.
- **NFR27** : Outils analytiques RGPD-compliant : Plausible (sans cookies, hosted EU), PostHog (hosted EU, opt-in session replay), Brevo FR (V1).
- **NFR28** : Toute fonctionnalité analytique nécessitant un cookie (PostHog session replay) doit obtenir consentement explicite.
- **NFR29** : Pages légales versionnées en FR + EN dès le MVP ; FR fait foi juridiquement.
- **NFR30** : Tout payment Stripe > 30 € en EU déclenche 3DS Secure (géré nativement par Stripe Elements).

#### Scalability (NFR31-38)

- **NFR31** : Architecture supporte sans dégradation > 10 % la cible MVP (6 000 visiteurs uniques mensuels, 80 résa/mois).
- **NFR32** : Architecture supporte cible V1 (30 000 visiteurs/mois, 400 résa/mois) sans modification structurelle.
- **NFR33** : Architecture supporte cible V2 (100 000 visiteurs/mois, 1 500 résa/mois) ; split `payment-svc` dès V0 production.
- **NFR34** : NATS JetStream traverse 10 000 events/sec sans backpressure.
- **NFR35** : `catalog-svc` indexe un nouveau Service dans Meilisearch en moins de 5 secondes.
- **NFR36** : `messaging-svc` supporte 5 000 utilisateurs WebSocket concurrents avant split en deployment dédié.
- **NFR37** : `notification-svc` envoie 10 000 emails/jour sans queue saturée ; déploiement dédié au-delà.
- **NFR38** : Saisonnalité événementielle PdL (pic mai-septembre, creux hivernal) impose capacité 3× la moyenne pendant le pic ; auto-scaling horizontal V1.

#### Reliability & Availability (NFR39-46)

- **NFR39** : `gateway-api` disponibilité ≥ 99,5 % MVP, ≥ 99,9 % à partir de V1 (mesurée mensuellement).
- **NFR40** : NATS JetStream en mode replicas R3 en production avec DLQ stream dédié.
- **NFR41** : Consumer lag NATS < 100 messages en fonctionnement nominal ; alerte > 1 000 messages.
- **NFR42** : Outbox relay PG LISTEN/NOTIFY a fallback polling 30 s ; alerte > 100 messages outbox `pending` > 1 min.
- **NFR43** : Toute saga booking-payment bloquée > 5 min déclenche alerte admin avec replay manuel possible.
- **NFR44** : Sauvegarde PostgreSQL daily snapshot + WAL archiving avec RPO < 5 min, RTO < 1 h.
- **NFR45** : Tous les appels externes critiques (Stripe API, Resend, Meilisearch sync) ont retries exponentiels + circuit breaker timeout 3 s.
- **NFR46** : Tests chaos sur le flow saga booking-payment obligatoires en CI sur chaque PR touchant les services concernés.

#### Accessibility (NFR47-55)

- **NFR47** : Frontend respecte RGAA niveau AA (équivalent WCAG 2.1 AA) sur tous les parcours publics et authentifiés.
- **NFR48** : Contraste texte normal ≥ 4,5:1 ; texte large (≥ 18 pt ou 14 pt bold) ≥ 3:1 ; UI components ≥ 3:1.
- **NFR49** : Tous les éléments interactifs accessibles au clavier (Tab) avec focus ring visible et ordre de tabulation logique.
- **NFR50** : Toutes les images de contenu ont `alt` text non vide ; icon buttons ont `aria-label` ; lint rule bloquante en CI.
- **NFR51** : Aucune information critique véhiculée uniquement par la couleur (erreurs avec icône + texte, états calendrier avec hachures).
- **NFR52** : Frontend respecte `prefers-reduced-motion` ; aucun flash > 3 fois/seconde.
- **NFR53** : Tous les touch targets sur mobile ≥ 44 × 44 px (WCAG 2.1 AA + Apple HIG).
- **NFR54** : Score Lighthouse Accessibility ≥ 90 sur chaque PR (CI gate) ; tests Playwright + axe-core sur parcours critiques.
- **NFR55** : Audit manuel RGAA par expert externe obligatoire avant lancement public V0 ; tests utilisateurs avec personnes en situation de handicap V1.

#### Internationalization (NFR56-60)

- **NFR56** : Aucun texte UI hardcodé dans le frontend ; tous strings via `useTranslations()` de `next-intl` (ADR-012).
- **NFR57** : Toute PR ajoutant ou modifiant une page DOIT inclure les traductions correspondantes dans `messages/fr.json` ET `messages/en.json` ; CI check bloquant.
- **NFR58** : URLs systématiquement locale-prefixées (`/fr/...` ou `/en/...`) avec hreflang propre ; chaque entité a slug par locale.
- **NFR59** : Emails transactionnels via Resend avec templates dupliqués FR + EN, sélectionnés selon la locale du destinataire.
- **NFR60** : Meilisearch maintient 1 index par locale (`listings_fr`, `listings_en`) avec tokenization native.

#### Observability (NFR61-66)

- **NFR61** : Tous les services émettent traces OpenTelemetry avec correlation IDs propagés à travers la saga distribuée ; exportées vers Tempo.
- **NFR62** : Toutes les métriques business critiques (NATS lag, outbox lag, saga duration, payment success rate, search p95) exposées en Prometheus + alertables Alertmanager.
- **NFR63** : Tous les events business critiques émis en server-side via gateway-api (résistant ad-block) et visibles dans PostHog.
- **NFR64** : UTM params persistés sur `users` et `bookings` dès Sprint 0 (impossibles à rétro-fitter sans perte).
- **NFR65** : Dashboards opérationnels Looker Studio + Plausible + PostHog couvrent quotidien/hebdo/mensuel.
- **NFR66** : Logs applicatifs sans PII ; redaction systématique côté gateway-api et notification-svc.

#### Maintainability (NFR67-74)

- **NFR67** : Tous les services backend respectent pattern Pretre (`domain/usecases/infrastructure` + `UseCaseProxy`) ; `eslint-plugin-boundaries` configuré dès Sprint 0.
- **NFR68** : Domain layer (`domain/`) sans aucun import NestJS ; tests unitaires triviaux.
- **NFR69** : Tous les events NATS suivent convention `<service>.<aggregate>.<event>.v<n>` lowercase ; tout schéma versionné dans `@tukio/contracts`.
- **NFR70** : Toute décision architecturale structurante fait l'objet d'une ADR documentée dans `docs/adr/`.
- **NFR71** : Couverture tests minimale par service : 80 % `domain/`, 70 % `usecases/`, 50 % `infrastructure/`. CI gate bloquant.
- **NFR72** : Tout PR de migration de schema DB DOIT inclure script de rollback testé.
- **NFR73** : Code passe checks lint, format, typecheck, tests sur chaque PR ; aucun merge sur `main` sans CI verte.
- **NFR74** : Conventions de nommage figées (Pro/provider, Client/customer, etc.) enforced via lint rules custom.

#### Integration (NFR75-79)

- **NFR75** : Stripe webhooks ont endpoint unique sur `payment-svc` ; events transformés en NATS events internes.
- **NFR76** : Keycloak emit webhooks consommés par `identity-svc` qui maintient mirror ; job réconciliation quotidien.
- **NFR77** : Aucun appel HTTP-to-HTTP entre services downstream sauf exception `booking-svc` → `catalog-svc` pour vérif dispo temps réel.
- **NFR78** : Retries exponentiels + circuit breaker (timeout 3 s) sur tous les appels externes critiques.
- **NFR79** : API INSEE SIRENE consultée à l'onboarding pro pour vérif SIRET ; en cas d'indisponibilité, dossier passe en validation manuelle.

#### Operability (NFR80-84)

- **NFR80** : Déploiement initial MVP colocaté en 3 unités (`core-api`, `workers`, `nats-cluster`) sur 1 cluster K8s/namespace.
- **NFR81** : `payment-svc` splitté en deployment dédié dès V0 production (sécurité PCI-DSS-adjacent).
- **NFR82** : `notification-svc`, `media-svc`, `messaging-svc`, `catalog-svc` splittables en deployment dédié sur trigger explicite.
- **NFR83** : Toute migration DB backward-compatible (deux versions coexistent) pour rolling deployments sans downtime.
- **NFR84** : Tous les services exposent endpoints `/health` (liveness), `/ready` (readiness), `/metrics` (Prometheus).

### Additional Requirements

> Extraits de l'Architecture v1 (Step 4 §Core Architectural Decisions + Step 6 §Project Structure + Step 9 §Implementation Handoff).

#### 14 ADRs structurants à formaliser dans `docs/adr/0001-*.md` à `0014-*.md` au Sprint 0

- **ADR-001** : Pattern Pretre Clean Architecture strict + monorepo Turborepo
- **ADR-002** : NATS JetStream (vs Kafka/RabbitMQ)
- **ADR-003** : Database per service, no shared tables
- **ADR-004** : Booking et Order = 2 services distincts
- **ADR-005** : Meilisearch dès le MVP (override Postgres FTS)
- **ADR-006** : Saga choréographée (pas d'orchestrator)
- **ADR-007** : Outbox pattern partout via PG LISTEN/NOTIFY
- **ADR-008** : gateway-api seul accès public
- **ADR-009** : Keycloak + identity-svc séparés
- **ADR-010** : TypeORM par défaut + raw SQL pour read-heavy
- **ADR-011** : `@tukio/contracts` package dès Sprint 0
- **ADR-012** : i18n FR + EN dès Sprint 0
- **ADR-013** : Frontend multi-zones 4 apps + architecture feature-based stricte
- **ADR-014** : Enveloppe REST canonique sur toutes les responses gateway-api

#### Stack figée (latest stable, cf. `feedback_latest_versions.md`)

- **Frontend** : Next.js 15 + React 19 + TypeScript strict + Tailwind v4 (CSS-first `@theme`) + next-intl + shadcn/ui + Lucide + Fraunces + Inter + JetBrains Mono + TanStack Query 5 + Zustand 5 + React Hook Form 7 + Zod + Stripe Elements + WebSocket
- **Backend** : NestJS 11 (Fastify) + Pattern Pretre hexagonal + TypeORM + raw SQL pour read-heavy
- **Auth** : Keycloak 25 (Phasetwo managé MVP)
- **Messaging** : NATS JetStream 2.10+ via `@horizon-republic/nestjs-jetstream`
- **DB** : PostgreSQL 16 (Neon serverless), 1 database par service, MVP 10 DBs sur 1 instance
- **Recherche** : Meilisearch (1 index par locale)
- **Paiements** : Stripe Connect Express + Stripe Billing
- **Médias** : Cloudflare R2 + Cloudflare Images
- **Email** : Resend (transactionnel) + Brevo (marketing V1)
- **Cache** : Upstash Redis
- **Observabilité** : OpenTelemetry + Prometheus + Tempo + Loki + Grafana Cloud
- **Hébergement** : Vercel (4 frontends multi-zones) + Hetzner Cloud K8s (backend, ArgoCD GitOps)
- **CI/CD** : GitHub Actions + GitHub Container Registry (ghcr.io) + Husky + lint-staged + commitlint
- **Secrets** : Doppler MVP, AWS Secrets Manager / Vault V2

#### Sprint 0 backbone — livrables d'initialisation

- Bootstrap monorepo Turborepo (`pnpm dlx create-turbo@latest tukio --package-manager pnpm`)
- Setup 4 apps Next.js 15 multi-zones (`apps/{public,customer,seller,admin}/`)
- Setup 10 services NestJS hexagonaux (`apps/{gateway-api,identity-svc,catalog-svc,booking-svc,order-svc,payment-svc,messaging-svc,review-svc,notification-svc,media-svc}/`)
- Scaffold pattern Pretre dans `identity-svc` puis répliquer aux 9 autres services
- Setup 8 libs partagées : `@tukio/{contracts,messaging,auth,testing,ui,api-client,i18n-client,auth-client}`
- Initialiser `docs/adr/` avec les 14 ADRs préexistants
- Docker Compose dev local complet (Postgres × 10 DBs, NATS, Keycloak, Meilisearch, Redis, MailHog)
- CI GitHub Actions : workflow PR (lint + typecheck + tests affected + Lighthouse 4 apps)
- Helm charts K8s : déploiement core-api / workers / nats sur Hetzner staging via ArgoCD
- Observability stack : Grafana Cloud + agents OpenTelemetry dans les 10 services
- Schema `acquisition_*` migré sur `users` + `bookings` dès Sprint 0 (impossible à rétro-fitter)
- 14 ADRs `docs/adr/` initialisés avec status accepted

#### Conventions non négociables (figées par lint rules)

- Code/DB/API/events en EN strict ; UI/produit en FR/EN selon locale
- Tous paths URL en EN (jamais FR), avec locale-prefix `/{locale}/...`
- "Buyer" interdit en code (utiliser `customer`) ; "Seller" reste seulement dans URLs
- Slugs par locale (FR + EN distincts) stockés dans `<entity>_translations`
- Events NATS : `<service>.<aggregate>.<event>.v<n>` lowercase, dashes pour tokens composés
- Error codes : `<DOMAIN>-<CATEGORY>-<NNN>` format
- Enveloppe REST : `{ method, code, data | error, pagination?, meta }` sur toutes responses gateway-api

#### 12 intégrations externes critiques (à câbler Sprint 0+)

- **Stripe Connect Express** (🔴 critique) — webhooks unique endpoint `payment-svc`
- **Stripe Billing** (🔴 V1) — subscription tiers
- **Stripe Identity** (🟠 V1) — KYC complet pro
- **Keycloak 25** (🔴 critique) — OIDC + webhooks → identity-svc
- **Cloudflare R2 + Images** (🟠) — médias + CDN + transformations
- **Resend** (🟠) — emails transactionnels FR + EN
- **Brevo** (🟡 V1+) — emails marketing FR + EN
- **Meilisearch** (🔴) — 1 index par locale
- **API INSEE SIRENE** (🟢) — vérification SIRET onboarding
- **Plausible** (🟡) — web analytics RGPD
- **PostHog** hosted EU (🟠) — product analytics + funnels + A/B
- **DeepL ou GPT-4** (🟡 V1+) — traduction auto FR → EN

#### Risques R1-R15 + RA1-RA5 (à mitiger by design dans les stories)

- **R1** TVA marketplace (🔴) → audit expert-comptable spécialisé avant V1
- **R2** Statut éditeur LCEN involontaire (🔴) → pas de modération pré-pub systématique, audit avocat
- **R5** Race conditions dispo (🟠) → 3 layers locks Redis + DB exclusion + optimistic
- **R6** Anti-désintermédiation insuffisante (🟡) → coordonnées masquées + regex V1
- **R8** Sync Keycloak ↔ identity-svc drift (🟡) → webhooks + job réconciliation quotidien
- **R10** RGPD vs conservation 10 ans (🟡) → anonymisation post-délai utile
- **R11** Saga booking-payment partiellement échouée (🔴) → tests chaos CI, replay possible, monitoring
- **R12** NATS JetStream perte message (🟠) → R3 prod, DLQ, monitoring lag
- **R13** Outbox relay panne (🟠) → healthcheck + fallback polling 30s
- **R15** Coût opérationnel 10 services dès MVP (🟠) → 3 deployment units MVP
- **RA1** Acquisition demande échoue (🔴, risque opérationnel #1) → SEO foundation Sprint 0 + tracking server-side + mix 3 leviers MVP

### UX Design Requirements

> 21 UX-DRs extraits de l'UX Design Specification v1. Chaque UX-DR est implémentable comme story autonome.

#### Design system code-ready

- **UX-DR1** : Design system code-ready Tailwind v4 (`@theme` directive CSS-first dans `packages/ui/src/styles/theme.css`) avec tous les tokens couleur (brand 50-900, cream 50-300, charcoal 400-900, success/warning/error/info/danger), typo (Fraunces/Inter/JetBrains Mono modular scale 1.250), spacing 4px-base, radius, shadows warm-tinted, breakpoints xs-2xl, animations.
- **UX-DR2** : TypeScript tokens `packages/ui/src/tokens/{colors,typography,spacing,radius,shadows,breakpoints,animations}.ts` pour accès programmatique (charts, Stripe Elements theme, tests visuels Playwright).
- **UX-DR3** : Migration des classes utilitaires custom du bundle Cloud Design (`.tk-btn`, `.tk-input`, etc.) vers composants React typés `<Button>`, `<Input>` dans `@tukio/ui/components/`.
- **UX-DR4** : `packages/ui/src/styles/globals.css` entry point partagé qui `@import "tailwindcss"` + `@import "./theme.css"` + reset léger + base styles cohérents avec design brief.

#### Composants atomiques @tukio/ui

- **UX-DR5** : Composants atomiques React 19 + TypeScript strict avec accessibility ARIA : `<Button>` (variants primary/secondary/tertiary/ghost/danger, sizes sm/default/lg), `<Input>`, `<Label>`, `<Helper>`, `<FormField>`, `<Badge>` (variants brand/success/warning/info/neutral), `<Card>`, `<Modal>`, `<Toast>`, `<Alert>`, `<Avatar>`, `<Stars>`, `<Skeleton>`, `<Spinner>`, `<ProgressBar>`, `<Placeholder>` (rayé monospace).

#### Patterns composites @tukio/ui/patterns

- **UX-DR6** : Patterns composites cross-domain : `<TopBar>`, `<Footer>`, `<ConversationThread>` (FR67-74), `<ReviewsDisplay>` (multi-critères V1), `<PricingDisplay>` (multi-lignes TVA), `<AvailabilityCalendar>`, `<FilterSidebar>` (FR19), `<FileUpload>` (V1 messagerie + KYC pro), `<StepIndicator>`, `<Map>` (V1), `<EmptyState>` (7 variants design brief §D.7), `<ErrorPage>` (404, 500, maintenance).

#### Bundle Cloud Design — 31 écrans existants

- **UX-DR7** : Intégration des **22 écrans Cloud Design figés** (cf. UX Spec §Audit) en composants React + Next.js feature-based, pixel-match avec `tukio.one.html` de référence : home, search, service, pro-profile (apps/public) ; checkout, confirmation, bookings-list, booking-detail, cancel-flow, review-form, messages (apps/customer) ; pro-dashboard, pro-onboarding (full + MVP simplifié), seller-bookings, seller-calendar, seller-profile-edit, seller-reviews, seller-service-create (full + MVP simplifié) (apps/seller).
- **UX-DR8** : Audit + intégration des **5 écrans à auditer** (`account-settings`, `mvp-auth`, `mvp-admin`, `mobile-extra`, calendar interaction dans `service.jsx`) — clarifier la couverture exacte au Sprint 0 et compléter si besoin.

#### Écrans MVP critiques manquants (gap analysis 🔴)

- **UX-DR9** : Designer + intégrer **page liste verifications admin** (`admin.tukio.one/{locale}/verifications`) avec file `pending_admin_review`, filtres, badges délai d'attente. Critère de sortie MVP : sans cette page, J5 (Léa valide pro) impossible.
- **UX-DR10** : Designer + intégrer **détail dossier pro KYC admin** (`admin.tukio.one/{locale}/verifications/{id}`) avec SIRET INSEE auto-check, KYC docs viewer (pièce ID + RIB + justificatif), bio, photo profil, bouton Valider/Rejeter avec raison + note interne admin.
- **UX-DR11** : Designer + intégrer **page payouts pro** (`/{locale}/seller/billing/payouts`) avec liste payouts Stripe Connect (en attente / versé), facture pro téléchargeable, transactions associées, total période.
- **UX-DR12** : Designer + intégrer **page email vérification landing** (`/{locale}/auth/verify-email`) avec bloquage des features transactionnelles tant que email non vérifié + CTA "Renvoyer email" + helper "Vérifiez vos spams".

#### Templates emails Resend FR + EN (MVP critiques)

- **UX-DR13** : Concevoir et intégrer **7 templates emails transactionnels Resend** en versions FR + EN : confirmation booking customer, demande pro reçue, rappel J-7 customer, rappel J-1 customer, demande d'avis J+1, validation pro reçue, refund customer (template empathique pour litiges).

#### États interactifs (UX patterns)

- **UX-DR14** : Implémenter **loading states hiérarchiques** : skeleton screens (initial load), spinners (actions courtes), progress bars (uploads/exports), avec règle "pas de loader si action < 300 ms".
- **UX-DR15** : Implémenter **error handling 3 niveaux** : inline (champ form via `<FormField>`), toast (mutations ratées), page d'erreur (404/500). Toujours avec action de récupération (Réessayer / Retour / Contacter le support). Format error envelope ADR-014 consommé via TanStack Query `onError`.
- **UX-DR16** : Implémenter **7 variants empty states** (`<EmptyState>`) : search-no-results, cart-empty, customer-no-bookings, seller-no-bookings, seller-no-services, messages-empty, reviews-empty — avec illustration + titre + description + CTA primary.
- **UX-DR17** : Implémenter **confirmations destructrices** (`<DestructiveConfirmModal>`) avec re-formulation + conséquences listées + bouton primary `danger` + ESC + click outside ferme.

#### i18n UX (cohérent ADR-012, FR96-104)

- **UX-DR18** : Implémenter **sélecteur locale** dans `<TopBar>` (FR / EN switcher) avec persistance cookie `tukio-locale` (`Domain=.tukio.one`) + préférence compte si connecté + redirect vers même route avec locale prefix changé.
- **UX-DR19** : Implémenter **fallback FR pour contenu user-generated EN manquant** avec badge UI explicite `<Badge variant="info">{t('listing.availableOnlyInFrench')}</Badge>` (FR99-100).

#### Accessibility RGAA AA (NFR47-55)

- **UX-DR20** : Implémenter **accessibility checklist par composant atomic** (`<Button>`, `<Input>`, `<Modal>`, `<Toast>`, `<Stars>`, `<Avatar>`, `<Badge>`, `<Placeholder>`, `<FilterSidebar>`, `<AvailabilityCalendar>`, `<ConversationThread>`) avec : focus ring visible, ARIA labels, sémantique HTML stricte, aria-live appropriée, `prefers-reduced-motion` respecté, touch targets 44 × 44 px mobile.
- **UX-DR21** : Setup **validation accessibility CI** : axe-core auto dans Playwright tests E2E sur parcours critiques (search, checkout, onboarding pro), Lighthouse CI score Accessibility ≥ 90 sur chaque PR (gate bloquant), audit manuel RGAA par expert externe avant V0 release.

### FR Coverage Map

> Mapping complet des **130 FRs** vers les **17 epics** (Epic 0 Sprint 0 Foundation + 7 MVP + 5 V1 + 4 V2). NFRs et UX-DRs sont cross-cutting et listés au niveau de chaque epic.

| FR | Epic | Phase | Note |
|----|------|-------|------|
| FR1 | Epic 1 | MVP | Customer registration B2C particulier |
| FR2 | Epic 8 | V1 | B2B Customer registration |
| FR3 | Epic 1 + Epic 2 | MVP | Pro conversion wizard Identité+Activité+Documents+Récap (Epic 1 — voir FR13) → Stripe Connect + 1ère fiche (Epic 2) |
| FR4 | Epic 1 | MVP | Login Keycloak email/password |
| FR5 | Epic 7 | V1 | Social login Google/Apple |
| FR6 | Epic 15 | V2 | SAML SSO Enterprise |
| FR7 | Epic 1 | MVP | Reset password |
| FR8 | Epic 1 | MVP | Email verification (+ UX-DR12 landing page) |
| FR9 | Epic 6 | MVP | MFA TOTP admin |
| FR10 | Epic 11 | V1 | MFA TOTP optionnel pro |
| FR11 | Epic 2 | V1 | Profil pro enrichi (portfolio, équipe, certifs) |
| FR12 | Epic 2 | V1 | Stripe Identity KYC complet |
| FR13 | Epic 1 | MVP | Conversion customer → pro (wizard 4 steps : Identité / Activité / Documents / Récap → `pending_admin_review`) |
| FR14 | Epic 1 | MVP | Profile management |
| FR15 | Epic 1 | MVP | Soft-delete + anonymisation RGPD |
| FR16 | Epic 1 | MVP | Anti-doublon SIRET pro |
| FR17 | Epic 1 | MVP | Bloquage transactions si email non vérifié |
| FR18 | Epic 3 | MVP | Search par catégorie + ville + date |
| FR19 | Epic 3 | MVP | Filter sidebar facets |
| FR20 | Epic 3 | MVP | Fiche service publique |
| FR21 | Epic 3 | MVP | Profil pro public |
| FR22 | Epic 3 + Epic 7 | MVP/V1 | Pages catégorie générales (MVP), pages locales catégorie × ville (V1) |
| FR23 | Epic 2 + Epic 3 | MVP | Création fiche service (3-15 photos), 1ère fiche dans onboarding pro |
| FR24 | Epic 3 | MVP | Édition/retrait fiche service |
| FR25 | Epic 3 | MVP/V1 | Tarification unité/forfait MVP, sur devis V1 |
| FR26 | Epic 3 | MVP | Zone livraison + délai |
| FR27 | Epic 3 | V1 | Vidéos YouTube/Vimeo embed |
| FR28 | Epic 3 | V1 | Calendrier dispo avancé |
| FR29 | Epic 3 | V1 | InventoryPool partagé |
| FR30 | Epic 3 + Epic 6 | MVP | Auto-publication fiche service (admin) |
| FR31 | Epic 3 | MVP | Affichage prix médian catégorie |
| FR32 | Epic 3 | MVP | Soft warning ±50 % médiane |
| FR33 | Epic 3 + Epic 7 | MVP | Indexation Meilisearch (1 index/locale) |
| FR34 | Epic 4 | MVP | Réservation directe (V1 demande devis) |
| FR35 | Epic 4 + Epic 8 | MVP/V1 | Panier mono-vendeur (MVP), multi-vendeurs (V1) |
| FR36 | Epic 4 | MVP | Liste réservations customer |
| FR37 | Epic 4 | MVP | Détail réservation customer |
| FR38 | Epic 4 | MVP | Annulation 3 templates politique |
| FR39 | Epic 10 | V1 | Force majeure → dispute Admin |
| FR40 | Epic 8 | V1 | Modification réservation |
| FR41 | Epic 8 | V1 | Réservation conditionnelle 48h |
| FR42 | Epic 4 | MVP | File pending pro acceptance |
| FR43 | Epic 4 | MVP | Acceptation/refus pro |
| FR44 | Epic 12 | V1 | Devis personnalisé pro |
| FR45 | Epic 4 | MVP | Coordonnées masquées avant acceptation |
| FR46 | Epic 8 | V1 | Pro propose modification |
| FR47 | Epic 4 | MVP | Lifecycle booking (statuts + audit trail) |
| FR48 | Epic 4 | MVP | 3 layers race conditions dispo |
| FR49 | Epic 4 | MVP | Stripe Elements + capture différée |
| FR50 | Epic 8 | V1 | Carte sauvegardée |
| FR51 | Epic 9 | V1 | Acomptes 30/70 |
| FR52 | Epic 8 | V1 | Factures customer |
| FR53 | Epic 4 | MVP | Pro voit transactions/commissions |
| FR54 | Epic 4 | MVP | Factures pro mandat art. 289 CGI |
| FR55 | Epic 9 | V1 | Export CSV/PDF comptabilité |
| FR56 | Epic 4 | MVP | Pro voit payouts (UX-DR11) |
| FR57 | Epic 9 | V1 | 3 tiers Starter/Business/Enterprise |
| FR58 | Epic 9 | V1 | Change tier + proratisation |
| FR59 | Epic 9 | V1 | Résilier abonnement |
| FR60 | Epic 15 | V2 | Intégrations comptables Pennylane/QuickBooks |
| FR61 | Epic 6 | MVP | Refund manuel admin (partiel V1) |
| FR62 | Epic 10 | V1 | Disputes Stripe + evidence trail |
| FR63 | Epic 6 | MVP | Rapprochement Stripe ↔ Tukio |
| FR64 | Epic 4 | MVP | 3 cas TVA |
| FR65 | Epic 4 | MVP | Reversement automatique J+1 |
| FR66 | Epic 9 | V1 | Tier dérivé Stripe Subscription |
| FR67 | Epic 5 | MVP | Conversations customer/pro |
| FR68 | Epic 5 | MVP | Messages texte lié à booking |
| FR69 | Epic 12 | V1 | Chat libre avant booking |
| FR70 | Epic 12 | V1 | Pièces jointes (PDF, images) |
| FR71 | Epic 12 | V1 | Recherche historique conversations |
| FR72 | Epic 12 | V1 | Anti-désintermédiation regex |
| FR73 | Epic 5 | MVP | Rate limiting anti-spam messages |
| FR74 | Epic 5 | MVP | Rétention messages 5 ans |
| FR75 | Epic 5 | MVP | Avis 1-5 + commentaire |
| FR76 | Epic 12 | V1 | Multi-critères |
| FR77 | Epic 12 + Epic 9 | V1 | Réponse pro Business+ |
| FR78 | Epic 12 | V1 | Note réciproque pro → customer |
| FR79 | Epic 5 | MVP | Display avis sur fiches |
| FR80 | Epic 5 | MVP | Signaler avis abusif |
| FR81 | Epic 5 | MVP | Demande avis automatique J+1 |
| FR82 | Epic 5 | MVP | Pondération récence |
| FR83 | Epic 2 + Epic 6 | MVP | Validation pro KYC (Epic 2 workflow + Epic 6 admin queue UI) |
| FR84 | Epic 6 | MVP | Suspendre compte (admin) |
| FR85 | Epic 6 | MVP | Bannir + hash anti-recréation |
| FR86 | Epic 6 | MVP | Signalements modération |
| FR87 | Epic 10 | V1 | Workflow litige structuré 48h |
| FR88 | Epic 6 | MVP | Sanctions graduées |
| FR89 | Epic 6 | MVP | Audit trail consultable |
| FR90 | Epic 6 | MVP | Provisionnement admin |
| FR91 | Epic 6 | MVP | Édition taxonomie |
| FR92 | Epic 10 | V1 | Replay event NATS (sensible 🔴) |
| FR93 | Epic 10 | V1 | Impersonation user (sensible 🔴) |
| FR94 | Epic 6 | MVP | Audit trail immuable |
| FR95 | Epic 6 | MVP | Audit non-modifiable |
| FR96 | Epic 7 | MVP | Detection locale Accept-Language |
| FR97 | Epic 7 | MVP | Choix locale user persisté |
| FR98 | Epic 7 | MVP | URLs locale-prefixées + hreflang |
| FR99 | Epic 3 + Epic 7 | MVP | Saisie pro FR obligatoire + EN optionnel |
| FR100 | Epic 7 | MVP | Badge fallback FR (UX-DR19) |
| FR101 | Epic 3 | V1 | Pré-remplissage auto DeepL/GPT |
| FR102 | Epic 5 + Epic 7 | MVP | Emails locale destinataire |
| FR103 | Epic 3 + Epic 7 | MVP | Index Meilisearch par locale |
| FR104 | Epic 7 | MVP | Pages légales FR + EN |
| FR105 | Epic 7 | MVP | UTM tracking server-side |
| FR106 | Epic 7 | MVP | Events business critiques server-side |
| FR107 | Epic 11 | V1 | Génération code parrainage |
| FR108 | Epic 11 | V1 | Inscription avec code + crédit symétrique |
| FR109 | Epic 11 | V1 | Customer voit ses crédits |
| FR110 | Epic 11 | V1 | Apporteur d'affaires partenaire |
| FR111 | Epic 11 | V1 | Apporteur voit commissions |
| FR112 | Epic 11 | V1 | Newsletter opt-in |
| FR113 | Epic 11 | V1 | Checklist téléchargeable + email capture |
| FR114 | Epic 16 | V2 | Programme fidélité customer |
| FR115 | Epic 7 | MVP | Sitemaps XML segmentés par locale |
| FR116 | Epic 7 | MVP | Schema.org JSON-LD |
| FR117 | Epic 11 | V1 | Notifications in-app (cloche 🔔) |
| FR118 | Epic 5 | MVP | Préférences notifications |
| FR119 | Epic 5 | MVP | Email transactionnel (UX-DR13 templates FR + EN) |
| FR120 | Epic 11 | V1 | SMS urgents (option pro payante) |
| FR121 | Epic 11 | V1 | Web push PWA |
| FR122 | Epic 14 | V2 | Push native iOS/Android |
| FR123 | Epic 5 | MVP | Regroupement messages non lus |
| FR124 | Epic 11 | V1 | Templates emails admin |
| FR125 | Epic 16 | V2 | Newsletter segmentée admin |
| FR126 | Epic 13 | V2 | Configurateur événement |
| FR127 | Epic 13 | V2 | Recommandations personnalisées |
| FR128 | Epic 15 | V2 | Co-traitance pros |
| FR129 | Epic 15 | V2 | Analytics pros avancées |
| FR130 | Epic 15 | V2 | Badges "vérifié"/"pro de l'année" |

**Validation** : 100 % des 130 FRs mappés à au moins 1 epic. Aucun FR orphelin.

## Epic List

### Epic 0 — Sprint 0 Foundation

**Phase** : Sprint 0 (3-5 jours estimés)
**Outcome équipe** : un dev clone le repo, lance `pnpm dev` + `docker:up`, voit les 4 apps + 10 services tourner localement, push une PR qui build/test/deploy automatiquement en staging via ArgoCD. Plateforme prête à recevoir les stories user-facing.

**Couvre** :
- Bootstrap monorepo Turborepo + 4 apps Next.js 15 + 10 services NestJS scaffoldés en pattern Pretre
- 8 libs partagées : `@tukio/contracts`, `@tukio/messaging`, `@tukio/auth`, `@tukio/testing`, `@tukio/ui`, `@tukio/api-client`, `@tukio/i18n-client`, `@tukio/auth-client`
- Design system Tailwind v4 (`packages/ui/src/styles/theme.css` + tokens TS + composants atomiques + patterns extracted bundle Cloud Design)
- Docker Compose dev local complet (Postgres × 10 DBs, NATS, Keycloak, Meilisearch, Redis, MailHog)
- CI GitHub Actions (lint + typecheck + tests affected + Lighthouse 4 apps)
- Helm charts K8s + ArgoCD staging (Hetzner)
- 14 ADRs documentés dans `docs/adr/`
- Schema `acquisition_*` migré sur tables `users` + `bookings`
- Observability stack (OpenTelemetry + Prometheus + Tempo + Loki + Grafana Cloud)
- Vercel multi-zones config

**FRs covered** : aucun FR direct (foundational, prerequis to all)
**NFRs covered** : NFR67-74 (Maintainability), NFR80-84 (Operability), NFR61-66 (Observability)
**UX-DRs covered** : UX-DR1-6 (design system code-ready Tailwind v4), UX-DR7 (intégration 22 écrans figés bundle), UX-DR8 (audit 5 écrans à clarifier)

---

### Epic 1 — Identity & Authentication Backbone

**Phase** : MVP
**Outcome utilisateur** : tout user (Visitor → Customer / Pro / Admin) peut s'inscrire, se connecter, gérer son profil, vérifier son email, et bénéficier de RBAC granulaire. Foundation pour tous les autres epics.

**FRs covered** : FR1, FR3 (registration partiel — KYC dans Epic 2), FR4, FR7, FR8, FR13 (V1), FR14-17
**NFRs covered** : NFR9-12 (HTTPS/mTLS/JWT/MFA), NFR21 (LCEN positioning), NFR25 (soft-delete RGPD), NFR26 (droits RGPD V1)
**UX-DRs covered** : UX-DR12 (email verification landing page), audit `mvp-auth` (5 écrans audit)

---

### Epic 2 — Pro Onboarding & Admin Verification

**Phase** : MVP
**Outcome utilisateur** : un Pro peut compléter son onboarding (4 étapes wizard < 30 min) et se faire valider par un Admin sous 24h. Sans cet epic, aucun pro ne peut publier de service.

**FRs covered** : FR3 (KYC docs upload), FR11 (V1 portfolio), FR12 (V1 Stripe Identity), FR23 (1ère fiche dans onboarding), FR83 (admin valide/rejette), FR94-95 (audit trail)
**NFRs covered** : NFR15 (chiffrement at-rest pièces ID), NFR79 (INSEE SIRENE)
**UX-DRs covered** : UX-DR9-10 (admin verification queue + KYC review detail), UX-DR8 (audit `mvp-admin` partiel)
**Intégrations** : Stripe Connect Express (KYC financier), API INSEE SIRENE (vérif SIRET), Cloudflare R2 (KYC docs storage)

---

### Epic 3 — Catalog Publication & Discovery

**Phase** : MVP
**Outcome utilisateur** : un Pro publie ses services, un Visitor les découvre par search/filtres/fiches détaillées. Couvre les 2 catégories pilotes MVP (tentes/chapiteaux + mobilier événementiel).

**FRs covered** : FR18-21, FR22 (page catégorie générale MVP), FR23-26, FR27-29 (V1), FR30-33, FR99 (saisie pro FR + EN), FR101 (V1 traduction auto), FR103 (Meilisearch par locale)
**NFRs covered** : NFR1 (search p95 < 150ms), NFR5 (Core Web Vitals SEO), NFR60 (Meilisearch par locale)
**UX-DRs covered** : `home`, `search`, `service`, `pro-profile` (4 écrans bundle figés), audit calendar interaction service.jsx
**Intégrations** : Meilisearch Cloud (1 index par locale), Cloudflare Images (transformations photos services)

---

### Epic 4 — Booking, Cart & Payment Saga (mono-vendor MVP)

**Phase** : MVP
**Outcome utilisateur** : un Customer réserve un Service en < 4 min, le Pro accepte, capture Stripe différée, reversement automatique J+1. Saga distribuée booking → order → payment fonctionnelle.

**FRs covered** : FR34, FR35 (mono-vendor MVP), FR36-38, FR42-43, FR45 (anti-désintermédiation), FR47-49, FR53-54, FR56, FR61, FR63-65
**NFRs covered** : R5 (race conditions 3 layers), R11 (saga monitoring + alerts > 5min), NFR3 (checkout < 1s), NFR6 (capture < 800ms p95), NFR40-46 (reliability), NFR43-46 (saga resilience), NFR22-23 (mandat art. 289 CGI + 3 cas TVA)
**UX-DRs covered** : `checkout`, `confirmation`, `bookings-list`, `booking-detail`, `cancel-flow`, `seller-bookings` (6 écrans bundle figés), UX-DR11 (seller payouts page MVP critique)
**Intégrations** : Stripe Connect Express (PaymentIntents, capture différée, refunds, payouts), Redis Upstash (locks dispo)

---

### Epic 5 — Messaging, Reviews & Transactional Notifications

**Phase** : MVP
**Outcome utilisateur** : Customer et Pro communiquent via chat lié à booking, demande d'avis automatique J+1, emails transactionnels FR/EN. Cycle post-booking complet.

**FRs covered** : FR67-68, FR73-75, FR79-82, FR102 (emails locale destinataire), FR117 (préférences MVP), FR118-119, FR123
**NFRs covered** : NFR4 (WebSocket p95 < 200ms), NFR59 (templates Resend FR + EN), NFR16 (PII redaction logs)
**UX-DRs covered** : `messages`, `review-form` (2 écrans bundle figés), UX-DR13 (7 templates emails Resend FR + EN MVP critiques)
**Intégrations** : Resend (transactional emails), Upstash Redis pub/sub (WebSocket sync)

---

### Epic 6 — Admin Moderation Console (MVP minimum)

**Phase** : MVP
**Outcome utilisateur** : Admin gère la plateforme — valide pros, modère signalements, gère transactions/refunds, consulte audit trail. Sans cet epic, pas de gouvernance.

**FRs covered** : FR9 (MFA admin), FR30 (auto-publication policy), FR61 (refund admin), FR63 (rapprochement), FR84-86, FR88-91, FR94-95
**NFRs covered** : NFR12 (MFA TOTP admin obligatoire), NFR19-20 (audit trail + hash anti-recréation), NFR21-22 (LCEN + mandat art. 289 CGI), NFR54 (Lighthouse a11y ≥ 90)
**UX-DRs covered** : `mvp-admin` (audit), pages admin MVP (verifications via Epic 2, transactions, audit trail) — gap V1+ pour les écrans admin avancés
**Intégrations** : Keycloak admin roles (`admin-{support,modo,super}`)

---

### Epic 7 — i18n FR/EN + Acquisition Foundation (RA1 mitigation)

**Phase** : MVP
**Outcome utilisateur** : Visitor accède au site en FR ou EN, contenu user-generated traduisible, SEO bilingue, tracking acquisition fonctionnel dès le 1er visiteur. RA1 = risque opérationnel #1, ce epic est CRITIQUE.

**FRs covered** : FR5 (V1 social login), FR22 (V1 pages locales auto), FR96-100, FR102, FR104 (legal pages FR + EN), FR105-106, FR115-116
**NFRs covered** : NFR1-8 (Core Web Vitals SEO), NFR27-28 (Plausible + PostHog RGPD), NFR56-60 (i18n complète), NFR63-64 (server-side tracking + acquisition_* schema)
**UX-DRs covered** : UX-DR18-19 (locale selector + fallback FR badge)
**Intégrations** : Plausible (web analytics RGPD), PostHog hosted EU (server-side events via gateway-api), DeepL/GPT-4 (V1)

---

### Epic 8 — B2B Customer Accounts & Multi-Vendor Cart `[V1]`

**Phase** : V1
**Outcome utilisateur** : entreprise cliente s'inscrit, panier multi-vendeurs, factures B2B, devis personnalisés, modifications de réservation, réservations conditionnelles 48h.

**FRs covered** : FR2, FR35 (multi-vendor V1), FR40-41, FR46, FR50, FR52
**NFRs covered** : NFR23 (cas TVA B2B intra-UE)
**UX-DRs covered** : pages B2B Multi-vendor cart UI (gap V1)

---

### Epic 9 — Pro Subscriptions, Tiers & Échéanciers `[V1]`

**Phase** : V1
**Outcome utilisateur** : Pro choisit son tier (Starter/Business/Enterprise), Customer paie en 30/70 acompte, échéanciers personnalisables, factures pro téléchargeables. Inflexion business V1.

**FRs covered** : FR51, FR55, FR57-59, FR66, FR77 (réponse avis Business+)
**Intégrations** : Stripe Billing (subscription tiers, sync via webhooks)
**UX-DRs covered** : Pages subscription tier choice + change V1 (gap V1)

---

### Epic 10 — Dispute Workflow & Advanced Admin `[V1]`

**Phase** : V1
**Outcome utilisateur** : workflow litige structuré 48h médiation, replay events admin pour sagas échouées, impersonation user pour debug, tooling admin avancé.

**FRs covered** : FR39, FR62, FR87, FR92-93
**NFRs covered** : NFR43 (saga > 5min replay), NFR19 (audit actions sensibles)
**UX-DRs covered** : workflow admin dispute médiation V1 (gap V1), saga monitoring + replay event admin-modo V1

---

### Epic 11 — In-App Notifications, PWA & Referral Program `[V1]`

**Phase** : V1
**Outcome utilisateur** : notifications in-app cloche 🔔, web push PWA pros, programme parrainage symétrique 30€/30€, apporteurs B2B (wedding planners), email marketing.

**FRs covered** : FR10, FR107-113, FR117 (in-app), FR120-121, FR124
**Intégrations** : Brevo (email marketing FR + EN)
**UX-DRs covered** : Apporteurs B2B partner dashboard V1 (gap V1)

---

### Epic 12 — Anti-désintermédiation, Reviews Multi-Critères & Quotes `[V1]`

**Phase** : V1
**Outcome utilisateur** : reviews multi-critères, réponse pro aux avis, anti-désintermédiation regex avancée, chat libre avant booking pour devis.

**FRs covered** : FR44, FR69-72, FR76-78
**NFRs covered** : R6 (anti-désintermédiation insuffisante mitigation V1)
**UX-DRs covered** : Workflow pro contestation dispute Stripe + evidence trail V1 (gap V1, signature électronique livraison)

---

### Epic 13 — Configurateur & Smart Recommendations `[V2]`

**Phase** : V2
**Outcome utilisateur** : Customer utilise un configurateur d'événement intelligent qui assemble plusieurs services en un devis, recommandations personnalisées basées sur historique.

**FRs covered** : FR126-127

---

### Epic 14 — Mobile Native iOS + Android `[V2]`

**Phase** : V2
**Outcome utilisateur** : Pro reçoit ses leads via notifications push native iOS/Android, gère ses réservations et calendrier en mobilité.

**FRs covered** : FR122
**Stack additionnelle V2** : React Native ou Flutter (à figer V2)

---

### Epic 15 — Pro Enterprise & SAML SSO B2B `[V2]`

**Phase** : V2
**Outcome utilisateur** : Pro Enterprise bénéficie de SLA 4h, account manager, intégrations comptables (Pennylane, QuickBooks API directe), badges visibles. Comptes B2B Enterprise login via SAML federation.

**FRs covered** : FR6, FR60, FR128-130

---

### Epic 16 — Loyalty Customer & Newsletter Admin `[V2]`

**Phase** : V2
**Outcome utilisateur** : programme de fidélité client (-5% à la 3ᵉ résa), Admin envoie newsletters segmentées.

**FRs covered** : FR114, FR125

---

### Dépendances naturelles entre epics

```
Epic 0 (Sprint 0 Foundation)
  ↓
  ├──→ Epic 1 (Identity & Auth) — prerequis pour TOUS les autres
  │     ↓
  │     ├──→ Epic 2 (Pro Onboarding) ──┐
  │     │                              │
  │     ├──→ Epic 3 (Catalog) ─────────┼─→ Epic 4 (Booking + Payment Saga)
  │     │                              │       ↓
  │     ├──→ Epic 7 (i18n + Acquisition) ─┐    ├──→ Epic 5 (Messaging + Reviews + Notifs)
  │     │   (peut démarrer en parallèle)  │    │
  │     │                                  │    └──→ Epic 6 (Admin Console)
  │     │                                  │
  │     │                                  └──── post-MVP V1 ────→ Epics 8-12 (parallèles)
  │     │                                                                ↓
  │     │                                                          post-V1 V2 ────→ Epics 13-16
```

**Critère de sortie MVP** : Epics 0-7 livrés et déployés. Permet d'atteindre 50 pros + 100 résa cibles MVP.

**Critère de sortie V1** : Epics 8-12 livrés. Permet d'atteindre 200 abonnés Business + 1ʳᵉ rentabilité mensuelle.

---

## Stories — Detailed

> Stories détaillées par epic, avec format user story standard (`As a … I want … So that …`) + acceptance criteria Given/When/Then. Couverture FRs/NFRs/UX-DRs explicitée par story.
>
> **Ordre de livraison** : Epic 0 → Epic 1 → Epic 2 → … → Epic 16 (cf. dépendances ci-dessus).

### Epic 0: Sprint 0 Foundation

**Outcome équipe** : un dev clone le repo, lance `pnpm dev` + `pnpm docker:up`, voit les 4 apps + 10 services tourner localement, push une PR qui build/test/deploy automatiquement en staging via ArgoCD. Plateforme prête à recevoir les stories user-facing.

**FRs covered** : aucun FR direct (foundational, prerequis to all)
**NFRs covered** : NFR5-8, NFR9-13, NFR15-16, NFR18, NFR42-46, NFR50, NFR54, NFR56-58, NFR60-66, NFR67-74, NFR79-84
**UX-DRs covered** : UX-DR1-6 (design system), UX-DR7 (intégration 22 écrans figés bundle), UX-DR8 (audit 5 écrans)

#### Story 0.1: Bootstrap monorepo Turborepo + scaffold 4 Next.js apps + 10 NestJS services

**As a** developer,
**I want** a fully-scaffolded Turborepo monorepo with 4 Next.js 15 apps and 10 NestJS 11 services initialized as empty workspaces,
**So that** the team can start implementing features without setting up tooling manually.

**Acceptance Criteria :**

- **Given** une machine clean avec pnpm 10+ et Node.js 22 LTS installés, **When** je clone le repo et lance `pnpm install`, **Then** tous les workspaces installent sans erreur et `pnpm-workspace.yaml` résout `apps/*` et `packages/*`.
- **Given** le workspace installé, **When** je regarde `apps/`, **Then** je trouve exactement 4 Next.js 15 apps : `public`, `customer`, `seller`, `admin` (chacun avec `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/[locale]/page.tsx`, `middleware.ts` placeholder).
- **Given** le workspace installé, **When** je regarde `apps/`, **Then** je trouve exactement 10 NestJS 11 services : `gateway-api`, `identity-svc`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc` (chacun avec `package.json`, `nest-cli.json`, `tsconfig.json`, `Dockerfile`, `.env.example`, `src/main.ts`, `src/app.module.ts`).
- **Given** le workspace installé, **When** je regarde `packages/`, **Then** je trouve 8 libs scaffoldées vides : `contracts`, `messaging`, `auth`, `testing`, `ui`, `api-client`, `i18n-client`, `auth-client` (chacun avec `package.json`, `tsconfig.json`, `src/index.ts` placeholder).
- **Given** le workspace, **When** je regarde la racine, **Then** je trouve `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc.json`, `.editorconfig`, `commitlint.config.cjs`, `.nvmrc`, `.gitignore`, `.husky/{pre-commit,commit-msg}`, `README.md`.
- **Given** le workspace, **When** je lance `pnpm dev`, **Then** Turborepo démarre les 4 frontends + 10 backends en parallèle (chacun expose un serveur HTTP même si vide), aucune erreur `EADDRINUSE` (ports configurés distincts : 3000-3003 frontends, 4000-4009 backends).
- **Given** le workspace, **When** je lance `pnpm lint && pnpm typecheck`, **Then** les 2 commandes passent sans erreur (configs Next.js + NestJS strict + ESLint + Prettier déjà câblées).

#### Story 0.2: Initialize @tukio/contracts (envelope types + 5 critical NATS event JSON Schemas + core DTOs)

**As a** developer,
**I want** the `@tukio/contracts` package initialized with envelope types (ADR-014), 5 critical NATS event JSON Schemas, and shared DTO Zod schemas,
**So that** all backend services and frontend apps can consume strongly-typed contracts from a single source of truth.

**Acceptance Criteria :**

- **Given** le package `@tukio/contracts`, **When** j'importe `{ SuccessEnvelope, ErrorEnvelope, Pagination, Meta }` depuis `@tukio/contracts/envelope`, **Then** ils sont disponibles comme types TypeScript correctement typés (cf. ADR-014 §Format Patterns).
- **Given** `@tukio/contracts/src/events/`, **When** je regarde la structure, **Then** je trouve au minimum 5 events JSON Schema + types TS dérivés : `catalog/listing-published.v1.{schema.json,ts}`, `booking/booking-requested.v1.{schema.json,ts}`, `booking/booking-accepted.v1.{schema.json,ts}`, `payment/payment-intent-captured.v1.{schema.json,ts}`, `admin/admin-action-pro-verified.v1.{schema.json,ts}`.
- **Given** un événement NATS, **When** je l'instancie via `@tukio/contracts`, **Then** il respecte la convention `<service>.<aggregate>.<event>.v<n>` lowercase + suit la structure enveloppe `{ eventId, eventType, eventVersion, occurredAt, correlationId, causationId, actor, aggregate, payload }` (cf. PRD §Communication Patterns).
- **Given** `@tukio/contracts/src/dtos/`, **When** je regarde la structure, **Then** je trouve des Zod schemas partagés pour les 5 use cases critiques MVP : `auth.dto.ts` (RegisterCustomerDto), `booking.dto.ts` (CreateBookingDto, BookingResponseDto), `catalog.dto.ts` (CreateListingDto), `payment.dto.ts` (PaymentIntentResponseDto).
- **Given** `@tukio/contracts`, **When** je publie ce package en interne (workspace), **Then** `apps/gateway-api`, `apps/<service>-svc`, et les 4 frontends peuvent l'importer via `import { ... } from '@tukio/contracts/...'` sans erreur de résolution.
- **Given** une PR qui modifie un JSON Schema event, **When** la CI tourne, **Then** le check `tukio/event-naming` (lint custom) valide le format `<service>.<aggregate>.<event>.v<n>`, et le test de compatibilité de schéma compare avec la version précédente (alerte si breaking change non-versionné).

#### Story 0.3: Setup design system Tailwind v4 (theme.css + tokens TS + globals.css) in @tukio/ui

**As a** frontend developer,
**I want** `@tukio/ui` configured with Tailwind v4 CSS-first design tokens (theme.css), TypeScript tokens for programmatic access, and a shared globals.css entry point,
**So that** the 4 Next.js apps consume the same terracotta design system without duplication.

**Acceptance Criteria :**

- **Given** `packages/ui/src/styles/theme.css`, **When** je l'ouvre, **Then** je trouve la directive `@theme { ... }` Tailwind v4 avec **tous les tokens** : `--color-brand-{50..900}` (terracotta `#FCF3EE` → `#3E1606`), `--color-cream-{50..300}`, `--color-charcoal-{400..900}`, fonctionnels (success/warning/error/info/danger), `--font-{display,body,mono}`, `--text-{xs..6xl}` modular scale 1.250, `--spacing-{0..24}` base 4 px, `--radius-{sm,md,lg,xl,2xl,full}`, `--shadow-{sm,default,md,lg,xl}`, `--breakpoint-{xs..2xl}`, `--animate-typing`.
- **Given** `packages/ui/src/tokens/`, **When** je l'ouvre, **Then** je trouve `colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `shadows.ts`, `breakpoints.ts`, `animations.ts`, `index.ts` avec les valeurs exactes du theme.css pour accès programmatique (charts, Stripe Elements theme).
- **Given** `packages/ui/src/styles/globals.css`, **When** je l'ouvre, **Then** je trouve `@import "tailwindcss"`, `@import "./theme.css"`, et le reset léger + base styles (Inter pour body, Fraunces pour `<h1-4>`, `text-wrap: balance` sur headings, `text-wrap: pretty` sur `<p>`, `prefers-reduced-motion` respecté).
- **Given** `apps/public/src/app/globals.css`, **When** je l'ouvre, **Then** il importe simplement `@import "@tukio/ui/styles/globals.css"` et l'app render le terracotta + Fraunces correctement.
- **Given** une page Next.js qui utilise `bg-brand-500`, **When** je build l'app, **Then** Tailwind v4 génère la classe correspondante avec la valeur `#C2410C` (auto-detect content sans `content: [...]` config explicite).
- **Given** je teste les Core Web Vitals avec Lighthouse, **When** la home charge, **Then** LCP < 2,5 s, INP < 200 ms, CLS < 0,1 (NFR5).

#### Story 0.4: Implement 17 atomic components (@tukio/ui/components) extracted from Cloud Design bundle

**As a** frontend developer,
**I want** 17 atomic React 19 components implemented in `@tukio/ui/components/` based on the Cloud Design bundle's `_shared.jsx` and `tokens.css`,
**So that** the 4 apps consume identical UI primitives with full accessibility and TypeScript types.

**Acceptance Criteria :**

- **Given** `packages/ui/src/components/`, **When** je l'ouvre, **Then** je trouve les 17 composants (chacun dans son dossier `<Component>/{Component.tsx,Component.spec.tsx,index.ts,types.ts}`) : `Button`, `Input`, `Label`, `Helper`, `FormField`, `Badge`, `Card`, `Modal`, `Toast`, `Alert`, `Avatar`, `Stars`, `Skeleton`, `Spinner`, `ProgressBar`, `Placeholder`, `Divider`.
- **Given** `<Button variant="primary" size="default">`, **When** je le rends, **Then** le rendu visuel match exactement `tokens.css .tk-btn-primary` du bundle (bg `brand-500`, color `cream-50`, hover `brand-400`, height 40 px, padding 0 16 px, border-radius `md`).
- **Given** `<Button variant="primary" size="lg">`, **When** je le rends sur mobile, **Then** la hauteur est 48 px (touch target ≥ 44 × 44 px conforme NFR53).
- **Given** `<Button loading>`, **When** il est rendu, **Then** un `<Spinner size="sm" />` apparaît à gauche, `aria-busy="true"` est appliqué, et le bouton est `disabled`.
- **Given** `<Modal>`, **When** il s'ouvre, **Then** il a `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (titre), `aria-describedby` (description), focus trap actif (Tab cycle dans la modale), ESC ferme, click outside ferme (sauf si modale destructrice avec `requireExplicitClose`).
- **Given** `<Placeholder label="Photo événement réel">`, **When** il est rendu, **Then** le pattern striped monospace match `.tk-ph` du bundle (`background-image: repeating-linear-gradient(135deg, ...)`), `role="img"` + `aria-label="Photo événement réel"`.
- **Given** chaque composant atomic, **When** je lance les tests Vitest, **Then** au moins 1 test couvre l'API (props, variants), 1 test couvre l'accessibilité (axe-core inline), coverage ≥ 80 % du fichier.
- **Given** chaque composant atomic, **When** je l'importe `import { Button } from '@tukio/ui/button'`, **Then** seul le code du Button est tree-shaken (pas de barrel `import * from '@tukio/ui'`).

#### Story 0.5: Implement 12 composite patterns (@tukio/ui/patterns) extracted from Cloud Design bundle

**As a** frontend developer,
**I want** 12 composite patterns implemented in `@tukio/ui/patterns/` based on the Cloud Design bundle's screens and `_shared.jsx`,
**So that** les 4 apps réutilisent les mêmes assemblages cross-domain (TopBar, Footer, ConversationThread, etc.).

**Acceptance Criteria :**

- **Given** `packages/ui/src/patterns/`, **When** je l'ouvre, **Then** je trouve 12 patterns : `TopBar`, `Footer`, `ConversationThread`, `ReviewsDisplay`, `PricingDisplay`, `AvailabilityCalendar`, `FilterSidebar`, `FileUpload`, `StepIndicator`, `EmptyState`, `ErrorPage`, `Map` (V1 placeholder).
- **Given** `<TopBar variant="public" locale="fr">`, **When** je le rends sur `apps/public/`, **Then** je vois logo Tukio à gauche + search bar centrale + Catégories/Devenir pro/Help links + Connexion/S'inscrire CTAs à droite.
- **Given** `<EmptyState variant="search-no-results">`, **When** je le rends, **Then** je vois illustration (Lucide grand format) + titre `<h2>` Fraunces + description `text-base charcoal-500` + CTA `<Button variant="primary">` "Effacer les filtres".
- **Given** `<EmptyState>`, **When** je passe les 7 variants (`search-no-results`, `cart-empty`, `customer-no-bookings`, `seller-no-bookings`, `seller-no-services`, `messages-empty`, `reviews-empty`), **Then** chaque variant a son icône, titre, description, CTA approprié (cohérent UX-DR16).
- **Given** `<ConversationThread messages={...} currentUserId={...}>`, **When** je le rends, **Then** les bulles s'affichent à droite/gauche selon l'expéditeur, timestamps relatifs ("Il y a 5 min"), `aria-live="polite"` pour les nouveaux messages, indicateur de typing `tk-typing` keyframes en bas si l'autre tape.
- **Given** `<StepIndicator steps={['Profil','KYC','Stripe','Service']} current={2}>`, **When** je le rends, **Then** je vois 4 étapes avec étape 1+2 ✅ (validées), étape 3 active (focus visible), étape 4 désactivée. Cohérent avec `pro-onboarding.jsx` du bundle.
- **Given** `<FileUpload accept="image/*,application/pdf" maxSize="10MB" multiple>`, **When** je drop des fichiers ou clique, **Then** preview visible, validation type + size, progress bar par fichier, error inline si refus, `aria-describedby` vers helper.
- **Given** chaque pattern, **When** je lance les tests Playwright + axe-core, **Then** parcours critiques passent sans violation accessibility (NFR54).

#### Story 0.6: Pattern Pretre scaffolding template in identity-svc + replication script

**As a** tech lead,
**I want** pattern Pretre Clean Architecture scaffolded in `identity-svc` as the canonical template + a replication script that copies the structure to the 9 other services,
**So that** all 10 services start with the exact same architecture without manual setup.

**Acceptance Criteria :**

- **Given** `apps/identity-svc/src/`, **When** je l'ouvre, **Then** je trouve la structure Pattern Pretre exacte : `domain/{model,ports,service,exception}`, `usecases/`, `infrastructure/{persistence/typeorm,messaging/nats,external,http/{controllers,dtos,guards},logger,config,exception,usecases-proxy}`.
- **Given** `apps/identity-svc/src/domain/`, **When** je le scanne, **Then** **aucun import** de `@nestjs/*`, `typeorm`, `stripe`, `axios`, ou tout autre dépendance externe (vérifié par `eslint-plugin-boundaries`).
- **Given** `apps/identity-svc/src/domain/ports/tokens.ts`, **When** je l'ouvre, **Then** je trouve les Symbol DI tokens nommés `SCREAMING_SNAKE_CASE` : `USER_PROFILE_REPOSITORY`, `KEYCLOAK_SYNC`, `EVENT_PUBLISHER`, etc.
- **Given** `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`, **When** je l'ouvre, **Then** je trouve un DynamicModule NestJS qui wire chaque port → implémentation concrete (TypeORM repos, Keycloak service, NATS publisher).
- **Given** un script `infra/scripts/replicate-pretre-structure.sh`, **When** je l'exécute avec `--target=catalog-svc`, **Then** la structure de dossiers est copiée vers `apps/catalog-svc/src/`, avec placeholders pour aggregates/ports/usecases (pas de logique métier copiée).
- **Given** je lance `pnpm test --filter=identity-svc`, **When** les tests s'exécutent, **Then** au moins 1 use case a un test unitaire qui mocke les ports (pas de testcontainer requis), démontrant la testabilité du pattern Pretre.
- **Given** une PR qui ajoute `import { Repository } from 'typeorm'` dans `apps/identity-svc/src/domain/`, **When** la CI tourne, **Then** le lint `eslint-plugin-boundaries` rejette la PR (violation de boundary domain → infrastructure).

#### Story 0.7: Setup @tukio/messaging (NATS JetStream + outbox/inbox helpers)

**As a** backend developer,
**I want** `@tukio/messaging` library with NATS JetStream wrapper, transactional outbox/inbox helpers, and correlation context propagation,
**So that** all backend services consume a unified messaging primitive with reliability guarantees.

**Acceptance Criteria :**

- **Given** `packages/messaging/src/`, **When** je l'ouvre, **Then** je trouve `nats-jetstream-client.ts` (wrapper `@horizon-republic/nestjs-jetstream`), `outbox-publisher.ts` (PG LISTEN/NOTIFY relay), `inbox-consumer.ts` (idempotence handler), `correlation-context.ts`, `event-versioning.ts`, `index.ts`.
- **Given** un service backend qui import `{ OutboxPublisher } from '@tukio/messaging'`, **When** il appelle `outbox.publish(event)` dans une transaction TypeORM, **Then** l'event est inséré dans la table `outbox` du service avec status `pending`, et le PG LISTEN/NOTIFY relay le publie dans NATS dès commit DB (ADR-007).
- **Given** un service consommateur, **When** il import `{ InboxConsumer } from '@tukio/messaging'`, **Then** chaque event reçu de NATS est dédupliqué via la table `inbox` (idempotence sur `eventId`).
- **Given** `correlation-context.ts`, **When** un service publie un event en consommant un autre event, **Then** le `correlationId` du source event est propagé automatiquement au `correlationId` du nouvel event publié (saga choréographée ADR-006).
- **Given** `event-versioning.ts`, **When** je publie un event v1 et un consumer attend v2, **Then** le helper de migration permet la coexistence v1/v2 sans break (cohérent ADR-011).
- **Given** un test chaos qui simule la perte de NATS pendant 30 s, **When** un service publie via outbox, **Then** les events restent en table outbox `pending`, et le relais reprend automatiquement quand NATS revient (fallback polling 30 s — NFR42).

#### Story 0.8: Setup @tukio/auth (backend) + @tukio/auth-client (frontend)

**As a** fullstack developer,
**I want** `@tukio/auth` with Keycloak JWT guards for backend + `@tukio/auth-client` with Keycloak adapter for frontend,
**So that** authentification est unifiée et cohérente entre les 10 services backend et les 4 apps frontend.

**Acceptance Criteria :**

- **Given** `packages/auth/src/` (backend), **When** je l'ouvre, **Then** je trouve `keycloak-jwt.guard.ts`, `roles.decorator.ts`, `roles.guard.ts`, `jwks-cache.service.ts` (cache 10 min — NFR11), `actor-resolver.ts`, `types/{Actor,Role}.ts`.
- **Given** un controller NestJS `@UseGuards(KeycloakJwtGuard) @Roles('admin-modo')`, **When** une requête arrive sans JWT, **Then** le guard renvoie 401 enveloppe REST (cohérent ADR-014).
- **Given** un controller `@UseGuards(KeycloakJwtGuard) @Roles('admin-super')`, **When** une requête arrive avec JWT du rôle `customer`, **Then** le guard renvoie 403 enveloppe REST avec `tukioCode: AUTH-FORBIDDEN-001`.
- **Given** `packages/auth-client/src/` (frontend), **When** je l'ouvre, **Then** je trouve `keycloak-client.ts`, `refresh-token-rotation.ts`, `cookie-manager.ts` (`Domain=.tukio.one`), hooks `useAuth`, `useRole`, `useRequireRole`, `useLogout`, `middleware-helpers.ts`.
- **Given** un app Next.js qui utilise `useAuth()`, **When** le user est connecté, **Then** le hook retourne `{ user, role, locale, isAuthenticated: true }`.
- **Given** un user non authentifié hitting `/customer/account/...`, **When** le `KeycloakAuthMiddleware` détecte absence de cookie `tukio-access-token`, **Then** il redirige vers `auth.tukio.one/realms/tukio/protocol/openid-connect/auth?...` avec `state=` pour redirect post-login.
- **Given** un user authentifié sur `tukio.one` (apex unifié, ADR-016), **When** il navigue vers `seller.tukio.one`, **Then** le cookie session Keycloak (`Domain=.tukio.one`, HttpOnly, Secure, SameSite=Lax) est partagé et il reste authentifié (NFR9).

#### Story 0.9: Setup @tukio/api-client + @tukio/i18n-client + @tukio/testing

**As a** developer,
**I want** `@tukio/api-client` (TanStack Query hooks + envelope handler), `@tukio/i18n-client` (next-intl shared config), `@tukio/testing` (testcontainers + chaos helpers + fixtures),
**So that** les 4 apps frontend ont des hooks API typés cohérents et les 10 backends ont une infra de test partagée.

**Acceptance Criteria :**

- **Given** `packages/api-client/src/`, **When** je l'ouvre, **Then** je trouve `client.ts` (axios instance), `envelope-handler.ts` (extract `data` from `SuccessEnvelope`, throw `ApiError` from `ErrorEnvelope`), `hooks/{catalog,booking,payment,messaging,review,identity,admin}/`, `types/{ApiError,QueryKeys}.ts`.
- **Given** un app frontend qui consomme `useBookingDetail({ id })`, **When** la query résout, **Then** elle retourne `data: BookingResponseDto` (le type `data` extrait de l'enveloppe), et en cas d'erreur, le `onError` reçoit `ApiError` typé avec `tukioCode`.
- **Given** `packages/i18n-client/src/`, **When** je l'ouvre, **Then** je trouve `config.ts` (locales `['fr', 'en']`, fallback `fr`), `middleware.ts` (next-intl middleware partagé), `formatters/{date,number,currency,relativeTime}.ts`, `hreflang.tsx`.
- **Given** une page Next.js qui utilise `<Hreflang locale="fr" alternates={[{locale:'en', href:'/en/...'}]} />`, **When** elle render, **Then** les balises `<link rel="alternate" hreflang="fr" href="..."/>` et `hreflang="en"` sont injectées dans `<head>` (cohérent NFR58).
- **Given** `packages/testing/src/`, **When** je l'ouvre, **Then** je trouve `testcontainers/{postgres,nats,redis,keycloak,meilisearch}.helper.ts`, `chaos/{nats-disconnect,db-failure,saga-partial-failure}.helper.ts`, `fixtures/{user,listing,booking,order,payment,review}.fixture.ts`.
- **Given** un test d'intégration `BookingTypeormRepository.integration-spec.ts`, **When** il appelle `await postgresHelper.start()`, **Then** un container Postgres éphémère démarre, les migrations sont jouées, et le test peut interagir avec une DB réelle.
- **Given** un test chaos saga, **When** il appelle `chaosHelper.simulateNatsDisconnect({ duration: 30s })`, **Then** NATS est déconnecté pendant 30 s puis reconnecté, et le test vérifie que la saga reprend correctement (NFR46).

#### Story 0.10: Docker Compose dev local complet + scripts bootstrap

**As a** developer,
**I want** un Docker Compose complet pour le dev local (Postgres × 10 DBs, NATS, Keycloak, Meilisearch, Redis, MailHog) + des scripts de bootstrap (Keycloak realm, DB création, seed catégories),
**So that** un nouveau dev a un environnement complet en moins de 5 minutes après `git clone`.

**Acceptance Criteria :**

- **Given** un dev qui clone le repo, **When** il lance `pnpm docker:up`, **Then** Docker Compose démarre : 1 Postgres avec 10 databases logiques (`tukio_identity`, `tukio_catalog`, `tukio_booking`, `tukio_order`, `tukio_payment`, `tukio_messaging`, `tukio_review`, `tukio_notification`, `tukio_media`, `tukio_meta`), 1 NATS JetStream, 1 Keycloak (admin/admin), 1 Meilisearch, 1 Redis, 1 MailHog (`localhost:8025`).
- **Given** le stack démarré, **When** je lance `infra/scripts/bootstrap-keycloak-realm.sh`, **Then** le realm `tukio` est provisionné dans Keycloak avec 4 clients (`tukio-web`, `tukio-admin`, `tukio-api`, `tukio-mobile`) et 5 rôles (`client`, `pro`, `admin-support`, `admin-modo`, `admin-super`).
- **Given** le stack démarré, **When** je lance `infra/scripts/bootstrap-databases.sh`, **Then** les 10 databases sont créées + les migrations TypeORM jouées sur chacune (table `outbox`, `inbox`, `<entity>` initiales).
- **Given** le stack démarré, **When** je lance `infra/scripts/seed-categories.ts`, **Then** les 2 catégories pilotes MVP (tentes/chapiteaux + mobilier événementiel) sont seedées dans `tukio_catalog` avec leurs sous-catégories et types.
- **Given** un dev qui lance `pnpm dev`, **When** Turborepo démarre tous les apps + services, **Then** je peux ouvrir `http://localhost:3000` (apps/public), `http://localhost:3001` (customer), `http://localhost:3002` (seller), `http://localhost:3003` (admin), et chaque service backend répond sur son port (gateway-api 4000, identity-svc 4001, etc.).
- **Given** un email transactionnel envoyé par un service backend en local, **When** il passe par Resend simulé, **Then** je le vois dans MailHog (`localhost:8025`) sans avoir besoin de Resend prod credentials.

#### Story 0.11: CI GitHub Actions pipeline (lint + typecheck + tests affected + Lighthouse 4 apps)

**As a** tech lead,
**I want** CI GitHub Actions configurées avec lint, typecheck, tests affected (Turborepo), Lighthouse CI sur les 4 apps frontend, et scan dépendances Dependabot,
**So that** chaque PR est validée automatiquement avant merge sur `main`.

**Acceptance Criteria :**

- **Given** une PR qui modifie `apps/customer/`, **When** la CI tourne, **Then** seuls les jobs affected (Turborepo `--filter=...[origin/main]`) s'exécutent : lint apps/customer, typecheck apps/customer, tests Vitest apps/customer, Lighthouse CI apps/customer.
- **Given** une PR qui ajoute un texte hardcoded `<button>Reserver</button>` dans une page, **When** la CI tourne, **Then** le lint custom `tukio/no-hardcoded-text` rejette la PR (violation NFR56 — utiliser `useTranslations()`).
- **Given** une PR qui ajoute un path URL `/categorie/...` (FR), **When** la CI tourne, **Then** le lint custom `tukio/no-fr-paths` rejette la PR (NFR58 paths EN obligatoires).
- **Given** une PR qui ajoute une image sans `alt=""`, **When** la CI tourne, **Then** le lint accessibility rejette la PR (NFR50).
- **Given** une PR mergée sur `main`, **When** GitHub Actions trigger `build-images.yml`, **Then** Docker images sont buildées pour les 10 services et pushées sur `ghcr.io/<org>/tukio/<service>:latest`.
- **Given** Lighthouse CI tourne sur la home `apps/public/`, **When** les Core Web Vitals sont mesurés, **Then** LCP < 2,5 s, INP < 200 ms, CLS < 0,1, et score Accessibility ≥ 90 (NFR54). Sinon CI bloque la PR.
- **Given** Dependabot configuré, **When** une CVE critique est détectée sur un package, **Then** une PR auto est créée pour bumper la version, et la CI bloque le merge si la CVE n'est pas patchable (NFR18).

#### Story 0.12: Helm charts K8s + ArgoCD staging deployment + observability stack

**As a** DevOps / tech lead,
**I want** Helm charts pour les 3 unités de déploiement MVP (`core-api`, `workers`, `nats-cluster`) + config ArgoCD GitOps + stack observability (OpenTelemetry + Prometheus + Tempo + Loki + Grafana Cloud),
**So that** chaque merge sur `main` déploie automatiquement en staging Hetzner avec monitoring complet.

**Acceptance Criteria :**

- **Given** `infra/k8s/helm-charts/`, **When** je l'ouvre, **Then** je trouve 3 charts : `core-api/` (gateway + identity + catalog + booking + order + payment), `workers/` (messaging + review + notification + media), `nats-cluster/` (NATS R3 replicas), avec `values-{dev,staging,production}.yaml`.
- **Given** un déploiement staging, **When** ArgoCD sync, **Then** les 3 unités sont déployées sur le cluster Hetzner staging, avec HPA (CPU 70 %), PDB (min 1 pod), NetworkPolicy (deny-all + whitelist explicite par namespace), endpoints `/health`, `/ready`, `/metrics` exposés (NFR84).
- **Given** un service down depuis 30 s en staging, **When** Kubernetes liveness probe échoue, **Then** le pod est restart automatiquement, sans page utilisateur.
- **Given** OpenTelemetry agents configurés dans les 10 services, **When** une requête arrive sur gateway-api, **Then** un span est créé avec `correlationId` propagé, exporté vers Tempo (Grafana Cloud), visible dans le dashboard "Saga booking-payment" (R11 monitoring).
- **Given** un saga booking-payment bloquée > 5 min, **When** Prometheus alerte, **Then** un message Slack arrive sur `#tukio-alerts` (NFR43).
- **Given** Neon Postgres connecté, **When** un service commit une transaction, **Then** WAL archiving streame vers Neon (RPO < 5 min, RTO < 1 h — NFR44).
- **Given** Cloudflare R2 bucket configured, **When** `media-svc` upload une pièce d'identité KYC, **Then** server-side encryption R2 active (NFR15), versioning 15 jours.

#### Story 0.13: Initialize 14 ADRs in docs/adr/ + Vercel multi-zones config + schema acquisition_*

**As a** tech lead,
**I want** les 14 ADRs documentés dans `docs/adr/0001-*.md` à `0014-*.md` + config Vercel multi-zones + migration schema `acquisition_*` sur `users` et `bookings`,
**So that** les conventions architecturales sont source of truth, les 4 apps composent sous tukio.one, et le tracking acquisition est câblé dès le 1er user.

**Acceptance Criteria :**

- **Given** `docs/adr/`, **When** je l'ouvre, **Then** je trouve 14 ADRs au format ADR standard (Status / Context / Decision / Consequences) : `0001-pretre-clean-architecture.md`, `0002-nats-jetstream.md`, `0003-database-per-service.md`, `0004-booking-order-split.md`, `0005-meilisearch-mvp.md`, `0006-saga-choreographed.md`, `0007-outbox-pattern.md`, `0008-gateway-api-public-only.md`, `0009-keycloak-identity-svc-split.md`, `0010-typeorm-default-raw-sql-readheavy.md`, `0011-tukio-contracts-package.md`, `0012-i18n-fr-en-sprint-zero.md`, `0013-frontend-multi-zones-feature-based.md`, `0014-api-response-envelope.md`, + `template.md` pour les futurs ADRs.
- **Given** `apps/public/next.config.ts` (post Story 0.14 / ADR-016), **When** je l'ouvre, **Then** je trouve un rewrite résiduel uniquement vers `seller.tukio.one` (les routes `/account` et `/cart` sont servies localement par le route group `(authenticated)`) :
  ```ts
  rewrites: [
    { source: '/:locale/seller/:path*', destination: 'https://seller.tukio.one/:locale/seller/:path*' },
  ]
  ```
- **Given** un user connecté sur `tukio.one/fr/`, **When** il clique un lien vers `/fr/account/bookings`, **Then** la route est servie par `apps/public` localement (pas de rewrite cross-zone), le cookie session Keycloak est lu sur le même domain, et le user reste authentifié.
- **Given** la migration TypeORM dans `identity-svc/migrations/`, **When** je l'exécute, **Then** les colonnes suivantes sont ajoutées sur `users` ET sur `bookings` (table dans `booking-svc`) : `acquisition_source` (TEXT, ENUM `'organic' | 'google_ads' | 'meta_ads' | 'referral' | 'direct' | 'partner'`), `acquisition_medium` (TEXT), `acquisition_campaign` (TEXT), `acquisition_referral_id` (TEXT NULL), `acquisition_first_touch` (TIMESTAMPTZ), `acquisition_last_touch` (TIMESTAMPTZ).
- **Given** un Visitor arrive sur `tukio.one/fr/?utm_source=google_ads&utm_campaign=spring2026`, **When** il s'inscrit en tant que customer, **Then** son user record en DB a `acquisition_source = 'google_ads'`, `acquisition_campaign = 'spring2026'` (NFR64 — impossible à rétro-fitter sans perte).
- **Given** la story est complétée, **When** je vérifie l'état Sprint 0, **Then** : 14 ADRs documentés ✅, Vercel multi-zones configuré ✅, schema acquisition_* migré ✅, et le projet est **prêt à recevoir les stories user-facing Epic 1+**.

**Epic 0 — Total stories Sprint 0 foundation : 14** (0.1-0.14)

---

### Epic 0 — Phase Pré-Lancement (Stories 0.15 → 0.20)

> 🚀 **Ajouté 2026-05-20** suite au constat que tukio.one doit être en ligne avant le lancement officiel (~6 mois de dev restants). Objectif : ne pas laisser le domaine vide, capter les emails des pros intéressés, et présenter le projet de manière crédible. **Toggle manuel via env var `NEXT_PUBLIC_COMING_SOON_MODE=true`** — pas de back-office, suppression du flag = un PR au moment du lancement. Source design : `tukio-design/project/screens/{coming-soon.jsx,public-pages.jsx}` (extraction tar du bundle Claude Design, 6 écrans complets avec texte FR verbatim).

**Phase** : Pre-MVP (intercalée entre Sprint 0 close-out et Epic 1 close-out)
**Outcome utilisateur** : un Visitor (curieux grand public ou pro de l'événementiel) qui tape `tukio.one` voit une landing "Coming Soon" éditoriale + un formulaire de capture d'email RGPD-conforme. Un pro qui veut comprendre comment la plateforme va fonctionner trouve une page "Devenir pro" très détaillée (parcours d'inscription, modèle commission 10 %, paiements Stripe Connect, métiers acceptés). Privacy / Mentions légales / Contact existent pour la conformité dès J0 de la collecte d'email.

**FRs covered (anticipation)** : FR112 (acceptMarketing — partiel pre-lancement)
**NFRs covered** : NFR1 (RGPD), NFR21 (LCEN — site vitrine), NFR50/54 (a11y RGAA AA), NFR58 (i18n FR+EN), NFR67 (env-driven config)
**ADRs touchés** : ADR-012 (i18n bilingue), ADR-016 (apex unified — Story 0.14 baseline)
**Intégrations externes** : Resend Audiences API (capture email RGPD EU)

**Réversibilité (critère acceptance global)** : à la date du lancement officiel, désactiver le mode coming soon doit se résumer à :
1. `NEXT_PUBLIC_COMING_SOON_MODE=false` dans `.env.production`
2. Redeploy production (`git tag v…` → CI)
3. Suppression du middleware `coming-soon-gate.ts` et du flag dans une PR de nettoyage post-lancement (optionnelle, l'app fonctionne avec le flag à `false`).
Aucune migration DB, aucun backoffice, aucun feature flag tiers.

**Stories** : 0.15 (toggle infra + middleware) · 0.16 (design system atoms manquants) · 0.17 (landing Coming Soon apex) · 0.18 (landing Devenir Pro seller) · 0.19 (4 pages publiques : About + Privacy + Legal + Contact) · 0.20 (Resend Audiences integration + form handlers)

#### Story 0.15: Toggle infra `NEXT_PUBLIC_COMING_SOON_MODE` + middleware `coming-soon-gate` apex/seller

**As a** tech lead,
**I want** un flag build-time `NEXT_PUBLIC_COMING_SOON_MODE` (`true` | `false`) lu par un middleware `coming-soon-gate.ts` qui réécrit toutes les routes hors whitelist vers les landings Coming Soon (Story 0.17 pour apex, Story 0.18 pour seller),
**So that** je peux mettre tukio.one + seller.tukio.one en mode "vitrine pré-lancement" sans toucher au reste du code Epic 1+ déjà en cours, et désactiver en un redeploy au moment du lancement.

**Acceptance Criteria :**

- **Given** `apps/public/.env.example` + `apps/seller/.env.example`, **When** je les ouvre, **Then** je trouve la variable `NEXT_PUBLIC_COMING_SOON_MODE=true` avec un commentaire `# Pre-launch mode. Set to 'false' to expose the real app (Epic 1+).` Lecture via `process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'` strict (toute autre valeur → mode OFF).
- **Given** `apps/public/src/middleware.ts`, **When** la chaîne middleware exécute, **Then** un nouveau wrapper `comingSoonGateMiddleware` est inséré **AVANT** `acquisitionCookieMiddleware` et `i18nMiddleware`. Le wrapper : (1) si flag OFF → `NextResponse.next()`, (2) si flag ON → vérifie la pathname contre une whitelist + redirige tout le reste vers `/${locale}/coming-soon` (rewrite, pas redirect — préserve l'URL d'origine en SSR pour analytics).
- **Given** la whitelist routes (flag ON), **When** une request arrive, **Then** sont autorisées sans rewrite : `/_next/*`, `/api/*`, `/${locale}/coming-soon`, `/${locale}/coming-soon/success`, `/${locale}/devenir-pro` (apex uniquement — la landing pro vit sur apex), `/${locale}/a-propos`, `/${locale}/confidentialite`, `/${locale}/mentions-legales`, `/${locale}/contact`, `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, `/og-image.*`, `/.well-known/*`, `/assets/*`. Toute autre route hors whitelist → rewrite vers `/${locale}/coming-soon`.
- **Given** `apps/seller/src/middleware.ts`, **When** la chaîne exécute, **Then** `comingSoonGateMiddleware` est inséré avant `pendingAdminReviewRedirect`. Si flag ON sur seller, **toute** route `/seller/*` est rewrite vers `/${locale}/seller-coming-soon` (landing pro Story 0.18), sauf `/api/*` et `/_next/*`. Whitelist seller : `/${locale}/seller-coming-soon`, `/${locale}/seller-coming-soon/success`, et idem assets.
- **Given** un test Playwright `coming-soon-gate.e2e-spec.ts` (apex et seller), **When** je set `NEXT_PUBLIC_COMING_SOON_MODE=true` au build, **Then** : (a) `GET /fr/` → 200 mais rend la landing Coming Soon, (b) `GET /fr/auth/sign-up` → idem rewrite landing (l'URL reste `/fr/auth/sign-up` côté browser mais le contenu est la landing), (c) `GET /fr/a-propos` → 200 page About réelle, (d) `GET /robots.txt` → 200 (whitelist).
- **Given** flag OFF (`NEXT_PUBLIC_COMING_SOON_MODE=false`), **When** je rerun les Playwright, **Then** toutes les routes Epic 1+ fonctionnent normalement (Story 1.2d sign-up etc.) — preuve de réversibilité.
- **Given** unit tests `coming-soon-gate.spec.ts` (vitest), **When** ils tournent, **Then** ≥ 90% coverage sur la logique pure de matching whitelist (apex + seller) — pattern Story 1.3d `pending-admin-review-decision.spec.ts` réutilisé.
- **Given** le robots.txt en mode coming soon (Story 0.20 sub-task), **When** Googlebot crawle, **Then** la directive `Allow: /` reste active mais avec un sitemap pointant uniquement vers les pages publiques (pas vers `/auth/sign-up` etc.) — éviter d'indexer des pages 404-équivalentes.
- **Given** la NFR67 (env-driven config), **When** un dev clone le repo, **Then** par défaut le flag est OFF en dev local (`.env.local` shipped avec `false`) pour que le dev Epic 1+ continue normalement — seul `.env.production` (committed `.env.example` mais override via DO Droplet secrets) a le flag à ON.

#### Story 0.16: Design system atoms `@tukio/ui` requis par Coming Soon + Pages publiques

**As a** frontend dev,
**I want** les composants atoms et patterns manquants ajoutés à `@tukio/ui` (`Kicker`, `SiteHeader`, `LogoMark`, `IconSet` étendu, `PublicFooter`, `EditorialPageShell`, `Block`, `Pill` animé),
**So that** les stories 0.17/0.18/0.19 consomment les atoms via subpath imports sans dupliquer le code dans chaque app.

**Acceptance Criteria :**

- **Given** `packages/ui/src/components/`, **When** je l'ouvre, **Then** je trouve les NEW atoms : `Kicker/Kicker.tsx` (label uppercase mono, prop `color`, letter-spacing 0.04em, font-size 11-12px), `LogoMark/LogoMark.tsx` (logo Tukio SVG avec prop `size` number, default 22), `Pill/Pill.tsx` (rounded full pill avec optional `pulseDot` animation `tk-pulse 2s infinite`), `IconSet` étendu avec 14 icons utilisés dans le design : `arrow`, `shield`, `bolt`, `check`, `card`, `message`, `calendar`, `chart`, `doc`, `user`, `tent`, `package`, `flame`, `sparkle` (lucide-react underlying).
- **Given** `packages/ui/src/patterns/`, **When** je l'ouvre, **Then** je trouve les NEW patterns : `SiteHeader/SiteHeader.tsx` (props `active?: 'pros' | 'about' | 'contact'`, slots logo + nav links avec hover state — version "site publique" différente du Story 1.4d header authentifié), `PublicFooter/PublicFooter.tsx` (footer "© tukio.one · 2026 · Made in Loire-Atlantique" + 3 slots links + style cream-200 border-top), `EditorialPageShell/EditorialPageShell.tsx` (props `kicker`, `title` (React node pour italic accent), `intro?`, `maxWidth` default 880 ; layout cream-50 + padding 72-96px desktop + responsive), `Block/Block.tsx` (titre h2 Fraunces 24px + slot children).
- **Given** chaque NEW atom/pattern, **When** je l'inspecte, **Then** : (1) zero hardcoded color — tokens `var(--brand-*)`, `var(--cream-*)`, `var(--charcoal-*)` via Tailwind v4 `@theme` Story 0.3, (2) zero hardcoded text (props pour tout texte user-facing — i18n FR/EN consumer-side), (3) spec `.spec.tsx` Vitest + Testing Library couvre ≥ 80% (atoms) / ≥ 70% (patterns), (4) Storybook MDX ou JSDoc avec example minimal — Sprint 0 pattern.
- **Given** la règle de barrel imports (AGENTS.md), **When** un consumer importe, **Then** il utilise subpath strict `import { Kicker } from '@tukio/ui/components/Kicker'` — la règle `tukio/no-barrel-import-ui` doit passer.
- **Given** l'animation `tk-pulse`, **When** elle est définie, **Then** elle vit dans `packages/ui/src/styles/animations.css` (ou tokens TS si pattern Story 0.3) + respect `prefers-reduced-motion` (animation disabled si user opt-out).
- **Given** axe-core a11y test sur chaque pattern, **When** il tourne, **Then** 0 violations — `SiteHeader` a `role="banner"`, `PublicFooter` a `role="contentinfo"`, `Pill` (decorative pulse) `aria-hidden="true"` sur le dot.
- **Given** le SVG Logo Tukio, **When** il est rendu, **Then** il est inline SVG (pas `<img>`), couleurs paramétrables via `currentColor`, `aria-label="Tukio"` si standalone, `aria-hidden="true"` si à côté d'un title.
- **Given** la NFR58 i18n, **When** un atom expose du texte (ex: alt logo), **Then** la prop est typée `string` injectable — pas de `'Tukio'` hardcodé en interne.

#### Story 0.17: Landing Coming Soon apex tukio.one (`/${locale}/coming-soon` + success state)

**As a** Visitor (grand public curieux ou pro événementiel),
**I want** atterrir sur une landing éditoriale chaleureuse avec un formulaire de capture d'email (prénom, nom, email, profil organisateur/pro, RGPD opt-in),
**So that** je peux laisser mes coordonnées pour être prévenu·e à l'ouverture, et avoir une idée claire de ce qu'est tukio.one.

**Acceptance Criteria :**

- **Given** `apps/public/src/app/[locale]/coming-soon/page.tsx`, **When** je l'ouvre, **Then** la page rend la landing 2-colonnes (split desktop, stacked mobile) **strictement conforme** au design `tukio-design/project/screens/coming-soon.jsx:5-183` :
  - **Header** : `<LogoMark size={22}>` + badge mono uppercase "Bientôt en Pays de la Loire"
  - **Colonne gauche éditoriale** (background cream-50) : `<Pill pulseDot>En construction</Pill>` brand-50/brand-700 + H1 Fraunces 64px "Vos événements, *réservés.*" (italic brand-600) + pitch + sub-pitch + **trust strip 3 stats** ("140+ Pros déjà inscrits" / "44 · 49 Lancement pilote" / "0 € Inscription")
  - **Colonne droite formulaire** (background cream-100, border-left cream-200) : `<Kicker>Rester informé·e</Kicker>` + H2 32px "Soyez parmi les *premiers*." + form 5 fields (Prénom + Nom 2-col, Email, Role radio cards Organisateur/Professionnel, RGPD opt-in checkbox + lien Privacy) + CTA primary "Me prévenir à l'ouverture" + reassurance icon shield "Vos données restent en France, jamais revendues"
  - **Footer** `<PublicFooter>` : "© tukio.one · 2026 · Made in Loire-Atlantique" + links "Devenir pro pilote" → `/${locale}/devenir-pro` + "Mentions légales" → `/${locale}/mentions-legales` + "contact@tukio.one" → `mailto:`
- **Given** le form, **When** soumis avec données invalides, **Then** validation inline RHF + zodResolver (pattern Story 1.2d) : email required + format RFC 5322, prénom + nom required (1-80 chars trim), role required (default `organisateur`), RGPD opt-in **required** (literal true). Erreurs in-line `<FormField>` Story 0.4 atom.
- **Given** le form soumis valide, **When** il POST, **Then** appel `useSubmitPreLaunchSignup()` hook `@tukio/api-client/hooks/pre-launch` (Story 0.20) → en cas de success `router.push('/${locale}/coming-soon/success')` avec `firstName` + `position` (e.g., 247ᵉ) en query params (ou via state via session storage si on veut éviter l'exposition URL).
- **Given** `apps/public/src/app/[locale]/coming-soon/success/page.tsx`, **When** je l'ouvre, **Then** rend l'écran success `coming-soon.jsx:186-241` : cercle success 80px + check icon + Kicker "C'est noté" + H1 "À très bientôt, *{firstName}.*" + "Vous êtes la **{position}ᵉ personne** sur la liste. On vous écrit dès l'ouverture, pas avant." + bloc "En attendant…" parrainage (CTA "Parrainez-le →" → mailto: ou modal Story V1+).
- **Given** i18n FR+EN (ADR-012), **When** je switch locale via `?lang=en` ou `/en/coming-soon`, **Then** **tous les textes** sont traduits FR/EN via next-intl namespace `coming_soon` (~25 keys × 2 locales). Stratégie de traduction EN : traduction professionnelle ou GPT-4 review humaine pour ne pas avoir d'EN "robotisé" — le ton chaleureux/italic de la version FR doit ressortir.
- **Given** le SEO, **When** Googlebot crawle `/fr/coming-soon` ou `/en/coming-soon`, **Then** : (1) `<title>` = "tukio.one — Bientôt en Pays de la Loire" (FR) / "tukio.one — Coming Soon in Pays de la Loire" (EN), (2) `<meta description>` ≤ 160 chars, (3) Open Graph `og:title`, `og:description`, `og:image` (1200×630 SVG/PNG brand+pitch), (4) `<link rel="canonical">` correct, (5) hreflang FR/EN propre.
- **Given** la NFR50/54 a11y RGAA AA, **When** axe-core run sur les 2 pages, **Then** 0 violations. Skip-link "Aller au formulaire" focusable. Le pulse `tk-pulse` désactivé `prefers-reduced-motion`. Tous les inputs ont label associé `htmlFor`. Le H1 italic est lisible par lecteur d'écran (pas de span décoratif aria-hidden qui casse le sens).
- **Given** Lighthouse desktop, **When** je lance audit, **Then** ≥ 95 perf, ≥ 95 a11y, ≥ 100 SEO, ≥ 100 best practices (image WebP + fonts preload + zero JS bloquant sur la landing → 99 % SSG/SSR).
- **Given** Playwright e2e `coming-soon.e2e-spec.ts`, **When** je lance, **Then** 8 cases verts : (1) load page FR + check H1 visible + form rendered, (2) load page EN + check H1 traduit, (3) submit avec form vide → 5 erreurs inline visibles, (4) submit avec email invalide → erreur inline, (5) submit valide → redirect /coming-soon/success + firstName visible, (6) toggle role radio Organisateur ↔ Professionnel → visuel change, (7) click "politique de confidentialité" → navigate `/confidentialite`, (8) axe-core sur les 2 pages → 0 violations.

#### Story 0.18: Landing "Devenir pro" sur seller.tukio.one (`/${locale}/seller-coming-soon`)

**As a** professionnel de l'événementiel,
**I want** atterrir sur une page détaillée qui explique précisément comment tukio.one va fonctionner pour moi (parcours d'inscription, commission 10 %, paiement Stripe Connect, métiers acceptés, documents requis),
**So that** je comprends le modèle, je peux décider si je m'inscris à la liste d'attente, et la plateforme me semble crédible et professionnelle.

**Acceptance Criteria :**

- **Given** `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx`, **When** je l'ouvre, **Then** la page rend la landing détaillée **strictement conforme** au design `tukio-design/project/screens/public-pages.jsx:114-397` (fonction `BecomeProScreen`) :
  - **Hero 2-col** (split desktop) : Kicker "Pour les professionnels" + H1 60px "Comment fonctionne tukio.one *pour les pros*." + pitch + **banner brand-50** "tukio.one n'est pas encore ouverte" avec icône bolt + CTA "Soyez prévenu·e en priorité" → lien vers Story 0.17 landing apex `/coming-soon` cross-zone (`window.location.href`)
  - **Section "Pour qui"** : 6 cards métiers (Tentes/Mobilier/Traiteur/Décoration/Son&lumière/Animation) — grille 3-col desktop, 2-col tablet, 1-col mobile
  - **Section "Le parcours pro"** (background cream-100) : 5-step horizontal cards numérotés (Inscription / Demande pro / Validation 24-48h / Compte Stripe / Mise en ligne)
  - **Section "Ce qu'il faut prévoir"** : 2 cards (docs demande pro + docs compte de paiement)
  - **Section sombre "Paiements et reversements"** (background charcoal-800, text cream-50) : pipeline 4-step (paiement → fonds sécurisés Stripe → prestation → reversement J+1 à J+3) + 2 cards modes (cartes/Apple Pay/SEPA/échelonné + virement bancaire/délai/tracking/justifs) + bloc Stripe Connect partner ("Stripe gère les paiements, pas tukio")
  - **Section "Tarification"** : 3 cards "0 € Inscription / 10 % Commission / J+1 Reversement" + paragraphe formules d'abonnement V1+
  - **Section "Pourquoi nous rejoindre"** (background cream-100) : 6 cards (paiement / confiance / communication / calendrier / stats / administratif)
  - **CTA final** : Kicker "En préparation" + H2 "La plateforme ouvre bientôt." + 2 CTAs ("Être prévenu·e à l'ouverture" primary cross-zone vers apex + "Une question ? Nous écrire" tertiary vers `/${locale}/contact`)
- **Given** le CTA primary "Être prévenu·e à l'ouverture", **When** un pro clique, **Then** redirect cross-zone `window.location.assign('https://tukio.one/${locale}/coming-soon?role=pro')` — le query `?role=pro` pré-coche le role "Professionnel" sur la landing apex Story 0.17 (Story 0.17 lit ce query au mount).
- **Given** la NFR58 i18n FR+EN, **When** je switch locale, **Then** **tous les textes** (~90 strings : 6 cards métiers + 5 steps + 8 docs lines + 8 paiement lines + 6 pourquoi cards + textes statiques) sont traduits via namespace `seller_coming_soon` (~90 keys × 2 locales).
- **Given** SEO, **When** Googlebot crawle, **Then** title "tukio.one pour les pros — Pays de la Loire" + meta description + Open Graph + canonical + hreflang. **Indexabilité** : `<meta name="robots" content="index, follow">` (cette page sert aussi à présenter le modèle pour SEO acquisition pro).
- **Given** axe-core a11y RGAA AA, **When** il tourne, **Then** 0 violations. Section sombre charcoal-800 → ratio contraste vérifié sur tous les textes cream-50 / cream-200 (AAA si possible).
- **Given** Lighthouse, **When** je lance audit, **Then** ≥ 90 perf (longue page, donc tolérance), ≥ 95 a11y, ≥ 100 SEO, ≥ 95 best practices.
- **Given** Playwright `seller-coming-soon.e2e-spec.ts`, **When** je lance, **Then** 6 cases : load FR/EN + scroll-to-section anchors + CTA cross-zone (intercept `window.location`) + content sections présentes + axe-core + Lighthouse perf.

#### Story 0.19: 4 pages publiques (À propos / Confidentialité / Mentions légales / Contact)

**As a** Visitor (curieux, journaliste, autorité de contrôle),
**I want** accéder aux pages institutionnelles minimales dès la phase pré-lancement (À propos, Confidentialité, Mentions légales, Contact),
**So that** le projet est crédible et conforme RGPD/LCEN dès la première capture d'email.

**Acceptance Criteria :**

- **Given** `apps/public/src/app/[locale]/a-propos/page.tsx`, **When** je l'ouvre, **Then** rend `AboutScreen` (`tukio-design/project/screens/public-pages.jsx:31-110`) : `<EditorialPageShell>` Story 0.16 + Kicker "À propos" + H1 "Une plateforme, *un événement*" + intro + **5 blocks** (Pourquoi tukio.one / Ce que la plateforme propose 4 cards / Comparaison "Sans tukio.one" vs "Avec tukio.one" 2-col / Ancré en Pays de la Loire / Notre engagement 4 commitments).
- **Given** `apps/public/src/app/[locale]/confidentialite/page.tsx`, **When** je l'ouvre, **Then** rend `PrivacyPolicyScreen` (`public-pages.jsx:400-456`) : Kicker "Politique de confidentialité" + H1 "Vos données, *en clair*." + intro + date "Dernière mise à jour : 20 mai 2026" + banner brand-50 "En phase de pré-lancement" + **8 blocks** strict spec design (qui collecte / ce qu'on collecte / pourquoi / rétention 12 mois / après lancement / vos droits / hébergement Vercel+Resend / réclamation CNIL).
- **Given** `apps/public/src/app/[locale]/mentions-legales/page.tsx`, **When** je l'ouvre, **Then** rend `LegalScreen` (`public-pages.jsx:459-518`) : Kicker "Mentions légales" + H1 "Un projet *en préparation*." + intro + date + banner brand-50 "Statut du projet" + **6 blocks** (responsable / société en cours SAS RCS Nantes / hébergement Vercel / nature actuelle LCEN / propriété intellectuelle / contact).
- **Given** `apps/public/src/app/[locale]/contact/page.tsx`, **When** je l'ouvre, **Then** rend `ContactScreen` (`public-pages.jsx:521-619`) : Kicker "Contact" + H1 "On *vous écoute*." + intro + **form 2-col** :
  - **Form left** (`<Card>` padding 32) : 7 fields (Prénom + Nom 2-col, Email, Vous êtes select 5 options [Organisateur / Pro événementiel / Journaliste presse / Partenaire potentiel / Autre], Sujet select 5 options [Question générale / Devenir pro / Problème technique / Partenariat / Presse], Message textarea rows=6, CTA "Envoyer") + note "Vos données traitées conformément… Réponse sous 48h ouvrées."
  - **Aside right** : 4 cards canaux directs (contact@tukio.one support 48h / dpo@tukio.one RGPD / signalement@tukio.one urgences / presse@tukio.one) + card "En phase de préparation" (cream-100)
- **Given** le form Contact submission, **When** un visiteur submit, **Then** appel `useSubmitPreLaunchContact()` hook (Story 0.20) → POST vers Resend ou direct mailto: fallback (décision Story 0.20). En cas de success → toast "Message envoyé, réponse sous 48h" + reset form. En cas d'erreur → toast erreur.
- **Given** **chaque page** publique, **When** elle render, **Then** elle utilise `<EditorialPageShell>` + `<Block>` Story 0.16 (pas de duplication HTML cross-pages), `<SiteHeader>` + `<PublicFooter>` partagés. Spec design : font Fraunces 52px titres + Inter 17px intro + 15px body + line-height 1.6-1.7.
- **Given** i18n FR+EN, **When** je switch, **Then** **les 4 pages** sont traduites — namespaces `about` / `privacy` / `legal` / `contact` (~140 keys × 2 locales totale ~ 280 keys). **Note importante** : les pages Confidentialité et Mentions légales sont des **textes juridiques** — la traduction EN doit être validée juridiquement (ou bien afficher un badge "Available in French only" UX-DR16 si pas traduit, mais préférer la traduction pour crédibilité).
- **Given** SEO, **When** Googlebot crawle, **Then** chaque page a son title + meta description spécifique + canonical + hreflang FR/EN + Open Graph propre. **Indexabilité** : `index, follow` sur les 4 pages.
- **Given** axe-core a11y RGAA AA, **When** je teste les 4 pages, **Then** 0 violations. Form Contact : tous les `select` ont label associé, `textarea` accessible name, CTA `aria-label` complet, validation errors `aria-live="polite"`.
- **Given** Playwright `public-pages.e2e-spec.ts`, **When** je lance, **Then** ≥ 12 cases : 4 pages × (load FR + load EN + navigation depuis Footer + axe-core).

#### Story 0.20: Resend Audiences integration + form handlers (`POST /api/pre-launch/{signup,contact}`)

**As a** founder (Ismael),
**I want** les emails capturés via les formulaires des Stories 0.17 et 0.19 stockés dans une Resend Audience EU (RGPD-compliant, jamais transitant par notre DB),
**So that** au moment du lancement je peux exporter la liste vers Brevo (Epic 16.2) et envoyer un email de notification one-shot, sans avoir à déployer un service backend dédié maintenant.

**Acceptance Criteria :**

- **Given** un compte Resend setup (free tier 3 000 emails/mois suffit MVP), **When** je vais sur dashboard Resend, **Then** je crée 2 audiences EU : `tukio-pre-launch-waitlist` (depuis Story 0.17 form) avec custom fields `firstName`, `lastName`, `role` (`organisateur` | `professionnel`), `locale` (`fr` | `en`), `acquisitionSource`, `acquisitionCampaign` ; et **optionnellement** `tukio-pre-launch-contacts` (depuis Story 0.19 contact form si Resend Audiences supporte les contacts sans opt-in marketing — sinon stocker dans Linear/Notion/Slack via webhook). API key dédiée stockée dans secret Doppler/DO `RESEND_AUDIENCES_API_KEY`.
- **Given** `apps/public/src/app/api/pre-launch/signup/route.ts` (Next.js 16 Route Handler), **When** un POST arrive avec `{ firstName, lastName, email, role, locale, marketingOptIn: true }`, **Then** : (1) parse Zod schema (`PreLaunchSignupSchema`), (2) lit cookie `tukio-acq-first` (Story 0.13) pour `acquisitionSource` + `acquisitionCampaign`, (3) call `resend.contacts.create({ audienceId, email, firstName, lastName, unsubscribed: false, ...customFields })`, (4) compute position (= Resend Audience count post-insertion via `resend.contacts.list()` ou estimation + cache 5min Redis), (5) répond JSON `{ ok: true, position: 247 }` envelope simplifiée (pas Story 1.2c forwarder — c'est un edge case acceptable hors gateway-api, NE PAS ouvrir un endpoint identity-svc juste pour ça).
- **Given** Resend renvoie une erreur (conflict email déjà inscrit), **When** le handler catch, **Then** retourne `{ ok: true, position: <existing position>, alreadySubscribed: true }` — message UI "Vous êtes déjà inscrit, on vous écrit dès l'ouverture" (pas une erreur destructrice).
- **Given** Resend renvoie une erreur 5xx ou timeout, **When** le handler catch, **Then** retourne 502 + log Pino structuré + ne PAS crash la page user (UI affiche toast erreur "Service momentanément indisponible, réessayez dans quelques minutes"). Pas de retry automatique côté server (Resend SDK retry interne suffit).
- **Given** rate limiting anti-spam, **When** une IP fait > 5 submissions/min, **Then** retourne 429 avec `Retry-After` header (utilise edge `@upstash/ratelimit` OR Upstash Redis Story 0.x — alignement Story 1.2c throttler).
- **Given** `apps/public/src/app/api/pre-launch/contact/route.ts`, **When** un POST arrive depuis form Contact Story 0.19, **Then** : option A (recommandée) — envoie un email via Resend transactional API vers `contact@tukio.one` avec le contenu du form (Resend `from: "Tukio Form <noreply@tukio.one>"`, `to: ["contact@tukio.one"]`, `subject: "[Contact tukio.one] {sujet}"`, body templated). Option B (fallback) — store dans une Resend Audience `tukio-contacts` sans envoi auto, traiter manuellement.
- **Given** `packages/api-client/src/hooks/pre-launch/`, **When** je l'ouvre, **Then** 2 NEW hooks TanStack Query : `useSubmitPreLaunchSignup()` (POST `/api/pre-launch/signup`, retourne `{ data, error, isPending }`) + `useSubmitPreLaunchContact()` (idem `/api/pre-launch/contact`). Pattern réutilise Story 1.2c hooks pattern (mapZodError, ApiError class).
- **Given** la NFR1 (RGPD), **When** un user submit, **Then** : (1) double opt-in NON requis (consent unique via checkbox + texte "J'accepte de recevoir un email lors du lancement" — Resend gère son propre footer unsubscribe), (2) la déclaration CNIL n'est PAS nécessaire pour < 5 000 contacts B2B (CNIL note "registre obligatoire" mais pas déclaration), (3) la mention "Vos données restent en France" suppose que Resend Audience EU est conforme — VÉRIFIER dans le Resend dashboard que la région audience = `eu-west` ou `eu-central`.
- **Given** un test Playwright `pre-launch-handlers.e2e-spec.ts`, **When** je lance, **Then** 6 cases : (1) signup happy POST → mock Resend SDK retourne `{ id: 'cnt_xxx' }` → response `{ ok: true, position: N }`, (2) signup duplicate email → mock 409 → response `{ ok: true, alreadySubscribed: true }`, (3) signup invalid Zod → 422 + issues, (4) signup rate limit 6e essai en 60s → 429 + Retry-After, (5) contact handler success → resend.emails.send called avec bons params, (6) contact handler error → 502 graceful.
- **Given** la NFR82 audit, **When** un signup arrive, **Then** log Pino structuré `{ event: 'pre_launch_signup', email: '[REDACTED]', emailHash: sha256(email).slice(0,8), role, locale, acquisitionSource, correlationId, timestamp }` — **email pas en clair dans les logs**.
- **Given** un dev en local, **When** il submit le form en dev, **Then** Resend SDK passe par `RESEND_API_KEY=re_test_xxx` (test mode) qui n'envoie pas vraiment + dashboard Resend "Test Mode" visible — pas de pollution audience prod.
- **Given** robots.txt + sitemap au mode coming soon, **When** je vais sur `/robots.txt` apex, **Then** le fichier permet d'indexer `/`, `/coming-soon`, `/devenir-pro` (cross-zone : référence depuis apex vers seller via host `seller.tukio.one`), `/a-propos`, `/confidentialite`, `/mentions-legales`, `/contact`, et **bloque** explicitement `/api/*`, `/_next/*`. Sitemap dynamic Next.js 16 `app/sitemap.ts` génère les ~10 URLs principales × 2 locales avec `<lastmod>` + `<changefreq>weekly</changefreq>`.

#### Story 0.21: SEO foundation + Analytics pré-lancement (`robots.txt` + `sitemap.xml` + Open Graph + structured data JSON-LD + Plausible)

**As a** founder qui veut que la phase pré-lancement génère du trafic organique et de la confiance dès J0,
**I want** le SEO technique complet dès le pré-lancement (robots.txt strict, sitemap.xml dynamique multi-locale, Open Graph + Twitter Cards, structured data JSON-LD schema.org Organization, Plausible Analytics cookie-less RGPD) sur les 7 pages publiques (Stories 0.17-0.19),
**So that** Google/Bing peuvent indexer correctement les pages publiques dès J0, les partages réseaux sociaux ont un visuel propre, je peux mesurer le funnel "visite → submit waitlist" sans cookie banner, et les autorités (CNIL, France Num) trouvent le site crédible et conforme.

**Acceptance Criteria :**

- **Given** `apps/public/src/app/robots.ts` (Next.js 16 `MetadataRoute.Robots`), **When** Googlebot/Bingbot fetch `/robots.txt`, **Then** il reçoit :
  ```
  User-agent: *
  Allow: /
  Disallow: /api/
  Disallow: /_next/
  Disallow: /auth/
  Disallow: /(authenticated)/
  Disallow: /seller/onboarding/

  Sitemap: https://tukio.one/sitemap.xml
  ```
  Avec un commentaire de fichier disant "Pre-launch mode 2026 — most routes rewrite to /coming-soon. Sitemap reflects publicly indexable pages only." **MIRROR** côté `apps/seller/src/app/robots.ts` (sitemap pointe vers `https://seller.tukio.one/sitemap.xml`).
- **Given** `apps/public/src/app/sitemap.ts` (Next.js 16 `MetadataRoute.Sitemap`), **When** Googlebot fetch `/sitemap.xml`, **Then** le sitemap liste **10 URLs × 2 locales = 20 entrées** :
  - `https://tukio.one/fr/` + `https://tukio.one/en/` (priority 1.0, changefreq weekly — rewrite vers `/coming-soon` mais l'URL canonique reste `/`)
  - `https://tukio.one/{fr,en}/coming-soon` (priority 0.9)
  - `https://tukio.one/{fr,en}/devenir-pro` (priority 0.8 — landing apex marketing pro)
  - `https://tukio.one/{fr,en}/a-propos` (priority 0.7)
  - `https://tukio.one/{fr,en}/confidentialite` (priority 0.4)
  - `https://tukio.one/{fr,en}/mentions-legales` (priority 0.4)
  - `https://tukio.one/{fr,en}/contact` (priority 0.6)
  - Chaque entrée avec `<lastmod>` = date de génération + `<changefreq>weekly</changefreq>` + balises `<xhtml:link rel="alternate" hreflang="{fr,en,x-default}">` pour le multilingue Google. **MIRROR** sitemap seller avec `https://seller.tukio.one/{fr,en}/seller-coming-soon` (priority 0.9, 1 URL × 2 locales).
- **Given** `apps/public/src/app/[locale]/layout.tsx` + chaque `page.tsx` des Stories 0.17/0.19, **When** je lis le head, **Then** la `generateMetadata()` Next.js 16 retourne :
  - `title` : page-specific (Story 0.17 : "tukio.one — Bientôt en Pays de la Loire" / Story 0.19 about : "À propos — tukio.one" / etc.)
  - `description` : page-specific, ≤ 160 chars FR + EN, contient le keyword principal ("événementiel Pays de la Loire" pour Home/Coming Soon)
  - `keywords` : optionnel (Google ignore mais Bing utilise — modestes 5-8 keywords pertinents)
  - `openGraph` : `{ title, description, type: 'website', locale: 'fr_FR' | 'en_US', siteName: 'tukio.one', images: [{ url: '/og/{slug}.png', width: 1200, height: 630, alt }], url: canonical }`
  - `twitter` : `{ card: 'summary_large_image', title, description, images: ['/og/{slug}.png'] }`
  - `alternates.canonical` : URL canonique sans query string
  - `alternates.languages` : `{ fr: 'https://tukio.one/fr/path', en: 'https://tukio.one/en/path', 'x-default': 'https://tukio.one/fr/path' }`
- **Given** les images Open Graph, **When** je vais sur `https://tukio.one/og/{slug}.png`, **Then** je trouve 7 visuels brand 1200×630 PNG (cohérents avec design tokens — cream-50 background + Fraunces title + brand-500 accent + logo Tukio top-left) :
  - `og/home.png` : "tukio.one — Bientôt en Pays de la Loire"
  - `og/coming-soon.png` : idem (alias)
  - `og/devenir-pro.png` : "Pour les pros de l'événementiel"
  - `og/a-propos.png` : "Une plateforme, un événement."
  - `og/confidentialite.png` : "Vos données, en clair."
  - `og/mentions-legales.png` : "Un projet en préparation."
  - `og/contact.png` : "On vous écoute."
  **Implementation option** : Next.js 16 `app/og/[slug]/route.ts` Image Response (Edge runtime) qui génère ces visuels à la volée — pas de PNG statiques à maintenir. Pattern : `import { ImageResponse } from 'next/og'`. Fonts Fraunces + Inter loaded via `@next/font` ou fetch. ImageResponse cache 24h (`cache-control: public, max-age=86400`).
- **Given** `apps/public/src/app/[locale]/layout.tsx` head, **When** la page rend, **Then** un `<script type="application/ld+json">` injecte le structured data **schema.org Organization** :
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "tukio.one",
    "url": "https://tukio.one",
    "logo": "https://tukio.one/logo.png",
    "description": "Marketplace des professionnels de l'événementiel en Pays de la Loire — tentes, mobilier, traiteur, décoration.",
    "foundingDate": "2026",
    "foundingLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressRegion": "Pays de la Loire", "addressCountry": "FR" } },
    "sameAs": [/* LinkedIn URL si dispo, vide sinon */],
    "contactPoint": { "@type": "ContactPoint", "email": "contact@tukio.one", "contactType": "Customer Service", "availableLanguage": ["French", "English"] }
  }
  ```
  Validation : Google Rich Results Test sur les 7 pages → 0 erreur, 0 warning.
- **Given** Plausible Analytics setup, **When** je crée un compte Plausible (~€9/mois ou auto-hosted gratuit), **Then** : (1) j'ajoute `tukio.one` + `seller.tukio.one` comme 2 sites Plausible, (2) je copie le snippet `<script defer data-domain="tukio.one" src="https://plausible.io/js/script.outbound-links.tagged-events.js"></script>` dans `apps/public/src/app/[locale]/layout.tsx` head (conditional render `if (process.env.NEXT_PUBLIC_PLAUSIBLE_ENABLED === 'true')`), mirror sur `apps/seller`. **RGPD-friendly** : pas de cookies, pas d'IP stockée, pas de cookie banner nécessaire — confirmer dans la Privacy policy Story 0.19 section 7 "Hébergement et sous-traitants en pré-lancement" l'ajout de Plausible.
- **Given** les custom events Plausible, **When** un user interagit, **Then** ces events sont tracked via `plausible.q.push(['event', '<name>', { props }])` ou `window.plausible('<name>', { props })` :
  - `Coming Soon Form Submit` (props : `role`, `locale`, `acquisitionSource`)
  - `Coming Soon Form Submit Success`
  - `Contact Form Submit`
  - `Devenir Pro CTA Click` (depuis seller-coming-soon vers apex coming-soon)
  - `Outbound Click — Privacy` / `Outbound Click — Legal`
  Dashboard Plausible affiche le funnel : Pageviews `/coming-soon` → `Coming Soon Form Submit` → `Coming Soon Form Submit Success` (conversion %).
- **Given** la NFR58 i18n SEO, **When** un crawler Google FR visite `tukio.one`, **Then** il découvre via Accept-Language ou hreflang la version FR et l'indexe en `fr_FR` ; un crawler Google EN découvre `en_US` ; un crawler Bing idem. **Test concret** : `curl -H "Accept-Language: en" https://tukio.one/` → redirect 301 ou render direct `/en/coming-soon` (selon stratégie middleware i18n Story 0.15).
- **Given** une checklist SEO pré-publication, **When** Ismael lance le check manuel avant le go-live, **Then** ces outils passent au vert :
  - Google Rich Results Test (https://search.google.com/test/rich-results) sur les 7 pages → 0 erreur
  - Lighthouse SEO score ≥ 95 sur les 7 pages (`pnpm lighthouse:ci` pattern Story 0.11)
  - Mobile-Friendly Test Google
  - Schema Markup Validator (validator.schema.org)
  - Twitter Card Validator (cards-dev.twitter.com/validator)
  - Facebook Sharing Debugger (developers.facebook.com/tools/debug/)
  - axe-core a11y 0 violations sur 7 pages (= zero impact négatif SEO)
- **Given** Search Console + Bing Webmaster Tools, **When** Ismael soumet le domaine post-go-live, **Then** : (1) `tukio.one` + `seller.tukio.one` ajoutés Search Console + Bing Webmaster, (2) sitemap soumis, (3) URL Inspection sur `/fr/coming-soon` → "URL is on Google" sous 7 jours, (4) **note de doc dans runbook** : un dev/Ismael peut suivre la procédure sans connaissance Search Console préalable.
- **Given** un test Playwright `seo.e2e-spec.ts`, **When** je lance, **Then** ≥ 10 cases : 7 pages × { `<title>` non-vide ET unique cross-pages, `<meta name="description">` présent ET ≤ 160 chars, `<link rel="canonical">` correct, `<meta property="og:image">` 200 OK, `<script type="application/ld+json">` parsable JSON valide schema.org } + sitemap.xml content-type `application/xml` + robots.txt content-type `text/plain` + outbound liens externes ouvrent `target="_blank" rel="noopener noreferrer"`.
- **Given** un audit Plausible 30 jours post-go-live (= jalon de succès), **When** Ismael ouvre le dashboard, **Then** il voit : nombre visiteurs uniques + funnel `Coming Soon Pageview → Form Submit → Submit Success` avec %conversion + sources de trafic (organic/direct/referral) + breakdown par locale. **Objectif minimum** : conversion ≥ 3 % (3 inscriptions waitlist / 100 visiteurs landing) — KPI à mesurer.
- **Given** un runbook NEW `docs/runbooks/seo-prelaunch-checklist.md`, **When** je l'ouvre, **Then** je trouve : (1) procédure d'enregistrement Search Console + Bing Webmaster pas à pas, (2) liste outils de validation (avec URLs), (3) procédure update OG image (modifier `app/og/[slug]/route.ts` + redeploy), (4) procédure ajout/désactivation Plausible, (5) procédure remove SEO foundation post-MVP-launch (en réalité on garde tout — seul le robots.txt évolue selon les routes indexables Epic 1+).

**Epic 0 — Total stories Sprint 0 + Pre-launch : 21** (0.1-0.14 foundation + 0.15-0.21 pre-launch landing + SEO + analytics)

---

### Epic 1: Identity & Authentication Backbone

**Outcome utilisateur** : un Visitor peut s'inscrire en moins de 30 s en tant que Customer B2C, ou en tant que Pro (compte mis en attente admin), confirmer son email, se connecter, réinitialiser son mot de passe, et gérer son profil. Les Admins ont obligatoirement la 2FA TOTP. Un compte Pro ne peut pas être créé en doublon sur un même SIRET.

**FRs covered MVP** : FR1, FR3, FR4, FR7, FR8, FR9, FR14, FR15, FR16, FR17
**FRs déférés V1+** : FR2 (B2B Customer Account), FR5 (login social), FR6 (SAML SSO), FR10 (Pro 2FA), FR11 (profil enrichi), FR12 (Stripe Identity), FR13 (conversion client → Pro)
**NFRs covered** : NFR1 (RGPD), NFR9 (Keycloak auth), NFR10 (rate limit), NFR11 (JWKS cache), NFR12 (refresh token rotation), NFR13 (session cookies), NFR15 (PII encryption), NFR48 (UX < 30 s), NFR71 (test coverage)
**UX-DRs covered** : UX-DR9 (sign-up funnel), UX-DR10 (email verification landing — gap MVP critique), UX-DR11 (account settings)

#### Story 1.1: Provision Keycloak realm `tukio` with 5 roles + 4 clients + Phasetwo extension

**As a** tech lead,
**I want** the Keycloak 26 realm `tukio` provisioned with 5 roles (`client`, `pro`, `admin-support`, `admin-modo`, `admin-super`), 4 OIDC clients (`tukio-web`, `tukio-admin`, `tukio-api`, `tukio-mobile`), and Phasetwo extension installed,
**So that** auth backbone est prêt pour MVP (sessions, scopes, claims) avec extensibilité multi-tenant V2.

**Acceptance Criteria :**

- **Given** Keycloak 26 démarré en staging, **When** je lance `infra/scripts/bootstrap-keycloak-realm.sh`, **Then** le realm `tukio` existe avec les 5 rôles, et chaque rôle a sa description en FR + EN dans les attributs.
- **Given** le realm `tukio`, **When** je liste les clients, **Then** je trouve : `tukio-web` (public, OIDC, redirect URIs `https://*.tukio.one/*`, PKCE obligatoire), `tukio-admin` (public, OIDC + 2FA enforcement, redirect URI `https://admin.tukio.one/*`), `tukio-api` (confidential, service account + introspection), `tukio-mobile` (public, PKCE, scheme `tukio://`).
- **Given** un user créé avec rôle `pro`, **When** son JWT est introspecté, **Then** le claim `realm_access.roles` contient `pro`, et le claim custom `tukio:locale` est présent (default `fr`).
- **Given** Phasetwo extension installée, **When** je consulte `/realms/tukio/portal`, **Then** l'API Phasetwo répond (réservé V2 pour SSO B2B Enterprise — non exposé MVP).
- **Given** une politique `Brute Force Detection` activée, **When** un user fait 5 tentatives login fail en 5 min, **Then** son compte est temporairement lock (15 min) et un événement `LOGIN_ERROR` est publié dans NATS pour audit (NFR10).
- **Given** des thèmes Keycloak custom (login + email), **When** je consulte `/realms/tukio/login`, **Then** le branding terracotta + Fraunces match `tokens.css`, FR/EN selon `kc_locale` query param.
- **Given** un dev qui veut le realm en local, **When** il lance `pnpm docker:up && infra/scripts/bootstrap-keycloak-realm.sh --env=local`, **Then** un realm `tukio` identique au staging est provisionné en local.

#### Story 1.2: Customer B2C registration (`POST /v1/auth/customer/register`)

> 📌 **Décomposée 2026-05-15 via `/bmad-correct-course`** : voir sub-stories `1.2a` (contracts + identity-svc domain + use case unit), `1.2b` (identity-svc infrastructure + controller /internal/customers), `1.2c` (gateway-api Pretre + forwarder + Throttler Redis), `1.2d` (frontend sign-up + middleware + Playwright e2e + observability). Ce bloc ACs reste autorité fonctionnelle. Référence : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md`.

**As a** Visitor,
**I want** to register as a Customer B2C with email + password in less than 30 seconds,
**So that** I can start browsing and bookmarking events services.

**Acceptance Criteria :**

- **Given** un Visitor sur `tukio.one/fr/auth/sign-up`, **When** il soumet `{ email, password, firstName, lastName, locale: 'fr', acceptTerms: true, acceptMarketing?: bool, acquisition: { source, campaign?, referralId? } }`, **Then** le gateway-api forward à `identity-svc.POST /internal/customers`, qui (1) valide email RFC 5322 + password (≥ 12 chars, mix maj/min/digit/special — NFR9), (2) crée le user dans Keycloak avec rôle `client` + email non vérifié, (3) crée le `UserProfile` aggregate en DB `tukio_identity` avec acquisition_* tracké, (4) publie `identity.user.registered.v1` dans NATS, (5) répond enveloppe `{ method:'POST', code:201, data:{ userId, requiresEmailVerification:true } }`.
- **Given** un Visitor avec un email déjà existant, **When** il soumet le formulaire, **Then** la response est `{ method:'POST', code:409, error:{ tukioCode:'IDENTITY-CONFLICT-001', message:'Email déjà utilisé' } }` — message générique côté UI mais code distinct côté API pour rate-limiting (NFR9 sécurité énumération).
- **Given** la story FR8, **When** le user est créé, **Then** un événement `notification.email.send.v1` est publié pour envoyer le mail de vérification via Resend (template `email-verify.fr.tsx` ou `email-verify.en.tsx` selon `locale`).
- **Given** la NFR10 (rate limit), **When** une IP fait > 5 inscriptions/min, **Then** le gateway-api retourne 429 enveloppe avec `Retry-After`.
- **Given** un Customer qui s'inscrit avec UTM `?utm_source=google_ads&utm_campaign=spring2026`, **When** son record est créé, **Then** les colonnes `acquisition_source = 'google_ads'`, `acquisition_campaign = 'spring2026'`, `acquisition_first_touch` et `acquisition_last_touch` sont remplies (Story 0.13).
- **Given** un Customer fraîchement créé email non vérifié, **When** il essaie d'accéder à `/customer/bookings/checkout`, **Then** middleware Next.js détecte `email_verified=false` dans JWT et redirige vers `/auth/verify-email-required` (FR17).
- **Given** UX-DR9 (sign-up funnel), **When** je mesure le temps entre arrivée formulaire et succès, **Then** ≤ 30 s pour 90 % des inscriptions desktop (NFR48).
- **Given** test Playwright e2e, **When** un Visitor s'inscrit, **Then** parcours validé sans erreur axe-core, FR + EN.

#### Story 1.3: Customer→Pro conversion wizard with `pending_admin_review` status (`POST /v1/auth/pro/register`)

> 🧩 **Décomposée en 4 sous-stories le 2026-05-16** via `/bmad-correct-course` (sprint-change-proposal-2026-05-16.md) : `1-3a-contracts-pro-domain-usecase` + `1-3b-identity-svc-infrastructure-insee-r2-controller` (deviation INSEE auth: apiKey direct au lieu d'OAuth2) + `1-3c-gateway-api-pro-register-multipart-forwarder` + `1-3d-frontend-wizard-seller-middleware-e2e-observability`.
>
> 🔄 **Re-cadrée le 2026-05-17** via `/bmad-correct-course` (sprint-change-proposal-2026-05-17.md) suite au constat que la spec divergeait du Cloud Design `docs/cloud-design-bundle/project/screens/mvp-pro-onboarding.jsx`. Le flow réel est : **Customer authentifié + email-verified → CTA "Devenir pro" dropdown avatar → wizard 4 steps** `/seller/onboarding/{step}` (Identité pré-remplie / Activité / Documents / Récap) **→ submit → page pending**. Backend Story 1.3a/b/c conservé (étendus via 1.3a-bis + 1.3b-bis ; endpoint réutilisé). Story 1.3d v1 mergée puis **rollback** (wizard + i18n + Playwright à supprimer dans Story 1.3d v2). Sub-stories actualisées : 1.3a ✅ + 1.3a-bis 🆕 + 1.3b ✅ + 1.3b-bis 🆕 + 1.3c ✅ + 1.3d v1 ❌ rollback + 1.3d v2 🆕.

**As a** Customer authentifié + email-verified,
**I want** to convert my account to a Pro by completing a guided 4-step wizard (Identité / Activité / Documents / Récap) on `seller.tukio.one`,
**So that** I can request to become a Pro on Tukio with my account flagged `pending_admin_review` for admin review — while preserving my existing account history.

**Acceptance Criteria :**

- **Given** un Customer authentifié + email-verified sur `tukio.one`, **When** il clique l'item "Devenir pro" dans le dropdown avatar, **Then** il est redirigé cross-zone vers `seller.tukio.one/{locale}/seller/onboarding/identity`.
- **Given** le wizard step 1 "Identité" sur `/seller/onboarding/identity`, **When** il render, **Then** Prénom/Nom/Email sont pré-remplis depuis le compte Customer existant + champs additionnels Téléphone (required, hint "visible clients après acceptation") + Date de naissance (DD/MM/YYYY, required) + bannière RGPD brand-50.
- **Given** le wizard step 2 "Activité" sur `/seller/onboarding/activity`, **When** soumis, **Then** identity-svc valide : companyName (required) + SIRET (Luhn live check + INSEE actif via apiKey, 422 `IDENTITY-VALIDATION-003` si inactif) + Forme juridique (enum SAS/SASU, EURL/SARL, Micro, Auto, Asso 1901) + Statut TVA (enum assujetti/non) + Catégories d'activité (1-2 max parmi 6 fixtures MVP) + Zone d'intervention (city + radiusKm 1-200) + Contact phone (FR format).
- **Given** le wizard step 3 "Documents" sur `/seller/onboarding/documents`, **When** soumis, **Then** uploads `idCard` (required) + `rib` (required) + `kbisOrInsee?` (optional) stockés Cloudflare R2 chiffrés SSE-S3 (NFR15) avec metadata `actorId`.
- **Given** le wizard step 4 "Récap" sur `/seller/onboarding/review`, **When** Pro coche la charte (acceptCharter required literal true) + clique "Soumettre mon dossier", **Then** identity-svc (1) assigne le rôle `pro` au user Keycloak existant (PAS créer un nouveau user) + set custom claim `tukio:status='pending_admin_review'`, (2) crée le `ProProfile` aggregate avec status `pending_admin_review`, (3) publie `identity.pro.registered.v1` (admin reçoit notif Story 2.3), (4) répond enveloppe avec `requiresAdminReview: true`, (5) frontend redirige vers `/seller/onboarding/pending`.
- **Given** un Customer qui essaie de soumettre avec un SIRET déjà utilisé par un autre `ProProfile` actif, **When** la step 2 ou 4 est soumise, **Then** identity-svc retourne 409 enveloppe `tukioCode:'IDENTITY-CONFLICT-002'` (FR16, anti-doublon).
- **Given** un Pro `pending_admin_review`, **When** il accède `/seller/listings/new` ou autre path transactionnel non-whitelist, **Then** middleware Next.js seller redirige vers `/seller/onboarding/pending` avec message "Votre dossier est en cours de vérification" (FR17). Whitelist : `/onboarding/*`, `/profile/*`, `/messaging/*`.
- **Given** UX-DR9 + `docs/cloud-design-bundle/project/screens/mvp-pro-onboarding.jsx`, **When** je regarde le flow, **Then** je trouve : header simple (Logo + "Brouillon · sauvegardé il y a 1 min" + bouton "Continuer plus tard"), step indicator barres horizontales 4 segments + labels colorés (success-700 done / brand-700 current / charcoal-400 upcoming), layout single-column 720px max, Kicker "Étape N — Label" + H1 Fraunces + sub-paragraph.
- **Given** la page pending `/seller/onboarding/pending`, **When** elle render, **Then** elle est conforme `ProOnbPendingScreen` : icône clock warning + headline "Dossier entre les mains d'un admin tukio" + "< 24h ouvrées" + card "Pendant ce temps préparez votre vitrine" 3 PendingTask (brouillon fiche, photos, politique annulation).
- **Given** la story Pro pending, **When** un Admin valide ou rejette le dossier (Epic 2 Story 2.5), **Then** Pro reçoit un email transactionnel selon décision et son `tukio:status` Keycloak passe à `verified` (chemin → Stripe Connect Story 2.1) ou `rejected` (CTA "Corriger" Story 2.5).
- **Given** RGPD (NFR1, NFR15), **When** un Pro upload sa pièce d'identité, **Then** chiffré R2 SSE-S3 server-side, accessible uniquement par admins via signed URLs 5 min, et purgé après 90 jours post-validation/rejet (rétention KYC — cf. runbook `docs/runbook/kyc-docs-retention.md`).

#### Story 1.4: Login flow Keycloak (`POST /v1/auth/login` + Authorization Code + PKCE)

> ⚠️ **Décomposée en 4 sub-stories** via `/bmad-correct-course` 2026-05-17-bis
> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md`) :
> 1.4a (contracts + utils + KeycloakOAuthClient) → 1.4b (5 endpoints + 5 use cases + CsrfGuard + e2e)
> → 1.4c (login page + callback + AuthProvider ×3 + LogoutButton ×3) → 1.4d (middlewares ×3
> + auth-client hooks finalize + observability).
>
> 🔑 **Architecture dual-portal acté 2026-05-17 17h** (révision de la décision Customer-first matinale) :
> 2 portails UX distincts (apex `tukio.one` Customer + `seller.tukio.one` Pro) avec **1 backend
> Customer-first unique** (`POST /v1/auth/customer/register` → role=client systématique). Implications
> sur cette story 1.4 : zéro `?role=pro` au signup, zéro lien "S'inscrire en tant que Pro" sur la
> page login customer apex. Le rôle Pro s'obtient via conversion post-auth (Story 1.3 v2 ✅ livrée).
> Le **CTA "Devenir pro"** dans le header global apex + les **pages auth seller.tukio.one** sont
> livrés par **Story 1.11** (NEW). Voir mémoire `project_signup_dual_portal_2026_05_17.md`.

**As a** Customer / Pro / Admin,
**I want** to log in with my email + password via Keycloak,
**So that** I get a session valid across all 4 zones (`*.tukio.one`).

**Acceptance Criteria :**

- **Given** un user sur `tukio.one/fr/auth/login`, **When** il clique "Se connecter", **Then** il est redirigé vers `auth.tukio.one/realms/tukio/protocol/openid-connect/auth?response_type=code&client_id=tukio-web&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...&kc_locale=fr` (PKCE obligatoire — NFR9).
- **Given** un user qui s'authentifie correctement, **When** Keycloak callback `/auth/callback?code=...&state=...`, **Then** Next.js échange code → tokens via Keycloak `/token` endpoint, écrit cookies `tukio-access-token` (HttpOnly, Secure, SameSite=Lax, `Domain=.tukio.one`, max-age 5 min) et `tukio-refresh-token` (HttpOnly, Secure, SameSite=Strict, `Domain=.tukio.one`, max-age 30 jours rolling — NFR12, NFR13).
- **Given** un Customer authentifié sur `tukio.one` (apex unifié, ADR-016), **When** il navigue vers `seller.tukio.one`, **Then** le cookie est partagé et il reste authentifié sans re-login (NFR9).
- **Given** un user qui essaie de se connecter avec mauvais password, **When** la response Keycloak arrive, **Then** Next.js affiche un message générique "Email ou mot de passe incorrect" (pas de leak — NFR9), et incrémente le compteur Brute Force Detection.
- **Given** un Pro `pending_admin_review`, **When** il se connecte, **Then** il est redirigé vers `/seller/onboarding/pending` (FR17).
- **Given** un Admin, **When** il se connecte, **Then** Keycloak force la 2FA TOTP avant émission token (FR9). S'il n'a pas configuré TOTP, il est redirigé vers `/auth/totp-setup` (Story 1.7).
- **Given** un access token expiré (5 min), **When** une requête API est faite, **Then** le frontend appelle silencieusement `/auth/refresh` avec le refresh token, reçoit nouveaux tokens (rotation), et retry la requête (transparent UX — NFR12).
- **Given** UX-DR9, **When** je regarde la page login, **Then** elle a `<Input type="email">`, `<Input type="password">`, lien "Mot de passe oublié ?", lien "Pas de compte ? S'inscrire", labels FR + EN.

#### Story 1.5: Password reset flow (`POST /v1/auth/password-reset/request` + `POST /v1/auth/password-reset/confirm`)

**As a** Customer / Pro / Admin,
**I want** to reset my password via an email link,
**So that** I can recover access to my account if I forget it.

**Acceptance Criteria :**

- **Given** un user sur `/fr/auth/password-reset`, **When** il soumet son email, **Then** identity-svc (1) appelle Keycloak `/realms/tukio/account/password-reset` qui génère un reset token (TTL 30 min), (2) publie `notification.email.send.v1` avec template `password-reset.fr.tsx` ou `.en.tsx`, (3) répond enveloppe générique `{ code:200, data:{ message:'Si un compte existe pour cet email, un lien a été envoyé' } }` — sans révéler si l'email existe (NFR9 anti-énumération).
- **Given** un user qui clique le lien `tukio.one/fr/auth/password-reset/confirm?token=...`, **When** il soumet `{ newPassword, newPasswordConfirm }`, **Then** identity-svc valide le token via Keycloak, vérifie password complexity (NFR9), update password, invalide toutes sessions existantes, publie `identity.password.reset.v1`, et redirige vers `/fr/auth/login` avec message succès.
- **Given** un token expiré ou déjà utilisé, **When** le user soumet, **Then** réponse 410 enveloppe `IDENTITY-EXPIRED-001` avec CTA "Demander un nouveau lien".
- **Given** la NFR10, **When** une IP fait > 3 demandes reset/heure, **Then** le gateway-api retourne 429.
- **Given** un user qui reset son password, **When** l'email est envoyé, **Then** il contient explicitement "Si vous n'avez pas demandé ce lien, ignorez cet email" + un timestamp + lien "Signaler une activité suspecte" (sécurité utilisateur).

#### Story 1.6: Email verification flow (`POST /v1/auth/email/verify` + landing page)

**As a** Customer / Pro,
**I want** to verify my email address by clicking a link,
**So that** I can unlock transactional features (booking, payment, messaging).

**Acceptance Criteria :**

- **Given** un user fraîchement inscrit, **When** il reçoit l'email "Vérifiez votre adresse" template Resend, **Then** il contient un lien `tukio.one/fr/auth/email/verify?token=...` (TTL 7 jours).
- **Given** le user clique le lien, **When** il arrive sur la landing page, **Then** identity-svc valide le token via Keycloak, set `email_verified=true` dans Keycloak, publie `identity.email.verified.v1`, et la page affiche un message succès avec CTA "Continuer" vers `/account/dashboard` (default Customer — l'option "Devenir pro" est accessible ensuite depuis le dropdown avatar pour démarrer le wizard conversion, cf. Story 1.3).
- **Given** la landing page de verification (UX-DR10 — gap MVP critique à designer Sprint 0), **When** elle render, **Then** elle utilise les composants `<EmptyState variant="success">` (Story 0.5) avec icône check + titre Fraunces + description.
- **Given** un token expiré, **When** le user clique, **Then** la page affiche "Lien expiré" + CTA "Renvoyer un email de vérification" qui appelle `POST /v1/auth/email/resend` (rate-limit 1/5 min).
- **Given** un Customer email non vérifié qui essaie de réserver (FR17), **When** il accède `/customer/bookings/checkout`, **Then** middleware redirige vers `/auth/verify-email-required` qui affiche "Vérifiez votre email pour continuer" + CTA "Renvoyer le lien".
- **Given** un Pro email non vérifié, **When** il accède `/seller/onboarding`, **Then** la step "Vérification email" est marquée non validée et bloque les steps suivantes.

#### Story 1.7: Admin 2FA TOTP obligatoire (`POST /v1/auth/totp/setup` + `POST /v1/auth/totp/verify`)

**As an** Admin,
**I want** to be forced to set up 2FA TOTP at first login,
**So that** my admin account is protected against credential theft.

**Acceptance Criteria :**

- **Given** un Admin créé via `infra/scripts/create-admin.ts` ou flow Admin Super invite (Epic 6), **When** il se connecte la première fois, **Then** Keycloak redirige vers `/auth/totp-setup` après email verify (FR9).
- **Given** la page `/auth/totp-setup`, **When** elle render, **Then** elle affiche un QR code (fourni par Keycloak `/account/totp/setup`) + 8 codes de récupération à imprimer/sauvegarder + champ "Entrer le code à 6 chiffres" + CTA "Valider".
- **Given** l'Admin scanne le QR code dans Google Authenticator / Authy, **When** il entre le code et clique Valider, **Then** Keycloak active TOTP, response 201 enveloppe avec `recoveryCodes: string[]`, et l'Admin est redirigé vers `/admin/dashboard`.
- **Given** un Admin qui a TOTP activé, **When** il se reconnecte, **Then** Keycloak demande `email + password + TOTP code` avant émission token.
- **Given** un Admin qui a perdu son device TOTP, **When** il entre un recovery code, **Then** Keycloak accepte le login + force le re-setup TOTP immédiatement après (recovery code à usage unique).
- **Given** un Admin sans TOTP configuré qui essaie de bypass, **When** il accède `/admin/*`, **Then** middleware bloque (NFR9 — admin sans TOTP = pas d'accès).

#### Story 1.8: Profile management (`GET /v1/me` + `PATCH /v1/me`)

**As a** Customer / Pro,
**I want** to consult and edit my profile (name, phone, address, locale, preferences),
**So that** my information stays up to date and I can change my preferred language.

**Acceptance Criteria :**

- **Given** un user authentifié, **When** il appelle `GET /v1/me`, **Then** identity-svc retourne enveloppe `{ code:200, data:{ id, email, role, firstName, lastName, locale, phone?, address?, marketingOptIn, emailVerified, createdAt, ...prosFields? } }`.
- **Given** un user sur `/fr/account/profile`, **When** il édite ses champs et soumet, **Then** Next.js appelle `PATCH /v1/me` avec body Zod-validé via `@tukio/contracts`, identity-svc update le `UserProfile` aggregate + sync changes pertinents vers Keycloak (firstName, lastName, locale), publie `identity.user.profile-updated.v1`.
- **Given** un user qui change sa locale `fr` → `en`, **When** il refresh la page, **Then** middleware next-intl détecte le claim `tukio:locale='en'` du JWT (re-issu) et redirige vers `/en/account/profile`.
- **Given** un user qui essaie de changer son email, **When** il submit, **Then** la response est 422 enveloppe `IDENTITY-VALIDATION-003` "Le changement d'email nécessite une procédure dédiée" (déféré V1 — pas dans MVP).
- **Given** UX-DR11 (account settings), **When** je regarde la page, **Then** elle utilise `<FormField>`, `<Input>`, `<Button>` (Story 0.4), validation inline via React Hook Form + Zod, sauvegarde optimistic via TanStack Query mutation.
- **Given** RGPD (NFR1), **When** un Pro édite son profil, **Then** les champs sensibles (numéro pièce d'identité, RIB) sont en readonly avec mention "Modification via support".

#### Story 1.9: Account deletion soft-delete + RGPD (`DELETE /v1/me`)

**As a** Customer / Pro,
**I want** to delete my account,
**So that** I exercise my RGPD right to erasure while complying with French legal accounting retention.

**Acceptance Criteria :**

- **Given** un user authentifié sur `/fr/account/settings`, **When** il clique "Supprimer mon compte" et confirme dans une modale destructrice (`requireExplicitClose`), **Then** Next.js appelle `DELETE /v1/me`, identity-svc (1) vérifie absence de bookings actifs (sinon refuse 409 `IDENTITY-CONFLICT-003` "Annulez vos résa avant"), (2) marque `UserProfile` avec `deleted_at = NOW()` (soft-delete), (3) anonymise les champs PII (email → `deleted-{uuid}@deleted.tukio.one`, firstName/lastName → "Utilisateur supprimé", phone → null), (4) garde toutes les données comptables/transactionnelles intactes (factures, bookings, payments — rétention 10 ans légale FR — NFR1), (5) disable le compte Keycloak, (6) publie `identity.user.deleted.v1`, (7) répond 204.
- **Given** un user supprimé, **When** un endpoint API renvoie une référence à ce user (ex: review afficher "auteur"), **Then** le nom affiché est "Utilisateur supprimé" et l'avatar est l'icône default.
- **Given** un job cron `purge-deleted-accounts.task.ts` qui tourne quotidiennement, **When** un user a `deleted_at < NOW() - INTERVAL '10 years'`, **Then** ses données comptables sont purgées définitivement (hors backups archivés conformément NFR1).
- **Given** un Pro avec des bookings actifs, **When** il essaie de supprimer son compte, **Then** la modale affiche "Vous avez X bookings en cours, annulez-les d'abord" + liste des bookings concernés + CTA vers `/seller/bookings/active`.
- **Given** un user supprimé, **When** il essaie de re-créer un compte avec le même email, **Then** identity-svc accepte (l'ancien email est anonymisé donc plus en conflit) — mais le nouveau compte est un user neuf, pas une "résurrection".

#### Story 1.10: identity-svc Pretre implementation (domain `UserProfile` + `ProProfile` + Keycloak sync)

**As a** backend developer,
**I want** identity-svc fully implemented with Pattern Pretre Clean Architecture, including domain aggregates `UserProfile`/`ProProfile`, ports `UserProfileRepository`/`KeycloakSync`/`InseeSiretValidator`/`MediaStorage`/`EventPublisher`, and use cases for stories 1.2-1.9,
**So that** all FRs Epic 1 are backed by testable, domain-driven code respecting boundaries.

**Acceptance Criteria :**

- **Given** `apps/identity-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{user-profile.ts, pro-profile.ts, value-objects/{email.vo.ts, password-policy.vo.ts, siret.vo.ts, address.vo.ts, role.vo.ts, status.vo.ts}}`, `ports/{user-profile-repository.ts, pro-profile-repository.ts, keycloak-sync.ts, insee-siret-validator.ts, media-storage.ts, event-publisher.ts, password-hasher.ts, totp-service.ts}`, `service/{password-policy.service.ts}`, `exception/{identity.exception.ts}`.
- **Given** chaque port domain, **When** je l'ouvre, **Then** c'est une `interface` TS pure (pas de classe) + un Symbol DI token exporté (`USER_PROFILE_REPOSITORY = Symbol('UserProfileRepository')`).
- **Given** `apps/identity-svc/src/usecases/`, **When** je l'ouvre, **Then** je trouve 1 use case par story 1.2-1.9 : `register-customer.usecase.ts`, `register-pro.usecase.ts`, `verify-email.usecase.ts`, `request-password-reset.usecase.ts`, `confirm-password-reset.usecase.ts`, `setup-admin-totp.usecase.ts`, `update-profile.usecase.ts`, `delete-account.usecase.ts`. Chacun a `execute(input): Promise<output>` typé via `@tukio/contracts`.
- **Given** `apps/identity-svc/src/infrastructure/`, **When** je l'ouvre, **Then** je trouve : `persistence/typeorm/{user-profile.entity.ts, pro-profile.entity.ts, user-profile.typeorm-repository.ts, pro-profile.typeorm-repository.ts}`, `external/{keycloak-sync.service.ts, insee-siret-validator.service.ts, media-storage-r2.service.ts}`, `messaging/nats/{event-publisher.nats.ts, outbox-publisher.ts}`, `http/controllers/{customer.controller.ts, pro.controller.ts, auth.controller.ts, me.controller.ts}`, `usecases-proxy/usecases-proxy.module.ts`.
- **Given** un test unitaire `register-customer.usecase.spec.ts`, **When** il s'exécute, **Then** il mocke tous les ports (pas de testcontainer Postgres requis), et coverage du use case ≥ 80 % (NFR71).
- **Given** un test d'intégration `user-profile.typeorm-repository.integration-spec.ts`, **When** il s'exécute via `pnpm test:integration --filter=identity-svc`, **Then** un container Postgres éphémère démarre via `@tukio/testing`, les migrations sont jouées, et le test interagit avec une vraie DB (NFR71 — coverage 50 % infrastructure).
- **Given** lint `eslint-plugin-boundaries`, **When** la CI tourne sur `apps/identity-svc/`, **Then** elle vérifie qu'aucun fichier `domain/` n'importe `@nestjs/*`, `typeorm`, `axios`, ou autre dépendance externe.
- **Given** la table `outbox` est en place dans `tukio_identity`, **When** un use case publie un event (ex: `register-customer.usecase` → `identity.user.registered.v1`), **Then** l'event est inséré dans outbox dans la même transaction TypeORM que la création du `UserProfile` (cohérence — ADR-007).
- **Given** la migration TypeORM identity-svc, **When** elle s'exécute, **Then** la table `audit_log` est créée avec colonnes `id (uuid)`, `actor_id (uuid)`, `actor_role (enum)`, `action_type (text)`, `aggregate_type (text)`, `aggregate_id (uuid)`, `before_state (jsonb)`, `after_state (jsonb)`, `reason (text NULL)`, `correlation_id (uuid)`, `at (timestamptz NOT NULL)`, `ip_address (inet)`, `user_agent (text)`, indexes `(actor_id, at DESC)` et `(aggregate_id, at DESC)`. Disponible dès Epic 1 pour les use cases (login audit Story 1.4, TOTP setup Story 1.7, account delete Story 1.9). Le trigger d'immutabilité + UI de consultation sont ajoutés Story 2.7.

#### Story 1.11: Seller signup portal (`seller.tukio.one` sign-up + login + CTA "Devenir pro" header apex + flag intent Pro)

> 🆕 **Story NEW** créée 2026-05-17 suite à la décision dual-portal (révision 17h) actée par Ismael
> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md` addendum).
> Architecture : 2 portails UX distincts (apex Customer + seller Pro) avec 1 backend Customer-first unique.

**As a** Pro prospect (visiteur ou Customer existant souhaitant devenir Pro),
**I want** un portail signup/login dédié sur `seller.tukio.one` avec branding/storytelling Pro, accessible
depuis un CTA "Devenir pro" visible dans le header global apex `tukio.one`, et un mécanisme de redirect
intelligent post-email-verify vers le wizard conversion Pro,
**So that** j'ai un point d'entrée visuel clair, un parcours signup brandé pro, et — si je suis déjà
Customer authentifié — une proposition contextualisée de conversion vers le wizard Story 1.3 v2.

**Acceptance Criteria :**

- **Given** un visiteur sur `tukio.one`, **When** il regarde le header global, **Then** il voit un CTA "Devenir pro" (FR) / "Become a pro" (EN) visible 100 % du temps, qui click → `seller.tukio.one/{locale}/auth/sign-up`. Variante mobile dans drawer (≤768px).
- **Given** un visiteur sur `seller.tukio.one/{locale}/auth/sign-up`, **When** la page render, **Then** il voit un hero brandé pro + 3 cards bénéfices + form fields IDENTIQUES au signup Customer (email, password, firstName, lastName, acceptTerms, acceptMarketing) — pas de field Pro spécifique (SIRET collecté plus tard via wizard).
- **Given** le user soumet le sign-up Pro, **When** la requête part, **Then** `POST /v1/auth/customer/register` (Story 1.2c, MÊME endpoint) est appelé avec body `signupOrigin: 'pro_portal'`. gateway-api set un cookie `tukio-signup-intent=pro` (HttpOnly+Secure+SameSite=Lax+Domain=.tukio.one+Max-Age=86400). identity-svc set `user_profile.signup_intent='pro'` (DB column NEW migration).
- **Given** le compte est créé, **When** je regarde Keycloak, **Then** le rôle est `client` (PAS `pro`) — backend Customer-first préservé. Le rôle Pro effectif s'obtient via `ConvertCustomerToProUseCase` Story 1.3b-bis (wizard conversion Story 1.3 v2 ✅ livré).
- **Given** un Customer authentifié `role=client status=active` arrivant sur `seller.tukio.one/{locale}` (racine), **When** middleware seller route, **Then** affiche page "Vous êtes connecté en tant que client. Devenir pro ?" avec CTA "Démarrer ma demande" → `seller.tukio.one/{locale}/seller/onboarding/identity` (wizard step 1 Story 1.3 v2).
- **Given** un Pro `role=pro status=pending_admin_review` OU `active` arrivant sur `seller.tukio.one/{locale}`, **When** middleware seller route, **Then** redirect vers dashboard seller approprié (Story 2.x).
- **Given** un visiteur non authentifié arrivant sur `seller.tukio.one/{locale}` (racine), **When** middleware seller route, **Then** redirect vers `seller.tukio.one/{locale}/auth/sign-up` (AC2).
- **Given** Story 1.6 (email-verify) extension AC, **When** un user clique le lien email-verify post-signup, **Then** redirect intelligent : (1) cookie `tukio-signup-intent=pro` d'abord, (2) DB column `user_profile.signup_intent` en fallback. Si `'pro'` détecté → `seller.tukio.one/{locale}/seller/onboarding/identity`. Sinon → `tukio.one/{locale}/account/dashboard`. Cookie cleared après usage (mais pas la DB column — cleared par `ConvertCustomerToProUseCase` à la conversion réussie ou rejet explicite).
- **Given** la page login seller `seller.tukio.one/{locale}/auth/login`, **When** elle render, **Then** brandée pro, `<LoginCta>` initie Keycloak OAuth (`clientId=tukio-web`, MÊME que apex), avec lien "Pas encore de compte pro ? Créez-en un" (mène vers AC2). Pas de lien "Customer signup".
- **Given** Playwright e2e `apps/seller/e2e/auth/signup-pro-portal.spec.ts`, **When** il tourne, **Then** il valide 14 cases × 2 locales : CTA header apex visible + redirect cross-zone + axe-core 0 violations sur 3 pages + happy path signup + cookie + DB column + Customer auth conversion proposée + non-auth redirect sign-up + email non-verified redirect verify-email-required.

**Epic 1 — Total stories : 11**

---

### Epic 2: Pro Onboarding & Admin Verification

**Outcome utilisateur** : un Pro `pending_admin_review` (sortant Epic 1) complète un onboarding wizard 4 étapes (< 30 min cumulatif) — Stripe Connect Express, KYC docs validation par Admin, 1ère fiche service. À la fin, son statut passe à `verified` et il peut publier sur le catalogue. Un Admin peut traiter sa file de vérifications en < 24h.

**FRs covered MVP** : FR3 (KYC validation flow), FR23 partiel (onboarding crée la 1ère fiche service), FR83 (admin valide/rejette), FR94 (audit log toutes actions admin), FR95 (admin Super peut consulter audit trail)
**FRs déférés V1+** : FR11 (profil enrichi portfolio/équipe/certifs), FR12 (Stripe Identity KYC complet)
**NFRs covered** : NFR15 (chiffrement at-rest KYC docs), NFR79 (INSEE SIRENE), NFR48 (UX < 30 min onboarding), NFR82 (audit log immutable)
**UX-DRs covered** : UX-DR9 (admin verification queue — **gap MVP critique à designer Sprint 0**), UX-DR10 (admin KYC review detail — **gap MVP critique à designer Sprint 0**), UX-DR8 (audit `mvp-admin` bundle partiel)
**Intégrations** : Stripe Connect Express, INSEE SIRENE, Cloudflare R2

#### Story 2.1: Stripe Connect Express account creation + onboarding link

**As a** Pro `pending_admin_review`,
**I want** to create my Stripe Connect Express account and complete Stripe's hosted KYC onboarding,
**So that** I can receive payouts from bookings paid via Tukio.

**Acceptance Criteria :**

- **Given** un Pro authentifié sur `/seller/onboarding/stripe`, **When** il clique "Connecter mon compte Stripe", **Then** payment-svc appelle `Stripe.accounts.create({ type: 'express', country: 'FR', business_type: 'company', business_profile: { mcc: '7299', url, ... }, metadata: { proProfileId } })`, persiste `stripeAccountId` dans `ProProfile.stripeAccountId`, puis appelle `Stripe.accountLinks.create({ refresh_url, return_url, type: 'account_onboarding' })` et redirige le Pro vers l'URL Stripe hosted.
- **Given** un Pro qui complète l'onboarding Stripe et revient sur `/seller/onboarding/stripe/return`, **When** payment-svc appelle `Stripe.accounts.retrieve(stripeAccountId)`, **Then** il vérifie `details_submitted = true` + `charges_enabled = true` + `payouts_enabled = true`, met à jour `ProProfile.stripeStatus = 'submitted'`, publie `payment.stripe-account.submitted.v1`, et marque la step "Stripe" du wizard comme complétée.
- **Given** un Pro dont Stripe a flaggé un `requirements.currently_due > 0` (ex: documents manquants), **When** il revient, **Then** `ProProfile.stripeStatus = 'requires_action'` et l'UI affiche un CTA "Compléter votre dossier Stripe" qui regénère un `accountLink` (lien Stripe a TTL court).
- **Given** un Stripe webhook `account.updated` reçu sur payment-svc, **When** payment-svc le traite, **Then** il valide la signature `Stripe-Signature`, met à jour `ProProfile.stripeStatus`, et publie `payment.stripe-account.updated.v1` (consommé par notification-svc pour informer le Pro).
- **Given** un Pro `verified` (Admin a validé), **When** son `ProProfile.stripeStatus != 'submitted'`, **Then** payment-svc bloque son `chargesAllowed`, et le Pro voit dans `/seller/dashboard` un banner "Complétez votre compte Stripe pour pouvoir recevoir des résa".
- **Given** la NFR15, **When** un Stripe webhook arrive avec PII, **Then** payment-svc ne log JAMAIS le payload complet (uniquement `eventId, type, accountId`), et stocke `currently_due` requirements dans une colonne dédiée.
- **Given** un Pro qui veut tester (sandbox), **When** son `STRIPE_MODE=test` est actif, **Then** payment-svc utilise les clés `STRIPE_SECRET_KEY_TEST` (Doppler), et un badge "TEST" apparaît dans `/seller/dashboard`.

#### Story 2.2: Stripe Connect step extension + first listing redirect (post conversion-wizard)

> 🔄 **Re-cadrée 2026-05-17** via `/bmad-correct-course` (sprint-change-proposal-2026-05-17.md) : les steps Profil/KYC/Documents/Récap sont déplacées dans Story 1.3 (conversion wizard MVP). Story 2.2 ne couvre plus que (a) l'extension du wizard avec la step Stripe Connect après validation admin, (b) la redirection vers création 1ère fiche (Epic 3).

**As a** Pro `verified` (admin a validé via Story 2.5),
**I want** to add my Stripe Connect Express account via a guided step + then create my first listing,
**So that** I can start receiving bookings + payments.

**Acceptance Criteria :**

- **Given** un Pro `verified` qui se connecte (Story 1.4), **When** il atterrit sur `/seller/`, **Then** middleware le redirige vers `/seller/onboarding/stripe` si `stripeStatus != 'submitted'`, sinon vers `/seller/onboarding/first-listing` si pas encore de fiche, sinon `/seller/dashboard`.
- **Given** la page `/seller/onboarding/stripe`, **When** elle render, **Then** elle réutilise le `<OnbShell>` Story 1.3d v2 + step indicator étendu (Identité ✅ / Activité ✅ / Documents ✅ / Récap ✅ / **Stripe** courant / 1ère fiche upcoming) + contenu Stripe Connect (Story 2.1) + CTAs "Continuer" / "Sauvegarder et reprendre plus tard".
- **Given** la step Stripe complétée (Story 2.1 — `details_submitted + charges_enabled + payouts_enabled = true`), **When** Pro clique "Continuer", **Then** il est redirigé vers `/seller/onboarding/first-listing` qui présente CTA "Créer ma première fiche" → redirect `/seller/listings/new` (Epic 3) avec banner "C'est votre 1ère fiche ! Une fois publiée, votre compte sera totalement actif".
- **Given** un Pro qui complète tout, **When** la fiche est publiée, **Then** identity-svc met à jour `ProProfile.onboardingCompletedAt = NOW()`, son JWT claim `tukio:status` passe à `verified-active` au prochain refresh, et il est redirigé vers `/seller/dashboard` avec une modale "Bienvenue chez Tukio !" + checklist V1+ (compléter portfolio, etc.).
- **Given** NFR48 (UX < 30 min post-validation admin), **When** je mesure le temps Pro post-`verified` jusqu'à fiche publiée, **Then** un Pro typique complète Stripe + 1ère fiche en < 20 min.

**Hors scope** (déplacé Story 1.3 v2) :
- Step "Profil" — remplacée par step "Identité" wizard conversion Story 1.3
- Step "Validation Tukio" — page pending standalone `/seller/onboarding/pending` Story 1.3
- Step "KYC docs" — step "Documents" wizard conversion Story 1.3
- Step "Récap" — step "Récap" wizard conversion Story 1.3

#### Story 2.3: Admin verification queue (`GET /v1/admin/verifications` + UI list)

**As an** Admin (modo / support),
**I want** to see a paginated queue of Pros in `pending_admin_review`,
**So that** I can process them in order with full context (oldest first by SLA).

**Acceptance Criteria :**

- **Given** un Admin authentifié sur `admin.tukio.one/fr/verifications`, **When** la page charge, **Then** identity-svc expose `GET /v1/admin/verifications?status=pending_admin_review&page=1&pageSize=20&sort=submittedAt:asc`, retourne enveloppe paginée `{ data: [{ id, companyName, siret, submittedAt, status, kycDocsCount, stripeStatus }], pagination, meta }`.
- **Given** la queue UI (UX-DR9 — **gap MVP critique à designer Sprint 0**), **When** elle render, **Then** elle utilise `<Card>`, `<Badge variant="warning">"En attente"</Badge>`, `<Avatar>`, et chaque ligne affiche : nom société, SIRET, soumis depuis (timestamp relatif), badge KYC docs (`3/3`), badge Stripe (`OK`/`En cours`), bouton "Examiner" → redirect vers Story 2.4.
- **Given** un Admin qui filtre par `submittedAt > 24h ago`, **When** le filter est appliqué, **Then** un badge rouge "SLA dépassé" apparaît sur les pros en retard (NFR48 — SLA validation 24h).
- **Given** la queue, **When** elle est vide (aucun pro pending), **Then** `<EmptyState variant="admin-queue-empty">` affiche "Aucune vérification en attente. Bon boulot !" (UX-DR16).
- **Given** la NFR82 (audit), **When** un Admin ouvre la queue, **Then** un événement `admin.queue-viewed.v1` n'est PAS publié (lecture sans audit), mais l'ouverture d'un pro spécifique (Story 2.4) déclenche audit log.
- **Given** RBAC, **When** un user `admin-support` accède la queue, **Then** il VOIT les pros mais ne peut PAS les valider (Story 2.5 vérifie le rôle `admin-modo` minimum). Un `admin-support` peut uniquement laisser une note de pré-screening.

#### Story 2.4: Admin KYC review detail screen + signed URL preview

**As an** Admin (modo / super),
**I want** to review a single Pro's KYC dossier (raison sociale, SIRET INSEE, RIB, ID, Stripe status, notes),
**So that** I can take an informed decision (validate or reject with reason).

**Acceptance Criteria :**

- **Given** un Admin sur la queue (Story 2.3), **When** il clique "Examiner" sur un Pro, **Then** il navigue vers `/admin/verifications/<proId>`, et identity-svc expose `GET /v1/admin/verifications/<id>` qui retourne enveloppe `{ data: { proProfile, kycDocs: [{ type, signedUrl, uploadedAt }], inseeSnapshot, stripeAccountSnapshot, history: [{ action, actor, at, reason? }] } }`.
- **Given** l'Admin sur la page detail (UX-DR10 — **gap MVP critique à designer Sprint 0**), **When** elle render, **Then** elle a 4 sections : (1) "Société" (companyName + SIRET cliquable vers INSEE snapshot), (2) "Documents KYC" (preview pièce d'identité, RIB, kbis si fourni — chacun en lightbox via signed URL), (3) "Stripe" (charges/payouts enabled badges, requirements_currently_due si non vide), (4) "Historique" (timeline actions admin).
- **Given** un signed URL pour un KYC doc, **When** Admin clique l'aperçu, **Then** media-svc génère un signed URL Cloudflare R2 valide 5 min, et l'Admin voit le PDF/JPG dans une modale.
- **Given** un Admin qui ferme le tab et revient 6 min plus tard, **When** il re-clique, **Then** un nouveau signed URL est généré (TTL court — NFR15).
- **Given** un Pro dont l'INSEE snapshot montre `etatAdministratifEtablissement = 'F'` (fermé), **When** l'Admin regarde, **Then** un banner rouge "Établissement fermé selon INSEE" apparaît + recommandation "Rejeter".
- **Given** un Pro dont le SIRET est valide MAIS l'adresse INSEE diffère de l'adresse soumise, **When** l'Admin regarde, **Then** un badge orange "Adresse INSEE différente" highlight les 2 adresses pour comparaison.
- **Given** la NFR82 (audit), **When** l'Admin ouvre la page detail, **Then** un événement `admin.verification.viewed.v1` est publié avec `{ adminId, proProfileId, at }` (audit RGPD — qui a vu quoi).

#### Story 2.5: Pro acceptation/rejet workflow + transitions de statut

**As an** Admin (modo / super),
**I want** to validate or reject a Pro's verification request with a structured reason,
**So that** the Pro gets clear feedback and his status transitions correctly.

**Acceptance Criteria :**

- **Given** un Admin sur la page detail (Story 2.4), **When** il clique "Valider", **Then** une modale demande confirmation simple "Confirmer la validation ?", et au confirm : identity-svc `POST /v1/admin/verifications/<id>/accept` (1) vérifie rôle `admin-modo` minimum, (2) update `ProProfile.status = 'verified'` + `verifiedAt = NOW()` + `verifiedBy = adminId`, (3) sync Keycloak custom claim `tukio:status='verified'`, (4) publie `identity.pro.verified.v1`, (5) audit log `admin.action.pro-verified.v1`, (6) répond enveloppe 200.
- **Given** un Admin qui clique "Rejeter", **When** une modale demande raison structurée (`<Select>` avec options `'siret_invalid' | 'kyc_doc_unreadable' | 'kyc_doc_missing' | 'company_not_found_insee' | 'duplicate_siret' | 'other'`) + `<Textarea>` raison libre obligatoire (≥ 20 chars), **Then** au confirm, identity-svc (1) update `ProProfile.status = 'rejected'` + `rejectedAt`, `rejectedBy`, `rejectionReason`, `rejectionMessage`, (2) sync Keycloak `tukio:status='rejected'`, (3) publie `identity.pro.rejected.v1`, (4) audit log `admin.action.pro-rejected.v1`.
- **Given** un Pro `verified`, **When** il refresh son JWT, **Then** son claim passe à `tukio:status='verified'` et il a accès à `/seller/listings/new` (Epic 3).
- **Given** un Pro `rejected`, **When** il se connecte, **Then** il atterrit sur `/seller/onboarding/rejected` qui affiche raison structurée + message libre + CTA "Refaire mon dossier" qui repasse `pending_admin_review` (re-uploads requis).
- **Given** la story validation, **When** notification-svc consomme `identity.pro.verified.v1`, **Then** il envoie l'email transactionnel `pro-verified.fr.tsx` ou `.en.tsx` "Votre compte Tukio Pro est validé !" avec CTA "Publier votre 1ère fiche".
- **Given** la story rejet, **When** notification-svc consomme `identity.pro.rejected.v1`, **Then** il envoie l'email `pro-rejected.fr.tsx` ou `.en.tsx` avec raison structurée traduite + message libre + CTA "Refaire mon dossier".
- **Given** un Admin qui essaie d'accepter un Pro déjà `verified` (race condition double-clic), **When** identity-svc reçoit le 2e POST, **Then** il retourne 409 enveloppe `IDENTITY-CONFLICT-004` "Pro déjà validé" (idempotence applicative).
- **Given** la NFR48 (24h SLA), **When** un Pro est `pending_admin_review` depuis > 24h, **Then** Prometheus alerte sur Slack `#tukio-alerts-ops`.

#### Story 2.6: 1ère fiche service intégrée dans le wizard onboarding

**As a** Pro fraîchement `verified`,
**I want** to publish my first listing directly from the onboarding wizard,
**So that** je suis officiellement actif sur la marketplace.

**Acceptance Criteria :**

- **Given** un Pro `verified` sur la step 4 du wizard, **When** il clique "Créer ma 1ère fiche", **Then** il navigue vers `/seller/listings/new?onboarding=true` qui affiche un banner "Dernière étape ! Publiez votre 1ère fiche pour activer votre compte".
- **Given** la création de fiche est gérée par Epic 3 (Catalog), **When** le Pro publie, **Then** Epic 3 publie `catalog.listing.published.v1`, et un consumer dans identity-svc met à jour `ProProfile.firstListingPublishedAt = NOW()`.
- **Given** la 1ère fiche publiée, **When** identity-svc check `ProProfile.onboardingCompletedAt`, **Then** il marque l'onboarding complété, publie `identity.pro.onboarding-completed.v1`, et le Pro est redirigé vers `/seller/dashboard` avec modale "Bienvenue !".
- **Given** un Pro `verified` qui n'a pas publié sa 1ère fiche depuis > 7 jours, **When** un cron `pro-onboarding-reminder.task.ts` tourne quotidiennement, **Then** il envoie un email rappel "Publiez votre 1ère fiche pour activer votre compte" (max 3 rappels J+7, J+14, J+21).
- **Given** UX-DR9, **When** je regarde le banner, **Then** il utilise `<Alert variant="info">` (Story 0.4) avec `<Button variant="primary">"Continuer"</Button>`.

#### Story 2.7: Audit trail toutes actions admin (table `audit_log` + immutabilité)

**As an** Admin Super,
**I want** every admin action logged in an immutable audit trail with `who, what, when, why, before/after`,
**So that** I have full traceability for compliance, internal investigations, and RGPD audits.

**Acceptance Criteria :**

- **Given** la table `audit_log` créée Story 1.10, **When** Story 2.7 ajoute la migration de durcissement, **Then** un trigger Postgres `audit_log_immutable_trigger` est créé qui rejette tout `UPDATE` ou `DELETE` (NFR82 — immutabilité applicative + DB), exception levée `42501 — audit log is immutable`.
- **Given** un Admin valide un Pro (Story 2.5), **When** identity-svc exécute le use case, **Then** il insère un row dans `audit_log` AVANT le commit transaction (cohérence — fait partie de la même transaction TypeORM).
- **Given** un dev essaie de bypass via `ALTER TABLE` ou désactiver le trigger, **When** la requête arrive, **Then** RLS Postgres `tukio_identity_admin` role n'a pas `ALTER` privilege sur `audit_log` (defense in depth).
- **Given** un Admin Super sur `/admin/audit`, **When** la page charge, **Then** il voit une liste paginée des dernières actions, avec filtres : `actor_id`, `action_type`, `aggregate_type`, `date range`. (UI Epic 6 mais data exposée par identity-svc dès Epic 2).
- **Given** la NFR1 (RGPD — droit d'accès aux données), **When** un user demande l'historique des actions admin sur son compte, **Then** identity-svc expose `GET /v1/me/admin-actions` qui retourne la liste filtrée sur `aggregate_id = userId` (action_type, at, raison rendue intelligible côté UI — pas l'identité de l'admin).
- **Given** la rétention NFR1, **When** un audit log a > 5 ans, **Then** un cron `purge-audit-log.task.ts` archive les rows vers Cloudflare R2 chiffré + supprime de la DB chaude (compliance).

#### Story 2.8: Pro verification reminder + auto-rejection après 30 jours d'inactivité

**As a** product owner,
**I want** Pros stuck in `pending_admin_review` to be auto-rejected after 30 days of inactivity,
**So that** la queue admin reste propre et les Pros qui hésitent sont relancés ou nettoyés.

**Acceptance Criteria :**

- **Given** un cron `pro-pending-reminder.task.ts` qui tourne quotidiennement, **When** un Pro est `pending_admin_review` depuis 7 jours sans avoir complété Stripe, **Then** notification-svc envoie un email rappel "Complétez votre dossier sous 23 jours ou il sera fermé" + lien vers `/seller/onboarding`.
- **Given** un Pro relancé J+7, **When** il ne complète toujours rien J+30, **Then** identity-svc auto-rejette son compte avec `rejectionReason = 'inactivity'`, publie `identity.pro.auto-rejected.v1`, et notification-svc envoie un email "Votre dossier a été fermé pour inactivité. Vous pouvez le rouvrir à tout moment." + CTA "Recréer mon compte".
- **Given** un Pro auto-rejeté, **When** il se reconnecte, **Then** son état est `rejected` avec raison `inactivity` (différenciable d'un rejet Admin), et il peut relancer un dossier directement (skip création de compte).
- **Given** la NFR82 (audit), **When** un cron auto-rejette, **Then** le row `audit_log` a `actor_id = NULL` + `actor_role = 'system'` + `action_type = 'auto_reject_inactivity'` (traçabilité même pour les actions automatiques).
- **Given** un Admin qui consulte la queue, **When** il filter `status = 'rejected'`, **Then** il distingue les rejets manuels (avec actor_id Admin) des auto-rejets (system).

**Epic 2 — Total stories : 8**

---

### Epic 3: Catalog Publication & Discovery

**Outcome utilisateur** : un Pro `verified` publie une fiche Service en < 15 min (3-15 photos, titre/description FR obligatoire + EN optionnel, tarification unité/forfait, zone livraison). Un Visitor découvre les services via search (catégorie + ville + date) + filtres facettes, en moins de 150 ms p95. Couvre les 2 catégories pilotes MVP (tentes/chapiteaux + mobilier événementiel).

**FRs covered MVP** : FR18, FR19, FR20, FR21, FR22 partiel (page catégorie générale MVP, page locale V1), FR23, FR24, FR25 partiel (unité + forfait MVP, devis V1), FR26, FR30, FR31, FR32, FR33, FR99, FR103
**FRs déférés V1+** : FR22 (pages locales auto), FR27 (vidéo embed), FR28 (calendrier dispo), FR29 (InventoryPool partagé), FR101 (traduction auto DeepL)
**NFRs covered** : NFR1 (search p95 < 150 ms), NFR3 (fiche < 1,5 s LCP), NFR5 (Core Web Vitals SEO), NFR60 (Meilisearch par locale), NFR58 (URLs EN, hreflang), NFR50/54 (a11y), NFR71 (test coverage)
**UX-DRs covered** : `home`, `search`, `service`, `pro-profile` (4 écrans bundle figés)
**Intégrations** : Meilisearch Cloud, Cloudflare Images, Cloudflare R2, DeepL `[V1]`

#### Story 3.1: Catalog data model + 2 catégories pilotes seed

**As a** product owner,
**I want** the catalog data model implemented (Category, Subcategory, Service Type taxonomy) with the 2 pilot categories seeded for Pays de la Loire MVP,
**So that** Pros can create listings under structured categories and Visitors can browse.

**Acceptance Criteria :**

- **Given** la migration TypeORM dans `catalog-svc/migrations/`, **When** elle s'exécute, **Then** elle crée les tables : `category` (`id, slug, parent_id NULL, sort_order, mvp_pilot bool`), `category_translations` (`category_id, locale, name, description, meta_title, meta_description`), `service_type` (`id, category_id, slug, default_pricing_mode enum`), `service_type_translations`. Index unique `(category_id, locale)` et `(slug)` global.
- **Given** le seed `infra/scripts/seed-categories.ts`, **When** je l'exécute, **Then** les 2 catégories pilotes MVP sont créées : `tents-marquees` (root) avec sous-cat `chapiteaux`, `barnums`, `tentes-stretch`, `pagodes`, et `event-furniture` (root) avec sous-cat `tables`, `chairs`, `bar-furniture`, `lounge-furniture`. Chacune a ses translations FR + EN.
- **Given** un slug catégorie, **When** un Visitor charge `/fr/category/tents-marquees`, **Then** `category.slug` est en EN strict (NFR58, override K-05) et le titre rendu est traduit FR via `category_translations` (`Chapiteaux & barnums`).
- **Given** la cohérence avec `@tukio/contracts`, **When** je regarde `packages/contracts/src/dtos/catalog.dto.ts`, **Then** le DTO `CategoryDto` expose `{ id, slug, parentId, name, description, listingsCount }` avec `name`/`description` localisés selon `Accept-Language`.
- **Given** le seed catégories, **When** un Admin Super accède `/admin/categories` (V1+ UI), **Then** il pourra modifier les translations (hors-MVP, mais data model prêt).

#### Story 3.2: catalog-svc Pretre implementation (domain `Listing`, `Pricing`, `ServiceArea`, `Photo` value-objects)

**As a** backend developer,
**I want** catalog-svc implemented with Pattern Pretre Clean Architecture covering the Listing aggregate and its value-objects,
**So that** all Epic 3 use cases are backed by testable domain code.

**Acceptance Criteria :**

- **Given** `apps/catalog-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{listing.ts (aggregate root), value-objects/{title-multilang.vo.ts, description-multilang.vo.ts, pricing.vo.ts, service-area.vo.ts, photo.vo.ts, slug.vo.ts}, category.ts (entity), service-type.ts}`, `ports/{listing-repository.ts, category-repository.ts, search-indexer.ts, photo-storage.ts, event-publisher.ts, median-price-calculator.ts}`, `service/{listing-publication.service.ts}` (logique auto-publish FR30 + soft-warning FR32), `exception/{catalog.exception.ts}`.
- **Given** `Pricing` value-object, **When** je l'instancie avec `mode='unit'`, **Then** elle accept `{ amount, currency, unit, minQuantity?, maxQuantity? }` — et avec `mode='package'`, accept `{ amount, currency, packageDescription }` (FR25 MVP).
- **Given** `TitleMultilang`/`DescriptionMultilang`, **When** je les instancie sans FR, **Then** ils throw `CatalogValidationException('Le titre/description FR est obligatoire')` (FR99).
- **Given** `ServiceArea`, **When** je l'instancie avec `{ deliveryRadiusKm: 50, originPostalCode: '44000', minLeadTimeDays: 3 }`, **Then** elle valide rayon km > 0 et `minLeadTimeDays >= 1` (FR26).
- **Given** `Photo` value-object, **When** je l'instancie sans `r2Key` et `cloudflareImageId`, **Then** elle throw (chaque photo doit avoir un originale R2 et une variante CF Images).
- **Given** `apps/catalog-svc/src/usecases/`, **When** je l'ouvre, **Then** je trouve : `create-listing.usecase.ts`, `publish-listing.usecase.ts`, `update-listing.usecase.ts`, `unpublish-listing.usecase.ts`, `delete-listing.usecase.ts`, `get-listing-detail.usecase.ts`, `list-pro-listings.usecase.ts`, `compute-median-price.usecase.ts`.
- **Given** lint boundaries, **When** la CI tourne sur `apps/catalog-svc/`, **Then** elle vérifie qu'aucun fichier `domain/` n'importe Meilisearch SDK, axios, ou `@nestjs/*`.

#### Story 3.3: Pro create listing wizard frontend (multi-step : infos + photos + tarifs + zone)

**As a** Pro `verified`,
**I want** a multi-step wizard to create my listing in < 15 min,
**So that** I can publish without confusion and don't lose progress if I navigate away.

**Acceptance Criteria :**

- **Given** un Pro `verified` sur `/seller/listings/new`, **When** la page render, **Then** elle affiche `<StepIndicator steps={['Infos','Photos','Tarifs','Zone & délais','Aperçu']} current={1} />` et le step 1 propose `<Select>` Catégorie + Sous-catégorie, `<Input>` Titre FR (max 80 chars), `<Input>` Titre EN optionnel, `<Textarea>` Description FR (max 2000 chars), `<Textarea>` Description EN optionnelle.
- **Given** le step 1, **When** le Pro entre Title FR vide, **Then** la validation Zod inline bloque "Titre FR obligatoire" (FR99) et l'EN est marqué optionnel "Si vide, les visiteurs EN verront la version FR avec un badge".
- **Given** le step 2 "Photos", **When** le Pro upload < 3 photos, **Then** le bouton "Suivant" est disabled avec message "3 photos minimum" (FR23). Au-delà de 15 photos, l'upload est bloqué.
- **Given** le step 3 "Tarifs", **When** le Pro choisit `mode = 'unit'`, **Then** il voit `<Input>` Prix unitaire + `<Input>` Unité (ex: "par jour") + `<Input>` Quantité min/max optionnels. Si `mode = 'package'`, il voit `<Input>` Prix forfaitaire + `<Textarea>` Description forfait (FR25).
- **Given** le step 3, **When** le prix saisi dévie > 50 % de la médiane catégorie, **Then** un soft-warning `<Alert variant="warning">` "Votre prix dévie de X % de la médiane catégorie. Continuer ?" apparaît (FR32 — pas blocage strict).
- **Given** le step 4 "Zone & délais", **When** le Pro saisit `originPostalCode` + `deliveryRadiusKm` (slider 5-200 km) + `minLeadTimeDays` (1-30), **Then** une carte minimale (Map placeholder V1) montre la zone (FR26).
- **Given** le step 5 "Aperçu", **When** le Pro voit le rendu final, **Then** il a un toggle FR/EN preview, un CTA "Publier" et un CTA "Sauvegarder en brouillon". À chaque changement de step, draft auto-save côté backend (debounced 2 s).
- **Given** un Pro qui ferme l'onglet en plein wizard, **When** il revient sur `/seller/listings/new`, **Then** un banner "Reprendre votre brouillon ?" propose de continuer (draft TTL 7 jours). Sinon, il peut start fresh.
- **Given** UX-DR12 (gap MVP — design wizard service), **When** je regarde le rendu, **Then** il s'inspire de `service.jsx` du bundle pour la prévisualisation Step 5.
- **Given** NFR48 (UX < 15 min), **When** je mesure le temps Pro de bout-en-bout, **Then** un Pro typique avec ses photos prêtes complète l'ensemble en < 15 min.

#### Story 3.4: Photo upload + Cloudflare Images integration (`POST /v1/listings/photos`)

**As a** Pro,
**I want** to upload 3-15 photos with automatic resize + WebP/AVIF conversion + CDN delivery,
**So that** ma fiche charge rapidement même avec des photos haute résolution.

**Acceptance Criteria :**

- **Given** un Pro qui drop 5 photos dans `<FileUpload>` (Story 0.5), **When** chaque photo est sélectionnée, **Then** Next.js valide côté client : `image/jpeg | image/png | image/webp | image/heic`, max 10 MB par photo, ratio 4:3 ou 16:9 recommandé.
- **Given** la validation OK, **When** le frontend appelle `POST /v1/listings/photos/upload-url` (axios via `@tukio/api-client`), **Then** media-svc génère un signed PUT URL Cloudflare R2 (TTL 5 min), retourne enveloppe `{ uploadUrl, r2Key, photoTempId }`. Le frontend PUT directement sur R2 (zéro charge backend).
- **Given** le PUT R2 réussi, **When** le frontend appelle `POST /v1/listings/photos/finalize` avec `{ r2Key, photoTempId }`, **Then** media-svc upload R2 → Cloudflare Images via `cf.images.upload({ url: r2SignedReadUrl })`, persiste `{ id, listingId?, r2Key, cloudflareImageId, variants: ['thumbnail', 'card', 'detail'], altText? }` dans `tukio_media`, et retourne `{ photoId, urls: { thumbnail, card, detail } }`.
- **Given** une fiche en draft, **When** le Pro réordonne ses photos par drag & drop, **Then** Next.js call `PATCH /v1/listings/{id}/photos/reorder` avec `{ photoIds: [...] }` qui update la propriété `sort_order` (transactionnel).
- **Given** un Pro qui retire une photo, **When** il clique X, **Then** Next.js call `DELETE /v1/listings/photos/{id}`, media-svc soft-delete (purge R2 + CF Images via cron 7j post-delete), publie `media.photo.deleted.v1`.
- **Given** la NFR3 (LCP < 2,5 s), **When** un Visitor charge la fiche service, **Then** la 1ère photo est servie en `<picture>` avec WebP/AVIF + JPG fallback, lazy-load via `loading="lazy"` sauf pour la hero photo (LCP candidate).
- **Given** la NFR50 (a11y), **When** le Pro upload une photo, **Then** un champ `alt text` (max 125 chars) est demandé inline (optionnel mais fortement recommandé via tooltip "Décrivez l'image pour les utilisateurs malvoyants").
- **Given** un fichier malicieux (ex: PHP renommé .jpg), **When** il passe le check côté client, **Then** Cloudflare Images rejette à l'upload (validation magic bytes côté CF) et media-svc renvoie 422 enveloppe.

#### Story 3.5: Listing publish workflow + auto-publish (FR30) + median price calculation (FR31, FR32)

**As a** Pro,
**I want** to publish my listing with auto-validation if I'm trusted (verified > 30 days, < 3 reports),
**So that** my listing is live immediately without admin friction; otherwise it goes to moderation a posteriori.

**Acceptance Criteria :**

- **Given** un Pro qui clique "Publier" depuis le wizard, **When** Next.js call `POST /v1/listings/{id}/publish`, **Then** catalog-svc (1) valide intégrité (3+ photos, FR99 title FR, prix > 0, zone définie), (2) appelle `MedianPriceCalculator.compute(categoryId)` qui retourne la médiane des listings publiés de la catégorie, (3) calcule deviation (`abs(price - median) / median > 0.5` → soft-warning `metadata.priceDeviation = true`), (4) appelle `ListingPublicationService.shouldAutoPublish(proProfileId)` qui vérifie `verifiedAt < NOW() - 30 days` ET `reportsCount < 3` ET `proProfile.status = 'verified'`.
- **Given** un Pro éligible auto-publish (FR30), **When** publish, **Then** listing.status = `published`, `publishedAt = NOW()`, publie `catalog.listing.published.v1`, et la fiche est visible immédiatement sur `/fr/services/<slug>`.
- **Given** un Pro non éligible (verified < 30 jours OU > 3 reports), **When** publish, **Then** listing.status = `pending_moderation`, publie `catalog.listing.submitted-for-moderation.v1` (Epic 6 admin queue), et le Pro voit "Votre fiche sera publiée après vérification (~24h)".
- **Given** un Pro qui sauvegarde en draft, **When** il clique "Sauvegarder", **Then** listing.status = `draft`, accessible uniquement via `/seller/listings/<id>/edit` (pas indexée Meilisearch).
- **Given** la median price (FR31), **When** un cron `compute-medians.task.ts` tourne quotidiennement, **Then** il recalcule `median_price_eur_per_unit` pour chaque (categoryId, pricingMode) et met à jour `category.median_price` dans `tukio_catalog` (lecture optimisée).
- **Given** la NFR1 (RGPD), **When** un Visitor consulte la médiane d'une catégorie via `/fr/category/<slug>`, **Then** elle est affichée publiquement (FR31 — transparence client) sans identifier les pros sources.

#### Story 3.6: Edit / Unpublish / Delete listing flow

**As a** Pro,
**I want** to edit, unpublish, or delete my published listings,
**So that** je gère mon catalogue au fil du temps.

**Acceptance Criteria :**

- **Given** un Pro sur `/seller/listings`, **When** la page render, **Then** il voit une liste paginée de ses listings avec status badge (`Brouillon`, `En modération`, `Publié`, `Dépubliée`), CTA `Éditer`, `Dupliquer`, `Dépublier` (si publié), `Supprimer` (si draft ou dépubliée).
- **Given** un Pro qui clique "Éditer" sur une fiche publiée, **When** il modifie et re-publie, **Then** catalog-svc applique les mêmes règles que Story 3.5 (auto-publish ou moderation selon profil), publie `catalog.listing.updated.v1`, et update Meilisearch (Story 3.7).
- **Given** un Pro qui clique "Dépublier", **When** il confirme dans une modale destructrice, **Then** listing.status = `unpublished`, `unpublishedAt = NOW()`, listing retiré de Meilisearch, publie `catalog.listing.unpublished.v1` (consumer Epic 4 vérifie qu'aucune résa active n'est en cours sinon refuse).
- **Given** un Pro qui essaie de dépublier une fiche avec une résa `confirmed` à venir, **When** il clique, **Then** la modale affiche "X résa(s) à venir bloquent la dépublication" + CTA "Voir les résas". Pas de blocage technique strict mais UX warning fort.
- **Given** un Pro qui clique "Supprimer" sur un draft, **When** il confirme, **Then** catalog-svc soft-delete listing + photos (Story 3.4 retire de R2 + CF Images via cron 7j), publie `catalog.listing.deleted.v1`.
- **Given** un Pro qui essaie de delete une fiche publiée, **When** il clique, **Then** message "Dépubliez d'abord" — soft delete uniquement si jamais publiée (préserve historique transactionnel).
- **Given** UX-DR15 (seller listings page — gap MVP), **When** la page render, **Then** elle utilise `<Card>` + `<Badge>` + actions menu (Story 0.4).

#### Story 3.7: Meilisearch index per locale + outbox-driven sync (FR33, FR103)

**As a** developer,
**I want** Meilisearch indexes (`listings_fr` and `listings_en`) auto-synced via outbox events,
**So that** la search est cohérente sans race conditions et résiliente aux pannes Meilisearch.

**Acceptance Criteria :**

- **Given** `infra/meilisearch/setup-indexes.ts`, **When** je l'exécute, **Then** Meilisearch crée 2 index : `listings_fr` (settings : searchableAttributes `[title, description, categoryName, proName]`, filterableAttributes `[categorySlug, postalCode, deliveryRadiusKm, priceUnit, priceMin, priceMax, capacity, status]`, sortableAttributes `[publishedAt, priceUnit, distance]`) et `listings_en` (idem).
- **Given** un consumer NATS dans catalog-svc `listing-search-indexer.consumer.ts`, **When** il consomme `catalog.listing.published.v1`, **Then** il indexe le listing dans `listings_fr` et (si translation EN existe) dans `listings_en`. Si EN absent, il index dans `listings_en` avec contenu FR + flag `_fallback_locale: 'fr'` (NFR60 — fallback FR pour Visitor EN).
- **Given** un consumer qui consomme `catalog.listing.unpublished.v1` ou `catalog.listing.deleted.v1`, **When** il s'exécute, **Then** il `delete` du listing des 2 index Meilisearch.
- **Given** la NFR1 (search p95 < 150 ms), **When** Meilisearch est sollicité avec un query typique, **Then** la latence p95 < 150 ms en staging et production.
- **Given** une panne Meilisearch (timeout > 5 s), **When** un consumer essaie d'indexer, **Then** il retry avec backoff exponentiel (3 tries), puis met l'event en DLQ NATS (`dlq.catalog.listing-indexer`) — pas de perte (NFR42, NFR46).
- **Given** un cron `meilisearch-reconcile.task.ts` qui tourne hebdomadaire, **When** il tourne, **Then** il compare DB `tukio_catalog` vs Meilisearch indexes, et reconcilie les écarts (purge orphelins, re-index manquants). Coverage NFR46 — la search peut être reconstruite sans recoverabilité de prod.

#### Story 3.8: Search frontend (barre recherche cat + ville + date) — FR18

**As a** Visitor,
**I want** to search by category + city + date from a prominent search bar on the home,
**So that** je trouve rapidement les services dispo pour mon événement.

**Acceptance Criteria :**

- **Given** la home `/fr/`, **When** elle render, **Then** elle utilise `home.jsx` du bundle Cloud Design (figé) avec une `<SearchBar>` à 3 champs : `<Select>` Catégorie (dropdown des 2 catégories MVP), `<Input>` Ville (autocomplete via `/v1/geo/cities?q=` — endpoint geo-svc V1, pour MVP : input libre + INSEE postal_codes lookup), `<DatePicker>` Date événement (range V1, single date MVP).
- **Given** un Visitor qui clique "Rechercher" avec `categoryId=tents-marquees`, `city=Nantes`, `date=2026-08-15`, **When** Next.js navigue vers `/fr/search?category=tents-marquees&city=nantes&postalCode=44000&date=2026-08-15`, **Then** la page search appelle `GET /v1/search/listings?...` (gateway-api forward à catalog-svc) qui interroge Meilisearch `listings_fr` avec filters appropriés.
- **Given** la résolution de la ville en postal code, **When** "Nantes" est entré, **Then** la query Meilisearch filtre `postalCode` IN `[44000, 44100, 44200, 44300]` (codes postaux de Nantes intra-muros — NFR79 INSEE base postale).
- **Given** un user qui scroll les résultats, **When** la liste atteint la fin, **Then** infinite scroll TanStack Query `useInfiniteQuery` charge la page suivante (pageSize=20).
- **Given** la NFR58 (URLs EN strict), **When** un Visitor anglais search "tents Nantes", **Then** l'URL est `/en/search?category=tents-marquees&city=nantes&postalCode=44000&date=2026-08-15` (paths EN, query params EN).
- **Given** UX-DR16 (empty state), **When** la search ne retourne aucun résultat, **Then** `<EmptyState variant="search-no-results">` affiche "Aucun service ne correspond. Essayez d'élargir votre zone ou changer de date" + CTA "Effacer les filtres".

#### Story 3.9: Filters / facettes + search results page (FR19)

**As a** Visitor,
**I want** to refine search results with filters (capacity, price range, options, distance),
**So that** je trouve exactement le service qui correspond à mes besoins.

**Acceptance Criteria :**

- **Given** la page `/fr/search?...`, **When** elle render, **Then** elle a une sidebar `<FilterSidebar>` (Story 0.5) avec : `<Slider>` Prix min/max (auto-bounded sur la médiane catégorie ±100 %), `<RangeSlider>` Distance livraison (5-200 km), `<Checkbox group>` Capacité ('< 50', '50-100', '100-200', '> 200'), `<Checkbox group>` Options (selon facettes catégorie). Mobile : sidebar devient bottom-sheet via `<Drawer>`.
- **Given** un Visitor qui change un filter, **When** il toggle "Prix max < 800 €", **Then** Next.js update URL query params (`?priceMax=800`) sans re-fetch full page (shallow routing), et appelle Meilisearch avec le nouveau filter, met à jour les résultats (transition animée — `prefers-reduced-motion` respecté).
- **Given** la NFR1 (search p95 < 150 ms), **When** un user enchaîne plusieurs changements de filters, **Then** chaque requête Meilisearch + render Next.js < 150 ms p95 (debounce 300 ms côté client pour éviter spam).
- **Given** la page results, **When** elle render, **Then** chaque résultat est `<Card>` avec photo hero CF Images variant `card`, titre Fraunces, prix (unité ou forfait avec label), badge ville + distance, badge capacité, étoiles avis (si reviews — Epic 5), CTA "Voir la fiche".
- **Given** un Visitor qui survole une carte, **When** il hover, **Then** la photo bascule en variant `detail` haute résolution (preload smart) — NFR3.
- **Given** UX-DR `search` (bundle figé), **When** je compare le rendu, **Then** il match le screen `search.jsx` (figé).
- **Given** la NFR58 hreflang, **When** un Visitor en `en` regarde la SERP, **Then** `<link rel="alternate" hreflang="fr" href="/fr/search?...">` est injecté.

#### Story 3.10: Listing detail public page (fiche service complète) — FR20

**As a** Visitor,
**I want** to view a complete service detail page (title, photos, description, pricing, options, delivery, reviews, cancel policy),
**So that** je décide en confiance avant de réserver.

**Acceptance Criteria :**

- **Given** un Visitor qui clique une carte search, **When** Next.js navigue vers `/fr/services/<slug>` (slug auto-généré depuis titre FR via slugify, unique), **Then** la page (RSC + dynamic rendering) appelle `GET /v1/services/<slug>` qui retourne enveloppe `{ data: { listing, pro: { id, slug, name, avatar, rating }, reviews: { aggregates, sample: 3 } } }`.
- **Given** la fiche, **When** elle render, **Then** elle reproduit `service.jsx` du bundle Cloud Design (figé) : galerie photos hero (slider mobile, mosaic desktop), titre Fraunces, prix tarifs unité/forfait (`<PricingDisplay>` Story 0.5), description, zone livraison + délai min, calendar dispo placeholder (V1 FR28), section "Politique d'annulation", section "Avis clients" (Story 5.5 Epic 5), CTA primaire "Réserver" (Epic 4) sticky desktop / fixed bottom mobile.
- **Given** la NFR3 (LCP < 2,5 s), **When** la fiche charge, **Then** la photo hero est preload via `<link rel="preload" as="image">`, et le LCP candidate est cette photo (mesuré Lighthouse CI Story 0.11).
- **Given** la NFR5 (SEO Core Web Vitals), **When** Googlebot crawle, **Then** la fiche a metadata `<title>` + `<meta description>` traduits via `category_translations` + `<script type="application/ld+json">` JSON-LD `Product` ou `Service` schema.org avec `name, description, image, offers, brand: pro.name, aggregateRating`.
- **Given** un Visitor `en` qui charge `/en/services/<slug>` et le listing n'a pas de translation EN, **When** la page render, **Then** un badge `<Badge variant="info">"Available in French only"</Badge>` apparaît et le contenu est affiché en FR (FR99 fallback).
- **Given** la NFR58 hreflang, **When** un Visitor charge la fiche, **Then** `<link rel="alternate" hreflang="fr" href="/fr/services/<slug>">` et `hreflang="en" href="/en/services/<slug>">` sont injectés.
- **Given** un slug listing dépublié, **When** un Visitor accède l'URL, **Then** Next.js retourne 410 Gone avec `<ErrorPage variant="listing-unavailable">` qui propose des suggestions de listings similaires (Meilisearch query par catégorie + ville).

#### Story 3.11: Pro public profile page (FR21)

**As a** Visitor,
**I want** to view a Pro's public profile (bio, services list, aggregate reviews),
**So that** I can assess his reputation and browse his other services.

**Acceptance Criteria :**

- **Given** un Visitor qui clique le nom du Pro sur une fiche service, **When** Next.js navigue vers `/fr/pro/<slug>` (slug auto-généré depuis companyName, unique), **Then** la page (RSC) appelle `GET /v1/pros/<slug>` qui retourne enveloppe `{ data: { pro: { id, slug, name, bio, avatar, location, verifiedSince }, listings: [...], reviewsAggregate: { average, count, distribution } } }`.
- **Given** la page render, **When** je compare au bundle, **Then** elle reproduit `pro-profile.jsx` (figé) : avatar + nom Fraunces + badge "Vérifié depuis MM/YYYY" + rating étoiles, section "À propos" (bio MVP — FR11 portfolio V1), section "Services proposés" (grid de cards = ses listings publiés), section "Avis clients" (3 derniers avec lien "Voir tous les avis").
- **Given** un Visitor qui clique un service du pro, **When** il navigue, **Then** il atterrit sur la fiche détail (Story 3.10) — même rendu que via search.
- **Given** un Pro `unpublished` ou `deleted` (RGPD Story 1.9), **When** un Visitor accède son slug, **Then** Next.js 410 Gone avec `<ErrorPage>` "Ce profil n'est plus disponible" + CTA retour catégorie.
- **Given** la NFR58 hreflang, **When** un Visitor charge le profil pro, **Then** `<link rel="alternate" hreflang="fr|en" href="/{locale}/pro/<slug>">` injecté.
- **Given** la NFR5 SEO, **When** Googlebot crawle, **Then** JSON-LD `Organization` + `aggregateRating` schema.org est injecté.

#### Story 3.12: Category general page + median price display (FR22 MVP, FR31)

**As a** Visitor,
**I want** to browse a category page with all available services and see the median price,
**So that** je découvre les options et juge si mon budget est réaliste.

**Acceptance Criteria :**

- **Given** un Visitor sur `/fr/category/tents-marquees`, **When** la page render, **Then** elle appelle `GET /v1/categories/<slug>` qui retourne enveloppe `{ data: { category: { name, description, medianPrice, listingsCount }, listings: [...] (paginé), subcategories: [...] } }`.
- **Given** la page render, **When** je regarde le H1, **Then** il affiche le `category.name` localisé (Fraunces) + sous-titre "X services disponibles dans votre région" + badge `<PricingDisplay variant="median">` "Prix médian : ~XXX €" (FR31).
- **Given** un Visitor qui scroll, **When** il voit les cards listings (rendu identique à search), **Then** chaque card a un badge "deviation" si `priceDeviation = true` (couleur warning si dévie > 50 % — FR32 transparence).
- **Given** la NFR5 SEO, **When** la page render, **Then** elle a metadata pré-générée (`generateMetadata` Next.js 15) basée sur `category_translations.meta_title` + `meta_description`, JSON-LD `ItemList` schema.org listant les top listings.
- **Given** la page locale catégorie × ville (`/fr/category/<slug>/<city>`) — FR22 V1, **When** un Visitor accède l'URL en MVP, **Then** Next.js retourne 404 avec suggestion vers la page catégorie générale (déféré V1).
- **Given** la NFR58 paths EN, **When** je regarde l'URL, **Then** `/fr/category/tents-marquees` (slug EN) ou `/en/category/tents-marquees` (override K-05).

**Epic 3 — Total stories : 12**

---

### Epic 4: Booking, Cart & Payment Saga (mono-vendor MVP)

**Outcome utilisateur** : un Customer réserve un Service en < 4 min (cart → checkout Stripe Elements), le Pro reçoit la demande, accepte sous 48h, capture différée Stripe, événement consommé puis reversement automatique J+1 après prestation. Saga distribuée booking → order → payment fonctionnelle, résiliente aux pannes, monitoring + alertes Slack si stuck > 5 min.

**FRs covered MVP** : FR34, FR35, FR36, FR37, FR38, FR42, FR43, FR45, FR47, FR48, FR49, FR53, FR54, FR56, FR61, FR63, FR64, FR65
**FRs déférés V1+** : FR44 (devis), FR46 (modification résa), FR50 (saved card), FR51 (échéancier 30/70), FR52 (factures client UI), FR55 (export CSV/PDF), FR62 (disputes Stripe UI évoluée)
**NFRs covered** : R5 (race conditions 3 layers), R11 (saga monitoring + alerts > 5 min), NFR3 (checkout < 1 s), NFR6 (capture < 800 ms p95), NFR40-46 (reliability + saga resilience), NFR22-23 (mandat 289 CGI + 3 cas TVA), NFR82 (audit), NFR1 (RGPD anti-désintermédiation)
**UX-DRs covered** : `checkout`, `confirmation`, `bookings-list`, `booking-detail`, `cancel-flow`, `seller-bookings` (6 écrans bundle figés), UX-DR11 (seller payouts page MVP critique — gap Sprint 0)
**Intégrations** : Stripe Connect Express, Redis Upstash, NATS JetStream

#### Story 4.1: booking-svc Pretre + `Booking` aggregate + saga state machine (FR47)

**As a** backend developer,
**I want** booking-svc with Pattern Pretre + a Booking aggregate enforcing the 5-status lifecycle as an explicit state machine,
**So that** invalid transitions are impossible at the domain level and the saga is testable.

**Acceptance Criteria :**

- **Given** `apps/booking-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{booking.ts (aggregate root), value-objects/{booking-id.vo.ts, booking-status.vo.ts, booking-period.vo.ts, capture-policy.vo.ts}, booking-line.ts (entity)}`, `ports/{booking-repository.ts, listing-snapshot-port.ts, availability-lock-port.ts (Redis), event-publisher.ts}`, `service/{booking-state-machine.service.ts}`, `exception/{booking.exception.ts, invalid-transition.exception.ts}`.
- **Given** `BookingStateMachine`, **When** un Booking est en status `pending_pro_acceptance` et reçoit l'event `accept`, **Then** il transite vers `confirmed` (via `BookingStateMachine.transition('pending_pro_acceptance', 'accept')` → `'confirmed'`). Toute transition invalide (ex: `cancelled` → `confirmed`) throw `InvalidTransitionException`.
- **Given** les 5 statuts du lifecycle (FR47), **When** je liste les transitions valides, **Then** elles sont : `request → pending_pro_acceptance` (auto sur paiement OK), `pending_pro_acceptance → confirmed` (Pro accepte) | `pending_pro_acceptance → refused` (Pro refuse OU expiration 48h) | `pending_pro_acceptance → cancelled` (Customer annule), `confirmed → completed` (cron post-event J+1) | `confirmed → cancelled` (Customer annule selon politique).
- **Given** chaque transition, **When** elle s'exécute, **Then** un `BookingStatusChanged` domain event est appendé à `Booking.uncommittedEvents`, contenant `{ from, to, at, actor, reason? }` — et publié vers NATS via outbox (`booking.<status>.v1`).
- **Given** un usecase `book-listing.usecase.ts`, **When** il s'exécute, **Then** il (1) appelle `availabilityLock.acquire(listingId, period, 30s)` (Redis SET NX), (2) appelle `listingSnapshot.fetch(listingId)` pour figer le prix au moment du booking (anti-changement de prix après réservation), (3) crée le `Booking` aggregate, (4) commit transaction TypeORM + outbox event `booking.requested.v1`.
- **Given** `apps/booking-svc/src/usecases/`, **When** je l'ouvre, **Then** je trouve : `book-listing.usecase.ts`, `accept-booking.usecase.ts`, `refuse-booking.usecase.ts`, `cancel-booking.usecase.ts (customer)`, `auto-expire-booking.usecase.ts (cron 48h)`, `complete-booking.usecase.ts (cron post-event)`, `list-customer-bookings.usecase.ts`, `list-pro-bookings.usecase.ts`, `get-booking-detail.usecase.ts`.
- **Given** un test unitaire `booking.aggregate.spec.ts`, **When** il s'exécute, **Then** chaque transition est couverte (≥ 80 % coverage NFR71).

#### Story 4.2: order-svc + payment-svc Pretre implementations + saga consumers

**As a** backend developer,
**I want** order-svc and payment-svc implemented with Pattern Pretre, each handling its part of the choreographed saga via NATS event consumers,
**So that** the saga is decoupled, resilient, and each service owns its data.

**Acceptance Criteria :**

- **Given** `apps/order-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{order.ts (aggregate, lié au Booking), invoice.ts (entity), invoice-line.ts, value-objects/{order-status.vo.ts, vat-treatment.vo.ts, currency-amount.vo.ts}}`, `ports/{order-repository.ts, invoice-repository.ts, vat-calculator-port.ts, pdf-generator-port.ts, event-publisher.ts}`.
- **Given** `apps/order-svc/src/usecases/`, **When** je l'ouvre, **Then** je trouve : `create-order-from-booking.usecase.ts` (consumer `booking.requested.v1`), `confirm-order.usecase.ts` (consumer `booking.confirmed.v1` + `payment.captured.v1`), `cancel-order.usecase.ts` (consumer `booking.cancelled.v1` + `booking.refused.v1`), `generate-invoices.usecase.ts` (post-confirm).
- **Given** `apps/payment-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{payment-intent.ts, refund.ts, transfer.ts, payout.ts, value-objects/{payment-status.vo.ts, capture-policy.vo.ts}}`, `ports/{payment-intent-repository.ts, stripe-gateway-port.ts, event-publisher.ts}`, `service/{commission-calculator.service.ts}`.
- **Given** `apps/payment-svc/src/usecases/`, **When** je l'ouvre, **Then** je trouve : `create-payment-intent.usecase.ts` (consumer `booking.requested.v1`), `capture-payment.usecase.ts` (consumer `booking.confirmed.v1`), `cancel-payment.usecase.ts` (consumer `booking.refused.v1` + `booking.cancelled.v1` selon policy), `refund-payment.usecase.ts` (admin Story 4.12), `transfer-to-pro.usecase.ts` (cron J+1 Story 4.10), `process-stripe-webhook.usecase.ts`.
- **Given** chaque service consumer NATS, **When** il consomme un event, **Then** il dédoublonne via `inbox` table (idempotence sur `eventId`), traite, et publie son propre event de progression (`order.created.v1`, `payment.intent-created.v1`, etc.).
- **Given** un timeout de saga (Order ne reçoit pas `payment.captured.v1` dans les 5 min après `booking.confirmed.v1`), **When** un cron `saga-watchdog.task.ts` détecte le bloque, **Then** il publie `saga.alert.v1` (consommé par notification-svc qui ping Slack — R11 Story 4.13).
- **Given** lint boundaries, **When** la CI tourne, **Then** elle vérifie qu'aucun fichier `domain/` des 3 services (booking, order, payment) n'importe Stripe SDK, axios, ou `@nestjs/*`.

#### Story 4.3: Cart UI mono-vendor + persistence Zustand (`/fr/cart`)

**As a** Customer / Visitor,
**I want** to add services to a cart and review before checkout,
**So that** I can adjust quantities, dates, and options before paying.

**Acceptance Criteria :**

- **Given** un Visitor ou Customer sur `/fr/services/<slug>`, **When** il clique "Ajouter au panier", **Then** un Zustand store `cartStore` (persistant guest via cookie `tukio-cart-id` + LocalStorage user) ajoute la ligne `{ listingId, listingSnapshot, quantity, period, options, unitPrice }`.
- **Given** un Customer authentifié qui ajoute, **When** le store update, **Then** Next.js syncronise via `POST /v1/carts/<cartId>/lines` (cart-svc gère la persistence backend pour reprise cross-device — MVP simple table dans `tukio_booking`).
- **Given** un Customer qui ajoute un 2e listing d'un **autre Pro**, **When** le store détecte, **Then** modal warning "Le panier mono-vendeur ne supporte qu'un Pro à la fois (multi-vendor V1). Remplacer le panier ?" avec CTA "Remplacer" / "Garder".
- **Given** la page `/fr/cart`, **When** elle render, **Then** elle utilise `<Card>` + `<PricingDisplay>` (Story 0.5) avec : récap des lignes, sous-total, frais Tukio (commission visible Sprint 0 — transparence), TVA placeholder (calc final côté server checkout), total estimé, CTA primaire "Procéder au paiement" → `/fr/checkout`.
- **Given** un cart vide, **When** la page render, **Then** `<EmptyState variant="cart-empty">` affiche "Votre panier est vide" + CTA "Découvrir les services" → `/fr/category/tents-marquees`.
- **Given** un Customer non-authentifié qui clique "Procéder au paiement", **When** il submit, **Then** middleware redirige vers `/fr/auth/login?redirectTo=/fr/checkout` (preserve cart state).
- **Given** la NFR3 (checkout < 1 s), **When** un Customer authentifié atteint `/fr/checkout`, **Then** la page hydrate < 1 s LCP (Lighthouse CI Story 0.11).
- **Given** UX-DR `checkout` (bundle figé), **When** je render, **Then** la page match `checkout.jsx`.

#### Story 4.4: Booking submission + 3-layer race condition protection (FR48, R5)

**As a** Customer,
**I want** my booking submission protected against race conditions (deux clients réservant le même créneau simultanément),
**So that** I never double-book and don't pay for an unavailable slot.

**Acceptance Criteria :**

- **Given** un Customer sur `/fr/checkout` qui clique "Confirmer le paiement", **When** Next.js call `POST /v1/bookings` avec `{ listingId, period: { start, end }, quantity, options, paymentMethodId }`, **Then** booking-svc applique 3 layers (R5) :
  - **Layer 1 — Redis lock** : `availabilityLock.acquire(listingId, period, 30s)` via `SET NX` Upstash Redis. Si lock occupé → 409 `BOOKING-CONFLICT-001` "Un autre client est en train de réserver ce créneau, réessayez dans 30 s".
  - **Layer 2 — DB exclusion constraint** : table `booking` a `EXCLUDE USING GIST (listing_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (status IN ('pending_pro_acceptance', 'confirmed'))`. Postgres rejette tout INSERT en chevauchement → 409 `BOOKING-CONFLICT-002` "Créneau déjà réservé".
  - **Layer 3 — Optimistic locking** : aggregate `Booking` a `version: int` colonne, et `UPDATE booking SET ... WHERE id = ? AND version = ?` détecte les writes concurrents → retry × 1, sinon 409 `BOOKING-CONFLICT-003`.
- **Given** un Pro qui veut bloquer une dispo via `seller/bookings/manual-block` (V1 FR28), **When** il submit, **Then** la même protection 3 layers s'applique.
- **Given** un Booking créé en `pending_pro_acceptance`, **When** la réponse Stripe PaymentIntent OK arrive, **Then** booking-svc relâche le Redis lock (TTL 30 s — auto-cleanup), commit la transaction, publie `booking.requested.v1`.
- **Given** un test chaos `availability-conflict.spec.ts` (Story 0.9 testing helpers), **When** je simule 100 Customers qui réservent le même créneau en parallèle, **Then** **exactement 1** booking est créé avec `status='pending_pro_acceptance'`, les 99 autres reçoivent 409 enveloppe propre (NFR46 chaos resilience).
- **Given** la NFR82, **When** un conflict 409 survient, **Then** event `booking.conflict-detected.v1` publié avec `correlationId` pour audit (volume, patterns).

#### Story 4.5: Stripe PaymentIntent + Stripe Elements checkout (FR49)

**As a** Customer,
**I want** to pay by credit card via Stripe Elements with 3D Secure if required,
**So that** my payment is secure (PCI DSS compliant) and supports SCA Europe.

**Acceptance Criteria :**

- **Given** un Customer qui charge `/fr/checkout`, **When** Next.js call `POST /v1/bookings/checkout-session` avec le cart, **Then** booking-svc fait Story 4.4 (3-layer lock), payment-svc crée un `Stripe.paymentIntents.create({ amount, currency: 'eur', capture_method: 'manual', application_fee_amount, transfer_data: { destination: pro.stripeAccountId }, metadata: { bookingId, customerId, proId, correlationId } })`, response enveloppe `{ data: { bookingId, paymentIntentClientSecret } }`.
- **Given** le frontend a le `clientSecret`, **When** Stripe Elements `<PaymentElement>` rend, **Then** le Customer entre sa CB, et `stripe.confirmPayment({ elements, confirmParams: { return_url: '/fr/checkout/success?bookingId=...' } })` est appelé, qui (1) chiffre la CB côté client (PCI DSS — Tukio ne voit jamais le PAN), (2) déclenche 3D Secure si requis (Stripe redirige vers la banque), (3) status PaymentIntent = `requires_capture` (auth différée).
- **Given** la confirmation OK, **When** Customer atterrit sur `/fr/checkout/success?bookingId=...`, **Then** la page (UX-DR `confirmation` figé du bundle) affiche : "Votre demande a été envoyée au Pro" + récap + délai d'acceptation 48h + CTA "Voir mes réservations" → `/customer/bookings/<id>`.
- **Given** Stripe webhook `payment_intent.requires_capture` reçu sur payment-svc, **When** il est traité, **Then** payment-svc valide signature `Stripe-Signature`, dédouble via inbox, met à jour son `PaymentIntent.status = 'requires_capture'`, publie `payment.intent-authorized.v1`. order-svc consume cet event et confirme l'Order en `pending_pro_acceptance`.
- **Given** Stripe `payment_intent.payment_failed` (3D Secure refusé, fonds insuffisants, etc.), **When** le webhook arrive, **Then** payment-svc publie `payment.intent-failed.v1`, booking-svc consume → transite Booking vers `cancelled` (raison `payment_failed`), libère le Redis lock.
- **Given** la NFR3 (checkout < 1 s), **When** Customer entre sa CB, **Then** la confirmation côté server (booking + paymentIntent) répond < 1 s p95. Capture (au accept Pro Story 4.7) répond < 800 ms p95 (NFR6).
- **Given** un Customer qui n'a pas de Pro disponible (cart vide, Pro `unverified`), **When** il essaie de checkout, **Then** booking-svc retourne 422 enveloppe `BOOKING-VALIDATION-001` "Pro non disponible".
- **Given** la NFR1 (RGPD), **When** je log les transactions, **Then** payment-svc ne log JAMAIS le PAN, CVV, ou client_secret (uniquement `paymentIntentId`, status, amount).

#### Story 4.6: Pro pending requests page + délai expiration 48h (FR42)

**As a** Pro,
**I want** to see my pending booking requests with a clear deadline,
**So that** je peux accepter/refuser dans les 48h sinon expiration auto.

**Acceptance Criteria :**

- **Given** un Pro authentifié sur `/seller/bookings/pending`, **When** la page render (UX-DR `seller-bookings` du bundle figé), **Then** elle affiche une liste paginée triée par `expiresAt asc` : `<Card>` par demande avec masquage anti-désintermédiation (Story 4.7) — initiale prénom + lettre nom (`Marie L.`), Avatar default, ville approximative, NO email/phone/full name, période + options demandées, `<Badge>` countdown "Expire dans 23h12m".
- **Given** un Pro qui n'a aucune demande pending, **When** la page render, **Then** `<EmptyState variant="seller-no-bookings">` "Aucune demande en attente. Restez actif pour augmenter votre visibilité !" (UX-DR16).
- **Given** une demande Booking en `pending_pro_acceptance` créée à T0, **When** un cron `auto-expire-booking.task.ts` tourne toutes les 5 min, **Then** il détecte `expiresAt < NOW()` (T0 + 48h) et appelle `auto-expire-booking.usecase.ts` qui (1) transite Booking → `refused` (raison `auto_expired`), (2) publie `booking.refused.v1`, (3) payment-svc consume → cancel le PaymentIntent (libère l'autorisation), (4) notification-svc envoie email Customer "Désolé, le Pro n'a pas répondu à temps".
- **Given** un Pro qui clique sur une demande, **When** il navigue vers `/seller/bookings/<id>`, **Then** la page detail affiche les mêmes infos masquées + 2 CTAs "Accepter" / "Refuser" + un toggle "Envoyer message au client" (Epic 5 chat) qui passe par le système de messaging anti-désintermédiation.
- **Given** un Pro qui essaie de communiquer email/phone du Customer en clair dans le chat, **When** le message est envoyé, **Then** Epic 5 messaging détecte les pattern PII et masque (FR45, R6).
- **Given** la NFR48 (48h SLA Pro), **When** un Pro a > 5 demandes pending depuis > 24h, **Then** notification-svc envoie un rappel email "5 demandes attendent votre réponse".

#### Story 4.7: Pro accept/refuse → Stripe capture + anti-désintermédiation reveal (FR43, FR45, R6)

**As a** Pro,
**I want** to accept or refuse a booking request — and only see the Customer's full PII (email, phone) AFTER accepting,
**So that** anti-désintermédiation is enforced at the system level.

**Acceptance Criteria :**

- **Given** un Pro sur `/seller/bookings/<id>` qui clique "Accepter", **When** Next.js call `POST /v1/bookings/<id>/accept`, **Then** booking-svc (1) vérifie ownership (proProfileId match JWT), (2) transite Booking → `confirmed` (state machine Story 4.1), (3) publie `booking.confirmed.v1`, (4) audit log.
- **Given** `booking.confirmed.v1` consommé par payment-svc, **When** il s'exécute, **Then** payment-svc appelle `Stripe.paymentIntents.capture(paymentIntentId)`, status devient `succeeded`, publie `payment.intent-captured.v1`. order-svc consume → status Order = `paid`, génère factures (Story 4.9), publie `order.confirmed.v1`. notification-svc envoie email Customer "Le Pro a accepté votre demande !" + email Pro "Vous avez accepté la demande de Marie Lefèvre" (PII complète révélée maintenant côté Pro email).
- **Given** un Pro qui clique "Refuser", **When** Next.js call `POST /v1/bookings/<id>/refuse` avec `{ reason: 'unavailable' | 'out_of_zone' | 'other', message? }`, **Then** booking-svc transite Booking → `refused`, publie `booking.refused.v1`, payment-svc cancel PaymentIntent (libère l'autorisation Customer), notification-svc envoie email Customer "Le Pro est indisponible" + suggestions Meilisearch.
- **Given** un Pro qui a accepté, **When** il consulte `/seller/bookings/<id>`, **Then** PII Customer **complète** est révélée (full name, email, phone) avec un banner "Ces informations sont confidentielles. Toute communication doit passer par la plateforme jusqu'à la prestation" (FR45, R6 anti-désintermédiation, NFR1 RGPD audit).
- **Given** un Customer qui consulte `/customer/bookings/<id>` après accept, **When** la page render, **Then** PII Pro complète est révélée également (mutual reveal post-accept).
- **Given** un Pro qui essaie de bypass (regarder DB direct, etc.) — théorique, **When** il fait un `GET /v1/bookings/<id>` en `pending_pro_acceptance`, **Then** la response masque PII Customer (initials only — server-side enforcement, pas juste UI).
- **Given** la NFR82 audit, **When** un Pro accepte ou refuse, **Then** event `booking.<status>.v1` audit log avec `actor`, `at`, `reason?`.
- **Given** la NFR6 (capture < 800 ms p95), **When** payment-svc appelle Stripe capture, **Then** la latence p95 < 800 ms (Stripe SLA + network).

#### Story 4.8: Customer cancellation flow + 3 templates politique annulation (FR38)

**As a** Customer,
**I want** to cancel my booking with a clear refund preview based on the Pro's cancellation policy,
**So that** je sais exactement combien je récupère avant de confirmer.

**Acceptance Criteria :**

- **Given** un Customer sur `/customer/bookings/<id>` (statut `confirmed`), **When** il clique "Annuler ma réservation", **Then** une modale destructrice (`requireExplicitClose`) affiche : (1) la politique du Pro (templates `flexible | standard | strict`), (2) le calcul refund preview (`api.bookings.<id>.cancellation-preview` qui retourne `{ refundAmount, retainedAmount, breakdown }`), (3) `<Textarea>` raison libre optionnel, (4) CTA destructive "Annuler ma réservation".
- **Given** les 3 templates de politique (configurables côté Pro Story 3.x), **When** je regarde leur logique, **Then** :
  - `flexible` : refund 100 % si annulation > 7 jours avant événement, 50 % si 2-7 jours, 0 % si < 2 jours.
  - `standard` (default) : refund 100 % si > 14 jours, 50 % si 7-14, 0 % si < 7.
  - `strict` : refund 50 % si > 30 jours, 0 % si < 30.
- **Given** un Customer qui confirme l'annulation, **When** Next.js call `POST /v1/bookings/<id>/cancel`, **Then** booking-svc (1) transite Booking → `cancelled` (raison `customer_cancellation`), (2) publie `booking.cancelled.v1` avec `refundAmount`, (3) payment-svc consume → `Stripe.refunds.create({ paymentIntentId, amount: refundAmount })` partiel ou total, (4) order-svc émet une facture d'avoir si applicable, (5) notification-svc envoie email Customer "Votre réservation est annulée. Refund de X € en cours" + email Pro "Le Customer a annulé. Vous conservez Y € selon votre politique".
- **Given** un Customer qui annule en `pending_pro_acceptance` (avant accept Pro), **When** il submit, **Then** PaymentIntent est cancel (pas refund — autorisation libérée sans charge), Booking → `cancelled` (raison `customer_pre_acceptance`).
- **Given** UX-DR `cancel-flow` du bundle figé, **When** la modale render, **Then** elle reproduit le screen `cancel-flow.jsx`.
- **Given** la NFR82, **When** un cancel est exécuté, **Then** audit log `booking.cancelled.v1` avec `actor=customer`, `reason`, `refundAmount`, `policyApplied`.

#### Story 4.9: Invoice generation + 3 TVA cases + mandat 289 CGI (FR54, FR64)

**As a** Pro / Customer,
**I want** invoices automatically generated post-confirmation, applying correct VAT rules and the mandatory mandate art. 289 CGI,
**So that** je suis légalement conforme et je peux comptabiliser les transactions.

**Acceptance Criteria :**

- **Given** `booking.confirmed.v1` consommé par order-svc, **When** `generate-invoices.usecase.ts` s'exécute, **Then** il (1) appelle `vatCalculator.compute({ pro, customer, amount, country })` selon les 3 cas FR64, (2) génère 2 PDFs : facture Customer (émise PAR Tukio AU NOM du Pro — mandat 289 CGI) + facture Tukio→Pro (commission Tukio + frais Stripe), (3) stocke PDFs sur Cloudflare R2 chiffré, (4) publie `order.invoices-generated.v1`.
- **Given** les 3 cas TVA (FR64), **When** `vatCalculator` s'exécute, **Then** il applique :
  - **Cas A** — Pro non-assujetti TVA (auto-entrepreneur < seuils, ou exonéré) : facture HT seul, mention "TVA non applicable, art. 293 B du CGI" (`vatTreatment = 'exempted'`).
  - **Cas B** — Pro assujetti + Customer B2C (particulier) : TVA 20 % FR sur le montant HT (default), `vatTreatment = 'b2c_fr_standard'`.
  - **Cas C** — Pro assujetti + Customer B2B intra-UE (V1 FR2) : autoliquidation TVA, mention "Reverse charge — Article 196 of the EU VAT Directive 2006/112/EC" (`vatTreatment = 'b2b_intra_eu_reverse_charge'`). MVP : ce cas n'est pas exposé (pas de Customer B2B avant V1) mais data model prêt.
- **Given** la facture émise par Tukio au nom du Pro (FR54 mandat 289 CGI), **When** je l'ouvre, **Then** elle contient : header "Facture émise par Tukio (RCS Nantes XXX) au nom et pour le compte de [Pro Name] (SIRET YYY) en vertu d'un mandat de facturation (article 289 du CGI)", footer "Tukio applique sur cette transaction une commission de Z € HT", champs Customer (full name, address — révélé post-accept FR45), montant HT, TVA, TTC, total, conditions de paiement.
- **Given** un PDF généré via React PDF (`@react-pdf/renderer`), **When** je le download, **Then** il a un nom `tukio-facture-<bookingId>-<yyyy-mm-dd>.pdf`, conforme A4, branding Tukio, 1-2 pages.
- **Given** la NFR1 (rétention 10 ans légale FR), **When** un cron `purge-invoices.task.ts` tourne, **Then** il préserve toutes factures < 10 ans (cf. Story 1.9 soft-delete user mais factures préservées).
- **Given** la NFR82 audit, **When** une facture est générée, **Then** event `order.invoice-generated.v1` audit log avec `invoiceNumber, vatTreatment, htAmount, vatAmount, ttcAmount, commission`.
- **Given** un Customer V1 (FR52 UI customer factures), **When** il accède `/customer/bookings/<id>/invoices`, **Then** il télécharge le PDF facture (signed URL R2 5 min). MVP : email avec PDF en pièce jointe (attachment max 5 MB Resend).

#### Story 4.10: Auto-payout J+1 cron + Stripe transfer (FR65, FR56)

**As a** Pro,
**I want** to receive my payout automatically J+1 after the event ends, after Tukio commission deduction,
**So that** je n'ai aucune action à faire et le cash arrive sur mon compte bancaire dans les 7 jours Stripe.

**Acceptance Criteria :**

- **Given** un cron `auto-complete-payout.task.ts` qui tourne quotidiennement à 02:00 Europe/Paris, **When** il s'exécute, **Then** il interroge `booking-svc` pour les bookings `confirmed` avec `period.end < NOW() - INTERVAL '1 day'` ET pas encore `completed`.
- **Given** chaque booking détecté, **When** le cron le traite, **Then** booking-svc (1) transite Booking → `completed`, (2) publie `booking.completed.v1`, (3) order-svc consume → status Order = `completed`, (4) payment-svc consume → calcule `commission = order.totalHt * 0.15` (15 % MVP), `proPayoutAmount = order.totalHt - commission`, appelle `Stripe.transfers.create({ amount: proPayoutAmount, currency: 'eur', destination: pro.stripeAccountId, source_transaction: paymentIntent.charge.id, transfer_group: bookingId })`, persiste un `Transfer` aggregate, publie `payment.transfer-created.v1`.
- **Given** Stripe webhook `transfer.created` reçu, **When** payment-svc le traite, **Then** il marque `Transfer.status = 'pending_payout'` (waiting Stripe schedule J+7 default).
- **Given** Stripe webhook `payout.paid` reçu (Pro a touché le cash), **When** payment-svc le traite, **Then** il marque `Payout.status = 'paid'`, publie `payment.payout-confirmed.v1`, notification-svc envoie email Pro "Votre paiement de X € a été versé sur votre compte".
- **Given** un Pro sur `/seller/payouts` (UX-DR11 — gap MVP critique), **When** il accède, **Then** il voit liste : pending payouts (= future), in-transit, paid (avec dates), montants HT, commission Tukio déduite, frais Stripe estimés (% transparents).
- **Given** la story Pro qui a annulé (cancellation timing), **When** un Pro `cancel` Booking après `confirmed`, **Then** payment-svc fait `Stripe.refunds.create()` au Customer (selon politique), pas de transfer, ou `Stripe.transfers.create({ reversal_amount })` si déjà transféré.
- **Given** la NFR23 (rapprochement comptable), **When** un cron `stripe-reconciliation.task.ts` tourne quotidiennement, **Then** il compare `Stripe.balanceTransactions.list()` vs Tukio DB et alerte si écart > 0,01 €.

#### Story 4.11: Customer/Pro bookings list + detail page (FR36, FR37, FR53)

**As a** Customer / Pro,
**I want** to see all my bookings (past and upcoming) with full status visibility,
**So that** je suis toujours informé et peux agir (annuler, contacter Pro, télécharger facture).

**Acceptance Criteria :**

- **Given** un Customer sur `/fr/customer/bookings`, **When** la page render (UX-DR `bookings-list` du bundle figé), **Then** elle affiche 2 sections : "À venir" + "Passées", paginées, avec `<Card>` par booking : photo hero du listing, status `<Badge>` (couleur selon statut), Pro name, période, total, CTA "Voir détails" → `/customer/bookings/<id>`.
- **Given** un Customer qui clique sur un booking, **When** il navigue vers `/customer/bookings/<id>`, **Then** la page (UX-DR `booking-detail` figé) affiche : timeline statut (visual), récap, infos Pro (révélées post-accept), facture lien (si confirmed), CTA "Annuler" (selon Story 4.8), CTA "Messages" (Epic 5).
- **Given** un Pro sur `/fr/seller/bookings`, **When** la page render, **Then** elle affiche 4 onglets : `Pending (X)`, `Confirmed (X)`, `Completed (X)`, `Cancelled (X)`, avec liste paginée et `<Badge>` countdown si pending.
- **Given** un Pro sur `/fr/seller/transactions` (FR53), **When** la page render, **Then** elle liste toutes les transactions Order avec colonnes : date, Customer (initiales si pre-accept, full post-accept), montant HT, TVA, TTC, commission Tukio, Stripe fees, net Pro, status payout, CTA "Télécharger facture" (PDF émise mandat 289 CGI).
- **Given** la NFR48 (UX), **When** un Pro a > 50 transactions, **Then** filtres par date range + status sont dispo (perfs : indexes DB sur `status, period_start`).
- **Given** la NFR58 paths EN, **When** je regarde l'URL, **Then** `/fr/customer/bookings`, `/fr/seller/bookings`, `/fr/seller/transactions` (paths EN strict).

#### Story 4.12: Admin refund + reconciliation page (FR61, FR63)

**As an** Admin (modo / super),
**I want** to issue manual refunds for support cases and view Stripe ↔ Tukio reconciliation,
**So that** je résous les litiges customer et je vérifie l'intégrité financière de la plateforme.

**Acceptance Criteria :**

- **Given** un Admin sur `/admin/transactions/<bookingId>`, **When** il accède, **Then** la page affiche : full booking info, payment intent, transfers, refunds historique, CTA "Émettre un remboursement".
- **Given** un Admin clique "Émettre un remboursement", **When** une modale demande `{ amount (partial or full), reason: 'customer_complaint' | 'service_not_delivered' | 'fraud' | 'other', adminNote }`, **Then** au confirm : payment-svc `POST /v1/admin/refunds` (rôle `admin-modo` minimum) appelle `Stripe.refunds.create({ paymentIntentId, amount, reason })`, persiste un `Refund` aggregate, publie `payment.refund-issued.v1`, audit log avec actor admin.
- **Given** un Admin sur `/admin/reconciliation` (UI MVP minimal — V1 dashboards complets), **When** la page render, **Then** elle affiche un tableau : période (ce mois), commissions encaissées Tukio, commissions reverse à Stripe, payouts envoyés Pros, balance Stripe vs balance théorique Tukio, écart. Si écart > 0,01 €, banner rouge.
- **Given** un Admin Super, **When** il export reconciliation en CSV (`GET /v1/admin/reconciliation/export?from=2026-04-01&to=2026-04-30`), **Then** payment-svc retourne un CSV avec toutes les transactions du mois (audit comptable, NFR23).
- **Given** la NFR82 audit, **When** un refund est émis ou reconciliation exportée, **Then** audit log immutable.

#### Story 4.13: Saga monitoring + R11 alerts > 5 min stuck

**As a** SRE / tech lead,
**I want** the booking-order-payment saga monitored with Prometheus + Grafana + Slack alerts on stuck transactions,
**So that** un saga bloqué est détecté en < 5 min et un humain peut intervenir avant que le Customer s'inquiète.

**Acceptance Criteria :**

- **Given** OpenTelemetry instrumenté dans booking-svc, order-svc, payment-svc (Story 0.12), **When** un Customer initie un booking, **Then** un span racine est créé avec `correlationId`, propagé via NATS event headers (`x-correlation-id`), et chaque service ajoute ses spans (DB queries, Stripe calls, NATS publish).
- **Given** un dashboard Grafana "Tukio Saga Health", **When** je l'ouvre, **Then** il affiche : (1) booking creation rate (RPS), (2) saga completion rate (= `order.confirmed.v1` / `booking.requested.v1`), (3) saga p95 latency (de `booking.requested.v1` à `payment.intent-captured.v1`), (4) stuck saga count (sagas bloquées > 5 min), (5) DLQ messages count.
- **Given** un cron `saga-watchdog.task.ts` qui tourne toutes les 1 min, **When** il détecte une saga bloquée (booking `pending_pro_acceptance` > 49h, ou booking `confirmed` sans `payment.captured.v1` > 5 min, ou order `pending` > 10 min), **Then** il émet event `saga.alert.v1` consommé par notification-svc qui ping Slack `#tukio-alerts-saga` avec correlationId + lien Tempo trace.
- **Given** la NFR43, **When** une alerte saga est émise, **Then** elle est PagerDuty escalade après 15 min (V1 — MVP : Slack only).
- **Given** un dev qui debug, **When** il a un `correlationId`, **Then** il peut filtrer Tempo (Grafana Cloud) pour voir le trace complet du saga (booking → payment → order → notification) avec timestamps de chaque event NATS.
- **Given** la NFR42 (event reliability), **When** un service crash en plein traitement d'un event, **Then** NATS JetStream redélivre l'event (max 5 retries, backoff exponential), et au-delà l'event va en DLQ `dlq.<service>.<event-type>`. Une alerte Slack est émise dès qu'un message arrive en DLQ.
- **Given** un test chaos `saga-partial-failure.spec.ts` (Story 0.9), **When** je simule la panne payment-svc juste après `booking.requested.v1`, **Then** au redémarrage, payment-svc reprend l'event depuis NATS (durable consumer JetStream), crée le PaymentIntent, et le saga complete sans perte (NFR46).

**Epic 4 — Total stories : 13**

---

### Epic 5: Messaging, Reviews & Transactional Notifications

**Outcome utilisateur** : un Customer et un Pro communiquent via un chat lié à leur booking. Après l'événement, un email auto J+1 invite le Customer à laisser un avis (note 1-5 + commentaire). Les avis pondérés par récence sont affichés sur la fiche service et le profil Pro. 9 templates email transactionnels FR/EN sont envoyés via Resend selon le `locale` du destinataire.

**FRs covered MVP** : FR67, FR68, FR73, FR74, FR75, FR79, FR80, FR81, FR82, FR100, FR102
**FRs déférés V1+** : FR69 (chat libre pré-booking devis), FR70 (pièces jointes), FR71 (search messages), FR72 (PII regex masking dans messages — server-side reveal post-accept FR45 reste MVP), FR76 (avis multi-critères), FR77 (Pro réponse publique), FR78 (Pro avis sur Customer)
**NFRs covered** : NFR1 (rétention 5 ans messages), NFR82 (audit), NFR42/45 (durabilité events emails), NFR50/54 (a11y), NFR58 (i18n templates)
**UX-DRs covered** : `messages-list`, `conversation-thread`, `review-form` (gap MVP — designer Sprint 0), `reviews-display` (4 écrans bundle figés via `messages.jsx` + `service.jsx` reviews section), 7-9 templates email à designer Sprint 0 (gap MVP)
**Intégrations** : Resend, Brevo (broadcast V1+ prep), NATS JetStream

#### Story 5.1: messaging-svc Pretre + `Conversation` + `Message` aggregates

**As a** backend developer,
**I want** messaging-svc with Pattern Pretre, including Conversation aggregate (linked to a Booking) and Message entity with retention policy,
**So that** chat features are domain-driven, testable, and respect 5-year RGPD retention.

**Acceptance Criteria :**

- **Given** `apps/messaging-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{conversation.ts (aggregate root, lié à un bookingId), message.ts (entity), value-objects/{conversation-id.vo.ts, message-content.vo.ts, participant.vo.ts}}`, `ports/{conversation-repository.ts, message-repository.ts, rate-limit-port.ts (Redis), event-publisher.ts}`, `service/{anti-spam.service.ts}`, `exception/{messaging.exception.ts}`.
- **Given** `Conversation`, **When** elle est créée à partir d'un `booking.requested.v1`, **Then** elle a `participantsActorIds: [customerId, proId]`, `bookingId`, `lastMessageAt`, `unreadCounts: { customerUnread, proUnread }`. Une conversation par booking, créée au moment de la résa.
- **Given** `Message`, **When** il est instancié, **Then** il a `{ id, conversationId, senderActorId, content (max 4000 chars), sentAt, deliveredAt?, readAt?, isSystem (bool — pour notifs auto comme "Le pro a accepté") }`.
- **Given** `apps/messaging-svc/src/usecases/`, **When** je l'ouvre, **Then** je trouve : `create-conversation-from-booking.usecase.ts` (consumer `booking.requested.v1`), `send-message.usecase.ts`, `mark-as-read.usecase.ts`, `list-conversations.usecase.ts`, `get-conversation-messages.usecase.ts`, `archive-conversation.usecase.ts` (post-completion + 6 mois).
- **Given** la NFR1 rétention 5 ans (FR74), **When** un cron `purge-old-messages.task.ts` tourne mensuellement, **Then** il archive vers Cloudflare R2 chiffré + supprime de la DB chaude les messages > 5 ans.
- **Given** lint boundaries, **When** la CI tourne, **Then** elle vérifie qu'aucun fichier `domain/` n'importe Resend SDK, `@nestjs/*`, ou Redis client.

#### Story 5.2: Conversation thread UI (Customer + Pro views)

**As a** Customer / Pro,
**I want** a real-time conversation thread tied to my booking,
**So that** je communique sans quitter la plateforme et garde une trace écrite.

**Acceptance Criteria :**

- **Given** un user authentifié sur `/fr/account/messages`, **When** la page render (UX-DR `messages-list`), **Then** elle utilise `<Card>` listant les conversations triées par `lastMessageAt desc`, avec : avatar du participant (révélé selon Story 4.7), preview du dernier message tronqué, timestamp relatif, badge unread count. Empty state si aucune conv.
- **Given** un user qui clique sur une conversation, **When** il navigue vers `/fr/account/messages/<conversationId>`, **Then** la page affiche `<ConversationThread>` (Story 0.5) avec : header (booking lié + status badge + CTA "Voir réservation"), messages historiques paginés (load-more vers le haut), `<Textarea>` + bouton envoi en bas sticky.
- **Given** un user qui scroll vers le haut, **When** il atteint le top, **Then** TanStack Query `useInfiniteQuery` charge les 50 messages plus anciens (pagination cursor-based).
- **Given** un user qui ouvre une conversation, **When** la page load, **Then** Next.js call `POST /v1/conversations/<id>/mark-as-read` qui reset `unreadCount` côté user actuel + publie `messaging.conversation.read.v1`.
- **Given** un nouveau message arrivé pendant que l'user est sur la page, **When** un Server-Sent Event (SSE) ou polling 10 s arrive (MVP : polling 10 s simple, V1 : SSE/WebSocket réel), **Then** le message s'ajoute à la fin du thread avec animation (transition respecte `prefers-reduced-motion`).
- **Given** la NFR50 a11y, **When** un nouveau message arrive, **Then** `aria-live="polite"` sur le thread annonce "Nouveau message de Jean : ..." aux screen readers.
- **Given** un Customer qui vient de Story 4.11 booking detail "Messages", **When** il clique, **Then** il atterrit sur la conversation correspondante directement.

#### Story 5.3: Send message + rate limiting (FR73) + 5-year retention (FR74)

**As a** Customer / Pro,
**I want** to send a text message with anti-spam protection (max 3 msg/h to a non-responding recipient),
**So that** abusive behavior est blocked et le destinataire n'est pas spammé.

**Acceptance Criteria :**

- **Given** un user qui tape un message, **When** il clique "Envoyer" ou Cmd+Enter, **Then** Next.js call `POST /v1/conversations/<id>/messages` avec `{ content }`, messaging-svc (1) vérifie ownership (sender ∈ conversation.participants), (2) appelle `AntiSpamService.checkRateLimit(senderActorId, recipientActorId, conversationId)`, (3) si OK persiste le message + publie `messaging.message.sent.v1`, (4) consumer notification-svc envoie email "Vous avez un nouveau message" si recipient offline > 5 min.
- **Given** la rate limit FR73 (3 messages/h), **When** un sender a déjà envoyé 3 messages au même recipient sans réponse dans la dernière heure, **Then** la 4e tentative renvoie 429 enveloppe `MESSAGING-RATE-LIMITED-001` "Vous avez envoyé 3 messages sans réponse. Patientez une heure". Le compteur reset dès qu'un reply arrive.
- **Given** un Pro qui essaie de spam un Customer pre-acceptance (anti-désintermédiation Story 4.7), **When** la conversation existe mais Booking en `pending_pro_acceptance`, **Then** rate limit s'applique normalement, ET les emails transactionnels Customer mentionnent "Le Pro vous a envoyé un message via Tukio" (PII Pro masquée).
- **Given** un message envoyé, **When** le recipient l'ouvre, **Then** son `readAt` est set, l'event `messaging.message.read.v1` est publié, et le sender voit double-tick (UX feedback) — V1 enrichi (MVP : simple `read` indicator).
- **Given** la NFR1 (rétention 5 ans FR74), **When** un user supprime son compte (Story 1.9), **Then** ses messages sont anonymisés (`senderName = 'Utilisateur supprimé'`) mais préservés dans la conversation pour traçabilité litige (durée 5 ans légale).
- **Given** la NFR82 audit, **When** un message est envoyé/reçu, **Then** l'event NATS contient `correlationId` permettant traçabilité (mais pas le `content` — pour ne pas dupliquer la PII dans les logs).
- **Given** UX-DR `conversation-thread` (`messages.jsx` figé), **When** je render, **Then** rendu match les composants du bundle (bulles, timestamps, typing animation `tk-typing`).

#### Story 5.4: notification-svc Pretre + Resend integration + 9 templates FR/EN

**As a** developer,
**I want** notification-svc with Pattern Pretre integrating Resend for transactional emails, with 9 React Email templates in FR and EN,
**So that** all critical user events trigger reliable, branded, accessible emails in the recipient's locale.

**Acceptance Criteria :**

- **Given** `apps/notification-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{notification.ts (aggregate, persisté pour audit), value-objects/{notification-channel.vo.ts (email|in-app), notification-type.vo.ts}}`, `ports/{email-sender-port.ts (Resend wrapper), notification-repository.ts, event-publisher.ts}`, `service/{template-resolver.service.ts (matche type → template + locale)}`.
- **Given** `apps/notification-svc/src/templates/`, **When** je l'ouvre, **Then** je trouve 9 templates React Email × 2 locales = 18 fichiers : `email-verify.{fr,en}.tsx`, `password-reset.{fr,en}.tsx`, `pro-verified.{fr,en}.tsx`, `pro-rejected.{fr,en}.tsx`, `booking-requested-pro.{fr,en}.tsx` (Pro reçoit demande), `booking-confirmed-customer.{fr,en}.tsx`, `booking-refused-customer.{fr,en}.tsx`, `booking-cancelled.{fr,en}.tsx` (envoyée à Customer + Pro), `payout-confirmed-pro.{fr,en}.tsx`, `review-request-customer.{fr,en}.tsx`.
- **Given** chaque template, **When** je le render, **Then** il contient : header logo Tukio + tagline traduite, body Fraunces titre + Inter texte, CTA principal `<Button>` brand-500, footer adresse RCS Tukio + lien désinscription (uniquement marketing — pas transactionnel) + lien préférences communication.
- **Given** les events triggers, **When** ils sont publiés (cf. Epics précédents), **Then** notification-svc consume :
  - `identity.user.registered.v1` → email-verify
  - `identity.password.reset.v1` (request) → password-reset
  - `identity.pro.verified.v1` → pro-verified
  - `identity.pro.rejected.v1` ou `identity.pro.auto-rejected.v1` → pro-rejected
  - `booking.requested.v1` → booking-requested-pro (au pro) + confirmation Customer "Demande envoyée"
  - `booking.confirmed.v1` → booking-confirmed-customer
  - `booking.refused.v1` → booking-refused-customer
  - `booking.cancelled.v1` → booking-cancelled (au Customer ET Pro)
  - `payment.payout-confirmed.v1` → payout-confirmed-pro
  - `review.request.v1` (Story 5.6) → review-request-customer
- **Given** la FR102, **When** un event est consommé, **Then** notification-svc lit `recipient.locale` (depuis identity-svc snapshot dans l'event ou via cache) et choisit le template approprié.
- **Given** une panne Resend (timeout > 10 s), **When** notification-svc essaie de send, **Then** retry × 3 backoff exponentiel, puis DLQ NATS avec alerte Slack `#tukio-alerts-notifications` (NFR42, NFR45).
- **Given** la NFR82 audit, **When** un email est envoyé, **Then** une row est insérée dans `notification` table avec `{ id, type, channel, recipientActorId, locale, templateName, sentAt, status: 'sent' | 'failed', resendMessageId, correlationId }` (NFR1 — 3 ans pour traçabilité).
- **Given** un dev en local, **When** un email est envoyé, **Then** il arrive dans MailHog (`localhost:8025`) au lieu de Resend (Story 0.10).
- **Given** la FR123 (regroupement messages non lus), **When** un user reçoit ≥ 2 messages chat dans les 5 min sans les lire, **Then** notification-svc temporise (debounce 5 min) et envoie UN SEUL email digest "Vous avez X nouveaux messages de Y" avec preview groupé, plutôt que N emails individuels (template `messages-digest.{fr,en}.tsx` — 10e template, ajouté à la liste Story 5.4 = 10 templates × 2 locales = 20 fichiers).

#### Story 5.5: review-svc Pretre + `Review` aggregate

**As a** backend developer,
**I want** review-svc with Pattern Pretre and a Review aggregate enforcing only verified-event reviews,
**So that** les avis sont liés à un booking complété et inviolables.

**Acceptance Criteria :**

- **Given** `apps/review-svc/src/domain/`, **When** je l'ouvre, **Then** je trouve : `model/{review.ts (aggregate, lié à bookingId + listingId + customerActorId + proActorId), value-objects/{review-id.vo.ts, rating.vo.ts (1-5), review-content.vo.ts (max 2000 chars)}, review-report.ts (entity)}`, `ports/{review-repository.ts, review-aggregator-port.ts, event-publisher.ts}`, `service/{recency-weighting.service.ts (FR82)}`, `exception/{review.exception.ts}`.
- **Given** `Review`, **When** je l'instancie sans bookingId valide ou booking pas en `completed`, **Then** elle throw `ReviewValidationException('Cannot review without completed booking')` (FR75 contrainte intégrité).
- **Given** un Customer ne peut laisser qu'un seul avis par booking, **When** il essaie d'en créer un 2e sur le même booking, **Then** review-svc retourne 409 enveloppe `REVIEW-CONFLICT-001`.
- **Given** `apps/review-svc/src/usecases/`, **When** je l'ouvre, **Then** je trouve : `create-review.usecase.ts`, `request-review.usecase.ts (cron J+1, J+7 — Story 5.6)`, `get-aggregate-for-listing.usecase.ts`, `get-aggregate-for-pro.usecase.ts`, `report-review-as-abusive.usecase.ts`, `moderate-review.usecase.ts (admin Epic 6)`.
- **Given** `RecencyWeightingService`, **When** je calcule l'aggregate d'un listing, **Then** chaque review a `weight = 2.0 if reviewedAt > NOW() - 6 months else 1.0` (FR82), et le rating moyen pondéré est `Σ(rating × weight) / Σ(weight)`.
- **Given** un cron `aggregate-reviews.task.ts` qui tourne 6× par jour, **When** il s'exécute, **Then** il recalcule les aggregates par listing + par pro, et persiste dans une vue matérialisée `review_aggregate_mv` pour lecture optimisée (NFR1 perfs).
- **Given** lint boundaries, **When** la CI tourne, **Then** elle vérifie qu'aucun fichier `domain/` n'importe `@nestjs/*`.

#### Story 5.6: Auto-request review J+1 + relance J+7 (FR81)

**As a** product owner,
**I want** customers to receive an auto review request email J+1 after their event ends, with a J+7 follow-up if they haven't responded,
**So that** je maximise le taux de retour avis (cible > 30 %) sans spammer.

**Acceptance Criteria :**

- **Given** un cron `request-reviews.task.ts` qui tourne quotidiennement à 09:00 Europe/Paris, **When** il s'exécute, **Then** il interroge booking-svc pour les bookings `completed` avec `period.end < NOW() - INTERVAL '1 day'` ET sans `reviewRequestedAt` set.
- **Given** chaque booking détecté, **When** le cron le traite, **Then** review-svc (1) marque `reviewRequestedAt = NOW()` sur le booking, (2) publie `review.request.v1` avec `{ bookingId, customerId, listingId, locale }`, (3) notification-svc consume → envoie email `review-request-customer.{locale}.tsx` "Comment s'est passé votre événement ?" + CTA "Laisser un avis" → `/customer/bookings/<id>/review`.
- **Given** un cron `request-reviews-relance.task.ts` qui tourne quotidiennement à 09:00, **When** il s'exécute, **Then** il interroge booking-svc pour les bookings avec `reviewRequestedAt < NOW() - 7 days` ET pas encore de Review créée ET `reviewRelanceCount = 0`.
- **Given** chaque booking détecté pour relance, **When** le cron le traite, **Then** il publie `review.request-reminder.v1`, notification-svc envoie email `review-request-relance-customer.{locale}.tsx` (compte parmi les 9 templates Story 5.4 ou 10e). Marque `reviewRelanceCount = 1`. Pas de 2e relance.
- **Given** un Customer qui clique le CTA email, **When** il atterrit sur `/customer/bookings/<id>/review`, **Then** la page affiche `<ReviewForm>` (UX-DR review-form gap MVP, à designer Sprint 0).
- **Given** un Customer qui a déjà laissé son avis, **When** un cron relance se déclenche, **Then** il SKIP ce booking (check `existingReview` avant publish).
- **Given** la NFR48, **When** un Customer a son compte supprimé, **Then** request review cron SKIP (FR75 sans Customer pas d'avis).

#### Story 5.7: Customer leave review + report abuse (FR75, FR80)

**As a** Customer,
**I want** to leave a review (1-5 stars + text) for my completed booking, and report abusive reviews,
**So that** je partage mon expérience et la communauté garde un signal de qualité fiable.

**Acceptance Criteria :**

- **Given** un Customer sur `/fr/customer/bookings/<id>/review` (booking `completed`), **When** la page render, **Then** elle affiche `<ReviewForm>` : `<Stars max={5}>` interactive (cliquer 1-5), `<Textarea>` commentaire (max 2000 chars, min 20 recommandé soft), `<Checkbox>` "Vérifier que mon nom apparaisse comme 'Marie L.' (initiale du nom)" (par défaut `true` — RGPD), CTA "Publier mon avis".
- **Given** un Customer qui submit, **When** Next.js call `POST /v1/reviews` avec `{ bookingId, rating, content, anonymized }`, **Then** review-svc valide (Story 5.5 contraintes), persiste, publie `review.created.v1`, recalcule l'aggregate du listing + pro, retourne enveloppe `{ data: { reviewId } }`.
- **Given** un Visitor sur la fiche service, **When** il voit l'avis, **Then** le nom affiché est "Marie L." (initiales par défaut FR75 anonymized + FR80 protection auteur), la date est relative, les étoiles sont rendues via `<Stars>` (Story 0.4).
- **Given** un user (Customer ou Pro) qui voit un avis suspect, **When** il clique "Signaler" → modale, **Then** Next.js call `POST /v1/reviews/<id>/report` avec `{ reason: 'inappropriate' | 'fake' | 'off_topic' | 'other', message? }`, review-svc persiste un `ReviewReport`, publie `review.reported.v1` (consumer admin queue Epic 6 modère).
- **Given** une review reportée 3 fois, **When** le seuil est atteint, **Then** review-svc auto-hide la review (status `pending_moderation`), publie `review.auto-hidden.v1`, l'aggregate est recalculé sans cette review.
- **Given** UX-DR `review-form` (gap MVP — designer Sprint 0), **When** je render, **Then** la page utilise les composants Story 0.4 (Stars, FormField, Textarea, Button) avec validation inline.
- **Given** la NFR82 audit, **When** un avis est créé/reporté, **Then** event audit log avec `actor`, `at`, `aggregateId`.

#### Story 5.8: Reviews aggregate display (Service + Pro) + recency weight (FR79, FR82)

**As a** Visitor,
**I want** to see aggregated reviews (average rating, count, distribution) on a service detail page and on a Pro profile,
**So that** I can assess reputation at a glance and read recent feedback.

**Acceptance Criteria :**

- **Given** un Visitor sur `/fr/services/<slug>` (Story 3.10), **When** la section "Avis clients" render, **Then** elle affiche : `<ReviewsDisplay>` (Story 0.5) avec rating moyen pondéré (FR82), count total, distribution barchart (5/4/3/2/1 étoiles), liste des 10 dernières reviews (paginé), CTA "Voir tous les avis" → page dédiée si > 10.
- **Given** un listing fraîchement publié sans avis, **When** la section render, **Then** `<EmptyState variant="reviews-empty">` affiche "Aucun avis pour le moment. Soyez le premier client à le découvrir !" (UX-DR16).
- **Given** chaque review affichée, **When** elle render, **Then** elle a : nom auteur (anonymized si `anonymized=true`), avatar default, étoiles, date relative ("Il y a 2 mois"), texte du commentaire (max 200 chars + "Lire la suite" si plus), badge "Récent" si `reviewedAt > NOW() - 6 months` (FR82 transparence pondération).
- **Given** un Pro avec 5+ listings publiés, **When** un Visitor consulte son profil `/fr/pro/<slug>` (Story 3.11), **Then** la section "Avis clients" agrégés affiche le rating moyen pondéré ALL listings + count + 3 derniers avis (cross-listings).
- **Given** la NFR1 perfs, **When** une fiche service charge, **Then** l'aggregate vient de la vue matérialisée `review_aggregate_mv` (lecture < 50 ms p95), pas de re-calc en live.
- **Given** la NFR5 SEO, **When** Googlebot crawle, **Then** JSON-LD `aggregateRating` + `Review` schema.org est injecté dans la fiche (rich snippets dans Google Search).

#### Story 5.9: Display badge "FR only" si EN absent (FR100)

**As a** Visitor en `en`,
**I want** to see a clear visual badge "Available in French only" when a service has no EN translation,
**So that** je comprends pourquoi le contenu s'affiche en FR (fallback transparent).

**Acceptance Criteria :**

- **Given** un Visitor `en` qui charge `/en/services/<slug>` et le listing n'a pas de `title_en` ou `description_en`, **When** la fiche render, **Then** un `<Badge variant="info">"Available in French only"</Badge>` apparaît au-dessus du titre, couleur info (cream-50 + charcoal-700), tooltip explicatif "This service has not been translated by the seller".
- **Given** un Visitor `en` qui charge `/en/category/<slug>` ou `/en/search?...`, **When** des cards listings sans EN apparaissent dans les résultats, **Then** chaque card affiche un mini-badge "FR" (icon flag) en coin top-right (UX subtil pour SERP, plus prominent en fiche).
- **Given** un Pro qui édite sa fiche et ajoute la translation EN, **When** il save, **Then** le badge disparaît au prochain reload (cache invalidation TanStack Query).
- **Given** la NFR60 (Meilisearch fallback), **When** un Visitor `en` search, **Then** les listings sans EN sont quand même indexés `listings_en` avec le contenu FR + flag `_fallback_locale: 'fr'` (Story 3.7), et la SERP les liste avec le badge "FR only".
- **Given** un Visitor `fr`, **When** il consulte la fiche, **Then** aucun badge n'apparaît (FR est la langue principale, fallback non applicable).
- **Given** UX-DR16 transparence, **When** un user clique le badge, **Then** une tooltip explique "Le prestataire n'a pas encore traduit cette fiche. Le contenu est affiché en français" + lien "Demander la traduction" (V1 — fonctionnalité plus tard, MVP : tooltip statique).

#### Story 5.10: Notification preferences MVP minimal (FR118)

**As a** Customer / Pro,
**I want** to opt-out of marketing emails and choose digest frequency,
**So that** je ne suis pas spammé tout en restant informé des notifs critiques.

**Acceptance Criteria :**

- **Given** un user authentifié sur `/fr/account/notifications`, **When** la page render, **Then** elle affiche un toggle minimaliste : (1) "Recevoir les emails marketing Tukio" (default `false` si user n'a pas opt-in à l'inscription), (2) "Fréquence digest messages" (radio : `immediate` | `5-min digest` | `hourly digest`), (3) info read-only "Les notifications transactionnelles critiques (booking, paiement, sécurité) sont toujours envoyées".
- **Given** un user qui submit, **When** Next.js call `PATCH /v1/me/notification-preferences`, **Then** identity-svc persiste `{ marketingOptIn, messagesDigestFrequency }` sur `UserProfile`, sync Brevo `marketingOptIn` (Epic 16 V1 enriched), audit log.
- **Given** notification-svc consume un event marketing (`marketing.campaign-send.v1` — V1+), **When** il dispatche, **Then** il SKIP les users avec `marketingOptIn=false`.
- **Given** notification-svc consume un message chat event, **When** il calcule l'envoi email digest, **Then** il respecte `messagesDigestFrequency` du recipient (Story 5.4 patch FR123).
- **Given** la NFR1 (RGPD), **When** un user opt-out marketing, **Then** Brevo contact list mise à jour < 24h (cron sync). Pas de marketing email envoyé même si Brevo lag.
- **Given** la full granularité (per channel × per type) est V1 Story 11.4, **When** un user MVP veut désactiver les notifs in-app push, **Then** UI minimale MVP n'expose pas (in-app + push arrivent en V1 Epic 11).

**Epic 5 — Total stories : 10**

---

### Epic 6: Admin Moderation Console

**Outcome utilisateur** : un Admin Tukio dispose d'une console centralisée pour modérer la plateforme — queues listings/reviews/reports, suspension/ban de comptes avec sanction graduée, gestion taxonomie, gestion comptes admin, et consultation journal d'audit immuable.

**FRs covered MVP** : FR84, FR85, FR86, FR88, FR89, FR90, FR91, FR94/FR95 (UI consult)
**FRs déférés V1+** : FR87 (litige workflow — Epic 10), FR92 (event replay sensible), FR93 (user impersonation sensible)
**Note** : FR83 (KYC verification queue) couvert par **Epic 2 stories 2.3-2.5**.
**NFRs couverts** : NFR1, NFR9 (admin 2FA Story 1.7), NFR82 (audit immuable), NFR50/54 (a11y desktop-only admin)
**UX-DRs covered** : `mvp-admin` (audit Cloud Design bundle partiel), pages admin MVP (verifications via Epic 2, transactions via Epic 4) — gap V1+ pour les écrans admin avancés
**Intégrations** : aucune nouvelle (réutilise infra Epics 1-5)

#### Story 6.1: Admin dashboard home (queues counts + activity overview)

**As an** Admin (support / modo / super),
**I want** a dashboard home showing me at a glance the queues that need my attention and platform health KPIs,
**So that** je sais immédiatement quoi traiter en priorité quand je me connecte.

**Acceptance Criteria :**

- **Given** un Admin authentifié sur `admin.tukio.one/fr/`, **When** la page render, **Then** elle affiche en grid `<Card>` (responsive desktop only — UX-DR admin) :
  - Pro Verifications pending (count) → Story 2.3
  - Listings pending_moderation (count) → Story 6.2
  - Reviews pending_moderation (auto-hidden) (count) → Story 6.3
  - Reports open (count, breakdown par type) → Story 6.4
  - Saga alerts active (count) → Story 4.13
  - Today : new pros / new bookings / new transactions (KPI rapides)
- **Given** chaque card, **When** je clique dessus, **Then** je navigue vers la queue correspondante avec filtres pré-appliqués.
- **Given** un `admin-support`, **When** il accède le dashboard, **Then** il voit toutes les queues mais les actions sont read-only (peut consulter, pas modérer — RBAC).
- **Given** un `admin-modo`, **When** il accède, **Then** il a accès aux actions moderation (suspend, hide review, etc.) — Stories 6.2-6.5.
- **Given** un `admin-super`, **When** il accède, **Then** il voit en plus les cards "Admin accounts (count)" → Story 6.7 et "Audit log activity (last 24h)" → Story 6.6.
- **Given** la NFR82 audit, **When** un Admin navigue le dashboard, **Then** aucun audit log (consultation passive). Mais l'ouverture d'une queue spécifique avec filtre = audit (event `admin.queue.viewed.v1`).
- **Given** UX-DR admin, **When** je render, **Then** le layout utilise sidebar verticale gauche (navigation queues) + main content + topbar avec user dropdown. Style figé du bundle `mvp-admin` partiel (gap MVP — designer Sprint 0 layout admin global).

#### Story 6.2: Listings moderation queue (FR30 a posteriori + FR91 a priori)

**As an** Admin (modo / super),
**I want** to review listings flagged for moderation (Pros < 30 days verified, > 3 reports, or admin-flagged),
**So that** je publie ou rejette dans les 24h pour ne pas bloquer les Pros tout en protégeant la plateforme.

**Acceptance Criteria :**

- **Given** un Admin sur `/admin/listings/queue`, **When** la page charge, **Then** catalog-svc expose `GET /v1/admin/listings?status=pending_moderation&page=1&pageSize=20&sort=submittedAt:asc`, retourne enveloppe paginée avec listings.
- **Given** la queue UI, **When** elle render, **Then** chaque listing apparaît en `<Card>` avec : photo hero, titre FR + EN si dispo, Pro nom + lien profil, prix, `<Badge>` raison flag (`new_pro`, `reports_threshold`, `price_deviation`, `manual_admin_flag`), CTA "Examiner" → `/admin/listings/<id>/review`.
- **Given** la page detail listing, **When** elle render, **Then** elle affiche : preview complet de la fiche (mode "vu par Visitor"), section "Détails moderation" (raison flag + reports si existants + Pro history), 3 CTAs : "Approuver" / "Rejeter" / "Demander modification".
- **Given** un Admin clique "Approuver", **When** il confirme, **Then** catalog-svc transite listing → `published`, indexe Meilisearch, publie `catalog.listing.approved.v1`, audit log `admin.action.listing-approved.v1` (NFR82).
- **Given** un Admin clique "Rejeter", **When** il fournit raison structurée (`<Select>`: `'inappropriate_content' | 'misleading_pricing' | 'duplicate_listing' | 'policy_violation' | 'other'`) + `<Textarea>` détails ≥ 20 chars, **Then** catalog-svc transite listing → `rejected`, publie `catalog.listing.rejected.v1`, notification-svc envoie email Pro avec raison + CTA "Modifier ma fiche". Audit log.
- **Given** un Admin clique "Demander modification", **When** il fournit message libre, **Then** listing → `requires_changes`, email Pro envoyé, le Pro peut éditer et re-soumettre (re-entre dans la queue).
- **Given** RBAC, **When** un `admin-support` accède la queue, **Then** read-only ; les actions Approve/Reject/RequestChanges sont disabled avec tooltip "Permission insuffisante" (rôle `admin-modo` minimum).
- **Given** la NFR48 (24h SLA), **When** un listing est `pending_moderation` depuis > 24h, **Then** un badge SLA-dépassé apparaît + Slack alert.

#### Story 6.3: Reviews moderation queue (auto-hidden reviews from Story 5.7)

**As an** Admin (modo / super),
**I want** to review auto-hidden reviews (3+ reports threshold) and decide to restore or permanently hide,
**So that** les avis légitimes ne sont pas censurés à tort, mais le contenu abusif est filtré.

**Acceptance Criteria :**

- **Given** un Admin sur `/admin/reviews/queue`, **When** la page charge, **Then** review-svc expose `GET /v1/admin/reviews?status=pending_moderation&page=1&pageSize=20`, retourne reviews auto-hidden (Story 5.7) + reviews report-flagged manuellement.
- **Given** la queue UI, **When** elle render, **Then** chaque review apparaît avec : étoiles, content (full), Customer auteur (anonymisé "Marie L." par défaut, full visible côté admin avec audit log), Pro/listing concerné, reports count + raisons listées, CTA "Examiner".
- **Given** la page detail review, **When** un Admin clique "Restaurer", **Then** review-svc transite review → `visible` (annule auto-hide), recalcule l'aggregate listing, publie `review.restored.v1`, audit log `admin.action.review-restored.v1` avec raison.
- **Given** un Admin clique "Masquer définitivement", **When** il fournit raison structurée (`'fake_review' | 'inappropriate_content' | 'off_topic' | 'spam'`), **Then** review-svc transite → `hidden_permanently`, publie `review.hidden-permanently.v1`, notification email Customer "Votre avis a été masqué — raison : X" (transparence FR80).
- **Given** la même review reportée à nouveau après "Restaurer", **When** elle franchit le seuil 3 reports, **Then** elle est re-auto-hidden et re-entre dans la queue (cycle).
- **Given** la NFR82, **When** Admin agit, **Then** action immutable + retraçable (qui a restauré quoi quand).

#### Story 6.4: Reports / Signalements queue (FR86)

**As an** Admin (modo / super),
**I want** a unified queue for all report types (services, reviews, accounts, messages) with action-routing,
**So that** je traite les signalements quel que soit l'aggregate concerné.

**Acceptance Criteria :**

- **Given** un Admin sur `/admin/reports`, **When** la page charge, **Then** un endpoint cross-services agrégé (gateway-api `GET /v1/admin/reports?status=open`) retourne tous les reports : `listing_reports`, `review_reports`, `account_reports`, `message_reports`. Total enveloppé `{ data: [...mixed types with discriminator field], pagination, meta }`.
- **Given** la queue UI, **When** elle render, **Then** des onglets filtrent par type : `Tous (X)`, `Services (X)`, `Avis (X)`, `Comptes (X)`, `Messages (X)`, avec liste paginée triée par `reportedAt desc` ou par seuil critique.
- **Given** un report listing, **When** Admin clique "Examiner", **Then** il navigue vers `/admin/listings/<id>/review` (Story 6.2).
- **Given** un report review, **When** Admin clique "Examiner", **Then** il navigue vers `/admin/reviews/<id>/review` (Story 6.3).
- **Given** un report account (Customer ou Pro signalé pour comportement), **When** Admin clique "Examiner", **Then** il navigue vers `/admin/accounts/<id>` qui affiche le profil + historique reports + CTAs Story 6.5 (suspend/ban).
- **Given** un report message (chat abusif), **When** Admin clique "Examiner", **Then** il navigue vers `/admin/conversations/<id>` qui affiche le thread complet (lecture admin, audit log NFR82) + CTAs "Avertir l'auteur" / "Suspendre l'auteur".
- **Given** chaque report, **When** Admin résout (statue), **Then** il marque `report.resolution = 'action_taken' | 'no_action' | 'invalid'`, publie `<aggregate>.report-resolved.v1`, audit log.
- **Given** un user qui report la même cible 3× en < 24h, **When** la 4e tentative arrive, **Then** rate-limit 429 enveloppe (anti-abuse user reports).

#### Story 6.5: Suspend / Ban account + sanction graduée (FR84, FR85, FR88)

**As an** Admin (modo / super),
**I want** to apply a graduated sanction (warning → suspend publication 7d → suspend account 30d → permanent ban) with a documented reason,
**So that** la modération est proportionnée et juste.

**Acceptance Criteria :**

- **Given** un Admin sur `/admin/accounts/<id>`, **When** la page render, **Then** elle affiche : profile résumé (Customer ou Pro), historique sanctions (`<Timeline>`), reports concernant ce compte, CTAs sanction graduée. Le 1er CTA dispo dépend de l'historique : si jamais sanctionné → "Avertir", si déjà averti → "Suspendre publication 7j", etc. (FR88 graduation logique).
- **Given** un Admin qui clique "Avertir", **When** il fournit raison structurée + message libre ≥ 30 chars, **Then** identity-svc persiste un `Sanction` aggregate `{ accountId, level: 'warning', reason, by, at }`, publie `identity.account.warned.v1`, notification-svc envoie email "Avertissement : votre comportement a été signalé. Détails : ...". Audit log.
- **Given** "Suspendre publication 7j" (rôle `admin-modo`), **When** Admin confirme, **Then** identity-svc set `Sanction { level: 'suspended_publication', durationDays: 7, ... }`, publie `identity.account.publication-suspended.v1`, catalog-svc consume → tous listings actifs du Pro passent en `unpublished` (cf. Story 3.6 + dépublication temporaire), un cron `restore-publication.task.ts` réactive J+7. Email Pro avec raison.
- **Given** "Suspendre compte 30j" (rôle `admin-modo`), **When** Admin confirme, **Then** identity-svc set Sanction, sync Keycloak `enabled=false`, sessions invalidées, user redirigé vers `/account/suspended` à la prochaine connexion avec raison + date de fin. Cron `restore-account.task.ts` réactive J+30. Email envoyé.
- **Given** "Bannir définitivement" (FR85, rôle `admin-super` UNIQUEMENT), **When** Admin confirme via modale destructive double-confirm + raison ≥ 50 chars, **Then** identity-svc (1) hash `email`, `phone`, `ipAddress` historique avec sel + persiste dans `banned_identifiers` table (anti-recréation FR85), (2) sync Keycloak `enabled=false` + flag `banned: true`, (3) anonymise PII selon Story 1.9 (mais avec marker `banned`, pas user-deleted), (4) publie `identity.account.banned.v1`, (5) audit log critique avec `actor=admin-super`, raison documentée immutable.
- **Given** la table `banned_identifiers`, **When** un Visitor essaie de s'inscrire (Story 1.2/1.3) avec un email/phone/IP qui hash matche, **Then** identity-svc retourne 403 enveloppe `IDENTITY-FORBIDDEN-001` "Inscription impossible" (sans révéler la raison — sécurité).
- **Given** la NFR82 audit, **When** une sanction est appliquée, **Then** event `identity.account.<level>.v1` audit log avec breakdown complet (actor, target, level, reason, durationDays, expectedRestoreAt).
- **Given** un account suspendu/banni avec bookings actifs, **When** la sanction est appliquée, **Then** un workflow gracieux : (1) Admin doit choisir "Annuler les bookings actifs" ou "Conserver les bookings jusqu'à completion" (modal explicite), (2) selon choix, booking-svc cancel les bookings + payment-svc refund (Story 4.12) ou laisse couler.

#### Story 6.6: Audit log viewer + export (FR89)

**As an** Admin Super,
**I want** to consult and export the immutable audit log with filters,
**So that** je traçabilise toute action sensible pour compliance et investigations.

**Acceptance Criteria :**

- **Given** un `admin-super` sur `/admin/audit`, **When** la page charge, **Then** identity-svc expose `GET /v1/admin/audit?actorId=&actionType=&aggregateType=&aggregateId=&from=&to=&page=1&pageSize=50` (avec RBAC strict — `admin-modo` peut lire actions le concernant uniquement, `admin-super` voit tout).
- **Given** la queue UI, **When** elle render, **Then** elle affiche un tableau filtrable : `at`, `actor (Avatar + name + role)`, `action_type`, `aggregate_type`, `aggregate_id (clickable → page detail)`, `reason` (truncated, "Lire la suite"), `correlation_id (clickable → Tempo trace)`, `before/after diff` (collapsible JSON pretty).
- **Given** la NFR82 immutabilité, **When** un `admin-super` essaie d'éditer ou supprimer une row, **Then** la DB rejette via trigger Postgres `audit_log_immutable_trigger` (Story 2.7) + audit_log lui-même log la tentative comme `admin.audit-tamper-attempt.v1` (alerte critique Slack).
- **Given** `admin-super` qui clique "Exporter", **When** il choisit format `CSV` ou `JSONL` + range date, **Then** un job async background génère l'export sur Cloudflare R2 chiffré, signed URL 30 min, email envoyé "Votre export est prêt".
- **Given** la NFR1 (RGPD audit retention), **When** un cron `archive-audit-log.task.ts` tourne mensuellement, **Then** rows > 5 ans sont archivés vers R2 chiffré + supprimées de DB chaude (Story 2.7).
- **Given** UX-DR admin, **When** je render, **Then** la page utilise `<DataTable>` (V1 — MVP : `<Card>` + pagination simple — gap UX Sprint 0 à designer).

#### Story 6.7: Admin user management (`admin-super` only) — FR90

**As an** Admin Super,
**I want** to create, edit, and revoke admin accounts (provisionnement manuel uniquement),
**So that** la gestion des privilèges admin est contrôlée et auditée.

**Acceptance Criteria :**

- **Given** un `admin-super` sur `/admin/admins`, **When** la page charge, **Then** identity-svc expose `GET /v1/admin/admins` qui retourne enveloppe avec liste des admins (id, email, full name, role, createdAt, lastLoginAt, status, createdBy).
- **Given** un `admin-super` qui clique "Créer un admin", **When** une modale demande `{ email, firstName, lastName, role: 'admin-support' | 'admin-modo' | 'admin-super', initialPassword? (auto-généré si vide) }`, **Then** au submit : identity-svc (1) crée le user dans Keycloak avec rôle approprié + `requireTotpSetup: true` (Story 1.7), (2) génère un setup-link Keycloak (TTL 24h), (3) email envoyé au nouvel admin avec lien "Configurer mon compte admin" (forcé email-verify + TOTP setup à la 1ère connexion), (4) publie `identity.admin.created.v1`, audit log avec `actor=admin-super`.
- **Given** un `admin-super` qui édite un admin, **When** il change le rôle (ex: `admin-modo` → `admin-super`), **Then** double confirmation + raison ≥ 30 chars demandée + email auto à l'admin élevé "Vous avez désormais des privilèges Super, raison : ...", audit log.
- **Given** un `admin-super` qui révoque un admin, **When** il clique "Révoquer" et confirme, **Then** identity-svc (1) sync Keycloak `enabled=false`, (2) invalide toutes sessions, (3) marque `Admin.revokedAt`, (4) publie `identity.admin.revoked.v1`, audit log critique. L'admin révoqué est redirigé vers `/admin/access-revoked` à la prochaine req.
- **Given** un `admin-super` qui essaie de se révoquer lui-même, **When** il clique, **Then** la modale bloque "Vous ne pouvez pas révoquer votre propre compte. Demandez à un autre admin Super" (NFR9 — sécurité contre self-lockout).
- **Given** la dernière `admin-super` actif (cas extrême), **When** quelqu'un essaie de la révoquer, **Then** l'opération est bloquée avec message "Au moins un admin Super doit rester actif" (cohérence opérationnelle).
- **Given** la NFR9 (admin 2FA TOTP obligatoire Story 1.7), **When** un nouvel admin se connecte, **Then** flow forcé : email verify → TOTP setup → dashboard.

#### Story 6.8: Taxonomy editor (`admin-super` only) — FR91

**As an** Admin Super,
**I want** to edit the catalog taxonomy (categories, sub-categories, service types, translations) without redeploying,
**So that** je peux ajuster la structure produit selon retours marché sans dev-cycle.

**Acceptance Criteria :**

- **Given** un `admin-super` sur `/admin/taxonomy`, **When** la page charge, **Then** elle affiche un arbre éditable : root categories → sub-categories → service types (drag & drop pour réordonner). Chaque nœud a `name (FR)`, `name (EN)`, `slug (EN strict)`, `description (FR/EN)`, `mvpPilot (bool)`, CTAs `Éditer`, `Ajouter sous-catégorie`, `Supprimer`.
- **Given** un Admin Super qui édite un name FR, **When** il save, **Then** catalog-svc `PATCH /v1/admin/taxonomy/<id>` update `category_translations`, publie `catalog.taxonomy.updated.v1`, invalide les caches Next.js (`revalidateTag('taxonomy')`), audit log.
- **Given** un Admin Super qui crée une nouvelle sous-catégorie, **When** il submit, **Then** catalog-svc valide unicité slug, persiste, publie `catalog.taxonomy.created.v1`, retourne enveloppe 201.
- **Given** un Admin qui essaie de delete une catégorie ayant des listings actifs, **When** il clique, **Then** catalog-svc retourne 409 enveloppe `CATALOG-CONFLICT-001` "X listings utilisent cette catégorie. Retirez-les ou re-mappez avant suppression" + lien vers la liste.
- **Given** la NFR58 paths EN strict, **When** un Admin essaie de saver un slug `/categorie/...` (FR), **Then** validation Zod côté server rejette avec 422 "Slug doit être en EN".
- **Given** une modification de taxonomie, **When** elle est appliquée, **Then** un Meilisearch reindex partiel est déclenché (uniquement pour les listings de la catégorie modifiée) — coordination via NATS event `catalog.taxonomy.updated.v1` consommé par Story 3.7 indexer.
- **Given** la NFR82, **When** Admin Super modifie taxonomie, **Then** audit log avec `before/after` JSON diff complet pour traçabilité.

**Epic 6 — Total stories : 8**

---

### Epic 7: i18n FR/EN + Acquisition Foundation

**Outcome utilisateur** : la plateforme est bilingue FR/EN dès le 1er jour (URLs locale-prefixées, hreflang systématique, fallback FR transparent), Visitor → Customer/Pro tracking acquisition complet (UTM multi-touch attribution, referral codes), SEO foundation prête (sitemap dynamique, robots.txt, JSON-LD), analytics Plausible (RGPD-friendly). Mitigation RA1 (risque acquisition velocity).

**FRs covered MVP** : FR96 (auto-detect Accept-Language fallback FR), FR97 (user choisit locale + cookie + persistence account), FR98 (locale-prefix URLs + hreflang systématique)
**FRs déjà couverts dans Epics précédents** : FR99 (Story 3.3), FR100 (Story 5.9), FR102 (Story 5.4), FR103 (Story 3.7) ; FR101 V1 (DeepL — déféré)
**NFRs covered** : NFR58 (URLs EN strict + hreflang), NFR60 (Meilisearch fallback), NFR64 (acquisition tracking ≥ 12 mois rétention), NFR5 (Core Web Vitals SEO), NFR48 (UX bilingue), NFR1 (RGPD analytics)
**Risques mitigés** : **RA1** (acquisition velocity)
**UX-DRs covered** : Language switcher (gap MVP — designer Sprint 0)
**Intégrations** : Plausible Analytics (cookie-less RGPD), next-intl 4

#### Story 7.1: next-intl setup + locale routing middleware (FR96, FR97, FR98)

**As a** developer,
**I want** next-intl 4 fully integrated with shared config in `@tukio/i18n-client` (Story 0.9), middleware for locale routing, and locale persistence,
**So that** the 4 frontend apps share one bilingual config and respect FR96/FR97/FR98.

**Acceptance Criteria :**

- **Given** chaque app frontend (`apps/{public,customer,seller,admin}`), **When** je regarde `middleware.ts`, **Then** elle utilise `createMiddleware` de `@tukio/i18n-client` (Story 0.9) avec `locales: ['fr', 'en']`, `defaultLocale: 'fr'`, `localePrefix: 'always'` (FR98 — toutes les URLs sont prefixées).
- **Given** un Visitor arrive sans cookie locale, **When** il accède `tukio.one/`, **Then** middleware lit `Accept-Language` header, choisit `fr` ou `en`, redirige 302 vers `/fr/` ou `/en/` (FR96). Si header non-FR/EN, fallback `fr`.
- **Given** un user authentifié avec `tukio:locale='en'` claim JWT, **When** il accède n'importe quelle page sans préfixe explicite, **Then** middleware lit le claim et redirige vers `/en/...` (FR97 — user choice persistant).
- **Given** un user qui change manuellement la langue via `<LanguageSwitcher>` (Story 7.2), **When** il toggle FR → EN, **Then** Next.js (1) écrit cookie `NEXT_LOCALE=en` (Domain=.tukio.one, max-age 1 an), (2) si user authentifié, call `PATCH /v1/me { locale: 'en' }` (Story 1.8) qui sync Keycloak claim + DB, (3) refresh la page sur `/en/...` équivalent.
- **Given** `packages/i18n-client/src/messages/{fr,en}/`, **When** je l'ouvre, **Then** je trouve les fichiers JSON bilingues partagés cross-apps : `common.json` (boutons, labels, errors générique), `auth.json`, `catalog.json`, `booking.json`, `seller.json`, `admin.json`. Cohérence ICU MessageFormat (pluriels, nombres, dates).
- **Given** un dev qui ajoute un nouveau texte UI hardcoded `<button>Reserver</button>`, **When** la CI tourne, **Then** le lint custom `tukio/no-hardcoded-text` (Story 0.11) rejette la PR (NFR56 — utiliser `useTranslations()`).
- **Given** la NFR48 (UX), **When** un Visitor change la langue, **Then** la transition est instantanée (next-intl client-side switch sans full reload si même page).

#### Story 7.2: Language switcher UI + hreflang systematic (NFR58)

**As a** Visitor / Customer / Pro,
**I want** a clear language switcher in the UI and hreflang tags on every page,
**So that** je change de langue facilement, et les moteurs de recherche découvrent les versions FR/EN.

**Acceptance Criteria :**

- **Given** le pattern `<LanguageSwitcher>` (gap MVP — designer Sprint 0), **When** je l'ouvre dans `packages/ui/src/patterns/LanguageSwitcher/`, **Then** il affiche un dropdown avec drapeaux FR/EN (fallback texte si emoji blocked) + libellé `FR` / `EN` + check marker sur la locale active.
- **Given** le `<LanguageSwitcher>` placé dans `<TopBar>` (Story 0.5) et `<Footer>`, **When** un user clique, **Then** il déclenche le flow Story 7.1 (cookie + sync user + redirect).
- **Given** chaque page Next.js, **When** elle render via `generateMetadata` (Next.js 15), **Then** elle injecte automatiquement `<link rel="alternate" hreflang="fr" href="https://tukio.one/fr/...">` ET `<link rel="alternate" hreflang="en" href="https://tukio.one/en/...">` ET `<link rel="alternate" hreflang="x-default" href="https://tukio.one/fr/...">` (NFR58, défaut FR).
- **Given** un helper `<Hreflang>` dans `@tukio/i18n-client` (Story 0.9), **When** il est utilisé dans `layout.tsx` de chaque app, **Then** il génère les 3 balises sans duplication.
- **Given** un Visitor sur `/fr/services/<slug>`, **When** Googlebot crawle, **Then** il découvre la version `/en/services/<slug>` via hreflang et indexe les 2 versions distinctement (NFR5 SEO).
- **Given** la NFR50 a11y, **When** un user navigue avec clavier, **Then** le `<LanguageSwitcher>` est focusable, le dropdown s'ouvre avec Espace/Enter, items navigables avec flèches, ESC ferme. `aria-label="Choisir la langue"`.

#### Story 7.3: Sitemap dynamique + robots.txt + structured data audit (NFR5)

**As a** SEO,
**I want** dynamic sitemaps per locale + robots.txt + JSON-LD coverage audit on all public pages,
**So that** Google découvre 100 % du catalogue rapidement et le ranking est optimisé.

**Acceptance Criteria :**

- **Given** `apps/public/src/app/sitemap.ts`, **When** je l'ouvre, **Then** il utilise `MetadataRoute.Sitemap` Next.js 15 et génère dynamiquement : home `/{locale}/` (priority 1.0), categories `/{locale}/category/<slug>` (0.9), listings `/{locale}/services/<slug>` (0.8), pros `/{locale}/pro/<slug>` (0.7), pages statiques `/{locale}/about`, `/{locale}/help`, `/{locale}/legal/*` (0.5). Une URL par locale (FR + EN) = ~×2 URLs.
- **Given** un sitemap > 50k URLs (limite Google), **When** il est généré, **Then** il est split en `sitemap-categories.xml`, `sitemap-listings.xml`, `sitemap-pros.xml` avec un `sitemap-index.xml` racine.
- **Given** `apps/public/src/app/robots.ts`, **When** je l'ouvre, **Then** il génère `robots.txt` avec : `User-agent: *`, `Allow: /`, `Disallow: /admin/`, `Disallow: /seller/onboarding/`, `Disallow: /customer/`, `Sitemap: https://tukio.one/sitemap.xml`.
- **Given** Google Search Console (V1 setup), **When** je submit le sitemap, **Then** le crawl rate augmente et toutes les listings sont indexées sous 7 jours (NFR5).
- **Given** un audit JSON-LD via Lighthouse CI (Story 0.11), **When** il tourne sur les pages publiques, **Then** chaque type a son schema.org : home `Organization` + `WebSite` + `SearchAction`, category `ItemList`, listing `Service` + `Offer` + `aggregateRating` + `Review`, pro `LocalBusiness` + `aggregateRating`. Coverage ≥ 100 % sur les pages publiques principales (audit script `pnpm audit:seo`).
- **Given** la NFR58 paths EN strict, **When** Googlebot crawle `/fr/category/tents-marquees`, **Then** le slug reste en EN (`tents-marquees`, pas `chapiteaux`) — cohérence de Sprint 0.
- **Given** la NFR5 Core Web Vitals, **When** Lighthouse mesure les pages publiques, **Then** SEO score ≥ 95 sur home + category + listing detail (CI Story 0.11).

#### Story 7.4: Plausible Analytics setup + custom events (RGPD-friendly)

**As a** product owner,
**I want** Plausible Analytics integrated (cookie-less, RGPD-compliant) with custom events on key conversions,
**So that** je mesure le funnel acquisition sans avoir besoin d'un cookie banner ni de craindre la CNIL.

**Acceptance Criteria :**

- **Given** `apps/public/src/app/layout.tsx` (et apps customer/seller), **When** je l'ouvre, **Then** un script Plausible est inclus via `<Script src="https://plausible.io/js/script.outbound-links.tagged-events.js" data-domain="tukio.one" />` (RGPD : pas de cookies, pas d'IP stockée — NFR1).
- **Given** la home `/fr/`, **When** un Visitor charge la page, **Then** Plausible enregistre `pageview` automatique (sans PII).
- **Given** un Visitor qui clique le CTA "Réserver" sur une fiche service, **When** il submit, **Then** un custom event `plausible('Booking Started', { props: { listingId, category, locale } })` est fire (Story 4.5).
- **Given** un Customer qui complete un booking (`/checkout/success`), **When** la page render, **Then** event `plausible('Booking Completed', { props: { listingId, category, amount, locale, source } })` (avec `source` lu depuis `acquisition_source` user).
- **Given** un Pro qui s'inscrit, **When** Story 1.3 complete, **Then** event `plausible('Pro Registered', { props: { category? (intended), source, campaign? } })`.
- **Given** un Customer qui s'inscrit, **When** Story 1.2 complete, **Then** event `plausible('Customer Registered', { props: { source, campaign? } })`.
- **Given** Plausible dashboard, **When** je consulte, **Then** je vois funnel `Home → Search → Listing → Booking Started → Booking Completed` avec taux conversion par étape, segmenté par source (`google_ads`, `meta_ads`, `organic`, `direct`, `referral`).
- **Given** la NFR1 RGPD, **When** je cherche le cookie banner, **Then** Tukio n'en a pas besoin pour Plausible (pas de cookie). Si V1 ajoute PostHog avec cookies, alors banner s'imposera (NFR1 conformité — déféré V1).
- **Given** Plausible config, **When** je vérifie le data residency, **Then** Plausible EU servers (Allemagne) — RGPD-compliant by default.
- **Given** la FR106 (events business critiques server-side), **When** un event NATS critique est publié (`booking.confirmed.v1`, `payment.intent-captured.v1`, `payment.refund-issued.v1`, `identity.user.registered.v1`, `identity.pro.verified.v1`), **Then** un consumer dédié `analytics-svc` (ou une lambda Vercel) consomme et push vers une analytics warehouse (V1 enriched : PostHog OR ClickHouse OR BigQuery). Server-side events INDÉPENDANTS du JS client (résiste aux ad-blockers) avec `correlationId` cross-référencé aux events Plausible client.
- **Given** un dashboard SQL warehouse, **When** je query `SELECT count(*) FROM events WHERE event_type = 'booking.confirmed' AND occurred_at > NOW() - INTERVAL '7 days'`, **Then** je vois le vrai count de conversions (vs Plausible client qui peut être bloqué).

#### Story 7.5: Acquisition tracking enrichment + multi-touch attribution

**As a** product owner,
**I want** UTM and referral parameters captured on first touch + last touch with multi-touch attribution table,
**So that** je sais d'où viennent mes meilleurs Customers/Pros et j'optimise les canaux ROI-positifs.

**Acceptance Criteria :**

- **Given** Story 0.13 a déjà ajouté les colonnes `acquisition_*` sur `users` et `bookings`, **When** un Visitor arrive sur `tukio.one/fr/?utm_source=google_ads&utm_medium=cpc&utm_campaign=spring2026&utm_content=ad-variant-A`, **Then** Next.js middleware (1) parse les UTM params, (2) écrit cookie `tukio-acq-first` (Domain=.tukio.one, max-age 90 jours, JSON: `{ source, medium, campaign, content, term, landingPage, at }`) — never overwritten if already exists, (3) écrit cookie `tukio-acq-last` (max-age 30 jours, overwritten à chaque visite avec UTM différents).
- **Given** un Visitor qui s'inscrit (Customer Story 1.2 ou Pro Story 1.3), **When** identity-svc crée le user, **Then** il lit les cookies `tukio-acq-first` et `tukio-acq-last`, persiste les colonnes `acquisition_first_*` et `acquisition_last_*` sur `users`. Audit log inclus.
- **Given** un Customer authentifié qui réserve (Story 4.4), **When** le Booking est créé, **Then** booking-svc snap les `acquisition_*` du user vers le booking aussi (multi-touch — un même user peut booker via différentes campagnes au fil du temps).
- **Given** une nouvelle table `acquisition_touchpoint` créée Sprint 0 (extension Story 0.13), **When** un user fait une action significative (visit, register, book), **Then** identity-svc INSERT un row `{ id, actorId, eventType, source, medium, campaign, content, term, occurredAt }` (multi-touch attribution complete — NFR64 ≥ 12 mois rétention).
- **Given** un dashboard Grafana / Plausible / PostHog (V1 enriched), **When** je consulte le funnel, **Then** je peux segmenter par `first_touch_source` ou `last_touch_source` ou `multi-touch` (modèle linéaire weighted).
- **Given** la NFR1 RGPD, **When** un user demande la suppression de son compte (Story 1.9), **Then** ses `acquisition_touchpoint` rows sont anonymisés (actorId → uuid v5 stable + suppression cookies trackés) mais data agrégée préservée pour analytics.

#### Story 7.6: Referral codes foundation (génération + tracking — UI V1)

**As a** product owner,
**I want** every Customer and Pro to have a unique referral code generated automatically, tracked when used,
**So that** when V1 ships referral program (Epic 11), the foundation is already collecting data and the V1 launch isn't a cold start.

**Acceptance Criteria :**

- **Given** Story 1.2 (Customer register) ou 1.3 (Pro register), **When** identity-svc crée le user, **Then** il génère un `referralCode` (8 chars alphanumériques, exclude ambiguous chars `0/O`, `1/I/l`), unique check, persiste sur `users.referral_code`. Format ex: `K7P9XQ2M`.
- **Given** un Visitor qui arrive sur `tukio.one/?ref=K7P9XQ2M`, **When** Next.js middleware parse, **Then** il (1) valide existence du code (call `/v1/referrals/<code>/validate`), (2) écrit cookie `tukio-acq-referral` (max-age 90 jours, `{ referralCode, referrerActorId, at, landingPage }`), (3) inclut `referralCode` dans le `tukio-acq-first` cookie (Story 7.5).
- **Given** un Visitor s'inscrit avec ce cookie, **When** identity-svc crée le user, **Then** il persiste `acquisition_referral_id = <referrerActorId>` sur le nouveau user (Story 0.13 column), publie `identity.user.registered.v1` avec `referralChain: { referrerId, code }`.
- **Given** une table `referral_event` créée, **When** un referral est utilisé (signup, ou plus tard 1ère booking), **Then** un row `{ id, referrerActorId, referredActorId, eventType, occurredAt, rewardEligible }` est INSERT (V1 program calcule rewards depuis cette table — Epic 11).
- **Given** un user qui consulte `/customer/account/profile` (Story 1.8), **When** la page render, **Then** elle affiche le `referralCode` user dans une section "Parrainage (V1+ : récompenses bientôt)" + CTA "Copier le lien" → `https://tukio.one/?ref=<code>` (UI MVP minimal — V1 program complet Epic 11).
- **Given** la NFR82 audit, **When** un referral est utilisé, **Then** l'event `identity.referral.used.v1` est publié + audit log.

#### Story 7.7: Email locale dispatch QA + i18n cohérence audit

**As a** QA / product owner,
**I want** automated tests verifying every transactional email renders correctly in FR and EN with no missing translation keys,
**So that** je garantis l'expérience bilingue cohérente sur les 18 templates email.

**Acceptance Criteria :**

- **Given** un test automatisé `email-i18n.spec.ts` dans `apps/notification-svc/test/`, **When** il s'exécute, **Then** il (1) loop sur les 9 templates Story 5.4 × 2 locales = 18 renders, (2) vérifie que chaque template render sans erreur React, (3) extrait tous les `<Text>` ou `<Heading>` et compare cross-locale pour détecter missing keys (FR a une string, EN n'a pas → fail), (4) vérifie les liens (CTAs) ne sont pas vides, (5) vérifie les variables interpolées (ex: `{userName}`) sont remplacées correctement.
- **Given** un script `pnpm i18n:audit`, **When** je l'exécute, **Then** il scan tous les `useTranslations('namespace')` dans les 4 frontend apps + email templates, agrège les keys utilisées, compare avec `messages/{fr,en}/*.json`, détecte : (a) keys utilisées mais absentes du JSON, (b) keys présentes JSON mais inutilisées (cleanup). Fail si keys missing.
- **Given** un Customer FR qui reçoit `booking-confirmed-customer.fr.tsx`, **When** il l'ouvre, **Then** tous les textes sont en FR (titre, body, CTA, footer), date au format `15 août 2026` (Intl.DateTimeFormat fr-FR), montant `120,50 €` (séparateur virgule). Idem en EN : `August 15, 2026`, `€120.50` (séparateur point).
- **Given** la cohérence terminologique, **When** je relis les 18 templates, **Then** les termes clés sont cohérents : `booking` (EN) ↔ `réservation` (FR), `listing` ↔ `fiche service`, `Pro` ↔ `Pro`/`Prestataire`, `Customer` ↔ `Client`, etc. (un glossaire `docs/i18n-glossary.md` formalisé Sprint 0).
- **Given** un Customer EN avec un Pro qui a une fiche FR uniquement (FR99 + Story 5.9), **When** un email transactionnel est envoyé, **Then** le template EN est utilisé (locale Customer prime), MAIS le `listing.title` injecté dans le template reste en FR (snapshot du listing) avec un disclaimer en EN "Service title in French".
- **Given** la CI, **When** une PR ajoute un nouveau template ou modifie un existant, **Then** le test `email-i18n.spec.ts` tourne automatiquement et bloque le merge en cas de discrepancy FR/EN.

#### Story 7.8: SEO foundation + Open Graph + structured data complet (NFR5)

**As a** product owner,
**I want** every public page to have proper Open Graph tags, Twitter Cards, JSON-LD structured data, and canonical URLs,
**So that** social shares look professional and rankings are maximized from day 1.

**Acceptance Criteria :**

- **Given** chaque page publique (home, category, listing, pro), **When** elle render via `generateMetadata` Next.js 15, **Then** elle injecte automatiquement : `<title>` (60 chars max), `<meta name="description">` (155 chars max), `<link rel="canonical">` (URL canonique), Open Graph (`og:title`, `og:description`, `og:image` (1200×630), `og:type`, `og:url`, `og:locale`, `og:site_name='Tukio'`), Twitter Cards (`twitter:card='summary_large_image'`, `twitter:title`, `twitter:description`, `twitter:image`).
- **Given** un Visitor qui partage une fiche service sur LinkedIn ou WhatsApp, **When** le preview render, **Then** il affiche le titre, description, et `og:image` correcte (la photo hero du listing optimisée 1200×630 via Cloudflare Images variant `og`).
- **Given** une page sans og:image custom (ex: home), **When** elle render, **Then** un og:image fallback Tukio générique est servi (`https://tukio.one/og-default.png` brand-500 + logo + tagline).
- **Given** les 18 templates email Story 5.4 + 7.7, **When** un user clique un CTA, **Then** l'URL inclut `?utm_source=email&utm_medium=transactional&utm_campaign=<template_name>` automatiquement (tracking de la performance email).
- **Given** un Visitor partage une fiche service en EN, **When** il clique un lien sur Slack, **Then** preview render `/en/services/<slug>` avec `og:locale='en_US'` (cohérence locale FR97).
- **Given** la NFR5, **When** Lighthouse mesure SEO score, **Then** ≥ 95/100 sur home + category + listing detail. Si < 95, CI fail (Story 0.11).
- **Given** un audit avec Search Console (V1 monitoring), **When** je vérifie après 30 jours en prod, **Then** > 80 % des URLs publiques sont indexées Google + 0 erreurs critiques.

#### Story 7.9: Legal pages FR + EN (CGU, CGV, Privacy, Mentions légales) — FR104

**As a** Visitor / Customer / Pro,
**I want** to access legal pages (Terms of Service, Sales Conditions, Privacy Policy, Legal Notices) in FR and EN,
**So that** je suis informé de mes droits et la plateforme respecte les obligations légales (RGPD, art. L. 111-1 Code conso, art. 6-III LCEN).

**Acceptance Criteria :**

- **Given** `apps/public/src/app/[locale]/legal/`, **When** je l'ouvre, **Then** je trouve 4 pages MDX (Markdown enrichi) bilingues : `terms-of-service/page.mdx` (CGU), `sales-conditions/page.mdx` (CGV plateforme), `privacy-policy/page.mdx` (politique confidentialité RGPD), `legal-notice/page.mdx` (mentions légales SIREN, RCS Nantes, hébergeur Hetzner, DPO contact). Chaque page a sa version `.fr.mdx` + `.en.mdx` (next-intl routing).
- **Given** un Visitor sur `/fr/legal/privacy-policy`, **When** la page render, **Then** elle affiche : preamble RGPD, droits utilisateur (accès/rectification/suppression/opposition/portabilité), liste des données collectées par catégorie, sous-traitants tiers (Stripe, Resend, Cloudflare, Plausible, Hetzner, Neon, Keycloak, Meilisearch, Brevo), durées de rétention (Story 1.9 + 5.3), contact DPO + lien CNIL.
- **Given** un Visitor sur `/fr/legal/sales-conditions`, **When** la page render, **Then** elle affiche : commission Tukio (15 % MVP, transparente), mandat 289 CGI (FR54), politiques annulation (3 templates Story 4.8), responsabilités plateforme vs Pros (Tukio = intermédiaire, pas le prestataire).
- **Given** la NFR58 paths EN, **When** je regarde l'URL, **Then** `/fr/legal/terms-of-service` (slug EN strict, override K-05) ; le `<Footer>` (Story 0.5) link "CGU" → `/fr/legal/terms-of-service` (libellé FR, path EN).
- **Given** la NFR1 (RGPD), **When** un user demande l'export de ses données ou la suppression (Story 1.9), **Then** la page Privacy Policy détaille la procédure + lien `/fr/account/data-export` (V1+ self-service — MVP : email DPO).
- **Given** Story 7.3 sitemap, **When** il génère, **Then** les 4 pages legal × 2 locales = 8 URLs sont incluses avec priority 0.5.
- **Given** la NFR50 a11y, **When** je consulte les pages legal, **Then** structure sémantique (h1, h2, h3 hiérarchique), table des matières navigable, focus management.

**Epic 7 — Total stories : 9**

---

## Couverture MVP — Récap end-of-Epic 7 (sortie MVP)

**Total stories MVP** : Epic 0 (13) + Epic 1 (11) + Epic 2 (8) + Epic 3 (12) + Epic 4 (13) + Epic 5 (10) + Epic 6 (8) + Epic 7 (9) = **84 stories**. (Epic 1 = 11 stories après ajout Story 1.11 dual-portal 2026-05-17.)

**FRs MVP couverts (sur 130 total PRD)** :
- A. Identity (FR1, FR3, FR4, FR7, FR8, FR9, FR14-17) : **10/17** — Epic 1
- B. Pro Onboarding (FR3 KYC, FR23, FR83, FR94-95) : **5/5** — Epic 2
- C. Catalog (FR18-26 sauf V1+, FR30-33, FR99, FR103) : **15/16** — Epic 3
- D. Booking/Payment (FR34-38, FR42-49, FR53-65 sauf V1+) : **18/18** — Epic 4
- E. Messaging/Reviews (FR67-68, FR73-75, FR79-82, FR100, FR102) : **11/16** — Epic 5
- F. Admin (FR84-91, FR94-95) : **8/13** — Epic 6
- I. i18n (FR96-103) : **8/8** — Epic 7 + Epics 3/5

**FRs déférés V1+** : ~49 FRs (capabilités non MVP-critiques : B2B, social login, abonnements, PWA, mobile native, multi-vendeur cart, modifications résa, devis personnalisé, etc.) → Epics 8-16.

**Critère de sortie MVP** : Epics 0-7 livrés et déployés en production. Permet d'atteindre cible MVP **50 pros + 100 résa** en Pays de la Loire bilingue FR/EN.

---

### Epic 8: B2B Customer Accounts & Multi-Vendor Cart (V1)

**Outcome** : Customer Enterprise crée un compte B2B avec SIRET + facturation entreprise + utilisateurs multiples. Multi-vendor cart débloqué (panier mixant plusieurs Pros = N saga parallèles).

**FRs covered V1** : FR2 (B2B account), FR35 V1 (multi-vendor cart), FR52 (factures Customer UI)
**Dépend de** : Epics 1, 3, 4

#### Story 8.1: Customer B2B account registration (FR2)

**As a** Customer Enterprise (acheteur dans une entreprise),
**I want** to register a B2B account with SIRET + raison sociale + billing address,
**So that** je reçois des factures conformes B2B (TVA + numéro entreprise) au nom de ma société.

**ACs** :
- Given un Visitor sur `/fr/auth/sign-up?type=b2b`, When il submit `{ companyName, siret, vatNumber, billingAddress, contactName, email, password }`, Then identity-svc valide SIRET via INSEE (Story 1.3), crée user avec rôle `client` + `tukio:accountType='business'`, persiste `BusinessProfile` aggregate.
- Given un B2B account créé, When il commande, Then les factures appliquent `vatTreatment='b2b_intra_eu_reverse_charge'` ou `b2c_fr_standard` selon vatNumber (Story 4.9 cas C activé).
- Given multi-utilisateurs, When un B2B Admin invite un collègue, Then notification email + flow accept invitation, le nouveau user a rôle `business-buyer` ou `business-admin` (RBAC interne).

#### Story 8.2: Multi-vendor cart + parallel saga orchestration (FR35 V1)

**As a** Customer,
**I want** to mix services from multiple Pros in one cart and pay once,
**So that** je n'ai pas à faire 3 checkouts distincts pour mon événement.

**ACs** :
- Given un Customer qui ajoute un 2e listing d'un autre Pro, When le store détecte (Story 4.3 modal qui bloquait MVP), Then il accepte (V1) et stocke la 2e ligne avec `proId` distinct.
- Given checkout multi-vendor, When `POST /v1/bookings/multi`, Then booking-svc crée N bookings parallèles (un par Pro), chacun avec son saga propre + son PaymentIntent. Si un Pro refuse, refund partiel uniquement sur sa quote-part.
- Given le checkout, When Stripe — architecture choisie : N PaymentIntents séparés `transfer_data.destination` distincts, regroupés par `transfer_group=cartId`.
- Given UX checkout multi-vendor, When la page render, Then chaque Pro est card-isolated avec status own + cancellation policy + total partiel ; total global en footer.

#### Story 8.3: Customer invoices UI download (FR52)

**As a** Customer,
**I want** to download all my booking invoices from my account,
**So that** je gère ma comptabilité (B2B) ou mes remboursements (B2C).

**ACs** :
- Given un Customer sur `/customer/bookings/<id>/invoices`, When la page render, Then liste des factures (Story 4.9 PDFs) avec dates, montants, status, CTA "Télécharger PDF" → signed URL R2 5 min.
- Given un Customer B2B sur `/customer/account/billing`, When il consulte, Then il voit toutes ses factures cumulées + filtres date range + export ZIP.

#### Story 8.4: B2B billing settings + multi-user management

**As a** B2B Admin,
**I want** to manage billing details (VAT, address, email facturation) and add other team members to my account,
**So that** mon entreprise utilise Tukio à plusieurs avec une seule facturation centralisée.

**ACs** :
- Given un B2B Admin sur `/customer/account/business`, When il édite SIRET ou VAT, Then identity-svc revalidate INSEE + persiste, audit log.
- Given B2B Admin invite, When il submit `{ email, role: 'business-buyer' | 'business-admin' }`, Then notification-svc envoie invitation, accept flow crée user lié au `BusinessProfile`.
- Given un B2B Admin qui retire un user, When il confirme, Then user-link supprimé mais bookings du user restent (history préservée).

**Epic 8 — 4 stories**

---

### Epic 9: Pro Subscriptions, Tiers & Échéanciers (V1)

**Outcome** : Pros choisissent un tier d'abonnement (Starter gratuit / Business 29 €/mois / Enterprise sur devis), facturé via Stripe Subscriptions, Stripe = source of truth (FR66). Customer peut payer en 30/70 (acompte + solde).

**FRs covered V1** : FR57-59 (subscriptions), FR66 (Stripe Subscription source), FR51 (échéancier 30/70), FR50 (saved card), FR55 (export CSV/PDF)

#### Story 9.1: Subscription tiers data model + Stripe Products/Prices setup

**ACs** :
- Given Stripe products `tukio_starter`, `tukio_business`, `tukio_enterprise` (custom price), When un Pro subscribe, Then payment-svc crée `Stripe.subscriptions.create({ customer, items: [{ price: 'tukio_business' }] })`.
- Given une table `pro_subscription` créée, When elle persiste, Then elle a `{ proId, stripeSubscriptionId, tier: 'starter'|'business'|'enterprise', status, currentPeriodEnd }` — tier dérivé Stripe state (FR66 jamais l'inverse).
- Given un Stripe webhook `customer.subscription.updated`, When payment-svc consomme, Then il sync `pro_subscription.tier`, publie `payment.subscription-changed.v1`.

#### Story 9.2: Pro subscription upgrade/downgrade with proration (FR58)

**ACs** :
- Given un Pro Starter qui upgrade Business, When il clique "Passer à Business", Then payment-svc `Stripe.subscriptions.update({ proration_behavior: 'create_prorations' })`, Stripe émet une facture pro-rata, Pro paie immédiatement la différence.
- Given un Pro Business qui downgrade Starter, When il confirme, Then change effectif fin de période (`cancel_at_period_end=false`, `pause` jusqu'à fin), pas de remboursement.
- Given un Pro qui résilie (FR59), When il confirme, Then `subscription.cancel(at_period_end=true)`, accès Business jusqu'à fin de période, puis bascule Starter automatiquement.

#### Story 9.3: 30/70 split payment (échéancier customer-side) — FR51

**ACs** :
- Given un Customer pour un booking ≥ 500 €, When il choisit "Payer en 2 fois (30/70)", Then payment-svc crée 2 PaymentIntents : 30 % à la résa (auth + capture acceptance Pro), 70 % autoCharge J-7 avant événement (saved card requise — FR50).
- Given une saved card expirée à J-7, When la 2e charge fail, Then notification email Customer "Mettez à jour votre CB", booking suspendu sans cancellation auto (Customer 48h pour résoudre, sinon escalade Admin).
- Given un Customer qui annule avant J-7, When refund, Then 1ère échéance refunded selon politique annulation, 2e échéance jamais débitée.

#### Story 9.4: Pro export transactions CSV/PDF (FR55)

**ACs** :
- Given un Pro sur `/seller/transactions`, When il clique "Exporter", Then payment-svc génère async export (CSV ou PDF) sur R2 chiffré, signed URL 30 min, email envoyé "Export prêt".
- Given un export CSV, When je l'ouvre, Then colonnes : date, customer (full post-accept), montant HT, TVA, TTC, commission, fees Stripe, net Pro, status, invoice number — compatible import comptables.

**Epic 9 — 4 stories**

---

### Epic 10: Dispute Workflow & Advanced Admin (V1)

**Outcome** : Workflow litige structuré (FR87 ouverture → médiation 48h → résolution → clôture, réouverture 15j). Stripe disputes UI Admin enrichie. Event replay + impersonation sécurisés.

**FRs covered V1** : FR87 (litige workflow), FR62 (Stripe disputes UI évoluée), FR92 (event replay), FR93 (impersonation)

#### Story 10.1: Dispute aggregate + workflow state machine (FR87)

**ACs** :
- Given une nouvelle entité `Dispute` (booking-svc ou nouveau dispute-svc V1), When un Customer ou Pro ouvre un litige, Then status `opened`, mediator admin assigné, SLA médiation 48h, transitions `opened → in_mediation → resolved | escalated → closed` (réouverture 15j possible).
- Given un litige, When le mediator propose une résolution, Then les 2 parties acceptent ou rejettent ; si désaccord persistant, escalation vers `admin-super`.
- Given un litige résolu, When 15 jours passent, Then auto-close avec finality. Sinon, partie peut rouvrir (1× max).

#### Story 10.2: Stripe disputes UI Admin (FR62)

**ACs** :
- Given un Stripe webhook `charge.dispute.created`, When payment-svc reçoit, Then il persiste un `StripeDispute` aggregate, alerte Admin Slack, freeze automatiquement les payouts du Pro concerné.
- Given un Admin sur `/admin/disputes/<id>`, When il consulte, Then il voit l'evidence trail (Tukio booking + chat + invoices) et peut soumettre à Stripe via formulaire structured.
- Given Stripe webhook `charge.dispute.closed`, When payment-svc reçoit, Then update + unfreeze payouts si dispute won.

#### Story 10.3: Event replay (sensitive) — FR92

**ACs** :
- Given un `admin-super` sur `/admin/event-replay`, When il select event NATS depuis DLQ + valide raison ≥ 50 chars, Then audit log critique + replay event avec marker `replayedBy=adminId`.
- Given un test, When admin replay un event idempotent (Story 0.7 inbox), Then il est dédoublé proprement (no double-effect).

#### Story 10.4: User impersonation (sensitive) — FR93

**ACs** :
- Given un `admin-support` sur `/admin/accounts/<id>` qui clique "Impersonifier", When il fournit raison + ticket support, Then identity-svc génère un short-lived JWT (15 min, claim `impersonatedBy=adminId`) + audit log critique. Toutes actions sous impersonation sont marquées dans audit log avec `actorId=user, impersonatorId=admin`.
- Given une session impersonation, When admin termine, Then JWT révoqué + email automatique au user "Un agent Tukio a accédé à votre compte pour : <raison>".

**Epic 10 — 4 stories**

---

### Epic 11: In-App Notifications, PWA & Referral Program (V1)

**Outcome** : Notifications in-app temps réel (vs email Story 5.4). PWA installable iOS/Android. Programme referral exposé (Story 7.6 foundation activée, rewards calculées).

**FRs covered V1** : in-app notifs, PWA, referral program complet

#### Story 11.1: In-app notification feed + real-time SSE

**ACs** :
- Given une nouvelle entité `Notification` étendue (Story 5.4 ajoute channel `in-app`), When un event triggers (booking, message, etc.), Then notification-svc INSERT row in-app + push via SSE.
- Given un user sur n'importe quelle page, When il a `<NotificationBell>` (top-right), Then il voit count unread + dropdown des 10 dernières notifs avec deep-link.
- Given une SSE connection, When un nouveau notif arrive, Then UI update sans reload (TanStack Query cache invalidation).

#### Story 11.2: PWA installable + push web notifications

**ACs** :
- Given chaque app frontend (public/customer/seller), When je l'ouvre sur mobile, Then `manifest.json` + service worker permettent install écran d'accueil avec icône Tukio.
- Given un user qui opt-in push, When une notification critique arrive (booking confirmed/refused), Then push web envoyé via Web Push API (clé VAPID).
- Given offline, When user consulte l'app, Then service worker sert pages cached (read-only) + bannière "Mode hors-ligne".

#### Story 11.3: Referral program rewards calculation + UI

**ACs** :
- Given Story 7.6 foundation, When un referred user fait sa 1ère booking complétée, Then `referral_event` row marqué `rewardEligible=true`, identity-svc applique reward : Customer referrer reçoit code promo 10 € sur prochaine résa, Pro referrer reçoit -1 mois subscription Business.
- Given un user sur `/account/referrals`, When il consulte, Then il voit ses parrainages (count, status, rewards earned) + dashboard partage social (Twitter, WhatsApp, email).

#### Story 11.4: Notification preferences (granular)

**ACs** :
- Given un user sur `/account/notifications`, When il consulte, Then il choisit par event type (booking, messages, marketing, reminders) + canal (email, in-app, push) en grid checkbox.
- Given des préférences appliquées, When un event arrive, Then notification-svc respecte les choix (skip si user disabled ce canal/type), sauf événements critiques (security, account suspension — non-disablable).

**Epic 11 — 4 stories**

---

### Epic 12: Anti-désintermédiation Renforcée, Reviews Multi-Critères & Quotes (V1)

**Outcome** : PII regex masking automatique dans messages chat (FR72). Reviews multi-critères (FR76) + Pro réponse publique (FR77) + Pro avis sur Customer (FR78). Devis personnalisés (FR44) + chat libre pré-booking (FR69) + modification résa (FR46) + pièces jointes (FR70).

**FRs covered V1** : FR44, FR46, FR69, FR70, FR72, FR76, FR77, FR78

#### Story 12.1: PII regex detection + masking in chat messages (FR72)

**ACs** :
- Given un message chat (Story 5.3) avec contenu "Mon mail est jean@example.com appelle moi 0612345678", When messaging-svc le traite, Then une regex EU-PII detect emails + phones FR + IBAN, masque "**EMAIL_MASKED**" et "**PHONE_MASKED**" tant que booking != `confirmed`. Audit log les détections.
- Given message masked, When recipient le lit, Then il voit le masque + tooltip "Tukio masque les coordonnées avant acceptation pour votre sécurité".
- Given un Pro Power User qui essaie obfuscation ("zéro six = 06"), When messaging-svc detect (regex étendue), Then masque V1 limited regex, V2 ML. Si > 3 tentatives, alerte admin (FR45 anti-désintermédiation).

#### Story 12.2: Reviews multi-critères + Pro réponse publique (FR76, FR77, FR78)

**ACs** :
- Given un Customer sur Story 5.7 ReviewForm enrichie V1, When il submit, Then il note 4 critères (qualité, ponctualité, communication, rapport qualité/prix) + commentaire global. Aggregate calcule moyennes par critère + globale.
- Given un Pro Business+, When il consulte une review, Then il peut répondre publiquement (max 1000 chars) — la réponse est visible publiquement sous l'avis original avec badge "Réponse du pro". Modération Admin si signalée (Story 6.3).
- Given Pro avis Customer (FR78), When booking complété, Then Pro peut laisser avis sur Customer (visible aux autres Pros uniquement, jamais Visitor) — comportement, ponctualité paiement, courtoisie.

#### Story 12.3: Devis personnalisés + chat libre pré-booking (FR44, FR69)

**ACs** :
- Given un Visitor sur fiche service, When il clique "Demander un devis", Then il ouvre un chat libre avec le Pro (anti-désintermédiation FR72 active), demande structurée (date, options, capacité, budget).
- Given un Pro qui répond avec devis personnalisé, When il submit `{ amount, breakdown, validity 7 jours }`, Then Customer reçoit notification + bouton "Accepter et réserver" qui crée Booking + Stripe PaymentIntent au prix devis (skip pricing standard).

#### Story 12.4: Booking modification proposal (FR46) + file attachments (FR70)

**ACs** :
- Given un Pro après acceptation, When il propose modification (date, options, prix), Then Customer reçoit notif + accepte ou refuse (si refuse → annulation selon politique).
- Given chat (Story 5.3), When un user attache un fichier (max 10 MB, PDF/JPG/PNG), Then media-svc store sur R2 chiffré + génère signed URL pour partage. Audit log.

**Epic 12 — 4 stories**

---

### Epic 13: Configurateur Événement & Smart Recommendations (V2)

**Outcome** : Configurateur guidé (mariage/anniversaire/team-building) qui suggère un bundle de services. Recommandations smart (similar listings, "Customers who booked X also booked Y", recently viewed).

#### Story 13.1: Event configurator wizard

**ACs** :
- Given un Visitor sur `/fr/configurateur`, When il choisit type événement + nombre invités + budget, Then catalog-svc retourne un bundle suggéré (1 chapiteau + tables + chairs) optimisé prix.
- Given le bundle, When Visitor add-to-cart, Then panier multi-vendor (Epic 8) avec tous les listings sélectionnés.

#### Story 13.2: Recently viewed + similar listings (collaborative filtering)

**ACs** :
- Given un Visitor qui consulte 3 listings, When il revient home, Then section "Récemment vus" affichée + section "Similaires" via Meilisearch facetting (catégorie, ville, prix range proche).
- Given V2 ML, When un Customer book X, Then "Customers who booked X also booked Y" générée via une vue matérialisée co-occurrence.

#### Story 13.3: AI-powered semantic search (V2)

**ACs** :
- Given un Visitor qui search "tente romantique pour mariage 80 personnes", When il submit, Then une layer AI (embeddings via Claude) re-rank les résultats Meilisearch selon intention sémantique vs uniquement keywords.

**Epic 13 — 3 stories**

---

### Epic 14: Mobile Native iOS + Android (V2)

**Outcome** : Apps natives iOS + Android via React Native (partage code 80 % avec web Next.js), Apple/Google Pay, push native, camera intégration (upload photos via mobile).

#### Story 14.1: React Native scaffold + shared business logic

**ACs** :
- Given `apps/mobile/` créé via React Native + Expo, When je build, Then iOS + Android apps installables. Reuse `@tukio/api-client`, `@tukio/i18n-client`, `@tukio/auth-client` (Story 0.8/0.9).
- Given navigation `@react-navigation`, When user navigue Home → Search → Listing, Then performance native + bundle < 30 MB.

#### Story 14.2: Apple Pay + Google Pay + native push

**ACs** :
- Given un Customer mobile au checkout, When il choisit Apple Pay, Then Stripe Mobile SDK + Apple Pay token, capture flow Story 4.5. Idem Google Pay.
- Given push natives via FCM/APNs, When booking event, Then user reçoit push native (vs web push Epic 11).

#### Story 14.3: Camera intégration (Pro upload photos mobile)

**ACs** :
- Given un Pro mobile qui crée listing (Story 3.3), When il clique "Ajouter photo", Then camera native s'ouvre + permission + upload Story 3.4 pipeline.
- Given V2, When Pro shoot photo, Then auto-resize côté client + upload progress visible.

**Epic 14 — 3 stories**

---

### Epic 15: Pro Enterprise & SAML SSO B2B (V2)

**Outcome** : Tier Enterprise activé avec SSO SAML fédéré (FR6), intégration Pennylane comptable (FR60), bulk pricing, multi-pro accounts.

#### Story 15.1: SAML SSO B2B Enterprise (FR6)

**ACs** :
- Given Phasetwo extension Keycloak (Story 1.1), When un Customer Enterprise configure son IdP (Okta/Azure AD), Then SAML federated login activé sur `/auth/saml/<tenantId>`, claim mapping → Tukio user.
- Given un user Enterprise se connecte via SAML, When il atterrit, Then session Tukio créée + role auto-assigné selon group SAML.

#### Story 15.2: Pennylane / QuickBooks accounting API (FR60)

**ACs** :
- Given un Pro Enterprise, When il connecte Pennylane via OAuth, Then payment-svc push automatiquement chaque transaction confirmée vers Pennylane (factures, écritures comptables).
- Given des écarts détectés, When cron `pennylane-reconcile.task.ts` tourne, Then alertes si transaction Tukio ≠ Pennylane.

#### Story 15.3: Bulk discounts + multi-pro accounts

**ACs** :
- Given un Customer Enterprise avec contrat-cadre Tukio, When il book, Then prix appliqué inclut un bulk discount auto (configurable Admin Super), commission Tukio peut varier.
- Given un compte Enterprise Pro (groupe avec N filiales), When un employé d'une filiale book, Then le Pro principal voit la résa dans son dashboard agrégé multi-filiales.

**Epic 15 — 3 stories**

---

### Epic 16: Loyalty Customer & Newsletter Admin (V2)

**Outcome** : Programme fidélité Customer (points par booking, tiers Bronze/Silver/Gold). Newsletter Brevo broadcast (vs Resend transactional).

#### Story 16.1: Customer loyalty points + tiers

**ACs** :
- Given Customer qui complete un booking, When `booking.completed.v1` consommé, Then une nouvelle table `loyalty_points` INSERT `+ X points` (X = floor(amount HT / 10)). Tiers : Bronze (0-500 pts), Silver (500-2000), Gold (2000+).
- Given un Customer Gold, When il consulte un listing, Then badge "Gold reward : 5 % de réduction appliqué" + auto-applied au checkout.

#### Story 16.2: Newsletter Brevo + opt-in management

**ACs** :
- Given Story 1.2 (`acceptMarketing` opt-in), When user accept, Then identity-svc sync vers Brevo contact list "newsletter-fr" ou "newsletter-en".
- Given un Admin Super sur `/admin/newsletters`, When il crée une campagne, Then il sélectionne segment (B2C, B2B, Pro), template Brevo, schedule send. RGPD : double opt-in obligatoire.

#### Story 16.3: A/B testing campaign infrastructure

**ACs** :
- Given Brevo split-test, When une campagne avec 2 variants (A/B subject lines), Then 50/50 split, vainqueur auto-promoted après 24h.
- Given un dashboard Plausible enriched (V2 PostHog optionnel), When je consulte, Then conversion par variant trackée.

**Epic 16 — 3 stories**

---

## Couverture totale — Récap end-of-Epic 16

**Total stories sur 17 epics** :
- MVP (Epics 0-7) : 84 stories (Epic 1 = 11 après ajout Story 1.11 dual-portal 2026-05-17)
- V1 (Epics 8-12) : 4+4+4+4+4 = 20 stories
- V2 (Epics 13-16) : 3+3+3+3 = 12 stories
- **TOTAL** : **116 stories**

**FRs couverts** :
- 130 FRs PRD (100 % couvert)
- 84 NFRs PRD (couverts via NFR cross-references)
- 21 UX-DRs (couverts via Epics 0-7 + V1+V2)
- 14 ADRs Architecture (référencés dans Story 0.13 + chaque service)

**Critères de sortie** :
- **MVP (sortie cible 6 mois)** : Epics 0-7 ✅ → 50 pros + 100 résa Pays de la Loire FR/EN
- **V1 (sortie cible 12 mois)** : Epics 8-12 ✅ → 200 abonnés Business + 1ʳᵉ rentabilité mensuelle + multi-vendor cart + B2B + dispute workflow complet
- **V2 (sortie cible 18-24 mois)** : Epics 13-16 ✅ → rebooking > 25 % + 20 comptes Enterprise + ARR > 500 k€ + apps mobile native


**Critère de sortie V2** : Epics 13-16 livrés. Permet d'atteindre rebooking > 25 % + 20 comptes Enterprise + ARR > 500 k€.
