import type { UnderwritingInput, UnderwritingResult, Verdict } from "./types";
import { clamp, num, safeDivide } from "./money";

/**
 * Opportunity ranking — a TRANSPARENT, multi-factor score (0–100) with visible
 * sub-scores. The weights are MODEL ASSUMPTIONS (documented, configurable), not
 * universal truths.
 *
 * Hard rule: ranking NEVER overrides a fatal deal-killer. A 95-point property
 * with a fatal title/access issue still sorts to the bottom and reads PASS.
 */
export interface RankingWeights {
  value: number; // /20
  brrrr: number; // /20
  cashFlow: number; // /15
  risk: number; // /20
  dataConfidence: number; // /10
  rentalMarket: number; // /10
  liquidity: number; // /5
}

/** Documented default weights (sum = 100). */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  value: 20,
  brrrr: 20,
  cashFlow: 15,
  risk: 20,
  dataConfidence: 10,
  rentalMarket: 10,
  liquidity: 5,
};

export interface RankSubscores {
  value: number;
  brrrr: number;
  cashFlow: number;
  risk: number;
  dataConfidence: number;
  rentalMarket: number;
  liquidity: number;
}

export interface RankInput {
  id: string;
  name: string;
  municipality?: string;
  input: UnderwritingInput;
  result: UnderwritingResult;
}

export interface RankedProperty {
  id: string;
  name: string;
  municipality?: string;
  taxSaleDate?: string;
  minimumTender: number;
  conservativeMarketValue: number;
  opportunisticBid: number;
  targetBid: number;
  maxSafeBid: number;
  walkAwayBid: number;
  expectedRent: number;
  monthlyCashFlow: number;
  brrrrCapitalLeft: number;
  riskScore: number;
  confidence: number;
  verdict: Verdict;
  hasFatal: boolean;
  subscores: RankSubscores;
  total: number;
  recommendedAction: string;
  rankReasons: string[];
  mainRisks: string[];
  nextActions: string[];
}

function subscores(r: RankInput, w: RankingWeights): RankSubscores {
  const { input, result } = r;
  const m = result.bid.atMaxSafeBid;
  const marketValue = result.valuation ? result.valuation.base : num(input.value.conservativeAsIs);

  const discount = clamp(safeDivide(marketValue - result.bid.maximumSafeBid, marketValue, 0), 0, 1);
  const value = round(discount * w.value);
  const brrrr = round(clamp(m.capitalRecoveryPct, 0, 1) * w.brrrr);
  const cashFlow = round(clamp(m.monthlyCashFlow / 400, 0, 1) * w.cashFlow);
  const risk = round((1 - result.dealKillers.riskScore / 100) * w.risk);
  const dataConfidence = round((result.confidence.overall / 100) * w.dataConfidence);

  let rentalMarket = clamp((m.dscr - 1) / 0.5, 0, 1) * w.rentalMarket;
  if (input.meta.rural) rentalMarket -= 2;
  rentalMarket = round(clamp(rentalMarket, 0, w.rentalMarket));

  let liquidity = w.liquidity;
  if (input.meta.rural) liquidity -= 2;
  if (input.meta.waterfront) liquidity += 1;
  if ((input.meta.propertyType ?? "").toLowerCase().includes("land")) liquidity -= 1;
  liquidity = round(clamp(liquidity, 0, w.liquidity));

  return { value, brrrr, cashFlow, risk, dataConfidence, rentalMarket, liquidity };
}

function round(n: number): number {
  return Math.round(n);
}

function recommendedAction(verdict: Verdict, total: number, hasFatal: boolean): string {
  if (hasFatal || verdict === "STRONG_PASS" || verdict === "PASS") return "PASS";
  if (verdict === "WATCH" || verdict === "CONDITIONAL_BUY") return "WATCH / VERIFY";
  if ((verdict === "STRONG_BUY" || verdict === "BUY") && total >= 75) return "INVESTIGATE IMMEDIATELY";
  return "REVIEW";
}

function nextActions(r: RankInput): string[] {
  const actions: string[] = [];
  const cats = new Set(
    r.input.risks
      .filter((x) => x.severity === "UNKNOWN" || x.dataStatus === "UNKNOWN" || x.fatalIfConfirmed)
      .map((x) => x.category),
  );
  if (cats.has("TITLE")) actions.push("Order a title / sub-search");
  if (cats.has("ACCESS")) actions.push("Verify registered legal access");
  if (cats.has("ZONING")) actions.push("Confirm zoning & permitted use");
  if (cats.has("UTILITIES") || r.input.meta.rural) actions.push("Confirm septic & well condition");
  if (cats.has("ENVIRONMENTAL") || cats.has("FLOOD")) actions.push("Check environmental / flood mapping");
  actions.push("Drive-by / inspect where access permits");
  if (num(r.input.renovation.cosmetic) + num(r.input.renovation.major) + num(r.input.renovation.structural) === 0) {
    actions.push("Obtain a contractor renovation estimate");
  }
  actions.push("Confirm insurance availability");
  // De-duplicate, keep order, cap at 6.
  return Array.from(new Set(actions)).slice(0, 6);
}

export function rankProperties(items: RankInput[], weights: RankingWeights = DEFAULT_RANKING_WEIGHTS): RankedProperty[] {
  const ranked = items.map((r) => {
    const s = subscores(r, weights);
    const total = clamp(
      s.value + s.brrrr + s.cashFlow + s.risk + s.dataConfidence + s.rentalMarket + s.liquidity,
      0,
      100,
    );
    const hasFatal = r.result.dealKillers.hasFatal;
    const m = r.result.bid.atMaxSafeBid;
    return {
      id: r.id,
      name: r.name,
      municipality: r.municipality,
      taxSaleDate: r.input.taxSale.saleDate,
      minimumTender: num(r.input.taxSale.minimumTender),
      conservativeMarketValue: r.result.valuation ? r.result.valuation.base : num(r.input.value.conservativeAsIs),
      opportunisticBid: r.result.bid.opportunisticBid,
      targetBid: r.result.bid.targetBid,
      maxSafeBid: r.result.bid.maximumSafeBid,
      walkAwayBid: r.result.bid.walkAwayBid,
      expectedRent: num(r.input.rental.monthlyMarketRent),
      monthlyCashFlow: m.monthlyCashFlow,
      brrrrCapitalLeft: m.capitalTrapped,
      riskScore: r.result.dealKillers.riskScore,
      confidence: r.result.confidence.overall,
      verdict: r.result.verdict,
      hasFatal,
      subscores: s,
      total,
      recommendedAction: recommendedAction(r.result.verdict, total, hasFatal),
      rankReasons: r.result.reasons.toBuy,
      mainRisks: [...r.result.dealKillers.high, ...r.result.dealKillers.unknowns].slice(0, 4).map((x) => x.label),
      nextActions: nextActions(r),
    } satisfies RankedProperty;
  });

  // Fatal deal-killers ALWAYS sort last, regardless of score.
  return ranked.sort((a, b) => {
    if (a.hasFatal !== b.hasFatal) return a.hasFatal ? 1 : -1;
    return b.total - a.total;
  });
}
