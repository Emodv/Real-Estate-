import type {
  BidCeiling,
  BidCeilingKey,
  MathLine,
  UnderwritingInput,
} from "./types";
import { num, clamp, roundDollars, amortizingPayment } from "./money";
import { acquisitionCosts } from "./acquisition";
import { renovationWithContingency } from "./renovation";
import { rentalMath } from "./rental";
import { evaluateBrrrr } from "./brrrr";
import { riskPremiumPct } from "./risk";

/** Upper bound for the price search — generous multiple of ARV/value. */
function searchUpperBound(input: UnderwritingInput): number {
  return Math.max(
    num(input.value.conservativeArv),
    num(input.value.conservativeAsIs),
    num(input.refinance.arv),
    num(input.taxSale.minimumTender),
    100_000,
  ) * 3;
}

/**
 * Find the maximum price P in [lo, hi] for which `ok(P)` is true.
 * Requires `ok` to be monotonic: true for small P, false for large P.
 * If ok(lo) is false, returns lo (no headroom). Uses 60 bisection steps.
 */
export function maxPriceSatisfying(
  ok: (p: number) => boolean,
  lo: number,
  hi: number,
): number {
  let low = lo;
  let high = hi;
  if (!ok(low)) return low;
  if (ok(high)) return high;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (ok(mid)) low = mid;
    else high = mid;
  }
  return low;
}

// ---------------------------------------------------------------------------
// A. VALUE-BASED CEILING (MAO style, on conservative ARV)
// ---------------------------------------------------------------------------
export function valueCeiling(input: UnderwritingInput, extraMarginPct = 0): number {
  const arv = num(input.value.conservativeArv);
  const margin = clamp(num(input.value.marginOfSafetyPct) + extraMarginPct, 0, 0.95);
  const reno = renovationWithContingency(input.renovation);
  const buffer = Math.max(num(input.value.requiredEquityBuffer), 0);
  const hi = searchUpperBound(input);
  // Constraint: totalProjectCost(P) + buffer <= arv * (1 - margin)
  const target = arv * (1 - margin) - buffer;
  const ok = (p: number) => {
    const m = evaluateBrrrr(p, input);
    return m.totalProjectCost + buffer <= arv * (1 - margin) + 1e-6 * arv;
  };
  if (target <= 0) return 0;
  return Math.max(0, maxPriceSatisfying(ok, 0, hi));
}

/** Show-your-math breakdown for the value ceiling, evaluated at that ceiling. */
export function valueCeilingMath(input: UnderwritingInput, ceiling: number): MathLine[] {
  const arv = num(input.value.conservativeArv);
  const margin = clamp(num(input.value.marginOfSafetyPct), 0, 0.95);
  const m = evaluateBrrrr(ceiling, input);
  const requiredMargin = arv * margin;
  const buffer = Math.max(num(input.value.requiredEquityBuffer), 0);
  return [
    { label: "Conservative After-Repair Value (ARV)", amount: roundDollars(arv), op: "info" },
    { label: `Required margin of safety (${Math.round(margin * 100)}%)`, amount: -roundDollars(requiredMargin), op: "subtract" },
    { label: "Required equity buffer", amount: -roundDollars(buffer), op: "subtract" },
    { label: "Renovation (incl. contingency)", amount: -roundDollars(m.renovationWithContingency), op: "subtract" },
    { label: "Acquisition / closing costs", amount: -roundDollars(m.acquisitionCosts), op: "subtract" },
    { label: "Financing fees", amount: -roundDollars(m.financingFees), op: "subtract" },
    { label: "Holding costs", amount: -roundDollars(m.totalHoldingCost), op: "subtract" },
    { label: "VALUE-BASED BID CEILING", amount: roundDollars(ceiling), op: "result" },
  ];
}

// ---------------------------------------------------------------------------
// B. BRRRR CEILING (limit trapped capital after refinance)
// ---------------------------------------------------------------------------
export function brrrrCeiling(input: UnderwritingInput): number {
  const maxTrapped = Math.max(num(input.returns.maxCapitalTrapped), 0);
  const hi = searchUpperBound(input);
  const ok = (p: number) => evaluateBrrrr(p, input).capitalTrapped <= maxTrapped + 1e-6;
  return Math.max(0, maxPriceSatisfying(ok, 0, hi));
}

// ---------------------------------------------------------------------------
// C. CASH-FLOW CEILING (buy-and-hold debt service test, independent of refi)
// ---------------------------------------------------------------------------
export function cashFlowCeiling(input: UnderwritingInput): number {
  const { noi } = rentalMath(input.rental);
  const minDscr = Math.max(num(input.returns.minDscr), 0.0001);
  const minMonthly = num(input.returns.minMonthlyCashFlow);
  // Maximum annual debt service the property can support.
  const byDscr = noi / minDscr;
  const byCashFlow = noi - minMonthly * 12;
  const maxAnnualDebtService = Math.max(0, Math.min(byDscr, byCashFlow));

  const financedPct = clamp(num(input.financing.financedOnPurchasePct), 0, 1);
  const rate = Math.max(num(input.refinance.refinanceAnnualRate), 0) / 12;
  const periods = Math.max(num(input.refinance.refinanceAmortizationYears), 0) * 12;
  const hi = searchUpperBound(input);

  const ok = (p: number) => {
    const loan = p * financedPct;
    const annualDs = amortizingPayment(loan, rate, periods) * 12;
    return annualDs <= maxAnnualDebtService + 1e-6;
  };
  // If financedPct is 0 there is no debt, constraint always satisfied.
  if (financedPct <= 0) return hi;
  return Math.max(0, maxPriceSatisfying(ok, 0, hi));
}

