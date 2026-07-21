# Data Model

## Provenance is first-class

Every data point carries a **data status** so the system never presents an
assumption as a fact:

| Status | Meaning |
|--------|---------|
| `VERIFIED` | Confirmed against an authoritative source. |
| `ESTIMATED` | A reasoned estimate. |
| `INFERRED` | Derived from other data. |
| `USER_PROVIDED` | Entered by the analyst. |
| `AI_SUGGESTED` | Proposed by a model (Phase 4+), pending review. |
| `UNKNOWN` | Not yet known — treated as **risky**, never as safe. |

The system distinguishes **fact / assumption / estimate / opinion** everywhere.

## Raw vs derived

- **Raw** (`property_sources`, `property_documents`, `evidence_items`) captures
  original source content, URL, source type, retrieval timestamp, and
  extraction method. It is immutable relative to analysis.
- **Derived** (`market_valuations`, `renovation_estimates`, `risk_assessments`,
  `underwriting_runs`, …) is computed and may be regenerated. Regenerating
  analysis never mutates raw source rows.

## Underwriting input (the engine contract)

`UnderwritingInput` (`src/lib/underwriting/types.ts`) is the complete,
serializable contract fed to the engine. Groups:

`meta`, `taxSale`, `value`, `acquisition`, `renovation`, `financing`,
`holding`, `rental`, `refinance`, `returns`, `capital`, `bidShape`, `risks[]`,
`evidence[]`.

It is validated by `underwritingInputSchema` (Zod, `src/lib/data/schema.ts`)
before ever reaching the engine, and normalized through `withDefaults()` so
partial input never crashes the calculator.

## Evidence & confidence

Each `EvidenceItem` records `claim`, `value`, `source`, `sourceType`, `date`,
`distanceKm`, and `dataStatus`. Confidence scores are **derived** from this
evidence (count, recency, proximity, verification) — not invented. See
`confidence.ts`.

## Reproducibility

`underwriting_runs` stores the **full input JSON** plus a **result snapshot**
and an `engine_version`. Because the engine is pure, any run can be
re-derived exactly, which is also what makes hindsight-free backtesting
possible (see `docs/BACKTESTING.md`).
