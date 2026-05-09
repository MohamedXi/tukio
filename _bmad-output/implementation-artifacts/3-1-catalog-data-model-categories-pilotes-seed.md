# Story 3.1: Catalog data model + 2 catégories pilotes seed

Status: ready-for-dev

## Story

**As a** product owner Tukio (gardien de la taxonomie marketplace + démarrage Epic 3 Catalog Publication & Discovery),
**I want** **scaffolder le catalog-svc Pretre baseline** + livrer le **modèle de données catalogue** (taxonomie hiérarchique : Category → Subcategory → ServiceType) avec :
- (a) **scaffolding `catalog-svc`** via `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc` (Story 0.6 livré) — réplique structure Pretre canonique (`domain/usecases/infrastructure/usecases-proxy/` + `eslint-plugin-boundaries` + Symbol DI tokens + envelope ADR-014 + Outbox transactional Story 0.7) dans `apps/catalog-svc/src/` ; service exposé port `4002` (cohérent infra Story 0.10 docker-compose) ; migration baseline `1715300000000-CreateCatalogSvcBaseline.ts` crée tables `outbox`, `inbox` (Story 0.7 templates) — **Story 3.1 scaffolde uniquement**, Story 3.2 ajoute les aggregates Listing/ServiceArea/Photo/Pricing ;
- (b) **migration DB taxonomie** Story 3.1 `1715300100000-CreateCategoryTaxonomy.ts` créant 4 tables relationnelles avec PII-free design + i18n native :
```sql
CREATE TABLE category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE, -- EN strict (NFR58 override K-05 + memory feedback_tech_layer_english)
  parent_id UUID NULL REFERENCES category(id) ON DELETE RESTRICT, -- root if NULL
  sort_order INT NOT NULL DEFAULT 0,
  mvp_pilot BOOLEAN NOT NULL DEFAULT false, -- true for tents-marquees + event-furniture
  median_price_amount BIGINT NULL, -- in cents EUR (Story 3.5 cron will populate FR31)
  median_price_currency VARCHAR(3) NULL DEFAULT 'EUR' CHECK (median_price_currency IN ('EUR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_category_parent_id ON category (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_category_mvp_pilot ON category (mvp_pilot) WHERE deleted_at IS NULL AND mvp_pilot = true;

CREATE TABLE category_translations (
  category_id UUID NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('fr', 'en')),
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  meta_title VARCHAR(160) NULL, -- SEO Story 7.x
  meta_description VARCHAR(320) NULL, -- SEO Story 7.x
  PRIMARY KEY (category_id, locale)
);

CREATE TABLE service_type (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  slug VARCHAR(100) NOT NULL UNIQUE, -- EN strict
  default_pricing_mode VARCHAR(20) NOT NULL CHECK (default_pricing_mode IN ('unit', 'package')), -- FR25 MVP
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_service_type_category_id ON service_type (category_id) WHERE deleted_at IS NULL;

CREATE TABLE service_type_translations (
  service_type_id UUID NOT NULL REFERENCES service_type(id) ON DELETE CASCADE,
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('fr', 'en')),
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  default_unit VARCHAR(60) NULL, -- e.g., "par jour" / "per day" — used as default for `pricing.unit` step UI Story 3.3
  PRIMARY KEY (service_type_id, locale)
);
```
- (c) **seed script `infra/scripts/seed-categories.ts`** (NEW Story 3.1 — pattern Story 1.3 INSEE seed réutilisé) idempotent (peut être ré-exécuté safely — `INSERT ... ON CONFLICT (slug) DO NOTHING` + `INSERT ... ON CONFLICT (category_id, locale) DO UPDATE SET ...`) qui peuple les 2 catégories pilotes MVP Pays de la Loire avec sous-catégories et translations FR + EN strict. **EN slug** = source of truth (URLs publiques `/fr/category/tents-marquees` cohérentes avec memory `feedback_tech_layer_english`) ; **FR/EN translations** = labels affichés UI (Story 3.3 wizard, Story 3.8 search results, Story 3.10 listing detail) :

**ROOT 1 : `tents-marquees`** (`mvp_pilot=true`, sort_order=10) :
| Slug EN | Translations FR | Translations EN | default_pricing_mode |
|---------|-----------------|-----------------|---------------------|
| `tents-marquees` (root) | name="Chapiteaux & barnums", description="Solutions abritées pour vos événements en extérieur" | name="Tents & marquees", description="Sheltered solutions for your outdoor events" | — (root, no pricing) |
| `marquees` (sub) | "Chapiteaux", "Grandes structures traditionnelles, capacité 100-1000+ pers." | "Marquees", "Large traditional structures, capacity 100-1000+ guests" | `unit` (per day) |
| `pop-up-tents` (sub) | "Barnums", "Structures pliables rapides, capacité 20-150 pers." | "Pop-up tents", "Quick foldable structures, capacity 20-150 guests" | `unit` (per day) |
| `stretch-tents` (sub) | "Tentes stretch", "Toiles tendues design pour cocktails, capacité 50-300 pers." | "Stretch tents", "Designer fabric tents for cocktails, capacity 50-300 guests" | `unit` (per day) |
| `pagoda-tents` (sub) | "Pagodes", "Petites structures carrées 3×3m à 6×6m, modulaires" | "Pagoda tents", "Small modular square structures 3×3m to 6×6m" | `unit` (per day) |

