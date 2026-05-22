# Story 0.18: Landing "Devenir Pro" sur seller.tukio.one (`/${locale}/seller-coming-soon`) — page éditoriale détaillée 6 sections + cross-zone CTA

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** professionnel de l'événementiel (loueur de chapiteaux, mobilier événementiel, traiteur, décorateur, son&lumière, animation) qui découvre tukio.one en phase pré-lancement,
**I want** atterrir sur une page **dédiée pros** sur `seller.tukio.one` qui m'explique **précisément** comment la plateforme va fonctionner (métiers acceptés, parcours d'inscription en 5 étapes, modèle commission 10%, paiements Stripe Connect J+1 à J+3, documents requis, "pourquoi nous rejoindre"),
**so that** : (a) je comprends en 30 secondes si tukio.one est pour moi (6 cards métiers immédiatement visibles + critères d'éligibilité clairs : SIRET valide + SAS/SARL/auto-entrepreneur/asso) ; (b) je sais exactement comment l'argent circule (pipeline 4 étapes pédagogique paiement → Stripe séquestre → prestation → reversement J+1, avec mention explicite "Stripe gère les paiements, pas tukio" pour la crédibilité KYC) ; (c) je sais ce que ça va me coûter (3 cards "0 € Inscription / 10 % Commission / J+1 Reversement" — transparence radicale, mentions formules d'abonnement V1+) ; (d) je vois ce que tukio.one va prendre en charge pour moi (6 cards : paiement / confiance / communication / calendrier / stats / administratif) ; (e) je peux m'inscrire à la waitlist en 1 clic — CTA cross-zone vers `tukio.one/${locale}/coming-soon?role=pro` qui pré-coche le radio "Professionnel" de la landing apex Story 0.17 (transition fluide entre les 2 portails).

> **Outcome attendu** : à la fin de cette story, (1) `pnpm --filter=seller dev` + `NEXT_PUBLIC_COMING_SOON_MODE=true` + navigate `seller.tukio.one/fr/seller-coming-soon` rend **exactement** la page du design `tukio-design/project/screens/public-pages.jsx:113-397` (`BecomeProScreen`) — hero 2-cols avec banner brand-50 "tukio.one n'est pas encore ouverte" + 6 cards métiers grid 3-col desktop + parcours 5 steps horizontal + 2 cards docs requis + **section sombre charcoal-800** "Paiements et reversements" avec pipeline 4 steps + 2 cards modes paiement / reversement + bloc Stripe Connect partner + 3 cards tarification "0 € / 10 % / J+1" + 6 cards "Pourquoi nous rejoindre" + CTA final pré-lancement ; (2) tous les CTAs primary "Être prévenu·e à l'ouverture" + secondary "Soyez prévenu·e en priorité" déclenchent `window.location.assign('https://tukio.one/${locale}/coming-soon?role=pro')` (cross-zone redirect — pré-coche radio Pro Story 0.17 AC4) ; (3) i18n FR + EN strict (~90 keys × 2 locales = 180 strings dans namespace `seller_coming_soon`) avec traduction professionnelle EN du contenu éditorial dense (modèle commission, KYC Stripe, mandat facturation) ; (4) Lighthouse desktop ≥ 90 perf (longue page tolérance) / ≥ 95 a11y / ≥ 100 SEO / ≥ 95 best practices ; (5) axe-core 0 violations — incluant la **section sombre charcoal-800** qui doit respecter contrast ratio AA sur cream-50/cream-200 texte ; (6) **indexabilité Google `<meta name="robots" content="index, follow">`** (contrairement à `/coming-soon` apex qui est indexé aussi mais cette page sert le SEO pro spécifique — keyword "marketplace événementiel pros" + "Stripe Connect" + "Pays de la Loire") ; (7) Playwright e2e 6 cases × 2 locales = 12 contextes verts (load FR/EN + scroll-to-section anchors + CTA cross-zone intercept + sections présentes + axe-core + Lighthouse perf) ; (8) responsive mobile/tablet correct (le design est très dense desktop — vérifier que les grids 3-col/4-col se stackent proprement < 1024px).

## Acceptance Criteria

1. **AC1 — Architecture pages Next.js 16 (Server Components 100%, zéro Client)** : à la différence de Story 0.17 (form interactif), Story 0.18 est **100% éditoriale** — aucun event handler, aucun state.
   - **`apps/seller/src/app/[locale]/seller-coming-soon/page.tsx`** (UPDATE depuis placeholder Story 0.15) : Server Component principal, render la structure complète. Compose tous les sous-composants Server.
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonHero.tsx`** (NEW) : Server — hero 2-cols (Kicker + H1 italic + pitch + banner brand-50 "tukio.one n'est pas encore ouverte" + CTA inline + image gradient placeholder)
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonProfessions.tsx`** (NEW) : Server — 6 cards métiers grid 3-col responsive
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonJourney.tsx`** (NEW) : Server — 5 steps horizontal cards numérotés
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonRequirements.tsx`** (NEW) : Server — 2 cards docs requis
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonPayments.tsx`** (NEW) : Server — section sombre charcoal-800 avec pipeline 4 steps + 2 cards modes + Stripe partner
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonPricing.tsx`** (NEW) : Server — 3 cards "0 €/10 %/J+1"
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonBenefits.tsx`** (NEW) : Server — 6 cards "Pourquoi nous rejoindre"
   - **`apps/seller/src/features/pre-launch/components/SellerComingSoonFinalCta.tsx`** (NEW) : Server — CTA bloc final centré
   - **`apps/seller/src/features/pre-launch/components/CrossZoneCtaClient.tsx`** (NEW, MINIMAL Client) : `'use client'` — composant minimal qui rend un `<button>` ou `<a>` exécutant `window.location.assign(...)` au click. **Le seul Client Component** de la page car `window.location.assign` requiert browser context. Alternative envisagée : `<a href="https://tukio.one/${locale}/coming-soon?role=pro">` simple Server qui fonctionne sans JS — préférer si possible (zéro Client = perf optimal). Décision dev-time : si Track Plausible event pendant click souhaité → Client Component obligatoire ; sinon Server `<a>` strict.
   - **Folder layout final** :
     ```
     apps/seller/src/
     ├── app/[locale]/seller-coming-soon/
     │   ├── page.tsx                                # Server — main page
     │   └── success/page.tsx                        # Server — pas livré Story 0.18 (placeholder Story 0.15 conservé)
     └── features/pre-launch/
         └── components/
             ├── SellerComingSoonHero.tsx
             ├── SellerComingSoonProfessions.tsx
             ├── SellerComingSoonJourney.tsx
             ├── SellerComingSoonRequirements.tsx
             ├── SellerComingSoonPayments.tsx
             ├── SellerComingSoonPricing.tsx
             ├── SellerComingSoonBenefits.tsx
             ├── SellerComingSoonFinalCta.tsx
             ├── CrossZoneCtaClient.tsx              # ou éliminé si <a> Server suffit
             └── __tests__/
                 └── CrossZoneCtaClient.spec.tsx     # uniquement si Client Component retenu
     ```
   - **Note** : pas de page `/seller-coming-soon/success/` Story 0.18 — il n'y a pas de form ici (les emails sont capturés sur la landing apex Story 0.17 via cross-zone). Le placeholder Story 0.15 reste tel quel ou est supprimé proprement.

2. **AC2 — Hero 2-cols** : `SellerComingSoonHero.tsx` réplique strict `public-pages.jsx:120-144`.
   - Container : `<section className="px-10 py-[72px] pb-14">`
   - Grid : `<div className="max-w-[1200px] mx-auto grid grid-cols-[1.1fr_1fr] gap-14 items-center max-md:grid-cols-1">`
   - **Colonne gauche** :
     - `<Kicker>Pour les professionnels</Kicker>` (i18n `hero.kicker`)
     - `<h1>` font-display 60px font-normal tracking-tight leading-[1.02] color-charcoal-800 mt-3.5 max-w-[520px] :
       ```tsx
       <h1>
         {t('hero.titleLine1')} <em className="italic text-brand-600">{t('hero.titleLine2Emphasis')}</em>.
       </h1>
       ```
       FR : `titleLine1="Comment fonctionne tukio.one"` + `titleLine2Emphasis="pour les pros"` / EN : `titleLine1="How tukio.one works"` + `titleLine2Emphasis="for pros"`
     - `<p>` text-[17px] color-charcoal-600 mt-4 leading-[1.6] max-w-[520px] : pitch (i18n `hero.pitch`)
     - **Banner brand-50** "tukio.one n'est pas encore ouverte" : `<div className="mt-7 p-4 bg-brand-50 border border-brand-100 rounded-xl flex gap-3 items-start">` :
       - `<Zap size={18} color="var(--color-brand-700)" />` (lucide bolt mapping Story 0.16)
       - `<div>` :
         - `<div text-[14px] font-semibold color-brand-700>` "tukio.one n'est pas encore ouverte" / "tukio.one is not open yet"
         - `<p text-[13px] color-charcoal-700 mt-1 leading-[1.5]>` : "Cette page décrit comment la plateforme fonctionnera. Vous pourrez créer votre compte pro à l'ouverture." + inline `<CrossZoneCta variant="link">` "Soyez prévenu·e en priorité" (lien brand-700 underlined)
   - **Colonne droite** : visuel placeholder gradient brand-100→brand-300 aspect-square rounded-2xl avec inner border cream-50/40 — design `public-pages.jsx:140-143`. **Image réelle** déférée Story V1+ enrichment (Ismael pourra ajouter une photo de chapiteau / mobilier événementiel). Placeholder ne charge AUCUN fichier image.

3. **AC3 — Section "Pour qui" — 6 cards métiers** : `SellerComingSoonProfessions.tsx` réplique `public-pages.jsx:147-173`.
   - Container : `<section className="px-10 py-14 max-w-[1200px] mx-auto">`
   - `<Kicker>Pour qui</Kicker>` + `<h2 text-[36px] font-display mt-2 mb-3>` "Les métiers concernés." / "The professions concerned." + `<p text-[15px] color-charcoal-600 mb-7 max-w-[640px]>` : intro éligibilité SIRET (i18n `professions.intro`)
   - **Grid 3-col desktop, 2-col tablet, 1-col mobile** : `<div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2 max-sm:grid-cols-1">`
   - **6 cards** (data tableau i18n) :
     | Slug | Icon lucide | Title FR | Description FR |
     |---|---|---|---|
     | tents | `Tent` | "Tentes et chapiteaux" | "Location, montage, démontage." |
     | furniture | `Package` | "Mobilier événementiel" | "Tables, chaises, mange-debout, lounge." |
     | catering | `Flame` | "Traiteur et boissons" | "Plateaux, food-trucks, bars éphémères." |
     | decoration | `Sparkles` | "Décoration et fleurs" | "Scénographie, fleuristes, créateurs." |
     | sound-light | `Zap` | "Son et lumière" | "Sono, DJ, éclairage scénique." |
     | animation | `User` | "Animation et services" | "Photographes, animateurs, intervenants." |
   - **Card structure** : `<div className="tk-card p-4.5">` (utilise Card atom Story 0.4 `<Card>` ou className directe) :
     - Icon container : `<span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 inline-flex items-center justify-center mb-3">` + Icon
     - `<h3 text-[15px] font-semibold>` title
     - `<p text-[13px] color-charcoal-600 mt-1 leading-[1.55]>` description
   - **i18n** : `professions.cards[0].title`, `professions.cards[0].description`, ... × 6. Ou structure array via `t.rich()` next-intl.

4. **AC4 — Section "Le parcours pro" — 5 steps horizontal** : `SellerComingSoonJourney.tsx` réplique `public-pages.jsx:176-196`.
   - Container : `<section className="px-10 py-14 bg-cream-100">` + `<div className="max-w-[1200px] mx-auto">`
   - `<Kicker>Le parcours pro</Kicker>` + `<h2 text-[36px] font-display mt-2 mb-7>` "De l'inscription à la première réservation." / "From signup to first booking."
   - **Grid 5-col desktop, 2-col tablet, 1-col mobile** : `<div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">`
   - **5 steps** :
     | n° | Title FR | Description FR |
     |---|---|---|
     | 01 | "Inscription" | "Email, mot de passe, vérification de l'adresse. Quelques minutes." |
     | 02 | "Demande pro" | "Identité, activité (SIRET, forme juridique), zone d'intervention, documents." |
     | 03 | "Validation" | "Examen du dossier par l'équipe tukio. Sous 24 à 48 heures ouvrées." |
     | 04 | "Compte Stripe" | "Configuration séparée du compte de paiement. KYC géré par Stripe." |
     | 05 | "Mise en ligne" | "Création de vos fiches services, photos, prix, disponibilités." |
   - **Card structure** : `<div className="tk-card p-4.5">` :
     - Numéro : `<div className="font-display font-normal italic text-[30px] text-brand-500 tracking-tight leading-none">` "01"
     - `<h3 text-[14px] font-semibold mt-3>` title
     - `<p text-[12px] color-charcoal-600 mt-1.5 leading-[1.55]>` description

5. **AC5 — Section "Ce qu'il faut prévoir" — 2 cards docs requis** : `SellerComingSoonRequirements.tsx` réplique `public-pages.jsx:199-239`.
   - Container : `<section className="px-10 py-14 max-w-[1200px] mx-auto">`
   - `<Kicker>Ce qu'il faut prévoir</Kicker>` + `<h2 text-[36px] font-display mt-2 mb-7>` "Les documents et conditions requis." / "Required documents and conditions."
   - **Grid 2-col** : `<div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">`
   - **Card 1** : "Pour votre demande pro" / "For your pro application" — `<h3 text-[17px] font-semibold mb-3.5>` + `<ul>` 5 items avec `<Check size={16} color="var(--color-brand-700)" strokeWidth={2.5} />` :
     - "Une activité déclarée en France (SIRET valide)"
     - "Une pièce d'identité (CNI, passeport ou titre de séjour)"
     - "Un justificatif d'activité (Kbis, attestation INSEE, statuts)"
     - "Une assurance responsabilité civile professionnelle"
     - "Une adresse email et un téléphone joignables"
   - **Card 2** : "Pour votre compte de paiement" / "For your payment account" — 4 items :
     - "Un compte bancaire professionnel au nom de votre activité"
     - "Un IBAN français ou européen (SEPA)"
     - "Les justificatifs demandés par Stripe pour le KYC"
     - "Pour les SAS, SARL, EURL : Kbis de moins de 3 mois"

6. **AC6 — Section "Paiements et reversements" — SECTION SOMBRE (la plus dense)** : `SellerComingSoonPayments.tsx` réplique `public-pages.jsx:242-321`.
   - Container : `<section className="px-10 py-18 bg-charcoal-800 text-cream-50">` (background charcoal-800, texte cream-50)
   - `<div className="max-w-[1200px] mx-auto">`
   - **Heading** :
     - `<Kicker color="cream">Paiements et reversements</Kicker>` (Story 0.16 atom `color="cream"` variant pour texte cream-200 dark mode)
     - `<h2 text-[36px] font-display mt-2 mb-3.5 text-cream-50>` "Comment vous êtes payé, en détail." / "How you get paid, in detail."
     - `<p text-[15px] color-cream-200 max-w-[620px] leading-[1.6] mb-9>` intro transparence (i18n `payments.intro`)
   - **Pipeline 4-col** : `<div className="grid grid-cols-4 gap-4 mb-10 max-md:grid-cols-2 max-sm:grid-cols-1">`
     - Card style : `<div className="p-4.5 bg-cream-50/[0.04] rounded-xl border border-cream-50/[0.08]">`
       - Numéro : `<div className="font-display italic text-[28px] text-brand-300 font-normal tracking-tight leading-none">` "01"
       - `<h3 text-[14px] font-semibold mt-3 text-cream-50>` title
       - `<p text-[12px] color-cream-200 mt-1.5 leading-[1.55] opacity-85>` description
     - 4 steps :
       | n° | Title FR | Description FR |
       |---|---|---|
       | 01 | "Le client paie" | "Au moment de la réservation, le client règle 100 % par carte bancaire ou Apple/Google Pay via Stripe." |
       | 02 | "Fonds sécurisés" | "L'argent est conservé par Stripe sur un compte séquestre. Vous voyez la réservation, mais l'argent n'est pas encore à vous." |
       | 03 | "Prestation réalisée" | "Le jour J, vous délivrez votre service. Le client confirme (explicitement ou automatiquement après J+1)." |
       | 04 | "Reversement" | "Stripe vire le montant net sur votre IBAN en J+1 à J+3 ouvrés. Vous recevez un email de confirmation." |
   - **Modes paiement 2-col** : `<div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">`
     - **Colonne gauche** "Ce que vos clients peuvent utiliser" / "What your clients can use" :
       - `<h3 text-[18px] font-semibold text-cream-50 mb-3>` + `<ul>` 4 items avec `<CreditCard size={16} color="var(--color-brand-300)" />` :
         - "Carte bancaire" — "Visa, Mastercard, American Express, Carte Bleue"
         - "Apple Pay et Google Pay" — "Sur mobile et tablette"
         - "Virement SEPA (réservations B2B)" — "Pour les commandes importantes des entreprises"
         - "Paiement en plusieurs fois" — "Acomptes échelonnés selon vos conditions"
     - **Colonne droite** "Comment vous êtes payé" / "How you get paid" — 4 items avec `<Check size={16} color="var(--color-brand-300)" strokeWidth={2.5} />` :
       - "Virement bancaire SEPA" — "Sur votre IBAN pro, automatique après chaque prestation"
       - "Délai de reversement" — "J+1 à J+3 ouvrés après confirmation de la prestation"
       - "Suivi en temps réel" — "Tableau de bord avec l'état de chaque paiement"
       - "Justificatifs téléchargeables" — "Factures, attestations, exports comptables"
   - **Stripe Connect partner bloc** : `<div className="mt-10 p-6 bg-cream-50/[0.06] rounded-xl flex gap-5 items-center">`
     - `<span className="w-12 h-12 rounded-lg bg-[#635BFF] text-white inline-flex items-center justify-center text-2xl font-bold flex-shrink-0">S</span>` (Stripe logo placeholder — `#635BFF` est la couleur officielle Stripe)
     - `<div>` :
       - `<h3 text-[16px] font-semibold text-cream-50>` "Stripe gère les paiements, pas tukio" / "Stripe handles payments, not tukio"
       - `<p text-[13px] color-cream-200 mt-1.5 leading-[1.6] opacity-85>` long paragraphe Stripe Connect (i18n `payments.stripePartner.body`)
   - **Color contrast NFR50/54** : vérifier explicitement :
     - `cream-50` sur `charcoal-800` → ratio AAA (≥ 7:1)
     - `cream-200` sur `charcoal-800` → AA (≥ 4.5:1)
     - `brand-300` icons sur `charcoal-800` → AA
     - Aucun texte avec `opacity-85` sous AA contrast — si limite, augmenter opacity à 90 ou utiliser cream-100.

7. **AC7 — Section "Tarification" — 3 cards "0 €/10 %/J+1"** : `SellerComingSoonPricing.tsx` réplique `public-pages.jsx:324-350`.
   - Container : `<section className="px-10 py-18 max-w-[1200px] mx-auto">`
   - `<Kicker>Tarification</Kicker>` + `<h2 text-[36px] font-display mt-2 mb-3.5>` "Vous ne payez que quand vous gagnez." / "You only pay when you earn." + `<p text-[15px] color-charcoal-600 max-w-[600px] mb-8 leading-[1.6]>` intro transparence
   - **Grid 3-col** : `<div className="grid grid-cols-3 gap-4 mb-8 max-md:grid-cols-1">`
     - 3 cards avec valeur display 48px brand-600 :
       - **0 €** : "Inscription, fiches, mise en ligne" — "Aucun frais pour rejoindre la plateforme et publier vos services."
       - **10 %** : "Commission par réservation" — "Prélevée automatiquement sur le montant client. Tout inclus, pas de surcouche."
       - **J+1** : "Délai de reversement" — "Stripe envoie le virement après confirmation de la prestation."
   - **Disclaimer formules V1+** : `<p text-[13px] color-charcoal-500 leading-[1.6] p-4 bg-cream-100 rounded-lg>` "Des formules d'abonnement avec commission réduite (Business, Enterprise) sont prévues pour les pros à fort volume. Elles seront proposées en option, jamais imposées. Les détails seront communiqués au moment du lancement."

8. **AC8 — Section "Pourquoi nous rejoindre" — 6 cards** : `SellerComingSoonBenefits.tsx` réplique `public-pages.jsx:353-378`.
   - Container : `<section className="px-10 py-18 bg-cream-100">` + `<div className="max-w-[1200px] mx-auto">`
   - `<Kicker>Pourquoi nous rejoindre</Kicker>` + `<h2 text-[36px] font-display mt-2 mb-7>` "Ce qu'on prend en charge pour vous." / "What we take care of for you."
   - **Grid 3-col desktop, 2-col tablet, 1-col mobile** : 6 cards (data tableau) :
     | Icon | Title FR | Description FR |
     |---|---|---|
     | `CreditCard` (card) | "Le paiement" | "Stripe Connect, KYC géré, factures automatiques, reversements rapides. Vous touchez votre argent sans relancer personne." |
     | `Shield` | "La confiance" | "Profils vérifiés, avis modérés, médiation tukio en cas de litige. Vos clients arrivent rassurés." |
     | `MessageSquare` (message) | "La communication" | "Messagerie intégrée, notifications, rappels. Tout l'historique de chaque dossier au même endroit." |
     | `Calendar` | "Le calendrier" | "Disponibilités, blocage de créneaux, conflits évités automatiquement." |
     | `BarChart3` (chart) | "Les stats" | "Taux de conversion, panier moyen, délai de réponse. De quoi piloter votre activité." |
     | `FileText` (doc) | "L'administratif" | "Mandat de facturation, gestion TVA, exports comptables. Votre comptable nous remerciera." |
   - **Card structure** : icon container `w-10 h-10 rounded-lg bg-brand-50 text-brand-700 inline-flex items-center justify-center mb-3.5` + `<h3 text-[17px] font-semibold>` + `<p text-[14px] color-charcoal-600 mt-2 leading-[1.6]>`

9. **AC9 — CTA final pré-lancement** : `SellerComingSoonFinalCta.tsx` réplique `public-pages.jsx:381-395`.
   - Container : `<section className="px-10 py-18 text-center">`
   - `<div className="max-w-[640px] mx-auto">`
   - `<Kicker>En préparation</Kicker>` + `<h2 text-[36px] font-display mt-2 mb-3.5>` "La plateforme ouvre bientôt." / "The platform opens soon."
   - `<p text-[15px] color-charcoal-600 leading-[1.6] mb-7>` : "Les inscriptions pro ne sont pas encore ouvertes. Laissez-nous vos coordonnées pour être prévenu·e dès l'ouverture, et bénéficier d'un accès prioritaire pour publier vos premières fiches services." (i18n `finalCta.body`)
   - **2 CTAs inline-flex gap-3** :
     1. **Primary** : `<CrossZoneCta variant="primary" size="lg">` "Être prévenu·e à l'ouverture" / "Be notified at launch" → action cross-zone `window.location.assign('https://tukio.one/${locale}/coming-soon?role=pro')`
     2. **Tertiary** : `<a href="/${locale}/contact" className="tk-btn tk-btn-tertiary tk-btn-lg">` "Une question ? Nous écrire" / "Got a question? Write to us"
   - **Note** : le contact link route vers `seller.tukio.one/${locale}/contact` actuellement (placeholder Story 0.15). Idéalement la page contact est sur apex (`tukio.one/${locale}/contact` Story 0.19). Décision dev-time : `href="https://tukio.one/${locale}/contact"` cross-zone OR `href="/${locale}/contact"` interne. Recommandation : **cross-zone vers apex** car la page contact réelle est sur apex.

10. **AC10 — `CrossZoneCtaClient.tsx` (Client minimal) ou alternative `<a>` Server** :
    - **Décision dev-time** : 2 options selon besoin tracking analytics.
    - **Option A — `<a>` Server (préférée si pas de Plausible event needed)** :
      ```tsx
      // Server Component, zéro JS hydraté
      export function CrossZoneCta({ locale, variant, size, children }: Props) {
        return (
          <a
            href={`https://tukio.one/${locale}/coming-soon?role=pro`}
            className={cn('tk-btn', `tk-btn-${variant}`, `tk-btn-${size}`)}
          >
            {children}
          </a>
        );
      }
      ```
    - **Option B — `<button>` Client avec tracking Plausible (si Story 0.21 livre Plausible et on veut event `Devenir Pro CTA Click`)** :
      ```tsx
      'use client';
      export function CrossZoneCtaClient({ locale, variant, size, children }: Props) {
        const handleClick = () => {
          if (typeof window !== 'undefined' && (window as any).plausible) {
            (window as any).plausible('Devenir Pro CTA Click', { props: { locale } });
          }
          window.location.assign(`https://tukio.one/${locale}/coming-soon?role=pro`);
        };
        return (
          <button onClick={handleClick} className={cn('tk-btn', `tk-btn-${variant}`, `tk-btn-${size}`)}>
            {children}
          </button>
        );
      }
      ```
    - **Recommandation Story 0.18** : démarrer avec **Option A** (Server `<a>` simple). Si Story 0.21 fait passer Plausible + custom events, **migrer vers Option B** en follow-up (≤ 30 min). Évite over-engineering Story 0.18.
    - **Sécurité** : `https://tukio.one/${locale}/coming-soon?role=pro` hardcoded URL → pas d'injection. Si on veut env-driven, lire `process.env.NEXT_PUBLIC_PUBLIC_BASE_URL` côté Server Component et passer en prop au `<a>`.

