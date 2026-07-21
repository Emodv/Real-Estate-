import type { UnderwritingInput, UnderwritingResult, Verdict } from "@/lib/underwriting";
import { underwrite } from "@/lib/underwriting";
import { num, safeDivide, round2 } from "@/lib/underwriting";

/**
 * Historical backtesting engine (pure).
 *
 * HINDSIGHT GUARD: `runBacktest` underwrites ONLY the pre-sale input. The
 * actuals (winning bid, sale price, later value) are used solely for scoring
 * the prediction afterward — they never enter `underwrite()`. A dedicated test
 * asserts that changing the actuals does not change the prediction.
 *
 * Guiding principle: a FALSE POSITIVE (system says BUY on a bad deal) is worse
 * than a FALSE NEGATIVE (system says PASS on a good deal). The scorecard makes
 * both visible, but the model is deliberately conservative.
 */

/** Facts only knowable AFTER the sale — never fed to the model. */
export interface BacktestActuals {
  actualWinningBid: number;
  /** Later resale / appraised value if known (post-sale). Optional. */
  actualSalePriceLater?: number;
  actualArv?: number;
  actualRenovation?: number;
  actualMonthlyRent?: number;
  notes?: string;
}

const BUY_VERDICTS: Verdict[] = ["STRONG_BUY", "BUY", "CONDITIONAL_BUY"];

export interface BacktestPrediction {
  predictedMarketValue: number;
  predictedArv: number;
  predictedRenovation: number;
  predictedMonthlyRent: number;
  predictedConservativeBid: number;
  predictedTargetBid: number;
  predictedMaxSafeBid: number;
  predictedWalkAwayBid: number;
  predictedVerdict: Verdict;
  predictedScore: number;
  predictedConfidence: number;
}

export interface BacktestComparison {
  minimumTender: number;
  actualWinningBid: number;
  /** Verdict said buy AND the reserve is within our max safe bid. */
  wouldWeBid: boolean;
  /** Our max safe bid was at/above the actual winning price (we could have won). */
  couldWeHaveWon: boolean;
  /** We would have bid AND could have won it at/under our max safe bid. */
  wouldWeHaveWonIt: boolean;
  /** Winning bid minus our max safe bid (positive = auction cleared above us). */
  bidGapVsMaxSafe: number;
  /** True if actual winning bid <= our target bid (great entry). */
  wonBelowTarget: boolean;
  /** How far our predicted market value sat above the winning bid, as %. */
  predictedDiscountToWinningBid: number;
  /** Valuation error vs. a later known value, if provided (else null). */
  valuationErrorPct: number | null;
  arvErrorPct: number | null;
  renovationErrorPct: number | null;
  rentErrorPct: number | null;
}

export interface BacktestOutcome {
  prediction: BacktestPrediction;
  comparison: BacktestComparison;
}

function errPct(predicted: number, actual?: number): number | null {
  if (actual === undefined || !Number.isFinite(actual) || actual === 0) return null;
  return round2(safeDivide(predicted - actual, actual, 0) * 100) / 100;
}

