import { describe, it, expect } from "vitest";
import { underwrite } from "../engine";
import { rankProperties } from "../ranking";
import { rentalMath } from "../rental";
import { withDefaults } from "../defaults";
import { SCENARIOS } from "./scenarios";

describe("F1 — CapEx reserve lowers NOI (no silent optimism)", () => {
  it("adding a CapEx reserve reduces NOI vs no reserve", () => {
    const withCapex = SCENARIOS.strongRural.rental;
    const noCapex = { ...withCapex, capexPct: 0 };
    expect(rentalMath(noCapex).noi).toBeGreaterThan(rentalMath(withCapex).noi);
  });
});

describe("F2 — confidence tracks evidence quality", () => {
  it("strong recent nearby comps beat few far old high-dispersion comps", () => {
    const strong = underwrite(SCENARIOS.strongRural).confidence;
    const weak = underwrite(SCENARIOS.lowConfidenceValuation).confidence;
    expect(strong.valuation).toBeGreaterThan(weak.valuation);
    expect(strong.overall).toBeGreaterThan(weak.overall);
  });

  it("no comps yields lower valuation confidence than good comps", () => {
    const good = underwrite(SCENARIOS.strongRural).confidence.valuation;
    const none = underwrite(SCENARIOS.noComps).confidence.valuation;
    expect(good).toBeGreaterThanOrEqual(none);
  });
});

describe("F3 — unknown renovation is not treated as $0", () => {
  it("caps confidence and warns when reno is $0 with unverified condition", () => {
    const r = underwrite(SCENARIOS.unknownCondition);
    expect(r.confidence.overall).toBeLessThanOrEqual(45);
    expect(r.warnings.join(" ")).toMatch(/UNKNOWN is not \$0/i);
    // Cannot present as a clean STRONG BUY / BUY under unknown reno.
    expect(["STRONG_BUY", "BUY"]).not.toContain(r.verdict);
  });
});

describe("F4 — distinct bid ladder", () => {
  it("opportunistic <= conservative <= target <= max safe = walk-away", () => {
    const b = underwrite(SCENARIOS.excellentBrrrr).bid;
    expect(b.opportunisticBid).toBeLessThanOrEqual(b.conservativeBid);
    expect(b.conservativeBid).toBeLessThanOrEqual(b.targetBid);
    expect(b.targetBid).toBeLessThanOrEqual(b.maximumSafeBid);
    expect(b.walkAwayBid).toBe(b.maximumSafeBid);
  });
});

describe("F6 — MPAC assessment never anchors value", () => {
  it("changing assessment does not change value, max safe bid, or verdict", () => {
    const a = underwrite(SCENARIOS.misleadingAssessment);
    const b = underwrite(withDefaults({ ...SCENARIOS.misleadingAssessment, value: { ...SCENARIOS.misleadingAssessment.value, assessment: 999999 } }));
    expect(a.valuation!.base).toBe(b.valuation!.base);
    expect(a.bid.maximumSafeBid).toBe(b.bid.maximumSafeBid);
    expect(a.verdict).toBe(b.verdict);
    // Comp-derived value (~420k) must dominate, not the 600k assessment.
    expect(a.valuation!.base).toBeLessThan(500000);
  });
});

describe("F7 — determinism & AI independence", () => {
  it("same input yields byte-identical bids and score", () => {
    const a = JSON.stringify(underwrite(SCENARIOS.strongUrban).bid);
    const b = JSON.stringify(underwrite(SCENARIOS.strongUrban).bid);
    expect(a).toBe(b);
  });
  it("no AI configuration is read by the deterministic engine", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.PRIMARY_AI_PROVIDER;
    const r = underwrite(SCENARIOS.strongUrban);
    expect(r.bid.maximumSafeBid).toBeGreaterThan(0);
  });
});

describe("Fatal deal-killer overrides everything", () => {
  it("fatal property is STRONG_PASS and sorts last in ranking", () => {
    const items = Object.entries(SCENARIOS).map(([id, input]) => ({ id, name: id, input, result: underwrite(input) }));
    const ranked = rankProperties(items);
    const fatal = ranked.find((x) => x.id === "fatalDealKiller")!;
    expect(fatal.verdict).toBe("STRONG_PASS");
    expect(fatal.recommendedAction).toBe("PASS");
    expect(ranked[ranked.length - 1].hasFatal).toBe(true);
    // No fatal property should outrank a non-fatal one.
    const firstFatalIdx = ranked.findIndex((x) => x.hasFatal);
    const lastNonFatalIdx = ranked.map((x) => x.hasFatal).lastIndexOf(false);
    expect(firstFatalIdx).toBeGreaterThan(lastNonFatalIdx);
  });
});

describe("Opportunity ranking is transparent & deterministic", () => {
  const items = Object.entries(SCENARIOS).map(([id, input]) => ({ id, name: id, input, result: underwrite(input) }));

  it("subscores never exceed their caps and total is 0..100", () => {
    for (const r of rankProperties(items)) {
      expect(r.subscores.value).toBeLessThanOrEqual(20);
      expect(r.subscores.brrrr).toBeLessThanOrEqual(20);
      expect(r.subscores.cashFlow).toBeLessThanOrEqual(15);
      expect(r.subscores.risk).toBeLessThanOrEqual(20);
      expect(r.subscores.dataConfidence).toBeLessThanOrEqual(10);
      expect(r.subscores.rentalMarket).toBeLessThanOrEqual(10);
      expect(r.subscores.liquidity).toBeLessThanOrEqual(5);
      expect(r.total).toBeGreaterThanOrEqual(0);
      expect(r.total).toBeLessThanOrEqual(100);
    }
  });

  it("weak-rental and poor-cash-flow properties do not top the ranking", () => {
    const ranked = rankProperties(items);
    const top = ranked[0];
    expect(["weakRental", "fatalDealKiller"]).not.toContain(top.id);
  });

  it("is deterministic across runs", () => {
    const a = rankProperties(items).map((x) => x.id).join(",");
    const b = rankProperties(items).map((x) => x.id).join(",");
    expect(a).toBe(b);
  });
});
