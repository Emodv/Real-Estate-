import type { BidStrategy, UnderwritingInput, UnderwritingResult } from "./types";
import { clamp, num, roundDollars } from "./money";
import { evaluateBrrrr } from "./brrrr";
import {
  computeCeilings,
  bindingCeiling,
  valueCeiling,
  valueCeilingMath,
  maxPriceSatisfying,
} from "./ceilings";
import { dealKillerReport } from "./risk";
import { computeConfidence } from "./confidence";
import { computeScore } from "./score";
import { computeSwot } from "./swot";
import { computeVerdict, buildCommittee } from "./verdict";
import { withDerivedDistances } from "@/lib/geo/distance";
import { scoreComps, DEFAULT_COMP_WEIGHTS, type ScoredComp } from "./comps";
import { deriveMarketValue, type MarketValuation } from "./valuation";
import { buildRenovationModel } from "./renovationModel";
import { renovationRaw } from "./renovation";
import { refinanceScenarios } from "./refinanceScenarios";
import { sensitivity } from "./sensitivity";
import { computeReasons } from "./reasons";

/**
 * Comps → valuation pre-step. Scores comparables and, when the user has NOT
 * supplied explicit market values (fields left at 0), seeds the conservative
 * as-is / base / ARV values from the comp-derived valuation. Explicit
 * user-entered values always take precedence — comps never silently override
 * a figure the analyst set deliberately.
 */
function applyValuation(input: UnderwritingInput): {
  input: UnderwritingInput;
  scoredComps: ScoredComp[];
  valuation: MarketValuation | null;
} {
  const comps = input.comps ?? [];
  if (comps.length === 0) return { input, scoredComps: [], valuation: null };

  const scoredComps = scoreComps(
    {
      propertyType: input.meta.propertyType,
      buildingSqft: undefined,
      lotAcres: input.meta.lotSizeAcres,
      bedrooms: input.meta.bedrooms,
      bathrooms: input.meta.bathrooms,
      lat: input.meta.lat,
      lng: input.meta.lng,
    },
    comps,
    input.compWeights ?? DEFAULT_COMP_WEIGHTS,
  );
  const valuation = deriveMarketValue(
    { lotAcres: input.meta.lotSizeAcres, bedrooms: input.meta.bedrooms, bathrooms: input.meta.bathrooms, propertyType: input.meta.propertyType },
    scoredComps,
    { assessment: input.value.assessment },
  );
  if (!valuation) return { input, scoredComps, valuation: null };

  const value = { ...input.value };
  if (num(value.conservativeAsIs) <= 0) value.conservativeAsIs = valuation.low;
  if (num(value.baseValue) <= 0) value.baseValue = valuation.base;
  // Conservative default: ARV = comp-derived base (renovation brings the
  // property TO market, not above it) unless the analyst set ARV explicitly.
  if (num(value.conservativeArv) <= 0) value.conservativeArv = valuation.base;

  const refinance =
    num(input.refinance.arv) <= 0 ? { ...input.refinance, arv: valuation.base } : input.refinance;

  return { input: { ...input, value, refinance }, scoredComps, valuation };
}

/**
 * The single public entry point for underwriting.
 *
 * Pure and deterministic: `underwrite(input)` always returns the same result
 * for the same input. No AI, no network, no clock-dependence except confidence
 * recency (which is derived from evidence dates and is itself deterministic
 * given "now").
 */
