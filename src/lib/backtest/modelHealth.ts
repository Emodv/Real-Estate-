import type { BacktestScorecard } from "./backtest";
import type { ConfidenceCalibration } from "./confidenceCalibration";

/**
 * Model Health — provisional governance status, NOT scientific truth.
 * GREEN is deliberately hard: it is never "a few tests passed".
 */
export type HealthStatus = "RED" | "YELLOW" | "GREEN" | "INSUFFICIENT_DATA";

/** Provisional governance thresholds (documented in docs/MODEL_GOVERNANCE.md). */
export const HEALTH_THRESHOLDS = {
  minBacktests: 20,
  maxFalseBuyRate: 0.05, // 5%
  maxMedianAbsValuationErrorPct: 15,
  maxRenovationUnderestimatePct: 18, // median reno error below −18% = systematic underestimation
};

export interface HealthCheck {
  label: string;
  pass: boolean | null; // null = not enough data to evaluate
  detail: string;
}

export interface ModelHealth {
  status: HealthStatus;
  headline: string;
  checks: HealthCheck[];
  thresholds: typeof HEALTH_THRESHOLDS;
}

export function assessModelHealth(
  card: BacktestScorecard,
  confidence: ConfidenceCalibration,
): ModelHealth {
  const t = HEALTH_THRESHOLDS;
  const checks: HealthCheck[] = [];

  const enoughData = card.total >= t.minBacktests;
  checks.push({
    label: `At least ${t.minBacktests} backtests`,
    pass: enoughData,
    detail: `${card.total} recorded.`,
  });

  const fbr = card.falseBuyRate;
  checks.push({
    label: `False-BUY rate ≤ ${Math.round(t.maxFalseBuyRate * 100)}%`,
    pass: fbr === null ? null : fbr <= t.maxFalseBuyRate,
    detail: fbr === null ? "No conclusive BUYs yet." : `${Math.round(fbr * 100)}%.`,
  });

  const mav = card.medianAbsValuationErrorPct;
  checks.push({
    label: `Median abs. valuation error ≤ ${t.maxMedianAbsValuationErrorPct}%`,
    pass: mav === null ? null : mav <= t.maxMedianAbsValuationErrorPct,
    detail: mav === null ? "No valuation actuals yet." : `${mav}%.`,
  });

  const mReno = card.medianRenovationErrorPct;
  checks.push({
    label: "No systematic renovation underestimation",
    pass: mReno === null ? null : mReno >= -t.maxRenovationUnderestimatePct,
    detail: mReno === null ? "No renovation actuals yet." : `median reno error ${mReno}%.`,
  });

  checks.push({
    label: "High confidence outperforms low confidence",
    pass: confidence.highOutperformsLow,
    detail: confidence.note,
  });

  let status: HealthStatus;
  let headline: string;
  if (!enoughData) {
    status = "INSUFFICIENT_DATA";
    headline = `INSUFFICIENT DATA — ${card.total}/${t.minBacktests} backtests. The model is not validated; do not rely on it for capital decisions yet.`;
  } else {
    const evaluable = checks.filter((c) => c.pass !== null);
    const anyFail = evaluable.some((c) => c.pass === false);
    const allPass = evaluable.length > 0 && evaluable.every((c) => c.pass === true);
    // A high false-BUY rate is an automatic RED.
    const falseBuyBad = fbr !== null && fbr > t.maxFalseBuyRate;
    if (falseBuyBad) {
      status = "RED";
      headline = "RED — false-BUY rate exceeds the safety threshold. Do not trust BUY recommendations.";
    } else if (allPass) {
      status = "GREEN";
      headline = "GREEN — validated against sufficient historical data under the current provisional thresholds.";
    } else if (anyFail) {
      status = "YELLOW";
      headline = "YELLOW — enough data, but one or more governance checks fail. Review before trusting.";
    } else {
      status = "YELLOW";
      headline = "YELLOW — promising but some checks are not yet evaluable.";
    }
  }

  return { status, headline, checks, thresholds: t };
}
