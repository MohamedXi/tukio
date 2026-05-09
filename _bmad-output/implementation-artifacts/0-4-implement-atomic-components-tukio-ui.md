# Story 0.4: Implement 17 atomic components (@tukio/ui/components) extracted from Cloud Design bundle

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** frontend developer (équipe Sprint 0),
**I want** the **17 atomic React 19 components** implemented in `packages/ui/src/components/<Component>/` based on the Cloud Design bundle's `_shared.jsx` and `tokens.css`, with **Radix UI primitives** for les composants a11y-critiques (`Modal`, `Toast`), **`class-variance-authority` (CVA)** pour les variants typés, **Lucide React** pour les icônes, et tests Vitest + axe-core inline ≥ 80 % coverage par composant,
**so that** les 4 apps Next.js consomment 17 primitives UI **identiques visuellement et accessibles**, importées par subpath strict (`@tukio/ui/button`), prêtes à être composées dans Story 0.5 (12 patterns) puis dans toutes les stories Epic 1+ (formulaires d'auth, fiches services, modales d'acceptation booking, toasts de confirmation, etc.).

> **Outcome attendu** : à la fin de cette story, `import { Button } from '@tukio/ui/button'` rend un bouton terracotta `bg-brand-500` exactement comme `tk-btn-primary` du bundle (height 40 px, padding 0 16 px, hover `brand-400`, touch target 48 px sur mobile via `size="lg"`), `<Modal>` capture le focus + ESC ferme + click outside ferme + `aria-modal="true"`, `<Toast>` apparaît en live region polite avec swipe dismiss, et `pnpm test --filter=@tukio/ui` passe avec ≥ 80 % coverage par composant + zéro violation axe-core.

## Acceptance Criteria

1. **AC1 — 17 dossiers de composants présents avec layout standard** : Given `packages/ui/src/components/`, When je l'ouvre, Then je trouve **exactement** 17 dossiers (alphabétique) dans cette structure stricte par composant :
   ```
   <Component>/
     ├─ <Component>.tsx          # implémentation React 19 + Tailwind v4 + CVA
     ├─ <Component>.spec.tsx     # tests Vitest + Testing Library + axe-core inline
     ├─ <Component>.types.ts     # exports types Props + variants typés CVA
     └─ index.ts                 # barrel interne re-export `<Component>` + types
   ```
   Liste exhaustive (alphabétique) : `Alert`, `Avatar`, `Badge`, `Button`, `Card`, `Divider`, `FormField`, `Helper`, `Input`, `Label`, `Modal`, `Placeholder`, `ProgressBar`, `Skeleton`, `Spinner`, `Stars`, `Toast`.

2. **AC2 — `<Button>` match `.tk-btn-primary` du bundle byte-pour-byte** : Given `<Button variant="primary" size="default">Réserver</Button>`, When il est rendu, Then :
   - `display: inline-flex`, `align-items: center`, `justify-content: center`, `gap: var(--spacing-2)`, `white-space: nowrap`, `border: 1px solid transparent`, `cursor: pointer`, `transition: background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out`
   - `bg-brand-500 text-cream-50 h-10 px-4 rounded-md text-base font-medium`
   - `hover:bg-brand-400`
   - **5 variants** : `primary` (bg `brand-500` / fg `cream-50`), `secondary` (bg `cream-100` / fg `charcoal-700` / border `cream-300` ; hover bg `cream-200`), `tertiary` (bg `transparent` / fg `brand-700` ; hover bg `brand-50`), `ghost` (bg `transparent` / fg `charcoal-600` ; hover bg `cream-100`), `danger` (bg `danger-500` / fg `cream-50` ; hover bg `danger-600`)
   - **3 sizes** : `sm` (`h-8 px-3 text-sm`), `default` (`h-10 px-4 text-base`), `lg` (`h-12 px-5 text-base`) — `lg` garantit touch target ≥ 44 × 44 px (NFR53 WCAG 2.1 AA)
   - **`loading` prop** : `<Button loading>` rend un `<Spinner size="sm" />` à gauche du label, `aria-busy="true"`, `disabled` natif appliqué
   - **`disabled` prop** : `disabled` natif + `opacity-50 cursor-not-allowed`, focus ring conservé pour la lisibilité keyboard
   - **`icon` prop** : `<Button icon={<Search />}>` ou `<Button iconRight={<ArrowRight />}>` placent l'icône Lucide avec `size={size === 'sm' ? 14 : 16}` et `gap-2`
   - **`asChild` prop** (via Radix Slot) : `<Button asChild><Link href="/...">...</Link></Button>` rend l'enfant comme bouton (utile pour les liens stylés CTA)
   - **`type` prop par défaut** : `'button'` (préviens les soumissions accidentelles dans les `<form>`)
   - **focus visible** : `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50`

3. **AC3 — `<Input>` match `.tk-input` du bundle** : Given `<Input placeholder="Email" />`, When il est rendu, Then :
   - `h-10 px-3 bg-cream-50 border border-cream-300 rounded-sm text-base text-charcoal-700 w-full outline-none`
   - `focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(194,65,12,0.18)]` (ring focus terracotta translucide)
   - `placeholder:text-charcoal-400`
   - `disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-cream-100`
   - **Slots `prefix` + `suffix`** : `<Input prefix={<Search />} suffix={<X onClick={clear} />}>` avec padding-left/right ajustés (`pl-10` ou `pr-10` selon présence)
   - **`error` prop** : `<Input error>` applique `border-error-500 focus:border-error-500 focus:shadow-[0_0_0_3px_rgba(185,28,28,0.18)]`
   - **`type` prop** : pass-through HTML (`text`, `email`, `tel`, `password`, `number`, `search`, `url`, `date`, `time`, `datetime-local`)
   - **forwardRef** : ref forward au `<input>` natif (critique pour React Hook Form `register`)
   - **Auto-clear button optionnel** : `<Input clearable value={...} onChange={...}>` rend un `<button>` X dans le suffix quand `value` non vide ; click vide la valeur via `onChange` synthétique avec `target.value = ''`

4. **AC4 — `<Label>` + `<Helper>` + `<FormField>` (composition formulaires)** : Given le triplet `<FormField label="Email" helper="Nous ne le partageons jamais" error="Email invalide"><Input /></FormField>`, When il est rendu, Then :
   - `<Label>` : `text-sm text-charcoal-500 font-semibold mb-1.5 block` (cohérent `.tk-label`), génère un `htmlFor` qui matche un `id` auto-généré sur l'enfant `<Input>`
   - `<Helper>` : `text-xs text-charcoal-400 mt-1` (cohérent `.tk-helper`), wraps `aria-describedby` automatiquement
   - `<FormField>` : wrapper qui injecte `id`, `aria-describedby` (vers helper + error), `aria-invalid` (true si `error` défini) sur l'enfant `<Input>` via React.cloneElement (ou pattern Compound Component)
   - `error` prop sur `<FormField>` : si défini, remplace `<Helper>` par un `<span className="text-xs text-error-500 mt-1">{error}</span>` avec `role="alert"` + `aria-live="polite"`
   - **`required` prop** : ajoute `*` rouge après le label + `aria-required="true"` sur l'input

5. **AC5 — `<Badge>` match `.tk-badge` du bundle** : Given `<Badge variant="brand">Nouveau</Badge>`, When il est rendu, Then :
   - `inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full tracking-tight`
   - **6 variants** (5 du bundle + 1 danger) :
     - `brand` : `bg-brand-50 text-brand-700 border border-brand-100`
     - `success` : `bg-success-50 text-success-700 border-transparent`
     - `warning` : `bg-warning-50 text-warning-700 border-transparent`
     - `info` : `bg-info-50 text-info-700 border-transparent`
     - `neutral` : `bg-cream-100 text-charcoal-600 border-cream-200`
     - `danger` : `bg-danger-50 text-danger-700 border-transparent`
   - **`icon` prop optionnel** : `<Badge icon={<CheckCircle />}>Vérifié</Badge>` rend l'icône Lucide à gauche, `size={12}`

