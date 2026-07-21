import { describe, it, expect } from "vitest";
import { ontarioLandTransferTax, acquisitionCosts, landTransferTax } from "../acquisition";
import type { AcquisitionInput } from "../types";

describe("Ontario Land Transfer Tax", () => {
  it("computes known marginal-bracket values", () => {
    // $200,000: 0.5%*55k + 1%*145k = 275 + 1450 = 1725
    expect(ontarioLandTransferTax(200000)).toBe(1725);
    // $300,000: 275 + 1950 + 750 = 2975
    expect(ontarioLandTransferTax(300000)).toBe(2975);
    // $400,000: 275 + 1950 + 2250 = 4475
    expect(ontarioLandTransferTax(400000)).toBe(4475);
    // $500,000: 4475 + 2%*100k = 6475
    expect(ontarioLandTransferTax(500000)).toBe(6475);
  });

  it("returns 0 for non-positive price", () => {
    expect(ontarioLandTransferTax(0)).toBe(0);
    expect(ontarioLandTransferTax(-100)).toBe(0);
  });

  it("doubles roughly with Toronto MLTT", () => {
    const input: AcquisitionInput = {
      landTransferTaxMode: "ontario",
      includeTorontoMLTT: true,
      legalFees: 0,
      titleInsurance: 0,
      otherClosingCosts: 0,
    };
    expect(landTransferTax(300000, input)).toBe(2975 * 2);
  });

  it("supports percent and flat modes", () => {
    const percent: AcquisitionInput = {
      landTransferTaxMode: "percent",
      landTransferTaxPct: 0.015,
      legalFees: 0,
      titleInsurance: 0,
      otherClosingCosts: 0,
    };
    expect(landTransferTax(200000, percent)).toBe(3000);

    const flat: AcquisitionInput = {
      landTransferTaxMode: "flat",
      landTransferTaxFlat: 5000,
      legalFees: 0,
      titleInsurance: 0,
      otherClosingCosts: 0,
    };
    expect(landTransferTax(999999, flat)).toBe(5000);
  });

  it("sums closing costs", () => {
    const input: AcquisitionInput = {
      landTransferTaxMode: "ontario",
      legalFees: 2500,
      titleInsurance: 800,
      otherClosingCosts: 1500,
    };
    // LTT(300k)=2975 + 2500 + 800 + 1500 = 7775
    expect(acquisitionCosts(300000, input)).toBe(7775);
  });
});
