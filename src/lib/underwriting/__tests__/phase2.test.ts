import { describe, it, expect } from "vitest";
import { buildRenovationModel, type RenoLineItem } from "../renovationModel";
import { refinanceScenarios, DEFAULT_LTVS } from "../refinanceScenarios";
import { sensitivity, breakEvenBid } from "../sensitivity";
import { computeReasons } from "../reasons";
import { evaluateBrrrr } from "../brrrr";
import { dealKillerReport } from "../risk";
import { computeConfidence } from "../confidence";
import { computeScore } from "../score";
import { underwrite } from "../engine";
import { withDefaults } from "../defaults";
import { SAMPLE_PROPERTY } from "./fixtures";

describe("renovation model", () => {
  it("sums line items and applies contingency, tracking KNOWN share", () => {
    const items: RenoLineItem[] = [
      { category: "ROOF", status: "KNOWN", low: 8000, base: 10000, high: 12000 },
      { category: "SEPTIC", status: "UNKNOWN", low: 20000, base: 30000, high: 40000 },
    ];
    const m = buildRenovationModel(items, 0.15);
    expect(m.base).toBe(40000);
    expect(m.baseWithContingency).toBe(46000);
    expect(m.unknownCategories).toContain("SEPTIC");
    expect(m.knownShare).toBeCloseTo(0.25, 2); // 10k known / 40k base
  });

  it("synthesizes a line from a coarse total when none provided", () => {
    const m = buildRenovationModel(undefined, 0.1, 50000);
    expect(m.base).toBe(50000);
    expect(m.lineItems).toHaveLength(1);
    expect(m.lineItems[0].status).toBe("ESTIMATED");
  });

  it("never produces NaN on empty/zero input", () => {
    const m = buildRenovationModel([], 0, 0);
    expect(Number.isFinite(m.base)).toBe(true);
    expect(Number.isFinite(m.baseWithContingency)).toBe(true);
  });
});

describe("refinance scenarios", () => {
  it("covers all default LTVs; higher LTV recovers more capital", () => {
    const s = refinanceScenarios(SAMPLE_PROPERTY, 150000);
    expect(s.map((x) => x.ltv)).toEqual(DEFAULT_LTVS);
    for (const x of s) {
      expect(Number.isFinite(x.refinanceAmount)).toBe(true);
      expect(Number.isFinite(x.monthlyCashFlow)).toBe(true);
    }
    expect(s[3].capitalRecovered).toBeGreaterThanOrEqual(s[0].capitalRecovered);
  });
});

describe("sensitivity analysis", () => {
  it("produces a matrix matching the axes", () => {
    const s = sensitivity(SAMPLE_PROPERTY);
    expect(s.matrix).toHaveLength(s.arvAxis.length);
    expect(s.matrix[0]).toHaveLength(s.renovationAxis.length);
    for (const row of s.matrix) for (const cell of row) expect(Number.isFinite(cell.maxSafeBid)).toBe(true);
  });

  it("higher renovation lowers the max safe bid (within an ARV row)", () => {
    const s = sensitivity(SAMPLE_PROPERTY);
    const row = s.matrix[0];
    expect(row[row.length - 1].maxSafeBid).toBeLessThanOrEqual(row[0].maxSafeBid + 1);
  });

  it("break-even bid: all-in cost equals ARV (zero equity)", () => {
    const be = breakEvenBid(SAMPLE_PROPERTY);
    const m = evaluateBrrrr(be, SAMPLE_PROPERTY);
    expect(Math.abs(m.equityCreatedVsCost)).toBeLessThan(3000);
    // Break-even (zero equity) should sit at or above the safety-margined walk-away.
    expect(be).toBeGreaterThanOrEqual(s(SAMPLE_PROPERTY));
  });
});

function s(input: Parameters<typeof underwrite>[0]) {
  return underwrite(input).bid.maximumSafeBid;
}

describe("reasons (deal-killer mode)", () => {
  it("returns at most 3 of each and lists a fatal killer under notToBuy", () => {
    const input = withDefaults({
      ...SAMPLE_PROPERTY,
      risks: [{ category: "ACCESS", severity: "FATAL", label: "Landlocked", dataStatus: "VERIFIED" }],
    });
    const atMax = evaluateBrrrr(0, input);
    const risk = dealKillerReport(input.risks);
    const conf = computeConfidence(input);
    const score = computeScore(input, atMax, 0, risk);
    const r = computeReasons(input, { maxSafeBid: 0, atMaxSafeBid: atMax, score, risk, confidence: conf, valuation: null });
    expect(r.toBuy.length).toBeLessThanOrEqual(3);
    expect(r.notToBuy.length).toBeLessThanOrEqual(3);
    expect(r.notToBuy.join(" ")).toMatch(/Landlocked/i);
  });
});

describe("comps drive valuation inside the engine", () => {
  it("seeds market value from comps when value inputs are blank", () => {
    const input = withDefaults({
      meta: { propertyType: "Detached house", bedrooms: 3, bathrooms: 1, lotSizeAcres: 2, lat: 44.3, lng: -78.3 },
      taxSale: { minimumTender: 90000 },
      // value.* intentionally left at 0 (defaults)
      renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 60 },
      rental: { monthlyMarketRent: 3200, vacancyPct: 0.05, annualPropertyTax: 3000, annualInsurance: 1400, annualUtilities: 0, maintenancePct: 0.08, managementPct: 0.08, otherAnnualOpEx: 600, confidence: 60 },
      comps: [
        { salePrice: 430000, buildingSqft: 1500, lotAcres: 2, bedrooms: 3, bathrooms: 1, lat: 44.31, lng: -78.31, saleDate: new Date().toISOString(), propertyType: "Detached house", source: "MLS", dataStatus: "USER_PROVIDED" },
        { salePrice: 410000, buildingSqft: 1450, lotAcres: 2, bedrooms: 3, bathrooms: 1, lat: 44.29, lng: -78.28, saleDate: new Date().toISOString(), propertyType: "Detached house", source: "MLS", dataStatus: "USER_PROVIDED" },
        { salePrice: 420000, buildingSqft: 1480, lotAcres: 2, bedrooms: 3, bathrooms: 1, lat: 44.32, lng: -78.33, saleDate: new Date().toISOString(), propertyType: "Detached house", source: "MLS", dataStatus: "USER_PROVIDED" },
      ],
    });
    const r = underwrite(input);
    expect(r.valuation).not.toBeNull();
    expect(r.valuation!.base).toBeGreaterThan(380000);
    expect(r.scoredComps.length).toBe(3);
    // A positive max safe bid should now exist, derived from comp value.
    expect(r.bid.maximumSafeBid).toBeGreaterThan(0);
    expect(r.refinanceScenarios).toHaveLength(4);
    expect(r.sensitivity.matrix.length).toBeGreaterThan(0);
    expect(r.reasons.toBuy.length + r.reasons.notToBuy.length).toBeGreaterThan(0);
  });
});
