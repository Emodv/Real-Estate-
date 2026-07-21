import type { BacktestOutcome } from "./backtest";

/**
 * Confidence calibration: does higher confidence actually correlate with
 * smaller prediction error? We only MEASURE this — we never auto-tune the
 * confidence formula from it (see docs/MODEL_GOVERNANCE.md).
 */
export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceBandStats {
  band: ConfidenceBand;
  n: number;
  medianAbsValuationErrorPct: number | null;
  falseBuyRate: number | null;
}

export interface ConfidenceCalibration {
  sufficient: boolean;
  bands: ConfidenceBandStats[];
  /** True when HIGH-confidence error < LOW-confidence error (both measurable). */
  highOutperformsLow: boolean | null;
  note: string;
}

/** Provisional governance rule: need this many records (and ≥2 per compared band). */
export const CONFIDENCE_MIN_SAMPLE = 12;

function bandOf(confidence: number): ConfidenceBand {
  if (confidence >= 70) return "HIGH";
  if (confidence >= 45) return "MEDIUM";
  return "LOW";
}

function median(nums: number[]): number | null {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? Math.round(s[mid] * 100) / 100 : Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100;
}

export function calibrateConfidence(outcomes: BacktestOutcome[]): ConfidenceCalibration {
  const groups: Record<ConfidenceBand, BacktestOutcome[]> = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const o of outcomes) groups[bandOf(o.prediction.predictedConfidence)].push(o);

  const bands: ConfidenceBandStats[] = (["HIGH", "MEDIUM", "LOW"] as ConfidenceBand[]).map((band) => {
    const g = groups[band];
    const absErrs = g
      .map((o) => o.comparison.valuationErrorPct)
      .filter((x): x is number => x !== null)
      .map(Math.abs);
    const buys = g.filter((o) => o.comparison.decision === "CORRECT_BUY" || o.comparison.decision === "FALSE_BUY");
    const falseBuys = g.filter((o) => o.comparison.decision === "FALSE_BUY").length;
    return {
      band,
      n: g.length,
      medianAbsValuationErrorPct: median(absErrs),
      falseBuyRate: buys.length > 0 ? Math.round((falseBuys / buys.length) * 100) / 100 : null,
    };
  });

  const high = bands.find((b) => b.band === "HIGH")!;
  const low = bands.find((b) => b.band === "LOW")!;
  const sufficient =
    outcomes.length >= CONFIDENCE_MIN_SAMPLE && high.n >= 2 && low.n >= 2 &&
    high.medianAbsValuationErrorPct !== null && low.medianAbsValuationErrorPct !== null;

  const highOutperformsLow = sufficient
    ? (high.medianAbsValuationErrorPct as number) < (low.medianAbsValuationErrorPct as number)
    : null;

  const note = !sufficient
    ? `INSUFFICIENT SAMPLE SIZE — need ≥${CONFIDENCE_MIN_SAMPLE} backtests with ≥2 in both HIGH and LOW bands to judge confidence calibration.`
    : highOutperformsLow
      ? "High-confidence properties show lower valuation error than low-confidence ones — confidence is informative."
      : "High-confidence properties are NOT outperforming low-confidence ones — confidence may be miscalibrated (log, do not auto-tune).";

  return { sufficient, bands, highOutperformsLow, note };
}
