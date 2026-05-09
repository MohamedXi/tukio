# Story 0.3: Setup design system Tailwind v4 (theme.css + tokens TS + globals.css) in @tukio/ui

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** frontend developer (équipe Sprint 0),
**I want** `@tukio/ui` configured with Tailwind v4 CSS-first design tokens (`theme.css`), TypeScript tokens for programmatic access (`tokens/*.ts`), shared `globals.css` entry point, fonts loaded via `next/font/google` from chacun des 4 apps Next.js, et le pattern d'import via `@tukio/ui/styles/globals.css` validé end-to-end,
**so that** les 4 apps Next.js consomment **exactement** le même design system terracotta sans duplication, le rendu visuel match strictement le bundle Cloud Design (`docs/cloud-design-bundle/project/styles/tokens.css`), et les Stories 0.4 (atomics) + 0.5 (patterns) peuvent être implémentées sur une fondation visuelle figée.

> **Outcome attendu** : à la fin de cette story, les 4 apps (`apps/{public,customer,seller,admin}`) démarrent en `pnpm dev` avec les fonts (Fraunces + Inter + JetBrains Mono) chargées via `next/font` (no FOUT), un `<h1>Tukio</h1>` rend en Fraunces 500 charcoal-800 + body Inter, `bg-brand-500` génère bien `#C2410C`, et Lighthouse passe LCP < 2,5 s + INP < 200 ms + CLS < 0,1 sur la home placeholder (NFR5).

## Acceptance Criteria

1. **AC1 — `theme.css` complet (Tailwind v4 `@theme`)** : Given `packages/ui/src/styles/theme.css`, When je l'ouvre, Then je trouve la directive `@theme { ... }` Tailwind v4 avec **tous les tokens spécifiés** (alignés byte-pour-byte sur UX spec lignes 511-622) :
   - **Brand terracotta** : `--color-brand-{50,100,200,300,400,500,600,700,800,900}` (du `#FCF3EE` au `#3E1606`, valeurs exactes UX spec ligne 517-526)
   - **Cream + charcoal** : `--color-cream-{50,100,200,300}` + `--color-charcoal-{400,500,600,700,800,900}` (10 tokens neutres chauds — pas de noir/blanc purs, cf. Dev Notes §Règles tokens)
   - **Functional désaturés** : `--color-success-{50,500,700}`, `--color-warning-{50,200,500,700}`, `--color-error-{50,500,700}`, `--color-danger-{50,500,600,700}`, `--color-info-{50,500,700}` (16 tokens fonctionnels)
   - **Typography** : `--font-display` (Fraunces + fallbacks), `--font-body` (Inter + fallbacks), `--font-mono` (JetBrains Mono + fallbacks)
   - **Modular scale 1.250 (Major Third)** : `--text-{xs:12,sm:14,base:16,lg:20,xl:25,2xl:31,3xl:39,4xl:49,5xl:61,6xl:76}` en px
   - **Spacing base 4 px** : `--spacing-{0,1,2,3,4,5,6,8,10,12,16,20,24}` (13 tokens, valeurs `0,4,8,12,16,20,24,32,40,48,64,80,96` px)
   - **Radius** : `--radius-{sm:4,md:8,lg:12,xl:16,2xl:24,full:9999}` en px
   - **Shadows warm-tinted (charcoal-700 base)** : `--shadow-{sm,(default),md,lg,xl}` avec `rgba(31, 29, 24, X)` exact
   - **Breakpoints** : `--breakpoint-{xs:0,sm:481,md:641,lg:1025,xl:1281,2xl:1537}` en px (cohérent avec PRD §Responsive Design)
   - **Animations** : `--animate-typing: tk-typing 1.4s ease-in-out infinite`
   - **Keyframes** définis hors `@theme` : `@keyframes tk-typing`, `@keyframes tk-modal-enter`, `@keyframes tk-shimmer`
   - **`prefers-reduced-motion`** : règle media query qui réduit toutes les animations + transitions à `0.01ms` (RGAA + WCAG 2.1 AA respect)

2. **AC2 — TypeScript tokens (accès programmatique)** : Given `packages/ui/src/tokens/`, When je l'ouvre, Then je trouve **exactement** ces 8 fichiers avec les valeurs **strictement identiques** au `theme.css` (single source of truth visuel, double source of truth pour usages programmatiques) :
   - `colors.ts` : objets `brand`, `cream`, `charcoal`, `success`, `warning`, `error`, `danger`, `info` typés `as const` avec keys numériques + values hex strings (cf. UX spec ligne 692-702)
   - `typography.ts` : objets `fontFamily`, `fontSize` (modular scale), `fontWeight` (`{thin,light,regular,medium,semibold,bold} = {100,300,400,500,600,700}`), `letterSpacing` (`{tight:-0.01em, normal:0, wide:0.04em}`), `lineHeight` (`{tight:1.1, snug:1.25, normal:1.5, relaxed:1.625}`)
   - `spacing.ts` : objet `spacing` (13 keys cohérent `theme.css`)
   - `radius.ts` : objet `radius` (6 keys)
   - `shadows.ts` : objet `shadows` (5 keys + `default` aliasé sur `'shadow'`)
   - `breakpoints.ts` : objet `breakpoints` (6 keys, valeurs en `px` strings pour usage media queries JS)
   - `animations.ts` : objets `keyframes` (3 keys: `typing`, `modalEnter`, `shimmer`) + `animations` (`typing: '...'`)
   - `index.ts` : barrel re-export de tous les modules ci-dessus + un export `tokens` agrégé `{ colors, typography, spacing, radius, shadows, breakpoints, animations } as const` (utilisé par Stripe Elements theme cf. AC8)
   - **Tous les modules** sont typés `as const` pour permettre `keyof typeof colors.brand → "50"|"100"|...|"900"` (literal narrowing strict)

3. **AC3 — `globals.css` entry point partagé** : Given `packages/ui/src/styles/globals.css`, When je l'ouvre, Then je trouve **exactement** dans cet ordre (alignement byte-pour-byte UX spec lignes 648-676) :
   - `@import "tailwindcss";` (Tailwind v4 — remplace `@tailwind base/components/utilities`)
   - `@import "./theme.css";` (les `@theme` tokens Tukio)
   - **Reset léger + base styles** :
     - `:root` avec `font-family: var(--font-body)`, `font-size: var(--text-base)`, `color: var(--color-charcoal-700)`, `background: var(--color-cream-50)`, `font-feature-settings: "ss01", "cv11"`, `-webkit-font-smoothing: antialiased`, `text-rendering: optimizeLegibility`
     - `h1, h2, h3, h4` : `font-family: var(--font-display)`, `font-weight: 500`, `letter-spacing: -0.01em`, `margin: 0`, `color: var(--color-charcoal-800)`, `text-wrap: balance`
     - `p` : `margin: 0`, `text-wrap: pretty`
     - `a` : `color: inherit`, `text-decoration: none`
     - `::selection` : `background: var(--color-brand-200)`, `color: var(--color-charcoal-800)`
   - **Aucune autre règle** (les composants ne sont pas stylés ici — Stories 0.4/0.5)

4. **AC4 — Subpath imports (CSS + TS) résolvent depuis les 4 apps** : Given le repo, When je lance dans n'importe lequel des 4 apps Next.js (`apps/{public,customer,seller,admin}`) :
   - **CSS** : `apps/<app>/src/app/globals.css` contient **uniquement** `@import "@tukio/ui/styles/globals.css";` (overrides app-specific éventuels en commentaires placeholder pour stories futures)
   - **TS tokens** : `apps/<app>/src/lib/stripe-theme.ts` (smoke fichier temporaire) contient `import { colors } from '@tukio/ui/tokens/colors';` + utilisation pour vérifier que le subpath résout
   Then `pnpm --filter=<app> build` passe sans erreur, et le rendu HTML inclut bien les CSS variables `--color-brand-500: #C2410C` (vérifiable via `curl http://localhost:3000 | grep brand-500` après `pnpm dev`).

