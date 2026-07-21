import { describe, it, expect } from "vitest";
import { scoreComps, DEFAULT_COMP_WEIGHTS, type CompProperty, type CompSubject } from "../comps";

const subject: CompSubject = {
  propertyType: "Detached house",
  buildingSqft: 1500,
  lotAcres: 2,
  bedrooms: 3,
  bathrooms: 1,
  yearBuilt: 1975,
  lat: 44.3,
  lng: -78.3,
};

function comp(over: Partial<CompProperty>): CompProperty {
  return {
    salePrice: 400000,
    source: "MLS",
    dataStatus: "USER_PROVIDED",
    ...over,
  };
}

describe("scoreComps", () => {
  it("ranks a near-identical comp above a dissimilar one", () => {
    const near = comp({ address: "near", buildingSqft: 1520, lotAcres: 2.1, bedrooms: 3, bathrooms: 1, yearBuilt: 1978, lat: 44.31, lng: -78.31, saleDate: new Date().toISOString(), propertyType: "Detached house" });
    const far = comp({ address: "far", buildingSqft: 600, lotAcres: 0.1, bedrooms: 1, bathrooms: 1, yearBuilt: 1930, lat: 45.5, lng: -76.0, saleDate: "2019-01-01", propertyType: "Condo" });
    const scored = scoreComps(subject, [far, near]);
    expect(scored[0].address).toBe("near");
    expect(scored[0].similarity).toBeGreaterThan(scored[1].similarity);
  });

  it("computes price per sqft and price per acre", () => {
    const scored = scoreComps(subject, [comp({ salePrice: 450000, buildingSqft: 1500, lotAcres: 3 })]);
    expect(scored[0].pricePerSqft).toBe(300);
    expect(scored[0].pricePerAcre).toBe(150000);
  });

  it("similarity is bounded in [0,1] and weights sum to ~1", () => {
    const scored = scoreComps(subject, [comp({ lat: 44.31, lng: -78.31 }), comp({ lat: 44.35, lng: -78.35 })]);
    for (const c of scored) {
      expect(c.similarity).toBeGreaterThanOrEqual(0);
      expect(c.similarity).toBeLessThanOrEqual(1);
    }
    const wsum = scored.reduce((s, c) => s + c.weight, 0);
    expect(wsum).toBeGreaterThan(0.98);
    expect(wsum).toBeLessThan(1.02);
  });

  it("handles missing dimensions without deflating similarity to zero", () => {
    // Only sale price known; distance derivable. Should still score > 0.
    const scored = scoreComps(subject, [comp({ lat: 44.3, lng: -78.3 })]);
    expect(scored[0].similarity).toBeGreaterThan(0);
  });

  it("returns empty array for no comps", () => {
    expect(scoreComps(subject, [])).toEqual([]);
  });

  it("respects configurable weights (distance-only weighting)", () => {
    const weights = { ...DEFAULT_COMP_WEIGHTS, distance: 1, buildingSize: 0, lotSize: 0, bedrooms: 0, bathrooms: 0, propertyType: 0, age: 0, saleRecency: 0 };
    const onSite = comp({ address: "onsite", lat: 44.3, lng: -78.3, buildingSqft: 100 });
    const scored = scoreComps(subject, [onSite], weights);
    expect(scored[0].similarity).toBeCloseTo(1, 1); // zero distance -> full marks
  });
});
