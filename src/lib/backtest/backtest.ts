import type { UnderwritingInput, UnderwritingResult, Verdict } from "@/lib/underwriting";
import { underwrite, evaluateBrrrr } from "@/lib/underwriting";
import { num, safeDivide, round2 } from "@/lib/underwriting";

/** Decision-quality label once actuals are known (the Phase 3 core metric). */
export type DecisionClass =
  | "CORRECT_BUY"
  | "FALSE_BUY"
  | "CORRECT_PASS"
  | "FALSE_PASS"
  | "INCONCLUSIVE";

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
  /** Post-mortem decision quality using actuals (never affects the prediction). */
  decision: DecisionClass;
  decisionRationale: string;
  /** Where the actual winning bid landed relative to our bid ladder. */
  bidClass: BidClass;
}

/** Actual winning bid vs. our bid ladder. "Could have won" ≠ "should have bought". */
export type BidClass =
  | "BOUGHT_WITHIN_SAFE" // winning <= target
  | "ABOVE_TARGET_BELOW_MAX" // target < winning <= max safe
  | "OVERBID"; // winning > max safe (we would have lost the auction at a safe price)

export interface BacktestOutcome {
  prediction: BacktestPrediction;
  comparison: BacktestComparison;
}

function errPct(predicted: number, actual?: number): number | null {
  if (actual === undefined || !Number.isFinite(actual) || actual === 0) return null;
  return round2(safeDivide(predicted - actual, actual, 0) * 100) / 100;
}

/**
 * Post-mortem: rebuild the deal with ACTUAL renovation / rent / value and
 * evaluate it at the price we would realistically have transacted at, to judge
 * whether our BUY/PASS call was correct. This uses actuals ONLY for scoring —
 * it is never part of `underwrite()` and cannot change the frozen prediction.
 *
 * The most important label is FALSE_BUY (we said buy, reality was bad).
 */
function classifyDecision(
  preSaleInput: UnderwritingInput,
  prediction: BacktestPrediction,
  actuals: BacktestActuals,
  couldWin: boolean,
): { decision: DecisionClass; rationale: string } {
  const predictedBuy = BUY_VERDICTS.includes(prediction.predictedVerdict);

  const actualValue = actuals.actualArv ?? actuals.actualSalePriceLater;
  const actualRent = actuals.actualMonthlyRent;
  const hasValue = actualValue !== undefined && Number.isFinite(actualValue) && actualValue > 0;
  const hasIncome = actualRent !== undefined && Number.isFinite(actualRent) && actualRent > 0;
  if (!hasValue && !hasIncome) {
    return { decision: "INCONCLUSIVE", rationale: "Not enough post-sale actuals (value and/or rent) to judge the decision." };
  }

  // Build the "reality" input from the pre-sale input, overriding with actuals.
  const reality: UnderwritingInput = {
    ...preSaleInput,
    renovation:
      actuals.actualRenovation !== undefined
        ? { ...preSaleInput.renovation, cosmetic: num(actuals.actualRenovation), major: 0, structural: 0, contingencyPct: 0 }
        : preSaleInput.renovation,
    rental: hasIncome ? { ...preSaleInput.rental, monthlyMarketRent: num(actualRent) } : preSaleInput.rental,
    refinance: hasValue ? { ...preSaleInput.refinance, arv: num(actualValue) } : preSaleInput.refinance,
    value: hasValue ? { ...preSaleInput.value, conservativeArv: num(actualValue) } : preSaleInput.value,
  };

  // Price we would realistically have paid if we participated and won.
  const winning = num(actuals.actualWinningBid);
  const entryPrice =
    winning > 0 ? Math.min(winning, prediction.predictedMaxSafeBid) : prediction.predictedTargetBid;
  const m = evaluateBrrrr(entryPrice, reality);

  const equityOk = m.equityCreatedVsCost > 0;
  const cashFlowOk = m.monthlyCashFlow >= 0;
  const realityGood = equityOk && cashFlowOk;

  if (predictedBuy && realityGood)
    return { decision: "CORRECT_BUY", rationale: `Reality (actual value/rent) still yields equity ($${Math.round(m.equityCreatedVsCost).toLocaleString()}) and non-negative cash flow at our entry.` };
  if (predictedBuy && !realityGood)
    return { decision: "FALSE_BUY", rationale: `We recommended BUY but reality fails: equity ${Math.round(m.equityCreatedVsCost).toLocaleString()}, cash flow $${Math.round(m.monthlyCashFlow)}/mo at our entry.` };
  if (!predictedBuy && realityGood && couldWin)
    return { decision: "FALSE_PASS", rationale: "We passed, but reality would have been a sound, winnable deal (missed opportunity)." };
  return { decision: "CORRECT_PASS", rationale: "We passed and reality confirms the economics did not work (or it was unwinnable at a safe price)." };
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
  const { decision, rationale } = classifyDecision(preSaleInput, prediction, actuals, couldWeHaveWon);
  const bidClass: BidClass =
    winning > prediction.predictedMaxSafeBid
      ? "OVERBID"
      : winning <= prediction.predictedTargetBid
        ? "BOUGHT_WITHIN_SAFE"
        : "ABOVE_TARGET_BELOW_MAX";

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
    decision,
    decisionRationale: rationale,
    bidClass,
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
  medianValuationErrorPct: number | null;
  medianAbsValuationErrorPct: number | null;
  avgArvErrorPct: number | null;
  avgRenovationErrorPct: number | null;
  medianRenovationErrorPct: number | null;
  medianAbsRenovationErrorPct: number | null;
  avgRentErrorPct: number | null;
  medianRentErrorPct: number | null;
  medianAbsRentErrorPct: number | null;
  // Bid-gap classification (could-have-won ≠ should-have-bought).
  boughtWithinSafe: number;
  aboveTargetBelowMax: number;
  overbid: number;
  avgPredictedDiscountToWinningBid: number;
  totalCapitalIfBidAtMaxSafe: number;
  // Decision quality (the metrics we care about most; false BUY first).
  correctBuy: number;
  falseBuy: number;
  correctPass: number;
  falsePass: number;
  inconclusive: number;
  /** false BUYs / (correct BUY + false BUY). null when no conclusive BUYs. */
  falseBuyRate: number | null;
  /** Systematic-bias flags derived from median errors (not overfit). */
  patternFlags: string[];
}

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return null;
  return round2(valid.reduce((s, n) => s + n, 0) / valid.length);
}

