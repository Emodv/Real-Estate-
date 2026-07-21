import type { UnderwritingInput } from "./types";
import { evaluateBrrrr } from "./brrrr";
import { clamp, num } from "./money";

/**
 * Refinance scenarios at multiple LTVs (65 / 70 / 75 / 80% by default).
 * Reuses the tested BRRRR core by re-evaluating with each LTV — the numbers are
 * identical to the main engine, just parameterized by refinance LTV.
 */
export interface RefinanceScenario {
  ltv: number;
  refinanceAmount: number;
  refinanceCosts: number;
  capitalRecovered: number;
  capitalTrapped: number;
  newMonthlyMortgage: number;
  annualDebtService: number;
  monthlyCashFlow: number;
  dscr: number;
  capRate: number;
  cashOnCash: number | null;
  equityCreatedVsCost: number;
}

export const DEFAULT_LTVS = [0.65, 0.7, 0.75, 0.8];

export function refinanceScenarios(
  input: UnderwritingInput,
  price: number,
  ltvs: number[] = DEFAULT_LTVS,
): RefinanceScenario[] {
  return ltvs.map((rawLtv) => {
    const ltv = clamp(num(rawLtv), 0, 1);
    const m = evaluateBrrrr(price, {
      ...input,
      refinance: { ...input.refinance, refinanceLtv: ltv },
    });
    return {
      ltv,
      refinanceAmount: m.refinanceAmount,
      refinanceCosts: m.refinanceCosts,
      capitalRecovered: m.capitalRecovered,
      capitalTrapped: m.capitalTrapped,
      newMonthlyMortgage: m.newMonthlyMortgage,
      annualDebtService: m.annualDebtService,
      monthlyCashFlow: m.monthlyCashFlow,
      dscr: m.dscr,
      capRate: m.capRate,
      cashOnCash: m.cashOnCash,
      equityCreatedVsCost: m.equityCreatedVsCost,
    };
  });
}
