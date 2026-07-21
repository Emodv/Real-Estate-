import { describe, it, expect } from "vitest";
import { scoreComps, type CompProperty, type CompSubject } from "../comps";
import { deriveMarketValue } from "../valuation";

const subject: CompSubject = { propertyType: "Detached house", buildingSqft: 1500, lotAcres: 2, bedrooms: 3, bathrooms: 1, lat: 44.3, lng: -78.3 };

function comp(price: number, sqft: number, over: Partial<CompProperty> = {}): CompProperty {
  return { salePrice: price, buildingSqft: sqft, lat: 44.31, lng: -78.31, saleDate: new Date().toISOString(), propertyType: "Detached house", bedrooms: 3, bathrooms: 1, lotAcres: 2, source: "MLS", dataStatus: "USER_PROVIDED", ...over };
}

describe("deriveMarketValue", () => {
  it("returns null with no comps", () => {
    expect(deriveMarketValue(subject, [])).toBeNull();
  });

  it("derives Low < Base < High from $/sqft comps", () => {
    const comps = scoreComps(subject, [comp(450000, 1500), comp(420000, 1400), comp(465000, 1550)]);
    const v = deriveMarketValue(subject, comps);
    expect(v).not.toBeNull();
    expect(v!.low).toBeLessThan(v!.base);
    expect(v!.base).toBeLessThan(v!.high);
    // ~$300/sqft × 1500 ≈ $450k base.
    expect(v!.base).toBeGreaterThan(400000);
    expect(v!.base).toBeLessThan(500000);
    expect(v!.method).toContain("sqft");
  });

  it("computes assessment-to-market ratio without using assessment as the anchor", () => {
    const comps = scoreComps(subject, [comp(450000, 1500), comp(440000, 1500)]);
    const v = deriveMarketValue(subject, comps, { assessment: 300000 });
    expect(v!.assessmentToMarket).toBeGreaterThan(0);
    // base is comp-derived (~450k), NOT the 300k assessment.
    expect(v!.base).toBeGreaterThan(400000);
  });

  it("flags weak comps in notes", () => {
    const weak = scoreComps(subject, [comp(450000, 1500, { propertyType: "Vacant land", bedrooms: 0, bathrooms: 0, lat: 45.9, lng: -76, saleDate: "2018-01-01" })]);
    const v = deriveMarketValue(subject, weak, { minSimilarity: 0 });
    expect(v!.notes.some((n) => /weak|provisional/i.test(n))).toBe(true);
  });

  it("falls back to raw sale price when subject size unknown", () => {
    const noSize: CompSubject = { ...subject, buildingSqft: undefined };
    const comps = scoreComps(noSize, [comp(450000, 1500), comp(430000, 1400)]);
    const v = deriveMarketValue(noSize, comps);
    expect(v!.method).toContain("sale price");
  });
});