// ---------------------------------------------------------------------------
// D. ROI CEILING (minimum cash-on-cash on trapped capital)
// ---------------------------------------------------------------------------
export function roiCeiling(input: UnderwritingInput): number {
  const minCoC = Math.max(num(input.returns.minCashOnCash), 0);
  const hi = searchUpperBound(input);
  const ok = (p: number) => {
    const m = evaluateBrrrr(p, input);
    if (m.annualCashFlow <= 0) {
      // Negative cash flow can never meet a positive CoC requirement.
      return minCoC <= 0;
    }
    if (m.capitalTrapped <= 0) return true; // infinite return, always meets
    return m.annualCashFlow / m.capitalTrapped >= minCoC - 1e-9;
  };
  return Math.max(0, maxPriceSatisfying(ok, 0, hi));
}

// ---------------------------------------------------------------------------
// E. RISK-ADJUSTED CEILING (value ceiling with extra risk margin)
// ---------------------------------------------------------------------------
export function riskAdjustedCeiling(input: UnderwritingInput): number {
  const extra = riskPremiumPct(input.risks);
  return valueCeiling(input, extra);
}

// ---------------------------------------------------------------------------
// F. CAPITAL CEILING (cash you can actually deploy)
// ---------------------------------------------------------------------------
export function capitalCeiling(input: UnderwritingInput): number | null {
  const cap = input.capital.maxCapitalAvailable;
  if (cap === undefined || cap === null || !Number.isFinite(cap)) return null;
  const hi = searchUpperBound(input);
  const ok = (p: number) => evaluateBrrrr(p, input).totalCashInvested <= cap + 1e-6;
  return Math.max(0, maxPriceSatisfying(ok, 0, hi));
}

// ---------------------------------------------------------------------------
// Assemble all ceilings & the binding constraint.
// ---------------------------------------------------------------------------
export function computeCeilings(input: UnderwritingInput): BidCeiling[] {
  const value = valueCeiling(input);
  const brrrr = brrrrCeiling(input);
  const cashFlow = cashFlowCeiling(input);
  const roi = roiCeiling(input);
  const riskAdj = riskAdjustedCeiling(input);
  const capital = capitalCeiling(input);

  const ceilings: BidCeiling[] = [
    {
      key: "VALUE",
      label: "Value-Based",
      amount: roundDollars(value),
      applicable: true,
      rationale: `Most you can pay and still retain a ${Math.round(num(input.value.marginOfSafetyPct) * 100)}% margin of safety plus the required equity buffer against conservative ARV.`,
    },
    {
      key: "BRRRR",
      label: "BRRRR",
      amount: roundDollars(brrrr),
      applicable: true,
      rationale: `Keeps trapped capital at or below the target of $${roundDollars(num(input.returns.maxCapitalTrapped)).toLocaleString()} after refinancing.`,
    },
    {
      key: "CASH_FLOW",
      label: "Cash-Flow",
      amount: roundDollars(cashFlow),
      applicable: true,
      rationale: `Debt service stays covered at DSCR >= ${num(input.returns.minDscr)} with at least $${roundDollars(num(input.returns.minMonthlyCashFlow))}/mo cash flow.`,
    },
    {
      key: "ROI",
      label: "ROI",
      amount: roundDollars(roi),
      applicable: true,
      rationale: `Maintains a cash-on-cash return of at least ${Math.round(num(input.returns.minCashOnCash) * 100)}% on trapped capital.`,
    },
    {
      key: "RISK_ADJUSTED",
      label: "Risk-Adjusted",
      amount: roundDollars(riskAdj),
      applicable: true,
      rationale: `Value ceiling widened by an additional risk premium of ${Math.round(riskPremiumPct(input.risks) * 100)}% reflecting identified risks.`,
    },
    {
      key: "CAPITAL",
      label: "Capital Constraint",
      amount: capital === null ? Infinity : roundDollars(capital),
      applicable: capital !== null,
      rationale:
        capital === null
          ? "No capital limit provided."
          : `Total cash deployed stays within the $${roundDollars(num(input.capital.maxCapitalAvailable)).toLocaleString()} capital limit.`,
    },
  ];

  return ceilings;
}

export function bindingCeiling(ceilings: BidCeiling[]): {
  amount: number;
  key: BidCeilingKey;
} {
  const applicable = ceilings.filter((c) => c.applicable && Number.isFinite(c.amount));
  if (applicable.length === 0) return { amount: 0, key: "VALUE" };
  let binding = applicable[0];
  for (const c of applicable) {
    if (c.amount < binding.amount) binding = c;
  }
  return { amount: Math.max(0, binding.amount), key: binding.key };
}