function median(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 ? round2(valid[mid]) : round2((valid[mid - 1] + valid[mid]) / 2);
}

export function scoreBacktests(items: BacktestScoreItem[]): BacktestScorecard {
  const outs = items.map((i) => i.outcome);
  const countV = (v: Verdict) => outs.filter((o) => o.prediction.predictedVerdict === v).length;
  const countD = (d: string) => outs.filter((o) => o.comparison.decision === d).length;

  const valErr = outs.map((o) => o.comparison.valuationErrorPct).filter((x): x is number => x !== null);
  const renoErr = outs.map((o) => o.comparison.renovationErrorPct).filter((x): x is number => x !== null);
  const rentErr = outs.map((o) => o.comparison.rentErrorPct).filter((x): x is number => x !== null);
  const arvErr = outs.map((o) => o.comparison.arvErrorPct).filter((x): x is number => x !== null);

  const correctBuy = countD("CORRECT_BUY");
  const falseBuy = countD("FALSE_BUY");
  const conclusiveBuys = correctBuy + falseBuy;

  // Systematic-bias flags (only when a median is meaningfully non-zero).
  const patternFlags: string[] = [];
  const mVal = median(valErr);
  const mReno = median(renoErr);
  const mRent = median(rentErr);
  if (mVal !== null && mVal > 8) patternFlags.push(`Market value runs ~${mVal}% HIGH vs later value — tighten valuation.`);
  if (mVal !== null && mVal < -8) patternFlags.push(`Market value runs ~${Math.abs(mVal)}% LOW vs later value.`);
  if (mReno !== null && mReno < -10) patternFlags.push(`Renovation is under-estimated by ~${Math.abs(mReno)}% — raise reno assumptions.`);
  if (mRent !== null && mRent > 10) patternFlags.push(`Rent runs ~${mRent}% HIGH vs achieved — trim rent assumptions.`);

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
    avgValuationErrorPct: avg(valErr),
    medianValuationErrorPct: mVal,
    medianAbsValuationErrorPct: median(valErr.map(Math.abs)),
    avgArvErrorPct: avg(arvErr),
    avgRenovationErrorPct: avg(renoErr),
    medianRenovationErrorPct: mReno,
    medianAbsRenovationErrorPct: median(renoErr.map(Math.abs)),
    avgRentErrorPct: avg(rentErr),
    medianRentErrorPct: mRent,
    medianAbsRentErrorPct: median(rentErr.map(Math.abs)),
    boughtWithinSafe: outs.filter((o) => o.comparison.bidClass === "BOUGHT_WITHIN_SAFE").length,
    aboveTargetBelowMax: outs.filter((o) => o.comparison.bidClass === "ABOVE_TARGET_BELOW_MAX").length,
    overbid: outs.filter((o) => o.comparison.bidClass === "OVERBID").length,
    avgPredictedDiscountToWinningBid: avg(outs.map((o) => o.comparison.predictedDiscountToWinningBid)) ?? 0,
    totalCapitalIfBidAtMaxSafe: round2(
      outs.filter((o) => o.comparison.wouldWeHaveWonIt).reduce((s, o) => s + o.comparison.actualWinningBid, 0),
    ),
    correctBuy,
    falseBuy,
    correctPass: countD("CORRECT_PASS"),
    falsePass: countD("FALSE_PASS"),
    inconclusive: countD("INCONCLUSIVE"),
    falseBuyRate: conclusiveBuys > 0 ? round2(falseBuy / conclusiveBuys) : null,
    patternFlags,
  };
}
