# Phase 3A — Engine Audit

A critical read of every financial formula in `src/lib/underwriting/` and
`src/lib/backtest/`, focused on where an assumption can materially move the
investment decision. Findings are ordered by severity. Only material findings
are fixed in this phase (see `docs/CALIBRATION_LOG.md`); cosmetic issues are
left alone.

Legend: **CRITICAL** = can cause a bad BUY · **HIGH** = materially moves the bid
or confidence · **MEDIUM** = clarity / secondary economics · **LOW** = verify &
lock with a test.

---

## F1 — No CapEx reserve in rental NOI  · HIGH · FIXED
- **Current behavior:** `rentalMath` reserves only maintenance + management
  (as % of EGI). Long-term capital expenditure (roof, furnace, windows,
  flooring cycles) is not reserved.
- **Why it matters:** NOI is overstated, which flows into cash flow, cap rate,
  DSCR, the cash-flow bid ceiling and the ROI bid ceiling — so the **maximum
  safe bid is biased high**. On a hold strategy this is exactly the silent
  optimism the system is supposed to resist.
- **Fix:** add `capexPct` (default 5% of EGI) as a distinct reserve line;
  include it in operating expenses. Conservative and explicit.
- **Investment impact:** lowers NOI, lowers max safe bid modestly on
  cash-flow/ROI-bound deals. Correctly conservative.

## F2 — Confidence ignores the comparable-sales engine  · HIGH · FIXED
- **Current behavior:** `computeConfidence` derives valuation confidence from
  the legacy `input.evidence[]` array via regex on claim text. It does **not**
  read `input.comps` or the valuation engine's dispersion-aware
  `valuation.confidence`.
- **Why it matters:** After Phase 2, comparables live in `input.comps`. A
  property valued from three strong, recent, nearby comps can still report LOW
  valuation confidence (empty `evidence[]`), while confidence fails to fall when
  comp **dispersion** is high. Confidence is supposed to track evidence quality;
  here it tracks the wrong field.
- **Fix:** pass the computed `valuation` (and `scoredComps`) into
  `computeConfidence`; when a comp-derived valuation exists, adopt its
  dispersion-aware confidence as the valuation sub-score and factor comp count /
  recency / proximity. Fall back to the legacy evidence path only when no comps.
- **Investment impact:** confidence now rises with good comps and **falls with
  dispersion / few / old / far comps**, which is what gates the verdict.

## F3 — Unknown renovation silently treated as \$0  · HIGH · FIXED
- **Current behavior:** bid ceilings deduct `input.renovation` totals. If the
  user leaves renovation at 0 because condition is unknown, renovation is
  deducted as \$0 and the **max safe bid is inflated** with no penalty.
- **Why it matters:** "Unknown" must never become "\$0". This is the single
  most dangerous silent-optimism path for tax-sale properties bought sight-unseen.
- **Fix (conservative, non-fabricating):** the engine does not invent a
  renovation number, but when renovation is \$0 / effectively unknown and the
  property is not marked condition-verified, it now (a) emits a prominent
  warning, (b) **caps overall confidence low**, and (c) surfaces it as a reason
  not to buy. Low confidence already gates the verdict down to
  CONDITIONAL/WATCH, so an unknown-renovation deal can no longer present as a
  clean STRONG BUY.
- **Investment impact:** removes the "free renovation" inflation of the bid's
  trustworthiness without fabricating a cost.

## F4 — Bid ladder incomplete (no explicit walk-away / opportunistic)  · MEDIUM · FIXED
- **Current behavior:** conservative / target / max-safe / hard-stop only.
- **Why it matters:** the brief asks these to remain distinct — the do-not-cross
  price, the conservative ceiling, the target, and the "steal" price are
  different decisions and must not collapse into one number.
- **Fix:** add `opportunisticBid` (the price at which capital is **fully
  recovered** on refinance — an exceptional BRRRR outcome — clamped ≤
  conservative) and an explicit `walkAwayBid` (= max safe bid, the do-not-cross).
  `breakEvenBid` (zero-equity, above max-safe) stays in the sensitivity block.
- **Investment impact:** clearer bidding discipline; no change to the safety
  ceiling.

## F5 — Backtest lacked FALSE BUY / FALSE PASS classification  · MEDIUM · FIXED
- **Current behavior:** backtest tracked would-we-bid / could-we-win / bid gap,
  but not whether a BUY was **correct** once actuals are known.
- **Why it matters:** the whole point of Phase 3 is to measure the dangerous
  error — recommending BUY on a deal that reality proved bad.
- **Fix:** add a post-mortem classifier that recomputes the deal economics at
  our own bid using the **actual** renovation / rent / value, and labels each
  record `CORRECT_BUY | FALSE_BUY | CORRECT_PASS | FALSE_PASS | INCONCLUSIVE`.
  Actuals are used only here, never in the prediction (guarded by test).
- **Investment impact:** the calibration dashboard can now surface the
  false-BUY rate — the metric we minimize first.

## F6 — MPAC assessment must never anchor value  · LOW · VERIFIED (test added)
- **Current behavior:** valuation derives from comps; the score's discount uses
  `conservativeAsIs`; assessment appears only as a reference ratio.
- **Action:** no code change; added a regression test proving that changing the
  assessment does not change market value, max safe bid, or verdict.

## F7 — Determinism & AI isolation  · LOW · VERIFIED (test added)
- **Current behavior:** the `underwrite()` path imports no AI module; AI lives
  only behind `src/lib/ai` and is never called by the engine.
- **Action:** no code change; added tests proving byte-identical output across
  repeated runs and that the deterministic result does not depend on any AI
  provider being configured.

---

## Reviewed and found SOUND (no change)
- **Refinance proceeds** are ARV-based, not cost-basis: `refinanceAmount =
  ARV × LTV`; `netCash = refinanceAmount − existingLoan − refiCosts`;
  `capitalTrapped = totalCashInvested − netCash`. The "75% LTV returns 75% of
  invested" fallacy is **not** present. (Test added to lock this.)
- **No divide-by-zero / NaN**: all math flows through `num`/`safeDivide`; a
  dedicated test asserts no `NaN` on empty input.
- **Fatal deal-killer override**: a fatal risk forces `STRONG_PASS` regardless
  of score. (Already tested; kept.)
- **Bid ceilings** are independent and the binding one is reported; no
  double-counting of the same cost across a single ceiling was found.
- **Hindsight isolation** in backtesting: actuals never enter `underwrite()`.
