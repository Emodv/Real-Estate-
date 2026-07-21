# Database

Production storage is **Supabase Postgres**. The schema lives in
`supabase/migrations/` and is the source of truth for the production data
model. Phase 1 also ships a local JSON-file store so the app runs with zero
cloud setup.

## Migrations

| File | Contents |
|------|----------|
| `0001_initial_schema.sql` | All tables, UUID PKs, FKs, indexes, `updated_at` triggers. |
| `0002_rls_policies.sql` | Row Level Security on every table + `handle_new_user` trigger. |

### Applying migrations

Using the Supabase CLI (recommended):

```bash
supabase link --project-ref <your-project-ref>
supabase db push        # applies supabase/migrations in order
```

Or apply each file via the Supabase SQL editor in order.

## Design rules

- **UUID** primary keys (`gen_random_uuid()`), `created_at`/`updated_at`
  timestamps on every table.
- **Foreign keys** with `on delete cascade` from child rows to their property.
- **Indexes** on every foreign key used for lookups.
- **RLS on everywhere.** A signed-in user can read/write only rows they own;
  child rows inherit ownership via a join to `properties`.
- **Raw vs derived separation**: `property_sources` holds original source data
  and is never overwritten by analysis tables (`market_valuations`,
  `underwriting_runs`, …).
- **No secrets in the database.** API keys live only in environment variables.

## Table groups

- **Identity**: `users`, `properties`
- **Tax sale**: `tax_sale_events`
- **Raw provenance**: `property_sources`, `property_documents`,
  `property_images`, `evidence_items`
- **Comparables**: `comparable_sales`, `rental_comparables`
- **Derived analysis**: `market_valuations`, `renovation_estimates`,
  `rental_estimates`, `risk_assessments`
- **Underwriting**: `underwriting_runs` (stores full input JSON + result
  snapshot for reproducibility), `bid_scenarios`
- **Later phases**: `backtest_records` (Phase 2), `ai_analysis_runs` (Phase 4),
  `audit_logs`

## The `PropertyStore` seam

`src/lib/data/store.ts` defines the `PropertyStore` interface. Phase 1 uses
`LocalFilePropertyStore` (writes `.data/properties.json`, gitignored). A
`SupabasePropertyStore` implementing the same interface is the Phase 1→full
swap point: it persists `underwriting_runs.input` and reads it back, letting
the deterministic engine recompute the result on demand.
