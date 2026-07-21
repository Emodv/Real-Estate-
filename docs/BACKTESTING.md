# Backtesting (Phase 2 — design)

Backtesting is a **core feature**, not an afterthought. The question it answers:

> Would TaxSale Copilot have identified the best opportunities *before* the
> tax sale occurred — and avoided the ones that looked cheap but were bad?

## Why the engine already supports it

The engine is **pure and deterministic**, and `underwriting_runs` stores the
**full input JSON** used for each run. That means a historical record can be
underwritten with exactly the information available at a chosen cutoff date and
re-derived byte-for-byte later.

## Hindsight-bias controls (mandatory)

A `backtest_records` row carries an **`as_of_date`** (information cutoff). When
running a historical underwrite:

- Use **only** evidence dated on or before `as_of_date`.
- **Never** feed the actual winning price, later resale value, or any
  post-sale information into the valuation. Those fields exist on the record
  **only** to score the prediction afterward — they are never inputs.

## Record shape

`input_at_time` (the cutoff-limited `UnderwritingInput`), our
`conservative_bid` / `target_bid` / `maximum_safe_bid`, then the *outcome*
fields for scoring: `actual_winning_price`, `actual_pct_of_assessment`,
`later_market_value`.

## Metrics to compute

- **Would we have bid?** (verdict ≠ PASS/STRONG_PASS and reserve ≤ max safe bid)
- **Would we have won?** (our max safe bid ≥ actual winning price)
- **At what bid** (conservative/target/max) and would the resulting deal have
  met our return requirements?
- **Calibration**: predicted opportunity vs. actual result across the sample.

## Test set (target ≥ 10)

- Several **featured** properties (apparent standouts).
- Several that **looked cheap but were bad** investments.
- Several **ordinary** properties.

The goal is not to prove the model works — it is to **discover where it fails**
and tighten the conservative assumptions accordingly.