**ROOT 2 : `event-furniture`** (`mvp_pilot=true`, sort_order=20) :
| Slug EN | Translations FR | Translations EN | default_pricing_mode |
|---------|-----------------|-----------------|---------------------|
| `event-furniture` (root) | "Mobilier événementiel", "Tables, chaises, mobilier bar et lounge pour vos réceptions" | "Event furniture", "Tables, chairs, bar and lounge furniture for receptions" | — |
| `tables` (sub) | "Tables", "Tables banquet, mange-debout, hautes, basses" | "Tables", "Banquet, cocktail, high and low tables" | `unit` (per day) |
| `chairs` (sub) | "Chaises", "Chaises pliantes, banquet, design, bar" | "Chairs", "Folding, banquet, designer, bar chairs" | `unit` (per day) |
| `bar-furniture` (sub) | "Mobilier bar", "Bars mobiles, comptoirs, tabourets, mange-debout" | "Bar furniture", "Mobile bars, counters, stools, cocktail tables" | `unit` (per day) |
| `lounge-furniture` (sub) | "Mobilier lounge", "Canapés, fauteuils, poufs, tables basses" | "Lounge furniture", "Sofas, armchairs, poufs, coffee tables" | `package` (per setup) |

ServiceTypes (8 total) sont implicitement les sous-catégories (1:1 mapping MVP — V1+ pourra introduire ServiceType comme dimension orthogonale, ex: `marquees` × `installation-included` vs `marquees` × `self-pickup`) ;
- (d) **DTOs `@tukio/contracts/dtos/catalog/category.dto.ts`** (NEW Story 3.1) avec Zod schemas réutilisables + types TS dérivés :
```ts
export const CategoryDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/), // EN strict
  parentId: z.string().uuid().nullable(),
  name: z.string(), // localized per Accept-Language
  description: z.string().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  listingsCount: z.number().int().nonnegative(), // Story 3.5 cron populates V1, MVP returns 0
  medianPriceAmount: z.number().int().positive().nullable(), // cents EUR
  medianPriceCurrency: z.literal('EUR').nullable(),
  isMvpPilot: z.boolean(),
  subcategories: z.array(z.lazy(() => CategoryDtoSchema)).optional(), // tree shape if ?tree=true query param
  serviceTypes: z.array(z.lazy(() => ServiceTypeDtoSchema)).optional(),
});

export const ServiceTypeDtoSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string(),
  description: z.string().nullable(),
  defaultPricingMode: z.enum(['unit', 'package']),
  defaultUnit: z.string().nullable(),
});
```
- (e) **endpoints lecture catégories** Story 3.1 livre 2 endpoints internes + 2 endpoints publics gateway-api (UI consommera Story 3.3 wizard + Story 3.8 search) :
  - `GET /v1/categories` (public, no auth) — retourne enveloppe paginée `{ data: CategoryDto[], pagination, meta }` — query params `?locale=fr|en` (default Accept-Language), `?tree=true|false` (default false — flat list ; true → nested with subcategories), `?mvpPilotOnly=true|false` (default true MVP — exclut futures categories). Cache HTTP `Cache-Control: public, max-age=3600` (catégories changent rarement). Throttle 120/min/IP (lecture publique).
  - `GET /v1/categories/:slug` (public) — retourne enveloppe single avec subcategories nested + serviceTypes
  - `GET /internal/categories` (catalog-svc internal — consumed Story 3.7 Meilisearch indexer + Story 3.5 median price cron — pas de redaction)
  - **i18n response** : middleware lit `Accept-Language` header (`fr-FR` → `fr`, `en-US` → `en`), default `fr` (Tukio MVP target FR), use case `GetCategoriesUseCase` JOIN `category_translations` WHERE locale=$locale → fallback FR si translation EN absente (NFR60 — Meilisearch fallback strategy mirror)
- (f) **Use cases catalog-svc** Story 3.1 minimal (Story 3.2 étendra avec Listing aggregate use cases) :
  - `list-categories.usecase.ts` (with tree option + mvpPilotOnly filter)
  - `get-category-by-slug.usecase.ts`
- (g) **Tests integration** Postgres testcontainer : seed idempotent (re-run = no duplicates), JOIN translations FR vs EN, parent_id cascade restrict (cannot DELETE parent with subcategories), unique slug global enforced, mvp_pilot index used (EXPLAIN ANALYZE) ;
- (h) **forward-dep documentation Story 3.3** : Story 3.3 wizard frontend consumera `GET /v1/categories?tree=true` pour le `<Select>` Catégorie + Sous-catégorie. Story 3.7 Meilisearch indexer consumera `GET /internal/categories` pour synchroniser facettes search ; Story 3.12 page catégorie générale consumera `GET /v1/categories/:slug` ;

**so that** Tukio dispose d'une **taxonomie structurée bilingue** prête pour : (1) Story 3.3 wizard Pro create listing (catégorie → sous-cat → service_type → default pricing mode), (2) Story 3.7 Meilisearch indexer (facettes search par catégorie), (3) Story 3.8 search frontend (filtre catégorie multi-select), (4) Story 3.12 page catégorie générale (URL canonique `/fr/category/tents-marquees` + breadcrumb + median price display FR31 transparency client) ; le **pattern complet "i18n native taxonomy with translations table + EN strict slugs + tree query support + idempotent seed"** devient template Stories 5.x review-svc (review categories), Stories 9.x V1 subscription tiers (taxonomy plans), Stories 13.x V2 configurateur (events templates taxonomy).

