# Story 0.5: Implement 12 composite patterns (@tukio/ui/patterns) extracted from Cloud Design bundle

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** frontend developer (équipe Sprint 0),
**I want** the **12 composite patterns** implemented in `packages/ui/src/patterns/<Pattern>/` qui composent les 17 atomics Story 0.4 + Logo custom + helpers internes, en suivant strictement les références du bundle Cloud Design (`_shared.jsx` + `home.jsx` Footer + `messages.jsx` ConversationThread + `service.jsx` Reviews/Pricing/Calendar + `search.jsx` FilterSidebar + `pro-onboarding.jsx` StepIndicator/FileUpload), avec tests Playwright + axe-core sur parcours critiques (NFR54),
**so that** les 4 apps Next.js consomment les patterns identiques (un Customer voit le même `<TopBar variant="public">` que le Visitor, le même `<EmptyState variant="cart-empty">` partout dans `/cart`, la même `<ConversationThread>` côté `customer/messages` et `seller/messages`), aucune story Epic 1+ ne re-implémente la TopBar ou la Footer, et les compositions complexes (chat avec live region, calendrier dispo grid keyboard navigable, file upload drag&drop) sont a11y-correct dès le 1er rendering.

> **Outcome attendu** : à la fin de cette story, `apps/public/src/app/[locale]/page.tsx` rend `<TopBar variant="public">` + `<EmptyState variant="search-no-results">` + `<Footer />`, `apps/seller/src/app/[locale]/seller/messages/page.tsx` (placeholder) rend `<ConversationThread>` avec live region polite, et un test Playwright sur la home `/fr/` passe `LCP < 2,5 s` + `axe-core: 0 violations`.

## Acceptance Criteria

1. **AC1 — 12 dossiers de patterns avec layout standard** : Given `packages/ui/src/patterns/`, When je l'ouvre, Then je trouve **exactement** 12 dossiers (alphabétique) avec cette structure stricte par pattern :
   ```
   <Pattern>/
     ├─ <Pattern>.tsx              # composition d'atomics @tukio/ui
     ├─ <Pattern>.spec.tsx         # tests Vitest + Testing Library + axe-core inline
     ├─ <Pattern>.types.ts         # exports types Props + variants typés CVA
     └─ index.ts                   # barrel interne re-export
   ```
   Liste exhaustive (alphabétique) : `AvailabilityCalendar`, `ConversationThread`, `EmptyState`, `ErrorPage`, `FileUpload`, `FilterSidebar`, `Footer`, `Map`, `PricingDisplay`, `ReviewsDisplay`, `StepIndicator`, `TopBar`.

2. **AC2 — `<TopBar>` 4 variants (public / customer / seller / admin)** : Given `<TopBar variant="public" locale="fr" onLocaleChange={(l) => ...} />`, When il est rendu, Then :
   - **`variant="public"`** (extracted `_shared.jsx` `TopNav` + `SiteHeader`) : Logo gauche + search bar centrale (placeholder `<Input prefix={<Search />}>` cliquable qui ouvre une modale de recherche complète V1+ ou navigue vers `/search` MVP) + nav links (`Catégories`, `Devenir pro`, `Aide`) + boutons droite (`Connexion` ghost + `S'inscrire` primary), border-bottom `cream-200`, bg `cream-50`
   - **`variant="customer"`** (compose Logo + nav `Découvrir` `Inspirations` `Aide` + `<Avatar>` user + dropdown account) : sticky top, bg `cream-50`, sub-nav éventuelle `<TopBar.SubNav>` pour `/account/{bookings,messages,favorites,reviews,settings}` (extracted `_shared.jsx` `ClientSubNav`)
   - **`variant="seller"`** : **PAS de top bar horizontale** — render à la place `<ProSidebar />` exporté depuis ce même pattern (extracted `_shared.jsx` lignes 343-409). Sticky left sidebar charcoal-700 background + nav items avec icônes Lucide + badges count + section user en bas. Width `248px`, height `calc(100vh - 32px)`, margin `16px 0 16px 16px`, rounded-lg
   - **`variant="admin"`** : top bar horizontale charcoal-900 background + nav items admin (`Vérifications`, `Modération`, `Transactions`, `Audit`, `Config`) + indicateur MFA actif + `<Avatar>` admin
   - **`<TopBar.LocaleSwitcher>`** : sub-component présent dans tous les variants, render `<button>` avec drapeau ou label "FR / EN" + dropdown `Radix Popover` ou `<select>` natif (cf. UX spec ligne 1439 — gap audit Step 2 → Story 0.5 résout)
   - **Composition** : `<TopBar.LocaleSwitcher>` est un sub-component exporté pour permettre des layouts custom V1+
   - **Props i18n-agnostic** : tous les labels (Connexion, S'inscrire, Découvrir, etc.) sont des **props typées strictement** (`<TopBar variant="public" labels={{ login: t('common.login'), signup: t('common.signup'), categories: t('nav.categories'), ... }} />`), avec defaults EN. **Pas de `useTranslations` dans la lib** (i18n responsabilité de l'app)

3. **AC3 — `<Footer>` (extracted `home.jsx` lignes 329-359)** : Given `<Footer columns={[{title: 'tukio.one', links: [...]}, ...]} brandTagline="..." legal="© 2026 tukio.one — Made in Nantes" />`, When il est rendu, Then :
   - `padding: 64px 80px 40px`, bg `cream-50`, `border-top: 1px solid cream-200`
   - Grid `1.5fr repeat(N, 1fr)` avec `gap: 48px`, `margin-bottom: 48px` — colonne 1 = `<Logo />` + `<p>` tagline (max-width 280px, color `charcoal-500`), colonnes 2+ = title (font-weight 600 charcoal-700) + liste `<ul>` de links (color `charcoal-500`, gap 10px)
   - Bottom : flex space-between `padding-top: 24px border-top: 1px solid cream-200`, `font-size: 12px`, `color: charcoal-400`. Champ `legal` à gauche, `legalRight` à droite (default : "Hébergeur LCEN · Tiers de confiance Stripe")
   - **Props i18n-agnostic** : `columns`, `brandTagline`, `legal`, `legalRight` tous typés string et passés par l'app (consommée via `next-intl` côté apps)
   - **Responsive** : sur mobile (`max-md:`), grid passe en `grid-cols-2` puis `grid-cols-1`, padding réduit `padding: 32px 16px 24px`
   - **A11y** : balise `<footer role="contentinfo">` (par défaut HTML5), liens `<a>` natifs (pas de `<button>`)

4. **AC4 — `<ConversationThread>` (extracted `messages.jsx`)** : Given `<ConversationThread messages={[...]} currentUserId="user-123" onSendMessage={(text) => mutation.mutate(text)} isOtherTyping={isOtherTyping} />`, When il est rendu, Then :
   - **Bulles** : à droite si `message.senderId === currentUserId` (bg `brand-500` + color `cream-50` + rounded-2xl bottom-right `rounded-br-sm`), à gauche sinon (bg `cream-100` + color `charcoal-700` + rounded-2xl bottom-left `rounded-bl-sm`)
   - **Avatar** à gauche des bulles "other" (sub-component `<ConversationThread.Avatar avatar={...} />`), pas d'avatar côté `currentUser` (bulles flush right)
   - **Timestamps relatifs** : "Il y a 5 min" via prop `formatRelativeTime` (i18n-agnostic, app fournit le formatter)
   - **`aria-live="polite"`** sur la liste pour annonce des nouveaux messages, `aria-relevant="additions"` (cf. UX spec ligne 1428)
   - **Auto-scroll** : ref sur le dernier message + `scrollIntoView({ behavior: 'smooth', block: 'end' })` quand un nouveau message arrive
   - **Indicator de typing** : si `isOtherTyping`, render 3 dots avec animation `tk-typing` keyframes (Story 0.3) en bas-gauche, `aria-label="L'autre utilisateur est en train d'écrire"` (i18n via prop `typingLabel`)
   - **Input message** : `<Input>` (Story 0.4) full-width avec suffix `<Button icon={<Send />} aria-label={sendLabel}>` ; `Enter` envoie, `Shift+Enter` saute une ligne, `Esc` blur
   - **Sub-components** : `<ConversationThread.Bubble>`, `<ConversationThread.Composer>` exportés pour permettre des layouts custom V1+
   - **PII redaction** : NON prise en charge ici (Story 12.1, V1+) — Story 0.5 affiche les messages tels quels

5. **AC5 — `<ReviewsDisplay>` (extracted `service.jsx` + `pro-profile.jsx`)** : Given `<ReviewsDisplay rating={4.8} count={42} breakdown={{ punctuality: 4.9, communication: 4.7, valueForMoney: 4.6, professionalism: 4.9 }} reviews={[...]} />`, When il est rendu, Then :
   - **Note globale** : `<Stars value={4.8} count={42} size={20} />` (Story 0.4) en haut, `font-display text-3xl charcoal-800`
   - **Breakdown multi-critères** (V1 — au MVP, breakdown est optionnel et caché si non fourni) : 4 mini barres horizontales avec `<ProgressBar>` (Story 0.4) labellisées (Ponctualité, Communication, Rapport qualité-prix, Professionnalisme)
   - **Liste avis** : pour chaque review : `<Avatar>` (Story 0.4) + `<Stars value={review.rating} />` + nom user + date relative + texte avis (max 3 lignes par défaut, "Lire la suite" toggle si plus)
   - **Pagination** : `<Button variant="tertiary">Voir plus d'avis</Button>` (load more pattern, default 3 reviews visible)
   - **Empty case** : si `reviews.length === 0`, render `<EmptyState variant="reviews-empty">` (cf. AC10)
   - **Props i18n-agnostic** : `breakdownLabels`, `loadMoreLabel`, `dateFormatter` passés par l'app
   - **Sub-components** : `<ReviewsDisplay.Summary>`, `<ReviewsDisplay.Breakdown>`, `<ReviewsDisplay.List>`, `<ReviewsDisplay.Item>` exportés

