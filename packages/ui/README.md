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

| Subpath                            | Contents                                        |
| ---------------------------------- | ----------------------------------------------- |
| `@tukio/ui`                        | Global types only (`BrandShade`, `ColorScale`)  |
| `@tukio/ui/styles/globals.css`     | Tailwind v4 + theme.css + reset (CSS-only)      |
| `@tukio/ui/styles/theme.css`       | Tailwind v4 `@theme` tokens                     |
| `@tukio/ui/tokens`                 | All tokens aggregated as `tokens` const         |
| `@tukio/ui/tokens/colors`          | Brand terracotta + cream/charcoal + functional  |
| `@tukio/ui/tokens/typography`      | Fraunces / Inter / JetBrains Mono + scale 1.250 |
| `@tukio/ui/tokens/spacing`         | Base 4 px (13 stops)                            |
| `@tukio/ui/tokens/radius`          | sm/md/lg/xl/2xl/full                            |
| `@tukio/ui/tokens/shadows`         | Warm-tinted (charcoal-700 base rgba)            |
| `@tukio/ui/tokens/breakpoints`     | xs/sm/md/lg/xl/2xl                              |
| `@tukio/ui/tokens/animations`      | `tk-typing`, `tk-modal-enter`, `tk-shimmer`     |
| `@tukio/ui/themes/stripe-elements` | Stripe `Appearance` derived from tokens         |

## Single source of truth

`theme.css` holds the canonical token values. The TS modules under `tokens/` mirror them for programmatic access. A Vitest test (`tokens-css-sync.spec.ts`) parses `theme.css` and asserts strict equality — drift fails CI.

## Conventions

- **No pure black or white** — always `charcoal-X` or `cream-X`.
- **`prefers-reduced-motion: reduce`** is non-negotiable (RGAA AA).
- **Fonts via `next/font/google`** in each app's `layout.tsx` — never via `<link>` or CSS `@import url(https://fonts.googleapis.com)` (RGPD + LCP).
- **`text-wrap: balance`** on `<h*>`, **`text-wrap: pretty`** on `<p>`.

## References

- UX spec §Design System Documentation (lines 445–707)
- ADR-013 frontend multi-zones (Story 0.13)
