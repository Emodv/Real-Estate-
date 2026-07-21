import { describe, it, expect } from "vitest";
import { underwrite } from "../engine";
import { estimateRent } from "../rentEstimate";
import { rentalMath } from "../rental";
import { withDefaults } from "../defaults";
import { SAMPLE_PROPERTY } from "./fixtures";
import { SCENARIOS } from "./scenarios";

describe("first-class rent range", () => {
  it("without rental comps: illustrative ±10% around base", () => {
    const r = estimateRent(withDefaults({ rental: { ...SAMPLE_PROPERTY.rental, monthlyMarketRent: 2000 } }));
    expect(r.illustrative).toBe(true);
    expect(r.base).toBe(2000);
    expect(r.low).toBe(1800);
    expect(r.high).toBe(2200);
    expect(r.method).toMatch(/illustrative/i);
  });

  it("with rental comps: base is the median and not illustrative; MSB uses base", () => {
    const input = withDefaults({
      ...SAMPLE_PROPERTY,
      rental: { ...SAMPLE_PROPERTY.rental, monthlyMarketRent: 9999 }, // should be overridden by comps
      rentalComps: [
        { monthlyRent: 3000, source: "L", dataStatus: "USER_PROVIDED", distanceKm: 3, dateObserved: new Date().toISOString() },
        { monthlyRent: 3200, source: "L", dataStatus: "USER_PROVIDED", distanceKm: 5, dateObserved: new Date().toISOString() },
        { monthlyRent: 3400, source: "L", dataStatus: "USER_PROVIDED", distanceKm: 7, dateObserved: new Date().toISOString() },
      ],
    });
    const r = underwrite(input);
    expect(r.rent.illustrative).toBe(false);
    expect(r.rent.base).toBe(3200); // median
    // NOI must reflect the comp base (3200), not the bogus 9999 input.
    expect(r.noiBreakdown.noi).toBe(rentalMath({ ...input.rental, monthlyMarketRent: 3200 }).noi);
  });

  it("high-rent scenario never lowers the max safe bid vs base (bid uses base)", () => {
    const r = underwrite(SAMPLE_PROPERTY);
    expect(r.rentScenarios.high.noi).toBeGreaterThanOrEqual(r.rentScenarios.base.noi);
    expect(r.rentScenarios.base.noi).toBeGreaterThanOrEqual(r.rentScenarios.low.noi);
  });
});

describe("itemized operating expenses & NOI reconciliation", () => {
  it("opex items sum to operatingExpenses and NOI = EGI - opex", () => {
    const r = underwrite(SAMPLE_PROPERTY);
    const sum = r.operatingExpenses.reduce((s, o) => s + o.amount, 0);
    expect(Math.round(sum)).toBe(Math.round(r.noiBreakdown.operatingExpenses));
    expect(Math.round(r.noiBreakdown.effectiveGrossIncome - r.noiBreakdown.operatingExpenses)).toBe(
      Math.round(r.noiBreakdown.noi),
    );
  });

  it("maintenance and CapEx are separate lines (no double-count)", () => {
    const r = underwrite(SAMPLE_PROPERTY);
    const labels = r.operatingExpenses.map((o) => o.label);
    expect(labels).toContain("Maintenance / repairs");
    expect(labels).toContain("CapEx reserve");
  });

  it("EGI = GPR - vacancy", () => {
    const b = underwrite(SAMPLE_PROPERTY).noiBreakdown;
    expect(Math.round(b.grossPotentialRent - b.vacancy)).toBe(Math.round(b.effectiveGrossIncome));
  });
});

describe("determinism preserved", () => {
  it("rent/opex outputs are stable across runs", () => {
    const a = JSON.stringify(underwrite(SCENARIOS.strongRural).rentScenarios);
    const b = JSON.stringify(underwrite(SCENARIOS.strongRural).rentScenarios);
    expect(a).toBe(b);
  });
});
