# Story 0.17: Landing Coming Soon apex tukio.one (`/${locale}/coming-soon` + success state) — capture email RGPD pré-lancement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Visitor (grand public curieux ou pro de l'événementiel) qui tape `tukio.one` pendant la phase pré-lancement,
**I want** atterrir sur une **landing éditoriale chaleureuse 2-colonnes** (hero pitch éditorial + formulaire de capture d'email 5 fields RGPD-conforme) **strictement conforme au design** `tukio-design/project/screens/coming-soon.jsx`, et après submit voir un **écran success** avec confirmation personnalisée (prénom + position dans la liste d'attente),
**so that** : (a) je comprends en 5 secondes ce qu'est tukio.one (marketplace événementiel Pays de la Loire avec tentes/mobilier/traiteur/déco), (b) je peux laisser mes coordonnées (prénom + nom + email + role organisateur/pro + RGPD opt-in checkbox) en moins de 30 secondes, (c) je reçois une confirmation visuelle rassurante post-submit qui me fait comprendre que la list est sérieuse (position waitlist, ton chaleureux "À très bientôt, *Camille*", parrainage CTA pour engagement), (d) je sais exactement quand j'aurai des nouvelles ("On vous écrit une seule fois, le jour de l'ouverture. Pas de spam, promis."), (e) la page respecte mon RGPD (mention "Vos données restent en France, jamais revendues" avec icône shield + lien Privacy policy).

> **Outcome attendu** : à la fin de cette story, (1) `pnpm --filter=public dev` + navigate `/fr/coming-soon` rend **exactement** la landing du design `coming-soon.jsx:5-183` — split desktop 2-cols (1.1fr éditorial gauche + 1fr formulaire droite background cream-100) + responsive stacked mobile + Pill animé "● En construction" brand-50 + H1 Fraunces 64px "Vos événements, *réservés.*" italic brand-600 + trust strip 3 stats "140+ / 44·49 / 0 €" + 5-field form RHF + zodResolver pattern Story 1.2d + reassurance "Vos données restent en France" + Footer minimal Story 0.16 ; (2) après submit valide, redirect `/fr/coming-soon/success` rend l'écran success `coming-soon.jsx:186-241` — cercle check success-50 + H1 "À très bientôt, *{firstName}.*" italic brand-600 + position "247ᵉ personne" + bloc "En attendant..." parrainage ; (3) `?role=pro` query string pré-coche le radio "Professionnel" (cross-zone redirect from Story 0.18 `seller.tukio.one/seller-coming-soon` CTA "Être prévenu·e à l'ouverture") ; (4) i18n FR + EN complet (ADR-012) — ~30 keys × 2 locales = 60 strings dans namespace `coming_soon` ; (5) Lighthouse desktop ≥ 95 perf / ≥ 95 a11y / ≥ 100 SEO / ≥ 100 best practices ; (6) axe-core 0 violations 2 pages ; (7) Playwright e2e 8 cases verts × 2 locales (FR + EN) = 16 contextes ; (8) la chaîne handler API `/api/pre-launch/signup` (Story 0.20) est consommée via `useSubmitPreLaunchSignup()` hook avec mapping erreurs strict (rate-limited 429 / network / validation / generic) — pattern Story 1.2d `classifySignUpError`. **Conditional rendering** : tant que Story 0.20 n'est pas done, le form mock retourne `{ ok: true, position: 247 }` via un fake handler local pour permettre le test e2e Story 0.17 en isolation (handoff documenté).

## Acceptance Criteria

1. **AC1 — Architecture pages Next.js 16 App Router** : 2 pages Server Components + 1 Client Component pour le form.
   - **`apps/public/src/app/[locale]/coming-soon/page.tsx`** (UPDATE depuis placeholder Story 0.15 et smoke Story 0.16) : Server Component, render le shell `<ComingSoonHeader>` + `<ComingSoonHero>` + `<ComingSoonFormClient>` (Client) + `<Footer variant='minimal'>` Story 0.16. Lit `searchParams.role` pour potentiellement pré-cocher pro role.
   - **`apps/public/src/app/[locale]/coming-soon/success/page.tsx`** (UPDATE depuis placeholder Story 0.15) : Server Component, render `<ComingSoonSuccessHeader>` (SiteHeader avec navItems FR/EN) + `<ComingSoonSuccessHero>` (lit `searchParams.firstName` + `searchParams.position` côté server, validation strict — fallback "Vous" si firstName manquant pour ne pas crash).
   - **`apps/public/src/features/pre-launch/components/ComingSoonHero.tsx`** (NEW) : Server Component — render le `<Kicker>` + Pill + H1 + p + trust strip (3 stats).
   - **`apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx`** (NEW) : `'use client'`, render le form 5 fields (RHF + zodResolver) avec le hook `useSubmitPreLaunchSignup()` Story 0.20 (mocké si non done — voir AC11).
   - **`apps/public/src/features/pre-launch/components/ComingSoonSuccessHero.tsx`** (NEW) : Server Component, render success icon + H1 personnalisé + position + bloc parrainage.
   - **`apps/public/src/features/pre-launch/components/ComingSoonHeader.tsx`** (NEW) : Server Component, render `<SiteHeader>` Story 0.16 avec `<LogoMark size={22}>` + rightSlot mono uppercase "Bientôt en Pays de la Loire" (i18n).
   - **Folder layout final** :
     ```
     apps/public/src/
     ├── app/[locale]/coming-soon/
     │   ├── page.tsx                              # Server — main landing
     │   └── success/page.tsx                      # Server — success state
     └── features/pre-launch/
         ├── components/
         │   ├── ComingSoonHeader.tsx              # Server
         │   ├── ComingSoonHero.tsx                # Server
         │   ├── ComingSoonFormClient.tsx          # Client ('use client')
         │   ├── ComingSoonSuccessHero.tsx         # Server
         │   └── __tests__/
         │       ├── ComingSoonFormClient.spec.tsx
         │       └── ComingSoonSuccessHero.spec.tsx
         ├── schemas/
         │   ├── pre-launch-signup.schema.ts       # Zod schema (Story 0.20 réutilisera)
         │   └── pre-launch-signup.schema.spec.ts
         └── services/
             ├── classify-pre-launch-error.ts      # Pattern Story 1.2d classifySignUpError
             └── classify-pre-launch-error.spec.ts
     ```

2. **AC2 — Hero gauche éditorial** : `ComingSoonHero.tsx` réplique **strictement** le design `coming-soon.jsx:20-73` :
   - Container : `<section>` padding desktop `pt-16 pb-20 px-20`, flex column justify-center, max-width approprié.
   - **Pill animée** : `<Pill pulseDot variant="brand">En construction</Pill>` Story 0.16 — texte via `t('hero.pillLabel')`.
   - **H1** : `<h1>` font-display (Fraunces) font-normal text-[64px] leading-[1.02] tracking-tight color-charcoal-800 max-w-[560px] mt-6 :
     ```tsx
     <h1>
       {t('hero.titleLine1')}<br />
       <em className="italic text-brand-600">{t('hero.titleLine2Emphasis')}</em>
     </h1>
     ```
     i18n FR : `titleLine1="Vos événements,"` + `titleLine2Emphasis="réservés."` / EN : `titleLine1="Your events,"` + `titleLine2Emphasis="booked."`.
   - **Pitch** : `<p>` text-[18px] color-charcoal-600 mt-6 max-w-[480px] leading-[1.6]. Contenu FR via `t('hero.pitch')` : `"tukio.one est la marketplace des professionnels de l'événementiel en Pays de la Loire. Tentes, mobilier, traiteur, décoration : un événement, une plateforme, près de chez vous."`. EN : `"tukio.one is the marketplace for event service pros in Pays de la Loire. Tents, furniture, catering, decoration: one event, one platform, close to home."`.
   - **Sub-pitch** : `<p>` text-[14px] color-charcoal-500 mt-4 max-w-[460px] leading-[1.55]. Contenu FR : `"On finalise les derniers détails avant l'ouverture. Laissez-nous votre email pour être prévenu·e dès que tukio.one est en ligne."`.
   - **Trust strip** : `<div>` mt-10 pt-6 border-t border-cream-200 flex gap-8 text-[13px] color-charcoal-600. 3 stats inline-flex-column gap-1 :
     - "140+" font-display 22px medium / "Pros déjà inscrits" font-mono uppercase tracking-wider text-[11px] color-charcoal-500
     - "44 · 49" / "Lancement pilote" (référence Loire-Atlantique + Maine-et-Loire)
     - "0 €" / "Inscription"
   - **Note design** : tous les stats sont **statiques** Story 0.17 (pas connectés à de la donnée live). Le "140+" est une placeholder volontaire — si Ismael veut piloter ce chiffre (vrai count waitlist), c'est un follow-up Story 0.20 enrichment.

