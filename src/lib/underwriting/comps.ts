import type { DataStatus } from "./types";
import { clamp, safeDivide } from "./money";
import { haversineKm } from "@/lib/geo/distance";

/**
 * Comparable-sales engine.
 *
 * Deterministic similarity scoring + price normalization. Weights are MODEL
 * ASSUMPTIONS (configurable), not universal truths — every scored comp carries
 * the reasons behind its similarity so the user can audit it.
 */

export interface CompProperty {
  id?: string;
  address?: string;
  salePrice: number;
  saleDate?: string; // ISO date
  propertyType?: string;
  buildingSqft?: number;
  lotAcres?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  condition?: string;
  distanceKm?: number;
  lat?: number;
  lng?: number;
  source: string;
  sourceType?: string;
  dataStatus: DataStatus;
}

export interface CompSubject {
  propertyType?: string;
  buildingSqft?: number;
  lotAcres?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lat?: number;
  lng?: number;
}

export interface CompWeights {
  distance: number;
  buildingSize: number;
  lotSize: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: number;
  age: number;
  saleRecency: number;
}

/** Model-assumption default weights (sum = 1.0). Configurable per run. */
export const DEFAULT_COMP_WEIGHTS: CompWeights = {
  distance: 0.25,
  buildingSize: 0.2,
  lotSize: 0.1,
  bedrooms: 0.1,
  bathrooms: 0.1,
  propertyType: 0.1,
  age: 0.05,
  saleRecency: 0.1,
};

export interface ScoredComp extends CompProperty {
  pricePerSqft: number | null;
  pricePerAcre: number | null;
  effectiveDistanceKm: number | null;
  /** 0..1 overall similarity to the subject. */
  similarity: number;
  /** Normalized weight across the included comp set (sums to 1). */
  weight: number;
  reasons: string[];
}

function ratioCloseness(a?: number, b?: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const av = a as number;
  const bv = b as number;
  const hi = Math.max(Math.abs(av), Math.abs(bv));
  if (hi < 1e-9) return 1;
  return clamp(1 - Math.abs(av - bv) / hi, 0, 1);
}

function countCloseness(a: number | undefined, b: number | undefined, ref: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return clamp(1 - Math.abs((a as number) - (b as number)) / ref, 0, 1);
}

function monthsBetween(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
}

function effectiveDistance(subject: CompSubject, comp: CompProperty): number | null {
  if (Number.isFinite(comp.distanceKm)) return comp.distanceKm as number;
  if (
    Number.isFinite(subject.lat) &&
    Number.isFinite(subject.lng) &&
    Number.isFinite(comp.lat) &&
    Number.isFinite(comp.lng)
  ) {
    return haversineKm(
      { lat: subject.lat as number, lng: subject.lng as number },
      { lat: comp.lat as number, lng: comp.lng as number },
    );
  }
  return null;
}

/** Distance decay: 0 km -> 1.0, >= 25 km -> 0. */
function distanceCloseness(km: number | null): number | null {
  if (km === null) return null;
  return clamp(1 - Math.min(km, 25) / 25, 0, 1);
}

/**
 * Score comparables against the subject. Only dimensions where BOTH sides have
 * data contribute, and weights are renormalized over the available dimensions
 * so missing fields don't silently deflate similarity.
 */
export function scoreComps(
  subject: CompSubject,
  comps: CompProperty[],
  weights: CompWeights = DEFAULT_COMP_WEIGHTS,
): ScoredComp[] {
  const scored = comps.map((comp) => {
    const eff = effectiveDistance(subject, comp);
    const dims: Array<{ key: keyof CompWeights; closeness: number | null; label: string }> = [
      { key: "distance", closeness: distanceCloseness(eff), label: eff !== null ? `${eff.toFixed(1)} km away` : "distance unknown" },
      { key: "buildingSize", closeness: ratioCloseness(subject.buildingSqft, comp.buildingSqft), label: "building size" },
      { key: "lotSize", closeness: ratioCloseness(subject.lotAcres, comp.lotAcres), label: "lot size" },
      { key: "bedrooms", closeness: countCloseness(subject.bedrooms, comp.bedrooms, 3), label: "bedrooms" },
      { key: "bathrooms", closeness: countCloseness(subject.bathrooms, comp.bathrooms, 2), label: "bathrooms" },
      { key: "propertyType", closeness: propertyTypeCloseness(subject.propertyType, comp.propertyType), label: "property type" },
      { key: "age", closeness: countCloseness(subject.yearBuilt, comp.yearBuilt, 40), label: "age" },
      { key: "saleRecency", closeness: recencyCloseness(comp.saleDate), label: "sale recency" },
    ];

    let weightedSum = 0;
    let weightTotal = 0;
    const reasons: string[] = [];
    for (const d of dims) {
      if (d.closeness === null) continue;
      const w = weights[d.key];
      weightedSum += w * d.closeness;
      weightTotal += w;
      if (d.closeness >= 0.85) reasons.push(`close on ${d.label}`);
      else if (d.closeness <= 0.35) reasons.push(`differs on ${d.label}`);
    }
    const similarity = weightTotal > 0 ? clamp(weightedSum / weightTotal, 0, 1) : 0;

    const pricePerSqft =
      Number.isFinite(comp.buildingSqft) && (comp.buildingSqft as number) > 0
        ? Math.round(safeDivide(comp.salePrice, comp.buildingSqft as number) * 100) / 100
        : null;
    const pricePerAcre =
      Number.isFinite(comp.lotAcres) && (comp.lotAcres as number) > 0
        ? Math.round(safeDivide(comp.salePrice, comp.lotAcres as number))
        : null;

    return {
      ...comp,
      pricePerSqft,
      pricePerAcre,
      effectiveDistanceKm: eff === null ? null : Math.round(eff * 100) / 100,
      similarity: Math.round(similarity * 1000) / 1000,
      weight: 0,
      reasons,
    } satisfies ScoredComp;
  });

  // Normalize weights by similarity across the included set.
  const totalSim = scored.reduce((s, c) => s + c.similarity, 0);
  for (const c of scored) {
    c.weight = totalSim > 0 ? Math.round(safeDivide(c.similarity, totalSim) * 1000) / 1000 : 0;
  }
  return scored.sort((a, b) => b.similarity - a.similarity);
}

function propertyTypeCloseness(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return 1;
  // Partial credit when one contains the other (e.g. "detached" vs "detached house").
  if (na.includes(nb) || nb.includes(na)) return 0.7;
  return 0.2;
}

function recencyCloseness(saleDate?: string): number | null {
  const months = monthsBetween(saleDate);
  if (months === null) return null;
  return clamp(1 - Math.min(Math.max(months, 0), 24) / 24, 0, 1);
}
