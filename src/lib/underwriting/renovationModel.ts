import { num, round2, clamp } from "./money";

/**
 * Renovation estimation model.
 *
 * Categorized low/base/high estimates with an explicit data-status per line —
 * the system never silently converts an ASSUMED cost into a KNOWN one.
 */
export type RenoStatus = "KNOWN" | "ESTIMATED" | "ASSUMED" | "UNKNOWN";

export const RENO_CATEGORIES = [
  "ROOF",
  "FOUNDATION",
  "STRUCTURAL",
  "ELECTRICAL",
  "PLUMBING",
  "HVAC",
  "WINDOWS",
  "INSULATION",
  "KITCHEN",
  "BATHROOMS",
  "FLOORING",
  "PAINT",
  "EXTERIOR",
  "LANDSCAPING",
  "APPLIANCES",
  "SEPTIC",
  "WELL",
  "OTHER",
] as const;
export type RenoCategory = (typeof RENO_CATEGORIES)[number];

export interface RenoLineItem {
  category: RenoCategory;
  status: RenoStatus;
  low: number;
  base: number;
  high: number;
  note?: string;
}

export interface RenovationModel {
  lineItems: RenoLineItem[];
  low: number;
  base: number;
  high: number;
  contingencyPct: number;
  lowWithContingency: number;
  baseWithContingency: number;
  highWithContingency: number;
  /** Categories flagged UNKNOWN — must be verified before bidding. */
  unknownCategories: RenoCategory[];
  /** Share of base cost that is KNOWN (0..1). Lower = riskier estimate. */
  knownShare: number;
  confidence: number;
}

/**
 * Build the renovation model from explicit line items. When none are given,
 * synthesize a single conservative line from the coarse cosmetic/major/
 * structural totals (status ESTIMATED) so the model always renders.
 */
export function buildRenovationModel(
  lineItems: RenoLineItem[] | undefined,
  contingencyPct: number,
  fallbackTotal = 0,
): RenovationModel {
  const items: RenoLineItem[] =
    lineItems && lineItems.length > 0
      ? lineItems.map(normalizeLine)
      : [
          {
            category: "OTHER",
            status: "ESTIMATED",
            low: round2(fallbackTotal * 0.85),
            base: round2(fallbackTotal),
            high: round2(fallbackTotal * 1.25),
            note: "Synthesized from coarse cosmetic/major/structural totals.",
          },
        ];

  const low = round2(items.reduce((s, i) => s + i.low, 0));
  const base = round2(items.reduce((s, i) => s + i.base, 0));
  const high = round2(items.reduce((s, i) => s + i.high, 0));
  const c = Math.max(num(contingencyPct), 0);

  const knownBase = items.filter((i) => i.status === "KNOWN").reduce((s, i) => s + i.base, 0);
  const knownShare = base > 0 ? clamp(knownBase / base, 0, 1) : 0;
  const unknownCategories = items.filter((i) => i.status === "UNKNOWN").map((i) => i.category);

  // Confidence: driven by how much of the budget is KNOWN vs UNKNOWN/ASSUMED.
  const unknownBase = items.filter((i) => i.status === "UNKNOWN").reduce((s, i) => s + i.base, 0);
  const unknownShare = base > 0 ? unknownBase / base : 0;
  const confidence = clamp(Math.round(35 + knownShare * 55 - unknownShare * 40), 0, 100);

  return {
    lineItems: items,
    low,
    base,
    high,
    contingencyPct: c,
    lowWithContingency: round2(low * (1 + c)),
    baseWithContingency: round2(base * (1 + c)),
    highWithContingency: round2(high * (1 + c)),
    unknownCategories,
    knownShare: Math.round(knownShare * 100) / 100,
    confidence,
  };
}

function normalizeLine(i: RenoLineItem): RenoLineItem {
  const base = round2(num(i.base));
  const low = round2(num(i.low) || base * 0.85);
  const high = round2(num(i.high) || base * 1.25);
  return { ...i, low, base, high };
}