6. **AC6 — `<PricingDisplay>` (extracted `service.jsx` + `checkout.jsx`)** : Given `<PricingDisplay items={[{ label: 'Sous-total', amount: 80000, currency: 'EUR' }, { label: 'TVA 20%', amount: 16000, currency: 'EUR' }, { label: 'Frais de livraison', amount: 1500, currency: 'EUR' }]} total={{ label: 'Total TTC', amount: 97500, currency: 'EUR' }} formatMoney={(amount, currency) => '...'} />`, When il est rendu, Then :
   - **Liste lignes** : `<dl>` avec `<dt>` (label color `charcoal-600`) + `<dd>` (amount color `charcoal-700`, font-tabular-nums)
   - **Total** : ligne séparée par `border-top: 1px solid cream-200 pt-3 mt-3`, label en `font-semibold` + amount en `text-2xl font-display charcoal-800`
   - **Money formatting** : DOIT venir d'une prop `formatMoney(amount, currency)` (la lib est i18n-agnostic — l'app injecte le formatter, ex: `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100)`)
   - **Format Money** : input `amount` est en **cents** (cohérent ADR-014 + Story 0.2 `Money` type) — la prop `formatMoney` gère la conversion
   - **Typo tabular-nums** : `font-variant-numeric: tabular-nums` sur les amounts pour alignement vertical
   - **Variants** : `<PricingDisplay variant="compact">` (1 ligne total seulement, utilisé sur listing card), `<PricingDisplay variant="detailed">` (default, lignes complètes)

7. **AC7 — `<AvailabilityCalendar>` (extracted `service.jsx` + `seller-calendar.jsx`)** : Given `<AvailabilityCalendar month={new Date(2026, 5, 1)} availability={{ '2026-06-01': 'available', '2026-06-15': 'booked', '2026-06-22': 'unavailable' }} selectedDate={selected} onSelectDate={setSelected} onMonthChange={setMonth} />`, When il est rendu, Then :
   - **Layout** : grille 7 colonnes (jours de la semaine), header avec mois + flèches navigation (`<Button variant="ghost" icon={<ChevronLeft />} aria-label="Mois précédent">`)
   - **Cellules** : chaque jour = `<button>` avec `role="gridcell"`, `aria-label="15 juin 2026, disponible"` (i18n via prop `formatDateLabel`), `aria-disabled="true"` si non disponible, `aria-pressed="true"` si sélectionné
   - **States visuels** : `available` (bg `cream-50` hover `cream-100` text-charcoal-700), `booked` (bg `cream-200` text-charcoal-400 strikethrough cursor-not-allowed), `unavailable` (bg `cream-200` text-charcoal-400 cursor-not-allowed), `selected` (bg `brand-500` text-cream-50)
   - **Navigation clavier** (UX spec ligne 1427) : `role="grid"` sur le container, arrow keys (Up/Down/Left/Right) déplacent le focus entre cellules, `Enter`/`Space` sélectionnent une date disponible, `Home`/`End` aller au début/fin de semaine, `PageUp`/`PageDown` mois précédent/suivant
   - **Props i18n-agnostic** : `monthNames`, `dayNamesShort`, `formatDateLabel`, `nextMonthLabel`, `previousMonthLabel` passés par l'app
   - **Range selection** : prop optionnelle `range` (`{ start, end }`) pour sélectionner une période (cas utilisé en `seller-calendar.jsx` pour bloquer une plage). Default : sélection simple (cas service.jsx booking)
   - **Sub-components** : `<AvailabilityCalendar.Header>`, `<AvailabilityCalendar.Day>` exportés

8. **AC8 — `<FilterSidebar>` (extracted `search.jsx`)** : Given `<FilterSidebar groups={[{ id: 'category', legend: 'Catégorie', type: 'checkbox', options: [...] }, { id: 'price', legend: 'Prix', type: 'range', min: 0, max: 5000, value: [500, 2000] }, ...]} values={values} onChange={setValues} />`, When il est rendu, Then :
   - **`<aside>` width 280px desktop, full-screen drawer mobile** (`<Modal>` Story 0.4 sur mobile, sidebar inline desktop)
   - **Groupes pliables** : chaque group rendu en `<fieldset>` + `<legend>` (UX spec ligne 1426) avec `<button aria-expanded aria-controls>` pour collapse/expand
   - **Types de filtres supportés** : `checkbox` (multi-select, ex: catégories), `radio` (mutex, ex: tri), `range` (slider 2-handles, ex: prix), `toggle` (switch, ex: "Avec photos seulement")
   - **A11y** : `aria-expanded`, `aria-controls`, `<fieldset>` + `<legend>`, `<input type="checkbox">` natifs avec `<label>` (a11y native, pas de re-implémentation)
   - **CTA bottom** : `<Button variant="primary" full>Voir 47 résultats</Button>` (count des résultats passé en prop `resultCount`) + `<Button variant="ghost">Effacer tout</Button>`
   - **Props i18n-agnostic** : `applyLabel`, `clearLabel`, `mobileToggleLabel` passés par l'app
   - **Mobile pattern** : sur mobile (`max-md:`), un bouton `<Button variant="secondary" icon={<Filter />}>Filtres ({activeCount})</Button>` ouvre le `<Modal>` plein-écran avec le contenu du FilterSidebar

9. **AC9 — `<FileUpload>` (extracted `pro-onboarding.jsx` + `mvp-pro-onboarding.jsx`)** : Given `<FileUpload accept="image/*,application/pdf" maxSize={10 * 1024 * 1024} multiple onChange={(files) => setFiles(files)} onError={(error) => toast.error(error.message)} />`, When je drop des fichiers ou clique, Then :
   - **Drop zone** : `<div role="button" tabIndex={0}>` avec border-dashed `cream-300`, hover `border-brand-500 bg-brand-50`, drag-over (state `isDragOver`) bg `brand-100 border-brand-500`
   - **Dual interaction** : click ouvre `<input type="file" hidden>` natif, drag & drop fonctionne via `onDragOver`/`onDragLeave`/`onDrop` handlers
   - **Validation client** : type (regex sur `accept`), size (vs `maxSize`), count (vs `maxFiles` optionnel) — erreur affichée inline + déclenche `onError(...)` callback
   - **Preview par fichier** : `<div>` avec icon (image preview si type image, sinon icon `<File />` Lucide), nom + size formaté, `<ProgressBar>` (Story 0.4) si upload en cours (controlled via prop `uploadProgress[fileName]`)
   - **Remove button** : `<Button variant="ghost" icon={<X />} aria-label="Remove file">` par fichier
   - **A11y** : `role="button"`, `aria-label` (passé en prop `dropZoneLabel`), `aria-describedby` vers helper text décrivant types acceptés
   - **Multipart upload** : pas géré ici (Story 3.4 le branche avec Cloudflare Images SDK) ; `<FileUpload>` est juste l'UI de sélection + preview, l'upload effectif est délégué via `onChange`
   - **Props i18n-agnostic** : `dropZoneLabel`, `clickToUploadLabel`, `removeLabel`, `errorLabels` (`fileTypeNotAllowed`, `fileTooLarge`, `tooManyFiles`)

10. **AC10 — `<EmptyState>` 7 variants (UX spec lignes 1234-1248)** : Given `<EmptyState variant="search-no-results" onAction={() => clearFilters()} actionLabel="Effacer les filtres" />`, When il est rendu, Then :
    - **Structure standard** : `<section>` centré flex column gap-4 padding-12, `<icon>` (Lucide grand format `size={48}`) + `<h2 className="text-2xl font-display text-charcoal-800">{title}</h2>` + `<p className="text-base text-charcoal-500 max-w-md text-center">{description}</p>` + `<Button variant="primary" onClick={onAction}>{actionLabel}</Button>` (sauf `reviews-empty` sans CTA)
    - **7 variants** (icônes Lucide assignées) :
      - `search-no-results` : icon `<SearchX />`, default title/description i18n-agnostic via props
      - `cart-empty` : icon `<ShoppingCart />`
      - `customer-no-bookings` : icon `<Calendar />`
      - `seller-no-bookings` : icon `<Inbox />`
      - `seller-no-services` : icon `<Tag />`
      - `messages-empty` : icon `<MessageSquare />`
      - `reviews-empty` : icon `<Star />`, **PAS de CTA** (juste rassurer, cf. UX spec ligne 1246)
    - **A11y** : `<h2>` sémantique normale (UX spec ligne 1433), pas de `role="status"` (l'utilisateur navigue jusqu'à l'état vide, ce n'est pas un live update)
    - **Props** : `variant` (obligatoire), `title` `description` `actionLabel` `onAction` `icon` (override variant icon) `cta` (override default Button) — tous optionnels avec defaults EN
    - **`icon` prop override** : permet à l'app de passer une illustration custom (ex `<img src="/illustrations/cart-empty.svg">`) à la place de l'icône Lucide pour V1+

