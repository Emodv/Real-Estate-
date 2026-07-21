# Phase 2 Plan — Investment Intelligence Engine

## 1. Current architecture (what already works)

TaxSale Copilot is a Next.js (App Router) modular monolith. Phases 0, 1, and
1.5 shipped:

- **Deterministic underwriting engine** (`src/lib/underwriting/`, pure, 44 tests):
  Ontario LTT, renovation totals, NOI/cash flow, single-LTV refinance, six bid
  ceilings + binding constraint, three graduated bids + hard stop, risk /
  deal-killer classification, evidence-derived confidence, transparent
  investment sub-scores, evidence-referenced SWOT, gated verdict, committee
  narrative.
- **Location intelligence** (`src/lib/geo/`): Haversine + Google geocoding;
  the engine derives comparable distances from coordinates.
- **Auth + persistence** (Phase 1.5): Supabase Google OAuth, email allowlist,
  RLS, `PropertyStore` abstraction (local file store + Supabase store),
  provenance columns.
- **UI**: dashboard, intake form, full underwriting report (Show-Your-Math,
  ceilings, BRRRR, deal killers, SWOT, committee).

### What already satisfies parts of this prompt
Three bid levels, deal killers, SWOT, verdict rules, confidence, investment
score, BRRRR capital-trapped emphasis, provenance/data-status, "unknown treated
as risky." These are **reused, not rebuilt.**

## 2. What is missing (the Phase 2 delta)

| # | Gap | New module |
|---|-----|-----------|
| 1 | Comparable sales as a first-class object (price/sqft, price/acre, distance, **similarity scoring**, configurable weights) | `comps.ts` |
| 2 | **Market value derived FROM comps** (Low/Base/High), instead of hand-entered as-is/ARV | `valuation.ts` |
| 3 | Renovation model: light/moderate/heavy × categories × KNOWN/ESTIMATED/ASSUMED/UNKNOWN | `renovationModel.ts` |
| 4 | **Sensitivity matrix** (ARV × reno → max safe bid) + break-even & walk-away bids | `sensitivity.ts` |
| 5 | **Multi-LTV refinance scenarios** (65/70/75/80%) | `refinanceScenarios.ts` |
| 6 | Deal-killer **Top-3 reasons to buy / not buy** | `reasons.ts` |
| 7 | **Investment Committee Memo** as a structured deterministic object | `memo.ts` |
| 8 | **AI provider abstraction** (Anthropic/Gemini/OpenAI), never does math | `src/lib/ai/` |
| 9 | Multiple underwriting **strategies** (BRRRR / cash-flow / flip / land) | strategy field on input; ceilings already model BRRRR + cash-flow |

## 3. Data flow

```
PropertyInput (identity, tax sale, comps[], reno, rental, refi, risks, evidence)
      │
      ▼
withDerivedDistances (geo)         ← coordinates → comp distances
      │
      ▼
comps.ts ─► valuation.ts ─► (Low/Base/High market value + ARV, with evidence)
      │                         │
      │                         ▼
renovationModel.ts          feeds value.* used by ceilings
      │                         │
      ▼                         ▼
        deterministic engine (ceilings, BRRRR, score, risk, verdict)
      │
      ├─► refinanceScenarios.ts (65/70/75/80% LTV)
      ├─► sensitivity.ts (matrix + break-even/walk-away)
      ├─► reasons.ts (top 3 buy / not buy)
      ▼
memo.ts  ─►  Investment Committee Memo  ─►  UI + underwriting_runs snapshot
      ▲
      │ (optional, non-authoritative)
   src/lib/ai  — narrative, risk interpretation, missing-info; Zod-validated
```

**Invariant:** AI never feeds arithmetic. The deterministic engine owns every
number. AI only reads results and produces prose / flags, validated by Zod.

## 4. New database tables / columns

The Phase 1 schema already defines `comparable_sales`, `rental_comparables`,
`market_valuations`, `renovation_estimates`, `data_points`-style
`evidence_items`, `underwriting_runs`, `bid_scenarios`. Phase 2 migration
(`0004`) adds:

- `comparable_sales`: `building_sqft`, `lot_acres`, `bedrooms`, `bathrooms`,
  `year_built`, `condition`, `similarity_score`, `price_per_sqft`.
- `market_valuations`: `low_value`, `base_value`, `high_value`, `method`,
  `weights` jsonb.
- `underwriting_runs`: `memo` jsonb (full memo snapshot for reproducibility).

Local mode keeps everything in the `input` JSON, so no DB is required to run the
engine or tests.

## 5. AI provider strategy

`src/lib/ai/provider.ts` defines `AIProvider.analyze(task, payload) → Zod-validated JSON`.
Adapters: `anthropic.ts`, `gemini.ts`, `openai.ts`, plus a `null` provider used
when no key is set (so the app is fully functional with zero AI). Selected via
`PRIMARY_AI_PROVIDER` with ordered fallback. **No autonomous agents.** All keys
are server-only.

## 6. Testing strategy

Every new module is a pure function with a dedicated test file covering the
prompt's 20 required cases (zero/high reno, negative bid, tender > max bid,
refinance, capital recovery, cash flow, DSCR, cap rate, sensitivity, risk
premium, confidence, comp weighting, verdict, deal-killer override, missing
data, unknown data, no comps, weak comps). Target: keep the suite green after
every increment.

## 7. Implementation sequence (this phase)

1. `PHASE_2_PLAN.md` ✅
2. `comps.ts` + tests — similarity + price/sqft/acre + weighting
3. `valuation.ts` + tests — Low/Base/High from comps, ARV, confidence
4. `renovationModel.ts` + tests — tiers, categories, status
5. `refinanceScenarios.ts` + tests — 65/70/75/80% LTV
6. `sensitivity.ts` + tests — matrix, break-even, walk-away
7. `reasons.ts` + tests — top-3 buy / not-buy
8. `memo.ts` + tests — assemble the Investment Committee Memo
9. Integrate into `engine.ts` result; render a Memo view + comps in the UI
10. `src/lib/ai/` provider abstraction (interface + null provider + adapters)
11. DB migration `0004`; provenance polish
12. One real-property acceptance test (fixture + assertions)

Each increment: test → typecheck → lint → build → commit.

## 8. Out of scope (explicitly not now)
Ontario Tax Sales scraping, Telegram/email alerts, billing, multi-tenant RBAC,
document/OCR pipelines, autonomous agents. Authentication is "good enough" and
will not be refactored.
