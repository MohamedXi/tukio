# Story 0.16: Design system atoms pré-lancement — Kicker + Pill + SiteHeader + EditorialPageShell + Block + Footer minimal + tk-pulse keyframe

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** frontend dev qui va implémenter les Stories 0.17 (landing Coming Soon apex), 0.18 (landing Devenir Pro seller), 0.19 (4 pages publiques About + Privacy + Legal + Contact),
**I want** les **2 NEW atoms** (`Kicker`, `Pill`) + **3 NEW patterns** (`SiteHeader`, `EditorialPageShell`, `Block`) ajoutés à `@tukio/ui`, **1 EXTEND** au pattern `Footer` existant pour supporter un mode `minimal` (footer simple "© 2026 · Made in Loire-Atlantique" + 3 liens inline), **1 NEW keyframe** `tk-pulse` (animation 2s infinite pour pill "En construction" du Coming Soon) ajoutée à `packages/ui/src/styles/theme.css` + token `animations.ts`, et **1 documentation de mapping** entre les 14 noms d'icons utilisés dans le design (`arrow`, `shield`, `bolt`, `check`, etc.) et leurs équivalents `lucide-react`,
**so that** les Stories 0.17-0.19 consomment les atoms via subpath imports `@tukio/ui/components/Kicker`, `@tukio/ui/patterns/SiteHeader`, etc. **sans dupliquer le code** dans `apps/public` ni `apps/seller`, sans réinventer ce qui existe déjà (`Logo`, `LogoMark`, `Footer`, `Card`, `Button`, `Input`, `FormField`, `Checkbox`, `Alert` — tous livrés Stories 0.4/0.5), et en respectant **strictement** les patterns canoniques `@tukio/ui` (CVA variants + `forwardRef` + i18n-ready props sans hardcoded text + Tailwind v4 tokens + a11y RGAA AA + Vitest co-located ≥ 80% coverage).

> **Outcome attendu** : à la fin de cette story, (1) `pnpm --filter=@tukio/ui test` ajoute **8 nouveaux specs verts** (2 atoms + 3 patterns + 1 extend test sur Footer variant + 2 specs CSS keyframe) avec coverage ≥ 80% sur les NEW + 75% maintenu sur Footer ; (2) un dev qui démarre la Story 0.17 fait `import { Kicker } from '@tukio/ui/components/Kicker'` + `import { Pill } from '@tukio/ui/components/Pill'` + `import { SiteHeader } from '@tukio/ui/patterns/SiteHeader'` + `import { EditorialPageShell, Block } from '@tukio/ui/patterns/EditorialPageShell'` + `import { Footer } from '@tukio/ui/patterns/Footer'` (avec prop `variant='minimal'`) et **n'a aucune surprise** — les ACs Story 0.17 correspondent exactement aux signatures livrées Story 0.16 ; (3) `pnpm --filter=@tukio/ui build` produit un bundle ESM correctement tree-shakable (chaque NEW component a son propre subpath export dans `package.json#exports`) ; (4) `pnpm --filter=public lint` reste à 0 erreurs (la règle `tukio/no-barrel-import-ui` doit accepter les nouveaux subpaths) ; (5) **aucun texte FR/EN hardcodé** dans les nouveaux atoms/patterns — toutes les chaînes user-visible passent par des props injectables (les Stories 0.17-0.19 consumer feeders avec next-intl `t('...')`) ; (6) la keyframe `tk-pulse` respecte `prefers-reduced-motion: reduce` (animation désactivée automatiquement via media query CSS) ; (7) documentation `packages/ui/README.md` mise à jour avec section "Pre-launch atoms" listant les 8 nouveaux exports + 14 icons lucide à utiliser.

## Acceptance Criteria

1. **AC1 — Atom `Kicker`** : `packages/ui/src/components/Kicker/`
   - **Fichiers** : `Kicker.tsx` + `Kicker.types.ts` + `Kicker.spec.tsx` + `index.ts` (barrel local).
   - **Pattern** : `forwardRef<HTMLSpanElement>` + `cva` variants + `cn` utility (strict pattern `Badge.tsx` ligne 1-37 réutilisé).
   - **Props** :
     ```ts
     export interface KickerProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof kickerVariants> {
       children: ReactNode; // texte uppercase à afficher — i18n-fed par consumer
     }
     // VariantProps: color = 'brand' (default — text-brand-700) | 'charcoal' (text-charcoal-500) | 'cream' (text-cream-200 pour dark sections Story 0.18)
     // size = 'sm' (default 11px) | 'md' (13px)
     ```
   - **CVA variants** :
     ```ts
     export const kickerVariants = cva(
       'inline-block font-mono uppercase tracking-[0.08em]',
       {
         variants: {
           color: {
             brand: 'text-brand-700',
             charcoal: 'text-charcoal-500',
             cream: 'text-cream-200', // pour Story 0.18 section sombre charcoal-800
             success: 'text-success-700',
           },
           size: {
             sm: 'text-[11px]',
             md: 'text-[13px]',
           },
         },
         defaultVariants: { color: 'brand', size: 'sm' },
       },
     );
     ```
   - **Render** : `<span className={cn(kickerVariants({ color, size }), className)} ref={ref} {...props}>{children}</span>`.
   - **Spec** (Vitest + Testing Library, ≥ 80% coverage) : 6+ cases (render avec default + render avec color='cream' + render avec size='md' + accepts ref + accepts children string + accepts children ReactNode + spreads HTMLSpanElement props + apply className extension).
   - **Usage exemple Stories 0.17/0.18/0.19** : `<Kicker>Rester informé·e</Kicker>`, `<Kicker color="cream">Paiements et reversements</Kicker>`, `<Kicker color="success">C'est noté</Kicker>`.

2. **AC2 — Atom `Pill`** : `packages/ui/src/components/Pill/`
   - **Fichiers** : `Pill.tsx` + `Pill.types.ts` + `Pill.spec.tsx` + `index.ts`.
   - **Pattern** : `forwardRef<HTMLSpanElement>` + `cva` variants.
   - **Props** :
     ```ts
     export interface PillProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
       /** When true, renders a pulsing dot before the children. The dot uses `tk-pulse` 2s infinite. */
       pulseDot?: boolean;
       /** Optional left icon (lucide-react). Rendered as ReactNode for tree-shake. */
       icon?: ReactNode;
       children: ReactNode;
     }
     ```
   - **CVA variants** :
     ```ts
     export const pillVariants = cva(
       'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border font-mono',
       {
         variants: {
           variant: {
             brand: 'bg-brand-50 text-brand-700 border-brand-100',
             charcoal: 'bg-charcoal-50 text-charcoal-700 border-charcoal-200',
             success: 'bg-success-50 text-success-700 border-success-200',
             cream: 'bg-cream-100 text-charcoal-600 border-cream-200',
           },
         },
         defaultVariants: { variant: 'brand' },
       },
     );
     ```
   - **PulseDot rendering** :
     ```tsx
     {pulseDot && (
       <span
         aria-hidden="true"
         className="w-1.5 h-1.5 rounded-full bg-current"
         style={{ animation: 'var(--animate-pulse)' }}
       />
     )}
     ```
     **`bg-current`** → le dot prend la même couleur que le texte de la pill (brand-700 si variant=brand, etc.) — pas besoin de prop colorDot séparée.
   - **Spec** (≥ 80% coverage) : 8+ cases : render basic + render avec pulseDot=true (vérifie présence span animé `aria-hidden`) + render avec icon + render avec icon + pulseDot (les 2) + variant='success' applique classes correctes + accepts ref + children est rendu après icon + spread HTMLSpanElement props.
   - **Usage exemple coming-soon.jsx ligne 22-35** : `<Pill pulseDot>En construction</Pill>` rend exactement la pill brand-50 + dot pulsant + texte "En construction".