> **Outcome attendu** : à la fin de cette story, **catalog-svc est scaffoldé Pretre** (4ᵉ service Pretre after identity-svc Story 0.6, payment-svc Story 2.1, gateway-api Story 1.2 — ouverture Epic 3) ; un dev exécute `pnpm seed:categories` (NEW alias `package.json` root → `tsx infra/scripts/seed-categories.ts`) → 2 root categories + 8 subcategories + 8 service_types + 18 translations (9 × 2 locales) inserted in `tukio_catalog` DB ; un dev re-exécute le seed → no duplicates (idempotent ON CONFLICT) ; un Visitor `curl https://api.tukio.one/v1/categories?tree=true&locale=fr` → 200 enveloppe `{ data: [{ slug: 'tents-marquees', name: 'Chapiteaux & barnums', subcategories: [{ slug: 'marquees', name: 'Chapiteaux', serviceTypes: [{ slug: 'marquees', defaultPricingMode: 'unit', defaultUnit: 'par jour' }] }, ...] }, { slug: 'event-furniture', name: 'Mobilier événementiel', ... }] }` ; même curl avec `?locale=en` → labels EN ("Marquees", "Tents & marquees") ; un dev backend Story 3.7 (future Meilisearch indexer) appelle `GET /internal/categories` → toutes les categories raw (no PII redaction, no locale filter) ; un dev frontend Story 3.3 (future wizard) `useQuery(['categories', 'tree'])` → tree pour `<Select>` Catégorie ; un test `pnpm vitest --filter=catalog-svc` passe avec ≥ 90 % coverage seed + use cases + 80 % infra repo ; un test integration Postgres testcontainer `pnpm test:integration --filter=catalog-svc` passe (seed idempotent + JOIN locale fallback + cascade restrict).

## Acceptance Criteria

1. **AC1 — `catalog-svc` Pretre scaffolding (4ᵉ service Pretre)** : Given Story 0.6 a livré `replicate-pretre-structure.sh`, When je lance `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc`, Then la structure Pretre canonique est répliquée dans `apps/catalog-svc/src/` (cohérent Architecture lignes 2120-2164 — `domain/usecases/infrastructure/usecases-proxy/` + `eslint-plugin-boundaries` enforce + Symbol DI tokens + envelope ADR-014 + Outbox transactional Story 0.7 wired). Service exposé port `4002` (cohérent infra Story 0.10 docker-compose). Migration baseline `1715300000000-CreateCatalogSvcBaseline.ts` crée :
   - Table `outbox` (Story 0.7 template — pattern PG LISTEN/NOTIFY relay)
   - Table `inbox` (Story 0.7 idempotence pattern)
   - **PAS de Listing/Photo/etc. tables** Story 3.1 — Story 3.2 ajoutera après ses aggregates
   - **Tests health/ready** : `pnpm --filter=catalog-svc test` passe (lint boundaries 0 violations, baseline)

2. **AC2 — DB migration `category` + `category_translations` + `service_type` + `service_type_translations`** : Given AC1, When je consulte `apps/catalog-svc/src/infrastructure/persistence/typeorm/migrations/1715300100000-CreateCategoryTaxonomy.ts`, Then les 4 tables sont créées avec :
   - **Indexes contraintes complètes** (cf. story body)
   - **`down()` migration** : `DROP TABLE` ordre inverse FK + DROP INDEX safely
   - **Tests integration testcontainer Postgres** :
     - INSERT root category (parent_id NULL) + INSERT subcategory (parent_id=root.id) → success
     - DELETE parent with subcategories → fail RESTRICT
     - INSERT duplicate slug global → fail UNIQUE
     - INSERT translation locale='es' → fail CHECK constraint
     - Soft-delete category (UPDATE deleted_at) → translations preserved (CASCADE only on hard DELETE)

