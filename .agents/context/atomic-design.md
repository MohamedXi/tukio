# Atomic design — `@tukio/ui`

The frontend design system lives in `packages/ui/` and is consumed by
all 4 frontends (`public`, `customer`, `seller`, `admin`). It follows
the **atomic design ladder**, adapted to the Tukio scale:

| Folder                        | Role                                                         | Examples                                                        |
| ----------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| `packages/ui/src/tokens/`     | Tailwind v4 CSS-first `@theme` tokens + TypeScript exports   | `colors`, `typography`, `spacing`, `radius`, `shadows`          |
| `packages/ui/src/styles/`     | Importable CSS — `globals.css`, `theme.css`, reset           | (CSS only, no TS)                                               |
| `packages/ui/src/themes/`     | App-specific theme variants (Stripe Elements, future shadcn) | `stripe-elements.ts`                                            |
| `packages/ui/src/components/` | **ATOMS** — small primitives, single responsibility          | Button, Input, Alert, Badge, Card, Modal, Spinner, Stars        |
| `packages/ui/src/patterns/`   | **COMPOSITES** — multi-atom blocks                           | TopBar, FilterSidebar, ConversationThread, AvailabilityCalendar |

Canonical reference for an atom: **`packages/ui/src/components/Button/`**.

## What's an atom vs a pattern

**Atom (`components/`)** — single visual responsibility, no domain logic, no
data fetching, configurable via props. Uses `cva` for variant API,
`forwardRef`, `Slot` (Radix) for `asChild` composition.

**Pattern (`patterns/`)** — composes multiple atoms (and sometimes patterns)
into a recurring layout / widget. May orchestrate small interactive state
(open/close), but data fetching stays in the consuming app. A pattern
that grows app-specific belongs in the app, not in `@tukio/ui`.

If you can describe the thing without referencing a Tukio domain concept
(`Button`, `Card`, `Modal`), it's an atom. If you can describe it but it
implies a Tukio screen pattern (`FilterSidebar`, `ConversationThread`,
`PricingDisplay`), it's a pattern. If you must describe it with a feature
name (`ListingCard`, `BookingTimeline`), it's app-local — keep it out of
`@tukio/ui`.

## Folder convention (mirror this for new atoms / patterns)

```
packages/ui/src/components/Button/
├── Button.tsx          implementation (forwardRef, cva variants)
├── Button.types.ts     exported props + variant unions
├── Button.spec.tsx     Vitest + Testing Library
└── index.ts            re-exports Button + types
```

Same shape for patterns: `packages/ui/src/patterns/TopBar/{TopBar.tsx,
TopBar.types.ts, TopBar.spec.tsx, index.ts}`.

## Imports — subpath only

`tukio/no-barrel-import-ui` (warn at MVP, error at Story 0.11) **rejects**
barrel imports of named values from `@tukio/ui`.

```ts
// ✅ Subpath imports — always
import { Button } from '@tukio/ui/components/Button';
import { TopBar } from '@tukio/ui/patterns/TopBar';
import { colors } from '@tukio/ui/tokens/colors';
import { stripeElementsTheme } from '@tukio/ui/themes/stripe-elements';
import '@tukio/ui/styles/globals.css';

// ❌ Barrel imports of named values — forbidden
import { Button, colors } from '@tukio/ui';
```

The only allowed imports from the bare `@tukio/ui` entry are **type
re-exports** (`BrandShade`, `ColorScale`).

## Subpath map (`packages/ui/package.json#exports`)