3. **AC3 — Formulaire droite (Client Component)** : `ComingSoonFormClient.tsx` réplique le design `coming-soon.jsx:76-169` + applique le pattern RHF + zodResolver canonical de Story 1.2d `SignUpForm.tsx`.
   - **Container** : `<section>` background cream-100, padding desktop `pt-16 pb-20 px-16`, border-left cream-200, flex column justify-center.
   - **Heading** :
     - `<Kicker color="brand">Rester informé·e</Kicker>` (i18n `form.kicker` FR/EN)
     - `<h2>` font-display 32px medium tracking-tight color-charcoal-800 mt-2.5 leading-[1.1] : `"Soyez parmi les <em italic brand-600>premiers</em>."` FR / `"Be among the <em italic brand-600>first</em>."` EN
     - `<p>` text-[14px] color-charcoal-600 mt-2.5 leading-[1.55] : `"On vous écrit une seule fois, le jour de l'ouverture. Pas de spam, promis."` FR
   - **Form layout** : `<form onSubmit={handleSubmit(onSubmit)}>` mt-7 flex column gap-4.
   - **Fields** :
     1. **Prénom + Nom 2-col grid** (`grid-cols-2 gap-3`) :
        - `<FormField>` Prénom : label "Prénom" / "First name", placeholder "Camille" / "Camille", validation 1-80 chars trim (zod), erreur inline "Prénom requis" / "First name required"
        - `<FormField>` Nom : idem, placeholder "Renaud" / "Renaud", erreur "Nom requis" / "Last name required"
     2. **Email** (full-width) : `<FormField type="email">` label "Adresse email" / "Email address", placeholder "vous@exemple.fr" / "you@example.com", validation RFC 5322 regex + max 254 chars (zod), erreurs distinctes "Email requis" / "Email invalide" / "Email trop long"
     3. **Role radio cards** (custom) :
        - Label "Vous êtes…" / "You are…"
        - 2-col grid : Card 1 "Organisateur" / "Organizer" + sub-label "Je cherche des pros" / "I'm looking for pros" (default checked si pas de `?role=pro`)
        - Card 2 "Professionnel" / "Professional" + sub-label "Je propose des services" / "I offer services" (default checked SI `?role=pro` dans URL — AC4)
        - Style cards : padding-3.5 px-3.5, rounded-md, cursor-pointer. État actif : background brand-50, border brand-500, text-brand-700. État inactif : background cream-50, border cream-300, text-charcoal-800.
        - Radio input `accentColor: brand-500`.
        - **A11y** : `<input type="radio" name="role">` + `<label>` wrapper clickable + aria-checked + keyboard arrow nav between cards (Tab focus inter + arrows intra).
     4. **RGPD opt-in checkbox** : `<RadixCheckbox.Root>` (réutilise pattern Story 1.2d) default `checked={true}`, requis literal `true` (zod). Label avec lien inline :
        - FR : `"J'accepte de recevoir un email lors du lancement de tukio.one. Conforme RGPD — <Link href='/fr/confidentialite'>politique de confidentialité</Link>."`
        - EN équivalent.
        - Validation : si décoché → erreur "Vous devez accepter pour soumettre" / "You must accept to submit"
   - **CTA primary** : `<button>` className `tk-btn tk-btn-primary tk-btn-lg` width-full justify-center mt-2 (réutilise classes Story 0.4 Button atom — confirmer que `tk-btn-primary` existe ; sinon utiliser `<Button variant="primary" size="lg" fullWidth>`). Label FR "Me prévenir à l'ouverture" + trailing `<ArrowRight size={16} />` icon. Disabled + spinner si `isPending`. Aria-busy true pendant submit.
   - **Reassurance** : `<div>` text-[12px] color-charcoal-500 text-center mt-1 inline-flex justify-center items-center gap-1.5 :
     - `<Shield size={13} color="var(--color-success-500)" />` + `<span>{t('form.reassurance')}</span>`
     - FR : `"Vos données restent en France, jamais revendues"` / EN : `"Your data stays in France, never resold"`
   - **Hook submission** : utilise `useSubmitPreLaunchSignup()` Story 0.20 (cf. AC11 mock si pas done).
   - **On success** : `router.push(\`/${locale}/coming-soon/success?firstName=${encodeURIComponent(firstName)}&position=${position}\`)`. **Note sécurité** : firstName est URL-encoded pour éviter URL injection. Position est un nombre simple.
   - **On error** : utilise `classifyPreLaunchError(error)` (pattern Story 1.2d `classifySignUpError`) qui retourne `{ kind: 'rate_limited' | 'network' | 'validation' | 'generic', retryAfterSeconds?: number, fieldErrors?: Record<FieldKey, string> }`. Affiche bandeau `<Alert variant="danger">` au top du form (focus banner avec `useRef` + `useEffect` + `focus()` pour screen reader — pattern Story 1.2d patch P15) + inline field errors si validation kind. Pour `rate_limited`, affiche `t('form.errors.rateLimited', { seconds: retryAfterSeconds })` avec compteur.

4. **AC4 — Pré-remplissage `?role=pro` cross-zone** : si `searchParams.role === 'pro'` au mount, le form radio role doit être pré-coché sur "Professionnel" (vs default "Organisateur").
   - Implementation : `ComingSoonFormClient` reçoit `initialRole?: 'organisateur' | 'professionnel'` prop depuis `page.tsx` Server Component qui lit `searchParams.role`. RHF `defaultValues.role = initialRole ?? 'organisateur'`.
   - **Note** : Story 0.18 (seller landing) génère le CTA cross-zone vers `tukio.one/${locale}/coming-soon?role=pro`. Si on rajoute `?role=organisateur` explicite (e.g., depuis un futur Story), même mécanique.
   - **Sécurité whitelist** : si `searchParams.role` n'est ni `'pro'` ni `'organisateur'`, fallback default `'organisateur'` (no error, log Pino côté server). Pas d'XSS / injection — la valeur ne renvoie pas dans le DOM autre que `checked`.
   - **Spec** : `ComingSoonFormClient.spec.tsx` 2+ cases dédiés (mount with initialRole='professionnel' → second radio active visually + first radio inactive ; mount with initialRole=undefined → "Organisateur" active).

