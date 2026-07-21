import type { UnderwritingInput } from "@/lib/underwriting";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometres between two coordinates (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius (km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(R * c * 100) / 100;
}

function hasCoords(x: { lat?: number; lng?: number }): x is LatLng {
  return Number.isFinite(x.lat) && Number.isFinite(x.lng);
}

/**
 * Fill in `evidence[].distanceKm` from coordinates when it is missing and both
 * the subject and the evidence item are geocoded. This is a PURE transform —
 * no network — so the deterministic engine (and its confidence scoring, which
 * rewards nearby comps) benefits from real geocoded distances without ever
 * depending on an API at underwrite time.
 */
export function withDerivedDistances(input: UnderwritingInput): UnderwritingInput {
  const subject = input.meta;
  if (!hasCoords(subject)) return input;
  const subjectLL: LatLng = { lat: subject.lat as number, lng: subject.lng as number };

  let changed = false;
  const evidence = input.evidence.map((e) => {
    if (e.distanceKm != null && Number.isFinite(e.distanceKm)) return e;
    if (!hasCoords(e)) return e;
    changed = true;
    return { ...e, distanceKm: haversineKm(subjectLL, { lat: e.lat as number, lng: e.lng as number }) };
  });

  return changed ? { ...input, evidence } : input;
}