11. **AC11 — `<ErrorPage>` (404, 500, maintenance)** : Given `<ErrorPage variant="404" eventId="abc-xyz" onRetry={() => router.refresh()} onGoHome={() => router.push('/')} />`, When il est rendu, Then :
    - **3 variants** : `404` (icon `<MapPinOff />`, title "Page introuvable"), `500` (icon `<AlertOctagon />`, title "Une erreur est survenue", + Sentry `eventId` affiché en `text-xs text-charcoal-400 mt-4` pour copier-coller), `maintenance` (icon `<Wrench />`, title "Maintenance en cours")
    - **Layout** : full-screen `<main>` centré flex column gap-6 padding-12 bg `cream-50`, h1 large `text-5xl font-display`, description `text-base text-charcoal-500 max-w-md`, **2 CTAs** : `<Button variant="primary" onClick={onRetry}>Réessayer</Button>` + `<Button variant="tertiary" onClick={onGoHome}>Retour à l'accueil</Button>` (CTA UX spec ligne 1205-1209 — toujours proposer une action)
    - **404 SEO** (UX spec ligne 1435) : `<Head>` avec `noindex` + `<link rel="canonical" href="/">` (responsabilité de l'app — la lib expose juste les attributs en prop `headProps` que l'app injecte via Next.js)
    - **A11y** : `<h1>` sémantique (UX spec ligne 1434), `role="alert"` sur le container (erreur server)
    - **Props i18n-agnostic** : `title`, `description`, `retryLabel`, `goHomeLabel`, `eventIdLabel` passés par l'app

12. **AC12 — `<StepIndicator>` (extracted `pro-onboarding.jsx`)** : Given `<StepIndicator steps={['Profil', 'KYC', 'Stripe', 'Service']} current={2} onStepClick={(idx) => setCurrent(idx)} />`, When il est rendu, Then :
    - **Layout** : `<ol>` horizontal flex items-center, chaque étape = cercle (24px) + label (text-sm font-medium charcoal-700) + ligne de séparation horizontale `border-t cream-200`
    - **States par étape** :
      - `index < current` : cercle bg `success-500` text-cream-50 + icon `<Check size={14} />` (validée)
      - `index === current` : cercle bg `brand-500` text-cream-50 + numéro (active)
      - `index > current` : cercle bg `cream-200` text-charcoal-400 + numéro (à venir)
    - **`onStepClick` optionnel** : si fourni, les étapes validées (index < current) sont cliquables (`<button>`) pour revenir en arrière, `aria-current="step"` sur l'étape active
    - **`aria-label` par étape** : "Étape 2 sur 4 : KYC, en cours" (i18n-agnostic via prop `formatStepLabel({ index, total, label, status })`)
    - **Vertical variant** : prop `orientation="vertical"` rend en colonne avec ligne verticale (utilisé dans wizards longs cf. `seller-service-create.jsx`)
    - **A11y** : `<ol>` + `<li>`, `aria-current="step"` sur l'étape active, focus visible sur les cliquables

13. **AC13 — `<Map>` placeholder (V1)** : Given `<Map markers={[]} center={{ lat: 47.218, lng: -1.553 }} zoom={12} />`, When il est rendu, Then :
    - **Render placeholder** uniquement au MVP : `<Placeholder>` (Story 0.4) avec label "Carte interactive disponible en V1" (i18n-agnostic via prop `placeholderLabel`), aspect-[4/3]
    - **Props définies pour V1+** : `markers: Array<{ id, lat, lng, title?, color? }>`, `center: { lat, lng }`, `zoom: number`, `onMarkerClick?: (id) => void`, `provider: 'mapbox' | 'google'` (default `'mapbox'`)
    - **V1+ implémentation** : remplacer le `<Placeholder>` par un wrapper `react-map-gl` (Mapbox) ou `@vis.gl/react-google-maps` (Google) — décision en V1 selon coût + features
    - **Pas de tests Map au MVP** (placeholder = trivial), tests V1+

14. **AC14 — Logo + LogoMark exportés depuis `<TopBar>` ou pattern dédié** : Given le bundle `_shared.jsx` lignes 76-97 définit un `<Logo>` custom (wordmark Fraunces lowercase + arch SVG terracotta), When je l'importe via `import { Logo, LogoMark } from '@tukio/ui/logo'`, Then :
    - `<Logo size={28} mono={false} showDomain={true} color={...} />` rend le wordmark **`tukio.one`** en Fraunces 500 charcoal-800 + dot terracotta `brand-500` (cohérent bundle)
    - `<LogoMark size={32} color="..." />` rend uniquement le SVG arch (sans wordmark) — utilisé pour favicon, mobile compact, og:image
    - **Pattern dédié `Logo/`** dans `packages/ui/src/patterns/Logo/` avec `Logo.tsx`, `LogoMark.tsx` (sub-component), `Logo.spec.tsx`, `Logo.types.ts`, `index.ts`
    - **Subpath import** : `'@tukio/ui/logo'` (entrée dans `package.json` `exports` à ajouter)
    - **Prop `mono`** : si `true`, tout en `color` unifié (pas de dot terracotta), utilisé pour les contextes contraintes (header dark, footer)
    - **NB** : Le composant `<Logo>` est techniquement un atomic, mais conceptuellement un **branding pattern** — placé dans `patterns/` pour cohérence avec UX spec ligne 484 (qui le liste implicitement avec TopBar/Footer). Cette décision diverge légèrement de l'arborescence "atomics vs patterns" : Logo est un cas particulier, **branding asset** plutôt qu'UI primitive.

15. **AC15 — Tests Playwright + axe-core sur parcours critiques (NFR54)** : Given le package `@tukio/ui`, When je lance `pnpm --filter=@tukio/ui test:e2e`, Then les tests Playwright passent (au moins 4 parcours avec axe-core gates) :
    - **Parcours #1 — Home `<TopBar>` + `<Footer>` + `<EmptyState search-no-results>`** : monte un harness Playwright qui rend ces 3 patterns dans une page minimale, vérifie navigation clavier (Tab cycle), `axe.run()` retourne 0 violations
    - **Parcours #2 — `<ConversationThread>`** : harness avec 5 messages, simulate nouveau message arrivant, vérifie `aria-live="polite"` annonce le nouveau message, axe ≥ 0 violations
    - **Parcours #3 — `<AvailabilityCalendar>` keyboard nav** : focus initial sur jour 1, arrow keys naviguent, Enter sélectionne un jour disponible, ESC ne sélectionne pas, axe ≥ 0 violations
    - **Parcours #4 — `<FilterSidebar>` mobile drawer** : viewport 375x667, toggle button ouvre `<Modal>` plein-écran avec FilterSidebar dedans, focus trap actif, axe ≥ 0 violations
    - **Setup Playwright** : `packages/ui/playwright.config.ts` avec headless Chromium, screenshots en cas d'échec, `@playwright/test` + `@axe-core/playwright` latest stable
    - **Pas de Playwright cross-browser** ici (Chromium suffit pour les patterns, cross-browser arrive Story 0.11 CI Lighthouse)
    - **Tests Vitest unitaires** : continuent comme Story 0.4 (≥ 80 % coverage par pattern, axe-core inline via `vitest-axe`/`jest-axe`)

16. **AC16 — Tree-shaking via subpath imports + démo design-system page étendue** : Given une app frontend qui importe `import { TopBar } from '@tukio/ui/top-bar'`, When je build l'app via `pnpm --filter=public build`, Then **uniquement** le code du `TopBar.tsx` (+ ses deps : Avatar, Button, Input, Lucide icons utilisés) est inclus dans le bundle final. Vérifiable via :
    - **Lint enforcement** : `tukio/no-barrel-import-ui` (Story 0.3) bloque déjà `import { TopBar } from '@tukio/ui'`
    - **Démo page** : étendre `apps/public/src/app/[locale]/page.tsx` (déjà mis à jour Stories 0.3+0.4) pour rendre les 12 patterns en mode "design system showcase" sous les 17 atomics. Sections : `### TopBar variants`, `### Footer`, `### Empty States (7)`, `### ConversationThread (chat preview)`, `### Reviews / Pricing / Calendar`, `### FilterSidebar`, `### FileUpload`, `### StepIndicator`, `### ErrorPage variants`, `### Map placeholder`, `### Logo`
    - Bundle analyzer : `pnpm --filter=public dlx @next/bundle-analyzer` → vérifier que les patterns non utilisés sur des routes spécifiques ne sont PAS dans le chunk de cette route

