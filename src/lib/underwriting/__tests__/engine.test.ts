import { describe, it, expect } from "vitest";
import { underwrite } from "../engine";
import { withDefaults } from "../defaults";
import { SAMPLE_PROPERTY } from "./fixtures";
import type { RiskItem } from "../types";

describe("underwrite() orchestration", () => {
  it("produces a complete, finite result on the sample", () => {
    const r = underwrite(SAMPLE_PROPERTY);
    expect(r.bid.maximumSafeBid).toBeGreaterThan(0);
    expect(Number.isFinite(r.bid.conservativeBid)).toBe(true);
    expect(r.bid.conservativeBid).toBeLessThanOrEqual(r.bid.targetBid);
    expect(r.bid.targetBid).toBeLessThanOrEqual(r.bid.maximumSafeBid);
    expect(r.bid.hardStop).toBe(r.bid.maximumSafeBid);
    expect(r.score.total).toBeGreaterThanOrEqual(0);
    expect(r.score.total).toBeLessThanOrEqual(100);
    expect(r.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(r.confidence.overall).toBeLessThanOrEqual(100);
  });

  it("the binding constraint equals the max safe bid", () => {
    const r = underwrite(SAMPLE_PROPERTY);
    const binding = r.bid.ceilings.find((c) => c.key === r.bid.bindingConstraint);
    expect(binding).toBeDefined();
    expect(binding?.amount).toBeCloseTo(r.bid.maximumSafeBid, -1);
  });

  it("a FATAL risk forces STRONG_PASS regardless of a high score", () => {
    const fatal: RiskItem = {
      category: "ACCESS",
      severity: "FATAL",
      label: "Landlocked — no legal access",
      dataStatus: "VERIFIED",
    };
    const withFatal = withDefaults({ ...SAMPLE_PROPERTY, risks: [fatal] });
    const r = underwrite(withFatal);
    expect(r.dealKillers.hasFatal).toBe(true);
    expect(r.verdict).toBe("STRONG_PASS");
    expect(r.committee.buyOnlyIf.toLowerCase()).toContain("not buy");
  });

  it("max safe bid below minimum tender -> PASS/STRONG_PASS", () => {
    const overpriced = withDefaults({
      ...SAMPLE_PROPERTY,
      taxSale: { ...SAMPLE_PROPERTY.taxSale, minimumTender: 500000 },
    });
    const r = underwrite(overpriced);
    expect(["PASS", "STRONG_PASS"]).toContain(r.verdict);
  });

  it("critical unknown (title) prevents STRONG_BUY", () => {
    const r = underwrite(SAMPLE_PROPERTY); // sample has an UNKNOWN title risk
    expect(r.dealKillers.hasCriticalUnknown).toBe(true);
    expect(r.verdict).not.toBe("STRONG_BUY");
    expect(r.verdict).not.toBe("BUY");
  });

  it("never throws and never emits NaN on empty input", () => {
    const r = underwrite(withDefaults({}));
    expect(Number.isFinite(r.bid.maximumSafeBid)).toBe(true);
    expect(Number.isFinite(r.score.total)).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("is deterministic: same input -> same output", () => {
    const a = JSON.stringify(underwrite(SAMPLE_PROPERTY).bid.ceilings);
    const b = JSON.stringify(underwrite(SAMPLE_PROPERTY).bid.ceilings);
    expect(a).toBe(b);
  });

  it("SWOT statements always carry evidence", () => {
    const r = underwrite(SAMPLE_PROPERTY);
    const all = [
      ...r.swot.strengths,
      ...r.swot.weaknesses,
      ...r.swot.opportunities,
      ...r.swot.threats,
    ];
    for (const item of all) {
      expect(item.evidence.length).toBeGreaterThan(0);
    }
  });

  it("value math lines reconcile to the value ceiling", () => {
    const r = underwrite(SAMPLE_PROPERTY);
    const lines = r.bid.valueMathLines;
    const result = lines.find((l) => l.op === "result");
    expect(result).toBeDefined();
    // Running the additive/subtractive lines should land near the result.
    const running = lines
      .filter((l) => l.op === "info" || l.op === "add" || l.op === "subtract")
      .reduce((acc, l) => acc + l.amount, 0);
    expect(Math.abs(running - (result?.amount ?? 0))).toBeLessThan(2000);
  });
});