export function runBacktest(preSaleInput: UnderwritingInput, actuals: BacktestActuals): BacktestOutcome {
  // ---- PREDICTION: pre-sale info only. Actuals are NOT passed in. ----
  const result: UnderwritingResult = underwrite(preSaleInput);
  const m = result.bid.atMaxSafeBid;

  const prediction: BacktestPrediction = {
    predictedMarketValue: result.valuation ? result.valuation.base : num(preSaleInput.value.conservativeAsIs),
    predictedArv: num(preSaleInput.refinance.arv),
    predictedRenovation: result.renovationModel.baseWithContingency,
    predictedMonthlyRent: num(preSaleInput.rental.monthlyMarketRent),
    predictedConservativeBid: result.bid.conservativeBid,
    predictedTargetBid: result.bid.targetBid,
    predictedMaxSafeBid: result.bid.maximumSafeBid,
    predictedWalkAwayBid: result.sensitivity.walkAwayBid,
    predictedVerdict: result.verdict,
    predictedScore: result.score.total,
    predictedConfidence: result.confidence.overall,
  };

  // ---- COMPARISON: now (and only now) use the actuals. ----
  const tender = num(preSaleInput.taxSale.minimumTender);
  const winning = num(actuals.actualWinningBid);
  const wouldWeBid = BUY_VERDICTS.includes(result.verdict) && prediction.predictedMaxSafeBid >= tender && tender > 0;
  const couldWeHaveWon = prediction.predictedMaxSafeBid >= winning && winning > 0;

  const comparison: BacktestComparison = {
    minimumTender: tender,
    actualWinningBid: winning,
    wouldWeBid,
    couldWeHaveWon,
    wouldWeHaveWonIt: wouldWeBid && couldWeHaveWon,
    bidGapVsMaxSafe: round2(winning - prediction.predictedMaxSafeBid),
    wonBelowTarget: winning > 0 && winning <= prediction.predictedTargetBid,
    predictedDiscountToWinningBid:
      winning > 0 ? round2(safeDivide(prediction.predictedMarketValue - winning, prediction.predictedMarketValue, 0) * 100) / 100 : 0,
    valuationErrorPct: errPct(prediction.predictedMarketValue, actuals.actualSalePriceLater),
    arvErrorPct: errPct(prediction.predictedArv, actuals.actualArv),
    renovationErrorPct: errPct(prediction.predictedRenovation, actuals.actualRenovation),
    rentErrorPct: errPct(prediction.predictedMonthlyRent, actuals.actualMonthlyRent),
  };

  return { prediction, comparison };
}

// ---- Scorecard aggregation ------------------------------------------------

export interface BacktestScoreItem {
  outcome: BacktestOutcome;
}

export interface BacktestScorecard {
  total: number;
  strongBuy: number;
  buy: number;
  watch: number;
  pass: number;
  strongPass: number;
  wouldHaveBid: number;
  boughtBelowTarget: number;
  boughtBelowMaxSafe: number;
  /** Predicted BUY where auction cleared above our max safe bid (we'd have been outbid — a MISS, not a loss). */
  outbidOnWanted: number;
  avgValuationErrorPct: number | null;
  avgArvErrorPct: number | null;
  avgRenovationErrorPct: number | null;
  avgRentErrorPct: number | null;
  avgPredictedDiscountToWinningBid: number;
  totalCapitalIfBidAtMaxSafe: number;
}

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return null;
  return round2(valid.reduce((s, n) => s + n, 0) / valid.length);
}

export function scoreBacktests(items: BacktestScoreItem[]): BacktestScorecard {
  const outs = items.map((i) => i.outcome);
  const countV = (v: Verdict) => outs.filter((o) => o.prediction.predictedVerdict === v).length;

  return {
    total: outs.length,
    strongBuy: countV("STRONG_BUY"),
    buy: countV("BUY") + countV("CONDITIONAL_BUY"),
    watch: countV("WATCH"),
    pass: countV("PASS"),
    strongPass: countV("STRONG_PASS"),
    wouldHaveBid: outs.filter((o) => o.comparison.wouldWeBid).length,
    boughtBelowTarget: outs.filter((o) => o.comparison.wonBelowTarget).length,
    boughtBelowMaxSafe: outs.filter((o) => o.comparison.couldWeHaveWon).length,
    outbidOnWanted: outs.filter((o) => o.comparison.wouldWeBid && !o.comparison.couldWeHaveWon).length,
    avgValuationErrorPct: avg(outs.map((o) => o.comparison.valuationErrorPct).filter((x): x is number => x !== null)),
    avgArvErrorPct: avg(outs.map((o) => o.comparison.arvErrorPct).filter((x): x is number => x !== null)),
    avgRenovationErrorPct: avg(outs.map((o) => o.comparison.renovationErrorPct).filter((x): x is number => x !== null)),
    avgRentErrorPct: avg(outs.map((o) => o.comparison.rentErrorPct).filter((x): x is number => x !== null)),
    avgPredictedDiscountToWinningBid: avg(outs.map((o) => o.comparison.predictedDiscountToWinningBid)) ?? 0,
    totalCapitalIfBidAtMaxSafe: round2(
      outs.filter((o) => o.comparison.wouldWeHaveWonIt).reduce((s, o) => s + o.comparison.actualWinningBid, 0),
    ),
  };
}