17. **AC17 — `package.json` `exports` étendu pour les 12 patterns + Logo** : Given `packages/ui/package.json`, When je l'ouvre, Then les `exports` couvrent (en plus des entrées Stories 0.3+0.4) :
    - `./availability-calendar` → `./src/patterns/AvailabilityCalendar/index.ts`
    - `./conversation-thread` → `./src/patterns/ConversationThread/index.ts`
    - `./empty-state` → `./src/patterns/EmptyState/index.ts`
    - `./error-page` → `./src/patterns/ErrorPage/index.ts`
    - `./file-upload` → `./src/patterns/FileUpload/index.ts`
    - `./filter-sidebar` → `./src/patterns/FilterSidebar/index.ts`
    - `./footer` → `./src/patterns/Footer/index.ts`
    - `./logo` → `./src/patterns/Logo/index.ts`
    - `./map` → `./src/patterns/Map/index.ts`
    - `./pricing-display` → `./src/patterns/PricingDisplay/index.ts`
    - `./reviews-display` → `./src/patterns/ReviewsDisplay/index.ts`
    - `./step-indicator` → `./src/patterns/StepIndicator/index.ts`
    - `./top-bar` → `./src/patterns/TopBar/index.ts`

18. **AC18 — Peer deps additionnelles (slider Range, popover LocaleSwitcher)** : Given `packages/ui/package.json`, When je l'ouvre, Then les `peerDependencies` sont étendues avec :
    - `@radix-ui/react-slider` (latest stable) — utilisé par `<FilterSidebar>` pour le filtre `range`
    - `@radix-ui/react-popover` (latest stable) — utilisé par `<TopBar.LocaleSwitcher>` (dropdown FR/EN)
    - `@radix-ui/react-checkbox` (latest stable) — utilisé par `<FilterSidebar>` filtres checkbox (style cohérent vs natifs)
    - `date-fns` (latest stable, devDep + peerDep) — utilisé par `<AvailabilityCalendar>` pour les calculs de calendrier (jours du mois, première/dernière semaine). **Pas de Moment.js** (deprecated, lourd)
    - **PAS de** `@radix-ui/react-radio-group` (FilterSidebar radio utilise les `<input type="radio">` natifs avec `<fieldset>` — suffisant)
    - **PAS de** Mapbox/Google Maps SDK au MVP (V1+, Map est placeholder)

## Tasks / Subtasks