| Subpath                            | Contents                                           |
| ---------------------------------- | -------------------------------------------------- |
| `@tukio/ui`                        | Global types only (`BrandShade`, `ColorScale`)     |
| `@tukio/ui/styles/globals.css`     | Tailwind v4 + theme.css + reset (CSS-only)         |
| `@tukio/ui/styles/theme.css`       | Tailwind v4 `@theme` tokens                        |
| `@tukio/ui/tokens`                 | All tokens aggregated as `tokens` const            |
| `@tukio/ui/tokens/colors`          | Brand terracotta + cream/charcoal + functional     |
| `@tukio/ui/tokens/typography`      | Fraunces / Inter / JetBrains Mono + scale 1.250    |
| `@tukio/ui/tokens/<other>`         | Spacing, radius, shadows, motion, breakpoints      |
| `@tukio/ui/themes/stripe-elements` | Stripe Elements theme (used in checkout Story 4.5) |
| `@tukio/ui/components/<Name>`      | Each atom (Button, Input, …)                       |
| `@tukio/ui/patterns/<Name>`        | Each pattern (TopBar, FilterSidebar, …)            |

## Anatomy of an atom (`Button` reference)

```tsx
// packages/ui/src/components/Button/Button.tsx
'use client';
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
      size: { sm: 'h-8 px-3 text-sm', default: 'h-10 px-4 text-base', lg: 'h-12 px-5 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, icon, iconRight, children, disabled, asChild, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : icon}
        {children}
        {iconRight}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
```

```ts
// packages/ui/src/components/Button/Button.types.ts
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { buttonVariants } from './Button';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'default' | 'lg';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  asChild?: boolean;
}
```

```ts
// packages/ui/src/components/Button/index.ts
export { Button, buttonVariants } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types';
```

## Tokens & Tailwind v4

- **CSS-first.** Tokens declared in `packages/ui/src/styles/theme.css`
  under `@theme {}`. Tailwind v4 generates utilities at build time from
  these tokens.
- **No `tailwind.config.js`.** All configuration lives in `theme.css`.
- **TypeScript exports** (`@tukio/ui/tokens/colors`) are for programmatic
  access (Stripe Elements theme, server-side rendering, tests). They
  mirror the CSS tokens 1:1 — keep them in sync.
- **Brand palette**: terracotta (brand) + cream + charcoal + functional
  (success / warning / danger / info). See `@tukio/ui/tokens/colors`.
- **Typography**: Fraunces (display), Inter (body), JetBrains Mono (code).
  Scale 1.250.

## Hard rules

- ✅ Subpath imports only (above).
- ✅ Atoms in `components/`, composites in `patterns/`. App-specific
  pieces stay in the app.
- ✅ One atom = one folder = `<Name>.tsx` + `.types.ts` + `.spec.tsx` +
  `index.ts`.
- ✅ `'use client'` on every interactive atom.
- ✅ `forwardRef` on every atom that wraps a DOM element.
- ✅ `cva` for variant API. Variants live next to the component, not in a
  shared file.
- ❌ **Never** put a `#hex` color or `rgb(...)` value in a component —
  always go through tokens (Tailwind utilities or `@tukio/ui/tokens/colors`).
- ❌ **Never** wire data fetching (`useQuery`, `fetch`) into an atom or
  pattern. Keep `@tukio/ui` purely presentational.
- ❌ **Never** import a Tukio app-specific concept into `@tukio/ui` —
  no `import { Listing } from '@tukio/contracts/...'`. The library
  ships generic primitives.
- ❌ **Never** add a focus state without `:focus-visible` + a visible
  ring; RGAA AA mandates it.

## Accessibility baseline

Every atom MUST handle:

1. **Keyboard navigation** — tab order, Enter/Space activation.
2. **Focus ring** — `:focus-visible` with `ring-brand-200 ring-offset-2`.
3. **Disabled state** — `disabled:opacity-50 disabled:cursor-not-allowed`,
   `aria-disabled`.
4. **Loading state** — replaces icon with `<Spinner size="sm" />`,
   `aria-busy="true"`.
5. **Color contrast** — WCAG AA minimum (4.5:1 for normal text, 3:1 for
   large). Tokens are pre-validated.

## Adding a new component

See **`.agents/skills/add-ui-component.md`** (atom) and
**`.agents/skills/add-ui-pattern.md`** (composite).
