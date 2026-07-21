# Underwriting Engine

`src/lib/underwriting/` is the heart of the system: a **pure, deterministic,
unit-tested** TypeScript library. No I/O, no AI, no randomness. `underwrite(input)`
always returns the same result for the same input.

## Modules

| File | Responsibility |
|------|----------------|
| `money.ts` | Numeric primitives. Single choke point that guarantees no `NaN`/`Infinity` ever escapes (`num`, `clamp`, `safeDivide`, `amortizingPayment`). |
| `acquisition.ts` | Ontario Land Transfer Tax (marginal brackets) + closing costs. |
| `renovation.ts` | Renovation totals + contingency. |
| `rental.ts` | EGI, operating expenses, NOI (unlevered, price-independent). |
| `brrrr.ts` | `evaluateBrrrr(price, input)` — the full BRRRR model at a price. |
| `ceilings.ts` | Six independent bid ceilings + binding-constraint selection. |
| `risk.ts` | Deal-killer classification, risk score, risk premium. |
| `confidence.ts` | Evidence-derived confidence scores. |
| `score.ts` | Transparent 0–100 investment score with sub-scores. |
| `swot.ts` | Deterministic, evidence-referenced SWOT. |
| `verdict.ts` | Gated verdict + investment-committee narrative. |
| `engine.ts` | `underwrite(input)` orchestrator. |
| `defaults.ts` | Conservative defaults + `withDefaults()` normalization. |

## The BRRRR model (`evaluateBrrrr`)

Modeling assumptions (deliberately conservative):

- The acquisition + renovation loan is serviced **interest-only** during the
  hold, so the full balance is refinanced out (no principal paydown credit).
- The property is **fully vacant** during the renovation hold.
- Refinance pays off the acquisition/renovation loan; proceeds above payoff
  and refi costs are returned to the investor as **recovered capital**.
- The stabilized mortgage is a **fully-amortizing** loan on `ARV × refinanceLTV`.

Important structural fact: **NOI and post-refinance debt service are independent
of the purchase price** (the refinance loan is sized off ARV, not price). This
is why each bid ceiling isolates a different channel through which price affects
the deal.

## The six bid ceilings

Each ceiling answers "what is the most I can pay and still satisfy constraint X?"
Because every constraint is **monotonic** in price (higher price → worse), each
ceiling is solved by **bisection** (`maxPriceSatisfying`) over the BRRRR model.

| Ceiling | Constraint |
|---------|-----------|
| **VALUE** | `totalProjectCost(P) + equityBuffer ≤ ARV × (1 − marginOfSafety)` (MAO style). |
| **BRRRR** | `capitalTrapped(P) ≤ maxCapitalTrapped`. |
| **CASH_FLOW** | Buy-and-hold debt service on the purchase mortgage stays covered at `DSCR ≥ min` and `cashFlow ≥ minMonthly`. |
| **ROI** | `cashFlow / capitalTrapped(P) ≥ minCashOnCash`. |
| **RISK_ADJUSTED** | VALUE ceiling recomputed with an *extra* margin from the risk premium. |
| **CAPITAL** | `totalCashInvested(P) ≤ maxCapitalAvailable` (only if a limit is set). |

```
MAX SAFE BID = MIN(applicable ceilings)
BINDING CONSTRAINT = the ceiling that equals the min
```

The UI shows every ceiling and highlights the binding one. The graduated bids
are `conservative < target < maxSafe = hardStop`.

## Verdict gating (prefers NO DEAL over BAD DEAL)

The verdict is **not** a pure function of the score. Gates dominate, in order:

1. **Fatal deal-killer** → `STRONG_PASS` (no matter the score).
2. **Max safe bid below minimum tender** → `PASS` / `STRONG_PASS`.
3. **Critical unknown** (title / access / environmental / structural) →
   `CONDITIONAL_BUY` or `WATCH`.
4. **Low overall confidence** → capped at `CONDITIONAL_BUY` / `WATCH`.
5. Otherwise ranked by score + headroom over the reserve.

An UNKNOWN is always treated as materially risky — never as "safe".

## Guarantees enforced by tests

- No financial output is ever `NaN`/`Infinity` (even on all-empty input).
- Determinism: identical input → byte-identical ceilings.
- Monotonicity and boundary correctness of every ceiling.
- Fatal risk forces `STRONG_PASS`; critical unknown blocks `STRONG_BUY`/`BUY`.
- Value "Show Your Math" lines reconcile to the value ceiling.

Run: `npm test`.