export function underwrite(rawInput: UnderwritingInput): UnderwritingResult {
  const warnings: string[] = [];
  // Pure enrichment: derive comparable distances from geocoded coordinates
  // when available. No network — coordinates in, distances out.
  const distanced = withDerivedDistances(rawInput);
  // Comps -> valuation, seeding blank value inputs (see applyValuation).
  const { input, scoredComps, valuation } = applyValuation(distanced);

  // 1) Bid ceilings & the binding constraint -> maximum safe bid.
  const ceilings = computeCeilings(input);
  const { amount: maxSafeBid, key: bindingConstraint } = bindingCeiling(ceilings);

  // 2) Graduated bid levels.
  const conservativeFactor = clamp(num(input.bidShape.conservativeBidFactor, 0.85), 0.1, 1);
  const targetFactor = clamp(num(input.bidShape.targetBidFactor, 0.93), 0.1, 1);
  const conservativeBid = roundDollars(maxSafeBid * conservativeFactor);
  const targetBid = roundDollars(maxSafeBid * targetFactor);
  const hardStop = roundDollars(maxSafeBid); // do-not-cross line

  // Opportunistic (steal) bid: the price at which capital is FULLY recovered on
  // refinance (capitalTrapped <= 0). Clamped to be no higher than the
  // conservative bid — an opportunistic price is a discount, never a stretch.
  const fullRecoveryPrice = maxPriceSatisfying(
    (p) => evaluateBrrrr(p, input).capitalTrapped <= 0,
    0,
    Math.max(maxSafeBid, 1),
  );
  const opportunisticBid = roundDollars(Math.min(fullRecoveryPrice, conservativeBid));

  // 3) BRRRR snapshots.
  const atMaxSafeBid = evaluateBrrrr(maxSafeBid, input);
  const atMinimumTender = evaluateBrrrr(num(input.taxSale.minimumTender), input);

  // 4) Risk / deal-killers.
  const dealKillers = dealKillerReport(input.risks);

  // F3: renovation effectively unknown ($0 with unverified condition).
  const renovationUnknown =
    renovationRaw(input.renovation) <= 0 && num(input.renovation.confidence) < 70;
  if (renovationUnknown) {
    warnings.push(
      "Renovation is $0 with unverified condition. UNKNOWN is not $0 — the maximum safe bid is unreliable until a renovation estimate is obtained. Confidence has been capped.",
    );
  }

  // 5) Confidence (F2: comp/dispersion-aware), score, SWOT.
  const confidence = computeConfidence(input, { valuation, scoredComps, renovationUnknown });
  const score = computeScore(input, atMaxSafeBid, maxSafeBid, dealKillers);
  const swot = computeSwot(input, atMaxSafeBid);

  // 6) Verdict (gated) + investment committee.
  const { verdict, warnings: verdictWarnings } = computeVerdict(
    input,
    maxSafeBid,
    score,
    dealKillers,
    confidence,
  );
  warnings.push(...verdictWarnings);
  const committee = buildCommittee(input, verdict, atMaxSafeBid, maxSafeBid, dealKillers);

  // Sanity warnings for degenerate inputs.
  if (num(input.refinance.arv) <= num(input.value.conservativeAsIs)) {
    warnings.push("ARV is not greater than as-is value — renovation adds little/no forced appreciation.");
  }
  if (atMaxSafeBid.noi <= 0) {
    warnings.push("Net operating income is zero or negative — rental assumptions do not support the property.");
  }
  if (maxSafeBid <= 0) {
    warnings.push("No positive maximum safe bid exists under current assumptions. NO DEAL at any price.");
  }

  const valueCeilingAmount = valueCeiling(input);
  const bid: BidStrategy = {
    opportunisticBid,
    conservativeBid,
    targetBid,
    maximumSafeBid: roundDollars(maxSafeBid),
    hardStop,
    walkAwayBid: roundDollars(maxSafeBid),
    bindingConstraint,
    ceilings,
    atMaxSafeBid,
    atMinimumTender,
    valueMathLines: valueCeilingMath(input, valueCeilingAmount),
  };

  // 7) Phase 2 intelligence: renovation model, multi-LTV refi, sensitivity, reasons.
  const renovationModel = buildRenovationModel(
    input.renovationLineItems,
    num(input.renovation.contingencyPct),
    renovationRaw(input.renovation),
  );
  const refiScenarios = refinanceScenarios(input, maxSafeBid);
  const sens = sensitivity(input);
  const reasons = computeReasons(input, {
    maxSafeBid,
    atMaxSafeBid,
    score,
    risk: dealKillers,
    confidence,
    valuation,
  });

  const strategy = input.strategy ?? "BRRRR";

  return {
    strategy,
    verdict,
    bid,
    brrrrAtMinTender: atMinimumTender,
    dealKillers,
    swot,
    score,
    confidence,
    committee,
    warnings,
    scoredComps,
    valuation,
    renovationModel,
    refinanceScenarios: refiScenarios,
    sensitivity: sens,
    reasons,
  };
}
