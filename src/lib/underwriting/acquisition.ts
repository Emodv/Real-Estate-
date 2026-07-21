import type { AcquisitionInput } from "./types";
import { num, round2 } from "./money";

/**
 * Ontario provincial Land Transfer Tax (marginal brackets, 2024 schedule).
 *   0.5%  on the first $55,000
 *   1.0%  on $55,000  - $250,000
 *   1.5%  on $250,000 - $400,000
 *   2.0%  on $400,000 - $2,000,000
 *   2.5%  on the amount over $2,000,000
 *
 * Toronto Municipal LTT (MLTT) mirrors the provincial schedule and is only
 * added when `includeTorontoMLTT` is set (never for rural tax-sale property).
 */
export function ontarioLandTransferTax(price: number): number {
  const p = Math.max(num(price), 0);
  const brackets: Array<{ upTo: number; rate: number }> = [
    { upTo: 55000, rate: 0.005 },
    { upTo: 250000, rate: 0.01 },
    { upTo: 400000, rate: 0.015 },
    { upTo: 2000000, rate: 0.02 },
    { upTo: Infinity, rate: 0.025 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (p <= prev) break;
    const taxableInBracket = Math.min(p, b.upTo) - prev;
    tax += taxableInBracket * b.rate;
    prev = b.upTo;
  }
  return round2(tax);
}

export function landTransferTax(price: number, input: AcquisitionInput): number {
  switch (input.landTransferTaxMode) {
    case "percent":
      return round2(Math.max(num(price), 0) * num(input.landTransferTaxPct));
    case "flat":
      return round2(num(input.landTransferTaxFlat));
    case "ontario":
    default: {
      const provincial = ontarioLandTransferTax(price);
      const mltt = input.includeTorontoMLTT ? ontarioLandTransferTax(price) : 0;
      return round2(provincial + mltt);
    }
  }
}

/** Total one-time acquisition/closing costs at a given purchase price. */
export function acquisitionCosts(price: number, input: AcquisitionInput): number {
  const ltt = landTransferTax(price, input);
  return round2(
    ltt + num(input.legalFees) + num(input.titleInsurance) + num(input.otherClosingCosts),
  );
}
