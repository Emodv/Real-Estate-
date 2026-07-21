import type { DealKillerReport, RiskItem, RiskSeverity } from "./types";
import { clamp } from "./money";

const SEVERITY_WEIGHT: Record<RiskSeverity, number> = {
  FATAL: 100,
  HIGH: 22,
  MEDIUM: 10,
  LOW: 3,
  UNKNOWN: 14, // an unknown is treated as materially risky — never as "safe"
};

/**
 * Additional margin-of-safety percentage demanded by identified risks.
 * Capped so the risk-adjusted ceiling never collapses to nonsense.
 */
export function riskPremiumPct(risks: RiskItem[]): number {
  let premium = 0;
  for (const r of risks) {
    switch (r.severity) {
      case "FATAL":
        premium += 0.25;
        break;
      case "HIGH":
        premium += 0.06;
        break;
      case "UNKNOWN":
        premium += 0.04;
        break;
      case "MEDIUM":
        premium += 0.02;
        break;
      case "LOW":
        premium += 0.005;
        break;
    }
  }
  return clamp(premium, 0, 0.4);
}

export function dealKillerReport(risks: RiskItem[]): DealKillerReport {
  const fatal = risks.filter(
    (r) => r.severity === "FATAL" || (r.fatalIfConfirmed && r.severity !== "LOW"),
  );
  const high = risks.filter((r) => r.severity === "HIGH");
  const unknowns = risks.filter((r) => r.severity === "UNKNOWN" || r.dataStatus === "UNKNOWN");

  const hasFatal = risks.some((r) => r.severity === "FATAL");
  // A critical unknown = an unknown flagged as potentially fatal, or any
  // unknown in a category that can kill a deal (title / access / environmental).
  const criticalCategories = new Set(["TITLE", "ACCESS", "ENVIRONMENTAL", "FLOOD", "STRUCTURAL"]);
  const hasCriticalUnknown = unknowns.some(
    (r) => r.fatalIfConfirmed || criticalCategories.has(r.category),
  );

  let raw = 0;
  for (const r of risks) raw += SEVERITY_WEIGHT[r.severity] ?? 0;
  // Normalize: a single FATAL saturates; otherwise scale from accumulated weight.
  const riskScore = hasFatal ? 100 : clamp(Math.round(raw), 0, 95);

  return { hasFatal, hasCriticalUnknown, fatal, high, unknowns, riskScore };
}
