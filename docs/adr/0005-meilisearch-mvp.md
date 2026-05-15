# ADR-0005: Meilisearch for full-text search (MVP, self-hosted)

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `data`, `backend`

## Context

Tukio's core value proposition is a marketplace search experience — customers find tents, marquees,
and event furniture by location, date, guest count, price range, and category. This requires:

1. **Faceted search**: filtering by multiple attributes simultaneously (location + date + price range).
2. **Typo tolerance**: "tenté" → "tente", "marché" → "marque" — important for French mobile users.
3. **Sub-150ms p95 response time** (NFR1) — essential for SEO Core Web Vitals.
4. **Bilingual indexing** (FR + EN — ADR-0012): separate indexes per locale to handle stemming
   differences between French and English correctly.
5. **SEO relevance**: search results must reflect listing popularity, recency, and price competitiveness.

Forces in tension:

- **Managed vs self-hosted**: managed Meilisearch Cloud starts at €30/month — within budget but adds
  a dependency. Self-hosted on the `tukio-data` droplet adds no cost.
- **Postgres FTS vs dedicated search**: Postgres `tsvector` + `GIN` index can do basic FTS but lacks
  typo tolerance, faceted filtering, and the sub-150ms p95 requirement under concurrent load.
- **Complexity**: sync between Postgres (source of truth) and Meilisearch (search index) requires an
  event-driven pipeline — adds engineering effort (Story 3.7).

## Decision

Use **Meilisearch v1.13** (self-hosted on `tukio-data` droplet, ADR-0015) as the search engine for
all public listing searches. Meilisearch is the sole search query target — Postgres holds the source
of truth but is never queried for search.

Key configuration:

- **One index per locale**: `listings-fr` + `listings-en`. Each index is created with identical
  settings (sortable attributes, filterable attributes, ranking rules) but locale-specific
  `dictionary` and `synonyms` (Story 3.7).
- **Sync via NATS consumer**: `catalog-svc` subscribes to its own `catalog.listing.published.v1`
  and `catalog.listing.updated.v1` events and upserts the Meilisearch document. Failures land in
  the DLQ for retry (ADR-0002).
- **Ranking rules**: built-in Meilisearch defaults (words, typo, proximity, attribute, sort, exactness)
  + custom `_geo` sort by proximity to search location. Story 3.7 extends with `popularity_score`.
- **Filterable attributes**: `category`, `sub_category`, `region`, `price_per_day`, `availability`,
  `capacity`, `certification`.
- **Sortable attributes**: `price_per_day`, `popularity_score`, `created_at`.

## Consequences

### Positive

- **Sub-150ms p95 search** easily achievable: Meilisearch is designed for exactly this throughput
  level with faceted filtering.
- **Zero additional monthly cost**: self-hosted on the existing `tukio-data` droplet (€12/month
  already budgeted in ADR-0015).
- **Typo tolerance out of the box**: French typos handled without custom stemmer configuration.
- **Bilingual support**: separate indexes per locale with locale-specific synonym dictionaries.
- **Simple API**: Meilisearch REST API is well-documented and has a Node.js SDK — low friction to
  integrate in `catalog-svc`.
- **Docker image available**: `getmeili/meilisearch:v1.13` — same version in dev and prod to prevent
  API drift.

### Negative / Trade-offs

- **Sync lag**: Meilisearch is eventually consistent with Postgres. A newly published listing appears
  in search after the NATS event is consumed and the document is upserted — typically < 1s under
  normal load, but potentially minutes during outbox catch-up.
- **Self-hosted ops overhead**: Meilisearch master key rotation, volume backup (included in Postgres
  backup cron Story 0.12), and version upgrades are manual.
- **RAM pressure on `tukio-data`**: Meilisearch uses ~150-300 MB RAM under load, competing with
  Postgres (~300 MB) and Keycloak (~600 MB) on the 2 GB droplet. Monitor OOM risk (V1+ → separate
  droplet or Meilisearch Cloud if RAM becomes the bottleneck).
- **No ML-powered semantic search** (V1+): Meilisearch's semantic search requires a vector embedding
  pipeline. Deferred until catalog grows to > 500 listings.

### Neutral

- Meilisearch health check available at `http://<data-priv-ip>:7700/health` — included in
  UptimeRobot monitoring (Story 0.12 — optional, not current configured).

## Alternatives Considered

### Postgres full-text search (tsvector + GIN)

Built into the existing Postgres instance. **Rejected**: lacks typo tolerance, faceted filtering
performance degrades under multi-filter queries, and sub-150ms p95 is not achievable under concurrent
load without significant Postgres tuning (connection pooling, read replicas). Would require custom
stemming for French. Total engineering effort higher than Meilisearch integration.

### Algolia

Best-in-class managed search. **Rejected**: pricing starts at $10/month (1M search requests) and
escalates sharply — $0.10 per 1k additional requests. For an event marketplace with seasonal spikes,
costs are unpredictable. Also introduces a hard external dependency for the core search path.

### Elasticsearch / OpenSearch

Industry standard for complex search. **Rejected**: requires a dedicated cluster (minimum 3 nodes
for HA, ~€30-60/month additional), complex query DSL, and Java-level memory tuning. Operational
overhead is prohibitive for a solo team. Overkill for < 10k listings at MVP.

### Typesense

Similar to Meilisearch, open-source. **Considered**: excellent performance and simpler cluster setup.
**Chose Meilisearch** because of better French language support (custom tokenizer for diacritics),
more active community, and the founder's existing familiarity with the Meilisearch API.

## References

- [Source: PRD §NFR1 — search p95 < 150ms]
- [Source: Architecture §Search layer — line 125]
- [Source: Story 3.7 — Meilisearch index creation + NATS sync consumer]
- [Source: Story 0.12 / ADR-0015 — self-hosted on `tukio-data` droplet]
- [ADR-0012 — i18n split: one Meilisearch index per locale]

## Implementation Notes

- `catalog-svc` uses the `meilisearch` npm package (official SDK) for document upsert.
- Master key stored in `/home/tukio/tukio/secrets/meili_key` on the droplet and exported as
  `MEILI_MASTER_KEY` env var before `docker compose up` (Story 0.12 provision-secrets.sh).
- Index initialization in `catalog-svc` `onModuleInit()`: create index if not exists, configure
  filterable/sortable attributes, set ranking rules.
- Dev stack: same `getmeili/meilisearch:v1.13` in `docker-compose.dev.yml` to prevent drift.
