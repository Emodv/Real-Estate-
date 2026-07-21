# Engine Formula Audit (Phase 3.5)

A step-by-step trace of the deterministic underwriting pipeline, documenting
every input, formula, default, unknown-handling rule, and whether the step
moves the **Max Safe Bid (MSB)** or the **BUY/PASS** verdict. Source of truth:
`src/lib/underwriting/`. This audit does not change formulas — it verifies them.

Notation: `P` = purchase price. All money figures CAD.

---

## 1. Comparable Sales → `comps.ts`
- **In:** `input.comps[]`, subject meta. **Out:** `scoredComps[]` (similarity
  0–1, $/sqft, $/acre, effective distance, normalized weight).
- **Formula:** per-dimension closeness (distance decay to 0 at 25 km; ratio
  closeness for size; count closeness for beds/baths; type match; age; recency),
  weighted by `DEFAULT_COMP_WEIGHTS`, **renormalized over available dimensions**
  so missing fields don't deflate similarity.
- **Unknown:** a dimension with no data is skipped, not zeroed.
- **Affects MSB?** Indirectly (feeds valuation). **Verdict?** Indirectly.

## 2. Market Valuation → `valuation.ts`
- **In:** scored comps, subject sqft, assessment (reference only).
- **Formula:** indicated value per comp = subject sqft × comp $/sqft (or raw
  sale price when sizes unknown); **base = similarity-weighted mean**;
  dispersion = weighted CoV clamped [5%, 25%]; low/high = base × (1 ∓ dispersion).
- **Assessment:** shown only as `assessmentToMarket` ratio; **never** the anchor
  (locked by test F6).
- **Unknown:** no comps → returns null → engine falls back to user-entered
  `value.*`.
- **Affects MSB?** YES (seeds `conservativeAsIs` / `conservativeArv` when blank).

## 3. ARV
- **In:** `input.refinance.arv` (or comp base when blank).
- **Rule:** conservative default ARV = comp base (renovation brings the property
  *to* market, not above). User override respected.
- **Affects MSB?** YES (value ceiling & refinance).

## 4. Renovation → `renovation.ts` + `renovationModel.ts`
- **Formula:** raw = cosmetic + major + structural; **with contingency** =
  raw × (1 + contingencyPct). Model builds line items with status
  KNOWN/ESTIMATED/ASSUMED/UNKNOWN.
- **Unknown:** raw = $0 with `renovation.confidence < 70` ⇒ flagged
  `renovationUnknown` ⇒ confidence capped at 40 ⇒ verdict gated down (F3). Never
  silently $0-safe.
- **Affects MSB?** YES (deducted in every project-cost path). **Verdict?** YES
  (via confidence gate).

## 5. Rental income & 6. Operating expenses → `rental.ts`
- **Formula:** GPR = rent × 12; EGI = GPR × (1 − vacancy); opex =
  propertyTax + insurance + utilities + **maintenance (%EGI)** +
  **management (%EGI)** + **CapEx (%EGI, distinct — Phase 3)** + other;
  **NOI = EGI − opex**.
- **No double-count:** maintenance and CapEx are separate %s; property tax here
  is the *stabilized* tax (distinct from the holding-phase tax in §8).
- **Phase 3.5 change:** rent becomes a first-class **low/base/high** range and
  opex becomes an **itemized table with status** (see §13). MSB uses **base**
  rent only — never the optimistic high.
- **Affects MSB?** YES (cash-flow & ROI ceilings). **Verdict?** YES.

## 7. Financing (acquisition + reno phase)
- `purchaseLoan = P × financedOnPurchasePct`; `renovationLoan` = financed share
  of reno (if enabled); `financingFees = totalAcqFinancing × feesPct + fixedFees`.
- **Affects MSB?** YES (fees are an all-in cost; loan size drives holding interest).

## 8. Holding costs
- `monthlyHoldingInterest = totalAcqFinancing × (annualRate/12)` (interest-only,
  conservative); monthly holding = interest + propertyTax + insurance +
  utilities + maintenance + other; `totalHoldingCost = monthly × months`.
- **No double-count:** holding-phase property tax/insurance are the *vacant
  renovation period*; stabilized rental opex (§6) is the *rented period*.
- **Affects MSB?** YES.

## 9. Total project cost & cash invested → `brrrr.ts`
- `totalProjectCost = P + acqCosts + renoWithContingency + financingFees +
  totalHoldingCost`.
- `totalCashInvested = downPayment + acqCosts + financingFees + renoPaidInCash +
  totalHoldingCost` (equity actually deployed; loan-funded reno excluded).
- **Verified:** each cost appears once; project cost is all-in, cash is equity.

## 10. Refinance → `brrrr.ts`, `refinanceScenarios.ts`
- `refinanceAmount = ARV × LTV` (lender-valuation based, **not** cost-basis —
  the "75% LTV returns 75% of cost" fallacy is absent, locked by test);
  `netCash = refinanceAmount − existingLoan − refiCosts`;
  `capitalRecovered = max(netCash, 0)`; `capitalTrapped = totalCashInvested −
  capitalRecovered`. Scenarios at 65/70/75/80% LTV.
- **Affects MSB?** YES (BRRRR ceiling caps trapped capital).

## 11. BRRRR returns
- `annualDebtService = amortizingPayment(refinanceAmount, refiRate/12, amort×12)
  × 12`; `annualCashFlow = NOI − annualDebtService`; cap rate = NOI/ARV;
  cash-on-cash = annualCashFlow / capitalTrapped (null when trapped ≤ 0);
  DSCR = NOI / annualDebtService.

## 12. Bid ladder & Max Safe Bid → `ceilings.ts`, `engine.ts`
- Six independent ceilings (Value, BRRRR, Cash-Flow, ROI, Risk-Adjusted,
  Capital), each solved by monotonic bisection; **MSB = min(applicable
  ceilings)**; binding ceiling reported.
- Ladder: `opportunistic` (full capital recovery) ≤ `conservative` ≤ `target`
  ≤ `MSB = walk-away`; `breakEvenBid` (zero equity) sits above MSB in sensitivity.
- **Traceable:** `valueMathLines` shows the value ceiling waterfall.

## 13. Deal killers, confidence, verdict, ranking
- Fatal risk ⇒ STRONG_PASS (overrides score). MSB < min tender ⇒ PASS/STRONG_PASS.
  Critical unknown ⇒ CONDITIONAL/WATCH. Confidence < 45 caps enthusiasm.
- Confidence is dispersion/comp-aware (Phase 3). Ranking never overrides a fatal
  killer.

---

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| A1 | — | No double-counted or missing expense found across §7–§11. | VERIFIED |
| A2 | LOW | Rent was a single number; optimism risk. | FIXED (3.5): first-class low/base/high; MSB uses base. |
| A3 | LOW | Operating expenses not itemized/traceable in outputs. | FIXED (3.5): itemized opex table with status, in result + memo. |
| A4 | INFO | **Disposition/selling costs are intentionally excluded** — this is a BRRRR (refinance-and-hold) model, not a flip. A flip strategy would need selling costs; documented, not a bug. | BY DESIGN |
| A5 | INFO | Holding-phase interest is interest-only (no principal paydown credit) — conservative. | BY DESIGN |
| A6 | INFO | CapEx separated from maintenance in Phase 3; verified not double-counted. | VERIFIED |

No new **CRITICAL** mathematical bug was found. The only material Phase 3.5
changes are additive transparency: first-class rent ranges and itemized opex.