11. **AC11 — i18n FR + EN strict (ADR-012)** : namespace `seller_coming_soon` (~90 keys × 2 locales = 180 strings).
    - **`apps/seller/src/messages/fr.json`** UPDATE : append namespace complet :
      ```json
      "seller_coming_soon": {
        "meta": {
          "title": "Devenir pro sur tukio.one — Pays de la Loire",
          "description": "Marketplace événementiel pour pros : commission 10 %, paiements Stripe Connect J+1, KYC géré. Inscription pro à l'ouverture."
        },
        "hero": {
          "kicker": "Pour les professionnels",
          "titleLine1": "Comment fonctionne tukio.one",
          "titleLine2Emphasis": "pour les pros",
          "pitch": "Vous louez des chapiteaux, du mobilier, vous êtes traiteur ou décorateur en Pays de la Loire ? Voici comment la plateforme est pensée pour vous, en toute transparence.",
          "banner": {
            "title": "tukio.one n'est pas encore ouverte",
            "body": "Cette page décrit comment la plateforme fonctionnera. Vous pourrez créer votre compte pro à l'ouverture.",
            "cta": "Soyez prévenu·e en priorité"
          }
        },
        "professions": {
          "kicker": "Pour qui",
          "title": "Les métiers concernés.",
          "intro": "tukio.one s'adresse aux professionnels de l'événementiel disposant d'une activité déclarée (SAS, SARL, EURL, auto-entrepreneur, association). Au lancement, ces métiers seront accueillis en priorité.",
          "cards": [
            { "title": "Tentes et chapiteaux", "description": "Location, montage, démontage." },
            { "title": "Mobilier événementiel", "description": "Tables, chaises, mange-debout, lounge." },
            { "title": "Traiteur et boissons", "description": "Plateaux, food-trucks, bars éphémères." },
            { "title": "Décoration et fleurs", "description": "Scénographie, fleuristes, créateurs." },
            { "title": "Son et lumière", "description": "Sono, DJ, éclairage scénique." },
            { "title": "Animation et services", "description": "Photographes, animateurs, intervenants." }
          ]
        },
        "journey": {
          "kicker": "Le parcours pro",
          "title": "De l'inscription à la première réservation.",
          "steps": [
            { "n": "01", "title": "Inscription", "description": "Email, mot de passe, vérification de l'adresse. Quelques minutes." },
            { "n": "02", "title": "Demande pro", "description": "Identité, activité (SIRET, forme juridique), zone d'intervention, documents." },
            { "n": "03", "title": "Validation", "description": "Examen du dossier par l'équipe tukio. Sous 24 à 48 heures ouvrées." },
            { "n": "04", "title": "Compte Stripe", "description": "Configuration séparée du compte de paiement. KYC géré par Stripe." },
            { "n": "05", "title": "Mise en ligne", "description": "Création de vos fiches services, photos, prix, disponibilités." }
          ]
        },
        "requirements": {
          "kicker": "Ce qu'il faut prévoir",
          "title": "Les documents et conditions requis.",
          "proApp": {
            "title": "Pour votre demande pro",
            "items": [
              "Une activité déclarée en France (SIRET valide)",
              "Une pièce d'identité (CNI, passeport ou titre de séjour)",
              "Un justificatif d'activité (Kbis, attestation INSEE, statuts)",
              "Une assurance responsabilité civile professionnelle",
              "Une adresse email et un téléphone joignables"
            ]
          },
          "paymentAccount": {
            "title": "Pour votre compte de paiement",
            "items": [
              "Un compte bancaire professionnel au nom de votre activité",
              "Un IBAN français ou européen (SEPA)",
              "Les justificatifs demandés par Stripe pour le KYC",
              "Pour les SAS, SARL, EURL : Kbis de moins de 3 mois"
            ]
          }
        },
        "payments": {
          "kicker": "Paiements et reversements",
          "title": "Comment vous êtes payé, en détail.",
          "intro": "La transparence sur l'argent, c'est essentiel. Voici exactement comment ça marche, du moment où le client paie jusqu'au virement sur votre compte.",
          "pipeline": [
            { "n": "01", "title": "Le client paie", "description": "Au moment de la réservation, le client règle 100 % par carte bancaire ou Apple/Google Pay via Stripe." },
            { "n": "02", "title": "Fonds sécurisés", "description": "L'argent est conservé par Stripe sur un compte séquestre. Vous voyez la réservation, mais l'argent n'est pas encore à vous." },
            { "n": "03", "title": "Prestation réalisée", "description": "Le jour J, vous délivrez votre service. Le client confirme (explicitement ou automatiquement après J+1)." },
            { "n": "04", "title": "Reversement", "description": "Stripe vire le montant net sur votre IBAN en J+1 à J+3 ouvrés. Vous recevez un email de confirmation." }
          ],
          "clientPays": {
            "title": "Ce que vos clients peuvent utiliser",
            "items": [
              { "title": "Carte bancaire", "description": "Visa, Mastercard, American Express, Carte Bleue" },
              { "title": "Apple Pay et Google Pay", "description": "Sur mobile et tablette" },
              { "title": "Virement SEPA (réservations B2B)", "description": "Pour les commandes importantes des entreprises" },
              { "title": "Paiement en plusieurs fois", "description": "Acomptes échelonnés selon vos conditions" }
            ]
          },
          "youGetPaid": {
            "title": "Comment vous êtes payé",
            "items": [
              { "title": "Virement bancaire SEPA", "description": "Sur votre IBAN pro, automatique après chaque prestation" },
              { "title": "Délai de reversement", "description": "J+1 à J+3 ouvrés après confirmation de la prestation" },
              { "title": "Suivi en temps réel", "description": "Tableau de bord avec l'état de chaque paiement" },
              { "title": "Justificatifs téléchargeables", "description": "Factures, attestations, exports comptables" }
            ]
          },
          "stripePartner": {
            "title": "Stripe gère les paiements, pas tukio",
            "body": "Nous avons choisi Stripe Connect, leader mondial du paiement marketplace. Cela signifie que vos coordonnées bancaires ne transitent jamais par tukio.one. Le KYC, la conformité PSD2, la lutte anti-fraude, tout est géré par Stripe directement. Vos clients voient un paiement sécurisé, vous voyez vos virements arriver."
          }
        },
        "pricing": {
          "kicker": "Tarification",
          "title": "Vous ne payez que quand vous gagnez.",
          "intro": "Pas d'abonnement obligatoire au démarrage. Pas de frais cachés. Une commission claire, prélevée automatiquement sur chaque réservation. Vous voyez le montant exact qui vous revient avant même d'accepter la mission.",
          "cards": [
            { "value": "0 €", "title": "Inscription, fiches, mise en ligne", "description": "Aucun frais pour rejoindre la plateforme et publier vos services." },
            { "value": "10 %", "title": "Commission par réservation", "description": "Prélevée automatiquement sur le montant client. Tout inclus, pas de surcouche." },
            { "value": "J+1", "title": "Délai de reversement", "description": "Stripe envoie le virement après confirmation de la prestation." }
          ],
          "disclaimer": "Des formules d'abonnement avec commission réduite (Business, Enterprise) sont prévues pour les pros à fort volume. Elles seront proposées en option, jamais imposées. Les détails seront communiqués au moment du lancement."
        },
        "benefits": {
          "kicker": "Pourquoi nous rejoindre",
          "title": "Ce qu'on prend en charge pour vous.",
          "cards": [
            { "title": "Le paiement", "description": "Stripe Connect, KYC géré, factures automatiques, reversements rapides. Vous touchez votre argent sans relancer personne." },
            { "title": "La confiance", "description": "Profils vérifiés, avis modérés, médiation tukio en cas de litige. Vos clients arrivent rassurés." },
            { "title": "La communication", "description": "Messagerie intégrée, notifications, rappels. Tout l'historique de chaque dossier au même endroit." },
            { "title": "Le calendrier", "description": "Disponibilités, blocage de créneaux, conflits évités automatiquement." },
            { "title": "Les stats", "description": "Taux de conversion, panier moyen, délai de réponse. De quoi piloter votre activité." },
            { "title": "L'administratif", "description": "Mandat de facturation, gestion TVA, exports comptables. Votre comptable nous remerciera." }
          ]
        },
        "finalCta": {
          "kicker": "En préparation",
          "title": "La plateforme ouvre bientôt.",
          "body": "Les inscriptions pro ne sont pas encore ouvertes. Laissez-nous vos coordonnées pour être prévenu·e dès l'ouverture, et bénéficier d'un accès prioritaire pour publier vos premières fiches services.",
          "ctaPrimary": "Être prévenu·e à l'ouverture",
          "ctaContact": "Une question ? Nous écrire"
        }
      }
      ```
    - **`apps/seller/src/messages/en.json`** UPDATE : namespace EN équivalent strict. **Validation humaine requise** pour ton commercial pro — si dev agent utilise GPT-4 pour traduction, marker `"_NEEDS_HUMAN_REVIEW": true` + ouvrir issue follow-up. **Réutilisation possible** des traductions Story 0.17 communes (e.g., "À très bientôt" / "See you soon") mais pas de partage cross-app de la i18n (chaque app a ses propres messages).

