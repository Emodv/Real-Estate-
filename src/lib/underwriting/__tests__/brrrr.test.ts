import { describe, it, expect } from "vitest";
import { evaluateBrrrr } from "../brrrr";
import { rentalMath } from "../rental";
import { withDefaults } from "../defaults";
import { SAMPLE_PROPERTY } from "./fixtures";

describe("BRRRR model", () => {
  it("produces finite, internally consistent numbers on the sample", () => {
    const m = evaluateBrrrr(150000, SAMPLE_PROPERTY);
    for (const [k, v] of Object.entries(m)) {
      if (k === "cashOnCash") continue; // may legitimately be null
      expect(Number.isFinite(v as number), `${k} should be finite`).toBe(true);
    }
    // Renovation with 15% contingency on 80k raw = 92k
    expect(m.renovationRaw).toBe(80000);
    expect(m.renovationWithContingency).toBe(92000);
    // Purchase loan at 75%
    expect(m.purchaseLoan).toBe(112500);
    expect(m.downPayment).toBe(37500);
  });

  it("refinance amount = ARV * LTV", () => {
    const m = evaluateBrrrr(150000, SAMPLE_PROPERTY);
    expect(m.refinanceAmount).toBe(420000 * 0.75);
  });

  it("NOI is independent of purchase price", () => {
    const a = evaluateBrrrr(100000, SAMPLE_PROPERTY);
    const b = evaluateBrrrr(250000, SAMPLE_PROPERTY);
    expect(a.noi).toBe(b.noi);
    expect(a.noi).toBe(rentalMath(SAMPLE_PROPERTY.rental).noi);
  });

  it("higher purchase price traps more capital", () => {
    const a = evaluateBrrrr(120000, SAMPLE_PROPERTY);
    const b = evaluateBrrrr(200000, SAMPLE_PROPERTY);
    expect(b.capitalTrapped).toBeGreaterThan(a.capitalTrapped);
  });

  it("cashOnCash is null when all capital recovered", () => {
    // Very low price -> refinance recovers everything.
    const m = evaluateBrrrr(10000, SAMPLE_PROPERTY);
    expect(m.capitalTrapped).toBeLessThanOrEqual(0);
    expect(m.cashOnCash).toBeNull();
  });

  it("zero rent -> negative NOI does not crash and CoC handled", () => {
    const noRent = withDefaults({
      ...SAMPLE_PROPERTY,
      rental: { ...SAMPLE_PROPERTY.rental, monthlyMarketRent: 0 },
    });
    const m = evaluateBrrrr(150000, noRent);
    expect(m.noi).toBeLessThanOrEqual(0);
    expect(Number.isFinite(m.annualCashFlow)).toBe(true);
    expect(Number.isFinite(m.totalProjectCost)).toBe(true);
  });

  it("ARV below purchase still yields finite equity figures", () => {
    const badArv = withDefaults({
      ...SAMPLE_PROPERTY,
      refinance: { ...SAMPLE_PROPERTY.refinance, arv: 80000 },
    });
    const m = evaluateBrrrr(150000, badArv);
    expect(m.equityCreatedVsCost).toBeLessThan(0);
    expect(Number.isFinite(m.equityCreatedVsCost)).toBe(true);
  });

  it("handles all-missing input without NaN", () => {
    const empty = withDefaults({});
    const m = evaluateBrrrr(0, empty);
    for (const [k, v] of Object.entries(m)) {
      if (k === "cashOnCash") continue;
      expect(Number.isFinite(v as number), `${k} finite`).toBe(true);
    }
  });
});