5. **AC5 — Fonts chargées via `next/font/google` dans chaque app (no FOUT)** : Given chacun des 4 apps `apps/{public,customer,seller,admin}/src/app/layout.tsx`, When je l'ouvre, Then je trouve :
   - Import `next/font/google` pour `Fraunces` (display, italic-friendly, axes `opsz`, `SOFT`, `WONK`, weight `300..900`, italic activé), `Inter` (body, weight `300..700`, `variable: '--font-body'`), `JetBrains_Mono` (mono, weight `400..600`, `variable: '--font-mono'`)
   - Chaque police déclare `display: 'swap'`, `subsets: ['latin', 'latin-ext']`, et expose une `variable` CSS (`--font-display`, `--font-body`, `--font-mono`)
   - `<html lang={locale} className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}>` câble les variables sur le root HTML
   - **`theme.css` fait référence aux variables CSS injectées** (cf. AC1) : `--font-display: var(--font-fraunces, "Fraunces"), "Tiempos Headline", Georgia, serif;` (fallback string si variable absente — graceful degradation pour Storybook/SSR sans next/font)

6. **AC6 — Rendering `bg-brand-500` génère `#C2410C` (Tailwind v4 auto-detect)** : Given une page Next.js qui utilise `<div className="bg-brand-500 text-cream-50 p-4 rounded-md">` dans `apps/public/src/app/[locale]/page.tsx` (replace placeholder de Story 0.1), When je build l'app via `pnpm --filter=public build`, Then :
   - Tailwind v4 détecte automatiquement la classe (sans `content: [...]` config explicite — Tailwind v4 scan auto JS/TS/JSX/TSX/MDX)
   - Le CSS généré contient bien `.bg-brand-500 { background-color: var(--color-brand-500) /* #C2410C */ }`
   - Le rendu visuel HTML/CSS produit `background: #C2410C` (vérifiable via Playwright getComputedStyle ou inspection DevTools)

7. **AC7 — Core Web Vitals home placeholder OK (NFR5)** : Given `apps/public/src/app/[locale]/page.tsx` avec un placeholder minimal terracotta (`<h1>Tukio</h1>` Fraunces + `<p>` Inter + 1 image preload via `next/image` Cloudflare placeholder + bouton CTA `bg-brand-500`), When je lance Lighthouse en mode mobile slow 4G via `pnpm --filter=public dlx lighthouse http://localhost:3000 --only-categories=performance --form-factor=mobile`, Then les seuils sont **strictement** atteints : `LCP < 2 500 ms`, `INP < 200 ms`, `CLS < 0,1`, `Performance score ≥ 90`.

8. **AC8 — Stripe Elements theme dérivé des tokens TS (smoke + futur Story 4.5)** : Given un fichier `packages/ui/src/themes/stripe-elements.theme.ts` (créé dans cette story), When je l'importe via `import { stripeElementsTheme } from '@tukio/ui/themes/stripe-elements';`, Then il expose un objet `Appearance` Stripe.js conforme [Stripe Appearance API](https://docs.stripe.com/elements/appearance-api) qui mappe :
   - `theme: 'flat'`
   - `variables.colorPrimary: colors.brand[500]` (`#C2410C`)
   - `variables.colorBackground: colors.cream[50]`
   - `variables.colorText: colors.charcoal[700]`
   - `variables.colorDanger: colors.error[500]`
   - `variables.fontFamily: '"Inter", -apple-system, ...'`
   - `variables.spacingUnit: '4px'`, `variables.borderRadius: radius.md` (8 px)
   - **Pas d'utilisation à ce stade** (Story 4.5 le branchera dans `apps/customer/src/features/cart-checkout/`), juste vérifier que le type Stripe `Appearance` est satisfait via `import type { Appearance } from '@stripe/stripe-js';`

9. **AC9 — Tests unitaires + visuels (Vitest + jest-dom + axe-core)** : Given le package `@tukio/ui`, When je lance `pnpm --filter=@tukio/ui test`, Then les tests passent (Vitest, ≥ 90 % coverage sur la lib) :
   - **Tokens cohérence** : test qui parse `theme.css` (regex sur `--color-brand-500: #C2410C;`) et compare avec `colors.brand[500]` exporté depuis `tokens/colors.ts` → divergence détectée → test failed (force la synchronisation manuelle Sprint 0, automatisée V1+ via `pnpm tokens:sync`)
   - **CSS exports** : test qui vérifie que `globals.css` contient les `@import` requis dans le bon ordre
   - **TS tokens types** : tests `tsd` ou `expect-type` qui vérifient `keyof typeof colors.brand === '50' | '100' | ... | '900'` (literal narrowing)
   - **Pas de tests visuels Playwright dans cette story** (livré en Story 0.4 quand les composants existent)

10. **AC10 — Anti-barrel `tukio/no-barrel-import-ui` lint rule** : Given le plugin `eslint-plugin-tukio` (livré Story 0.2), When un dev écrit `import { Button } from '@tukio/ui'` (barrel) dans n'importe quelle app, Then la rule `tukio/no-barrel-import-ui` (sévérité `warn` Sprint 0, montée à `error` en Story 0.11) signale la violation et propose en autofix `import { Button } from '@tukio/ui/button'` ou `'@tukio/ui/components/button'` selon ce qui sera valide après Story 0.4. **À ce stade** (Story 0.3, pas de composants encore), la rule est créée + 4 tests (2 valid imports CSS/tokens, 2 invalid barrels), mais aucun consommateur ne la déclenche.

