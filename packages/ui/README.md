# @tukio/ui

Tukio design system: Tailwind v4 tokens (CSS-first), TypeScript tokens for programmatic access, shared `globals.css`, Stripe Elements theme. Components arrive in Story 0.4, patterns in Story 0.5.

## How to import

```ts
// CSS — in apps/<app>/src/app/globals.css (or src/app/[locale]/globals.css)
@import "@tukio/ui/styles/globals.css";

// TypeScript tokens
import { colors } from '@tukio/ui/tokens/colors';
import { fontFamily, fontSize } from '@tukio/ui/tokens/typography';
import { tokens } from '@tukio/ui/tokens';

// Stripe Elements theme (wired into checkout in Story 4.5)
import { stripeElementsTheme } from '@tukio/ui/themes/stripe-elements';

// Global types
import type { BrandShade, ColorScale } from '@tukio/ui';
```

## ❌ Forbidden

```ts
// Lint rule tukio/no-barrel-import-ui rejects barrel imports of named values.
import { colors } from '@tukio/ui';
import { Button } from '@tukio/ui'; // Story 0.4 components: subpath only
```

## Available subpaths

| Subpath                            | Contents                                                |
| ---------------------------------- | ------------------------------------------------------- |
| `@tukio/ui`                        | Global types only (`BrandShade`, `ColorScale`)          |
| `@tukio/ui/styles/globals.css`     | Tailwind v4 + theme.css + reset (CSS-only)              |
| `@tukio/ui/styles/theme.css`       | Tailwind v4 `@theme` tokens                             |
| `@tukio/ui/tokens`                 | All tokens aggregated as `tokens` const                 |
| `@tukio/ui/tokens/colors`          | Brand terracotta + cream/charcoal + functional          |
| `@tukio/ui/tokens/typography`      | Fraunces / Inter / JetBrains Mono + scale 1.250         |
| `@tukio/ui/tokens/spacing`         | Base 4 px (13 stops)                                    |
| `@tukio/ui/tokens/radius`          | sm/md/lg/xl/2xl/full                                    |
| `@tukio/ui/tokens/shadows`         | Warm-tinted (charcoal-700 base rgba)                    |
| `@tukio/ui/tokens/breakpoints`     | xs/sm/md/lg/xl/2xl                                      |
| `@tukio/ui/tokens/animations`      | `tk-typing`, `tk-modal-enter`, `tk-shimmer`, `tk-pulse` |
| `@tukio/ui/themes/stripe-elements` | Stripe `Appearance` derived from tokens                 |

## Single source of truth

`theme.css` holds the canonical token values. The TS modules under `tokens/` mirror them for programmatic access. A Vitest test (`tokens-css-sync.spec.ts`) parses `theme.css` and asserts strict equality — drift fails CI.

## Pre-launch atoms (Story 0.16)

Atoms + patterns introduced for the Coming Soon phase (Stories 0.17/0.18/0.19).
All are i18n-fed — strings are passed via props, never hardcoded.

| Subpath                                 | Export(s)                          | Purpose                                                                                          |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@tukio/ui/components/Kicker`           | `Kicker`, `kickerVariants`         | Uppercase mono label (`color`: brand/charcoal/cream/success, `size`: sm/md)                      |
| `@tukio/ui/components/Pill`             | `Pill`, `pillVariants`             | Rounded pill with optional pulsing dot + optional icon (`variant`: brand/charcoal/success/cream) |
| `@tukio/ui/patterns/SiteHeader`         | `SiteHeader`                       | Minimal editorial header (logo + optional navItems + rightSlot). Distinct from `TopBar`.         |
| `@tukio/ui/patterns/EditorialPageShell` | `EditorialPageShell`, `Block`      | Two-column editorial shell (kicker + h1 + intro + header/footer slots) + `<Block>` sections      |
| `@tukio/ui/patterns/Footer`             | `Footer` (new `variant="minimal"`) | Inline logo + copyright + 2-4 footer links. `variant` defaults to `'full'` (backward-compat).    |

### `tk-pulse` keyframe

Pill `pulseDot` uses `var(--animate-pulse)` which resolves to
`tk-pulse 2s ease-in-out infinite`. The global `@media (prefers-reduced-motion: reduce)`
rule in `theme.css` clamps animation duration to ~0ms, so the dot is static for
users with motion preferences disabled — no extra wiring needed in consumers.

### Distinction: `SiteHeader` vs `TopBar`

`TopBar variant="public"` is the **post-launch app header** (search input,
category links, Login/Sign up buttons). `SiteHeader` is the **pre-launch /
institutional header** (logo + minimal nav). Pick the one that matches the
page's purpose — they're not interchangeable.

### Icons — lucide-react direct usage

Story 0.16 does **not** introduce an `<Icon>` wrapper. Consumers import
icons directly from `lucide-react` (tree-shake friendly, type-safe). The
table below maps design names from `tukio-design/screens/{coming-soon,public-pages}.jsx`
to their lucide-react equivalents — use the right-hand identifier in imports:

| Design name | `lucide-react` import | Used by                                                                  |
| ----------- | --------------------- | ------------------------------------------------------------------------ |
| `arrow`     | `ArrowRight`          | "Me prévenir à l'ouverture" CTA trailing icon (Story 0.17)               |
| `shield`    | `Shield`              | Reassurance "Vos données restent en France" + Privacy banner (0.17/0.19) |
| `bolt`      | `Zap`                 | "tukio.one n'est pas encore ouverte" banner (Story 0.18 + Legal 0.19)    |
| `check`     | `Check`               | List items, pipeline steps (Stories 0.18/0.19)                           |
| `card`      | `CreditCard`          | Payments mode section (Story 0.18)                                       |
| `message`   | `MessageSquare`       | Communication card (Story 0.18)                                          |
| `calendar`  | `Calendar`            | Calendar card (Story 0.18)                                               |
| `chart`     | `BarChart3`           | Stats card (Story 0.18)                                                  |
| `doc`       | `FileText`            | Admin card (Story 0.18)                                                  |
| `user`      | `User`                | Animation services card + Presse channel (Stories 0.18/0.19)             |
| `tent`      | `Tent`                | Tents and marquees métier card (Story 0.18)                              |
| `package`   | `Package`             | Event furniture métier card (Story 0.18)                                 |
| `flame`     | `Flame`               | Catering and drinks métier card (Story 0.18)                             |
| `sparkle`   | `Sparkles`            | Decoration and flowers métier card (Story 0.18)                          |

### Footer migration note

`<Footer columns={[...]}>` calls from Story 0.5 keep working unchanged — the
new `variant` prop defaults to `'full'`. Switch to `variant="minimal"` for
editorial/landing pages where the full 4-column grid is overkill.

## Conventions

- **No pure black or white** — always `charcoal-X` or `cream-X`.
- **`prefers-reduced-motion: reduce`** is non-negotiable (RGAA AA).
- **Fonts via `next/font/google`** in each app's `layout.tsx` — never via `<link>` or CSS `@import url(https://fonts.googleapis.com)` (RGPD + LCP).
- **`text-wrap: balance`** on `<h*>`, **`text-wrap: pretty`** on `<p>`.

## References

- UX spec §Design System Documentation (lines 445–707)
- ADR-013 frontend multi-zones (Story 0.13)
