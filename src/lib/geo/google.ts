import "server-only";
import type { LatLng } from "./distance";

/**
 * Google Geocoding — server-only, env-gated, fail-soft.
 *
 * The API key is read from `GOOGLE_MAPS_API_KEY` and is NEVER exposed to the
 * client. If the key is absent, `isGeoEnabled()` is false and callers fall
 * back to manual coordinate entry. No key value ever lives in the repo.
 */
export function isGeoEnabled(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

export interface GeocodeResult {
  coords: LatLng;
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !address.trim()) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address.trim());
  url.searchParams.set("region", "ca"); // bias toward Canada / Ontario
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[];
    };
    if (data.status !== "OK" || data.results.length === 0) return null;
    const top = data.results[0];
    return {
      coords: { lat: top.geometry.location.lat, lng: top.geometry.location.lng },
      formattedAddress: top.formatted_address,
    };
  } catch {
    // Network / quota errors must never crash underwriting — geocoding is an
    // optional enrichment, not a dependency.
    return null;
  }
}