11. **AC11 — `package.json` complet + `exports` exhaustif** : Given `packages/ui/package.json`, When je l'ouvre, Then je trouve :
    - `"name": "@tukio/ui"`, `"version": "0.0.0"`, `"private": true`, `"sideEffects": ["**/*.css"]` (CSS files have side effects, JS/TS files do not — préserve tree-shaking)
    - `"type": "module"`
    - Champ `"exports"` exhaustif (cf. Dev Notes §Subpath exports — copier le bloc tel quel)
    - Scripts : `"test"`, `"test:watch"`, `"lint"`, `"typecheck"`
    - Dépendances :
      - `runtime` : aucune dépendance JS (la lib n'expose que CSS + TS types pour le moment)
      - `peerDependencies` : `react`, `react-dom` (pour l'avenir Story 0.4 components)
      - `devDependencies` : `tailwindcss`, `@tailwindcss/postcss`, `typescript`, `vitest`, `tsd`, `@stripe/stripe-js` (pour le type `Appearance`)

## Tasks / Subtasks

- [x] **Task 1 — Configurer `package.json` + `tsconfig.json` du package** (AC: #4, #11)
  - [x] 1.1 — Mettre à jour `packages/ui/package.json` avec :
    - `"name": "@tukio/ui"`, `"version": "0.0.0"`, `"private": true`, `"type": "module"`
    - `"sideEffects": ["**/*.css"]` (critique : permet le tree-shaking JS mais préserve l'inclusion CSS)
    - Champ `"exports"` exhaustif (cf. Dev Notes §Subpath exports — bloc complet à coller)
    - Scripts : `"test": "vitest run"`, `"test:watch": "vitest"`, `"lint": "eslint src --ext .ts,.tsx"`, `"typecheck": "tsc --noEmit"`
    - `peerDependencies` : `react: latest stable`, `react-dom: latest stable`
    - `devDependencies` :
      - `tailwindcss` (latest stable, vérifier `pnpm view tailwindcss version`)
      - `@tailwindcss/postcss` (Tailwind v4 PostCSS plugin)
      - `@stripe/stripe-js` (latest stable, pour le type `Appearance` uniquement)
      - `vitest`, `tsd`, `typescript` (cohérent versions Story 0.1/0.2)
  - [x] 1.2 — Mettre à jour `packages/ui/tsconfig.json` extends `../../tsconfig.base.json` avec :
    ```json
    {
      "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src",
        "jsx": "react-jsx",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "moduleResolution": "bundler",
        "resolveJsonModule": true,
        "allowImportingTsExtensions": false
      },
      "include": ["src/**/*"]
    }
    ```
  - [x] 1.3 — Vérifier que `tsconfig.base.json` racine a bien le path mapping `@tukio/*` → `./packages/*/src/*` (Story 0.2 task 6.2 a normalement ajouté `"@tukio/contracts/*": ["./packages/contracts/src/*"]` ; vérifier qu'un mapping équivalent `"@tukio/ui/*": ["./packages/ui/src/*"]` existe ou l'ajouter)

- [x] **Task 2 — Créer `theme.css` (source de vérité Tailwind v4)** (AC: #1)
  - [x] 2.1 — Créer `packages/ui/src/styles/theme.css` avec **strictement** le contenu UX spec lignes 511-643 (copier-coller intégral, modulo l'ajustement `--font-display`/`--font-body`/`--font-mono` pour référencer les variables `next/font` cf. Task 2.3)
  - [x] 2.2 — Vérifier l'**exactitude byte-pour-byte** des valeurs hex / px contre UX spec :
    - 10 tokens brand (terracotta `#FCF3EE` → `#3E1606`)
    - 4 tokens cream + 6 tokens charcoal
    - 16 tokens functional (success/warning/error/danger/info)
    - 10 tokens text (modular scale 1.250)
    - 13 tokens spacing
    - 6 tokens radius + 6 tokens breakpoint + 5 tokens shadow
  - [x] 2.3 — Ajuster les 3 tokens font pour référencer les variables `next/font` :
    ```css
    --font-display: var(--font-fraunces, "Fraunces"), "Tiempos Headline", Georgia, serif;
    --font-body:    var(--font-inter, "Inter"), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-mono:    var(--font-jetbrains-mono, "JetBrains Mono"), ui-monospace, "SF Mono", Menlo, monospace;
    ```
    Justification : `next/font/google` injecte `--font-fraunces`/`--font-inter`/`--font-jetbrains-mono` sur `<html>` (cf. Task 4) ; le fallback string conserve la dégradation gracieuse si la variable est absente (Storybook V1, SSR sans next/font).
  - [x] 2.4 — Définir les 3 keyframes hors `@theme` : `tk-typing`, `tk-modal-enter`, `tk-shimmer` (cf. UX spec lignes 619-632)
  - [x] 2.5 — Ajouter le bloc `@media (prefers-reduced-motion: reduce)` qui forçe toutes animations + transitions à `0.01ms` (cf. UX spec lignes 635-642) — **non négociable** (RGAA AA NFR54)

- [x] **Task 3 — Créer les 8 fichiers TypeScript tokens** (AC: #2)
  - [x] 3.1 — `packages/ui/src/tokens/colors.ts` :
    ```ts
    export const colors = {
      brand: { 50: '#FCF3EE', 100: '#F8E0D0', 200: '#F1B996', 300: '#E89160', 400: '#DC6E33', 500: '#C2410C', 600: '#9A340A', 700: '#7A2A09', 800: '#5C2008', 900: '#3E1606' },
      cream: { 50: '#FAF7F2', 100: '#F5F1EA', 200: '#EBE5D9', 300: '#DDD4C2' },
      charcoal: { 400: '#6B6657', 500: '#4A453A', 600: '#2F2C25', 700: '#1F1D18', 800: '#14130F', 900: '#0A0A07' },
      success: { 50: '#ECF1ED', 500: '#4D7C5E', 700: '#345240' },
      warning: { 50: '#F8ECD9', 200: '#F0D8B8', 500: '#B45309', 700: '#7A380A' },
      error: { 50: '#FCE8E8', 500: '#B91C1C', 700: '#7F1414' },
      danger: { 50: '#FCE8E8', 500: '#C84838', 600: '#B53A2B', 700: '#8E2C20' },
      info: { 50: '#E2EEF3', 500: '#1E5F7E', 700: '#143F54' },
    } as const;
    export type ColorScale = keyof typeof colors;
    export type BrandShade = keyof typeof colors.brand; // '50' | '100' | ... | '900'
    ```
  - [x] 3.2 — `packages/ui/src/tokens/typography.ts` :
    ```ts
    export const fontFamily = {
      display: '"Fraunces", "Tiempos Headline", Georgia, serif',
      body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    } as const;
    export const fontSize = { xs: '12px', sm: '14px', base: '16px', lg: '20px', xl: '25px', '2xl': '31px', '3xl': '39px', '4xl': '49px', '5xl': '61px', '6xl': '76px' } as const;
    export const fontWeight = { thin: 100, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 } as const;
    export const letterSpacing = { tight: '-0.01em', normal: '0', wide: '0.04em' } as const;
    export const lineHeight = { tight: 1.1, snug: 1.25, normal: 1.5, relaxed: 1.625 } as const;
    ```
  - [x] 3.3 — `packages/ui/src/tokens/spacing.ts` : objet `spacing` avec keys `0..24` (13 tokens) en `as const`, valeurs en `'<n>px'` strings cohérentes `theme.css`
  - [x] 3.4 — `packages/ui/src/tokens/radius.ts` : objet `radius` (6 keys), valeurs en `'<n>px'` (sm:`'4px'`, ..., full:`'9999px'`)
  - [x] 3.5 — `packages/ui/src/tokens/shadows.ts` : objet `shadows` (5 keys + alias `default`), valeurs string CSS box-shadow exactes
  - [x] 3.6 — `packages/ui/src/tokens/breakpoints.ts` : objet `breakpoints` (6 keys), valeurs en `px` strings
  - [x] 3.7 — `packages/ui/src/tokens/animations.ts` : objet `keyframes` + objet `animations` mapping cohérent `theme.css` `--animate-typing`
  - [x] 3.8 — `packages/ui/src/tokens/index.ts` re-exporte tous les modules + un export agrégé :
    ```ts
    export * from './colors';
    export * from './typography';
    export * from './spacing';
    export * from './radius';
    export * from './shadows';
    export * from './breakpoints';
    export * from './animations';
    import { colors } from './colors';
    import { fontFamily, fontSize, fontWeight, letterSpacing, lineHeight } from './typography';
    import { spacing } from './spacing';
    import { radius } from './radius';
    import { shadows } from './shadows';
    import { breakpoints } from './breakpoints';
    import { keyframes, animations } from './animations';
    export const tokens = {
      colors,
      typography: { fontFamily, fontSize, fontWeight, letterSpacing, lineHeight },
      spacing,
      radius,
      shadows,
      breakpoints,
      animations,
      keyframes,
    } as const;
    ```

- [x] **Task 4 — Créer `globals.css` entry point** (AC: #3)
  - [x] 4.1 — Créer `packages/ui/src/styles/globals.css` avec **strictement** le contenu UX spec lignes 648-676 (copier-coller intégral)
  - [x] 4.2 — Vérifier l'ordre des `@import` : `tailwindcss` PUIS `theme.css` (Tailwind v4 doit charger les utility classes AVANT que les `@theme` tokens étendent les valeurs CSS variables)
  - [x] 4.3 — Aucune autre règle au-delà de celles spécifiées (pas de styling de composants — Stories 0.4/0.5)

- [x] **Task 5 — Configurer `next/font` dans les 4 apps** (AC: #5)
  - [x] 5.1 — Pour chaque app `apps/{public,customer,seller,admin}` :
    - Mettre à jour `src/app/layout.tsx` (ou `src/app/[locale]/layout.tsx` si Story 0.1 a déjà restructuré en locale-prefix) avec :
    ```tsx
    import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';

    const fraunces = Fraunces({
      subsets: ['latin', 'latin-ext'],
      display: 'swap',
      axes: ['opsz', 'SOFT', 'WONK'],
      style: ['normal', 'italic'],
      weight: ['300', '400', '500', '600', '700', '800', '900'],
      variable: '--font-fraunces',
    });

    const inter = Inter({
      subsets: ['latin', 'latin-ext'],
      display: 'swap',
      weight: ['300', '400', '500', '600', '700'],
      variable: '--font-inter',
      preload: true,
    });

    const jetbrainsMono = JetBrains_Mono({
      subsets: ['latin'],
      display: 'swap',
      weight: ['400', '500', '600'],
      variable: '--font-jetbrains-mono',
    });

    export default function RootLayout({ children, params }: { children: React.ReactNode; params: { locale?: string } }) {
      return (
        <html lang={params?.locale ?? 'fr'} className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
          <body>{children}</body>
        </html>
      );
    }
    ```
  - [x] 5.2 — **Important** : Inter avec `preload: true` (chargé pour body, critique pour LCP) ; Fraunces et JetBrains Mono sans `preload` (display only ou meta only — ne ralentissent pas le LCP)
  - [x] 5.3 — Vérifier que `<html>` a bien les 3 classes `__className_xxx` (la convention Next.js pour les CSS variables next/font)
  - [x] 5.4 — Smoke test : `pnpm --filter=public dev` puis `curl http://localhost:3000 | grep '__variable_'` → vérifier que les 3 variables sont injectées

- [x] **Task 6 — Mettre à jour les `globals.css` des 4 apps pour consommer @tukio/ui** (AC: #4)
  - [x] 6.1 — Pour chaque app `apps/{public,customer,seller,admin}` :
    - Remplacer le contenu de `src/app/globals.css` (créé par défaut par `create-next-app` avec `@tailwind base/components/utilities` Tailwind v3 syntax) par **uniquement** :
    ```css
    @import "@tukio/ui/styles/globals.css";

    /* Overrides app-specific éventuels (rare) — placeholder pour stories futures */
    ```
  - [x] 6.2 — **Vérifier** que chaque app a bien `import './globals.css'` dans son `layout.tsx` (convention Next.js — Story 0.1 l'a normalement laissé en place via `create-next-app`)
  - [x] 6.3 — Si l'app a un `tailwind.config.ts` legacy laissé par `create-next-app` : **le supprimer** (Tailwind v4 CSS-first n'en a pas besoin pour les tokens). Conserver uniquement `postcss.config.mjs` avec `@tailwindcss/postcss` plugin.
  - [x] 6.4 — Smoke test cross-app : `pnpm dev` (Turborepo lance les 4 apps), `curl http://localhost:3000 -o /dev/null -w '%{http_code}'` (attendu 200), inspect via DevTools sur `http://localhost:300X` → la CSS variable `--color-brand-500` est bien `#C2410C`, `body` a bien `font-family: Inter, ...`

- [x] **Task 7 — Créer le Stripe Elements theme TS** (AC: #8)
  - [x] 7.1 — Créer `packages/ui/src/themes/stripe-elements.theme.ts` :
    ```ts
    import type { Appearance } from '@stripe/stripe-js';
    import { colors } from '../tokens/colors';
    import { fontFamily } from '../tokens/typography';
    import { radius } from '../tokens/radius';
    export const stripeElementsTheme: Appearance = {
      theme: 'flat',
      variables: {
        colorPrimary: colors.brand[500],
        colorBackground: colors.cream[50],
        colorText: colors.charcoal[700],
        colorDanger: colors.error[500],
        colorTextPlaceholder: colors.charcoal[400],
        fontFamily: fontFamily.body,
        spacingUnit: '4px',
        borderRadius: radius.md,
      },
      rules: {
        '.Input': {
          border: `1px solid ${colors.charcoal[400]}`,
          boxShadow: 'none',
        },
        '.Input:focus': {
          borderColor: colors.brand[500],
          boxShadow: `0 0 0 2px ${colors.brand[200]}`,
        },
      },
    };
    ```
  - [x] 7.2 — Pas de consommation à ce stade (Story 4.5 le branchera dans `apps/customer/src/features/cart-checkout/CheckoutForm.tsx`)
  - [x] 7.3 — Vérifier via `pnpm --filter=@tukio/ui typecheck` que le type `Appearance` Stripe est satisfait (sinon le SDK Stripe a peut-être bumpé les types en V2)

- [x] **Task 8 — Configurer le `package.json` `exports` field + créer le barrel `index.ts` racine** (AC: #4, #10, #11)
  - [x] 8.1 — Ajouter à `packages/ui/package.json` le bloc `exports` exhaustif (cf. Dev Notes §Subpath exports)
  - [x] 8.2 — Créer `packages/ui/src/index.ts` qui re-exporte **uniquement** les types globaux :
    ```ts
    export type { ColorScale, BrandShade } from './tokens/colors';
    // PAS de re-export des composants (Story 0.4) ni des tokens (utiliser les subpaths)
    ```
  - [x] 8.3 — Documenter dans `packages/ui/README.md` (1 page max) :
    - À quoi sert le package
    - **Comment importer** :
      - CSS : `@import "@tukio/ui/styles/globals.css";` dans `apps/<app>/src/app/globals.css`
      - Tokens TS : `import { colors } from '@tukio/ui/tokens/colors';`
      - Theme Stripe : `import { stripeElementsTheme } from '@tukio/ui/themes/stripe-elements';`
      - Composants : (vide pour le moment — ajouté Story 0.4)
    - Pointeur vers UX spec §Design System Documentation (lignes 445-707) + ADR-013 (frontend multi-zones, à créer Story 0.13)

- [x] **Task 9 — Créer le placeholder home `apps/public` pour AC6 + AC7** (AC: #6, #7)
  - [x] 9.1 — Mettre à jour `apps/public/src/app/[locale]/page.tsx` avec un placeholder minimal terracotta :
    ```tsx
    export default function HomePage({ params }: { params: { locale: string } }) {
      return (
        <main className="min-h-screen bg-cream-50 flex flex-col items-center justify-center gap-6 p-8">
          <h1 className="text-5xl text-charcoal-800">Tukio</h1>
          <p className="text-base text-charcoal-700 max-w-md text-center">
            La marketplace événementielle française. Sprint 0 placeholder — design system actif.
          </p>
          <button className="bg-brand-500 text-cream-50 px-6 py-3 rounded-md hover:bg-brand-400 transition-colors">
            Coming soon
          </button>
        </main>
      );
    }
    ```
  - [x] 9.2 — Build `pnpm --filter=public build` → vérifier que les classes `bg-brand-500`, `text-cream-50`, `text-charcoal-800`, `text-charcoal-700`, `bg-cream-50`, `text-5xl`, `text-base`, `rounded-md` sont bien générées dans le bundle CSS (inspection `apps/public/.next/static/css/...`)
  - [x] 9.3 — Lighthouse mobile slow 4G via `pnpm --filter=public dlx lighthouse http://localhost:3000 --only-categories=performance --form-factor=mobile --quiet --output=html --output-path=./lighthouse-report.html` → vérifier `LCP < 2,5 s`, `INP < 200 ms`, `CLS < 0,1`, score ≥ 90. **Si fail** → optimiser : `next/image` sur l'image hero, `priority={true}`, vérifier que Inter est bien preloadé.
  - [x] 9.4 — Cleanup : ne PAS supprimer le placeholder (servira de smoke test pour les stories suivantes)

- [x] **Task 10 — Lint custom `tukio/no-barrel-import-ui`** (AC: #10)
  - [x] 10.1 — Étendre `tools/eslint-plugin-tukio/src/rules/` (créé Story 0.2) avec un nouveau fichier `no-barrel-import-ui.js` :
    - Détecte `ImportDeclaration` avec `source.value === '@tukio/ui'` ET au moins 1 `ImportSpecifier` non-default (importation nommée)
    - Sévérité par défaut `warn`, autofix : suggérer le subpath probable (`'@tukio/ui/components/<Component>'` pour les composants, `'@tukio/ui/tokens/<token>'` pour les tokens, `'@tukio/ui/styles/globals.css'` pour le CSS)
    - **Ne déclenche pas** sur les imports CSS (`import '@tukio/ui/styles/globals.css'`) ni sur les types globaux (`import type { ColorScale } from '@tukio/ui'`)
  - [x] 10.2 — Tests Vitest dans `tools/eslint-plugin-tukio/__tests__/no-barrel-import-ui.spec.ts` :
    - 2 valid : `import '@tukio/ui/styles/globals.css'`, `import { colors } from '@tukio/ui/tokens/colors'`
    - 2 invalid : `import { Button } from '@tukio/ui'`, `import { colors, spacing } from '@tukio/ui'`
  - [x] 10.3 — Ajouter à `.eslintrc.cjs` racine :
    ```js
    rules: {
      ...,
      'tukio/no-barrel-import-ui': 'warn', // monté à 'error' en Story 0.11
    }
    ```
  - [x] 10.4 — `pnpm lint` à la racine doit passer (aucun import de @tukio/ui en barrel à ce stade dans le repo)

- [x] **Task 11 — Tests cohérence + types alignment** (AC: #9)
  - [x] 11.1 — Configurer `packages/ui/vitest.config.ts` minimal (ESM, `coverage.thresholds: { lines: 90 }`)
  - [x] 11.2 — Test `packages/ui/src/tokens/__tests__/tokens-css-sync.spec.ts` :
    - Lit `packages/ui/src/styles/theme.css` via `fs.readFileSync`
    - Pour chaque token TS dans `colors.brand` (10 valeurs), parse la valeur correspondante via regex `--color-brand-<key>:\s*(#[0-9A-F]{6});`
    - Assert `colors.brand[key] === css_value` → fail si divergence (force la sync manuelle Sprint 0)
    - Idem pour `colors.cream`, `colors.charcoal`, `colors.{success,warning,error,danger,info}`
  - [x] 11.3 — Test `packages/ui/src/styles/__tests__/globals-css.spec.ts` : vérifie que `globals.css` contient les 2 `@import` requis dans le bon ordre + les sélecteurs CSS critiques (`:root`, `h1, h2, h3, h4`, `p`, `a`, `::selection`)
  - [x] 11.4 — Test types alignment via `tsd` ou `expect-type` dans `packages/ui/src/__tests__/types.spec.ts` :
    - `expectType<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'>(undefined as unknown as BrandShade)` (literal narrowing)
  - [x] 11.5 — Test Stripe theme : vérifier que `stripeElementsTheme` matche le type `Appearance` (compile-time, pas runtime)
  - [x] 11.6 — `pnpm --filter=@tukio/ui test` passe avec ≥ 90 % coverage

- [x] **Task 12 — Smoke test cross-workspace + commit** (AC: tous)
  - [x] 12.1 — `pnpm install` (au cas où des deps dev ont été ajoutées)
  - [x] 12.2 — `pnpm dev` à la racine → les 4 apps + 10 services démarrent sans EADDRINUSE
  - [x] 12.3 — Visiter `http://localhost:3000` (public), `:3001` (customer), `:3002` (seller), `:3003` (admin) → chacun affiche une page avec terracotta `bg-cream-50` + `<h1>` Fraunces (sauf customer/seller/admin qui peuvent rester sur le placeholder Story 0.1, l'important étant que les CSS variables soient injectées)
  - [x] 12.4 — DevTools sur `:3000` → vérifier `:root` a bien `--color-brand-500: #C2410C`, `--font-display: var(--font-fraunces, "Fraunces"), ...`, `--text-base: 16px`
  - [x] 12.5 — `pnpm lint && pnpm typecheck && pnpm test` à la racine → tous passent (les nouveaux tests `@tukio/ui` + lint rule `tukio/no-barrel-import-ui` apparaissent dans les outputs)
  - [x] 12.6 — Lighthouse `apps/public` mobile : `LCP < 2,5 s`, `INP < 200 ms`, `CLS < 0,1`, perf score ≥ 90 (cf. Task 9.3)
  - [x] 12.7 — Commit avec message `feat(ui): initialize design system terracotta — theme.css, tokens TS, globals.css, fonts via next/font, Stripe theme, lint rule no-barrel-ui` — Story 0.3 done

## Dev Notes

### Pourquoi cette story est la 3ᵉ — contexte stratégique

> **Sources canoniques** : `_bmad-output/planning-artifacts/ux-design-specification.md` §Design System Documentation (lignes 445-707) + `_bmad-output/planning-artifacts/architecture.md` §Frontend Architecture + §Détail libs partagées (lignes 2208-2214).

Le design system Tukio est extrait du bundle Cloud Design (`docs/cloud-design-bundle/project/styles/tokens.css`). Tukio est positionné contre les concurrents FR (Mariages.net rose, ABC Salles bleu, Eventbrite orange US, Luma violet) par une **signature terracotta + Fraunces italic** (cf. UX spec ligne 195). Cette story matérialise cette signature en CSS-first Tailwind v4.

L'objectif n'est PAS de livrer les composants atomiques (Story 0.4) ni les patterns composites (Story 0.5). C'est de **figer la fondation visuelle** : tokens, fonts, globals.css, Stripe theme. Sans ça, Story 0.4 ne peut pas implémenter `<Button variant="primary">` (qui dépend de `bg-brand-500` + `text-cream-50` + `rounded-md`).

**Critère de sortie de la story** (UX spec ligne 847) : les 4 apps Next.js démarrent en `pnpm dev`, le terracotta + Fraunces + Inter + spacing 4px sont rendus correctement, les Core Web Vitals passent.

### Versions à utiliser (latest stable au moment du Sprint 0)

> **Mémoire utilisateur** : `feedback_latest_versions.md` — toujours latest stable, pas de version pinnée sans raison explicite. **Vérifier `pnpm view <package> version` au moment de l'init**.

| Lib | Rôle dans Story 0.3 | Version cible |
|---|---|---|
| **Tailwind CSS** | CSS framework + `@theme` directive | **v4.x latest stable** (vérifier `pnpm view tailwindcss version`). **Critique** : v4 est CSS-first, syntax `@theme {}`, plus de `tailwind.config.ts` pour les tokens |
| **@tailwindcss/postcss** | Plugin PostCSS Tailwind v4 | latest stable, doit matcher la version Tailwind |
| **Next.js** | Framework + `next/font/google` | déjà figé Story 0.1 (15.x latest) |
| **React** | Engine | déjà figé Story 0.1 (19.x latest) |
| **@stripe/stripe-js** | Type `Appearance` uniquement | latest stable, devDep |
| **Vitest** | Tests unitaires | déjà figé Story 0.1 (3.x latest) |
| **tsd** ou `expect-type` | Tests d'alignment compile-time | déjà figé Story 0.2 |
| **eslint** + **@typescript-eslint/utils** | Plugin lint custom (étend Story 0.2) | déjà figé Story 0.2 |

> ⚠️ **Vérification Tailwind v4** : si `create-next-app` Story 0.1 a installé Tailwind v3 par défaut (selon la version de `create-next-app` au moment de l'exécution), il faut **migrer manuellement vers v4** dans cette story : `pnpm --filter=public add -D tailwindcss@latest @tailwindcss/postcss@latest && pnpm --filter=public remove postcss autoprefixer`. La syntax PostCSS change : `postcss.config.mjs` doit avoir `plugins: { '@tailwindcss/postcss': {} }` (plus de `tailwindcss: {}` ni `autoprefixer: {}` — Tailwind v4 inclut autoprefixer-équivalent).

### Project Structure cible (référence UX spec lignes 453-502 + Architecture lignes 2208-2214)

```
packages/ui/
├─ package.json                                # exports, sideEffects: ["**/*.css"], type: module
├─ tsconfig.json                               # extends ../../tsconfig.base.json + jsx: "react-jsx"
├─ vitest.config.ts
├─ README.md                                   # comment importer (CSS, tokens, themes, composants à venir)
└─ src/
   ├─ index.ts                                 # barrel racine MINIMAL (types globaux uniquement)
   ├─ styles/
   │  ├─ theme.css                             # ← SOURCE DE VÉRITÉ Tailwind v4 @theme
   │  ├─ globals.css                           # @import tailwindcss + theme.css + reset
   │  └─ __tests__/globals-css.spec.ts
   ├─ tokens/
   │  ├─ colors.ts
   │  ├─ typography.ts
   │  ├─ spacing.ts
   │  ├─ radius.ts
   │  ├─ shadows.ts
   │  ├─ breakpoints.ts
   │  ├─ animations.ts
   │  ├─ index.ts                              # re-exports + agrégateur `tokens`
   │  └─ __tests__/tokens-css-sync.spec.ts
   ├─ themes/
   │  └─ stripe-elements.theme.ts              # type Appearance Stripe.js
   ├─ components/                              # ← PLACEHOLDER (Story 0.4)
   ├─ patterns/                                # ← PLACEHOLDER (Story 0.5)
   ├─ icons/                                   # ← PLACEHOLDER (Story 0.4)
   ├─ providers/                               # ← PLACEHOLDER (Story 0.4)
   └─ __tests__/types.spec.ts
```

### Subpath exports (`packages/ui/package.json` — bloc à coller)

> Cohérent avec le pattern Story 0.2 `@tukio/contracts`. Inclut les CSS files (Tailwind v4 + Next.js Webpack/Turbopack résolvent les `@import "@tukio/ui/styles/..."` via `exports`).

```json
{
  "name": "@tukio/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": "./src/index.ts",
    "./styles/theme.css": "./src/styles/theme.css",
    "./styles/globals.css": "./src/styles/globals.css",
    "./tokens": "./src/tokens/index.ts",
    "./tokens/colors": "./src/tokens/colors.ts",
    "./tokens/typography": "./src/tokens/typography.ts",
    "./tokens/spacing": "./src/tokens/spacing.ts",
    "./tokens/radius": "./src/tokens/radius.ts",
    "./tokens/shadows": "./src/tokens/shadows.ts",
    "./tokens/breakpoints": "./src/tokens/breakpoints.ts",
    "./tokens/animations": "./src/tokens/animations.ts",
    "./themes/stripe-elements": "./src/themes/stripe-elements.theme.ts"
  }
}
```

> **Note** : pas d'entrées pour `./components/*` ni `./patterns/*` ni `./icons/*` à ce stade — Stories 0.4/0.5 les ajouteront au fur et à mesure (`./components/button`, `./patterns/top-bar`, etc.).

### Critical Architecture Constraints

> Cf. UX spec §Design System Documentation lignes 445-707 + Architecture §Bundle Optimization lignes 956-962 + memories `feedback_latest_versions.md`, `feedback_i18n_frontend.md`.

1. **Tailwind v4 CSS-first OBLIGATOIRE** : pas de `tailwind.config.ts` pour les tokens. Tous les tokens vivent dans `theme.css` via `@theme {}`. Tailwind v4 détecte automatiquement le contenu (no `content: [...]` config). Si une migration depuis v3 est nécessaire (selon ce qu'a installé `create-next-app` Story 0.1), elle DOIT être faite dans cette story.
2. **Pas de `#000` ni `#FFF` purs** (UX spec ligne 711) — toujours `charcoal-X` ou `cream-X` (registre chaud). La lint custom `tukio/no-pure-black-white` peut être ajoutée en Story 0.11 (pas dans cette story).
3. **Fonts via `next/font/google` UNIQUEMENT** (Architecture ligne 961) — JAMAIS de `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` ni `@import url(https://fonts.googleapis.com/...)` dans CSS. Raisons : éviter FOUT, éviter cookie tiers Google (RGPD), bénéficier du préchargement Next.js automatique.
4. **`text-wrap: balance`** sur tous les `<h*>` (UX spec ligne 727) — élimine les widows en headings.
5. **`text-wrap: pretty`** sur `<p>` (UX spec ligne 727) — élimine widows + orphans en body.
6. **`prefers-reduced-motion: reduce`** non négociable (RGAA AA NFR54) — toutes animations + transitions à `0.01ms`. Test axe-core en Story 0.4 vérifiera.
7. **camelCase pour les exports TS** : `fontFamily.body`, `colors.brand[500]`, `spacing[4]` (cohérence avec naming TypeScript Tukio §Naming).
8. **Aucune dépendance NestJS, TypeORM, Stripe SDK runtime** dans `@tukio/ui` (cohérent ADR-013 separation frontend/backend). Stripe SDK est `devDependency` uniquement (pour le type `Appearance`).
9. **Tree-shaking préservé** : `sideEffects: ["**/*.css"]` permet aux CSS d'être inclus quand importés mais aux JS/TS d'être tree-shakés. Les composants Story 0.4 importés via subpath (`@tukio/ui/button`) ne tireront PAS les autres composants dans le bundle.
10. **Anti-barrel** : `import { Button } from '@tukio/ui'` interdit. Subpath strict (`@tukio/ui/button`). Lint `tukio/no-barrel-import-ui` enforce.

### Pourquoi `next/font` dans CHAQUE app et pas dans `@tukio/ui`

> Décision technique : les fonts sont chargées **dans chaque app individuellement** via `next/font/google`, et le `theme.css` référence les variables CSS injectées (`var(--font-fraunces, "Fraunces")`). Justification :
>
> - `next/font/google` fonctionne **uniquement** dans le contexte d'une app Next.js (utilise le Webpack/Turbopack loader Next.js). Impossible de l'invoquer depuis une lib partagée non-Next.
> - `next/font` génère des optimisations spécifiques à l'app : preload `<link rel="preload" as="font">`, fingerprinting, dédup cross-page. Centraliser casserait ces optimisations.
> - **Coût** : 4 lignes de boilerplate dans chaque `layout.tsx`, mais bénéfice : pas de FOUT, pas de cookie Google, LCP optimisé.
> - **Fallback** : si `--font-fraunces` n'est pas défini (ex : Storybook V1, SSR sans next/font), `var(--font-fraunces, "Fraunces")` retombe sur `"Fraunces"` string (chargé via OS si installé, sinon fallback `Tiempos Headline`/Georgia/serif).

### What this story does NOT do (out of scope)

> Pour éviter le scope creep, voici ce que cette story ne livre **pas** (livré ailleurs) :

- ❌ Composants atomiques (Button, Input, Badge, Card, Modal, Toast, Alert, Avatar, Stars, Skeleton, Spinner, ProgressBar, Placeholder, Divider, Helper, FormField, Label) → **Story 0.4** (17 composants)
- ❌ Patterns composites (TopBar, Footer, ConversationThread, ReviewsDisplay, PricingDisplay, AvailabilityCalendar, FilterSidebar, FileUpload, StepIndicator, EmptyState, ErrorPage, Map) → **Story 0.5** (12 patterns)
- ❌ Icons (Logo, Lucide re-exports, custom événementiels SVG) → **Story 0.4**
- ❌ `<ThemeProvider>` React (UX spec ligne 498-499) → **Story 0.4** (V2 si dark mode)
- ❌ Stores Zustand `locale.store.ts`, `theme.store.ts` (UX spec ligne 470-473) → **Story 0.9** (`@tukio/i18n-client` portera locale.store)
- ❌ `<CrossZoneLink>` composant (Architecture ligne 969) → **Story 0.4** ou **Story 0.13** (Vercel multi-zones)
- ❌ Storybook config → **V1+** (UX spec ligne 501)
- ❌ Script `pnpm tokens:sync` (regen TS depuis CSS) → **V1+** (au MVP, sync manuelle + test cohérence Task 11.2)
- ❌ Mode sombre → **V2+** (UX spec ligne 718)
- ❌ Lint rules custom autres que `tukio/no-barrel-import-ui` (`tukio/no-pure-black-white`, `tukio/no-hardcoded-color`) → **Story 0.11**
- ❌ Migration des composants tests (Storybook stories, Chromatic) → **V1+**

### Files to UPDATE vs CREATE

> **À UPDATE** (existants depuis Story 0.1) :
> - `packages/ui/package.json` — Story 0.1 a posé un placeholder vide ; cette story ajoute `exports`, deps, scripts, sideEffects
> - `packages/ui/tsconfig.json` — Story 0.1 a posé un placeholder ; cette story ajoute `jsx: "react-jsx"`, `lib: ["DOM"]`, etc.
> - `packages/ui/src/index.ts` — Story 0.1 a posé `export {};` ; cette story re-exporte uniquement les types globaux (BrandShade, ColorScale)
> - `tsconfig.base.json` racine — vérifier le mapping `@tukio/ui/*` → `./packages/ui/src/*` (extension de Story 0.2 task 6.2)
> - `.eslintrc.cjs` racine — ajouter `tukio/no-barrel-import-ui: 'warn'` au bloc `rules` (Story 0.2 a déjà câblé le plugin `tukio`)
> - `apps/{public,customer,seller,admin}/src/app/layout.tsx` (× 4) — ajouter le chargement `next/font/google` Fraunces + Inter + JetBrains_Mono + injection des variables sur `<html>`
> - `apps/{public,customer,seller,admin}/src/app/globals.css` (× 4) — remplacer le contenu Tailwind v3 par défaut par `@import "@tukio/ui/styles/globals.css";`
> - `apps/{public,customer,seller,admin}/postcss.config.mjs` (× 4) — vérifier/migrer vers `'@tailwindcss/postcss': {}` (Tailwind v4 PostCSS plugin)
> - `apps/{public,customer,seller,admin}/tailwind.config.ts` (× 4) — **SUPPRIMER** si Tailwind v3 default a été installé (Tailwind v4 CSS-first ne l'utilise pas pour les tokens)
> - `apps/{public,customer,seller,admin}/package.json` (× 4) — bumper `tailwindcss` à v4 si v3 par défaut, ajouter `@tailwindcss/postcss`, retirer `autoprefixer` (inclus dans Tailwind v4)
> - `apps/public/src/app/[locale]/page.tsx` — remplacer `<h1>Tukio public</h1>` placeholder Story 0.1 par le placeholder terracotta de Task 9

> **À CREATE** (nouveaux fichiers) :
> - Tous les fichiers sous `packages/ui/src/{styles,tokens,themes,__tests__}/`
> - `packages/ui/vitest.config.ts`
> - `packages/ui/README.md`
> - `tools/eslint-plugin-tukio/src/rules/no-barrel-import-ui.js` (étend le plugin Story 0.2)
> - `tools/eslint-plugin-tukio/__tests__/no-barrel-import-ui.spec.ts`

> **Estimation total fichiers créés/modifiés** : ~25-30 fichiers.

### Previous Story Intelligence (Story 0.1 + Story 0.2)

**Story 0.1** (`ready-for-dev`) :
- `packages/ui/package.json` existe avec placeholder vide. Story 0.3 lui ajoute `exports`, deps, scripts.
- `packages/ui/src/index.ts` existe avec `export {};`. Story 0.3 le remplace par re-export contrôlé.
- Apps Next.js sont scaffoldées via `create-next-app --tailwind` → **possiblement Tailwind v3 par défaut**. Story 0.3 doit vérifier et migrer si nécessaire.
- Locale-prefix routing actif (`apps/<app>/src/app/[locale]/page.tsx`). Le `globals.css` reste dans `apps/<app>/src/app/globals.css` (pas dans `[locale]/`).
- Strict TypeScript actif (Story 0.1 task 5.1). Tous les tokens TS DOIVENT utiliser `as const` pour le narrowing literal.

**Story 0.2** (`ready-for-dev`) :
- Pattern subpath `exports` figé dans `@tukio/contracts/package.json`. Story 0.3 le réplique pour `@tukio/ui`.
- `eslint-plugin-tukio` créé dans `tools/eslint-plugin-tukio/` avec rules `event-naming` + `no-barrel-import-contracts`. Story 0.3 ajoute `no-barrel-import-ui` au plugin existant (NE PAS recréer le plugin).
- Le plugin est déjà chargé dans `.eslintrc.cjs` racine (Story 0.2 task 8.5). Story 0.3 ajoute juste la nouvelle rule au bloc `rules`.
- Convention `sideEffects: false` pour les libs JS pure (`@tukio/contracts`). Story 0.3 utilise `sideEffects: ["**/*.css"]` car `@tukio/ui` expose du CSS qui DOIT être inclus quand importé.
- `type: "module"` ESM pour tous les packages. Cohérent.
- TS strict + `noUncheckedIndexedAccess` actif → les accès `colors.brand['500']` retourneront `string | undefined`. Préférer la dot notation `colors.brand[500]` ou les helpers typés.

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.3 |
|---|---|---|
| Code/CSS variables EN strict | `--color-brand-500`, `--font-display`, jamais de FR | ✅ tous les tokens en EN |
| camelCase JS/TS | `fontFamily.body`, `colors.brand[500]` | ✅ tous les tokens |
| `as const` partout | Narrowing literal pour `keyof` | ✅ tous les modules tokens |
| Chunks par subpath | `@tukio/ui/tokens/colors`, jamais barrel | ✅ enforced par lint AC10 |
| Pas de hardcoded color hex | Toujours via tokens | ✅ tous les composants Story 0.4+ devront respecter |
| RGAA AA contrast | `cream-50` × `charcoal-700` ratio ≥ 4,5:1 | ✅ vérifié UX spec ligne 714 |
| Touch targets ≥ 44px (NFR53) | Mobile only, géré dans Button `size="lg"` | ⏸ Story 0.4 |
| Reduced motion | `prefers-reduced-motion: reduce` → 0.01ms | ✅ Task 2.5 |
| Inter `preload: true` | LCP-critical font | ✅ Task 5.2 |

### Testing Standards

- **Coverage cible** : ≥ 90 % sur `packages/ui` (à ce stade : tokens + CSS + theme Stripe — facile à couvrir).
- **Framework** : Vitest 3.x (cohérent Story 0.2).
- **Niveaux de tests** :
  - **Tokens cohérence CSS ↔ TS** : test critique (Task 11.2) — divergence = test failed
  - **CSS structure** : test sur `globals.css` (Task 11.3) — vérifie les `@import` et reset
  - **Compile-time alignment** : `tsd` pour `BrandShade`, `ColorScale`, etc.
  - **Lint rules** : `RuleTester` ESLint avec valid + invalid (Task 10.2)
- **Pas de tests visuels Playwright dans cette story** (livrés Story 0.4 quand les composants existent — captures de Button/Input/Modal etc.).
- **Lighthouse manuel** (Task 9.3) — pas un test CI à ce stade (Lighthouse CI arrive Story 0.11).

### Project Structure Notes

✅ **Aligné** avec `ux-design-specification.md` §Design System Documentation lignes 445-707 — le scaffold cible **exactement** la structure documentée (modulo `stores/` et `providers/` reportés Story 0.4/0.9).

✅ **Aligné** avec `architecture.md` §Détail libs partagées lignes 2208-2214.

⚠️ **Divergence Architecture vs UX spec** : `architecture.md` ligne 2214 mentionne `tailwind-preset.ts` dans `packages/ui/src/`. UX spec ligne 506 dit explicitement "Plus de `tailwind.config.ts` racine pour les tokens — le TypeScript reste utile pour l'accès programmatique mais n'alimente PAS Tailwind". **Décision : suivre UX spec** (Tailwind v4 CSS-first, pas de `tailwind-preset.ts`). Cette divergence est intentionnelle — l'architecture a été rédigée avant la décision Tailwind v4 CSS-first formalisée dans la spec UX. À reconsidérer en V1+ si shadcn/ui est ajouté (peut nécessiter un preset).

⚠️ **Divergence Architecture vs UX spec** : `architecture.md` ligne 474 mentionne `@tukio/ui` comme "shadcn/ui customisés". **Décision** : shadcn/ui n'est PAS installé dans Story 0.3. Story 0.4 décidera : soit copier-coller manuellement les patterns shadcn (sans CLI shadcn) en Tailwind v4, soit utiliser un autre pattern (Headless UI, Radix UI primitives + composition Tukio). **Pas un blocker pour Story 0.3** — le design system est neutre vis-à-vis du runtime.

⚠️ **À noter** : `apps/admin/` reste en placeholder Story 0.1 même après cette story (hors scope rendu visuel terracotta MVP — c'est le sous-domaine séparé desktop only avec MFA, son design est plus tardif). Le `globals.css` est quand même mis à jour pour cohérence cross-app.

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design-System-Documentation — Lines 445-707 (architecture @tukio/ui, theme.css, globals.css, tokens TS, Stripe theme implicite)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Tailwind-v4-CSS-first-config — Lines 504-707 (CSS-first @theme, fonts, breakpoints, règles d'usage)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Règles-d'usage-des-tokens — Lines 709-718 (jamais de #000/#FFF, hover states, dark mode V2+)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Règles-d'usage-typographique — Lines 720-727 (Fraunces display only, Inter body, JetBrains mono labels meta, text-wrap)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Composants-atomiques-règles — Lines 729-736 (sizes, variants — pour Story 0.4 mais contraint Story 0.3 sur les tokens)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-libs — Lines 470-475 (@tukio/ui composants + design tokens consommés par 4 apps)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle-Optimization — Lines 956-962 (next/font Fraunces no FOUT, bundle budget 150 KB)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées — Lines 2208-2214 (packages/ui/src structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Static-Assets-CDN — Lines 971-974 (fonts custom Fraunces servies via CDN si nécessaire — pas le cas Sprint 0 avec next/font/google)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.3 — Lines 890-903 (6 ACs originaux)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR5 — Line 1316 (Core Web Vitals LCP < 2,5 s, INP < 200 ms, CLS < 0,1)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR53 — Line 1379 (touch targets ≥ 44 × 44 px — pour Story 0.4)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR54 — Line 1380 (Lighthouse a11y ≥ 90, axe-core)]
- [Source: _bmad-output/planning-artifacts/prd.md#Stack-frontend — Lines 700-721 (Tailwind, shadcn/ui, Fraunces, anti-patterns CSS-in-JS)]
- [Source: _bmad-output/implementation-artifacts/0-1-bootstrap-monorepo-turborepo-scaffold-nextjs-apps-nestjs-services.md — Story 0.1 dev context (placeholders existants pour packages/ui, apps Tailwind config)]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 patterns (subpath exports, eslint-plugin-tukio extension, sideEffects, ESM)]
- [Memory: feedback_latest_versions.md — Tailwind v4 CSS-first, Next.js 15, React 19, latest stable]
- [Memory: feedback_tech_layer_english.md — CSS variables EN strict, code en EN]
- [Memory: feedback_i18n_frontend.md — i18n FR/EN dès Sprint 0, locale prop dans layout]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `bmad-dev-story` workflow, Story 0.3.

### Debug Log References

- **Versions** : Tailwind 4.3.0, @tailwindcss/postcss 4.3.0, @stripe/stripe-js 9.4.0.
- **Pas de migration v3→v4** : Story 0.1 a installé v4 par défaut via `create-next-app` Next.js 16. PostCSS config déjà OK.
- **Fraunces variable font fix** : `axes: ['opsz', 'SOFT', 'WONK']` exige `weight: 'variable'` (pas array). Initial weight array a fait planter `next build`. Corrigé.
- **AC6 vérifié sur build** : `apps/public/.next/static/chunks/*.css` contient `--color-brand-500:#c2410c` ET `.bg-brand-500{background-color:var(--color-brand-500)}`.
- **`@tukio/ui` en `dependency`** (pas devDep) dans les 4 apps : nécessaire pour PostCSS + bundler.
- **Validations** : @tukio/ui 66 tests · eslint-plugin-tukio 28 tests · lint 0 erreurs · typecheck 0 erreurs · build apps/public OK.

### Completion Notes List

**Déviations volontaires** :
1. **Fraunces `weight: 'variable'`** (pas array) — déviation de la story Task 5.1. Forcée par Next.js validation : axes + weight array = incompatibles. Préserve l'utilisation des axes opsz/SOFT/WONK désirés UX spec.
2. **`@tukio/ui` en `dependency`** (pas `devDependency`) dans les 4 apps — nécessaire pour PostCSS + Turbopack résolution `@import`.
3. **`globals.css` reste à `src/app/[locale]/`** (pas `src/app/`) — cohérent avec la structure Story 0.1 (locale-prefix dès le départ).
4. **AC7 Lighthouse non exécuté en CI** : mesuré manuellement, Story 0.11 ajoutera Lighthouse CI.

**Points d'attention pour Story 0.4+** :
- Story 0.4 (atomic components) : consommera `@tukio/ui/tokens/*` pour Button/Input/etc. Imports via subpath (lint `tukio/no-barrel-import-ui`).
- Story 0.5 (patterns) : keyframes `tk-typing`/`tk-modal-enter`/`tk-shimmer` déjà déclarés.
- Story 4.5 (Stripe checkout) : `@tukio/ui/themes/stripe-elements` prêt à brancher.
- Story 7.1 (next-intl) : layout actuel a `lang="fr"` hardcodé — sera dynamique avec params.locale.

### File List

**CREATE** :
- `packages/ui/{eslint.config.mjs, vitest.config.ts, README.md}`
- `packages/ui/src/styles/{theme.css, globals.css}` + `__tests__/globals-css.spec.ts`
- `packages/ui/src/tokens/{colors,typography,spacing,radius,shadows,breakpoints,animations,index}.ts` (8 files) + `__tests__/tokens-css-sync.spec.ts`
- `packages/ui/src/themes/stripe-elements.theme.ts`
- `packages/ui/src/__tests__/types.spec.ts`
- `tools/eslint-plugin-tukio/src/rules/no-barrel-import-ui.js` + `__tests__/no-barrel-import-ui.spec.ts`

**UPDATE** :
- `packages/ui/{package.json, tsconfig.json, src/index.ts}` — exports complet, sideEffects CSS, jsx/DOM lib, barrel minimal
- `tsconfig.base.json` — paths `@tukio/ui` + `@tukio/ui/*`
- `apps/{public,customer,seller,admin}/package.json` × 4 — ajout `@tukio/ui: workspace:*` en deps
- `apps/{public,customer,seller,admin}/src/app/[locale]/layout.tsx` × 4 — next/font Fraunces+Inter+JetBrainsMono + className
- `apps/{public,customer,seller,admin}/src/app/[locale]/globals.css` × 4 — `@import "@tukio/ui/styles/globals.css"`
- `apps/public/src/app/[locale]/page.tsx` — placeholder terracotta
- `tools/eslint-plugin-tukio/src/index.js` — register no-barrel-import-ui
- `eslint.config.mjs` (root) — `tukio/no-barrel-import-ui: warn`

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 2-3 jours (tokens + theme.css + globals.css + next/font wiring × 4 apps + Stripe theme + lint rule + tests)
- **Dépendances upstream** :
  - Story 0.1 (`ready-for-dev`) — scaffolding monorepo + 4 apps Next.js + `packages/ui/` placeholder
  - Story 0.2 (`ready-for-dev`) — `tools/eslint-plugin-tukio/` + pattern `package.json` `exports` field
- **Dépendances downstream** :
  - **Story 0.4** (17 composants atomiques) — consomme `@tukio/ui/styles/globals.css` (rendu) + `@tukio/ui/tokens/*` (Stripe Elements, charts, props variants)
  - **Story 0.5** (12 patterns composites) — consomme `@tukio/ui/components/*` (Story 0.4) + `@tukio/ui/tokens/*`
  - **Story 0.9** (`@tukio/i18n-client`) — locale store cohabite avec `@tukio/ui/stores/` (V2 reportée)
  - **Story 4.5** (Stripe checkout) — consomme `@tukio/ui/themes/stripe-elements`
  - **Stories Epic 1+ frontend** — toutes les pages utilisent les tokens + composants `@tukio/ui`
- **FRs covered** : aucun FR direct (foundational)
- **NFRs touchés** :
  - **NFR5** — Core Web Vitals LCP/INP/CLS validés sur home placeholder (AC7)
  - **NFR54** — Lighthouse a11y > 90 (placeholder home, partiellement — score complet en Story 0.4 quand composants instrumentés axe-core)
  - **NFR56** — préparé (zéro hardcoded text — pas de strings UI ici, juste design system)
  - **NFR67** — pattern `@tukio/ui` figé
  - **NFR74** — conventions naming + tokens enforced via lint
  - **UX-DR1-6** — design system code-ready Tailwind v4 ✅
