import type { RentalComp, UnderwritingInput } from "./types";
import { clamp, num, round2 } from "./money";

/**
 * First-class rent estimate: low / base / high.
 *
 * - With rental comparables: base = median comp rent; the range spans the comp
 *   spread (widened to at least ±10%). Confidence rises with count/recency/proximity.
 * - Without comps: base = the single provided estimate, low/high = base ×0.90/×1.10,
 *   explicitly flagged as an ILLUSTRATIVE range (insufficient comparables).
 *
 * Rent data is never invented. The Max Safe Bid always uses BASE rent, never the
 * optimistic high.
 */
export interface RentEstimate {
  low: number;
  base: number;
  high: number;
  method: string;
  confidence: number;
  usedComps: number;
  illustrative: boolean;
  notes: string[];
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function rentComparableConfidence(comps: RentalComp[]): number {
  let c = 20;
  c += Math.min(comps.length, 5) * 9; // up to +45
  const near = comps.filter((x) => (x.distanceKm ?? Infinity) <= 15).length;
  c += Math.min(near, 3) * 5; // +15
  const recent = comps.filter((x) => {
    if (!x.dateObserved) return false;
    const ageDays = (Date.now() - new Date(x.dateObserved).getTime()) / 86_400_000;
    return Number.isFinite(ageDays) && ageDays <= 365;
  }).length;
  c += Math.min(recent, 3) * 6; // +18
  return clamp(Math.round(c), 0, 100);
}

export function estimateRent(input: UnderwritingInput): RentEstimate {
  const comps = (input.rentalComps ?? []).filter((c) => num(c.monthlyRent) > 0);
  const notes: string[] = [];

  if (comps.length > 0) {
    const rents = comps.map((c) => num(c.monthlyRent));
    const base = round2(median(rents));
    const low = round2(Math.min(base * 0.9, Math.min(...rents)));
    const high = round2(Math.max(base * 1.1, Math.max(...rents)));
    if (comps.some((c) => c.utilitiesIncluded)) {
      notes.push("Some rental comps include utilities — verify utility responsibility before relying on the base rent.");
    }
    if (comps.length < 3) notes.push("Fewer than 3 rental comparables — treat the range as provisional.");
    return {
      low,
      base,
      high,
      method: `median of ${comps.length} rental comparable(s)`,
      confidence: rentComparableConfidence(comps),
      usedComps: comps.length,
      illustrative: false,
      notes,
    };
  }

  const base = round2(Math.max(num(input.rental.monthlyMarketRent), 0));
  notes.push("Illustrative range — insufficient rental comparables. Confirm with local rental comps.");
  return {
    low: round2(base * 0.9),
    base,
    high: round2(base * 1.1),
    method: "illustrative ±10% (no rental comparables)",
    confidence: clamp(num(input.rental.confidence), 0, 100),
    usedComps: 0,
    illustrative: true,
    notes,
  };
}