12. **AC12 — Header + Footer + SiteHeader cohérence** : 
    - **Header** : `<SiteHeader>` Story 0.16 avec `<LogoMark size={22}>` + 0 navItems (la page seller en mode coming soon n'a pas de navigation cohérente vers À propos / Privacy car ces pages sont sur apex — sauf si on veut faire des cross-zone links, à voir). Recommandation : `navItems=[]` simple (juste Logo + locale switcher si disponible).
    - **Footer** : `<Footer variant="minimal" />` Story 0.16 — copyright + 2 links (`Mentions légales` cross-zone → `https://tukio.one/${locale}/mentions-legales` + `contact@tukio.one` mailto).
    - **Layout** : `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx` orchestre Header + Main + Footer. Pas de `<EditorialPageShell>` car la page n'a pas le format kicker+h1+intro centré standard — c'est une page multi-sections riches.

13. **AC13 — SEO metadata (Next.js 16 `generateMetadata`)** :
    ```ts
    export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
      const t = await getTranslations({ locale: params.locale, namespace: 'seller_coming_soon.meta' });
      const baseUrl = process.env.NEXT_PUBLIC_SELLER_BASE_URL ?? 'https://seller.tukio.one';
      return {
        title: t('title'),
        description: t('description'),
        openGraph: {
          title: t('title'),
          description: t('description'),
          type: 'website',
          locale: params.locale === 'fr' ? 'fr_FR' : 'en_US',
          siteName: 'tukio.one — Pros',
          images: [{ url: `${baseUrl}/og/seller-coming-soon.png`, width: 1200, height: 630 }],
          url: `${baseUrl}/${params.locale}/seller-coming-soon`,
        },
        twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
        alternates: {
          canonical: `${baseUrl}/${params.locale}/seller-coming-soon`,
          languages: { fr: `${baseUrl}/fr/seller-coming-soon`, en: `${baseUrl}/en/seller-coming-soon`, 'x-default': `${baseUrl}/fr/seller-coming-soon` },
        },
        robots: { index: true, follow: true }, // indexable (différence vs success Story 0.17)
      };
    }
    ```
    - **OG image** : `seller-coming-soon.png` 1200×630. Story 0.21 livre via Image Response Edge runtime. **Fallback** : `og/placeholder.png` ou même la même image que landing apex Story 0.17 (acceptable transitoire — Story 0.21 différencie).

14. **AC14 — A11y RGAA AA (NFR50/54)** :
    - **Sémantique HTML** : `<header role="banner">`, `<main>` unique, `<h1>` unique (dans Hero), `<h2>` × 6 (un par section principale), `<footer role="contentinfo">`. Pas de h2 manquant entre h1 et h3.
    - **Cards avec icons** : icon `aria-hidden="true"` (décoratif), texte du title fait office de label sémantique.
    - **CTAs** : `<a>` ou `<button>` avec label texte explicite (pas de "Click here").
    - **Section sombre** : `cream-50` sur `charcoal-800` → contrast AAA. `cream-200 opacity-85` → vérifier qu'on reste ≥ 4.5:1 (AA). Si limite, opacity à 90 ou utiliser `cream-100`.
    - **Test axe-core** : ajouter dans Playwright e2e case "axe-core full page" → 0 violations.
    - **Skip-link** : `<a href="#main-content" className="sr-only focus:not-sr-only">` Aller au contenu / Skip to content + `<main id="main-content">` sur la page.
    - **Lighthouse a11y** : ≥ 95.

15. **AC15 — Playwright e2e 6 cases × 2 locales = 12 contextes** : `apps/seller/test/e2e/seller-coming-soon.spec.ts`.
    - **Cases mode flag ON** :
      1. `GET /fr/seller-coming-soon` → 200 + H1 "Comment fonctionne tukio.one pour les pros" visible + banner brand-50 "tukio.one n'est pas encore ouverte" visible.
      2. `GET /en/seller-coming-soon` → 200 + H1 EN traduit.
      3. **Scroll-to-section** : scroll vers la section "Paiements et reversements" (charcoal-800) → vérifier que la section est visible viewport + texte "Stripe gère les paiements, pas tukio" présent.
      4. **CTA cross-zone intercept** : click sur "Être prévenu·e à l'ouverture" → `page.waitForURL('**/coming-soon?role=pro')` (Playwright `route.continue()` ou check `page.url()` après navigation). **Si CrossZoneCtaClient est un `<a>` Server simple** : `<a href>` test direct. **Si Client Component** : intercept `window.location` assignment.
      5. **Sections présentes** : vérifier que les 8 sections (Hero + Professions + Journey + Requirements + Payments + Pricing + Benefits + FinalCta) sont toutes visibles via assertions sur les kickers ou h2 textes.
      6. **axe-core full page** : 0 violations.
    - **Lighthouse perf** : run via `@playwright/test` + `playwright-lighthouse` plugin sur 1 case → ≥ 90 perf (longue page tolérance).
    - **Conformément accords Stories 1.2b-d** : dev livre code + spec **NON-EXÉCUTÉ** localement par dev agent.

16. **AC16 — Responsive desktop/tablet/mobile** :
    - **Desktop ≥ 1024px** : layout original design (3-col / 4-col / 5-col / 2-col grids selon section).
    - **Tablet 768-1023px** : grids 3-col → 2-col, 4-col → 2-col, 5-col → 3-col. Hero 2-col → stack vertical.
    - **Mobile < 768px** : tout en 1-col. CTAs full-width. Padding réduit (`px-4` au lieu de `px-10`).
    - **Test manuel** : Chrome DevTools responsive mode → Pixel 5 / iPad / Desktop 1920px → visuel cohérent.
    - **Playwright responsive case (optionnel)** : ajouter 1 case `page.setViewportSize({ width: 375, height: 812 })` + screenshot snapshot pour vérifier mobile rendering.

17. **AC17 — Lint + typecheck + test + build final** :
    - `pnpm --filter=seller lint` → 0 errors.
    - `pnpm --filter=seller typecheck` → 0 errors.
    - `pnpm --filter=seller test --coverage` → vert (faible coverage acceptable vu que la page est éditoriale pure — ≥ 50% sur `CrossZoneCtaClient` si Client retenu).
    - `pnpm --filter=seller build` → success. Bundle JS de la page ≤ 20 KB gzipped (Server Components 100% si pas de Client) ou ≤ 30 KB si CrossZoneCtaClient utilisé.
    - Smoke local : `NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=seller dev` → navigate `localhost:3002/fr/seller-coming-soon` → vérifier rendering des 8 sections + click CTA → redirect cross-zone.

## Tasks / Subtasks

- [x] **Task 1 — Folder structure + page principale** (AC: #1)
  - [x] 1.1 Créer dossier `apps/seller/src/features/pre-launch/components/`
  - [x] 1.2 UPDATE `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx` — Server Component principal qui orchestre Header + 8 sections + Footer
  - [x] 1.3 Décider Server `<a>` simple vs Client `CrossZoneCtaClient` — recommandation Option A (Server `<a>`)

- [x] **Task 2 — i18n FR + EN namespace `seller_coming_soon`** (AC: #11)
  - [x] 2.1 UPDATE `apps/seller/src/messages/fr.json` — namespace complet ~90 keys (meta, hero, professions cards[6], journey steps[5], requirements proApp + paymentAccount, payments pipeline[4] + clientPays[4] + youGetPaid[4] + stripePartner, pricing cards[3] + disclaimer, benefits cards[6], finalCta)
  - [x] 2.2 UPDATE `apps/seller/src/messages/en.json` — namespace EN équivalent (traduction professionnelle ou GPT-4 review humaine)
  - [x] 2.3 Si EN non-validé → marker `"_NEEDS_HUMAN_REVIEW": true` + issue follow-up

- [x] **Task 3 — Hero + Professions + Journey** (AC: #2, #3, #4)
  - [x] 3.1 Créer `SellerComingSoonHero.tsx` (2-col + banner brand-50 + image placeholder gradient)
  - [x] 3.2 Créer `SellerComingSoonProfessions.tsx` (6 cards grid 3-col responsive)
  - [x] 3.3 Créer `SellerComingSoonJourney.tsx` (5 steps horizontal cards numérotés)

- [x] **Task 4 — Requirements + Payments (section sombre)** (AC: #5, #6)
  - [x] 4.1 Créer `SellerComingSoonRequirements.tsx` (2 cards docs)
  - [x] 4.2 Créer `SellerComingSoonPayments.tsx` (charcoal-800 dark + pipeline 4 + 2 cards modes + Stripe partner)
  - [x] 4.3 Vérifier color contrast AAA cream-50/charcoal-800 et AA cream-200 (NFR50/54)

- [x] **Task 5 — Pricing + Benefits + FinalCta** (AC: #7, #8, #9)
  - [x] 5.1 Créer `SellerComingSoonPricing.tsx` (3 cards "0 €/10 %/J+1" + disclaimer V1+)
  - [x] 5.2 Créer `SellerComingSoonBenefits.tsx` (6 cards "Pourquoi nous rejoindre")
  - [x] 5.3 Créer `SellerComingSoonFinalCta.tsx` (CTA primary cross-zone + tertiary contact)

- [x] **Task 6 — Cross-zone CTA** (AC: #10)
  - [x] 6.1 Décider Server `<a>` (Option A) vs Client Component (Option B avec Plausible tracking)
  - [x] 6.2 Si Option A : créer helper Server Component `CrossZoneCta.tsx` avec `<a href>` rendering
  - [x] 6.3 Si Option B : créer `CrossZoneCtaClient.tsx` + spec
  - [x] 6.4 Vérifier URL hardcoded `https://tukio.one/${locale}/coming-soon?role=pro` ou env-driven `NEXT_PUBLIC_PUBLIC_BASE_URL`

- [x] **Task 7 — SEO + a11y** (AC: #13, #14)
  - [x] 7.1 Ajouter `generateMetadata` avec OG image + canonical + hreflang
  - [x] 7.2 UPDATE `apps/seller/.env.example` si `NEXT_PUBLIC_SELLER_BASE_URL` manquant
  - [x] 7.3 Skip-link "Aller au contenu" / "Skip to content" en haut de page
  - [x] 7.4 Tester contraste section sombre via outil Chrome DevTools

- [x] **Task 8 — Responsive** (AC: #16)
  - [x] 8.1 Vérifier breakpoints Tailwind v4 `max-md:`, `max-lg:`, `max-sm:` sur toutes grids
  - [x] 8.2 Test manuel Chrome DevTools responsive Pixel 5 + iPad + Desktop

- [x] **Task 9 — Playwright e2e** (AC: #15)
  - [x] 9.1 Créer `apps/seller/test/e2e/seller-coming-soon.spec.ts` (6 cases × 2 locales = 12 contextes)
  - [x] 9.2 NON-EXÉCUTÉ localement par dev agent — Ismael run

- [x] **Task 10 — Lint + typecheck + test + build + smoke** (AC: #17)
  - [x] 10.1 `pnpm --filter=seller lint && typecheck && test && build` → 0 errors
  - [x] 10.2 Smoke `NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=seller dev` → navigate page + click CTA → redirect cross-zone

## Dev Notes

### Architecture patterns à appliquer

- **Server Components 100% (ou 99%)** : page éditoriale pure — pas de state, pas d'event handlers (sauf CrossZoneCta si Client retenu). Bundle JS minimal, perf optimal.
- **Composition par sections** : 8 sous-composants Server, chacun avec sa propre responsabilité. Le `page.tsx` est un orchestrateur léger.
- **i18n strict via next-intl `getTranslations`** : Server async. Pas de `useTranslations` (Client-only).
- **Cross-zone redirect** : `window.location.assign` (Client) ou `<a href>` (Server preferred). URL hardcoded ou env-driven.
- **Atomes Story 0.16** : Kicker (avec variant `color="cream"` pour section sombre) + Pill (probablement pas utilisé Story 0.18 — réservé Story 0.17) + Footer minimal.
- **Pas de form** : à la différence Story 0.17. Toute la conversion passe par le cross-zone CTA vers apex.
- **`tk-card` Tailwind utility** : pour les cards atomiques (réutilise pattern Story 0.4 `Card` atom OR utility CSS si plus simple). Décision dev-time.

### Source tree composants à toucher

| Fichier / dossier | Action | Estimation |
|--|--|--|
| `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx` | UPDATE (placeholder Story 0.15 → final) | ~50 lignes |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonHero.tsx` | NEW | ~80 lignes |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonProfessions.tsx` | NEW | ~70 lignes |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonJourney.tsx` | NEW | ~60 lignes |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonRequirements.tsx` | NEW | ~80 lignes |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonPayments.tsx` | NEW | ~180 lignes (section la plus dense) |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonPricing.tsx` | NEW | ~70 lignes |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonBenefits.tsx` | NEW | ~80 lignes |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonFinalCta.tsx` | NEW | ~50 lignes |
| `apps/seller/src/features/pre-launch/components/CrossZoneCta.tsx` (ou Client) | NEW | ~30 lignes |
| `apps/seller/src/messages/fr.json` | UPDATE | +180 lignes namespace |
| `apps/seller/src/messages/en.json` | UPDATE | +180 lignes namespace |
| `apps/seller/.env.example` | UPDATE (si manquant) | +1 var `NEXT_PUBLIC_SELLER_BASE_URL` + `NEXT_PUBLIC_PUBLIC_BASE_URL` |
| `apps/seller/test/e2e/seller-coming-soon.spec.ts` | NEW | ~200 lignes (6 cases × 2 locales) |

**Total** : ~14 fichiers (12 NEW + 2 UPDATE), ~1100-1400 lignes + 360 i18n. **Estimation 2.5-3 jours** dev solo (page très dense, beaucoup de copy à traduire).

### Testing standards résumé

- **Pas de unit tests** sur les Server Components purs (juste du rendering JSX statique — testé via E2E Playwright).
- **Unit test sur `CrossZoneCtaClient`** si retenu Option B : 4+ cases (render + click déclenche window.location.assign + tracking Plausible appelé si disponible + a11y).
- **E2E Playwright** : 6 cases × 2 locales = 12 contextes. NON-EXÉCUTÉ localement par dev agent.
- **Lighthouse** : 1 run via Playwright plugin sur landing FR → ≥ 90 perf / ≥ 95 a11y / ≥ 100 SEO.
- **Coverage non-applicable** sur Server Components éditorial — focus sur E2E.

### Pièges connus à éviter

1. **Section sombre charcoal-800 contrast** : tester explicitement via Chrome DevTools "Inspect element → Accessibility tab". `cream-200 opacity-85` peut tomber sous AA 4.5:1 — ajuster opacity ou utiliser `cream-100`.
2. **CrossZone URL hardcoded vs env** : décider tôt. Si env (`NEXT_PUBLIC_PUBLIC_BASE_URL`), mettre à jour `.env.example` + `.env.local`. Sinon hardcoded `https://tukio.one` accepté pour MVP (l'URL ne changera pas).
3. **Server Component `<a>` simple suffit la plupart du temps** — éviter Client Component si pas de tracking. Pattern Stripe partner card : zéro JS pour 70% des Visiteurs.
4. **i18n arrays cards/steps** : next-intl 4.4.0 supporte les arrays via `t('cards.0.title')` ou `useMessages()` pour lire l'array entier. Tester syntax avant scaler à 6 cards × 2 locales.
5. **Image gradient hero** : placeholder via CSS pure (pas de `<img>` chargé). `<div style={{ background: 'linear-gradient(160deg, var(--color-brand-100), var(--color-brand-300))' }}>` aspect-square rounded-2xl + inner border. Pas de PNG/SVG.
6. **Stripe logo `#635BFF`** : couleur Stripe brand officielle. Lettre "S" stylisée → pas de SVG external. Décision : placeholder "S" suffisant Story 0.18 ; si V1+ on veut le vrai logo Stripe, suivre brand guidelines Stripe (logo PNG/SVG officiel).
7. **Pas de form sur la page seller** : à la différence Story 0.17. Tout passe par cross-zone CTA vers apex. Bien le clarifier dans le code (Server Components uniquement, pas de RHF, pas de hooks).
8. **Footer minimal cross-zone links** : `Mentions légales` doit pointer vers `https://tukio.one/${locale}/mentions-legales` (apex), pas `seller.tukio.one/${locale}/mentions-legales` (n'existe pas — placeholder Story 0.15 redirige mais inutile de dupliquer).
9. **OG image Story 0.21** : différencier `seller-coming-soon.png` vs `coming-soon.png` (apex) — c'est 2 visuels distincts (le seller met l'accent sur "Pour les pros"). Si Story 0.21 pas done, placeholder unique acceptable transitoire.
10. **Bundle taille** : si on bascule en 100% Server `<a>`, bundle JS de la page = ~5 KB (juste hydratation Next.js framework). Lighthouse perf ≥ 95 garanti.

### Coordination cross-story

- **Story 0.15 (toggle middleware)** : whitelist `/seller-coming-soon` + `/seller-coming-soon/success` déjà spec. Placeholder Story 0.15 sera écrasé Story 0.18.
- **Story 0.16 (atoms)** : Kicker (avec `color="cream"` variant pour section sombre) + Footer minimal + SiteHeader. Utilisation directe via subpath imports.
- **Story 0.17 (landing apex)** : reçoit le `?role=pro` query du cross-zone CTA. Coordination signature OK (Story 0.17 AC4 pre-fill role="professionnel" si query="pro").
- **Story 0.19 (4 pages publiques)** : la page Contact apex est référencée par le bouton "Une question ? Nous écrire" Story 0.18 (cross-zone). Si Story 0.19 pas done, le link aboutit sur placeholder Story 0.15 (acceptable transitoire).
- **Story 0.21 (SEO + Plausible)** : `seller-coming-soon.png` OG image + Plausible event `Devenir Pro CTA Click`. Si Story 0.21 pas done : OG fallback + pas de tracking (Story 0.18 ne dépend pas strictement).

### Project Structure Notes

- **Alignement** :
  - Pattern feature-folder `apps/seller/src/features/pre-launch/` (cohérent Story 0.17 `apps/public/src/features/pre-launch/`)
  - Server Components par défaut Next.js 16
  - i18n next-intl namespace per app (pas de partage cross-app)
  - Atomes `@tukio/ui` subpath imports stricts
- **Variance** :
  - Pas de form, pas de hook, pas de schema — différence fondamentale vs Story 0.17.
  - Page longue dense — décomposition en 8 sous-composants Server pour lisibilité.
  - Section sombre charcoal-800 unique dans le pré-lancement — pattern de couleurs distinct des autres pages.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story-0.18] Spec brute Story 0.18 (ACs source)
- [Source: `tukio-design/project/screens/public-pages.jsx:113-397`] Design source canonical (BecomeProScreen)
- [Source: `_bmad-output/implementation-artifacts/0-17-landing-coming-soon-apex.md`] Story 0.17 — pattern Server/Client split + i18n namespace + SEO metadata
- [Source: `_bmad-output/implementation-artifacts/0-16-design-system-atoms-pre-launch.md`] Atoms Kicker + Footer minimal + SiteHeader
- [Source: `_bmad-output/implementation-artifacts/0-15-coming-soon-toggle-infra-middleware.md`] Whitelist seller + placeholders
- [Source: `apps/seller/src/messages/fr.json`] Structure i18n existante
- [Source: `apps/seller/src/app/[locale]/page.tsx`] Pattern Server Component existant
- [Source: `_bmad-output/planning-artifacts/architecture.md`#ADR-012] i18n FR + EN bilingue
- [Source: `_bmad-output/planning-artifacts/architecture.md`#NFR50-54] a11y RGAA AA
- [Source: https://nextjs.org/docs/app/building-your-application/rendering/server-components] Next.js 16 Server Components
- [Source: `AGENTS.md`] Hard rules

### Latest tech specifics

- **Next.js 16.2.6** : Server Components default, pas de hydratation côté seller-coming-soon.
- **next-intl 4.4.0** : `getTranslations` Server async + arrays support via dot-notation `t('cards.0.title')` ou `useMessages()` hook.
- **Tailwind v4** : tokens via classes utility. `bg-charcoal-800` + `text-cream-50` strict.
- **lucide-react ^1.14.0** : icons `Tent`, `Package`, `Flame`, `Sparkles`, `Zap`, `User`, `CreditCard`, `Shield`, `MessageSquare`, `Calendar`, `BarChart3`, `FileText`, `Check`.

### Sécurité

- **Pas de form** : pas de validation, pas de submit, pas de hook. Surface attaque minimale.
- **Cross-zone URL** : `https://tukio.one` hardcoded ou env-driven. Pas d'injection (URL statique).
- **Plausible tracking** : si Client retenu, pas de PII envoyée (juste event name + locale).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Aucun.

### Completion Notes List

- Story 0.18 est la page la **plus dense** de la phase pré-lancement (~1100-1400 lignes + 360 i18n). Allouer 2.5-3 jours.
- Recommandation : implémenter une section à la fois et tester visuellement avant de passer à la suivante. Le scope est gérable car éditorial pur.
- Décision Server `<a>` vs Client : démarrer Server simple, migrer Client si Story 0.21 livre Plausible event tracking en parallèle.

### File List

**NEW (10 fichiers)** :
- `apps/seller/src/features/pre-launch/components/CrossZoneCta.tsx` (Server `<a>` helper, env-driven URL)
- `apps/seller/src/features/pre-launch/components/SellerComingSoonHero.tsx`
- `apps/seller/src/features/pre-launch/components/SellerComingSoonProfessions.tsx`
- `apps/seller/src/features/pre-launch/components/SellerComingSoonJourney.tsx`
- `apps/seller/src/features/pre-launch/components/SellerComingSoonRequirements.tsx`
- `apps/seller/src/features/pre-launch/components/SellerComingSoonPayments.tsx` (charcoal-800 dark + Stripe partner)
- `apps/seller/src/features/pre-launch/components/SellerComingSoonPricing.tsx`
- `apps/seller/src/features/pre-launch/components/SellerComingSoonBenefits.tsx`
- `apps/seller/src/features/pre-launch/components/SellerComingSoonFinalCta.tsx`
- `apps/seller/e2e/seller-coming-soon.spec.ts` (6 cases — NON-EXÉCUTÉ localement)

**UPDATE (3 fichiers)** :
- `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx` — remplace placeholder Story 0.15
- `apps/seller/src/messages/fr.json` — namespace `seller_coming_soon` ajouté
- `apps/seller/src/messages/en.json` — namespace `seller_coming_soon` + `_NEEDS_HUMAN_REVIEW` marker

**Total** : 13 fichiers (10 NEW + 3 UPDATE), ~1050 lignes ajoutées + 360 i18n strings.

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-20 | bmad-create-story (Opus 4.7) | Initial story creation — Landing seller Devenir Pro 8 sections (Hero + Professions 6 + Journey 5 + Requirements 2 + Payments dark 4+2+1 + Pricing 3 + Benefits 6 + FinalCta), 100% Server Components ou 99% (CrossZoneCta Server `<a>` ou Client option B avec Plausible tracking), i18n FR+EN namespace seller_coming_soon ~90 keys × 2 = 180 strings, cross-zone CTAs vers tukio.one/coming-soon?role=pro, SEO indexable, a11y RGAA AA avec attention section sombre contrast, Playwright 6×2=12 contextes. ~14 fichiers, 2.5-3j dev. |
| 2026-05-22 | bmad-dev-story (Opus 4.7 1M) | Implementation done — 13 fichiers (10 NEW + 3 UPDATE), ~1050 lignes + 360 i18n strings. **100% Server Components** (Option A retenue : CrossZoneCta helper Server `<a>` env-driven `NEXT_PUBLIC_PUBLIC_BASE_URL`). 8 sections : Hero (2-col grid + banner brand-50 + visual gradient placeholder) + Professions (6 cards lucide icons mapping Story 0.16) + Journey (5 steps numérotés italic) + Requirements (2 cards docs ul/li Check) + Payments charcoal-800 dark (pipeline 4 + 2 cols paiement + Stripe partner #635BFF) + Pricing (3 cards "0 €/10 %/J+1" + disclaimer V1+) + Benefits (6 cards) + FinalCta (CrossZoneCta + tertiary contact apex). SiteHeader + Footer minimal Story 0.16. SEO `index: true, follow: true` + OG/Twitter/hreflang. A11y RGAA AA : skip-link i18n, `<main id="main-content">`, h1 unique, role=banner/contentinfo via @tukio/ui, **section sombre dark color contrast renforcé `text-cream-100` au lieu de `text-cream-200 opacity-85` pour AA strict**. Playwright spec 6 cases (NON-EXÉCUTÉ localement — accord Stories 1.2b-d). Tests 28/28 verts (seller pre-existing, aucune régression) · lint 0 errors · typecheck 0 errors · build ✅ routes `/[locale]/seller-coming-soon` présentes. Bundle JS landing ~5 KB (Server `<a>` only, zéro hydratation form). Story passée review. |
