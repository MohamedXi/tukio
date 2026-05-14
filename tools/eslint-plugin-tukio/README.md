# eslint-plugin-tukio

Custom ESLint rules enforcing Tukio monorepo conventions. Twelve rules across
four themes: anti-barrel imports, NATS event naming, REST envelope, i18n
discipline, design-system tokens, and error-code catalog. Loaded by the root
`eslint.config.mjs`.

## Rules

| Rule                               | Default | Theme                          | Story |
| ---------------------------------- | ------- | ------------------------------ | ----- |
| `tukio/event-naming`               | error   | NATS naming                    | 0.2   |
| `tukio/no-barrel-import-contracts` | error   | Subpath imports                | 0.2   |
| `tukio/no-barrel-import-ui`        | error   | Subpath imports                | 0.3   |
| `tukio/no-direct-event-publish`    | error   | OutboxPublisher discipline     | 0.7   |
| `tukio/no-fr-paths`                | error   | i18n / paths EN strict (NFR58) | 0.11  |
| `tukio/no-hardcoded-text`          | error   | i18n / next-intl (NFR56)       | 0.11  |
| `tukio/no-class-validator`         | error   | Zod-only validation            | 0.11  |
| `tukio/error-code-format`          | error   | Error catalog shape            | 0.11  |
| `tukio/no-buyer`                   | error   | Terminology (customer)         | 0.11  |
| `tukio/no-bypass-envelope`         | error   | REST envelope discipline       | 0.11  |
| `tukio/no-pure-black-white`        | error   | Design tokens (UX line 711)    | 0.11  |
| `tukio/require-correlation-id`     | warn    | Tracing                        | 0.11  |

## `tukio/no-fr-paths`

URL paths must be 100% English. FR slugs live in `*_translations` tables for
SEO hreflang only — never in code.

```ts
// ✅
const url = '/fr/category/marquees';
const url = '/en/profile/edit';
router.push('/en/help');

// ❌
const url = '/fr/categorie/tentes'; // → autofixed to '/fr/category/tentes'
redirect('/profil/edit');
router.push('/panier');
```

## `tukio/no-hardcoded-text`

User-facing UI strings must come from `messages/{fr,en}.json` via `next-intl`'s
`useTranslations()`. Catches JSX text content and translatable attributes
(`aria-label`, `placeholder`, `title`, `alt`, `label`). Tech-only strings
(`utf-8`, `application/json`, `tukio.one`…) are whitelisted.

```tsx
// ✅
<button>{t('reserve')}</button>
<input placeholder={t('email_placeholder')} />

// ❌
<button>Reserver</button>
<input placeholder="Adresse email" />
<button aria-label="Fermer la modale" />
```

## `tukio/no-class-validator`

`class-validator` and `class-transformer` are forbidden. DTOs use Zod schemas
from `@tukio/contracts/dtos/*`, wired through `ZodValidationPipe`.

```ts
// ✅
import { CreateListingSchema } from '@tukio/contracts/dtos/catalog';

// ❌
import { IsString, IsEmail } from 'class-validator';
```

## `tukio/error-code-format`

`tukioCode` properties on `DomainException` subclasses must match the catalog
shape `<DOMAIN>-<CATEGORY>-<NNN>` (Architecture lines 1707-1715).

```ts
// ✅
class InvalidEmailException extends DomainException {
  tukioCode = 'AUTH-INVALID-EMAIL-001';
}

// ❌
{
  tukioCode: 'booking_conflict';
}
{
  tukioCode: 'BookingConflict';
}
{
  tukioCode: 'BOOKING-CONFLICT';
} // missing -NNN suffix
```

## `tukio/no-buyer`

The canonical term is `customer` — both for B2C particuliers and B2B pros.
`buyer` is forbidden across identifiers and string literals.

```ts
// ✅
interface Customer {
  id: CustomerId;
}
const role = 'customer:b2c';

// ❌
interface Buyer {
  id: BuyerId;
}
const role = 'buyer';
```

## `tukio/no-bypass-envelope`

Backend controllers under `apps/<svc>/src/infrastructure/http/**` must return
DTOs directly — the global `ResponseEnvelopeInterceptor` (Story 0.6) wraps them
into the canonical envelope `{ method, code, data | error, pagination?, meta }`.
Calling `response.json()` / `response.send()` / `reply.send()` bypasses it.

```ts
// ✅
@Get(':id')
async getUser(@Param('id') id: string): Promise<UserResponseDto> {
  return this.useCase.execute(id);
}

// ❌
@Get(':id')
async getUser(@Res() response, @Param('id') id: string) {
  response.json({ user: await this.useCase.execute(id) });
}
```

## `tukio/no-pure-black-white`

Pure black/white are forbidden by the design system. Use Tukio tokens (charcoal

- cream palette). See UX spec line 711 and `@tukio/ui/styles/theme.css`.

```tsx
// ✅
<div className="text-charcoal-700 bg-cream-50 border-cream-300" />

// ❌
<div className="text-black bg-white" />
<div style={{ color: '#000', background: '#fff' }} />
const overlay = 'rgba(0, 0, 0, 0.5)';   // also flagged
```

## `tukio/require-correlation-id` (warn)

Inline event payloads passed to `OutboxPublisher.publish()` should carry a
`correlationId` for distributed tracing. Use
`correlationContext.getCorrelationId()` (Story 0.7).

```ts
// ✅
await outboxPublisher.publish({
  eventType: 'identity.user.registered.v1',
  payload,
  correlationId: correlationContext.getCorrelationId(),
});

// ⚠️
await outboxPublisher.publish({
  eventType: 'identity.user.registered.v1',
  payload,
});
```

## Running tests

```sh
pnpm --filter=eslint-plugin-tukio test
```

Each rule has ≥ 3 valid + ≥ 3 invalid cases (Vitest + ESLint `Linter` flat
config harness).
