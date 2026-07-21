import { describe, it, expect } from "vitest";
import { runBacktest, scoreBacktests, type BacktestOutcome } from "../backtest";
import { calibrateConfidence, CONFIDENCE_MIN_SAMPLE } from "../confidenceCalibration";
import { assessModelHealth } from "../modelHealth";
import { SAMPLE_PROPERTY } from "@/lib/underwriting/__tests__/fixtures";

function outcome(winningBid: number, extra = {}): BacktestOutcome {
  return runBacktest(SAMPLE_PROPERTY, { actualWinningBid: winningBid, ...extra });
}

describe("bid-gap classification", () => {
  it("classifies overbid / within-safe / above-target", () => {
    const over = outcome(500000).comparison;
    expect(over.bidClass).toBe("OVERBID");
    const cheap = outcome(50000).comparison;
    expect(["BOUGHT_WITHIN_SAFE", "ABOVE_TARGET_BELOW_MAX"]).toContain(cheap.bidClass);
  });

  it("scorecard tallies bid classes", () => {
    const card = scoreBacktests([{ outcome: outcome(500000) }, { outcome: outcome(50000) }]);
    expect(card.overbid + card.boughtWithinSafe + card.aboveTargetBelowMax).toBe(2);
  });
});

describe("model health governance", () => {
  it("is INSUFFICIENT_DATA below the backtest threshold", () => {
    const card = scoreBacktests([{ outcome: outcome(120000) }]);
    const health = assessModelHealth(card, calibrateConfidence([outcome(120000)]));
    expect(health.status).toBe("INSUFFICIENT_DATA");
    expect(health.headline).toMatch(/INSUFFICIENT DATA/i);
  });

  it("does not call three passing tests a validated model", () => {
    const outs = [outcome(120000), outcome(110000), outcome(100000)];
    const card = scoreBacktests(outs.map((o) => ({ outcome: o })));
    const health = assessModelHealth(card, calibrateConfidence(outs));
    expect(health.status).not.toBe("GREEN");
  });
});

describe("confidence calibration", () => {
  it("flags insufficient sample size honestly", () => {
    const cal = calibrateConfidence([outcome(120000)]);
    expect(cal.sufficient).toBe(false);
    expect(cal.highOutperformsLow).toBeNull();
    expect(cal.note).toMatch(/INSUFFICIENT SAMPLE SIZE/i);
  });

  it("groups into HIGH/MEDIUM/LOW bands", () => {
    const cal = calibrateConfidence(Array.from({ length: CONFIDENCE_MIN_SAMPLE }, () => outcome(120000, { actualSalePriceLater: 400000 })));
    expect(cal.bands.map((b) => b.band).sort()).toEqual(["HIGH", "LOW", "MEDIUM"]);
    expect(cal.bands.reduce((s, b) => s + b.n, 0)).toBe(CONFIDENCE_MIN_SAMPLE);
  });
});