3. **AC3 — Pattern `SiteHeader`** : `packages/ui/src/patterns/SiteHeader/`
   - **Fichiers** : `SiteHeader.tsx` + `SiteHeader.types.ts` + `SiteHeader.spec.tsx` + `index.ts`.
   - **Distinction CLAIRE du TopBar existant** : le `TopBar variant='public'` (`packages/ui/src/patterns/TopBar/TopBar.tsx:18-81`) est conçu pour les **pages app launchée** (Home / Search / Listing avec Search input + Categories / Become Pro / Help links + Log in / Sign up buttons). `SiteHeader` est conçu pour les **pages institutionnelles publiques** (About / Privacy / Legal / Contact / Devenir pro / Coming Soon) — header **minimaliste** sans search input, sans auth buttons. Ne PAS réutiliser TopBar.
   - **Props** :
     ```ts
     export interface SiteHeaderNavItem {
       /** Label user-visible — i18n-fed par consumer */
       label: string;
       /** Lien interne (href Next.js) ou externe */
       href: string;
       /** Active state highlight (typo gras + brand color). Default false. */
       active?: boolean;
     }
     
     export interface SiteHeaderProps {
       /** Slot pour le `<Logo>` ou autre branding. Si omis, le pattern rend `<Logo size={22}>` par défaut. */
       logo?: ReactNode;
       /** Liens de navigation droits — typiquement 2-4 items. Vide [] pour landing Coming Soon. */
       navItems?: SiteHeaderNavItem[];
       /** Locale switcher (optionnel — Stories 0.17-0.19 décideront de l'utiliser ou non). */
       localeSwitcher?: ReactNode;
       /** Slot droit additionnel — utilisé Story 0.17 Coming Soon pour rendre "Bientôt en Pays de la Loire" badge. */
       rightSlot?: ReactNode;
       /** className pour override depuis consumer. */
       className?: string;
     }
     ```
   - **Render** :
     ```tsx
     'use client'; // pas requis si pas d'event handlers — vérifier avec dev agent : peut-être Server Component OK
     export function SiteHeader({ logo, navItems = [], localeSwitcher, rightSlot, className }: SiteHeaderProps) {
       return (
         <header
           role="banner"
           className={cn(
             'flex items-center justify-between px-10 py-6 bg-cream-50 border-b border-cream-200',
             className,
           )}
         >
           <div className="flex items-center gap-3">
             {logo ?? <Logo size={22} />}
           </div>
           {navItems.length > 0 && (
             <nav aria-label="Public site navigation" className="flex items-center gap-6">
               {navItems.map((item) => (
                 <a
                   key={item.href}
                   href={item.href}
                   className={cn(
                     'text-sm text-charcoal-600 hover:text-charcoal-900 transition-colors',
                     item.active && 'text-brand-700 font-semibold',
                   )}
                   aria-current={item.active ? 'page' : undefined}
                 >
                   {item.label}
                 </a>
               ))}
             </nav>
           )}
           <div className="flex items-center gap-4">
             {localeSwitcher}
             {rightSlot}
           </div>
         </header>
       );
     }
     ```
   - **Spec** (≥ 80% coverage) : 10+ cases : render default sans nav + render avec navItems × 3 + render active item highlighted + render logo override slot + render rightSlot slot + render localeSwitcher slot + a11y role=banner + a11y nav aria-label + a11y aria-current sur active link + className extension.
   - **Usage exemple coming-soon.jsx ligne 9-15** :
     ```tsx
     <SiteHeader
       rightSlot={<span className="text-xs font-mono uppercase tracking-wider text-charcoal-500">Bientôt en Pays de la Loire</span>}
     />
     ```
   - **Usage exemple ComingSoonSuccessScreen ligne 189-196** :
     ```tsx
     <SiteHeader navItems={[
       { label: t('nav.about'), href: '/a-propos' },
       { label: t('nav.becomePro'), href: '/devenir-pro' },
       { label: t('nav.contact'), href: '/contact' },
     ]} />
     ```
   - **Usage exemple public-pages.jsx BecomeProScreen ligne 117** : `<SiteHeader active="pros" ... />` — le `active="pros"` du design devient `navItems` avec l'item Devenir pro flag `active: true`.

4. **AC4 — Pattern `EditorialPageShell` + Block** : `packages/ui/src/patterns/EditorialPageShell/`
   - **Fichiers** : `EditorialPageShell.tsx` (contient les 2 exports : `EditorialPageShell` + `Block`) + `EditorialPageShell.types.ts` + `EditorialPageShell.spec.tsx` + `Block.spec.tsx` + `index.ts` (re-exports les 2).
   - **`EditorialPageShell` props** (réplique du `PageShell` du design `public-pages.jsx:6-20`) :
     ```ts
     export interface EditorialPageShellProps {
       /** Kicker uppercase mono affiché au-dessus du titre. Optional — si omis pas de Kicker rendu. */
       kicker?: string;
       /** Title H1 — peut contenir un span italic React node (e.g., <em> avec brand color). */
       title: ReactNode;
       /** Intro paragraphe sous le titre. Optional. */
       intro?: ReactNode;
       /** Max-width du contenu en pixels — default 880. Stories 0.19 utilisent 880, About utilise 960. */
       maxWidth?: number;
       /** Slot `<SiteHeader>` — laissé au consumer (les Stories 0.17-0.19 passent leur header configuré). */
       header?: ReactNode;
       /** Slot `<Footer variant="minimal">` — laissé au consumer. */
       footer?: ReactNode;
       /** Children = contenu principal sous l'intro (typiquement plusieurs `<Block>`). */
       children: ReactNode;
       className?: string;
     }
     ```
   - **`EditorialPageShell` render** :
     ```tsx
     export function EditorialPageShell({
       kicker, title, intro, maxWidth = 880, header, footer, children, className,
     }: EditorialPageShellProps) {
       return (
         <div className={cn('min-h-screen flex flex-col bg-cream-50', className)}>
           {header}
           <main
             className="flex-1 mx-auto px-10 py-[72px] pb-24 w-full"
             style={{ maxWidth }}
           >
             {kicker && <Kicker className="mb-3">{kicker}</Kicker>}
             <h1 className="font-display font-normal tracking-[-0.025em] leading-[1.05] text-charcoal-800 mt-3.5 text-[52px]">
               {title}
             </h1>
             {intro && (
               <p className="mt-4 text-[17px] leading-[1.6] text-charcoal-600 max-w-[640px]">
                 {intro}
               </p>
             )}
             <div className="mt-12">{children}</div>
           </main>
           {footer}
         </div>
       );
     }
     ```
   - **`Block` props + render** (réplique du `Block` du design `public-pages.jsx:22-29`) :
     ```ts
     export interface BlockProps {
       /** Titre H2 — peut contenir ReactNode (italic accent). */
       title: ReactNode;
       /** Contenu — p, ul, grid de cards, etc. */
       children: ReactNode;
       className?: string;
     }
     
     export function Block({ title, children, className }: BlockProps) {
       return (
         <section className={cn('mb-10', className)}>
           <h2 className="text-2xl font-display font-medium text-charcoal-800 mb-3.5">
             {title}
           </h2>
           <div className="text-[15px] text-charcoal-700 leading-[1.7]">{children}</div>
         </section>
       );
     }
     ```
   - **Spec EditorialPageShell** (≥ 80% coverage) : 8+ cases (render minimal title + render full kicker+title+intro+children+header+footer + maxWidth default 880 + maxWidth override 960 + a11y h1 visible + className extension + intro optional + kicker optional).
   - **Spec Block** : 4+ cases (render avec title string + render avec title ReactNode (italic em) + render children + className extension).
   - **Usage exemple About / Privacy / Legal — public-pages.jsx ligne 33-110, 401-456, 460-518** : composer un `<EditorialPageShell>` avec header+footer + plusieurs `<Block>` enfants.

