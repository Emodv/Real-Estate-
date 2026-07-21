import type {
  BrrrrResult,
  ConfidenceScore,
  DealKillerReport,
  InvestmentScore,
  UnderwritingInput,
} from "./types";
import type { MarketValuation } from "./valuation";
import { num, safeDivide } from "./money";

/**
 * "Deal-killer mode" reasoning. Instead of only asking "why buy?", the system
 * actively assembles the case AGAINST the deal. Every property gets a ranked
 * Top-3 reasons to buy and Top-3 reasons NOT to buy, derived deterministically
 * from the computed figures (no AI, no fabrication).
 */
export interface ReasonsResult {
  toBuy: string[];
  notToBuy: string[];
}

interface Ctx {
  maxSafeBid: number;
  atMaxSafeBid: BrrrrResult;
  score: InvestmentScore;
  risk: DealKillerReport;
  confidence: ConfidenceScore;
  valuation: MarketValuation | null;
}

interface Weighted {
  weight: number;
  text: string;
}

export function computeReasons(input: UnderwritingInput, ctx: Ctx): ReasonsResult {
  const buy: Weighted[] = [];
  const avoid: Weighted[] = [];
  const m = ctx.atMaxSafeBid;
  const asIs = num(input.value.conservativeAsIs);
  const tender = num(input.taxSale.minimumTender);

  // ---- Reasons to buy ----------------------------------------------------
  if (asIs > 0) {
    const disc = safeDivide(asIs - ctx.maxSafeBid, asIs, 0);
    if (disc >= 0.1)
      buy.push({ weight: disc, text: `Max safe bid is ${Math.round(disc * 100)}% below conservative market value ($${Math.round(asIs).toLocaleString()}).` });
  }
  if (m.capitalRecoveryPct >= 0.85)
    buy.push({ weight: m.capitalRecoveryPct, text: `BRRRR recovers ~${Math.round(m.capitalRecoveryPct * 100)}% of invested capital at the max safe bid.` });
  if (m.monthlyCashFlow > 100)
    buy.push({ weight: m.monthlyCashFlow / 1000, text: `Projected positive cash flow of $${Math.round(m.monthlyCashFlow).toLocaleString()}/mo after refinance.` });
  if (m.equityCreatedVsCost > 0)
    buy.push({ weight: m.equityCreatedVsCost / 100000, text: `~$${Math.round(m.equityCreatedVsCost).toLocaleString()} of equity created versus all-in cost.` });
  if (m.dscr >= 1.3)
    buy.push({ weight: m.dscr, text: `Comfortable debt-service coverage (DSCR ${m.dscr.toFixed(2)}×).` });
  if (tender > 0 && ctx.maxSafeBid > tender * 1.25)
    buy.push({ weight: safeDivide(ctx.maxSafeBid - tender, tender, 0), text: `Meaningful headroom between minimum tender ($${Math.round(tender).toLocaleString()}) and max safe bid.` });

  // ---- Reasons NOT to buy (the deal-killer lens) -------------------------
  if (ctx.risk.hasFatal)
    avoid.push({ weight: 100, text: `Fatal deal-killer present: ${ctx.risk.fatal.map((r) => r.label).join("; ")}.` });
  for (const r of ctx.risk.high)
    avoid.push({ weight: 20, text: `High risk: ${r.label} (${r.category}).` });
  if (ctx.risk.hasCriticalUnknown)
    avoid.push({ weight: 18, text: "Critical unknown (title / access / environmental / structural) is unverified." });
  if (m.monthlyCashFlow <= 0)
    avoid.push({ weight: 15, text: `Non-positive cash flow ($${Math.round(m.monthlyCashFlow).toLocaleString()}/mo) at the max safe bid.` });
  if (m.equityCreatedVsCost < 0)
    avoid.push({ weight: 16, text: "All-in cost exceeds conservative ARV — no equity created." });
  if (tender > 0 && ctx.maxSafeBid < tender)
    avoid.push({ weight: 30, text: `Max safe bid ($${Math.round(ctx.maxSafeBid).toLocaleString()}) is below the minimum tender — winning means overpaying.` });
  if (ctx.confidence.overall < 50)
    avoid.push({ weight: 12, text: `Low overall confidence (${ctx.confidence.overall}/100) — figures are provisional.` });
  if (ctx.valuation && ctx.valuation.usedComps < 3)
    avoid.push({ weight: 10, text: `Valuation rests on only ${ctx.valuation.usedComps} usable comparable(s).` });
  if (input.renovation.confidence < 50)
    avoid.push({ weight: 9, text: "Renovation scope is uncertain — condition largely unverified." });
  if (input.meta.rural)
    avoid.push({ weight: 6, text: "Rural market — thinner resale/refinance liquidity." });

  const top3 = (arr: Weighted[]) =>
    arr.sort((a, b) => b.weight - a.weight).slice(0, 3).map((x) => x.text);

  return { toBuy: top3(buy), notToBuy: top3(avoid) };
}
