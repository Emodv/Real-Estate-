import type { ConfidenceScore, UnderwritingInput } from "./types";
import { clamp } from "./money";

/**
 * Confidence is DERIVED from data quality and evidence coverage — never
 * invented. Each sub-score starts from a base and is adjusted by the presence
 * (and provenance) of supporting evidence.
 */
export function computeConfidence(input: UnderwritingInput): ConfidenceScore {
  const reasons: string[] = [];

  // --- Valuation confidence: driven by comparable evidence ----------------
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

  let valuation = 25;
  valuation += Math.min(comps.length, 5) * 8; // up to +40
  valuation += Math.min(verifiedComps, 3) * 5; // up to +15
  valuation += Math.min(recentComps, 3) * 4; // up to +12
  valuation += Math.min(nearComps, 3) * 3; // up to +9
  valuation = clamp(valuation, 0, 100);
  reasons.push(
    `${comps.length} comparable evidence item(s): ${nearComps} within 15km, ${recentComps} within 12 months, ${verifiedComps} verified.`,
  );

  // --- Renovation confidence ---------------------------------------------
  const renovation = clamp(input.renovation.confidence, 0, 100);
  if (renovation < 50) reasons.push("Renovation scope confidence is low — condition largely unknown.");

  // --- Rental confidence --------------------------------------------------
  const rental = clamp(input.rental.confidence, 0, 100);
  const rentComps = input.evidence.filter((e) => /rent/i.test(e.claim)).length;
  const rentalAdjusted = clamp(rental + Math.min(rentComps, 3) * 3, 0, 100);
  if (rentComps === 0) reasons.push("No rental comparables provided — rent estimate is unverified.");

  // --- Risk confidence: fewer unknowns = higher confidence ----------------
  const unknowns = input.risks.filter(
    (r) => r.severity === "UNKNOWN" || r.dataStatus === "UNKNOWN",
  ).length;
  const risk = clamp(90 - unknowns * 15, 0, 100);
  if (unknowns > 0) reasons.push(`${unknowns} risk factor(s) remain UNKNOWN and require verification.`);

  const overall = Math.round(
    valuation * 0.35 + renovation * 0.2 + rentalAdjusted * 0.2 + risk * 0.25,
  );

  return {
    overall: clamp(overall, 0, 100),
    valuation: Math.round(valuation),
    renovation: Math.round(renovation),
    rental: Math.round(rentalAdjusted),
    risk: Math.round(risk),
    reasons,
  };
}