- [ ] **Task 1 — Installer les peer deps additionnelles** (AC: #18)
  - [ ] 1.1 — `pnpm --filter=@tukio/ui add @radix-ui/react-slider @radix-ui/react-popover @radix-ui/react-checkbox date-fns --save-peer`
  - [ ] 1.2 — Pour chaque app `apps/{public,customer,seller,admin}` : `pnpm --filter=<app> add @radix-ui/react-slider @radix-ui/react-popover @radix-ui/react-checkbox date-fns` (résolution peer warning)
  - [ ] 1.3 — Mettre à jour `packages/ui/package.json` `exports` avec les 13 entrées (12 patterns + `logo`) — cf. AC17

- [ ] **Task 2 — Configurer Playwright pour le package** (AC: #15)
  - [ ] 2.1 — `pnpm --filter=@tukio/ui add -D @playwright/test @axe-core/playwright`
  - [ ] 2.2 — `pnpm --filter=@tukio/ui exec playwright install chromium` (download chrome headless uniquement — pas Firefox/WebKit pour MVP, vitesse CI)
  - [ ] 2.3 — Créer `packages/ui/playwright.config.ts` :
    ```ts
    import { defineConfig, devices } from '@playwright/test';
    export default defineConfig({
      testDir: './e2e',
      timeout: 30000,
      retries: 0,
      workers: 1,
      use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry', screenshot: 'only-on-failure' },
      projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
      webServer: { command: 'pnpm --filter=public dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 60000 },
    });
    ```
  - [ ] 2.4 — Ajouter scripts `packages/ui/package.json` : `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`

- [ ] **Task 3 — Implémenter `<Logo>` + `<LogoMark>` (prereq pour TopBar/Footer)** (AC: #14)
  - [ ] 3.1 — Créer `packages/ui/src/patterns/Logo/Logo.tsx` adapté du bundle `_shared.jsx` lignes 76-97 (wordmark Fraunces + arch SVG terracotta)
  - [ ] 3.2 — Créer `packages/ui/src/patterns/Logo/LogoMark.tsx` : juste le SVG arch (size + color props)
  - [ ] 3.3 — `Logo.types.ts` : `LogoProps` avec `size?: number`, `mono?: boolean`, `showDomain?: boolean`, `color?: string`
  - [ ] 3.4 — `Logo.spec.tsx` : test render variants (default, mono, showDomain=false), test color prop, axe ≥ 0 violations
  - [ ] 3.5 — `index.ts` re-export `Logo`, `LogoMark`, types

- [ ] **Task 4 — Implémenter `<TopBar>` 4 variants + sub-components** (AC: #2)
  - [ ] 4.1 — `TopBar.types.ts` : `TopBarProps` discriminé sur `variant` (`'public' | 'customer' | 'seller' | 'admin'`), labels prop typé strict (interfaces dérivées par variant)
  - [ ] 4.2 — `TopBar.tsx` : switch/case par variant qui render le bon layout
  - [ ] 4.3 — `<TopBar.SubNav>` sub-component (extracted `_shared.jsx` `ClientSubNav`) : pattern Compound Component
  - [ ] 4.4 — `<TopBar.LocaleSwitcher>` sub-component : utilise `@radix-ui/react-popover` (cf. AC18) pour dropdown FR/EN
  - [ ] 4.5 — `<ProSidebar>` (variant `seller`) : extracted `_shared.jsx` lignes 343-409, sticky left, charcoal-700 bg, badges count
  - [ ] 4.6 — Tests Vitest : 4 variants × axe call + interactions (locale switcher click, pro sidebar nav click)
  - [ ] 4.7 — `index.ts` re-export `TopBar` (avec sub-components attachés via `TopBar.SubNav = ...`, `TopBar.LocaleSwitcher = ...`)

- [ ] **Task 5 — Implémenter `<Footer>`** (AC: #3)
  - [ ] 5.1 — `Footer.tsx` adapté du bundle `home.jsx` lignes 329-359 (grid + Logo + columns + bottom legal)
  - [ ] 5.2 — Responsive : `grid-cols-2` puis `grid-cols-1` sur mobile (Tailwind breakpoints `md:` `sm:`)
  - [ ] 5.3 — Tests Vitest : test render avec columns dynamiques, axe ≥ 0 violations

- [ ] **Task 6 — Implémenter `<EmptyState>` 7 variants** (AC: #10)
  - [ ] 6.1 — `EmptyState.types.ts` : `EmptyStateVariant = 'search-no-results' | 'cart-empty' | 'customer-no-bookings' | 'seller-no-bookings' | 'seller-no-services' | 'messages-empty' | 'reviews-empty'`, `EmptyStateProps`
  - [ ] 6.2 — `EmptyState.tsx` : map variant → icon Lucide + default labels (EN), render section centrée
  - [ ] 6.3 — Spec : test 7 variants × axe + test override `icon` prop + test variant `reviews-empty` ne render PAS de CTA

- [ ] **Task 7 — Implémenter `<ErrorPage>` 3 variants** (AC: #11)
  - [ ] 7.1 — `ErrorPage.tsx` : 3 variants (404, 500, maintenance), 2 CTAs
  - [ ] 7.2 — Spec : test 3 variants, test eventId display sur 500, axe

- [ ] **Task 8 — Implémenter `<StepIndicator>` (horizontal + vertical)** (AC: #12)
  - [ ] 8.1 — `StepIndicator.tsx` : horizontal default, vertical via `orientation` prop
  - [ ] 8.2 — `aria-current="step"` sur l'étape active, `<ol>` + `<li>` + `<button>` cliquable si validé et `onStepClick` fourni
  - [ ] 8.3 — Spec : test 3 states (validé/active/à venir), test keyboard click via `userEvent.keyboard('{Enter}')`, axe

- [ ] **Task 9 — Implémenter `<ConversationThread>` + sub-components** (AC: #4)
  - [ ] 9.1 — `ConversationThread.tsx` : layout chat, bulles à droite/gauche selon `senderId === currentUserId`, auto-scroll, `aria-live="polite"`
  - [ ] 9.2 — Sub-components : `<ConversationThread.Bubble>`, `<ConversationThread.Composer>` (input + send button)
  - [ ] 9.3 — Indicator typing : 3 dots animés via `tk-typing` keyframes (Story 0.3) + `aria-label`
  - [ ] 9.4 — Spec : test bubbles alignment, test auto-scroll quand nouveau message, test live region annonces, test composer Enter/Shift+Enter, axe

- [ ] **Task 10 — Implémenter `<ReviewsDisplay>` + sub-components** (AC: #5)
  - [ ] 10.1 — `ReviewsDisplay.tsx` : compose `<Stars>` (Story 0.4) summary + breakdown optionnel + liste reviews paginée (load more)
  - [ ] 10.2 — Sub-components : `<ReviewsDisplay.Summary>`, `<ReviewsDisplay.Breakdown>`, `<ReviewsDisplay.List>`, `<ReviewsDisplay.Item>`
  - [ ] 10.3 — Empty case : si `reviews.length === 0`, render `<EmptyState variant="reviews-empty">`
  - [ ] 10.4 — Spec : test load more, test empty case, axe

- [ ] **Task 11 — Implémenter `<PricingDisplay>` (compact + detailed)** (AC: #6)
  - [ ] 11.1 — `PricingDisplay.tsx` : `<dl>` avec items + total séparé, font-tabular-nums, prop `formatMoney` obligatoire
  - [ ] 11.2 — Variants `compact` + `detailed`
  - [ ] 11.3 — Spec : test format Money via stub formatter, test compact vs detailed, axe

- [ ] **Task 12 — Implémenter `<AvailabilityCalendar>` (extracted service.jsx)** (AC: #7)
  - [ ] 12.1 — `AvailabilityCalendar.tsx` : utilise `date-fns` (`startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay`, `format`) pour calculer la grille du mois
  - [ ] 12.2 — `role="grid"`, navigation clavier complète (arrow keys, Home/End, PageUp/PageDown, Enter, Escape)
  - [ ] 12.3 — Sub-components : `<AvailabilityCalendar.Header>` (mois + nav buttons), `<AvailabilityCalendar.Day>`
  - [ ] 12.4 — Range selection optionnelle via prop `range`
  - [ ] 12.5 — Spec : test grid layout (28-31 jours), test arrow keys nav (focus déplacement), test Enter sélectionne, test PageUp change mois, axe

- [ ] **Task 13 — Implémenter `<FilterSidebar>` (desktop + mobile drawer)** (AC: #8)
  - [ ] 13.1 — `FilterSidebar.tsx` : map `groups` array → `<fieldset>` + `<legend>` par groupe, render input selon type (checkbox/radio/range/toggle)
  - [ ] 13.2 — Range filter via `@radix-ui/react-slider` (slider 2-handles)
  - [ ] 13.3 — Checkbox filter via `@radix-ui/react-checkbox` (style cohérent custom)
  - [ ] 13.4 — Mobile drawer : toggle button qui ouvre `<Modal>` (Story 0.4) plein-écran avec FilterSidebar dedans
  - [ ] 13.5 — CTA bottom : "Voir N résultats" + "Effacer tout"
  - [ ] 13.6 — Spec : test 4 types de filtres, test mobile toggle ouvre Modal, axe (a11y groups + slider)

- [ ] **Task 14 — Implémenter `<FileUpload>` (drag & drop + preview)** (AC: #9)
  - [ ] 14.1 — `FileUpload.tsx` : drop zone `role="button" tabIndex={0}` + `<input type="file" hidden>`, dual interaction click/drop
  - [ ] 14.2 — Validation client : type (regex `accept`), size (`maxSize`), count (`maxFiles`)
  - [ ] 14.3 — Preview par fichier : image preview via `URL.createObjectURL(file)` (révoqué au cleanup), icon Lucide pour PDF/autres, ProgressBar si `uploadProgress[fileName]`
  - [ ] 14.4 — Spec : test drag & drop (simuler `dragover`, `drop` events), test validation rejette types non acceptés, test remove button, axe

- [ ] **Task 15 — Implémenter `<Map>` placeholder** (AC: #13)
  - [ ] 15.1 — `Map.tsx` : render `<Placeholder>` (Story 0.4) avec label "Map (V1)" + props définies pour V1+
  - [ ] 15.2 — Spec : test placeholder render, pas de tests V1 features

- [ ] **Task 16 — Tests Playwright e2e (4 parcours critiques)** (AC: #15)
  - [ ] 16.1 — Créer `packages/ui/e2e/topbar-footer-emptystate.spec.ts` (parcours #1)
  - [ ] 16.2 — Créer `packages/ui/e2e/conversation-thread.spec.ts` (parcours #2)
  - [ ] 16.3 — Créer `packages/ui/e2e/availability-calendar.spec.ts` (parcours #3)
  - [ ] 16.4 — Créer `packages/ui/e2e/filter-sidebar-mobile.spec.ts` (parcours #4)
  - [ ] 16.5 — Chaque test : `await page.goto('/')`, render harness via `apps/public/src/app/[locale]/page.tsx` (qui inclut tous les patterns), `injectAxe`, `checkA11y`, assertions interactions
  - [ ] 16.6 — `pnpm --filter=@tukio/ui test:e2e` passe les 4 tests sans violations axe

- [ ] **Task 17 — Étendre la démo design-system page** (AC: #16)
  - [ ] 17.1 — Mettre à jour `apps/public/src/app/[locale]/page.tsx` pour render les 12 patterns sous une section "Patterns composites" (placée sous la section "17 atomics" de Story 0.4)
  - [ ] 17.2 — Pour chaque pattern, render au moins 1 instance principale + variants quand pertinent (TopBar 4 variants, EmptyState 7 variants, StepIndicator horizontal+vertical, ErrorPage 3 variants)
  - [ ] 17.3 — Tailwind v4 doit detect tous les class-variants (build automatique)
  - [ ] 17.4 — `pnpm --filter=public build` passe + bundle analyzer montre tree-shaking effectif

- [ ] **Task 18 — Tests + lint + commit** (AC: tous)
  - [ ] 18.1 — `pnpm --filter=@tukio/ui test --coverage` → ≥ 80 % coverage par pattern, axe inline tests passent
  - [ ] 18.2 — `pnpm --filter=@tukio/ui test:e2e` → 4 parcours Playwright passent
  - [ ] 18.3 — `pnpm lint && pnpm typecheck` à la racine → tous passent
  - [ ] 18.4 — `pnpm dev` → 4 apps démarrent, `apps/public` rend les patterns correctement
  - [ ] 18.5 — Commit `feat(ui): implement 12 composite patterns with Radix slider/popover/checkbox, date-fns, Playwright e2e tests` — Story 0.5 done

## Dev Notes

### Pourquoi cette story est la 5ᵉ — contexte stratégique

> **Sources canoniques** : `docs/cloud-design-bundle/project/screens/_shared.jsx` (TopNav, ClientSubNav, ProSidebar) + `home.jsx` (Footer) + `messages.jsx` (ConversationThread) + `service.jsx` + `pro-profile.jsx` (ReviewsDisplay) + `service.jsx` + `checkout.jsx` (PricingDisplay) + `service.jsx` + `seller-calendar.jsx` (AvailabilityCalendar) + `search.jsx` (FilterSidebar) + `pro-onboarding.jsx` + `mvp-pro-onboarding.jsx` (FileUpload, StepIndicator) + UX spec §UX Patterns lignes 1176-1294 (interaction states, empty states, error pages).

Story 0.4 a livré les 17 **primitives UI** (Button, Input, Modal, Toast, etc.). Story 0.5 livre les **12 compositions cross-domain** qui assemblent ces primitives en patterns réutilisables. Sans ces patterns, chaque story Epic 1+ devrait re-implémenter sa propre TopBar (incohérence visuelle), son propre EmptyState (manque de patterns standards), son propre ConversationThread (a11y compromise sans live region cohérente).

**Bénéfices opérationnels** :
- **Cohérence cross-app** : Customer voit la même `<TopBar variant="public">` que Visitor (même z-index, même padding, même hauteur), Seller voit la même `<ProSidebar>` peu importe sa page
- **a11y centralisé** : navigation clavier `<AvailabilityCalendar>` testée 1 fois en Story 0.5, pas re-testée 5 fois dans 5 stories Epic 1+
- **i18n délégué aux apps** : la lib expose des **labels props** (i18n-agnostic), les apps fournissent les strings via `next-intl`

**Décision technique majeure (à acter dans Story 0.5)** : la lib `@tukio/ui` reste **100 % i18n-agnostic**. Tous les labels (Connexion, Catégories, "Voir plus d'avis", "Réessayer", "Étape 2 sur 4", etc.) sont des **props typées strictes** avec defaults EN. **AUCUN composant** n'importe `next-intl` ou `useTranslations`. C'est l'app qui fournit les strings au rendering. Justification :
- `@tukio/ui` consommée par 4 apps × 2 locales = doit rester locale-agnostic
- Tests Vitest sans setup i18n complexe (just pass labels in props)
- Storybook V1+ peut tester les patterns sans monter `<NextIntlClientProvider>`

### Versions à utiliser (latest stable au moment du Sprint 0)

| Lib | Rôle | Version cible |
|---|---|---|
| **@radix-ui/react-slider** | range filter dans FilterSidebar | latest stable |
| **@radix-ui/react-popover** | LocaleSwitcher dropdown dans TopBar | latest stable |
| **@radix-ui/react-checkbox** | checkbox filter custom dans FilterSidebar | latest stable |
| **date-fns** | calculs calendrier `<AvailabilityCalendar>` | latest stable (3.x) — **PAS de Moment.js** (deprecated, 250 KB) |
| **@playwright/test** | tests e2e sur parcours patterns | latest stable |
| **@axe-core/playwright** | injection axe dans tests Playwright | latest stable |
| **chromium** (via `playwright install chromium`) | browser headless tests | last stable Playwright |

> ⚠️ **`react-map-gl` ou `@vis.gl/react-google-maps`** (V1+ pour `<Map>`) : NON installé au MVP. Décision V1 selon coût Mapbox vs Google Maps + features map nécessaires.
>
> ⚠️ **Pas de `react-day-picker`** : on implémente `<AvailabilityCalendar>` from scratch avec `date-fns`. Justification : react-day-picker est puissant mais lourd (~50 KB), fournit + de features que ce que MVP nécessite, et son styling est moins facilement intégrable au design system Tukio. Custom = ~200 lignes, full control sur a11y + design.

### Project Structure cible (cohérent UX spec lignes 483-493)

```
packages/ui/src/
├─ components/                                              # ← Story 0.4 (17 atomics)
├─ patterns/                                                # ← cette story
│  ├─ AvailabilityCalendar/{AvailabilityCalendar.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ ConversationThread/{ConversationThread.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ EmptyState/{EmptyState.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ ErrorPage/{ErrorPage.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ FileUpload/{FileUpload.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ FilterSidebar/{FilterSidebar.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ Footer/{Footer.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ Logo/{Logo.tsx, LogoMark.tsx, Logo.spec.tsx, Logo.types.ts, index.ts}
│  ├─ Map/{Map.tsx, Map.spec.tsx, Map.types.ts, index.ts}
│  ├─ PricingDisplay/{PricingDisplay.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ ReviewsDisplay/{ReviewsDisplay.tsx, .spec.tsx, .types.ts, index.ts}
│  ├─ StepIndicator/{StepIndicator.tsx, .spec.tsx, .types.ts, index.ts}
│  └─ TopBar/{TopBar.tsx, ProSidebar.tsx, LocaleSwitcher.tsx, TopBar.spec.tsx, TopBar.types.ts, index.ts}
├─ utils/, themes/, tokens/, styles/                        # ← Stories 0.3+0.4
└─ e2e/                                                     # ← cette story
   ├─ topbar-footer-emptystate.spec.ts
   ├─ conversation-thread.spec.ts
   ├─ availability-calendar.spec.ts
   └─ filter-sidebar-mobile.spec.ts
```

### Subpath exports (`packages/ui/package.json` — bloc complet, étend Stories 0.3+0.4)

> Étend les 18 entrées Stories 0.3+0.4 avec 13 nouvelles entrées (12 patterns + Logo).

```json
{
  "exports": {
    /* ... Stories 0.3+0.4 entries (CSS, tokens, themes, 17 atomics, utils) ... */
    "./availability-calendar": "./src/patterns/AvailabilityCalendar/index.ts",
    "./conversation-thread": "./src/patterns/ConversationThread/index.ts",
    "./empty-state": "./src/patterns/EmptyState/index.ts",
    "./error-page": "./src/patterns/ErrorPage/index.ts",
    "./file-upload": "./src/patterns/FileUpload/index.ts",
    "./filter-sidebar": "./src/patterns/FilterSidebar/index.ts",
    "./footer": "./src/patterns/Footer/index.ts",
    "./logo": "./src/patterns/Logo/index.ts",
    "./map": "./src/patterns/Map/index.ts",
    "./pricing-display": "./src/patterns/PricingDisplay/index.ts",
    "./reviews-display": "./src/patterns/ReviewsDisplay/index.ts",
    "./step-indicator": "./src/patterns/StepIndicator/index.ts",
    "./top-bar": "./src/patterns/TopBar/index.ts"
  }
}
```

### Pattern code — `<EmptyState>` (modèle de simplicité à dupliquer pour les autres simples)

```tsx
// packages/ui/src/patterns/EmptyState/EmptyState.tsx
import type { ReactNode } from 'react';
import { SearchX, ShoppingCart, Calendar, Inbox, Tag, MessageSquare, Star } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { cn } from '../../utils/cn';

const VARIANT_ICONS = {
  'search-no-results': SearchX,
  'cart-empty': ShoppingCart,
  'customer-no-bookings': Calendar,
  'seller-no-bookings': Inbox,
  'seller-no-services': Tag,
  'messages-empty': MessageSquare,
  'reviews-empty': Star,
} as const;

const DEFAULT_LABELS: Record<EmptyStateVariant, { title: string; description: string; actionLabel?: string }> = {
  'search-no-results': { title: 'No results found', description: 'Try clearing your filters or searching with different keywords.', actionLabel: 'Clear filters' },
  'cart-empty': { title: 'Your cart is empty', description: 'Discover services from our local professionals.', actionLabel: 'Discover services' },
  'customer-no-bookings': { title: 'No bookings yet', description: 'Once you book a service, it will appear here.', actionLabel: 'Discover services' },
  'seller-no-bookings': { title: 'No requests yet', description: 'Optimize your listing to attract more clients.', actionLabel: 'Optimize my listing' },
  'seller-no-services': { title: 'No services yet', description: 'Create your first service to start accepting bookings.', actionLabel: 'Create my first service' },
  'messages-empty': { title: 'No messages yet', description: 'When you contact a professional or receive a request, conversations will appear here.', actionLabel: 'Find a service' },
  'reviews-empty': { title: 'No reviews yet', description: 'Be the first to leave a review after your booking.' },
};

export type EmptyStateVariant = keyof typeof VARIANT_ICONS;

export interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  cta?: ReactNode;
  className?: string;
}

export function EmptyState({ variant, title, description, actionLabel, onAction, icon, cta, className }: EmptyStateProps) {
  const Icon = VARIANT_ICONS[variant];
  const defaults = DEFAULT_LABELS[variant];
  const finalTitle = title ?? defaults.title;
  const finalDescription = description ?? defaults.description;
  const finalActionLabel = actionLabel ?? defaults.actionLabel;
  return (
    <section className={cn('flex flex-col items-center justify-center gap-4 p-12 text-center', className)}>
      {icon ?? <Icon size={48} className="text-charcoal-400" aria-hidden="true" />}
      <h2 className="text-2xl font-display text-charcoal-800">{finalTitle}</h2>
      <p className="text-base text-charcoal-500 max-w-md">{finalDescription}</p>
      {cta ?? (finalActionLabel && onAction && variant !== 'reviews-empty' && (
        <Button variant="primary" onClick={onAction}>{finalActionLabel}</Button>
      ))}
    </section>
  );
}
```

### Pattern code — `<AvailabilityCalendar>` (squelette navigation clavier critique)

```tsx
// packages/ui/src/patterns/AvailabilityCalendar/AvailabilityCalendar.tsx (extrait — squelette)
import { useState, useCallback, useRef, useEffect } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths, isSameDay, getDay, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { cn } from '../../utils/cn';

type DayStatus = 'available' | 'booked' | 'unavailable';
type Availability = Record<string, DayStatus>; // ISO date string → status

export interface AvailabilityCalendarProps {
  month: Date;
  availability: Availability;
  selectedDate?: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  monthFormat?: string; // date-fns format string, default 'MMMM yyyy'
  dayNamesShort: [string, string, string, string, string, string, string]; // ['Mon', 'Tue', ...]
  formatDateLabel?: (date: Date, status: DayStatus) => string;
  nextMonthLabel?: string;
  previousMonthLabel?: string;
}

export function AvailabilityCalendar({ month, availability, selectedDate, onSelectDate, onMonthChange, monthFormat = 'MMMM yyyy', dayNamesShort, formatDateLabel, nextMonthLabel = 'Next month', previousMonthLabel = 'Previous month' }: AvailabilityCalendarProps) {
  const [focusedDate, setFocusedDate] = useState<Date>(selectedDate ?? new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  // Compute days to display (full weeks)
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const handleKeyDown = useCallback((e: React.KeyboardEvent, date: Date) => {
    let next = date;
    switch (e.key) {
      case 'ArrowRight': next = addDays(date, 1); break;
      case 'ArrowLeft': next = subDays(date, 1); break;
      case 'ArrowDown': next = addDays(date, 7); break;
      case 'ArrowUp': next = subDays(date, 7); break;
      case 'Home': next = startOfWeek(date, { weekStartsOn: 1 }); break;
      case 'End': next = endOfWeek(date, { weekStartsOn: 1 }); break;
      case 'PageUp': onMonthChange(subMonths(month, 1)); return;
      case 'PageDown': onMonthChange(addMonths(month, 1)); return;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const status = availability[format(date, 'yyyy-MM-dd')];
        if (status === 'available') onSelectDate(date);
        return;
      }
      default: return;
    }
    e.preventDefault();
    setFocusedDate(next);
  }, [month, availability, onMonthChange, onSelectDate]);

  // Auto-focus the focused day after render
  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${format(focusedDate, 'yyyy-MM-dd')}"]`);
    el?.focus();
  }, [focusedDate]);

  return (
    <div>
      {/* Header with month nav */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => onMonthChange(subMonths(month, 1))} aria-label={previousMonthLabel}>
          <ChevronLeft size={16} />
        </Button>
        <h3 className="font-display text-lg text-charcoal-800">{format(month, monthFormat)}</h3>
        <Button variant="ghost" size="sm" onClick={() => onMonthChange(addMonths(month, 1))} aria-label={nextMonthLabel}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Day names header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNamesShort.map((d) => <div key={d} className="text-xs text-charcoal-400 text-center">{d}</div>)}
      </div>

      {/* Days grid */}
      <div ref={gridRef} role="grid" className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const status = availability[dateKey] ?? 'unavailable';
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isFocused = isSameDay(day, focusedDate);
          const label = formatDateLabel?.(day, status) ?? `${format(day, 'd MMMM yyyy')}, ${status}`;
          return (
            <button
              key={dateKey}
              data-date={dateKey}
              role="gridcell"
              aria-label={label}
              aria-disabled={status !== 'available'}
              aria-pressed={isSelected}
              tabIndex={isFocused ? 0 : -1}
              disabled={status !== 'available'}
              onKeyDown={(e) => handleKeyDown(e, day)}
              onClick={() => status === 'available' && onSelectDate(day)}
              className={cn(
                'aspect-square text-sm rounded-md',
                status === 'available' && 'bg-cream-50 text-charcoal-700 hover:bg-cream-100 cursor-pointer',
                (status === 'booked' || status === 'unavailable') && 'bg-cream-200 text-charcoal-400 cursor-not-allowed',
                isSelected && 'bg-brand-500 text-cream-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Critical Architecture Constraints

> Cf. UX spec §Component Strategy lignes 1107-1175 (composition rules) + §Accessibility checklist lignes 1414-1428 + Architecture lignes 956-969 (bundle optimization, anti-barrel) + memories `feedback_*.md`.

1. **Composition uniquement, pas de re-implémentation** : `<TopBar>` compose `<Logo>` + `<Avatar>` + `<Button>` + `<Input>`. NE PAS dupliquer du code Button/Input dans TopBar — toujours composer les atomics existants.
2. **Pas de hooks externes côté patterns** : pas de `useTranslations`, pas de `useRouter`, pas de `useQuery`. Les patterns sont **stateless** (sauf state local UI : focus calendar, drag state FileUpload, expanded state FilterSidebar). Les apps injectent les data + callbacks via props.
3. **i18n-agnostic STRICT** : tous les labels en props avec defaults EN. JAMAIS d'import `next-intl` dans `packages/ui/`. (Si Storybook V1+ teste les patterns, il passe les labels en props.)
4. **a11y non négociable** : `<ConversationThread>` `aria-live`, `<AvailabilityCalendar>` `role="grid"` + nav clavier, `<FilterSidebar>` `<fieldset>` + `<legend>`, `<Modal>` (déjà dans Story 0.4) `role="dialog"`. Tests axe-core inline obligatoires.
5. **Touch targets ≥ 44 × 44 px sur mobile** (NFR53) : tous les boutons cliquables (`<TopBar>` mobile menu, `<AvailabilityCalendar>` jours, `<FilterSidebar>` toggles, `<FileUpload>` remove buttons) atteignent 44 px sur mobile.
6. **Anti-barrel** : `import { TopBar } from '@tukio/ui'` interdit. Subpath strict `'@tukio/ui/top-bar'`. Lint `tukio/no-barrel-import-ui` (Story 0.3) enforce.
7. **Tree-shaking préservé** : `sideEffects: ["**/*.css"]` (Story 0.3) → JS/TS files tree-shakés. Importer `<TopBar>` ne tire PAS `<ConversationThread>` ni `<Map>`.
8. **Patterns retournent JSX, pas des layouts complets** : `<TopBar>` ne render PAS un `<header>` + `<main>` complet — il render uniquement le `<header>`. L'app compose `<TopBar />` + `<main>{...}</main>` + `<Footer />` dans son layout.tsx.
9. **`<Map>` placeholder MVP** : ne pas installer Mapbox/Google Maps SDK. Décision V1 selon coût + features.
10. **Tests Playwright limités à 4 parcours** : la Story 0.5 ne teste pas TOUS les patterns en e2e (lourd, redondant avec Vitest unit tests). Seulement les compositions cross-pattern + les a11y critiques (chat live region, calendar nav, mobile drawer).

### What this story does NOT do (out of scope)

- ❌ **`<Map>` interactive Mapbox/Google** → V1+ (placeholder seul au MVP)
- ❌ **i18n strings hardcodées** → les apps fournissent via `next-intl`, la lib reste agnostic
- ❌ **`<ConversationThread>` PII regex detection** → Story 12.1 (V1, R6 anti-désintermédiation, regex centralisée dans `@tukio/contracts/regex-rules.ts`)
- ❌ **`<FileUpload>` upload Cloudflare Images réel** → Story 3.4 (UI dans Story 0.5, branchement SDK dans Story 3.4)
- ❌ **`<AvailabilityCalendar>` range mode complète** → MVP : single date selection. Range mode en V1+ pour `seller-calendar.jsx` blocage plage
- ❌ **`<ReviewsDisplay>` breakdown multi-critères** → V1 (au MVP, breakdown est optionnel — affiché si fourni mais hidden si absent ; Story 12.2 le rendra obligatoire)
- ❌ **`<TopBar>` `<TopBar.MobileMenu>` (drawer hamburger)** → V1 (au MVP, TopBar mobile montre juste les CTAs principaux ; le drawer complet attendra)
- ❌ **`<FilterSidebar>` filtres avancés** (date range picker, multi-level taxonomy, etc.) → ajoutés au fur et à mesure des stories Epic 1+
- ❌ **Storybook config + stories** → V1+
- ❌ **Tests visual regression** (Chromatic, Percy) → V1+
- ❌ **`<TopBar>` notification bell badge interactif** → Story 11.1 (in-app notifications V1)

### Files to UPDATE vs CREATE

> **À UPDATE** (existants depuis Stories 0.3+0.4) :
> - `packages/ui/package.json` — ajouter peer deps Radix slider/popover/checkbox + date-fns + Playwright + 13 entrées `exports`
> - `packages/ui/vitest.config.ts` — pas de changement (setup déjà OK Story 0.4)
> - `packages/ui/README.md` — documenter `import { TopBar } from '@tukio/ui/top-bar'` + lien vers Cloud Design bundle screens
> - `apps/{public,customer,seller,admin}/package.json` — ajouter peer deps Radix slider/popover/checkbox + date-fns
> - `apps/public/src/app/[locale]/page.tsx` — étendre la démo Stories 0.3+0.4 avec section "Patterns composites"

> **À CREATE** (nouveaux fichiers) :
> - 12 dossiers patterns × 4 fichiers = **48 fichiers** dans `packages/ui/src/patterns/`
> - `packages/ui/src/patterns/Logo/Logo.tsx`, `LogoMark.tsx`, `Logo.spec.tsx`, `Logo.types.ts`, `index.ts` (5 fichiers)
> - `packages/ui/src/patterns/TopBar/ProSidebar.tsx`, `LocaleSwitcher.tsx` (2 sub-components additionnels)
> - `packages/ui/playwright.config.ts`
> - `packages/ui/e2e/{topbar-footer-emptystate,conversation-thread,availability-calendar,filter-sidebar-mobile}.spec.ts` (4 fichiers)
> - **Estimation total fichiers créés** : ~60 fichiers

### Previous Story Intelligence (Stories 0.1 + 0.2 + 0.3 + 0.4)

**Story 0.1** — Apps Next.js scaffoldées, ports figés, structure feature-based.

**Story 0.2** — Pattern subpath `exports`, `eslint-plugin-tukio` créé.

**Story 0.3** — `theme.css` + tokens TS + globals.css + fonts via `next/font`. CSS variables `var(--color-brand-500)` etc. disponibles. Animations `tk-typing` + `tk-shimmer` + `tk-modal-enter` keyframes définies. Lint rule `tukio/no-barrel-import-ui` créée.

**Story 0.4** :
- 17 atomics implémentés : `Button`, `Input`, `Label`, `Helper`, `FormField`, `Badge`, `Card`, `Modal`, `Toast`, `Alert`, `Avatar`, `Stars`, `Skeleton`, `Spinner`, `ProgressBar`, `Placeholder`, `Divider`. **Tous consommables via subpath** (`'@tukio/ui/button'`, etc.)
- Pattern CVA + `cn()` helper (`packages/ui/src/utils/cn.ts`) : utilisé par tous les atomics. Story 0.5 réutilise le même helper pour les patterns.
- Radix UI Primitives installés (`@radix-ui/react-{dialog,toast,slot}`). Story 0.5 ajoute `slider`, `popover`, `checkbox`.
- `lucide-react` installé. Story 0.5 utilise les mêmes icônes (extension : `SearchX`, `ShoppingCart`, `Calendar`, `Inbox`, `Tag`, `MessageSquare`, `Star`, `MapPinOff`, `AlertOctagon`, `Wrench`, `ChevronLeft`, `ChevronRight`, `Filter`, `X`, `File`, `Send`, `Check`).
- Vitest + axe-core inline configurés (`vitest-axe`/`jest-axe`). Story 0.5 réutilise le setup, ajoute Playwright e2e.
- Coverage 80 % par composant. Story 0.5 garde 80 % par pattern.
- TypeScript strict + `noUncheckedIndexedAccess` : `<AvailabilityCalendar>` doit gérer `availability[dateKey]` qui retourne `DayStatus | undefined` (utiliser `??` partout).
- `apps/public/src/app/[locale]/page.tsx` rend déjà la démo des 17 atomics. Story 0.5 l'étend avec une section "Patterns composites".

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.5 |
|---|---|---|
| EN strict (paths, code) | Pattern names en PascalCase, files en PascalCase | ✅ tous les patterns |
| camelCase props | `onSelectDate`, `formatMoney`, `currentUserId` | ✅ tous les patterns |
| `forwardRef` quand pertinent | Patterns rarement (généralement composés non-référencés) | ⚠️ `<Footer>` `<EmptyState>` peuvent forward ; `<TopBar>` `<ConversationThread>` non |
| Pas de hardcoded color hex | Toujours via Tailwind utility | ✅ tous les patterns |
| Pas de `style={{ ... }}` inline | Sauf cas spécial (`<Placeholder>` background pattern) | ⚠️ Vérifier Map placeholder + ConversationThread typing dots |
| RGAA AA | axe-core inline + Playwright | ✅ tests obligatoires |
| Touch targets ≥ 44px | Mobile | ✅ FilterSidebar mobile toggle, AvailabilityCalendar days |
| ARIA roles + states | role="grid", role="dialog", aria-live, aria-current | ✅ a11y checklist UX spec lignes 1414-1428 |
| `aria-label` EN default | Override via prop par les apps i18n | ✅ tous les labels |
| date-fns over Moment | Performance + tree-shaking | ✅ AvailabilityCalendar |

### Testing Standards

- **Coverage cible** : ≥ 80 % par pattern (cohérent NFR71 + Story 0.4).
- **Framework Vitest unit tests** : continuent Story 0.4 (Vitest + Testing Library + axe-core inline).
- **Framework Playwright e2e** : NOUVEAU dans Story 0.5. Configuration minimale (Chromium uniquement, headless, 4 parcours).
- **Pas de tests visual regression** (Chromatic V1+).
- **Pas de tests cross-browser** ici (Story 0.11 CI Lighthouse + Playwright Firefox/WebKit V1+).

### Project Structure Notes

✅ **Aligné** avec UX spec §Architecture du package `@tukio/ui` lignes 451-502 (12 patterns listés).

✅ **Aligné** avec UX spec §Component Strategy lignes 1107-1175 (composition rules : niveau 1 atomics + patterns shared, niveau 2 features apps, niveau 3 shared apps).

✅ **Aligné** avec Cloud Design bundle (`_shared.jsx` + `home.jsx` + 6+ screens spécifiques).

⚠️ **Décision documentée** : `<Logo>` placé dans `patterns/Logo/` (et non `components/`) — branding asset, pas UI primitive. Diverge légèrement de l'arborescence atomics/patterns conceptuelle. Justification dans AC14.

⚠️ **Décision documentée** : `<TopBar variant="seller">` render `<ProSidebar>` (sticky left, pas top horizontal). Cette dualité "TopBar = sidebar pour seller" est conforme au bundle (`_shared.jsx` ProSidebar) mais peut surprendre. **Alternative envisagée** : pattern dédié `<ProSidebar>` séparé. **Décision figée** : garder dans `<TopBar>` car conceptuellement c'est le pattern de navigation principale (qu'il soit horizontal ou vertical). Si V1+ on a besoin de ProSidebar dans des contextes non-seller, on peut l'extraire (le sub-component est déjà séparé en `ProSidebar.tsx`).

⚠️ **Décision documentée** : `<Map>` placeholder MVP. Pas de SDK Maps installé. Risque : si une story Epic 1+ a besoin de Map, elle est bloquée jusqu'à V1. **Mitigation** : aucune story MVP ne nécessite de map (Story 3.10 listing detail public peut mentionner la zone géographique sans map interactive). Décision V1 selon coût Mapbox vs Google Maps + features.

⚠️ **À noter** : `<TopBar variant="admin">` est défini mais pas designé en détail au MVP (UX spec ligne 234 : `mvp-admin` est en audit). L'implémentation suit le bundle `_shared.jsx` avec adaptations charcoal-900 + MFA badge. Story 6.1 (Admin dashboard) raffinera si besoin.

### References

- [Source: docs/cloud-design-bundle/project/screens/_shared.jsx — lignes 76-97 (Logo), 152-209 (TopNav), 277-303 (SiteHeader), 305-329 (ClientSubNav), 343-409 (ProSidebar), 419-427 (ProShell)]
- [Source: docs/cloud-design-bundle/project/screens/home.jsx — lignes 329-359 (Footer)]
- [Source: docs/cloud-design-bundle/project/styles/tokens.css — `.tk-typing` keyframes (animation indicator chat)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Patterns-composites — Lines 738-754 (table 12 patterns + sources bundle)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Empty-states — Lines 1234-1248 (7 variants EmptyState avec CTAs)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Error-states — Lines 1195-1209 (3 niveaux d'erreur, ErrorPage 404/500)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component-Strategy — Lines 1107-1175 (3 niveaux composants, composition rules)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility-checklist-par-composant — Lines 1414-1428 (FilterSidebar fieldset, AvailabilityCalendar grid, ConversationThread aria-live)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Special-states-accessibility — Lines 1430-1435 (loading aria-busy, empty h2 sémantique, error h1 + recovery, 404 noindex)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Multilanguage-UX — Lines 1437-1457 (locale switcher dans TopBar, fallback FR badge)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle-Optimization — Lines 956-962 (anti-barrel, dynamic imports calendar, bundle 150 KB)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées — Lines 2208-2214 (packages/ui/src structure incluant patterns)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.5 — Lines 922-937 (8 ACs originaux : 12 patterns, TopBar variants, EmptyState 7, ConversationThread, StepIndicator, FileUpload, Playwright + axe)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR54 — Lighthouse a11y ≥ 90, axe-core obligatoire parcours critiques]
- [Source: _bmad-output/planning-artifacts/prd.md#FR67-74 — Messagerie chat (consommée par ConversationThread)]
- [Source: _bmad-output/implementation-artifacts/0-3-setup-design-system-tailwind-v4-tukio-ui.md — Story 0.3 dev context (theme.css, tokens, fonts, lint no-barrel-import-ui, animations keyframes)]
- [Source: _bmad-output/implementation-artifacts/0-4-implement-atomic-components-tukio-ui.md — Story 0.4 dev context (17 atomics, helper cn, Radix UI base, vitest-axe setup, coverage 80%)]
- [Memory: feedback_latest_versions.md — Tailwind v4, latest stable]
- [Memory: feedback_tech_layer_english.md — code/aria-label EN, paths EN]
- [Memory: feedback_clean_architecture_explicit.md — patterns 100 % stateless ou state local UI uniquement]
- [Memory: feedback_i18n_frontend.md — i18n FR/EN, lib `@tukio/ui` reste agnostic, apps font binding via `next-intl`]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent au démarrage de l'implémentation)

### Debug Log References

(à remplir au cours de l'implémentation — versions Radix slider/popover/checkbox + date-fns retenues, choix Playwright config, alternatives si patterns réutilisables non identifiés)

### Completion Notes List

(à remplir à la fin — résumé des décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 0.6 qui consommera `<Logo>`, `<TopBar>`, `<Footer>` dans `apps/identity-svc` UI auth, et pour stories Epic 1+ qui composent les 12 patterns)

### File List

(à remplir à la fin — liste exhaustive des fichiers créés / modifiés, avec chemins relatifs depuis la racine du repo)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 4-5 jours (12 patterns × ~2-3 h dev + 4 tests Playwright + setup = ~40 h, mais Logo/Footer/EmptyState/ErrorPage simples vs ConversationThread/AvailabilityCalendar/FilterSidebar/FileUpload complexes)
- **Dépendances upstream** :
  - Stories 0.1, 0.2, 0.3 (`ready-for-dev`)
  - **Story 0.4** (`ready-for-dev`) — 17 atomics indispensables (TopBar compose Avatar+Button+Input ; ConversationThread compose Avatar+Input+Button ; FilterSidebar compose Modal+Button+Input ; etc.)
- **Dépendances downstream** :
  - **Story 0.6** (Pattern Pretre identity-svc) — `apps/identity-svc` aura besoin de `<Logo>` + `<TopBar variant="public">` + `<Footer>` pour les pages auth
  - **Stories Epic 1+** (toutes les stories frontend MVP) :
    - Epic 1 (Auth) : `<TopBar>` + `<Footer>` + `<FormField>` + `<EmptyState messages-empty>`
    - Epic 2 (Pro Onboarding) : `<StepIndicator>` + `<FileUpload>` + `<TopBar variant="seller">`
    - Epic 3 (Catalog) : `<TopBar variant="public">` + `<FilterSidebar>` + `<EmptyState search-no-results>` + `<ReviewsDisplay>` + `<PricingDisplay>` + `<AvailabilityCalendar>`
    - Epic 4 (Booking + Payment) : `<PricingDisplay>` + `<AvailabilityCalendar>` + `<EmptyState customer-no-bookings>` + `<EmptyState seller-no-bookings>`
    - Epic 5 (Messaging + Reviews) : `<ConversationThread>` + `<ReviewsDisplay>` + `<EmptyState messages-empty>` + `<EmptyState reviews-empty>`
    - Epic 6 (Admin) : `<TopBar variant="admin">` + `<FilterSidebar>` (modération queues)
    - Epic 7 (i18n + Acquisition) : `<TopBar.LocaleSwitcher>` + `<Footer>` (legal pages)
- **FRs covered** : aucun FR direct (foundational)
- **NFRs touchés** :
  - **NFR53** — touch targets ≥ 44 × 44 px (mobile FilterSidebar toggle, calendar days, FileUpload remove) ✅
  - **NFR54** — Lighthouse a11y ≥ 90 + axe-core inline ≥ 0 violations + 4 parcours Playwright critique ✅
  - **NFR67** — patterns réutilisables, pas de duplication cross-app
  - **NFR71** — coverage ≥ 80 % par pattern ✅
  - **NFR74** — conventions naming + tree-shaking enforced via lint
  - **UX-DR1-6** — design system code-ready ✅
  - **UX-DR16** — 7 variants EmptyState catalogués et implémentés ✅
