import { describe, it, expect } from "vitest";
import { haversineKm, withDerivedDistances } from "../distance";
import { withDefaults } from "@/lib/underwriting";

describe("haversineKm", () => {
  it("is ~zero for identical points", () => {
    expect(haversineKm({ lat: 45, lng: -79 }, { lat: 45, lng: -79 })).toBe(0);
  });

  it("matches a known distance (Toronto ↔ Ottawa ≈ 350 km)", () => {
    const toronto = { lat: 43.6532, lng: -79.3832 };
    const ottawa = { lat: 45.4215, lng: -75.6972 };
    const d = haversineKm(toronto, ottawa);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(370);
  });

  it("is symmetric", () => {
    const a = { lat: 44.1, lng: -78.9 };
    const b = { lat: 44.5, lng: -78.2 };
    expect(haversineKm(a, b)).toBe(haversineKm(b, a));
  });
});

describe("withDerivedDistances", () => {
  it("fills missing distanceKm from subject + evidence coordinates", () => {
    const input = withDefaults({
      meta: { lat: 44.3, lng: -78.3 },
      evidence: [
        { claim: "Comp A", source: "MLS", dataStatus: "USER_PROVIDED", lat: 44.31, lng: -78.32 },
      ],
    });
    const out = withDerivedDistances(input);
    expect(out.evidence[0].distanceKm).toBeGreaterThan(0);
    expect(out.evidence[0].distanceKm).toBeLessThan(5);
  });

  it("does not overwrite a distance that was provided explicitly", () => {
    const input = withDefaults({
      meta: { lat: 44.3, lng: -78.3 },
      evidence: [
        { claim: "Comp A", source: "MLS", dataStatus: "USER_PROVIDED", distanceKm: 9.9, lat: 44.31, lng: -78.32 },
      ],
    });
    const out = withDerivedDistances(input);
    expect(out.evidence[0].distanceKm).toBe(9.9);
  });

  it("is a no-op when the subject is not geocoded", () => {
    const input = withDefaults({
      evidence: [{ claim: "Comp A", source: "MLS", dataStatus: "USER_PROVIDED", lat: 44.31, lng: -78.32 }],
    });
    const out = withDerivedDistances(input);
    expect(out.evidence[0].distanceKm).toBeUndefined();
  });
});
