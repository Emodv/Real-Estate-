# Calibration Log

Every change to the underwriting **model** (a formula, default, or gating rule
that can move an investment decision) is recorded here with its rationale and
expected effect. The goal is to avoid overfitting: changes are justified by
principle or evidence, never by "it made the backtests look better."

Format: date · change · why · evidence · effect on false-BUY rate / accuracy.

---

## 2026-07-21 — Phase 3 audit-driven changes

### C1 · Add CapEx reserve to rental NOI (default 5% of EGI)
- **Why:** maintenance ≠ long-term capital expenditure. Omitting a CapEx
  reserve overstates NOI and therefore the cash-flow/ROI bid ceilings.
- **Evidence:** standard buy-and-hold underwriting practice; principled, not
  fit to data.
- **Effect:** lowers NOI and the maximum safe bid on cash-flow/ROI-bound deals.
  Strictly more conservative → reduces false-BUY risk. No overfitting.

### C2 · Confidence now uses the comp-derived valuation + dispersion
- **Why:** confidence previously read the legacy `evidence[]` array and ignored
  `input.comps` and comp dispersion, so evidence quality was mismeasured.
- **Evidence:** the brief's confidence definition (more/recent/near comps →
  higher; wide dispersion → lower).
- **Effect:** confidence rises with good comps and falls with dispersion / few /
  old / far comps. Because low confidence gates the verdict down, this reduces
  over-confident BUYs.

### C3 · Unknown renovation ($0 + unverified condition) caps confidence at 40
- **Why:** "Unknown" must never behave like "$0". A sight-unseen tax-sale
  property with no renovation estimate cannot be a high-confidence BUY.
- **Evidence:** principle (F3 in the audit). 40 sits below the verdict's 45
  confidence floor, so such deals gate to CONDITIONAL/WATCH.
- **Effect:** removes the "free renovation" path to a clean BUY. Conservative.

### C4 · Explicit bid ladder: opportunistic + walk-away
- **Why:** the brief requires these to stay distinct decisions.
- **Effect:** presentation/clarity only; the safety ceiling (max safe bid) is
  unchanged, so no effect on decision quality.

### C5 · Backtest decision classification (CORRECT/FALSE BUY/PASS)
- **Why:** to measure the dangerous error — a BUY on a deal reality proved bad.
- **Method:** a post-mortem re-underwrites the deal at our entry price using the
  ACTUAL renovation / rent / value. Actuals never touch the prediction (guarded
  by test).
- **Effect:** measurement only; introduces the false-BUY rate metric we minimize.

---

## How to use this log going forward
When calibrating against real backtests, add an entry BEFORE changing a formula.
Record: what changed, why, how many backtests support it, and whether it
improves or worsens the **false-BUY rate** first and general accuracy second.
Never tune a formula solely to win historical auctions.
