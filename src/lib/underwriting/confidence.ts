import type { ConfidenceScore, UnderwritingInput } from "./types";
import type { MarketValuation } from "./valuation";
import type { ScoredComp } from "./comps";
import { clamp } from "./money";

export interface ConfidenceContext {
  /** Comp-derived valuation, when available (Phase 2 engine). */
  valuation?: MarketValuation | null;
  scoredComps?: ScoredComp[];
  /** True when renovation is effectively unknown ($0 with unverified condition). */
  renovationUnknown?: boolean;
}

/**
 * Confidence is DERIVED from data quality and evidence coverage — never
 * invented. It reflects EVIDENCE QUALITY: it rises with more/recent/near comps
 * and falls with valuation dispersion, unknown renovation, and unknown risks.
 */
export function computeConfidence(
  input: UnderwritingInput,
  ctx: ConfidenceContext = {},
): ConfidenceScore {
  const reasons: string[] = [];

  // --- Valuation confidence ----------------------------------------------
  let valuation: number;
  if (ctx.valuation) {
    // Adopt the dispersion-aware valuation confidence, then penalize dispersion
    // explicitly so wide comp spreads visibly lower confidence.
    const dispersionPenalty = Math.round((Math.min(ctx.valuation.dispersionPct, 0.25) / 0.25) * 20);
    valuation = clamp(ctx.valuation.confidence - dispersionPenalty, 0, 100);
    reasons.push(
      `${ctx.valuation.usedComps} usable comparable(s); valuation dispersion ±${Math.round(ctx.valuation.dispersionPct * 100)}% (penalty ${dispersionPenalty}).`,
    );
    if (ctx.valuation.usedComps < 3) reasons.push("Fewer than 3 usable comparables — valuation is provisional.");
  } else {
    // Legacy path: no comps — derive from the evidence[] array.
    const comps = input.evidence.filter(
      (e) => /comp|sale|listing|value/i.test(e.claim) || /comp/i.test(e.sourceType ?? ""),
    );
    const verifiedComps = comps.filter((e) => e.dataStatus === "VERIFIED").length;
    const recentComps = comps.filter((e) => {
      if (!e.date) return false;
      const ageDays = (Date.now() - new Date(e.date).getTime()) / 86_400_000;
      return Number.isFinite(ageDays) && ageDays <= 365;
    }).length;
    const nearComps = comps.filter((e) => (e.distanceKm ?? Infinity) <= 15).length;
    valuation = 25;
    valuation += Math.min(comps.length, 5) * 8;
    valuation += Math.min(verifiedComps, 3) * 5;
    valuation += Math.min(recentComps, 3) * 4;
    valuation += Math.min(nearComps, 3) * 3;
    valuation = clamp(valuation, 0, 100);
    if (comps.length === 0) reasons.push("No comparable sales provided — market value is unverified.");
  }

  // --- Renovation confidence ---------------------------------------------
  let renovation = clamp(input.renovation.confidence, 0, 100);
  if (ctx.renovationUnknown) {
    renovation = Math.min(renovation, 20);
    reasons.push("Renovation is $0 with unverified condition — treated as UNKNOWN, confidence capped.");
  } else if (renovation < 50) {
    reasons.push("Renovation scope confidence is low — condition largely unknown.");
  }

  // --- Rental confidence --------------------------------------------------
  const rentalBase = clamp(input.rental.confidence, 0, 100);
  const rentComps = input.evidence.filter((e) => /rent/i.test(e.claim)).length;
  const rental = clamp(rentalBase + Math.min(rentComps, 3) * 3, 0, 100);
  if (rentComps === 0) reasons.push("No rental comparables provided — rent estimate is unverified.");

  // --- Risk confidence: fewer unknowns = higher confidence ----------------
  const unknowns = input.risks.filter(
    (r) => r.severity === "UNKNOWN" || r.dataStatus === "UNKNOWN",
  ).length;
  const risk = clamp(90 - unknowns * 15, 0, 100);
  if (unknowns > 0) reasons.push(`${unknowns} risk factor(s) remain UNKNOWN and require verification.`);

  let overall = Math.round(valuation * 0.35 + renovation * 0.2 + rental * 0.2 + risk * 0.25);
  if (ctx.renovationUnknown) overall = Math.min(overall, 40); // gate: unknown reno cannot be high-confidence (< verdict's 45 floor)

  return {
    overall: clamp(overall, 0, 100),
    valuation: Math.round(valuation),
    renovation: Math.round(renovation),
    rental: Math.round(rental),
    risk: Math.round(risk),
    reasons,
  };
}
