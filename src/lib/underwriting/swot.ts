import type { BrrrrResult, Swot, SwotItem, UnderwritingInput } from "./types";
import { num } from "./money";

/**
 * Deterministic, evidence-referenced SWOT. This is NOT AI-generated fluff —
 * every statement is produced by a rule triggered by a concrete data point,
 * and cites the source of that data point.
 */
export function computeSwot(input: UnderwritingInput, atMaxSafeBid: BrrrrResult): Swot {
  const strengths: SwotItem[] = [];
  const weaknesses: SwotItem[] = [];
  const opportunities: SwotItem[] = [];
  const threats: SwotItem[] = [];

  const asIs = num(input.value.conservativeAsIs);
  const tender = num(input.taxSale.minimumTender);

  // Strengths -------------------------------------------------------------
  if (tender > 0 && asIs > 0 && tender / asIs < 0.5) {
    strengths.push({
      statement: `Minimum tender ($${Math.round(tender).toLocaleString()}) is well below conservative as-is value ($${Math.round(asIs).toLocaleString()}).`,
      evidence: "Tax sale minimum tender vs. conservative valuation",
      confidence: "Medium",
    });
  }
  if (atMaxSafeBid.capitalRecoveryPct >= 0.9) {
    strengths.push({
      statement: `BRRRR recovers ~${Math.round(atMaxSafeBid.capitalRecoveryPct * 100)}% of invested capital at the max safe bid.`,
      evidence: "Deterministic BRRRR model (refinance proceeds vs. cash invested)",
      confidence: "High",
    });
  }
  if (atMaxSafeBid.monthlyCashFlow > 0) {
    strengths.push({
      statement: `Positive projected cash flow of $${Math.round(atMaxSafeBid.monthlyCashFlow).toLocaleString()}/month after refinance.`,
      evidence: "NOI less stabilized debt service",
      confidence: "Medium",
    });
  }
  if ((input.meta.lotSizeAcres ?? 0) >= 1) {
    strengths.push({
      statement: `${input.meta.lotSizeAcres}-acre lot.`,
      evidence: "Property listing (user-provided)",
      confidence: "Medium",
    });
  }
  if (input.meta.waterfront) {
    strengths.push({
      statement: "Waterfront property — differentiated demand.",
      evidence: "Property listing (user-provided)",
      confidence: "Medium",
    });
  }

  // Weaknesses ------------------------------------------------------------
  if (atMaxSafeBid.monthlyCashFlow <= 0) {
    weaknesses.push({
      statement: `Non-positive cash flow ($${Math.round(atMaxSafeBid.monthlyCashFlow).toLocaleString()}/month) at the max safe bid.`,
      evidence: "NOI less stabilized debt service",
      confidence: "High",
    });
  }
  if (input.renovation.confidence < 50) {
    weaknesses.push({
      statement: "Renovation scope is uncertain — condition largely unverified.",
      evidence: `Renovation confidence ${input.renovation.confidence}/100`,
      confidence: "High",
    });
  }
  if (atMaxSafeBid.equityCreatedVsCost < 0) {
    weaknesses.push({
      statement: "All-in project cost exceeds conservative ARV — no equity created at this price.",
      evidence: "ARV less total project cost",
      confidence: "High",
    });
  }

  // Opportunities ---------------------------------------------------------
  const arv = num(input.refinance.arv);
  if (arv > asIs * 1.15) {
    opportunities.push({
      statement: "Renovation is projected to lift value meaningfully above as-is (forced appreciation).",
      evidence: "Conservative ARV vs. conservative as-is value",
      confidence: "Medium",
    });
  }
  if (atMaxSafeBid.capitalTrapped <= 0) {
    opportunities.push({
      statement: "Full capital recovery possible — capital can be recycled into the next deal.",
      evidence: "Refinance proceeds exceed cash invested",
      confidence: "Medium",
    });
  }

  // Threats ---------------------------------------------------------------
  if (input.meta.rural) {
    threats.push({
      statement: "Rural market — thinner buyer pool and slower resale/refinance liquidity.",
      evidence: "Property location (user-provided)",
      confidence: "Medium",
    });
  }
  for (const r of input.risks) {
    if (r.severity === "FATAL" || r.severity === "HIGH" || r.fatalIfConfirmed) {
      threats.push({
        statement: `${r.label}${r.detail ? ` — ${r.detail}` : ""}`,
        evidence: `Risk register (${r.category}, ${r.severity}, ${r.dataStatus})`,
        confidence: r.dataStatus === "VERIFIED" ? "High" : "Low",
      });
    }
  }

  return { strengths, weaknesses, opportunities, threats };
}