3. **AC3 — Seed script `infra/scripts/seed-categories.ts` idempotent** : Given AC2, When je consulte `infra/scripts/seed-categories.ts` + `package.json` root alias `pnpm seed:categories`, Then :
   - **Script TypeScript executable** (`tsx infra/scripts/seed-categories.ts`) — pattern Story 1.3 INSEE seed réutilisé (no @nestjs/cli runtime — direct TypeORM DataSource init)
   - **Idempotent UPSERT** :
     ```ts
     // Pseudo-code
     await db.query(`INSERT INTO category (slug, parent_id, sort_order, mvp_pilot) VALUES ($1, NULL, $2, true) ON CONFLICT (slug) DO NOTHING RETURNING id`, ['tents-marquees', 10]);
     // Then for each translation:
     await db.query(`INSERT INTO category_translations (category_id, locale, name, description) VALUES ($1, 'fr', $2, $3) ON CONFLICT (category_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`, [rootId, 'Chapiteaux & barnums', '...']);
     ```
   - **Datasets exacts** : 2 root + 8 sub + 8 service_types + 36 translations (18 entries × 2 locales) — cf. story body table spec
   - **Validation post-seed** : query `SELECT COUNT(*) FROM category WHERE mvp_pilot = true` → 10 (2 roots + 8 subs), `SELECT COUNT(*) FROM service_type` → 8, `SELECT COUNT(*) FROM category_translations` → 20 (10 cats × 2 locales), `SELECT COUNT(*) FROM service_type_translations` → 16 (8 × 2 locales)
   - **Logging structured** (`pino` Story 0.7 logger réutilisé) avec stats `{ rootsInserted, subsInserted, serviceTypesInserted, translationsUpserted }`
   - **Re-run safety** : 2nd execution → same DB state + log `{ rootsInserted: 0 (already existed) }`
   - **Tests integration testcontainer** : 3 cases — happy seed empty DB, re-run idempotent, DB error rollback (e.g., FK violation if parent missing) → exit code 1

4. **AC4 — DTOs `@tukio/contracts/dtos/catalog/category.dto.ts` + Zod schemas** : Given Story 0.2 contracts package, When je consulte, Then :
   - **NEW DTOs** `packages/contracts/src/dtos/catalog/category.dto.ts` :
     - `CategoryDtoSchema` (Zod recursive avec `subcategories` optional + `serviceTypes` optional)
     - `ServiceTypeDtoSchema`
     - `ListCategoriesQuerySchema` (`tree?: boolean default false`, `mvpPilotOnly?: boolean default true`, `locale?: 'fr' | 'en' default Accept-Language`)
   - **Tests Zod** : valid happy + invalid slug regex + invalid locale → expected validation error

5. **AC5 — `catalog-svc` use cases `list-categories.usecase.ts` + `get-category-by-slug.usecase.ts`** : Given Pretre architecture AC1, When je consulte `apps/catalog-svc/src/usecases/`, Then :
   - **NEW domain entities** `apps/catalog-svc/src/domain/model/`:
     - `category.entity.ts` (lightweight entity — pas un aggregate complet, just data holder for taxonomy reads. Story 3.2 introduit Listing comme aggregate root)
     - `service-type.entity.ts`
   - **NEW domain ports** :
     - `domain/ports/category-repository.port.ts` (`ICategoryRepository` interface — `findAll({ tree, mvpPilotOnly, locale }): Promise<Category[]>` + `findBySlug(slug, locale): Promise<Category | null>` + `findById(id): Promise<Category | null>`)
   - **NEW use cases** :
     - `list-categories.usecase.ts` :
       ```ts
       async execute(input: { locale: 'fr' | 'en'; tree: boolean; mvpPilotOnly: boolean }): Promise<CategoryDto[]> {
         const categories = await this.categoryRepo.findAll(input);
         if (!input.tree) return categories.map(c => this.toDto(c, input.locale));
         // Tree shape: nest subcategories under parent
         const roots = categories.filter(c => c.parentId === null);
         const subs = categories.filter(c => c.parentId !== null);
         return roots.map(root => ({
           ...this.toDto(root, input.locale),
           subcategories: subs.filter(s => s.parentId === root.id).map(s => ({ ...this.toDto(s, input.locale), serviceTypes: s.serviceTypes?.map(st => this.toServiceTypeDto(st, input.locale)) ?? [] })),
         }));
       }
       ```
     - `get-category-by-slug.usecase.ts` (returns single + subcategories + serviceTypes)
   - **NEW infrastructure repo** `apps/catalog-svc/src/infrastructure/persistence/typeorm/repositories/category.typeorm.repository.ts` :
     - `findAll` query : `SELECT c.*, ct.name, ct.description, ct.meta_title, ct.meta_description FROM category c LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = $locale WHERE c.deleted_at IS NULL [AND c.mvp_pilot = true if mvpPilotOnly]` + COALESCE fallback to FR if EN translation missing (NFR60 strategy)
     - `findBySlug` query similar + JOIN service_type + service_type_translations
   - Tests unit use cases ≥ 90 % + integration repo ≥ 80 %

6. **AC6 — gateway-api endpoints `GET /v1/categories` + `GET /v1/categories/:slug` + `GET /internal/categories`** : Given AC5, When je consulte `apps/gateway-api/src/infrastructure/http/controllers/categories.controller.ts` (NEW) + `apps/catalog-svc/src/infrastructure/http/controllers/internal-categories.controller.ts` (NEW), Then :
   - **Public endpoints gateway-api** :
     ```ts
     @Controller('/v1/categories')
     export class CategoriesController {
       @Get('/')
       @HttpCode(200)
       @CacheControl('public, max-age=3600') // categories rarely change
       async list(@Query() query: ListCategoriesQuery, @AcceptLanguage() locale: 'fr' | 'en'): Promise<CategoryDto[]> {
         return this.categoriesForwarder.getInstance().list({ ...query, locale: query.locale ?? locale });
       }

       @Get('/:slug')
       @HttpCode(200)
       @CacheControl('public, max-age=3600')
       async getBySlug(@Param('slug') slug: string, @AcceptLanguage() locale: 'fr' | 'en'): Promise<CategoryDto> {
         return this.categoriesForwarder.getInstance().getBySlug({ slug, locale });
       }
     }
     ```
   - **Internal endpoint catalog-svc** `GET /internal/categories` (consumed Story 3.7 Meilisearch indexer + Story 3.5 median cron) — no locale filter (returns all translations) + `X-Internal-Service-Token` guard
   - **Throttle** : 120/min/IP public, 600/min internal
   - **Errors** : 404 si slug not found → `CATALOG-NOT-FOUND-001` ; 422 si locale invalid → `VALIDATION-FAILED-001`
   - **Tests E2E** : 6 scénarios — `?tree=true` nested response, `?tree=false` flat, `?mvpPilotOnly=true` filter (default), `?locale=fr` FR labels, `?locale=en` EN labels, slug not found 404, internal endpoint with X-Internal-Service-Token

7. **AC7 — Tests integration end-to-end + perf + lint boundaries** :
   - **Tests integration testcontainer Postgres** (4 scenarios — cf. AC2 + AC3)
   - **Tests E2E gateway** (6 scenarios — cf. AC6)
   - **Perf** : `GET /v1/categories?tree=true&locale=fr` p90 < 100ms with seeded data + HTTP cache 60min validated via `Cache-Control` header
   - **Lint boundaries** : `pnpm --filter=catalog-svc lint` 0 violations (domain pure no I/O imports — Story 0.6 AC8 enforced)
   - **Coverage** : ≥ 90 % use cases + 80 % repo + 90 % seed script

8. **AC8 — Documentation + commit** :
   - **NEW runbook** `docs/runbook/seed-categories-debug.md` (~30 lignes) — flow + troubleshooting (re-run seed safe, FK violation if parent missing, locale check constraint, slug regex EN strict pattern enforce)
   - **UPDATE `docs/project-context.md`** — section "Catalog Taxonomy (Story 3.1)" : 4 tables + EN slugs + i18n FR/EN translations + 2 MVP pilot categories
   - **NEW seed alias** `package.json` root : `"seed:categories": "tsx infra/scripts/seed-categories.ts"`
   - **Commit** `feat(catalog): Story 3.1 catalog-svc Pretre scaffolding + category taxonomy data model + 2 MVP pilot categories seeded (tents-marquees + event-furniture) + i18n FR/EN translations + EN strict slugs + GET /v1/categories endpoints`

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` DTOs catalog** (AC: #4)
  - [ ] 1.1 — `dtos/catalog/category.dto.ts` (CategoryDtoSchema + ServiceTypeDtoSchema + ListCategoriesQuerySchema)
  - [ ] 1.2 — Tests Zod schemas
- [ ] **Task 2 — `catalog-svc` Pretre scaffolding** (AC: #1)
  - [ ] 2.1 — `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc` (Story 0.6 réutilisé)
  - [ ] 2.2 — Update `docker-compose.yml` Story 0.10 — add catalog-svc service port 4002 + DB tukio_catalog
  - [ ] 2.3 — Migration `1715300000000-CreateCatalogSvcBaseline.ts` (outbox + inbox tables)
  - [ ] 2.4 — Health/ready endpoints + lint boundaries 0 violations
- [ ] **Task 3 — DB migration taxonomy 4 tables** (AC: #2)
  - [ ] 3.1 — Migration `1715300100000-CreateCategoryTaxonomy.ts` (4 tables + indexes + check constraints)
  - [ ] 3.2 — Tests integration testcontainer Postgres 5 cases
- [ ] **Task 4 — Seed script idempotent + dataset 2 catégories pilotes** (AC: #3)
  - [ ] 4.1 — `infra/scripts/seed-categories.ts` (TypeScript executable via tsx, ON CONFLICT idempotent)
  - [ ] 4.2 — Dataset exact (2 roots + 8 subs + 8 service_types + 36 translations) cf. AC body table
  - [ ] 4.3 — Alias `package.json` root `"seed:categories"`
  - [ ] 4.4 — Tests integration testcontainer 3 cases (happy + idempotent re-run + FK error rollback)
- [ ] **Task 5 — Domain entities + ports + use cases catalog-svc** (AC: #5) — coverage ≥ 90 %
  - [ ] 5.1 — `domain/model/category.entity.ts` + `service-type.entity.ts` (lightweight entities)
  - [ ] 5.2 — `domain/ports/category-repository.port.ts`
  - [ ] 5.3 — Use case `list-categories.usecase.ts` (with tree shape + mvpPilotOnly filter)
  - [ ] 5.4 — Use case `get-category-by-slug.usecase.ts` (with subcategories + serviceTypes nested)
  - [ ] 5.5 — Tests unit ≥ 90 %
- [ ] **Task 6 — Infrastructure repo + locale fallback FR if EN missing** (AC: #5)
  - [ ] 6.1 — `category.typeorm.repository.ts` JOIN translations + COALESCE locale fallback
  - [ ] 6.2 — Wire usecases-proxy module + Symbol DI tokens
  - [ ] 6.3 — Tests integration repo ≥ 80 %
- [ ] **Task 7 — gateway-api + catalog-svc endpoints** (AC: #6)
  - [ ] 7.1 — `apps/catalog-svc/src/infrastructure/http/controllers/internal-categories.controller.ts` (`GET /internal/categories`)
  - [ ] 7.2 — `apps/gateway-api/src/usecases/catalog/categories.forwarder.ts` (NEW)
  - [ ] 7.3 — `apps/gateway-api/src/infrastructure/http/controllers/categories.controller.ts` (`GET /v1/categories` + `/:slug`)
  - [ ] 7.4 — `apps/gateway-api/src/infrastructure/external/catalog-svc/catalog-svc.client.ts` (NEW — listCategories + getBySlug)
  - [ ] 7.5 — `Cache-Control: public, max-age=3600` header on public endpoints
  - [ ] 7.6 — Throttle 120/min public + 600/min internal
  - [ ] 7.7 — `@AcceptLanguage()` decorator NEW (parse `Accept-Language` header → `'fr' | 'en'` default 'fr') — pattern réutilisable Stories 3.x catalog
  - [ ] 7.8 — Tests E2E 6 scénarios
- [ ] **Task 8 — Tests integration + perf + lint** (AC: #7)
  - [ ] 8.1 — Tests integration testcontainer Postgres seed end-to-end
  - [ ] 8.2 — Perf assert `GET /v1/categories` p90 < 100ms
  - [ ] 8.3 — Lint boundaries CI assert 0 violations
- [ ] **Task 9 — Documentation + commit** (AC: #8)
  - [ ] 9.1 — Runbook `docs/runbook/seed-categories-debug.md`
  - [ ] 9.2 — Update `docs/project-context.md`
  - [ ] 9.3 — Commit `feat(catalog): Story 3.1 catalog-svc Pretre scaffolding + category taxonomy + 2 MVP pilot seeded`

## Dev Notes

### Pourquoi Story 3.1 ouvre Epic 3 Catalog

Story 3.1 livre la **fondation Catalog Discovery** : taxonomie i18n native + scaffolding catalog-svc Pretre + DTOs partagés. Sans cette fondation, Story 3.2 (catalog-svc Listing aggregate), Story 3.3 (wizard create listing), Story 3.7 (Meilisearch indexer), Story 3.8 (search frontend), Story 3.12 (page catégorie) sont bloquées. Pattern complet **i18n native taxonomy with translations table + EN strict slugs + tree query support + idempotent seed** réutilisé Stories 5.x review-svc, 9.x V1 subscription tiers, 13.x V2 configurateur events templates.

### Décisions techniques majeures actées

1. **Scaffolding catalog-svc Pretre dans Story 3.1** (vs Story 3.2) — Story 3.2 implique catalog-svc existant. Story 3.1 ouvre Epic 3 et scaffolde via Story 0.6 replication script. Migrations + seed live in `apps/catalog-svc/`.
2. **EN strict slugs** (NFR58 override K-05 + memory `feedback_tech_layer_english`) — URLs publiques `/fr/category/tents-marquees` (vs `/fr/categorie/chapiteaux`). Slug = source of truth + langue stable cross-locales. UI affiche labels traduits FR/EN via `category_translations`.
3. **Tables séparées `category` + `category_translations`** (vs JSON column avec `{ fr: {...}, en: {...} }`) — patterns SQL natifs, queryable via JOIN, indexable per locale, scalable V1+ (autres langues sans migration data).
4. **Locale fallback FR si EN missing** (NFR60 cohérent Meilisearch strategy Story 3.7) — `COALESCE(en.name, fr.name)` SQL pattern. UX EN visitor qui n'a pas de translation EN voit le label FR avec badge V1 (Story 5.9).
5. **Soft-delete `deleted_at`** (vs hard DELETE) — preserve historique listings (Story 3.5 listings linked to soft-deleted categories restent valides + admin V1 can review).
6. **`mvp_pilot` boolean flag** (vs separate table) — simple flag, evolves V1+ when adding new categories. MVP queries default `mvpPilotOnly=true`.
7. **Idempotent seed via `ON CONFLICT`** — re-runnable safely (dev local, staging refresh, prod hotfix). Pattern Story 1.3 INSEE seed réutilisé.
8. **DTOs Zod recursive subcategories optional** — flat list par défaut (efficient for search facets), tree on-demand via `?tree=true` (efficient for wizard `<Select>` cascading).
9. **Public endpoints `GET /v1/categories` no auth + cache HTTP 1h** — taxonomy publique (SEO Story 7.x sitemap). Caché côté CDN + browser (Cache-Control public).
10. **`@AcceptLanguage()` decorator NEW** réutilisable Epic 3 entire — parse Accept-Language header → `'fr' | 'en'` default. Story 3.1 livre, Story 3.x.x consument.
11. **Service types 1:1 avec subcategories MVP** (vs separate dimension) — simpler taxonomy. V1+ pourra introduire ServiceType comme orthogonal (e.g., `marquees` × `installation-included` vs `self-pickup` Story 3.x V1).
12. **EN strict + i18n FR/EN + Pretre + envelope ADR-014 + latest stable versions** memories.

### Versions à utiliser

(Pas de nouvelle dépendance — réutilise Stories 0.x : NestJS 11, TypeORM, pino, Zod, axios, tsx via `@tukio/testing` Story 0.9)

### Project Structure cible

```
packages/contracts/src/dtos/catalog/
└─ category.dto.ts                                              # NEW Story 3.1 (CategoryDto + ServiceTypeDto + ListCategoriesQuery + Zod)

apps/catalog-svc/                                                # NEW Story 3.1 (scaffolded via replicate-pretre-structure.sh)
├─ src/
│  ├─ domain/
│  │  ├─ model/
│  │  │  ├─ category.entity.ts                                  # NEW
│  │  │  └─ service-type.entity.ts                              # NEW
│  │  └─ ports/
│  │     └─ category-repository.port.ts                         # NEW
│  ├─ usecases/
│  │  ├─ list-categories.usecase.ts + spec                      # NEW
│  │  └─ get-category-by-slug.usecase.ts + spec                 # NEW
│  ├─ usecases-proxy/usecases-proxy.module.ts                   # NEW (Pretre baseline)
│  ├─ infrastructure/
│  │  ├─ http/controllers/
│  │  │  └─ internal-categories.controller.ts                   # NEW (GET /internal/categories)
│  │  └─ persistence/typeorm/
│  │     ├─ entities/
│  │     │  ├─ category.entity.ts                               # NEW (TypeORM ORM entity, distinct from domain entity)
│  │     │  ├─ category-translation.entity.ts                   # NEW
│  │     │  ├─ service-type.entity.ts                           # NEW
│  │     │  └─ service-type-translation.entity.ts               # NEW
│  │     ├─ repositories/category.typeorm.repository.ts         # NEW
│  │     └─ migrations/
│  │        ├─ 1715300000000-CreateCatalogSvcBaseline.ts        # NEW (outbox + inbox)
│  │        └─ 1715300100000-CreateCategoryTaxonomy.ts          # NEW (4 tables + indexes)
│  ├─ main.ts                                                   # NEW (Pretre baseline)
│  └─ app.module.ts                                             # NEW
├─ test/
│  ├─ integration/
│  │  ├─ categories-repo.spec.ts                                # NEW (testcontainer Postgres)
│  │  └─ categories-endpoints.spec.ts                           # NEW (testcontainer + supertest)
│  └─ jest.config.ts
├─ tsconfig.json + package.json + .eslintrc.js + Dockerfile     # NEW (Pretre template)

apps/gateway-api/src/
├─ usecases/catalog/
│  └─ categories.forwarder.ts                                   # NEW
├─ infrastructure/http/controllers/
│  └─ categories.controller.ts                                  # NEW (GET /v1/categories + /:slug + Cache-Control)
├─ infrastructure/external/
│  └─ catalog-svc/catalog-svc.client.ts                         # NEW
└─ shared/decorators/accept-language.decorator.ts               # NEW (réutilisable Epic 3)

apps/gateway-api/test/e2e/
└─ categories.e2e-spec.ts                                       # NEW (6 tests)

infra/scripts/seed-categories.ts                                # NEW (idempotent ON CONFLICT)
infra/docker-compose.yml                                        # UPDATE Story 0.10 — add catalog-svc:4002 + DB tukio_catalog

package.json (root)                                              # UPDATE — add seed:categories alias

docs/runbook/seed-categories-debug.md                           # NEW
docs/project-context.md                                         # UPDATE — section Catalog Taxonomy

# Estimation : ~30 nouveaux + ~3 updates = ~33 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (`@tukio/contracts` DTOs), 0.6 (Pretre scaffolding template + replicate script + boundaries lint), 0.7 (outbox + inbox patterns), 0.10 (Doppler + docker-compose), 1.2 (gateway-api scaffolding), 1.3 (TypeORM repository pattern + soft-delete), 2.1 (forwarder pattern gateway → service internal endpoint) + memories.

1. **Pretre architecture stricte** — domain entity pure (no I/O), use cases orchestrate ports, infra in `infrastructure/`. Eslint-plugin-boundaries enforce — `pnpm --filter=catalog-svc lint` 0 violations.
2. **API responses envelope ADR-014** — `GET /v1/categories` retourne `{ method, code, data: [...], pagination?, meta }`.
3. **EN strict couche tech** (memory `feedback_tech_layer_english`) — slugs `tents-marquees`, `marquees`, `event-furniture`, `tables` strict EN. Migration columns + table names strict EN.
4. **i18n FR/EN dès Sprint 0** (memory `feedback_i18n_frontend`) — `category_translations` table + Accept-Language header + locale fallback FR.
5. **Latest stable versions** memory.
6. **NFR58 URLs EN + hreflang systematic** — Story 3.1 livre slugs EN ; Story 7.2 wire hreflang sur les pages catégorie.
7. **NFR60 Meilisearch fallback locale** — `category_translations` strategy mirror : Story 3.7 indexer réutilise même pattern.
8. **Soft-delete pattern** Story 1.3 réutilisé — `deleted_at TIMESTAMPTZ NULL` + indexes `WHERE deleted_at IS NULL`.

### Previous Story Intelligence

**Story 0.2 (`@tukio/contracts` initialization)** : a livré envelope types + Zod base schemas. Story 3.1 ajoute `dtos/catalog/category.dto.ts` (NEW namespace catalog).

**Story 0.6 (Pretre scaffolding template)** : a livré `replicate-pretre-structure.sh --target=<service>` script. Story 3.1 invoque pour scaffolder catalog-svc (4ᵉ service Pretre after identity-svc, gateway-api, payment-svc).

**Story 0.7 (Outbox/inbox)** : tables baseline réutilisées dans migration `CreateCatalogSvcBaseline.ts`. Story 3.1 NE publie PAS encore d'event NATS (Story 3.5 listing publish event).

**Story 0.10 (docker-compose dev local)** : Story 3.1 UPDATE `docker-compose.yml` pour ajouter `catalog-svc` service port 4002 + DB `tukio_catalog`.

**Story 1.2 (gateway-api scaffolding)** : pattern forwarder gateway → service internal endpoint réutilisé Story 3.1 (`categories.forwarder.ts`).

**Story 1.3 (Pro registration + INSEE seed)** : pattern seed script TypeScript + `ON CONFLICT DO NOTHING/UPDATE` réutilisé Story 3.1 `seed-categories.ts`.

**Story 2.1 (Stripe Connect — payment-svc Pretre scaffolding)** : pattern même que Story 3.1 (replicate-pretre-structure → service NEW + outbox + migrations baseline). Story 3.1 réutilise check-list.

### What this story does NOT do

- ❌ **Listing aggregate + ServiceArea + Photo + Pricing value-objects** → Story 3.2 (catalog-svc Pretre full domain)
- ❌ **Pro create listing wizard frontend** → Story 3.3
- ❌ **Photo upload + Cloudflare Images** → Story 3.4 (utilise media-svc + R2)
- ❌ **Listing publish workflow + auto-publish + median price** → Story 3.5
- ❌ **Meilisearch index + sync outbox** → Story 3.7
- ❌ **Search frontend barre recherche** → Story 3.8
- ❌ **Filters facettes search results** → Story 3.9
- ❌ **Listing detail public page** → Story 3.10
- ❌ **Pro public profile page** → Story 3.11
- ❌ **Page catégorie générale + median price display** → Story 3.12 (consume `GET /v1/categories/:slug` Story 3.1)
- ❌ **Admin UI `/admin/categories` edit translations** → V1+ (Story 6.x — data model ready Story 3.1)
- ❌ **3+ catégories MVP supplémentaires** (e.g., Sound, Lighting, Catering) — V1+ (data model supports, just add seed entries)
- ❌ **DeepL auto-translate** FR → EN translations missing → V1+ (FR101)

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 90 % use cases — NFR71 strict
- Coverage ≥ 90 % seed script (idempotency critical)
- Coverage ≥ 80 % infra repo
- Tests integration testcontainer Postgres : 4 scenarios DB constraints + 3 scenarios seed
- Tests E2E gateway 6 scenarios (cf. AC6)
- Perf : `GET /v1/categories?tree=true` p90 < 100ms with seeded data
- Lint boundaries `pnpm --filter=catalog-svc lint` 0 violations
- HTTP cache validated via `Cache-Control: public, max-age=3600` header assert

### Project Structure Notes

✅ **Aligné architecture, PRD §FR23 (catalog data model — taxonomy structurée), §FR99 (FR obligatoire bilingue), §FR103 (i18n cross-cutting), §NFR58 (URLs EN, hreflang), §NFR60 (Meilisearch per locale), §NFR71 (coverage), Stories 0.2/0.6/0.7/0.10/1.2/1.3/2.1, memories.**

⚠️ **Décision** : EN strict slugs + table translations séparée (vs JSON column) — i18n native scalable.

⚠️ **Décision** : Scaffolding catalog-svc dans Story 3.1 (vs 3.2) — Story 3.2 dépend du service existant.

⚠️ **Décision** : Locale fallback FR si EN missing — UX cohérent EN visitor sees FR with badge V1.

⚠️ **Décision** : Idempotent seed via `ON CONFLICT` — re-runnable safely.

⚠️ **Décision** : 2 catégories MVP pilotes uniquement (Sound, Lighting, Catering = V1+) — focus marketplace launch sur tents/marquees + event furniture (cible Pays de la Loire).

⚠️ **Décision** : `@AcceptLanguage()` decorator NEW Story 3.1 — réutilisable Epic 3 entire (Stories 3.x.x consument).

⚠️ **Décision** : Cache HTTP `Cache-Control: public, max-age=3600` sur public endpoints — taxonomy rare changes, browser/CDN cache.

⚠️ **Décision** : ServiceType 1:1 avec subcategories MVP — V1+ pourra ajouter dimension orthogonale (installation-included, self-pickup, etc.).

### References

- [Source: epics.md#Epic-3-Story-3.1 — Lines 1393-1405]
- [Source: epics.md#Epic-3-Overview — Lines 1383-1391 (FRs/NFRs/UX-DRs/Intégrations)]
- [Source: epics.md#Stories-3.2/3.3/3.5/3.7/3.8/3.12 — forward-deps consumers]
- [Source: prd.md#FR23 (catalog data model), #FR99 (bilingue FR obligatoire), #FR103 (i18n cross-cutting), #NFR58 (URLs EN), #NFR60 (Meilisearch per locale), #NFR71 (coverage)]
- [Source: architecture.md — ADR-007 outbox, ADR-014 envelope, Pretre boundaries lines 2120-2164, EN strict naming line 158, soft-delete line 264]
- [Source: Stories 0.2 (contracts), 0.6 (Pretre scaffold), 0.7 (outbox), 0.10 (docker-compose), 1.2 (gateway-api), 1.3 (seed pattern + soft-delete), 2.1 (replicate-pretre-structure pattern)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent : modèle + version)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 3.2 (catalog-svc Pretre full domain Listing aggregate — utilise category_id FK + service_type_id FK + Story 3.1 entities), Story 3.3 (wizard `<Select>` Catégorie/Sous-catégorie consume `GET /v1/categories?tree=true` Story 3.1), Story 3.5 (median price calculator cron consumes `GET /internal/categories`), Story 3.7 (Meilisearch indexer consume `GET /internal/categories` for facets), Story 3.8 (search frontend filter catégorie multi-select), Story 3.12 (page catégorie générale consume `GET /v1/categories/:slug`))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP) — **first story Epic 3**
- **Sprint cible** : Sprint 4 (1ʳᵉ story Epic 3 après Epic 2 closed)
- **Estimation effort** : 2-3 jours (1 dev fullstack — story foundation : scaffolding + DB migration + seed + DTOs + 2 endpoints + tests, ~33 fichiers)
- **Dépendances upstream** : Stories 0.2 (contracts), 0.6 (Pretre scaffold + replicate script), 0.7 (outbox + inbox), 0.10 (docker-compose + Doppler), 1.2 (gateway-api scaffolding), 1.3 (seed pattern + soft-delete + TypeORM repository), 2.1 (replicate-pretre-structure pattern Reference)
- **Dépendances downstream** :
  - Story 3.2 (catalog-svc Listing aggregate full Pretre — utilise category + service_type FKs Story 3.1)
  - Story 3.3 (wizard create listing — consume `GET /v1/categories?tree=true` pour `<Select>` Catégorie/Sous-catégorie)
  - Story 3.5 (median price calculator cron — consume `GET /internal/categories` pour iterate categories)
  - Story 3.7 (Meilisearch indexer — consume `GET /internal/categories` pour facets per locale)
  - Story 3.8 (search frontend — filter catégorie multi-select consume `GET /v1/categories`)
  - Story 3.12 (page catégorie générale — consume `GET /v1/categories/:slug` + median price display FR31)
  - Stories Epic 5 (review-svc) — pattern taxonomy translations réutilisé V1
- **FRs covered** :
  - **FR23 partial** ✅ catalog data model + structured taxonomy ready (full FR23 = Story 3.3 wizard pour Pro create listing)
  - **FR99** ✅ FR obligatoire enforced via DB column NOT NULL + Story 3.2 domain VO `TitleMultilang` invariant
  - **FR103** ✅ i18n cross-cutting taxonomy translations FR + EN
- **NFRs touchés** :
  - **NFR58** ✅ URLs EN strict slugs (`tents-marquees`, `marquees`, etc.)
  - **NFR60** ✅ locale fallback FR if EN missing (Meilisearch strategy mirror)
  - **NFR71** ✅ coverage ≥ 90 % use cases + seed + 80 % repo
  - **NFR48** ✅ HTTP cache 1h `Cache-Control: public` sur public endpoints (categories rare changes)

> **Prochaine story → Story 3.2** (catalog-svc Pretre full domain Listing aggregate + Pricing/ServiceArea/Photo value-objects — utilise category + service_type FKs Story 3.1)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.2, 0.6, 0.7, 0.10, 1.2, 1.3, 2.1 implémentées
3. Implémenter Tasks 1-9 dans l'ordre (DTOs Task 1 → scaffolding Task 2 → migration Task 3 → seed Task 4 → use cases Task 5 → repo Task 6 → endpoints Task 7 → tests Task 8 → docs Task 9)
4. Lancer `pnpm vitest --filter=catalog-svc` + `pnpm test:integration --filter=catalog-svc` après chaque jalon
5. Commit Story 3.1 quand : 4/4 testcontainer DB tests + 3/3 seed tests + 6/6 E2E gateway + coverage NFR71 + perf < 100ms p90 + lint boundaries 0 violations + HTTP cache header validated + idempotent seed re-run testé + locale fallback FR validated
6. Update sprint-status : `3-1-...: review` puis `done`
