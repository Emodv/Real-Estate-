# Architecture

TaxSale Copilot is a **modular monolith** built on Next.js (App Router) +
TypeScript. It is an internal decision-support tool — no billing, no
multi-tenancy, no microservices.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│  UI (React Server Components + a few Client Components)       │
│  src/app/**            src/components/**                      │
├──────────────────────────────────────────────────────────────┤
│  Server Actions (validation boundary)                        │
│  src/app/actions.ts                                          │
├──────────────────────────────────────────────────────────────┤
│  Deterministic Underwriting Engine  (the core)              │
│  src/lib/underwriting/**   — PURE, tested, no I/O, no AI      │
├──────────────────────────────────────────────────────────────┤
│  Data layer (storage abstraction)                            │
│  src/lib/data/**   +   src/lib/supabase/**                   │
├──────────────────────────────────────────────────────────────┤
│  Postgres via Supabase  (supabase/migrations/**)             │
└──────────────────────────────────────────────────────────────┘
```

## Non-negotiable boundaries

1. **AI never does financial math.** All bid, BRRRR, cash-flow, and refinance
   figures are produced by pure TypeScript in `src/lib/underwriting`. AI (a
   later phase) may only supply *inputs* and *narrative*, always validated by
   Zod. See `docs/UNDERWRITING_ENGINE.md`.
2. **The engine is pure.** `underwrite(input)` performs no I/O and is fully
   deterministic — the same input always yields the same output. This makes
   every number reproducible and unit-testable.
3. **Storage is abstracted.** The UI and engine never talk to a database
   directly. `PropertyStore` (`src/lib/data/store.ts`) is the single seam.
   Phase 1 ships a local JSON-file implementation; the Supabase implementation
   satisfies the same interface without touching business logic.
4. **Raw source data is stored separately from derived analysis** and is never
   overwritten by interpretations (see `docs/DATA_MODEL.md`).

## App modes

Controlled by `NEXT_PUBLIC_APP_MODE`:

- `local` (default) — no cloud dependencies. A JSON-file store under `.data/`
  is seeded with one illustrative property. Ideal for evaluating the engine
  and UI. **No authentication.**
- `supabase` — Supabase Postgres + Supabase Auth (Google OAuth) + RLS. See
  `docs/SECURITY.md` and `docs/DATABASE.md`.

## Key directories

| Path | Responsibility |
|------|----------------|
| `src/lib/underwriting/` | The deterministic engine + types + tests |
| `src/lib/data/` | Zod schemas, sample data, `PropertyStore` |
| `src/lib/supabase/` | Supabase client factories (supabase mode only) |
| `src/components/` | Presentational + report UI |
| `src/app/` | Routes, layout, server actions |
| `supabase/migrations/` | Normalized schema + RLS (source of truth for prod) |

## Why a modular monolith

Per the brief: start simple, extract services only when justified. There is no
Redis, BullMQ, Docker, or worker fleet. The engine is a library that could be
lifted into a queue-driven pipeline in Phase 5 without change, because it is
already a pure function.
