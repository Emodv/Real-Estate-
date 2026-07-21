# Model Governance

Rules that constrain how the TaxSale Copilot underwriting engine may be trusted
and changed. These are **provisional governance rules**, not scientific truth.

## Principles (non-negotiable)
1. **Decision support, not financial advice.** The engine informs a human; the
   human decides and bears the risk.
2. **AI cannot override deterministic math.** Every price, return, and verdict is
   produced by pure TypeScript. AI (a later phase) may only summarize evidence
   and flag risks, always Zod-validated, never numeric authority.
3. **AI cannot invent missing data.** Absent data stays absent.
4. **Unknown is not zero.** An unknown renovation, rent, or risk is treated as
   risky — it caps confidence and gates the verdict; it is never silently \$0.
5. **Assessment is not market value.** MPAC assessment is a reference ratio
   only; valuation is comp-derived.
6. **Backtests cannot guarantee future performance.** Past Ontario tax-sale
   outcomes do not bind future ones.
7. **Small samples are unreliable.** Fewer than the governance threshold of
   backtests ⇒ status INSUFFICIENT DATA. Three good backtests validate nothing.
8. **Formula changes require human approval** and a `docs/CALIBRATION_LOG.md`
   entry. The system measures error and *recommends*; it never auto-tunes.
9. **The engine prefers a false PASS over a false BUY.** Missing a good deal is
   acceptable; recommending a bad one is not.

## Model Health thresholds (provisional)
Implemented in `src/lib/backtest/modelHealth.ts`.

| Status | Meaning |
|--------|---------|
| **INSUFFICIENT DATA** | < 20 backtests. Not validated — do not risk capital on it. |
| **RED** | False-BUY rate above 5%, or an unacceptable error / unresolved critical bug. Do not trust BUY calls. |
| **YELLOW** | ≥ 20 backtests but one or more governance checks fail or aren't yet evaluable. |
| **GREEN** | ≥ 20 backtests, false-BUY rate ≤ 5%, median absolute valuation error ≤ 15%, no systematic renovation underestimation (median reno error ≥ −18%), and high confidence measurably outperforms low confidence. |

GREEN is deliberately hard and is **never** defined as "the unit tests pass".

## Change-control workflow
1. Run backtests; read the calibration dashboard (`/backtest`).
2. If a systematic bias appears, write a `CALIBRATION_LOG.md` entry FIRST:
   problem, evidence, old vs new formula, expected impact, before/after
   backtest metrics.
3. A human approves the change.
4. Only then change the formula, and re-run the full test suite + backtests.
5. Never tune a formula solely to win historical auctions.
