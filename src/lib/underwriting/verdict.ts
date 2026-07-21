import type {
  BrrrrResult,
  ConfidenceScore,
  DealKillerReport,
  InvestmentCommittee,
  InvestmentScore,
  UnderwritingInput,
  Verdict,
} from "./types";
import { num, safeDivide } from "./money";

/**
 * The verdict is intentionally NOT a pure function of the score. Gating rules
 * dominate: a fatal deal-killer, a bid ceiling below the reserve, or a critical
 * unknown can veto an otherwise attractive score. The system prefers
 * "NO DEAL" over "BAD DEAL".
 */
export function computeVerdict(
  input: UnderwritingInput,
  maxSafeBid: number,
  score: InvestmentScore,
  risk: DealKillerReport,
  confidence: ConfidenceScore,
): { verdict: Verdict; warnings: string[] } {
  const warnings: string[] = [];
  const tender = num(input.taxSale.minimumTender);

  // Gate 1 — fatal deal-killer -> never a buy.
  if (risk.hasFatal) {
    warnings.push("A fatal deal-killer is present. Verdict capped at STRONG PASS.");
    return { verdict: "STRONG_PASS", warnings };
  }

  // Gate 2 — cannot win at or below the max safe bid (reserve too high).
  if (tender > 0 && maxSafeBid < tender) {
    warnings.push(
      `Maximum safe bid ($${Math.round(maxSafeBid).toLocaleString()}) is below the minimum tender ($${Math.round(tender).toLocaleString()}). Winning requires overpaying.`,
    );
    return { verdict: maxSafeBid < tender * 0.9 ? "STRONG_PASS" : "PASS", warnings };
  }

  const headroom = tender > 0 ? safeDivide(maxSafeBid - tender, tender, 0) : 0;

  // Gate 3 — critical unknown -> at most CONDITIONAL / WATCH.
  if (risk.hasCriticalUnknown) {
    warnings.push("A critical unknown (title / access / environmental / structural) requires verification before bidding.");
    if (score.total >= 60 && headroom >= 0.15) {
      return { verdict: "CONDITIONAL_BUY", warnings };
    }
    return { verdict: "WATCH", warnings };
  }

  // Gate 4 — low confidence caps enthusiasm.
  if (confidence.overall < 45) {
    warnings.push("Overall confidence is low; treat all figures as provisional.");
    if (score.total >= 65 && headroom >= 0.2) return { verdict: "CONDITIONAL_BUY", warnings };
    return { verdict: "WATCH", warnings };
  }

  // Score + headroom driven ranking.
  if (score.total >= 80 && headroom >= 0.25) return { verdict: "STRONG_BUY", warnings };
  if (score.total >= 65 && headroom >= 0.1) return { verdict: "BUY", warnings };
  if (score.total >= 50) return { verdict: "WATCH", warnings };
  return { verdict: "PASS", warnings };
}

export function buildCommittee(
  input: UnderwritingInput,
  verdict: Verdict,
  atMaxSafeBid: BrrrrResult,
  maxSafeBid: number,
  risk: DealKillerReport,
): InvestmentCommittee {
  const missing: string[] = [];
  for (const r of input.risks) {
    if (r.severity === "UNKNOWN" || r.dataStatus === "UNKNOWN") {
      missing.push(`Verify ${r.category.toLowerCase()}: ${r.label}`);
    }
  }
  if (input.renovation.confidence < 50) missing.push("Obtain a property condition / renovation scope inspection.");
  if (input.evidence.filter((e) => /comp|sale/i.test(e.claim)).length < 3) {
    missing.push("Gather at least 3 comparable sales to firm up the valuation.");
  }
  if (input.evidence.filter((e) => /rent/i.test(e.claim)).length === 0) {
    missing.push("Confirm market rent with local rental comparables.");
  }

  const keyRisks = [...risk.high, ...risk.unknowns]
    .slice(0, 6)
    .map((r) => `${r.label} (${r.category}, ${r.severity})`);

  const dealKillers = risk.fatal.map((r) => `${r.label} (${r.category})`);

  const thesis =
    atMaxSafeBid.equityCreatedVsCost > 0
      ? `Acquire below intrinsic value, renovate to a conservative ARV of $${Math.round(num(input.refinance.arv)).toLocaleString()}, refinance to recover ${Math.round(atMaxSafeBid.capitalRecoveryPct * 100)}% of invested capital, and hold for $${Math.round(atMaxSafeBid.monthlyCashFlow).toLocaleString()}/mo cash flow.`
      : "The current assumptions do not create equity above all-in cost; the thesis only works at a materially lower purchase price.";

  const buyOnlyIf = buildBuyOnlyIf(input, verdict, maxSafeBid, risk);

  return { thesis, keyRisks, dealKillers, missingInformation: missing, buyOnlyIf };
}

function buildBuyOnlyIf(
  input: UnderwritingInput,
  verdict: Verdict,
  maxSafeBid: number,
  risk: DealKillerReport,
): string {
  if (verdict === "STRONG_PASS") {
    return "I would not buy this property under any bid — a fatal issue or unviable economics is present.";
  }
  const conditions: string[] = [`the winning bid stays at or below the maximum safe bid of $${Math.round(maxSafeBid).toLocaleString()}`];
  if (risk.hasCriticalUnknown || risk.unknowns.length > 0) {
    conditions.push("the outstanding title / access / environmental unknowns are verified clean");
  }
  if (input.renovation.confidence < 60) {
    conditions.push("a physical inspection confirms the renovation budget");
  }
  return `I would buy this property only if ${conditions.join(", and ")}.`;
}