6. **AC6 — `<Card>` match `.tk-card` du bundle** : Given `<Card>...</Card>`, When il est rendu, Then :
   - `bg-cream-50 border border-cream-200 rounded-lg overflow-hidden` (rounded-lg = 12 px = `--radius-lg`)
   - **Sous-composants composables** : `<Card.Header>`, `<Card.Body>`, `<Card.Footer>` (pattern Compound Component) avec padding cohérent (`p-4` body, `p-4 border-b border-cream-200` header, `p-4 border-t border-cream-200` footer)
   - **`as` prop** : `<Card as="article">` permet de changer le HTML element (default `div`)
   - **`hoverable` prop** : `<Card hoverable>` ajoute `hover:shadow-md transition-shadow cursor-pointer`
   - **`interactive` prop** : `<Card interactive onClick={...}>` ajoute `role="button"`, `tabIndex={0}`, gestion `onKeyDown` ENTER/SPACE (a11y obligatoire)

7. **AC7 — `<Modal>` (Radix Dialog) avec focus trap + ESC + click outside + ARIA** : Given `<Modal open={open} onOpenChange={setOpen} title="Confirmer la réservation" description="Cette action est irréversible." size="md"><Modal.Body>...</Modal.Body><Modal.Footer><Button variant="secondary" onClick={...}>Annuler</Button><Button variant="primary" onClick={...}>Confirmer</Button></Modal.Footer></Modal>`, When il s'ouvre, Then (via Radix UI `@radix-ui/react-dialog` latest stable, **non négociable** pour la gestion a11y) :
   - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (pointe vers le titre), `aria-describedby` (pointe vers la description)
   - **Focus trap actif** : Tab cycle dans la modale, focus initial sur le premier élément focusable (sauf si `initialFocus` prop fournit une ref custom)
   - **ESC key** ferme la modale (sauf `requireExplicitClose` prop pour les modales destructrices)
   - **Click outside (backdrop)** ferme la modale (sauf `requireExplicitClose`)
   - **Body scroll lock** quand ouverte (Radix le fait nativement)
   - **Animation entrée/sortie** : `tk-modal-enter` keyframes du `theme.css` (Story 0.3) — `data-[state=open]:animate-in data-[state=closed]:animate-out`
   - **3 sizes** : `sm` (`max-w-sm`), `md` (`max-w-md`), `lg` (`max-w-lg`)
   - **Backdrop** : `bg-charcoal-900/60 backdrop-blur-sm`
   - **Modal panel** : `bg-cream-50 rounded-xl shadow-xl border border-cream-200 p-6`
   - **Close button** : icon `<X />` Lucide en top-right `absolute top-4 right-4`, `aria-label="Fermer"` (i18n via `next-intl` côté apps — la lib `@tukio/ui` accepte un prop `closeLabel` avec default `'Close'` EN — l'app le surcharge avec `t('common.close')`)
   - **`requireExplicitClose` prop** : désactive ESC + click outside, force l'utilisateur à utiliser un bouton dans `Modal.Footer`

8. **AC8 — `<Toast>` (Radix Toast) avec live region + swipe dismiss + positioning** : Given un app qui appelle `toast.success("Réservation confirmée")` ou `toast.error("Erreur paiement", { tukioCode: 'PAYMENT-REFUSED-001' })`, When le toast apparaît, Then (via Radix UI `@radix-ui/react-toast` latest stable) :
   - `role="status"` (success/info) ou `role="alert"` (error/warning), `aria-live="polite"` (success/info) ou `aria-live="assertive"` (error)
   - **4 variants visuels** : `success` (icône `<CheckCircle />` + bg `success-50` border `success-500`), `error` (icône `<XCircle />` + bg `error-50` border `error-500`), `warning` (icône `<AlertTriangle />` + bg `warning-50` border `warning-500`), `info` (icône `<Info />` + bg `info-50` border `info-500`)
   - **Auto-dismiss** : default 5 s (success/info), 8 s (error/warning), `duration` prop override, `Infinity` désactive l'auto-dismiss
   - **Swipe dismiss** : sur mobile, swipe right ferme le toast (Radix natif)
   - **Positioning** : `<ToastProvider>` (à brancher dans le `RootLayout` de chaque app — Story 0.4 fournit le provider, les apps le branchent en Story 0.6+) avec viewport `bottom-right` desktop, `bottom-center` mobile (responsive via `sm:bottom-right`)
   - **Stack vertical** : 3 toasts max simultanément (configurable via `<ToastProvider swipeThreshold={50} duration={5000}>`)
   - **API impérative** : `import { useToast } from '@tukio/ui/toast'` expose `useToast()` qui retourne `{ toast: (opts) => void, dismiss: (id) => void }` — pattern shadcn-toast popularisé, pas de singleton global (compatible SSR)

9. **AC9 — `<Alert>` inline (pas dismissable) pour erreurs/warnings page-level** : Given `<Alert variant="error" title="Paiement refusé"><p>Votre carte a été refusée. Veuillez réessayer.</p></Alert>`, When il est rendu, Then :
   - `flex items-start gap-3 p-4 rounded-lg border`
   - **4 variants** : `success`, `warning`, `error`, `info` (mêmes couleurs que Toast)
   - `role="alert"` (error/warning) ou `role="status"` (success/info)
   - **Icône à gauche** : Lucide selon variant (`CheckCircle` / `AlertTriangle` / `XCircle` / `Info`), `size={20}`, alignée flex-start
   - **`title` prop** rendu en `font-semibold text-base mb-1` ; `children` rendus en `text-sm text-charcoal-600`
   - **`onDismiss` prop optionnel** : si fourni, rend un `<button>` X à droite avec `aria-label="Dismiss"`
   - **Pas d'auto-dismiss** (différent de `<Toast>` qui est éphémère ; `<Alert>` est in-flow)

10. **AC10 — `<Avatar>` (initiales + bg chaud)** : Given `<Avatar name="Camille R" size={36} tone="brand" />`, When il est rendu, Then :
    - `inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0`
    - **4 tones** (palette extracted bundle `_shared.jsx` ligne 129-134) : `cream` (bg `cream-200` / fg `charcoal-700`), `brand` (bg `brand-100` / fg `brand-700`), `info` (bg `info-50` / fg `info-700`), `success` (bg `success-50` / fg `success-700`)
    - **Initiales** : `name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()` (cohérent bundle ligne 135)
    - **`size` prop** : number en px (default 36), `font-size: size * 0.36`, `letter-spacing: 0.02em`
    - **`src` prop optionnel** : si fourni, rend `<img src={src} alt={name}>` à la place des initiales (avec fallback initiales si `onError`)
    - **`status` prop** : `'online' | 'offline' | 'busy'` rend un dot vert/gris/rouge en bottom-right

11. **AC11 — `<Stars>` rating display** : Given `<Stars value={4.8} count={42} size={14} />`, When il est rendu, Then :
    - `inline-flex items-center gap-1 font-medium font-variant-numeric:tabular-nums` (cohérent `.tk-stars`)
    - Icône `<Star fill={color} />` Lucide rempli avec `color="var(--color-brand-500)"`, `strokeWidth={2}`
    - `value` formaté `value.toFixed(1)` (1 décimale fixe), color `charcoal-700`
    - `count` optionnel : si défini, rend `· {count} avis` avec color `charcoal-400`, font-weight 400 — **i18n** : le texte "avis" est passé en prop `<Stars countLabel={t('common.reviews')} />` (default EN: `'reviews'`)
    - **`interactive` prop** : `<Stars interactive value={value} onChange={setValue}>` permet la sélection (5 étoiles cliquables, focus visible, `role="radiogroup"`, `aria-label="Star rating"`)

12. **AC12 — `<Skeleton>` + `<Spinner>` + `<ProgressBar>` (loading states)** : Given les 3 composants loading :
    - **`<Skeleton width="200px" height="20px" rounded="md" />`** : `bg-cream-200 animate-pulse rounded-{...}`, alternative `<Skeleton variant="shimmer">` utilise `tk-shimmer` keyframes (linear-gradient cream-100 → cream-200 → cream-100)
    - **`<Spinner size="sm" color="brand" />`** : SVG circular animé (rotation continue), 4 sizes (`xs:12px`, `sm:16px`, `default:24px`, `lg:32px`), 3 colors (`brand`, `cream`, `currentColor`), `aria-label="Loading"` (i18n via prop)
    - **`<ProgressBar value={42} max={100} variant="brand" />`** : `<div role="progressbar" aria-valuenow={42} aria-valuemin={0} aria-valuemax={100}>` avec barre interne `bg-brand-500 transition-all duration-300`, height `8px`, container bg `cream-200` rounded-full
    - **`indeterminate` prop** : `<Spinner indeterminate>` (default — pas de progress connue), `<ProgressBar indeterminate>` rend une animation glissante left-to-right
    - **prefers-reduced-motion** : les 3 composants respectent `@media (prefers-reduced-motion: reduce)` (Story 0.3 a posé la règle globale → animations à `0.01ms`, donc rien à faire ici)

13. **AC13 — `<Placeholder>` striped monospace match `.tk-ph` du bundle** : Given `<Placeholder label="Photo événement réel" aspect="4/3" />`, When il est rendu, Then :
    - `bg-cream-100 border border-cream-200 rounded-md flex items-center justify-center overflow-hidden`
    - `background-image: repeating-linear-gradient(135deg, transparent 0, transparent 10px, rgba(194, 65, 12, 0.06) 10px, rgba(194, 65, 12, 0.06) 11px)` (terracotta diagonal stripes 6 % opacity, exact bundle)
    - **Label** : `font-mono text-[10px] tracking-wider uppercase text-charcoal-400 bg-cream-50 border border-cream-300 rounded-sm px-2 py-1 text-center max-w-[calc(100%-16px)]`
    - `role="img"`, `aria-label={label}`
    - **`aspect` prop** : `aspect-[4/3]`, `aspect-[16/9]`, `aspect-square`, ou string CSS arbitraire
    - **`height` prop** : alternative à `aspect`, fixe une hauteur en px

14. **AC14 — `<Divider>`** : Given `<Divider />`, When il est rendu, Then :
    - `border-0 border-t border-cream-200 m-0` (cohérent `.tk-hr`)
    - `role="separator"` (par défaut HTML `<hr>`)
    - **`orientation` prop** : `'horizontal'` (default) ou `'vertical'` (height parent + border-l)
    - **`label` prop** : `<Divider label="OU">` rend un trait avec un label centré (pattern social login OR-divider) : `<div className="flex items-center gap-3"><hr className="flex-1" /><span className="text-xs text-charcoal-400 uppercase tracking-wider">{label}</span><hr className="flex-1" /></div>`

15. **AC15 — Tree-shaking via subpath imports** : Given une app frontend qui importe `import { Button } from '@tukio/ui/button'`, When je build l'app via `pnpm --filter=public build`, Then **uniquement** le code du `Button.tsx` (+ ses deps : Spinner, classnames CVA, Lucide icons utilisés) est inclus dans le bundle final. Vérifiable via :
    - `pnpm --filter=public build && pnpm --filter=public dlx @next/bundle-analyzer` → inspection visuelle du chunk : pas de `Modal.tsx`, pas de `Toast.tsx`, pas de `<Stars>`
    - **Lint enforcement** : la rule `tukio/no-barrel-import-ui` (créée Story 0.3) bloque `import { Button } from '@tukio/ui'` (barrel) — autofix vers `'@tukio/ui/button'`
    - **Anti-pattern à interdire en code review** : `import * as UI from '@tukio/ui'` (rare, mais possible)

16. **AC16 — Tests unitaires + axe-core inline ≥ 80 % coverage par composant** : Given le package, When je lance `pnpm --filter=@tukio/ui test`, Then les tests passent (Vitest + Testing Library + `vitest-axe` ou `jest-axe`, ≥ 80 % coverage par composant) :
    - **Pour chaque composant** au minimum :
      1. **API test** : tous les variants/sizes rendent les classes Tailwind attendues (snapshot ou assertion `getByRole`/`toHaveClass`)
      2. **Interaction test** (si applicable) : ex Button click déclenche `onClick`, Input change déclenche `onChange`, Modal `<button>` ferme la modale, Toast auto-dismiss après timer
      3. **A11y test** : `expect(await axe(container)).toHaveNoViolations()` — exécuté sur **chaque variant** principal (au moins 2 par composant)
    - **Pour les composants Radix-based** (Modal, Toast) : tests d'intégration vérifiant le focus trap, ESC handling, ARIA roles/states
    - **Setup Vitest a11y** : `tools/vitest-setup-axe.ts` chargé via `vitest.config.ts` `setupFiles` (helper réutilisable)
    - **Coverage report** : seuils Vitest `lines: 80, functions: 80, branches: 75, statements: 80` au niveau du package
    - **Tests Playwright** : **PAS dans cette story** (livré Story 0.5 avec les patterns + parcours complets)

17. **AC17 — `package.json` `exports` étendu pour les 17 composants + `<ToastProvider>` + utils** : Given `packages/ui/package.json`, When je l'ouvre, Then les `exports` couvrent (en plus des entrées Story 0.3) :
    - `./alert` → `./src/components/Alert/index.ts`
    - `./avatar` → `./src/components/Avatar/index.ts`
    - `./badge` → `./src/components/Badge/index.ts`
    - `./button` → `./src/components/Button/index.ts`
    - `./card` → `./src/components/Card/index.ts`
    - `./divider` → `./src/components/Divider/index.ts`
    - `./form-field` → `./src/components/FormField/index.ts`
    - `./helper` → `./src/components/Helper/index.ts`
    - `./input` → `./src/components/Input/index.ts`
    - `./label` → `./src/components/Label/index.ts`
    - `./modal` → `./src/components/Modal/index.ts`
    - `./placeholder` → `./src/components/Placeholder/index.ts`
    - `./progress-bar` → `./src/components/ProgressBar/index.ts`
    - `./skeleton` → `./src/components/Skeleton/index.ts`
    - `./spinner` → `./src/components/Spinner/index.ts`
    - `./stars` → `./src/components/Stars/index.ts`
    - `./toast` → `./src/components/Toast/index.ts` (exporte `<ToastProvider>`, `<ToastViewport>`, `useToast`, `<Toaster>` helper composant)
    - `./utils/cn` → `./src/utils/cn.ts` (helper `cn(...classes)` qui combine `clsx` + `tailwind-merge` — utilisé en interne par tous les composants pour merger les classNames Tailwind sans conflit)
    - **Pas d'entrée pour `./icons/*`** (Story 0.4 utilise `lucide-react` directement importé par les apps ; futur Story crée `@tukio/ui/icons` si besoin custom événementiels)

18. **AC18 — `lucide-react` + `class-variance-authority` + Radix UI installés en `peerDependencies`** : Given `packages/ui/package.json`, When je l'ouvre, Then :
    - **`peerDependencies`** : `react`, `react-dom`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `@radix-ui/react-slot` (latest stable pour tous, vérifiés via `pnpm view`)
    - **`peerDependenciesMeta`** : aucun `optional: true` — tous obligatoires
    - **Apps (`apps/{public,customer,seller,admin}`)** : doivent installer ces deps en `dependencies` (sinon erreur PNPM workspace strict). Task 9 le fait pour les 4 apps en une commande.

## Tasks / Subtasks

- [ ] **Task 1 — Installer les peer deps + utils** (AC: #17, #18)
  - [ ] 1.1 — `pnpm --filter=@tukio/ui add -D react@latest react-dom@latest @types/react@latest @types/react-dom@latest vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom vitest-axe jsdom` (devDeps lib)
  - [ ] 1.2 — `pnpm --filter=@tukio/ui add lucide-react class-variance-authority clsx tailwind-merge @radix-ui/react-dialog @radix-ui/react-toast @radix-ui/react-slot --save-peer` (peer deps)
  - [ ] 1.3 — Pour chaque app `apps/{public,customer,seller,admin}` : `pnpm --filter=<app> add lucide-react class-variance-authority clsx tailwind-merge @radix-ui/react-dialog @radix-ui/react-toast @radix-ui/react-slot` (résolution du peer warning)
  - [ ] 1.4 — Mettre à jour `packages/ui/package.json` `exports` avec les 17 entrées composants + `./toast` + `./utils/cn` (cf. AC17)

- [ ] **Task 2 — Créer `utils/cn.ts` (helper className merge)** (AC: tous, prereq)
  - [ ] 2.1 — Créer `packages/ui/src/utils/cn.ts` :
    ```ts
    import { clsx, type ClassValue } from 'clsx';
    import { twMerge } from 'tailwind-merge';
    export function cn(...inputs: ClassValue[]): string {
      return twMerge(clsx(inputs));
    }
    ```
  - [ ] 2.2 — Test unitaire `packages/ui/src/utils/__tests__/cn.spec.ts` : vérifie merge correct (`cn('px-2', 'px-4')` → `'px-4'`, `cn('text-sm', 'font-bold')` → `'text-sm font-bold'`)

- [ ] **Task 3 — Configurer Vitest + axe pour le package** (AC: #16)
  - [ ] 3.1 — Mettre à jour `packages/ui/vitest.config.ts` (créé Story 0.3) :
    ```ts
    import { defineConfig } from 'vitest/config';
    import react from '@vitejs/plugin-react';
    export default defineConfig({
      plugins: [react()],
      test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./src/test-setup.ts'],
        coverage: {
          provider: 'v8',
          thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
          exclude: ['**/*.spec.tsx', '**/*.types.ts', '**/index.ts', 'src/test-setup.ts'],
        },
      },
    });
    ```
  - [ ] 3.2 — Créer `packages/ui/src/test-setup.ts` :
    ```ts
    import '@testing-library/jest-dom/vitest';
    import { expect } from 'vitest';
    import * as matchers from 'vitest-axe/matchers';
    expect.extend(matchers);
    ```
  - [ ] 3.3 — Ajouter `@vitejs/plugin-react` en devDep (`pnpm --filter=@tukio/ui add -D @vitejs/plugin-react`)

- [ ] **Task 4 — Implémenter les 6 composants formulaires** (AC: #2, #3, #4) — **Button, Input, Label, Helper, FormField, Divider**
  - [ ] 4.1 — `Button` (AC2) :
    - `Button.types.ts` : exporte `ButtonProps` étendant `React.ButtonHTMLAttributes<HTMLButtonElement>` + `VariantProps<typeof buttonVariants>`
    - `Button.tsx` : utilise `cva()` pour les variants/sizes, `forwardRef`, support `asChild` via `@radix-ui/react-slot`, `loading` prop avec `<Spinner size="sm" />` (import depuis `../Spinner`), `icon`/`iconRight` props
    - `Button.spec.tsx` : 5 variants × default size + 3 sizes × primary variant + interaction click + loading state + disabled state + axe (3 calls minimum)
    - `index.ts` : `export { Button } from './Button'; export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types';`
  - [ ] 4.2 — `Input` (AC3) :
    - Support `prefix`, `suffix`, `error`, `clearable`, `forwardRef`
    - Spec : test forwardRef (vérifier `ref.current === <input>`), test error state, test clear button
  - [ ] 4.3 — `Label` (AC4) : composant simple `forwardRef` sur `<label>` avec classes par défaut
  - [ ] 4.4 — `Helper` (AC4) : `<span>` ou `<p>` avec classes helper
  - [ ] 4.5 — `FormField` (AC4) : compound component qui injecte `id`, `aria-describedby`, `aria-invalid` via `React.cloneElement` ou Context (préférer Context pattern pour multi-children futurs)
    - Spec : test `aria-describedby` correctement injecté, test `aria-invalid` quand `error` défini, test focus management
  - [ ] 4.6 — `Divider` (AC14) : support `orientation` + `label`, render `<hr>` ou wrapper flex

- [ ] **Task 5 — Implémenter les 4 composants de feedback visuel** (AC: #5, #6, #10, #11) — **Badge, Card, Avatar, Stars**
  - [ ] 5.1 — `Badge` (AC5) : `cva()` 6 variants, support `icon` Lucide
  - [ ] 5.2 — `Card` (AC6) : compound component (Header/Body/Footer), support `as`, `hoverable`, `interactive` (avec gestion keyboard)
    - Spec : test interactive a11y (Enter + Space déclenchent onClick, focus visible)
  - [ ] 5.3 — `Avatar` (AC10) : tones cream/brand/info/success, support `src` avec fallback initiales, support `status` dot
    - Spec : test fallback initiales quand `src` fail (simulate `onError`)
  - [ ] 5.4 — `Stars` (AC11) : utilise `<Star>` Lucide avec `fill="var(--color-brand-500)"`, support `interactive` mode (5 boutons radio invisibles avec labels)

- [ ] **Task 6 — Implémenter les 3 composants loading** (AC: #12) — **Skeleton, Spinner, ProgressBar**
  - [ ] 6.1 — `Skeleton` : variants `pulse` (default, animate-pulse Tailwind) et `shimmer` (custom keyframes `tk-shimmer` du theme.css)
  - [ ] 6.2 — `Spinner` : SVG circular path animé via `animate-spin`, 4 sizes, 3 colors
  - [ ] 6.3 — `ProgressBar` : `role="progressbar"`, support `indeterminate` mode

- [ ] **Task 7 — Implémenter les 2 composants Radix-based** (AC: #7, #8) — **Modal, Toast**
  - [ ] 7.1 — `Modal` (AC7) :
    - Wrapper sur `@radix-ui/react-dialog` : `<Modal>` mappe `<Dialog>`, `<Modal.Trigger>` mappe `<Dialog.Trigger>`, `<Modal.Content>` mappe `<Dialog.Content>` avec styling cream-50 + rounded-xl + shadow-xl + backdrop charcoal/60 backdrop-blur-sm
    - Sub-composants : `<Modal.Header>` (avec close button auto), `<Modal.Title>` (titre avec font-display), `<Modal.Description>`, `<Modal.Body>`, `<Modal.Footer>` (boutons à droite)
    - Animation : `data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95` (Tailwind animate utilities — vérifier compat Tailwind v4, sinon utiliser keyframes du theme.css `tk-modal-enter`)
    - `requireExplicitClose` prop : passe `onPointerDownOutside={(e) => e.preventDefault()}` + `onEscapeKeyDown={(e) => e.preventDefault()}` à Radix
    - `closeLabel` prop avec default `'Close'` (EN — le label i18n est responsabilité de l'app, pas de la lib)
    - Spec : test focus trap (Tab cycle dans modale), test ESC ferme, test click outside ferme, test `requireExplicitClose` bloque, test `aria-modal="true"`, axe ≥ 1 call
  - [ ] 7.2 — `Toast` (AC8) :
    - Wrapper sur `@radix-ui/react-toast` :
      - Exporter `<ToastProvider>` (à monter dans le `RootLayout` de chaque app — Story 0.6+ fait le branchement)
      - Exporter `<ToastViewport>` (le portail visuel, monté à côté de `<ToastProvider>`)
      - Exporter `useToast()` hook qui retourne `{ toast, dismiss }` — utilise `useState` + `useId` pour gérer une queue interne ; chaque appel à `toast({ title, description, variant, duration })` push une entry, l'expose via Context, le `<ToastViewport>` la rend
      - Exporter `<Toaster />` composant tout-en-un qui combine `<ToastProvider>` + `<ToastViewport>` (sucre syntaxique pour les apps simples)
    - 4 variants visuels avec icône Lucide (`CheckCircle`/`XCircle`/`AlertTriangle`/`Info`), couleurs cohérentes Alert
    - Auto-dismiss : durée default selon variant (5 s success/info, 8 s error/warning), override via prop `duration`
    - Spec : test auto-dismiss timer, test swipe dismiss (simuler `pointerdown`/`pointermove`/`pointerup`), test ARIA roles/live regions, axe

- [ ] **Task 8 — Implémenter les 2 composants restants** (AC: #9, #13) — **Alert, Placeholder**
  - [ ] 8.1 — `Alert` (AC9) : 4 variants, icône Lucide, support `title` + `children`, support `onDismiss` optionnel
  - [ ] 8.2 — `Placeholder` (AC13) : pattern striped via `style={{ backgroundImage: '...' }}` (pas de classe Tailwind pour le repeating-linear-gradient, donc inline style nécessaire), support `aspect`/`height`, `role="img"` + `aria-label`

- [ ] **Task 9 — Smoke test cross-app + storybook-like screen dans `apps/public`** (AC: #15)
  - [ ] 9.1 — Mettre à jour `apps/public/src/app/[locale]/page.tsx` (placeholder Story 0.3) avec une page de démonstration des 17 composants :
    ```tsx
    import { Button } from '@tukio/ui/button';
    import { Input } from '@tukio/ui/input';
    import { Badge } from '@tukio/ui/badge';
    import { Card } from '@tukio/ui/card';
    import { Avatar } from '@tukio/ui/avatar';
    import { Stars } from '@tukio/ui/stars';
    import { Skeleton } from '@tukio/ui/skeleton';
    import { Spinner } from '@tukio/ui/spinner';
    import { ProgressBar } from '@tukio/ui/progress-bar';
    import { Placeholder } from '@tukio/ui/placeholder';
    import { Divider } from '@tukio/ui/divider';
    import { Alert } from '@tukio/ui/alert';
    // ...
    ```
    Rendre 1 instance par variant principal de chaque composant (objectif : Tailwind v4 detect tous les class-variants pendant le build).
  - [ ] 9.2 — `pnpm --filter=public build` → vérifier que le build passe + bundle analyzer (`pnpm dlx @next/bundle-analyzer`) montre que **seuls** les composants utilisés sont dans le chunk
  - [ ] 9.3 — Visual smoke test : `pnpm --filter=public dev` → ouvrir `http://localhost:3000`, comparer visuellement avec `docs/cloud-design-bundle/project/screens/design-system.jsx` rendu (les couleurs/spacing/typo doivent matcher)

- [ ] **Task 10 — Tests + lint + commit** (AC: #16, tous)
  - [ ] 10.1 — `pnpm --filter=@tukio/ui test --coverage` → vérifier ≥ 80 % coverage par composant + zéro violation axe
  - [ ] 10.2 — `pnpm lint && pnpm typecheck` à la racine → tous passent (lint inclut `tukio/no-barrel-import-ui` qui ne trouve aucune violation)
  - [ ] 10.3 — `pnpm dev` à la racine → 4 apps + 10 services démarrent, `apps/public` rend la démo design system correctement
  - [ ] 10.4 — Commit avec message `feat(ui): implement 17 atomic components with Radix UI primitives, CVA variants, axe-core tested` — Story 0.4 done

## Dev Notes

### Pourquoi cette story est la 4ᵉ — contexte stratégique

> **Sources canoniques** : `docs/cloud-design-bundle/project/screens/_shared.jsx` (445 lignes — composants de référence) + `docs/cloud-design-bundle/project/styles/tokens.css` (lignes 196-279 — `.tk-btn-*`, `.tk-input`, `.tk-badge-*`, `.tk-card`, `.tk-hr`, `.tk-stars`) + UX spec §Composants atomiques règles (lignes 729-736).

Story 0.3 a livré la **fondation visuelle** (theme.css + tokens TS + globals.css + fonts). Story 0.4 livre les **17 primitives UI** qui assemblent cette fondation. Sans ces primitives, Story 0.5 (12 patterns composites) ne peut pas implémenter `<TopBar>` (qui dépend de `<Button>`, `<Input>`, `<Avatar>`), `<EmptyState>` (qui dépend de `<Button>`), `<ConversationThread>` (qui dépend de `<Avatar>` + `<Card>`), etc.

**Décision technique majeure (à acter dans Story 0.4)** : la lib utilise une **combinaison hybride** au lieu de shadcn/ui CLI :
- **Radix UI Primitives** pour les composants a11y-critiques uniquement (`Modal` via `@radix-ui/react-dialog`, `Toast` via `@radix-ui/react-toast`, `asChild` pattern via `@radix-ui/react-slot`)
- **`class-variance-authority` (CVA)** pour les variants typés (popularisé par shadcn, devenu standard de l'écosystème Tailwind)
- **`clsx` + `tailwind-merge`** via helper `cn()` interne (anti-conflit Tailwind class names)
- **Composants 100 % custom** pour le reste (Button, Input, Badge, Card, Avatar, Stars, Skeleton, Spinner, ProgressBar, Placeholder, Divider, Alert, Label, Helper, FormField)
- **PAS de shadcn CLI** : incompatible avec l'organisation `packages/ui` (shadcn génère dans une app spécifique, on aurait dû ré-écrire), incompatible avec Tailwind v4 CSS-first à la date de rédaction (2026-05-09)

**Justification** : Radix UI Primitives sont les fondations cachées de shadcn/ui. En utilisant Radix directement, on bénéficie de la même qualité a11y (focus trap, ARIA, keyboard nav) sans dépendre de la CLI shadcn et sans dette générée. L'écosystème Tailwind v4 + Radix + CVA est mature et stable au moment de cette story.

### Versions à utiliser (latest stable au moment du Sprint 0)

> **Mémoire utilisateur** : `feedback_latest_versions.md` — toujours latest stable, vérifier `pnpm view <package> version` au moment de l'init.

| Lib | Rôle | Version cible |
|---|---|---|
| **React** | engine | déjà figé Story 0.1 (19.x) |
| **lucide-react** | icônes (44 icons utilisés dans Story 0.4 + extensible) | latest stable |
| **class-variance-authority** | variants typés CVA | latest stable (1.x) |
| **clsx** | className combiner | latest stable (2.x) |
| **tailwind-merge** | dedup classes Tailwind conflictuelles | latest stable (3.x — vérifier compat Tailwind v4) |
| **@radix-ui/react-dialog** | Modal a11y | latest stable |
| **@radix-ui/react-toast** | Toast a11y + portal | latest stable |
| **@radix-ui/react-slot** | `asChild` pattern (Button + autres) | latest stable |
| **@vitejs/plugin-react** | Vitest React rendering | latest stable |
| **vitest-axe** | axe-core matcher pour Vitest | latest stable (alternative : `jest-axe` si vitest-axe n'est pas mature ; les 2 sont compatibles avec l'API `expect.extend`) |
| **@testing-library/react** | rendering React tests | latest stable |
| **@testing-library/user-event** | user event simulation | latest stable |
| **@testing-library/jest-dom** | matchers DOM | latest stable |
| **jsdom** | environment Vitest | latest stable |

> ⚠️ **Compatibilité tailwind-merge × Tailwind v4** : `tailwind-merge` v3 supporte officiellement Tailwind v4. Si la version pinned est < 3, `pnpm --filter=@tukio/ui add tailwind-merge@latest` au début de Story 0.4.
>
> ⚠️ **vitest-axe vs jest-axe** : si `vitest-axe` n'est pas trouvé (package peu maintenu), basculer sur `jest-axe` (largement utilisé, compatible Vitest via `expect.extend`). La syntaxe `expect(await axe(container)).toHaveNoViolations()` est identique.

### Project Structure cible (cohérent UX spec lignes 474-497)

```
packages/ui/src/
├─ components/                                              # ← cette story
│  ├─ Alert/{Alert.tsx, Alert.spec.tsx, Alert.types.ts, index.ts}
│  ├─ Avatar/{Avatar.tsx, Avatar.spec.tsx, Avatar.types.ts, index.ts}
│  ├─ Badge/{Badge.tsx, Badge.spec.tsx, Badge.types.ts, index.ts}
│  ├─ Button/{Button.tsx, Button.spec.tsx, Button.types.ts, index.ts}
│  ├─ Card/{Card.tsx, Card.spec.tsx, Card.types.ts, index.ts}
│  ├─ Divider/{Divider.tsx, Divider.spec.tsx, Divider.types.ts, index.ts}
│  ├─ FormField/{FormField.tsx, FormField.spec.tsx, FormField.types.ts, index.ts}
│  ├─ Helper/{Helper.tsx, Helper.spec.tsx, Helper.types.ts, index.ts}
│  ├─ Input/{Input.tsx, Input.spec.tsx, Input.types.ts, index.ts}
│  ├─ Label/{Label.tsx, Label.spec.tsx, Label.types.ts, index.ts}
│  ├─ Modal/{Modal.tsx, Modal.spec.tsx, Modal.types.ts, index.ts}
│  ├─ Placeholder/{Placeholder.tsx, Placeholder.spec.tsx, Placeholder.types.ts, index.ts}
│  ├─ ProgressBar/{ProgressBar.tsx, ProgressBar.spec.tsx, ProgressBar.types.ts, index.ts}
│  ├─ Skeleton/{Skeleton.tsx, Skeleton.spec.tsx, Skeleton.types.ts, index.ts}
│  ├─ Spinner/{Spinner.tsx, Spinner.spec.tsx, Spinner.types.ts, index.ts}
│  ├─ Stars/{Stars.tsx, Stars.spec.tsx, Stars.types.ts, index.ts}
│  └─ Toast/{Toast.tsx, Toast.spec.tsx, Toast.types.ts, index.ts}        # exporte ToastProvider, useToast, Toaster, ToastViewport
├─ utils/
│  ├─ cn.ts                                                              # className merger (clsx + tailwind-merge)
│  └─ __tests__/cn.spec.ts
├─ test-setup.ts                                                          # Vitest + Testing Library + axe matchers
└─ (existants depuis Story 0.3)
   ├─ index.ts, styles/, tokens/, themes/
```

### Subpath exports (`packages/ui/package.json` — bloc complet, écrase celui de Story 0.3)

> Étend Story 0.3 — ajoute les 17 composants + utils. Les entrées Story 0.3 (CSS, tokens, themes) sont conservées.

```json
{
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
    "./themes/stripe-elements": "./src/themes/stripe-elements.theme.ts",
    "./alert": "./src/components/Alert/index.ts",
    "./avatar": "./src/components/Avatar/index.ts",
    "./badge": "./src/components/Badge/index.ts",
    "./button": "./src/components/Button/index.ts",
    "./card": "./src/components/Card/index.ts",
    "./divider": "./src/components/Divider/index.ts",
    "./form-field": "./src/components/FormField/index.ts",
    "./helper": "./src/components/Helper/index.ts",
    "./input": "./src/components/Input/index.ts",
    "./label": "./src/components/Label/index.ts",
    "./modal": "./src/components/Modal/index.ts",
    "./placeholder": "./src/components/Placeholder/index.ts",
    "./progress-bar": "./src/components/ProgressBar/index.ts",
    "./skeleton": "./src/components/Skeleton/index.ts",
    "./spinner": "./src/components/Spinner/index.ts",
    "./stars": "./src/components/Stars/index.ts",
    "./toast": "./src/components/Toast/index.ts",
    "./utils/cn": "./src/utils/cn.ts"
  }
}
```

### Pattern CVA — exemple Button complet (à dupliquer pour les autres composants à variants)

> Référence canonique : `Button.tsx` doit suivre **exactement** ce pattern. Les autres composants (`Badge`, `Alert`, `Spinner`, etc.) en sont des variations.

```ts
// packages/ui/src/components/Button/Button.types.ts
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { buttonVariants } from './Button';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  asChild?: boolean;
}

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;
```

```tsx
// packages/ui/src/components/Button/Button.tsx
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { Spinner } from '../Spinner/Spinner';
import type { ButtonProps } from './Button.types';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap border border-transparent rounded-md font-medium cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-cream-50 hover:bg-brand-400',
        secondary: 'bg-cream-100 text-charcoal-700 border-cream-300 hover:bg-cream-200',
        tertiary: 'bg-transparent text-brand-700 hover:bg-brand-50',
        ghost: 'bg-transparent text-charcoal-600 hover:bg-cream-100',
        danger: 'bg-danger-500 text-cream-50 hover:bg-danger-600',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        default: 'h-10 px-4 text-base',
        lg: 'h-12 px-5 text-base', // touch target ≥ 48px (NFR53)
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, icon, iconRight, children, disabled, asChild, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const iconSize = size === 'sm' ? 14 : 16;
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size="sm" color="currentColor" aria-hidden="true" />}
        {!loading && icon && <span className="inline-flex items-center" aria-hidden="true" style={{ fontSize: iconSize }}>{icon}</span>}
        <span>{children}</span>
        {iconRight && <span className="inline-flex items-center" aria-hidden="true" style={{ fontSize: iconSize }}>{iconRight}</span>}
      </Comp>
    );
  }
);
Button.displayName = 'Button';
```

### Pattern Modal complet (Radix wrapper)

```tsx
// packages/ui/src/components/Modal/Modal.tsx (extrait — pattern à suivre)
import { forwardRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const contentVariants = cva(
  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-cream-50 rounded-xl shadow-xl border border-cream-200 p-6 w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
      },
    },
    defaultVariants: { size: 'md' },
  }
);

interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  requireExplicitClose?: boolean;
  closeLabel?: string;
  children: React.ReactNode;
}

export function Modal({ open, onOpenChange, title, description, size = 'md', requireExplicitClose, closeLabel = 'Close', children }: ModalProps) {
  const blockClose = requireExplicitClose
    ? { onPointerDownOutside: (e: Event) => e.preventDefault(), onEscapeKeyDown: (e: KeyboardEvent) => e.preventDefault() }
    : {};
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className={cn(contentVariants({ size }))} {...blockClose}>
          {title && <Dialog.Title className="text-xl font-display text-charcoal-800 mb-2">{title}</Dialog.Title>}
          {description && <Dialog.Description className="text-sm text-charcoal-500 mb-4">{description}</Dialog.Description>}
          {children}
          {!requireExplicitClose && (
            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 text-charcoal-500 hover:text-charcoal-700" aria-label={closeLabel}>
                <X size={20} />
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

Modal.Body = function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-6', className)}>{children}</div>;
};

Modal.Footer = function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex justify-end gap-2 pt-4 border-t border-cream-200', className)}>{children}</div>;
};
```

### Pattern Toast (useToast hook + Provider)

> Le hook `useToast()` est un pattern shadcn-toast popularisé. Il maintient une queue locale via `useState` + `useId`, exposée via Context.

```tsx
// packages/ui/src/components/Toast/Toast.tsx (extrait — squelette)
import * as Toast from '@radix-ui/react-toast';
import { createContext, useContext, useState, useCallback, useId, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}
interface ToastEntry extends ToastOptions { id: string }

const ToastContext = createContext<{ toast: (opts: ToastOptions) => void; dismiss: (id: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function Toaster({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const toast = useCallback((opts: ToastOptions) => {
    const id = crypto.randomUUID();
    setEntries((prev) => [...prev, { ...opts, id }]);
  }, []);
  const dismiss = useCallback((id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)), []);
  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}
        {entries.map((e) => {
          const variant = e.variant ?? 'info';
          const Icon = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }[variant];
          const role = (variant === 'error' || variant === 'warning') ? 'alert' : 'status';
          const ariaLive = (variant === 'error' || variant === 'warning') ? 'assertive' : 'polite';
          return (
            <Toast.Root key={e.id} duration={e.duration ?? (variant === 'error' ? 8000 : 5000)} type={variant === 'error' || variant === 'warning' ? 'foreground' : 'background'} className="bg-cream-50 border rounded-lg shadow-md p-4 flex items-start gap-3 data-[state=open]:animate-in data-[state=closed]:animate-out" onOpenChange={(open) => !open && dismiss(e.id)}>
              <Icon size={20} className={`text-${variant}-500 flex-shrink-0`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <Toast.Title className="font-semibold text-charcoal-800">{e.title}</Toast.Title>
                {e.description && <Toast.Description className="text-sm text-charcoal-500 mt-1">{e.description}</Toast.Description>}
              </div>
            </Toast.Root>
          );
        })}
        <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-96 max-w-[calc(100vw-32px)] outline-none z-50" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
```

### Critical Architecture Constraints

> Cf. UX spec §Composants atomiques règles lignes 729-736 + §Règles d'usage typographique lignes 720-727 + memories `feedback_*.md`.

1. **Touch target ≥ 44 × 44 px sur mobile (NFR53)** : tous les éléments interactifs (Button `lg`, Input `lg`, Modal close, Card interactive) doivent atteindre 44 px hauteur minimum sur mobile. Sur desktop, le `default` size suffit (40 px acceptable).
2. **Focus visible OBLIGATOIRE** : tous les composants interactifs ont `focus-visible:ring-2 focus-visible:ring-brand-200` (cohérent across components).
3. **`aria-label` en EN par défaut, override par l'app** : la lib `@tukio/ui` est i18n-agnostic. Tous les `aria-label` ont un default EN (`'Close'`, `'Loading'`, `'Star rating'`, `'Dismiss'`) que l'app surcharge via prop quand elle utilise `next-intl` (ex `<Modal closeLabel={t('common.close')}>`).
4. **Pas de hooks externes côté composants** (Zustand, TanStack Query) — les composants sont 100 % stateless ou state local seulement. Story 0.5 (patterns) les compose avec les hooks d'app.
5. **Forward refs partout** : Button, Input, Card, Avatar, Badge — tous `forwardRef<HTMLXxxElement>`. Critique pour React Hook Form `register`, Radix UI composition, et les libs de tooltips/popovers (ajoutées V1+).
6. **`displayName` set sur chaque forwardRef** (DevTools + tests).
7. **Pas de `console.log` dans le code prod** (lint enforce déjà via ESLint default).
8. **Pas de `any` TypeScript** (TS strict + memory `feedback_*` enforce).
9. **`React.cloneElement` pattern interdit pour multi-children** : préférer Compound Component avec Context (FormField, Card, Modal). `cloneElement` cassent quand l'enfant est wrappé (`<Tooltip><Input /></Tooltip>`).
10. **Anti-barrel** : `import { Button } from '@tukio/ui'` interdit. Subpath strict `'@tukio/ui/button'`. Lint `tukio/no-barrel-import-ui` (Story 0.3) enforce.
11. **Stripe Elements theme** : non touché par Story 0.4 (livré Story 0.3, consommé Story 4.5). Aucun composant Story 0.4 ne dépend de Stripe.
12. **`text-wrap: balance` + `text-wrap: pretty`** : déjà appliqués globalement par `globals.css` Story 0.3 sur `<h*>` et `<p>`. Les composants Story 0.4 n'ont pas besoin de les répéter.

### What this story does NOT do (out of scope)

> Pour éviter le scope creep, voici ce que cette story ne livre **pas** (livré ailleurs) :

- ❌ **12 patterns composites** (TopBar, Footer, ConversationThread, ReviewsDisplay, PricingDisplay, AvailabilityCalendar, FilterSidebar, FileUpload, StepIndicator, EmptyState, ErrorPage, Map) → **Story 0.5**
- ❌ **Logo + Stars custom + LogoMark** (présents dans `_shared.jsx`) → **Story 0.5** (pattern `<TopBar>` consomme `<Logo>`) ou **Story 0.13** (assets statiques + branding)
- ❌ **Icons custom événementiels** (`Marquee`, `Chair`, `Lighting`, `Catering`) → **V1+** (catalog finitions)
- ❌ **`<ThemeProvider>` React** (V2 dark mode) → **V2+**
- ❌ **Stores Zustand** (`locale.store.ts`, `theme.store.ts`) → **Story 0.9** (`@tukio/i18n-client`)
- ❌ **`<CrossZoneLink>`** → **Story 0.13** (Vercel multi-zones)
- ❌ **Storybook config** → **V1+**
- ❌ **Tests Playwright + axe-core sur parcours complets** → **Story 0.5** (composition patterns + journeys)
- ❌ **Composants formulaires avancés** (`<Select>`, `<Combobox>`, `<DatePicker>`, `<RadioGroup>`, `<Checkbox>`, `<Switch>`) → **stories Epic 1+** au fur et à mesure des besoins
- ❌ **`<Tooltip>` + `<Popover>`** → ajoutés au fur et à mesure (`@radix-ui/react-tooltip` + `react-popover`) en stories Epic 1+
- ❌ **Tests visual regression Chromatic** → V1+
- ❌ **Composants admin spécifiques** (`<DataTable>`, `<KanbanBoard>`) → **stories Epic 6** (admin console)
- ❌ **Variantes dark mode** → V2+

### Files to UPDATE vs CREATE

> **À UPDATE** (existants depuis Story 0.3) :
> - `packages/ui/package.json` — ajouter peer deps + 17 entrées `exports` + `./utils/cn` + `./toast`
> - `packages/ui/src/index.ts` — pas de changement (barrel racine reste minimal, pas de re-export composants)
> - `packages/ui/vitest.config.ts` — ajouter `setupFiles`, `coverage.thresholds`, `@vitejs/plugin-react`
> - `packages/ui/README.md` — documenter `import { Button } from '@tukio/ui/button'` patterns + lien vers Cloud Design bundle
> - `apps/{public,customer,seller,admin}/package.json` — ajouter peer deps `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-{dialog,toast,slot}`
> - `apps/public/src/app/[locale]/page.tsx` — étendre placeholder Story 0.3 avec démo des 17 composants

> **À CREATE** (nouveaux fichiers) :
> - 17 dossiers composants × 4 fichiers = **68 fichiers** dans `packages/ui/src/components/`
> - `packages/ui/src/utils/cn.ts` + `__tests__/cn.spec.ts`
> - `packages/ui/src/test-setup.ts`
> - **Estimation total fichiers créés** : ~75 fichiers

### Previous Story Intelligence (Story 0.1 + 0.2 + 0.3)

**Story 0.1** — Apps Next.js scaffoldées, ports figés (3000-3003), structure feature-based dans chaque app.

**Story 0.2** — Pattern subpath `exports`, `eslint-plugin-tukio` créé avec rules `event-naming` + `no-barrel-import-contracts`. Story 0.4 ne touche pas le plugin (rule `no-barrel-import-ui` ajoutée Story 0.3).

**Story 0.3** :
- `packages/ui/package.json` a déjà `exports` partiel (CSS + tokens + themes Stripe). Story 0.4 l'**étend** (n'écrase pas — ajoute les 17 composants + utils).
- `sideEffects: ["**/*.css"]` déjà posé. Critique pour Story 0.4 : les `*.tsx` composants ont `sideEffects: false` par défaut → tree-shaking préservé.
- `vitest.config.ts` créé avec `coverage.thresholds: { lines: 90 }`. Story 0.4 ajuste à 80 % (cohérent NFR71 pour `usecases/`, plus réaliste pour des composants UI riches).
- `globals.css` chargé dans `apps/<app>/src/app/globals.css` via `@import "@tukio/ui/styles/globals.css"`. Tous les composants Story 0.4 utilisent les CSS variables (`var(--color-brand-500)`) ou les utility classes Tailwind v4 (`bg-brand-500`) qui résolvent vers les `@theme` tokens.
- Fonts chargées via `next/font/google` (Story 0.3 task 5) → `var(--font-display)` / `var(--font-body)` / `var(--font-mono)` disponibles. Composants utilisent `font-display`, `font-body`, `font-mono` Tailwind utilities (générées automatiquement par `--font-display`, `--font-body`, `--font-mono` du theme.css).
- `tukio/no-barrel-import-ui` lint rule créée Story 0.3 → Story 0.4 ne déclenche aucune violation (utilise toujours subpaths).

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.4 |
|---|---|---|
| EN strict (paths, code) | Composant names en PascalCase, files en PascalCase | ✅ tous les fichiers |
| camelCase props | `onClose`, `aria-label` | ✅ tous les composants |
| `forwardRef` partout | Critique pour RHF / Radix | ✅ tous les composants interactifs |
| `displayName` set | DevTools | ✅ après chaque `forwardRef` |
| Pas de hardcoded color hex | Toujours via tokens | ✅ classes Tailwind `bg-brand-500` etc. |
| RGAA AA contrast | `cream-50` × `charcoal-700` ratio ≥ 4,5:1 | ✅ vérifié axe-core |
| Touch targets ≥ 44px | Mobile, géré par `size="lg"` | ✅ Button 48px lg |
| Reduced motion | Géré globalement par theme.css Story 0.3 | ✅ aucune action |
| ARIA roles + states | Modal `aria-modal`, Toast `role="status\|alert"` | ✅ Radix le fait nativement + tests axe |
| `aria-label` EN default | Override via prop par les apps i18n | ✅ Modal `closeLabel`, Stars `countLabel` |

### Testing Standards

- **Coverage cible** : ≥ 80 % par composant (NFR71 réaliste pour les composants UI ; `domain/` backend reste à 80 %, `usecases/` 70 %, `infrastructure/` 50 %).
- **Framework** : Vitest 3.x + Testing Library + `vitest-axe` (ou `jest-axe` fallback).
- **Niveaux de tests** :
  - **API tests** : props rendering correct, variants applique les bonnes classes
  - **Interaction tests** : `userEvent.click()`, `userEvent.type()`, `userEvent.keyboard('{Escape}')`
  - **A11y tests** : `axe(container)` sur 2+ variants par composant
  - **Forward ref tests** : `const ref = createRef(); render(<Button ref={ref} />); expect(ref.current).toBeInstanceOf(HTMLButtonElement)`
- **Pas de tests visual regression** (Chromatic V1+).
- **Pas de tests Playwright** ici (Story 0.5).

### Project Structure Notes

✅ **Aligné** avec `ux-design-specification.md` §Composants atomiques règles lignes 729-736 + UX spec lignes 474-497.

✅ **Aligné** avec `_shared.jsx` du Cloud Design bundle pour les patterns visuels (Button hover, Avatar tones, Stars layout, Placeholder striped).

✅ **Aligné** avec `tokens.css` du Cloud Design bundle pour les valeurs exactes (`tk-btn` height 40px / `tk-btn-lg` 48px / `tk-input` height 40px / `tk-badge` 2px 8px etc.).

⚠️ **Divergence Architecture vs implémentation** : `architecture.md` ligne 474 mentionne "shadcn/ui customisés". **Décision Story 0.4** : on utilise Radix UI directement (fondation de shadcn) + CVA + Tailwind v4. Pas de shadcn CLI. Pas de copier-coller des templates shadcn (incompatible Tailwind v4 CSS-first à la date). Le résultat fonctionnel est équivalent. Cette divergence est intentionnelle et documentée ici. **Pas un blocker** : si V1+ on veut migrer vers shadcn (par ex pour bénéficier d'updates upstream), on garde la même API publique des composants — refactor interne uniquement.

⚠️ **À noter** : `_shared.jsx` contient aussi `<TopNav>`, `<SiteHeader>`, `<ProSidebar>`, `<ProShell>`, `<ProPageHeader>`, `<Pill>`, `<Kicker>`, `<VersionBadge>`. Ces composants sont des **patterns composites** (composent Button + Avatar + Logo + Icon) → **livrés Story 0.5** (`<TopBar>`, `<Footer>`, etc.). Story 0.4 ne les touche pas.

⚠️ **À noter** : `Stars` du bundle utilise `<Icon name="star">` du `_shared.jsx`. Story 0.4 utilise `<Star />` de `lucide-react` directement (équivalent visuel, plus simple). Le `<Icon />` wrapper du bundle est non porté car redondant avec `lucide-react`.

⚠️ **À noter** : Le composant `<Logo>` du bundle (lignes 76-97 de `_shared.jsx`) est un **pattern visuel custom** (wordmark Fraunces + arch SVG terracotta). Reporté **Story 0.5** ou **Story 0.13** (assets statiques + branding final). Pas dans Story 0.4 (qui ne livre que des primitives génériques).

### References

- [Source: docs/cloud-design-bundle/project/screens/_shared.jsx — lignes 1-445 (composants Stars, Placeholder, Avatar, TopNav, Pill, Kicker, VersionBadge, ProSidebar, etc. — patterns visuels références)]
- [Source: docs/cloud-design-bundle/project/styles/tokens.css — lignes 196-279 (`.tk-btn-*`, `.tk-input`, `.tk-badge-*`, `.tk-card`, `.tk-hr`, `.tk-stars`, `.tk-ph` — specs CSS exactes)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Composants-atomiques-règles — Lines 729-736 (5 variants Button, sizes, touch targets, Modal a11y, etc.)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Règles-d'usage-typographique — Lines 720-727 (Fraunces display only, Inter body, contraintes)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Architecture-package-tukio-ui — Lines 451-502 (structure cible)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-libs — Lines 470-475 (@tukio/ui consommé par 4 apps)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées — Lines 2208-2214 (packages/ui/src structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle-Optimization — Lines 956-962 (anti-barrel, dynamic imports, bundle budget 150 KB)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.4 — Lines 905-921 (7 ACs originaux : 17 composants, structure dossiers, Button match bundle, touch target lg, Modal a11y, Placeholder, tests, tree-shaking)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR53 — Line 1379 (touch targets ≥ 44 × 44 px)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR54 — Line 1380 (Lighthouse a11y ≥ 90, axe-core obligatoire parcours critiques)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — coverage thresholds 80 %/70 %/50 % (composants Story 0.4 ciblent 80 %, équivalent `domain/`)]
- [Source: _bmad-output/implementation-artifacts/0-1-bootstrap-monorepo-turborepo-scaffold-nextjs-apps-nestjs-services.md — Story 0.1 dev context (apps Next.js setup, ports)]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 dev context (eslint-plugin-tukio créé, pattern subpath exports)]
- [Source: _bmad-output/implementation-artifacts/0-3-setup-design-system-tailwind-v4-tukio-ui.md — Story 0.3 dev context (theme.css + tokens TS + globals.css + fonts via next/font, sideEffects, lint no-barrel-import-ui)]
- [Memory: feedback_latest_versions.md — toujours latest stable, vérifier `pnpm view` au moment du dev]
- [Memory: feedback_tech_layer_english.md — code/aria-label EN, paths EN strict]
- [Memory: feedback_clean_architecture_explicit.md — composants 100 % stateless ou state local seulement, pas de hooks externes côté lib]
- [Memory: feedback_i18n_frontend.md — i18n FR/EN dès Sprint 0, lib agnostic, apps font le binding via `next-intl`]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent au démarrage de l'implémentation)

### Debug Log References

(à remplir au cours de l'implémentation — versions Radix UI + CVA + tailwind-merge retenues, choix vitest-axe vs jest-axe, conflits CSS Tailwind v4 detectés, alternatives si shadcn nécessaire)

### Completion Notes List

(à remplir à la fin — résumé des décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 0.5 qui consommera les 17 composants pour les 12 patterns composites, et pour les stories Epic 1+ qui les utiliseront dans les formulaires d'auth, fiches services, modales booking, toasts confirmation)

### File List

(à remplir à la fin — liste exhaustive des fichiers créés / modifiés, avec chemins relatifs depuis la racine du repo)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 4-5 jours (17 composants × ~2 h dev + tests + review = ~35 h, mais beaucoup partagent CVA/Tailwind utilities — gain de mutualisation)
- **Dépendances upstream** :
  - Story 0.1 (`ready-for-dev`) — apps Next.js + `packages/ui/` placeholder
  - Story 0.2 (`ready-for-dev`) — `eslint-plugin-tukio` (étendu Story 0.3 avec `no-barrel-import-ui`)
  - Story 0.3 (`ready-for-dev`) — `theme.css` + tokens TS + globals.css + fonts via `next/font` + utils prêts
- **Dépendances downstream** :
  - **Story 0.5** (12 patterns composites) — consomme les 17 atomics
  - **Story 0.6** (Pattern Pretre identity-svc) — `apps/identity-svc` aura besoin de `<Toaster />` provider et de `<Modal>` pour les pages auth
  - **Stories Epic 1+** (toutes les stories frontend) — formulaires d'auth, fiches services, modales acceptation booking, toasts confirmation, etc.
  - **Story 4.5** (Stripe checkout) — consomme `<Card>`, `<Button>`, `<Alert>` + `stripeElementsTheme` (Story 0.3)
- **FRs covered** : aucun FR direct (foundational)
- **NFRs touchés** :
  - **NFR53** — touch targets ≥ 44 × 44 px (Button `lg` = 48 px) ✅
  - **NFR54** — accessibility axe-core inline tests ≥ 0 violations sur tous les composants ✅
  - **NFR67** — pattern `@tukio/ui` figé avec composants standardisés
  - **NFR71** — coverage ≥ 80 % par composant ✅
  - **NFR74** — conventions naming + tree-shaking enforced via lint
  - **UX-DR1-6** — design system code-ready Tailwind v4 + composants atomiques implémentés ✅
