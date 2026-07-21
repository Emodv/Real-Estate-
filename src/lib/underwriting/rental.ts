import type { RentalInput } from "./types";
import { num, round2, clamp } from "./money";

export type OpexStatus = "KNOWN" | "ESTIMATED" | "ASSUMED" | "UNKNOWN";

export interface OpexLine {
  label: string;
  amount: number;
  /** How the figure was derived, e.g. "8% of EGI" or "fixed". */
  basis: string;
  status: OpexStatus;
}

export interface RentalMath {
  grossAnnualRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  /** Itemized, fully-traceable operating-expense table. Sums to operatingExpenses. */
  opexItems: OpexLine[];
}

/**
 * Net Operating Income (NOI) for the stabilized rental, with a fully itemized,
 * status-tagged operating-expense table.
 *
 *   GPR − vacancy = EGI
 *   EGI − (taxes + insurance + utilities + maintenance + management + capex + other) = NOI
 *
 * NOI is independent of purchase price and financing (property-level, unlevered).
 * Maintenance and CapEx are DISTINCT reserves (no double-count).
 */
export function rentalMath(input: RentalInput): RentalMath {
  const grossAnnualRent = round2(Math.max(num(input.monthlyMarketRent), 0) * 12);
  const vacancyPct = clamp(num(input.vacancyPct), 0, 1);
  const vacancy = round2(grossAnnualRent * vacancyPct);
  const effectiveGrossIncome = round2(grossAnnualRent - vacancy);

  const maintenance = round2(effectiveGrossIncome * Math.max(num(input.maintenancePct), 0));
  const management = round2(effectiveGrossIncome * Math.max(num(input.managementPct), 0));
  const capex = round2(effectiveGrossIncome * Math.max(num(input.capexPct), 0));

  const opexItems: OpexLine[] = [
    { label: "Property taxes", amount: round2(Math.max(num(input.annualPropertyTax), 0)), basis: "fixed", status: "ESTIMATED" },
    { label: "Insurance", amount: round2(Math.max(num(input.annualInsurance), 0)), basis: "fixed", status: "ESTIMATED" },
    { label: "Utilities (owner-paid)", amount: round2(Math.max(num(input.annualUtilities), 0)), basis: "fixed", status: "ASSUMED" },
    { label: "Property management", amount: management, basis: `${Math.round(num(input.managementPct) * 100)}% of EGI`, status: "ASSUMED" },
    { label: "Maintenance / repairs", amount: maintenance, basis: `${Math.round(num(input.maintenancePct) * 100)}% of EGI`, status: "ASSUMED" },
    { label: "CapEx reserve", amount: capex, basis: `${Math.round(num(input.capexPct) * 100)}% of EGI`, status: "ASSUMED" },
    { label: "Other operating expenses", amount: round2(Math.max(num(input.otherAnnualOpEx), 0)), basis: "fixed", status: "ASSUMED" },
  ];

  const operatingExpenses = round2(opexItems.reduce((s, i) => s + i.amount, 0));
  const noi = round2(effectiveGrossIncome - operatingExpenses);
  return { grossAnnualRent, effectiveGrossIncome, operatingExpenses, noi, opexItems };
}
