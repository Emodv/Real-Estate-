import type { BidStrategy, UnderwritingInput, UnderwritingResult } from "./types";
import { clamp, num, roundDollars } from "./money";
import { evaluateBrrrr } from "./brrrr";
import {
  computeCeilings,
  bindingCeiling,
  valueCeiling,
  valueCeilingMath,
} from "./ceilings";
import { dealKillerReport } from "./risk";
import { computeConfidence } from "./confidence";
import { computeScore } from "./score";
import { computeSwot } from "./swot";
import { computeVerdict, buildCommittee } from "./verdict";
import { withDerivedDistances } from "@/lib/geo/distance";

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
  const input = withDerivedDistances(rawInput);

  // 1) Bid ceilings & the binding constraint -> maximum safe bid.
  const ceilings = computeCeilings(input);
  const { amount: maxSafeBid, key: bindingConstraint } = bindingCeiling(ceilings);

  // 2) Graduated bid levels.
  const conservativeFactor = clamp(num(input.bidShape.conservativeBidFactor, 0.85), 0.1, 1);
  const targetFactor = clamp(num(input.bidShape.targetBidFactor, 0.93), 0.1, 1);
  const conservativeBid = roundDollars(maxSafeBid * conservativeFactor);
  const targetBid = roundDollars(maxSafeBid * targetFactor);
  const hardStop = roundDollars(maxSafeBid); // do-not-cross line

  // 3) BRRRR snapshots.
  const atMaxSafeBid = evaluateBrrrr(maxSafeBid, input);
  const atMinimumTender = evaluateBrrrr(num(input.taxSale.minimumTender), input);

  // 4) Risk / deal-killers.
  const dealKillers = dealKillerReport(input.risks);

  // 5) Confidence, score, SWOT.
  const confidence = computeConfidence(input);
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
    conservativeBid,
    targetBid,
    maximumSafeBid: roundDollars(maxSafeBid),
    hardStop,
    bindingConstraint,
    ceilings,
    atMaxSafeBid,
    atMinimumTender,
    valueMathLines: valueCeilingMath(input, valueCeilingAmount),
  };

  return {
    verdict,
    bid,
    brrrrAtMinTender: atMinimumTender,
    dealKillers,
    swot,
    score,
    confidence,
    committee,
    warnings,
  };
}
