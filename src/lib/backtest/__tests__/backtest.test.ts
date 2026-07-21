import { describe, it, expect } from "vitest";
import { runBacktest, scoreBacktests, type BacktestActuals } from "../backtest";
import { withDefaults } from "@/lib/underwriting";
import { SAMPLE_PROPERTY } from "@/lib/underwriting/__tests__/fixtures";

const actuals: BacktestActuals = {
  actualWinningBid: 150000,
  actualSalePriceLater: 410000,
  actualArv: 415000,
  actualRenovation: 85000,
  actualMonthlyRent: 3300,
};

describe("runBacktest — hindsight protection", () => {
  it("prediction does NOT depend on the actuals (no future-info leakage)", () => {
    const a = runBacktest(SAMPLE_PROPERTY, actuals);
    const b = runBacktest(SAMPLE_PROPERTY, {
      ...actuals,
      actualWinningBid: 999999,
      actualSalePriceLater: 10,
      actualArv: 10,
      actualRenovation: 10,
      actualMonthlyRent: 10,
    });
    // The prediction block must be byte-identical regardless of actuals.
    expect(JSON.stringify(a.prediction)).toBe(JSON.stringify(b.prediction));
  });

  it("computes could-have-won and bid gap from actual winning bid", () => {
    const o = runBacktest(SAMPLE_PROPERTY, actuals);
    expect(o.comparison.actualWinningBid).toBe(150000);
    expect(o.comparison.couldWeHaveWon).toBe(o.prediction.predictedMaxSafeBid >= 150000);
    expect(o.comparison.bidGapVsMaxSafe).toBeCloseTo(150000 - o.prediction.predictedMaxSafeBid, 0);
  });

  it("error metrics are null when the corresponding actual is absent", () => {
    const o = runBacktest(SAMPLE_PROPERTY, { actualWinningBid: 150000 });
    expect(o.comparison.valuationErrorPct).toBeNull();
    expect(o.comparison.arvErrorPct).toBeNull();
    expect(o.comparison.rentErrorPct).toBeNull();
  });

  it("a fatal-risk pre-sale property predicts STRONG_PASS and would-not-bid", () => {
    const input = withDefaults({
      ...SAMPLE_PROPERTY,
      risks: [{ category: "ACCESS", severity: "FATAL", label: "Landlocked", dataStatus: "VERIFIED" }],
    });
    const o = runBacktest(input, actuals);
    expect(o.prediction.predictedVerdict).toBe("STRONG_PASS");
    expect(o.comparison.wouldWeBid).toBe(false);
  });

  it("a max-safe-bid below the winning bid means we would NOT have overpaid", () => {
    // Very high winning bid -> we could not have won at/under our ceiling.
    const o = runBacktest(SAMPLE_PROPERTY, { actualWinningBid: 500000 });
    expect(o.comparison.couldWeHaveWon).toBe(false);
    expect(o.comparison.bidGapVsMaxSafe).toBeGreaterThan(0);
  });
});

describe("decision classification (false BUY / false PASS)", () => {
  it("flags a FALSE_BUY when reality (actuals) makes a recommended deal fail", () => {
    // Pre-sale looks buyable; actuals reveal much worse value + rent + reno.
    const o = runBacktest(SAMPLE_PROPERTY, {
      actualWinningBid: 130000,
      actualArv: 150000, // far below predicted ARV
      actualMonthlyRent: 900, // far below predicted rent
      actualRenovation: 180000, // blew the budget
    });
    if (["STRONG_BUY", "BUY", "CONDITIONAL_BUY"].includes(o.prediction.predictedVerdict)) {
      expect(o.comparison.decision).toBe("FALSE_BUY");
    } else {
      expect(["CORRECT_PASS", "INCONCLUSIVE"]).toContain(o.comparison.decision);
    }
  });

  it("is INCONCLUSIVE without post-sale value/rent actuals", () => {
    const o = runBacktest(SAMPLE_PROPERTY, { actualWinningBid: 130000 });
    expect(o.comparison.decision).toBe("INCONCLUSIVE");
  });

  it("scorecard exposes falseBuy count and rate", () => {
    const bad = runBacktest(SAMPLE_PROPERTY, { actualWinningBid: 130000, actualArv: 150000, actualMonthlyRent: 900, actualRenovation: 180000 });
    const card = scoreBacktests([{ outcome: bad }]);
    expect(card).toHaveProperty("falseBuy");
    expect(card).toHaveProperty("falseBuyRate");
    expect(card).toHaveProperty("medianValuationErrorPct");
  });
});

describe("scoreBacktests", () => {
  it("aggregates verdict counts and outcomes", () => {
    const good = runBacktest(SAMPLE_PROPERTY, { actualWinningBid: 120000, actualSalePriceLater: 410000 });
    const outbid = runBacktest(SAMPLE_PROPERTY, { actualWinningBid: 500000 });
    const card = scoreBacktests([{ outcome: good }, { outcome: outbid }]);
    expect(card.total).toBe(2);
    expect(card.strongBuy + card.buy + card.watch + card.pass + card.strongPass).toBe(2);
    expect(card.avgValuationErrorPct).not.toBeNull();
  });

  it("empty set yields zeroes and null averages without throwing", () => {
    const card = scoreBacktests([]);
    expect(card.total).toBe(0);
    expect(card.avgValuationErrorPct).toBeNull();
    expect(card.totalCapitalIfBidAtMaxSafe).toBe(0);
  });
});
