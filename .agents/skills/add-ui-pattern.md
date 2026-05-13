# Skill: add a new UI pattern (composite) in `@tukio/ui`

Use this when introducing a **multi-atom composite** that recurs across
multiple frontends or features — `TopBar`, `FilterSidebar`,
`ConversationThread`, `AvailabilityCalendar`, `PricingDisplay`.
Patterns live in `packages/ui/src/patterns/<Name>/`.

Same folder shape as atoms: `<Name>.tsx`, `<Name>.types.ts`,
`<Name>.spec.tsx`, `index.ts`.

## Is this actually a pattern (vs an atom, vs app-local)?

| If…                                                                                 | It's…                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Single visual responsibility, no composition                                        | atom (`components/`)                                    |
| Composes atoms (and/or other patterns) into a recurring widget across ≥ 2 frontends | pattern (`patterns/`)                                   |
| Carries a Tukio domain concept (`Listing`, `Booking`, `Pro`)                        | app-local component (in the relevant `apps/<app>/src/`) |
| Used in only 1 feature in 1 frontend, no reuse planned                              | app-local component                                     |

If unsure, default to **app-local**. Promote to a pattern when a second
feature wants the same thing — don't predict.

## Prerequisites

- Confirm the pattern doesn't already exist (`ls packages/ui/src/patterns/`).
- Confirm ≥ 2 consumer screens (or 1 + clearly imminent).
- Identify which atoms the pattern composes (must already exist in
  `@tukio/ui/components/`, or scaffold them first via
  `.agents/skills/add-ui-component.md`).
- Read `.agents/context/atomic-design.md`.
- Read `packages/ui/src/patterns/TopBar/` for the canonical shape.

## Step-by-step

1. **Sketch the API.** What props does the consumer pass? Common shape:
   - `data` — the model the pattern displays (typed via app-level types,
     **never** Tukio-domain — accept a generic shape via `<T>` if needed).
   - `onAction` — callbacks fired on user interaction.
   - `variant` / `size` / `tone` — visual configuration.
   - `slots` — `ReactNode` props for consumer customisation
     (`leftSlot`, `bottomSlot`).

   **No data fetching, no Tukio-domain types.** If you need to pass
   `Listing[]`, the pattern accepts `items: TListingShape[]` where
   `TListingShape` is a generic interface declared in the pattern's
   types.

2. **Folder skeleton.** Mirror an atom:

   ```
   packages/ui/src/patterns/<Name>/
   ├── <Name>.tsx
   ├── <Name>.types.ts
   ├── <Name>.spec.tsx
   └── index.ts
   ```

3. **Implementation.**
   - `'use client'` at the top if the pattern has interactive state.
   - Compose atoms via subpath imports:
     `import { Button } from '../../components/Button'` (within the
     package, relative is fine; from consumers, subpath).
   - Use `cva` for the pattern's own variant API (if it has one).
   - State management: prefer **uncontrolled** (`defaultOpen`) with
     callbacks; offer **controlled** alternatives
     (`open` + `onOpenChange`) only when consumers need it.
   - Accessibility: keyboard navigation across composed atoms,
     `role="region"` / `role="navigation"` / `role="dialog"` on the
     container as appropriate, `aria-label` from props.

4. **Types** in `<Name>.types.ts`. Use generics for data shapes:

   ```ts
   export interface <Name>Item {
     id: string;
     label: string;
     // ...
   }

   export interface <Name>Props<TItem extends <Name>Item = <Name>Item> {
     items: TItem[];
     selectedId?: string;
     onSelect?: (item: TItem) => void;
     // ...
   }
   ```

5. **Index re-export** + **package.json subpath**:

   ```json
   "./patterns/<Name>": {
     "types": "./src/patterns/<Name>/index.ts",
     "default": "./src/patterns/<Name>/index.ts"
   }
   ```

6. **Update `packages/ui/README.md`** "Available subpaths" table.

7. **Tests** — same expectations as an atom, plus integration-level:
   - Composes the right atoms (assert by `screen.getByRole(...)` —
     check each atom's role is present).
   - Callbacks fire with the right args on user interaction.
   - Keyboard navigation works across composed atoms (Tab order,
     Enter/Space).
   - Open / close (if applicable) preserves focus correctly.
   - Edge cases: empty `items`, `loading`, error display via
     `<EmptyState>` / `<Alert>` atoms.

8. **Run `/check`**:

   ```bash
   pnpm --filter=@tukio/ui typecheck && lint && test
   ```

9. **Consume in at least one frontend feature**. Verify visually
   (`pnpm --filter=<app> dev`).

10. **Commit + PR.** `feat(@tukio/ui): add <Name> pattern — Story <X.Y>`.

## Anti-patterns to refuse

- Putting domain-specific logic (`if (listing.isPublished) ...`)
  inside the pattern. Pass behaviour through callbacks / slots.
- Bringing in a new heavy dep (Mapbox, Date library beyond what's
  already in the stack). Surface and ask.
- Fetching data inside the pattern (`useQuery`, `fetch`). Consumers
  fetch and pass.
- Inline `#hex` colors — token utilities only.
- Skipping the `index.ts` + subpath export — consumers can't import
  the pattern otherwise.
- Adding a third pattern that duplicates 80 % of an existing one.
  Refactor the existing pattern's variant API instead.
- Promoting an app-local component "just in case" — wait for the second
  consumer.