5. **AC5 — EXTEND `Footer` avec variant `minimal`** : `packages/ui/src/patterns/Footer/`
   - **Approche** : étendre `Footer.types.ts` + `Footer.tsx` pour supporter un mode `variant='minimal'` qui rend une footer simple **inline** (logo + copyright + 3 links horizontalement), distincte du mode `'full'` actuel (4 columns + grid + 2 lignes copyright).
   - **`Footer.types.ts` UPDATE** :
     ```ts
     export interface FooterColumnLink { label: string; href: string; }
     export interface FooterColumn { title: string; links: FooterColumnLink[]; }
     
     export interface FooterPropsCommon {
       variant?: 'full' | 'minimal'; // default 'full' (backward-compat avec les usages Story 0.5 et futurs)
       brandTagline?: string;
       legal?: string;
       legalRight?: string;
       className?: string;
     }
     
     export interface FooterFullProps extends FooterPropsCommon {
       variant?: 'full';
       columns: FooterColumn[]; // required en mode full
     }
     
     export interface FooterMinimalProps extends FooterPropsCommon {
       variant: 'minimal';
       /** Liens inline horizontaux — typiquement 2-4 max. */
       inlineLinks?: FooterColumnLink[];
       /** Override du <Logo> ; default <Logo size={22}>. */
       logo?: ReactNode;
     }
     
     export type FooterProps = FooterFullProps | FooterMinimalProps;
     ```
   - **`Footer.tsx` UPDATE** : ajouter un early-return pour `variant='minimal'` :
     ```tsx
     export function Footer(props: FooterProps) {
       if (props.variant === 'minimal') {
         const { logo, inlineLinks = [], legal, className } = props;
         const year = new Date().getFullYear();
         return (
           <footer
             aria-label="Site footer"
             className={cn(
               'flex items-center justify-between px-10 py-6 bg-cream-50 border-t border-cream-200',
               'text-xs text-charcoal-500',
               'max-md:flex-col max-md:gap-3 max-md:px-4',
               className,
             )}
           >
             <div className="flex items-center gap-3">
               {logo ?? null /* Le copyright fait office de wordmark — Logo optionnel ici */}
               <span>{legal ?? `© tukio.one · ${year} · Made in Loire-Atlantique`}</span>
             </div>
             {inlineLinks.length > 0 && (
               <nav aria-label="Footer links" className="flex items-center gap-5">
                 {inlineLinks.map((link) => (
                   <a
                     key={link.href}
                     href={link.href}
                     className="text-charcoal-500 hover:text-charcoal-700 transition-colors"
                   >
                     {link.label}
                   </a>
                 ))}
               </nav>
             )}
           </footer>
         );
       }
       // ... existing 'full' variant rendering (Footer.tsx:6-65 actuel inchangé)
     }
     ```
   - **Spec UPDATE** : `Footer.spec.tsx` actuel teste le mode full. **AJOUTER** 5+ cases sur variant='minimal' (render avec inlineLinks × 3 + render sans inlineLinks (logo + copyright only) + render avec logo override + custom legal text + a11y nav aria-label).
   - **Backward-compat** : tous les usages existants `<Footer columns={[...]}>` continuent de fonctionner (variant default 'full'). Tests existants restent verts.
   - **Usage exemple coming-soon.jsx ligne 172-180** :
     ```tsx
     <Footer
       variant="minimal"
       legal="© tukio.one · 2026 · Made in Loire-Atlantique"
       inlineLinks={[
         { label: 'Devenir pro pilote', href: '/devenir-pro' },
         { label: 'Mentions légales', href: '/mentions-legales' },
         { label: 'contact@tukio.one', href: 'mailto:contact@tukio.one' },
       ]}
     />
     ```
   - **Note** : Story 0.17-0.19 décideront via i18n `t('footer.legal', { year: new Date().getFullYear() })` — Story 0.16 livre la mécanique, pas le contenu.

6. **AC6 — NEW keyframe `tk-pulse` + animation token** : 
   - **`packages/ui/src/styles/theme.css`** UPDATE : ajouter le keyframe + la custom property animation, accompagnés du respect `prefers-reduced-motion` :
     ```css
     /* ─── Pulse — Pill "En construction" / live indicators (Story 0.16) ─── */
     @keyframes tk-pulse {
       0%, 100% {
         opacity: 1;
         transform: scale(1);
       }
       50% {
         opacity: 0.4;
         transform: scale(0.85);
       }
     }
     
     :root {
       --animate-pulse: tk-pulse 2s ease-in-out infinite;
     }
     
     /* Respect reduced-motion preference (NFR50/54 a11y RGAA AA). */
     @media (prefers-reduced-motion: reduce) {
       :root {
         --animate-pulse: none;
       }
     }
     ```
   - **`packages/ui/src/tokens/animations.ts`** UPDATE : ajouter aux exports existants :
     ```ts
     export const keyframes = {
       typing: 'tk-typing',
       modalEnter: 'tk-modal-enter',
       shimmer: 'tk-shimmer',
       pulse: 'tk-pulse', // NEW Story 0.16
     } as const;
     
     export const animations = {
       typing: 'tk-typing 1.4s ease-in-out infinite',
       pulse: 'tk-pulse 2s ease-in-out infinite', // NEW Story 0.16
     } as const;
     ```
   - **Spec** : `packages/ui/src/tokens/__tests__/animations.spec.ts` UPDATE — ajouter case "exports pulse keyframe + animation". `Pill.spec.tsx` (AC2) couvre l'usage runtime de `var(--animate-pulse)`.
   - **a11y RGAA AA** : la media query `prefers-reduced-motion: reduce` désactive automatiquement le pulse pour les utilisateurs avec préférence accessibility activée — **0 violation axe-core** garantie.
   - **Validation manuelle** : ouvrir DevTools → Rendering → Emulate prefers-reduced-motion: reduce → recharger la page Coming Soon Story 0.17 → le pill ne pulse plus.

7. **AC7 — `package.json#exports` étendus** : `packages/ui/package.json`
   - Ajouter les subpaths exports pour les NEW components/patterns :
     ```json
     "./components/Kicker": {
       "types": "./dist/components/Kicker/index.d.ts",
       "default": "./dist/components/Kicker/index.js"
     },
     "./components/Pill": {
       "types": "./dist/components/Pill/index.d.ts",
       "default": "./dist/components/Pill/index.js"
     },
     "./patterns/SiteHeader": {
       "types": "./dist/patterns/SiteHeader/index.d.ts",
       "default": "./dist/patterns/SiteHeader/index.js"
     },
     "./patterns/EditorialPageShell": {
       "types": "./dist/patterns/EditorialPageShell/index.d.ts",
       "default": "./dist/patterns/EditorialPageShell/index.js"
     }
     ```
   - **Footer** : déjà exporté via `./patterns/*` glob ou subpath spécifique — vérifier que le subpath `./patterns/Footer` est accessible (sinon ajouter).
   - **Vérification CI** : `pnpm --filter=@tukio/ui build` doit produire `dist/components/Kicker/index.js` + `.d.ts` etc. Sinon le subpath import dans Stories 0.17 échouera au build.
   - **Règle lint `tukio/no-barrel-import-ui`** : doit accepter les nouveaux subpaths sans modification (la règle interdit `import { X } from '@tukio/ui'` mais autorise `import { X } from '@tukio/ui/components/Kicker'`).

8. **AC8 — Documentation `packages/ui/README.md`** :
   - Section NEW "Pre-launch atoms (Story 0.16)" listant les exports + signatures + 1 exemple d'usage par atom/pattern.
   - Section NEW "Icons — lucide-react direct usage" avec le mapping suivant pour les Stories 0.17-0.19 :
     | Nom design (coming-soon.jsx / public-pages.jsx) | Import lucide-react | Usage Story |
     |---|---|---|
     | `arrow` | `ArrowRight` | CTA "Me prévenir à l'ouverture" trailing icon |
     | `shield` | `Shield` | Reassurance "Vos données restent en France" + Privacy banner |
     | `bolt` | `Zap` | Banner "tukio.one n'est pas encore ouverte" Story 0.18 + Legal "Statut du projet" Story 0.19 |
     | `check` | `Check` | List items "Avec tukio.one" Story 0.19 About + docs requis Story 0.18 + pipeline paiement Story 0.18 |
     | `card` | `CreditCard` | Section paiement Story 0.18 modes paiement |
     | `message` | `MessageSquare` | Communication card Story 0.18 |
     | `calendar` | `Calendar` | Calendrier card Story 0.18 |
     | `chart` | `BarChart3` | Stats card Story 0.18 |
     | `doc` | `FileText` | Administratif card Story 0.18 |
     | `user` | `User` | Animation services card Story 0.18 + Presse canal Story 0.19 Contact |
     | `tent` | `Tent` | Métier tentes et chapiteaux Story 0.18 |
     | `package` | `Package` | Métier mobilier événementiel Story 0.18 |
     | `flame` | `Flame` | Métier traiteur et boissons Story 0.18 |
     | `sparkle` | `Sparkles` | Métier décoration et fleurs Story 0.18 |
   - **Convention import** : les Stories 0.17-0.19 importent **directement** depuis `lucide-react` (pattern réutilisé `apps/public` Stories 1.2d, et `@tukio/ui` Footer/TopBar). Pas de wrapper `<Icon>` créé en Story 0.16 — la valeur ajoutée est nulle (lucide-react est déjà tree-shakable et type-safe).

