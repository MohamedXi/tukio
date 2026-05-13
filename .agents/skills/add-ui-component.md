# Skill: add a new UI atom (component) in `@tukio/ui`

Use this when introducing a new **single-responsibility primitive** to
the design system — a Button variant, a new Input shape, an Alert, a
Tooltip, a Skeleton variant. Atoms live in
`packages/ui/src/components/<Name>/`.

The canonical reference is **`packages/ui/src/components/Button/`**.

## Is this actually an atom?

- ✅ It has a **single visual responsibility** (button, input, badge,
  divider). Can be described without reference to a Tukio domain
  concept.
- ✅ It's **stateless** (or owns purely local UI state like
  open/closed). No data fetching, no Tukio-specific business logic.
- ✅ It can be reused across all 4 frontends (`public`, `customer`,
  `seller`, `admin`).
- ✅ It composes only HTML primitives + maybe other atoms (`Button`
  uses `Spinner`).

If you find yourself wanting to reference `Listing`, `Booking`, `Pro`,
`Payment` — it's not an atom. It's either a `@tukio/ui` pattern (if
recurring across multiple features), an app-local component, or a
shared package elsewhere.

## Prerequisites

- Confirm the atom doesn't already exist (`ls packages/ui/src/components/`).
- Confirm there's a real demand: at least one consumer screen needs it.
- Read `.agents/context/atomic-design.md` in full.
- Read `packages/ui/src/components/Button/` as the canonical shape.

## Folder skeleton

```
packages/ui/src/components/<Name>/
├── <Name>.tsx              implementation, forwardRef, cva variants
├── <Name>.types.ts         exported props + variant unions
├── <Name>.spec.tsx         Vitest + Testing Library
└── index.ts                re-exports component + types
```

## Step-by-step

1. **Decide the variant axes.** What configurable dimensions does the
   atom have? Common axes: `variant` (visual style), `size`, `tone`
   (success/warning/danger), `weight`, `direction`. Keep it minimal:
   atoms are composed at the call site, not pre-configured here.

2. **Define types** in `<Name>.types.ts`:

   ```ts
   import type { HTMLAttributes, ReactNode } from 'react';
   import type { VariantProps } from 'class-variance-authority';
   import type { <name>Variants } from './<Name>';

   export type <Name>Variant = 'primary' | 'secondary' | ...;
   export type <Name>Size = 'sm' | 'default' | 'lg';

   export interface <Name>Props
     extends HTMLAttributes<HTML<X>Element>,
       VariantProps<typeof <name>Variants> {
     // additional props (icon, loading, …)
   }
   ```

3. **Implement** in `<Name>.tsx`:

   ```tsx
   'use client';
   import { forwardRef } from 'react';
   import { cva } from 'class-variance-authority';
   import { cn } from '../../utils/cn';
   import type { <Name>Props } from './<Name>.types';

   export const <name>Variants = cva(
     '<base classes — focus ring, transition, alignment>',
     {
       variants: {
         variant: { primary: '<...>', secondary: '<...>', ... },
         size: { sm: '<...>', default: '<...>', lg: '<...>' },
       },
       defaultVariants: { variant: 'primary', size: 'default' },
     },
   );

   export const <Name> = forwardRef<HTML<X>Element, <Name>Props>(
     ({ className, variant, size, children, ...props }, ref) => {
       return (
         <html-element-or-Slot
           ref={ref}
           className={cn(<name>Variants({ variant, size }), className)}
           {...props}
         >
           {children}
         </html-element-or-Slot>
       );
     },
   );
   <Name>.displayName = '<Name>';
   ```

   Use **tokens via Tailwind utilities only** — `bg-brand-500`,
   `text-cream-50`, `ring-brand-200`. Never `#hex` or inline styles.

4. **Index** in `index.ts`:

   ```ts
   export { <Name>, <name>Variants } from './<Name>';
   export type { <Name>Props, <Name>Variant, <Name>Size } from './<Name>.types';
   ```

5. **Wire the subpath export** in `packages/ui/package.json#exports`:

   ```json
   "./components/<Name>": {
     "types": "./src/components/<Name>/index.ts",
     "default": "./src/components/<Name>/index.ts"
   }
   ```

6. **Update `packages/ui/README.md`** "Available subpaths" table —
   alphabetical order.

7. **Write tests** in `<Name>.spec.tsx`. Cover:
   - Default render (variant, size, children).
   - Each variant + size combination (light snapshot via `getByRole`
     class assertions; behaviour-focused, not full DOM snapshots).
   - Keyboard interaction (Tab → focus visible; Enter/Space activates
     when applicable).
   - `disabled` + `loading` states if applicable (`toBeDisabled()`,
     `aria-busy="true"`).
   - Ref forwarding (`<X ref={ref} />`, assert `ref.current` is
     the underlying DOM element).
   - ClassName override + className merging.

   ```tsx
   import { render, screen } from '@testing-library/react';
   import { Button } from './Button';

   describe('Button', () => {
     it('renders with default primary variant', () => {
       render(<Button>OK</Button>);
       expect(screen.getByRole('button', { name: 'OK' })).toHaveClass('bg-brand-500');
     });

     it('shows Spinner when loading', () => {
       render(<Button loading>Submit</Button>);
       expect(screen.getByRole('button')).toBeDisabled();
     });
   });
   ```

8. **Run `/check`** at the package level:

   ```bash
   pnpm --filter=@tukio/ui typecheck
   pnpm --filter=@tukio/ui lint
   pnpm --filter=@tukio/ui test
   ```

9. **Consume the atom** in at least one frontend feature (the one that
   prompted the request). Verify visually with `pnpm --filter=<app> dev`.

10. **Commit + PR.** `feat(@tukio/ui): add <Name> atom — Story <X.Y>`.

## Anti-patterns to refuse

- Inline `#hex` or `rgb(...)` in the atom — use tokens.
- Skipping `forwardRef` — atoms wrap DOM, ref is part of the contract.
- Skipping `'use client'` on an interactive atom (anything with
  `onClick`, state, focus management).
- Bringing in a new dependency for a one-off atom — surface and ask.
- Adding `useQuery` / `fetch` to the atom — pass data via props.
- Adding domain concepts (`Listing`, `Pro`, `Booking`) to the atom — it
  belongs in a pattern or app-local.
- Pre-optimising with `React.memo` / `useCallback` "to be safe" —
  measure first.
- Skipping `:focus-visible` ring — RGAA AA mandates it.
- Skipping the spec file — atoms ship with tests, no exceptions.
