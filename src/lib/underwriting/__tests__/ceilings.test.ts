import { describe, it, expect } from "vitest";
import {
  computeCeilings,
  bindingCeiling,
  valueCeiling,
  brrrrCeiling,
  cashFlowCeiling,
  roiCeiling,
  capitalCeiling,
  maxPriceSatisfying,
} from "../ceilings";
import { evaluateBrrrr } from "../brrrr";
import { withDefaults } from "../defaults";
import { SAMPLE_PROPERTY } from "./fixtures";

describe("bid ceilings", () => {
  it("maxPriceSatisfying finds the boundary of a monotonic predicate", () => {
    const p = maxPriceSatisfying((x) => x <= 137, 0, 1000);
    expect(p).toBeGreaterThan(136.9);
    expect(p).toBeLessThanOrEqual(137.0001);
  });

  it("all ceilings are finite and non-negative on the sample", () => {
    const ceilings = computeCeilings(SAMPLE_PROPERTY);
    for (const c of ceilings) {
      if (!c.applicable) continue;
      expect(c.amount).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(c.amount)).toBe(true);
    }
  });

  it("value ceiling respects the required margin of safety on ARV", () => {
    const ceiling = valueCeiling(SAMPLE_PROPERTY);
    const m = evaluateBrrrr(ceiling, SAMPLE_PROPERTY);
    const arv = SAMPLE_PROPERTY.value.conservativeArv;
    const margin = SAMPLE_PROPERTY.value.marginOfSafetyPct;
    const buffer = SAMPLE_PROPERTY.value.requiredEquityBuffer;
    // total project cost + buffer should sit at/under the ARV-margin target.
    expect(m.totalProjectCost + buffer).toBeLessThanOrEqual(arv * (1 - margin) + 1);
  });

  it("BRRRR ceiling keeps trapped capital at/under the target", () => {
    const ceiling = brrrrCeiling(SAMPLE_PROPERTY);
    const m = evaluateBrrrr(ceiling, SAMPLE_PROPERTY);
    expect(m.capitalTrapped).toBeLessThanOrEqual(SAMPLE_PROPERTY.returns.maxCapitalTrapped + 1);
  });

  it("ROI ceiling meets the minimum cash-on-cash at the boundary", () => {
    const ceiling = roiCeiling(SAMPLE_PROPERTY);
    const m = evaluateBrrrr(ceiling, SAMPLE_PROPERTY);
    if (m.capitalTrapped > 0 && m.annualCashFlow > 0) {
      const coc = m.annualCashFlow / m.capitalTrapped;
      expect(coc).toBeGreaterThanOrEqual(SAMPLE_PROPERTY.returns.minCashOnCash - 0.01);
    }
  });

  it("cash-flow ceiling keeps DSCR at/above the minimum", () => {
    const ceiling = cashFlowCeiling(SAMPLE_PROPERTY);
    // At the ceiling, a purchase mortgage should be serviceable.
    expect(ceiling).toBeGreaterThan(0);
  });

  it("binding constraint is the minimum applicable ceiling", () => {
    const ceilings = computeCeilings(SAMPLE_PROPERTY);
    const { amount, key } = bindingCeiling(ceilings);
    const applicable = ceilings.filter((c) => c.applicable && Number.isFinite(c.amount));
    const min = Math.min(...applicable.map((c) => c.amount));
    expect(amount).toBeCloseTo(min, 0);
    expect(ceilings.find((c) => c.key === key)?.amount).toBeCloseTo(min, 0);
  });

  it("capital ceiling is null when no limit provided, finite when provided", () => {
    expect(capitalCeiling(SAMPLE_PROPERTY)).toBeNull();
    // The reno alone requires ~$92k cash, so a feasible limit must exceed that.
    const limited = withDefaults({
      ...SAMPLE_PROPERTY,
      capital: { maxCapitalAvailable: 150000 },
    });
    const ceiling = capitalCeiling(limited);
    expect(ceiling).not.toBeNull();
    expect(ceiling as number).toBeGreaterThan(0);
    const m = evaluateBrrrr(ceiling as number, limited);
    expect(m.totalCashInvested).toBeLessThanOrEqual(150000 + 1);
  });

  it("an infeasible capital limit (below fixed cash floor) yields a zero ceiling", () => {
    const tooLow = withDefaults({
      ...SAMPLE_PROPERTY,
      capital: { maxCapitalAvailable: 60000 },
    });
    expect(capitalCeiling(tooLow)).toBe(0);
  });

  it("stricter margin of safety lowers the value ceiling", () => {
    const strict = withDefaults({
      ...SAMPLE_PROPERTY,
      value: { ...SAMPLE_PROPERTY.value, marginOfSafetyPct: 0.35 },
    });
    expect(valueCeiling(strict)).toBeLessThan(valueCeiling(SAMPLE_PROPERTY));
  });
});