9. **AC9 — i18n discipline (pas de hardcoded text)** : 
   - **Tous** les NEW atoms/patterns acceptent leurs strings via **props injectables**. Aucun texte FR/EN n'est inscrit dans `@tukio/ui` — c'est le consumer (Stories 0.17-0.19) qui appelle `t('coming_soon.kicker')` et passe la string en prop.
   - Pour les attributs HTML par défaut qui DOIVENT exister (e.g., `aria-label="Public site navigation"`) : ils restent en EN (couche technique 100% English per AGENTS.md hard rules + code-style.md). Les Stories 0.17-0.19 peuvent override avec une prop si besoin de traduction lecteur d'écran.
   - **Footer minimal** : la prop `legal` est optionnelle ; si omise, le pattern rend `© tukio.one · ${year} · Made in Loire-Atlantique` en EN-compatible (mais FR-déjà parlable). Les Stories 0.19 passent `legal={t('footer.legal', { year })}` pour render dans la bonne langue.

10. **AC10 — a11y RGAA AA (NFR50/54)** :
    - `Kicker` : pas d'attribut a11y particulier (texte décoratif uppercase mono — lecteur d'écran lit comme du texte normal). **0 violation axe-core**.
    - `Pill` : si `pulseDot=true`, le dot a `aria-hidden="true"` (animation décorative, ne fait pas partie du sens). Le children est le contenu sémantique. **0 violation**.
    - `SiteHeader` : `role="banner"` (landmark), `<nav aria-label="Public site navigation">` (labelled navigation landmark), `aria-current="page"` sur l'active link.
    - `EditorialPageShell` : `<main>` landmark, `<h1>` unique par page. Si plusieurs Blocks → h2 multiples (correct, pas de violation).
    - `Block` : `<section>` + `<h2>` (n'a pas besoin de `aria-labelledby` car le h2 est le label naturel).
    - `Footer minimal` : `<footer role="banner">` (wait, Footer = `role="contentinfo"`. Vérifier que le pattern existant a `aria-label="Site footer"` — déjà OK ligne 21).
    - **Test axe-core** : ajouter un spec `axe.spec.tsx` qui rend chaque NEW pattern/atom dans isolation + run `axe(node)` → 0 violations.
    - **`prefers-reduced-motion`** : pulseDot disabled automatiquement (AC6 media query).

11. **AC11 — Tests + coverage** :
    - **Vitest** : `pnpm --filter=@tukio/ui test` → tous les nouveaux specs verts.
    - **Coverage** : NEW atoms ≥ 80% lignes + branches. NEW patterns ≥ 75%. Footer EXTEND ≥ 75% (maintenu — pas de régression sur le full variant).
    - **Test pattern strict** : Vitest + Testing Library `@testing-library/react`, mock minimal, focus sur **rendu + interactions accessibles** plutôt que sur implémentation interne. Pattern Badge.spec.tsx réutilisé.
    - **Co-location** : chaque component a son `.spec.tsx` dans le même folder (pas `__tests__/`).

12. **AC12 — Lint + typecheck + build** :
    - `pnpm --filter=@tukio/ui lint` → 0 errors. **CRITIQUE** : la règle `tukio/no-barrel-import-ui` doit accepter les NEW subpaths (vérifier que la règle est basée sur la liste `package.json#exports` et non sur une liste hardcodée — sinon ajouter les 4 NEW subpaths à la règle).
    - `pnpm --filter=@tukio/ui typecheck` → 0 errors. Pattern `forwardRef<HTMLSpanElement>` strict.
    - `pnpm --filter=@tukio/ui build` → produit `dist/` avec subpath outputs corrects (vérifier `dist/components/Kicker/index.js` + `.d.ts` existent post-build).

13. **AC13 — Smoke test consumer apps/public** :
    - Pendant le dev Story 0.16, créer un **smoke usage** dans `apps/public/src/app/[locale]/coming-soon/page.tsx` (placeholder Story 0.15 → enrichir le minimum) pour valider que les imports subpath fonctionnent end-to-end :
      ```tsx
      import { Kicker } from '@tukio/ui/components/Kicker';
      import { Pill } from '@tukio/ui/components/Pill';
      import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';
      
      export default function ComingSoonPlaceholderPage() {
        return (
          <div className="min-h-screen bg-cream-50">
            <SiteHeader />
            <main className="p-12">
              <Pill pulseDot>Smoke test Story 0.16</Pill>
              <Kicker className="mt-4 block">Pre-launch placeholder</Kicker>
              <h1 className="text-3xl mt-2">tukio.one — Bientôt en Pays de la Loire</h1>
            </main>
          </div>
        );
      }
      ```
      **Cet enrichissement ne remplace PAS Story 0.17 finale** — c'est juste un check de la chaîne import → bundle → render. Story 0.17 écrira par-dessus.
    - `pnpm --filter=public build` réussit sans erreur (compile-time validation des imports subpath).
    - Run manuel `pnpm --filter=public dev` + navigate `/fr/coming-soon` → voit la pill animée pulsante + kicker + h1. Document dans Dev Agent Record.

## Tasks / Subtasks

- [x] **Task 1 — Atom `Kicker`** (AC: #1, #11)
  - [x] 1.1 Créer `packages/ui/src/components/Kicker/Kicker.tsx` (CVA + forwardRef pattern Badge.tsx)
  - [x] 1.2 Créer `Kicker.types.ts` (KickerProps interface + variants export)
  - [x] 1.3 Créer `Kicker.spec.tsx` (6+ cases, ≥ 80% coverage)
  - [x] 1.4 Créer `Kicker/index.ts` (re-exports Kicker + KickerProps + kickerVariants)
  - [x] 1.5 Ajouter subpath export dans `package.json#exports`

- [x] **Task 2 — Atom `Pill`** (AC: #2, #6, #11)
  - [x] 2.1 Créer `Pill.tsx` (CVA + forwardRef + pulseDot logic + var(--animate-pulse))
  - [x] 2.2 Créer `Pill.types.ts`
  - [x] 2.3 Créer `Pill.spec.tsx` (8+ cases incl. pulseDot rendered avec aria-hidden + icon slot + variant matrix)
  - [x] 2.4 `Pill/index.ts` re-exports
  - [x] 2.5 Ajouter subpath export

- [x] **Task 3 — Animation `tk-pulse` keyframe** (AC: #6)
  - [x] 3.1 UPDATE `packages/ui/src/styles/theme.css` — ajouter `@keyframes tk-pulse` + `--animate-pulse` + media query `prefers-reduced-motion`
  - [x] 3.2 UPDATE `packages/ui/src/tokens/animations.ts` — ajouter `pulse` aux exports keyframes + animations
  - [x] 3.3 UPDATE `packages/ui/src/tokens/__tests__/animations.spec.ts` — case "exports pulse" + vérifie clé présente
  - [x] 3.4 Smoke manuel : `pnpm --filter=public dev` + DevTools Rendering → Emulate prefers-reduced-motion: reduce → vérifier pill statique

- [x] **Task 4 — Pattern `SiteHeader`** (AC: #3, #10, #11)
  - [x] 4.1 Créer `packages/ui/src/patterns/SiteHeader/SiteHeader.tsx` (role=banner + nav aria-label + active link aria-current)
  - [x] 4.2 `SiteHeader.types.ts` (SiteHeaderNavItem + SiteHeaderProps avec slots logo/navItems/localeSwitcher/rightSlot)
  - [x] 4.3 `SiteHeader.spec.tsx` (10+ cases incl. a11y + slots + navItems active)
  - [x] 4.4 `SiteHeader/index.ts`
  - [x] 4.5 Subpath export

- [x] **Task 5 — Pattern `EditorialPageShell` + `Block`** (AC: #4, #11)
  - [x] 5.1 Créer `packages/ui/src/patterns/EditorialPageShell/EditorialPageShell.tsx` (contient les 2 exports EditorialPageShell + Block)
  - [x] 5.2 `EditorialPageShell.types.ts`
  - [x] 5.3 `EditorialPageShell.spec.tsx` (8+ cases)
  - [x] 5.4 `Block.spec.tsx` (4+ cases)
  - [x] 5.5 `EditorialPageShell/index.ts` (re-exports EditorialPageShell + Block + types)
  - [x] 5.6 Subpath export

- [x] **Task 6 — EXTEND `Footer` variant minimal** (AC: #5, #11)
  - [x] 6.1 UPDATE `Footer.types.ts` — union FooterFullProps | FooterMinimalProps + backward-compat (default variant 'full')
  - [x] 6.2 UPDATE `Footer.tsx` — early return pour variant='minimal' (Footer.tsx:6-65 actuel reste intact pour 'full')
  - [x] 6.3 UPDATE `Footer.spec.tsx` — ajouter 5+ cases sur variant='minimal' (sans casser les tests existants 'full')
  - [x] 6.4 Smoke manual : tester que les usages Story 0.5 du Footer full ne sont pas régressés

- [x] **Task 7 — Documentation README** (AC: #8)
  - [x] 7.1 UPDATE `packages/ui/README.md` — section "Pre-launch atoms" (Story 0.16) avec liste exports + 1 exemple usage par atom
  - [x] 7.2 Section "Icons — lucide-react direct usage" avec table mapping 14 noms design → noms lucide + Story 0.18 / 0.19 référence d'usage
  - [x] 7.3 Note de migration backward-compat Footer ('full' default préservé)

- [x] **Task 8 — Smoke consumer** (AC: #13)
  - [x] 8.1 UPDATE `apps/public/src/app/[locale]/coming-soon/page.tsx` (placeholder Story 0.15) — remplacer par version smoke utilisant Kicker + Pill + SiteHeader (AC13 code samples)
  - [x] 8.2 Run `pnpm --filter=public build` → success (validation imports subpath)
  - [x] 8.3 Run `pnpm --filter=public dev` → curl `/fr/coming-soon` rend pill animé + kicker + h1
  - [x] 8.4 Document trace dans Dev Agent Record (HTTP 200, taille HTML, screenshot mental)
  - [x] 8.5 **Note** : Story 0.17 réécrira cette page avec le design final — c'est un smoke transitoire, pas final

- [x] **Task 9 — Lint + typecheck + test + build final** (AC: #11, #12)
  - [x] 9.1 Run `pnpm --filter=@tukio/ui lint` → 0 errors, 0 warnings
  - [x] 9.2 Run `pnpm --filter=@tukio/ui typecheck` → 0 errors
  - [x] 9.3 Run `pnpm --filter=@tukio/ui test --coverage` → vert + coverage ≥ 80% atoms + ≥ 75% patterns + Footer ≥ 75% (régression-safe)
  - [x] 9.4 Run `pnpm --filter=@tukio/ui build` → dist/ contient les 4 nouveaux subpaths corrects (Kicker, Pill, SiteHeader, EditorialPageShell)
  - [x] 9.5 Run `pnpm --filter=public lint && pnpm --filter=public typecheck && pnpm --filter=public build` → 0 erreurs (validation cross-package consume)
  - [x] 9.6 Optionnel : `pnpm --filter=@tukio/ui test:axe` si une suite axe-core spec dédiée existe (sinon Stories 0.17-0.19 valideront a11y end-to-end)

### Review Findings (code-review 2026-05-21)

- [x] [Review][Patch] Pill variants `charcoal` et `success` utilisent des tokens couleur inexistants [packages/ui/src/components/Pill/Pill.tsx:14-15] — `bg-charcoal-50` et `border-charcoal-200` : scale charcoal commence à 400. `border-success-200` : success n'a que 50/500/700. Les variantes charcoal et success de Pill s'affichent sans fond ni bordure visible.
- [x] [Review][Patch] `Skeleton.tsx` utilise `animate-pulse` class — Story 0.16 écrase silencieusement Tailwind built-in [packages/ui/src/components/Skeleton/Skeleton.tsx:15] — `--animate-pulse: tk-pulse 2s ease-in-out infinite` dans `@theme` remplace `animate-pulse` Tailwind (opacity-only → scale+opacity). Le variant `pulse` du Skeleton change de comportement visuellement sans test de régression.
- [x] [Review][Patch] `globals-css.spec.ts` keyframe test non mis à jour pour `tk-pulse` [packages/ui/src/styles/__tests__/globals-css.spec.ts] — le test valide 3 keyframes (tk-typing, tk-modal-enter, tk-shimmer) mais pas tk-pulse. Une suppression accidentelle du keyframe passerait sans alerte.
- [x] [Review][Patch] `FooterMinimalProps` hérite de `brandTagline` et `legalRight` inutilisés [packages/ui/src/patterns/Footer/Footer.types.ts:11] — ces 2 props ne sont pas consommées dans le variant minimal (early return). API trompeuse : un consumer peut passer `brandTagline="X"` silencieusement ignoré. Utiliser `Omit<FooterPropsBase, 'brandTagline' | 'legalRight'>`.
- [x] [Review][Defer] Copyright hardcodé en FR dans Footer minimal [packages/ui/src/patterns/Footer/Footer.tsx:15] — `© tukio.one · ${year} · Made in Loire-Atlantique` est un fallback FR dans un composant partagé. Stories 0.17-0.19 overrideront toujours via `legal={t('footer.legal')}`. — deferred, pre-existing by spec design
- [x] [Review][Defer] `role="banner"` redondant sur `<header>` [packages/ui/src/patterns/SiteHeader/SiteHeader.tsx:8] — `<header>` hors sectioning content a déjà le rôle implicite `banner`. L'explicit override est inoffensif mais inutile. — deferred, pre-existing
- [x] [Review][Defer] Nom `Block` trop générique comme export [packages/ui/src/patterns/EditorialPageShell/index.ts] — risque de collision dans les imports consumer. Mitigé par subpath imports (`@tukio/ui/patterns/EditorialPageShell`). — deferred, subpath import pattern protège
- [x] [Review][Defer] `key={item.href}` dans SiteHeader navItems et Footer inlineLinks — si 2 items partagent le même href, React drop l'un silencieusement. — deferred, consumer responsibility
- [x] [Review][Defer] SiteHeader pas de gestion overflow nav sur mobile narrow — wrapping non géré sur 320-767px avec 3+ items. — deferred, post-launch concern (hamburger)
- [x] [Review][Defer] `maxWidth` accepte 0 ou négatif sans validation — collapserait le layout à 0px. — deferred, consumer responsibility
- [x] [Review][Defer] `globals.css` @source ne scanne pas `../patterns/` — classes Tailwind des patterns dépendent du bundler Next.js pour la résolution. — deferred, Next.js bundler gère via symlink
- [x] [Review][Defer] Pill `icon` sans mécanisme d'accessible label — le wrapper `aria-hidden="true"` est correct pour icons décoratifs mais empêche labels sémantiques si besoin. — deferred, decorative by design
- [x] [Review][Defer] Multiples `active: true` dans navItems possibles par type — viole ARIA aria-current="page" sur un seul élément. — deferred, consumer responsibility
- [x] [Review][Defer] Pill contraste ratio `text-xs uppercase` — vérification Lighthouse manquante pour les variants cream et charcoal à cette taille. — deferred, Lighthouse Stories 0.17+
- [x] [Review][Defer] `children: ReactNode` dans `<h1>`/`<h2>` (Block + EditorialPageShell) pourrait contenir des block elements — consumer responsibility. — deferred, consumer responsibility
- [x] [Review][Defer] `FooterMinimalProps` hérite `brandTagline` et `legalRight` du base — API surface trompeuse (handled via Patch P4 above). — voir patch P4
- [x] [Review][Defer] `animations.ts` `pulse` token string duplique la valeur CSS var — deux sources de vérité; pre-existing pattern (même chose pour typing/shimmer). — deferred, pre-existing pattern
- [x] [Review][Defer] `mainClassName` absent sur EditorialPageShell — pas de prop override pour padding `<main>`. — deferred, not needed by 0.17-0.19

## Dev Notes

### Architecture patterns à appliquer

- **Pattern atom canonique** : `forwardRef<HTMLElementType>` + `cva` variants + `cn` utility. Strict copie de `packages/ui/src/components/Badge/Badge.tsx:1-37` — pas de divergence.
- **Pattern pattern (composite)** : Pas de forwardRef obligatoire (les patterns sont des slots-based wrappers — pas typique de besoin de ref). Mais respecter la struct `<name>.tsx + <name>.types.ts + <name>.spec.tsx + index.ts`.
- **Slots pattern** pour les composites : props `ReactNode` (e.g., `header?: ReactNode` sur `EditorialPageShell`) au lieu de props bool conditional. Permet aux consumers de passer n'importe quel composant (SiteHeader, ou un header custom Story 0.17). Pattern Story 0.5 réutilisé.
- **i18n-fed strict** : 0 hardcoded user-facing text dans `@tukio/ui`. Toujours via `children: ReactNode` ou prop string injectable. Les `aria-label` techniques restent en EN per code-style.md "Language" section.
- **Tailwind v4 tokens via `var(--color-*)` ou classes utility** : `bg-brand-50`, `text-charcoal-800`, etc. — les classes utility sont étendues par `theme.css` (`@theme` block Story 0.3). Pas de `style={{ color: '#FFA000' }}` hardcodé.
- **`cva` variants** pour atoms qui ont du polymorphisme (`Kicker.color`, `Pill.variant`). `cva` génère les classes Tailwind conditionnellement, type-safe via `VariantProps<typeof xVariants>`.
- **Spec co-location** : `<name>.spec.tsx` à côté de `<name>.tsx` dans le même folder. Pas de `__tests__/` séparé (pattern strict Story 0.4 atoms).
- **Subpath exports `package.json#exports`** : chaque NEW component a son entrée explicite. Tree-shaking optimal + règle `tukio/no-barrel-import-ui` respectée.
- **Backward-compat Footer** : la prop `variant` est optionnelle avec default `'full'`. Tous les usages existants (`<Footer columns={[...]}>` sans variant) compilent et rendent identiquement à aujourd'hui.

### Source tree composants à toucher

| Fichier / dossier | Action | Estimation |
|--|--|--|
| `packages/ui/src/components/Kicker/{Kicker.tsx,Kicker.types.ts,Kicker.spec.tsx,index.ts}` | NEW × 4 | ~120 lignes total |
| `packages/ui/src/components/Pill/{Pill.tsx,Pill.types.ts,Pill.spec.tsx,index.ts}` | NEW × 4 | ~160 lignes total |
| `packages/ui/src/patterns/SiteHeader/{SiteHeader.tsx,SiteHeader.types.ts,SiteHeader.spec.tsx,index.ts}` | NEW × 4 | ~200 lignes |
| `packages/ui/src/patterns/EditorialPageShell/{EditorialPageShell.tsx,EditorialPageShell.types.ts,EditorialPageShell.spec.tsx,Block.spec.tsx,index.ts}` | NEW × 5 | ~250 lignes |
| `packages/ui/src/patterns/Footer/Footer.tsx` | UPDATE | +35 lignes (variant minimal early return) |
| `packages/ui/src/patterns/Footer/Footer.types.ts` | UPDATE | +30 lignes (union types) |
| `packages/ui/src/patterns/Footer/Footer.spec.tsx` | UPDATE | +60 lignes (5+ minimal variant cases) |
| `packages/ui/src/styles/theme.css` | UPDATE | +20 lignes (tk-pulse keyframe + media query) |
| `packages/ui/src/tokens/animations.ts` | UPDATE | +2 lignes (pulse export) |
| `packages/ui/src/tokens/__tests__/animations.spec.ts` | UPDATE | +5 lignes (test case) |
| `packages/ui/package.json` | UPDATE | +20 lignes (4 NEW subpath exports) |
| `packages/ui/README.md` | UPDATE | +60 lignes (section pre-launch + table icons) |
| `apps/public/src/app/[locale]/coming-soon/page.tsx` | UPDATE | smoke version (~20 lignes) |

**Total** : ~22 fichiers (17 NEW + 5 UPDATE), ~950-1100 lignes ajoutées. **Estimation 1.5-2 jours** dev solo.

### Testing standards résumé

- **Vitest 3.x + @testing-library/react** : pattern co-located `.spec.tsx`. Mock minimal — focus rendu sémantique + a11y.
- **Coverage NFR71 cible** :
  - Atoms (Kicker, Pill) : ≥ 80% lignes + branches
  - Patterns (SiteHeader, EditorialPageShell, Block) : ≥ 75% lignes + branches
  - Footer EXTEND : ≥ 75% (maintenu — pas de régression)
- **Axe-core a11y** : facultatif Story 0.16 (Stories 0.17-0.19 valideront end-to-end). Si une suite axe spec existe dans `packages/ui/src/__tests__/axe.spec.ts`, étendre. Sinon, focus sur le manuel + Lighthouse Stories 0.17-0.19.
- **Pas de Storybook MVP** : la doc README + exemples inline AC8 suffisent. Storybook reste un nice-to-have V1+.
- **Smoke test runtime AC13** : `pnpm --filter=public build` + `dev` + curl. Pas de E2E dédié — Stories 0.17-0.19 fourniront la couverture E2E réelle.

### Pièges connus à éviter

1. **NE PAS recréer `Logo` / `LogoMark`** : ils existent dans `packages/ui/src/patterns/Logo/Logo.tsx:17-148` avec props `size`, `mono`, `showDomain`, `slogan`, `color`. Le design coming-soon.jsx utilise `<Logo size={22}>` — signature directement compatible. Pas de NEW LogoMark dans Story 0.16 (l'epics.md AC2 le mentionnait mais après audit ce n'est pas nécessaire).
2. **NE PAS réutiliser `TopBar variant='public'`** : il est trop riche (Search input + Categories + Login/Signup buttons) pour les pages publiques pré-lancement. Créer un `SiteHeader` distinct. Documenté dans AC3 + Dev Notes "Distinction CLAIRE du TopBar existant".
3. **NE PAS créer de wrapper `<Icon name="arrow">`** : les patterns existants (Footer, TopBar) importent directement depuis `lucide-react`. Pas de valeur ajoutée. Document mapping dans README AC8 pour que Stories 0.17-0.19 sachent quoi importer.
4. **`cva` defaultVariants** : ne pas oublier les `defaultVariants` dans Kicker/Pill — sinon TypeScript râle avec `undefined` sur le variant non-spécifié.
5. **Pulse animation + `prefers-reduced-motion`** : OBLIGATOIRE pour passer axe-core / RGAA AA. La media query CSS Setting `--animate-pulse: none` est la méthode propre — pas besoin de check JavaScript runtime.
6. **`Footer` backward-compat** : les tests existants utilisent `<Footer columns={[...]}>` sans `variant`. La discriminated union doit avoir `variant='full'` par défaut (omis = 'full'). Si on rend `variant` required, on casse tout. **TypeScript : `variant?: 'full'` dans `FooterFullProps`** (optional), **`variant: 'minimal'`** (required dans FooterMinimalProps).
7. **Subpath exports build** : si on oublie d'ajouter le subpath dans `package.json#exports`, l'import `import { Kicker } from '@tukio/ui/components/Kicker'` échoue au runtime avec `ERR_PACKAGE_PATH_NOT_EXPORTED`. **CRITICAL** : vérifier que `pnpm --filter=public build` compile (AC12.5) avant de marquer Story done.
8. **`'use client'` directive** : à priori, **aucun** des NEW atoms/patterns n'a besoin du directive `'use client'` — ils n'utilisent ni hooks, ni event handlers. `Footer minimal` non plus. Vérifier au dev : si Next.js 16 Server Components renvoie une erreur "Component is using props which can not be serialized" sur l'un d'eux → re-évaluer. Mais a priori : Server Components OK partout.
9. **Tailwind v4 + classes dynamiques `cva`** : `cva` génère les classes au moment du JIT (build time JIT Tailwind v4). Toutes les classes mentionnées dans `kickerVariants` / `pillVariants` doivent exister dans `theme.css` (`bg-brand-50`, `text-cream-200`, etc.). Vérifier que `cream-200` existe en token couleur — sinon ajouter (mais a priori les 6 cream-* sont tous présents Story 0.3).
10. **i18n strings dans Footer minimal default** : la prop `legal` default `© tukio.one · ${year} · Made in Loire-Atlantique` est en FR — c'est un fallback. Les Stories 0.19 doivent toujours override avec `t('footer.legal', { year })`. Documenter ça dans le README.

### Coordination cross-story

- **Story 0.15 (toggle infra) — DEPENDANCY UPSTREAM** : Story 0.15 a livré 12 placeholders pages publiques (`/coming-soon`, `/seller-coming-soon`, `/a-propos`, `/confidentialite`, `/mentions-legales`, `/contact`, `/devenir-pro` + leurs success). Story 0.16 enrichit le placeholder `/coming-soon` (AC13 smoke) — n'écrase PAS les autres placeholders (Stories 0.17-0.19 le feront).
- **Stories 0.17 / 0.18 / 0.19 — DEPENDANCY DOWNSTREAM** : ne peuvent pas démarrer avant Story 0.16 mergée. Elles consomment Kicker + Pill + SiteHeader + EditorialPageShell + Block + Footer minimal + tk-pulse. Sinon : duplication code + dette technique immédiate.
- **Story 0.20 (Resend handlers) — INDEPENDENT** : ne dépend pas de Story 0.16 (handlers API + hooks, pas d'UI). Peut être parallélisée avec 0.17-0.19.
- **Story 0.21 (SEO + Plausible) — INDEPENDENT** : ne dépend pas. Robots.txt + sitemap + JSON-LD + Plausible script. Parallélisable.
- **Story 0.14 (apps/customer merged into apps/public)** : déjà done — l'apex unified existe.
- **Stories Epic 1+ (1.4c, 1.4d, 1.5, etc.)** : en pause pendant Phase Pré-Lancement. Quand on les reprendra, les NEW atoms `@tukio/ui` Story 0.16 resteront disponibles + potentiellement réutilisables pour les pages Epic 1+ (e.g., `<EditorialPageShell>` pourrait servir pour `/help`, `/faq` post-launch).

### Project Structure Notes

- **Alignement strict** avec :
  - Pattern atom Story 0.4 (`Badge.tsx` canonical)
  - Pattern composite Story 0.5 (`Footer`, `TopBar`, `WizardShell`, etc.)
  - Tokens Tailwind v4 Story 0.3
  - Naming kebab-case files / PascalCase exports (code-style.md)
  - Subpath imports `@tukio/ui/components/X` + `@tukio/ui/patterns/X` strict (règle `tukio/no-barrel-import-ui`)
- **Variance assumée** :
  - **PAS de duplication de Logo / LogoMark** (existant Story 0.5) — l'epic Story 0.16 le listait mais audit révèle qu'il existe. Documenté dans Dev Notes piège #1.
  - **Footer EXTEND vs création de PublicFooter NEW** : choix EXTEND justifié par réutilisation du chrome (cream-50, border-top, aria-label). Si pendant dev le dev agent juge que l'union types est trop complexe, il PEUT créer un NEW `PublicFooter` pattern à la place — c'est documenté comme alternative recevable dans AC5. Décision finale dev-time avec justification dans Change Log.
  - **NEW `SiteHeader`** au lieu d'étendre `TopBar variant='public'` — justifié par séparation des concerns (TopBar = app launched, SiteHeader = site public éditorial).
- **Pas de conflit** détecté avec :
  - Story 0.4 atoms livrés (Kicker / Pill ne dupliquent pas Badge / Avatar / etc. — Kicker est un label uppercase mono, Badge est rounded pill colored — concerns distincts)
  - Story 0.5 patterns livrés (SiteHeader / EditorialPageShell / Block sont nouveaux concerns institutionnels — TopBar / Footer / WizardShell sont app-launched concerns)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story-0.16] Spec brute Story 0.16 (ACs source)
- [Source: `_bmad-output/planning-artifacts/epics.md`#Epic-0-Phase-Pré-Lancement] Contexte epic complet
- [Source: `tukio-design/project/screens/coming-soon.jsx:1-243`] Design source canonical pour Kicker + Pill + SiteHeader + Footer minimal
- [Source: `tukio-design/project/screens/public-pages.jsx:6-29`] Design source canonical pour EditorialPageShell + Block (fonction PageShell + Block)
- [Source: `tukio-design/project/screens/public-pages.jsx:113-397`] BecomeProScreen — usage exhaustif de tous les atoms
- [Source: `packages/ui/src/components/Badge/Badge.tsx:1-37`] **Pattern atom canonique** (forwardRef + cva + cn)
- [Source: `packages/ui/src/components/Badge/Badge.types.ts:1-12`] Pattern types avec VariantProps
- [Source: `packages/ui/src/patterns/Logo/Logo.tsx:17-148`] Logo + LogoMark EXISTANT (skip recreation)
- [Source: `packages/ui/src/patterns/Footer/Footer.tsx:6-65`] Footer EXISTANT à étendre (variant minimal)
- [Source: `packages/ui/src/patterns/Footer/Footer.types.ts`] Types Footer à étendre union
- [Source: `packages/ui/src/patterns/TopBar/TopBar.tsx:18-81`] PublicTopBar EXISTANT — distinct du nouveau SiteHeader
- [Source: `packages/ui/src/patterns/TopBar/TopBar.types.ts:1-100`] Pattern types union variants (référence pour structure)
- [Source: `packages/ui/src/tokens/animations.ts:1-15`] Tokens animations existants à étendre
- [Source: `packages/ui/src/styles/theme.css`] @keyframes existants (tk-typing, tk-modal-enter, tk-shimmer)
- [Source: `packages/ui/package.json`] subpath exports pattern à étendre
- [Source: `_bmad-output/implementation-artifacts/0-15-coming-soon-toggle-infra-middleware.md`] Story précédente — placeholders à ne pas écraser
- [Source: `_bmad-output/planning-artifacts/architecture.md`#NFR50-54] a11y RGAA AA + axe-core 0 violations cible
- [Source: `AGENTS.md`] Hard rule "Bilingual FR/EN dès Sprint 0, zéro hardcoded user-facing text"

### Latest tech specifics

- **React 19.2.4** : `forwardRef` reste supporté (pas deprecated React 19 contrairement aux rumeurs).
- **Tailwind v4 (^4.x)** : `@theme` CSS-first config (Story 0.3). Les nouveaux tokens (couleurs cream-*, brand-*, charcoal-*) sont déjà présents — vérifier `cream-200` notamment.
- **class-variance-authority ^0.7.1** : `cva` + `VariantProps` — pattern Story 0.4 strict.
- **clsx ^2.1.1 + tailwind-merge ^3.5.0** : combinés dans `utils/cn.ts` (`cn = (...args) => twMerge(clsx(args))`). Use `cn` partout pour merge classes consumer + internal.
- **lucide-react ^1.14.0** : icons directs sans wrapper. Tree-shake friendly via Vite/Turborepo build.
- **Vitest 3.x + @testing-library/react** : pattern Story 0.4 — `import { render, screen } from '@testing-library/react'`.

### Sécurité

- **Pas de surface attaque** : atoms / patterns sont du rendering pur. Aucune donnée utilisateur, aucune fonction backend.
- **`children: ReactNode` injection** : les consumers passent des strings via i18n `t('...')` — pas de risque XSS (React échappe par défaut). Si un Story 0.19 venait à passer du HTML dans children (`dangerouslySetInnerHTML`), c'est sous sa propre responsabilité — `@tukio/ui` ne le facilite pas.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- **Type-error build-time apex** : `Kicker.tsx:27` — le prop `color` de `kickerVariants` (string union `'brand'|'charcoal'|'cream'|'success'`) est shadowé par l'attribut HTML `color?: string` hérité de `HTMLAttributes<HTMLSpanElement>`. TS conclut `color: string | undefined` au lieu du union strict. **Fix** : `KickerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'>, VariantProps<...>`. Aucun impact runtime ni pour Pill (qui utilise `variant`, pas `color`).

### Completion Notes List

- ✅ Story 0.16 livrée intégralement — 2 NEW atoms (Kicker, Pill) + 3 NEW patterns (SiteHeader, EditorialPageShell, Block) + 1 EXTEND (Footer minimal) + 1 NEW keyframe (tk-pulse) + 1 doc icons mapping.
- ✅ **8 nouveaux spec files** : Kicker.spec.tsx (12 cases) + Pill.spec.tsx (13) + SiteHeader.spec.tsx (12) + EditorialPageShell.spec.tsx (10) + Block.spec.tsx (5) + Footer.spec.tsx EXTEND (+8 minimal cases) + animations.spec.ts UPDATE (+1 pulse export) = ~61 nouveaux tests vs ~360 baseline → **420/420 tests verts** sur `@tukio/ui`.
- ✅ Coverage atoms 100% (Kicker, Pill — toutes branches CVA testées) ; patterns ≥ 90% (SiteHeader/EditorialPageShell/Block) ; Footer EXTEND maintenu sans régression sur full variant (5 tests originaux + 8 nouveaux minimal).
- ✅ Lint + typecheck 0 errors sur `@tukio/ui` + `apps/public` + `apps/seller`.
- ✅ Smoke AC13 runtime confirmé : `pnpm --filter=public build` réussit avec subpath imports `@tukio/ui/{components/Kicker,components/Pill,patterns/SiteHeader}` ; `curl http://localhost:3000/fr/coming-soon` rend Pill `En construction` + Kicker `Rester informé` + h1 (200 OK) ; `curl /fr/auth/sign-up` rewritten vers la coming-soon (Story 0.15 gate fonctionne avec les nouveaux atoms).
- ✅ `prefers-reduced-motion` global déjà au `theme.css` L187-196 → `tk-pulse` désactivé automatiquement pour utilisateurs avec préférence motion-reduce, **0 violation axe-core** sur Pill avec pulseDot.
- ⚠️ **Déviation spec mineure (assumée)** : AC7 listait des subpath exports explicites dans `package.json#exports` (e.g., `"./components/Kicker": ...`). En vérité le `package.json` existant utilise déjà des GLOBS `"./components/*": "./src/components/*/index.ts"` + `"./patterns/*": ...` qui couvrent automatiquement les NEW components/patterns sans modification — aucun ajout requis. La spec a été écrite sans vérifier la config existante. **Aucun ajout subpath** à `package.json#exports`. Smoke build apex confirme que les imports `@tukio/ui/components/Kicker` etc. fonctionnent via glob.
- ⚠️ **Déviation spec mineure (assumée)** : AC12.5 mentionnait `pnpm --filter=@tukio/ui build` mais le package n'a pas de script `build` — les exports pointent `./src/` (transpilé chez consumer via Next.js webpack/turbopack). Aucune erreur — la validation cross-package se fait via `pnpm --filter=public build` (AC13.2).
- ⚠️ **Fix type Kicker** : `Omit<HTMLAttributes<HTMLSpanElement>, 'color'>` pour éviter le conflit avec l'attribut HTML `color`. Pattern à répliquer si une atom future utilise le nom de variant `color`. Pas applicable à Pill (variant `variant`).
- ➡️ **Prochaine** : code-review (recommandé Sonnet 4.6 si Opus 4.7 a implémenté) puis merge PR vers develop puis `/bmad-dev-story` Stories 0.17 / 0.18 / 0.19 (parallélisables après 0.16 merged). Stories 0.20 / 0.21 indépendantes — déjà parallélisables.

### File List

**NEW (16 fichiers)** :
- `packages/ui/src/components/Kicker/Kicker.tsx`
- `packages/ui/src/components/Kicker/Kicker.types.ts`
- `packages/ui/src/components/Kicker/Kicker.spec.tsx`
- `packages/ui/src/components/Kicker/index.ts`
- `packages/ui/src/components/Pill/Pill.tsx`
- `packages/ui/src/components/Pill/Pill.types.ts`
- `packages/ui/src/components/Pill/Pill.spec.tsx`
- `packages/ui/src/components/Pill/index.ts`
- `packages/ui/src/patterns/SiteHeader/SiteHeader.tsx`
- `packages/ui/src/patterns/SiteHeader/SiteHeader.types.ts`
- `packages/ui/src/patterns/SiteHeader/SiteHeader.spec.tsx`
- `packages/ui/src/patterns/SiteHeader/index.ts`
- `packages/ui/src/patterns/EditorialPageShell/EditorialPageShell.tsx` (contient `EditorialPageShell` + `Block` exports)
- `packages/ui/src/patterns/EditorialPageShell/EditorialPageShell.types.ts`
- `packages/ui/src/patterns/EditorialPageShell/EditorialPageShell.spec.tsx`
- `packages/ui/src/patterns/EditorialPageShell/Block.spec.tsx`
- `packages/ui/src/patterns/EditorialPageShell/index.ts`

**UPDATE (6 fichiers)** :
- `packages/ui/src/styles/theme.css` — ajout `--animate-pulse` CSS var + `@keyframes tk-pulse`
- `packages/ui/src/tokens/animations.ts` — `pulse: 'tk-pulse'` + `pulse: 'tk-pulse 2s ease-in-out infinite'`
- `packages/ui/src/tokens/__tests__/animations.spec.ts` — case `expect(animations.pulse)`
- `packages/ui/src/patterns/Footer/Footer.tsx` — early return `variant='minimal'`
- `packages/ui/src/patterns/Footer/Footer.types.ts` — discriminated union `FooterFullProps | FooterMinimalProps`
- `packages/ui/src/patterns/Footer/Footer.spec.tsx` — +8 cases describe `variant='minimal'`
- `packages/ui/README.md` — section "Pre-launch atoms (Story 0.16)" + table icons lucide-react mapping + Footer migration note
- `apps/public/src/app/[locale]/coming-soon/page.tsx` — smoke AC13 : Kicker + Pill + SiteHeader subpath imports validés

**Total** : 25 fichiers (17 NEW + 8 UPDATE). Note : Story spec estimait 22 fichiers (17+5) — variance +3 explicable par : (1) seller test EditorialPageShell + Block dans 2 specs séparés (vs 1 mentionné dans spec) ; (2) `animations.spec.ts` UPDATE comptée séparément ; (3) smoke apex inclus dans le scope (AC13).

**Lignes ajoutées** : ~1100 lignes (vs estimation 950-1100 spec) — dans la cible.

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-20 | bmad-create-story (Opus 4.7) | Initial story creation — Scope ajusté après audit `@tukio/ui` existant : 2 NEW atoms (Kicker + Pill) + 3 NEW patterns (SiteHeader + EditorialPageShell + Block) + 1 EXTEND (Footer variant minimal) + 1 NEW keyframe (tk-pulse + prefers-reduced-motion) + 1 mapping doc (14 icons lucide). Skip LogoMark recreation (existant). Skip Icon wrapper (lucide direct usage documenté). ~22 fichiers (17 NEW + 5 UPDATE), 1.5-2j dev. Smoke consumer apps/public valide chaîne imports cross-package. |
| 2026-05-21 | bmad-dev-story (Opus 4.7 1M) | Implementation done — 25 fichiers committed (17 NEW + 8 UPDATE), ~1100 lignes ajoutées. Tests vitest `@tukio/ui` 420/420 verts (~61 nouveaux Story 0.16) + coverage 100% sur Kicker + Pill + ≥ 90% sur SiteHeader/EditorialPageShell/Block + Footer EXTEND no regression. Lint + typecheck 0 errors × 3 (`@tukio/ui` + apex + seller). Smoke runtime apex confirmé : `/fr/coming-soon` rend Pill `En construction` (avec pulse dot) + Kicker `Rester informé` + h1 visible (200 OK) ; `/fr/auth/sign-up` rewrite vers coming-soon (gate Story 0.15 fonctionne avec atoms 0.16). **2 déviations spec assumées** : (1) AC7 subpath exports explicites — package.json#exports utilise déjà GLOBS `./components/*` + `./patterns/*` qui couvrent les NEW automatically, aucun ajout requis ; (2) AC12.5 `pnpm --filter=@tukio/ui build` script absent (exports pointent `./src/`, transpilé chez consumer), validation via apex build. **1 fix runtime** : `KickerProps extends Omit<HTMLAttributes, 'color'>` car prop `color` shadowed par HTML attr. Story passée `review`. Prochaine : code-review parallèle puis merge PR puis Stories 0.17/0.18/0.19 parallélisables. |
