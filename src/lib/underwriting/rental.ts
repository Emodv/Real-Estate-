import type { RentalInput } from "./types";
import { num, round2, clamp } from "./money";

export interface RentalMath {
  grossAnnualRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
}

/**
 * Net Operating Income (NOI) for the stabilized rental.
 * NOI is independent of purchase price and financing (it is a property-level,
 * unlevered figure) — this is important for how the bid ceilings are derived.
 */
export function rentalMath(input: RentalInput): RentalMath {
  const grossAnnualRent = round2(Math.max(num(input.monthlyMarketRent), 0) * 12);
  const vacancy = clamp(num(input.vacancyPct), 0, 1);
  const effectiveGrossIncome = round2(grossAnnualRent * (1 - vacancy));

  const maintenance = round2(effectiveGrossIncome * Math.max(num(input.maintenancePct), 0));
  const management = round2(effectiveGrossIncome * Math.max(num(input.managementPct), 0));
  const capex = round2(effectiveGrossIncome * Math.max(num(input.capexPct), 0));
  const operatingExpenses = round2(
    Math.max(num(input.annualPropertyTax), 0) +
      Math.max(num(input.annualInsurance), 0) +
      Math.max(num(input.annualUtilities), 0) +
      maintenance +
      management +
      capex +
      Math.max(num(input.otherAnnualOpEx), 0),
  );

  const noi = round2(effectiveGrossIncome - operatingExpenses);
  return { grossAnnualRent, effectiveGrossIncome, operatingExpenses, noi };
}
