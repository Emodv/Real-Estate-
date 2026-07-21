import type { ScoredComp, CompSubject } from "./comps";
import { clamp, num, round2, safeDivide } from "./money";

/**
 * Market valuation engine — derives Low / Base / High market value FROM
 * comparable sales. MPAC assessment is NEVER used as the valuation anchor
 * (it may be shown separately as a reference ratio only).
 *
 * Method:
 *  - Each comp produces an "indicated value" for the subject:
 *      * $/sqft × subject sqft  (when both are known), else
 *      * the comp's raw sale price.
 *  - Base = similarity-weighted mean of indicated values.
 *  - Dispersion = weighted coefficient of variation, clamped to [5%, 25%].
 *  - Low/High = Base × (1 ∓ dispersion).
 *  - Confidence rises with comp count, similarity, proximity, and recency.
 */
export interface MarketValuation {
  low: number;
  base: number;
  high: number;
  method: string;
  dispersionPct: number;
  usedComps: number;
  confidence: number;
  indications: Array<{ address?: string; indicated: number; weight: number; basis: string }>;
  notes: string[];
  /** Assessment reference (never used as the value anchor). */
  assessment?: number;
  assessmentToMarket?: number;
}

export interface ValuationOptions {
  /** Ignore comps below this similarity (0..1). Default 0.15. */
  minSimilarity?: number;
  assessment?: number;
}

export function deriveMarketValue(
  subject: CompSubject,
  comps: ScoredComp[],
  opts: ValuationOptions = {},
): MarketValuation | null {
  const minSim = opts.minSimilarity ?? 0.15;
  const usable = comps.filter((c) => c.similarity >= minSim && num(c.salePrice) > 0);
  if (usable.length === 0) return null;

  const subjectSqft = Number.isFinite(subject.buildingSqft) ? (subject.buildingSqft as number) : null;

  const indications = usable.map((c) => {
    let indicated: number;
    let basis: string;
    if (subjectSqft && c.pricePerSqft && c.pricePerSqft > 0) {
      indicated = subjectSqft * c.pricePerSqft;
      basis = `$${c.pricePerSqft.toFixed(0)}/sqft × ${subjectSqft} sqft`;
    } else {
      indicated = num(c.salePrice);
      basis = "raw sale price (size not comparable)";
    }
    return { address: c.address, indicated: round2(indicated), weight: c.weight, basis };
  });

  // Re-normalize weights over the usable subset.
  const wTotal = indications.reduce((s, i) => s + i.weight, 0);
  const weights = indications.map((i) => (wTotal > 0 ? i.weight / wTotal : 1 / indications.length));

  const base = indications.reduce((s, i, idx) => s + i.indicated * weights[idx], 0);

  // Weighted variance -> coefficient of variation.
  const variance = indications.reduce(
    (s, i, idx) => s + weights[idx] * (i.indicated - base) ** 2,
    0,
  );
  const std = Math.sqrt(Math.max(variance, 0));
  const cv = clamp(safeDivide(std, base, 0), 0, 1);
  const dispersion = clamp(Math.max(cv, 0.05), 0.05, 0.25);

  const low = round2(base * (1 - dispersion));
  const high = round2(base * (1 + dispersion));

  const confidence = valuationConfidence(usable);

  const notes: string[] = [];
  if (usable.length < 3) notes.push("Fewer than 3 usable comparables — treat the range as provisional.");
  if (!subjectSqft) notes.push("Subject building size unknown — valuation falls back to raw comp prices.");
  const avgSim = usable.reduce((s, c) => s + c.similarity, 0) / usable.length;
  if (avgSim < 0.5) notes.push("Average comparable similarity is low — comps are weak.");

  const assessment = opts.assessment;
  const assessmentToMarket =
    assessment && base > 0 ? Math.round(safeDivide(assessment, base) * 100) / 100 : undefined;

  return {
    low,
    base: round2(base),
    high,
    method: subjectSqft ? "similarity-weighted $/sqft" : "similarity-weighted sale price",
    dispersionPct: Math.round(dispersion * 1000) / 1000,
    usedComps: usable.length,
    confidence,
    indications,
    notes,
    assessment,
    assessmentToMarket,
  };
}

function valuationConfidence(comps: ScoredComp[]): number {
  let c = 20;
  c += Math.min(comps.length, 5) * 8; // up to +40
  const near = comps.filter((x) => (x.effectiveDistanceKm ?? Infinity) <= 15).length;
  c += Math.min(near, 3) * 4; // +12
  const recent = comps.filter((x) => {
    if (!x.saleDate) return false;
    const ageDays = (Date.now() - new Date(x.saleDate).getTime()) / 86_400_000;
    return Number.isFinite(ageDays) && ageDays <= 365;
  }).length;
  c += Math.min(recent, 3) * 4; // +12
  const strong = comps.filter((x) => x.similarity >= 0.6).length;
  c += Math.min(strong, 3) * 5; // +15
  return clamp(Math.round(c), 0, 100);
}
