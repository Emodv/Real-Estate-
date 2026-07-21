import type { BrrrrResult, DealKillerReport, InvestmentScore, UnderwritingInput } from "./types";
import { clamp, num, safeDivide } from "./money";

/**
 * Transparent 0-100 investment score with visible sub-scores. The score is a
 * SIGNAL, not the verdict — a fatal deal-killer forces STRONG PASS regardless
 * of score (see verdict.ts).
 */
export function computeScore(
  input: UnderwritingInput,
  atMaxSafeBid: BrrrrResult,
  maxSafeBid: number,
  risk: DealKillerReport,
): InvestmentScore {
  // VALUE /20 — discount of max safe bid vs conservative as-is value.
  const asIs = num(input.value.conservativeAsIs);
  const discount = clamp(safeDivide(asIs - maxSafeBid, asIs, 0), 0, 1);
  const value = clamp(Math.round(discount * 40), 0, 20);

  // BRRRR /20 — capital recovery percentage at the max safe bid.
  const brrrr = clamp(Math.round(atMaxSafeBid.capitalRecoveryPct * 20), 0, 20);

  // CASH FLOW /15 — monthly cash flow, scaled ($400/mo -> full marks).
  const cf = clamp(Math.round((atMaxSafeBid.monthlyCashFlow / 400) * 15), 0, 15);

  // MARKET /15 — headroom of max safe bid over minimum tender.
  const tender = Math.max(num(input.taxSale.minimumTender), 1);
  const headroom = clamp(safeDivide(maxSafeBid - tender, tender, 0), 0, 1);
  const market = clamp(Math.round(headroom * 30), 0, 15);

  // RISK /15 — inverse of risk score.
  const riskScore = clamp(Math.round((1 - risk.riskScore / 100) * 15), 0, 15);

  // RENTAL /10 — DSCR based coverage (1.5x -> full marks).
  const rental = clamp(Math.round(((atMaxSafeBid.dscr - 1) / 0.5) * 10), 0, 10);

  // LIQUIDITY /5 — rural / waterfront niche properties are less liquid.
  let liquidity = 5;
  if (input.meta.rural) liquidity -= 2;
  if (input.meta.waterfront) liquidity += 1; // waterfront has its own demand
  if ((input.meta.propertyType ?? "").toLowerCase().includes("land")) liquidity -= 1;
  liquidity = clamp(liquidity, 0, 5);

  const total = clamp(value + brrrr + cf + market + riskScore + rental + liquidity, 0, 100);

  return { total, value, brrrr, cashFlow: cf, market, risk: riskScore, rental, liquidity };
}
