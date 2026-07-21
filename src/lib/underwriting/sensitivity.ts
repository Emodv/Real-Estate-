import type { UnderwritingInput } from "./types";
import { evaluateBrrrr } from "./brrrr";
import { computeCeilings, bindingCeiling, maxPriceSatisfying } from "./ceilings";
import { renovationWithContingency } from "./renovation";
import { num, roundDollars } from "./money";

/**
 * Sensitivity analysis — "at what purchase price does this deal stop working?"
 *
 * - A 2-D matrix of the Maximum Safe Bid across ARV × renovation.
 * - The BREAK-EVEN bid: the highest price at which all-in cost still equals ARV
 *   (zero equity created).
 * - The WALK-AWAY bid: the Maximum Safe Bid (do-not-cross).
 */
export interface SensitivityCell {
  arv: number;
  renovation: number;
  maxSafeBid: number;
}

export interface SensitivityResult {
  arvAxis: number[];
  renovationAxis: number[];
  matrix: SensitivityCell[][]; // rows = ARV, cols = renovation
  breakEvenBid: number;
  walkAwayBid: number;
}

function maxSafeBidFor(input: UnderwritingInput): number {
  return bindingCeiling(computeCeilings(input)).amount;
}

/** Scale renovation line amounts so the raw total equals `target`. */
function withRenovationTotal(input: UnderwritingInput, target: number): UnderwritingInput {
  const currentRaw =
    num(input.renovation.cosmetic) + num(input.renovation.major) + num(input.renovation.structural);
  if (currentRaw <= 0) {
    return { ...input, renovation: { ...input.renovation, cosmetic: target, major: 0, structural: 0 } };
  }
  const k = target / currentRaw;
  return {
    ...input,
    renovation: {
      ...input.renovation,
      cosmetic: num(input.renovation.cosmetic) * k,
      major: num(input.renovation.major) * k,
      structural: num(input.renovation.structural) * k,
    },
  };
}

function withArv(input: UnderwritingInput, arv: number): UnderwritingInput {
  return {
    ...input,
    refinance: { ...input.refinance, arv },
    value: { ...input.value, conservativeArv: arv },
  };
}

export function breakEvenBid(input: UnderwritingInput): number {
  const arv = num(input.value.conservativeArv);
  const hi = Math.max(arv, num(input.refinance.arv), 100_000) * 2;
  // Highest price at which ARV - totalProjectCost >= 0.
  const ok = (p: number) => evaluateBrrrr(p, input).equityCreatedVsCost >= -1e-6;
  return roundDollars(Math.max(0, maxPriceSatisfying(ok, 0, hi)));
}

export function sensitivity(
  input: UnderwritingInput,
  arvAxisIn?: number[],
  renoAxisIn?: number[],
): SensitivityResult {
  const baseArv = num(input.value.conservativeArv) || num(input.refinance.arv) || 400_000;
  const baseReno = renovationWithContingency(input.renovation) || 75_000;

  const arvAxis = (arvAxisIn && arvAxisIn.length ? arvAxisIn : [0.85, 0.95, 1.05, 1.15].map((k) => baseArv * k)).map(
    roundDollars,
  );
  const renovationAxis = (renoAxisIn && renoAxisIn.length
    ? renoAxisIn
    : [1.0, 1.25, 1.5, 1.75].map((k) => baseReno * k)
  ).map(roundDollars);

  const matrix: SensitivityCell[][] = arvAxis.map((arv) =>
    renovationAxis.map((reno) => {
      const scenario = withRenovationTotal(withArv(input, arv), reno);
      return { arv, renovation: reno, maxSafeBid: roundDollars(maxSafeBidFor(scenario)) };
    }),
  );

  return {
    arvAxis,
    renovationAxis,
    matrix,
    breakEvenBid: breakEvenBid(input),
    walkAwayBid: roundDollars(maxSafeBidFor(input)),
  };
}