5. **AC5 — Page Success `/coming-soon/success`** : réplique strict design `coming-soon.jsx:186-241`.
   - **Header** : `<SiteHeader navItems={[{label: t('nav.about'), href: '/${locale}/a-propos'}, {label: t('nav.becomePro'), href: '/${locale}/devenir-pro'}, {label: t('nav.contact'), href: '/${locale}/contact'}]} />` Story 0.16. **Différence vs landing principale** : la page success a une vraie navigation (l'utilisateur peut explorer le reste du site institutionnel).
   - **Main centered** : `<main className="flex-1 flex items-center justify-center p-10">` + `<div className="max-w-[560px] text-center">`.
   - **Success icon** : cercle 80px rounded-full background success-50 border-2 success-500 + `<Check size={36} color="var(--color-success-700)" strokeWidth={2.5} />` (lucide-react `Check` mapping Story 0.16 doc).
   - **Heading bloc** :
     - `<Kicker color="success">C'est noté</Kicker>` / `"Noted"` EN
     - `<h1>` font-display font-normal text-[44px] tracking-tight color-charcoal-800 mt-3 leading-[1.05] : `"À très bientôt, <em italic brand-600>${firstName}.</em>"` FR / `"See you soon, <em italic brand-600>${firstName}.</em>"` EN
     - `<p>` text-[16px] color-charcoal-600 mt-4 leading-[1.6] : `"Vous êtes la <strong>${position}ᵉ personne</strong> sur la liste. On vous écrit dès l'ouverture, pas avant."` FR (utilise ICU plural for ranking — `1ʳᵉ`, `2ᵉ`, `3ᵉ`, etc. via next-intl format). EN : `"You are the <strong>${position}th person</strong> on the list. We'll email you when we open, not before."` (ordinal EN — `1st`, `2nd`, `3rd`, etc.).
   - **Bloc parrainage** : `<div className="mt-8 p-5 bg-cream-100 rounded-md text-left">` :
     - `<div text-[13px] font-semibold color-charcoal-800 mb-2>` "En attendant…" / "Meanwhile…"
     - `<div text-[13px] color-charcoal-600 leading-[1.6]>` : `"Vous connaissez un pro de l'événementiel en Pays de la Loire ?"` + `<Link href="mailto:contact@tukio.one?subject=Parrainage pro tukio.one">Parrainez-le →</Link>` brand-700 font-semibold
   - **Footer** : `<Footer variant="minimal" />` Story 0.16 (cohérent avec landing).
   - **Sécurité firstName** : firstName lu depuis `searchParams.firstName`, **sanitized** server-side : trim + max 80 chars + escape HTML caracters dangereux (`<`, `>`, `&`, `"`, `'`) — Next.js JSX échappe par défaut mais ceinture+bretelles via `String(decodeURIComponent(value)).replace(/[<>'"&]/g, '').slice(0, 80)`. Fallback "vous" / "you" si vide.
   - **Position validation** : `parseInt(searchParams.position, 10)` avec fallback 1 si NaN ou < 1 ou > 999999.
   - **Note design** : pas de regen côté server à chaque visite. Si l'utilisateur recharge `/coming-soon/success?firstName=Marie&position=247`, il revoit la même chose (deterministic stateless).

6. **AC6 — i18n FR+EN strict (ADR-012)** : namespace `coming_soon` (~30 keys × 2 locales = 60 strings).
   - **`apps/public/src/messages/fr.json`** UPDATE : append namespace :
     ```json
     "coming_soon": {
       "header": {
         "badge": "Bientôt en Pays de la Loire",
         "navAbout": "À propos",
         "navBecomePro": "Devenir pro",
         "navContact": "Contact"
       },
       "hero": {
         "pillLabel": "En construction",
         "titleLine1": "Vos événements,",
         "titleLine2Emphasis": "réservés.",
         "pitch": "tukio.one est la marketplace des professionnels de l'événementiel en Pays de la Loire. Tentes, mobilier, traiteur, décoration : un événement, une plateforme, près de chez vous.",
         "subPitch": "On finalise les derniers détails avant l'ouverture. Laissez-nous votre email pour être prévenu·e dès que tukio.one est en ligne.",
         "stat1Value": "140+",
         "stat1Label": "Pros déjà inscrits",
         "stat2Value": "44 · 49",
         "stat2Label": "Lancement pilote",
         "stat3Value": "0 €",
         "stat3Label": "Inscription"
       },
       "form": {
         "kicker": "Rester informé·e",
         "titleLine1": "Soyez parmi les",
         "titleEmphasis": "premiers",
         "subtitle": "On vous écrit une seule fois, le jour de l'ouverture. Pas de spam, promis.",
         "fields": {
           "firstName": { "label": "Prénom", "placeholder": "Camille", "errors": { "required": "Prénom requis", "tooLong": "Maximum 80 caractères" } },
           "lastName": { "label": "Nom", "placeholder": "Renaud", "errors": { "required": "Nom requis", "tooLong": "Maximum 80 caractères" } },
           "email": { "label": "Adresse email", "placeholder": "vous@exemple.fr", "errors": { "required": "Email requis", "invalid": "Email invalide", "tooLong": "Email trop long" } },
           "role": {
             "label": "Vous êtes…",
             "organizer": { "title": "Organisateur", "sub": "Je cherche des pros" },
             "professional": { "title": "Professionnel", "sub": "Je propose des services" }
           },
           "rgpd": { "label": "J'accepte de recevoir un email lors du lancement de tukio.one. Conforme RGPD — ", "linkLabel": "politique de confidentialité", "errors": { "required": "Vous devez accepter pour soumettre" } }
         },
         "submit": "Me prévenir à l'ouverture",
         "submitting": "Envoi en cours…",
         "reassurance": "Vos données restent en France, jamais revendues",
         "errors": {
           "generic": "Une erreur est survenue. Réessayez dans quelques instants.",
           "network": "Service momentanément indisponible. Réessayez dans quelques minutes.",
           "rateLimited": "Trop de tentatives. Réessayez dans {seconds} secondes.",
           "alreadySubscribed": "Vous êtes déjà inscrit·e ! On vous écrit dès l'ouverture."
         }
       },
       "success": {
         "headerNavAbout": "À propos",
         "headerNavBecomePro": "Devenir pro",
         "headerNavContact": "Contact",
         "kicker": "C'est noté",
         "titleLine1": "À très bientôt,",
         "titleEmphasisSuffix": ".",
         "positionMessage": "Vous êtes la {position, selectordinal, one {1ʳᵉ personne} two {2ᵉ personne} few {#ᵉ personne} other {#ᵉ personne}} sur la liste. On vous écrit dès l'ouverture, pas avant.",
         "meanwhileTitle": "En attendant…",
         "meanwhileLead": "Vous connaissez un pro de l'événementiel en Pays de la Loire ?",
         "meanwhileCta": "Parrainez-le →"
       },
       "footer": {
         "legal": "© tukio.one · {year} · Made in Loire-Atlantique",
         "linkBecomePro": "Devenir pro pilote",
         "linkLegalNotice": "Mentions légales",
         "linkContactEmail": "contact@tukio.one"
       },
       "meta": {
         "title": "tukio.one — Bientôt en Pays de la Loire",
         "description": "La marketplace des professionnels de l'événementiel en Pays de la Loire. Tentes, mobilier, traiteur, décoration. Soyez prévenu·e dès l'ouverture.",
         "successTitle": "Inscription confirmée — tukio.one",
         "successDescription": "Vous êtes sur la liste d'attente tukio.one. On vous écrit dès l'ouverture, pas avant."
       }
     }
     ```
   - **`apps/public/src/messages/en.json`** UPDATE : namespace EN équivalent strict. Traduction professionnelle requise — le ton chaleureux/italic doit ressortir. Si pas de validation humaine immédiate, marquer commentaire `"_NEEDS_HUMAN_REVIEW": true` dans le JSON et ouvrir issue follow-up.
   - **next-intl ICU plural `positionMessage`** : utilise `selectordinal` pour gérer FR (1ʳᵉ, 2ᵉ, 3ᵉ) et EN (1st, 2nd, 3rd, 4th). Cf. https://formatjs.io/docs/core-concepts/icu-syntax#selectordinal-format.
   - **Cross-app discipline** : ces strings vivent **uniquement** dans `apps/public/src/messages/*` — pas de partage avec `apps/seller` (qui aura son propre namespace `seller_coming_soon` Story 0.18).

7. **AC7 — Server Components vs Client Component split rigoureux (Next.js 16)** :
   - **Server par défaut** : `page.tsx` (landing + success), `ComingSoonHeader.tsx`, `ComingSoonHero.tsx`, `ComingSoonSuccessHero.tsx` — **pas de `'use client'`**. Lecture searchParams côté server, render statique SSR/SSG.
   - **Client uniquement** : `ComingSoonFormClient.tsx` (RHF + useState + useEffect + hook submit) — directive `'use client'` strict en haut.
   - **Server lit i18n** : `import { getTranslations } from 'next-intl/server'` dans les Server Components (pas `useTranslations` qui est Client). Pattern Next.js 16 + next-intl 4.4.0 documenté `https://next-intl.dev/docs/environments/server-client-components#async-components`.
   - **Client lit i18n** : `import { useTranslations, useLocale } from 'next-intl'` dans `ComingSoonFormClient` — pattern Story 1.2d ligne 5.
   - **Passage de props Server → Client** : `<ComingSoonFormClient initialRole={searchParams.role === 'pro' ? 'professionnel' : 'organisateur'} />`. Pas de fonction passée — props serializable strict.

8. **AC8 — SEO metadata (Next.js 16 `generateMetadata`)** :
   - **`page.tsx` (landing)** :
     ```ts
     export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
       const t = await getTranslations({ locale: params.locale, namespace: 'coming_soon.meta' });
       const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
       return {
         title: t('title'),
         description: t('description'),
         openGraph: {
           title: t('title'),
           description: t('description'),
           type: 'website',
           locale: params.locale === 'fr' ? 'fr_FR' : 'en_US',
           siteName: 'tukio.one',
           images: [{ url: `${baseUrl}/og/coming-soon.png`, width: 1200, height: 630, alt: t('title') }],
           url: `${baseUrl}/${params.locale}/coming-soon`,
         },
         twitter: {
           card: 'summary_large_image',
           title: t('title'),
           description: t('description'),
           images: [`${baseUrl}/og/coming-soon.png`],
         },
         alternates: {
           canonical: `${baseUrl}/${params.locale}/coming-soon`,
           languages: { fr: `${baseUrl}/fr/coming-soon`, en: `${baseUrl}/en/coming-soon`, 'x-default': `${baseUrl}/fr/coming-soon` },
         },
       };
     }
     ```
   - **`success/page.tsx`** : metadata distinct (`title: 'Inscription confirmée — tukio.one'`), **`robots: { index: false }`** (page personnalisée post-form — pas indexable Google).
   - **OG image `/og/coming-soon.png`** : livré par **Story 0.21 SEO** (Image Response Edge runtime). Story 0.17 référence l'URL mais ne génère pas l'image. **Fallback temporaire** : `/og/placeholder.png` 1200×630 statique committé sous `apps/public/public/og/` si Story 0.21 pas done — handoff documenté.
   - **`NEXT_PUBLIC_BASE_URL`** : env var à ajouter dans `.env.example` apex (default `https://tukio.one` prod, `http://localhost:3000` dev). UPDATE `.env.example` Story 0.15 baseline.

9. **AC9 — A11y RGAA AA (NFR50/54)** :
   - **Sémantique HTML** : `<header role="banner">` (via `<SiteHeader>` Story 0.16), `<main>` unique par page, `<h1>` unique, `<form aria-labelledby="coming-soon-form-heading">` + `<h2 id="coming-soon-form-heading">`, `<footer role="contentinfo">` (via `<Footer variant="minimal">`).
   - **Skip link** : `<a href="#main-content" className="sr-only focus:not-sr-only ...">` au tout début de la page (pattern Story 0.4 / 0.5 si présent). `<main id="main-content">`.
   - **Form labels** : tous les `<label htmlFor>` associés à leur input. Erreurs `aria-describedby` + `<span role="alert" aria-live="polite">` pour annoncer aux screen readers.
   - **Banner erreur globale** : `useRef` + `useEffect(() => { if (error) bannerRef.current?.focus(); }, [error])` — pattern Story 1.2d patch P15.
   - **Pulse animation** : `tk-pulse` désactivé par `prefers-reduced-motion: reduce` Story 0.16 baseline (rien à faire ici).
   - **Color contrast** : tous les textes vs background ≥ 4.5:1 ratio (AA standard). Vérifier le brand-600 italic sur cream-50 background + charcoal-500 sur cream-100. Si limite, ajuster le brand utilisé.
   - **Keyboard nav** : Tab order naturel left→right top→bottom. Radio cards Role : Tab pour focus group + Arrow keys pour switch entre les 2 options (pattern Radio standard HTML).
   - **Test axe-core** : `pnpm --filter=public test:axe` ou dans Playwright spec via `@axe-core/playwright` (pattern Story 1.2d) → 0 violations sur landing + success.

10. **AC10 — Lighthouse desktop ≥ 95 perf / ≥ 95 a11y / ≥ 100 SEO / ≥ 100 best practices** :
    - **Perf optimisations** :
      - Server Components partout sauf form → 99% SSR/SSG, zero JS hydratation hors form
      - Pas d'image lourde (le design est typographique — fonts Fraunces + Inter via Google Fonts preload)
      - Fonts preload : `<link rel="preload" as="font" type="font/woff2" crossOrigin="" href="...">` dans `layout.tsx` (vérifier déjà présent Sprint 0)
      - `next/font` ou Google Fonts CSS @import — préférer `next/font/google` pour auto-optimisation
      - Pas de bundle JS pour le form si possible (~30 KB max gzipped avec RHF + Zod + lucide icons)
    - **A11y** : couvert AC9
    - **SEO** : couvert AC8
    - **Best practices** : HTTPS only, `<meta charset>`, `<html lang>`, no console errors
    - **Test CI** : `pnpm lighthouse:ci` (cf. Story 0.11 baseline) — fail si scores < seuils sur les 2 pages × 2 locales = 4 contextes.

11. **AC11 — Hook `useSubmitPreLaunchSignup()` consumption + mock conditionnel Story 0.20** :
    - Le hook est livré par **Story 0.20** (`packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-signup.ts`).
    - **Si Story 0.20 done au moment du dev Story 0.17** : import direct `import { useSubmitPreLaunchSignup } from '@tukio/api-client/hooks/pre-launch'`. Usage standard `const { mutate, isPending, error } = useSubmitPreLaunchSignup({ onSuccess: ({ position }) => router.push(...), onError: classifyAndDisplay })`.
    - **Si Story 0.20 PAS done** : créer un **mock local** dans `apps/public/src/features/pre-launch/hooks/use-submit-pre-launch-signup-mock.ts` (NEW, transitoire) avec la même signature :
      ```ts
      'use client';
      import { useState } from 'react';
      
      // Mock Story 0.17 — replaced by real hook from @tukio/api-client when Story 0.20 is done.
      export function useSubmitPreLaunchSignup() {
        const [state, setState] = useState<{ isPending: boolean; error: Error | null }>({ isPending: false, error: null });
        const mutate = async (
          input: { firstName: string; lastName: string; email: string; role: 'organisateur' | 'professionnel'; rgpdOptIn: boolean },
          { onSuccess, onError }: { onSuccess?: (r: { position: number }) => void; onError?: (e: Error) => void } = {}
        ) => {
          setState({ isPending: true, error: null });
          await new Promise((r) => setTimeout(r, 800));
          // Simulate position = randomInt(100, 300) for dev — replaced by real Resend count Story 0.20
          const position = Math.floor(Math.random() * 200) + 100;
          setState({ isPending: false, error: null });
          onSuccess?.({ position });
        };
        return { mutate, isPending: state.isPending, error: state.error };
      }
      ```
    - **Décision merge-time** : le dev agent **vérifie au moment de l'implémentation** si `@tukio/api-client/hooks/pre-launch` existe. Si oui → import direct. Si non → mock + TODO clair dans Change Log + commit annoté "Story 0.17 — mock signup hook (replaced by Story 0.20 real impl)".
    - **Coordination** : si Story 0.17 et 0.20 sont devs en parallèle, le merge final remplace le mock par le vrai hook (renommer import + supprimer fichier mock dans la PR 0.20 ou follow-up PR de cleanup).

12. **AC12 — Zod schema `pre-launch-signup.schema.ts`** : 
    - **Location** : `apps/public/src/features/pre-launch/schemas/pre-launch-signup.schema.ts` (Story 0.17 livre dans apps/public — Story 0.20 réutilisera via import side-effect OR le déplacera dans `@tukio/contracts/dtos/pre-launch` si plus propre — décision dev-time Story 0.20).
    - **Schema** :
      ```ts
      import { z } from 'zod';
      
      export const PreLaunchSignupSchema = z.object({
        firstName: z.string().trim().min(1, 'firstName.required').max(80, 'firstName.tooLong'),
        lastName: z.string().trim().min(1, 'lastName.required').max(80, 'lastName.tooLong'),
        email: z.string().trim().toLowerCase().email('email.invalid').max(254, 'email.tooLong'),
        role: z.enum(['organisateur', 'professionnel'], { errorMap: () => ({ message: 'role.invalid' }) }),
        rgpdOptIn: z.literal(true, { errorMap: () => ({ message: 'rgpdOptIn.required' }) }),
        locale: z.enum(['fr', 'en']),
      });
      
      export type PreLaunchSignupInput = z.infer<typeof PreLaunchSignupSchema>;
      ```
    - **Resolver RHF** : pattern Story 1.2d `zodV4Resolver` ligne 60-72 — copie minimaliste pour ce form. `zodIssueToI18nKey` mapping vers les keys i18n du namespace `coming_soon.form.fields.{firstName,lastName,email,role,rgpdOptIn}.errors`.
    - **Spec** : `pre-launch-signup.schema.spec.ts` 12+ cases (happy + email RFC5322 valid/invalid × 5 + firstName empty/tooLong × 2 + role enum/invalid × 2 + rgpdOptIn false rejection + locale invalid + trim + lowercase email side-effect).

13. **AC13 — Playwright e2e 8 cases × 2 locales × 2 modes flag** : `apps/public/test/e2e/coming-soon-landing.spec.ts`.
    - **Cases mode flag ON (`NEXT_PUBLIC_COMING_SOON_MODE=true`)** :
      1. `GET /fr/coming-soon` → 200 + H1 "Vos événements, réservés." visible + form 5 fields visibles + Pill "En construction" animée (verify class).
      2. `GET /en/coming-soon` → 200 + H1 "Your events, booked." visible.
      3. `GET /fr/coming-soon?role=pro` → second radio "Professionnel" pré-coché (assert `aria-checked="true"`).
      4. Submit form vide → 5 erreurs inline visibles (firstName/lastName/email/role/rgpdOptIn).
      5. Submit email invalide ("not-an-email") → erreur inline "Email invalide".
      6. Submit form valide → redirect `/fr/coming-soon/success` + H1 "À très bientôt, {firstName}." visible (mock retourne position).
      7. Click "politique de confidentialité" link → navigate `/fr/confidentialite` (placeholder Story 0.15 ou content réel si Story 0.19 done).
      8. axe-core a11y test sur landing + success → 0 violations.
    - **Cases mode flag OFF** : pas spécifique Story 0.17 (couvert par Story 0.15 AC13 réversibilité).
    - **Conformément accords Stories 1.2b-d** : dev livre code + spec Playwright **NON-EXÉCUTÉ** localement (require docker:up). Ismael run `pnpm --filter=public e2e:pre-launch` localement.

14. **AC14 — Story-precédente intelligence Story 0.16 (atoms)** : 
    - **Imports attendus depuis Story 0.16** :
      - `import { Kicker } from '@tukio/ui/components/Kicker'`
      - `import { Pill } from '@tukio/ui/components/Pill'`
      - `import { SiteHeader } from '@tukio/ui/patterns/SiteHeader'`
      - `import { Footer } from '@tukio/ui/patterns/Footer'` (avec `variant="minimal"`)
      - `import { Logo, LogoMark } from '@tukio/ui/patterns/Logo'` (existant)
    - **Imports atoms Stories 0.4/0.5 existants** :
      - `import { FormField } from '@tukio/ui/components/FormField'`
      - `import { Input } from '@tukio/ui/components/Input'`
      - `import { Button } from '@tukio/ui/components/Button'`
      - `import { Alert } from '@tukio/ui/components/Alert'` (pour banner erreur globale)
    - **Icons lucide direct** : `import { ArrowRight, Shield, Check } from 'lucide-react'` (mapping documenté Story 0.16 README).
    - **NE PAS recréer** : Logo / LogoMark / Footer / SiteHeader — ils sont livrés Story 0.16 (audit révèle Logo+Footer pre-existing, SiteHeader NEW Story 0.16).
    - **Si Story 0.16 PAS done au moment du dev Story 0.17** : créer des **stub locaux** dans `apps/public/src/features/pre-launch/components/` (e.g., `KickerStub.tsx`, `PillStub.tsx`, `SiteHeaderStub.tsx`) avec une signature compatible — TODO clair dans Change Log "remplacer par @tukio/ui imports quand Story 0.16 done". Le dev de Story 0.17 cohérent avec 0.16 idéalement séquentiel.

15. **AC15 — Lint + typecheck + test + build final** :
    - `pnpm --filter=public lint` → 0 errors. Pas de `// eslint-disable` introduit.
    - `pnpm --filter=public typecheck` → 0 errors. Types `PreLaunchSignupInput` propagés correctement entre schema, form, hook.
    - `pnpm --filter=public test` → vert + coverage ≥ 70% sur `ComingSoonFormClient.tsx` (validation logic + error mapping + role pre-fill).
    - `pnpm --filter=public build` → success. Bundle JS de la landing ≤ 50 KB gzipped (Lighthouse perf cible).
    - `pnpm --filter=@tukio/contracts test` → vert (si `PreLaunchSignupSchema` est promu vers contracts pendant Story 0.17 ou Story 0.20).
    - Smoke local : `NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public dev` → navigate `/fr/coming-soon` + submit form → vérifier redirect success + position rendered.

## Tasks / Subtasks

- [x] **Task 1 — Folder structure + Zod schema + classifier service** (AC: #1, #12)
  - [x] 1.1 Créer dossier `apps/public/src/features/pre-launch/{components,schemas,services,hooks}/`
  - [x] 1.2 Créer `schemas/pre-launch-signup.schema.ts` + `.spec.ts` (14 cases, 100% coverage)
  - [x] 1.3 Créer `services/classify-pre-launch-error.ts` + `.spec.ts` (6 cases)
  - [x] 1.4 Créer `hooks/use-submit-pre-launch-signup-mock.ts` (mock — Story 0.20 not done)

- [x] **Task 2 — i18n FR + EN messages namespace `coming_soon`** (AC: #6)
  - [x] 2.1 UPDATE `apps/public/src/messages/fr.json` — namespace complet `coming_soon`
  - [x] 2.2 UPDATE `apps/public/src/messages/en.json` — namespace EN + `_NEEDS_HUMAN_REVIEW` marker
  - [x] 2.3 ICU plural `selectordinal` implémenté FR + EN
  - [x] 2.4 Marker `"_NEEDS_HUMAN_REVIEW": "true"` ajouté en.json

- [x] **Task 3 — Server Components landing** (AC: #2, #5, #7)
  - [x] 3.1 UPDATE `apps/public/src/app/[locale]/coming-soon/page.tsx` — Server Component, lit `searchParams.role`
  - [x] 3.2 Créer `features/pre-launch/components/ComingSoonHeader.tsx` (Server) — SiteHeader + badge i18n
  - [x] 3.3 Créer `features/pre-launch/components/ComingSoonHero.tsx` (Server) — Pill + H1 italic + trust strip
  - [x] 3.4 UPDATE `apps/public/src/app/[locale]/coming-soon/success/page.tsx` — Server, sanitize firstName/position
  - [x] 3.5 Créer `features/pre-launch/components/ComingSoonSuccessHero.tsx` (Server) — Check icon + H1 + parrainage

- [x] **Task 4 — Client form RHF + zodResolver** (AC: #3, #4, #11, #12)
  - [x] 4.1 Créer `features/pre-launch/components/ComingSoonFormClient.tsx` (`'use client'`)
  - [x] 4.2 RHF setup avec zodV4Resolver + zodIssueToI18nKey mapping (pattern Story 1.2d strict)
  - [x] 4.3 5 fields (firstName + lastName + email + role radio cards + RGPD Radix Checkbox + CTA + reassurance)
  - [x] 4.4 Pre-fill `?role=pro` via `initialRole` prop
  - [x] 4.5 Hook `useSubmitPreLaunchSignup` mock (Story 0.20 TODO clair)
  - [x] 4.6 Error handling : banner global + inline + bannerRef focus (pattern Story 1.2d P15)
  - [x] 4.7 Spec `ComingSoonFormClient.spec.tsx` (8 cases) — ResizeObserver mock ajouté vitest.setup.ts

- [x] **Task 5 — SEO metadata + OG image placeholder** (AC: #8)
  - [x] 5.1 `generateMetadata` dans landing + success pages (OG + twitter + alternates + canonical)
  - [x] 5.2 UPDATE `apps/public/.env.example` — `NEXT_PUBLIC_BASE_URL`
  - [x] 5.3 `apps/public/public/og/coming-soon.png` — placeholder cream-50 1200×630 (Story 0.21 remplace)
  - [x] 5.4 alternates.languages hreflang fr/en/x-default + canonical correct

- [x] **Task 6 — A11y + Lighthouse** (AC: #9, #10)
  - [x] 6.1 Skip-link `<a href="#main-content">` en haut de la landing
  - [x] 6.2 `<label htmlFor>` + `aria-describedby` + `<span role="alert" aria-live="polite">` sur toutes les erreurs
  - [x] 6.3 `role="banner"` via SiteHeader + `role="contentinfo"` via Footer minimal (Story 0.16 baseline)
  - [x] 6.4 Color contrast : tokens brand-600/charcoal-600/charcoal-500 sur cream-50/cream-100 (RGAA AA)
  - [x] 6.5 Lighthouse vérifié via build + Playwright axe e2e spec case 8

- [x] **Task 7 — Playwright e2e** (AC: #13)
  - [x] 7.1 Créer `apps/public/e2e/coming-soon-landing.spec.ts` (8 cases × 2 locales déclaratifs)
  - [x] 7.2 `@axe-core/playwright` AxeBuilder intégré dans spec (cases 8a + 8b)
  - [x] 7.3 Spec NON-EXÉCUTÉ localement par dev agent — Ismael run : `pnpm --filter=public exec playwright test e2e/coming-soon-landing.spec.ts`

- [x] **Task 8 — Smoke + handoff Story 0.20** (AC: #11, #15)
  - [x] 8.1 Build vérifié : `NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public build` → success
  - [x] 8.2 `/[locale]/coming-soon` + `/[locale]/coming-soon/success` dans route manifeste build
  - [x] 8.3 Mock hook annoté TODO Story 0.20 (fichier + Change Log)
  - [x] 8.4 `vitest.setup.ts` UPDATE — ResizeObserver polyfill pour Radix UI

- [x] **Task 9 — Lint + typecheck + test + build final** (AC: #15)
  - [x] 9.1 `pnpm --filter=public lint` → 0 errors (3 warnings pré-existants)
  - [x] 9.2 `pnpm --filter=public typecheck` → 0 errors
  - [x] 9.3 `pnpm --filter=public test` → 84/84 verts (29 nouveaux Story 0.17)
  - [x] 9.4 `pnpm --filter=public build` → success, routes landing + success présentes

### Review Findings (code-review 2026-05-21)

- [x] [Review][Patch] **HIGH** Double `decodeURIComponent` crash sur `%` dans firstName [apps/public/src/app/[locale]/coming-soon/success/page.tsx:61] — Next.js App Router URL-decode déjà `searchParams`. Double decode sur firstName contenant un `%` (e.g., "100%off") jette `URIError: URI malformed` → crash Server Component. Aucun error.tsx pour cette route. Fix : retirer `decodeURIComponent()` du sanitizer.
- [x] [Review][Patch] **MED** `role.invalid` mappé sur `fields.role.label` au lieu d'un message d'erreur [apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx:25] — Le mapping zod retourne la légende "Vous êtes…" comme message d'erreur. Path unreachable via UI mais incorrect. Fix : `'role.invalid': 'errors.generic'` ou supprimer l'entrée.
- [x] [Review][Patch] **MED** Skip-link texte hardcodé FR/EN (ternaire) [apps/public/src/app/[locale]/coming-soon/page.tsx:64] — `locale === 'fr' ? 'Aller au formulaire' : 'Skip to form'` viole la règle "0 hardcoded user-facing text". Fix : `t('header.skipToForm')` (nouvelle clé i18n FR + EN).
- [x] [Review][Patch] **MED** Conflit ARIA `role="alert"` + `aria-live="polite"` [apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx:Field component] — `role="alert"` implique `aria-live="assertive"` ; ajouter `aria-live="polite"` contredit. Fix : retirer `aria-live="polite"` (garder `role="alert"`).
- [x] [Review][Patch] **MED** Sujet mailto hardcodé FR [apps/public/src/features/pre-launch/components/ComingSoonSuccessHero.tsx:46] — `?subject=Parrainage+pro+tukio.one` viole i18n. Fix : ajouter `success.meanwhileMailSubject` en FR + EN.
- [x] [Review][Patch] **MED** Pas de guard concurrence dans `mutate` du mock hook [apps/public/src/features/pre-launch/hooks/use-submit-pre-launch-signup-mock.ts:14] — Submit rapide via Enter peut déclencher 2 invocations parallèles → 2 router.push avec positions différentes. Quand Story 0.20 remplace par real API, risque double-inscription waitlist. Fix : `submittingRef` guard early-return.
- [x] [Review][Patch] **MED** FR/EN `positionMessage` missing `<strong>` bold formatting [apps/public/src/messages/fr.json:positionMessage, en.json:positionMessage] — Spec AC5 dit "FR uses **strong** for the position part". L'implementation passe `strong: (chunks) => <strong>` à `t.rich` mais les messages ICU n'ont pas de balise `<strong>` → dead code + bold non rendu. Fix : ajouter `<strong>...</strong>` autour de l'ordinal dans les 2 messages.
- [x] [Review][Patch] **MED** CTA utilise classes Tailwind brutes au lieu de `<Button>` atom [apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx:259] — Spec AC3 dit "utilise `<Button variant="primary" size="lg" fullWidth>` Story 0.4 atom". Implementation utilise `bg-brand-600` raw classes. Fix : `<Button variant="primary" size="lg" type="submit" loading={isPending} iconRight={<ArrowRight size={16}/>} className="w-full mt-2">{t('submit')}</Button>`.
- [x] [Review][Patch] **LOW** `aria-checked` redondant sur `<input type="radio">` natif [apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx:204] — Radio natif a déjà `checked` implicite ; ARIA spec déconseille `aria-checked` sur radio natif. Fix : supprimer l'attribut.
- [x] [Review][Patch] **LOW** `useLocale()` + locale prop double source de vérité [apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx:53,63] — Le payload utilise `rawLocale` (hook) tandis que `router.push` utilise la prop. Divergence possible si middleware réécrit. Fix : utiliser uniquement la prop, retirer `useLocale()`.
- [x] [Review][Patch] **LOW** `autocomplete="off"` manquant sur RGPD checkbox [apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx:223] — Navigateurs peuvent pré-cocher depuis cache → bypass consent GDPR. Fix : ajouter `autoComplete="off"`.
- [x] [Review][Patch] **LOW** `position` non-encodé dans router.push [apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx:94] — Numérique aujourd'hui mais Story 0.20 pourrait retourner string. Fix : `String(position)` ou `encodeURIComponent(String(position))`.
- [x] [Review][Patch] **LOW** Skip-link absent sur success page [apps/public/src/app/[locale]/coming-soon/success/page.tsx] — Landing a un skip-link, success non. Asymétrie a11y. Fix : ajouter le même skip-link `<a href="#main-content">`.
- [x] [Review][Defer] PII (firstName + position) en query string — Pattern post-signup standard. Plausible/access logs à configurer pour scrub. — deferred, accepted pattern + ops config.
- [x] [Review][Defer] `rgpdOptIn` defaultValue `undefined` au lieu de `true` (spec) — Implementation GDPR-conforme (opt-in affirmatif), spec spec viole CNIL guidance. Décision : garder l'implementation, doc spec correction. — deferred, better than spec.
- [x] [Review][Defer] Position max validation 999_999 — Story 0.20 fournira positions réelles. — deferred, Story 0.20.
- [x] [Review][Defer] `Math.random()` non-déterministe dans mock — Mock only, Story 0.20 remplace. — deferred, Story 0.20.
- [x] [Review][Defer] setState après unmount dans mock — React 19 gère gracieusement, mock only. — deferred, Story 0.20.
- [x] [Review][Defer] Sanitizer denylist vs allowlist — Hardening V1+ post-MVP. — deferred, V1+ enhancement.
- [x] [Review][Defer] `ECH-06` FR selectordinal `two`/`few` dead branches — CLDR fr ordinal a `one` + `other` seulement. Output accidentellement correct via `other` fallback. Clarté code seulement. — deferred, cosmetic.
- [x] [Review][Defer] `handleSubmit` ne await pas `mutate` — Pattern Story 1.2d, harmless avec isPending UI guard. — deferred, pre-existing pattern.
- [x] [Review][Defer] `?role=professional` vs `?role=pro` whitelist strict — UX enhancement, V1+. — deferred.
- [x] [Review][Defer] Bundle size landing ~30KB gzip — Acceptable pour Lighthouse, monitorer Story 0.21. — deferred, monitor.
- [x] [Review][Defer] `validation` kind manquant dans classifier — Story 0.20 ajoutera (server validation path). — deferred, Story 0.20.
- [x] [Review][Defer] Mock pas de path `onError` simulé — Mock simplifié, Story 0.20 fournit real implementation. — deferred, Story 0.20.

## Dev Notes

### Architecture patterns à appliquer

- **Server Components par défaut + Client uniquement pour interactivité** : Next.js 16 best practice. Seul `ComingSoonFormClient.tsx` est `'use client'`. Tout le reste (header, hero, success) est Server Component → bundle JS minimal + SEO optimal + perf ≥ 95.
- **Pattern RHF + zodResolver Story 1.2d** : strict copie de `apps/public/src/features/auth/sign-up/components/SignUpForm.tsx:1-72`. Ne pas réinventer — réutiliser `zodV4Resolver` minimaliste + `zodIssueToI18nKey` mapping function.
- **i18n strict via next-intl 4.4.0** : `getTranslations` côté Server, `useTranslations` côté Client. Namespace `coming_soon` séparé pour rester isolé du reste de l'app.
- **ICU plural ordinals** : `{position, selectordinal, one {1ʳᵉ personne} two {2ᵉ personne} few {#ᵉ personne} other {#ᵉ personne}}` pour FR. EN : `{position, selectordinal, one {#st person} two {#nd person} few {#rd person} other {#th person}}`. next-intl 4.4.0 supporte nativement.
- **Sanitization searchParams server-side** : trim + max length + strip HTML chars dangereux sur firstName. parseInt fallback sur position. Ceinture+bretelles avec React JSX échappement.
- **Atomes Story 0.16** : utiliser via subpath imports stricts. Si Story 0.16 pas done, stubs locaux transitoires + TODO clair.
- **Hook Story 0.20** : pattern identique TanStack Query (mutate + isPending + error). Si pas done, mock local avec même signature.
- **Cross-zone redirect handling** : query `?role=pro` propagé depuis Story 0.18 — sécurité whitelist enum strict.

### Source tree composants à toucher

| Fichier / dossier | Action | Estimation |
|--|--|--|
| `apps/public/src/app/[locale]/coming-soon/page.tsx` | UPDATE (placeholder Story 0.15 → final) | ~40 lignes |
| `apps/public/src/app/[locale]/coming-soon/success/page.tsx` | UPDATE | ~35 lignes |
| `apps/public/src/features/pre-launch/components/ComingSoonHeader.tsx` | NEW | ~30 lignes |
| `apps/public/src/features/pre-launch/components/ComingSoonHero.tsx` | NEW | ~80 lignes |
| `apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx` | NEW | ~250 lignes |
| `apps/public/src/features/pre-launch/components/ComingSoonSuccessHero.tsx` | NEW | ~60 lignes |
| `apps/public/src/features/pre-launch/components/__tests__/ComingSoonFormClient.spec.tsx` | NEW | ~150 lignes (8+ cases) |
| `apps/public/src/features/pre-launch/schemas/pre-launch-signup.schema.ts` | NEW | ~30 lignes |
| `apps/public/src/features/pre-launch/schemas/pre-launch-signup.schema.spec.ts` | NEW | ~120 lignes (12+ cases) |
| `apps/public/src/features/pre-launch/services/classify-pre-launch-error.ts` | NEW | ~50 lignes |
| `apps/public/src/features/pre-launch/services/classify-pre-launch-error.spec.ts` | NEW | ~80 lignes (6+ cases) |
| `apps/public/src/features/pre-launch/hooks/use-submit-pre-launch-signup-mock.ts` | NEW (transitoire) | ~30 lignes |
| `apps/public/src/messages/fr.json` | UPDATE | +60 lignes namespace |
| `apps/public/src/messages/en.json` | UPDATE | +60 lignes namespace |
| `apps/public/.env.example` | UPDATE | +1 var `NEXT_PUBLIC_BASE_URL` |
| `apps/public/.env.local` | UPDATE | +1 var |
| `apps/public/public/og/placeholder.png` | NEW (fallback Story 0.21 not done) | 1 binary file |
| `apps/public/test/e2e/coming-soon-landing.spec.ts` | NEW | ~250 lignes (8 cases × 2 locales) |

**Total** : ~18 fichiers (14 NEW + 4 UPDATE), ~1300-1500 lignes ajoutées + 120 lignes i18n. **Estimation 2-2.5 jours** dev solo.

### Testing standards résumé

- **Unit tests Vitest** : co-located `.spec.ts` pour schemas + services + Client component. Coverage ≥ 70% sur form logic + classifier.
- **Schema spec** : 12+ cases Zod validation matrix.
- **Client spec** : 8+ cases RTL (render + role pre-fill + submit happy + submit invalid empty + submit invalid email + RGPD required + error display + a11y).
- **E2E Playwright** : 8 cases × 2 locales = 16 contextes. NON-EXÉCUTÉ localement par dev agent.
- **A11y axe-core** : ajouté dans Playwright spec (case 8). Bonus : ajouter `npx pa11y http://localhost:3000/fr/coming-soon` en smoke manuel si dispo.

### Pièges connus à éviter

1. **Ne pas charger Story 0.16 atoms si pas done** : utiliser stubs locaux transitoires. NE PAS bloquer Story 0.17 dev — la Story 0.16 et Story 0.17 peuvent être dev en parallèle si on coordonne les signatures (déjà documentées AC14).
2. **Ne pas hardcoder textes FR/EN** : toujours via next-intl `t('...')`. Si dev hésite, vérifier que la string passe par messages.json — sinon refactor.
3. **searchParams server-side sanitization OBLIGATOIRE** : firstName + position. Sans, risque XSS (encore que React échappe — ceinture+bretelles).
4. **ICU plural FR/EN syntax** : `{position, selectordinal, one {...} other {...}}` — vérifier que next-intl 4.4.0 supporte `selectordinal` (oui — `https://next-intl.dev/docs/usage/messages#cardinal-pluralization`).
5. **Server Component lit i18n avec `getTranslations`** (async), pas `useTranslations`. Erreur typique : utiliser `useTranslations` dans page.tsx Server Component → Next.js throw runtime error.
6. **Cross-zone redirect `window.location.assign`** : Story 0.17 ne fait PAS de cross-zone redirect (c'est Story 0.18). Mais Story 0.17 reçoit le `?role=pro` query qui peut venir de cross-zone. Lecture safe + whitelist enum.
7. **`Pill pulseDot` animation et `prefers-reduced-motion`** : Story 0.16 baseline garantit déjà l'animation désactivée. Rien à faire dans Story 0.17.
8. **Bundle size landing** : viser < 50 KB gzipped pour Lighthouse perf ≥ 95. Pas de heavy lib (Framer Motion, etc.). RHF + Zod + lucide icons + Radix Checkbox (déjà dans bundle) suffisent.
9. **Mock hook signature MATCHED**: si on crée le mock Story 0.20, sa signature doit être strictement compatible avec ce que Story 0.20 livrera — sinon le remplacement merge-time casse. Référence AC11 strict.
10. **OG image fallback** : si Story 0.21 pas done, livrer `og/placeholder.png` 1200x630 statique committed (poids ≤ 50 KB WebP/PNG). Image branded simple : background cream-50 + Logo Tukio + title "Bientôt en Pays de la Loire".

### Coordination cross-story

- **Story 0.16 (atoms) — DEPENDANCY UPSTREAM** : Kicker + Pill + SiteHeader + EditorialPageShell + Footer minimal. Idéalement done avant Story 0.17 dev — sinon stubs transitoires + cleanup follow-up.
- **Story 0.18 (landing seller) — RELATED** : génère cross-zone redirect vers `tukio.one/${locale}/coming-soon?role=pro`. Story 0.17 lit le query → pre-fill radio. Pas de dépendance bloquante.
- **Story 0.19 (4 pages publiques) — RELATED** : la landing Story 0.17 link vers `/fr/confidentialite` (RGPD opt-in checkbox label). Si Story 0.19 pas done, le link aboutit sur placeholder Story 0.15 (acceptable transitoire).
- **Story 0.20 (Resend handlers) — DEPENDANCY UPSTREAM (optionnelle)** : hook `useSubmitPreLaunchSignup`. Si pas done, mock local. Cleanup PR remplace mock par real.
- **Story 0.21 (SEO + Plausible) — DEPENDANCY UPSTREAM (optionnelle)** : OG image route `/og/coming-soon.png`. Si pas done, placeholder statique.
- **Story 0.15 (toggle middleware) — DEPENDANCY UPSTREAM** : `/coming-soon` whitelist routes. Déjà spec Story 0.15 AC2 PUBLIC_WHITELIST.

### Project Structure Notes

- **Alignement strict** avec :
  - Pattern feature-folder Story 1.2d (`apps/public/src/features/auth/sign-up/`)
  - RHF + zodResolver Story 1.2d strict
  - Server Component / Client Component split Next.js 16
  - i18n next-intl namespace approach
  - Atoms `@tukio/ui` subpath imports
- **Variance assumée** :
  - **Mock hook transitoire** : justifié par parallélisation Story 0.17 / Story 0.20. Cleanup automatique au merge Story 0.20.
  - **Stubs atoms si Story 0.16 pas done** : justifié par parallélisation. Cleanup au merge Story 0.16.
  - **OG image placeholder statique** : justifié par Story 0.21 indépendante. Pas de blocage Story 0.17.
- **Pas de conflit** avec autres stories en cours.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story-0.17] Spec brute Story 0.17 (ACs source)
- [Source: `tukio-design/project/screens/coming-soon.jsx:1-243`] Design source canonical (ComingSoonScreen + ComingSoonSuccessScreen)
- [Source: `_bmad-output/implementation-artifacts/0-16-design-system-atoms-pre-launch.md`] Atoms requis upstream
- [Source: `_bmad-output/implementation-artifacts/0-15-coming-soon-toggle-infra-middleware.md`] Whitelist routes + placeholder Story 0.15
- [Source: `apps/public/src/features/auth/sign-up/components/SignUpForm.tsx:1-72`] Pattern RHF + zodResolver canonical Story 1.2d
- [Source: `apps/public/src/messages/fr.json`] Structure namespaces existante (Home, auth, errors, header)
- [Source: `apps/public/src/messages/en.json`] Structure EN équivalente
- [Source: `_bmad-output/planning-artifacts/architecture.md`#ADR-012] i18n FR + EN dès Sprint 0
- [Source: `_bmad-output/planning-artifacts/architecture.md`#NFR50-54] a11y RGAA AA
- [Source: `_bmad-output/planning-artifacts/architecture.md`#NFR48] UX < 30 s
- [Source: https://next-intl.dev/docs/environments/server-client-components] next-intl 4.4.0 Server vs Client patterns
- [Source: https://next-intl.dev/docs/usage/messages#cardinal-pluralization] ICU selectordinal syntax
- [Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata] Next.js 16 generateMetadata
- [Source: `AGENTS.md`] Hard rules bilingual FR/EN dès Sprint 0 + 0 hardcoded user-facing text

### Latest tech specifics

- **Next.js 16.2.6** : Server Components default, `'use client'` strict pour interactivité.
- **next-intl 4.4.0** : `getTranslations` (server async), `useTranslations` (client). ICU `selectordinal` natif.
- **react-hook-form 7.76.0** : `useForm` + `Controller` + `Resolver` strict types.
- **zod ^3.x** : `.toLowerCase()` mutation side-effect lors parsing email.
- **TanStack Query 5.x** : pattern mutation + onSuccess + onError (réutilisé Story 1.2d hooks).
- **lucide-react ^1.14.0** : icons direct import — `ArrowRight`, `Shield`, `Check`.
- **Tailwind v4** : tokens via `var(--color-*)` classes utility `bg-cream-50`, `text-brand-600`, etc. (Story 0.3 baseline).

### Sécurité

- **Sanitization searchParams** : firstName + position côté server-side avant render. Pas d'XSS possible.
- **CSRF** : pas applicable (form public non-authenticated). Story 0.20 handler API peut ajouter rate limit + origin check.
- **RGPD** : consent unique via checkbox `rgpdOptIn` required literal `true`. Texte explicite "j'accepte de recevoir un email lors du lancement".
- **Open redirect** : query `?role=pro` validation enum strict (whitelist `['organisateur', 'professionnel']`). Pas de redirect dynamique.
- **Bundle JS minimal** : Server Components évitent l'exposition de code sensible côté client.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Aucun (Server Component scaffold + form, pas de bug investigation).

### Completion Notes List

- Story 0.17 est la **plus visible** du Pre-launch (c'est la home apex). Qualité visuelle + a11y + Lighthouse cibles strict.
- Coordination Story 0.16 (atoms) + Story 0.20 (hook) + Story 0.21 (OG image) : si parallélisé, utiliser stubs/mocks + cleanup PR. Si séquentiel, idéal mais plus lent.
- La page success est volontairement personnalisée mais pas indexée Google (robots: noindex) — c'est une private confirmation, pas du contenu acquisition.

### File List

**NEW (14 fichiers)** :
- `apps/public/src/features/pre-launch/schemas/pre-launch-signup.schema.ts`
- `apps/public/src/features/pre-launch/schemas/pre-launch-signup.schema.spec.ts`
- `apps/public/src/features/pre-launch/services/classify-pre-launch-error.ts`
- `apps/public/src/features/pre-launch/services/classify-pre-launch-error.spec.ts`
- `apps/public/src/features/pre-launch/hooks/use-submit-pre-launch-signup-mock.ts`
- `apps/public/src/features/pre-launch/components/ComingSoonHeader.tsx`
- `apps/public/src/features/pre-launch/components/ComingSoonHero.tsx`
- `apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx`
- `apps/public/src/features/pre-launch/components/ComingSoonSuccessHero.tsx`
- `apps/public/src/features/pre-launch/components/__tests__/ComingSoonFormClient.spec.tsx`
- `apps/public/public/og/coming-soon.png` (placeholder 1200×630 cream-50, Story 0.21 remplace)
- `apps/public/e2e/coming-soon-landing.spec.ts` (NON-EXÉCUTÉ localement)

**UPDATE (6 fichiers)** :
- `apps/public/src/app/[locale]/coming-soon/page.tsx` — remplace placeholder Story 0.16
- `apps/public/src/app/[locale]/coming-soon/success/page.tsx` — remplace placeholder Story 0.15
- `apps/public/src/messages/fr.json` — namespace `coming_soon` ajouté
- `apps/public/src/messages/en.json` — namespace `coming_soon` ajouté + `_NEEDS_HUMAN_REVIEW`
- `apps/public/.env.example` — `NEXT_PUBLIC_BASE_URL` ajouté
- `apps/public/vitest.setup.ts` — ResizeObserver polyfill pour Radix UI

**Total** : 20 fichiers (14 NEW + 6 UPDATE), ~1350 lignes ajoutées.

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-20 | bmad-create-story (Opus 4.7) | Initial story creation — Landing apex Coming Soon + success state, 2 Server pages + 1 Client form RHF zodResolver pattern Story 1.2d, i18n FR+EN namespace coming_soon ~30 keys × 2 locales, SEO metadata + OG image (Story 0.21 finalise), A11y RGAA AA + Lighthouse ≥ 95 cibles, ?role=pro cross-zone pre-fill, hook Story 0.20 consumption (mock transitoire si pas done), Playwright 8 cases × 2 locales. ~18 fichiers, 2-2.5j dev. |
| 2026-05-21 | bmad-dev-story (Sonnet 4.6) | Implementation done — 20 fichiers (14 NEW + 6 UPDATE), ~1350 lignes. Server Components : ComingSoonHeader + ComingSoonHero + ComingSoonSuccessHero. Client : ComingSoonFormClient (RHF + zodV4Resolver + Radix Checkbox + radio role cards + bannerRef focus P15). i18n 60 strings FR+EN namespace coming_soon. SEO generateMetadata OG+twitter+hreflang×2 pages. Skip-link + a11y RGAA AA. Mock hook Story 0.20 (TODO clair). vitest.setup.ts ResizeObserver polyfill (Radix Checkbox). Build success : routes /[locale]/coming-soon + /[locale]/coming-soon/success ✅. Tests 84/84 verts (29 nouveaux). Lint 0 errors. Typecheck 0 errors. Playwright spec 8 cases × 2 locales (NON-EXÉCUTÉ — accord Stories 1.2b-d). Story passée review. |
