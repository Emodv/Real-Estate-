import { describe, it, expect } from "vitest";
import { underwrite } from "../engine";
import { buildMemo } from "../memo";
import { withDefaults } from "../defaults";
import { SAMPLE_PROPERTY } from "./fixtures";

describe("buildMemo", () => {
  const result = underwrite(SAMPLE_PROPERTY);
  const memo = buildMemo(SAMPLE_PROPERTY, result);

  it("mirrors engine numbers exactly (no independent calculation)", () => {
    expect(memo.executive.maximumSafeBid).toBe(result.bid.maximumSafeBid);
    expect(memo.executive.targetBid).toBe(result.bid.targetBid);
    expect(memo.executive.dealScore).toBe(result.score.total);
    expect(memo.executive.confidence).toBe(result.confidence.overall);
    expect(memo.executive.capitalLeftAfterRefinance).toBe(result.bid.atMaxSafeBid.capitalTrapped);
    expect(memo.brrrr.totalProjectCost).toBe(result.bid.atMaxSafeBid.totalProjectCost);
    expect(memo.rental.noi).toBe(result.bid.atMaxSafeBid.noi);
  });

  it("never anchors on assessment", () => {
    expect(memo.valuation.usesAssessmentAsAnchor).toBe(false);
  });

  it("carries all required sections", () => {
    for (const key of [
      "header", "executive", "thesis", "bidStrategy", "showMath", "valuation",
      "renovation", "rental", "brrrr", "sensitivity", "dealKillers", "unknowns",
      "swot", "finalDecision",
    ]) {
      expect(memo).toHaveProperty(key);
    }
  });

  it("selects best-recovery and best-cashflow scenarios from existing scenarios", () => {
    const ltvs = result.refinanceScenarios.map((s) => s.ltv);
    expect(ltvs).toContain(memo.brrrr.bestCapitalRecoveryLtv);
    expect(ltvs).toContain(memo.brrrr.bestCashFlowLtv);
  });

  it("surfaces the title unknown with verification guidance", () => {
    const title = memo.unknowns.find((u) => u.category === "TITLE");
    expect(title).toBeDefined();
    expect(title!.howToVerify.toLowerCase()).toContain("title");
    expect(memo.finalDecision.nextAction).toMatch(/TITLE/i);
  });

  it("thesis provides <=3 reasons each side", () => {
    expect(memo.thesis.reasonsToBuy.length).toBeLessThanOrEqual(3);
    expect(memo.thesis.reasonsNotToBuy.length).toBeLessThanOrEqual(3);
  });

  it("a fatal risk drives PASS as the next action", () => {
    const fatal = withDefaults({
      ...SAMPLE_PROPERTY,
      risks: [{ category: "ACCESS", severity: "FATAL", label: "Landlocked", dataStatus: "VERIFIED" }],
    });
    const memoF = buildMemo(fatal, underwrite(fatal));
    expect(memoF.finalDecision.decision).toBe("STRONG_PASS");
    expect(memoF.finalDecision.nextAction.toUpperCase()).toContain("PASS");
  });
});
